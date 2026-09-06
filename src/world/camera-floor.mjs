// Camera clearance is independent of the orbit target and enforced after navigation.
export function cameraFloor(height, x, z, scale = 1) {
  const terrain = Math.max(
    height(x, z),
    height(x + 0.5, z),
    height(x - 0.5, z),
    height(x, z + 0.5),
    height(x, z - 0.5),
  );
  return Math.max(0, terrain + 0.15) + 0.58 * scale;
}
export function keepAboveGround(position, target, floor, walking) {
  const lift = walking ? floor - position.y : Math.max(0, floor - position.y);
  position.y += lift;
  target.y += lift;
}
