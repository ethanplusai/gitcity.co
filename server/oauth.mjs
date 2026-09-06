import { randomBytes, createHash } from 'node:crypto';
export function pkce() {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}
export function returnPath(value) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    /[\\\x00-\x20]/.test(value)
  )
    return '/';
  const url = new URL(value, 'https://gitcity.local');
  if (url.origin !== 'https://gitcity.local' || url.pathname.startsWith('/auth/')) return '/';
  return url.pathname;
}
