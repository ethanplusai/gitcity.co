import test from 'node:test';
import assert from 'node:assert/strict';
import { hash, random, coordinates, building, parseRoute, reward } from '../shared/model.mjs';
import { ownersForPath, allocateReward } from '../shared/governance.mjs';
import { analyze } from '../server/analyze.mjs';
import { dominantTimezone } from '../server/github.mjs';
import { openStore } from '../server/store.mjs';
test('world and building generation is repeatable and independent of traversal order', () => {
  const a = coordinates('acme/compiler');
  coordinates('another/repo');
  assert.deepEqual(coordinates('acme/compiler'), a);
  const source = { path: 'src/parser.ts', symbols: 12, complexity: 9 };
  assert.deepEqual(building(source), building(source));
  assert.notDeepEqual(building(source), building({ ...source, path: 'src/parser2.ts' }));
  assert.ok(building({ ...source, symbols: 100 }).height > building(source).height);
  assert.equal(hash('react'), hash('react'));
  assert.deepEqual(
    Array.from({ length: 4 }, random('seed')),
    Array.from({ length: 4 }, random('seed')),
  );
});
test('URL grammar covers world, owner, repo and encoded file paths', () => {
  assert.equal(parseRoute('/').level, 'world');
  assert.deepEqual(parseRoute('/acme'), { level: 'owner', owner: 'acme' });
  assert.equal(parseRoute('/acme/repo').level, 'repo');
  assert.equal(parseRoute('/acme/repo/src/hello%20world.ts').file, 'src/hello world.ts');
});
test('AST metrics come from syntax, not keywords in comments or strings', () => {
  const source = `// if class while for\nimport x from 'react';\nconst label='function if class';\nexport function f(a:number){if(a>0)return a;return 0;}\nconst other=()=>3;`;
  const result = analyze('src/file.ts', source);
  assert.equal(result.symbols, 2);
  assert.equal(result.complexity, 1);
  assert.deepEqual(result.imports, ['react']);
  assert.equal(result.analysis, 'TypeScript AST');
  assert.equal(analyze('main.rs', 'pub fn main() { if true {} }').analysis, 'lexical');
});
test('structure cannot come from self-merged, own, unmerged or bot-merged work', () => {
  const pr = { merged: true, author: 'alice', owner: 'project', mergedBy: 'bob' };
  assert.ok(reward(pr, 'alice', 100) > 0);
  for (const change of [
    { merged: false },
    { owner: 'ALICE' },
    { mergedBy: 'Alice' },
    { mergedBy: null },
    { author: 'other' },
    { mergerIsBot: true },
  ])
    assert.equal(reward({ ...pr, ...change }, 'alice', 100), 0);
  assert.ok(reward(pr, 'alice', 1000) > reward(pr, 'alice', 10));
});
test('CODEOWNERS applies path scopes and last matching ownership, including empty override', () => {
  const text = '* @global\n/src/ @source\n*.ts @typescript\n/src/private/\n/docs/**/guide.md @docs';
  assert.deepEqual(ownersForPath(text, 'README.md'), ['@global']);
  assert.deepEqual(ownersForPath(text, 'src/a.js'), ['@source']);
  assert.deepEqual(ownersForPath(text, 'src/a.ts'), ['@typescript']);
  assert.deepEqual(ownersForPath(text, 'src/private/a.ts'), []);
  assert.deepEqual(ownersForPath(text, 'docs/nested/guide.md'), ['@docs']);
  assert.deepEqual(ownersForPath(text, 'docs/guide.md'), ['@docs']);
});
test('upstream allocation conserves credits and deduplicates dependency highways', () => {
  const split = allocateReward(57, ['b/repo', 'a/repo', 'b/repo', null]);
  assert.equal(split.personal + split.upstream.reduce((n, d) => n + d.amount, 0), 57);
  assert.equal(split.upstream.length, 2);
  assert.deepEqual(allocateReward(9, []), { personal: 9, upstream: [] });
});
test('timezone comes from observed offsets, with unavailable kept unknown', () => {
  assert.equal(
    dominantTimezone([
      'Date: Mon, 1 Sep 2025 12:00:00 -0430',
      'Date: Tue, 2 Sep 2025 13:00:00 -0430',
      'Date: Wed, 3 Sep 2025 10:00:00 +0200',
    ]),
    -270,
  );
  assert.equal(dominantTimezone([null, 'no date']), null);
});
test('ledger survives repeated imports, preserves ownership and cannot overspend', () => {
  const store = openStore(':memory:');
  store.db.prepare('INSERT INTO players(login) VALUES(?)').run('alice');
  store.creditSoft('alice', 50);
  store.creditSoft('alice', 50);
  assert.equal(store.db.prepare('SELECT soft FROM players').get().soft, 50);
  store.purchase('alice', 'org/repo', 'amber');
  assert.equal(store.db.prepare('SELECT soft FROM players').get().soft, 30);
  store.creditSoft('alice', 55);
  assert.equal(store.db.prepare('SELECT soft FROM players').get().soft, 35);
  assert.throws(() => store.purchase('alice', 'org/repo', 'amber'), /already own/);
  assert.throws(() => store.purchase('alice', 'org/repo', 'pavilion'), /enough/);
  const work = {
    id: 'pr:1',
    login: 'alice',
    repo: 'org/repo',
    amount: 100,
    pr: 12,
    paths: ['src/a.ts'],
    dependencies: ['dep/core'],
  };
  assert.equal(store.acceptWork(work), 90);
  assert.equal(store.acceptWork(work), 0);
  assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, 90);
  assert.equal(store.db.prepare('SELECT balance FROM treasury').get().balance, 10);
  assert.equal(store.db.prepare('SELECT login FROM ownership').get().login, 'alice');
  store.purchase('alice', 'org/repo', 'pavilion');
  assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, 40);
  assert.throws(() => store.purchase('alice', 'other/repo', 'pavilion'));
  assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, 40);
  store.db.close();
});

test('permanent coordinates resolve collisions and never relocate a visited city', () => {
  const store = openStore(':memory:');
  const first = store.locate('new/project');
  const again = store.locate('new/project');
  assert.deepEqual(first, again);
  const other = store.locate('new/another');
  assert.ok(Math.abs(first.x - other.x) >= 38 || Math.abs(first.z - other.z) >= 38);
  assert.deepEqual(store.locate('facebook/react'), store.locateOwner('facebook'));
  assert.ok(
    Math.hypot(first.x - store.locateOwner('new').x, first.z - store.locateOwner('new').z) < 100,
  );
  const org = store.locateOwner('another-org');
  assert.ok(Math.abs(first.x - org.x) >= 640 || Math.abs(first.z - org.z) >= 640);
  store.db.close();
});
test('community structures consume earned treasury funds exactly once', () => {
  const store = openStore(':memory:');
  assert.throws(() => store.buildCivic('upstream/repo'), /50 earned/);
  store.db.prepare('INSERT INTO treasury(repo,balance) VALUES(?,?)').run('upstream/repo', 80);
  store.buildCivic('upstream/repo');
  assert.equal(store.db.prepare('SELECT balance FROM treasury').get().balance, 30);
  assert.throws(() => store.buildCivic('upstream/repo'), /already stands/);
  assert.equal(store.db.prepare('SELECT balance FROM treasury').get().balance, 30);
  store.db.close();
});
