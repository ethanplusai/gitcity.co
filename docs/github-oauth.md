# GitHub sign-in setup

The authorization-code flow is implemented in `server/api.mjs`. You need a registered **GitHub OAuth App** and its credentials. A GitHub App is a different registration type.

## Local development

1. Open https://github.com/settings/developers → OAuth Apps → New OAuth App.
2. Set application name to `Gitcity development`, homepage URL to `http://localhost:3000`, and authorization callback URL to `http://localhost:3000/auth/callback`.
3. Register the app and generate a client secret. Keep your existing `.env` and its `GITHUB_TOKEN`; add or fill in:

   ```dotenv
   PORT=3000
   APP_ORIGIN=http://localhost:3000
   GITHUB_CLIENT_ID=your_client_id
   GITHUB_CLIENT_SECRET=your_client_secret
   ```

4. Restart `npm run dev`; custom server environment changes require a restart. Visit `http://localhost:3000`, open a city, select Sign in, then Continue with GitHub. The app returns you to that city and starts importing your history. Large histories take time; exploration stays available.
5. Optionally set `GITHUB_TOKEN` to a server-only token for the public repo API rate limit. This is separate from sign-in credentials. Never use a `NEXT_PUBLIC_` variable for either secret or token; `.env` is ignored by Git.

Use the same hostname throughout: localhost and 127.0.0.1 are different cookie/origin contexts. Device flow is unnecessary.

## Production at gitcity.co

Use a separate production OAuth App to isolate credentials:

| Setting | Value |
| --- | --- |
| Homepage URL | `https://gitcity.co` |
| Authorization callback URL | `https://gitcity.co/auth/callback` |
| Server `APP_ORIGIN` | `https://gitcity.co` |

Set `GITHUB_CLIENT_ID` and `GITHUB_CLIENT_SECRET` in the host's secret/environment settings. Use your actual canonical domain if different, without a trailing slash. Redirect www to that domain. Build with `npm run build`, start with `npm start`, and terminate HTTPS at the host or reverse proxy. The custom Node 24 server must handle `/auth/*` and `/api/*`; plain `next start` and a static export do not run these routes. Keep the SQLite data directory on a persistent volume.

Current sessions and one-time OAuth states live in server memory. Use one server instance for this alpha; restarts sign users out. Multiple instances require a shared session/state store (and a shared durable database strategy). No refresh-token storage is implemented: if GitHub issues an expiring token, the session ends at token expiry and the user signs in again.

## Vercel deployment

The Node API is exposed through `src/pages/api/[[...path]].ts`; `/auth/*` rewrites to it. Production requires `DATABASE_URL`, a migrated database, `SESSION_ENCRYPTION_KEY`, and the canonical HTTPS `APP_ORIGIN`, in addition to the existing GitHub variables. Sessions and OAuth states are encrypted in the database; OAuth state is consumed once, atomically. See [production-deployment.md](production-deployment.md).

Use separate preview and production databases and OAuth callbacks. A local two-instance test verifies the protocol with mocked GitHub responses; a real browser sign-in on the configured deployment remains a release check.

## What the flow does

- Requests `read:user` for profile access and `read:org` for membership/governance checks. No private repository or repository-write scope is requested. Organization OAuth restrictions may require an owner to approve the app before organization membership checks work.
- Uses a one-time state bound to an HttpOnly cookie and S256 PKCE, exchanges the code on the server, then fetches `/user` to establish identity.
- Keeps tokens off the browser and uses HttpOnly, SameSite=Lax session cookies, with Secure in production.
- Validates a local return path so a shared city/file URL survives sign-in.
- Imports contribution history through an idempotent ledger. Merely signing in or exploring cannot mint structure credits.

## Verification / troubleshooting

A real successful sign-in cannot be tested until the app credentials are installed. After setup, verify that `/api/session` reports `configured: true`, that GitHub redirects to `/auth/callback`, and that the passport shows the correct account and history import progress. Do not share the session response or cookies publicly.

- **Sign-in unavailable:** missing environment variables, or the Node server was not restarted.
- **Redirect mismatch:** callback and `APP_ORIGIN` differ in scheme, host, or port.
- **Sign-in expired:** another sign-in replaced the cookie, the ten-minute state expired,. Start sign-in again in the same browser.
- **Signed out immediately:** using production Secure cookies over HTTP, or requests reached another server instance.
- **Missing organization role:** verify the requested scopes, organization restrictions and current membership.

Official references: [Register an OAuth App](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/creating-an-oauth-app), [authorization flow and PKCE](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps), [OAuth scopes](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/scopes-for-oauth-apps).
