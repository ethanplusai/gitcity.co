# Gitcity production deployment

The backend migration is implemented; external database provisioning and a real preview remain required. This runbook replaces the earlier persistent-server-only guidance. No release should proceed based only on a successful frontend build.

## Environment

Use Node 24.x and the Next.js framework preset. Build command: `npm run build` (webpack).

| Variable | Purpose |
| --- | --- |
| DATABASE_URL | Managed Postgres connection URL; provider SSL settings remain enabled |
| SESSION_ENCRYPTION_KEY | Base64-encoded 32 random bytes; AES-GCM encrypts stored GitHub credentials and OAuth state |
| APP_ORIGIN | Exact canonical origin, e.g. https://gitcity.co; no trailing slash |
| GITHUB_TOKEN | Public repository data requests |
| GITHUB_CLIENT_ID | Existing OAuth app identifier |
| GITHUB_CLIENT_SECRET | Existing OAuth secret |

Keep every variable server-only. Use separate databases and encryption keys for Preview and Production. OAuth callbacks must match the chosen origin; use a stable preview domain/separate OAuth app to test sign-in without redirecting to production. Encrypted sessions stop working if the encryption key changes; rotate deliberately and have users sign in again.

## Database setup

1. Connect a managed Postgres database (Neon recommended through the Vercel Marketplace). Place it near the functions, initially iad1/us-east. Confirm provider plan and backup retention before creating paid resources.
2. Set DATABASE_URL locally for the intended **preview** database without replacing existing GitHub credentials.
3. Run `npm run db:migrate`. Versioned migrations create the world/economy schema, encrypted session/state tables, resumable job records, shared cache leases, and request limits. Migration versions are recorded; rerunning is safe. Runtime requests do not run DDL.
4. If preserving the local world's addresses and earned state, back up SQLite and run `node --env-file-if-exists=.env scripts/import-world.mjs /path/to/backup.sqlite` before the destination first serves traffic. It refuses a nonempty destination and imports in one transaction. Sessions/caches/jobs are intentionally excluded. Do not point the importer at an already active production database.
5. Run the same migrations against Production with its own connection URL once Preview passes. Back up before any future migration; automatic app rollback does not undo schema changes.

## Verification and release

- `npm run check:release`: lint, local tests, PostgreSQL contract tests, two-instance HTTP OAuth/session tests with mocked GitHub, production build.
- PostgreSQL contract tests run in PGlite by default. `TEST_DATABASE_URL` can target a **fresh disposable** real Postgres database; never point test fixtures at Production. Real multi-connection/provider behavior still needs that run.
- Create a Vercel Preview. `node scripts/check-deployment.mjs https://preview-host` verifies JSON API routes, DB health, anonymous session configuration, and the populated featured-city snapshot. If deployment protection is enabled, authenticate the check through Vercel rather than exposing a bypass token in logs.
- Verify browser sign-in with the real GitHub app, logout, shared repo/file links, phone arrival, and navigation during construction. Verify a reward retry and that a redeploy retains world addresses and player data.
- Confirm the GitHub production branch setting before pushing. At audit time the remote contained master only and the current production deployment referenced master. User intends main as the eventual production branch.
- Record the prior production deployment, then promote/push the reviewed commit. Check the canonical domain again. App rollback is safe only while the schema remains compatible.

## Runtime behavior and known limits

- Production refuses SQLite fallback. Local development can still use data/gitcity.sqlite.
- Durable store operations use a short Postgres advisory transaction lock to retain the existing global nonoverlap/allocation guarantees. This intentionally favors correctness over write throughput for the first release; no GitHub calls run inside that store transaction.
- Repository and atlas caches are shared in Postgres, bounded by expiry and serialized-size caps. Cache leases coalesce work across instances. A visitor may receive a retry response while another instance prepares a city. No stale private/opted-out snapshot is served outside its existing verification/cache window.
- OAuth records are consumed atomically; tokens remain encrypted in shared sessions. Cookies are HttpOnly, SameSite=Lax and Secure in production. Mutations require the canonical Origin.
- History import does one saved unit per authenticated POST. The client drives further steps while restoration is open. Closing the tab pauses it; resuming continues saved progress. A crashed worker's lease expires, and the ledger prevents duplicate minting. There is no unattended scheduler in this first release.
- Inbound auth and expensive city requests have database-backed rate limits. GitHub limits can still pause restoration or surveys; the UI must remain usable in that state.
- Real-account OAuth, a physical phone, provider backup/restore, and production-scale throughput are not proven by local fixture tests.
