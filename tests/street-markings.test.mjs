import test from 'node:test';
import assert from 'node:assert/strict';
import { streetMarkings } from '../shared/street-markings.mjs';
const nodes = [
  { id: 'west', x: -20, z: 0 },
  { id: 'center', x: 0, z: 0 },
  { id: 'east', x: 20, z: 0 },
  { id: 'north', x: 0, z: 20 },
];
const edge = (from, to, kind = 'local') => ({
  id: from + to,
  from,
  to,
  length: 20,
  halfWidth: 0.7,
  kind,
});

test('crossings serve actual intersections and omit ordinary bends or subdivisions', () => {
  assert.equal(
    streetMarkings({
      nodes: nodes.slice(0, 3),
      edges: [edge('west', 'center'), edge('center', 'east')],
    }).crossings.length,
    0,
  );
  const graph = {
    nodes,
    edges: [
      edge('west', 'center', 'avenue'),
      edge('center', 'east', 'avenue'),
      edge('center', 'north'),
    ],
  };
  const result = streetMarkings(graph);
  assert.equal(result.crossings.length, 3);
  assert.ok(result.crossings.every((c) => c.node === 'center'));
  for (const c of result.crossings) assert.ok(Math.abs(Math.hypot(c.x, c.z) - 2.125) < 1e-6);
  for (const dash of result.dashes)
    for (const crossing of result.crossings)
      assert.ok(Math.hypot(dash.x - crossing.x, dash.z - crossing.z) >= 1);
});

test('small junction links cannot acquire overlapping crossing stripes', () => {
  const graph = {
    nodes: nodes.map((n) => (n.id === 'north' ? { ...n, z: 3 } : n)),
    edges: [
      edge('west', 'center'),
      edge('center', 'east'),
      { ...edge('center', 'north'), length: 3 },
    ],
  };
  assert.ok(streetMarkings(graph).crossings.every((c) => c.edge !== 'centernorth'));
});
