import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { plannedLayout } from '../src/world/planned-layout.ts';
import {
  plannedStreets,
  streetBuildSteps,
  preparePlannedStreets,
  disposePreparedStreets,
} from '../src/world/planned-streets.ts';

const plan = () =>
  plannedLayout({
    id: 'demo/repo',
    coordinates: { x: 0, z: 0 },
    files: Array.from({ length: 18 }, (_, i) => ({
      path: `src/file-${i}.ts`,
      symbols: i + 1,
      size: 2000,
    })),
  });
const snapshot = (group) => {
  const meshes = [];
  group.traverse((mesh) => {
    if (!mesh.isMesh) return;
    meshes.push({
      attributes: Object.fromEntries(
        Object.entries(mesh.geometry.attributes).map(([name, a]) => [name, Array.from(a.array)]),
      ),
      index: mesh.geometry.index ? Array.from(mesh.geometry.index.array) : null,
      instances: mesh.instanceMatrix ? Array.from(mesh.instanceMatrix.array) : null,
      colors: mesh.instanceColor ? Array.from(mesh.instanceColor.array) : null,
      count: mesh.count,
    });
  });
  return meshes;
};
test('resumable streets preserve exact geometry and instance placement', () => {
  const layout = plan(),
    synchronous = plannedStreets(layout),
    job = streetBuildSteps(layout);
  let step = job.next(),
    yields = 0;
  while (!step.done) {
    yields++;
    step = job.next();
  }
  assert.ok(yields > 8);
  assert.deepEqual(snapshot(step.value), snapshot(synchronous));
  disposePreparedStreets(synchronous);
  disposePreparedStreets(step.value);
});
test('canceling partial street preparation releases allocated geometry', async () => {
  const original = T.BufferGeometry.prototype.dispose;
  const request = globalThis.requestAnimationFrame,
    cancel = globalThis.cancelAnimationFrame;
  globalThis.requestAnimationFrame = (callback) => setTimeout(callback, 0);
  globalThis.cancelAnimationFrame = clearTimeout;
  let disposals = 0,
    checks = 0;
  T.BufferGeometry.prototype.dispose = function () {
    disposals++;
    original.call(this);
  };
  try {
    const result = await preparePlannedStreets(plan(), undefined, () => ++checks > 4);
    assert.equal(result, null);
    assert.ok(disposals > 0);
    const aborted = new AbortController();
    aborted.abort();
    const count = disposals;
    assert.equal(await preparePlannedStreets(plan(), aborted.signal), null);
    assert.equal(disposals, count);
  } finally {
    T.BufferGeometry.prototype.dispose = original;
    if (request) globalThis.requestAnimationFrame = request;
    else delete globalThis.requestAnimationFrame;
    if (cancel) globalThis.cancelAnimationFrame = cancel;
    else delete globalThis.cancelAnimationFrame;
  }
});
