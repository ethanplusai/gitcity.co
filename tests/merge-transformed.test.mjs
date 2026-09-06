import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { mergeTransformed } from '../src/world/merge-transformed.mjs';

test('direct transformed batches match cloned merges and retain independently owned source buffers', () => {
  for (const indexed of [true, false]) {
    const base = new T.BoxGeometry(0.61, 1.23, 0.19);
    const source = indexed ? base : base.toNonIndexed();
    const original = source.clone();
    const parts = Array.from({ length: indexed ? 2800 : 8 }, (_, i) => ({
      geometry: source,
      matrix: new T.Matrix4().compose(
        new T.Vector3(i * 0.3, i % 5, -i * 0.7),
        new T.Quaternion().setFromEuler(new T.Euler(i * 0.03, i * 0.1, 0.2)),
        new T.Vector3(0.8, 1.7, 1.2),
      ),
    }));
    const clones = parts.map(({ geometry, matrix }) => geometry.clone().applyMatrix4(matrix));
    const expected = mergeGeometries(clones),
      actual = mergeTransformed(parts);
    for (const name of Object.keys(expected.attributes)) {
      assert.deepEqual(actual.attributes[name].array, expected.attributes[name].array);
      assert.deepEqual(source.attributes[name].array, original.attributes[name].array);
    }
    assert.deepEqual(actual.index?.array, expected.index?.array);
    actual.attributes.position.setX(0, 999);
    assert.deepEqual(source.attributes.position.array, original.attributes.position.array);
    [base, source, original, expected, actual, ...clones].forEach((g) => g.dispose());
  }
});

test('untransformed direct merges preserve all buffers without a transform pass', () => {
  const parts = Array.from({ length: 12 }, (_, i) =>
    new T.BoxGeometry(0.3, 0.2, 0.9).translate(i, 0.145, -i),
  );
  const expected = mergeGeometries(parts);
  const actual = mergeTransformed(parts.map((geometry) => ({ geometry })));
  for (const name of Object.keys(expected.attributes))
    assert.deepEqual(actual.attributes[name].array, expected.attributes[name].array);
  assert.deepEqual(actual.index.array, expected.index.array);
  [...parts, expected, actual].forEach((geometry) => geometry.dispose());
});
