import test from 'node:test';
import assert from 'node:assert/strict';
import { sourcePage, mergeSourceFiles } from '../shared/source-pages.mjs';

test('directory pages reach beyond the former 256-file cutoff without skipping or duplicating source paths', () => {
  const all = Array.from({ length: 537 }, (_, i) => ({ path: `src/module-${i}.ts` }));
  all.push({ path: 'docs/index.md' });
  let cursor = '',
    seen = [];
  do {
    const page = sourcePage([...all].reverse(), 'sha-one', 'src', cursor);
    assert.ok(page.files.length <= 64);
    assert.equal(page.total, 537);
    seen.push(...page.files);
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(seen.length, 537);
  assert.equal(new Set(seen.map((f) => f.path)).size, 537);
});

test('a source cursor cannot silently cross snapshots or directories', () => {
  const files = Array.from({ length: 70 }, (_, i) => ({ path: `src/${i}.ts` }));
  const cursor = sourcePage(files, 'sha-one', 'src').nextCursor;
  assert.throws(() => sourcePage(files, 'sha-two', 'src', cursor), { status: 409 });
  assert.throws(() => sourcePage(files, 'sha-one', 'other', cursor), { status: 400 });
  assert.throws(() => sourcePage(files, 'sha-one', 'src', 'bad'), { status: 400 });
});

test('incremental detail retains earlier directories and refreshes duplicate paths without losing history', () => {
  const existing = Array.from({ length: 300 }, (_, i) => ({ path: `other/${i}.ts` }));
  existing.push({ path: 'src/a.ts', lines: 3, contributor: 'person' });
  const merged = mergeSourceFiles(existing, [
    { path: 'src/a.ts', lines: 4 },
    { path: 'src/b.ts', lines: 8 },
  ]);
  assert.equal(merged.length, 302);
  assert.deepEqual(
    merged.find((f) => f.path === 'src/a.ts'),
    { path: 'src/a.ts', lines: 4, contributor: 'person' },
  );
  assert.deepEqual(merged.slice(0, 300), existing.slice(0, 300));
});

test('a changed blob cannot inherit stale analysis or latest-contributor metadata', () => {
  assert.deepEqual(
    mergeSourceFiles(
      [{ path: 'a.ts', sha: 'old', contributor: 'old-person', lines: 20 }],
      [{ path: 'a.ts', sha: 'new', analysis: 'unavailable' }],
    ),
    [{ path: 'a.ts', sha: 'new', analysis: 'unavailable' }],
  );
});
