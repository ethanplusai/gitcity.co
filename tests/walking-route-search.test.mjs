import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { graphRoute } from '../src/world/navigation.ts';

test('walking search returns a shortest deterministic route across a large connected grid', () => {
  const graph = { nodes: [], edges: [] };
  const side = 40;
  for (let z = 0; z < side; z++)
    for (let x = 0; x < side; x++) {
      const id = `${x}:${z}`;
      graph.nodes.push({ id, x, z });
      if (x) graph.edges.push({ from: `${x - 1}:${z}`, to: id, length: 1 });
      if (z) graph.edges.push({ from: `${x}:${z - 1}`, to: id, length: 1 });
    }
  const origin = new Vector3(500, 0, -300);
  for (const [x, z] of [
    [39, 39],
    [2, 1],
    [0, 20],
    [30, 5],
  ]) {
    const start = new Vector3(500, 2, -300),
      end = new Vector3(500 + x, 100, -300 + z);
    const route = graphRoute(start, end, origin, graph);
    let previous = start,
      distance = 0;
    for (const point of route) {
      assert.equal(point.y, 2);
      distance += point.distanceTo(previous);
      previous = point;
    }
    assert.equal(distance, x + z);
    assert.deepEqual(route, graphRoute(start, end, origin, graph));
  }
  const direct = graphRoute(
    new Vector3(500.2, 2, -300),
    new Vector3(500.8, 0, -300),
    origin,
    graph,
  );
  assert.equal(direct.length, 3);
  assert.ok(Math.abs(direct[1].x - 500.8) < 1e-8);
});
