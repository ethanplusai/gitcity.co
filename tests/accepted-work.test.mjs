import test from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { acceptPullRequest, pullRequestAddress } from '../server/accepted-work.mjs';
import { openStore } from '../server/store.mjs';

function fixture(options = {}) {
  const store = openStore(options.path || ':memory:');
  store.db.prepare('INSERT OR IGNORE INTO players(login) VALUES(?)').run('alice');
  const pr = {
    merged: true,
    user: { login: 'alice' },
    merged_by: { login: 'maintainer', type: 'User' },
    ...options.pr,
  };
  const meta = {
    full_name: 'org/repo',
    owner: { type: 'Organization' },
    stargazers_count: 100,
    private: false,
    topics: [],
    ...options.meta,
  };
  const services = {
    github: async (path) => {
      if (path.endsWith('/pulls/12')) return pr;
      if (path === '/repos/org/repo') return meta;
      if (path.includes('/memberships/')) {
        if (options.membershipError)
          throw Object.assign(new Error('Membership unavailable'), {
            status: options.membershipError,
          });
        return { role: options.admin ? 'admin' : 'member' };
      }
      if (path.endsWith('/issues/12')) return { id: 345 };
      if (path.includes('/files?'))
        return [
          { filename: 'src/a.ts', status: 'modified' },
          { filename: 'removed.ts', status: 'removed' },
        ];
      throw new Error(`Unexpected ${path}`);
    },
    repoData: async () => {
      if (options.optOutFile) throw new Error('Repository opted out');
      return { dependencies: [{ repo: 'dep/core' }] };
    },
  };
  return {
    store,
    services,
    run: (id) =>
      acceptPullRequest(
        { login: 'alice', token: 'fixture' },
        store,
        { owner: 'org', repo: 'repo', number: 12 },
        services,
        id,
      ),
  };
}

test('targeted acceptance and history import share one atomic reward identity', async () => {
  const { store, run } = fixture();
  try {
    const result = await run();
    assert.equal(result.reason, 'accepted');
    assert.ok(result.awarded > 0);
    assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, result.awarded);
    assert.equal(store.db.prepare('SELECT path FROM ownership').get().path, 'src/a.ts');
    assert.equal(store.db.prepare('SELECT item FROM possessions').get().item, 'resident');
    assert.ok(store.db.prepare('SELECT balance FROM treasury').get().balance > 0);
    assert.equal((await run(345)).reason, 'already_recorded');
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM ledger').get().n, 1);
    assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, result.awarded);
  } finally {
    store.db.close();
  }
});

test('ineligible and unverifiable pull requests cannot mint credits or recognition', async () => {
  for (const options of [
    { pr: { merged: false } },
    { pr: { user: { login: 'other' } } },
    { pr: { merged_by: { login: 'alice', type: 'User' } } },
    { pr: { merged_by: { login: 'robot', type: 'Bot' } } },
    { pr: { merged_by: { login: 'unknown' } } },
    { pr: { merged_by: { login: 'migration', type: 'Mannequin' } } },
    { admin: true },
    { meta: { private: true } },
    { meta: { topics: ['gitcity-opt-out'] } },
    { optOutFile: true },
    { membershipError: 403 },
    { meta: { full_name: 'alice/renamed' } },
  ]) {
    const { store, run } = fixture(options);
    try {
      try {
        const result = await run();
        assert.notEqual(result.reason, 'accepted');
      } catch (error) {
        assert.match(error.message, /opted out|Membership unavailable/);
      }
      assert.equal(store.db.prepare('SELECT count(*) AS n FROM ledger').get().n, 0);
      assert.equal(store.db.prepare('SELECT count(*) AS n FROM ownership').get().n, 0);
    } finally {
      store.db.close();
    }
  }
});

