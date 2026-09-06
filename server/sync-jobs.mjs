import { randomUUID } from 'node:crypto';
import { github, repoData } from './github.mjs';
import { acceptPullRequest } from './accepted-work.mjs';
const publicJob = (state) => ({
  running: state.running,
  phase: state.phase,
  scanned: state.scanned,
  awarded: state.awarded,
  error: state.error || null,
});
export function syncJobs(store, dependencies = { github, repoData }) {
  const { db } = store;
  async function get(login) {
    const row = await db.prepare('SELECT state FROM sync_jobs WHERE login=?').get(login);
    return row
      ? publicJob(JSON.parse(row.state))
      : { running: false, phase: 'Ready to restore history', scanned: 0, awarded: 0 };
  }
  async function step(session, restart = false) {
    const { login, token, createdAt } = session,
      now = Date.now(),
      lease = randomUUID();
    const initial = {
      running: true,
      phase: 'Restoring contribution history',
      scanned: 0,
      awarded: 0,
      softTotal: 0,
      year: new Date(createdAt).getUTCFullYear(),
      until: now,
      windows: [{ from: Date.parse(createdAt), to: now, page: 1 }],
      pending: [],
    };
    await db
      .prepare('INSERT OR IGNORE INTO sync_jobs(login,state,lease_until) VALUES(?,?,0)')
      .run(login, JSON.stringify(initial));
    const row = await db
      .prepare(
        'UPDATE sync_jobs SET lease=?,lease_until=? WHERE login=? AND lease_until<? RETURNING state',
      )
      .get(lease, now + 360000, login, now);
    if (!row) return get(login);
    const previous = JSON.parse(row.state);
    const state = restart && !previous.running ? initial : previous;
    try {
      if (!state.running) return publicJob(state);
      state.error = null;
      const endYear = new Date(state.until).getUTCFullYear();
      if (state.year <= endYear) {
        const from = `${state.year}-01-01T00:00:00Z`,
          to = new Date(
            Math.min(Date.parse(`${state.year}-12-31T23:59:59Z`), state.until),
          ).toISOString();
        const result = await dependencies.github('/graphql', token, {
          method: 'POST',
          body: JSON.stringify({
            query:
              'query($login:String!,$from:DateTime!,$to:DateTime!){user(login:$login){contributionsCollection(from:$from,to:$to){totalCommitContributions}}}',
            variables: { login, from, to },
          }),
        });
        const count = result.data?.user?.contributionsCollection?.totalCommitContributions;
        if (result.errors || !Number.isSafeInteger(count) || count < 0)
          throw new Error('Contribution history is temporarily unavailable.');
        state.softTotal += count;
        state.phase = `Read ${state.year++} contributions`;
        if (state.year > endYear) await store.creditSoft(login, state.softTotal);
      } else if (state.pending.length) {
        const item = state.pending[0],
          [owner, repo] = item.repository_url.split('/').slice(-2);
        const result = await acceptPullRequest(
          session,
          store,
          { owner, repo, number: item.number },
          dependencies,
          item.id,
        );
        state.pending.shift();
        state.scanned++;
        state.awarded += result.awarded;
        state.phase = `Verified ${owner}/${repo} #${item.number}`;
      } else if (state.windows.length) {
        const window = state.windows[0];
        const q = `is:pr is:merged author:${login} merged:${new Date(window.from).toISOString()}..${new Date(window.to).toISOString()}`;
        const result = await dependencies.github(
          `/search/issues?q=${encodeURIComponent(q)}&per_page=30&page=${window.page}`,
          token,
        );
        if (result.incomplete_results)
          throw new Error('GitHub returned incomplete history. Please resume shortly.');
        if (result.total_count > 1000) {
          if (window.to - window.from < 1000)
            throw new Error('This history interval exceeds GitHub’s search limit.');
          const mid = Math.floor((window.from + window.to) / 2);
          state.windows.splice(
            0,
            1,
            { from: window.from, to: mid, page: 1 },
            { from: mid + 1, to: window.to, page: 1 },
          );
        } else {
          state.pending = result.items.map(({ id, number, repository_url }) => ({
            id,
            number,
            repository_url,
          }));
          if (window.page * 30 >= result.total_count) state.windows.shift();
          else window.page++;
        }
        state.phase = 'Reading merged contributions';
      } else {
        state.running = false;
        state.phase = 'History restored';
      }
      await db
        .prepare('UPDATE sync_jobs SET state=? WHERE login=? AND lease=?')
        .run(JSON.stringify(state), login, lease);
      return publicJob(state);
    } catch (error) {
      // Keep the work item and running state so another request can retry it.
      state.error =
        error.status === 403 || error.status === 429
          ? 'GitHub rate limit reached. Resume restoration after it resets.'
          : 'Restoration paused. Your verified progress is saved; resume to retry.';
      state.phase = 'Restoration paused';
      await db
        .prepare('UPDATE sync_jobs SET state=? WHERE login=? AND lease=?')
        .run(JSON.stringify(state), login, lease);
      return { ...publicJob(state), running: false };
    } finally {
      await db
        .prepare('UPDATE sync_jobs SET lease=NULL,lease_until=0 WHERE login=? AND lease=?')
        .run(login, lease);
    }
  }
  return { get, step };
}
