# Contributing to Gitcity

Use Node.js 24+ and `npm ci`. Start the application with `npm run dev`, not `next dev`: the custom server owns the GitHub and contribution endpoints.

Keep public shared links fast and account-free. A visitor must see the world constructing itself instead of a loading spinner. Source geometry must come from parsed code; unknown metrics, CI, history, usage, and permissions must not be replaced with made-up activity.

Keep currency issuance and spending server-authoritative, transactional, and idempotent. Validate a civic action against GitHub before mutating shared state. Never persist OAuth tokens in browser storage or check credentials into the repository.

Run `npm test`, `npm run lint`, and `npm run build`. Rendering or navigation changes should also pass `npm run test:browser` against a running local app and be visually checked at phone and desktop sizes. Browser tests use explicit fixtures; avoid live GitHub mutations in tests.

The README describes the current sampling and service bounds. Update those alongside changes to API coverage, persistence, governance, or rendering behavior.
