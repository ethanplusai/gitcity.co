# Gitcity: a civic co-op built on real software

## The place

A GitHub user or organization is a **city**. Its repositories are **neighborhoods**. Directories organize **blocks**, and source files determine the buildings. Contributors can have a hometown and belong to several other cities through accepted work. A large organization should feel like one connected metropolitan place, not a collection of unrelated worlds.

The URL stays geographical: `/` opens the world in a real 3D city view, `/owner` frames a city, `/owner/repo` enters a neighborhood, and a file path enters a source building. Repository neighborhoods share their owner's address space. Exploring a previously unknown repo allocates a permanent neighboring parcel. A neighborhood may appear empty while its actual source data is being read; population must never be invented to fill a skyline.

## The game

The long-term direction is a civic co-op: **a place worth returning to even when you are not writing code**. Players need short activities, medium-term personal goals and long-term shared projects. Walking through a visualization is only the introduction.

The useful distinction is between the city's physical capacity and how people use it:

- GitHub establishes physical capacity, dependencies, accepted contributions and civic authority. It is the source of truth for structural growth.
- Playing creates experience, relationships, service performance and presentation choices. These can change how a place feels and operates without manufacturing code activity.
- Community decisions spend actually earned structural resources. Gameplay reputation cannot be exchanged for merged contributions or building capacity.

## Playable in this build

Anonymous visitors can take an archive courier, street survey or service round. Each has three destinations selected deterministically from real source files, then a return to the neighborhood depot. The player travels actual streets, sees their location and destination on a minimap, and must be physically near a stop to interact. WASD/arrows walk, Shift runs, E interacts; Follow streets provides an accessible touch-friendly route through intersections. Buildings block movement. Looking at a destination from the air cannot complete a stop.

Completing a round records service reputation, steward level, a personal best and a new route rotation. Abandoning a round earns nothing. Completed progress survives reload on the same device. It is explicitly a local single-player prototype; the timer and reputation are not trusted server economy data. An unfinished round is abandoned on leaving its neighborhood. The three job themes currently share the same travel-and-service core; specialized cargo, surveying tools and maintenance puzzles are not implemented yet.

The HUD lives outside the scrolling repository panel, which gets out of the way during a round. Source exploration, real GitHub issues at city hall and contribution ownership remain available outside a round.

## Next systems, in order

1. **Make each activity play differently.** Courier routes need cargo capacity and a choice between direct delivery and depot resupply. Surveying should require framing a landmark and revealing something about the code. Maintenance should have a small hands-on repair task. Time alone is not sufficient depth.
2. **Give neighborhoods an operating state.** Use bounded, server-authoritative service needs derived from repository size and verified activity. Players choose which service to improve. Success changes presentation and service availability, never claims that CI passed or a file was maintained on GitHub.
3. **Add asynchronous cooperation.** Shared route boards, a record of who serviced a place, scheduled gatherings and public project proposals make another person's work visible. No real-time crowd simulation is needed to make the first cooperative loop useful.
4. **Make dependencies an economy network.** Dependent neighborhoods become actual delivery destinations. Connect routes through street-edge terminals. Upstream contribution funding remains conserved and auditable; game cargo must be a separately named resource with no conversion into hard contribution currency.
5. **Bring players back to contribution.** A city hall issue becomes a contribution contract. The game opens the real issue, identifies the relevant source neighborhood, and tracks an actual accepted PR. The return visit reveals the contributor's name on their building. This is the bridge from playing in a place to improving its underlying software.

Do not start with survival meters, mandatory daily chores, simulated commits, or a shop full of purchasable skyscrapers. The city should invite care, not punish absence. Public service tasks should be optional and bounded, not an infinite grind that crowds out real contribution.

## Rendering contract

- Every city view contains real mesh geometry. No baked skyline billboards or perspective-locked sprites.
- The overview and detailed neighborhood use the same architecture and parcel planning. Overview meshes are merged by finish to reduce draw calls.
- Each source building constructs at most once during a visit session. Source refreshes may reveal new files, but camera movement and return visits do not replay the city rising.
- Navigation does not trigger implicit directory expansion/replacement. Source data is expanded through explicit file/directory requests.
- Dependency roads use a flat road surface. They leave from the neighborhood edge, never as raised cylindrical tubes through the center.
- Broader building footprints, restrained materials, set-back upper floors, balconies, roof details, sidewalks, street trees, masonry canal edges and bridges provide urban scale. Public landscape is baseline presentation, not a claim about accepted contributions.

