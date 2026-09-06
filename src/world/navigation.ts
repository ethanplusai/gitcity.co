import { MinQueue } from '../../shared/min-queue.mjs';
import * as T from 'three';
// Route via street intersections, keeping the walking path outside source parcels.
export function streetRoute(
  start: T.Vector3,
  end: T.Vector3,
  origin: T.Vector3,
  side: number,
  scale: number,
) {
  const min = -side * 12,
    max = side * 12;
  const local = (p: T.Vector3) =>
    new T.Vector3((p.x - origin.x) / scale, 0, (p.z - origin.z) / scale);
  const nearest = (v: number) =>
    Math.max(min, Math.min(max, Math.round((v - min) / 24) * 24 + min));
  const a = local(start),
    b = local(end);
  const connect = (p: T.Vector3) =>
    Math.abs(p.x - nearest(p.x)) < Math.abs(p.z - nearest(p.z))
      ? new T.Vector3(nearest(p.x), 0, p.z)
      : new T.Vector3(p.x, 0, nearest(p.z));
  const sa = connect(a),
    sb = connect(b);
  const ia = new T.Vector3(nearest(sa.x), 0, nearest(sa.z)),
    ib = new T.Vector3(nearest(sb.x), 0, nearest(sb.z));
  return [sa, ia, new T.Vector3(ib.x, 0, ia.z), ib, sb, b].map(
    (p) => new T.Vector3(origin.x + p.x * scale, start.y, origin.z + p.z * scale),
  );
}

export function graphRoute(
  start: T.Vector3,
  end: T.Vector3,
  origin: T.Vector3,
  graph: {
    nodes: { id: string; x: number; z: number }[];
    edges: { from: string; to: string; length: number }[];
  },
) {
  const local = (p: T.Vector3) => ({ x: p.x - origin.x, z: p.z - origin.z });
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const project = (p: { x: number; z: number }) => {
    let best: {
      point: { x: number; z: number };
      from: string;
      to: string;
      distance: number;
    } | null = null;
    for (const edge of graph.edges) {
      const a = nodes.get(edge.from)!,
        b = nodes.get(edge.to)!,
        dx = b.x - a.x,
        dz = b.z - a.z,
        t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz))),
        point = { x: a.x + t * dx, z: a.z + t * dz },
        distance = Math.hypot(p.x - point.x, p.z - point.z);
      if (!best || distance < best.distance)
        best = { point, from: edge.from, to: edge.to, distance };
    }
    return best;
  };
  const a = project(local(start)),
    b = project(local(end));
  if (!a || !b) return [];
  if (a.from === b.from && a.to === b.to)
    return [a.point, b.point, local(end)].map(
      (p) => new T.Vector3(p.x + origin.x, start.y, p.z + origin.z),
    );
  const cost = new Map<string, number>(),
    previous = new Map<string, string>(),
    open = new MinQueue(),
    settled = new Set<string>();
  for (const id of [a.from, a.to]) {
    const p = nodes.get(id)!;
    cost.set(id, Math.hypot(p.x - a.point.x, p.z - a.point.z));
    open.push(id, cost.get(id)!);
  }
  const adjacency = new Map(graph.nodes.map((n) => [n.id, [] as { id: string; cost: number }[]]));
  for (const e of graph.edges) {
    adjacency.get(e.from)!.push({ id: e.to, cost: e.length });
    adjacency.get(e.to)!.push({ id: e.from, cost: e.length });
  }
  while (open.size) {
    const entry = open.pop();
    if (!entry || settled.has(entry.id) || entry.cost !== cost.get(entry.id)) continue;
    const current = entry.id,
      best = entry.cost;
    settled.add(current);
    if (settled.has(b.from) && settled.has(b.to)) break;
    for (const next of adjacency.get(current) || []) {
      const candidate = best + next.cost;
      if (candidate < (cost.get(next.id) ?? Infinity)) {
        cost.set(next.id, candidate);
        previous.set(next.id, current);
        open.push(next.id, candidate);
      }
    }
  }
  const candidates = [b.from, b.to]
    .map((id) => {
      const p = nodes.get(id)!;
      return {
        id,
        cost: (cost.get(id) ?? Infinity) + Math.hypot(p.x - b.point.x, p.z - b.point.z),
      };
    })
    .sort((a, b) => a.cost - b.cost);
  if (!Number.isFinite(candidates[0].cost)) return [];
  const route = [];
  for (let id: string | undefined = candidates[0].id; id; id = previous.get(id))
    route.push(nodes.get(id)!);
  route.reverse();
  const points =
    a.from === b.from && a.to === b.to ? [a.point, b.point] : [a.point, ...route, b.point];
  return [...points, local(end)].map((p) => new T.Vector3(p.x + origin.x, start.y, p.z + origin.z));
}
