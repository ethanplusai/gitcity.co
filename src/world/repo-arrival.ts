import type { PlannedLayout } from './planned-layout.ts';

// Repository links arrive at a legible neighborhood. The complete inventory
// determines the city footprint, but must not push visitors kilometers away.
export function repoArrival(plan: PlannedLayout) {
  const entrance = plan.parcels[0]?.front || plan.regions[0]?.center || plan.civic;
  const nearby = plan.parcels.filter((p) => Math.hypot(p.x - entrance.x, p.z - entrance.z) < 35);
  const center = nearby.length
    ? {
        x: nearby.reduce((sum, p) => sum + p.x, 0) / nearby.length,
        z: nearby.reduce((sum, p) => sum + p.z, 0) / nearby.length,
      }
    : entrance;
  return { center, span: Math.min(64, Math.max(28, plan.total)) };
}

// Choose a real frontage with a populated view along its street. Fixed parcel
// coordinates stay untouched; only the visitor's starting viewpoint changes.
export function streetArrival(plan: PlannedLayout) {
  const parcels = plan.parcels;
  let best: { x: number; z: number; target: { x: number; z: number }; score: number } | undefined;
  const stride = Math.max(1, Math.ceil(parcels.length / 64));
  for (let index = 0; index < parcels.length; index += stride) {
    const lot = parcels[index];
    const outX = Math.sin(lot.rotation),
      outZ = Math.cos(lot.rotation);
    const x = lot.front.x + outX * 0.45,
      z = lot.front.z + outZ * 0.45;
    for (const sign of [-1, 1]) {
      const dx = Math.cos(lot.rotation) * sign,
        dz = -Math.sin(lot.rotation) * sign;
      let score = 0;
      for (const neighbor of parcels) {
        const vx = neighbor.x - x,
          vz = neighbor.z - z;
        const ahead = vx * dx + vz * dz,
          lateral = Math.abs(vx * dz - vz * dx);
        if (ahead > 1 && ahead < 45 && lateral < 18)
          score += (1 - lateral / 24) / (1 + ahead * 0.05);
      }
      if (!best || score > best.score + 1e-8)
        best = { x, z, target: { x: x + dx * 8 + outX * 0.3, z: z + dz * 8 + outZ * 0.3 }, score };
    }
  }
  return best;
}
