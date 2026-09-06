// Road paint follows actual graph junctions, not every segment endpoint.
export function streetMarkings(graph) {
  const nodes = new Map(graph.nodes.map((node) => [node.id, node]));
  const incident = new Map(graph.nodes.map((node) => [node.id, []]));
  for (const edge of graph.edges) {
    incident.get(edge.from).push(edge);
    incident.get(edge.to).push(edge);
  }
  const crossings = [],
    dashes = [];
  for (const edge of graph.edges) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    const ux = (b.x - a.x) / edge.length,
      uz = (b.z - a.z) / edge.length;
    const approaches = [];
    for (const [node, reverse] of [
      [edge.from, false],
      [edge.to, true],
    ]) {
      const junction = incident.get(node);
      if (junction.length < 3) continue;
      const setback = Math.max(1.725, ...junction.map((e) => e.halfWidth)) + 0.4;
      if (edge.length < setback * 2 + 1) continue;
      const t = reverse ? edge.length - setback : setback;
      approaches.push(t);
      crossings.push({
        node,
        edge: edge.id,
        x: a.x + ux * t,
        z: a.z + uz * t,
        angle: Math.atan2(ux, uz),
        halfWidth: edge.halfWidth,
      });
    }
    if (edge.kind === 'local') continue;
    for (let t = 1.2; t < edge.length - 1.2; t += 3.4) {
      if (approaches.some((crossing) => Math.abs(crossing - t) < 1)) continue;
      dashes.push({ x: a.x + ux * t, z: a.z + uz * t, angle: Math.atan2(ux, uz) });
    }
  }
  return { crossings, dashes };
}
