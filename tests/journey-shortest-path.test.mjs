import test from 'node:test';
import assert from 'node:assert/strict';
import { JourneyNetwork } from '../shared/journeys.mjs';

test('bounded journey search matches exhaustive shortest costs with blocked roads and disconnected destinations', () => {
  const nodes = Array.from({ length: 49 }, (_, i) => ({
    id: String(i),
    x: (i % 7) * 10,
    z: Math.floor(i / 7) * 10,
  }));
  const edges = [];
  for (const node of nodes)
    for (const step of [1, 7]) {
      const target = nodes[Number(node.id) + step];
      if (!target || (step === 1 && target.z !== node.z)) continue;
      edges.push({ id: `${node.id}-${target.id}`, from: node.id, to: target.id, length: 10 });
    }
  nodes.push({ id: 'isolated-a', x: 200, z: 0 }, { id: 'isolated-b', x: 210, z: 0 });
  edges.push({ id: 'isolated', from: 'isolated-a', to: 'isolated-b', length: 10 });
  const destinations = edges
    .filter((_, i) => i % 9 === 0)
    .map((edge, i) => {
      const a = nodes.find((n) => n.id === edge.from),
        b = nodes.find((n) => n.id === edge.to);
      return { id: String(i), point: { x: a.x * 0.3 + b.x * 0.7, z: a.z * 0.3 + b.z * 0.7 } };
    });
  destinations.push({ id: 'isolated', point: { x: 205, z: 0 } });
  const network = new JourneyNetwork({ nodes, edges }, destinations, [
    { x: 25, z: 20 },
    { x: 30, z: 45 },
  ]);
  const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
  for (const vehicle of [false, true])
    for (const from of network.destinations)
      for (const to of network.destinations) {
        const a = from.projection,
          b = to.projection;
        let expected = Infinity;
        if (!vehicle || (!network.closed.has(a.edge.id) && !network.closed.has(b.edge.id))) {
          const costs = new Map(nodes.map((n) => [n.id, Infinity]));
          for (const id of [a.edge.from, a.edge.to])
            costs.set(id, distance(a.point, network.nodes.get(id)));
          for (let pass = 0; pass < nodes.length; pass++)
            for (const edge of edges) {
              if (vehicle && network.closed.has(edge.id)) continue;
              costs.set(edge.to, Math.min(costs.get(edge.to), costs.get(edge.from) + edge.length));
              costs.set(
                edge.from,
                Math.min(costs.get(edge.from), costs.get(edge.to) + edge.length),
              );
            }
          expected = Math.min(
            ...[b.edge.from, b.edge.to].map(
              (id) => costs.get(id) + distance(b.point, network.nodes.get(id)),
            ),
          );
          if (a.edge.id === b.edge.id) expected = Math.min(expected, distance(a.point, b.point));
        }
        const route = network.path(from, to, vehicle);
        if (!Number.isFinite(expected)) assert.equal(route, null);
        else {
          assert.ok(route);
          const actual = route.points.reduce(
            (sum, p, i) => sum + (i ? distance(route.points[i - 1], p) : 0),
            0,
          );
          assert.ok(
            Math.abs(actual - expected) < 1e-8,
            `${from.id} to ${to.id}: ${actual} != ${expected}`,
          );
        }
      }
});
