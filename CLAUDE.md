# gitcity v2

## Commands
- `npm run dev` — start dev server
- `npm run build` — production build
- `npm run preview` — preview production build

## Architecture
- Forked from IsoCity (amilich/isometric-city, MIT)
- Next.js + React + TypeScript + Canvas 2D
- IsoCity's rendering engine: multi-canvas layered rendering, sprite sheets, procedural roads, vehicle systems
- Data source: GitHub API (replaces IsoCity's user-placed buildings)

## What was kept from IsoCity
- All rendering code (CanvasIsometricGrid, building sprites, road drawing, traffic, depth sorting)
- Sprite sheet assets and loading system
- Multi-canvas architecture (ground, roads, vehicles, buildings layers)
- Water rendering, pedestrians, vehicles

## What was removed
- Economy/zoning/resource simulation
- User building placement UI
- Save/load, multiplayer (Supabase)
- Toolbar, build menus, zone controls

## What was added
- GitHub API integration (fetch repo file tree)
- Landing page with repo input
- Hash routing (#/owner/repo)
- Auto city generation from codebase structure
- Build animation (buildings rise)
- File type → building type mapping

## Context
- Domain: gitcity.co
- See .orcha/project.md for phase breakdown
- IsoCity reference at /tmp/isocity-ref/
