import test from 'node:test';
import assert from 'node:assert/strict';
import { cityCell, streetGraph } from '../shared/city-plan.mjs';
import { buildStreetPavement, pavement } from '../src/world/street-pavement.mjs';
import { packPavement, unpackPavement, pavementBuffers } from '../src/world/pavement-transfer.mjs';
import { PavementWorker } from '../src/world/pavement-worker.mjs';

const graph = (owner) => streetGraph([cityCell(owner, 0, 0)]);
const snapshot = (parts) =>
  parts.map(([bucket, geometry]) => [
    bucket,
    [...geometry.index.array],
    Object.fromEntries(
      Object.entries(geometry.attributes).map(([key, value]) => [key, [...value.array]]),
    ),
  ]);

test('transferred pavement preserves geometry and moves buffer ownership', () => {
  const source = buildStreetPavement(graph('transfer'));
  const expected = snapshot(source);
  const packed = packPavement(source),
    buffers = pavementBuffers(packed);
  const received = structuredClone(packed, { transfer: buffers });
  assert.ok(buffers.every((buffer) => buffer.byteLength === 0));
  const restored = unpackPavement(received);
  assert.deepEqual(snapshot(restored), expected);
  for (const [, geometry] of [...source, ...restored]) geometry.dispose();
});

test('worker preparation primes the cache, and failed or disposed requests settle safely', async () => {
  const previous = globalThis.Worker;
  let instance;
  globalThis.Worker = class {
    constructor() {
      instance = this;
    }
    postMessage(data) {
      this.request = data;
    }
    terminate() {
      this.terminated = true;
    }
  };
  try {
    const client = new PavementWorker();
    const input = graph('worker-success');
    const pending = client.prepare(input);
    const built = buildStreetPavement(input);
    instance.onmessage({ data: { id: instance.request.id, parts: packPavement(built) } });
    assert.equal(await pending, true);
    assert.equal(pavement.has(input), true);
    assert.equal(await client.prepare(input), false); // Already warm.
    const interrupted = client.prepare(graph('worker-cancel'));
    client.dispose();
    assert.equal(await interrupted, false);
    assert.equal(instance.terminated, true);
    const failed = new PavementWorker();
    const waiting = failed.prepare(graph('worker-failed'));
    instance.onerror();
    assert.equal(await waiting, false);
    assert.equal(await failed.prepare(graph('worker-failed')), false);
  } finally {
    if (previous === undefined) delete globalThis.Worker;
    else globalThis.Worker = previous;
  }
});
