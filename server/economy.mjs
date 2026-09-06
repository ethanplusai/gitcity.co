import { github, repoData } from './github.mjs';
import { acceptPullRequest } from './accepted-work.mjs';
/** Recursively partition time so GitHub's 1,000-result search cap cannot silently drop history. */
export async function* mergedHistory(login, token, from, to) {
  const query = `is:pr is:merged author:${login} merged:${new Date(from).toISOString()}..${new Date(to).toISOString()}`;
  const first = await github(`/search/issues?q=${encodeURIComponent(query)}&per_page=100`, token);
  if (first.incomplete_results)
    throw new Error(
      'GitHub returned incomplete history. Your verified progress is saved; restore again to continue.',
    );
  if (first.total_count > 1000) {
    if (to - from < 1000)
      throw new Error(
        'This history interval exceeds GitHub’s search limit. Verified progress is saved.',
      );
    const mid = Math.floor((from + to) / 2);
    yield* mergedHistory(login, token, from, mid);
    yield* mergedHistory(login, token, mid + 1, to);
    return;
  }
  yield* first.items;
  for (let page = 2; page <= Math.ceil(first.total_count / 100); page++) {
    const result = await github(
      `/search/issues?q=${encodeURIComponent(query)}&per_page=100&page=${page}`,
      token,
    );
    if (result.incomplete_results)
      throw new Error('GitHub returned incomplete history. Please resume restoration.');
    yield* result.items;
  }
}
export async function restoreHistory(session, store, onProgress = () => {}) {
  const { login, token, createdAt } = session;
  let softTotal = 0,
    awarded = 0,
    scanned = 0;
  for (
    let year = new Date(createdAt).getUTCFullYear();
    year <= new Date().getUTCFullYear();
    year++
  ) {
    const from = `${year}-01-01T00:00:00Z`,
      to = new Date(Math.min(Date.parse(`${year}-12-31T23:59:59Z`), Date.now())).toISOString();
    const result = await github('/graphql', token, {
      method: 'POST',
      body: JSON.stringify({
        query:
          'query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){totalCommitContributions}}}',
        variables: { login, from, to },
      }),
    });
    if (result.errors)
      throw new Error(
        'GitHub could not restore contribution history. Your verified progress is saved.',
      );
    softTotal += result.data.user.contributionsCollection.totalCommitContributions;
    onProgress({ phase: `Reading ${year} contributions`, scanned, awarded });
  }
  store.creditSoft(login, softTotal);
  for await (const item of mergedHistory(login, token, Date.parse(createdAt), Date.now())) {
    const id = `pr:${item.id}`;
    if (store.db.prepare('SELECT id FROM ledger WHERE id=?').get(id)) continue;
    const [owner, repo] = item.repository_url.split('/').slice(-2);
    if (owner.toLowerCase() === login.toLowerCase()) continue;
    const result = await acceptPullRequest(
      session,
      store,
      { owner, repo, number: item.number },
      { github, repoData },
      item.id,
    );
    scanned++;
    awarded += result.awarded;
    onProgress({ phase: `Restoring ${result.repo} #${item.number}`, scanned, awarded });
  }
  return { awarded, scanned, softTotal, incomplete: false };
}
