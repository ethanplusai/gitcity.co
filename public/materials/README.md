# Shared city surfaces

CC0 assets from Poly Haven, reduced to 1K. Exact upstream URLs, byte sizes and asset pages are recorded in manifest.json. Run `node scripts/fetch-materials.mjs` to reproduce the downloads with upstream MD5 verification.

- Kloppenheim 06 Pure Sky: environment lighting and glass reflections.
- Brick Wall 001: base color, OpenGL normals and roughness.
- Concrete Pavement 02: sidewalk/forecourt color, OpenGL normals and roughness.
- Aerial Grass Rock: shared ground cover base color.

License: https://polyhaven.com/license
JPEG/HDR fallback payload: 5,727,661 bytes. These files are shared by every city, loaded asynchronously, and owned by the renderer rather than individual buildings.

## GPU-compressed variants

Run `node scripts/compress-materials.mjs` to encode the seven JPEG sources with the pinned official Basis Universal WebAssembly encoder. Color and roughness use ETC1S; the normal map uses UASTC with renormalized mipmaps. The encoder flips source rows to match Three.js JPEG upload orientation. All maps retain 1024×1024 resolution and include mip chains. `compressed-manifest.json` records source hashes, encoder revision, format and output sizes.

The renderer detects compressed texture support and transcodes through one worker, then releases that worker after loading settles. Individual failed compressed requests fall back to JPEG. Procedural finishes remain visible during arrival. The compressed maps total 3,629,615 bytes; the shared transcoder adds its JS/WASM download, and the HDR is unchanged. This is primarily GPU memory optimization, not a claim of smaller first-visit transfer or faster frame rate.

Chrome/Metal review with scanned pavement observed seven rendered maps using 9.33 MiB of compressed mip payload, versus 37.33 MiB for their RGBA8 equivalents. Device format selection varies; actual driver allocation and physical-phone performance have not been measured.

The bundled Basis transcoder is copied from the installed Three.js distribution and is licensed under Apache 2.0; see `basis/LICENSE` and `basis/README.md`. Texture source assets remain CC0.

Paving uses shared world-coordinate mapping across sidewalks and civic forecourts. The scan contains six slabs across its width; a 2.4-world-unit repeat gives 0.4-unit slabs. Restrained color saturation and a distance fade control repetition. The procedural slab finish remains available during map loading or failure. Normal and roughness maps are shader relief only; walking geometry is unchanged.
