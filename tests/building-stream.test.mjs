import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { architecture } from '../src/world/architecture.ts';
import { unloadBuildingBlock, reloadBuildingBlock } from '../src/world/building-stream.ts';
import { BlockBatches } from '../src/world/block-batches.ts';
import { batchedFile } from '../src/world/urban.ts';

test('far blocks release detail buffers and restore their deterministic kit without moving file anchors', () => {
  const parent = new T.Group(),
    objects = [];
  parent.position.set(100, 0, 50);
  for (let i = 0; i < 8; i++) {
    const file = { path: `src/stream-${i}.ts`, lines: 120, symbols: 20, analysis: 'AST' };
    const kit = architecture(file),
      anchor = new T.Group();
    anchor.position.x = i * 4;
    anchor.userData.buildingRecipe = {
      file,
      body: kit.body,
      glass: kit.glass,
      roof: kit.roof,
      rotation: 0,
      scale: 1,
    };
    anchor.add(kit.group);
    parent.add(anchor);
    objects.push(anchor);
  }
  const bytes = () => {
    const buffers = new Set();
    parent.traverse((o) => {
      if (o.isMesh) {
        for (const a of Object.values(o.geometry.attributes)) buffers.add(a.array.buffer);
        if (o.geometry.index) buffers.add(o.geometry.index.array.buffer);
      }
    });
    return [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  };
  const before = bytes(),
    position = objects[0].position.clone();
  const original = [...objects[0].children[0].children[0].geometry.attributes.position.array];
  const remove = (group, keep = new Set()) => {
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        if (!keep.has(o.material)) o.material.dispose();
      }
    });
    group.clear();
    group.removeFromParent();
  };
  const batches = new BlockBatches(parent, new Map([['block', objects]]), () => {}, {
    unload: (objects, batch) => {
      const proxy = unloadBuildingBlock(objects, remove);
      if (batch) remove(batch);
      return proxy;
    },
    reload: (objects) => reloadBuildingBlock(objects, () => {}),
    remove,
  });
  const far = new T.Vector3(1000, 100, 0),
    near = new T.Vector3(0, 2, 0);
  batches.update(far, null, false);
  assert.ok(objects.every((o) => o.children.length === 0));
  assert.ok(bytes() < before * 0.35, `${bytes()} retained vs ${before} detailed bytes`);
  parent.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(100, 100, 50), new T.Vector3(0, -1, 0));
  const hit = ray.intersectObject(batches.chunks[0].proxy, true)[0];
  assert.equal(batchedFile(hit.object, hit.faceIndex).path, 'src/stream-0.ts');
  const body = objects[0].userData.buildingRecipe.body;
  const roof = objects[0].userData.buildingRecipe.roof;
  body.color.set('#aabbcc');
  batches.update(near, null, false);
  assert.equal(batches.chunks[0].proxy, null);
  assert.deepEqual(
    [...objects[0].children[0].children[0].geometry.attributes.position.array],
    original,
  );
  assert.deepEqual(objects[0].position, position);
  assert.equal(objects[0].children[0].children[0].material, body);
  assert.equal(body.color.getHex(), 0xaabbcc);
  assert.ok(objects[0].children[0].children.some((mesh) => mesh.material === roof));
  batches.update(far, null, false);
  batches.update(far, objects[0], false);
  assert.equal(batches.chunks[0].proxy, null);
  assert.equal(objects[0].visible, false);
  assert.ok(objects.slice(1).every((o) => o.visible));
});

test('known distant blocks start coarse and stay cold while other blocks construct', async () => {
  const { architectureStyle } = await import('../src/world/architecture.ts');
  const file = { path: 'src/cold.ts', lines: 200, symbols: 15, analysis: 'AST' };
  const style = architectureStyle(file),
    parent = new T.Group(),
    anchor = new T.Group();
  anchor.userData.buildingRecipe = {
    file,
    body: style.body,
    glass: style.glass,
    rotation: 0,
    scale: 1,
  };
  parent.add(anchor);
  style.materials.filter((m) => m !== style.body && m !== style.glass).forEach((m) => m.dispose());
  let reloads = 0;
  const remove = (group) => {
    group.traverse((o) => {
      if (o.isMesh) {
        o.geometry.dispose();
        o.material.dispose();
      }
    });
    group.clear();
    group.removeFromParent();
  };
  const batches = new BlockBatches(parent, new Map([['cold', [anchor]]]), () => {}, {
    unload: (objects) => unloadBuildingBlock(objects, remove),
    reload: (objects) => {
      reloads++;
      reloadBuildingBlock(objects, () => {});
    },
    remove,
  });
  assert.ok(batches.chunks[0].proxy);
  assert.equal(anchor.children.length, 0);
  batches.update(new T.Vector3(1000, 100, 0), null, true);
  assert.equal(reloads, 0);
  assert.ok(batches.chunks[0].proxy);
  batches.update(new T.Vector3(0, 2, 0), null, false);
  assert.equal(reloads, 1);
  assert.ok(anchor.children[0].children.length > 2);
  assert.equal(batches.chunks[0].proxy, null);
  remove(parent);
});
