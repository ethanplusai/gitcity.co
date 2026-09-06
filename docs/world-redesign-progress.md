# Connected-city redesign: completion ledger

Objective: implement all eight improvements in the September 5 city-layout review. This ledger records evidence, not a reduced definition of completion.

| Requirement | Required evidence | Status |
| --- | --- | --- |
| Shared city plan | Terrain, road geometry, parcels, collision, walking and traffic consume one plan; no parcel/road intersections | In progress |
| Organizations as connected cities | Three adjoining repo neighborhoods, shared civic center, fixed human scale, stable coordinate/address migration | In progress |
| Believable street hierarchy | Connected arterials/local streets/paths with varied block shapes and purposeful terrain response | Pending |
| Buildings form streets | Street-facing entrances, perimeter blocks/courtyards, corner sites, sparse and dense repo examples | In progress |
| Continuous ground | No raised city boards or survey pads; matching road/foundation grades; credible transitions and bridges | In progress |
| Dependency gateways and corridors | Valid terminal connections, obstacle avoidance, corridor sharing and readable dependency selection | In progress |
| Three-scale art quality | Reviewed world, neighborhood and walking captures in day/night; consistent scale/assets, phone checks | In progress |
| Connected gameplay | Cross-neighborhood delivery, visitors with destinations, issue detours, civic recognition, one navigation network | In progress |

Final acceptance also requires existing OAuth/session, source entry, contribution economy, ownership and opt-out behavior to remain intact. No deployment or GitHub write is required by this visual/gameplay task. No completion claim until the evidence above exists.

## Foundation work completed in the first implementation turn

- `shared/road-network.mjs` plans explicit gateway-to-gateway paths around protected neighborhood bounds; the renderer now uses piecewise-linear ribbons, eliminating spline overshoot. Exact corridor reuse receives a lower path cost. Local gateway approaches and full corridor aggregation remain to implement.
- Removed the thick active-city base slab and the unexplored survey pads. Terrain now meets streets at a common datum. Removed repeated per-repo canals; a coherent water network remains to implement.
- Added version-2 owner-wide land reservations without relocating existing owner or repository anchors. Only compact block claims are stored; no rendered geometry is persisted. The repository API now returns this plan. Current rendering still uses the old parcel layout until all consumers migrate together.
- Added variable-width blocks with shared bent boundaries, T-junction graph subdivision, and non-overlapping street-facing parcels. New claims cannot occupy existing claims; expansion preserves earlier blocks.
- Evidence: obstacle-routing tests, persistent-claim tests, T-junction connectivity tests, parcel-overlap tests, 441 generated blocks checked for capacity and overlap, and the existing desktop/mobile navigation suite. Full city-plan rendering/gameplay integration is the next task, not complete.

## Renderer integration underway

- Version-2 manifests now drive active and cached-preview building placement, orientation, fixed scale, shared boundary streets, courtyard planting, civic placement, collision bounds, and camera framing. Legacy payloads without manifests still use the prior renderer; this compatibility path is not the completed world design.
- Navigation uses the generated street graph; visitor and car loops follow actual block boundaries. Issue markers use street edges, and nearby night lights match the rendered lamp positions. Destination-driven population and cross-neighborhood operations remain pending.
- Empty land reservations no longer draw vacant neighborhood blocks. Land expansion accompanies source/directory responses, and atlas responses include the same permanent reservations.
- Verification: 36 unit tests, TypeScript, ESLint, webpack production build, and the desktop/mobile browser suite with a version-2 fixture passed. The live `vercel/next.js` endpoint returns version 2 and 64 source files. Local server restarted on port 3010.
- Visual review confirms removal of the enormous paved block interiors, but does not establish art-quality completion: terrain remains repetitive, corners need proper joined road geometry, vegetation and civic surroundings need more work, and owner-wide roads/previews need deduplication. Street arrival framing is still being evaluated. Growth addresses persist within a browser visit, not yet across independent refreshed source samples. Dependency routes now avoid planned extents but still need real local terminal connections. The HUD map still assumes the old square extent.

## Joined street surfaces and connected wayfinding

- Street pavement is now triangulated as the space around block polygons, with a continuous outer boundary. This replaces intersecting road boxes. Sidewalks, curb faces, and crosswalks share those boundaries; entrance aprons connect source buildings to sidewalks.
- Added distinct courtyard lawn, garden paths, and benches. Meadow ground uses filtered world-space variation instead of the repeating grass photograph. Terrain grading and forest exclusion now follow developed block polygons for planned neighborhoods; legacy previews retain their fallback clearances.
- Walking arrival now looks along the occupied street frontage. The mission map uses the actual street graph and bounds and displays the active walking route instead of an invented square grid.
- Evidence: 39 unit tests, TypeScript, lint, webpack production build; the version-2 desktop/phone navigation suite passed in daylight and at night. The version-2 game suite completed a four-stop courier round with physical travel, proximity gating, persisted rewards, and cancellation checks. Pavement tests compare triangulated area against the intended footprint and cover stepped boundary/T-junction cases.
- Visual assessment: junction overlap and arrival framing are improved; nighttime sidewalks, visitors, and windows remain readable. Full art-quality acceptance is still unproven. The countryside is still too sparse, architecture and vegetation need further refinement, owner-wide preview deduplication and connected destinations remain outstanding, and there is not yet an accepted three-neighborhood reference city. No requirement in the original eight-item scope is being dropped.


## Owner-wide infrastructure and continuous neighborhood travel

- Added owner-plan aggregation: permanent repo anchors remain unchanged while street boundaries, lamps, courtyards, and one civic hall are rendered once per owner. Active repo geometry replaces its preview without duplicating shared roads. Combined navigation and map bounds include adjoining neighborhoods; neighboring source buildings have collision bounds.
- Owner views frame the developed city after previews arrive. A direct repo link can populate two adjoining neighborhoods in the background. Cached preview invalidation now includes changed source samples and land manifests, avoiding stale geometry after on-demand expansion.
- Added “Walk to [neighborhood]” actions. They route along the shared graph. Crossing a loaded neighborhood boundary updates the repository URL while preserving the camera, previous district buildings, and walking route. Explicit owner/overview navigation remains available.
- Evidence: 40 unit tests, TypeScript, ESLint, webpack production build, the courier round test, and a new three-repository browser fixture. The fixture verifies deduplicated streets, unchanged world building positions, connected graph, one owner street group, desktop/phone entry, and repeat-safe construction. Actual travel from studio/engine to studio/interface passed with a largest 100ms sampled camera movement of approximately 0.57 world units, not an overview teleport. Reference capture: /private/tmp/gitcity-connected-owner.png.
- Still incomplete: the accepted visual reference must use and review real multi-repo data, architectural/landscape refinement remains, durable file addresses across fresh source snapshots remain, dependency highway terminals are not fully connected, and population is still primarily block-loop traffic. Walking between neighborhoods is implemented; cross-neighborhood contribution/delivery gameplay is not yet complete.

## Destination-based city activity

- Replaced planned-city block loops with deterministic trips over the shared street graph. Buildings and the civic forecourt are destinations, including loaded neighboring repos. Visitors dwell after arrival and then choose another destination. Vehicles use lane offsets and rounded turns, follow leaders, yield near the player, and use stable priority at crossings; opposing lanes do not deadlock each other.
- Bug-linked road-repair edges can be excluded from vehicle routes. Confirmed issue closure rebuilds route availability while preserving vehicle state. Raised issue visuals to meet the current road grade.
- Clicking a traveler (or meeting a city guide) exposes the actual destination and offers a walk-to-destination action. These remain simulated inhabitants, not representations of real GitHub users.
- Journey state is retained in memory for up to eight owners and rebased when entering a neighboring repo, preserving world positions and destinations. It is not added to durable player storage or the contribution ledger.
- Found and fixed an animated-arrival bug during the non-reduced-motion browser test: a flight destination below the camera floor could never complete, preventing issue navigation. Flight destinations now respect ground clearance before interpolation.
- Evidence: 45 unit tests, TypeScript, ESLint, webpack production build; real-animation browser coverage for visitor arrivals, guide destination inspection, pause, physical issue exploration, field-note proximity, GitHub closure confirmation, and traffic reopening. Three-neighborhood desktop/phone coverage still passes, including continuous walking with maximum sampled camera movement around 0.57 units. Unit coverage includes detours, destination dwell, deterministic updates, vehicle yielding, opposing lanes, and trip rebasing.
- Scope still open: cross-neighborhood delivery/contribution gameplay, verified real multi-repo visual reference, street hierarchy and terrain-responsive layouts, final architecture/vegetation/environment art, durable file-address migration, and fully connected dependency highway terminals. Destination trips are implemented; they do not constitute completion of the full game or graphics redesign.


## Facade differentiation and vehicle asset upgrade

- Brick, stone and larger-window facade families now differ in bay widths, pier proportions, window heights and ground-floor treatment. Added entrance hardware/lights, rear service details and roof seams, while retaining the source-derived envelope. Fixed wider end piers after the envelope check caught an overshoot.
- Replaced photographed brick shading with fixed-scale running-bond masonry, shared by city hall and brick source buildings. Material batching now distinguishes shader programs so finishes cannot be merged incorrectly.
- Replaced the loaded blocky vehicle geometry with a derivative of Khronos Car Concept. Removed source textures/logo artwork and interior/engine components, welded and simplified the exterior, baked restrained vertex colors, and merged it into one material batch. Output: 14,430 triangles and 551,872 bytes; no texture downloads. This is a more detailed touring-car silhouette, not a complete diverse municipal vehicle fleet.
- Provenance and modifications are in public/models/car-concept-license.txt and public/models/credits.md; the app's guide links the attribution. Source: Eric Chadwick (2024), Darmstadt Graphics Group GmbH, CC BY 4.0. The reproducible bake script uses meshoptimizer as a declared development dependency.
- Evidence: 46 unit tests, TypeScript, lint and webpack production build. Desktop/phone browser navigation passed with the new geometry and masonry shader. Asset-budget coverage checks one material/mesh, no images, bounded download size/triangles, fixed length, and attribution. Street captures show the new facade treatment and car silhouettes; full final art-quality acceptance remains open.
- Remaining original scope is unchanged: terrain-responsive street hierarchy, cohesive landscape and vegetation, final civic/architectural composition, real multi-repository reference review, durable source addresses, fully joined dependency terminals, and cross-neighborhood delivery/contribution gameplay still require work.

## Street profile hierarchy

- The shared graph now identifies an owner-wide main avenue, connecting streets, and local streets using stable block topology. Profiles survive repo-coordinate rebasing and are consumed by joined pavement, curb, sidewalk and crossing geometry. Local streets are narrower and omit center-line paint; sidewalk outer limits and existing building addresses stay fixed.
- Added per-edge polygon offsets so different road widths meet at actual corner intersections without overlapping road boxes. Existing traffic lane and pedestrian offsets remain within the corresponding carriageways and sidewalks.
- Evidence: 48 unit tests, TypeScript, ESLint and webpack build passed. Desktop/phone browser navigation passed with planned-city fixtures and no runtime errors. Reviewed fresh overview and street captures.
- This is a first street hierarchy, not completion of terrain-responsive urban planning. The reviewed fixture still has excessive open land, sparse frontages and weak landscape composition. Curved/terrain-driven growth, civic surroundings, vehicle surface quality, final vegetation and the remaining original requirements remain open.

## Civic block landscape

- Added a planted civic garden, connected approaches from all four surrounding sidewalks, a broader entrance approach adjoining the hall forecourt, perimeter paths, four trees and seating. Paths transition between sidewalk and existing forecourt grades; the work reuses existing material and vegetation batches.
- Evidence: 48 unit tests, TypeScript, ESLint and webpack build passed. Desktop/phone browser coverage including city hall and source entry passed with no runtime errors. Reviewed the updated overview capture at /private/tmp/gitcity-upgraded-overview.png.
- This gives the civic block a defined setting; it does not complete the requested city composition. Dense street frontage, terrain-responsive growth, landscape transitions, final asset quality and connected contribution gameplay remain open under the original scope.

## Street frontage and real-data reference review

- Building placement now aligns the actual source-derived front face to its fixed entrance address. Shallower buildings no longer sit behind a maximum-depth parcel center. Dimensions are unchanged; rear setbacks absorb the depth variation. Added coverage for facade alignment and stable addresses when source samples grow.
- Added scripts/real-city-review.mjs, which uses the live local API without intercepted fixtures and captures a real multi-repository Vercel owner view, Next.js district/street views, night, and a phone direct link. Captures and response/renderer diagnostics are written to /private/tmp/gitcity-real-*.
- The live review exposed excessive labels for unloaded repositories and repeated owner names. City-level labels now name the repository neighborhood and appear for loaded neighborhoods; the owner repository list retains access to the others.
- Evidence: 49 unit tests, TypeScript, ESLint and webpack build; three-neighborhood continuous walking and phone suite passed after frontage changes. Live real-data review passed twice, including after label changes, with no page errors. Reviewed owner, street and phone captures.
- Real-data visual acceptance remains incomplete: the owner city is visibly connected but still too sparse and geometric, the terrain lacks convincing transitions, night phone framing is weak, and vehicles/vegetation remain below the intended quality. These findings preserve, rather than reduce, the original completion requirements.

## Shared approach planning

- Replaced independent civic-to-block L-shaped approaches with deterministic connections to the nearest already-connected developed fabric. Owner aggregation recomputes one shared connection plan instead of retaining every repo's independent approach grid. Source parcels and permanent land claims stay fixed.
- Measured against locally cached real vercel/ai, vercel/next.js, vercel/styled-jsx and vercel/hyper: 22 developed blocks remain; total street-enclosed blocks decrease from 40 to 25. The reduction removes 15 unnecessary empty approach blocks, not source buildings.
- Evidence: 50 unit tests, TypeScript, lint and webpack production build. Added order-invariance, occupied-block retention, reduction and connected-graph coverage. Continuous three-neighborhood walking and phone checks passed (largest sampled travel step ~0.57). Live real-data day/night/phone review passed with no page errors; reviewed the refreshed owner capture.
- Remaining: the connector representation still uses block boundaries, rather than independent terrain-following avenue corridors. The connected planning improvement is not full street hierarchy/landscape completion, nor final visual acceptance. All other original requirements remain active.

## Atmospheric visibility and streamed-ground transition

- Fog now limits attenuation at the camera's focus as orbit distance increases, preserving the explored city's readability while retaining stronger distance haze beyond it. CI storm haze remains distinct. Density updates during camera movement rather than waiting for the lighting interval.
- Clearer captures exposed the abrupt edge of the nine detailed terrain tiles. Added a single 1,440-vertex transition mesh matching those edge samples and descending smoothly to the distant ground; both now share the meadow material. Geometry/materials are disposed when the streamed region changes.
- Evidence: 52 unit tests, TypeScript, lint and webpack build. New checks cover focus visibility across altitudes, storm distinction, exact sampled inner-edge heights, outer ground grade, upward normals and replacement cleanup. Live Vercel day/night/phone capture suite passed after both changes; reviewed the refreshed owner view.
- The transition removes the exposed streaming seam; it is not a substitute for terrain-responsive roads, coherent hydrology or final countryside design. Those and the remaining original graphics/gameplay scope are still incomplete.

## Vehicle surface preservation

- Rebuilt the licensed touring-car derivative using normal-aware simplification in the installed meshoptimizer baker. Position-only simplification had preserved the silhouette but left distorted highlights across curved body panels. The baker now accounts for the normal field during reduction.
- New asset: 19,612 triangles, 19,266 vertices, 658,592 bytes, still one mesh/material and no image downloads. Existing limits of 20,000 triangles and 750,000 bytes remain unchanged. Updated the modification notice.
- Evidence: all 52 tests, including unchanged asset limits, pass. Desktop/phone browser navigation passes with no runtime errors. Reviewed the fresh street capture: panel highlights are visibly smoother than the prior distorted appearance.
- A varied municipal vehicle fleet, final visitor/vegetation art and the full original city/gameplay scope remain unfinished. This is a specific surface-quality correction, not final graphics acceptance.

## Vehicle lamp integration

- Removed the placeholder headlight/taillight boxes once the detailed cars load. Their original lamp surfaces now emit through a vertex-color mask, controlled by the local day/night state. No extra lamp geometry or draw calls are added; the original fallback remains available until models arrive.
- Evidence: 52 unit tests, TypeScript, lint, webpack build and nighttime desktop/phone browser checks passed. Reviewed the street capture to confirm removal of the bright detached boxes; adjusted the headlamp mask for the baked linear colors and repeated the browser shader check.
- This corrects lamp placement. It does not complete road illumination, fleet diversity, final art quality, terrain-responsive planning or the original connected gameplay requirements.

## Source-sample address ownership

- Fixed a slot-ownership collision during changing source samples. Temporarily absent files keep their cached entrance slot when capacity permits. If reserved land is full, an absent cache entry is explicitly invalidated before its slot is reused, so a returning file cannot silently overlap a current building.
- Evidence: 54 unit tests, TypeScript, lint and webpack build. Added sample disappearance/return coverage and full-cache replacement coverage proving unique ownership and retention of all current files within available parcel capacity.
- This does not solve durable cross-session addresses. Under capacity pressure an absent file can still receive a new address when it returns, and fresh browsers lack the session map. A shared address manifest and capacity/migration strategy remain required before address stability is complete; the original goal remains active.

## Trip continuity across street replanning

- Journey snapshots now carry their street geometry. Restoration checks complete segment coverage against the new graph, accepting intersection subdivisions and coordinate rebasing but rejecting missing road sections. Both visitors and vehicles reroute invalid trips from their current position, trying the original destination first.
- This fixes a gap where closure checks alone allowed saved journeys to follow streets removed by owner-wide replanning. Snapshot geometry remains in the bounded in-memory journey cache, not durable player storage.
- Evidence: 56 tests, TypeScript, lint, webpack build and the three-neighborhood desktop/phone browser suite passed. New coverage checks road removal, preserved actor position/destination, subdivision and missing segment rejection. Existing coordinate-rebase and closure tests remain passing.
- Cross-neighborhood delivery/contribution gameplay, durable addresses and the remaining original graphics/planning requirements are still open.

## Cross-neighborhood courier rounds

- Courier contracts can now select verified source-building destinations across up to three loaded repositories belonging to the same owner, followed by the shared civic depot. Only destinations present in the active connected plan are eligible. Single-neighborhood rounds remain available; survey/service rounds retain their local scope.
- Physical boundary transitions preserve the mission and its subscription instead of unmounting/canceling the activity. Qualified destination IDs resolve against the owner network after each repository-origin change. Delivery approaches stop on the sidewalk rather than directly against facade geometry.
- Rewards remain repeat-safe personal service reputation, scoped to the originating contract. This does not award accepted-contribution currency or imply GitHub issue resolution.
- Evidence: 57 unit tests, TypeScript, ESLint and webpack build. New contract coverage checks same-owner destinations, deterministic selection, origin-scoped rounds and duplicate reward protection. The existing local round/persistence/cancellation suite passes. A new full cross-city browser test passes on desktop and phone: studio/engine → studio/documentation → studio/interface → civic depot, actual URL transitions, preserved mission, proximity-gated deliveries and reward persistence after reload. Reviewed the phone delivery capture.
- Tests first exposed mission URL-transition suppression and premature delivery sampling; both the implementation and verification were corrected before the successful runs. Cross-neighborhood courier gameplay is implemented, while the accepted GitHub contribution/bounty return loop and the original remaining visual/planning requirements remain open.

## Phone mission controls

- Replaced the absolutely positioned mobile minimap with a two-column grid. The map no longer covers the delivery button; repository paths remain visible and primary actions have a 44px minimum touch height. Desktop layout is unchanged.
- Evidence: webpack production build and the full phone cross-city courier suite passed, including three URL transitions, deliveries, return to the depot and persistent reward. Reviewed the refreshed phone capture to confirm the map/action separation.
- The remaining original city planning, landscape, art and contribution-loop requirements remain active.

## Contribution recognition refresh

