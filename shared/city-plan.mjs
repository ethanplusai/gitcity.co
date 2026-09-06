import { CityAxisCache } from './city-axis.mjs';
export const PLAN_VERSION = 2;
// Every owner shares these street coordinates. Row-dependent block widths produce
// T-junctions; gentle bends are shared by adjoining blocks, so boundaries still meet.
const cityAxes = new CityAxisCache();
const axis = (index, seed, minimum, variation) => cityAxes.get(index, seed, minimum, variation);
export function cityCell(owner, column, row) {
  const z0 = axis(row, `${owner}:rows`, 18, 7),
    z1 = axis(row + 1, `${owner}:rows`, 18, 7);
  const x0 = axis(column, `${owner}:row:${row}`, 20, 7),
    x1 = axis(column + 1, `${owner}:row:${row}`, 20, 7);
  const bend = (z) => Math.sin(z * 0.018) * 3.2;
  const polygon = [
    { x: x0 + bend(z0), z: z0 },
    { x: x1 + bend(z0), z: z0 },
    { x: x1 + bend(z1), z: z1 },
    { x: x0 + bend(z1), z: z1 },
  ];
  return {
    column,
    row,
    polygon,
    center: { x: (x0 + x1) / 2 + bend((z0 + z1) / 2), z: (z0 + z1) / 2 },
    width: x1 - x0,
    depth: z1 - z0,
  };
}
export function landCandidates(owner, anchor, claimed, count, canPlace = null) {
  const result = [];
  for (let radius = 2; result.length < count && radius <= 128; radius *= 2) {
    const options = [];
    for (let row = -radius; row <= radius; row++)
      for (let column = -radius; column <= radius; column++) {
        if (Math.abs(row) <= 0 && Math.abs(column) <= 0) continue; // civic square, reserved independently of repo activity
        const key = `${column}:${row}`;
        if (claimed.has(key)) continue;
        const cell = cityCell(owner, column, row),
          distance = Math.hypot(cell.center.x - anchor.x, cell.center.z - anchor.z);
        if (canPlace && !canPlace(cell)) continue;
        options.push({ ...cell, distance, key });
      }
    options.sort((a, b) => a.distance - b.distance || a.row - b.row || a.column - b.column);
    for (const option of options) {
      if (result.length >= count) break;
      claimed.add(option.key);
      result.push(option);
    }
  }
  if (result.length < count) throw new Error('The current city planning region is full.');
  return result;
}
// Merge collinear boundary subdivisions into a real graph. This is also the source
// of street-rendering segments and pedestrian/vehicle routing nodes.
export function streetGraph(cells, additional = []) {
  const segments = [
    ...cells.flatMap((cell) =>
      cell.polygon.map((p, i) => ({
        points: [p, cell.polygon[(i + 1) % cell.polygon.length]],
        kind:
          (i === 0 && cell.row === 0) || (i === 2 && cell.row === -1)
            ? 'avenue'
            : (i === 3 && cell.column === 0) || (i === 1 && cell.column === -1)
              ? 'collector'
              : 'local',
      })),
    ),
    ...additional,
  ];
  const vertices = new Map(),
    edges = new Map(),
    key = (p) => `${p.x.toFixed(5)}:${p.z.toFixed(5)}`;
  for (const segment of segments) for (const p of segment.points) vertices.set(key(p), p);
  const points = [...vertices.values()];
  const bins = new Map();
  for (const point of points) {
    const id = `${Math.floor(point.x / 32)}:${Math.floor(point.z / 32)}`;
    const bucket = bins.get(id) || [];
    bucket.push(point);
    bins.set(id, bucket);
  }
  for (const {
    points: [a, b],
    kind,
    mandatory,
  } of segments) {
    const dx = b.x - a.x,
      dz = b.z - a.z,
      length2 = dx * dx + dz * dz;
    const nearby = [];
    for (
      let z = Math.floor((Math.min(a.z, b.z) - 1e-5) / 32);
      z <= Math.floor((Math.max(a.z, b.z) + 1e-5) / 32);
      z++
    )
      for (
        let x = Math.floor((Math.min(a.x, b.x) - 1e-5) / 32);
        x <= Math.floor((Math.max(a.x, b.x) + 1e-5) / 32);
        x++
      )
        nearby.push(...(bins.get(`${x}:${z}`) || []));
    const cuts = nearby
      .map((p) => ({ p, t: ((p.x - a.x) * dx + (p.z - a.z) * dz) / length2 }))
      .filter(
        ({ p, t }) =>
          t >= -1e-7 && t <= 1 + 1e-7 && Math.abs((p.x - a.x) * dz - (p.z - a.z) * dx) < 1e-5,
      )
      .sort((a, b) => a.t - b.t);
    for (let i = 1; i < cuts.length; i++) {
      const from = key(cuts[i - 1].p),
        to = key(cuts[i].p);
      if (from === to) continue;
      const id = [from, to].sort().join('|');
      edges.set(id, {
        id,
        kind,
        halfWidth: kind === 'avenue' ? 0.95 : kind === 'collector' ? 0.85 : 0.7,
        from,
        to,
        length: Math.hypot(cuts[i].p.x - cuts[i - 1].p.x, cuts[i].p.z - cuts[i - 1].p.z),
        ...(mandatory ? { mandatory: true } : {}),
      });
    }
  }
  return { nodes: points.map((p) => ({ ...p, id: key(p) })), edges: [...edges.values()] };
}

