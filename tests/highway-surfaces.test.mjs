import { HIGHWAY } from '../shared/highway-profile.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { sharedCorridors, corridorGraph } from '../shared/road-network.mjs';
import { highwaySurfaces } from '../src/world/highway-surfaces.mjs';
import { Raycaster, Vector3 } from 'three';

test('crossing highways form one paved junction without double-covered asphalt', () => {
  const corridors = sharedCorridors([
    {
      dependency: 'a/repo',
      points: [
        { x: -5, z: 0 },
        { x: 5, z: 0 },
      ],
    },
    {
      dependency: 'b/repo',
      points: [
        { x: 0, z: -5 },
        { x: 0, z: 5 },
      ],
    },
  ]);
  const graph = corridorGraph(corridors);
  assert.equal(graph.nodes.length, 5);
  assert.equal(graph.edges.length, 4);
  const group = highwaySurfaces(corridors);
  assert.equal(group.children.length, 3);
  assert.ok(group.children[2].isInstancedMesh);
  const road = group.children[1],
    geometry = road.geometry;
  const p = geometry.attributes.position,
    indices = geometry.index;
  let area = 0;
  for (let i = 0; i < indices.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map((j) => indices.getX(i + j));
    area +=
      Math.abs(
        (p.getX(b) - p.getX(a)) * (p.getZ(c) - p.getZ(a)) -
          (p.getZ(b) - p.getZ(a)) * (p.getX(c) - p.getX(a)),
      ) / 2;
  }
  const width = HIGHWAY.halfWidth * 2;
  assert.ok(Math.abs(area - (2 * (10 + width) * width - width ** 2)) < 1e-5);
  group.updateMatrixWorld(true);
  const ray = new Raycaster(new Vector3(0.07, 2, 0.04), new Vector3(0, -1, 0));
  assert.equal(ray.intersectObject(road).length, 1);
  group.traverse((object) => {
    if (object.isMesh) {
      if (object.isInstancedMesh) object.dispose();
      object.geometry.dispose();
      object.material.dispose();
    }
  });
});
