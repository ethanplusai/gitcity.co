import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryBlock } from '../shared/directory-block.mjs';
import { directoryGreens } from '../shared/directory-greens.mjs';
import { WOODLAND_CROWN_RADIUS } from '../shared/woodland.mjs';
import { pointInPolygon } from '../shared/street-surfaces.mjs';
import { segmentHitsSite } from '../shared/road-network.mjs';

test('public side groves keep full crowns clear of reserved sources and connecting streets', () => {
  let count = 0;
  for (const owner of ['vercel', 'studio', 'test'])
    for (const [x, z] of [
      [0, 2],
      [-6, -4],
      [9, 10],
    ]) {
      const region = { ...directoryBlock(owner, x, z), repo: `${owner}/repo` };
      const trees = directoryGreens(region);
      assert.deepEqual(trees, directoryGreens({ ...region, unresolved: [], occupied: [] }));
      assert.ok(trees.length <= 8);
      count += trees.length;
      for (const tree of trees) {
        const radius = tree.scale * WOODLAND_CROWN_RADIUS;
        for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 8)
          assert.ok(
            pointInPolygon(
              {
                x: tree.x + Math.cos(angle) * (radius + 1.725),
                z: tree.z + Math.sin(angle) * (radius + 1.725),
              },
              region.polygon,
            ),
          );
        for (const lot of region.lots) {
          const halfX =
            (Math.abs(Math.cos(lot.rotation)) * lot.width +
              Math.abs(Math.sin(lot.rotation)) * lot.depth) /
            2;
          const halfZ =
            (Math.abs(Math.sin(lot.rotation)) * lot.width +
              Math.abs(Math.cos(lot.rotation)) * lot.depth) /
            2;
          assert.ok(
            tree.x + radius < lot.x - halfX ||
              tree.x - radius > lot.x + halfX ||
              tree.z + radius < lot.z - halfZ ||
              tree.z - radius > lot.z + halfZ,
          );
        }
        for (const street of region.streets)
          assert.equal(
            segmentHitsSite(street.a, street.b, {
              minX: tree.x - radius - 1.725,
              maxX: tree.x + radius + 1.725,
              minZ: tree.z - radius - 1.725,
              maxZ: tree.z + radius + 1.725,
            }),
            false,
          );
      }
    }
  assert.ok(count > 8);
});