// Frontage parcels are derived from their enclosing block, never independently scattered.
// The open middle remains a courtyard, not a giant paved surface.
export function frontageLots(cell) {
  const lots = [];
  for (let edge = 0; edge < cell.polygon.length; edge++) {
    const a = cell.polygon[edge],
      b = cell.polygon[(edge + 1) % cell.polygon.length],
      dx = b.x - a.x,
      dz = b.z - a.z,
      length = Math.hypot(dx, dz),
      ux = dx / length,
      uz = dz / length;
    const count = Math.max(1, Math.floor((length - 6.6) / 3.2)),
      spacing = (length - 6.6) / count;
    for (let i = 0; i < count; i++) {
      const along = 3.3 + (i + 0.5) * spacing,
        front = { x: a.x + ux * along - uz * 1.8, z: a.z + uz * along + ux * 1.8 };
      const candidate = {
        edge,
        slot: lots.length,
        x: front.x - uz * 1.45,
        z: front.z + ux * 1.45,
        front,
        rotation: Math.atan2(uz, -ux),
        width: Math.min(3, spacing),
        depth: 2.9,
      };
      if (!lots.some((lot) => lotsOverlap(lot, candidate, 0.12))) lots.push(candidate);
    }
  }
  return lots;
}

export function lotsOverlap(a, b, padding = 0) {
  const axes = (lot) => [
    { x: Math.cos(lot.rotation), z: -Math.sin(lot.rotation) },
    { x: Math.sin(lot.rotation), z: Math.cos(lot.rotation) },
  ];
  const aa = axes(a),
    bb = axes(b),
    delta = { x: b.x - a.x, z: b.z - a.z };
  for (const axis of [...aa, ...bb]) {
    const dot = (v) => Math.abs(v.x * axis.x + v.z * axis.z);
    const radius =
      (a.width / 2 + padding) * dot(aa[0]) +
      (a.depth / 2 + padding) * dot(aa[1]) +
      (b.width / 2 + padding) * dot(bb[0]) +
      (b.depth / 2 + padding) * dot(bb[1]);
    if (dot(delta) >= radius) return false;
  }
  return true;
}

// Connect developed blocks to the existing fabric, rather than drawing a
// separate L-shaped belt of empty blocks from every site back to city hall.
// Stable tie-breaking makes the same occupied set produce the same plan.
export function connectedCityCells(owner, occupied) {
  const key = (c) => `${c.column}:${c.row}`;
  const targets = new Map(occupied.map((c) => [key(c), c]));
  targets.set('0:0', cityCell(owner, 0, 0));
  const connected = new Map([['0:0', cityCell(owner, 0, 0)]]);
  while ([...targets.keys()].some((id) => !connected.has(id))) {
    // Attach adjoining developed cells as a component before looking for a
    // bridge. Large surveyed neighborhoods should not repeat a global BFS for
    // every individual cell already touching the network.
    const adjoining = [...connected.values()];
    for (let i = 0; i < adjoining.length; i++) {
      const cell = adjoining[i];
      for (const [dx, dz] of [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ]) {
        const column = cell.column + dx,
          row = cell.row + dz,
          id = `${column}:${row}`;
        if (!targets.has(id) || connected.has(id)) continue;
        const next = cityCell(owner, column, row);
        connected.set(id, next);
        adjoining.push(next);
      }
    }
    if ([...targets.keys()].every((id) => connected.has(id))) break;
    const queue = [...connected.values()].sort((a, b) => a.row - b.row || a.column - b.column);
    const previous = new Map(queue.map((c) => [key(c), null]));
    let found = null;
    for (let i = 0; i < queue.length && !found; i++) {
      const cell = queue[i];
      for (const [dx, dz] of [
        [0, -1],
        [-1, 0],
        [1, 0],
        [0, 1],
      ]) {
        const next = { column: cell.column + dx, row: cell.row + dz };
        const id = key(next);
        if (previous.has(id)) continue;
        previous.set(id, cell);
        if (targets.has(id) && !connected.has(id)) {
          found = next;
          break;
        }
        queue.push(next);
      }
    }
    for (let cell = found; cell; cell = previous.get(key(cell)))
      connected.set(key(cell), cityCell(owner, cell.column, cell.row));
  }
  return [...connected.values()].sort((a, b) => a.row - b.row || a.column - b.column);
}

