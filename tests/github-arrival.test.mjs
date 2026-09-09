import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { repoData, sourceInventory } from '../server/github.mjs';

test('renamed repo retains its canonical inventory and source analysis overlaps history without registry or patch requests', async (t) => {
  const source = 'export function greet(name: string) { return name ? name : "hello"; }\n';
  const sha = createHash('sha1')
    .update(`blob ${Buffer.byteLength(source)}\0`)
    .update(source)
    .digest('hex');
  const commit = {
    sha: 'revision',
    commit: {
      message: 'Initial',
      committer: { date: '2026-09-01T12:00:00Z' },
      author: { name: 'Author' },
    },
    author: { login: 'author' },
  };
  let releaseHistory;
  const historyGate = new Promise((resolve) => {
    releaseHistory = resolve;
  });
  let sourceRead = false;
  const urls = [];
  t.mock.method(globalThis, 'fetch', async (input) => {
    const url = new URL(input);
    urls.push(url.href);
    const json = (data) => new Response(JSON.stringify(data), { status: 200 });
    if (url.hostname === 'raw.githubusercontent.com') {
      sourceRead = true;
      return new Response(source);
    }
    if (url.pathname === '/repos/arrival-old/repo')
      return json({
        full_name: 'arrival-new/repo',
        name: 'repo',
        private: false,
        default_branch: 'main',
      });
    if (url.pathname.endsWith('/git/trees/revision'))
      return json({
        truncated: false,
        tree: [{ path: 'src/main.ts', type: 'blob', size: source.length, sha }],
      });
    if (url.pathname.endsWith('/commits')) return json([commit]);
    if (url.pathname.endsWith('/commits/revision')) {
      await historyGate;
      return json({ ...commit, files: [{ filename: 'src/main.ts' }] });
    }
    if (url.pathname.endsWith('/status')) return json({ total_count: 0 });
    if (url.pathname.endsWith('/check-runs')) return json({ check_runs: [] });
    if (url.pathname.endsWith('/issues') || url.pathname.endsWith('/pulls')) return json([]);
    throw Error(`Unexpected request: ${url}`);
  });
  const pending = repoData('arrival-old', 'repo');
  try {
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(sourceRead, true, 'source parsing must begin before slow commit history finishes');
  } finally {
    releaseHistory();
  }
  const repo = await pending;
  assert.equal(repo.id, 'arrival-new/repo');
  assert.ok(repo.files[0].symbols > 0);
  assert.equal(repo.files[0].lastCommit, commit.commit.committer.date);
  assert.deepEqual(sourceInventory(repo.id, repo.ref).paths, ['src/main.ts']);
  assert.equal(sourceInventory(repo.id, repo.ref).complete, true);
  assert.equal(
    urls.some((url) => url.includes('.patch') || url.includes('npmjs.org')),
    false,
  );
});
