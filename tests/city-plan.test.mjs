import test from 'node:test';
import assert from 'node:assert/strict';
import { cityCell, streetGraph, frontageLots, lotsOverlap } from '../shared/city-plan.mjs';
import { openStore } from '../server/store.mjs';
test('land claims grow without moving city anchors or existing blocks; adjacent repos cannot overlap', () => {
  const store = openStore(':memory:'),
    anchor = store.locate('demo/one'),
    a = store.reserveLand('demo/one', 3),
    b = store.reserveLand('demo/two', 3),
    expanded = store.reserveLand('demo/one', 6);
  assert.deepEqual(store.locate('demo/one'), anchor);
  assert.deepEqual(expanded.blocks.slice(0, 3), a.blocks);
  const occupied = new Set(expanded.blocks.map((b) => `${b.column}:${b.row}`));
  for (const block of b.blocks) assert.ok(!occupied.has(`${block.column}:${block.row}`));
  assert.deepEqual(store.reserveLand('demo/one', 2), expanded);
  store.db.close();
});
test('shared city streets split at T-junctions and do not duplicate boundary edges', () => {
  const cells = [
    cityCell('demo', 0, 1),
    cityCell('demo', 1, 1),
    cityCell('demo', 0, 2),
    cityCell('demo', 1, 2),
  ];
  const graph = streetGraph(cells),
    adj = new Map(graph.nodes.map((n) => [n.id, []]));
  for (const edge of graph.edges) {
    adj.get(edge.from).push(edge.to);
    adj.get(edge.to).push(edge.from);
    assert.ok(edge.length > 0);
  }
  const seen = new Set(),
    queue = [graph.nodes[0].id];
  while (queue.length) {
    const id = queue.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    queue.push(...adj.get(id));
  }
  assert.equal(seen.size, graph.nodes.length);
  assert.equal(new Set(graph.edges.map((e) => e.id)).size, graph.edges.length);
  assert.ok([...adj.values()].some((edges) => edges.length === 3));
});

test('frontage lots face shared streets and leave a courtyard at fixed human scale', () => {
  const cell = cityCell('demo', 1, 1),
    lots = frontageLots(cell);
  assert.ok(lots.length >= 8);
  for (const lot of lots) {
    assert.ok(Math.hypot(lot.x - lot.front.x, lot.z - lot.front.z) > 1.4);
    assert.ok(lot.width >= 2.8);
    assert.ok(Number.isFinite(lot.rotation));
  }
  for (let i = 0; i < lots.length; i++)
    for (let j = i + 1; j < lots.length; j++)
      assert.equal(lotsOverlap(lots[i], lots[j], 0.1), false);
});

test('visible planned blocks contain source buildings and navigation follows their shared network', async () => {
  const { plannedLayout } = await import('../src/world/planned-layout.ts');
  const { graphRoute } = await import('../src/world/navigation.ts');
  const { Vector3 } = await import('three');
  const store = openStore(':memory:');
  const coordinates = store.locate('demo/one');
  const data = {
    id: 'demo/one',
    coordinates,
    landPlan: store.reserveLand('demo/one', 5),
    files: Array.from({ length: 18 }, (_, i) => ({ path: `src/${i}.ts` })),
  };
  const plan = plannedLayout(data);
  assert.equal(plan.parcels.length, 18);
  assert.ok(plan.blocks.length < data.landPlan.blocks.length);
  for (const block of plan.blocks) assert.ok(plan.parcels.some((p) => p.block === block.block));
  const origin = new Vector3(coordinates.x, 0, coordinates.z);
  const first = plan.parcels[0].front,
    last = plan.parcels.at(-1).front;
  const route = graphRoute(
    new Vector3(first.x, 0, first.z).add(origin),
    new Vector3(last.x, 0, last.z).add(origin),
    origin,
    plan.graph,
  );
  assert.ok(route.length >= 3);
  const onEdge = (p) =>
    plan.graph.edges.some((e) => {
      const a = plan.graph.nodes.find((n) => n.id === e.from),
        b = plan.graph.nodes.find((n) => n.id === e.to);
      const x = p.x - origin.x,
        z = p.z - origin.z;
      return (
        Math.abs(Math.hypot(x - a.x, z - a.z) + Math.hypot(x - b.x, z - b.z) - e.length) < 1e-5
      );
    });
  assert.ok(route.slice(0, -1).every(onEdge));
  assert.ok(plan.lamps.length > 0);
  store.db.close();
});