test('PR address parser confines verification to GitHub repository pull endpoints', () => {
  assert.deepEqual(pullRequestAddress('https://github.com/org/repo/pull/12#discussion'), {
    owner: 'org',
    repo: 'repo',
    number: 12,
  });
  for (const url of [
    'http://github.com/org/repo/pull/12',
    'https://github.com.evil.test/org/repo/pull/12',
    'https://user@github.com/org/repo/pull/12',
    'https://github.com/org/repo/issues/12',
    'https://github.com/org/repo/pull/9007199254740993',
    'https://localhost/private',
  ])
    assert.throws(() => pullRequestAddress(url));
});

test('concurrent targeted verification and history restoration credit a merge once', async () => {
  const { store, run } = fixture();
  try {
    const results = await Promise.all([run(), run(345)]);
    assert.deepEqual(results.map((r) => r.reason).sort(), ['accepted', 'already_recorded']);
    const credited = results.reduce((n, r) => n + r.awarded, 0);
    assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, credited);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM ledger').get().n, 1);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM ownership').get().n, 1);
    const treasury = store.db.prepare('SELECT balance FROM treasury').get().balance;
    await run();
    assert.equal(store.db.prepare('SELECT balance FROM treasury').get().balance, treasury);
  } finally {
    store.db.close();
  }
});

test('interrupted file pagination leaves no reward and retry attributes every fetched surviving path', async () => {
  const { store, services, run } = fixture();
  const github = services.github;
  let fail = true;
  services.github = async (path) => {
    if (path.includes('/files?')) {
      if (path.endsWith('page=1'))
        return Array.from({ length: 100 }, (_, i) => ({
          filename: `src/${i}.ts`,
          status: 'modified',
        }));
      if (fail) throw Object.assign(new Error('GitHub rate limit'), { status: 429 });
      return [
        { filename: 'src/final.ts', status: 'added' },
        { filename: 'src/deleted.ts', status: 'removed' },
      ];
    }
    return github(path);
  };
  try {
    await assert.rejects(run(), /rate limit/);
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM ledger').get().n, 0);
    assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, 0);
    fail = false;
    assert.equal((await run()).reason, 'accepted');
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM ownership').get().n, 101);
    assert.equal(
      store.db.prepare("SELECT path FROM ownership WHERE path='src/deleted.ts'").get(),
      undefined,
    );
  } finally {
    store.db.close();
  }
});

test('recognition write failure rolls back currency, residency and ledger before a safe retry', async () => {
  const { store, run } = fixture();
  try {
    store.db.exec(
      "CREATE TRIGGER fail_recognition BEFORE INSERT ON ownership BEGIN SELECT RAISE(ABORT, 'recognition unavailable'); END;",
    );
    await assert.rejects(run(), /recognition unavailable/);
    for (const table of ['ledger', 'possessions', 'ownership', 'treasury'])
      assert.equal(store.db.prepare(`SELECT count(*) AS n FROM ${table}`).get().n, 0);
    assert.equal(store.db.prepare('SELECT hard FROM players').get().hard, 0);
    store.db.exec('DROP TRIGGER fail_recognition');
    assert.equal((await run()).reason, 'accepted');
    assert.equal(store.db.prepare('SELECT count(*) AS n FROM ownership').get().n, 1);
  } finally {
    store.db.close();
  }
});

test('verified credits and attribution survive reopening the local database', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'gitcity-acceptance-'));
  const path = join(dir, 'world.sqlite');
  let opened;
  try {
    opened = fixture({ path });
    const first = await opened.run();
    opened.store.db.close();
    opened = fixture({ path });
    assert.equal((await opened.run()).reason, 'already_recorded');
    assert.equal(opened.store.db.prepare('SELECT hard FROM players').get().hard, first.awarded);
    assert.equal(opened.store.db.prepare('SELECT login,repo,path,pr FROM ownership').get().pr, 12);
    assert.equal(opened.store.db.prepare('SELECT item FROM possessions').get().item, 'resident');
  } finally {
    opened?.store.db.close();
    await rm(dir, { recursive: true, force: true });
  }
});
