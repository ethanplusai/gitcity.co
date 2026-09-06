import { atlas, coordinates } from './model.mjs';
export function ownerSeed(owner) {
  const featured = atlas.find(
    (city) => city.id.split('/')[0].toLowerCase() === owner.toLowerCase(),
  );
  const base = featured || coordinates(owner.toLowerCase());
  return { x: base.x * 16, z: base.z * 16 };
}
export function neighborhoodOffset(slot) {
  if (!slot) return { x: 0, z: 0 };
  const ring = Math.ceil((Math.sqrt(slot + 1) - 1) / 2),
    edge = ring * 2;
  const offset = slot - (2 * ring - 1) ** 2;
  const side = Math.floor(offset / edge),
    n = offset % edge;
  const positions = [
    [ring, -ring + n],
    [ring - n, ring],
    [-ring, ring - n],
    [-ring + n, -ring],
  ];
  return { x: positions[side][0] * 40, z: positions[side][1] * 40 };
}
