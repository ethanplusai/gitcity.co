import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { Landscape } from '../src/world/landscape.ts';

test('terrain builds one nearby tile per update and keeps old ground until replacement', () => {
  const landscape = new Landscape();
  const center = new T.Vector3(0, 2, 0);
  const sky = { hour: 12, daylight: 1 };
  const update = () => landscape.update(center, center, 0, sky, false, true);
  try {
    for (let i = 1; i <= 9; i++) {
      update();
      assert.equal(landscape.tiles.size, i);
    }
    assert.ok(landscape.tiles.has('0:0:0'));
    const old = new Map(landscape.tiles);
    landscape.setBlocks([
      [
        { x: -5, z: -5 },
        { x: 5, z: -5 },
        { x: 5, z: 5 },
        { x: -5, z: 5 },
      ],
    ]);
    update();
    assert.equal(landscape.tiles.size, 9);
    assert.ok(landscape.tiles.has('0:0:1'));
    assert.equal(
      [...old.values()].filter((tile) => [...landscape.tiles.values()].includes(tile)).length,
      8,
    );
    for (let i = 0; i < 8; i++) update();
    assert.ok([...landscape.tiles.keys()].every((key) => key.endsWith(':1')));
    center.x = 256;
    update();
    center.x = 0;
    for (let i = 0; i < 9; i++) update();
    assert.equal(landscape.tiles.size, 9);
    assert.ok(landscape.tiles.has('-1:0:1')); // Returning during a partial rebuild must resume it.
  } finally {
    landscape.group.traverse((o) => {
      o.geometry?.dispose();
      o.material?.dispose();
    });
    landscape.cloudTexture.dispose();
  }
});
