import test from 'node:test';
import assert from 'node:assert/strict';
import { directoryBlock } from '../shared/directory-block.mjs';
import { pointInPolygon } from '../shared/street-surfaces.mjs';
import { lotsOverlap } from '../shared/city-plan.mjs';
import { openStore } from '../server/store.mjs';

test('inventory groups have 64 full-size non-overlapping plots served by internal streets', () => {
  const orientations = new Set();
  for (const owner of ['test', 'vercel', 'studio'])
    for (const [x, z] of [
      [0, 2],
      [-6, -4],
      [9, 10],
    ]) {
      const plan = directoryBlock(owner, x, z);
      orientations.add(plan.orientation);
      assert.deepEqual(plan, directoryBlock(owner, x, z));
      assert.equal(plan.lots.length, 64);
      assert.equal(plan.streets.length, 3);
      for (const lot of plan.lots) {
        assert.ok(pointInPolygon(lot, plan.polygon));
        assert.equal(lot.width, 3.2);
        assert.equal(lot.depth, 2.9);
        for (const dx of [-lot.width / 2, lot.width / 2])
          for (const dz of [-lot.depth / 2, lot.depth / 2])
            assert.ok(
              pointInPolygon(
                {
                  x: lot.x + Math.cos(lot.rotation) * dx + Math.sin(lot.rotation) * dz,
                  z: lot.z - Math.sin(lot.rotation) * dx + Math.cos(lot.rotation) * dz,
                },
                plan.polygon,
              ),
            );
        const street = plan.streets[Math.floor(lot.slot / 22)];
        const axis = plan.orientation ? 'x' : 'z';
        assert.ok(Math.abs(Math.abs(lot.front[axis] - street.a[axis]) - 1.8) < 1e-8);
        for (const road of plan.streets)
          assert.ok(Math.abs(lot[axis] - road.a[axis]) - lot.depth / 2 >= 1.8 - 1e-8);
      }
      for (let i = 0; i < 64; i++)
        for (let j = i + 1; j < 64; j++)
          assert.equal(lotsOverlap(plan.lots[i], plan.lots[j]), false);
    }
  assert.deepEqual([...orientations].sort(), [0, 1]);
});

test('directory land grows around legacy and neighboring claims without moving reserved groups', () => {
  const store = openStore(':memory:');
  try {
    const old = store.reserveLand('test/one', 8);
    const directory = (blocks) => [
      { name: 'src', blocks: Array.from({ length: blocks }, (_, index) => ({ index, count: 64 })) },
    ];
    const before = store.inventoryLand('test/one', directory(5));
    const other = store.inventoryLand('test/two', directory(4));
    const expanded = store.inventoryLand('test/one', directory(7));
    assert.deepEqual(expanded[0].blocks.slice(0, 5), before[0].blocks);
    assert.deepEqual(store.reserveLand('test/one', 8), old);
    const occupied = new Set(old.blocks.map((b) => `${b.column}:${b.row}`));
    for (const block of [...expanded[0].blocks, ...other[0].blocks])
      for (let z = 0; z < 2; z++)
        for (let x = 0; x < 3; x++) {
          const key = `${block.column + x}:${block.row + z}`;
          assert.ok(!occupied.has(key));
          occupied.add(key);
        }
    const future = store.reserveLand('test/three', 10);
    for (const block of future.blocks) assert.ok(!occupied.has(`${block.column}:${block.row}`));
  } finally {
    store.db.close();
  }
});

