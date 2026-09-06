// Street pavement is the space around city blocks, rather than intersecting boxes.
export function polygonArea(points) {
  return (
    points.reduce((sum, a, i) => {
      const b = points[(i + 1) % points.length];
      return sum + a.x * b.z - b.x * a.z;
    }, 0) / 2
  );
}
export function insetPolygon(points, distance) {
  const polygon = points.filter((p, i) => {
    const a = points[(i + points.length - 1) % points.length],
      b = points[(i + 1) % points.length];
    return Math.abs((p.x - a.x) * (b.z - p.z) - (p.z - a.z) * (b.x - p.x)) > 1e-7;
  });
  return polygon.map((p, i) => {
    const a = polygon[(i + polygon.length - 1) % polygon.length],
      b = polygon[(i + 1) % polygon.length];
    const l1 = Math.hypot(p.x - a.x, p.z - a.z),
      l2 = Math.hypot(b.x - p.x, b.z - p.z);
    const u = { x: (p.x - a.x) / l1, z: (p.z - a.z) / l1 },
      v = { x: (b.x - p.x) / l2, z: (b.z - p.z) / l2 };
    const n = { x: -u.z - v.z, z: u.x + v.x },
      denom = n.x * -u.z + n.z * u.x;
    return { x: p.x + (n.x * distance) / denom, z: p.z + (n.z * distance) / denom };
  });
}
export function pointInPolygon(point, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i],
      b = polygon[j];
    if (
      a.z > point.z !== b.z > point.z &&
      point.x < ((b.x - a.x) * (point.z - a.z)) / (b.z - a.z) + a.x
    )
      inside = !inside;
  }
  return inside;
}
export function streetBoundaryLoops(cells, graph) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n])),
    boundary = [];
  for (const edge of graph.edges) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to),
      dx = (b.x - a.x) / edge.length,
      dz = (b.z - a.z) / edge.length;
    const left = { x: (a.x + b.x) / 2 - dz * 0.001, z: (a.z + b.z) / 2 + dx * 0.001 },
      right = { x: (a.x + b.x) / 2 + dz * 0.001, z: (a.z + b.z) / 2 - dx * 0.001 };
    const l = cells.some((c) => pointInPolygon(left, c.polygon)),
      r = cells.some((c) => pointInPolygon(right, c.polygon));
    if (l !== r)
      boundary.push(l ? { from: edge.from, to: edge.to } : { from: edge.to, to: edge.from });
  }
  const byStart = new Map(boundary.map((e) => [e.from, e])),
    unused = new Set(boundary),
    loops = [];
  while (unused.size) {
    const first = unused.values().next().value,
      loop = [];
    let edge = first;
    do {
      if (!edge || !unused.has(edge)) throw new Error('City boundary is not a closed manifold');
      unused.delete(edge);
      loop.push(nodes.get(edge.from));
      edge = byStart.get(edge.to);
    } while (edge !== first);
    loops.push(loop);
  }
  return loops;
}

