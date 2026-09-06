import { cityCell } from './city-plan.mjs';
import { random } from './model.mjs';

// A 64-source group occupies three city columns by two rows. The outer
// perimeter follows the same city lattice as its neighbours; inner streets
// serve paired rows of full-size buildings rather than shrinking file geometry.
export function directoryBlock(owner, column, row) {
  const cells = [];
  for (let z = row; z < row + 2; z++)
    for (let x = column; x < column + 3; x++) cells.push(cityCell(owner, x, z));
  const north = cells.slice(0, 3),
    south = cells.slice(3);
  const polygon = [
    ...north.map((c) => c.polygon[0]),
    north[2].polygon[1],
    north[2].polygon[2],
    south[2].polygon[1],
    south[2].polygon[2],
    ...[...south].reverse().map((c) => c.polygon[3]),
    south[0].polygon[0],
    north[0].polygon[3],
  ].filter((p, i, all) => i === 0 || Math.hypot(p.x - all[i - 1].x, p.z - all[i - 1].z) > 1e-7);
  const minZ = north[0].polygon[0].z,
    maxZ = south[0].polygon[3].z;
  const left = Math.max(...[north[0], south[0]].flatMap((c) => [c.polygon[0].x, c.polygon[3].x]));
  const right = Math.min(...[north[2], south[2]].flatMap((c) => [c.polygon[1].x, c.polygon[2].x]));
  const center = { x: (left + right) / 2, z: (minZ + maxZ) / 2 };
  const edgeX = (z, side) => {
    const band = z <= north[0].polygon[3].z ? north : south;
    const cell = side < 0 ? band[0] : band[2];
    const a = cell.polygon[side < 0 ? 0 : 1],
      b = cell.polygon[side < 0 ? 3 : 2];
    const t = (z - a.z) / (b.z - a.z);
    return a.x + (b.x - a.x) * t;
  };
  const streets = Array.from({ length: 3 }, (_, i) => {
    const z = center.z + (i - 1) * 9.65;
    return { a: { x: edgeX(z, -1), z }, b: { x: edgeX(z, 1), z } };
  });
  const lots = Array.from({ length: 64 }, (_, slot) => {
    const rank = Math.floor(slot / 11),
      column = slot % 11;
    const street = streets[Math.floor(rank / 2)];
    const sign = rank % 2 === 0 ? -1 : 1;
    const front = { x: center.x + (column - 5) * 3.4, z: street.a.z + sign * 1.8 };
    return {
      slot,
      front,
      x: front.x,
      z: front.z + sign * 1.45,
      rotation: sign < 0 ? 0 : Math.PI,
      width: 3.2,
      depth: 2.9,
    };
  });
  // Turn selected deep reservations into north/south neighborhood streets.
  // Full source footprints need 37.2 units along the eleven-plot row, plus
  // clearance from any connecting boundary road. Smaller sites keep their fit.
  const orientation =
    maxZ - minZ >= 41.5 && random(`${owner}:${column}:${row}:street-axis`)() > 0.5 ? 1 : 0;
  if (orientation) {
    const turn = (point) => ({
      x: center.x + point.z - center.z,
      z: center.z - point.x + center.x,
    });
    lots.forEach((lot) => {
      const position = turn(lot);
      lot.front = turn(lot.front);
      lot.x = position.x;
      lot.z = position.z;
      lot.rotation += Math.PI / 2;
    });
    streets.forEach((street, index) => {
      const x = center.x + (index - 1) * 9.65;
      street.a = { x, z: maxZ };
      street.b = { x, z: minZ };
    });
  }
  return {
    orientation,
    column,
    row,
    cells,
    polygon,
    center,
    width: right - left,
    depth: maxZ - minZ,
    streets,
    lots,
  };
}

export function directoryCandidates(owner, anchor, occupied, count, canPlace = null) {
  const result = [];
  for (let radius = 2; result.length < count && radius <= 128; radius *= 2) {
    const candidates = [];
    for (let row = -radius; row <= radius; row++)
      for (let column = -radius; column <= radius; column++) {
        const x = column * 3,
          z = row * 2;
        const keys = [];
        for (let dz = 0; dz < 2; dz++)
          for (let dx = 0; dx < 3; dx++) keys.push(`${x + dx}:${z + dz}`);
        if (keys.some((key) => key === '0:0' || occupied.has(key))) continue;
        const block = directoryBlock(owner, x, z);
        if (canPlace && !canPlace(block)) continue;
        candidates.push({
          column: x,
          row: z,
          keys,
          distance: Math.hypot(block.center.x - anchor.x, block.center.z - anchor.z),
        });
      }
    candidates.sort((a, b) => a.distance - b.distance || a.row - b.row || a.column - b.column);
    for (const candidate of candidates) {
      if (result.length === count) break;
      if (candidate.keys.some((key) => occupied.has(key))) continue;
      candidate.keys.forEach((key) => occupied.add(key));
      result.push({ column: candidate.column, row: candidate.row });
    }
  }
  if (result.length !== count) throw new Error('The current city region is full.');
  return result;
}
