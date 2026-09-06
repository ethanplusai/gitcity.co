import test from 'node:test';
import assert from 'node:assert/strict';
import { cityCell, streetGraph } from '../shared/city-plan.mjs';
import { StreetPavementCache } from '../src/world/street-pavement.mjs';

const dispose = (parts) => parts.forEach(([, g]) => g.dispose());
const signature = (parts) =>
  parts.map(([bucket, g]) => [bucket, [...g.attributes.position.array], [...g.index.array]]);

test('cached pavement survives independent geometry mutation and invalidates real street changes', () => {
  const cache = new StreetPavementCache();
  const graph = streetGraph([cityCell('demo', 0, 0), cityCell('demo', 1, 0)]);
  const first = cache.get(graph),
    expected = signature(first);
  first[0][1].attributes.position.array.fill(0);
  first[0][1].index.array.fill(0);
  dispose(first);
  const repeat = cache.get(structuredClone(graph));
  assert.deepEqual(signature(repeat), expected);
  assert.equal(cache.entries.size, 1);
  dispose(repeat);
  const wider = structuredClone(graph);
  wider.edges[0].halfWidth += 0.15;
  const changed = cache.get(wider);
  assert.notDeepEqual(signature(changed), expected);
  assert.equal(cache.entries.size, 2);
  dispose(changed);
  const moved = structuredClone(graph);
  for (const node of moved.nodes) node.x += 125;
  const translated = cache.get(moved);
  assert.notDeepEqual(signature(translated), expected);
  assert.equal(cache.entries.size, 3);
  dispose(translated);
  const removed = structuredClone(graph);
  removed.edges.pop();
  dispose(cache.get(removed));
  assert.equal(cache.entries.size, 3);
  assert.ok(cache.bytes <= cache.maxBytes);
});

test('pavement cache respects byte and entry limits without discarding requested geometry', () => {
  const graph = streetGraph([cityCell('demo', 0, 0)]);
  const baseline = new StreetPavementCache();
  const parts = baseline.get(graph);
  const expected = signature(parts);
  dispose(parts);
  const limited = new StreetPavementCache(baseline.bytes - 1);
  const uncached = limited.get(graph);
  assert.deepEqual(signature(uncached), expected);
  assert.equal(limited.bytes, 0);
  assert.equal(limited.entries.size, 0);
  dispose(uncached);
  const one = new StreetPavementCache(16 * 1024 * 1024, 1);
  dispose(one.get(graph));
  dispose(one.get(streetGraph([cityCell('other', 0, 0)])));
  assert.equal(one.entries.size, 1);
  const rebuilt = one.get(graph);
  assert.deepEqual(signature(rebuilt), expected);
  dispose(rebuilt);
});
