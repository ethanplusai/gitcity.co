import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { grove } from './vegetation.mjs';
import { random } from '../../shared/model.mjs';
// Baseline landscape and street furniture, independent of contribution-earned civic structures.
export function publicRealm(total: number, seed: string) {
  const result = new T.Group(),
    rng = random(seed);
  const buckets: T.BufferGeometry[][] = [[], [], [], [], []];
  const box = (n: number, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const indexed = new T.BoxGeometry(w, h, d);
    const g = indexed.toNonIndexed();
    indexed.dispose();
    g.translate(x, y, z);
    buckets[n].push(g);
  };
  const trees: { x: number; z: number; scale: number; rotation: number }[] = [];
  // Waterways belong to the shared terrain plan, not an identical canal per repository.
  for (const sign of [-1, 1]) {
    const edge = sign * (total / 2 + 2.5);
    box(3, 2.4, 0.08, total - 2, edge, -0.05, 0);
    for (let z = -total / 2 + 4; z < total / 2 - 2; z += 5) {
      trees.push({ x: edge, z, scale: 0.85 + rng() * 0.3, rotation: rng() * Math.PI * 2 });
      box(0, 0.8, 0.35, 0.8, edge, 0.12, z);
    }
  }
  // Roadside bays are presentation, not inferred GitHub traffic.
  for (let x = -total / 2 + 3; x < total / 2 - 2; x += 3) {
    box(1, 2, 0.04, 1.4, x, -0.01, total / 2 + 2);
    box(0, 0.04, 0.02, 1.2, x - 1, 0.02, total / 2 + 2);
  }
  const colors = ['#9c9c8e', '#444a48', '#494a3d', '#566c49', '#3d6344'];
  buckets.forEach((parts, i) => {
    if (!parts.length) return;
    const mesh = new T.Mesh(
      mergeGeometries(parts),
      new T.MeshStandardMaterial({ color: colors[i], roughness: 0.92 }),
    );
    parts.forEach((g) => g.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    result.add(mesh);
  });
  result.add(grove(trees, seed));
  return result;
}
