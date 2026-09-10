import test from 'node:test';
import assert from 'node:assert/strict';
import { ownerDirectoryCache, ownerDirectoryPage } from '../server/owner-directory.mjs';

test('a directory page can be returned without reading the remaining organization', async () => {
  const calls = [];
  const page = await ownerDirectoryPage('large-org', async (path) => {
    calls.push(path);
    return Array.from({ length: 100 }, (_, index) => ({
      full_name: `large-org/repo-${index}`,
      private: index === 0,
    }));
  });
  assert.equal(calls.length, 1);
  assert.ok(calls[0].endsWith('page=1'));
  assert.equal(page.repos.length, 99);
  assert.equal(page.nextPage, 2);
  await assert.rejects(
    ownerDirectoryPage(
      'large-org',
      () => {
        throw Error('must not fetch');
      },
      -1,
    ),
    /Invalid directory page/,
  );
});
test('owner directory paginates, coalesces visitors, filters exclusions and retries failures', async () => {
  const cached = ownerDirectoryCache();
  let calls = 0;
  const load = async (path) => {
    calls++;
    return path.endsWith('page=1')
      ? Array.from({ length: 100 }, (_, i) => ({ full_name: `org/repo-${i}` }))
      : [
          { full_name: 'org/last' },
          { full_name: 'org/private', private: true },
          { full_name: 'org/optout', topics: ['gitcity-opt-out'] },
        ];
  };
  const [a, b] = await Promise.all([cached('org', load), cached('ORG', load)]);
  assert.equal(calls, 2);
  assert.equal(a, b);
  assert.equal(a.length, 101);
  await cached('org', load);
  assert.equal(calls, 2);
  await assert.rejects(
    cached('other', async () => {
      throw Error('offline');
    }),
  );
  assert.deepEqual(await cached('other', async () => []), []);
});
