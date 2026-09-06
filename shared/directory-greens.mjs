import { random } from './model.mjs';
import { pointInPolygon } from './street-surfaces.mjs';
import { WOODLAND_CROWN_RADIUS } from './woodland.mjs';

const segmentDistance = (point, a, b) => {
  const dx = b.x - a.x,
    dz = b.z - a.z;
  const t = Math.max(
    0,
    Math.min(1, ((point.x - a.x) * dx + (point.z - a.z) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(point.x - a.x - t * dx, point.z - a.z - t * dz);
};

// Small public groves occupy the broad side margins of rotated source rows.
// All reserved plots participate in clearance, regardless of analysis/occupancy.
export function directoryGreens(region) {
  if (!region.orientation) return [];
  const rng = random(`${region.repo || 'directory'}:${region.column}:${region.row}:greens`);
  const minX = Math.min(...region.polygon.map((p) => p.x));
  const maxX = Math.max(...region.polygon.map((p) => p.x));
  const minZ = Math.min(...region.polygon.map((p) => p.z));
  const maxZ = Math.max(...region.polygon.map((p) => p.z));
  const leftPlots = Math.min(...region.lots.map((lot) => lot.x - lot.depth / 2));
  const rightPlots = Math.max(...region.lots.map((lot) => lot.x + lot.depth / 2));
  const result = [];
  for (const side of [-1, 1])
    for (let i = 0; i < 4; i++) {
      const low = side < 0 ? minX + 4.5 : rightPlots + 3.5;
      const high = side < 0 ? leftPlots - 3.5 : maxX - 4.5;
      const point = {
        x: low + (high - low) * (0.3 + rng() * 0.4),
        z: minZ + 5 + (maxZ - minZ - 10) * ((i + 0.3 + rng() * 0.4) / 4),
        y: -0.055,
        scale: 0.75 + rng() * 0.18,
        rotation: rng() * Math.PI * 2,
        species: rng() < 0.8 ? 0 : 1,
      };
      const radius = WOODLAND_CROWN_RADIUS * point.scale;
      if (high <= low || !pointInPolygon(point, region.polygon)) continue;
      if (
        region.polygon.some(
          (a, index) =>
            segmentDistance(point, a, region.polygon[(index + 1) % region.polygon.length]) <
            radius + 1.725,
        )
      )
        continue;
      if (
        region.streets.some((street) => segmentDistance(point, street.a, street.b) < radius + 1.725)
      )
        continue;
      if (
        region.lots.some((lot) => {
          const dx = point.x - lot.x,
            dz = point.z - lot.z;
          const across = Math.cos(lot.rotation) * dx - Math.sin(lot.rotation) * dz;
          const outward = Math.sin(lot.rotation) * dx + Math.cos(lot.rotation) * dz;
          return (
            Math.hypot(
              Math.max(0, Math.abs(across) - lot.width / 2),
              Math.max(0, Math.abs(outward) - lot.depth / 2),
            ) <
            radius + 0.4
          );
        })
      )
        continue;
      if (result.some((tree) => Math.hypot(point.x - tree.x, point.z - tree.z) < 4)) continue;
      result.push(point);
    }
  return result;
}
