import { SegmentIndex } from './segment-index.mjs';
import { MinQueue } from './min-queue.mjs';
import { random } from './model.mjs';
const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const mix = (a, b, t) => ({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t });
const edgeKey = (e) => e.id || [e.from, e.to].sort().join('|');

export class JourneyNetwork {
  constructor(graph, destinations, closures = []) {
    this.graph = graph;
    this.nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    this.links = new Map(graph.nodes.map((n) => [n.id, []]));
    this.closed = new Set();
    this.spatial = new SegmentIndex(graph, this.nodes);
    for (const p of closures) {
      const projected = this.project(p);
      if (projected) this.closed.add(edgeKey(projected.edge));
    }
    for (const e of graph.edges) {
      this.links.get(e.from).push({ to: e.to, edge: e });
      this.links.get(e.to).push({ to: e.from, edge: e });
    }
    this.destinations = destinations
      .map((d) => ({ ...d, projection: this.project(d.point) }))
      .filter((d) => d.projection);
    this.cache = new Map();
  }
  project(p) {
    return this.spatial.nearest(p);
  }
  coverage(a, b) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    if (length2 < 1e-10) return [];
    const intervals = [];
    // Match the collinearity tolerance below, including very short segments.
    const padding = 1e-4 / Math.sqrt(length2) + 1e-8;
    const candidates = this.spatial.overlaps(
      Math.min(a.x, b.x) - padding,
      Math.min(a.z, b.z) - padding,
      Math.max(a.x, b.x) + padding,
      Math.max(a.z, b.z) + padding,
    );
    for (const edge of candidates) {
      const p = this.nodes.get(edge.from),
        q = this.nodes.get(edge.to);
      if (
        Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) > 1e-4 ||
        Math.abs((q.x - a.x) * dz - (q.z - a.z) * dx) > 1e-4
      )
        continue;
      const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2;
      const u = ((q.x - a.x) * dx + (q.z - a.z) * dz) / length2;
      intervals.push({
        start: Math.max(0, Math.min(t, u)),
        end: Math.min(1, Math.max(t, u)),
        id: edgeKey(edge),
      });
    }
    intervals.sort((a, b) => a.start - b.start);
    let covered = 0;
    const ids = [];
    for (const interval of intervals) {
      if (interval.end <= covered) continue;
      if (interval.start > covered + 1e-6) return null;
      covered = interval.end;
      ids.push(interval.id);
      if (covered >= 1 - 1e-6) return ids;
    }
    return null;
  }
  path(from, to, vehicle = false) {
    const key = `${from.id}>${to.id}:${vehicle}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const a = from.projection,
      b = to.projection;
    if (vehicle && (this.closed.has(edgeKey(a.edge)) || this.closed.has(edgeKey(b.edge))))
      return null;
    const costs = new Map(),
      previous = new Map(),
      open = new MinQueue();
    for (const id of [a.edge.from, a.edge.to]) {
      const cost = distance(a.point, this.nodes.get(id));
      costs.set(id, cost);
      open.push(id, cost);
    }
    let bestGoal = Infinity;
    while (open.size) {
      const { id: current, cost: best } = open.pop();
      if (best !== costs.get(current)) continue;
      if (best > bestGoal) break;
      if (current === b.edge.from || current === b.edge.to)
        bestGoal = Math.min(bestGoal, best + distance(b.point, this.nodes.get(current)));
      for (const next of this.links.get(current)) {
        if (vehicle && this.closed.has(edgeKey(next.edge))) continue;
        const value = best + next.edge.length;
        if (value < (costs.get(next.to) ?? Infinity)) {
          costs.set(next.to, value);
          previous.set(next.to, { id: current, edge: next.edge });
          open.push(next.to, value);
        }
      }
    }
    const options = [b.edge.from, b.edge.to]
      .map((id) => ({
        id,
        cost: (costs.get(id) ?? Infinity) + distance(b.point, this.nodes.get(id)),
      }))
      .sort((a, b) => a.cost - b.cost);
    if (!Number.isFinite(options[0].cost)) return null;
    let points, edges;
    if (edgeKey(a.edge) === edgeKey(b.edge)) {
      points = [a.point, b.point];
      edges = [edgeKey(a.edge)];
    } else {
      const vertices = [],
        traversed = [];
      for (let id = options[0].id; id;) {
        vertices.push(this.nodes.get(id));
        const p = previous.get(id);
        if (p) traversed.push(edgeKey(p.edge));
        id = p?.id;
      }
      points = [a.point, ...vertices.reverse(), b.point];
      edges = [edgeKey(a.edge), ...traversed.reverse(), edgeKey(b.edge)];
    }
    points = points.filter((p, i) => i === 0 || distance(p, points[i - 1]) > 1e-5);
    const route = { points, edges };
    if (this.cache.size > 512) this.cache.delete(this.cache.keys().next().value);
    this.cache.set(key, route);
    return route;
  }
}

function lanePath(points, offset) {
  if (points.length < 2) return points;
  return points.map((p, i) => {
    const a = points[Math.max(0, i - 1)],
      b = points[Math.min(points.length - 1, i + 1)];
    let incoming = i ? { x: (p.x - a.x) / distance(p, a), z: (p.z - a.z) / distance(p, a) } : null;
    const outgoing =
      i < points.length - 1
        ? { x: (b.x - p.x) / distance(b, p), z: (b.z - p.z) / distance(b, p) }
        : incoming;
    incoming ||= outgoing;
    const nx = incoming.z + outgoing.z,
      nz = -incoming.x - outgoing.x,
      denom = nx * incoming.z - nz * incoming.x;
    const factor = Math.abs(denom) < 0.2 ? offset / 2 : offset / denom;
    return { x: p.x + nx * factor, z: p.z + nz * factor };
  });
}
function rounded(points, radius) {
  if (points.length < 3) return points;
  const result = [points[0]];
  for (let i = 1; i < points.length - 1; i++) {
    const a = points[i - 1],
      b = points[i],
      c = points[i + 1],
      r = Math.min(radius, distance(a, b) * 0.3, distance(b, c) * 0.3);
    if (r < 0.01) {
      result.push(b);
      continue;
    }
    const entry = mix(b, a, r / distance(a, b)),
      exit = mix(b, c, r / distance(b, c));
    result.push(entry);
    for (let step = 1; step <= 4; step++) {
      const t = step / 4;
      result.push(mix(mix(entry, b, t), mix(b, exit, t), t));
    }
  }
  result.push(points.at(-1));
  return result;
}

export class CityJourneys {
  /** @param {ReturnType<CityJourneys['snapshot']> | null} snapshot */
  constructor(network, count, seed, vehicle = false, snapshot = null, offset = { x: 0, z: 0 }) {
    this.network = network;
    this.vehicle = vehicle;
    this.rng = random(seed);
    this.completed = 0;
    const available = vehicle
      ? network.destinations.filter((d) => !network.closed.has(edgeKey(d.projection.edge)))
      : network.destinations;
    const choices = available.length ? available : network.destinations;
    this.actors = Array.from({ length: choices.length ? count : 0 }, (_, index) => {
      const origin = choices[index % choices.length];
      const actor = {
        origin,
        target: origin,
        position: { ...(vehicle ? origin.projection.point : origin.point) },
        angle: 0,
        speed: vehicle ? 1.6 + this.rng() * 0.8 : 0.38 + this.rng() * 0.18,
        wait: 0,
        route: [],
        segment: 0,
        progress: 0,
        visits: 0,
        moving: false,
        edges: [],
      };
      const saved = snapshot?.actors[index];
      if (saved) return actor;
      this.choose(actor);
      // Distribute initial visitors along real trips without spawning them in a single crowd.
      const initial =
        this.rng() *
        actor.route.reduce((sum, p, i) => (i ? sum + distance(actor.route[i - 1], p) : sum), 0);
      this.advance(actor, initial);
      return actor;
    });
    if (snapshot) this.restore(snapshot, offset);
  }
  choose(actor, preferred = null) {
    const candidates = this.network.destinations;
    for (let attempt = 0; attempt < Math.min(candidates.length * 2, 32); attempt++) {
      const target =
        attempt === 0 && preferred
          ? preferred
          : candidates[Math.floor(this.rng() * candidates.length)];
      if (target.id === actor.origin.id) continue;
      const path = this.network.path(actor.origin, target, this.vehicle);
      if (!path || path.points.length < 2) continue;
      const lanes = lanePath(path.points, this.vehicle ? 0.42 : 1.35);
      actor.route = rounded(
        [actor.position, ...lanes, ...(this.vehicle ? [] : [target.point])],
        this.vehicle ? 0.45 : 0.15,
      ).filter((p, i, array) => !i || distance(p, array[i - 1]) > 1e-5);
      actor.segment = 0;
      actor.progress = 0;
      actor.target = target;
      actor.edges = path.edges;
      actor.moving = true;
      return;
    }
    actor.wait = 5;
    actor.moving = false;
  }
  advance(actor, remaining) {
    while (remaining > 0 && actor.segment < actor.route.length - 1) {
      const a = actor.route[actor.segment],
        b = actor.route[actor.segment + 1],
        length = distance(a, b),
        step = Math.min(remaining, length - actor.progress);
      actor.progress += step;
      remaining -= step;
      actor.position = mix(a, b, length ? actor.progress / length : 1);
      actor.angle = Math.atan2(b.x - a.x, b.z - a.z);
      if (actor.progress >= length - 1e-8) {
        actor.segment++;
        actor.progress = 0;
      }
    }
    if (actor.route.length && actor.segment >= actor.route.length - 1) {
      actor.origin = actor.target;
      actor.wait = this.vehicle ? 2 + this.rng() * 4 : 4 + this.rng() * 12;
      actor.moving = false;
      actor.visits++;
      this.completed++;
    }
  }
  snapshot() {
    return {
      completed: this.completed,
      streets: this.network.graph.edges.map((edge) => ({
        id: edgeKey(edge),
        a: this.network.nodes.get(edge.from),
        b: this.network.nodes.get(edge.to),
      })),
      actors: this.actors.map((a) => ({
        ...a,
        origin: a.origin.id,
        target: a.target.id,
        position: { ...a.position },
        route: a.route.map((p) => ({ ...p })),
      })),
    };
  }
  restore(snapshot, offset = { x: 0, z: 0 }) {
    if (!snapshot) return;
    this.completed = snapshot.completed;
    const destinations = new Map(this.network.destinations.map((d) => [d.id, d]));
    const savedStreets = new Map((snapshot.streets || []).map((edge) => [edge.id, edge]));
    const currentEdges = new Set(this.network.graph.edges.map(edgeKey));
    this.actors.forEach((actor, i) => {
      const saved = snapshot.actors[i];
      if (!saved) return;
      const translate = (p) => ({ x: p.x + offset.x, z: p.z + offset.z });
      const position = translate(saved.position);
      const origin = destinations.get(saved.origin) || {
        id: `transit:${i}`,
        point: position,
        projection: this.network.project(position),
      };
      const target = destinations.get(saved.target);
      const route = saved.route.map(translate);
      const edges =
        offset.x || offset.z
          ? [
              ...new Set(
                route
                  .map((p) => this.network.project(p))
                  .filter(Boolean)
                  .map((p) => edgeKey(p.edge)),
              ),
            ]
          : saved.edges;
      let missingRoad = false;
      const remapped = saved.edges.flatMap((id) => {
        const street = savedStreets.get(id);
        const covered = street
          ? this.network.coverage(translate(street.a), translate(street.b))
          : currentEdges.has(id)
            ? [id]
            : null;
        if (!covered) missingRoad = true;
        return covered || [];
      });
      Object.assign(actor, saved, {
        origin,
        target: target || origin,
        position,
        route,
        edges: snapshot.streets ? remapped : edges,
      });
      if (
        !target ||
        missingRoad ||
        (this.vehicle && actor.edges.some((e) => this.network.closed.has(e)))
      ) {
        actor.origin = {
          id: `transit:${i}`,
          point: actor.position,
          projection: this.network.project(actor.position),
        };
        actor.route = [];
        actor.segment = 0;
        actor.progress = 0;
        actor.wait = 0;
        this.choose(actor, target);
      }
    });
  }
  update(dt, player, paused = false) {
    if (paused || dt <= 0) return;
    const positions = this.actors.map((a) => ({ ...a.position, angle: a.angle }));
    for (const [i, actor] of this.actors.entries()) {
      if (actor.wait > 0) {
        actor.wait -= dt;
        if (actor.wait <= 0) this.choose(actor);
        continue;
      }
      const p = actor.position,
        forward = { x: Math.sin(actor.angle), z: Math.cos(actor.angle) };
      const obstructed =
        this.vehicle &&
        (distance(p, player) < 1.4 ||
          positions.some((other, j) => {
            if (j === i || distance(other, p) >= 1.35) return false;
            const dx = other.x - p.x,
              dz = other.z - p.z,
              alignment = Math.sin(other.angle) * forward.x + Math.cos(other.angle) * forward.z;
            const ahead = dx * forward.x + dz * forward.z,
              lateral = Math.abs(dx * forward.z - dz * forward.x);
            // Follow a leader in this lane; crossing traffic uses a stable priority.
            return (
              (alignment > 0.5 && ahead > 0.05 && lateral < 0.5) ||
              (Math.abs(alignment) < 0.5 && j < i && ahead > -0.2)
            );
          }));
      actor.moving = !obstructed;
      if (!obstructed) this.advance(actor, dt * actor.speed);
    }
  }
}
