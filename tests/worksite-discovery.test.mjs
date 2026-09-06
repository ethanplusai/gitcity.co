import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverWorksites, worksiteInvitation } from '../shared/worksite-discovery.mjs';

test('discovery prioritizes explicit maintainer invitations and unvisited sites without changing source order', () => {
  const issues = [
    { number: 8, labels: ['bug'] },
    { number: 3, labels: ['Help Wanted'] },
    { number: 4, labels: ['good-first-issue', 'documentation'] },
    { number: 1, labels: ['easy', 'beginner'] },
  ];
  const before = structuredClone(issues),
    notes = [{ number: 4 }];
  assert.deepEqual(
    discoverWorksites(issues, []).map((i) => i.number),
    [4, 3, 1, 8],
  );
  assert.deepEqual(
    discoverWorksites(issues, notes).map((i) => i.number),
    [3, 1, 8, 4],
  );
  assert.deepEqual(
    discoverWorksites(issues, notes, 'saved').map((i) => i.number),
    [4],
  );
  assert.deepEqual(
    discoverWorksites(issues, notes, 'unexplored').map((i) => i.number),
    [3, 1, 8],
  );
  assert.deepEqual(
    discoverWorksites(issues, notes, 'newcomer').map((i) => i.number),
    [4],
  );
  assert.deepEqual(
    discoverWorksites(issues, [], 'help').map((i) => i.number),
    [4, 3],
  );
  assert.deepEqual(
    discoverWorksites(issues, [], 'wayfinding').map((i) => i.number),
    [4],
  );
  assert.deepEqual(
    discoverWorksites(issues, [], 'pothole').map((i) => i.number),
    [8],
  );
  assert.equal(
    worksiteInvitation(issues[3]),
    '',
    'do not infer an invitation from difficulty labels',
  );
  assert.deepEqual(issues, before);
});
