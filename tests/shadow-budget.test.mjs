import test from 'node:test';
import assert from 'node:assert/strict';
import { shadowBudget } from '../shared/shadow-budget.mjs';
test('compact shadow budget reserves shadows for healthy street-level rendering', () => {
  assert.deepEqual(shadowBudget({ compact: true, walking: true, economical: false }), {
    enabled: true,
    size: 512,
  });
  assert.equal(shadowBudget({ compact: true, walking: false, economical: false }).enabled, false);
  assert.equal(shadowBudget({ compact: true, walking: true, economical: true }).enabled, false);
  assert.deepEqual(shadowBudget({ compact: false, walking: false, economical: false }), {
    enabled: true,
    size: 1024,
  });
});
