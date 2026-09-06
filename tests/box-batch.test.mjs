import test from 'node:test';
import assert from 'node:assert/strict';
import { BoxGeometry } from 'three';
import { BoxBatch } from '../src/world/box-batch.mjs';

test('packed street boxes retain faces, normals and UVs across growth and 16-bit limits', () => {
  const batch = new BoxBatch();
  assert.equal(batch.geometry(), null);
  for (let i = 0; i < 2800; i++) batch.add(0.15, 0.006, 0.55, i * 0.26, 0.115, -i, i * 0.17);
  const actual = batch.geometry();
  assert.equal(actual.attributes.position.count, 2800 * 24);
  for (const i of [0, 31, 32, 1023, 2799]) {
    const expected = new BoxGeometry(0.15, 0.006, 0.55)
      .rotateY(i * 0.17)
      .translate(i * 0.26, 0.115, -i);
    for (const name of ['position', 'normal', 'uv']) {
      const a = actual.attributes[name].array,
        b = expected.attributes[name].array;
      for (let j = 0; j < b.length; j++)
        assert.ok(Math.abs(a[i * b.length + j] - b[j]) < (name === 'position' ? 0.0003 : 1e-6));
    }
    for (let j = 0; j < 36; j++)
      assert.equal(actual.index.array[i * 36 + j], expected.index.array[j] + i * 24);
    expected.dispose();
  }
  actual.dispose();
});

test('packed architectural boxes exactly retain masonry coordinates and seeded room UV offsets', () => {
  for (const mode of [1, 2]) {
    const batch = new BoxBatch();
    for (let i = 0; i < 40; i++) {
      const w = 0.07 + i * 0.013,
        h = 0.61,
        d = 0.026;
      const x = i * 0.8,
        y = 0.78 + i * 0.03,
        z = -2.26;
      batch.add(w, h, d, x, y, z, 0, mode, i, i + 3);
      const expected = new BoxGeometry(w, h, d).translate(x, y, z);
      const p = expected.attributes.position,
        n = expected.attributes.normal,
        uv = expected.attributes.uv;
      for (let v = 0; v < p.count; v++) {
        if (mode === 1)
          uv.setXY(
            v,
            (Math.abs(n.getX(v)) > 0.5 ? p.getZ(v) : p.getX(v)) * 3.9,
            (Math.abs(n.getY(v)) > 0.5 ? p.getZ(v) : p.getY(v)) * 3.9,
          );
        else uv.setXY(v, uv.getX(v) + i, uv.getY(v) + i + 3);
      }
      for (const name of ['position', 'normal', 'uv'])
        assert.deepEqual(
          batch[name].slice(
            i * expected.attributes[name].array.length,
            (i + 1) * expected.attributes[name].array.length,
          ),
          expected.attributes[name].array,
        );
      expected.dispose();
    }
    batch.geometry().dispose();
  }
});
