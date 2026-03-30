/**
 * GitHub API — fetch repo file tree.
 * Uses the Git Trees API for efficient single-request tree fetching.
 */

export interface RepoFile {
  path: string;
  type: string;     // file extension without dot
  size: number;     // bytes
  lines: number;    // estimated from size
  isEntry: boolean;
}

export interface RepoData {
  owner: string;
  repo: string;
  files: RepoFile[];
  totalSize: number;
}

const ENTRY_NAMES = new Set(['index', 'main', 'app', 'server', 'mod', 'lib', '__init__']);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.nuxt',
  '__pycache__', '.venv', 'venv', 'vendor', 'target',
  '.idea', '.vscode', '.github',
]);

const BINARY_EXTS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'ico', 'svg', 'webp',
  'woff', 'woff2', 'ttf', 'eot', 'mp3', 'mp4', 'wav',
  'zip', 'tar', 'gz', 'pdf', 'exe', 'dll', 'so', 'dylib',
  'lock', 'lockb',
]);

function getExt(path: string): string {
  const dot = path.lastIndexOf('.');
  const slash = path.lastIndexOf('/');
  if (dot <= slash) return '';
  return path.slice(dot + 1).toLowerCase();
}

function isSkipped(path: string): boolean {
  const parts = path.split('/');
  return parts.some(p => SKIP_DIRS.has(p));
}

function isEntryFile(path: string): boolean {
  const name = (path.split('/').pop() || '').replace(/\.[^.]+$/, '');
  return ENTRY_NAMES.has(name);
}

// Estimate line count from byte size (rough: ~40 bytes per line for code)
function estimateLines(size: number): number {
  return Math.max(1, Math.round(size / 40));
}

export async function fetchRepoTree(owner: string, repo: string, branch = 'main'): Promise<RepoData> {
  // Check sessionStorage cache first
  const cacheKey = `gitcity:${owner}/${repo}:${branch}`;
  if (typeof window !== 'undefined') {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        // Cache for 10 minutes
        if (parsed._ts && Date.now() - parsed._ts < 10 * 60 * 1000) {
          delete parsed._ts;
          return parsed as RepoData;
        }
      }
    } catch { /* ignore cache errors */ }
  }

  // Try main first, fallback to master
  let data: any; // eslint-disable-line @typescript-eslint/no-explicit-any

  try {
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/${branch}?recursive=1`);
    if (res.status === 404 && branch === 'main') {
      const res2 = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees/master?recursive=1`);
      if (res2.status === 404) throw new Error(`REPO_NOT_FOUND`);
      if (res2.status === 403) throw new Error(`RATE_LIMIT`);
      if (res2.status === 401) throw new Error(`PRIVATE_REPO`);
      if (!res2.ok) throw new Error(`GitHub API error: ${res2.status}`);
      data = await res2.json();
    } else if (res.status === 404) {
      throw new Error(`REPO_NOT_FOUND`);
    } else if (res.status === 403) {
      throw new Error(`RATE_LIMIT`);
    } else if (res.status === 401) {
      throw new Error(`PRIVATE_REPO`);
    } else if (!res.ok) {
      throw new Error(`GitHub API error: ${res.status}`);
    } else {
      data = await res.json();
    }
  } catch (err: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
    if (err.message === 'REPO_NOT_FOUND' || err.message === 'RATE_LIMIT' || err.message === 'PRIVATE_REPO') throw err;
    if (err.name === 'TypeError' || err.message?.includes('fetch')) throw new Error('NETWORK_ERROR');
    throw new Error(err.message || `Failed to fetch repo`);
  }

  if (!data.tree) {
    throw new Error('No tree data in response');
  }

  if (data.truncated) {
    console.warn(`GitHub API returned truncated tree for ${owner}/${repo}`);
    // Continue with partial data — we cap at 500 files anyway
  }

  const files: RepoFile[] = [];
  let totalSize = 0;

  for (const item of data.tree) {
    if (item.type !== 'blob') continue;
    if (isSkipped(item.path)) continue;

    const ext = getExt(item.path);
    if (BINARY_EXTS.has(ext)) continue;
    if (!ext) continue; // skip extensionless files

    const size = item.size || 0;
    if (size > 500_000) continue; // skip huge files

    files.push({
      path: item.path,
      type: ext,
      size,
      lines: estimateLines(size),
      isEntry: isEntryFile(item.path),
    });
    totalSize += size;
  }

  // Cap at 2000 files for browser performance
  const cappedFiles = files.length > 2000 ? files.slice(0, 2000) : files;
  const result: RepoData = { owner, repo, files: cappedFiles, totalSize };

  // Cache in sessionStorage
  if (typeof window !== 'undefined') {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ ...result, _ts: Date.now() }));
    } catch { /* ignore quota errors */ }
  }

  return result;
}

/**
 * Parse a GitHub URL or owner/repo string into owner and repo.
 * Handles: "facebook/react", "https://github.com/facebook/react", "github.com/facebook/react"
 */
export function parseRepoInput(input: string): { owner: string; repo: string } | null {
  const trimmed = input.trim().replace(/\/$/, '');

  // Direct owner/repo format
  const directMatch = trimmed.match(/^([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)$/);
  if (directMatch) {
    return { owner: directMatch[1], repo: directMatch[2] };
  }

  // GitHub URL format
  const urlMatch = trimmed.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([a-zA-Z0-9_.-]+)\/([a-zA-Z0-9_.-]+)/);
  if (urlMatch) {
    return { owner: urlMatch[1], repo: urlMatch[2] };
  }

  return null;
}
