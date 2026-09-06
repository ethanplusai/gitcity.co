import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
const downloads = new Map<string, Promise<ArrayBuffer>>();
export async function streetModel(name: string) {
  const vehicle = name === 'sedan' || name === 'suv';
  const url = `/models/${vehicle ? 'city-car' : name}.glb`;
  if (!downloads.has(url))
    downloads.set(
      url,
      fetch(url)
        .then((r) => {
          if (!r.ok) throw new Error(`Model ${name} unavailable`);
          return r.arrayBuffer();
        })
        .catch((e) => {
          downloads.delete(url);
          throw e;
        }),
    );
  const gltf = await new GLTFLoader().parseAsync((await downloads.get(url)!).slice(0), '/models/');
  gltf.scene.updateMatrixWorld(true);
  const meshes: T.Mesh[] = [];
  gltf.scene.traverse((o) => {
    if (o instanceof T.Mesh) meshes.push(o);
  });
  if (vehicle) {
    const material = meshes[0].material as T.MeshPhysicalMaterial;
    if (name === 'suv') material.color.set('#d3d4ce');
    const night = { value: 0 };
    material.userData.vehicleNight = night;
    material.onBeforeCompile = (shader) => {
      shader.uniforms.vehicleNight = night;
      shader.fragmentShader = 'uniform float vehicleNight;\n' + shader.fragmentShader;
      shader.fragmentShader = shader.fragmentShader
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>
          float headlamp = smoothstep(.4,.53,min(vColor.r,min(vColor.g,vColor.b)));
          float taillamp = smoothstep(.2,.28,vColor.r)*(1.-smoothstep(.04,.08,vColor.g));
          totalEmissiveRadiance += vec3(1.,.91,.72)*headlamp*mix(.08,2.0,vehicleNight);
          totalEmissiveRadiance += vec3(1.,.055,.018)*taillamp*mix(.08,.8,vehicleNight);
        `,
        )
        .replace(
          '#include <roughnessmap_fragment>',
          `#include <roughnessmap_fragment>
        float paintSurface=smoothstep(.025,.08,max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b)));
        roughnessFactor=mix(.85,roughnessFactor,paintSurface);
      `,
        )
        .replace(
          '#include <metalnessmap_fragment>',
          `#include <metalnessmap_fragment>
        metalnessFactor*=paintSurface;
      `,
        );
    };
    material.customProgramCacheKey = () => 'city-touring-car-v2';
    return { geometry: meshes[0].geometry, material };
  }
  if (name.startsWith('citizen'))
    return { geometry: meshes[0].geometry, material: meshes[0].material as T.MeshStandardMaterial };
  const bounds = new T.Box3().setFromObject(gltf.scene),
    size = bounds.getSize(new T.Vector3()),
    center = bounds.getCenter(new T.Vector3()),
    scale = 1.3 / size.z;
  const matrix = new T.Matrix4()
    .makeScale(scale, scale, scale)
    .multiply(new T.Matrix4().makeTranslation(-center.x, -bounds.min.y, -center.z));
  const parts = meshes.map((mesh) =>
    mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(matrix),
  );
  const geometry = mergeGeometries(parts);
  parts.forEach((g) => g.dispose());
  const source = meshes[0].material as T.MeshStandardMaterial;
  const material = new T.MeshPhysicalMaterial({
    map: source.map,
    color: source.color,
    roughness: 0.32,
    metalness: 0.38,
    clearcoat: 0.55,
    clearcoatRoughness: 0.22,
  });
  const paint = new T.Color(name === 'sedan' ? '#56656e' : '#85877f');
  material.onBeforeCompile = (shader) => {
    shader.uniforms.cityPaint = { value: paint };
    shader.fragmentShader =
      'uniform vec3 cityPaint;\n' +
      shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
      float high=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
      float low=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
      float chroma=high-low;
      // Refinish the saturated body panels while retaining lamps, tires and window trim.
      float body=smoothstep(.055,.14,chroma)*smoothstep(.09,.2,high);
      float lamp=step(diffuseColor.r*.55,diffuseColor.g)*step(diffuseColor.g*.85,diffuseColor.r)*step(.35,high);
      body*=1.-lamp*.65;
      diffuseColor.rgb=mix(diffuseColor.rgb,cityPaint*(.88+high*.18),body);
    `,
      );
  };
  material.customProgramCacheKey = () => `city-vehicle-finish-${name}`;
  meshes.forEach((mesh) => {
    mesh.geometry.dispose();
    (mesh.material as T.Material).dispose();
  });
  return { geometry, material };
}
