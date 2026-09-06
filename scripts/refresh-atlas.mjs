// A small, attributable cache of real public source metrics. No rendered geometry is stored.
import { writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { atlas } from '../shared/model.mjs';
import { analyze } from '../server/analyze.mjs';
const snapshots = [];
for (const city of atlas) {
  const headers = process.env.GITHUB_TOKEN
    ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
    : {};
  const metadataResponse = await fetch(`https://api.github.com/repos/${city.id}`, {
    headers,
    signal: AbortSignal.timeout(20000),
  });
  if (!metadataResponse.ok) {
    console.error(`${city.id}: metadata ${metadataResponse.status}`);
    continue;
  }
  const metadata = await metadataResponse.json();
  if (metadata.private || metadata.topics?.includes('gitcity-opt-out')) continue;
  const response = await fetch(
    `https://api.github.com/repos/${city.id}/git/trees/${metadata.default_branch}?recursive=1`,
    { headers, signal: AbortSignal.timeout(20000) },
  );
  if (!response.ok) {
    console.error(`${city.id}: tree ${response.status}`);
    continue;
  }
  const tree = await response.json();
  if (tree.tree.some((f) => f.path === '.gitcity-opt-out')) continue;
  const candidates = tree.tree.filter(
    (f) =>
      f.type === 'blob' &&
      f.size < 80000 &&
      /\.(?:tsx?|jsx?|rs)$/.test(f.path) &&
      !/(?:test|fixture|__test|\.spec\.)/i.test(f.path),
  );
  const stride = Math.max(1, Math.floor(candidates.length / 72));
  const sampled = candidates.filter((f, i) => i % stride === 0).slice(0, 72);
  const files = [];
  for (let i = 0; i < sampled.length; i += 8) {
    files.push(
      ...(
        await Promise.all(
          sampled.slice(i, i + 8).map(async (f) => {
            try {
              const r = await fetch(
                `https://raw.githubusercontent.com/${city.id}/${metadata.default_branch}/${f.path}`,
                { signal: AbortSignal.timeout(12000) },
              );
              if (!r.ok) return null;
              const source = await r.text();
              const bytes = Buffer.from(source);
              const sha = createHash('sha1')
                .update(`blob ${bytes.length}\0`)
                .update(bytes)
                .digest('hex');
              if (sha !== f.sha) return null;
              return { path: f.path, sha: f.sha, ...analyze(f.path, source) };
            } catch {
              return null;
            }
          }),
        )
      ).filter(Boolean),
    );
  }
  const known = { react: 'facebook/react', next: 'vercel/next.js', vue: 'vuejs/core' };
  const imported = [
    ...new Set(
      files
        .flatMap((f) => f.imports || [])
        .map((i) => i.split('/')[0])
        .filter((i) => known[i] && known[i] !== city.id),
    ),
  ];
  snapshots.push({
    dependencies: imported.map((name) => ({ name, repo: known[name] })),
    id: city.id,
    name: city.name,
    language: city.language,
    files,
    tree: tree.sha,
    fetchedAt: new Date().toISOString(),
    provenance: `https://github.com/${city.id}`,
    scope:
      'World silhouette only; source metrics verified against Git blob SHA. Live opt-out checked on arrival.',
  });
  console.log(`${city.id}: ${files.length} verified source files`);
}
if (!snapshots.length)
  throw new Error('No source snapshots available; existing cache was not replaced.');
await writeFile('server/atlas.json', JSON.stringify(snapshots));
