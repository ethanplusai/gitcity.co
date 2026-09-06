import * as T from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { readFile, writeFile } from 'node:fs/promises';
globalThis.ProgressEvent = class {};
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((result) => {
      this.result =
        'data:application/octet-stream;base64,' + Buffer.from(result).toString('base64');
      this.onloadend?.();
    });
  }
};
for (const kind of ['Male', 'Female']) {
  const gltf = await new GLTFLoader().parseAsync(
    await readFile(`/private/tmp/Casual_${kind}.gltf`, 'utf8'),
    '',
  );
  const meshes = [];
  gltf.scene.traverse((o) => {
    if (o.isSkinnedMesh) meshes.push(o);
  });
  const mixer = new T.AnimationMixer(gltf.scene),
    clip = gltf.animations.find((a) => a.name === 'Walk');
  mixer.clipAction(clip).play();
  mixer.setTime(0);
  gltf.scene.updateMatrixWorld(true);
  const frames = [];
  const idle = gltf.animations.find((a) => a.name === 'Idle');
  for (let frame = -1; frame < 10; frame++) {
    const idleFrame = frame < 0 || frame >= 8;
    if (frame <= 0 || frame === 8) {
      mixer.stopAllAction();
      mixer.clipAction(idleFrame ? idle : clip).play();
    }
    mixer.setTime(
      frame < 0 ? 0 : idleFrame ? ((frame - 7) / 3) * idle.duration : (frame / 8) * clip.duration,
    );
    gltf.scene.updateMatrixWorld(true);
    const parts = meshes.map((mesh) => {
      mesh.skeleton.update();
      const g = mesh.geometry.clone();
      g.deleteAttribute('skinIndex');
      g.deleteAttribute('skinWeight');
      const p = g.attributes.position,
        v = new T.Vector3();
      for (let i = 0; i < p.count; i++) {
        v.fromBufferAttribute(p, i);
        mesh.applyBoneTransform(i, v);
        v.applyMatrix4(mesh.matrixWorld);
        const skinIndices = mesh.geometry.attributes.skinIndex;
        const skinWeights = mesh.geometry.attributes.skinWeight;
        let headWeight = 0,
          legWeight = 0;
        for (let component = 0; component < 4; component++) {
          const bone = mesh.skeleton.bones[skinIndices.getComponent(i, component)];
          const weight = skinWeights.getComponent(i, component);
          if (bone.name === 'Head') headWeight += weight;
          if (/^(UpperLeg|LowerLeg|Foot)/.test(bone.name)) legWeight += weight;
        }
        // Keep shoulders, sleeves and hands attached as one upper-body form.
        // Leg weights lengthen the lower body; only head-weighted vertices
        // shrink around the animated head joint, retaining neck transitions.
        const head = mesh.skeleton.bones
          .find((bone) => bone.name === 'Head')
          .getWorldPosition(new T.Vector3());
        const upperLift = 0.38;
        const bodyY = v.y + upperLift;
        v.y = T.MathUtils.lerp(bodyY, v.y * 1.4, legWeight);
        head.y += upperLift;
        v.lerp(head.clone().add(v.clone().sub(head).multiplyScalar(0.4)), headWeight);
        p.setXYZ(i, v.x, v.y, v.z);
      }
      g.computeVertexNormals();
      const color = ['Skin', 'Face'].includes(mesh.material.name)
        ? new T.Color('#b5a48e')
        : mesh.material.color;
      const colors = new Float32Array(p.count * 3);
      const trousers = meshes.find((part) => part.material.name === 'Pants').material.color;
      const footwear = new T.Color('#292c2b');
      const sole = new T.Color('#494b47');
      for (let i = 0; i < p.count; i++) {
        let finish = color;
        if (mesh.material.name === 'Skin') {
          // Classify in the source bind pose, never the animated pose: cuffs
          // and shoes must remain attached to the same vertices all cycle.
          const bindY = mesh.geometry.attributes.position.getY(i);
          let leg = 0;
          for (let component = 0; component < 4; component++) {
            const bone =
              mesh.skeleton.bones[mesh.geometry.attributes.skinIndex.getComponent(i, component)];
            if (/^(UpperLeg|LowerLeg|Foot)/.test(bone.name))
              leg += mesh.geometry.attributes.skinWeight.getComponent(i, component);
          }
          if (leg > 0.5) finish = bindY < 0.045 ? sole : bindY < 0.19 ? footwear : trousers;
        }
        finish.toArray(colors, i * 3);
      }
      g.setAttribute('color', new T.BufferAttribute(colors, 3));
      return g;
    });
    frames.push(mergeGeometries(parts));
    parts.forEach((g) => g.dispose());
  }
  // Normalize against the resting body, not a changing walk pose.
  frames[0].computeBoundingBox();
  const bounds = frames[0].boundingBox,
    center = bounds.getCenter(new T.Vector3());
  const scale = 0.55 / (bounds.max.y - bounds.min.y);
  for (const frame of frames)
    frame.translate(-center.x, -bounds.min.y, -center.z).scale(scale, scale, scale);
  const geometry = frames.shift();
  geometry.morphAttributes.position = frames.map((g) => g.attributes.position.clone());
  geometry.morphAttributes.normal = frames.map((g) => g.attributes.normal.clone());
  const mesh = new T.Mesh(
    geometry,
    new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }),
  );
  mesh.updateMorphTargets();
  const binary = await new GLTFExporter().parseAsync(mesh, { binary: true });
  await writeFile(`public/models/citizen-${kind.toLowerCase()}.glb`, Buffer.from(binary));
  console.log(kind, binary.byteLength);
}
