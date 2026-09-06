import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { HDRLoader } from 'three/examples/jsm/loaders/HDRLoader.js';
import { Surfaces } from '../src/world/surfaces.ts';

test('surface arrivals publish brick maps together and leave unrelated materials alone', async () => {
  const original = T.TextureLoader.prototype.loadAsync;
  const originalHDR = HDRLoader.prototype.loadAsync;
  const pending = new Map();
  T.TextureLoader.prototype.loadAsync = (url) =>
    new Promise((resolve, reject) => pending.set(url, { resolve, reject }));
  HDRLoader.prototype.loadAsync = async () => {
    throw new Error('No environment in this test');
  };
  const surfaces = new Surfaces();
  const brick = new T.MeshStandardMaterial();
  const grass = new T.MeshStandardMaterial();
  brick.userData.surface = 'brick';
  grass.userData.surface = 'grass';
  const flush = () => new Promise((resolve) => setImmediate(resolve));
  const deliver = (name) => {
    const texture = new T.Texture();
    pending.get(`/materials/${name}.jpg`).resolve(texture);
    return texture;
  };
  try {
    surfaces.track(brick);
    surfaces.track(grass);
    assert.equal(brick.version, 0);
    const loading = surfaces.load({ capabilities: { getMaxAnisotropy: () => 4 } }, new T.Scene());
    const color = deliver('brick-color');
    await flush();
    assert.equal(brick.map, null);
    const ground = deliver('grass-color');
    await flush();
    assert.equal(grass.map, ground);
    assert.equal(grass.version, 1);
    deliver('brick-normal');
    await flush();
    assert.equal(brick.version, 0);
    deliver('brick-rough');
    await flush();
    assert.equal(brick.map, color);
    assert.equal(brick.version, 1);
    assert.equal(grass.version, 1);
    let released = 0;
    color.addEventListener('dispose', () => released++);
    surfaces.dispose();
    assert.equal(released, 1);
    deliver('concrete-normal');
    deliver('concrete-rough');
    const late = deliver('concrete-color');
    late.addEventListener('dispose', () => released++);
    await loading;
    assert.equal(released, 2);
    assert.equal(brick.version, 1);
  } finally {
    surfaces.dispose();
    brick.dispose();
    grass.dispose();
    T.TextureLoader.prototype.loadAsync = original;
    HDRLoader.prototype.loadAsync = originalHDR;
  }
});

test('disposing an incomplete finish releases arrived maps before remaining requests settle', async () => {
  const original = T.TextureLoader.prototype.loadAsync;
  const originalHDR = HDRLoader.prototype.loadAsync;
  const pending = new Map();
  T.TextureLoader.prototype.loadAsync = (url) =>
    new Promise((resolve) => pending.set(url, resolve));
  HDRLoader.prototype.loadAsync = async () => {
    throw new Error('No environment');
  };
  const surfaces = new Surfaces();
  let released = 0;
  const texture = () => {
    const result = new T.Texture();
    result.addEventListener('dispose', () => released++);
    return result;
  };
  try {
    const loading = surfaces.load({ capabilities: { getMaxAnisotropy: () => 4 } }, new T.Scene());
    pending.get('/materials/brick-color.jpg')(texture());
    pending.delete('/materials/brick-color.jpg');
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(released, 0);
    surfaces.dispose();
    assert.equal(released, 1, 'partial finish is released without waiting for other maps');
    for (const resolve of pending.values()) resolve(texture());
    await loading;
    assert.equal(released, 7, 'each late map is released exactly once');
    surfaces.dispose();
    assert.equal(released, 7);
  } finally {
    surfaces.dispose();
    T.TextureLoader.prototype.loadAsync = original;
    HDRLoader.prototype.loadAsync = originalHDR;
  }
});

test('compressed failures fall back per map and release the transcoder after settlement', async () => {
  const { KTX2Loader } = await import('three/examples/jsm/loaders/KTX2Loader.js');
  const saved = {
    detect: KTX2Loader.prototype.detectSupport,
    load: KTX2Loader.prototype.loadAsync,
    dispose: KTX2Loader.prototype.dispose,
    jpg: T.TextureLoader.prototype.loadAsync,
    hdr: HDRLoader.prototype.loadAsync,
  };
  const requests = [],
    fallback = [];
  let disposed = 0;
  KTX2Loader.prototype.detectSupport = function () {
    return this;
  };
  KTX2Loader.prototype.loadAsync = async function (url) {
    assert.equal(this.workerPool.pool, 1);
    requests.push(url);
    if (url.includes('brick-normal')) throw new Error('Unsupported payload');
    return new T.CompressedTexture();
  };
  KTX2Loader.prototype.dispose = () => disposed++;
  T.TextureLoader.prototype.loadAsync = async (url) => {
    fallback.push(url);
    return new T.Texture();
  };
  HDRLoader.prototype.loadAsync = async () => {
    throw new Error('No environment');
  };
  const surfaces = new Surfaces(),
    brick = new T.MeshStandardMaterial();
  brick.userData.surface = 'brick';
  surfaces.track(brick);
  try {
    await surfaces.load(
      { extensions: { has: () => true }, capabilities: { getMaxAnisotropy: () => 4 } },
      new T.Scene(),
    );
    assert.equal(requests.length, 7);
    assert.deepEqual(fallback, ['/materials/brick-normal.jpg']);
    assert.equal(brick.map.isCompressedTexture, true);
    assert.equal(brick.map.colorSpace, T.SRGBColorSpace);
    assert.equal(brick.map.repeat.x, 0.65);
    assert.ok(brick.normalMap);
    assert.equal(disposed, 1);
    surfaces.dispose();
    assert.equal(disposed, 1);
  } finally {
    surfaces.dispose();
    brick.dispose();
    Object.assign(KTX2Loader.prototype, {
      detectSupport: saved.detect,
      loadAsync: saved.load,
      dispose: saved.dispose,
    });
    T.TextureLoader.prototype.loadAsync = saved.jpg;
    HDRLoader.prototype.loadAsync = saved.hdr;
  }
});
