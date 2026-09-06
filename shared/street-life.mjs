import { hash } from './model.mjs';
/** @param {number|null|undefined} stars @param {number|null|undefined} weekly */
export function cityPopulation(stars, weekly = null) {
  const known = Number.isFinite(stars) && stars >= 0;
  const visitors = known && stars > 0 ? Math.min(80, Math.ceil(Math.log2(stars + 1) * 5)) : 0;
  const usageKnown = Number.isFinite(weekly) && weekly >= 0;
  const cars = usageKnown
    ? weekly > 0
      ? Math.min(20, Math.ceil(Math.log10(weekly + 1) * 3))
      : 0
    : known && stars > 0
      ? Math.min(12, Math.ceil(Math.log10(stars + 1) * 2))
      : 0;
  return { visitors, cars, known, trafficSource: usageKnown ? 'package usage' : 'star interest' };
}
export function issueKind(issue) {
  const labels = (issue.labels || []).map((l) =>
    typeof l === 'string' ? l.toLowerCase() : l.name?.toLowerCase() || '',
  );
  if (labels.some((l) => /\bbug\b|defect/.test(l))) return 'pothole';
  if (labels.some((l) => /documentation|\bdocs?\b/.test(l))) return 'wayfinding';
  if (labels.some((l) => /enhancement|feature/.test(l))) return 'worksite';
  return 'notice';
}
export const issueKinds = {
  pothole: {
    name: 'Road repair',
    action: 'Survey pothole',
    meaning: 'A bug-labelled GitHub issue',
  },
  wayfinding: {
    name: 'Wayfinding repair',
    action: 'Inspect sign',
    meaning: 'A documentation-labelled GitHub issue',
  },
  worksite: {
    name: 'Proposed works',
    action: 'Survey site',
    meaning: 'A feature or enhancement request',
  },
  notice: { name: 'Community notice', action: 'Read notice', meaning: 'An open GitHub issue' },
};
export function workOrders(repo, side, addresses = new Map()) {
  const slots = Math.max(48, side * 48),
    used = new Set(addresses.values());
  return [...(repo.issues || [])]
    .sort((a, b) => a.number - b.number)
    .slice(0, 12)
    .map((issue) => {
      let slot = addresses.get(issue.number);
      if (slot === undefined) {
        slot = hash(`${repo.id}#${issue.number}`) % slots;
        let attempts = 0;
        while (used.has(slot) && attempts++ < slots) slot = (slot + 1) % slots;
        addresses.set(issue.number, slot);
        used.add(slot);
      }
      const edge = Math.floor(slot / (slots / 4)),
        u = ((slot % (slots / 4)) + 0.5) / (slots / 4),
        span = side * 24;
      const along = (u - 0.5) * (span - 6),
        curb = side * 12 - 0.85;
      const x = edge === 0 ? along : edge === 1 ? curb : edge === 2 ? -along : -curb;
      const z = edge === 0 ? -curb : edge === 1 ? along : edge === 2 ? curb : -along;
      return {
        ...issue,
        kind: issueKind(issue),
        x,
        z,
        heading: edge % 2 === 0 ? 0 : Math.PI / 2,
        relatedPath:
          (repo.files || []).find((f) => (issue.body || '').includes(f.path))?.path || null,
      };
    });
}
export function canSurvey(distance, walking) {
  return walking && Number.isFinite(distance) && distance <= 1.8;
}
export function saveSurvey(state, repo, issue, note, distance, walking, now = Date.now()) {
  if (!canSurvey(distance, walking)) return state;
  const key = `${repo}#${issue}`;
  return { ...state, [key]: { ...state[key], note: String(note).slice(0, 2000), surveyedAt: now } };
}
