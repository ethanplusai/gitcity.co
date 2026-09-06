import { pointInPolygon } from './street-surfaces.mjs';

// The wings beside the fixed source rows are public land. Use them as small
// connected courts, keeping every reserved source plot available for growth.
export function directoryCourts(region) {
  // Rotated rows use the reservation's short dimension. Their end margins
  // cannot fit the minimum court width plus entrance and boundary clearances.
  if (region.orientation) return [];
  const left = region.center.x - region.width / 2;
  const right = region.center.x + region.width / 2;
  const lotLeft = Math.min(...region.lots.map((lot) => lot.x - lot.width / 2));
  const lotRight = Math.max(...region.lots.map((lot) => lot.x + lot.width / 2));
  const result = [];
  for (const sign of [-1, 1]) {
    const minX = sign < 0 ? left + 2.3 : lotRight + 1.1;
    const maxX = sign < 0 ? lotLeft - 1.1 : right - 2.3;
    if (maxX - minX < 3.5) continue;
    for (const band of [-1, 1]) {
      const z = region.center.z + band * 4.825;
      // A court opens only beside a built access street. Sparse blocks do not
      // sprout civic furniture at every future street position.
      const road = region.streets.find((street) => Math.abs(street.a.z - z) < 5);
      if (!road) continue;
      const minZ = z - 2.8,
        maxZ = z + 2.8;
      const polygon = [
        { x: minX, z: minZ },
        { x: maxX, z: minZ },
        { x: maxX, z: maxZ },
        { x: minX, z: maxZ },
      ];
      if (!polygon.every((point) => pointInPolygon(point, region.polygon))) continue;
      const x = (minX + maxX) / 2;
      result.push({
        polygon,
        x,
        z,
        width: maxX - minX,
        depth: maxZ - minZ,
        // Connect the paved court to its serving street's existing sidewalk.
        entry: { x: minX + 0.6, z: road.a.z + Math.sign(z - road.a.z) * 1.6 },
        tree: {
          x: x + sign * (maxX - minX) * 0.22,
          z,
          scale: 0.48,
          rotation: (region.column + region.row) * 0.7,
        },
      });
    }
  }
  return result;
}

// Preserve a usable route from the sidewalk along both sides of the island.
export function courtPlanting(court) {
  const width = Math.max(0.4, Math.min(court.width * 0.68, court.width - 2.6));
  const left = court.x - width / 2,
    right = court.x + width / 2;
  const front = court.z - 1.35,
    back = court.z + 1.35;
  const corner = Math.min(0.3, width * 0.25);
  return {
    polygon: [
      { x: left + corner, z: front },
      { x: right - corner, z: front },
      { x: right, z: front + corner },
      { x: right, z: back - corner },
      { x: right - corner, z: back },
      { x: left + corner, z: back },
      { x: left, z: back - corner },
      { x: left, z: front + corner },
    ],
    trees:
      width < 2
        ? [{ ...court.tree, x: court.x, z: court.z }]
        : [-1, 1].map((side) => ({ ...court.tree, x: court.x + side * width * 0.24, z: court.z })),
  };
}