test('source buildings meet their stable street frontage regardless of seeded depth', async () => {
  const { plannedLayout } = await import('../src/world/planned-layout.ts');
  const { building } = await import('../shared/model.mjs');
  const addresses = new Map();
  const data = {
    id: 'demo/frontage',
    files: Array.from({ length: 20 }, (_, i) => ({ path: `src/${i}.ts` })),
  };
  const before = plannedLayout(data, addresses);
  for (const lot of before.parcels) {
    const depth = building(lot.file).depth;
    assert.ok(Math.abs(lot.x + (Math.sin(lot.rotation) * depth) / 2 - lot.front.x) < 1e-8);
    assert.ok(Math.abs(lot.z + (Math.cos(lot.rotation) * depth) / 2 - lot.front.z) < 1e-8);
  }
  const after = plannedLayout({ ...data, files: [...data.files, { path: 'a/new.ts' }] }, addresses);
  for (const lot of before.parcels) {
    const next = after.parcels.find((p) => p.file.path === lot.file.path);
    assert.deepEqual(next.front, lot.front);
    assert.equal(next.x, lot.x);
    assert.equal(next.z, lot.z);
  }
});

test('neighboring districts share approach blocks instead of repeating routes to city hall', async () => {
  const { connectedCityCells } = await import('../shared/city-plan.mjs');
  const occupied = [
    [3, 3],
    [4, 3],
    [4, 4],
  ].map(([x, z]) => cityCell('demo', x, z));
  const connected = connectedCityCells('demo', occupied);
  const old = new Set(['0:0']);
  for (const b of occupied) {
    for (let x = 0; x <= b.column; x++) old.add(`${x}:0`);
    for (let z = 0; z <= b.row; z++) old.add(`${b.column}:${z}`);
  }
  assert.ok(connected.length < old.size, `${connected.length} blocks versus ${old.size}`);
  assert.deepEqual(connectedCityCells('demo', [...occupied].reverse()), connected);
  for (const b of occupied)
    assert.ok(connected.some((c) => c.column === b.column && c.row === b.row));
  const graph = streetGraph(connected),
    reached = new Set(),
    queue = [graph.nodes[0].id];
  while (queue.length) {
    const id = queue.pop();
    if (reached.has(id)) continue;
    reached.add(id);
    for (const edge of graph.edges) {
      if (edge.from === id) queue.push(edge.to);
      if (edge.to === id) queue.push(edge.from);
    }
  }
  assert.equal(reached.size, graph.nodes.length);
});

test('temporarily missing source samples keep their addresses when other files arrive', async () => {
  const { plannedLayout } = await import('../src/world/planned-layout.ts');
  const addresses = new Map();
  const base = { id: 'demo/samples', files: [{ path: 'a.ts' }, { path: 'b.ts' }] };
  const initial = plannedLayout(base, addresses);
  plannedLayout({ ...base, files: [{ path: 'b.ts' }, { path: 'c.ts' }] }, addresses);
  const returned = plannedLayout({ ...base, files: [...base.files, { path: 'c.ts' }] }, addresses);
  assert.equal(new Set(returned.parcels.map((p) => `${p.front.x}:${p.front.z}`)).size, 3);
  for (const parcel of initial.parcels)
    assert.deepEqual(
      returned.parcels.find((p) => p.file.path === parcel.file.path).front,
      parcel.front,
    );
});

test('full address caches do not hide current files or retain duplicate slot ownership', async () => {
  const { plannedLayout } = await import('../src/world/planned-layout.ts');
  const cell = { ...cityCell('demo', 1, 0), block: 0 };
  const count = frontageLots(cell).length;
  const data = {
    id: 'demo/capacity',
    landPlan: { version: 2, city: { x: 0, z: 0 }, anchor: { x: 0, z: 0 }, blocks: [cell] },
    files: Array.from({ length: count }, (_, i) => ({ path: `old/${i}.ts` })),
  };
  const addresses = new Map();
  plannedLayout(data, addresses);
  const updated = plannedLayout(
    { ...data, files: data.files.map((_, i) => ({ path: `new/${i}.ts` })) },
    addresses,
  );
  assert.equal(updated.parcels.length, count);
  assert.equal(new Set(addresses.values()).size, addresses.size);
  assert.equal(new Set(updated.parcels.map((p) => `${p.front.x}:${p.front.z}`)).size, count);
});
