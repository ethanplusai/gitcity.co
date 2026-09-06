import test from 'node:test';
import assert from 'node:assert/strict';
import { yieldFrame } from '../src/world/frame-yield.mjs';

test('preview yielding settles after rendering, on cancellation, and when frames are suspended', async () => {
  const request = globalThis.requestAnimationFrame,
    cancel = globalThis.cancelAnimationFrame;
  let callback,
    requests = 0,
    cancellations = 0;
  globalThis.requestAnimationFrame = (fn) => {
    callback = fn;
    return ++requests;
  };
  globalThis.cancelAnimationFrame = () => {
    cancellations++;
  };
  try {
    const aborted = new AbortController();
    aborted.abort();
    assert.equal(await yieldFrame(aborted.signal), false);
    assert.equal(requests, 0);
    const active = new AbortController();
    const pending = yieldFrame(active.signal);
    active.abort();
    assert.equal(await pending, false);
    assert.equal(cancellations, 1);
    const rendered = yieldFrame();
    callback();
    assert.equal(await rendered, true);
    // Deliberately never deliver the next rAF: hidden-tab fallback must settle.
    assert.equal(await yieldFrame(), true);
    assert.equal(requests, 3);
    assert.equal(cancellations, 3);
  } finally {
    if (request) globalThis.requestAnimationFrame = request;
    else delete globalThis.requestAnimationFrame;
    if (cancel) globalThis.cancelAnimationFrame = cancel;
    else delete globalThis.cancelAnimationFrame;
  }
});
