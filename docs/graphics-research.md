# Graphics direction and references — September 2026

The primitive car bodies and capsule people were visible placeholders. Increasing their subdivisions cannot produce authored silhouettes, panel detail, clothing or convincing gait. The implementation now supports replacing that representation with authored models without changing GitHub-derived population or architecture.

## Sources inspected

- [Three.js car material demo](https://threejs.org/examples/webgl_materials_car.html): a useful high-quality vehicle reference. Its authored model and differentiated body/detail/glass materials are a better target than procedural boxes. Its Ferrari is a reference, not an asset included here.
- [Three.js glTF scene loading](https://threejs.org/manual/en/load-gltf.html): preserves authored scene hierarchy and meshes. Applied by introducing a glTF street-model loader.
- [Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html): supports per-instance morph weights. Applied by baking eight skeletal walk poses and interpolating them on the GPU, with two crowd mesh batches instead of a skeleton update per visitor.
- [Three.js skinning and morphing example](https://threejs.org/examples/webgl_animation_skinning_morph.html): demonstrates authored animation clips and morphing. The current crowd uses walk poses only, not a full character state machine.
- [San Verde](https://github.com/ryanfitzpatrickio/san_verde): an architectural reference for separating vehicle manifests, authored models, agent behavior and city stages. Its README documents a WebGPU-only browser requirement, so copying that renderer wholesale would compromise Gitcity's existing phone/browser path. No performance or visual equivalence was assumed from the README.
- [Kenney Car Kit](https://kenney.nl/assets/car-kit) and [Quaternius Ultimate Animated Character Pack](https://quaternius.com/packs/ultimatedanimatedcharacter.html): original CC0 sources for the models actually integrated. They are stylized authored assets, not photorealistic assets. Detailed provenance accompanies the models.
- [OrbitControls](https://threejs.org/docs/pages/OrbitControls.html): an orbiting camera controller, not a terrain collision controller. Walking now bypasses its position update; a separate ground-clearance constraint applies after camera navigation.

## Shipped implementation

Sedan/SUV models and two casual character variants load when the camera reaches neighborhood detail. Existing primitive representations provide immediate fallback; downloads do not rebuild buildings. Each car variant is merged into one instanced batch. Characters use baked positions and normals with interpolated walk poses and a shared vertex-color material per variant. Model download bytes are cached; per-city GPU meshes and materials are disposed. The new GLBs total approximately 4.5 MB before transport compression and are deferred until neighborhood detail. They remain a budget to reduce, not free detail.

Night now has stronger sky fill, reflected light and exposure, plus four bounded non-shadow-casting point lights assigned to nearby street fixtures. This lights actual surfaces, including car bodies, instead of relying solely on emissive windows and headlight pixels. The local-clock day/night cycle remains intact.

Walking mouse/touch dragging rotates the view about a stationary eye. Orbit panning stays parallel to the ground. A post-navigation constraint keeps the camera above sampled terrain, including when an orbit target moves below the ground. Pointer capture prevents stuck drags outside the canvas, and accumulated drag distance prevents a return-to-origin drag from accidentally opening a building.

## Next visual milestones

1. Replace uniform building frontages with an authored modular facade/roof kit, retaining source-derived dimensions. Evaluate one finished block in day and night before expanding the kit.
2. Separate vehicle paint, glass, rubber and trim in the asset preparation pipeline; add wheel animation and carefully bounded headlight illumination.
3. Add proper vegetation LOD assets and compositional variety. Ground vegetation density and curb placement matter more than extra noise textures.
4. Compress meshes/textures and test sustained performance on physical iOS/Android devices. Consider richer desktop lighting only after establishing that budget.

No percentage improvement claim is meaningful without a defined measure and user assessment. This changes the asset pipeline and fixes camera safety; it does not establish photorealism.

## Validation

27 unit tests and lint pass. Production compilation passes with `next build --webpack`. Chrome checks cover desktop/mobile navigation, source entry, a persistent canvas, loaded authored assets, GPU morph animation, steep walking drags, wheel zoom, orbital panning, issue surveying and the four-stop service route. Night screenshots were reviewed on a Mac GPU; this is not a physical-phone or thermal benchmark. Street entry now frames the boulevard from the sidewalk rather than looking directly at a wall or lamp.
