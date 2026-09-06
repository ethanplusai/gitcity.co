import test from 'node:test';
import assert from 'node:assert/strict';
import { citizenGait } from '../src/world/citizen-gait.mjs';

test('pedestrian gait follows traveled distance across different frame rates', () => {
  const travel = (frames) => {
    const state = { phase: 0.2, weight: 0, position: { x: 0, z: 0 } };
    for (let i = 1; i <= frames; i++)
      citizenGait(state, { x: (i * 0.5) / frames, z: 0 }, true, 1 / frames, false, false);
    return state;
  };
  const a = travel(30),
    b = travel(120);
  assert.ok(Math.abs(a.phase - b.phase) < 1e-10);
  assert.ok(Math.abs(a.weight - b.weight) < 1e-10);
  assert.ok(a.weight > 0.99);
});

test('stops blend to idle, reduced motion rests immediately and pauses preserve the pose', () => {
  const state = { phase: 0.4, weight: 1, position: { x: 0, z: 0 } };
  const paused = citizenGait(state, { x: 0, z: 0 }, false, 0.1, true, false);
  assert.equal(state.weight, 1);
  assert.equal(paused.first + paused.second, 1);
  for (let i = 0; i < 60; i++) citizenGait(state, { x: 0, z: 0 }, false, 1 / 60, false, false);
  assert.equal(state.weight, 0);
  assert.equal(state.phase, 0.4);
  state.weight = 1;
  const reduced = citizenGait(state, { x: 0.1, z: 0 }, true, 0.1, false, true);
  assert.equal(reduced.first + reduced.second, 0);
  citizenGait(state, { x: 200, z: 0 }, true, 0.1, false, false);
  assert.equal(state.phase, 0.4, 'teleportation does not advance the stride');
});

test('idle breathing is staggered, frame-rate independent, and respects pause and reduced motion', () => {
  const simulate = (frames) => {
    const state = { phase: 0.27, weight: 0 };
    let pose;
    for (let i = 0; i < frames; i++)
      pose = citizenGait(state, { x: 0, z: 0 }, false, 1 / frames, false, false);
    return { state, pose };
  };
  const a = simulate(30),
    b = simulate(120);
  assert.ok(Math.abs(a.state.idlePhase - b.state.idlePhase) < 1e-10);
  assert.ok(a.pose.idleFirst + a.pose.idleSecond > 0.5);
  const paused = citizenGait(a.state, { x: 0, z: 0 }, false, 1, true, false);
  assert.deepEqual(paused, a.pose);
  const reduced = citizenGait(a.state, { x: 0, z: 0 }, false, 1, false, true);
  assert.equal(reduced.idleFirst + reduced.idleSecond, 0);
  const other = citizenGait({ phase: 0.8, weight: 0 }, { x: 0, z: 0 }, false, 0, false, false);
  assert.notEqual(other.idleFirst, b.pose.idleFirst);
  const walking = citizenGait({ phase: 0.2, weight: 1 }, { x: 0, z: 0 }, true, 0, true, false);
  assert.equal(walking.idleFirst + walking.idleSecond, 0);
});
