import test from 'node:test';
import assert from 'node:assert/strict';
import { CityAxisCache } from '../shared/city-axis.mjs';
import { hash } from '../shared/model.mjs';

const original = (index, seed, minimum, variation) => {
  let value = 0;
  for (let i = 0; i < Math.abs(index); i++)
    value += minimum + (hash(`${seed}:${index < 0 ? -i - 1 : i}`) % variation);
  return index < 0 ? -value : value;
};
test('cached city axes preserve coordinates through growth, eviction and remote lookups', () => {
  const cache = new CityAxisCache(3, 32);
  for (let pass = 0; pass < 3; pass++)
    for (const seed of ['demo:rows', 'demo:row:-4', 'another:rows', 'demo:row:2'])
      for (const index of [0, 1, 20, 4, 32, 33, 1025, -2, -32, -1030, 8]) {
        for (const [minimum, variation] of [
          [18, 7],
          [20, 7],
        ])
          assert.equal(
            cache.get(index, seed, minimum, variation),
            original(index, seed, minimum, variation),
          );
        assert.ok(cache.entries.size <= 3);
        for (const entry of cache.entries.values()) {
          assert.equal(entry.values.byteLength, 33 * 8);
          assert.ok(entry.count <= 32);
        }
      }
});
