import { issueKind } from './street-life.mjs';
export function worksiteInvitation(issue) {
  const labels = (issue.labels || []).map((label) =>
    String(typeof label === 'string' ? label : label.name || '')
      .toLowerCase()
      .replace(/[-_]+/g, ' ')
      .trim()
      .replace(/\s+/g, ' '),
  );
  if (labels.includes('good first issue')) return 'Good first issue';
  if (labels.includes('help wanted')) return 'Help wanted';
  return '';
}
export function discoverWorksites(issues, notes, filter = 'all') {
  const saved = new Set(notes.map((note) => note.number));
  return issues
    .filter((issue) => {
      if (filter === 'newcomer') return worksiteInvitation(issue) === 'Good first issue';
      if (filter === 'help') return worksiteInvitation(issue) !== '';
      if (filter === 'unexplored') return !saved.has(issue.number);
      if (filter === 'saved') return saved.has(issue.number);
      if (['pothole', 'wayfinding', 'worksite'].includes(filter))
        return issueKind(issue) === filter;
      return true;
    })
    .sort((a, b) => {
      const rank = (issue) =>
        saved.has(issue.number)
          ? 3
          : worksiteInvitation(issue) === 'Good first issue'
            ? 0
            : worksiteInvitation(issue)
              ? 1
              : 2;
      return rank(a) - rank(b) || a.number - b.number;
    });
}
