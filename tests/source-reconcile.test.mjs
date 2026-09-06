import test from 'node:test';
import assert from 'node:assert/strict';
import { partitionSourceSnapshot, reconcileSourceFiles } from '../shared/source-reconcile.mjs';

test('a new commit preserves verified expanded sources, refreshes changed blobs and removes deleted files', () => {
  const previous = [
    { path: 'src/a.ts', sha: 'same', lines: 200, analysis: 'AST' },
    { path: 'src/b.ts', sha: 'old', lines: 40, contributor: 'old-person' },
    { path: 'src/removed.ts', sha: 'deleted' },
  ];
  const partition = partitionSourceSnapshot(previous, [
    { path: 'src/a.ts', sha: 'same' },
    { path: 'src/b.ts', sha: 'new' },
  ]);
  assert.deepEqual(partition.unchanged, ['src/a.ts']);
  assert.deepEqual(partition.removed, ['src/removed.ts']);
  assert.deepEqual(partition.changed, [{ path: 'src/b.ts', sha: 'new' }]);
  const files = reconcileSourceFiles(
    previous,
    [{ path: 'index.ts', sha: 'initial', lines: 3 }],
    [{ ...partition, files: [{ path: 'src/b.ts', sha: 'new', lines: 42 }] }],
  );
  assert.deepEqual(files, [
    previous[0],
    { path: 'src/b.ts', sha: 'new', lines: 42 },
    { path: 'index.ts', sha: 'initial', lines: 3 },
  ]);
});

test('an incomplete Git tree cannot be treated as evidence of source deletion', () => {
  const known = [{ path: 'src/a.ts', sha: 'a' }];
  assert.throws(() => partitionSourceSnapshot(known, [], true), { status: 503 });
  assert.deepEqual(partitionSourceSnapshot(known, known, true), {
    unchanged: ['src/a.ts'],
    removed: [],
    changed: [],
  });
});

test('expanded sources without blob evidence must be re-analyzed, never assumed unchanged', () => {
  const result = partitionSourceSnapshot(
    [{ path: 'a.ts', lines: 1 }],
    [{ path: 'a.ts', sha: 'verified' }],
  );
  assert.deepEqual(result.unchanged, []);
  assert.deepEqual(result.changed, [{ path: 'a.ts', sha: 'verified' }]);
});
