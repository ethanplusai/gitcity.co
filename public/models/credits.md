# Street model provenance

- `sedan.glb`, `suv.glb`: Kenney Car Kit, CC0. https://kenney.nl/assets/car-kit
  Original archive: https://kenney.nl/media/pages/assets/car-kit/1a312ec241-1775131960/kenney_car-kit.zip
  Included original license: `Kenney-license.txt`.
- `citizen-male.glb`, `citizen-female.glb`: Quaternius Ultimate Animated Character Pack, CC0. https://quaternius.com/packs/ultimatedanimatedcharacter.html
  Original glTF folder: https://drive.google.com/drive/folders/1UNNT0MeVX0O04RGgu8aLkKe3fwB9_t-A
  Male original file: 1rrj82IYNaSWj5ySxR6fW9oojyHFiW7_r
  Female original file: 1E79ks2jbMt5iIrI8Ag9lRgA0VRnfU4pk
  Modified: eight baked walk poses plus two idle poses blended with the resting base, merged vertex-color materials, neutral face palette, reduced head proportions and elongated adult body proportions (2026-09-06 revision), city-scale normalization, bind-pose clothing/footwear vertex colors (full-length trouser coloring with dark shoes and soles). Rebuild with `scripts/bake-citizens.mjs` after placing the original `Casual_Male.gltf` and `Casual_Female.gltf` in `/private/tmp`.

CC0: https://creativecommons.org/publicdomain/zero/1.0/

- `city-car.glb`: derived from **Car Concept**, Eric Chadwick (2024), Darmstadt Graphics Group GmbH, **CC BY 4.0**. [Source and metadata](https://github.com/KhronosGroup/glTF-Sample-Assets/tree/main/Models/CarConcept), [license and changes](car-concept-license.txt), [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/). Modified: removed texture/logo artwork and interior/engine components, simplified and welded exterior geometry, baked neutral vertex colors, normalized scale/orientation, and merged to one material batch. Rebuild with `node scripts/bake-city-car.mjs` after downloading the source glTF and binary to the paths documented in that script.