- Completed history sync now reloads the active repository's civic metadata and refreshes resident plaques directly. The regular repository poll also refreshes recognition when commits/CI remain unchanged. Camera position and constructed buildings are retained.
- Added a targeted browser fixture for a completed accepted-contribution import: a new @contributor plaque appears with PR attribution immediately after sync, camera coordinates and construction count remain identical, and repeating sync does not duplicate the plaque.
- Evidence: 57 unit tests, TypeScript, lint, webpack build and the recognition browser fixture passed. This proves the frontend recognition refresh against verified-result-shaped API data, not an end-to-end live GitHub PR/merge import. The full live contribution return loop, durable addresses and remaining original graphics/planning work remain open.

## Discoverable accepted work at city hall

- City hall now lists the signed-in contributor's verified accepted file paths with PR attribution and direct file-building links. The list scrolls within the hall so source paths outside the initial city sample are discoverable without searching the rendered buildings.
- Evidence: TypeScript, lint and webpack build passed. Extended the recognition browser fixture through sync → city hall → an accepted file outside the initial source sample → attributed archive. The existing immediate plaque, unchanged camera/construction and duplicate-sync checks still pass.
- This closes a frontend discovery gap. It does not establish a live GitHub merge/import test, permanent source addresses or completion of the remaining original graphics/planning requirements.

## Citywide night readability and construction placement

- Owner views now supply their actual fixtures to the four nearby surface lights. Planned streets also draw soft night-only lamp pools in one instanced batch per owner group, making the broader street network readable without allocating a dynamic light per lamp. Daytime pool intensity is zero.
- Real night captures exposed legacy crane coordinates placing towers in roads. Planned-city cranes now occupy block-interior sites, are limited to available developed blocks, and rise above nearby source buildings. Shortened hanging cables to clear local roofs.
- Evidence: 57 tests, TypeScript, lint and webpack build passed for the lighting/placement changes. Material-batch checks account for the single added pool batch. The live Vercel capture suite now includes owner-night and passed twice with no page errors; reviewed owner and street captures confirming the road obstruction was removed.
- These changes improve night readability and remove a concrete placement error. Final crane/vegetation/visitor art, terrain-responsive streets, durable addresses and the remaining original requirements are still open.

## Batched construction kit

- Replaced solid crane towers and bars with lattice masts and jibs, support cables, counterweights, a trolley/short hoist and a glazed operator cabin. The jib remains independently animated; planned interior placement and source-relative height are retained.
- The kit uses five mesh batches per crane, independent of height. Geometry checks at heights 6/12/30 report 3,296/4,736/9,216 triangles with finite bounds. TypeScript, lint, webpack build and desktop/phone browser rendering/navigation passed. Reviewed the updated city overview capture.
- This improves a specific construction asset; final city art, terrain-responsive planning, permanent addresses and the remaining original requirements remain open.

## Construction-site ground presence

- Added low protective rails around crane bases and registered their corresponding scaled footprint with walking collision. The fixed worksite now has a visible and physical ground boundary instead of allowing players through the mast.
- Evidence: TypeScript, lint and webpack build passed. The full planned-city courier/browser round passes with physical travel, proximity checks, completion, persistence and cancellation, confirming its tested street routes remain reachable with the new blockers.
- This does not complete terrain-responsive planning, permanent source addresses, final city art or the remaining original contribution/world requirements.

## City hall to physical issue exploration

- Added an Explore work site action beside each city-hall issue link. It closes the hall dialog, selects the issue encounter and starts street navigation to its marker. The original GitHub link remains available.
- Evidence: TypeScript, lint and webpack build passed. The real-animation street-life browser suite now supports a hall-entry case; that case passed through noticeboard action, automatic walking, proximity-gated field notes, persistence and simulated GitHub closure/traffic reopening with clean shaders.
- This connects the existing noticeboard and street-issue flows. Live GitHub contribution/merge proof and the remaining original city/graphics requirements remain unfinished.

## Consistent issue closure across city views

- City hall and street-encounter lists now consult the engine's repository-scoped confirmed-closure records. A closed marker no longer leaves an inert Explore action behind in the hall, and remounting the encounter panel cannot lose the in-session confirmation. A newer issue update supersedes the recorded timestamp.
- Evidence: TypeScript, lint and webpack build passed. Extended the hall-entry browser flow through simulated GitHub closure and return to city hall; the Explore action is absent and the empty notice is shown. The physical route, notes, persistence and traffic-reopening checks still pass.
- Repository identity was already scoped correctly by the encounter component key; no change to that mechanism was needed. Remaining original graphics, planning, durable-address and live contribution verification requirements stay open.

## Sparse connecting streets and geometry-driven countryside

- Unloaded repository labels no longer clear forests or flatten terrain. Clearance follows loaded shared owner plans, with developed/civic parcels and narrow connecting street footprints; independent per-repository approach grids no longer determine the countryside.
- Replaced complete empty-block road loops with a shared sparse network. Developed frontages remain fixed; additional boundary links connect those components, and unused dead ends are removed. Coordinate rebasing retains the same selected links. Buildings and permanent land claims do not move.
- Pavement and sidewalks now follow directed graph contours, including bridges between street components, rather than requiring four roads around every connecting cell. Here “bridges” means graph connections, not water-crossing structures. Navigation, traffic, maps, lamps and terrain clearance use the selected graph.
- Evidence: 58 tests, TypeScript, lint and webpack build passed. The added geometry test checks road reduction, rebasing, paved route coverage through junctions and connecting links, and absence of asphalt on removed roads. Desktop and phone courier browser flows passed across three neighborhood URLs, physical deliveries, civic return and reward persistence. Refreshed actual Vercel day/night/street/phone captures completed without page errors; reviewed overview and street images.
- This removes a concrete cause of empty connecting grids. Streets still derive from the existing cell framework; independently terrain-responsive corridors, hydrology, permanent file addresses, truthful large-repo density, final architectural/vegetation/visitor art and live contribution verification remain unfinished. Capture frame timings are snapshots on a desktop GPU, not a mobile performance benchmark.

## Fuller botanical tree kit

