# Gitcity

## Commands
- `npm run dev` — custom Node/Express + Next development server on port 3000
- `npm run build` — production Next build and TypeScript check
- `npm start` — production custom server; requires the build and Node 24+
- `npm test` — core invariants and SQLite ledger tests
- `npm run lint` — application/server lint
- `npm run test:browser` — Chrome browser suite against localhost:3000 with API fixtures
- `npm run refresh:atlas` — fetch a verified, public source-metric atlas cache
- `npm run format` — format application code

## Architecture
- `src/components/WorldApp.tsx`: persistent React shell, URL/altitude navigation, dialogs, GitHub UI
- `src/world/engine.ts`: Three.js scene, camera, modular architecture, LOD, weather and construction
- `src/world/audio.ts`: opt-in procedural ambient sound
- `server/index.mjs`: API routes, OAuth, session and civic permission boundaries
- `server/github.mjs`: public source snapshots, SHA verification, code/history/dependency analysis
- `server/economy.mjs`: verified and resumable public contribution import
- `server/store.mjs`: transactional SQLite ownership/currency/idempotency ledger and coordinates
- `shared/`: deterministic generation and governance rules

No Canvas 2D renderer or legacy IsoCity simulation remains. Never introduce spinners, simulated GitHub activity, client-authoritative currency, or cosmetic edits to code-derived geometry. Unknown data must remain visibly unknown. Preserve the MIT license. Read README.md for operating bounds, deployment requirements and cache/opt-out behavior.


## Current city/game model
- An owner is a city; repos are its neighborhoods. `owner_cities`/`neighborhoods` version the old map; retain legacy `cities` and contribution records.
- Overview geometry must remain true 3D. `urban.ts` plans stable parcels and batches geometry; never restore billboard skyline sprites or tube highways.
- Construction is tracked per repo/file and must not restart because of camera movement or refresh.
- `CityOperations.tsx`, `shared/operations.mjs`, and `world/navigation.ts` implement local, repeat-safe service rounds. Service reputation is not GitHub contribution currency and has no server trust.
- Mission HUD uses a portal to escape the scrolling/backdrop-filtered repo panel. Mobile gameplay must keep the scene visible.
- `docs/city-game.md` distinguishes implemented gameplay from future cooperative simulation.
