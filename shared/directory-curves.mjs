// Refit a reserved directory block around three gently bending access streets.
// The returned segments share exact endpoints for the existing street graph.
export function curvedDirectoryBlock(plan) {
  const lateral = plan.orientation ? { x: 1, z: 0 } : { x: 0, z: 1 };
  const forward = plan.orientation ? { x: 0, z: -1 } : { x: 1, z: 0 };
  const project = (p) => (p.x - plan.center.x) * forward.x + (p.z - plan.center.z) * forward.z;
  const lanes = Array.from({ length: 3 }, (_, lane) => {
    const cross = (lane - 1) * 10.65;
    const center = { x: plan.center.x + lateral.x * cross, z: plan.center.z + lateral.z * cross };
    const hits = [];
    for (let i = 0; i < plan.polygon.length; i++) {
      const a = plan.polygon[i],
        b = plan.polygon[(i + 1) % plan.polygon.length];
      const da = (a.x - center.x) * lateral.x + (a.z - center.z) * lateral.z;
      const db = (b.x - center.x) * lateral.x + (b.z - center.z) * lateral.z;
      if ((da <= 0 && db > 0) || (db <= 0 && da > 0)) {
        const t = da / (da - db);
        hits.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
      }
    }
    hits.sort((a, b) => project(a) - project(b));
    if (hits.length < 2)
      throw new Error('Directory access street does not intersect its reservation');
    const a = hits[0],
      b = hits.at(-1),
      length = project(b) - project(a);
    const points = Array.from({ length: 13 }, (_, i) => {
      const t = i / 12,
        bend = i === 0 || i === 12 ? 0 : 0.5 * Math.sin(t * Math.PI * 2);
      return {
        x: a.x + (b.x - a.x) * t + lateral.x * bend,
        z: a.z + (b.z - a.z) * t + lateral.z * bend,
      };
    });
    return { a, length, points };
  });
  const lots = plan.lots.map((lot) => {
    const lane = Math.floor(lot.slot / 22),
      side = Math.floor(lot.slot / 11) % 2 ? 1 : -1;
    const road = lanes[lane],
      along = project(lot.front);
    const t = Math.max(0, Math.min(12 - 1e-9, ((along - project(road.a)) / road.length) * 12));
    const index = Math.floor(t),
      fraction = t - index;
    const a = road.points[index],
      b = road.points[index + 1];
    const front = {
      x: a.x + (b.x - a.x) * fraction + lateral.x * side * 1.96,
      z: a.z + (b.z - a.z) * fraction + lateral.z * side * 1.96,
    };
    return {
      ...lot,
      front,
      x: front.x + lateral.x * side * 1.45,
      z: front.z + lateral.z * side * 1.45,
    };
  });
  return {
    ...plan,
    lots,
    streets: lanes.flatMap((lane, index) =>
      lane.points.slice(1).map((b, i) => ({ a: lane.points[i], b, lane: index })),
    ),
  };
}
