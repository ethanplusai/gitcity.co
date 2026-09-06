import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { previewMassing } from '../src/world/preview-massing.ts';
import { architecture } from '../src/world/architecture.ts';
import { building } from '../shared/model.mjs';
test('distant previews retain source footprints and skylines with substantially less geometry', () => {
  let near = 0,
    far = 0;
  for (let i = 0; i < 18; i++) {
    const file = { path: `src/roof-${i}.ts`, symbols: 8, complexity: 3 },
      model = building(file);
    const detailed = architecture(file),
      proxy = previewMassing(file);
    const bounds = new T.Box3().setFromObject(proxy.group);
    assert.ok(Math.abs(bounds.max.x - bounds.min.x - model.width) < 1e-6);
    assert.ok(Math.abs(bounds.max.z - bounds.min.z - model.depth) < 1e-6);
    assert.ok(Math.abs(bounds.max.y - model.height) < 0.025);
    for (const [kit, isFar] of [
      [detailed, false],
      [proxy, true],
    ])
      kit.group.traverse((o) => {
        if (!o.isMesh) return;
        assert.ok(o.geometry.attributes.position.array.every(Number.isFinite));
        const count = o.geometry.index?.count || o.geometry.attributes.position.count;
        if (isFar) far += count;
        else near += count;
        o.geometry.dispose();
        o.material.dispose();
      });
  }
  assert.ok(far < near / 20, `${far} proxy indices vs ${near} detailed indices`);
});
