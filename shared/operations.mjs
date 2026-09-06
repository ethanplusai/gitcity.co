import { hash } from './model.mjs';
export const services = [
  {
    id: 'courier',
    name: 'Archive courier',
    description:
      'Carry a source archive between three neighborhood stops, then return to the depot.',
    verb: 'Deliver archive',
    reward: 60,
  },
  {
    id: 'survey',
    name: 'Street survey',
    description:
      'Survey three source parcels for the neighborhood atlas. Choose your route through the streets.',
    verb: 'Record survey',
    reward: 50,
  },
  {
    id: 'maintenance',
    name: 'Service round',
    description:
      'Visit three street service points and check in at the depot. A city-life activity, separate from GitHub changes.',
    verb: 'Service stop',
    reward: 70,
  },
];
export function contract(repo, kind, round = 0, neighbors = []) {
  const service = services.find((s) => s.id === kind);
  if (!service) throw new Error('Unknown city service');
  const files = [...repo.files].sort(
    (a, b) => hash(`${kind}:${round}:${a.path}`) - hash(`${kind}:${round}:${b.path}`),
  );
  if (!files.length) return null;
  const adjacent =
    kind === 'courier'
      ? neighbors
          .filter(
            (r) =>
              r.id !== repo.id &&
              r.id.split('/')[0].toLowerCase() === repo.id.split('/')[0].toLowerCase() &&
              r.files.length,
          )
          .sort((a, b) => a.id.localeCompare(b.id))
          .slice(0, 2)
      : [];
  const stops = adjacent.length
    ? [
        `${repo.id}/${files[0].path}`,
        ...adjacent.map(
          (r) =>
            `${r.id}/${[...r.files].sort((a, b) => hash(`${kind}:${round}:${a.path}`) - hash(`${kind}:${round}:${b.path}`))[0].path}`,
        ),
        ...(adjacent.length === 1 ? [`${repo.id}/${(files[1] || files[0]).path}`] : []),
        '@depot',
      ]
    : files
        .slice(0, 3)
        .map((f) => f.path)
        .concat('@depot');
  return {
    id: `${repo.id}:${kind}:${round}`,
    kind,
    repo: repo.id,
    round,
    stops,
    reward: service.reward,
  };
}
export function canService(distance, walking) {
  return walking && Number.isFinite(distance) && distance <= 1.8;
}
export function completeService(state, job, elapsed) {
  if (state.completed?.some((entry) => entry.id === job.id)) return state;
  const completed = [
    ...(state.completed || []),
    { id: job.id, kind: job.kind, seconds: Math.max(1, Math.round(elapsed)), repo: job.repo },
  ].slice(-500);
  return {
    ...state,
    completed,
    reputation: (state.reputation || 0) + job.reward,
    rounds: { ...state.rounds, [job.repo + ':' + job.kind]: job.round + 1 },
  };
}