- Replaced individual diamond leaf meshes with layered textured twig sprays. Broadleaf trees now fill their crown centers and upper canopy; conifers retain a tapered, layered silhouette. Seeded branches, tree positions and per-instance variation remain deterministic.
- Two shared 256px procedural cutout textures carry individual leaf/needle shapes and tonal variation. Explicit mip levels preserve alpha coverage so small leaves do not erase the distant crown. Materials write depth and use alpha testing; edge smoothing uses alpha-to-coverage where MSAA is available, per [Three.js material documentation](https://threejs.org/docs/pages/Material.html#alphaToCoverage).
- Measured kit budgets: 1,004/1,220 triangles for nearby broadleaf/conifer trees and 484/556 for woodland variants. Groves retain four instanced mesh batches. Both shared texture chains total 699,048 bytes before GPU-specific overhead. Reduced triangles do not by themselves establish a mobile frame-rate improvement; cutout sampling has a fragment cost.
- Evidence: 59 tests passed, including finite/deterministic geometry, instancing, explicit tree budgets and alpha coverage across all nine mip levels. TypeScript, lint and webpack build passed for the new kit; subsequent needle-density tuning passed the tests and final real Vercel browser capture suite. Reviewed street and owner images; day/night/phone captures completed without page errors.
- Fuller individual trees improve the street view. Woodland placement/composition remains sparse, and this does not complete final landscape art, terrain-responsive roads, durable source addresses, semantic density or live contribution verification.

## Continuous woodland placement

- Replaced per-tile circular tree clusters with a warped world-space habitat field. Larger woodland bodies now cross streamed tile boundaries, with glades and irregular margins instead of repeated isolated groves.
- Tree candidates belong to stable jittered world cells. Position, scale, rotation and species survive region-query order and removal of neighboring trees for development. Grove batching now honors that stable species assignment instead of changing species when an earlier tree disappears.
- Clearance accounts for the rendered crown plus instance-width variation and an irregular edge margin. Developed parcels and roads retain their clearings. A final geometry check increased the conservative crown radius from the initial estimate to 2.9 units.
- Evidence: TypeScript, lint and webpack build passed. The full 62-test suite passed after the final clearance correction, including tile partition equivalence, unchanged remaining trees after development, and actual kit-radius containment. Actual Vercel owner/day/night/street/phone captures completed without page errors; reviewed the owner image showing continuous woodland around and between neighborhoods. Recorded frames were approximately 15–16ms on the desktop GPU, which is not a physical-phone performance benchmark.
- This improves forest composition and stability. Final ground/understory art, independently terrain-responsive city planning, large-repo semantic density, permanent file addresses and the remaining original game/contribution requirements are still open.

## Incremental source exploration beyond the initial sample

- Traced the density ceiling to the 64-file initial sample, an inaccessible directory expansion path, a fixed first-256-files endpoint and client replacement that discarded other previously loaded files.
- Directory controls in Buildings now show explored source counts and request additional 64-file pages, excluding the server's initial sample. Stable path cursors are bound to the Git ref and directory; a changed ref returns a retryable conflict rather than silently skipping files. Completed directories disable further requests.
- Incoming pages merge by source path without erasing earlier pages or other directories. Changed blob SHAs cannot inherit stale analysis/contributor fields. Only newly materialized buildings participate in the construction delay, preserving their commit order without waiting behind existing buildings.
- Evidence: 66 tests, TypeScript, lint and webpack build passed for pagination and incremental merging. The desktop browser fixture reached 338 buildings over five pages, retained earlier files, kept its camera and disabled the completed directory. The normal-motion variant also passes, waiting for fresh renderer counts and completion of every page’s construction within eight seconds. The restarted real API returned two 64-file, fully parsed pages from Next.js packages (3,340 sources), with matching refs, no overlap and a continuation cursor. Invalid cursors return HTTP 400 through the real route.
- Local development server restarted on port 3010 (PID 31292); no deployment performed. This is incremental detail acquisition, not completed semantic zoom: unloaded source massing, rendering budgets for very large expanded scenes, durable addresses, and preservation/revalidation of expanded detail when a new commit arrives remain open.

## Expanded cities survive verified commit refreshes

- A new commit no longer replaces an explored city with its initial 64-file sample. The client reconciles expanded paths in bounded batches against the new Git tree before applying that snapshot. Unchanged blob SHAs retain their analyzed geometry; changed blobs are re-analyzed; a complete tree must confirm deletion. Truncated trees cannot be treated as evidence that an explored file disappeared.
- Refresh requests are bound to the requested Git ref. A changed snapshot or user action that replaces the in-flight city state prevents partial results from overwriting newer state. Directory cursors reset after the accepted commit so newly added sources remain explorable. Existing buildings retain their construction history and camera placement.
- Evidence: 69 tests, TypeScript, lint and webpack build passed. The browser fixture expands to 338 buildings and then exercises the actual one-minute commit poll: one changed blob receives new analysis, one confirmed deletion reduces the city to 337 buildings, expanded files remain, and neither camera position nor construction count changes. A first timer-accelerated test did not trigger the actual poll; the final passing test uses the normal polling interval.
- Real Next.js API reconciliation also passed: two unchanged blobs retained, one deliberately outdated blob re-analyzed, one absent path confirmed removed, and the response ref matched. Local server restarted on port 3010 (PID 34781); no deployment performed. This closes commit-refresh loss of expanded detail. Cross-session addresses, unloaded-directory massing, bounded large-scene semantic rendering, final city art, terrain-responsive planning and live contribution verification remain open.

## Distant blocks share draws without losing architectural detail

- Active planned cities now batch settled distant buildings by physical block and compatible material. Nearby buildings retain their individual objects. Batches preserve original geometry, UVs, finish shaders, shadows and per-triangle file identity; ray picking still selects the correct source building.
- Construction stays on individual objects, and occupied interiors never regain an exterior shell through a visibility switch. Cloned batch materials follow source color and window-emission state. Distance thresholds use hysteresis to avoid switching repeatedly at a boundary.
- Batches are generated lazily, at most one block per frame, after construction settles. The first eager implementation added work during arrival and one phone-sized capture recorded a slow frame; the final path defers that work. Detailed geometry is still retained in memory, and the batches add copies: this reduces submission cost, not the full large-scene memory requirement.
- Evidence: 70 tests, TypeScript, lint and webpack build passed. The added test verifies unchanged triangle counts, fewer submitted meshes, correct ray-selected file, presentation/emission propagation, construction visibility and interior hiding. The normal-motion 338-building browser flow passes five-page expansion and camera checks, recording 576 draw calls with 27 batched blocks; an earlier equivalent expanded-city capture recorded 2,738 draws. These are draw counts, not a measured frame-rate multiplier.
- Actual Vercel owner/day/night/street/phone captures completed without page errors. Reviewed street and expanded-city images. Final capture frame samples were approximately 14–16ms on the desktop GPU; physical-phone profiling and broad performance guarantees remain open.
- This supports richer active cities without replacing their visible architecture with generic proxy boxes. Unloaded-directory semantic massing, memory-bounded detail streaming, permanent file addresses, terrain-responsive planning, final city art and live contribution verification remain unfinished.

## Junction-based road paint and concrete sidewalks

- Crosswalks now follow actual multi-road graph junctions. Ordinary segment subdivisions and bends no longer receive automatic crossings, and short links cannot accumulate overlapping approach stripes. Centerline dashes leave a clear gap around crossings.
- Existing sidewalk surfaces now render concrete panel joints, subtle panel variation and fine aggregate. Pixel-footprint filtering fades these details at altitude without additional textures or geometry batches.
- Evidence: 72 tests, TypeScript, lint and webpack build passed. Junction tests cover straight subdivisions, a T-junction, crossing/dash separation and short links. Reviewed the real Vercel street image; day/night/phone captures completed without page errors. The planned-city browser suite also passed world/repo/file/hall/navigation/phone flows with shader-error monitoring and no runtime errors.
- These are street-detail improvements. They do not complete terrain-responsive planning, unloaded-directory massing, bounded detail streaming, permanent file addresses, final city/vehicle/visitor art or live contribution verification.

## Persisted source-building addresses

- Added compact repository/path/slot records to the existing SQLite store. Encountered source paths keep their slots through process restart, different browser samples, and temporary disappearance; slots are not recycled when a file is absent. Visible architecture still regenerates from source data.
- Repository, atlas, directory-page, source-entry and changed-source responses carry canonical per-file slots. The planned renderer honors those slots over browser-local allocation. Responses only include addresses for their returned files, rather than transmitting the entire historical address table.
- Land grows to accommodate recorded slots within the existing detailed-land limit. Exhausting that capacity returns an explicit error instead of silently reassigning another file's address. This does not solve unbounded semantic land/detail capacity.
- Evidence: 73 tests, TypeScript, lint and webpack build passed. A new test closes and reopens the database, visits 100 other files and regenerates fresh browser layouts, verifying identical returned file coordinates and no recycled slot. Real Next.js API responses returned 64 unique addresses and matching repository/source-entry slots. The real owner/day/night/street/phone capture suite completed without page errors.
- Local server restarted on port 3010 (PID 40393). Existing browser-only placement transitions to the canonical records when fresh addressed data arrives. Durability is verified for the retained local SQLite file; shared production storage/deployment persistence is not yet verified. Unloaded-directory massing, memory-bounded semantic detail, terrain-responsive planning, final city art and live contribution verification remain open.

## Near and distant buildings share geometry buffers

- Removed the duplicate geometry allocation introduced by distant block batching. After a block settles, individual building meshes draw their own index ranges from the block's shared position/normal/UV/index buffers. Original per-file vertex arrays are released, and temporary source-slice bookkeeping is discarded.
- File anchors and per-building materials remain separate. Matrix compensation preserves world-space placement and finish shaders; near ray picking observes each building's draw range. The distant batch retains per-triangle file attribution.
- Evidence: 73 tests, TypeScript, lint and webpack build passed. The expanded batching test measures unique backing-buffer bytes before/after and verifies no duplicate allocation in its fixture, unchanged triangle count, correct near/distant ray picking and visibility/material behavior. Browser navigation/file entry/phone flows passed with shader-error monitoring. The 338-building expansion still records 576 draws with 27 batched blocks; approach to street level passed and the final eye-height image was reviewed.
- This removes the duplicate copy, not all large-scene memory growth: encountered source geometry is still retained, and memory-bounded streaming plus unloaded-directory semantic representation remain unfinished. Shared production persistence, terrain-responsive planning, final city art and live contribution verification also remain open.

## Street model loading recovery

- Active street life starts detailed asset requests immediately, before camera descent. Each vehicle and pedestrian variant becomes visible independently; only actors awaiting their own variant retain fallback geometry.
- Failed variants retry up to three attempts with a three-second delay. Requests already in flight and successfully loaded variants are skipped. A stalled sibling request cannot block retries, and disposed street scenes do not schedule further attempts.
- Evidence: 73 tests, TypeScript and lint passed. Chrome/Metal planned-city street fixture deliberately failed the first shared car download and held then failed one pedestrian download: three variants became ready while the fourth was stalled, then all four recovered with exactly two requests per affected asset. Street routing, interactions, issue closure and shader monitoring passed. These are fixture checks, not live GitHub merge verification.
- Broader architecture, terrain-responsive layout, semantic representation/streaming, shared production persistence and final art remain unfinished. This fixes an asset delivery problem; it does not by itself establish the requested overall realism.
- Production webpack build also passed. Reviewed the issue-street capture: it confirms the street interaction view remains functional but exposes an oversized, coarse pothole marker. This capture does not establish vehicle visual quality; marker scale/materials remain a concrete next art task.

## Road repair visual scale

- Replaced the broad eleven-sided pothole ring and box rubble with a seeded, irregular wheel-track footprint roughly 0.58 by 0.38 world units. Narrow broken edges and millimeter-scale aggregate sit just above pavement; aggregate is merged into two material batches.
- Confirmed repairs preserve the defect's seeded outline and orientation. Non-road issues no longer leave asphalt repair patches when closed.
- Evidence: TypeScript, lint and production webpack build passed; the planned-city Chrome/Metal street interaction fixture passed issue routing, proximity notes, simulated confirmed GitHub closure and shader checks. Reviewed the walking capture and subsequently narrowed/darkened the edge to reduce its remaining pale-ring appearance. This remains a procedural surface approximation, not a physically cut road depression.
- This is an incremental art improvement. All outstanding requirements in the original completion table remain in scope, including terrain-responsive connected planning, dependency terminals, semantic streaming, production persistence and broader architectural/landscape quality.

## Dependency endpoints use loaded street junctions

- Loaded district highway endpoints now select a real outer street node facing their destination and extend outward to the visibility-planned corridor. The selection is independent of node enumeration order. Approaches that intersect another district's protected bounds are omitted rather than forced through development.
- Unloaded destinations retain provisional exterior gateways. This is the endpoint foundation, not complete terminal integration: curb crossings/grades, owner-wide terminal aggregation, rebuilding terminals as previews materialize, navigation continuity and shared corridor geometry remain required.
- Evidence: added cardinal-direction, deterministic selection, street-interior avoidance and unloaded-fallback checks. TypeScript, lint and 74 tests passed. The planned-city browser suite passed world/repo/file/hall/owner/phone navigation and shader/runtime monitoring. These checks establish endpoint selection and existing navigation regression coverage; they do not prove seamless highway travel or final visual quality.

## Highways refresh with owner geography

- Extracted dependency-road rebuilding from district construction. Owner preview additions/removals now refresh road geometry, picking references and landscape road clearance. Previous road resources are disposed.
- Loaded owners contribute one combined street graph and protected extent, rather than competing per-repo bounding boxes. Same-owner dependencies do not add redundant exterior highways between neighborhoods already joined by owner streets.
- Evidence: TypeScript/lint and the standard planned-city browser suite passed. A dedicated delayed-atlas browser fixture observes one resolved terminal before destination arrival and two afterward, with one dependency route and the active district retaining 18 settled buildings. Its initial assertion incorrectly used a global construction counter before the first diagnostic frame; the passing version checks active structures and settled animation state. No shader/runtime errors.
- Terminal grades/curb openings, shared corridor meshes, routed highway travel, semantic streaming and the remaining original completion requirements are still open.

## Shared dependency pavement

- Collinear overlapping highway routes now split at their shared endpoints and render each shared stretch once, retaining the complete dependency set on that stretch. Reverse traversal and different source subdivisions are handled. Unbranched stretches with the same dependencies are rejoined to preserve mitered bends.
- Rendering still uses the existing boulevard material/geometry kit. This removes duplicate shared pavement, not all junction/terminal limitations. Branch junction surfaces, endpoint curb/grade integration, a multi-destination interaction chooser and navigable highway travel remain open; current road clicks use the first deterministically ordered dependency.
- Evidence: 75 tests and lint passed, including exact union length, shared length, ordering independence and bend continuity. The delayed-destination browser fixture passed settled active geometry, terminal refresh and clean shaders. The first production check caught a missing explicit point type at the JavaScript/TypeScript boundary; that annotation was added before rerunning the build.

## Joined highway junction surfaces

- Dependency routes now split at geometric crossings as well as overlapping endpoints. Their shared graph generates continuous asphalt and shoulder outlines, using the existing bounded-miter street surface routine. Visible highway geometry is two finish meshes; invisible per-route meshes preserve selection metadata.
- Highway asphalt now uses the same filtered aggregate shader as local streets. This joins highway branches and crossings, but does not yet cut through city sidewalk/curb surfaces or solve endpoint grades and highway navigation.
- Evidence: 76 tests, TypeScript and lint passed. A crossing fixture verifies five graph nodes/four edges, exact paved union area, one asphalt ray intersection at the junction and two visible finish meshes. The delayed-destination Chrome/Metal fixture passed terminal updates, settled district geometry and shader/runtime monitoring.
- The full original completion table remains open where indicated. Semantic streaming, terrain-responsive planning, final architecture/landscape quality and shared production persistence are not resolved by this junction change.

## Physical city entrance openings

- Highway entrances now subtract their footprint from actual sidewalk, curb and marking triangles. Attribute interpolation preserves UVs and normals; removing/replanning a route restores the retained original geometry instead of accumulating destructive cuts. Openings are applied only to the corresponding owner's street group.
- Joined highway asphalt now uses the local street datum (with a small separation to avoid coplanar flicker); shoulders sit below it. Original clipping geometry is disposed with its owner group.
- Evidence: 77 tests, TypeScript, lint and webpack build passed. New ray tests verify both pavement and vertical curb removal, unaffected nearby pavement, repeat-safe clipping, finite attributes and complete restoration. The delayed-city Chrome/Metal fixture passed with clean shaders; reviewed its overview capture and the visible city/highway join.
- The capture also makes the existing highway width look too narrow for the detailed cars. Width/vehicle clearance, routed highway travel, destination selection and final entrance landscaping remain to address. This work does not complete semantic streaming, terrain-responsive planning or broader realism requirements.

## Consistent two-lane highway scale

- Added one highway profile for pavement width, shoulder width, gateway clearance, route obstacle clearance and pavement heights. Rendered streets, entrance cuts and picking proxies now share the 1.9-unit carriageway. Each 0.95-unit lane accommodates the detailed car's measured 0.759-unit width with margin.
- Centerline paint is one instanced batch using the existing junction-aware marking placement. Scene disposal now releases InstancedMesh resources as well as geometry/material resources.
- Evidence: 77 tests, lint and production webpack build passed. Asset validation now checks lane fit against the actual GLB position bounds. Joined-junction area validation follows the shared highway profile. The delayed-city Chrome/Metal fixture passed without shader/runtime errors; reviewed the new overview and its wider entrance.
- This proves geometric lane capacity, not highway traffic or navigable cross-owner trips. Those, destination selection and the remaining original redesign requirements remain unfinished.

## Dependency destination interaction

- Clicking a highway now opens a destination chooser using that stretch's dependency metadata. It no longer silently selects the first repository. The repo panel also exposes an accessible Dependency destinations button for phone and keyboard exploration.
- Destination entries show the owner city and repository neighborhood and navigate through the existing URL/camera flow. Closing the dialog preserves the current view. The action is labeled Visit; it does not claim continuous highway walking is implemented.
- Evidence: TypeScript/lint passed. The expanded delayed-city Chrome/Metal fixture clicks the actual rendered highway, verifies its destination dialog, then uses the panel selector at a 390px phone viewport and reaches the selected facebook/react URL and heading, with no runtime/shader errors. Multi-destination metadata splitting remains covered by the corridor unit test; this browser fixture uses one destination.
- Continuous cross-owner travel, highway traffic, terrain-responsive planning, semantic streaming and remaining realism/persistence requirements remain open.

## Walking between loaded owner cities

- Added a permanent-world walking graph combining loaded owner street graphs with the same dependency corridors used for rendering. Exact gateway nodes join the networks; disconnected destination graphs yield no walking action.
- The destination chooser offers Walk along the connecting road for a loaded, reachable dependency. Arrival uses the existing camera-preserving repository handoff; manual controls cancel the automatic route, including phone forward/back controls. Replanning refreshes a running route or stops it if connectivity is lost.
- Evidence so far: 78 tests and lint passed. The world graph test checks owner-coordinate rebasing, both gateway transitions and disconnected rejection. A full Chrome/Metal highway trip reached the other owner URL with a largest 100ms camera step of about 0.60 units; phone interruption and subsequent destination selection also passed.
- Visual inspection of that first arrival caught a façade-facing stop despite passing movement/floor checks. The route was corrected to approach via the sidewalk and finish along the frontage; the production build passed and the repeated full trip is being visually checked. Do not treat the first arrival image as acceptable POV evidence.
- Still open: persistence of explored highway geometry after active-repo changes, cross-owner highway traffic, richer travel feedback, unloaded destinations, terrain-responsive planning, semantic streaming and remaining original redesign requirements.
- Repeated full-trip verification passed after the sidewalk correction: largest sampled step 0.57 units, correct destination URL, camera at the enforced floor. Reviewed the new arrival image: the façade is beside the camera and the sidewalk/street are visible instead of a wall filling the view. Final production webpack build passed. This fixture is evidence of connected walking and improved arrival placement, not final city-art acceptance.

## Explored highways survive view changes

- Highway planning now includes cached data for repositories visited during the current browser session, overriding cached snapshots with active data. Leaving the active district no longer disposes world highways or restores away their entrance openings. Removing a repository excludes its absent source data from replanning.
- Corridor interaction metadata retains both endpoint repositories, so a road can identify the city behind the visitor as well as the upstream dependency. Walking connectivity accepts reachable endpoints in the explored highway network.
- Evidence: destination navigation and returning to world view passed in the Chrome/Metal fixture. The final check inspects three actual visible highway meshes still in the scene, not only the retained route counters. TypeScript/lint and the production webpack build passed during implementation; the final diagnostic addition was type-checked separately.
- This is within-session explored-world persistence, not a new database of road geometry. Geometry still regenerates from repo/owner plans. Browser-reload exploration restoration, bounded world detail, traffic, richer travel feedback and the remaining original completion requirements stay open.

## Connected vehicle journeys

- Active-city cars now receive the connected world road component and loaded destinations rebased into their existing scene coordinates. Pedestrians retain their local network. Disconnected loaded owners are excluded from vehicle destination choices.
- Network replacement restores current vehicle journeys/positions and retains the existing usage/star-derived actor cap. Confirmed road-issue closure rebuilds the connected vehicle network rather than reverting it to owner-only streets. Traveler walking actions also use the connected graph where available.
- Evidence: 79 tests and lint passed. A deterministic traffic simulation keeps six actors, observes them on the highway between owner streets, records completed journeys and excludes an isolated third city. Chrome/Metal confirms destination coverage expands from 19 to 38 on late city loading; the existing street-life browser fixture passes interaction, closure/detour and shader checks.
- This verifies connected route capability, not a final rendered highway-traffic art review or persistent traffic for every visited city. Active-city actor ownership, broader traveler arrival handling, density/readability and the remaining original completion requirements remain open.

## Readable highway travel on phones

- Added a journey card with the destination, an estimate from remaining routed distance and walking speed, and Stop walking. Updates follow rounded remaining seconds rather than causing a React update every render frame. Manual movement and explicit navigation dismiss the trip state.
- The repo panel hides during the trip and restores afterward; phone walking controls move to the bottom so the city stays visible. Arrival estimate remains approximate and does not claim a measured physical-world distance.
- Evidence: Chrome/Metal at 390px verifies card bounds, destination/estimate, manual interruption, explicit Stop walking, panel restoration and subsequent destination navigation. Reviewed the final phone capture after removing the obstructing repo panel. TypeScript/lint and production webpack build passed before the final layout adjustment; the final layout was browser-tested and type-checked.
- This completes this travel-feedback increment, not the full redesign. Final city art, terrain-responsive planning, semantic streaming, persistent multi-city traffic and production persistence requirements remain open.

## Civic roofline and public approach

- City hall's wings now have hipped roofs with ridge caps, boxed eaves, gutters/downpipes and masonry exhaust stacks. The central lobby has a parapet and inset framed skylight. The civic height bound and active collision envelope account for the roof profile while preserving the existing footprint and forecourt.
- Forecourt concrete now shares the sidewalk finish instead of separate high-contrast grid strips. The default city-hall camera was moved clear of a nearby canopy that obscured much of the facade.
- Evidence: 79 tests and the final production webpack build passed; lint/TypeScript checks passed during implementation. Initial testing caught an indexed/non-indexed geometry merge mismatch; the roof index format was corrected before final checks. A new Chrome/Metal civic review captures day/night/phone views with interaction and shader checks. Reviewed the revised daylight view with the full facade visible and the earlier night lighting view.
- These are visible form/detail and composition changes, not final realistic-art acceptance. Window depth, material richness, planting, broader architecture/landscape integration and all remaining original completion requirements stay open.

## More readable window interiors

- Shared glazing now uses a dielectric material response and distinct room wall/floor/ceiling shading. Analytic box intersections add desks with supports and storage cabinets, so furniture changes its apparent shape with viewing angle. Existing night emission illuminates the room detail; grazing views retain more of the glass tint.
- This reuses the window geometry and adds no texture downloads or interior meshes. It adds fragment-shader work; no mobile GPU speedup is claimed. The interior kit is deliberately small and remains repetitive compared with final art ambitions.
- Evidence: 79 tests, lint and production webpack build passed. Civic day/night/phone captures completed with clean shaders and the day/night images were reviewed. After the final desk-support adjustment, the standard planned-city browser suite passed world/repo/source/hall/owner/phone flows with shader/runtime monitoring.
- Material richness, planting, full terrain-responsive city planning, semantic streaming and other unresolved original requirements remain open.

## Reclaiming distant active-city detail

- Active planned cities now have a farther representation that releases detailed building meshes and their shared geometry buffers. Coarse code-sized masses retain file picking, addresses and live material state. Approaching regenerates the deterministic kit without replaying commit construction; file entry has priority over background eviction.
- Near and middle distances retain the existing exact-geometry batching. Distance hysteresis prefetches detail before close approach; at most one block changes representation per frame. Bounds refresh after construction settles. Material recipes remain small and preserve cosmetics/night lighting across regeneration.
- Evidence: 80 tests, lint and production webpack build passed. A new test verifies far owned geometry buffers are below 35% of detailed bytes, empty released anchors, file ray picking, exact restored vertex arrays, unchanged anchor placement, material identity/color, and occupied-file priority. Standard world/source/hall/owner/phone browser flows passed. The 338-file expansion/approach fixture passed and recorded 408 overview draw calls; reviewed the restored street-detail image.
- This reduces steady-state active-city geometry retention. Initial snapshot construction can still allocate all encountered detail before reclamation, preview cities still retain their geometry, and unloaded directory massing remains absent. These are not yet a hard whole-world memory bound or complete semantic streaming. All other unresolved original requirements remain in scope.

## Avoiding some repeated expansion allocations

- Previously constructed distant blocks can start with material recipes and coarse geometry when an expanded source snapshot preserves the camera. Fresh or selected blocks still construct detailed buildings. A separate block constructing no longer forces already-coarse blocks to regenerate. Deterministic style selection is shared with the detailed kit.
- Evidence: 81 unit tests passed, including initially coarse block activation and isolation from construction elsewhere. Production webpack build passed before browser verification. Both reduced-motion and normal-animation Chrome/Metal expansion runs passed with 338 accessible source buildings, unchanged camera, completed construction and restored street detail. Each final expansion initially built 314 detailed files rather than 338, and settled at 408 overview draw calls. Reviewed the restored street capture.
- The observed initial-allocation reduction is only 24 buildings in this fixture. This does not establish a peak-memory budget: fresh blocks, initial snapshots and preview geometry remain to address, alongside unloaded-directory massing and all remaining original requirements.

## Exploration visibility

- Owner/repository exploration now removes the broad dark page gradients over the scene, retaining only light shading near the top and bottom UI. The stronger homepage text backdrop remains for the world introduction. The exploration override also applies at phone widths.
- TypeScript passed. Day/night/phone civic interaction and shader checks passed; reviewed all three captures. This improves visibility of existing materials and lighting, not the underlying architectural or terrain realism. The phone repo panel still obscures too much of the scene outside travel mode and needs a broader exploration layout pass.

## Compact phone exploration

- Phone owner/repo views now start with a compact title and Details control; repository arrivals also offer a direct Walk action. Details expands for source files, civic interactions and activities. Starting a street/highway walk collapses it, preserving access to walking controls after travel interruption. Desktop details retain their full layout.
- Touch movement captures the active pointer and clears held movement on release, cancellation or lost capture. Browser testing caught a panel-restoration regression that hid a pressed movement button; compact restoration fixed it. The travel fixture now uses a real browser pointer sequence and verifies the camera stops after release.
- Evidence: TypeScript, lint and production webpack build passed. Planned civic day/night/phone checks cover compact panel height below 110px, expanded file access, collapse on walking and visible controls. Reviewed compact phone civic and street captures. Standard shared-link/source/owner browser flows and dependency travel/interruption/return-to-world checks passed with clean runtime/shader monitoring.
- These are desktop Chrome phone-viewport checks, not physical-device performance certification. Terrain-responsive city composition, architectural/vegetation/vehicle art, bounded world streaming, broader gameplay and remaining production requirements stay open. Overall completion remains unproven; the status estimate given to the user is subjective, not a measured acceptance score.

## Source-derived roof silhouettes

- Added gable and hip roofs for smaller/simple source buildings alongside terraces for larger or more complex sources. Roof space is reserved inside the existing source-derived height. The pitched kit includes masonry gable ends, eaves, gutters, ridge caps and a restrained stack. File entrances and parcel anchors remain fixed.
- Coarse block geometry shares the roof profile and retains its roof material through detail release/regeneration, so distant buildings do not revert to full-height flat boxes. Geometry continues to regenerate from source data and path seeds.
- Evidence: 82 tests, lint, TypeScript and production webpack build passed. Tests exercise all three roof forms, source envelope bounds, exact regeneration and retained roof material. The 338-file browser expansion/approach check passed with clean shaders; overview draw calls increased from the previous 408 to 486 with the added coarse roof finishes. No performance gain is claimed. Live owner/district/street/day/night/phone captures completed without page errors; reviewed the owner, district and street daylight views.
- The live Next.js review still shows a severe composition mismatch: about 31.9K repository files are represented initially by 64 analyzed samples. Different roofs cannot make that sparse sample read as the real repository's city. Unloaded-directory massing and stable resolution into detailed file addresses are a priority for the next substantial composition change. The current server reserves land only for addressed source samples (`sourceLand`), so this requires coordinated data/address/plan/render changes, not merely adding decorative buildings. Terrain-responsive streets and all remaining original requirements stay open.

## Complete eligible-source inventory and stable directory slots

- The server now surveys every eligible source path from the already fetched Git tree before loading additional code detail. Persistent directory ordinals and per-directory file slots survive pagination, additions, removals and reopening the store; retired slots are not recycled. This is a separate address layer, leaving existing city coordinates, land claims and rendered file addresses intact during the transition.
- Repo and directory APIs carry compact 64-slot block summaries and directory addresses for requested files. Full tree paths remain on the server. Counts distinguish observed files, retained capacity and measured parsing coverage; incomplete Git trees are explicitly marked incomplete. Source analysis accumulated through exploration contributes measured symbol/complexity subtotals without extrapolating unparsed files. Client expansion retains the new inventory metadata.
- Evidence: 84 tests, lint, TypeScript and production webpack build passed. A 20K-file test verifies bounded summary payload, page independence, deletion/addition/reopen stability, partial-tree reporting and unchanged legacy addresses. The live Next.js API review found 27,018 eligible source files (distinct from 31,877 total blobs), 438 inventory blocks and a 28,950-byte summary. Expanding `.config` returned 18 files, raised measured parsing coverage from 64 to 82 and retained initial global/directory addresses. Local development server restarted on port 3010 to load the API change.
- This is the stable inventory foundation, not rendered semantic massing. The new logical blocks still require physical region allocation, shared streets/terrain, aggregate geometry and progressive resolution that preserves locations. Persistent directory-slot storage also needs inclusion in the production persistence/cache design. All original completion requirements remain active.

## Physical directory block layout — staged for renderer integration

- Added a deterministic 64-slot block layout occupying three existing city columns by two rows. Its perimeter follows the owner street lattice; three internal streets serve six paired frontage rows. File plots keep their full 3.2 by 2.9 allocation and leave clearance for sidewalks and neighboring buildings. This supplies actual positions for eventual detail, rather than a coarse box unrelated to its files.
- Added persistent directory land reservations, preservation of legacy file placement, and spatially indexed clearance against other owners' civic/land footprints. Ordinary future land allocation respects directory reservations. New city-anchor searches also reject occupied civic footprints. Same-owner growth and cross-owner separation are tested.
- Evidence: 87 tests, lint, TypeScript and production webpack build passed. Coverage includes plot containment, road clearance, pairwise non-overlap, repository growth, other-owner footprints, legacy/new placement flags and store-reopen stability. A 438-region local allocation benchmark before the final cross-owner clearance addition took 71ms initially and 1ms when already reserved; these are CPU allocation measurements, not browser frame-rate evidence.
- The live physical-reservation prototype returned stable sites and a 38,251-byte summary. Integration review caught a staging hazard: making those sites unavailable to the old renderer would push future legacy expansions outward before the new plots were usable. API activation was therefore removed; only newly created, unrendered prototype reservations/legacy flags were cleared. Existing source/directory slots, city coordinates, land claims, players and currency were retained. The active API and standard phone/source/owner browser checks pass again; the live logical inventory remains 28,950 bytes and no staged reservations remain in the local database.
- Next required integration: the renderer must place `directoryLocated` files into these plots, draw aggregate groups and their matching perimeter/internal streets and ground, exclude legacy files from aggregate counts, and request the selected 64-slot group rather than always paging from the start of its directory. Activate `inventoryLand`/`inventoryFiles` in the API only with that path working. This staged layout is not visible semantic massing or completion of city composition. All original requirements remain open as previously recorded.

## Targeted block loading and the directory street network

- Directory requests can now target a particular stable 64-slot group with an explicit repository ref. The server verifies the snapshot, selects only that group's eligible paths still present in the tree, and reuses matching cached analysis. Stale refs and invalid block indices are rejected. Normal directory pagination remains available.
- The client distinguishes block requests from whole-directory cursors, queues expansion work to prevent completion-order overwrites, retains the current camera, and allows unavailable block data to be retried. Geometry picking can pass a block index and focuses on the actual hit point. These hooks are ready for aggregate meshes; visible directory massing remains staged.
- Added `directoryNetwork`, which replaces the six underlying survey cells with the group's real perimeter and three access streets. Mandatory file-access streets survive connector pruning. Shared graph construction now handles longer perimeters and bins nearby vertices; connected developed components are attached together before bridge searches. This avoids both roads through directory plots and repeated global searches for each adjoining cell.
- Evidence: 88 tests and lint/TypeScript passed. The new network test checks graph connectivity, every plot against actual road widths, and retention of serving streets. A local 438-group network build took 147ms for 4,847 nodes and 6,600 edges; no browser frame-rate claim is made. Live Next.js verification selected `crates` block 17 (10 files in its exact slot range) and rejected stale/invalid requests. The 338-file expansion browser test passed. Owner walking/phone tests passed with a largest sampled step about 0.565 units and no runtime errors.
- Phone testing caught an initialization race in the prior compact-panel work: clicking Details early could be undone when renderer readiness triggered the route effect. Resetting the panel on explicit navigation/history traversal instead fixed the repeat test. Production builds passed during implementation; a final build includes this last UI fix.
- Remaining activation work: aggregate occupancy/legacy accounting, detailed file placement into the reserved groups, renderer/terrain integration, appropriate group loading on approach, and performance/visual review of the complete live inventory. Preview block clicks must enter the correct repo before requesting its source; group coordinates must stay in the correct owner/repo frame. Physical reservation activation remains disabled in the live API until that integrated path works. All original requirements remain in scope.

## Directory geometry resolves at fixed plots — renderer integration staged

- Inventory blocks now carry exact active-slot masks and preserved-legacy masks. The client excludes deleted paths, already detailed files and preserved legacy buildings from coarse occupancy. Reserved directory plots feed both repository and merged owner street plans in their correct coordinate frames; ordinary courtyard paths no longer cross these directory plots.
- Added a single instanced coarse-envelope draw per repo, with instance-specific repo/directory/block picking. Active views and cached neighborhood previews consume it. Selecting a preview envelope enters its repository before requesting source data, avoiding requests against the previously active repo. Loading detailed sources removes only their own envelopes. These neutral envelopes intentionally do not invent source height, commit history, activity or windows.
- Coarse collision boxes use 16-unit spatial buckets instead of adding tens of thousands of boxes to the walking loop. Preview reuse now compares inventory metadata as well as files/land. Remaining concerns include neighboring coarse collisions, proximity loading, large-world terrain cost, full-inventory performance and source endpoint metadata/legacy allocation before live API activation.
- Evidence: 90 tests pass, TypeScript and production webpack build pass. New tests cover exact unresolved occupancy, deletion, preserved legacy placement, detail replacing the corresponding plot, owner/repo world-coordinate agreement and instance picking metadata. The Chrome/Metal 258-source fixture resolves 64 sources from 250 coarse plots to 186, with 72 total detailed files and clean runtime/shader monitoring. It reported 234 draw calls and 2,638,246 triangles after expansion; this is not physical-phone performance evidence. Initial browser failures were an incomplete test fixture missing commits, corrected before the successful run.
- Reviewed `/private/tmp/gitcity-inventory-before.png` and `/private/tmp/gitcity-inventory-after.png`. The replacement is visible and stable, but the survey appearance is still too repetitive, macro blocks leave excessive empty frontage, and sparse final groups retain too many empty streets. This is explicitly not final visual acceptance. The underlying street grid and vegetation also remain below the user's requested realism.
- Physical reservation activation remains disabled in the live API. Next work must improve block composition, complete metadata/allocation activation coherently, trigger detail on approach, and validate a complete large repository in-browser. No push/deploy. All original redesign and production/gameplay requirements remain open as recorded above.

## Live inventory activation, neighborhood arrivals and automatic resolution

- Activated the coordinated directory allocation/rendering path locally. `sourceLayout` preserves legacy addresses at first activation, then assigns newly explored files only to their directory plots. New repositories use directory plots for their initial detail as well. Source-file responses carry the inventory needed to place directly linked files. Cached partial responses retain explicit incomplete status and stable slots; the client preserves an existing complete inventory when a source fallback has no ref.
- The live Next.js API now supplies 438 physical groups for 27,018 eligible sources in about 56.9KB of summary JSON. Initial legacy addresses remained stable, `.config` expansion and exact `crates` block 17 selection passed, and stale refs/invalid indices are still rejected. A database backup was taken at `/private/tmp/gitcity-before-inventory-activation.sqlite` before activation. Local server restarted on port 3010 (PID 7675, session 36129); no push/deploy.
- Directory access streets are now drawn only for rows containing current nonlegacy files; resolving detail does not change those roads. Empty reserved rows remain unbuilt. This removes some unnecessary internal roads but does not solve oversized block perimeters/frontage or the overall grid composition.
- Repository links now arrive at a bounded neighborhood framing centered on nearby detailed entrances. Removed a separate UI overview call that had overridden the new camera target. Bird’s-eye view still deliberately frames the full city. Sun shadows follow the viewing area with bounded coverage instead of stretching one texture across the repository footprint.
- Terrain edge-distance queries use a spatial influence index with the existing 88-unit terrain transition radius. The new distance test checks 438 rectangles across negative coordinates and bin boundaries against exact distances. This preserves the terrain field within its influence radius without scanning all city polygons at every ground/plant point.
- Walking or descending below 24 units requests nearby unresolved blocks automatically, one request at a time. Successful requests advance after two seconds; failures have a 30-second retry delay. Source resolution retains camera and old buildings. The Chrome/Metal walking fixture requested block zero first, then a neighboring group, reaching 128 detailed files from eight without repeated block requests; construction settled and camera height matched the walking floor.
- Evidence so far: 93 tests, TypeScript and lint pass. The 27,018-file Chrome fixture completed after neighborhood arrival correction (182 draw calls and 3,785,706 triangles after expansion; not a physical-device FPS claim). The real owner/repo/street/day/night/phone review completed with no page errors. Reviewed real district daylight, phone night and automatic-walking captures. Earlier full-size capture framed the city too far away; an intermediate browser run was interrupted by development hot reload and was repeated with source files stable.
- Visual acceptance remains open. Actual captures still show repetitive neutral survey envelopes, broad empty setbacks, a largely grid-based plan and insufficiently convincing trees/streets/buildings. Automatic loading now connects exploration to real detail, but this is not the final architectural kit, terrain-responsive city composition, whole-world memory bound, production persistence or complete contribution game loop. All original requirements remain active.
- Final production webpack build and lint passed. The 338-file pagination regression passed after explicitly selecting Bird’s-eye view for its distant-initialization assertion (314 initially detailed files, 27 batched blocks, 486 draw calls at that fixture view). Camera retention and prior-file preservation passed across all five expansion pages. This adjustment follows the intentionally changed arrival framing; it does not claim nearby initial detail is reduced.

## Planted directory courts and bounded tree detail

- Added connected public courts in the unused wings beside fixed directory source rows. Courts retain every current/future file plot, connect to built access streets and do not appear beside wholly absent streets. Paved edges, planted islands, paired trees and seating replace some unstructured empty frontage. The first visual pass had too much hardscape; enlarged planted islands after inspecting the capture.
- Coarse source envelopes now use restrained masonry colors by row and a distinct roof finish. Their height remains neutral; these finishes do not imply unseen source metrics, commit activity or occupancy. Detailed brick façades now have filtered shallow mortar relief in their lighting normal. Reduced the relief after close-up review showed the initial depth was excessive.
- Full-city planting initially increased the fixture to 11,075,848 rendered triangles. Added two fixed tree kits with instance transfer: detailed branches nearby, simplified trunk/crown geometry in the distance, 70/90-unit hysteresis and updates after camera movement. Distant trees do not cast shadows. Repeated 27,018-source fixture reported 4,790,090 triangles and 190 draw calls after expansion, versus 3,785,706 triangles before this public-realm pass. This reduces the new planting cost but is not a performance gain against the pre-court baseline or proof of physical-phone FPS.
- Evidence: 95 tests pass, TypeScript passes. New coverage checks court containment, reserved-plot and street clearance, sidewalk connections, deterministic placement, and transfer of every tree between detail levels without duplication, including owner-coordinate transforms and hysteresis. Chrome/Metal expansion and walking fixtures passed with clean runtime/shader monitoring. Reviewed overview and walking captures. Automatic walking still resolved 128 detailed files without duplicate requests and kept the camera at the walking floor.
- These are incremental public-realm/material improvements. Repetitive coarse boxes, broad setbacks, overly regular streets, final architectural/vehicle/person/tree art, terrain-responsive geography, whole-world memory limits, production persistence and the complete outward-contribution game loop remain open. No push/deploy; the original goal remains active.

- Final production webpack build and lint passed for the planted-court and vegetation-detail pass.

## Facade openings and street-level shared links

- Corrected opaque facade panels that overlapped lower window panes and left mismatched gaps above windows. Added a restrained ground-floor band; the glass family has wider panes, thinner piers and taller glazing. Raycast tests verify upper/lower window samples actually hit glazing across brick, concrete and glass families, while wall areas remain opaque. Source-derived dimensions and file addresses remain unchanged.
- Ordinary repository URLs now arrive on the street as originally requested. Arrival selects a real frontage with buildings visible along the street rather than the first alphabetic file facing an empty stretch. Selection preserves owner-coordinate translation and stable tie-breaking. Explicit `?view=overview` and Bird’s-eye view remain available. Phone compact controls expose City view while walking and Walk while above the city.
- Nearby automatic source loading preserves an active camera destination as well as its current position/target. Scripted flights now own the camera until arrival rather than competing with OrbitControls damping. Added camera destination/walking diagnostics and a phone shared-link → overview → street review with normal motion.
- Live phone review exposed an NPC head occupying most of the camera view. Pedestrian materials now use a short-range dithered visibility falloff, retaining opaque rendering and model positions. An integration error accidentally applied the visitor hook in the unrelated shadow constructor, causing `visitor is not defined`; fixed that error, verified TypeScript independently, and repeated the live phone test with runtime and shader monitoring.
- Terrain updates now generate the nearest missing tile per frame and retain an old revision until the replacement tile is ready. Tests cover one-tile progress, revision replacement without dropping existing ground, and return to a prior area during an incomplete rebuild. This bounds per-update terrain work but has not resolved the full rendering stall.
- Evidence: 98 tests, TypeScript, lint and production webpack build pass. Controlled expansion and automatic street-arrival browser fixtures pass. Live owner/district/street/day/night/phone captures completed; reviewed the phone street view and caught the head obstruction there before fixing it. The animated phone flow reaches the walking floor after returning from overview, with no monitored runtime/shader errors.
- Performance remains specifically unresolved: camera tracing saw a roughly 2.4-second frame before tile batching and a 2.65-second frame in the later repeat. The normal-motion test needs a 15-second return allowance rather than its old five-second assertion. Do not claim terrain batching fixed that stall or that physical-phone performance is certified. Next profiling must identify remaining CPU/GPU/main-thread work during the transition. The original city-art, urban-layout, gameplay, persistence and world-streaming requirements remain active; no push/deploy.
- The stationary/reduced-motion phone repeat also passed with runtime/shader monitoring, including overview return. Reviewed its capture: the previously obstructing head is absent while the street and more distant pedestrians remain visible.

## Profiling street rebuilds and traffic restoration

- Phone CPU profiling traced the overview/return pause to background neighbor previews rebuilding owner streets and traffic. Batched atlas, owner and nearby-repo preview responses so each response group rebuilds an owner once. Indexed developed-block boundary checks used by connected street generation. This does not yet prevent rebuilding unchanged owner geometry or make distant previews true impostors.
- Replaced the journey solver's repeated linear minimum search with a stable heap and early termination once no cheaper destination route is possible. Exhaustive-reference tests cover blocked vehicle streets, projected endpoints and disconnected destinations. The 4,847-node/6,600-edge, 80-actor benchmark reduced routing from about 416ms to 64ms in the earlier comparison.
- Street markings, lamps and furniture now write their box faces directly into shared buffers instead of allocating and transforming a BoxGeometry per part before merging. Tests compare positions, normals, UVs and indices with the previous geometry, including growth beyond 65,535 vertices. A 12,000-box local CPU benchmark measured 59–89ms for the old construction/merge versus 3–7ms packed; this is not browser FPS evidence.
- Added an exact segment bounds tree for nearest-road projection and route-coverage candidates during traffic restoration. Original edge ordinals preserve equal-distance choices. Exhaustive nearest/bounds comparisons cover 500 query points, duplicate-edge ties, distant queries and empty graphs. Existing route restoration, origin shifts, closures and subdivision tests pass. Index construction adds cost: the small 64-destination benchmark's construction/projection phase increased from about 23ms to 46ms, while the browser trace no longer shows projection/coverage among its leading self-time samples.
- Three successive animated phone runs sampled stalls of 2,209.5ms after preview batching, 1,679.5ms after packed boxes, and 1,541.5ms after traffic indexing. These are sparse development-browser samples, not controlled benchmarks, whole-run maximum frame times, or physical-phone certification. Navigation and runtime/shader monitoring passed. CPU profiles still identify street ShapeGeometry hole triangulation as a major remaining cost. The pause is reduced in these observations, not fixed.
- 101 tests, lint and TypeScript pass. Reviewed the phone street capture: roads/buildings remain present, but repetitive architecture and stylized people remain visibly below the requested realism. Production build verification follows. No deployment. The complete art, urban-layout, interactive contribution loop, persistence and world-streaming requirements remain open.
- Final production webpack build passed for the street-buffer and traffic-index changes.

## Bounded reuse of verified street pavement

- Isolated road, curb and sidewalk geometry into `street-pavement.mjs`. An LRU holds at most three CPU geometry templates and 16MiB of accounted key/buffer data. Keys include exact node coordinates/IDs and edge endpoints/widths; road changes regenerate pavement. Each caller gets owned geometry clones so highway-opening edits and renderer disposal cannot corrupt a later city rebuild. Oversized networks are built but not retained. JS object/Map overhead is additional to the accounted byte cap.
- Kept the existing joined-polygon triangulation. Two attempted decompositions failed the large-fixture area checks (edge strips overlapped at width transitions; face ribbons mishandled complex boundaries), so neither is shipped. This cache reduces repeated work; first-time triangulation remains expensive.
- The 438-directory/6,600-edge benchmark measured about 330ms initially and 2–7ms on repeated requests, retaining approximately 5.76MB and returning the same 84,300 pavement/curb/sidewalk triangles. These are CPU measurements, not FPS claims. Cache tests cover independent mutation/disposal, geometry invalidation, byte/entry eviction and oversized uncached results. Existing area and sparse-road coverage tests still pass.
- Improved the phone review to collect every rAF interval throughout overview/return instead of relying only on sparse renderer diagnostic samples. Latest normal-motion local Chrome run reported 229 intervals, max 26.3ms, p95 15.1ms and none above 100ms; navigation/runtime/shader checks passed. This is one desktop Chrome phone-viewport run with local cached data, not physical-phone certification, cold-load evidence, or a claim that every transition stall is fixed. The preceding profiled run also passed; its sparse samples contained no large pause.
- 103 tests, TypeScript and lint pass. Reviewed the street capture: connected pavement remains visible, and the art remains below the realism target. Production build follows. The full visual redesign, less regular geography, contribution gameplay, production persistence and whole-world resource bounds remain open. Nothing deployed.
- Final production webpack build passed for bounded pavement reuse.

## Varied window interiors and revised pedestrian proportions

- Existing room-depth glazing now varies partial roller blinds, curtain widths and room finish, with darker room corners and side walls. Individual window selections use path-seeded integer UV cells while fractional UVs retain room projection. This adds no interior meshes and survives merged neighborhood geometry and translation. It does not imply GitHub activity; commit-driven window lighting remains separate.
- Added coverage for repeatable path-based window selections, different selections across panes/files and preservation through batching. Existing facade opening raycasts now identify the revised glazing shader. 104 tests, TypeScript and lint pass. The normal-motion phone review passed runtime/shader monitoring; reviewed the resulting street capture. These are visible close-range material changes, not final facade art or a city-wide realism transformation.
- Rebuilt both existing CC0 pedestrian assets from their local source glTF with smaller heads and elongated bodies. Applied the same deformation to all eight baked walking poses and retained approximately the previous overall city-scale height. Updated the provenance and reproducible bake script. Models remain simplified figures; better clothing/body art and animation still need work. Reviewed the in-scene capture.
- The later pedestrian review measured a 1,493.9ms maximum rAF interval despite passing navigation and shader checks. This contradicts any broad inference from the prior smooth run: pavement caching helps repeat work but has not proven transition stalls resolved. First-time geometry/rebuild scheduling and physical-phone performance remain open.
- The older camera/model test initially timed out waiting for Walk visibility/stability under software rendering. An attempted unconditional Details expansion also failed because the 850px fixture uses the desktop panel. The final test waits for the canvas and conditionally opens Details when present; Chrome/Metal passes all model loading, GPU morph, walking-drag floor, wheel/pan floor and shader checks. The initial timeout cause was not conclusively isolated. Production build follows. No deployment; all larger visual, city-composition, gameplay, persistence and streaming requirements remain active.
- Final production webpack build passed for revised window interiors and pedestrian assets.

## Returning to contribution investigations

- Added a field notebook to city hall and the neighborhood panel. On-site surveys retain the issue title and existing plan/time; visitors can discover their saved investigations after a reload, resume an available work site, open the canonical GitHub issue, or remove a note. Both notebook views update together and listen for storage changes from another tab.
- Older note/time-only surveys remain readable. Entries outside the current issue sample remain visible with their GitHub link and an explicit status-check prompt. Confirmed closed issues keep their notes but offer no resume action to a removed marker. Notes remain device-local and do not claim issues, mint currency, confer ownership or assert accepted contributions.
- Parser tests cover old surveys, repository isolation, malformed entries and the existing physical survey gate. The browser review surveys an actual fixture work site, reloads, discovers/resumes its saved plan, checks open then closed GitHub fixture responses, verifies the city-hall notebook and canonical issue link, and removes the note. This is fixture evidence for the return-investigation loop, not a verified live merge/reward lifecycle.
- 106 tests, TypeScript and lint pass. Browser survey/reload/resume/closure checks pass. Phone-width notebook review and production build follow. The full contribution economy/reward loop, durable production state, city-art/layout redesign and stable world streaming remain open. Nothing deployed.
- Phone city-hall capture reviewed; note text and GitHub/remove actions fit the modal. The phone removal check and final production webpack build passed.

## Targeted accepted-pull-request verification

- Added a signed-in account form and authenticated `POST /api/contributions/verify`. Visitors can submit one GitHub PR URL after a merge rather than repeat all historical contribution queries. URL parsing is confined to HTTPS github.com pull-request paths; the server reads GitHub data and does not send messages or change repositories. Used the official pull-request API contract: https://docs.github.com/en/rest/pulls/pulls#get-a-pull-request.
- Extracted shared acceptance logic used by history restoration and targeted verification. Checks include the signed-in author, merge state, a different human merger, personal and organization-admin ownership, repository privacy/opt-out, and file/dependency data before the existing transactional ledger grants credits, residency, ownership and upstream shares. Canonical repository ownership is checked after redirects/renames. Membership failures other than 404 cannot establish eligibility and halt verification.
- Targeted verification uses the GitHub issue ID as the ledger identity, matching existing search-based history imports (PR resource IDs are different). Tests verify one-time crediting across both entry paths, dependency treasury allocation, surviving-file recognition, and rejection with zero ledger/ownership writes for ineligible or unverifiable work. An already-recorded contribution reports that result rather than issuing another reward. The existing 3,000-file API page ceiling remains; this does not establish exhaustive file attribution for larger PRs.
- The form refreshes player/city recognition after verification. A subsequent city-refresh failure preserves the successful verification message; it does not report the ledger operation as failed. The browser fixture checks the form, repeated verification, a building plaque without camera movement/reconstruction, and the city-hall link to attributed source. Unsigned-in POST against the restarted real local endpoint returned 401.
- 109 tests and initial TypeScript/lint passed. Targeted browser recognition passed; final refresh-handling repeat and production checks follow. No real account contribution was imported by these tests, and no production durability/authenticated live merge lifecycle is certified. Local dev server restarted on port 3010, PID 53914. The broader graphics/layout, world performance, complete game loop and production persistence requirements remain open. Nothing deployed.
- Final targeted browser repeat, lint and production webpack build passed, including the final recognition-refresh handling.

## Acceptance failure and retry audit

- Tightened accepted-work verification to require GitHub's explicit `User` merger type. Missing/unknown types and migration mannequins no longer pass merely because they are not labeled `Bot`.
- Added concurrent targeted/history verification coverage using the real SQLite transaction: exactly one ledger award, one attribution and no repeated upstream allocation. An interrupted second file page leaves the ledger/wallet untouched; retry records all 101 surviving fixture files and excludes deleted files. An injected ownership-write failure rolls back ledger, wallet, residency and treasury before a successful retry.
- A temporary on-disk database test closes and reopens the store, then verifies the same PR again: credits, residency and file attribution persist and the retry reports already recorded. This proves local SQLite persistence only; it does not validate Vercel storage, distributed sessions/jobs or production recovery.
- 113 tests and lint pass. This pass changes server eligibility logic and backend tests; frontend source and assets are unchanged, so the preceding successful production UI build was not repeated. The local server is restarted to activate the check. The full visuals/gameplay/world-streaming/production scope remains unfinished; nothing deployed.

## Foliage breeze and leaf backlighting

- Added a shared-time, low-amplitude foliage deformation seeded by each tree's world position. Existing leaf cards move; trunks, instance counts and triangle counts are unchanged. Reduced-motion mode holds the foliage clock at zero. Culling bounds reserve deformation at the largest instance scale.
- Visible, depth-shadow and point-distance-shadow materials use the same deformation and alpha cutout map. Owned shadow materials are released with the visible foliage material. Added lifecycle/culling coverage; existing near/far instance transfer tests still pass. A modest analytic forward-scattering lobe adds leaf backlighting from the directional light; this is not full physical subsurface scattering.
- 114 tests, TypeScript and lint pass. Normal-motion phone navigation/shader check passed (one local run max rAF interval 15.3ms; this does not supersede the previously observed 1.49-second stall). Desktop Chrome/Metal camera/model test passed with shadows enabled and no monitored shader errors. The live owner/district/street/day/night/phone capture suite completed without page errors. Reviewed the real street-day image: vegetation renders, but conifer silhouettes remain sparse, repeated facades remain prominent and overall art quality still falls short. The live day's CI storm lighting does not constitute a controlled sunny backlighting comparison.
- Production build follows. This adds motion and lighting to the existing kits; final tree/vehicle/person/building art, organic city composition, stable cold/phone performance, complete contribution gameplay and production persistence remain open. No deployment.
- Final production webpack build passed for foliage motion/backlighting.

## Fuller conifer crown composition

- Redistributed conifer sprays inward along branches and varied spray size with crown height. Larger lower sprays and a retained upper leader reduce the isolated-tuft silhouette. Detailed, middle and distant kits retain their previous triangle and instance counts; broadleaf generation is unchanged.
- The first taper was too narrow and made the reviewed upper crown barer, so it was revised before acceptance. Increased conifer needle length/width modestly and retained the existing coverage-preserving mip construction. Base alpha-test coverage measured 19.26% before and 27.69% after. This increases pixel coverage/overdraw despite unchanged triangles; no general performance gain is claimed.
- Repeated the real owner/district/street/day/night/phone capture suite without page errors. Reviewed the street-day comparison: the retained revision has fuller crowns and less exposed trunk between the foliage clusters than the first attempt and original capture. Trees remain stylized procedural kits; final botanical art quality is not complete.
- 114 tests and lint pass. Normal-motion phone runtime/shader/navigation check passes, with p95 rAF interval 15ms but a 1,027ms maximum interval. The existing intermittent transition stall therefore remains open; these desktop Chrome phone-viewport samples do not certify physical-device performance. Production build follows. All broader city-art, connected organic layout, gameplay, persistence and world-streaming requirements remain active; no deployment.
- Final production webpack build, including TypeScript, passed for the retained conifer revision.

## Skip redundant background previews of the active district

- Background atlas/neighbor batches now skip the currently loaded repository, case-insensitively. Its active source data and detailed geometry remain authoritative. Direct preview generation when leaving a district is retained, so owner/world views still materialize the current neighborhood. A batch containing only skipped entries no longer clears city trees unnecessarily.
- Added active-preview skip and owner-rebuild counters for diagnostics. A delayed-atlas browser fixture injects an older, differently cased snapshot containing an obsolete file: construction count, owner rebuild count and camera position remain unchanged. Leaving via the owner breadcrumb then retains the current 18-file neighborhood. Reviewed the owner-view capture. The first test run used an anchor selector for a button breadcrumb; corrected and repeated successfully.
- 114 tests, TypeScript and lint pass. The real normal-motion phone profile passes navigation/runtime/shader checks but still reports a 1,240.2ms maximum rAF interval (p95 15ms). Leading remaining CPU samples include first-time pavement hole triangulation, traffic path initialization, and street box construction from actual neighboring preview arrivals. The targeted redundant-work fix is verified; the general transition stall is not resolved.
- Production build follows. The required next performance work includes scheduling/off-thread generation for substantial new owner geometry, with old ground remaining visible until replacement. This does not replace the original art/layout, gameplay, persistence and whole-world streaming requirements. No deployment.
- Final production webpack build passed for the active-preview fix.

## Worker-prepared background pavement and layout reuse

- Background preview batches now prepare pavement in a browser module worker, transfer typed geometry buffers to the existing bounded cache, and then apply their neighborhoods. Existing scene geometry remains visible while preparation runs. Main-thread fallback is retained for unavailable/failed/timed-out workers. Worker lifetime is tied to the engine, and pending requests settle during disposal.
- Preview batches are serialized. Owner/neighbor navigation supplies an AbortSignal, checks cancellation after preparation, and checks the active repository again before applying a preview. A real browser test delays worker delivery, navigates to another owner, then releases the result: the canceled batch adds no old buildings/streets and does not move the new camera. The owner walking fixture verifies at least one actual worker build and still passes adjacent-neighborhood travel and phone entry.
- Prepared owner layouts are reused only when the current repository references/order still match. Directory networks retain city-space node identities and are translated into the active district frame instead of recomputing topology. A recursive full-layout comparison against a fresh two-repo inventory rebuild verifies coordinates/metadata and absence of source-plan mutation; legacy small plans retain their previous construction path.
- Buffer-transfer tests verify exact indices/attributes and detached sender buffers. Worker success, cache priming, failure and disposal tests pass alongside bounded-cache tests. 117 tests, TypeScript and lint pass. Production worker bundling passed during implementation; final build follows the layout-reuse change.
- Extended the phone profiler with `GITCITY_SETTLE=1`: it waits for a worker preparation and an empty preview queue before stopping frame measurement, then reports worker/queue/rebuild counters. An initial 188ms navigation-only maximum was too narrow to establish completion. The first queue-complete trace measured 1,413.9ms; after layout reuse/rebasing the repeated trace measured 973.3ms, p95 15.1ms, six worker builds and zero pending batches. These are successive desktop-Chrome development runs, not controlled production/physical-phone benchmarks.
- The main-thread profile no longer lists pavement hole triangulation among its leading work. Remaining costs include garbage collection, traffic initialization, street/architecture buffer creation and rendering. The visible pause is still unacceptable and not resolved. This infrastructure does not complete the larger art/organic-layout redesign, full contribution game loop, world resource bounds or production persistence. Nothing deployed.
- Final production webpack build, including the worker bundle and TypeScript, passed.

## Direct traffic restoration and transit continuity

- CityJourneys can now construct actors from a saved snapshot without calculating temporary trips first. Valid saved routes are restored directly; new actors and changed/unavailable routes still select trips. StreetLife uses this path during owner refresh, vehicle-network replacement and issue closure. The engine avoids restoring pedestrians a second time after constructor restoration, while reapplying original vehicle state after attaching the highway network.
- Fixed repeated-restoration behavior for actors whose origin is an in-transit location or a removed destination. Their current position is retained, with a projected transit origin; a removed target triggers a new route instead of leaving the actor at a freshly generated spawn point. Tests verify zero throwaway path searches for valid saved actors, new-population routing, in-transit position preservation and removed-target rerouting.
- The 4,847-node/6,600-edge benchmark measured about 59.4ms for reconstruction-plus-restore versus 7.7ms for direct restoration of 80 actors, excluding network-index creation in both measurements. These are CPU measurements, not browser FPS. The complete live phone queue trace passed navigation/runtime/shader checks with six worker builds and zero pending batches; maximum rAF interval was 867ms and p95 15.2ms. The remaining pause is still unresolved.
- 119 tests, TypeScript and lint pass. Browser traffic/issue-closure integration and production build follow. City art, organic layouts, the remaining main-thread rebuild costs, complete contribution gameplay and production persistence remain unfinished. No deployment.

- Direct traffic restoration: the planned-road street-life browser integration passed, including issue closure, retained notebook state and clean shaders. Final production webpack build passed.

## Slate surface on pitched roofs

- Added a shared procedural slate material to pitched source roofs and city hall. Staggered courses, restrained per-tile variation and derivative-based normal relief replace the uniform roof finish. Pattern contrast fades at subpixel scale; flat terrace roofs retain their previous material. No additional triangles, texture downloads or mesh submissions; fragment shading does add work.
- Browser civic day/night/phone capture and navigation checks pass without monitored shader/runtime errors. Reviewed the day capture: slate courses are visible, but heavy facade framing, flat surroundings and detached public-space composition remain obvious. This is a material improvement, not completion of the cohesive realistic neighborhood target.
- 119 tests, lint and production webpack build (including TypeScript) pass. Before image: /private/tmp/gitcity-roof-before.png; after: /private/tmp/gitcity-civic-day.png. Full city-art, organic layout, gameplay, transition performance, world resource bounds and production persistence requirements remain open. Nothing deployed.

## Civic entrance proportions and connected approach

- Replaced oversized solid window surrounds on side/rear elevations with slim jambs, lintels and projecting sills matching the front facade. Added restrained window transoms. The double-height lobby now has a smaller double-door assembly beneath a transom, with sidelights and correctly lowered handles.
- Replaced the short tilted slab, which extended into the masonry wing, with a continuous 3.6-unit side ramp rising 0.3 units to a shared landing. The narrower adjacent stair, solid ramp sides and handrails stay within the lobby recess and connect to the civic approach. This is geometry integration; general walking floor/collision behavior has not been expanded to support building interiors.
- The first extruded ramp was non-indexed and failed geometry batching; caught by both unit and browser checks. Added sequential indices, reran successfully. A raycast regression samples the ramp surface and both landing approaches, proving their expected continuous heights without wing interference.
- Reviewed the planned-city day capture: smaller door framing, slimmer windows and connected approach are visible. Civic day/night/phone navigation and monitored shader/runtime checks pass. 120 tests, lint and the production webpack build including TypeScript pass.
- Shrub art, forecourt/terrain composition, organic city layouts, broader realism, transition stalls, gameplay depth, bounded world streaming and durable production persistence remain incomplete. Nothing deployed.

## Botanical civic planter foliage

- Replaced 800 opaque sphere clumps with 480 instanced leaf sprays using the existing shared coverage-preserving botanical texture. Added 36 small stems into the existing timber batch. Seeded crown placement and leaf tint preserve deterministic regeneration; alpha cutouts retain leaf edges, with alpha-to-coverage where supported.
- Shrub geometry drops from 28,800 triangles to 960 leaf-card triangles plus 720 stem triangles, with unchanged mesh submissions. Overlapping alpha-tested cards add pixel work; this is not an established whole-frame performance improvement. The shared texture requires no new asset download.
- Reviewed the planned civic day capture: leaves and stems replace the pebble silhouette, with a lower, irregular canopy and the entrance remaining visible. Civic day/night/phone navigation and monitored shader/runtime checks pass. 120 tests, lint and production webpack build including TypeScript pass.
- This improves one prominent landscape asset. Full botanical quality, organic terrain/street composition, city art, transition stalls, gameplay depth, world resource bounds and durable production persistence remain unfinished. Nothing deployed.

## Building frontage and plot paving

- Replaced the narrow, mostly under-building entrance patch with paving across the source-derived facade width, capped at the plot width. Narrow side strips and a rear service pad use remaining plot space without changing building volumes, file addresses or road topology. The new strips use the existing packed pavement batch/material; they add boxes but no separate material submissions.
- The existing street placement already left only a small facade-to-sidewalk gap; investigation did not support moving buildings or inventing a larger missing connection. This pass addresses visible local ground seams rather than claiming to resolve the larger city composition.
- Civic/connected-city day/night/phone browser check passed without monitored shader/runtime errors. Reviewed the phone street capture: full facade bases meet paving, with the existing sidewalk and road preserved. 120 tests, lint and production webpack build including TypeScript pass.
- Large block spacing, organic terrain-responsive composition, broader graphics quality, transition performance, gameplay, world memory bounds and durable production persistence remain unfinished. Nothing deployed.

## Bounded exact city-axis prefix caching

- The full-queue profile identified cityCell/axis generation as remaining repeated work. Added LRU-bounded exact prefix sums for seeded block widths: 64 entries with 1,025 doubles each (about 513 KiB of numeric storage plus keys/metadata). Distant indices compute beyond the retained prefix without growing storage. Existing permanent city coordinates and topology are unchanged.
- Regression compares the previous algorithm exactly across positive/negative axes, varied seeds, increasing/decreasing indices, eviction and indices beyond the cache limit; retained entry and array limits are checked. A 30,000-lookup synthetic benchmark measured 81.5ms for the original loop versus 6.3ms cached, with identical totals. This is a CPU benchmark, not FPS.
- Full live phone arrival/city overview/walking/preview-queue check passed with six worker builds, zero pending batches and eight rebuilds. Max rAF interval 653.2ms; p95 15ms. The preceding run measured 867ms, but these successive development runs are not a controlled production/physical-device comparison. The remaining pause is still unacceptable and unresolved.
- 121 tests, lint and production webpack build including TypeScript pass. Full graphics/organic layout/gameplay/world bounds/production persistence scope remains active. Nothing deployed.

## Reuse repository layouts within owner preparation

- Owner preparation now returns its per-repository layouts in an optional batch-local map keyed by repository object identity. Preview architecture and neighbor collision/region setup reuse those layouts instead of rebuilding the same graph. No persistent layout cache is introduced; ordinary direct entry retains its existing layout generation.
- Extended the prepared-owner regression to compare every captured repository layout against a fresh calculation. TypeScript caught an initially overbroad replacement affecting direct entry; corrected before validation. 121 tests, TypeScript and lint pass.
- Full live phone queue trace passed navigation and monitored runtime/shader checks: six workers, zero pending batches, nine owner rebuilds, max rAF interval 813.8ms and p95 15.1ms. The preceding eight-rebuild run measured 653.2ms; the new result does not establish a whole-transition improvement. Remaining work still needs scheduling/resource reuse beyond removing duplicate layout calculations.
- Browser worker-cancellation test passes: navigation discards the old prepared owner without moving the new camera or adding stale buildings. Final production webpack build passes. Full visual/organic-layout/gameplay/world-resource/production scope remains unfinished; no deployment.

## Retain owner civic resources across street updates

- Owner street replacement now detaches and retains the existing civic hall before disposing the old street group. Geometry, materials, foliage instances and sign texture survive; position, visibility and picking ownership are refreshed when attached to the new group. If the owner has no repositories, normal disposal still removes the hall.
- Browser owner-city test now verifies the hall UUID remains identical and the owner hall build count stays one through owner view, district entry and walking into an adjacent neighborhood. Three-neighborhood travel, repeat-safe construction and phone arrival pass without monitored rendering errors; largest sampled walking step was 0.66 units.
- 121 tests, TypeScript, lint and production webpack build pass. This removes repeated civic allocation but does not establish a whole-frame performance improvement; the previously observed 814ms expansion pause remains unresolved. Full realism, organic layout, gameplay, world-resource bounds and production persistence remain unfinished. No deployment.

## Share owner spatial sites during highway planning

- Highway planning now allocates one world-space node array and bounds object per loaded owner, reused by all of that owner's repository entries. Previously each repository copied the same potentially large owner graph. The reuse is local to one rebuild and retains existing gateway/obstacle semantics; streetGateway does not mutate its node input.
- Full live phone queue trace passed with five workers, zero pending batches and seven rebuilds: max rAF interval 135.4ms, p95 15.1ms. This processed fewer updates than preceding runs and does not prove the general expansion stall resolved.
- Planned highway fixture verifies delayed terminal refresh from one to two, vehicle destinations from 19 to 38, retained active construction, dependency selection, phone UI, navigation and retained world highways. First invocation omitted its required GITCITY_PLAN=1; corrected. Its old hard-coded road screen click no longer opened the chooser in the current view; replaced with the visible dependency control and narrowed the reported test scope. Camera-aware road-picking verification remains outstanding, not claimed passed.
- 121 tests, TypeScript, lint and production webpack build pass. Full art/organic-layout/gameplay/performance/world bounds/production persistence requirements remain unfinished; no deployment.

## Camera-aware dependency road picking verification

- Added an on-demand development-only canvas diagnostic projecting current highway samples through the actual camera. It exposes screen coordinates only, performs no camera/scene mutation and is removed on disposal. No per-frame projection cost; verified zero occurrences of the hook in generated production JavaScript.
- Highway browser test now enters the user-accessible overhead view, selects an unobscured projected road point and sends a real pointer click. It closes the chooser, orbits with a real drag, projects again and verifies another road click opens the chooser. Delayed terminal/traffic-destination refresh, phone selector, repository navigation and retained world highway meshes also pass.
- The first attempt at the current street-level angle found no projected highway points outside the interface; this was not evidence of a picking failure. Switching to the overhead view established visible geometry before testing interaction. This closes the previously outstanding camera-aware road-picking fixture coverage, not every possible camera/occlusion case.
- 121 tests, TypeScript, lint and production webpack build pass. Full graphics, organic composition, gameplay depth, expansion performance, resource bounds and production persistence remain unfinished. No deployment.

## Verify accepted work at city hall

- Signed-in players can verify a merged PR directly at city hall beside the noticeboard and field notebook. The account panel retains the same action. Both use one shared refresh handler to update player state, residency/civic data and rendered attribution without restarting construction.
- The targeted recognition browser fixture now supports the city-hall entry path. It verifies acceptance, repeat-safe recognition, unchanged camera/construction during verification, and navigation from the accepted-work list into an attributed file outside the initial source sample. Reviewed the 390px phone form capture; the form stays within the dialog width and displays the recorded result.
- This is a controlled API fixture, not a live GitHub merge/OAuth/production verification. Existing backend acceptance/idempotency tests remain the server-side evidence. 121 tests, TypeScript, lint and production webpack build pass.
- Full contribution gameplay depth, actual production persistence, city art/organic layouts, expansion performance and world bounds remain unfinished. No deployment.

## Take saved investigations into contribution work

- Saved field notes now offer Copy contribution plan: issue title, canonical GitHub issue URL, current city URL and the player's saved text. It creates no external comment, issue claim or currency award. Browsers denying clipboard access show a styled selectable read-only brief instead.
- Notebook instances are keyed by repository so transient copy/status state cannot follow navigation to a different city. Removing a note clears its displayed fallback; resuming clears the copy notice.
- Extended the street-life browser fixture to inspect the exact clipboard payload with a controlled clipboard implementation, then simulate denied clipboard access and verify the fallback in the 390px city-hall notebook. Reload/resume, real issue-state fixture handling, removal and monitored shader/runtime checks pass. Reviewed the phone fallback capture.
- 121 tests, lint and production webpack build including TypeScript pass. Full art, organic city composition, gameplay depth, expansion performance, world resource bounds and durable production persistence remain unfinished. No deployment.

## Persistent dialog exit on phones

- Moved the shared modal close control into a sticky toolbar, with a 44px touch target and visible keyboard focus. Dialog scrolling is contained and reserves space for the toolbar. Long civic notebook/noticeboard content no longer carries the exit control offscreen.
- Extended the phone notebook browser check to verify the button's dimensions, viewport containment and actual element hit at its center while scrolled, then click it and verify the dialog closes. Existing survey/copy/fallback/removal and monitored runtime/shader checks pass. Reviewed the phone screenshot: close remains visible above scrolled notebook content.
- Lint and production webpack build including TypeScript pass. This is a UI-only change; the unchanged 121 unit tests were not repeated. The broader realism, organic composition, gameplay, expansion performance, world resource bounds and durable production persistence remain unfinished. No deployment.

## Preserve unchanged highway openings and terrain road state

- Removed the temporary empty-road assignment during highway refresh. The final complete road list still reaches Landscape.setRoads, including genuinely empty results; unchanged roads now retain their terrain revision instead of forcing two transitions.
- Removed the preliminary clearing of all street openings. applyStreetOpenings now remembers exact opening content and resulting geometry per mesh in a WeakMap, avoiding re-clipping unchanged entrances. Changed openings and empty results still replace/restore actual geometry; no retained global mesh cache.
- Extended raycast/resource tests: repeated equivalent opening arrays keep the exact geometry without disposal; a moved entrance releases the old cut once, restores the old location and opens the new location; removing it restores the original sidewalk.
- Full live phone trace passed with six workers, zero pending batches, eight owner rebuilds, max rAF interval 906.3ms and p95 15ms. The previous lighter 135ms run was not proof of resolution. Current profile includes roughly 265ms sampled garbage collection across the measured window; large allocation/geometry work remains.
- Planned highway browser fixture passes delayed terminal refresh, actual road picking before/after orbit, phone selection and retained world highways. 121 tests, lint and production webpack build including TypeScript pass. Broader graphics/organic layout/gameplay/performance/world-resource/production scope remains unfinished. No deployment.

## Direct buffer assembly for source building boxes

- Source architecture now writes its many facade/roof-detail boxes into per-material BoxBatch buffers instead of constructing and disposing a BoxGeometry per part. Flushes around custom pitched roofs preserve original vertex/index order. Masonry UVs use the same rounded positions; glass consumes the same path-seeded room offsets. Existing materials, envelopes and building identities are unchanged.
- Added architectural UV modes to BoxBatch and retained its default street behavior. Geometry output uses BufferAttribute around owned sliced arrays, avoiding the extra typed-array copy previously made by Float32BufferAttribute.
- Captured the previous complete position/normal/UV/index buffers for 24 varied buildings before editing and compared the new output: zero differing values. Permanent tests verify exact architectural box positions, normals and both UV modes through buffer growth, alongside existing roof/envelope/window tests.
- 122 tests, TypeScript and lint pass. Desktop Chrome/Metal model/morph/shadow/camera check passes without shader errors. Full phone queue passes with six workers, zero pending batches, eight rebuilds, max rAF 813.5ms and p95 15.2ms. This removes many temporary allocations but does not resolve the expansion pause.
- Final production webpack build passes. Full realistic art/organic layout/gameplay/world bounds/production persistence scope remains unfinished. Nothing deployed.

## Direct transformed neighborhood merging

- Replaced per-mesh clone/applyMatrix4 followed by mergeGeometries with direct writes into final neighborhood buffers. Position, normal and tangent transforms preserve Three.js semantics; other attributes copy unchanged. Source geometries remain owned by their callers. File ranges and retained source slices keep their previous ordering and offsets.
- Regression compares exact attributes and indices against the previous Three.js pipeline for indexed/non-indexed geometry, nonuniform transforms and 2,800 boxes crossing the 16-bit limit. It verifies source buffers remain unchanged and independent of the merged result. Existing picking/detail-restoration/window tests pass.
- 123 tests, TypeScript and lint pass. Phone queue check passes with six workers, zero pending batches and eight rebuilds: max rAF 694.4ms, p95 15.1ms. The preceding comparable-count run measured 813.5ms; these remain successive development runs, not controlled production/physical-device measurements. Expansion latency is still unresolved.
- Desktop Chrome/Metal model/morph/camera/shader check and final production webpack build pass. Full art/organic layout/gameplay/resource-bounds/production-persistence scope remains unfinished. No deployment.

## Cancellable rendering opportunities between preview phases

- Preview batches yield before preparing each owner and before committing prepared previews. Continuation runs in a task after an animation-frame opportunity; a 50ms timer prevents suspension in hidden tabs. Cancellation settles immediately, clears pending callbacks and is checked before scene changes. Existing geometry remains visible during the wait.
- Added tests for pre-aborted and actively canceled yields, frame delivery and suspended-frame fallback. The real browser worker-cancellation fixture still discards old owner work without moving the new camera or adding stale buildings.
- 124 tests, TypeScript and lint pass. Full phone queue passes with six workers, zero pending batches and eight rebuilds: max rAF 720.3ms, p95 15.1ms. Phase-level yields alone do not fix the long task inside an owner commit; intra-owner geometry scheduling/off-thread preparation remains necessary. No whole-transition speedup is claimed.
- Final production webpack build passes. Full art/organic-layout/gameplay/world-resource/production-persistence scope remains unfinished. No deployment.

## Direct street merging and phase-level expansion diagnostics

- Street finish batches now use direct typed-buffer merging without a transform pass or temporary JavaScript index arrays. Added an exact-buffer comparison for untransformed merges. Source layouts and road geometry are unchanged.
- Added development phase timings around owner planning, repository previews, street geometry, traffic, highways and landscape, with finer pavement/furniture/vegetation/merge timing inside street construction. Production paths omit timing/logging. The phone profiler records the timings alongside complete preview-queue frame measurements.
- The finer trace identifies prepared pavement at about 4ms, furniture/surface construction at 129–219ms, vegetation at 13–48ms and final merging at 63–93ms for large owner streets. One owner commit also spent 125ms in street life and 120ms in highways. These observations direct the next work toward intra-owner street assembly scheduling/off-thread generation, not additional pavement-worker changes.
- Full phone checks pass, but measured maxima remain poor: 907ms in one seven-rebuild run and 1,092.6ms in a nine-rebuild diagnostic run (six workers, zero pending batches, p95 15.1ms). This pass does not establish a whole-transition speedup.
- 125 tests, lint and final production webpack build including TypeScript pass. Full art/organic layout/gameplay/performance/world-resource/production-persistence scope remains unfinished. No deployment.

## Resumable offscreen street preparation

- Split planned street construction into generator checkpoints across markings, lamps, source frontages, directory courts, legacy blocks, vegetation and final material batches. Existing synchronous callers drain the same generator. Background owner preview batches use an 8ms work target with the existing rendering yield between chunks; individual operations can still exceed that target.
- Prepared street groups remain offscreen until the owner commit. The previous streets remain visible during preparation. The completed group is reused only with its matching prepared plan; unused/mismatched groups are released. Cancellation or engine disposal closes the generator and releases allocated surfaces/materials/instances. Preparation errors also run cleanup.
- Added exact synchronous-versus-staged geometry/instance comparison and partial/pre-aborted cleanup tests. Browser worker-cancellation test still discards old owner work without changing the new scene. Development phase timing now subtracts time spent suspended at checkpoints.
- Full phone queue run passed with six workers, zero pending batches and eight rebuilds. Owner commit measured 245ms (street life 126.6ms, highways 100.9ms); max rAF interval 426.1ms and p95 15.1ms. This is a successive development observation, not controlled production/physical-phone proof. Direct-entry synchronous street builds, large individual final merges, owner planning, traffic and highways remain potential long tasks.
- 127 tests, TypeScript, lint and final production webpack build pass. Full realistic art/organic layout/gameplay/world-resource/production-persistence scope remains unfinished. No deployment.

## Attach refreshed traffic only to the final highway network

- Owner street-life refresh now defers highway attachment until rebuildHighways has produced the replacement graph. It returns a restoration callback that reapplies the original vehicle snapshot after that attachment. This removes the intermediate JourneyNetwork construction against stale highways; ordinary direct refresh still attaches immediately. Pedestrian/driver state handling is retained.
- Full phone queue run passes with six workers, zero pending batches and eight rebuilds: street-life 84.4ms, highways 89ms, owner commit 193.7ms; max rAF interval 372.6ms and p95 15.2ms. The preceding street-life/commit timings were 126.6/245ms. These successive development runs do not establish physical-device performance, and the remaining pause is still too long.
- Planned highway browser fixture passes delayed terminal refresh and destination expansion, actual road picking before/after orbit, phone selection, repository navigation and retained world highways. Existing journey restoration tests pass with the full 127-test suite.
- TypeScript, lint and final production webpack build pass. Full art/organic layout/gameplay/performance/world-resource/production-persistence scope remains unfinished. No deployment.

## Defer vehicle journeys until the final network exists

- StreetLife supports deferred vehicle setup for owner refreshes. It holds the original vehicle snapshot/coordinate offset and initializes journeys once when the final highway network attaches, avoiding local trip selection that would immediately be replaced. If attachment cannot occur, finishVehicleSetup creates a local fallback. Ordinary direct-entry setup is retained.
- Added a development-only read-only traffic snapshot diagnostic, removed on disposal and verified absent from production JavaScript. The highway browser fixture can now add both a same-owner neighborhood and a dependency city while traffic is paused. It verifies destinations expand from 19 to 56 and every existing vehicle position remains exactly unchanged, then completes road picking/orbit/phone navigation checks.
- Full live phone queue passes with six workers, zero pending batches and eight rebuilds: max rAF 412.8ms, p95 15.1ms, street life 84.8ms, highways 88.8ms, owner commit 249ms. The preceding 372.6ms run means no clear whole-transition speedup is established; this pass removes intermediate initialization and proves continuity.
- 127 tests, TypeScript, lint and final production webpack build pass. Full realistic art/organic-layout/gameplay/performance/world-resource/production-persistence scope remains unfinished. No deployment.

## In-place segment index construction

- Replaced recursive full-array sorting/slicing with in-place median selection over working records. Original edge order remains untouched; bounded leaves and original-order tie breaking are preserved.
- Added 4,096-edge reverse-sorted/coincident coverage for balanced depth, membership, source-order preservation and query ordering. Prior validation: 128 tests, lint and production webpack build pass.
- Journey benchmark projection/index construction measured 44.261ms before and 12.258ms afterward. Latest full development phone trace measured street life 20.2ms, highways 26.7ms, owner commit 64.3ms and max frame interval 238.2ms. These are successive desktop browser observations, not physical-phone production proof. Traffic continuity and actual highway picking/navigation fixture pass.

## Recessed civic elevations

- Replaced solid municipal wing boxes with masonry bands and piers around the actual front, rear and side window openings. Glass and mullions sit behind the exterior face, exposing real brick reveals and enabling geometric shadow depth. Existing stone dressings, building envelope and entrance are retained.
- Civic glass now receives deterministic per-pane room UV offsets, using the existing room finish/blind variation without interior meshes or additional material submissions.
- Added raycast coverage proving front, rear and side rays reach recessed glass rather than hidden solid masonry. Full 129-test suite, lint and production webpack build including TypeScript pass. Browser city-hall day/night/phone review passes with no monitored shader/runtime errors; reviewed day and night captures at /private/tmp/gitcity-civic-day.png and /private/tmp/gitcity-civic-night.png. Before image: /private/tmp/gitcity-civic-before-recess.png.
- Visible improvement is incremental facade depth. The current image still shows overly uniform furnishings, flat city composition and weak vegetation/art cohesion. The overall realistic neighborhood target, organic urban geography, compelling gameplay, world resource bounds and durable production persistence remain incomplete. No deployment.

## Recover presentation quality after transient load

- Inspection found adaptive-lite was permanent for the visit once triggered: renderer pixel ratio stayed capped at 1 and desktop ambient occlusion stayed disabled even after rendering became smooth. Extracted frame-history policy and added recovery after a minimum 30-second cooldown plus eight continuous seconds below 21ms. Sustained slow rendering still falls back; suspension/slow frames reset the recovery window. Existing two-second full-quality readiness gate remains.
- Recovery restores the 1.5 pixel-ratio cap and existing eligible desktop composer without altering geometry, addresses or construction state. It does not force expensive postprocessing on phones or devices that remain slow.
- Added histories covering a slow arrival, recovery, failed expensive retry, 30fps devices and suspended tabs. Full 131-test suite, lint and production webpack build including TypeScript pass.
- Extended civic browser review with actual requestAnimationFrame throttling: observed adaptive-lite, released throttle, observed full quality and unchanged construction count, then passed day/night/phone and walking checks with clean monitored shaders/runtime. Initial fixture throttle was overwritten by test-clock setup; corrected by installing after arrival and reran successfully. Reviewed current day screenshot. This is desktop Chrome/Metal verification, not physical-phone performance proof.
- Broader city composition, art cohesion, organic terrain/streets, deeper gameplay, resource bounds and durable production state remain incomplete. No deployment.

## Continuous source-building entrance openings

- Source facades previously generated centered doors independently of ground-floor piers, shop windows and sills, allowing those layers to cross the entrance. Front-facing layers now split around one continuous centered entry opening; the plinth also leaves a shallow threshold there. Existing source-derived width/depth/height, entrance positions, roof variants and material batching are retained.
- Added raycasts across brick/concrete/glass source families proving the door glass remains unobstructed at multiple heights and both sides of the central mullion. Existing envelope, deterministic generation and geometry checks pass with the full 132-test suite.
- Lint and production webpack build including TypeScript pass. Model/camera/morph/shader browser regression and planned civic day/night/phone/walking review pass. Reviewed populated phone street view at /private/tmp/gitcity-phone-street-panel.png: entrances are clear along the frontage. The model fixture's early overview screenshot was not useful evidence of street appearance; used the populated civic walking capture instead.
- This corrects physical facade composition, not the full visual target. People/vegetation quality, organic city composition, deeper gameplay, world resource bounds and production persistence remain incomplete. Nothing deployed.

## Resting pedestrians and distance-driven gait

- Previously stopped pedestrians selected walk frame zero, leaving them frozen mid-stride; reduced-motion visitors also retained walking poses. Rebaked the existing citizen assets with the source Idle clip as base geometry and the same eight Walk morph targets. Downloads remain 2,052,600 and 2,088,496 bytes.
- Added per-visitor gait state: distance traveled advances the walk phase, stops blend to idle, pause preserves the current pose and reduced motion uses idle immediately. Large position changes do not spin the gait. Existing instanced GPU morph rendering remains; no per-person skeleton updates.
- Added tests for equal-distance motion across 30/120 updates, stopping, pause, reduced motion and teleportation. Full 134-test suite, lint and production webpack build including TypeScript pass. Browser model/morph/camera/shader regression and planned civic day/night/phone checks pass.
- Reviewed /private/tmp/gitcity-phone-street-panel.png: stationary visitors now stand on both feet instead of holding a stepping pose. Existing character anatomy/clothing still look stylized and awkward; this is an animation improvement, not a finished character art solution. Full city realism, organic composition, deeper gameplay, resource bounds and production persistence remain incomplete. No deployment.

## Rig-aware citizen proportions

- Replaced height-only vertex warping, which compressed shoulders and distorted arms along with the head, with bone-weight-based proportion adjustment during asset baking. Head vertices shrink around the animated head joint, leg-weighted vertices lengthen the lower body, and the torso/arms move together. The resting body normalizes to 0.55 city units; all eight walk targets receive the same process.
- Reviewed the populated phone screenshot against /private/tmp/gitcity-before-proportions.png. The shoulder/shirt silhouette is broader and the torso/arms more coherent. These remain stylized assets, not finished realistic character art. Downloads are 2,052,576 and 2,088,484 bytes; no runtime skeleton work was added.
- Direct GLB validation confirms finite position/normal data, eight morph targets and actual posed vertex heights between -0.01 and 0.6. An initial conservative geometry bounding-box assertion failed because Three.js expands relative morph bounds conservatively; corrected the verification to evaluate actual base-plus-target vertices, all of which pass.
- Browser model/morph/camera/shader and civic day/night/phone/walking reviews pass, as does the production webpack build. Asset/bake-script-only change; unchanged 134 unit tests were not repeated. Full realistic city composition/art/gameplay/resource-bounds/production scope remains incomplete. No deployment.

## Stable nearby street illumination

- Replaced direct once-per-second reassignment of the four nearby PointLights with a persistent fixture pool. Retained fixtures keep their slots; departing lights fade to zero before their position changes, then fade in at the replacement. A retained-fixture distance preference reduces boundary switching; duplicate fixtures do not consume multiple slots.
- Four existing lights remain the rendering budget. Selection still occurs with the existing lighting refresh, while bounded fade updates run each frame. Distant lamp pools and source geometry are unchanged.
- Added coverage for fixed positions while illuminated, fade-out/reassignment/fade-in, removal, duplicate fixtures, retained slot identity and boundary jitter. Full 136-test suite and lint pass. Planned civic day/night/phone/walking browser check passes with clean monitored shaders/runtime; reviewed night capture.
- Production build initially exposed JavaScript inference of null-only light positions; explicit nullable position types fixed it, and final webpack build including TypeScript passes. No deployment. Overall night art direction, organic city composition, richer gameplay, world resource bounds and production persistence remain unfinished.

## Connect investigations to saved pull requests

- Each field-notebook investigation can retain a GitHub PR link for the same repository. Links are canonicalized and validated before saving/rendering; credentialed, foreign-host/repository and non-PR URLs are rejected. Revising a survey preserves its saved PR instead of replacing all metadata.
- Signed-in city-hall notebooks can open acceptance verification prefilled from that saved PR. The existing server acceptance/award path is reused; saving a link claims nothing and grants no credits. Verification forms use unique accessible input IDs when several forms are present. The prior save reminder clears on verified acceptance.
- Added link-validation and revised-survey preservation tests; full 137-test suite passes. Lint and final production webpack build including TypeScript pass.
- Extended recognition browser fixture saves the PR, checks its link/prefill, verifies acceptance and duplicate handling, confirms plaque attribution without camera/construction changes and checks phone form bounds. Existing anonymous street survey/reload/resume/copy/closure/removal browser flow also passes. Reviewed phone verification screenshot. These use controlled API responses, not a real-account GitHub merge.
- PR tracking remains device-local. Full engaging game progression, organic city composition/visual quality, world resource bounds and durable production state remain incomplete. No deployment.

## Release distant preview facades

- Preview neighborhoods now have detailed and lightweight source-massing representations. Distant massing preserves file-derived footprints, heights and roof forms using fewer than one-twentieth of the tested detailed geometry indices. It does not invent additional buildings. Nearby facades regenerate from retained repo/layout data; replaced geometry/materials use existing disposal paths.
- Distant previews initially use massing based on anchor distance; actual generated world bounds subsequently govern detail. Facades release beyond 140 units and return within 100, one neighborhood per frame after pending preview batches finish. Active district streaming remains independent. Street topology, addresses and construction history are unchanged during preview detail transitions.
- Added source footprint/skyline/finite-geometry and reduction tests; full 138-test suite passes. Initial Node test import resolution failed on extensionless imports; fixed explicit module extensions. Lint and final production webpack build including TypeScript pass.
- Extended owner browser fixture uses actual zoom to simplify all three previews and restore nearby detail, verifying unchanged construction count and owner street rebuild count. It then walks continuously into the adjacent repo (largest sampled step 0.57), checks retained hall identity, and passes the phone shared-link route without monitored rendering errors.
- Reviewed populated owner street capture: facades remain present at walking distance. Fixture screenshot also exposes missing source metrics rendered as NaN/undefined, a separate UI robustness issue to address. This is not a complete whole-world budget: roads, cached repo data, massing, labels and distant-owner terrain still remain retained; individual detail rebuilds can still be long tasks. Full city art/organic composition/gameplay/production scope remains unfinished. No deployment.

## Honest partial-data presentation

- Addressed NaN/undefined observed in the owner street screenshot. Missing/nonfinite/negative repo counts display an unknown marker rather than a fabricated zero. Unreported CI receives the existing no-status explanation; missing history coverage and invalid timestamps have explicit unavailable text, including the arrival status line.
- Extended the partial-data owner browser fixture to assert unknown stars, no NaN/undefined metrics, unreported CI and unavailable history. It passes continuous neighborhood walking, retained civic identity and the phone shared-link path without monitored rendering errors.
- Lint and production webpack build including TypeScript pass. UI-only change; unchanged 138 unit tests were not repeated. Full realistic art/organic-city/gameplay/world-budget/production scope remains unfinished. No deployment.

## Stage preview detail replacements offscreen

- Distance-triggered preview changes now prepare facade kits across rendering opportunities with an 8ms work target. The currently visible skyline/facades remain installed until the replacement is ready. Only one preview preparation runs at once; source data changes, navigation into the repo, object replacement, camera reversal or engine disposal invalidate the result.
- Partial source geometry/materials are released on cancellation or failure. Completed unused replacements are also disposed. Prepared facades reuse the existing synchronous commit path; street topology and construction history are retained. Individual building calls, final merging and directory massing remain synchronous and can exceed the work target.
- Added exact staged-versus-direct geometry/placement comparison and partial/pre-canceled resource-release checks. Full 140-test suite, TypeScript, lint and final production webpack build pass.
- Owner browser test passes actual zoom-out simplification and near restoration with unchanged construction/street rebuild counts, continuous adjacent-repo walking (largest sampled step 0.565), civic identity and phone shared-link behavior without monitored shader/runtime errors. This establishes continuity/correctness, not a measured physical-phone frame-time improvement.
- Full realistic city art/organic composition/gameplay/world memory bounds/durable production scope remains incomplete. No deployment.

## Restore small-scale contact shadows

- Reduced directional shadow depth bias from -0.001 to -0.00008 and normal bias from 0.012 to 0.004; the former offset was large relative to small facade/bench details. Walking shadow coverage now has an 18-unit minimum half-extent instead of 28; other views retain their previous coverage. Shadow texture remains 1024 square.
- Compared fixed civic day views: shadows now visibly anchor benches and the building base. Reviewed phone/night capture without obvious acne in those views. Before capture: /private/tmp/gitcity-before-shadow-contact.png; current: /private/tmp/gitcity-civic-day.png. This is limited view-based evidence, not proof against every sun angle/device.
- Civic day/night/phone/walking and camera/model/morph/shader browser checks pass. Lint and production webpack build including TypeScript pass. Presentation-constant change; unchanged 140 unit tests were not repeated. Broader realistic art/organic composition/gameplay/world memory/production goals remain incomplete. No deployment.

## Shielded street-lamp kit

- Replaced the planned street lamp's full glowing cube and uniform pole with a planted base, slimmer upper shaft, mounting collar and opaque metal hood. Only the underside panel emits. Fixture locations/heights, light pools and the four-light nearby budget are retained.
- Geometry stays in the existing metal/emissive BoxBatch material buckets, adding four boxes per fixture without extra material submissions or point lights. This is a modest street-furniture refinement, not a major whole-scene visual improvement.
- Full 140-test suite, including staged/direct street geometry equivalence, lint and production webpack build including TypeScript pass. Civic day/night/phone/walking browser checks pass with clean monitored shaders/runtime; reviewed phone street capture.
- Full realistic city composition/art, deeper gameplay, world memory bounds and durable production scope remain unfinished. No deployment.

## Cut-stone surface definition

- Limestone walls now use subtle staggered course joints and restrained per-block tone variation over the existing grain finish. Horizontal faces retain grain without wall courses. Derivative-based joint fading limits distant pattern shimmer; shader coordinates account for instance transforms.
- No new textures, geometry or material submissions. Reviewed civic daytime capture: the lobby surround and foundation read as assembled stone rather than uniform slabs. Civic day/night/phone/walking browser checks pass with clean monitored shaders/runtime.
- Full 140-test suite (including batching/geometry checks), lint and production webpack build including TypeScript pass. This is a material refinement, not completion of the much larger realistic-city/organic-composition/gameplay/world-budget/production goals. No deployment.

## Keep courtyard entrances clear of planting

- Found that the previous 68%-width island overlaps the sidewalk entry strip in narrow directory courts. Planting now reserves at least 1.3 units on either side (before the 0.035-unit curb half-width), leaving the existing 1.15-unit entry route clear. Narrow islands use one centered tree; wider islands retain two with trunks placed inside the bed.
- Islands have clipped corners with continuous perimeter curb segments, all in existing surface/box material buckets. Source plots, streets and permanent addresses are unchanged.
- Added narrow/wide court clearance and tree-placement coverage. Full 141-test suite, lint and production webpack build including TypeScript pass. Source-inventory browser review resolves 72 source buildings with 186 survey plots and exits cleanly; reviewed overview capture.
- The overview still exposes highly regular macroblocks, repetitive unresolved source massing and broad empty streets. This courtyard correction does not satisfy the organic, realistic city-composition target. That remains a major next priority alongside gameplay, whole-world resource bounds and durable production state. No deployment.

## Semantic grouping of unresolved source surveys

- Unresolved survey plots now group into contiguous row envelopes beyond 100 units and restore individual plots within 75. Resolved/absent slots break groups; grouping never joins distinct street rows. Fixed survey height remains neutral and does not infer source complexity or commit history.
- Reuses existing instance buffers/materials with an updated active count and click map. Nearby individual matrices restore exactly; a far group identifies its directory block through a valid member slot. This reduces rendered survey instances, not allocated buffer capacity or whole-world memory.
- Added resolved-gap/row-boundary/click/hysteresis/exact-restoration coverage. Full 142-test suite, lint and production webpack build including TypeScript pass. Inventory overview resolution and automatic street-level resolution browser reviews both exit successfully; reviewed overview capture.
- Grouped envelopes are a semantic presentation step, not realistic finished architecture. The macroblock composition remains overly regular, and broader art/gameplay/world-budget/production requirements remain unfinished. No deployment.

## Remove large-network streetlight selection regression

- Current phone profiling exposed substantial comparator/coordinate-key work in the recently introduced stable light pool. Replaced full sorting and repeated scoring with bounded top-four insertion, calculating each unique fixture's key and distance once. Retained-fixture preference, tie ordering, duplicate filtering and fade behavior are preserved.
- Added comparison against exhaustive ranking across 5,000 fixtures, duplicates and 20 changing camera positions. Full 143-test suite, lint and final production webpack build including TypeScript pass.
- Local 20,000-fixture/30-query benchmark measured 1,412.5ms before and 139.4ms after. Successive full live phone traces both completed six workers/eight owner rebuilds: max frame interval 292.1ms before and 226.8ms after, p95 15.1/15.2ms. Latest owner commit 47.4ms; sampled select self time 18.1ms. These are desktop Chrome development observations, not controlled physical-phone results; 227ms remains a visible pause.
- Full realistic-city composition/art/gameplay/world bounds/production goals remain incomplete. No deployment.

## Visit recognition immediately after verification

- Acceptance refresh now matches the returned PR number and signed-in login against freshly fetched server resident attribution. Successful verification offers “Visit your contribution” for the matching file, or “Visit this city” when no current-file attribution is available. Navigation uses the existing in-app route/camera flow and closes the dialog.
- The action is available from account/city-hall verification and notebook-prefilled verification. New submissions and URL edits clear stale visit actions; failed refreshes retain the recorded-result explanation. No extra credits or attribution are inferred on the client.
- Extended recognition browser fixture clicks the new action, verifies the attributed file route and contributor plaque, then completes the existing unsampled archive check. Acceptance/duplicate handling, unchanged camera/construction during verification, and phone layout checks pass. Reviewed phone verification capture.
- TypeScript, lint and production webpack build pass. UI-flow change; unchanged 143 unit tests were not repeated. Real-account GitHub merge verification, full gameplay/art/organic-city/world-budget/production requirements remain incomplete. No deployment.

## Restrained instanced clothing variation

- Added six muted clothing finishes chosen deterministically from each existing visitor seed. A per-instance color attribute recolors the authored blue garment vertices while retaining skin, hair and trousers; the shader composes with camera-clearance fading.
- Uses the existing two citizen models and draw batches, with no extra model downloads, skeleton work or draw submissions. Small color buffers are owned by the existing model geometries and use their disposal path.
- Model/morph/camera/shader and civic day/night/phone/walking browser checks pass; reviewed phone street capture. Lint and production webpack build including TypeScript pass. Art-only change; unchanged 143 unit tests were not repeated.
- Clothing shape and character silhouette variety remain limited. Full realistic city composition/art, richer gameplay, world resource bounds and durable production requirements remain incomplete. No deployment.

## Denser distant canopy textures

- Distant tree cards now use shared canopy variants with broader overlapping leaves; close-up botanical textures remain unchanged. The existing alpha-coverage mipmap generation also applies to the new variants. Geometry and draw submissions are unchanged.
- Base alpha-test coverage rises from 27.8% to 36.3% for broadleaf and 27.7% to 34.0% for conifer. The two extra RGBA mip chains total 699,048 bytes. Increased covered pixels are a fill-rate tradeoff, not a free performance gain.
- Reviewed source-inventory overview: crowns are fuller and less fragmentary. Inventory rendering and civic day/night/phone/walking browser checks pass. Full 143-test suite, lint and production webpack build including TypeScript pass.
- Forest species/silhouette variety and terrain composition remain limited. Full realistic-city/organic-layout/gameplay/world-budget/durable-production goals remain unfinished. No deployment.

## Remove mandatory empty directory ring roads

- Directory reservations previously forced their entire perimeter to become roads despite source buildings facing the interior access streets. Perimeter edges now remain connection candidates; only actual legacy/civic frontage and directory access streets are mandatory. Existing source entrances, plots and permanent coordinates are unchanged.
- Extended the network regression to compare the old ring-road requirement: the fixture uses over 15% less road length while retaining connected access streets and road clearance from every source lot. All 143 tests, lint and production webpack build pass.
- Inventory browser review and owner preview-LOD/adjacent-neighborhood walking/phone browser checks pass. Reviewed inventory overview: empty perimeter rings are removed, but parallel access streets, terminal streets and elongated survey masses still give an industrial composition. This does not establish realistic city quality or physical-phone performance.
- Full organic urban layout, cohesive art, deeper gameplay, bounded world resources and durable production requirements remain unfinished. No deployment.

## Keep unknown source surveys out of the skyline

- Unanalyzed directory plots previously rendered at a fixed 1.8-unit height with dark roofs; far grouping made them resemble enormous finished warehouses. Replaced them with 0.08-unit survey pads, centered at 0.15, without cast shadows or the roof shader. Only analyzed source structures now contribute building silhouettes.
- Reserved footprints, near/far grouping, directory hit metadata and exact restoration remain intact. Extended survey regression checks the pad height and absence of fabricated building shadows. All 143 tests, lint and production webpack build pass.
- Inventory overview browser review passes (72 structures); automatic street-level resolution passes (128 structures), verifying that pads still resolve into source buildings. Reviewed overview: unknown warehouses are gone, but empty reserved roads and monotonous layout remain conspicuous. This exposes the need for stronger initial analyzed coverage and urban composition; it does not establish the desired realistic-city experience.
- Full art/layout/gameplay/world-budget/durable-production requirements remain unfinished. Changes remain local.

## Guidance for neighborhood and traveler-destination walks

- Added destination, remaining street-route distance, estimated travel time and a stop action to guided neighborhood walks and following a street actor's destination. Shares the existing travel panel placement and phone presentation; manual movement still cancels the route. Empty paths clear guidance, and the existing highway guidance remains available.
- Street distance uses the remaining polyline in horizontal coordinates and the active world scale. Added distance/scale/empty-route tests. All 144 tests, lint and production webpack build pass.
- Extended the owner browser review with route-label/distance assertions, 390px phone bounds, stop/hide/restart checks and continuous cross-neighborhood arrival (largest sampled step 0.655). Reviewed /private/tmp/gitcity-walking-guidance-phone.png. Existing owner street/hall identity and phone shared-link checks pass without monitored rendering errors.
- This improves navigation feedback, not the full game loop or city visual target. Full art/layout/gameplay/world-budget/durable-production requirements remain unfinished. No deployment.

## Distance-based walking sound and camera response

- Footstep cadence now accumulates accepted horizontal movement for manual and guided walking. Blocked/zero movement does not advance it; running produces faster steps, world scale is respected, and large discontinuities do not produce a burst. Replaced the former key-held timer, which sounded even against obstacles and omitted guided routes.
- Footstep audio layers a short filtered-noise envelope and softened low impact, alternating subtle left/right pitch and filter variation. One 0.16-second noise buffer is reused; transient noise nodes disconnect when finished. Sound still requires the existing user-enabled audio context. No subjective listening-quality claim is established by the automated checks.
- Guided movement carries the view target with camera translation and uses exponential time-based steering instead of a fixed per-frame interpolation. Added frame-rate equivalence and cadence/speed/scale/idle/discontinuity tests. All 146 tests, lint and production webpack build pass.
- Owner browser review instruments actual short audio-buffer starts: guided walking produces steps, stopping produces none for the observed idle interval, and restart/cross-neighborhood travel succeeds (largest sampled step 0.570). Phone guidance and owner street/hall continuity checks pass without monitored rendering errors.
- Full realistic city art/layout, deeper gameplay, world resource limits and durable production requirements remain unfinished. No deployment.

## Connect the existing photographed ground material

- Found that terrain/apron ground materials did not register with the shared Surfaces loader, leaving the already-downloaded grass-color texture unused. Meadow ground now registers as grass and samples that existing Aerial Grass Rock asset in continuous world coordinates.
- The shader uses restrained luminance/color variation, derivative-based distance filtering and small luminance-derived normal relief. This is a presentation bump approximation, not measured terrain displacement or a supplied normal map. The existing procedural surface remains the texture-loading fallback; formal lawn materials retain their prior treatment.
- No new asset payload, geometry or draw submissions. The shared 1024-square texture now consumes GPU sampling/storage (approximately 5.33 MiB for RGBA with mipmaps); this is not a free rendering improvement. Source/license provenance remains in public/materials/manifest.json and README.md.
- Lint and production webpack build pass. Civic day/night/phone/walking browser review and guided cross-neighborhood/phone review pass without monitored shader/runtime errors; reviewed walking-height capture with visible ground texture along the pavement. Unchanged 146 unit tests were not repeated for this material-only change.
- Ground silhouette, vegetation variety, organic layout and overall art quality still need substantial improvement, alongside gameplay/world-budget/durable-production work. No deployment.

## Connect scanned brick finishes to the actual buildings

- Brick source buildings and civic masonry now register with Surfaces and use the existing Brick Wall 001 color, OpenGL normal and roughness maps. Previously these downloaded assets had no registered brick consumers. Shared repeat 0.65 preserves approximately 0.03-unit courses against the existing physical UV scale.
- The seeded wall palette remains the base; scan variation is normalized and blended at 45%, with normal strength 0.25. Reviewed the first overly noisy capture and reduced both contrast and relief. The running-bond procedural finish remains the fallback before color maps arrive; scanned normals replace procedural mortar relief when available.
- No additional geometry/draw submissions or asset-download payload. Three shared 1K RGBA mip chains can add approximately 16 MiB of GPU texture storage plus sampling cost. This has not been validated on physical phones.
- All 146 tests and lint pass; final production webpack build passes after visual tuning. Civic day/night/phone/file-access/walking browser checks pass with clean monitored shaders/runtime; reviewed the final daylight hall capture. Source dimensions, frontage openings and semantic data are unchanged.
- Whole-city realism, organic composition, gameplay depth, world resource bounds and durable production remain unfinished. No deployment.

## Bounded street-level shadows on compact views

- Previously the renderer disabled directional shadows entirely at phone startup. Compact/coarse-pointer views now use a 512-square directional shadow map while walking and outside adaptive economy mode; overview and sustained-low-performance modes disable casting. Desktop retains 1024-square shadows. The existing nearby shadow extent and once-per-second refresh remain.
- Resizing releases the previous shadow render target before changing resolution. Added an explicit shadow-budget policy test for street/overview/economy/desktop behavior. All 147 tests, lint and production webpack build pass.
- Civic browser review verifies the 512 map/active street shadow state and disabled overview state, alongside day/night/phone/file-access/walking checks. Reviewed /private/tmp/gitcity-phone-day-shadows.png: facade contact shading is visible, but this is limited visual evidence.
- Live large-repository shared-link/overview/street-return review passes with five workers, seven rebuilds and zero pending previews. Its 305 measured navigation frames had p95 15ms and maximum 15.4ms; these sampled desktop Chrome development intervals exclude other expensive work (the log also contains a 238.1ms street build). They do not prove physical-phone performance or whole-arrival smoothness.
- Full realism, organic layout, gameplay depth, world memory bounds and durable production scope remain unfinished. No deployment.

## Remember the notebook's acceptance checkpoint

- Field notes now explain their next stage: investigation saved, PR linked awaiting verification, or acceptance verified on this device with date. Successful server acceptance followed by city refresh records the checkpoint only when returned repository/PR number exactly matches the currently tracked link.
- Linking a different PR clears the prior checkpoint; the reader also rejects mismatched acceptance/link records. Local checkpoints are never read by the currency/residency ledger. Browser storage failure keeps the server result and explains the missing local checkpoint.
- Added exact-PR/mismatched-repo/changed-link/old-record tests. All 148 tests, lint and production webpack build pass.
- Extended recognition browser review verifies the checkpoint after accepted/duplicate handling and after visiting the contribution, reloading, and reopening city hall. Existing unchanged-camera/construction, single plaque, phone verification bounds and unsampled attributed-file checks pass. This uses fixture acceptance, not a real-account GitHub merge.
- Full city realism/layout, deeper recurring gameplay, bounded world resources and durable production requirements remain unfinished. No deployment.

## Publish shared surface maps without unrelated invalidation

- The shared loader previously marked every tracked material for update on each image completion, even when its maps did not change. Map application now compares actual bindings; registering a fallback-only material and unrelated image arrivals do not increment its material version.
- Brick color/normal/roughness maps publish together after that finish's requests settle. Grass, concrete and environment loading remain independent; procedural fallbacks remain visible while the brick finish is pending. Failed map requests retain available fallbacks. Disposal clears owned texture/environment references and ignores later tracking; late settled textures are disposed.
- Added controlled delayed-loader coverage: partial brick arrival does not change bindings, the complete set causes one material version increment, grass stays at one increment through brick arrival, and owned/late textures are disposed. All 149 tests, lint and production webpack build pass.
- Civic day/night/phone/file-access/walking browser checks pass with clean monitored shaders/runtime. No controlled frame-rate improvement is established by these material-version tests. Pending requests still use the existing loader lifecycle, and whole-world resource bounds remain unfinished.
- Full realism/layout/gameplay/world-budget/durable-production requirements remain unfinished. No deployment.

## Explain interrupted neighborhood walking

- Added navigation notices when neighborhood/traveler route searches return no connected path, when issue-route searches fail, and when accepted guided movement encounters an obstacle. Messages distinguish missing connections from physical obstruction and explain how to continue exploring manually. Wired the callback into the existing dismissible status notification.
- Lint and production webpack build pass. Owner walking-guidance/stop/restart/continuous-neighbor-arrival/phone browser regression passes. Those browser checks cover normal routing; they do not directly force each new failure branch. Unchanged 149 unit tests were not repeated for this notification wiring.
- Full graphics/layout/gameplay/world-budget/production requirements remain incomplete. No deployment.

## Release partially arrived texture finishes on disposal

- Grouped finish loading now tracks arrived-but-unpublished textures explicitly. Disposing Surfaces releases those immediately, without waiting for remaining maps; subsequent arrivals dispose themselves before configuration/publication. Settled batches do not dispose an already-released texture twice.
- Added delayed-request regression proving the first map is released while other requests remain pending, each later map is released exactly once, and repeated disposal is harmless. All 150 tests, lint and production webpack build pass. This is a resource lifecycle correction; browser appearance checks were not repeated.
- Texture requests themselves are not aborted and promise-held JavaScript objects can remain until settlement. This does not establish whole-world memory bounds. Full graphics/layout/gameplay/world-budget/production goals remain incomplete. No deployment.

## Preserve canopy-volume normals across leaf-card sides

- The tree kit supplies radial canopy normals, but the double-sided material reversed them for back-facing cards, producing abrupt dark patches among overlapping sprays. The foliage shader now cancels that reversal for its canopy normals (including the unperturbed normal) while retaining existing wind, transmission and cutout shadow passes.
- Reduced leaf albedo with a muted tint after the corrected first render appeared too bright. Geometry, textures and instance/draw counts are unchanged. Reviewed the final civic daylight capture: the severe dark card patches are removed, though angular silhouettes and limited tree variety remain.
- Initial browser validation caught an incorrect Three.js shader variable name; corrected it to nonPerturbedNormal and reran successfully. All 150 tests, lint and final production webpack build pass. Civic day/night/phone/file-access/walking and compact shadow activation/deactivation browser checks pass with clean monitored shaders/runtime.
- Full realistic art/organic composition/gameplay/world-budget/durable-production goals remain unfinished. No deployment.

## Keep per-tree finishes stable through vegetation zoom

- Added restrained path-independent, position/seed-derived leaf and bark color variation through existing instance colors. No new tree geometry, materials or draw batches. Instance color buffers and cached transfer colors add small per-tree storage; this does not expand the botanical species/silhouette kit.
- Streaming groves now transfer each tree's color alongside its matrix when compacting near/far batches. Extended the hysteresis test to assert exact color identity through every transition and distinguish individual trees.
- All 150 tests, lint and production webpack build pass. Civic day/night/phone/file-access/walking browser checks pass with clean monitored shaders/runtime; reviewed daylight capture. Variation is subtle and does not satisfy the larger realistic-city target.
- Full art/organic layout/gameplay/world-budget/durable-production goals remain incomplete. No deployment.

## Stop walking-route searches at their destination

- Walking graph routing previously scanned the open set for its minimum repeatedly and exhausted the entire graph. It now uses the existing stable MinQueue, ignores obsolete queue entries, and stops after settling both destination street endpoints. Same-edge routes bypass graph search entirely. Projection and search share one node lookup instead of constructing three.
- Added a 1,600-intersection shortest-distance/determinism/world-origin/height/same-edge regression. All 151 tests, lint and production webpack build pass. Owner walking guidance, stop/restart, adjacent-repository continuity and phone browser checks pass.
- Local before/after fixture: ten nearby routes in a 14,400-intersection grid took 223.4ms before and 66.8ms after. This is a synthetic desktop observation, not controlled whole-arrival or physical-phone evidence. Graph projection and adjacency construction still inspect the full network; whole-world budgets remain incomplete.
- Full art/organic-city/gameplay/world-resource/durable-production goals remain unfinished. No deployment.

## Introduce a second source-neighborhood street orientation

- Deep directory reservations (at least 41.5 units) can now deterministically use north/south access streets, selected by owner/block seed. Other blocks retain east/west streets. The 64 full-size plots rotate within their existing reservation; their entrances move accordingly. Permanent city coordinates, reservation polygons, source slot assignment and data-derived dimensions are unchanged.
- Rotated access streets connect to the reservation's actual north/south boundary. Grouped survey pads now use row-vector length, both center coordinates and plot rotation; they no longer assume an east/west row. Rotated short-axis row margins cannot fit the current minimum end-court kit, so that kit is omitted there.
- Generalized plot corner/road-clearance and network checks across three owner seeds, covering both orientations, deterministic regeneration, non-overlap and connected access. Added exact near/far rotated survey alignment/restoration coverage. All 152 tests, lint and production webpack build pass.
- Inventory overview (72 detailed structures), automatic street resolution (128) and owner guidance/stop/restart/shared-street/continuous-neighbor/phone browser reviews pass. Reviewed overview with visibly mixed axes; it remains regular and sparse rather than a finished organic city. The overview also exposes excessive repetition in the recently connected ground texture, which needs further distance treatment.
- Full cohesive city art/organic composition/gameplay/world-budget/durable-production requirements remain incomplete. No deployment.

## Fade repeated ground detail out of the city overview

- Added a smooth 20–80 world-unit view-distance fade to the photographed ground's color/relief, alongside its existing pixel-footprint filtering. Nearby pavement-edge detail remains; distant terrain returns to broad procedural variation instead of exposing the scan's repeating pattern.
- Reviewed inventory overview and phone walking captures. Inventory resolution and owner guidance/stop/restart/continuous-neighborhood/phone browser checks pass with clean monitored shaders/runtime. Lint and production webpack build pass. Unchanged 152 unit tests were not repeated for this material-only distance adjustment.
- This fixes a visible material repetition problem; distant terrain remains too plain and city composition still needs deeper work. Full art/layout/gameplay/world-budget/durable-production goals remain unfinished. No deployment.

## Resume saved investigations from the street panel

- The street panel now offers the latest saved investigation whose issue remains in the current open sample. Selecting it opens the investigation and requests a walk to its marker. Work-site buttons identify saved plans or linked PRs on this device; confirmed-closed issues are excluded.
- Extracted a shared notebook subscription used by city hall and the street panel. Snapshots are repository-scoped so an owner/repository transition cannot briefly expose the previous city's notes; storage and local notebook events refresh both views.
- Lint and final production webpack build pass. Street-life browser flow now resumes directly after reload and verifies the action disappears after confirmed GitHub closure, retaining proximity notes and phone removal checks. Recognition/duplicate/checkpoint/reload/attributed-building browser flow also passes. Unchanged 152 unit tests were not repeated for this UI/state-subscription change.
- This improves returning-player continuity, not the full recurring game loop. Full graphics/layout/gameplay/world-budget/durable-production goals remain unfinished. No deployment.

## Plant public side margins in north/south neighborhoods

- Added deterministic small groves in the broad side margins of rotated source blocks, which cannot use the existing narrow end-court kit. At most eight trees per eligible reservation feed the existing streamed vegetation batches.
- Placement includes the conservative crown radius and sidewalk clearance against access streets and every reservation edge; all 64 reserved source plots participate regardless of current detail or occupancy. New source resolution therefore does not displace planting or grow buildings through it.
- Added multi-owner crown/polygon/street/source-plot clearance, deterministic detail-independence and per-block count coverage. All 153 tests, lint and production webpack build pass. Inventory browser review resolves 72 source structures with 186 survey pads and exits cleanly; reviewed overview with planting beside the rotated rows.
- Adds instance/triangle work proportional to eligible regions; it is not a whole-world budget solution. These groves do not yet provide an interactive park or pedestrian path network. Full art/organic-layout/gameplay/world-resource/durable-production goals remain incomplete. No deployment.

## Keep shared scanned finishes compressed on the GPU

- Generated pinned, reproducible 1K KTX2 variants: ETC1S color/roughness, UASTC normal with renormalized mipmaps and source-row flip matching JPEG orientation. Included source hashes, encoder revision and bundled transcoder license/provenance.
- Surfaces now detects GPU compression support, uses one transcode worker, falls back to JPEG per failed map, and preserves grouped finish publication. The worker is disposed after all loading settles so delayed initialization cannot start a worker after premature loader disposal. Existing late texture disposal remains in place.
- Added compressed-path/fallback/worker-release coverage; all 154 tests, lint and production webpack build pass. Initial browser instrumentation watched the wrong GL upload call; corrected it to cover WebGL2 sub-image uploads. Civic day/night/phone/file-access/walking/compact-shadow browser checks then pass with clean monitored shaders/runtime.
- Chrome/Metal observed four 1K rendered map mip chains totaling about 5.33 MiB compressed versus 21.33 MiB RGBA8 equivalents. This measures upload payload, not total driver allocation, physical-phone performance or frame-rate gains. Five map files total 2,112,312 bytes plus the shared transcoder; HDR remains unchanged and JPEGs remain fallback. Concrete did not render in this fixture.
- Reviewed daylight and phone street captures: masonry detail retained, but paving is flat, tree silhouettes angular and pedestrians awkward. This is resource preparation for richer art, not the requested major visible realism leap. Full urban composition/art/gameplay/world budgets/durable production remain incomplete. No deployment.

## Replace flat public paving with a scanned slab finish

- Replaced the unused concrete-wall scan with Poly Haven's CC0 Concrete Pavement 02 color/normal/roughness set, using upstream MD5 verification and recorded asset URLs. Regenerated compressed variants with source hashes. Pavement and civic forecourt materials now register this grouped finish with Surfaces.
- Shared world-coordinate UVs keep adjoining surfaces aligned, with six scanned slabs per 2.4 world units. Matched normal/roughness maps give joints and aggregate lighting response; procedural paving remains while downloads settle or fail. Distance fading and muted color reduce repetition. No additional draw batches or collision geometry.
- All 154 tests, lint and production webpack build pass. Civic day/night/phone/file-access/walking/compact-shadow browser review passes with clean monitored shaders/runtime. Reviewed both daylight civic and phone street captures: slab texture and joints now visibly replace the flat sidewalk/forecourt surfaces. Street asphalt and the broad civic approach still remain too plain; pedestrians and trees are still major art limitations.
- Browser upload evidence now includes seven 1K map mip chains totaling 9,786,896 bytes (~9.33 MiB) compressed versus ~37.33 MiB RGBA8 equivalents. The new normal/roughness maps increase both transfer and memory; total KTX2 payload is 3,629,615 bytes plus transcoder/HDR. This is not a physical-phone performance result. Full art/organic layout/gameplay/world budgets/durable production remain unfinished. No deployment.

## Correct bare-looking pedestrian feet and leg finishes

- The character baker recolored the whole Skin source mesh uniformly, including feet. Added bind-pose leg classification from source skin weights and vertex height: lower legs take the source trouser color, feet dark footwear and bottom vertices a muted sole. Classification is independent of animated pose so boundaries do not slide through the walk cycle.
- Rebaked both existing characters. Geometry, eight walking morphs, idle base, material count and runtime draw batches remain unchanged; GLB sizes are 2,052,580 and 2,088,484 bytes. Updated model provenance. No new asset downloads.
- All 154 tests pass. Civic day/night/phone/file-access/walking/compact-shadow browser checks pass with clean monitored shaders/runtime. Reviewed phone street capture: skin-colored feet are gone; the new finish is visible. No application-source changes, so lint/build were not repeated for this offline asset change.
- The same narrow-leg silhouettes and stiff idle pose remain; recoloring does not create tailored trouser geometry or a new animation kit. Full realistic art/organic urban composition/gameplay/world budgets/durable production remain unfinished. No deployment.

## Blend standing pedestrians through staggered idle poses

- Baked two additional samples from each source Idle clip, retaining the resting base and eight existing walking poses. Stationary actors cycle between the three idle samples over the source 25/6-second duration, with phases seeded from actor offsets. Existing distance-based walking weights crossfade into the idle blend.
- Pausing retains the current pose; reduced motion selects the resting base immediately while preserving idle phase for a staggered resumption. Runtime guards retain compatibility with older eight-target model responses. Updated model provenance.
- Added frame-rate independence, stagger, pause, reduced-motion and full-walk idle suppression coverage. All 155 tests, lint and final production webpack build pass. Final civic day/night/phone/file-access/walking/compact-shadow browser regression passes with clean monitored shaders/runtime; reviewed daylight capture. Offline loaded assets have ten finite position targets with idle component displacement below 0.020 world units. No subjective video review or physical-phone performance claim.
- Same two crowd draw batches and no runtime skeletons, but two extra morph targets increase model transfer, GPU storage and vertex work. Files are now 2,476,412 and 2,519,704 bytes (423,832 and 431,220 additional bytes). This is modest movement variation, not the full required character-art/animation redesign. Full art/organic layout/gameplay/world budgets/durable production remain unfinished. No deployment.

## Join the civic approach to the paved public realm

- Civic loop paths and the broad front approach previously shared a plain material bucket with wooden benches. Moved their existing geometry into the shared scanned sidewalk finish, preserving heights, slopes and connections to the four boundary sidewalks. Shared world mapping keeps the paving pattern continuous with the hall forecourt.
- Replaced four oversized solid bench seats with lower slatted seats, backs, supports and armrests scaled against the 0.55-unit citizens. Added short paved seating pockets joining the loop. These remain presentation geometry; no sitting interaction or new pathfinding behavior is claimed.
- Reuses existing material/geometry batches and map assets; additional bench pieces and pocket surfaces add geometry. All 155 tests, lint and production webpack build pass. Civic day/night/phone/file-access/walking/compact-shadow browser checks pass with clean monitored shaders/runtime; reviewed daylight capture showing the continuous forecourt and new seating.
- Civic architecture, planting richness and activities remain limited. This does not resolve broader city composition, character art, recurring gameplay, world resource limits or durable production. Full goal remains incomplete. No deployment.

## Light the civic garden loop through the existing bounded pool

- Added four shielded lamp fixtures along the inner edge of the civic loop when the plan actually contains the civic reservation. A shared planFixtures helper feeds both visible pole/pool geometry and engine light candidates in repository and owner views, preserving coordinate translation without mutating stored street-lamp data.
- Reuses existing fixture geometry/material batches and the four active PointLight slots. Adds four visible lamps/pool instances per civic reservation and candidate-selection work, not additional active lights. Existing fade/selection behavior remains.
- Added non-mutation, civic-presence, translation and footprint/building-clearance coverage. Updated the existing street-surface fixture-count assertion to include the four civic lamps. Initial production typecheck caught missing helper typing; added the explicit parameter shape. All 156 tests, final lint and production webpack build pass.
- Civic day/night/phone/file-access/walking/compact-shadow browser review passes with clean monitored shaders/runtime; reviewed night capture with warm illumination reaching paving and nearby foliage. Owner/district/shared-street/continuous-neighborhood/phone browser review also passes. Whole-world allocation/physical-phone budgets and major art/gameplay/production requirements remain incomplete. No deployment.

## Discover contribution sites by maintainer invitation and personal progress

- Added work-site filters for explicit good-first-issue/help-wanted invitations, bug/documentation/feature categories, unsurveyed sites and saved plans. Matching counts and empty states refer to the current cached issue sample; no extra GitHub request or inferred bounty/difficulty claim.
- Unsurveyed sites with explicit maintainer invitations rank first, then other unsurveyed sites, then saved plans, with deterministic issue-number ties. Labels are normalized for case/separators; generic easy/beginner labels do not become maintainer invitations. Source arrays and stored notes are not changed by discovery.
- Added Explore next work site, which selects and walks to the first unsurveyed result in the active filter. Saving field notes removes that issue from new-site discovery; the existing resume action remains. Confirmed-closed issues are excluded before filtering.
- Added ranking/filter/non-mutation coverage. All 157 tests, lint and production webpack build pass. Extended street-life browser review to test empty newcomer results, bug filtering, guided discovery, and removal of a saved site from discovery. Full proximity-save/reload-resume/notebook/confirmed-closure/mobile-removal regression passes with clean monitored shaders/runtime.
- This supplies more deliberate exploration choices, not the full recurring contribution game or real-account acceptance proof. Graphics, organic urban composition, richer city activities, world budgets and durable production remain unfinished. No deployment.

## Complete saved-PR verification from the street notebook

- Revalidated issue discovery against authoritative fetching/rendering: normal GitHub snapshots and physical work orders both cap their issue samples at twelve. No normal-snapshot marker-count mismatch was established.
- Found and fixed a contribution-flow gap: the street notebook supported saving PR links but lacked the verification callback available in city hall. WorldApp now supplies its existing authenticated acceptance refresh and attributed-building navigation callbacks through CityChallenges to FieldNotebook. Anonymous users retain local planning without verification controls.
- Reuses the existing server verification, immutable local acceptance checkpoint and visit flow; no new credit or residency rules. Lint and production webpack build pass. Unchanged 157 unit tests were not repeated for callback wiring.
- Extended the recognition browser fixture to exercise the street notebook directly, including saving a PR, verification, visible building attribution, no camera change/construction replay, duplicate protection, visit to the attributed file, reload, retained checkpoint and city-hall recognition. It passes with clean monitored runtime. Anonymous discovery/proximity-notes/reload-resume/notebook/closure/mobile-removal browser regression also passes.
- Fixture acceptance is not proof of real GitHub OAuth/merge acceptance. Full art/organic composition/recurring gameplay/world budgets/durable production remain unfinished. No deployment.

## Give anonymous contributors a clear notebook sign-in handoff

- Anonymous saved-PR entries previously instructed users to verify in place despite lacking verification controls. Their stage text now explains that sign-in is needed after merge; a contextual Sign in to verify your contribution action opens the existing passport/auth panel from either street or city-hall notebooks. Signed-in entries retain verification controls and wording.
- Reuses the existing auth panel, including its current-path return URL and configured/unconfigured behavior. Opening it does not alter or clear local contribution plans or saved PRs.
- Lint and production webpack build pass. Added browser coverage that saves a PR anonymously, verifies the next-step text and absence of verification controls, opens/closes the account panel, and checks the retained PR and plan. Full discovery/proximity-save/reload-resume/closure/mobile-removal browser regression passes with clean monitored runtime. Unchanged 157 unit tests were not repeated for callback/copy changes.
- This verifies the in-app sign-in handoff, not a real GitHub OAuth round trip. Full graphics/organic city layout/recurring gameplay/world budgets/durable production requirements remain incomplete. No deployment.

## Add filtered surface relief to shared asphalt

- Replaced sinusoidal repeating road variation with smooth world-space noise at weathering, intermediate, aggregate and fine-grain scales. Added restrained roughness variation and derivative normal relief; pixel-footprint filters fade fine detail. No generated cracks/potholes or changes to GitHub-driven road repairs.
- Reuses the shared asphalt finish on planned streets, dependency highways and existing architecture fallback consumers. No new maps, geometry or draw batches; additional fragment-shader arithmetic is a cost and has not been profiled on a physical phone.
- Lint and production webpack build pass. Civic day/night/phone/file-access/walking/compact-shadow browser checks pass with clean monitored shaders/runtime. Highway refresh, road picking through orbit, phone selector, navigation, retained world meshes and traffic-continuity regression passes. Unchanged 157 unit tests were not repeated for this shader-only change.
- Reviewed phone street capture: the material change is subtle at that viewing distance; road composition remains too plain. No claim of a major visible realism leap or measured performance gain. Full art/organic composition/recurring gameplay/world budgets/durable production requirements remain unfinished. No deployment.

## Give joined kerbs a light-catching bevel

- Split the existing square kerb edge into a lower vertical face and a narrow sloped upper face. The bevel occupies the existing 0.075-unit kerb width and preserves road height 0.11, sidewalk height 0.145 and the road/sidewalk outer boundaries. Contours with unmatched point counts retain the original square treatment rather than joining unrelated vertices.
- Adds two triangles per beveled contour segment within the existing kerb material batch. No extra material, texture or walking collision geometry. Existing joined-road triangulation and total area checks still pass.
- Added finite-normal, height-range and upward-sloped-face coverage across three owner seeds with joined junctions. Updated the road-area test's stale exact shader-v2 lookup to accept the asphalt finish family, retaining its geometric assertions. All 158 tests, lint and production webpack build pass. Civic day/night/phone/file-access/walking/compact-shadow browser review passes with clean monitored shaders/runtime; reviewed phone street capture.
- Edge treatment is a small physical refinement, not the major street-layout/architecture/art improvement still required. Drainage, richer urban composition, recurring gameplay, world budgets and durable production remain unfinished. No deployment.

## Prototype curved directory streets within full-source reservations

- Began a substantive neighborhood-layout change after reviewing the rigid three-parallel-street directory kit. Added curvedDirectoryBlock as a separate, not-yet-integrated generator: three 12-segment access streets, 0.5-unit lateral bends, refitted row spacing/front setbacks, and exact intersections with the existing reservation boundary. Keeps all 64 full-size source plots and their slot identities, with relocated entrances inside the same permanent reservation.
- Added four-owner/three-location checks for deterministic non-mutating generation, full oriented plot containment, non-overlap, exact segment joins and conservative 1.725-unit pavement clearance from every reserved plot. All 159 tests and lint pass.
- Not wired into directoryBlock or the renderer yet. Courtyard entry placement, survey grouping, planting, shared road graph/routing and their old straight-lane assumptions still require integration and browser validation. No claim of a visible local improvement this turn; current running app retains the verified straight-street layout. Full objective remains active and incomplete. No deployment.

## Stopped at user request

- User requested stopping after roughly thirteen hours with insufficient visible improvement. Ended feature work and reverted only the interrupted curved-layout integration, retaining the disconnected prototype for reference.
- Final wrap-up: all 159 tests and production webpack build pass; localhost:3010 responds HTTP 200. Existing server remains running. No deployment or commit. Added docs/STOPPING-POINT.md with current state, limitations and restart details.
- The full objective was not achieved. Do not resume the broad improvement loop automatically; await an explicit new user task.