## Versioned geography

The former repo-as-city coordinate table is retained untouched. The new `owner_cities` and `neighborhoods` tables form a versioned map, with permanent positions within this model. Existing player balances, contribution ledger, ownership and possessions are preserved. This changes the alpha's map locations deliberately to implement the corrected hierarchy.

The current owner endpoint lists up to 100 recently updated public repositories and initially requests source detail for up to four. Unknown neighborhoods remain survey sites. This is materialization on demand, not a complete global GitHub index. Civic permissions remain scoped to the repository whose GitHub rights were verified; authority in one neighborhood must not grant control of an entire organization city.


## API quota fallback

An exhausted GitHub API quota must not silently erase the homepage. Known atlas repositories can use verified cached source metrics after the public GitHub page positively confirms public visibility and the raw default-branch opt-out marker is confirmed absent. Topic opt-outs are checked on that public page too. Uncertain/private/opted-out repositories stay unavailable. This fallback is bounded to the bundled verified atlas, clearly labeled cached, and reports unavailable stars, CI, PRs and history as unknown. It does not synthesize an active economy. Known source files can be fetched from public raw GitHub and analyzed on demand; the returned file hash is computed from those actual bytes.

## Street-life and contribution-site pass

This build adds faceless simulated visitors whose count is a bounded logarithmic interpretation of stars (maximum 80). Package downloads set vehicle density when available; otherwise star interest supplies an explicitly labelled fallback (maximum 20 or 12 cars respectively). Unknown and zero interest produce no invented crowd. These are ambient characters, not GitHub identities, concurrent users or literal download deliveries. Vehicles yield to the player and steer around nearby issue sites. Motion can be paused and respects reduced-motion preferences.

The current sample of up to 12 recently updated open GitHub issues becomes physical street furniture:

| GitHub evidence | City interpretation | Available interaction |
| --- | --- | --- |
| Bug label | Pothole, broken asphalt and safety cones | Walk to and survey the road repair |
| Documentation label | Wayfinding repair | Inspect the sign and plan a documentation change |
| Feature/enhancement label | Proposed works board | Survey the proposed site |
| Other open issue | Community notice | Read and investigate the report |

A visitor can introduce these work sites. Select a site, follow a street route, and save up to 2,000 characters of field notes when physically within reach. Notes persist on the device, require no account and earn no currency. Opening the report leads to the actual GitHub issue. “Check GitHub status” uses a public, read-only backend request: only a confirmed closure removes the current marker. A not-planned closure is identified as such, never celebrated as a player's repair. No simulated interaction closes an issue or attributes a contribution. Sampling changes are not proof of closure.

Issue/stars refreshes leave building geometry and construction history alone. Stable issue addresses and existing vehicle progress survive metadata refreshes. Source-building geometry remains code-derived; roads, visitors and work boards interpret evidence without claiming extra source code exists.

## A more ambitious city game: design direction, not shipped features

The next useful step is to make these places form systems rather than isolated buttons. A documentation problem could obscure a route's signs; surveying reveals an annotated map, while the actual GitHub merge restores permanent wayfinding. Bug sites could create delivery detours, giving courier players a reason to care about maintenance. Proposed features could be fenced civic plans that attract visitors before accepted contributions fund structure. None of these should make a reported bug's severity up from its title.

Dependencies offer the strongest cooperative layer: freight terminals connect supplier neighborhoods to downstream users, and players organize routes between them. Releases could produce scheduled public gatherings and temporary presentation changes. CI weather could change visibility and route choices, with accessible alternatives. PR construction sites could display verified review stages and let tourists follow their progress. Shared planning needs server-backed identity and abuse controls before it becomes multiplayer; the current field notes and service game remain local.

The target loop is discovery → investigation → contribution plan → actual GitHub work → verified acceptance → visible civic recognition. Visiting and helping should remain worthwhile for a non-coder, without allowing playtime to counterfeit accepted contributions.
