import test from 'node:test';
import assert from 'node:assert/strict';
import { FootstepCadence, walkingLookBlend } from '../src/world/footstep-cadence.mjs';

test('footsteps follow traveled distance across speeds, frame rates and world scales', () => {
  const simulate = (fps, speed, scale) => {
    const cadence = new FootstepCadence();
    let steps = 0;
    for (let i = 0; i < fps * 10; i++)
      steps += Number(cadence.advance((speed * scale) / fps, scale));
    return steps;
  };
  assert.equal(simulate(30, 4, 1), 24);
  assert.equal(simulate(120, 4, 1), 24);
  assert.equal(simulate(60, 4, 0.25), 24);
  assert.equal(simulate(60, 7.2, 1), 43);
  const cadence = new FootstepCadence();
  for (let i = 0; i < 100; i++) assert.equal(cadence.advance(0), false);
  assert.equal(cadence.advance(100), false);
  assert.equal(cadence.advance(NaN), false);
  assert.equal(cadence.advance(0.2), false);
});

test('walking look smoothing has the same response across frame rates', () => {
  const response = (fps) => {
    let direction = 0;
    for (let i = 0; i < fps; i++) direction += (1 - direction) * walkingLookBlend(1 / fps);
    return direction;
  };
  assert.ok(Math.abs(response(30) - response(120)) < 1e-12);
  assert.equal(walkingLookBlend(0), 0);
});
