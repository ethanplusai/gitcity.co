import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { streamingGrove } from '../src/world/vegetation.mjs';

test('courtyard vegetation transfers each tree once between near and distant kits with hysteresis', () => {
  const group = streamingGrove(
    [
      { x: 0, z: 0, species: 0 },
      { x: 200, z: 0, species: 0 },
    ],
    'test',
  );
  group.position.set(500, 0, -300);
  const [detail, coarse] = group.children;
  const expectedColors = coarse.children.map((mesh) =>
    [0, 1].map((i) => {
      const color = new T.Color();
      mesh.getColorAt(i, color);
      return color;
    }),
  );
  assert.notDeepEqual(expectedColors[0][0], expectedColors[0][1]);
  const update = (x) => {
    group.userData.updateVegetation(new T.Vector3(x + 500, 2, -300));
    for (const lod of [detail, coarse])
      lod.children.forEach((mesh, batch) => {
        for (let i = 0; i < mesh.count; i++) {
          const transform = new T.Matrix4(),
            color = new T.Color();
          mesh.getMatrixAt(i, transform);
          mesh.getColorAt(i, color);
          assert.deepEqual(color, expectedColors[batch][transform.elements[12] / 200]);
        }
      });
  };
  update(0);
  for (let i = 0; i < detail.children.length; i++) {
    assert.equal(detail.children[i].count, 1);
    assert.equal(coarse.children[i].count, 1);
    assert.equal(coarse.children[i].castShadow, false);
    const a = new T.Matrix4(),
      b = new T.Matrix4();
    detail.children[i].getMatrixAt(0, a);
    coarse.children[i].getMatrixAt(0, b);
    assert.equal(a.elements[12], 0);
    assert.equal(b.elements[12], 200);
  }
  update(80);
  assert.equal(detail.children[0].count, 1); // Retain detail until 90.
  update(100);
  assert.equal(detail.children[0].count, 0);
  update(80);
  assert.equal(detail.children[0].count, 0); // Reenter below 70.
  update(60);
  assert.equal(detail.children[0].count, 1);
  update(200);
  assert.equal(detail.children[0].count, 1);
  const matrix = new T.Matrix4();
  detail.children[0].getMatrixAt(0, matrix);
  assert.equal(matrix.elements[12], 200);
  const triangles = (g) => g.children.reduce((n, mesh) => n + mesh.geometry.index.count / 3, 0);
  assert.ok(triangles(coarse) < triangles(detail) * 0.15);
  group.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});

test('moving foliage shares cutout maps with shadow passes and releases its owned shadow materials', async () => {
  const { grove } = await import('../src/world/vegetation.mjs');
  const group = grove([{ x: 0, z: 0, scale: 3, species: 0 }], 'motion');
  const leaves = group.children.find((mesh) => mesh.customDepthMaterial);
  assert.ok(leaves);
  assert.equal(leaves.customDepthMaterial.map, leaves.material.map);
  assert.equal(leaves.customDistanceMaterial.map, leaves.material.map);
  assert.equal(leaves.customDepthMaterial.alphaTest, leaves.material.alphaTest);
  const before = leaves.boundingSphere.radius;
  leaves.computeBoundingSphere();
  assert.ok(before - leaves.boundingSphere.radius >= 0.24 - 1e-6);
  let disposed = 0;
  leaves.customDepthMaterial.addEventListener('dispose', () => disposed++);
  leaves.customDistanceMaterial.addEventListener('dispose', () => disposed++);
  group.traverse((object) => {
    object.geometry?.dispose();
    object.material?.dispose();
  });
  assert.equal(disposed, 2);
});
