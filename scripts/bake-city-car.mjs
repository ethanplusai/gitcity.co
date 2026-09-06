// Source: Khronos glTF-Sample-Assets/Models/CarConcept (CC-BY-4.0).
// Download CarConcept.gltf and CarConcept.data.bin into /private/tmp first.
import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { MeshoptSimplifier } from 'meshoptimizer';
import { readFile, writeFile } from 'node:fs/promises';
globalThis.ProgressEvent = class {};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result =
        'data:application/octet-stream;base64,' + Buffer.from(result).toString('base64');
      this.onloadend?.();
    });
  }
};
const source = JSON.parse(await readFile('/private/tmp/gitcity-car-concept.gltf', 'utf8'));
const bin = await readFile('/private/tmp/CarConcept.data.bin');
source.buffers[0].uri = 'data:application/octet-stream;base64,' + bin.toString('base64');
const names = source.materials.map((m) => m.name || 'Body panel');
source.materials = source.materials.map((m, i) => ({
  name: names[i],
  pbrMetallicRoughness: { baseColorFactor: [0.3, 0.3, 0.3, 1] },
}));
delete source.images;
delete source.textures;
delete source.samplers;
delete source.animations;
delete source.extensions;
source.extensionsUsed = [];
source.extensionsRequired = [];
for (const mesh of source.meshes) for (const p of mesh.primitives) delete p.extensions;
const gltf = await new GLTFLoader().parseAsync(JSON.stringify(source), '');
gltf.scene.updateMatrixWorld(true);
const bounds = new T.Box3().setFromObject(gltf.scene),
  size = bounds.getSize(new T.Vector3());
const rotation = new T.Matrix4().makeRotationY(size.x > size.z ? Math.PI / 2 : 0);
const meshes = [];
gltf.scene.traverse((o) => {
  if (o.isMesh) meshes.push(o);
});
const parts = [];
await MeshoptSimplifier.ready;
MeshoptSimplifier.useExperimentalFeatures = true;
let original = 0,
  headlightZ = 0,
  headlightCount = 0;
for (const mesh of meshes) {
  const label = mesh.material.name || '';
  if (/Interior|Floor|Dash|License/.test(label) || /Engine|BodyUnderside|Interior/i.test(mesh.name))
    continue;
  let geo = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld).applyMatrix4(rotation);
  for (const attr of Object.keys(geo.attributes))
    if (!['position', 'normal'].includes(attr)) geo.deleteAttribute(attr);
  const welded = mergeVertices(geo, 0.0001);
  geo.dispose();
  geo = welded;
  if (/Headlight/.test(label)) {
    geo.computeBoundingBox();
    headlightZ += geo.boundingBox.getCenter(new T.Vector3()).z;
    headlightCount++;
  }
  const positions = geo.attributes.position.array,
    indices = geo.index
      ? new Uint32Array(geo.index.array)
      : Uint32Array.from({ length: geo.attributes.position.count }, (_, i) => i);
  original += indices.length / 3;
  const target = Math.min(
    indices.length,
    Math.max(36, Math.floor((indices.length * 0.04) / 3) * 3),
  );
  // Preserve the surface-normal field as well as silhouette: position-only
  // reduction can leave interpolated highlights looking dented on body panels.
  const [simplified] = MeshoptSimplifier.simplifyWithAttributes(
    indices,
    positions,
    3,
    geo.attributes.normal.array,
    3,
    [0.25, 0.25, 0.25],
    null,
    target,
    0.018,
  );
  const [remap, count] = MeshoptSimplifier.compactMesh(simplified);
  const result = new T.BufferGeometry();
  for (const attr of ['position', 'normal']) {
    const old = geo.attributes[attr];
    if (!old) continue;
    const values = new Float32Array(count * 3);
    for (let i = 0; i < remap.length; i++)
      if (remap[i] !== 0xffffffff)
        for (let k = 0; k < 3; k++) values[remap[i] * 3 + k] = old.array[i * 3 + k];
    result.setAttribute(attr, new T.BufferAttribute(values, 3));
  }
  result.setIndex(new T.BufferAttribute(simplified, 1));
  if (!result.attributes.normal) result.computeVertexNormals();
  const finish = /Paint|Panel|Body panel/.test(label)
    ? '#647782'
    : /Glass|Mirror/.test(label)
      ? '#24383f'
      : /Tire|Mechanical/.test(label)
        ? '#202323'
        : /Headlight/.test(label)
          ? '#dedac4'
          : /Brakelight/.test(label)
            ? '#962f25'
            : /Signal/.test(label)
              ? '#b77d30'
              : /Rim|Disc|Hardware/.test(label)
                ? '#8c9393'
                : '#424849';
  const color = new T.Color(finish),
    colors = new Uint8Array(count * 3);
  for (let i = 0; i < count; i++) {
    colors[i * 3] = Math.round(color.r * 255);
    colors[i * 3 + 1] = Math.round(color.g * 255);
    colors[i * 3 + 2] = Math.round(color.b * 255);
  }
  result.setAttribute('color', new T.BufferAttribute(colors, 3, true));
  parts.push(result);
  geo.dispose();
}
const geometry = mergeGeometries(parts);
parts.forEach((p) => p.dispose());
geometry.computeBoundingBox();
const box = geometry.boundingBox,
  center = box.getCenter(new T.Vector3()),
  span = box.getSize(new T.Vector3());
geometry.translate(-center.x, -box.min.y, -center.z);
if (headlightCount && headlightZ / headlightCount < center.z) geometry.rotateY(Math.PI);
geometry.scale(1.3 / span.z, 1.3 / span.z, 1.3 / span.z);
const material = new T.MeshPhysicalMaterial({
  vertexColors: true,
  roughness: 0.45,
  metalness: 0.22,
  clearcoat: 0.22,
  clearcoatRoughness: 0.25,
});
const model = new T.Mesh(geometry, material);
model.name = 'City touring car';
const binary = await new GLTFExporter().parseAsync(model, { binary: true });
await writeFile('public/models/city-car.glb', Buffer.from(binary));
console.log(
  JSON.stringify({
    sourceTriangles: original,
    triangles: geometry.index.count / 3,
    vertices: geometry.attributes.position.count,
    bytes: binary.byteLength,
    originalBounds: span.toArray(),
  }),
);
