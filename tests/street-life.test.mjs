import test from 'node:test';
import assert from 'node:assert/strict';
import { cityPopulation, issueKind, workOrders, saveSurvey } from '../shared/street-life.mjs';
test('street life represents known interest and remains bounded at GitHub scale', () => {
  assert.equal(cityPopulation(null).visitors, 0);
  assert.equal(cityPopulation(0).cars, 0);
  assert.equal(cityPopulation(1000000, 1000000000).visitors, 80);
  assert.equal(cityPopulation(1000000, 1000000000).cars, 20);
  assert.equal(cityPopulation(100, 0).cars, 0);
  assert.equal(cityPopulation(100, 20).trafficSource, 'package usage');
  assert.ok(cityPopulation(200).visitors >= cityPopulation(100).visitors);
});
test('issue labels choose problems without inventing severity from titles', () => {
  assert.equal(issueKind({ title: 'Bug report' }), 'notice');
  assert.equal(issueKind({ labels: ['bug'] }), 'pothole');
  assert.equal(issueKind({ labels: [{ name: 'documentation' }] }), 'wayfinding');
  assert.equal(issueKind({ labels: ['enhancement'] }), 'worksite');
});
test('issue street addresses survive new samples and source links require evidence', () => {
  const addresses = new Map(),
    repo = {
      id: 'a/b',
      files: [{ path: 'src/main.ts' }],
      issues: [{ number: 20, body: 'See src/main.ts' }],
    };
  const original = workOrders(repo, 2, addresses)[0];
  const expanded = workOrders(
    { ...repo, issues: [{ number: 1 }, ...repo.issues] },
    2,
    addresses,
  ).find((i) => i.number === 20);
  assert.deepEqual(expanded, original);
  assert.equal(original.relatedPath, 'src/main.ts');
  assert.deepEqual(workOrders(repo, 2)[0], original);
});
test('field notes require physical presence and never mint contribution currency', () => {
  const state = {};
  assert.equal(saveSurvey(state, 'a/b', 1, 'plan', 20, true), state);
  assert.equal(saveSurvey(state, 'a/b', 1, 'plan', 1, false), state);
  assert.equal(saveSurvey(state, 'a/b', 1, 'plan', NaN, true), state);
  assert.deepEqual(saveSurvey(state, 'a/b', 1, 'plan', 1, true, 42), {
    'a/b#1': { note: 'plan', surveyedAt: 42 },
  });
});
