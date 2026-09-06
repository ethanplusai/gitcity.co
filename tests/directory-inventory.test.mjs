import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openStore } from '../server/store.mjs';

test('complete tree slots are independent of detail pages and survive deletion, growth and reopen', () => {
  const directory = mkdtempSync(join(tmpdir(), 'gitcity-inventory-'));
  const path = join(directory, 'world.sqlite');
  let store = openStore(path);
  try {
    const paths = Array.from(
      { length: 20000 },
      (_, i) => `src/file-${String(i).padStart(5, '0')}.ts`,
    );
    paths.push('README.md', 'lib/main.ts');
    const detail = (path) => ({ path, symbols: 4, complexity: 2, analysis: 'AST' });
    const first = store.directoryInventory('Test/City', paths, [detail(paths[100])], true);
    const src = first.directories.find((d) => d.name === 'src');
    assert.equal(src.count, 20000);
    assert.equal(src.capacity, 20000);
    assert.equal(src.blocks.length, 313);
    assert.equal(
      src.blocks.reduce((n, b) => n + b.count, 0),
      20000,
    );
    assert.equal(
      src.blocks.reduce((n, b) => n + b.parsed, 0),
      1,
    );
    assert.equal(
      src.blocks.reduce((n, b) => n + b.symbols, 0),
      4,
    );
    assert.ok(Buffer.byteLength(JSON.stringify(first)) < 45000);
    assert.equal(first.files.length, 1); // Full tree paths are not sent to phones.
    const slot = first.files[0].directoryAddress;
    const reserved = store.inventoryLand('test/city', first.directories);
    const page = store.directoryInventory(
      'test/city',
      [...paths].reverse(),
      [detail(paths[100]), detail(paths[19000])],
      true,
    );
    assert.equal(page.files[0].directoryAddress, slot);
    assert.equal(page.files[1].directoryAddress, 19000);
    const selected = store.inventoryBlockPaths('test/city', 'src', 100);
    assert.equal(selected.length, 64);
    assert.deepEqual(
      selected.map((file) => file.directoryAddress),
      Array.from({ length: 64 }, (_, i) => 6400 + i),
    );
    assert.ok(selected.every((file) => file.path.startsWith('src/')));
    assert.deepEqual(store.inventoryBlockPaths('different/city', 'src', 100), []);
    for (const invalid of [-1, 1.5, NaN, Infinity, 1000001])
      assert.throws(() => store.inventoryBlockPaths('test/city', 'src', invalid), { status: 400 });
    store.db.close();
    store = openStore(path);
    assert.deepEqual(store.inventoryLand('test/city', first.directories), reserved);
    const next = paths.filter((p) => p !== paths[100]);
    next.push('src/aaa-new.ts', 'a-new-directory/entry.ts');
    const changed = store.directoryInventory('test/city', next, [detail('src/aaa-new.ts')], true);
    assert.equal(changed.files[0].directoryAddress, 20000);
    assert.equal(changed.directories.find((d) => d.name === 'src').address, src.address);
    assert.equal(changed.directories.find((d) => d.name === 'src').capacity, 20001);
    const restored = store.directoryInventory(
      'test/city',
      [...next, paths[100]],
      [detail(paths[100])],
      true,
    );
    assert.equal(restored.files[0].directoryAddress, slot);
    const incomplete = store.directoryInventory(
      'test/city',
      [paths[100]],
      [detail(paths[100])],
      false,
    );
    assert.equal(incomplete.complete, false);
    assert.equal(incomplete.directories[0].count, 1);
    assert.equal(incomplete.directories[0].capacity, 20001);
  } finally {
    store.db.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('inventory surveying leaves existing city and file addresses unchanged', () => {
  const store = openStore(':memory:');
  try {
    const before = store.sourceLand('test/city', ['src/z.ts', 'src/a.ts']);
    store.directoryInventory(
      'test/city',
      Array.from({ length: 500 }, (_, i) => `src/${i}.ts`),
    );
    assert.deepEqual(store.sourceLand('test/city', ['src/z.ts', 'src/a.ts']), before);
    assert.equal(store.db.prepare('SELECT COUNT(*) AS count FROM source_addresses').get().count, 2);
  } finally {
    store.db.close();
  }
});
