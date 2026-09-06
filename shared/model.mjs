/** Stable, versioned world coordinates. Never depend on API ordering. */
export function hash(text) {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function random(seed) {
  let a = hash(seed);
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const atlas = [
  {
    id: 'facebook/react',
    name: 'React',
    language: 'JavaScript',
    color: '#8bced6',
    x: -28,
    z: 12,
    tagline: 'A city built around interfaces.',
    topic: 'INTERFACES',
    footprint: 17,
  },
  {
    id: 'vercel/next.js',
    name: 'Next.js',
    language: 'TypeScript',
    color: '#d6dcc7',
    x: 12,
    z: 30,
    tagline: 'Where the web comes together.',
    topic: 'FRAMEWORKS',
    footprint: 13,
  },
  {
    id: 'microsoft/vscode',
    name: 'VS Code',
    language: 'TypeScript',
    color: '#94b6e1',
    x: 27,
    z: -19,
    tagline: 'A home for every kind of builder.',
    topic: 'DEVELOPER TOOLS',
    footprint: 20,
  },
  {
    id: 'rust-lang/rust',
    name: 'Rust',
    language: 'Rust',
    color: '#d99b71',
    x: -37,
    z: -31,
    tagline: 'Built to stand the test of time.',
    topic: 'LANGUAGES',
    footprint: 15,
  },
  {
    id: 'denoland/deno',
    name: 'Deno',
    language: 'Rust',
    color: '#bda8d5',
    x: 57,
    z: 23,
    tagline: 'A fresh foundation for JavaScript.',
    topic: 'RUNTIMES',
    footprint: 11,
  },
  {
    id: 'vuejs/core',
    name: 'Vue',
    language: 'TypeScript',
    color: '#98caa0',
    x: -4,
    z: -49,
    tagline: 'The progressive neighborhood.',
    topic: 'INTERFACES',
    footprint: 12,
  },
];
export function coordinates(id) {
  const known = atlas.find((c) => c.id.toLowerCase() === id.toLowerCase());
  if (known) return { x: known.x, z: known.z };
  const r = random(id.toLowerCase());
  const angle = r() * Math.PI * 2;
  const radius = 75 + r() * 180;
  return { x: Math.cos(angle) * radius, z: Math.sin(angle) * radius };
}
export function parseRoute(path) {
  const p = path
    .split('/')
    .filter(Boolean)
    .map((part) => {
      try {
        return decodeURIComponent(part);
      } catch {
        return part;
      }
    });
  if (!p.length) return { level: 'world' };
  if (p.length === 1) return { level: 'owner', owner: p[0] };
  return {
    level: p.length > 2 ? 'file' : 'repo',
    owner: p[0],
    repo: p[1],
    file: p.slice(2).join('/'),
  };
}
export function building(file) {
  const r = random(file.path);
  const symbols = file.symbols ?? 0;
  const complexity = file.complexity ?? 0;
  return {
    width: 2.1 + r() * 0.8,
    depth: 2 + r() * 0.9,
    height: 1.1 + Math.log2(1 + symbols) * 0.65 + Math.log2(1 + complexity) * 0.28,
    tiers: 1 + Math.min(3, Math.floor(symbols / 12)),
    roof: Math.floor(r() * 3),
    seed: r(),
    decay: file.lastCommit
      ? Math.min(1, Math.max(0, (Date.now() - Date.parse(file.lastCommit)) / (86400000 * 730)))
      : 0,
  };
}
/** Only verified, externally accepted work earns structure. Idempotence lives in ledger. */
export function reward(pr, login, standing) {
  if (
    !pr.merged ||
    pr.author?.toLowerCase() !== login.toLowerCase() ||
    pr.owner?.toLowerCase() === login.toLowerCase() ||
    pr.mergedBy?.toLowerCase() === login.toLowerCase() ||
    !pr.mergedBy ||
    pr.mergerIsBot
  )
    return 0;
  return Math.max(1, Math.floor(10 * (1 + Math.log10(1 + Math.max(0, standing)))));
}
export function governance(login, permissions, owners, hasMerge) {
  if (!login) return 'Tourist';
  if (permissions?.push || permissions?.admin || permissions?.maintain) return 'Mayor';
  if (owners.some((o) => o.toLowerCase() === `@${login.toLowerCase()}`)) return 'Alderman';
  return hasMerge ? 'Resident' : 'Tourist';
}
