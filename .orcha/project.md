# gitcity v2 — Fork IsoCity, Replace Data Source

## Summary
Fork IsoCity's proven rendering engine. Gut the game simulation. Replace with GitHub API data source. Result: IsoCity-quality rendering powered by real codebase data.

## Source Material
- IsoCity repo cloned at: /tmp/isocity-ref/
- IsoCity is Next.js 16 + React 19 + TypeScript + Canvas
- MIT licensed
- Key directories: src/components/game/ (rendering), src/lib/ (config), public/assets/ (sprites)

## Strategy
NOT building a renderer from scratch. Forking IsoCity and adapting:
1. Copy IsoCity's entire codebase as starting point
2. Strip game mechanics (economy, zoning, user building, save/load, multiplayer)
3. Keep rendering (buildings, roads, vehicles, water, depth sorting, multi-canvas)
4. Add: GitHub API data source, landing page, hash routing, build animation
5. Map file types → building types, directories → city blocks

## Phases

### Phase 1: Copy IsoCity base
- Copy the full IsoCity codebase into gitcity-v2
- Install dependencies, verify it builds and runs
- Commit as "base: copy IsoCity rendering engine"

### Phase 2: Strip game mechanics
- Remove economy, zoning, resource management UI
- Remove user interaction (place/demolish buildings)
- Remove save/load, multiplayer (Supabase)
- Remove toolbar, build menus, zone controls
- Keep: rendering engine, road drawing, vehicle systems, sprite loading, depth sorting
- Result: a city that renders but has no user interaction

### Phase 3: Add GitHub data source
- Add src/lib/github-api.ts (from gitcity v1)
- Add city generation from GitHub file tree
- Map file types → building types
- Map directories → city blocks with roads between
- Auto-generate road network connecting blocks
- Buildings placed programmatically, not by user

### Phase 4: Landing page & routing
- Add landing page with repo input
- Hash routing (#/owner/repo)
- Example repo chips
- Loading/build animation
- Day/night toggle (simplify from IsoCity's full time system)

### Phase 5: Polish
- Build animation (buildings rise one by one)
- Hover tooltips on buildings (file info)
- Branding (gitcity.co)
- README

## Status
- [ ] Phase 1: Copy IsoCity
- [ ] Phase 2: Strip game mechanics
- [ ] Phase 3: GitHub data source
- [ ] Phase 4: Landing & routing
- [ ] Phase 5: Polish
