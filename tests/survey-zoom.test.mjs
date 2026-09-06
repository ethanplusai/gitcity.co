import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { directoryMassing, directoryHit } from '../src/world/directory-massing.ts';
import { directoryBlock } from '../shared/directory-block.mjs';

test('north-south surveys keep grouped pads aligned with their reserved source row', () => {
  const region = {
    ...directoryBlock('vercel', 0, 2),
    repo: 'vercel/test',
    directory: 'src',
    index: 0,
    unresolved: [0, 1, 2],
  };
  assert.equal(region.orientation, 1);
  const group = directoryMassing([region]),
    mesh = group.children[0];
  const initial = Array.from(mesh.instanceMatrix.array);
  group.userData.updateSurvey(new T.Vector3(region.center.x, 200, region.center.z));
  assert.equal(mesh.count, 1);
  const matrix = new T.Matrix4();
  mesh.getMatrixAt(0, matrix);
  assert.ok(Math.abs(matrix.elements[0]) < 1e-6);
  assert.ok(Math.abs(Math.abs(matrix.elements[2]) - (6.8 + 3.2 * 0.88)) < 1e-5);
  assert.ok(Math.abs(matrix.elements[12] - region.lots[1].x) < 1e-5);
  assert.ok(Math.abs(matrix.elements[14] - region.lots[1].z) < 1e-5);
  group.userData.updateSurvey(new T.Vector3(region.center.x, 1, region.center.z));
  assert.deepEqual(Array.from(mesh.instanceMatrix.array), initial);
  mesh.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});
test('survey overview groups contiguous plots without bridging resolved gaps or street rows', () => {
  const region = {
    repo: 'test/city',
    directory: 'src',
    index: 0,
    column: 0,
    row: 0,
    center: { x: 17, z: 5 },
    width: 40,
    depth: 20,
    unresolved: [0, 1, 3, 10, 11],
    lots: Array.from({ length: 22 }, (_, slot) => ({
      slot,
      x: (slot % 11) * 3.4,
      z: Math.floor(slot / 11) * 9,
      width: 3.2,
      depth: 2.9,
    })),
  };
  const group = directoryMassing([region]),
    mesh = group.children[0];
  const initial = Array.from(mesh.instanceMatrix.array);
  assert.equal(mesh.count, 5);
  group.userData.updateSurvey(new T.Vector3(17, 200, 5));
  assert.equal(mesh.count, 4);
  assert.deepEqual(
    mesh.userData.directorySlots.map((s) => s.slot),
    [0, 3, 10, 11],
  );
  const matrix = new T.Matrix4();
  mesh.getMatrixAt(0, matrix);
  assert.ok(Math.abs(matrix.elements[0] - (3.4 + 3.2 * 0.88)) < 1e-5);
  assert.ok(Math.abs(matrix.elements[5] - 0.08) < 1e-6);
  assert.ok(Math.abs(matrix.elements[13] - 0.15) < 1e-6);
  assert.equal(mesh.castShadow, false, 'unparsed surveys do not cast invented building shadows');
  assert.equal(directoryHit({ object: mesh, instanceId: 3 }).slot, 11);
  group.userData.updateSurvey(new T.Vector3(17, 85, 5));
  assert.equal(mesh.count, 4, 'hysteresis retains overview near the boundary');
  group.userData.updateSurvey(new T.Vector3(17, 1, 5));
  assert.equal(mesh.count, 5);
  assert.deepEqual(Array.from(mesh.instanceMatrix.array), initial);
  mesh.dispose();
  mesh.geometry.dispose();
  mesh.material.dispose();
});
