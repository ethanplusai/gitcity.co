import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { analyze } from './analyze.mjs';
const snapshots = JSON.parse(await readFile(new URL('./atlas.json', import.meta.url), 'utf8'));
const checks = new Map();
async function bounded(response, max = 1500000) {
  if (!response.ok) throw new Error('Public source unavailable');
  const reader = response.body.getReader(),
    chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > max) throw new Error('Public source too large');
      chunks.push(value);
    }
  } finally {
    await reader.cancel();
  }
  return Buffer.concat(chunks).toString('utf8');
}
export async function publicSnapshotAllowed(id, fetcher = fetch) {
  const cached = checks.get(id);
  if (fetcher === fetch && cached?.expires > Date.now()) return cached.allowed;
  let allowed = false;
  try {
    const page = await fetcher(`https://github.com/${id}`, { signal: AbortSignal.timeout(12000) });
    const html = await bounded(page);
    const publicFlag =
      /<meta\s+name="octolytics-dimension-repository_public"\s+content="true"\s*\/?\s*>/.test(html);
    if (!publicFlag || /\/topics\/gitcity-opt-out(?:["?\/])/.test(html)) return false;
    const marker = await fetcher(`https://raw.githubusercontent.com/${id}/HEAD/.gitcity-opt-out`, {
      method: 'HEAD',
      signal: AbortSignal.timeout(12000),
    });
    allowed = marker.status === 404;
  } catch {}
  if (fetcher === fetch)
    checks.set(id, { allowed, expires: Date.now() + (allowed ? 900000 : 30000) });
  return allowed;
}
export async function cachedRepository(id) {
  const snapshot = snapshots.find((s) => s.id.toLowerCase() === id.toLowerCase());
  if (!snapshot || !(await publicSnapshotAllowed(snapshot.id))) return null;
  const directories = [
    ...new Set(snapshot.files.map((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.'))),
  ].map((name) => ({
    name,
    count: snapshot.files.filter(
      (f) => (f.path.includes('/') ? f.path.split('/')[0] : '.') === name,
    ).length,
  }));
  return {
    ...snapshot,
    cached: true,
    description: 'A verified source snapshot. Live GitHub metadata is temporarily unavailable.',
    stars: null,
    issuesAvailable: false,
    forks: null,
    openPRs: null,
    prsSampled: false,
    ci: 'unknown',
    totalFiles: snapshot.files.length,
    truncated: true,
    directories,
    commits: [],
    issues: [],
    defaultBranch: 'HEAD',
    historyCoverage: 'Cached source samples; commit history and live repository totals unavailable',
    timezone: null,
    codeowners: '',
  };
}
export async function cachedSource(id, path) {
  const repo = await cachedRepository(id);
  if (!repo?.files.some((file) => file.path === path)) return null;
  const source = await bounded(
    await fetch(
      `https://raw.githubusercontent.com/${id}/HEAD/${path.split('/').map(encodeURIComponent).join('/')}`,
      { signal: AbortSignal.timeout(12000) },
    ),
    200000,
  );
  const bytes = Buffer.from(source),
    sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  return { source, file: { path, sha, ...analyze(path, source) } };
}
