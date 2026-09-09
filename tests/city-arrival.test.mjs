import test from 'node:test';
import assert from 'node:assert/strict';
import { cityArrivalOrder } from '../shared/city-arrival.mjs';

test('arrival prioritizes a maintained source repo, then adjacent neighborhoods without changing coordinates', () => {
  const cities = [
    { id: 'org/.github', x: 0, z: 0, stars: 2 },
    { id: 'org/archived', x: 40, z: 0, stars: 90000, archived: true },
    { id: 'org/product', x: 80, z: 0, stars: 40000 },
    { id: 'org/neighbor', x: 90, z: 0, stars: 0 },
    { id: 'org/fork', x: 500, z: 0, stars: 80000, fork: true },
  ];
  const ordered = cityArrivalOrder(cities);
  assert.equal(ordered[0].id, 'org/product');
  assert.equal(ordered[1].id, 'org/neighbor');
  assert.equal(ordered.length, cities.length);
  assert.equal(ordered[0], cities[2]);
  assert.equal(cities[0].id, 'org/.github');
});
