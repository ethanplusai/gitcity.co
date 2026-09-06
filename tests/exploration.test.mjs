import test from 'node:test';
import assert from 'node:assert/strict';
import { discover, expedition } from '../shared/exploration.mjs';
import { pkce, returnPath } from '../server/oauth.mjs';
import { createHash } from 'node:crypto';
test('exploration is repeat-safe, city-scoped and survives serialization', () => {
  let journal = discover([], 'a/b', 'city');
  for (const path of ['a.ts', 'b.ts', 'c.ts', 'a.ts'])
    journal = discover(journal, 'a/b', 'file', path);
  journal = discover(journal, 'a/b', 'hall');
  assert.deepEqual(expedition(JSON.parse(JSON.stringify(journal)), 'a/b'), {
    buildings: 3,
    hall: true,
    cities: 1,
    xp: 80,
    complete: true,
  });
  assert.equal(expedition(journal, 'c/d').complete, false);
});
test('OAuth uses unique S256 proof and only returns to local city paths', () => {
  const proof = pkce();
  assert.equal(proof.challenge, createHash('sha256').update(proof.verifier).digest('base64url'));
  assert.notEqual(proof.verifier, pkce().verifier);
  for (const path of [
    'https://evil.test',
    '//evil.test',
    '/\\evil.test',
    '/auth/github',
    '/\nevil',
  ])
    assert.equal(returnPath(path), '/');
  assert.equal(returnPath('/a/b/src/main.ts?old=1'), '/a/b/src/main.ts');
});