test('physical reservations respect another owner city and preserve legacy file placement flags', () => {
  const store = openStore(':memory:');
  try {
    const owner = store.locateOwner('first');
    store.locateOwner('second');
    store.db
      .prepare('UPDATE owner_cities SET x=?,z=? WHERE id=?')
      .run(owner.x + 90, owner.z + 10, 'second');
    store.sourceLand('first/one', ['src/old.ts']);
    const directories = [
      { name: 'src', blocks: Array.from({ length: 30 }, (_, index) => ({ index, count: 64 })) },
    ];
    const first = store.inventoryLand('first/one', directories);
    const second = store.inventoryLand('second/one', directories);
    const aabb = (owner, block) => {
      const p = directoryBlock(owner, block.column, block.row).polygon;
      const origin = store.locateOwner(owner);
      return {
        minX: Math.min(...p.map((p) => p.x)) + origin.x,
        maxX: Math.max(...p.map((p) => p.x)) + origin.x,
        minZ: Math.min(...p.map((p) => p.z)) + origin.z,
        maxZ: Math.max(...p.map((p) => p.z)) + origin.z,
      };
    };
    for (const a of first[0].blocks.map((b) => aabb('first', b)))
      for (const b of second[0].blocks.map((b) => aabb('second', b)))
        assert.ok(a.maxX <= b.minX || b.maxX <= a.minX || a.maxZ <= b.minZ || b.maxZ <= a.minZ);
    store.sourceLand('first/one', ['src/old.ts', 'src/new.ts']);
    const files = store.inventoryFiles('first/one', [
      { path: 'src/old.ts', directoryAddress: 1 },
      { path: 'src/new.ts', directoryAddress: 0 },
    ]);
    assert.equal(files[0].directoryLocated, false);
    assert.equal(files[1].directoryLocated, true);
  } finally {
    store.db.close();
  }
});

test('directory network connects resolved plots without retaining survey roads through them', async () => {
  const { directoryCandidates } = await import('../shared/directory-block.mjs');
  const { directoryNetwork } = await import('../shared/directory-network.mjs');
  const { cityCell, connectedStreetGraph } = await import('../shared/city-plan.mjs');
  const { segmentHitsSite } = await import('../shared/road-network.mjs');
  for (const owner of ['test', 'vercel', 'studio']) {
    const legacy = [cityCell(owner, 1, 0)];
    const groups = directoryCandidates(owner, { x: 0, z: 0 }, new Set(['1:0']), 3).map((c) =>
      directoryBlock(owner, c.column, c.row),
    );
    const { graph, streets } = directoryNetwork(owner, legacy, groups);
    const ringGraph = connectedStreetGraph(
      streets,
      [...legacy, cityCell(owner, 0, 0), ...groups],
      groups.flatMap((group) =>
        group.streets.map((street) => ({
          points: [street.a, street.b],
          kind: 'local',
          mandatory: true,
        })),
      ),
    );
    const roadLength = (network) => network.edges.reduce((sum, edge) => sum + edge.length, 0);
    assert.ok(roadLength(graph) < roadLength(ringGraph) * 0.85);
    const nodes = new Map(graph.nodes.map((n) => [n.id, n]));
    const adjacency = new Map(graph.nodes.map((n) => [n.id, []]));
    for (const edge of graph.edges) {
      adjacency.get(edge.from).push(edge.to);
      adjacency.get(edge.to).push(edge.from);
      for (const lot of groups.flatMap((g) => g.lots)) {
        assert.equal(
          segmentHitsSite(nodes.get(edge.from), nodes.get(edge.to), {
            minX:
              lot.x -
              (Math.abs(Math.cos(lot.rotation)) * lot.width +
                Math.abs(Math.sin(lot.rotation)) * lot.depth) /
                2 -
              edge.halfWidth,
            maxX:
              lot.x +
              (Math.abs(Math.cos(lot.rotation)) * lot.width +
                Math.abs(Math.sin(lot.rotation)) * lot.depth) /
                2 +
              edge.halfWidth,
            minZ:
              lot.z -
              (Math.abs(Math.sin(lot.rotation)) * lot.width +
                Math.abs(Math.cos(lot.rotation)) * lot.depth) /
                2 -
              edge.halfWidth,
            maxZ:
              lot.z +
              (Math.abs(Math.sin(lot.rotation)) * lot.width +
                Math.abs(Math.cos(lot.rotation)) * lot.depth) /
                2 +
              edge.halfWidth,
          }),
          false,
        );
      }
    }
    const visited = new Set(),
      queue = [graph.nodes[0].id];
    while (queue.length) {
      const id = queue.pop();
      if (visited.has(id)) continue;
      visited.add(id);
      queue.push(...adjacency.get(id));
    }
    assert.equal(visited.size, graph.nodes.length);
    for (const group of groups)
      for (const street of group.streets) {
        assert.ok(
          graph.edges.some(
            (e) =>
              e.mandatory &&
              Math.abs(
                nodes.get(e.from)[group.orientation ? 'x' : 'z'] -
                  street.a[group.orientation ? 'x' : 'z'],
              ) < 1e-6,
          ),
        );
      }
  }
});
