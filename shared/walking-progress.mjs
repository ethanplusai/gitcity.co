// Horizontal street distance, not straight-line distance through city blocks.
export function walkingProgress(position, path, scale = 1) {
  let distance = 0;
  let previous = position;
  for (const point of path) {
    distance += Math.hypot(point.x - previous.x, point.z - previous.z);
    previous = point;
  }
  distance /= Math.max(0.0001, scale);
  return { distance: Math.ceil(distance), seconds: Math.ceil(distance / 5) };
}
