import * as T from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';

// One material download set per renderer; scene regeneration never owns these textures.
export class Surfaces {
  private materials = new Set<T.MeshStandardMaterial>();
  private textures = new Map<string, T.Texture>();
  private stagedTextures = new Set<T.Texture>();
  private environment: T.WebGLRenderTarget | null = null;
  private disposed = false;
  track(material: T.MeshStandardMaterial) {
    if (this.disposed || !material.userData.surface || this.materials.has(material)) return;
    this.materials.add(material);
    material.addEventListener('dispose', () => this.materials.delete(material));
    this.apply(material);
  }
  private apply(material: T.MeshStandardMaterial) {
    const brick = material.userData.surface === 'brick';
    const map =
      this.textures.get(
        material.userData.surface === 'grass'
          ? 'grass-color'
          : brick
            ? 'brick-color'
            : 'concrete-color',
      ) || null;
    const finish = brick ? 'brick' : material.userData.surface === 'concrete' ? 'concrete' : null;
    const normal = finish ? this.textures.get(`${finish}-normal`) || null : material.normalMap;
    const roughness = finish ? this.textures.get(`${finish}-rough`) || null : material.roughnessMap;
    if (finish) material.normalScale.setScalar(brick ? 0.25 : 0.55);
    if (
      material.map === map &&
      material.normalMap === normal &&
      material.roughnessMap === roughness
    )
      return;
    material.map = map;
    material.normalMap = normal;
    material.roughnessMap = roughness;
    material.needsUpdate = true;
  }
  async load(renderer: T.WebGLRenderer, scene: T.Scene) {
    if (this.disposed) return;
    const loader = new T.TextureLoader();
    const compressed =
      renderer.extensions &&
      [
        'WEBGL_compressed_texture_astc',
        'WEBGL_compressed_texture_etc',
        'WEBGL_compressed_texture_s3tc',
        'EXT_texture_compression_bptc',
        'WEBGL_compressed_texture_pvrtc',
        'WEBKIT_WEBGL_compressed_texture_pvrtc',
        'WEBGL_compressed_texture_etc1',
      ].some((name) => renderer.extensions.has(name))
        ? new KTX2Loader()
            .setTranscoderPath('/materials/basis/')
            .setWorkerLimit(1)
            .detectSupport(renderer)
        : null;
    const loadTexture = async (name: string): Promise<T.Texture> => {
      if (compressed) {
        try {
          return await compressed.loadAsync(`/materials/${name}.ktx2`);
        } catch (error) {
          if (this.disposed) throw error;
        }
      }
      return loader.loadAsync(`/materials/${name}.jpg`);
    };
    const loadMaps = async (names: string[]) => {
      const results = await Promise.allSettled(
        names.map(async (name) => {
          const texture = await loadTexture(name);
          if (this.disposed) {
            texture.dispose();
            return null;
          }
          this.stagedTextures.add(texture);
          texture.wrapS = texture.wrapT = T.RepeatWrapping;
          // Thirteen courses per scan retain approximately 0.03-unit courses.
          if (name.startsWith('brick-')) texture.repeat.setScalar(0.65);
          texture.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
          if (name.endsWith('color')) texture.colorSpace = T.SRGBColorSpace;
          return { name, texture };
        }),
      );
      // Publish a complete finish together; newly tracked materials cannot see
      // half of a still-loading brick set. Failed maps retain their fallback.
      for (const result of results) {
        if (result.status !== 'fulfilled' || !result.value) continue;
        const { name, texture } = result.value;
        this.stagedTextures.delete(texture);
        if (!this.disposed) this.textures.set(name, texture);
      }
      if (!this.disposed) this.materials.forEach((material) => this.apply(material));
    };
    await Promise.allSettled([
      loadMaps(['brick-color', 'brick-normal', 'brick-rough']),
      loadMaps(['concrete-color', 'concrete-normal', 'concrete-rough']),
      loadMaps(['grass-color']),
      (async () => {
        const hdr = await new HDRLoader().loadAsync('/materials/sky.hdr');
        if (this.disposed) {
          hdr.dispose();
          return;
        }
        const pmrem = new T.PMREMGenerator(renderer);
        this.environment = pmrem.fromEquirectangular(hdr);
        scene.environment = this.environment.texture;
        scene.environmentIntensity = 0.65;
        hdr.dispose();
        pmrem.dispose();
      })(),
    ]);
    // Wait for pending transcodes before terminating: delayed initialization
    // must not create a worker after an early scene disposal.
    compressed?.dispose();
  }
  dispose() {
    this.disposed = true;
    this.stagedTextures.forEach((texture) => texture.dispose());
    this.stagedTextures.clear();
    this.textures.forEach((t) => t.dispose());
    this.environment?.dispose();
    this.environment = null;
    this.textures.clear();
    this.materials.clear();
  }
}
