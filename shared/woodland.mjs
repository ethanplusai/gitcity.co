import { random } from './model.mjs';

// Includes the woodland kit's maximum crown radius and instance width variation.
export const WOODLAND_CROWN_RADIUS = 2.9;

const smooth = (t) => t * t * (3 - 2 * t);
function noise(x, z) {
  const ix = Math.floor(x),
    iz = Math.floor(z),
    u = smooth(x - ix),
    v = smooth(z - iz);
  const sample = (dx, dz) => random(`biome:${ix + dx}:${iz + dz}`)();
  const a = sample(0, 0) * (1 - u) + sample(1, 0) * u;
  const b = sample(0, 1) * (1 - u) + sample(1, 1) * u;
  return a * (1 - v) + b * v;
}

// A world-space habitat field crosses tile boundaries. Larger woodland bodies
// contain small glades and ragged margins, instead of isolated circular groves.
export function woodlandDensity(x, z) {
  const warpX = x + (noise(x * 0.006 + 17, z * 0.006) - 0.5) * 65;
  const warpZ = z + (noise(x * 0.006, z * 0.006 - 23) - 0.5) * 65;
  const field = noise(warpX * 0.013, warpZ * 0.013) * 0.78 + noise(x * 0.045, z * 0.045) * 0.22;
  return smooth(Math.max(0, Math.min(1, (field - 0.38) / 0.25)));
}

// Each jittered world cell owns at most one tree. Region queries select that
// same tree, independent of tile arrival order, clipping, or neighboring cities.
/**
 * @param {(x: number, z: number) => number} clearance
 * @param {(x: number, z: number) => number} height
 */
export function woodlandPoints(bounds, clearance = () => Infinity, height = () => 0) {
  const spacing = 5,
    points = [];
  for (
    let row = Math.floor(bounds.minZ / spacing) - 1;
    row <= Math.floor(bounds.maxZ / spacing);
    row++
  )
    for (
      let column = Math.floor(bounds.minX / spacing) - 1;
      column <= Math.floor(bounds.maxX / spacing);
      column++
    ) {
      const rng = random(`woodland-tree:${column}:${row}`);
      const x = (column + 0.5 + (rng() - 0.5) * 0.65) * spacing;
      const z = (row + 0.5 + (rng() - 0.5) * 0.65) * spacing;
      if (x < bounds.minX || x >= bounds.maxX || z < bounds.minZ || z >= bounds.maxZ) continue;
      const density = woodlandDensity(x, z);
      if (rng() > density * 0.93) continue;
      const scale = 1.1 + rng() * 1.1;
      const rotation = rng() * Math.PI * 2;
      const species = rng() < 0.25 + noise(x * 0.018 + 31, z * 0.018) * 0.35 ? 1 : 0;
      // Crown clearance, with an irregular additional margin at developed land.
      if (clearance(x, z) < scale * WOODLAND_CROWN_RADIUS + 0.5 + rng() * 2) continue;
      points.push({ x, z, y: height(x, z), scale, rotation, species });
    }
  return points;
}
