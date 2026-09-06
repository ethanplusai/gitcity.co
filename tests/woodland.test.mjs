import test from 'node:test';
import assert from 'node:assert/strict';
import { woodlandPoints, woodlandDensity, WOODLAND_CROWN_RADIUS } from '../shared/woodland.mjs';

const ordered = (points) => points.sort((a, b) => a.z - b.z || a.x - b.x);
test('woodland is continuous across streamed tiles and independent of exploration order', () => {
  const whole = woodlandPoints({ minX: -128, maxX: 128, minZ: -128, maxZ: 128 });
  const tiled = [0, -128].flatMap((minZ) =>
    [0, -128].flatMap((minX) => woodlandPoints({ minX, maxX: minX + 128, minZ, maxZ: minZ + 128 })),
  );
  assert.deepEqual(ordered(tiled), ordered(whole));
  assert.equal(new Set(whole.map((p) => `${p.x}:${p.z}`)).size, whole.length);
  assert.ok(whole.length > 300 && whole.length < 2000);
  const left = woodlandDensity(128 - 1e-5, 50),
    right = woodlandDensity(128 + 1e-5, 50);
  assert.ok(Math.abs(left - right) < 1e-5);
});

test('development removes overlapping crowns without reseeding remaining woodland', () => {
  const bounds = { minX: -128, maxX: 128, minZ: -128, maxZ: 128 };
  const initial = woodlandPoints(bounds);
  const height = (x, z) => x * 0.01 + z * 0.02;
  const cleared = woodlandPoints(bounds, (x) => Math.abs(x) - 4, height);
  const remaining = new Map(cleared.map((p) => [`${p.x}:${p.z}`, p]));
  for (const p of initial) {
    const next = remaining.get(`${p.x}:${p.z}`);
    if (next) {
      assert.deepEqual({ ...next, y: 0 }, p);
      assert.equal(next.y, height(next.x, next.z));
      assert.ok(Math.abs(next.x) - 4 >= next.scale * WOODLAND_CROWN_RADIUS + 0.5);
    }
  }
  assert.ok(cleared.length < initial.length);
  assert.ok(cleared.length > initial.length * 0.7);
});

test('woodland clearance contains the rendered crown including instance width variation', async () => {
  const { treeKit } = await import('../src/world/vegetation.mjs');
  for (const seed of ['woodland:-1:0', 'woodland:0:0', 'woodland:4:7'])
    for (const species of [0, 1]) {
      const kit = treeKit(seed + species, species === 1, true);
      for (const geometry of [kit.bark, kit.leaves]) {
        const positions = geometry.attributes.position;
        for (let i = 0; i < positions.count; i++)
          assert.ok(Math.hypot(positions.getX(i), positions.getZ(i)) * 1.1 < WOODLAND_CROWN_RADIUS);
        geometry.dispose();
      }
    }
});
