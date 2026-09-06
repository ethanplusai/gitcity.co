import * as T from 'three';
import { mergeTransformed } from './merge-transformed.mjs';
import { hash } from '../../shared/model.mjs';
import type { Repo, CodeFile } from './types';
export type Parcel = { file: CodeFile; x: number; z: number; scale: number; directory: string };
export function parcels(data: Repo, addresses = new Map<string, number>()) {
  const dirs = [
    ...new Set(
      (data.directories || [])
        .map((d) => d.name)
        .concat(data.files.map((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.'))),
    ),
  ].sort();
  const side = Math.max(1, Math.ceil(Math.sqrt(dirs.length)));
  const result: Parcel[] = [];
  dirs.forEach((dir, index) => {
    const files = data.files
      .filter((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.') === dir)
      .sort((a, b) => a.path.localeCompare(b.path));
    const count = Math.max(
      files.length,
      (data.directories || []).find((d) => d.name === dir)?.count || 0,
    );
    const cols = Math.max(3, Math.ceil(Math.sqrt(Math.min(256, count))));
    const step = 19 / cols;
    const used = new Set(
      files.filter((f) => addresses.has(f.path)).map((f) => addresses.get(f.path)!),
    );
    for (const file of files) {
      let slot = addresses.get(file.path);
      if (slot === undefined) {
        slot = hash(file.path) % (cols * cols);
        while (used.has(slot)) slot = (slot + 1) % (cols * cols);
        addresses.set(file.path, slot);
        used.add(slot);
      }
      result.push({
        file,
        directory: dir,
        x: ((index % side) - (side - 1) / 2) * 24 + ((slot % cols) - (cols - 1) / 2) * step,
        z:
          (Math.floor(index / side) - (side - 1) / 2) * 24 +
          (Math.floor(slot / cols) - (cols - 1) / 2) * step,
        scale: Math.min(1.8, step / 3.3),
      });
    }
  });
  return { side, dirs, parcels: result, total: side * 24 };
}
// Ground-hugging ribbons, with a real road cross-section. No cylindrical dependency geometry.
export function boulevard(points: T.Vector3[], width = 0.65) {
  const curve = new T.CurvePath<T.Vector3>();
  for (let i = 1; i < points.length; i++) curve.add(new T.LineCurve3(points[i - 1], points[i]));
  const group = new T.Group();
  const ribbon = (w: number, color: string, y: number) => {
    const vertices: number[] = [],
      indices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        before = points[Math.max(0, i - 1)],
        after = points[Math.min(points.length - 1, i + 1)];
      const incoming = p.clone().sub(before).normalize(),
        outgoing = after.clone().sub(p).normalize();
      if (i === 0) incoming.copy(outgoing);
      if (i === points.length - 1) outgoing.copy(incoming);
      const n1 = new T.Vector3(-incoming.z, 0, incoming.x),
        n2 = new T.Vector3(-outgoing.z, 0, outgoing.x);
      const normal = n1.clone().add(n2).normalize();
      normal.multiplyScalar(Math.min(w, w / 2 / Math.max(0.5, normal.dot(n2))));
      vertices.push(p.x + normal.x, y, p.z + normal.z, p.x - normal.x, y, p.z - normal.z);
      if (i < points.length - 1) {
        const n = i * 2;
        indices.push(n, n + 2, n + 1, n + 1, n + 2, n + 3);
      }
    }
    const geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    const mesh = new T.Mesh(
      geo,
      new T.MeshStandardMaterial({ color, roughness: 1, side: T.DoubleSide }),
    );
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  ribbon(width + 0.2, '#9b9b8c', 0.025);
  ribbon(width, '#343d40', 0.04);
  return { group, curve };
}
// One draw per finish, while preserving real 3D geometry at every camera angle.
export function batchArchitecture(root: T.Group, retainSlices = false) {
  root.updateMatrixWorld(true);
  const batches = new Map<
    string,
    {
      material: T.Material;
      parts: { geometry: T.BufferGeometry; matrix: T.Matrix4 }[];
      ranges: { end: number; file: CodeFile }[];
      triangles: number;
      slices: { geometry: T.BufferGeometry; start: number; count: number; matrix: T.Matrix4 }[];
    }
  >();
  root.traverse((o) => {
    if (!(o instanceof T.Mesh) || Array.isArray(o.material)) return;
    const material = o.material as T.MeshStandardMaterial;
    const key = [
      material.color?.getHex(),
      material.emissive?.getHex(),
      material.roughness,
      material.metalness,
      material.userData.surface,
      material.customProgramCacheKey(),
      material.userData.nightWindow,
      material.userData.activityGlow,
    ].join(':');
    let batch = batches.get(key);
    if (!batch) {
      batch = { material: material.clone(), parts: [], ranges: [], triangles: 0, slices: [] };
      batch.material.userData.sourceMaterial = material;
      batch.material.onBeforeCompile = material.onBeforeCompile;
      batch.material.customProgramCacheKey = material.customProgramCacheKey;
      batches.set(key, batch);
    }
    if (retainSlices)
      batch.slices.push({
        geometry: o.geometry,
        start: batch.triangles * 3,
        count: o.geometry.index?.count || o.geometry.attributes.position.count,
        matrix: o.matrix.clone().multiply(o.matrixWorld.clone().invert()),
      });
    batch.parts.push({ geometry: o.geometry, matrix: o.matrixWorld });
    batch.triangles += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
    if (o.userData.file) batch.ranges.push({ end: batch.triangles, file: o.userData.file });
  });
  const result = new T.Group();
  for (const batch of batches.values()) {
    const geometry = mergeTransformed(batch.parts)!;
    const mesh = new T.Mesh(geometry, batch.material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.fileRanges = batch.ranges;
    if (retainSlices) mesh.userData.sourceSlices = batch.slices;
    result.add(mesh);
  }
  return result;
}

export function batchedFile(
  object: T.Object3D,
  faceIndex: number | null | undefined,
): CodeFile | undefined {
  if (faceIndex === undefined || faceIndex === null) return;
  return object.userData.fileRanges?.find((range: { end: number }) => faceIndex < range.end)?.file;
}
