# Gitcity stopping point

Feature work stopped at the user's request after the extended rebuild did not deliver the requested visual improvement. Do not resume the broad goal automatically. The realistic-city vision is unfinished.

## Local review

- App: http://localhost:3010
- Working tree: /Users/ethanrogers/Projects/gitcity
- Branch: master; extensive rebuild changes remain uncommitted, including untracked source/assets and intentional removal of the old renderer. Preserve the worktree; do not use a blanket reset or clean.
- Nothing from this wrap-up was committed, pushed or deployed.
- Existing development server was left running. To restart if needed: `PORT=3010 APP_ORIGIN=http://localhost:3010 npm run dev`.

## Cleanup and evidence

Removed only the interrupted curved-street integration from directory-block, directory-courts and directory-massing. The standalone shared/directory-curves.mjs prototype and its tests remain disconnected from the app for reference. The live layout is the previous verified straight-street layout with mixed neighborhood orientations.

Final `npm test`: 159 passing. Final `npx next build --webpack`: passing. Local homepage HTTP 200. Logs: /private/tmp/gitcity-wrapup-tests.log and /private/tmp/gitcity-wrapup-build.log. Prior browser evidence and detailed changes are recorded in docs/world-redesign-progress.md; no new full browser sweep was run during wrap-up.

## Existing implementation

Continuous 3D exploration and GitHub-derived districts, source buildings, dependency connections, walking guidance, simulated street life, issue discovery, local contribution plans, and server-verified contribution recognition flows. Recent art work includes scanned/GPU-compressed surfaces, civic paving/seating/lighting, pedestrian finishes/idle poses, and kerb detailing.

## Material limitations

Visual quality and organic urban composition remain substantially below the requested target. Most recent art changes were incremental. Recurring gameplay, whole-world resource budgets and physical-phone performance remain incomplete. Real-account OAuth/merge acceptance has not been verified end to end. SQLite/local process state is not a completed durable Vercel production solution. Automated fixture checks do not prove these requirements.

## Recommendation if the project is resumed deliberately

First choose a concrete visual reference and one representative neighborhood. Set a short, explicit time limit and review side-by-side street/overview captures before expanding scope. Treat a stronger architecture/vegetation/character asset kit and urban composition as the primary art work; avoid another open-ended micro-polish run. Production storage and live OAuth should be separate bounded tasks. No additional work is authorized by this recommendation alone.

## Follow-up: bounded arrival experience (September 6)

At the user's explicit request, improved arrival only; the broad realism goal remains stopped. Searches now use a themed survey overlay, frame every public repository in an owner directory before detail, and retain that camera framing while source previews arrive. Unknown districts display neutral survey grids, never fabricated source buildings. Directory pagination includes more than 100 repositories, coalesces concurrent requests and caches metadata for 15 minutes. Homepage now opens the Vue community, prioritizes its cached core snapshot, and includes the full directory (124 public repositories at verification). Overview labels collapse by community and avoid overlap.

Validation: 160 unit tests passing; lint and webpack production build passing; delayed directory/detail browser regression passing (no camera reframe), phone owner/repo links, walking across districts, civic/file entry and clean shaders. Real Vue landing inspected on desktop and phone; warm local directory response measured about 2 ms. Latest app remains http://localhost:3010. Nothing pushed or deployed.

Limitations: complete directory footprint does not mean every repo has preloaded source geometry. Vue core uses the bundled source snapshot; other districts resolve progressively. Metadata cache is per server process, with short public HTTP caching; durable shared production caching remains separate work. Physical-phone performance and live Vercel behavior were not validated here.

### Arrival correction after user review

The full Vue directory was a poor homepage composition, and the blocking blueprint screen was rejected. Supersedes the preceding arrival description: homepage now prioritizes the cached Next.js snapshot and frames a populated cluster at a low aerial altitude. It no longer waits for or inserts an entire owner directory on landing. Owner searches still show their complete directory.

Loading now uses a small noninteractive status notice over the live world. Repository arrivals use an aerial neighborhood view instead of automatically entering the street. Pointer, keyboard and zoom input during loading prevent the data response from overriding the visitor's camera; automatic owner framing is a smooth flight. Initial owner previews rise in small commit-ordered building batches, with repeat visits/detail changes avoiding replay. Reduced-motion preference skips the animation. Explicit street entry and file links retain their intended behavior.

Validation: 160 unit tests, lint, webpack build, and civic/file/walking browser checks pass. Desktop and phone populated landing screenshots: /private/tmp/gitcity-populated-landing.png and /private/tmp/gitcity-populated-landing-phone.png. Source cache coverage and durable production storage limitations remain unchanged. Still local only at port 3010; no deployment.

## Production backend preparation (September 6)

User explicitly authorized working through production readiness on Vercel. Implemented reusable Express API handlers, a Next Node API catch-all plus auth rewrites, managed Postgres store and three versioned migrations, encrypted shared OAuth/session records, checkpointed request-driven history restoration, shared source/atlas/directory caching with cross-instance leases, database request limits, and an empty-destination-only SQLite world importer. Local SQLite remains a development option; production requires Postgres and an encryption key.

Release scripts: npm run check:release, npm run db:migrate, node scripts/check-deployment.mjs URL. GitHub Actions workflow runs checks on non-main pushes/PRs. Detailed steps: docs/production-deployment.md. Core rendering behavior is unchanged in this backend task.

Evidence: 161 unit tests (including PostgreSQL/PGlite contract and migration/import/cache tests), lint, production build with /api/[[...path]], isolated two-instance OAuth/session/logout HTTP tests, local HTTP health/session/featured-atlas smoke checks, and civic/file/walking phone browser regression pass. PGlite is not a substitute for testing the provisioned provider with separate actual connections. Real GitHub sign-in on a deployed preview remains unverified.

Vercel CLI login exists as ethanplusai. Checkout is linked to team ethans-projects-2b4b9f7d / project gitcity (prj_UMKSRKbjSD836bfnFbvZC1XC4F3S). Existing Production GitHub token/client ID/client secret were confirmed by names only and preserved. Added Production APP_ORIGIN=https://gitcity.co and SESSION_ENCRYPTION_KEY via stdin; local .env has the encryption key. Link command created ignored .env.local/OIDC metadata. Never commit either env file or .vercel.

Neon provisioning attempted with free_v3, iad1, auth=false, name gitcity-production, Production only, no env pull. No database was created: CLI requires human marketplace terms acceptance at https://vercel.com/ethans-projects-2b4b9f7d/~/integrations/accept-terms/neon?source=cli. User was asked to complete it. Once accepted, retry provisioning, create isolated preview storage, migrate/test, configure preview env/callback, then prepare the release. No DATABASE_URL exists locally yet. No application deployment or Git push was performed.

Existing live deployment to preserve for rollback: dpl_AkvmEfXsweuCPyoap64iK1DBef79 / https://gitcity-k092g0kzz-ethans-projects-2b4b9f7d.vercel.app; gitcity.co and master alias point there. Confirm/change production branch to main only when ready. Local dev server restarted on port 3010, PID 64604, session 96670. Extensive worktree remains uncommitted; preserve it.
