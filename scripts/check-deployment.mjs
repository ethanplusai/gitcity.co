// Read-only checks. Supply a preview URL; this does not deploy or mutate state.
const base = process.argv[2];
if (!base || !/^https?:\/\//.test(base))
  throw new Error('Usage: node scripts/check-deployment.mjs https://your-preview-domain');
for (const path of ['/', '/api/health', '/api/session', '/api/atlas']) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(90000) });
  if (!response.ok) throw new Error(`${path}: HTTP ${response.status}`);
  if (path.startsWith('/api/')) {
    if (!response.headers.get('content-type')?.includes('application/json'))
      throw new Error(`${path}: expected JSON, received page HTML`);
    const data = await response.json();
    if (path === '/api/health' && data.ok !== true) throw new Error('Database health failed');
    if (path === '/api/session' && (!data.configured || data.player !== null))
      throw new Error('Anonymous OAuth session configuration failed');
    if (
      path === '/api/atlas' &&
      (!Array.isArray(data) || !data.some((repo) => repo.id === 'vercel/next.js'))
    )
      throw new Error('Featured city unavailable');
  }
  console.log(`PASS ${path}`);
}
