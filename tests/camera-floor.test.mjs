import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraFloor, keepAboveGround } from '../src/world/camera-floor.mjs';
test('camera clearance follows nearby terrain and district scale', () => {
  assert.equal(
    cameraFloor(() => -0.6, 0, 0),
    0.58,
  );
  assert.equal(
    cameraFloor(() => 4, 0, 0),
    4.73,
  );
  assert.ok(cameraFloor((x) => (x > 0 ? 5 : 0), 0, 0) > 5);
});
test('orbit recovery lifts camera and aim together; walking stays at eye height', () => {
  const p = { y: -12 },
    target = { y: -15 };
  keepAboveGround(p, target, 0.58, false);
  assert.ok(Math.abs(p.y - 0.58) < 1e-9);
  assert.equal(p.y - target.y, 3);
  p.y = 80;
  target.y = 78;
  keepAboveGround(p, target, 0.58, true);
  assert.ok(Math.abs(p.y - 0.58) < 1e-9);
  assert.equal(p.y - target.y, 2);
});
