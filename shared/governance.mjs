/** GitHub CODEOWNERS: last matching rule wins; unsupported patterns grant nothing. */
export function ownersForPath(text, path) {
  let owners = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const [pattern, ...people] = line.split(/\s+/);
    if (pattern.startsWith('!') || pattern.includes('[') || pattern.includes('\\')) continue;
    let re = '';
    const clean = pattern.replace(/^\//, '');
    for (let i = 0; i < clean.length; i++) {
      const c = clean[i];
      if (c === '*' && clean[i + 1] === '*') {
        i++;
        if (clean[i + 1] === '/') {
          i++;
          re += '(?:.*/)?';
        } else re += '.*';
      } else if (c === '*') re += '[^/]*';
      else if (c === '?') re += '[^/]';
      else re += c.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
    const anchored = pattern.startsWith('/') || clean.replace(/\/$/, '').includes('/');
    const regex = new RegExp(
      (anchored ? '^' : '(?:^|/)') + re + (pattern.endsWith('/') ? '.*' : '(?:/.*)?$'),
    );
    if (regex.test(path)) owners = people.filter((p) => p.startsWith('@'));
  }
  return owners;
}
export function allocateReward(amount, dependencies) {
  const repos = [...new Set(dependencies.filter(Boolean))].sort();
  if (!repos.length) return { personal: amount, upstream: [] };
  const fund = Math.floor(amount * 0.1);
  const upstream = repos.slice(0, fund).map((repo) => ({ repo, amount: 1 }));
  let remaining = fund - upstream.length;
  for (let i = 0; remaining > 0; i++, remaining--) upstream[i % upstream.length].amount++;
  return { personal: amount - fund, upstream };
}