// Offset each boundary by its street width. Intersect neighboring offset lines,
// retaining collinear subdivisions where a street profile changes.
export function insetPolygonEdges(points, distances) {
  return points.flatMap((p, i) => {
    const previous = (i + points.length - 1) % points.length;
    const a = points[previous],
      b = points[(i + 1) % points.length];
    const l1 = Math.hypot(p.x - a.x, p.z - a.z);
    const l2 = Math.hypot(b.x - p.x, b.z - p.z);
    const u = { x: (p.x - a.x) / l1, z: (p.z - a.z) / l1 };
    const v = { x: (b.x - p.x) / l2, z: (b.z - p.z) / l2 };
    const first = { x: p.x - u.z * distances[previous], z: p.z + u.x * distances[previous] };
    const second = { x: p.x - v.z * distances[i], z: p.z + v.x * distances[i] };
    const cross = u.x * v.z - u.z * v.x;
    if (Math.abs(cross) < 1e-7)
      return Math.abs(distances[previous] - distances[i]) < 1e-7 ? [first] : [first, second];
    const t = ((second.x - first.x) * v.z - (second.z - first.z) * v.x) / cross;
    return [{ x: first.x + t * u.x, z: first.z + t * u.z }];
  });
}
/** @returns {number[]} */
export function streetWidths(polygon, graph) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  return polygon.map((a, i) => {
    const b = polygon[(i + 1) % polygon.length];
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    let width = 0.7;
    for (const edge of graph.edges) {
      const p = nodes.get(edge.from),
        q = nodes.get(edge.to);
      if (
        Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) > 1e-5 ||
        Math.abs((q.x - a.x) * dz - (q.z - a.z) * dx) > 1e-5
      )
        continue;
      const t = ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2;
      const u = ((q.x - a.x) * dx + (q.z - a.z) * dz) / length2;
      if (Math.min(t, u) < 1 - 1e-7 && Math.max(t, u) > 1e-7)
        width = Math.max(width, edge.halfWidth ?? 0.95);
    }
    return width;
  });
}

// Walk directed street edges with the face on the left. Bridges occur twice in
// the exterior walk; buffering that walk produces one joined pavement boundary.
/** @param {number | null} fixedWidth */
export function streetContours(graph, extra = 0, fixedWidth = null) {
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const outgoing = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const e of graph.edges) {
    outgoing.get(e.from).push({ from: e.from, to: e.to, width: e.halfWidth });
    outgoing.get(e.to).push({ from: e.to, to: e.from, width: e.halfWidth });
  }
  for (const [id, edges] of outgoing) {
    const a = nodes.get(id);
    edges.sort(
      (u, v) =>
        Math.atan2(nodes.get(u.to).z - a.z, nodes.get(u.to).x - a.x) -
        Math.atan2(nodes.get(v.to).z - a.z, nodes.get(v.to).x - a.x),
    );
  }
  const visited = new Set(),
    contours = [];
  for (const edges of outgoing.values())
    for (const start of edges) {
      if (visited.has(start)) continue;
      const walk = [];
      let edge = start;
      do {
        visited.add(edge);
        walk.push(edge);
        const next = outgoing.get(edge.to),
          reverse = next.findIndex((n) => n.to === edge.from);
        edge = next[(reverse + next.length - 1) % next.length];
      } while (edge !== start);
      const points = walk.flatMap((next, i) => {
        const prev = walk[(i + walk.length - 1) % walk.length];
        const a = nodes.get(prev.from),
          p = nodes.get(next.from),
          b = nodes.get(next.to);
        const l1 = Math.hypot(p.x - a.x, p.z - a.z),
          l2 = Math.hypot(b.x - p.x, b.z - p.z);
        const u = { x: (p.x - a.x) / l1, z: (p.z - a.z) / l1 },
          v = { x: (b.x - p.x) / l2, z: (b.z - p.z) / l2 };
        const w1 = fixedWidth ?? prev.width + extra,
          w2 = fixedWidth ?? next.width + extra;
        const first = { x: p.x - u.z * w1, z: p.z + u.x * w1 },
          second = { x: p.x - v.z * w2, z: p.z + v.x * w2 };
        const cross = u.x * v.z - u.z * v.x;
        if (Math.abs(cross) < 1e-7) {
          if (u.x * v.x + u.z * v.z < 0)
            return [
              { x: first.x + u.x * w1, z: first.z + u.z * w1 },
              { x: second.x + u.x * w2, z: second.z + u.z * w2 },
            ];
          return Math.abs(w1 - w2) < 1e-7 ? [first] : [first, second];
        }
        const t = ((second.x - first.x) * v.z - (second.z - first.z) * v.x) / cross;
        if (Math.abs(t) > Math.max(w1, w2) * 4) return [first, second];
        return [{ x: first.x + t * u.x, z: first.z + t * u.z }];
      });
      contours.push({ points, interior: polygonArea(walk.map((e) => nodes.get(e.from))) > 0 });
    }
  return contours;
}
