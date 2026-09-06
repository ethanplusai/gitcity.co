import test from 'node:test';
import assert from 'node:assert/strict';
import { walkingProgress } from '../shared/walking-progress.mjs';

test('walking guidance measures the street route and respects world scale', () => {
  const start = { x: 0, y: 10, z: 0 };
  const path = [
    { x: 0, y: 0, z: 30 },
    { x: 40, y: 0, z: 30 },
  ];
  assert.deepEqual(walkingProgress(start, path), { distance: 70, seconds: 14 });
  assert.deepEqual(walkingProgress(start, path, 2), { distance: 35, seconds: 7 });
  assert.deepEqual(walkingProgress({ x: 0, z: 20 }, path), { distance: 50, seconds: 10 });
  assert.deepEqual(walkingProgress(start, []), { distance: 0, seconds: 0 });
});
