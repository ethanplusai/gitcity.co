import test from 'node:test';
import assert from 'node:assert/strict';
import { openStore } from '../server/store.mjs';
import { sourceLayout } from '../server/source-layout.mjs';
import { plannedLayout } from '../src/world/planned-layout.ts';

test('full inventory activation preserves legacy files and never allocates second addresses for directory detail', () => {
  const store = openStore(':memory:');
  try {
    const id = 'studio/city';
    const paths = Array.from({ length: 1000 }, (_, i) => `src/${String(i).padStart(4, '0')}.ts`);
    const file = (path) => ({ path, analysis: 'AST', symbols: 2, lines: 30 });
    const old = sourceLayout(store, id, paths.slice(0, 8).map(file), null);
    const full = { paths, complete: true, measurements: paths.slice(0, 8).map(file) };
    const active = sourceLayout(store, id, paths.slice(0, 8).map(file), full, 'ref');
    assert.deepEqual(
      active.files.map((f) => f.address),
      old.files.map((f) => f.address),
    );
    assert.ok(active.files.every((f) => !f.directoryLocated));
    const page = sourceLayout(store, id, paths.slice(8, 72).map(file), full, 'ref');
    assert.ok(page.files.every((f) => f.directoryLocated && f.address === undefined));
    assert.equal(
      store.db.prepare('SELECT COUNT(*) AS n FROM source_addresses WHERE repo=?').get(id).n,
      8,
    );
    assert.deepEqual(page.landPlan, active.landPlan);
    const data = {
      id,
      coordinates: store.locate(id),
      ...page,
      files: [...active.files, ...page.files],
    };
    const layout = plannedLayout(data);
    assert.equal(layout.parcels.length, 72);
    assert.equal(
      layout.regions.reduce((n, r) => n + r.unresolved.length, 0),
      928,
    );
    const cached = sourceLayout(store, id, [file(paths[50])], null);
    assert.equal(cached.files[0].directoryLocated, true);
    assert.equal(cached.sourceInventory.complete, false);
    assert.deepEqual(
      plannedLayout({ ...data, ...cached }).parcels[0].front,
      layout.parcels.find((p) => p.file.path === paths[50]).front,
    );
  } finally {
    store.db.close();
  }
});

test('a new repo puts initial source detail directly into inventory plots', () => {
  const store = openStore(':memory:');
  try {
    const paths = ['src/a.ts', 'src/b.ts'];
    const layout = sourceLayout(
      store,
      'new/city',
      [{ path: paths[0], analysis: 'AST' }],
      { paths, complete: true },
      'ref',
    );
    assert.equal(layout.files[0].directoryLocated, true);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS n FROM source_addresses').get().n, 0);
    assert.equal(
      plannedLayout({ id: 'new/city', coordinates: store.locate('new/city'), ...layout }).parcels
        .length,
      1,
    );
  } finally {
    store.db.close();
  }
});
