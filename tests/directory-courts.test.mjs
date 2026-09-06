import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryCourts } from '../shared/directory-courts.mjs';
import { directoryBlock } from '../shared/directory-block.mjs';
import { segmentHitsSite } from '../shared/road-network.mjs';
import { pointInPolygon } from '../shared/street-surfaces.mjs';

test('directory public courts avoid source plots and streets while retaining sidewalk connections', () => {
  for (const owner of ['test', 'vercel', 'studio'])
    for (const [x, z] of [
      [3, 2],
      [-9, -4],
      [12, -6],
    ]) {
      const region = directoryBlock(owner, x, z);
      const courts = directoryCourts(region);
      if (region.orientation) assert.equal(courts.length, 0);
      else assert.ok(courts.length >= 2);
      for (const court of courts) {
        assert.ok(court.polygon.every((p) => pointInPolygon(p, region.polygon)));
        const a = court.polygon[0],
          b = court.polygon[2];
        for (const lot of region.lots) {
          assert.ok(
            b.x <= lot.x - lot.width / 2 ||
              a.x >= lot.x + lot.width / 2 ||
              b.z <= lot.z - lot.depth / 2 ||
              a.z >= lot.z + lot.depth / 2,
          );
        }
        for (const road of region.streets)
          assert.equal(
            segmentHitsSite(road.a, road.b, {
              minX: a.x - 1.725,
              maxX: b.x + 1.725,
              minZ: a.z - 1.725,
              maxZ: b.z + 1.725,
            }),
            false,
          );
        assert.ok(
          region.streets.some((road) => Math.abs(Math.abs(road.a.z - court.entry.z) - 1.6) < 1e-8),
        );
      }
      assert.equal(directoryCourts({ ...region, streets: [] }).length, 0);
      assert.deepEqual(directoryCourts(region), courts);
    }
});

test('planting leaves a continuous entrance-width route in narrow and wide courts', async () => {
  const { courtPlanting } = await import('../shared/directory-courts.mjs');
  for (const width of [3.5, 4, 6, 10, 20]) {
    const court = { x: 10, z: 20, width, tree: { x: 0, z: 0, scale: 0.48, rotation: 0 } };
    const bed = courtPlanting(court);
    const left = 10 - width / 2,
      right = 10 + width / 2;
    assert.ok(Math.min(...bed.polygon.map((p) => p.x)) - left >= 1.299);
    assert.ok(right - Math.max(...bed.polygon.map((p) => p.x)) >= 1.299);
    for (const tree of bed.trees)
      assert.ok(
        tree.x > Math.min(...bed.polygon.map((p) => p.x)) &&
          tree.x < Math.max(...bed.polygon.map((p) => p.x)),
      );
    assert.equal(bed.trees.length, width < 4.6 ? 1 : 2);
  }
});
