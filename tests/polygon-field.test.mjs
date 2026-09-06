import test from 'node:test';
import assert from 'node:assert/strict';
import { polygonField } from '../shared/polygon-field.mjs';

test('terrain influence matches exact rectangle distance across negative coordinates and bin edges', () => {
  const boxes = Array.from({ length: 438 }, (_, i) => ({
    x0: (i % 22) * 75 - 820,
    z0: Math.floor(i / 22) * 48 - 480,
  })).map((b) => ({ ...b, x1: b.x0 + 62, z1: b.z0 + 39 }));
  const distance = polygonField(
    boxes.map((b) => [
      { x: b.x0, z: b.z0 },
      { x: b.x1, z: b.z0 },
      { x: b.x1, z: b.z1 },
      { x: b.x0, z: b.z1 },
    ]),
  );
  for (let x = -1100; x < 1100; x += 31.5)
    for (let z = -700; z < 700; z += 33.25) {
      const expected = Math.min(
        88,
        ...boxes.map((b) =>
          Math.hypot(Math.max(b.x0 - x, 0, x - b.x1), Math.max(b.z0 - z, 0, z - b.z1)),
        ),
      );
      assert.ok(Math.abs(distance(x, z) - expected) < 1e-8);
    }
  assert.equal(polygonField([])(0, 0), 88);
});
