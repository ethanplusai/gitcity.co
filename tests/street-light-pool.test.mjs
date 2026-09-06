import test from 'node:test';
import assert from 'node:assert/strict';
import { StreetLightPool } from '../src/world/street-light-pool.mjs';
const p = (x) => ({ x, y: 2.5, z: 0 });
const settle = (pool) => {
  for (let i = 0; i < 60; i++) pool.update(1 / 60);
};
test('street lights stay fixed while lit and fade before moving to another fixture', () => {
  const pool = new StreetLightPool(1);
  pool.select([p(0), p(10)], p(0));
  settle(pool);
  assert.equal(pool.slots[0].weight, 1);
  pool.select([p(0), p(10)], p(10));
  let previous = { ...pool.slots[0].position };
  for (let i = 0; i < 60; i++) {
    const slot = pool.update(1 / 60)[0];
    if (slot.position.x !== previous.x) assert.equal(slot.weight, 0);
    previous = { ...slot.position };
  }
  assert.equal(pool.slots[0].position.x, 10);
  assert.equal(pool.slots[0].weight, 1);
  pool.select([], p(10));
  settle(pool);
  assert.equal(pool.slots[0].position, null);
  assert.equal(pool.slots[0].weight, 0);
});
test('selection keeps fixture identity, removes duplicates and resists boundary jitter', () => {
  const pool = new StreetLightPool(2);
  pool.select([p(0), p(10), p(20), p(0)], p(4));
  settle(pool);
  const positions = pool.slots.map((s) => s.position.x);
  pool.select([p(20), p(10), p(0)], p(6));
  settle(pool);
  assert.deepEqual(
    pool.slots.map((s) => s.position.x),
    positions,
  );
  assert.equal(new Set(positions).size, 2);
  const single = new StreetLightPool(1);
  single.select([p(0), p(10)], p(4.9));
  settle(single);
  single.select([p(0), p(10)], p(5.1));
  settle(single);
  assert.equal(single.slots[0].position.x, 0);
});

test('bounded selection matches exhaustive distance ranking over a large changing network', () => {
  const points = Array.from({ length: 5000 }, (_, i) => p((i % 100) * 3.4));
  points.forEach((point, i) => (point.z = Math.floor(i / 100) * 3.9));
  points.push(...points.slice(0, 20));
  const pool = new StreetLightPool(4),
    key = (p) => `${p.x},${p.y},${p.z}`;
  for (let i = 0; i < 20; i++) {
    const camera = { x: i * 8.7, y: 1, z: i * 4.3 };
    const retained = new Set(pool.slots.filter((s) => s.target).map((s) => key(s.target)));
    const score = (p) =>
      ((p.x - camera.x) ** 2 + (p.y - camera.y) ** 2 + (p.z - camera.z) ** 2) *
      (retained.has(key(p)) ? 0.8 : 1);
    const expected = [...new Map(points.map((p) => [key(p), p])).values()]
      .sort((a, b) => score(a) - score(b) || key(a).localeCompare(key(b)))
      .slice(0, 4)
      .map(key)
      .sort();
    pool.select(points, camera);
    assert.deepEqual(pool.slots.map((s) => key(s.target)).sort(), expected);
  }
});
