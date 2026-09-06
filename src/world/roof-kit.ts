import * as T from 'three';
import { building } from '../../shared/model.mjs';
import type { CodeFile } from './types';

// Roof space is part of the source-derived envelope, never extra storeys.
export function roofProfile(file: CodeFile) {
  const source = building(file);
  const kind =
    (file.symbols || 0) > 35 || (file.complexity || 0) > 12 || source.roof === 0
      ? 'terrace'
      : source.roof === 1
        ? 'gable'
        : 'hip';
  const rise = kind === 'terrace' ? 0 : Math.min(0.6, source.height * 0.22);
  return { kind, rise, eave: source.height - rise };
}

export function pitchedRoof(
  width: number,
  depth: number,
  eave: number,
  rise: number,
  hip: boolean,
  gableEnds = false,
) {
  const w = width / 2,
    d = depth / 2;
  const end = hip ? Math.max(0, d - w * 0.7) : d;
  const vertices = [
    [-w, eave, -d],
    [w, eave, -d],
    [w, eave, d],
    [-w, eave, d],
    [0, eave + rise, -end],
    [0, eave + rise, end],
  ];
  const positions: number[] = [],
    uvs: number[] = [];
  // Separate face vertices preserve the planes of a real roof instead of
  // smoothing the ridge into a rounded canopy.
  for (const face of [
    [0, 4, 1],
    [1, 4, 5],
    [1, 5, 2],
    [2, 5, 3],
    [3, 5, 4],
    [3, 4, 0],
  ]) {
    const endFace = face[0] === 0 || face[0] === 2;
    if (!hip && endFace !== gableEnds) continue;
    for (const index of face) {
      const p = vertices[index];
      positions.push(...p);
      uvs.push(p[0] * 3.9, (gableEnds ? p[1] : p[2]) * 3.9);
    }
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
  geometry.computeVertexNormals();
  return geometry;
}
