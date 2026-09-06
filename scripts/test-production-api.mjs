import assert from 'node:assert/strict';
import { once } from 'node:events';
import { randomBytes } from 'node:crypto';
import { database } from '../tests/helpers/database.mjs';
import { migrate } from '../server/postgres.mjs';
import { createPostgresStore } from '../server/postgres-store.mjs';
import { runtimeState } from '../server/runtime-state.mjs';
import { createApi } from '../server/api.mjs';
const db = await database(),
  servers = [],
  originalFetch = globalThis.fetch;
const originalId = process.env.GITHUB_CLIENT_ID,
  originalSecret = process.env.GITHUB_CLIENT_SECRET;
process.env.GITHUB_CLIENT_ID = 'test-client';
process.env.GITHUB_CLIENT_SECRET = 'test-secret';
try {
  await migrate(db);
  const key = randomBytes(32).toString('base64'),
    origin = 'https://gitcity.co';
  for (let i = 0; i < 2; i++) {
    const app = createApi({
      store: await createPostgresStore(db),
      runtime: runtimeState(db, key),
      origin,
      production: true,
    });
    const server = app.listen(0, '127.0.0.1');
    await once(server, 'listening');
    servers.push(server);
  }
  const url = (i) => `http://127.0.0.1:${servers[i].address().port}`;
  globalThis.fetch = async (input, options) => {
    const address = String(input);
    if (address === 'https://github.com/login/oauth/access_token')
      return Response.json({ access_token: 'test-github-token', expires_in: 3600 });
    if (address === 'https://api.github.com/user')
      return Response.json({ login: 'auth-test', created_at: '2020-01-01T00:00:00Z' });
    if (address.startsWith('https:')) throw new Error('Unexpected outbound test request');
    return originalFetch(input, options);
  };
  const start = await fetch(url(0) + '/auth/github?returnTo=/test/city', { redirect: 'manual' });
  assert.equal(start.status, 302);
  const location = new URL(start.headers.get('location'));
  assert.equal(location.searchParams.get('redirect_uri'), origin + '/auth/callback');
  const state = location.searchParams.get('state');
  const binding = start.headers.getSetCookie()[0].split(';')[0];
  assert.match(start.headers.getSetCookie()[0], /HttpOnly/);
  assert.match(start.headers.getSetCookie()[0], /Secure/);
  const callback = await fetch(url(1) + `/auth/callback?state=${state}&code=test-code`, {
    redirect: 'manual',
    headers: { cookie: binding },
  });
  assert.equal(callback.status, 302);
  assert.equal(callback.headers.get('location'), '/test/city?welcome=1');
  const sessionCookie = callback.headers
    .getSetCookie()
    .find((c) => c.startsWith('gitcity='))
    .split(';')[0];
  const signedIn = await fetch(url(0) + '/api/session', { headers: { cookie: sessionCookie } });
  const session = await signedIn.json();
  assert.equal(session.player.login, 'auth-test');
  assert.equal(JSON.stringify(session).includes('test-github-token'), false);
  const replay = await fetch(url(0) + `/auth/callback?state=${state}&code=test-code`, {
    redirect: 'manual',
    headers: { cookie: binding },
  });
  assert.equal(replay.status, 400);
  const csrf = await fetch(url(1) + '/api/logout', {
    method: 'POST',
    headers: { cookie: sessionCookie, origin: 'https://attacker.invalid' },
  });
  assert.equal(csrf.status, 403);
  const logout = await fetch(url(1) + '/api/logout', {
    method: 'POST',
    headers: { cookie: sessionCookie, origin },
  });
  assert.equal(logout.status, 200);
  assert.equal(
    (await (await fetch(url(0) + '/api/session', { headers: { cookie: sessionCookie } })).json())
      .player,
    null,
  );
  console.log(
    'PASS: two-instance OAuth callback, secure cookies, session retrieval, replay rejection, mutation origin and cross-instance logout.',
  );
} finally {
  globalThis.fetch = originalFetch;
  for (const server of servers) await new Promise((resolve) => server.close(resolve));
  await db.close();
  if (originalId === undefined) delete process.env.GITHUB_CLIENT_ID;
  else process.env.GITHUB_CLIENT_ID = originalId;
  if (originalSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
  else process.env.GITHUB_CLIENT_SECRET = originalSecret;
}
