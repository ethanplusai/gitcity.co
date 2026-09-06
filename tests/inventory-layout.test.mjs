import { repoArrival } from '../src/world/repo-arrival.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import { openStore } from '../server/store.mjs';
import { inventoryRegions } from '../src/world/inventory-layout.ts';
import { plannedLayout } from '../src/world/planned-layout.ts';
import { ownerPlan } from '../src/world/owner-plan.ts';
import { directoryMassing, directoryHit } from '../src/world/directory-massing.ts';

function fixture(store, id) {
  const paths = Array.from({ length: 130 }, (_, i) => `src/${String(i).padStart(3, '0')}.ts`);
  const files = [{ path: paths[0], symbols: 3, lines: 20, analysis: 'AST' }];
  const legacy = store.sourceLand(
    id,
    files.map((f) => f.path),
  );
  const inventory = store.directoryInventory(
    id,
    paths,
    files.map((f) => ({ ...f, address: legacy.addresses[f.path] })),
    true,
  );
  inventory.directories = store.inventoryLand(id, inventory.directories);
  return {
    paths,
    repo: {
      id,
      coordinates: store.locate(id),
      landPlan: legacy.landPlan,
      sourceInventory: inventory,
      files: store.inventoryFiles(id, inventory.files),
    },
  };
}

test('survey geometry excludes legacy and deleted slots, resolving detail without moving addresses', () => {
  const store = openStore(':memory:');
  try {
    const { repo, paths } = fixture(store, 'studio/one');
    const first = plannedLayout(repo);
    assert.equal(
      first.regions.reduce((n, r) => n + r.unresolved.length, 0),
      129,
    );
    assert.ok(!first.regions[0].unresolved.includes(0));
    assert.equal(first.regions[2].streets.length, 1);
    assert.equal(first.regions[0].streets.length, 3);
    assert.deepEqual(
      repoArrival({ ...first, total: 4000 }),
      repoArrival({ ...first, total: 8000 }),
    );
    assert.ok(repoArrival(first).span <= 64);
    const group = directoryMassing(first.regions);
    assert.equal(group.children.length, 1);
    assert.equal(group.children[0].count, 129);
    assert.deepEqual(directoryHit({ object: group.children[0], instanceId: 0 }), {
      repo: repo.id,
      directory: 'src',
      block: 0,
      slot: 1,
    });
    const matrix = new T.Matrix4();
    group.children[0].getMatrixAt(0, matrix);
    const oldLot = first.regions[0].lots[1];
    assert.ok(Math.abs(matrix.elements[12] - oldLot.x) < 1e-5);
    assert.ok(Math.abs(matrix.elements[14] - oldLot.z) < 1e-5);
    const detail = { path: paths[1], symbols: 8, lines: 50, analysis: 'AST' };
    const inventory = store.directoryInventory(
      repo.id,
      paths.filter((p) => p !== paths[2]),
      [...repo.files, detail],
      true,
    );
    inventory.directories = store.inventoryLand(repo.id, inventory.directories);
    const nextRepo = {
      ...repo,
      sourceInventory: inventory,
      files: store.inventoryFiles(repo.id, inventory.files),
    };
    const next = plannedLayout(nextRepo);
    assert.equal(
      next.regions.reduce((n, r) => n + r.unresolved.length, 0),
      127,
    );
    assert.deepEqual(next.parcels[0], first.parcels[0]);
    assert.deepEqual(next.parcels.find((p) => p.file.path === detail.path).front, oldLot.front);
    assert.deepEqual(
      next.regions.map((r) => r.streets),
      first.regions.map((r) => r.streets),
    );
    assert.deepEqual(
      next.regions.map((r) => r.center),
      first.regions.map((r) => r.center),
    );
    assert.ok(!next.regions[0].unresolved.includes(2));
    group.children[0].geometry.dispose();
    group.children[0].material.dispose();
  } finally {
    store.db.close();
  }
});

test('owner aggregation preserves inventory plots in world coordinates for each repository', () => {
  const store = openStore(':memory:');
  try {
    const repos = ['studio/one', 'studio/two'].map((id) => fixture(store, id).repo);
    const city = repos[0].landPlan.city;
    const combined = ownerPlan(repos);
    assert.equal(new Set(combined.regions.map((r) => r.block)).size, 6);
    for (const repo of repos) {
      const raw = inventoryRegions(repo);
      const local = plannedLayout(repo);
      raw.forEach((region, index) => {
        const owned = combined.regions.find((r) => r.repo === repo.id && r.index === region.index);
        owned.lots.forEach((lot, i) => {
          assert.ok(Math.hypot(lot.x - region.lots[i].x, lot.z - region.lots[i].z) < 1e-8);
          assert.ok(
            Math.hypot(lot.front.x - region.lots[i].front.x, lot.front.z - region.lots[i].front.z) <
              1e-8,
          );
        });
        assert.ok(
          Math.abs(local.regions[index].center.x + repo.coordinates.x - region.center.x - city.x) <
            1e-8,
        );
      });
    }
    const shifted = ownerPlan(repos, new Map(), repos[1].coordinates);
    shifted.regions.forEach((r, i) => {
      assert.ok(
        Math.abs(r.center.x + repos[1].coordinates.x - combined.regions[i].center.x - city.x) <
          1e-8,
      );
    });
  } finally {
    store.db.close();
  }
});

test('rebasing a prepared directory owner plan matches rebuilding in district coordinates', async () => {
  const { rebasePlan } = await import('../src/world/rebase-plan.ts');
  const store = openStore(':memory:');
  try {
    const repos = [fixture(store, 'studio/one').repo, fixture(store, 'studio/two').repo];
    const addresses = new Map();
    const origin = repos[0].landPlan.city;
    const district = repos[1].coordinates;
    const layouts = new Map();
    const prepared = ownerPlan(repos, addresses, origin, layouts);
    assert.equal(layouts.size, repos.length);
    for (const repo of repos)
      assert.deepEqual(layouts.get(repo), plannedLayout(repo, addresses.get(repo.id)));
    const original = structuredClone(prepared);
    const shifted = rebasePlan(prepared, origin.x - district.x, origin.z - district.z);
    const rebuilt = ownerPlan(repos, addresses, district);
    const same = (a, b, path = '') => {
      if (typeof a === 'number' && typeof b === 'number') {
        assert.ok(Math.abs(a - b) < 1e-7, `${path}: ${a} versus ${b}`);
      } else if (a && typeof a === 'object') {
        assert.deepEqual(Object.keys(a), Object.keys(b), path);
        for (const key of Object.keys(a)) same(a[key], b[key], `${path}.${key}`);
      } else assert.equal(a, b, path);
    };
    same(shifted, rebuilt);
    assert.deepEqual(prepared, original);
  } finally {
    store.db.close();
  }
});
