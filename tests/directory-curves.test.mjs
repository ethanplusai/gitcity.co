import { segmentHitsSite } from '../shared/road-network.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryBlock } from '../shared/directory-block.mjs';
import { curvedDirectoryBlock } from '../shared/directory-curves.mjs';
import { pointInPolygon } from '../shared/street-surfaces.mjs';
import { lotsOverlap } from '../shared/city-plan.mjs';

test('curved directory access retains full plots, stable reservations and joined lane endpoints', () => {
  for (const owner of ['vercel', 'facebook', 'studio', 'test'])
    for (const [x, z] of [
      [0, 2],
      [-6, -4],
      [9, 10],
    ]) {
      const original = directoryBlock(owner, x, z),
        before = structuredClone(original);
      const plan = curvedDirectoryBlock(original);
      assert.deepEqual(original, before);
      assert.deepEqual(plan, curvedDirectoryBlock(original));
      assert.equal(plan.streets.length, 36);
      for (let i = 0; i < 36; i++)
        if (i % 12) assert.deepEqual(plan.streets[i - 1].b, plan.streets[i].a);
      for (const lot of plan.lots) {
        const halfX =
          (Math.abs(Math.cos(lot.rotation)) * lot.width +
            Math.abs(Math.sin(lot.rotation)) * lot.depth) /
          2;
        const halfZ =
          (Math.abs(Math.sin(lot.rotation)) * lot.width +
            Math.abs(Math.cos(lot.rotation)) * lot.depth) /
          2;
        for (const road of plan.streets)
          assert.equal(
            segmentHitsSite(
              road.a,
              road.b,
              {
                minX: lot.x - halfX,
                maxX: lot.x + halfX,
                minZ: lot.z - halfZ,
                maxZ: lot.z + halfZ,
              },
              1.725,
            ),
            false,
            'access pavement clears each full source plot',
          );

        for (const u of [-1, 1])
          for (const v of [-1, 1]) {
            const p = {
              x:
                lot.x +
                ((u * lot.width) / 2) * Math.cos(lot.rotation) +
                ((v * lot.depth) / 2) * Math.sin(lot.rotation),
              z:
                lot.z -
                ((u * lot.width) / 2) * Math.sin(lot.rotation) +
                ((v * lot.depth) / 2) * Math.cos(lot.rotation),
            };
            assert.ok(pointInPolygon(p, plan.polygon), 'full source plot remains in reservation');
          }
        for (const other of plan.lots)
          if (lot.slot < other.slot) assert.equal(lotsOverlap(lot, other), false);
      }
    }
});
