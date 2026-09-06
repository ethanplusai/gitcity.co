import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';
import { plannedLayout } from '../src/world/planned-layout.ts';

test('source addresses survive store reopen, independent browser samples and source disappearance', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gitcity-addresses-'));
  const path = join(directory, 'city.sqlite');
  let store = openStore(path);
  try {
    const initial = store.sourceLand('test/city', ['src/z.ts', 'src/a.ts']);
    const expanded = store.sourceLand('test/city', ['src/m.ts', 'src/z.ts']);
    assert.equal(initial.addresses['src/z.ts'], expanded.addresses['src/z.ts']);
    const position = (land, paths) =>
      plannedLayout({
        id: 'test/city',
        coordinates: land.landPlan.anchor,
        landPlan: land.landPlan,
        files: paths.map((path) => ({
          path,
          address: land.addresses[path],
          lines: 100,
          analysis: 'AST',
        })),
      }).parcels.map((p) => ({ path: p.file.path, x: p.x, z: p.z }));
    const before = position(expanded, ['src/z.ts', 'src/m.ts']);
    store.db.close();
    store = openStore(path);
    // Visiting other files must not recycle a temporarily absent source's lot.
    store.sourceLand(
      'test/city',
      Array.from({ length: 100 }, (_, i) => `new/${i}.ts`),
    );
    const returning = store.sourceLand('test/city', ['src/m.ts', 'src/z.ts']);
    assert.deepEqual(returning.addresses, expanded.addresses);
    assert.deepEqual(position(returning, ['src/m.ts', 'src/z.ts']), before);
    const alone = position(store.sourceLand('test/city', ['src/z.ts']), ['src/z.ts'])[0];
    assert.deepEqual(
      alone,
      before.find((p) => p.path === 'src/z.ts'),
    );
    assert.equal(
      store.db
        .prepare('SELECT COUNT(*) AS count FROM source_addresses WHERE repo=?')
        .get('test/city').count,
      103,
    );
  } finally {
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
