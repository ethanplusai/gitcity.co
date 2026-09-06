import { corridorGraph } from './road-network.mjs';

// Rebase each loaded owner's street graph into permanent world coordinates,
// then join exact gateway nodes to the same corridors used for rendering.
export function worldStreetGraph(owners, corridors) {
  const nodes = new Map(),
    edges = new Map();
  const key = (p) => `${p.x.toFixed(6)},${p.z.toFixed(6)}`;
  const add = (graph, origin) => {
    const ids = new Map();
    for (const node of graph.nodes) {
      const point = { x: node.x + origin.x, z: node.z + origin.z },
        id = key(point);
      nodes.set(id, { ...point, id });
      ids.set(node.id, id);
    }
    for (const edge of graph.edges) {
      const from = ids.get(edge.from),
        to = ids.get(edge.to);
      if (from === to) continue;
      const a = nodes.get(from),
        b = nodes.get(to);
      const id = [from, to].sort().join('|');
      edges.set(id, { from, to, length: Math.hypot(a.x - b.x, a.z - b.z) });
    }
  };
  owners.forEach(({ graph, origin }) => add(graph, origin));
  add(corridorGraph(corridors), { x: 0, z: 0 });
  return { nodes: [...nodes.values()], edges: [...edges.values()] };
}

/**
 * @param {{nodes: Array<{id: string, x: number, z: number}>, edges: Array<{from: string, to: string, length: number}>}} graph
 * @param {{x: number, z: number}} start
 */
export function connectedWorldGraph(graph, start) {
  const nearest = graph.nodes.reduce(
    (best, node) =>
      !best ||
      Math.hypot(node.x - start.x, node.z - start.z) <
        Math.hypot(best.x - start.x, best.z - start.z)
        ? node
        : best,
    null,
  );
  if (!nearest) return { nodes: [], edges: [] };
  const links = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const edge of graph.edges) {
    links.get(edge.from).push(edge.to);
    links.get(edge.to).push(edge.from);
  }
  const visited = new Set([nearest.id]),
    queue = [nearest.id];
  for (let i = 0; i < queue.length; i++)
    for (const next of links.get(queue[i])) {
      if (!visited.has(next)) {
        visited.add(next);
        queue.push(next);
      }
    }
  return {
    nodes: graph.nodes.filter((node) => visited.has(node.id)),
    edges: graph.edges.filter((edge) => visited.has(edge.from) && visited.has(edge.to)),
  };
}
