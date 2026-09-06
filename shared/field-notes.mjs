export const FIELD_NOTES_KEY = 'gitcity.issue-notes.v1';
export const FIELD_NOTES_EVENT = 'gitcity:field-notes';
// A local notebook checkpoint only. Currency and residency never read this.
export function recordNotebookAcceptance(state, key, repo, number, now = Date.now()) {
  if (!Number.isSafeInteger(number) || number <= 0 || !Number.isFinite(now) || now <= 0)
    return state;
  const entry = state?.[key];
  const accepted = `https://github.com/${repo}/pull/${number}`;
  if (!entry || notebookPullRequest(entry.pullRequest, repo) !== accepted) return state;
  return { ...state, [key]: { ...entry, acceptance: { pullRequest: accepted, verifiedAt: now } } };
}
export function notebookPullRequest(value, repo) {
  try {
    const url = new URL(value);
    if (
      url.protocol !== 'https:' ||
      url.hostname !== 'github.com' ||
      url.port ||
      url.username ||
      url.password
    )
      return '';
    const match = url.pathname.match(/^\/([^/]+)\/([^/]+)\/pull\/([1-9]\d*)\/?$/);
    if (
      !match ||
      `${match[1]}/${match[2]}`.toLowerCase() !== repo.toLowerCase() ||
      !Number.isSafeInteger(Number(match[3]))
    )
      return '';
    return `https://github.com/${repo}/pull/${match[3]}`;
  } catch {
    return '';
  }
}

// Old surveys stored only note/time. Keep them readable, including issues that
// have fallen out of the repository's current open-issue sample.
export function fieldNotes(state, repo) {
  if (!state || typeof state !== 'object' || Array.isArray(state)) return [];
  const prefix = repo.toLowerCase() + '#';
  return Object.entries(state)
    .flatMap(([key, value]) => {
      if (!key.toLowerCase().startsWith(prefix) || !value || typeof value !== 'object') return [];
      const suffix = key.slice(prefix.length);
      if (!/^[1-9]\d*$/.test(suffix) || !Number.isSafeInteger(Number(suffix))) return [];
      if (
        typeof value.note !== 'string' ||
        !Number.isFinite(value.surveyedAt) ||
        value.surveyedAt <= 0
      )
        return [];
      return [
        {
          key,
          number: Number(suffix),
          note: value.note.slice(0, 2000),
          title: typeof value.title === 'string' ? value.title.slice(0, 300) : '',
          surveyedAt: value.surveyedAt,
          pullRequest: notebookPullRequest(value.pullRequest, repo),
          verifiedAt:
            notebookPullRequest(value.pullRequest, repo) &&
            notebookPullRequest(value.acceptance?.pullRequest, repo) ===
              notebookPullRequest(value.pullRequest, repo) &&
            Number.isFinite(value.acceptance?.verifiedAt) &&
            value.acceptance.verifiedAt > 0
              ? value.acceptance.verifiedAt
              : null,
        },
      ];
    })
    .sort((a, b) => b.surveyedAt - a.surveyedAt || a.number - b.number);
}
