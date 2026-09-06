import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { architecture } from '../src/world/architecture.ts';
import { batchArchitecture } from '../src/world/urban.ts';
import { preparePreviewFacades, disposePreviewFacades } from '../src/world/preview-facades.ts';
globalThis.requestAnimationFrame = (callback) => setTimeout(() => callback(performance.now()), 0);
globalThis.cancelAnimationFrame = clearTimeout;
const parcels = Array.from({ length: 12 }, (_, i) => ({
  file: { path: `src/${i}.ts`, symbols: i * 3, complexity: 4 },
  scale: 1,
  x: i * 3,
  z: 4,
  rotation: i * 0.3,
}));
const snapshot = (group) =>
  group.children.map((mesh) => ({
    attributes: Object.fromEntries(
      Object.entries(mesh.geometry.attributes).map(([name, a]) => [name, Array.from(a.array)]),
    ),
    index: Array.from(mesh.geometry.index.array),
  }));
test('staged preview preparation preserves exact facade geometry and placement', async () => {
  const source = new T.Group();
  for (const p of parcels) {
    const kit = architecture(p.file, p.scale);
    kit.group.position.set(p.x, 0, p.z);
    kit.group.rotation.y = p.rotation;
    source.add(kit.group);
  }
  const direct = batchArchitecture(source),
    staged = await preparePreviewFacades(parcels, true, () => false);
  assert.ok(staged);
  assert.deepEqual(snapshot(staged), snapshot(direct));
  for (const group of [source, direct, staged]) disposePreviewFacades(group);
});
test('canceled preview preparation releases partially built resources and returns no replacement', async () => {
  let checks = 0,
    disposed = 0;
  const dispose = T.BufferGeometry.prototype.dispose;
  T.BufferGeometry.prototype.dispose = function () {
    disposed++;
    dispose.call(this);
  };
  try {
    assert.equal(await preparePreviewFacades(parcels, true, () => ++checks > 2), null);
    assert.ok(disposed > 0);
    assert.equal(await preparePreviewFacades(parcels, true, () => true), null);
  } finally {
    T.BufferGeometry.prototype.dispose = dispose;
  }
});
