import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { localSky } from '../shared/sky-time.mjs';
import { Landscape } from '../src/world/landscape.ts';
import { grove } from '../src/world/vegetation.mjs';

test('local clock produces daylight and a navigable night cycle independently of repository data', () => {
  assert.equal(localSky(new Date(2026, 8, 5, 12)).phase, 'Day');
  assert.equal(localSky(new Date(2026, 8, 5, 23)).phase, 'Night');
  assert.equal(localSky(new Date(2026, 8, 5, 8, 30)).hour, 8.5);
  const before = localSky(new Date(2026, 8, 5, 19, 0));
  const after = localSky(new Date(2026, 8, 5, 19, 1));
  assert.ok(Math.abs(before.daylight - after.daylight) < 0.02);
});
test('terrain rebuilds when permanent coordinates replace a provisional location, even with the same city count', () => {
  const landscape = new Landscape();
  landscape.setSites([{ x: -400, z: 100 }]);
  const revision = landscape.revision;
  landscape.setSites([{ x: 95, z: 30 }]);
  assert.ok(landscape.revision > revision);
  const same = landscape.revision;
  landscape.setSites([{ x: 95, z: 30 }]);
  assert.equal(landscape.revision, same);
  for (let x = 85; x < 105; x += 2)
    for (let z = 20; z < 40; z += 2) assert.equal(landscape.height(x, z), -0.055);
  landscape.setRoads([
    [
      { x: 200, z: 200 },
      { x: 400, z: 200 },
    ],
  ]);
  assert.equal(landscape.height(300, 200), -0.055);
  assert.equal(landscape.roadDistance(300, 205), 5);
  landscape.dispose();
});
test('groves use deterministic instanced branches and leaves instead of opaque crown balls', () => {
  const points = Array.from({ length: 20 }, (_, i) => ({ x: i * 3, z: 0, scale: 1 }));
  const a = grove(points, 'test'),
    b = grove(points, 'test');
  assert.equal(a.children.length, 4);
  a.children.forEach((mesh, i) => {
    assert.ok(mesh instanceof T.InstancedMesh);
    assert.equal(mesh.count, 10);
    assert.deepEqual(
      mesh.geometry.attributes.position.array,
      b.children[i].geometry.attributes.position.array,
    );
    mesh.computeBoundingBox();
    assert.ok(mesh.boundingBox.max.y > 1);
  });
  for (const group of [a, b])
    group.traverse((m) => {
      if (m instanceof T.Mesh) {
        m.geometry.dispose();
        m.material.dispose();
      }
    });
});

test('developed land controls terrain clearance at block edges instead of a city-wide circle', () => {
  const landscape = new Landscape();
  landscape.setBlocks([
    [
      { x: 0, z: 0 },
      { x: 20, z: 0 },
      { x: 20, z: 20 },
      { x: 0, z: 20 },
    ],
  ]);
  assert.equal(landscape.blockDistance(10, 10), 0);
  assert.equal(landscape.blockDistance(25, 10), 5);
  assert.equal(landscape.height(10, 10), -0.055);
  assert.equal(landscape.height(25, 10), -0.055);
  assert.notEqual(landscape.height(50, 10), -0.055);
  const revision = landscape.revision;
  landscape.setBlocks([
    [
      { x: 0, z: 0 },
      { x: 20, z: 0 },
      { x: 20, z: 20 },
      { x: 0, z: 20 },
    ],
  ]);
  assert.equal(landscape.revision, revision);
  landscape.dispose();
});

test('atmosphere preserves the focused city at every altitude while retaining distant haze', async () => {
  const { atmosphereDensity } = await import('../shared/atmosphere.mjs');
  const transmission = (density, distance) => Math.exp(-((density * distance) ** 2));
  for (const distance of [1, 20, 100, 300, 1000, 3000]) {
    const clear = atmosphereDensity(distance);
    const storm = atmosphereDensity(distance, true);
    assert.ok(transmission(clear, distance) >= 0.95);
    assert.ok(transmission(storm, distance) >= 0.81);
    assert.ok(storm > clear);
    assert.ok(transmission(clear, distance * 4) < transmission(clear, distance));
  }
  assert.ok(Number.isFinite(atmosphereDensity(NaN)));
});

test('terrain transition matches detailed tile edges and distant ground with one bounded mesh', () => {
  const landscape = new Landscape();
  landscape.updateApron(2, -3);
  const mesh = landscape.apron;
  const positions = mesh.geometry.attributes.position;
  const ringSize = 72 * 4;
  assert.equal(positions.count, ringSize * 5);
  for (let i = 0; i < ringSize; i++) {
    assert.ok(
      Math.abs(positions.getY(i) - landscape.height(positions.getX(i), positions.getZ(i))) < 1e-5,
    );
    assert.equal(positions.getY(ringSize * 4 + i), -4);
  }
  assert.ok(mesh.geometry.attributes.normal.getY(0) > 0);
  landscape.updateApron(3, -3);
  assert.equal(mesh.parent, null);
  landscape.dispose();
});

test('foliage retains cutout coverage at distance within a shared texture and geometry budget', async () => {
  const { foliageTexture } = await import('../src/world/foliage-texture.mjs');
  const { treeKit } = await import('../src/world/vegetation.mjs');
  for (const conifer of [false, true]) {
    const texture = foliageTexture(conifer);
    assert.equal(texture, foliageTexture(conifer));
    assert.equal(texture.generateMipmaps, false);
    assert.equal(texture.mipmaps.length, 9);
    const coverage = (data) =>
      data.reduce((n, v, i) => n + (i % 4 === 3 && v >= 77 ? 1 : 0), 0) / (data.length / 4);
    const base = coverage(texture.image.data);
    assert.ok(base > 0.1 && base < 0.6);
    for (const mip of texture.mipmaps) {
      assert.ok(coverage(mip.data) >= base * 0.7, `crown disappeared at mip ${mip.width}`);
      assert.ok(mip.data.byteLength === mip.width * mip.height * 4);
    }
    for (const distant of [false, true]) {
      const kit = treeKit('budget', conifer, distant);
      const triangles = (kit.bark.index.count + kit.leaves.index.count) / 3;
      assert.ok(triangles < (distant ? 600 : 1300));
      for (const geometry of [kit.bark, kit.leaves]) {
        assert.ok([...geometry.attributes.position.array].every(Number.isFinite));
        geometry.dispose();
      }
    }
  }
});
