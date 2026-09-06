import test from 'node:test';
import assert from 'node:assert/strict';
import { planFixtures } from '../src/world/plan-fixtures.mjs';

test('civic fixtures translate with the square and do not change stored street lamps', () => {
  const plan = {
    streets: [{ column: 0, row: 0 }],
    lamps: [{ x: 20, z: 20 }],
    civic: { x: 0, z: 0 },
  };
  const before = structuredClone(plan);
  const fixtures = planFixtures(plan);
  assert.deepEqual(plan, before);
  assert.equal(fixtures.length, 5);
  assert.deepEqual(planFixtures({ ...plan, streets: [] }), plan.lamps);
  const shift = { x: 124, z: -89 };
  const moved = planFixtures({
    ...plan,
    lamps: plan.lamps.map((p) => ({ x: p.x + shift.x, z: p.z + shift.z })),
    civic: shift,
  });
  for (let i = 0; i < fixtures.length; i++) {
    assert.ok(Math.abs(moved[i].x - shift.x - fixtures[i].x) < 1e-10);
    assert.ok(Math.abs(moved[i].z - shift.z - fixtures[i].z) < 1e-10);
  }
  for (const p of fixtures.slice(1)) {
    assert.ok(Math.abs(p.x) - 0.12 / 2 >= 5.1 - 1e-10, 'base remains inside the paved side loop');
    assert.ok(Math.abs(p.x) + 0.12 / 2 < 6.3);
    assert.ok(p.z > -5.8 && p.z < 5.5);
    assert.ok(Math.abs(p.x) - 0.12 / 2 > 4, 'base clears the building');
  }
});
