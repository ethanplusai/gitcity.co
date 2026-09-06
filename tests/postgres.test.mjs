import { database } from './helpers/database.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate } from '../server/postgres.mjs';
import { createPostgresStore } from '../server/postgres-store.mjs';
import { openStore } from '../server/store.mjs';
import { runtimeState } from '../server/runtime-state.mjs';
import { syncJobs } from '../server/sync-jobs.mjs';
import { randomBytes } from 'node:crypto';
import { importWorld } from '../server/import-world.mjs';

test('PostgreSQL migrations, coordinate parity, concurrent rewards, durable auth and job resume', async () => {
  const db = await database(),
    local = openStore(':memory:');
  try {
    await migrate(db);
    await migrate(db);
    await importWorld(local.db, db);
    await assert.rejects(() => importWorld(local.db, db), /empty destination/);
    const a = await createPostgresStore(db),
      b = await createPostgresStore(db);
    const name = 'production-test/city';
    assert.deepEqual(await a.locate(name), local.locate(name));
    const [first, second] = await Promise.all([
      a.locate('production-test/neighbor'),
      b.locate('production-test/neighbor'),
    ]);
    assert.deepEqual(first, second);
    assert.notDeepEqual(first, await a.locate(name));
    const paths = ['src/a.ts', 'src/b.ts', 'docs/readme.md'];
    assert.deepEqual(await a.sourceLand(name, paths), local.sourceLand(name, paths));
    const files = paths.map((path) => ({ path, symbols: 3, complexity: 2 }));
    const inventory = await a.directoryInventory(name, paths, files, true);
    assert.deepEqual(inventory, local.directoryInventory(name, paths, files, true));
    assert.deepEqual(
      await a.inventoryLand(name, inventory.directories),
      local.inventoryLand(name, inventory.directories),
    );
    assert.deepEqual(
      await a.inventoryFiles(name, inventory.files),
      local.inventoryFiles(name, inventory.files),
    );
    assert.deepEqual(
      await a.inventoryBlockPaths(name, 'src', 0),
      local.inventoryBlockPaths(name, 'src', 0).map((row) => ({ ...row })),
    );
    await db.prepare('INSERT OR IGNORE INTO players(login) VALUES(?)').run('production-test');
    const work = {
      id: 'pr:production-test',
      login: 'production-test',
      amount: 100,
      repo: name,
      paths,
      pr: 1,
      dependencies: ['upstream/library'],
    };
    const credits = await Promise.all([a.acceptWork(work), b.acceptWork(work)]);
    assert.equal(credits.filter((x) => x > 0).length, 1);
    await Promise.all([a.creditSoft('production-test', 100), b.creditSoft('production-test', 100)]);
    assert.equal(
      (await db.prepare('SELECT soft FROM players WHERE login=?').get('production-test')).soft,
      100,
    );
    const purchases = await Promise.allSettled([
      a.purchase('production-test', name, 'amber'),
      b.purchase('production-test', name, 'amber'),
    ]);
    assert.equal(purchases.filter((x) => x.status === 'fulfilled').length, 1);
    assert.equal(
      (await db.prepare('SELECT soft FROM players WHERE login=?').get('production-test')).soft,
      80,
    );
    const query = db.query;
    db.query = async (sql, values) => {
      if (sql.startsWith('INSERT INTO directory_addresses'))
        throw new Error('Simulated write failure');
      return query(sql, values);
    };
    await assert.rejects(
      () => a.directoryInventory('rollback-test/city', ['src/a.ts']),
      /Simulated write failure/,
    );
    db.query = query;
    assert.equal(
      (
        await db
          .prepare('SELECT COUNT(*) AS n FROM directory_regions WHERE repo=?')
          .get('rollback-test/city')
      ).n,
      0,
    );
    const largePaths = Array.from({ length: 1200 }, (_, i) => `src/file-${i}.ts`);
    assert.equal(
      (await a.directoryInventory('batch-test/city', largePaths)).directories[0].count,
      1200,
    );
    assert.equal(
      (await b.directoryInventory('batch-test/city', largePaths)).directories[0].capacity,
      1200,
    );
    const key = randomBytes(32).toString('base64'),
      r1 = runtimeState(db, key),
      r2 = runtimeState(db, key);
    const session = {
      login: 'production-test',
      token: 'test-private-token',
      expires: Date.now() + 60000,
      createdAt: new Date().toISOString(),
    };
    await r1.sessions.set('session-test', session);
    assert.deepEqual(await r2.sessions.get('session-test'), session);
    const encrypted = await db
      .prepare('SELECT payload FROM sessions WHERE id=?')
      .get('session-test');
    assert.equal(encrypted.payload.includes(session.token), false);
    await r1.oauthStates.set('state-test', { ...session, binding: 'test' });
    const consumed = await Promise.all([
      r1.oauthStates.take('state-test'),
      r2.oauthStates.take('state-test'),
    ]);
    assert.equal(consumed.filter(Boolean).length, 1);
    await r2.sessions.delete('session-test');
    assert.equal(await r1.sessions.get('session-test'), undefined);
    let loads = 0;
    assert.deepEqual(
      await r1.cached('test-cache', 60000, async () => {
        loads++;
        return { city: true };
      }),
      { city: true },
    );
    assert.deepEqual(
      await r2.cached('test-cache', 60000, async () => {
        loads++;
        return { city: false };
      }),
      { city: true },
    );
    assert.equal(loads, 1);
    let concurrentLoads = 0;
    const loader = async () => {
      concurrentLoads++;
      await new Promise((r) => setTimeout(r, 100));
      return { shared: true };
    };
    assert.deepEqual(
      await Promise.all([
        r1.cached('concurrent-cache', 60000, loader),
        r2.cached('concurrent-cache', 60000, loader),
      ]),
      [{ shared: true }, { shared: true }],
    );
    assert.equal(concurrentLoads, 1);
    assert.equal(await r1.allow('limit-test', 1), true);
    assert.equal(await r2.allow('limit-test', 1), false);

    const dependencies = {
      github: async (path) =>
        path === '/graphql'
          ? { data: { user: { contributionsCollection: { totalCommitContributions: 100 } } } }
          : { items: [], total_count: 0, incomplete_results: false },
    };
    const j1 = syncJobs(a, dependencies),
      j2 = syncJobs(b, dependencies);
    assert.equal((await j1.step(session)).running, true);
    assert.equal((await j2.step(session)).running, true);
    assert.equal((await j1.step(session)).running, false);
    assert.equal((await j2.get(session.login)).phase, 'History restored');
  } finally {
    local.db.close();
    await db.close();
  }
});
