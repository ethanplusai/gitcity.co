import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldNotes, recordNotebookAcceptance } from '../shared/field-notes.mjs';
import { saveSurvey } from '../shared/street-life.mjs';

test('acceptance checkpoints follow only the exact tracked pull request', () => {
  const state = {
    'a/b#1': { note: 'Plan', surveyedAt: 10, pullRequest: 'https://github.com/a/b/pull/42' },
  };
  for (const [repo, number] of [
    ['a/b', 43],
    ['other/repo', 42],
    ['a/b', undefined],
  ])
    assert.equal(recordNotebookAcceptance(state, 'a/b#1', repo, number, 20), state);
  const accepted = recordNotebookAcceptance(state, 'a/b#1', 'a/b', 42, 20);
  assert.equal(fieldNotes(accepted, 'a/b')[0].verifiedAt, 20);
  assert.equal(fieldNotes(state, 'a/b')[0].verifiedAt, null);
  accepted['a/b#1'].pullRequest = 'https://github.com/a/b/pull/43';
  assert.equal(fieldNotes(accepted, 'a/b')[0].verifiedAt, null);
});

test('notebook retains old surveys and excludes unrelated or corrupt records', () => {
  const state = {
    'Owner/Repo#7': { note: 'Reproduce the crash', surveyedAt: 10 },
    'owner/repo#2': { note: 'Write a regression check', surveyedAt: 20, title: 'Crash on exit' },
    'owner/repository#7': { note: 'Different city', surveyedAt: 30 },
    'owner/repo#-3': { note: 'Invalid issue', surveyedAt: 30 },
    'owner/repo#4': { note: {}, surveyedAt: 30 },
    'owner/repo#5': null,
  };
  const result = fieldNotes(state, 'owner/repo');
  assert.deepEqual(
    result.map((n) => n.number),
    [2, 7],
  );
  assert.equal(result[1].title, '');
  assert.equal(result[0].title, 'Crash on exit');
  assert.equal(result[1].key, 'Owner/Repo#7');
  assert.deepEqual(fieldNotes(null, 'owner/repo'), []);
});

test('only an on-site survey creates a resumable notebook entry', () => {
  const empty = {};
  assert.deepEqual(fieldNotes(saveSurvey(empty, 'a/b', 1, 'Plan', 100, true), 'a/b'), []);
  const saved = saveSurvey(empty, 'a/b', 1, 'Plan', 1, true, 100);
  assert.equal(fieldNotes(saved, 'a/b')[0].note, 'Plan');
  assert.equal(fieldNotes(saved, 'a/b')[0].surveyedAt, 100);
});

test('notebook links stay in the investigated repository and survive revised notes', async () => {
  const { notebookPullRequest } = await import('../shared/field-notes.mjs');
  assert.equal(
    notebookPullRequest('https://github.com/Owner/Repo/pull/42#discussion', 'owner/repo'),
    'https://github.com/owner/repo/pull/42',
  );
  for (const url of [
    'javascript:alert(1)',
    'https://github.com.evil.test/owner/repo/pull/42',
    'https://github.com/a/b/pull/42',
    'https://github.com/owner/repo/issues/42',
    'https://user@github.com/owner/repo/pull/42',
  ])
    assert.equal(notebookPullRequest(url, 'owner/repo'), '');
  const saved = saveSurvey(
    {
      'owner/repo#1': {
        note: 'old',
        surveyedAt: 10,
        pullRequest: 'https://github.com/owner/repo/pull/42',
      },
    },
    'owner/repo',
    1,
    'Revised plan',
    1,
    true,
    20,
  );
  assert.equal(
    fieldNotes(saved, 'owner/repo')[0].pullRequest,
    'https://github.com/owner/repo/pull/42',
  );
});
