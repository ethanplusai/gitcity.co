import test from 'node:test';
import assert from 'node:assert/strict';
import { requestQuery } from '../server/request-query.mjs';
test('API query preserves source paths independently of the Next catch-all parameter', () => {
  assert.equal(
    requestQuery('/api/source/vuejs/core?path=packages%2Fruntime-core%2Fsrc%2Findex.ts').path,
    'packages/runtime-core/src/index.ts',
  );
  assert.deepEqual(
    { ...requestQuery('/auth/callback?code=abc&state=xyz') },
    { code: 'abc', state: 'xyz' },
  );
  assert.deepEqual(requestQuery('/api/test?path=a&path=b').path, ['a', 'b']);
  assert.equal(Object.getPrototypeOf(requestQuery('/api/test?__proto__=value')), null);
});
