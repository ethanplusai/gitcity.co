import { polygonField } from '../../shared/polygon-field.mjs';
import { groundCover } from './ground-cover.mjs';
import * as T from 'three';
import { random } from '../../shared/model.mjs';
import { grove } from './vegetation.mjs';
import { woodlandPoints } from '../../shared/woodland.mjs';
import { localSky } from '../../shared/sky-time.mjs';
type Site = { x: number; z: number };
function cloudNoise() {
  const rng = random('atmosphere-noise'),
    data = new Uint8Array(128 * 128);
  for (let i = 0; i < data.length; i++) data[i] = Math.floor(rng() * 256);
  const texture = new T.DataTexture(data, 128, 128, T.RedFormat);
  texture.wrapS = texture.wrapT = T.RepeatWrapping;
  texture.minFilter = texture.magFilter = T.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}
const noise = `uniform sampler2D noiseMap;
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){return texture2D(noiseMap,p/128.).r;}
float fbm(vec2 p){return noise(p)*.55+noise(p*2.03)*.27+noise(p*4.01)*.12+noise(p*8.07)*.06;}`;
export class Landscape {
  cloudTexture = cloudNoise();
  group = new T.Group();
  tiles = new Map<string, T.Group>();
  apron: T.Mesh | null = null;
  sites: Site[] = [];
  blocks: Site[][] = [];
  private distanceToBlocks = polygonField([]);
  private blockSignature = '';
  corridors: Site[][] = [];
  private roadSignature = '';
  lastTile = '';
  private pendingTileKey = '';
  revision = 0;
  private siteSignature = '';
  sky = new T.Mesh(
    new T.SphereGeometry(8000, 32, 16),
    new T.ShaderMaterial({
      side: T.BackSide,
      depthWrite: false,
      uniforms: {
        clock: { value: 0 },
        noiseMap: { value: this.cloudTexture },
        day: { value: 1 },
        sun: { value: new T.Vector3(0, 1, 0) },
        storm: { value: 0 },
      },
      vertexShader: `varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
      fragmentShader: `varying vec3 direction;uniform float clock;uniform float day;uniform vec3 sun;uniform float storm;${noise}
void main(){vec3 d=normalize(direction);float h=max(d.y,0.);float glow=pow(max(dot(d,sun),0.),12.);
vec3 zenith=mix(vec3(.008,.016,.04),vec3(.17,.38,.63),day);vec3 horizon=mix(vec3(.035,.055,.09),vec3(.66,.74,.78),day);
vec3 color=mix(horizon,zenith,pow(h,.45));color+=vec3(.6,.24,.075)*glow*(1.-abs(day*2.-1.));
vec2 uv=d.xz/(max(d.y,.04)+.16)*2.1+vec2(clock*.002,0.);
float cloud=smoothstep(.48,.72,fbm(uv))*smoothstep(.015,.16,d.y);
vec3 cloudColor=mix(vec3(.08,.10,.15),vec3(.9,.91,.9),day)*(1.-storm*.45);
cloudColor*=.75+.25*fbm(uv+vec2(.2,.1));color=mix(color,cloudColor,cloud*.9);
float stars=step(.9987,hash(floor(d.xz/(abs(d.y)+.2)*900.)))*pow(h,.4)*(1.-day)*(1.-cloud);
color+=vec3(stars*.7);float disk=smoothstep(.99965,.9999,dot(d,sun));color+=vec3(1.,.78,.46)*disk*day*3.;
vec3 moon=-sun;float lunar=smoothstep(.9995,.9998,dot(d,moon));color+=vec3(.55,.65,.82)*lunar*(1.-day);
gl_FragColor=vec4(color,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>}`,
    }),
  );
  constructor() {
    this.sky.frustumCulled = false;
    this.sky.renderOrder = 1000;
    this.group.add(this.sky);
  }
  roadDistance(x: number, z: number) {
    let distance = 10000;
    for (const line of this.corridors)
      for (let i = 1; i < line.length; i++) {
        const a = line[i - 1],
          b = line[i],
          dx = b.x - a.x,
          dz = b.z - a.z;
        const t = T.MathUtils.clamp(
          ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1),
          0,
          1,
        );
        distance = Math.min(distance, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
      }
    return distance;
  }
  setRoads(roads: Site[][]) {
    const signature = JSON.stringify(roads.map((line) => line.map((p) => [p.x, p.z])));
    if (signature === this.roadSignature) return;
    this.roadSignature = signature;
    this.corridors = roads;
    this.revision++;
    this.lastTile = '';
  }
  setBlocks(blocks: Site[][]) {
    const signature = JSON.stringify(blocks);
    if (signature === this.blockSignature) return;
    this.blockSignature = signature;
    this.blocks = blocks;
    this.distanceToBlocks = polygonField(blocks);
    this.revision++;
    this.lastTile = '';
  }
  blockDistance(x: number, z: number) {
    return this.distanceToBlocks(x, z);
  }

  height(x: number, z: number) {
    let distance = this.blockDistance(x, z) - 8;
    for (const site of this.sites)
      distance = Math.min(distance, Math.hypot(x - site.x, z - site.z) - 45);
    const t = Math.min(
      T.MathUtils.smoothstep(distance, 0, 80),
      T.MathUtils.smoothstep(this.roadDistance(x, z), 6, 30),
    );
    return (
      -0.055 +
      t * (3 + Math.sin(x * 0.016) * Math.cos(z * 0.013) * 5 + Math.sin(x * 0.04 + z * 0.026) * 1.6)
    );
  }
  setSites(sites: Site[]) {
    const signature = sites
      .map((s) => `${s.x}:${s.z}`)
      .sort()
      .join('|');
    if (signature === this.siteSignature) return;
    this.siteSignature = signature;
    this.sites = sites;
    this.revision++;
    this.lastTile = '';
  }
  update(
    center: T.Vector3,
    camera: T.Vector3,
    time: number,
    sky: ReturnType<typeof localSky>,
    storm: boolean,
    reduced: boolean,
  ) {
    this.sky.position.copy(camera);
    this.sky.material.uniforms.clock.value = reduced ? 0 : time;
    this.sky.material.uniforms.day.value = sky.daylight;
    this.sky.material.uniforms.storm.value = storm ? 1 : 0;
    const angle = ((sky.hour - 6.5) / 13) * Math.PI;
    this.sky.material.uniforms.sun.value.set(Math.cos(angle), Math.sin(angle), -0.25).normalize();
    const tx = Math.floor(center.x / 128),
      tz = Math.floor(center.z / 128),
      key = `${tx}:${tz}:${this.revision}`;
    if (key === this.lastTile && key === this.pendingTileKey) return;
    const coordinates = [];
    for (let x = tx - 1; x <= tx + 1; x++)
      for (let z = tz - 1; z <= tz + 1; z++) coordinates.push({ x, z });
    coordinates.sort((a, b) => Math.hypot(a.x - tx, a.z - tz) - Math.hypot(b.x - tx, b.z - tz));
    const wanted = new Set(coordinates.map(({ x, z }) => `${x}:${z}`));
    if (this.pendingTileKey !== key) {
      this.pendingTileKey = key;
      this.lastTile = '';
      this.updateApron(tx, tz);
      for (const [id, tile] of this.tiles) {
        const [x, z] = id.split(':');
        if (!wanted.has(`${x}:${z}`)) {
          this.disposeTile(tile);
          this.tiles.delete(id);
        }
      }
    }
    for (const { x, z } of coordinates) {
      const id = `${x}:${z}:${this.revision}`;
      if (this.tiles.has(id)) continue;
      const tile = new T.Group(),
        geo = new T.PlaneGeometry(128, 128, 24, 24);
      geo.rotateX(-Math.PI / 2);
      geo.translate(x * 128 + 64, 0, z * 128 + 64);
      const p = geo.attributes.position,
        colors = [];
      for (let i = 0; i < p.count; i++) {
        const px = p.getX(i),
          pz = p.getZ(i),
          h = this.height(px, pz);
        p.setY(i, h);
        geo.attributes.uv.setXY(i, px * 0.15, pz * 0.15);
        const c = new T.Color('#ffffff').lerp(
          new T.Color('#dedac5'),
          T.MathUtils.clamp(h / 8, 0, 1),
        );
        c.multiplyScalar(0.96 + Math.sin(px * 0.025) * Math.cos(pz * 0.031) * 0.04);
        colors.push(c.r, c.g, c.b);
      }
      geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
      geo.computeVertexNormals();
      const ground = new T.Mesh(
        geo,
        groundCover(
          new T.MeshStandardMaterial({ color: '#7b8460', vertexColors: true, roughness: 1 }),
        ),
      );

      ground.receiveShadow = true;
      tile.add(ground);
      const points = woodlandPoints(
        { minX: x * 128, maxX: (x + 1) * 128, minZ: z * 128, maxZ: (z + 1) * 128 },
        (px: number, pz: number) =>
          Math.min(
            this.roadDistance(px, pz) - 3,
            this.blockDistance(px, pz),
            ...this.sites.map((site) => Math.hypot(px - site.x, pz - site.z) - 36),
          ),
        (px: number, pz: number) => this.height(px, pz),
      );
      const forest = grove(points, `woodland:${x}:${z}`, true);
      forest.traverse((o) => {
        if (o instanceof T.Mesh) o.castShadow = false;
      });
      tile.add(forest);
      for (const [oldId, oldTile] of this.tiles)
        if (oldId.startsWith(`${x}:${z}:`)) {
          this.disposeTile(oldTile);
          this.tiles.delete(oldId);
        }
      this.tiles.set(id, tile);
      this.group.add(tile);
      // Build only the nearest missing tile this frame. Keep older revisions
      // visible until their replacement is ready, so the ground never opens.
      break;
    }
    if (coordinates.every(({ x, z }) => this.tiles.has(`${x}:${z}:${this.revision}`)))
      this.lastTile = key;
  }
  updateApron(tx: number, tz: number) {
    if (this.apron) {
      this.apron.removeFromParent();
      this.apron.geometry.dispose();
      (this.apron.material as T.Material).dispose();
    }
    const positions: number[] = [],
      colors: number[] = [],
      uv: number[] = [],
      indices: number[] = [];
    const steps = [0, 32, 80, 160, 320],
      segments = 72,
      count = segments * 4;
    const cx = tx * 128 + 64,
      cz = tz * 128 + 64;
    steps.forEach((extension, ring) => {
      const half = 192 + extension,
        blend = T.MathUtils.smoothstep(extension, 0, 320);
      for (let side = 0; side < 4; side++)
        for (let i = 0; i < segments; i++) {
          const t = i / segments;
          const x =
            cx +
            (side === 0
              ? -half + t * half * 2
              : side === 1
                ? half
                : side === 2
                  ? half - t * half * 2
                  : -half);
          const z =
            cz +
            (side === 0
              ? -half
              : side === 1
                ? -half + t * half * 2
                : side === 2
                  ? half
                  : half - t * half * 2);
          const h = this.height(x, z);
          positions.push(x, T.MathUtils.lerp(h, -4, blend), z);
          uv.push(x * 0.15, z * 0.15);
          const color = new T.Color('#ffffff').lerp(
            new T.Color('#dedac5'),
            T.MathUtils.clamp(h / 8, 0, 1),
          );
          color.multiplyScalar(0.96 + Math.sin(x * 0.025) * Math.cos(z * 0.031) * 0.04);
          color.lerp(new T.Color('#ffffff'), blend);
          colors.push(color.r, color.g, color.b);
          if (ring < steps.length - 1) {
            const a = ring * count + side * segments + i;
            const b = ring * count + ((side * segments + i + 1) % count);
            indices.push(a, b, a + count, b, b + count, a + count);
          }
        }
    });
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    this.apron = new T.Mesh(
      geometry,
      groundCover(
        new T.MeshStandardMaterial({ color: '#7b8460', vertexColors: true, roughness: 1 }),
      ),
    );
    this.apron.receiveShadow = true;
    this.group.add(this.apron);
  }
  disposeTile(tile: T.Group) {
    tile.removeFromParent();
    tile.traverse((o) => {
      if (o instanceof T.Mesh) {
        o.geometry.dispose();
        const m = Array.isArray(o.material) ? o.material : [o.material];
        m.forEach((v) => v.dispose());
      }
    });
  }
  dispose() {
    if (this.apron) {
      this.apron.geometry.dispose();
      (this.apron.material as T.Material).dispose();
      this.apron.removeFromParent();
      this.apron = null;
    }
    for (const tile of this.tiles.values()) this.disposeTile(tile);
    this.tiles.clear();
    this.cloudTexture.dispose();
    this.sky.geometry.dispose();
    this.sky.material.dispose();
  }
}
