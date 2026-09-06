import { createHash } from 'node:crypto';
import { analyze } from './analyze.mjs';
import { sourcePage } from '../shared/source-pages.mjs';
import { partitionSourceSnapshot } from '../shared/source-reconcile.mjs';
const cache = new Map(),
  inflight = new Map(),
  sourceCache = new Map();
const MAX_CITIES = 80;
let sharedCache;
export function configureSharedCache(runtime) {
  sharedCache = runtime;
}
const validPart = (value) => /^[\w.-]+$/.test(value) && value !== '.' && value !== '..';
export function validateRepo(owner, repo) {
  if (!validPart(owner) || !validPart(repo))
    throw Object.assign(new Error('Invalid GitHub repository address.'), { status: 400 });
}
export async function github(path, token, options = {}) {
  const r = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!r.ok) {
    const e = new Error(
      r.status === 403 || r.status === 429
        ? 'GitHub’s API limit has been reached. This city will resume construction when it resets.'
        : r.status === 404
          ? 'This repository is private or does not exist.'
          : `GitHub returned ${r.status}. Please try again.`,
    );
    e.status = r.status;
    throw e;
  }
  return r.status === 204 ? null : r.json();
}
async function boundedText(url, maxBytes = 200000, headerOnly = false) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new Error(`Source unavailable (${response.status})`);
  const reader = response.body.getReader();
  let text = '',
    size = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes && !headerOnly) throw new Error('Source exceeds the analysis limit.');
      text += decoder.decode(value, { stream: true });
      if (headerOnly && (text.includes('\n\n') || size > maxBytes)) break;
    }
  } finally {
    await reader.cancel();
  }
  return text;
}
async function sourceAt(id, ref, file) {
  if (sourceCache.has(file.sha)) return sourceCache.get(file.sha);
  const source = await boundedText(
    `https://raw.githubusercontent.com/${id}/${ref}/${file.path.split('/').map(encodeURIComponent).join('/')}`,
  );
  const bytes = Buffer.from(source);
  const sha = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (sha !== file.sha)
    throw new Error('Source changed during the survey. Retry to read a consistent snapshot.');
  sourceCache.set(file.sha, source);
  if (sourceCache.size > 2048) sourceCache.delete(sourceCache.keys().next().value);
  return source;
}
function eligible(f) {
  return (
    f.type === 'blob' &&
    f.size < 180000 &&
    !/(?:^|\/)(?:node_modules|vendor|dist|build|target|\.git)\//.test(f.path)
  );
}
function sourceFile(f) {
  return (
    eligible(f) &&
    /\.(?:[cm]?[jt]sx?|rs|py|go|java|rb|cpp|c|h|swift|css|scss|md|json|ya?ml|toml)$/.test(f.path)
  );
}
export function dominantTimezone(headers) {
  const counts = new Map();
  for (const header of headers) {
    const match = header?.match(/^Date: .*?([+-])(\d{2})(\d{2})\s*$/m);
    if (!match) continue;
    const minutes = (Number(match[2]) * 60 + Number(match[3])) * (match[1] === '-' ? -1 : 1);
    counts.set(minutes, (counts.get(minutes) || 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0] ?? null;
}
export async function repoData(owner, repo) {
  validateRepo(owner, repo);
  const id = `${owner}/${repo}`.toLowerCase();
  const old = cache.get(id);
  if (old && old.expires > Date.now()) return old.data;
  if (inflight.has(id)) return inflight.get(id);
  const load = async () => {
    if (!sharedCache) return survey(owner, repo, old);
    const snapshot = await sharedCache.cached('repo:v1:' + id, 60000, async () => {
      await survey(owner, repo, old);
      const city = cache.get(id);
      return { ...city, history: [...city.history], analyzed: [...city.analyzed] };
    });
    const city = {
      ...snapshot,
      history: new Map(snapshot.history),
      analyzed: new Map(snapshot.analyzed),
    };
    cache.set(id, city);
    if (cache.size > MAX_CITIES) cache.delete(cache.keys().next().value);
    return city.data;
  };
  const task = load().finally(() => inflight.delete(id));
  inflight.set(id, task);
  return task;
}
// The complete eligible inventory stays on the server. The browser receives
// compact block counts and only the paths whose source detail it requested.
export function sourceInventory(id, ref) {
  const city = cache.get(id.toLowerCase());
  if (!ref || !city || city.ref !== ref) return null;
  return {
    paths: city.all.filter(sourceFile).map((file) => file.path),
    complete: !city.data.truncated,
    measurements: [...city.analyzed.values()],
  };
}
async function survey(owner, repo, old) {
  const id = `${owner}/${repo}`,
    token = process.env.GITHUB_TOKEN,
    base = `/repos/${owner}/${repo}`;
  const metadata = await github(base, token);
  if (metadata.private)
    throw Object.assign(new Error('Only public cities are available.'), { status: 404 });
  if (metadata.topics?.includes('gitcity-opt-out')) {
    cache.delete(id.toLowerCase());
    throw Object.assign(new Error('This repository has opted out of Gitcity.'), { status: 410 });
  }
  const commits = await github(`${base}/commits?per_page=30`, token);
  const ref = commits[0]?.sha || metadata.default_branch;
  const [tree, prs, ci, issues, checks] = await Promise.all([
    github(`${base}/git/trees/${ref}?recursive=1`, token),
    github(`${base}/pulls?state=open&per_page=30`, token).catch(() => null),
    github(`${base}/commits/${ref}/status`, token).catch(() => null),
    github(`${base}/issues?state=open&sort=updated&per_page=30`, token).catch(() => null),
    github(`${base}/commits/${ref}/check-runs?per_page=30`, token).catch(() => null),
  ]);
  const all = tree.tree.filter((f) => f.type === 'blob');
  if (all.some((f) => f.path === '.gitcity-opt-out')) {
    cache.delete(id.toLowerCase());
    throw Object.assign(new Error('This repository has opted out of Gitcity.'), { status: 410 });
  }
  const sourceFiles = all.filter(sourceFile);
  const dirs = new Map();
  for (const f of sourceFiles) {
    const directory = f.path.includes('/') ? f.path.split('/')[0] : '.';
    if (!dirs.has(directory)) dirs.set(directory, []);
    dirs.get(directory).push(f);
  }
  // Round-robin sampling includes the entire repository rather than the first directory.
  const sampled = [];
  const groups = [...dirs.values()];
  for (let i = 0; sampled.length < 64 && i < 64; i++) {
    for (const group of groups) {
      if (group[i]) sampled.push(group[i]);
      if (sampled.length === 64) break;
    }
  }
  const details = await Promise.all(
    commits.slice(0, 5).map((c) => github(`${base}/commits/${c.sha}`, token).catch(() => null)),
  );
  const history = new Map();
  for (const c of details.filter(Boolean))
    for (const f of c.files || [])
      if (!history.has(f.filename))
        history.set(f.filename, {
          lastCommit: c.commit.committer.date,
          contributor: c.author?.login,
          additions: f.additions,
          deletions: f.deletions,
        });
  // Files absent from the recent changes need their own history; otherwise age stays unknown.
  await Promise.all(
    sampled
      .filter((f) => !history.has(f.path))
      .slice(0, 8)
      .map(async (f) => {
        try {
          const log = await github(
            `${base}/commits?path=${encodeURIComponent(f.path)}&per_page=1&sha=${ref}`,
            token,
          );
          if (log[0])
            history.set(f.path, {
              lastCommit: log[0].commit.committer.date,
              contributor: log[0].author?.login,
            });
        } catch {
          /* An API limit must never fabricate a file's age. */
        }
      }),
  );
  const files = [];
  for (let i = 0; i < sampled.length; i += 8) {
    files.push(
      ...(await Promise.all(
        sampled.slice(i, i + 8).map(async (f) => {
          try {
            return {
              path: f.path,
              sha: f.sha,
              ...analyze(f.path, await sourceAt(id, ref, f)),
              ...history.get(f.path),
            };
          } catch {
            return { path: f.path, sha: f.sha, analysis: 'unavailable', ...history.get(f.path) };
          }
        }),
      )),
    );
  }
  let dependencies = [],
    codeowners = '';
  const packageNames = [];
  const known = {
    react: 'facebook/react',
    next: 'vercel/next.js',
    vue: 'vuejs/core',
    typescript: 'microsoft/TypeScript',
    three: 'mrdoob/three.js',
    svelte: 'sveltejs/svelte',
    express: 'expressjs/express',
    vite: 'vitejs/vite',
    webpack: 'webpack/webpack',
    eslint: 'eslint/eslint',
    rollup: 'rollup/rollup',
  };
  const manifests = all
    .filter((f) => /(^|\/)package\.json$/.test(f.path) && eligible(f))
    .slice(0, 12);
  for (const manifest of manifests)
    try {
      const pkg = JSON.parse(await sourceAt(id, ref, manifest));
      if (pkg.name && !pkg.private) packageNames.push(pkg.name);
      for (const name of Object.keys(pkg.dependencies || {})) {
        if (!dependencies.some((d) => d.name === name))
          dependencies.push({ name, repo: known[name] || null });
      }
    } catch {}
  // Resolve a bounded set from their registry repository metadata, never guessed URLs.
  await Promise.all(
    dependencies
      .filter((d) => !d.repo)
      .slice(0, 8)
      .map(async (dep) => {
        try {
          const raw = JSON.parse(
            await boundedText(
              `https://registry.npmjs.org/${encodeURIComponent(dep.name)}/latest`,
              150000,
            ),
          );
          const url = typeof raw.repository === 'string' ? raw.repository : raw.repository?.url;
          const match = url?.match(/github\.com[/:]([\w.-]+\/[\w.-]+)/);
          if (match) dep.repo = match[1].replace(/\.git$/, '');
        } catch {}
      }),
  );
  let usage = null;
  for (const name of packageNames.slice(0, 3)) {
    try {
      const pkg = JSON.parse(
        await boundedText(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`, 150000),
      );
      const url = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
      const match = url?.match(/github\.com[/:]([\w.-]+\/[\w.-]+)/);
      if (match?.[1].replace(/\.git$/, '').toLowerCase() !== id.toLowerCase()) continue;
      const downloads = JSON.parse(
        await boundedText(
          `https://api.npmjs.org/downloads/point/last-week/${encodeURIComponent(name)}`,
          20000,
        ),
      );
      if (Number.isFinite(downloads.downloads)) {
        usage = {
          kind: 'npm downloads',
          package: name,
          weekly: downloads.downloads,
          end: downloads.end,
        };
        break;
      }
    } catch {
      /* Unsupported registries remain unknown. */
    }
  }
  const owners = ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']
    .map((p) => all.find((f) => f.path === p))
    .find(Boolean);
  if (owners)
    try {
      codeowners = await sourceAt(id, ref, owners);
    } catch {}
  const headers = await Promise.all(
    commits
      .slice(0, 8)
      .map((c) =>
        boundedText(`https://github.com/${id}/commit/${c.sha}.patch`, 12000, true).catch(
          () => null,
        ),
      ),
  );
  const checksState = checks?.check_runs?.length
    ? checks.check_runs.some((c) =>
        ['failure', 'timed_out', 'action_required'].includes(c.conclusion),
      )
      ? 'failure'
      : checks.check_runs.some((c) => c.status !== 'completed')
        ? 'pending'
        : checks.check_runs.every((c) => ['success', 'neutral', 'skipped'].includes(c.conclusion))
          ? 'success'
          : 'unknown'
    : 'unknown';
  const reported = [ci?.total_count ? ci.state : 'unknown', checksState];
  const state = reported.some((s) => s === 'failure' || s === 'error')
    ? 'failure'
    : reported.includes('pending')
      ? 'pending'
      : reported.includes('success')
        ? 'success'
        : 'unknown';
  const data = {
    id: metadata.full_name,
    name: metadata.name,
    description: metadata.description,
    language: metadata.language,
    stars: metadata.stargazers_count,
    forks: metadata.forks_count,
    openPRs: prs?.length ?? null,
    prsSampled: prs?.length === 30,
    ci: state,
    usage,
    files,
    totalFiles: all.length,
    truncated: tree.truncated,
    directories: [...dirs].map(([name, files]) => ({ name, count: files.length })),
    commits: commits.map((c) => ({
      sha: c.sha,
      message: c.commit.message.split('\n')[0],
      date: c.commit.committer.date,
      author: c.author?.login || c.commit.author.name,
    })),
    dependencies,
    codeowners,
    issuesAvailable: issues !== null,
    issues: (issues || [])
      .filter((i) => !i.pull_request)
      .slice(0, 12)
      .map((i) => ({
        number: i.number,
        title: i.title,
        url: i.html_url,
        labels: (i.labels || []).map((l) => (typeof l === 'string' ? l : l.name)),
        body: (i.body || '').slice(0, 1600),
        updatedAt: i.updated_at,
      })),
    fetchedAt: new Date().toISOString(),
    defaultBranch: metadata.default_branch,
    ref,
    historyCoverage: 'Latest 5 commits + 8 file histories; 64 source files initially',
    timezone: dominantTimezone(headers),
    timezoneSamples: headers.filter(Boolean).length,
  };
  const hashes = new Map(all.map((file) => [file.path, file.sha]));
  const analyzed = new Map(
    [...(old?.analyzed || [])].filter(([path, file]) => hashes.get(path) === file.sha),
  );
  for (const file of files) analyzed.set(file.path, file);
  cache.set(id.toLowerCase(), { data, all, ref, history, analyzed, expires: Date.now() + 60000 });
  if (cache.size > MAX_CITIES) cache.delete(cache.keys().next().value);
  return data;
}
export async function districtData(owner, repo, directory, cursor = '') {
  const data = await repoData(owner, repo);
  const city = cache.get(`${owner}/${repo}`.toLowerCase());
  const sampledPaths = new Set(data.files.map((f) => f.path));
  const page = sourcePage(
    city.all.filter((f) => sourceFile(f) && !sampledPaths.has(f.path)),
    city.ref,
    directory,
    cursor,
  );
  const candidates = page.files;
  const files = await analyzeSources(data, city, candidates);
  return {
    directory,
    files,
    total: data.directories.find((d) => d.name === directory)?.count || 0,
    nextCursor: page.nextCursor,
    ref: page.ref,
  };
}
async function analyzeSources(data, city, candidates) {
  const files = [];
  for (let i = 0; i < candidates.length; i += 8) {
    files.push(
      ...(await Promise.all(
        candidates.slice(i, i + 8).map(async (f) => {
          const known = city.analyzed.get(f.path);
          if (known?.sha === f.sha && known.analysis !== 'unavailable') return known;
          try {
            return {
              path: f.path,
              sha: f.sha,
              ...analyze(f.path, await sourceAt(data.id, city.ref, f)),
              ...city.history.get(f.path),
            };
          } catch {
            return { path: f.path, sha: f.sha, analysis: 'unavailable' };
          }
        }),
      )),
    );
  }
  for (const file of files) city.analyzed.set(file.path, file);
  return files;
}
export async function directoryBlockData(owner, repo, directory, block, ref, select) {
  if (!Number.isSafeInteger(block) || block < 0 || block > 1000000 || !ref)
    throw Object.assign(new Error('A valid block and repository snapshot are required.'), {
      status: 400,
    });
  const data = await repoData(owner, repo);
  const city = cache.get(`${owner}/${repo}`.toLowerCase());
  if (city.ref !== ref)
    throw Object.assign(
      new Error('The repository changed. Refresh the city before exploring this block.'),
      { status: 409 },
    );
  const selected = await select(data.id, sourceInventory(data.id, ref));
  if (!selected.length)
    throw Object.assign(new Error('This directory block does not exist.'), { status: 404 });
  const entries = new Map(city.all.filter(sourceFile).map((file) => [file.path, file]));
  const candidates = selected.map((file) => entries.get(file.path)).filter(Boolean);
  const files = await analyzeSources(data, city, candidates);
  return {
    directory,
    block,
    files,
    total: data.directories.find((d) => d.name === directory)?.count || 0,
    nextCursor: null,
    ref: city.ref,
  };
}
export async function fileData(owner, repo, path) {
  const data = await repoData(owner, repo);
  const city = cache.get(`${owner}/${repo}`.toLowerCase());
  const f = city.all.find((f) => f.path === path);
  if (!f)
    throw Object.assign(new Error('This file is not in the default branch.'), { status: 404 });
  if (f.size > 200000)
    throw Object.assign(new Error('This file is too large to enter here. Open it on GitHub.'), {
      status: 413,
    });
  const source = await sourceAt(data.id, city.ref, f);
  const file = { path, sha: f.sha, ...analyze(path, source), ...city.history.get(path) };
  city.analyzed.set(path, file);
  return {
    ref: city.ref,
    source,
    file,
    url: `https://github.com/${data.id}/blob/${city.ref}/${path}`,
  };
}

export async function reconcileData(owner, repo, ref, known) {
  if (
    !Array.isArray(known) ||
    known.length > 64 ||
    known.some(
      (f) =>
        !f ||
        typeof f.path !== 'string' ||
        f.path.length > 1000 ||
        (f.sha !== undefined && typeof f.sha !== 'string'),
    )
  )
    throw Object.assign(new Error('Provide at most 64 source paths to refresh.'), { status: 400 });
  const data = await repoData(owner, repo);
  const city = cache.get(`${owner}/${repo}`.toLowerCase());
  if (ref !== city.ref)
    throw Object.assign(new Error('The repository changed again; retry this city snapshot.'), {
      status: 409,
    });
  const { unchanged, removed, changed } = partitionSourceSnapshot(known, city.all, data.truncated);
  const files = [];
  for (let i = 0; i < changed.length; i += 8)
    files.push(
      ...(await Promise.all(
        changed.slice(i, i + 8).map(async (f) => {
          try {
            return {
              path: f.path,
              sha: f.sha,
              ...analyze(f.path, await sourceAt(data.id, city.ref, f)),
              ...city.history.get(f.path),
            };
          } catch {
            return { path: f.path, sha: f.sha, analysis: 'unavailable' };
          }
        }),
      )),
    );
  for (const file of files) city.analyzed.set(file.path, file);
  return { ref: city.ref, unchanged, removed, files };
}