// Keep every developed frontage, then join those street components by the
// shortest available boundary links. Empty connecting land does not need a grid.
export function connectedStreetGraph(cells, developed, additional = []) {
  const graph = streetGraph(cells, additional);
  const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
  const parent = new Map(graph.nodes.map((n) => [n.id, n.id]));
  const root = (id) => {
    let p = id;
    while (parent.get(p) !== p) p = parent.get(p);
    while (parent.get(id) !== id) {
      const next = parent.get(id);
      parent.set(id, p);
      id = next;
    }
    return p;
  };
  const boundaryBins = new Map();
  for (const cell of developed)
    for (let i = 0; i < cell.polygon.length; i++) {
      const u = cell.polygon[i],
        v = cell.polygon[(i + 1) % cell.polygon.length];
      const segment = { u, v };
      for (
        let x = Math.floor((Math.min(u.x, v.x) - 1e-5) / 32);
        x <= Math.floor((Math.max(u.x, v.x) + 1e-5) / 32);
        x++
      )
        for (
          let z = Math.floor((Math.min(u.z, v.z) - 1e-5) / 32);
          z <= Math.floor((Math.max(u.z, v.z) + 1e-5) / 32);
          z++
        ) {
          const key = `${x}:${z}`,
            bin = boundaryBins.get(key) || [];
          bin.push(segment);
          boundaryBins.set(key, bin);
        }
    }
  const required = (edge) => {
    if (edge.mandatory) return true;
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    const p = { x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 };
    return (boundaryBins.get(`${Math.floor(p.x / 32)}:${Math.floor(p.z / 32)}`) || []).some(
      ({ u, v }) => {
        const dx = v.x - u.x,
          dz = v.z - u.z;
        const t = ((p.x - u.x) * dx + (p.z - u.z) * dz) / (dx * dx + dz * dz);
        return t >= -1e-7 && t <= 1 + 1e-7 && Math.abs((p.x - u.x) * dz - (p.z - u.z) * dx) < 1e-5;
      },
    );
  };
  const fixed = graph.edges.filter(required),
    selected = [...fixed];
  for (const edge of fixed) parent.set(root(edge.from), root(edge.to));
  const fixedIds = new Set(fixed.map((e) => e.id));
  for (const edge of graph.edges
    .filter((e) => !fixedIds.has(e.id))
    .sort((a, b) => {
      const difference = Number(a.length.toFixed(5)) - Number(b.length.toFixed(5));
      const pa = nodes.get(a.from),
        qa = nodes.get(a.to),
        pb = nodes.get(b.from),
        qb = nodes.get(b.to);
      return (
        difference ||
        Number(((pa.z + qa.z - pb.z - qb.z) / 2).toFixed(5)) ||
        Number(((pa.x + qa.x - pb.x - qb.x) / 2).toFixed(5))
      );
    })) {
    const a = root(edge.from),
      b = root(edge.to);
    if (a !== b) {
      selected.push(edge);
      parent.set(a, b);
    }
  }
  // Kruskal also reaches unused boundary vertices. Peel their dead ends until
  // only useful connections and developed frontage remain.
  const degree = new Map(graph.nodes.map((n) => [n.id, 0]));
  for (const e of selected) {
    degree.set(e.from, degree.get(e.from) + 1);
    degree.set(e.to, degree.get(e.to) + 1);
  }
  let edges = selected,
    changed = true;
  while (changed) {
    changed = false;
    edges = edges.filter((e) => {
      if (fixedIds.has(e.id) || (degree.get(e.from) > 1 && degree.get(e.to) > 1)) return true;
      degree.set(e.from, degree.get(e.from) - 1);
      degree.set(e.to, degree.get(e.to) - 1);
      changed = true;
      return false;
    });
  }
  const used = new Set(edges.flatMap((e) => [e.from, e.to]));
  return {
    nodes: graph.nodes.filter((n) => used.has(n.id)),
    edges: edges.map((e) => ({ ...e, connector: !fixedIds.has(e.id) })),
  };
}
