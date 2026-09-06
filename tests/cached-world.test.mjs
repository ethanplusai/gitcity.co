import test from 'node:test';
import assert from 'node:assert/strict';
import { publicSnapshotAllowed } from '../server/cached-world.mjs';
const publicHTML = '<meta name="octolytics-dimension-repository_public" content="true" />';
test('quota fallback requires positive public evidence and a confirmed missing opt-out marker', async () => {
  for (const [html, status, expected] of [
    [publicHTML, 404, true],
    [publicHTML, 200, false],
    [publicHTML, 403, false],
    ['<html>Sign in</html>', 404, false],
    [publicHTML + '<a href="/topics/gitcity-opt-out">opt out</a>', 404, false],
  ]) {
    const fetcher = async (url) =>
      String(url).includes('raw.githubusercontent')
        ? new Response(null, { status })
        : new Response(html);
    assert.equal(await publicSnapshotAllowed('test/repo', fetcher), expected);
  }
  assert.equal(
    await publicSnapshotAllowed('test/repo', async () => {
      throw new Error('offline');
    }),
    false,
  );
});
