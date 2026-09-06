import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../server/store.mjs';
import { ownerPlan } from '../src/world/owner-plan.ts';
import { plannedLayout } from '../src/world/planned-layout.ts';
import { plannedStreets } from '../src/world/planned-streets.ts';

test('three repository neighborhoods share one connected street plan without duplicate blocks or moving buildings', () => {
  const store = openStore(':memory:');
  const repos = ['studio/one', 'studio/two', 'studio/three'].map((id) => ({
    id,
    coordinates: store.locate(id),
    landPlan: store.reserveLand(id, 3),
    files: Array.from({ length: 18 }, (_, i) => ({ path: `src/${i}.ts` })),
  }));
  const plan = ownerPlan(repos),
    origin = repos[0].landPlan.city;
  assert.equal(plan.parcels.length, 54);
  assert.equal(new Set(plan.streets.map((b) => `${b.column}:${b.row}`)).size, plan.streets.length);
  assert.equal(new Set(plan.graph.edges.map((e) => e.id)).size, plan.graph.edges.length);
  const links = new Map(plan.graph.nodes.map((n) => [n.id, []]));
  for (const e of plan.graph.edges) {
    links.get(e.from).push(e.to);
    links.get(e.to).push(e.from);
  }
  const visited = new Set(),
    queue = [plan.graph.nodes[0].id];
  while (queue.length) {
    const n = queue.pop();
    if (visited.has(n)) continue;
    visited.add(n);
    queue.push(...links.get(n));
  }
  assert.equal(visited.size, plan.graph.nodes.length);
  const expected = repos.flatMap((repo) =>
    plannedLayout(repo).parcels.map((p) => [p.x + repo.coordinates.x, p.z + repo.coordinates.z]),
  );
  plan.parcels.forEach((p, i) =>
    assert.ok(Math.hypot(p.x + origin.x - expected[i][0], p.z + origin.z - expected[i][1]) < 1e-9),
  );
  const shifted = ownerPlan(repos, new Map(), repos[1].coordinates);
  assert.deepEqual(
    shifted.graph.edges.map((e) => Number(e.length.toFixed(5))).sort(),
    plan.graph.edges.map((e) => Number(e.length.toFixed(5))).sort(),
  );
  const rendered = plannedStreets(plan);
  assert.ok(rendered.children.length <= 10);
  rendered.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
  store.db.close();
});
