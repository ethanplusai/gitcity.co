import test from 'node:test';
import assert from 'node:assert/strict';
import { streetArrival } from '../src/world/repo-arrival.ts';

test('street arrivals prefer populated frontages and look along the occupied direction', () => {
  const parcels = [-120, 0, 7, 14, 21].map((x) => ({
    x,
    z: -1.4,
    front: { x, z: 0 },
    rotation: 0,
  }));
  const arrival = streetArrival({ parcels });
  assert.ok(arrival.x >= 0);
  assert.equal(arrival.z, 0.45);
  assert.ok(arrival.score > 0);
  assert.ok(parcels.some((p) => p.x === arrival.x));
  const direction = Math.sign(arrival.target.x - arrival.x);
  assert.ok(
    parcels.filter((p) => (p.x - arrival.x) * direction > 0 && Math.abs(p.x - arrival.x) < 45)
      .length >= 2,
  );
  const shifted = streetArrival({
    parcels: parcels.map((p) => ({
      ...p,
      x: p.x + 400,
      z: p.z - 200,
      front: { x: p.front.x + 400, z: p.front.z - 200 },
    })),
  });
  assert.ok(Math.abs(shifted.x - 400 - arrival.x) < 1e-8);
  assert.ok(Math.abs(shifted.z + 200 - arrival.z) < 1e-8);
  assert.ok(Math.abs(shifted.target.x - 400 - arrival.target.x) < 1e-8);
});
