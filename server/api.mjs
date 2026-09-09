import { ownerDirectoryCache } from './owner-directory.mjs';
import { sourceLayout } from './source-layout-async.mjs';
import express from 'express';
import { publicSnapshotAllowed, cachedRepository, cachedSource } from './cached-world.mjs';
import { pkce, returnPath } from './oauth.mjs';
import { randomBytes, createHash } from 'node:crypto';
import {
  github,
  repoData,
  districtData,
  directoryBlockData,
  fileData,
  validateRepo,
  reconcileData,
  sourceInventory,
} from './github.mjs';
import { readFile } from 'node:fs/promises';
import { ownersForPath } from '../shared/governance.mjs';
import { syncJobs } from './sync-jobs.mjs';
import { acceptPullRequest, pullRequestAddress } from './accepted-work.mjs';
export function createApi({
  store,
  runtime,
  origin,
  production = process.env.NODE_ENV === 'production',
}) {
  const app = express();
  const { db } = store;
  const { sessions, oauthStates } = runtime;
  const jobs = syncJobs(store);
  const digest = (s) => createHash('sha256').update(s).digest('hex');
  const cookie = (req, name) =>
    req.headers.cookie
      ?.split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(name + '='))
      ?.slice(name.length + 1);
  const configured = Boolean(process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET);
  const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: production, maxAge: 86400000 };
  app.disable('x-powered-by');
  app.use('/api/reconcile', express.json({ limit: '96kb' }));
  app.use(express.json({ limit: '8kb' }));
  app.use(async (req, res, next) => {
    const raw = cookie(req, 'gitcity'),
      key = raw ? digest(raw) : '',
      session = await sessions.get(key);
    req.sessionKey = key;
    if (session?.expires > Date.now()) req.session = session;
    else if (session) await sessions.delete(key);
    const category = req.path.startsWith('/auth/')
      ? 'auth'
      : /^\/api\/(repos|owners|atlas|issues|source|district|reconcile)\//.test(req.path) ||
          req.path === '/api/atlas'
        ? 'city'
        : null;
    if (category) {
      const remote = process.env.VERCEL
        ? String(req.headers['x-forwarded-for'] || '').split(',')[0]
        : req.ip;
      const identity = digest(String(remote || 'unknown') + process.env.SESSION_ENCRYPTION_KEY);
      if (!(await runtime.allow(category + ':' + identity, category === 'auth' ? 12 : 120))) {
        res.setHeader('Retry-After', '60');
        return res
          .status(429)
          .json({ error: 'Too many requests. Please wait a minute before continuing.' });
      }
    }
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    if (req.path.startsWith('/api')) res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'POST' && req.headers.origin !== origin)
      return res.status(403).json({ error: 'Origin mismatch' });
    next();
  });
  const auth = (req, res, next) =>
    req.session ? next() : res.status(401).json({ error: 'Sign in with GitHub to continue.' });
  const player = async (login) => ({
    ...(await db.prepare('SELECT * FROM players WHERE login=?').get(login)),
    possessions: await db.prepare('SELECT repo,item FROM possessions WHERE login=?').all(login),
  });
  // Cached source metrics remain private to the server until the repository's opt-out is checked.
  let atlasCache = null,
    atlasExpires = 0,
    atlasPending = null;
  app.get('/api/atlas', async (req, res, next) => {
    res.setHeader('Cache-Control', 'public, max-age=60');
    try {
      if (atlasCache && atlasExpires > Date.now()) return res.json(atlasCache);
      if (!atlasPending)
        atlasPending = runtime
          .cached('atlas:v2', 900000, async () => {
            const snapshots = JSON.parse(
              await readFile(new URL('./atlas.json', import.meta.url), 'utf8'),
            );
            const results = await Promise.all(
              await Promise.all(
                snapshots.map(async (snapshot) => {
                  try {
                    const meta = await github(`/repos/${snapshot.id}`, process.env.GITHUB_TOKEN);
                    if (meta.private || meta.topics?.includes('gitcity-opt-out')) return null;
                    try {
                      await github(
                        `/repos/${snapshot.id}/contents/.gitcity-opt-out`,
                        process.env.GITHUB_TOKEN,
                      );
                      return null;
                    } catch (e) {
                      if (e.status !== 404) return null;
                    }
                    return {
                      ...snapshot,
                      coordinates: await store.locate(snapshot.id),
                      ...(await addressedFiles(snapshot.id, snapshot.files)),
                      city: {
                        owner: snapshot.id.split('/')[0],
                        ...(await store.locateOwner(snapshot.id.split('/')[0])),
                      },
                    };
                  } catch (e) {
                    if ([403, 429].includes(e.status) && (await publicSnapshotAllowed(snapshot.id)))
                      return {
                        ...snapshot,
                        cached: true,
                        coordinates: await store.locate(snapshot.id),
                        ...(await addressedFiles(snapshot.id, snapshot.files)),
                        city: {
                          owner: snapshot.id.split('/')[0],
                          ...(await store.locateOwner(snapshot.id.split('/')[0])),
                        },
                      };
                    return null;
                  }
                }),
              ),
            );
            atlasCache = results.filter(Boolean);
            atlasExpires = Date.now() + 900000;
            return atlasCache;
          })
          .finally(() => (atlasPending = null));
      res.json(await atlasPending);
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/health', async (req, res) => {
    await db.prepare('SELECT 1 AS ready').get();
    res.json({ ok: true });
  });
  app.get('/api/session', async (req, res) =>
    res.json({ configured, player: req.session ? await player(req.session.login) : null }),
  );
  app.get('/api/issues/:owner/:repo/:number', async (req, res, next) => {
    try {
      if (!/^\d+$/.test(req.params.number))
        return res.status(400).json({ error: 'Invalid issue number' });
      await repoData(req.params.owner, req.params.repo);
      const issue = await github(
        `/repos/${req.params.owner}/${req.params.repo}/issues/${req.params.number}`,
        process.env.GITHUB_TOKEN,
      );
      if (issue.pull_request)
        return res.status(400).json({ error: 'This is a pull request, not an issue' });
      res.json({
        number: issue.number,
        state: issue.state,
        stateReason: issue.state_reason,
        updatedAt: issue.updated_at,
        url: issue.html_url,
      });
    } catch (error) {
      next(error);
    }
  });
  app.get('/auth/github', async (req, res) => {
    if (!configured) return res.redirect('/?auth=unconfigured');
    await runtime.cleanup();
    const state = randomBytes(24).toString('hex'),
      binding = randomBytes(24).toString('hex');
    const proof = pkce();
    await oauthStates.set(state, {
      binding: digest(binding),
      expires: Date.now() + 600000,
      verifier: proof.verifier,
      returnTo: returnPath(req.query.returnTo),
    });
    res.cookie('gitcity_oauth', binding, { ...cookieOptions, maxAge: 600000 });
    res.redirect(
      `https://github.com/login/oauth/authorize?client_id=${process.env.GITHUB_CLIENT_ID}&redirect_uri=${encodeURIComponent(origin + '/auth/callback')}&state=${state}&scope=read:user%20read:org&code_challenge=${proof.challenge}&code_challenge_method=S256`,
    );
  });
  app.get('/auth/callback', async (req, res, next) => {
    try {
      const state =
        typeof req.query.state === 'string' ? await oauthStates.take(req.query.state) : null;
      const binding = cookie(req, 'gitcity_oauth');
      if (!state || state.expires < Date.now() || !binding || state.binding !== digest(binding))
        return res.status(400).send('Sign-in expired. Return to Gitcity and try again.');
      res.clearCookie('gitcity_oauth');
      if (req.query.error || typeof req.query.code !== 'string')
        return res.redirect(state.returnTo + '?auth=denied');
      const response = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({
          client_id: process.env.GITHUB_CLIENT_ID,
          client_secret: process.env.GITHUB_CLIENT_SECRET,
          code: req.query.code,
          code_verifier: state.verifier,
          redirect_uri: origin + '/auth/callback',
        }),
        signal: AbortSignal.timeout(15000),
      });
      const tokenResponse = await response.json();
      const token = tokenResponse.access_token;
      const lifetime = Math.min(86400000, Number(tokenResponse.expires_in || 86400) * 1000);
      if (!token) throw new Error('GitHub did not authorize sign-in.');
      const user = await github('/user', token),
        raw = randomBytes(32).toString('hex');
      await sessions.set(digest(raw), {
        login: user.login,
        token,
        createdAt: user.created_at,
        expires: Date.now() + lifetime,
      });
      await db.prepare('INSERT OR IGNORE INTO players(login) VALUES(?)').run(user.login);
      res.cookie('gitcity', raw, { ...cookieOptions, maxAge: lifetime });
      res.redirect(state.returnTo + '?welcome=1');
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/logout', auth, async (req, res) => {
    await sessions.delete(req.sessionKey);
    res.clearCookie('gitcity');
    res.json({ ok: true });
  });
  const ownerDirectory = ownerDirectoryCache();
  app.get('/api/owners/:owner', async (req, res, next) => {
    try {
      validateRepo(req.params.owner, 'repo');
      const repos = await runtime.cached('owner:' + req.params.owner.toLowerCase(), 900000, () =>
        ownerDirectory(req.params.owner, (path) => github(path, process.env.GITHUB_TOKEN)),
      );
      res.setHeader('Cache-Control', 'public, max-age=60');
      res.json(
        await Promise.all(
          repos
            .filter((r) => !r.private && !r.topics?.includes('gitcity-opt-out'))
            .map(async (r) => ({
              id: r.full_name,
              name: r.name,
              language: r.language,
              stars: r.stargazers_count,
              archived: r.archived,
              fork: r.fork,
              description: r.description,
              ...(await store.locate(r.full_name)),
              city: { owner: r.owner.login, ...(await store.locateOwner(r.owner.login)) },
            })),
        ),
      );
    } catch (e) {
      if ([403, 429].includes(e.status)) {
        const snapshots = JSON.parse(
          await readFile(new URL('./atlas.json', import.meta.url), 'utf8'),
        );
        const matches = (
          await Promise.all(
            snapshots
              .filter((s) => s.id.split('/')[0].toLowerCase() === req.params.owner.toLowerCase())
              .map((s) => cachedRepository(s.id)),
          )
        ).filter(Boolean);
        if (matches.length)
          return res.json(
            await Promise.all(
              matches.map(async (data) => ({
                id: data.id,
                name: data.name,
                language: data.language,
                cached: true,
                ...(await store.locate(data.id)),
                city: { owner: req.params.owner, ...(await store.locateOwner(req.params.owner)) },
              })),
            ),
          );
      }
      next(e);
    }
  });
  app.get('/api/repos/:owner/:repo', async (req, res, next) => {
    try {
      let data;
      try {
        data = await repoData(req.params.owner, req.params.repo);
      } catch (e) {
        if ([403, 429].includes(e.status))
          data = await cachedRepository(`${req.params.owner}/${req.params.repo}`);
        if (!data) throw e;
      }
      const position = await store.locate(data.id);
      const sources = await addressedFiles(data.id, data.files, data.ref);
      res.json({
        ...data,
        coordinates: position,
        ...sources,
        city: { owner: data.id.split('/')[0], ...(await store.locateOwner(data.id.split('/')[0])) },
        residents: await db
          .prepare('SELECT login,path,pr FROM ownership WHERE repo=?')
          .all(data.id),
        civic: await db
          .prepare("SELECT login,item FROM possessions WHERE repo=? AND item='pavilion'")
          .all(data.id),
        treasury:
          (await db.prepare('SELECT balance FROM treasury WHERE repo=?').get(data.id))?.balance ||
          0,
      });
    } catch (e) {
      next(e);
    }
  });
  async function addressedFiles(id, files, ref) {
    return await sourceLayout(store, id, files, sourceInventory(id, ref), ref);
  }
  async function addressedSources(req, files, ref) {
    return await addressedFiles(`${req.params.owner}/${req.params.repo}`, files, ref);
  }
  app.get('/api/source/:owner/:repo', async (req, res, next) => {
    try {
      const path = String(req.query.path || '');
      if (!path || path.length > 1000)
        return res.status(400).json({ error: 'A file path is required.' });
      try {
        const result = await fileData(req.params.owner, req.params.repo, path);
        const sources = await addressedSources(req, [result.file], result.ref);
        res.json({
          ...result,
          landPlan: sources.landPlan,
          sourceInventory: sources.sourceInventory,
          file: sources.files[0],
        });
      } catch (e) {
        const fallback =
          [403, 429].includes(e.status) &&
          (await cachedSource(`${req.params.owner}/${req.params.repo}`, path));
        if (!fallback) throw e;
        const sources = await addressedSources(req, [fallback.file]);
        res.json({
          ...fallback,
          landPlan: sources.landPlan,
          sourceInventory: sources.sourceInventory,
          file: sources.files[0],
        });
      }
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/reconcile/:owner/:repo', async (req, res, next) => {
    try {
      const result = await reconcileData(
        req.params.owner,
        req.params.repo,
        req.body?.ref,
        req.body?.files,
      );
      res.json({ ...result, ...(await addressedSources(req, result.files, result.ref)) });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/district/:owner/:repo', async (req, res, next) => {
    try {
      const directory = String(req.query.directory || '.');
      const result =
        req.query.block !== undefined
          ? await directoryBlockData(
              req.params.owner,
              req.params.repo,
              directory,
              /^\d+$/.test(String(req.query.block)) ? Number(req.query.block) : NaN,
              String(req.query.ref || ''),
              async (id, inventory) => {
                await store.directoryInventory(id, inventory.paths);
                return await store.inventoryBlockPaths(id, directory, Number(req.query.block));
              },
            )
          : await districtData(
              req.params.owner,
              req.params.repo,
              directory,
              String(req.query.cursor || ''),
            );
      res.json({ ...result, ...(await addressedSources(req, result.files, result.ref)) });
    } catch (e) {
      next(e);
    }
  });
  app.get('/api/governance/:owner/:repo', async (req, res, next) => {
    try {
      const data = await repoData(req.params.owner, req.params.repo);
      if (!req.session)
        return res.json({ role: 'Tourist', districtRole: null, owners: [], scopes: [] });
      const { login, token } = req.session,
        meta = await github(`/repos/${data.id}`, token);
      const owners = ownersForPath(data.codeowners, String(req.query.path || ''));
      let owns = owners.some((o) => o.toLowerCase() === `@${login.toLowerCase()}`);
      for (const team of owners.filter((o) => o.includes('/'))) {
        const [org, slug] = team.slice(1).split('/');
        try {
          const membership = await github(`/orgs/${org}/teams/${slug}/memberships/${login}`, token);
          if (membership.state === 'active') owns = true;
        } catch {}
      }
      const mayor = Boolean(
        meta.permissions?.push || meta.permissions?.maintain || meta.permissions?.admin,
      );
      const resident = Boolean(
        await db
          .prepare("SELECT 1 FROM possessions WHERE login=? AND repo=? AND item='resident'")
          .get(login, data.id),
      );
      const scopes = data.codeowners
        .split('\n')
        .filter(
          (line) =>
            line.trim() &&
            !line.trim().startsWith('#') &&
            line.split(/\s+/).some((word) => word.toLowerCase() === `@${login.toLowerCase()}`),
        )
        .map((line) => line.trim().split(/\s+/)[0]);
      res.json({
        role: mayor ? 'Mayor' : resident ? 'Resident' : 'Tourist',
        districtRole: owns ? 'Alderman' : null,
        owners,
        scopes,
        verifiedAt: new Date().toISOString(),
      });
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/contributions/verify', auth, async (req, res, next) => {
    try {
      let address;
      try {
        address = pullRequestAddress(req.body.url);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
      const result = await acceptPullRequest(req.session, store, address, { github, repoData });
      res.json({ ...result, player: await player(req.session.login) });
    } catch (error) {
      next(error);
    }
  });
  app.post('/api/sync', auth, async (req, res) =>
    res.json(await jobs.step(req.session, req.body?.restart === true)),
  );
  app.get('/api/sync', auth, async (req, res) => res.json(await jobs.get(req.session.login)));
  app.post('/api/purchase', auth, async (req, res, next) => {
    try {
      const { repo, item } = req.body;
      if (typeof repo !== 'string' || !/^[-\w.]+\/[-\w.]+$/.test(repo))
        return res.status(400).json({ error: 'Unknown city.' });
      const [owner, name] = repo.split('/');
      const city = await repoData(owner, name);
      await store.purchase(req.session.login, city.id, item);
      res.json({ ok: true, player: await player(req.session.login) });
    } catch (e) {
      next(e);
    }
  });
  app.post('/api/civic/pavilion', auth, async (req, res, next) => {
    try {
      const repo = String(req.body.repo || '');
      const [owner, name] = repo.split('/');
      const city = await repoData(owner || '', name || '');
      const permissions = (await github(`/repos/${city.id}`, req.session.token)).permissions;
      if (!permissions?.push && !permissions?.maintain && !permissions?.admin)
        return res
          .status(403)
          .json({ error: 'GitHub merge rights are required to manage the civic treasury.' });
      await store.buildCivic(city.id);
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.use('/api', (req, res) => res.status(404).json({ error: 'Unknown endpoint.' }));
  app.use((error, req, res, next) => {
    console.error('API request failed', { path: req.path, status: error.status || 500 });
    res.status(error.status >= 400 && error.status < 600 ? error.status : 500).json({
      error:
        error.status && error.status < 500
          ? error.message
          : 'The city could not be reached. Please retry.',
    });
  });
  return app;
}
