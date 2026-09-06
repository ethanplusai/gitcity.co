import { HIGHWAY } from '../shared/highway-profile.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
test('the detailed traffic asset stays within the mobile download and geometry budget', async () => {
  const binary = await readFile(new URL('../public/models/city-car.glb', import.meta.url));
  assert.equal(binary.readUInt32LE(0), 0x46546c67);
  assert.ok(binary.byteLength < 750000);
  const json = JSON.parse(binary.subarray(20, 20 + binary.readUInt32LE(12)).toString());
  assert.equal(json.meshes.length, 1);
  assert.equal(json.materials.length, 1);
  assert.equal(json.images?.length || 0, 0);
  const primitive = json.meshes[0].primitives[0];
  assert.ok(json.accessors[primitive.indices].count / 3 < 20000);
  assert.ok(primitive.attributes.COLOR_0 !== undefined);
  const position = json.accessors[primitive.attributes.POSITION];
  assert.ok(position.min.concat(position.max).every(Number.isFinite));
  assert.ok(Math.abs(position.max[2] - position.min[2] - 1.3) < 0.001);
  assert.ok(position.max[0] - position.min[0] + 0.15 < HIGHWAY.halfWidth);
  const attribution = await readFile(
    new URL('../public/models/car-concept-license.txt', import.meta.url),
    'utf8',
  );
  assert.match(attribution, /Eric Chadwick/);
  assert.match(attribution, /CC BY 4.0/);
  assert.match(attribution, /Changes for Gitcity/);
});
