import test from 'node:test';
import assert from 'node:assert/strict';
import { contract, completeService } from '../shared/operations.mjs';

test('courier contracts connect real same-owner destinations and keep origin-scoped rewards', () => {
  const repo = { id: 'studio/engine', files: [{ path: 'src/main.ts' }, { path: 'src/api.ts' }] };
  const neighbors = ['studio/ui', 'studio/docs', 'elsewhere/library'].map((id) => ({
    id,
    files: [{ path: 'index.ts' }],
  }));
  const job = contract(repo, 'courier', 2, neighbors);
  assert.deepEqual(job, contract(repo, 'courier', 2, [...neighbors].reverse()));
  assert.equal(job.stops.length, 4);
  assert.ok(job.stops.some((p) => p.startsWith('studio/ui/')));
  assert.ok(job.stops.some((p) => p.startsWith('studio/docs/')));
  assert.ok(!job.stops.some((p) => p.startsWith('elsewhere/')));
  assert.equal(job.stops.at(-1), '@depot');
  const result = completeService({ reputation: 0, rounds: {}, completed: [] }, job, 100);
  assert.equal(result.rounds['studio/engine:courier'], 3);
  assert.equal(result.reputation, 60);
  assert.deepEqual(completeService(result, job, 200), result);
  assert.ok(contract(repo, 'survey', 0, neighbors).stops.includes('src/main.ts'));
});
