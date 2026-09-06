import { pointInPolygon } from './street-surfaces.mjs';

// Terrain flattening ends 88 units from a city edge. Index only that influence
// region; distant developed land cannot change a tile's elevation or planting.
export function polygonField(polygons, radius = 88, cellSize = 64) {
  const bins = new Map();
  for (const polygon of polygons) {
    if (!polygon.length) continue;
    const x0 = Math.floor((Math.min(...polygon.map((p) => p.x)) - radius) / cellSize);
    const x1 = Math.floor((Math.max(...polygon.map((p) => p.x)) + radius) / cellSize);
    const z0 = Math.floor((Math.min(...polygon.map((p) => p.z)) - radius) / cellSize);
    const z1 = Math.floor((Math.max(...polygon.map((p) => p.z)) + radius) / cellSize);
    for (let x = x0; x <= x1; x++)
      for (let z = z0; z <= z1; z++) {
        const key = `${x}:${z}`;
        const bucket = bins.get(key) || [];
        bucket.push(polygon);
        bins.set(key, bucket);
      }
  }
  return (x, z) => {
    let distance = radius;
    for (const polygon of bins.get(`${Math.floor(x / cellSize)}:${Math.floor(z / cellSize)}`) ||
      []) {
      if (pointInPolygon({ x, z }, polygon)) return 0;
      for (let i = 0; i < polygon.length; i++) {
        const a = polygon[i],
          b = polygon[(i + 1) % polygon.length];
        const dx = b.x - a.x,
          dz = b.z - a.z;
        const t = Math.max(
          0,
          Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz || 1)),
        );
        distance = Math.min(distance, Math.hypot(x - a.x - t * dx, z - a.z - t * dz));
      }
    }
    return distance;
  };
}
