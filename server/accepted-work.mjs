import { reward } from '../shared/model.mjs';
export function pullRequestAddress(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Paste a GitHub pull request URL.');
  }
  const match = url.pathname.match(/^\/([\w.-]+)\/([\w.-]+)\/pull\/([1-9]\d*)\/?$/);
  if (
    url.protocol !== 'https:' ||
    url.hostname !== 'github.com' ||
    url.port ||
    url.username ||
    url.password ||
    !match ||
    !Number.isSafeInteger(Number(match[3]))
  )
    throw new Error('Use a URL like https://github.com/owner/repo/pull/123.');
  return { owner: match[1], repo: match[2], number: Number(match[3]) };
}
// Shared by full-history restoration and targeted verification. Services are
// explicit so rejection and retry behavior can be tested without GitHub writes.
export async function acceptPullRequest(
  session,
  store,
  address,
  { github, repoData },
  knownIssueId,
) {
  const { login, token } = session;
  const { owner, repo, number } = address;
  const result = (reason, awarded = 0, city = `${owner}/${repo}`) => ({
    reason,
    awarded,
    repo: city,
    number,
  });
  const pr = await github(`/repos/${owner}/${repo}/pulls/${number}`, token);
  if (pr.user?.login?.toLowerCase() !== login.toLowerCase()) return result('not_author');
  if (!pr.merged) return result('not_merged');
  if (owner.toLowerCase() === login.toLowerCase()) return result('own_repository');
  if (
    !pr.merged_by ||
    pr.merged_by.type !== 'User' ||
    pr.merged_by.login.toLowerCase() === login.toLowerCase()
  )
    return result('not_human_acceptance');
  const meta = await github(`/repos/${owner}/${repo}`, token);
  const [canonicalOwner, canonicalRepo] = meta.full_name.split('/');
  if (canonicalOwner.toLowerCase() === login.toLowerCase()) return result('own_repository');
  if (meta.private || meta.topics?.includes('gitcity-opt-out')) return result('not_participating');
  if (meta.owner?.type === 'Organization') {
    try {
      const membership = await github(`/user/memberships/orgs/${canonicalOwner}`, token);
      if (membership.role === 'admin') return result('own_repository');
    } catch (error) {
      if (error.status !== 404) throw error;
    }
  }
  const issueId =
    knownIssueId ?? (await github(`/repos/${owner}/${repo}/issues/${number}`, token)).id;
  if (!Number.isSafeInteger(issueId) || issueId <= 0)
    throw new Error('GitHub did not return a valid contribution identity.');
  const id = `pr:${issueId}`;
  if (await store.db.prepare('SELECT id FROM ledger WHERE id=?').get(id))
    return result('already_recorded', 0, meta.full_name);
  const amount = reward(
    {
      merged: pr.merged,
      author: pr.user.login,
      owner: canonicalOwner,
      mergedBy: pr.merged_by.login,
      mergerIsBot: pr.merged_by.type === 'Bot',
    },
    login,
    meta.stargazers_count,
  );
  const city = await repoData(canonicalOwner, canonicalRepo);
  const paths = [];
  for (let page = 1; page <= 30; page++) {
    const files = await github(
      `/repos/${owner}/${repo}/pulls/${number}/files?per_page=100&page=${page}`,
      token,
    );
    paths.push(...files.filter((f) => f.status !== 'removed').map((f) => f.filename));
    if (files.length < 100) break;
  }
  const awarded = await store.acceptWork({
    id,
    login,
    amount,
    repo: meta.full_name,
    paths,
    pr: number,
    dependencies: city.dependencies.map((d) => d.repo).filter(Boolean),
  });
  return result(awarded ? 'accepted' : 'already_recorded', awarded, meta.full_name);
}
