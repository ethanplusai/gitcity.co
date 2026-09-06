# Production readiness — September 6, 2026

Status: local application verified; not ready for the existing Vercel deployment. Nothing pushed or deployed. The prior broad graphics goal remains stopped. This is backend/deployment work.

## Recommended target if remaining on Vercel

Keep Next.js and static 3D assets on Vercel. Expose the existing GitHub/economy logic through Node-runtime API endpoints and OAuth routes. Use a managed relational database for durable state, shared expiring sessions, job checkpoints, and repository metadata caches. Postgres through the Vercel Marketplace is a conventional option; confirm the provider before implementing its adapter. Keep the database and functions in the same region. Preview deployments must use separate test data and credentials.

Vercel supports Express, so Express itself is not the blocker. This checkout starts Express and Next together in server/index.mjs; API/auth handlers are not currently exposed by its Next build. A supported Express deployment is another routing option, but it does not fix local SQLite or in-memory state.

Alternative: Vercel frontend proxies /api/* and /auth/* to a persistent Node backend with a persistent volume. This preserves synchronous SQLite transactions and most server code. It adds another hosted service, requires tested backups, and should initially use a single writer. Sessions and jobs still need restart-safe storage. Do not put mutable SQLite in a Vercel temporary directory or upload a database file after each request.

## Required changes and release evidence

| Area | Current evidence | Required change | Acceptance check |
| --- | --- | --- | --- |
| API/auth deployment | server/index.mjs owns all endpoints and starts next() + listen(); no Next API routes | Separate route handlers from process startup and expose supported Node routes | Preview serves JSON from /api/session and /api/atlas; /auth/github produces a valid redirect |
| Durable world/economy | server/store.mjs uses DatabaseSync and data/gitcity.sqlite | Managed DB adapter, schema migrations and transactional allocation/rewards; optionally import local world addresses | Restart and separate workers retain coordinates/ownership; concurrent claims never overlap and duplicate PR verification never rewards twice |
| Sessions/OAuth | sessions and oauthStates are Maps | Shared session records with hashed cookie IDs; encrypted GitHub tokens; expiring, atomically consumed OAuth state | Start sign-in on one instance and finish on another; replay rejected; logout revokes; no tokens in client responses/logs |
| History restoration | /api/sync responds 202 then runs an unawaited process-local task | Durable resumable jobs with checkpoints, leases/retries and bounded units of GitHub work; choose supported worker/workflow scheduling | Interrupt and resume across instances without skipped work or duplicate credits; progress survives restart |
| City cache/API budget | repo/source/atlas/directory caches live in Maps | Shared cache keyed by repository/ref; request coalescing; bounded parsing/concurrency; rate-limit backoff; warm featured Next.js snapshot | Cold/warm preview arrivals tested; API outage has a usable construction state; private/opt-out checks remain effective |
| Runtime/config | package Node >=24; local builds use webpack | Pin a supported Node major in project settings; npm run build now explicitly uses webpack; validate required env without logging values | Clean preview build, explicit DB configuration failure, no localhost auth/mutation origin |
| Release operations | Remote contains master only; no local Vercel project link | Confirm project production branch/domain, create tested nonproduction branch/preview, then promote reviewed commit to main | Real preview smoke checks, current production deployment recorded for rollback, database migration rollback strategy |

The database migration is not a mechanical connection-string swap. The store uses synchronous reads, SQLite-specific insert/conflict syntax, and BEGIN IMMEDIATE transactions. Coordinate allocation, purchases and upstream reward flows must retain atomicity under concurrent serverless requests. Both server/economy.mjs and server/accepted-work.mjs access the store directly and need the asynchronous adapter boundary as well.

## Account setup

After hosting choice is confirmed:

- All-Vercel: create/connect a managed database through the project's Storage/Marketplace flow. Choose a region alongside the app, enable available backups, and separate production from preview data. Review the provider's current pricing before provisioning a paid plan.
- Set server-only database credentials plus an encryption key for stored GitHub tokens once their exact variable names are defined by the adapter. Never use NEXT_PUBLIC_ for these.
- Existing GITHUB_TOKEN, GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET remain server-only. APP_ORIGIN must equal https://gitcity.co if that is the canonical production domain; OAuth callback is https://gitcity.co/auth/callback. Use a separate stable callback/app for preview sign-in testing as needed.
- Confirm Vercel's production branch is main. The remote currently exposes only master. Do not assume pushing an arbitrary branch will update the domain.

## Execution order

1. Choose hosting/database; separate backend startup from reusable handlers and establish a preview route smoke test.
2. Migrate transactional storage, sessions and OAuth; test separate-instance behavior and preserve existing world addresses if importing local data.
3. Make history jobs resumable; share city caches and bound public API work. Avoid adding multiple services if the database can support the initial job/cache workload.
4. Run a preview release with real GitHub sign-in, anonymous phone arrival, source/file entry, owner/repo URLs, accepted-PR retry, and persistence across redeploy. Verify no secrets or local database files enter the commit. Only then merge/push to main.

## Existing evidence and limits

160 local unit tests, lint and webpack build have passed; browser coverage includes arrival, orbit controls, construction replay, walking, phone viewport and file access. Those checks are not evidence for distributed DB transactions, live OAuth, physical-phone performance, provider configuration, or production deployment. Static asset directories currently total roughly 16 MB; do not include models/materials in API function bundles unnecessarily.

## Primary documentation checked

- [Express deployment support](https://vercel.com/docs/frameworks/backend/express)
- [SQLite and persistent storage on Vercel](https://vercel.com/kb/guide/is-sqlite-supported-in-vercel)
- [Storage integrations](https://vercel.com/docs/storage)
- [Durable workflows](https://vercel.com/docs/workflows)
- [Function limits](https://vercel.com/docs/functions/limitations)

Exact runtime, workflow availability and quotas must be checked against this project's selected plan. No Vercel account configuration was inspected through authenticated tooling in this audit.
