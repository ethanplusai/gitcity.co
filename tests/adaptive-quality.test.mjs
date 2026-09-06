import test from 'node:test';
import assert from 'node:assert/strict';
import { AdaptiveQuality } from '../src/world/adaptive-quality.mjs';

function history() {
  const quality = new AdaptiveQuality();
  let time = 0;
  return {
    quality,
    run(duration, frame) {
      for (let elapsed = 0; elapsed < duration; elapsed += frame) {
        time += frame;
        quality.observe(frame, time);
      }
    },
  };
}

test('a transient slow arrival can recover quality after sustained rendering headroom', () => {
  const { quality, run } = history();
  run(3, 1 / 60);
  assert.equal(quality.ready, true);
  run(3, 0.08);
  assert.equal(quality.economical, true);
  run(10, 1 / 60);
  assert.equal(quality.economical, true, 'cooldown prevents an immediate expensive retry');
  run(25, 1 / 60);
  assert.equal(quality.economical, false);
  run(3, 0.08);
  assert.equal(quality.economical, true, 'a device without full-quality headroom falls back again');
  run(10, 1 / 60);
  assert.equal(quality.economical, true);
});

test('slow devices and suspended tabs do not spuriously restore expensive rendering', () => {
  const { quality, run } = history();
  run(6, 0.08);
  run(60, 1 / 30);
  assert.equal(quality.economical, true);
  run(7, 1 / 60);
  run(120, 120);
  assert.equal(quality.economical, true);
  run(7, 1 / 60);
  assert.equal(quality.economical, true, 'suspension resets the consecutive headroom window');
  run(2, 1 / 60);
  assert.equal(quality.economical, false);
});
