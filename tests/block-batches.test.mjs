import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { architecture } from '../src/world/architecture.ts';
import { BlockBatches } from '../src/world/block-batches.ts';
import { batchedFile } from '../src/world/urban.ts';

test('distant blocks preserve geometry and file picking while reducing submitted meshes', () => {
  const parent = new T.Group(),
    objects = [];
  for (let i = 0; i < 12; i++) {
    const file = { path: `src/${i}.ts`, lines: 100, symbols: 10, analysis: 'AST' };
    const object = new T.Group();
    object.position.set(i * 4, 0, 0);
    object.add(architecture(file).group);
    parent.add(object);
    objects.push(object);
  }
  const triangles = (root) => {
    let count = 0;
    root.traverse((o) => {
      if (o.isMesh) count += (o.geometry.index?.count || o.geometry.attributes.position.count) / 3;
    });
    return count;
  };
  const meshes = (root) => {
    let count = 0;
    root.traverse((o) => {
      if (o.isMesh) count++;
    });
    return count;
  };
  const bytes = (root) => {
    const buffers = new Set();
    root.traverse((o) => {
      if (o.isMesh) {
        for (const attribute of Object.values(o.geometry.attributes))
          buffers.add(attribute.array.buffer);
        if (o.geometry.index) buffers.add(o.geometry.index.array.buffer);
      }
    });
    return [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 0);
  };
  const originalBytes = bytes(parent);
  const expected = triangles(parent),
    originalMeshes = meshes(parent);
  const batches = new BlockBatches(parent, new Map([['one', objects]])),
    chunk = batches.chunks[0];
  assert.equal(chunk.batch, null);
  assert.equal(batches.update(new T.Vector3(1000, 1000, 0), null, false), 1);
  assert.equal(triangles(chunk.batch), expected);
  assert.ok(
    bytes(parent) <= originalBytes * 1.01,
    `shared buffers ${bytes(parent)} vs original ${originalBytes}`,
  );
  assert.ok(meshes(chunk.batch) < originalMeshes / 2);
  assert.equal(batches.update(new T.Vector3(1000, 1000, 0), null, false), 1);
  assert.ok(objects.every((o) => !o.visible));
  parent.updateMatrixWorld(true);
  const ray = new T.Raycaster(new T.Vector3(0, 100, 0), new T.Vector3(0, -1, 0));
  const hit = ray.intersectObject(chunk.batch, true)[0];
  assert.ok(hit);
  assert.equal(batchedFile(hit.object, hit.faceIndex).path, 'src/0.ts');
  const material = chunk.batch.children[0].material,
    source = material.userData.sourceMaterial;
  source.color.set('#112233');
  source.emissiveIntensity = 0.7;
  batches.update(new T.Vector3(1000, 1000, 0), null, false);
  assert.equal(material.color.getHex(), source.color.getHex());
  assert.equal(material.emissiveIntensity, 0.7);
  batches.update(new T.Vector3(0, 2, 0), null, false);
  assert.ok(objects.every((o) => o.visible));
  assert.equal(chunk.batch.visible, false);
  parent.updateMatrixWorld(true);
  const closeHits = ray.intersectObjects(objects, true);
  assert.ok(closeHits.length > 0);
  assert.ok(closeHits.every((hit) => hit.object.userData.file.path === 'src/0.ts'));

  batches.update(new T.Vector3(1000, 1000, 0), null, true);
  assert.ok(objects.every((o) => o.visible));
  batches.update(new T.Vector3(1000, 1000, 0), objects[0], false);
  assert.equal(objects[0].visible, false);
  assert.ok(objects.slice(1).every((o) => o.visible));
  assert.equal(chunk.batch.visible, false);
  parent.traverse((o) => {
    if (o.isMesh) {
      o.geometry.dispose();
      o.material.dispose();
    }
  });
});
