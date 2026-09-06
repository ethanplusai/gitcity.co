# Rendering budget and art direction

The city uses real source-derived geometry with path-seeded architectural finishes. This pass introduces masonry, concrete and curtain-wall families, shared 1K PBR surfaces, HDR environment reflections, façade bays on all four sides, entrance framing, roof louvers and pavement courses. The walking eye is 0.58 local units against a 0.78-unit storey, rather than 1.7 units above the street. Walking uses a separate polar-angle limit so looking above the horizon cannot make the orbit controller lift the player out of walking mode.

The additional download is 3.69 MB across all cities, not per repository. Geometry appears immediately with fallback materials; texture completion changes only materials. Textures and the PMREM reflection target belong to the renderer and are disposed when it unmounts. Individual building disposal cannot destroy another building's texture.

Desktop starts with bounded pixel density and direct rendering, then enables ambient occlusion only after two seconds of measured frame-time headroom. Coarse-pointer/small displays skip the desktop postprocessing stack. Sustained slow frames switch to native rendering at a maximum DPR of 1; geometry, addresses and construction history remain unchanged. The canvas exposes `data-quality`, `data-draw-calls`, and `data-triangles` for diagnostics. This is a conservative automatic downgrade, not a measured guarantee of any frame rate. Real iOS/Android GPU and thermal testing remains necessary.

Keep future realism work focused on street frontage, a larger authored modular kit, vegetation silhouettes, road wear and convincing interior depth. Increasing polygon counts everywhere or shipping unique 4K maps per building would defeat the phone-first world. Current buildings remain procedural approximations; this pass is not photorealism.

Asset provenance and reproducible downloads: `public/materials/manifest.json` and `scripts/fetch-materials.mjs`.

## Landscape and local-clock pass

The old forest at the original map origin is replaced by nine streamed 128-unit terrain patches around the explored area. Broadleaf and conifer kits use tapered trunks, branches and individually silhouetted foliage, instanced in four draws per grove. The same kits appear in avenues and canal edges. Patch identity includes the actual city coordinates and road corridors: resolving a provisional city position invalidates terrain even when the city count stays unchanged. Ground remains below buildings and dependency roads, with forest clearance along those corridors.

Roads now have procedural aggregate and patch variation, raised curbs, gutters and non-emissive lane markings. Slatted benches use the same human scale as the walking camera. Street lamps have warm emissive fixtures and inexpensive ground light pools instead of one shadow-casting light per lamp.

A single sky shader with a shared 16 KB noise texture supplies layered drifting clouds, twilight color, a sun disk, a moon and stars. Lighting follows browser-local civil time, including timezone and daylight-saving changes. It is an artistic clock cycle, not astronomical sunrise: no location permission or latitude is requested. CI can still darken weather. Sky, fog, sunlight, ambient light, reflections, windows and lamps update together. Reduced-motion mode freezes cloud motion. Clock changes do not regenerate source geometry or replay construction.

Validation includes local noon/night browser captures, construction-count stability, terrain coordinate invalidation, road clearance and deterministic instanced vegetation. Physical phones still need testing. The visual and interaction suites also support `GITCITY_GPU=metal` on macOS, which was used for the final Apple M4 Pro checks; software Chrome remains an optional fallback.

Distant forests do not cast dynamic shadows. Street trees retain shadows, using a bounded 1024-pixel sun map updated with lighting and construction rather than unconditionally every frame. Render counters include the full frame, including postprocessing when enabled.

Ground cover adds one shared 1K grass-and-stone texture (666,655 bytes). Terrain UVs use world coordinates so tile seams do not reset the material. Aggregate grain fades using screen-space derivatives to prevent distant road and sidewalk speckling.

## Street-life rendering

Window glazing now uses analytic interior intersections: the viewing direction reveals side walls, a shaded floor, furnishings and curtains behind existing window geometry. PBR reflections remain on the exterior. Window UVs are preserved and the shader survives overview material batching. There are no interior meshes or new texture downloads in this pass.

Pedestrians use four instanced part batches; vehicles use five, including separate glazing, tires and emissive head/tail lights. Two instanced contact-shadow batches ground both groups without additional shadow-casting lights. Counts are bounded independently of repository popularity. Roads use rounded corner paths; issue markers add asphalt edges, rubble, cones and signs. These improve readable street life but are still procedural approximations, not photorealistic character or vehicle assets.

A credible route toward photorealism needs an authored modular frontage/roof/street-prop kit, richer material variation, tested compressed texture and mesh delivery, and better spatial composition. Reserve the highest detail for the current block and measure it on physical phones. The present pass adds no bitmap assets; the existing shared material download budget is unchanged. Desktop cinematic quality and a dependable anonymous phone visit need different quality tiers.

Validation: 25 unit tests, lint, production compilation with `next build --webpack`, desktop/mobile navigation and persistent-canvas checks, and a browser walkthrough of the new issue loop. GitHub issue state in the interaction test is mocked; it does not create or close any real issue. The default Turbopack production build encountered an environment worker-port restriction; webpack completed. This is not a physical-phone or sustained thermal benchmark.

## Civic reference block and shared façade kit

The civic building now has two low wings around a recessed public lobby, inset front glazing, limestone jambs, a bronze canopy, a signed entrance, shallow steps, a side ramp, benches and low planted forecourt edges. Its paved base extends to the ground rather than floating above the terrain. The civic envelope blocks walking through its walls; the service depot remains outside the forecourt. The city-hall camera frames the street-facing entrance instead of its rear elevation.

Source buildings use a matching vocabulary: masonry piers and spandrels surrounding recessed glazing, ground-floor storefront bays, thin bronze canopies, a continuous cornice, parapet coping and screened roof equipment. File-derived width, depth and height remain the envelope; data and the file-path seed still select the material family and window lighting. The kit remains six material batches per detailed building and participates in the existing overview batching.

Brick UV density was increased to correct oversized masonry seen during street-height review. Limestone uses restrained, derivative-faded procedural grain rather than a stained concrete photograph. The current patch introduces no downloaded texture assets. The civic façade is six geometry/material batches plus an instanced planting batch and a small physical sign.

Validation: 29 unit tests, lint, production compilation via webpack, desktop/mobile navigation and source entry, day/night civic screenshots, and service-route checks. The source-envelope test checks finite geometry and bounded façade/roof additions. The visual reference is a grounded procedural municipal block, not a claim of photorealism or a physical-phone performance benchmark.
