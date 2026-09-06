import { HIGHWAY } from './highway-profile.mjs';
// Spatial road planning is independent of rendering. Coordinates are world units.
export function containsSite(point, site, padding = 0) {
  return (
    point.x > site.minX - padding &&
    point.x < site.maxX + padding &&
    point.z > site.minZ - padding &&
    point.z < site.maxZ + padding
  );
}
export function segmentHitsSite(a, b, site, padding = 0) {
  let near = 0,
    far = 1;
  for (const axis of ['x', 'z']) {
    const lo = site[axis === 'x' ? 'minX' : 'minZ'] - padding,
      hi = site[axis === 'x' ? 'maxX' : 'maxZ'] + padding,
      d = b[axis] - a[axis];
    if (Math.abs(d) < 1e-9) {
      if (a[axis] <= lo || a[axis] >= hi) return false;
      continue;
    }
    let t0 = (lo - a[axis]) / d,
      t1 = (hi - a[axis]) / d;
    if (t0 > t1) [t0, t1] = [t1, t0];
    near = Math.max(near, t0);
    far = Math.min(far, t1);
    if (near >= far) return false;
  }
  return far > 0 && near < 1;
}
export function gateway(site, toward, clearance = 1.1) {
  const center = { x: (site.minX + site.maxX) / 2, z: (site.minZ + site.maxZ) / 2 },
    dx = toward.x - center.x,
    dz = toward.z - center.z;
  if (Math.abs(dx) > Math.abs(dz))
    return { x: dx >= 0 ? site.maxX + clearance : site.minX - clearance, z: center.z };
  return { x: center.x, z: dz >= 0 ? site.maxZ + clearance : site.minZ - clearance };
}
// A visibility graph around site corners. It cannot cut through an occupied district,
// unlike free control-point splines. Reused corridors have a lower planning cost.
export function planConnection(start, end, sites, existing = [], clearance = 0.8) {
  const nodes = [start, end];
  for (const s of sites)
    for (const x of [s.minX - clearance, s.maxX + clearance])
      for (const z of [s.minZ - clearance, s.maxZ + clearance]) {
        const p = { x, z };
        if (!sites.some((other) => containsSite(p, other, clearance * 0.9))) nodes.push(p);
      }
  const key = (p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`;
  const reused = new Set(
    existing.flatMap((line) =>
      line.slice(1).map((p, i) => [key(line[i]), key(p)].sort().join('|')),
    ),
  );
  const costs = nodes.map(() => Infinity),
    prev = nodes.map(() => -1),
    open = new Set(nodes.map((_, i) => i));
  costs[0] = 0;
  while (open.size) {
    let current = -1,
      best = Infinity;
    for (const i of open) {
      const estimate = costs[i] + Math.hypot(nodes[i].x - end.x, nodes[i].z - end.z) * 0.65;
      if (estimate < best) {
        best = estimate;
        current = i;
      }
    }
    if (current < 0) break;
    if (current === 1) break;
    open.delete(current);
    for (const next of open) {
      const a = nodes[current],
        b = nodes[next];
      if (sites.some((s) => segmentHitsSite(a, b, s, clearance * 0.9))) continue;
      const weight = reused.has([key(a), key(b)].sort().join('|')) ? 0.65 : 1,
        candidate = costs[current] + Math.hypot(a.x - b.x, a.z - b.z) * weight;
      if (candidate < costs[next]) {
        costs[next] = candidate;
        prev[next] = current;
      }
    }
  }
  if (!Number.isFinite(costs[1])) return null;
  const result = [];
  for (let i = 1; i !== -1; i = prev[i]) result.push(nodes[i]);
  return result.reverse();
}

// Join a highway to an existing outer street junction. Moving outward from the
// extreme street coordinate cannot cross the city's interior parcels.
export function streetGateway(site, toward, nodes, clearance = 1.1) {
  if (!nodes?.length) return { entrance: null, exit: gateway(site, toward, clearance) };
  const center = { x: (site.minX + site.maxX) / 2, z: (site.minZ + site.maxZ) / 2 };
  const axis = Math.abs(toward.x - center.x) > Math.abs(toward.z - center.z) ? 'x' : 'z';
  const cross = axis === 'x' ? 'z' : 'x';
  const sign = toward[axis] >= center[axis] ? 1 : -1;
  const extreme = Math.max(...nodes.map((p) => p[axis] * sign));
  const entrance = nodes
    .filter((p) => Math.abs(p[axis] * sign - extreme) < 1e-5)
    .sort(
      (a, b) =>
        Math.abs(a[cross] - toward[cross]) - Math.abs(b[cross] - toward[cross]) ||
        a[cross] - b[cross],
    )[0];
  const limit =
    axis === 'x' ? (sign > 0 ? site.maxX : site.minX) : sign > 0 ? site.maxZ : site.minZ;
  return {
    entrance: { x: entrance.x, z: entrance.z },
    exit: { x: entrance.x, z: entrance.z, [axis]: limit + sign * clearance },
  };
}

// Split overlapping collinear routes into unique stretches, retaining every
// dependency on each stretch. Reverse traversal and different subdivisions agree.
export function sharedCorridors(routes) {
  const segments = routes
    .flatMap(({ points, dependency }) =>
      points.slice(1).map((b, i) => ({
        a: points[i],
        b,
        dependency,
      })),
    )
    .filter(({ a, b }) => Math.hypot(b.x - a.x, b.z - a.z) > 1e-7);
  const key = (p) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
  const edges = new Map();
  for (const { a, b, dependency } of segments) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    const cuts = [0, 1];
    for (const other of segments)
      for (const p of [other.a, other.b]) {
        const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2;
        if (
          t > 1e-7 &&
          t < 1 - 1e-7 &&
          Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) < 1e-6 * Math.sqrt(length2)
        )
          cuts.push(t);
      }
    // Crossing routes become real junctions, including when neither input has
    // a vertex at the intersection.
    for (const other of segments) {
      const ox = other.b.x - other.a.x,
        oz = other.b.z - other.a.z;
      const determinant = dx * oz - dz * ox;
      if (Math.abs(determinant) < 1e-9) continue;
      const qx = other.a.x - a.x,
        qz = other.a.z - a.z;
      const t = (qx * oz - qz * ox) / determinant;
      const u = (qx * dz - qz * dx) / determinant;
      if (t > 1e-7 && t < 1 - 1e-7 && u >= 0 && u <= 1) cuts.push(t);
    }
    const sorted = [...new Set(cuts)].sort((x, y) => x - y);
    for (let i = 1; i < sorted.length; i++) {
      const p = { x: a.x + dx * sorted[i - 1], z: a.z + dz * sorted[i - 1] },
        q = { x: a.x + dx * sorted[i], z: a.z + dz * sorted[i] };
      if (key(p) === key(q)) continue;
      const forward = key(p) < key(q),
        id = [key(p), key(q)].sort().join('|');
      if (!edges.has(id))
        edges.set(id, { points: forward ? [p, q] : [q, p], dependencies: new Set() });
      edges.get(id).dependencies.add(dependency);
    }
  }
  const pieces = [...edges]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, edge]) => ({
      points: edge.points,
      dependencies: [...edge.dependencies].sort(),
    }));
  const adjacent = new Map();
  pieces.forEach((piece, index) =>
    piece.points.forEach((p) => {
      const id = key(p);
      if (!adjacent.has(id)) adjacent.set(id, []);
      adjacent.get(id).push(index);
    }),
  );
  const used = new Set(),
    chains = [];
  pieces.forEach((piece, index) => {
    if (used.has(index)) return;
    used.add(index);
    const points = [...piece.points],
      signature = JSON.stringify(piece.dependencies);
    for (const front of [false, true]) {
      while (true) {
        const end = front ? points[0] : points.at(-1),
          links = adjacent.get(key(end));
        if (links.length !== 2) break;
        const next = links.find((candidate) => !used.has(candidate));
        if (next === undefined || JSON.stringify(pieces[next].dependencies) !== signature) break;
        used.add(next);
        const p = pieces[next].points.find((p) => key(p) !== key(end));
        if (front) points.unshift(p);
        else points.push(p);
      }
    }
    chains.push({ points, dependencies: piece.dependencies });
  });
  return chains;
}

export function corridorGraph(corridors, halfWidth = HIGHWAY.halfWidth) {
  const nodes = new Map(),
    edges = [];
  const key = (p) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
  for (const corridor of corridors) {
    for (let i = 1; i < corridor.points.length; i++) {
      const a = corridor.points[i - 1],
        b = corridor.points[i];
      const from = key(a),
        to = key(b);
      nodes.set(from, { id: from, x: a.x, z: a.z });
      nodes.set(to, { id: to, x: b.x, z: b.z });
      edges.push({ from, to, length: Math.hypot(b.x - a.x, b.z - a.z), halfWidth });
    }
  }
  return { nodes: [...nodes.values()], edges };
}
