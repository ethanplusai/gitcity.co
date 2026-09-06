import * as T from 'three';
import { movingFoliage } from './foliage-motion.mjs';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { random } from '../../shared/model.mjs';
import { foliageTexture } from './foliage-texture.mjs';

// Two reusable botanical kits: branched broadleaf trees and layered conifers.
// Layered cutout branch sprays form dense crowns with shared, bounded geometry.
export function treeKit(seed, conifer = false, distant = false) {
  const rng = random(seed),
    wood = [],
    foliage = [];
  const branch = (start, end, radius) => {
    const direction = end.clone().sub(start);
    const g = new T.CylinderGeometry(radius * 0.35, radius, direction.length(), 5);
    g.applyQuaternion(
      new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), direction.clone().normalize()),
    );
    g.translate(...start.clone().add(end).multiplyScalar(0.5).toArray());
    wood.push(g);
  };
  const height = conifer ? 3.35 : 2.65;
  branch(new T.Vector3(), new T.Vector3(0.06, height, 0), 0.085);
  const tips = [];
  const limbs = conifer ? 14 : 10;
  for (let i = 0; i < limbs; i++) {
    const angle = i * 2.399 + (rng() - 0.5) * 0.25;
    const y = conifer ? 0.55 + i * 0.17 : 1.2 + i * 0.1;
    const reach = conifer
      ? (3.4 - y) * 0.44
      : 0.75 + Math.sin((i / limbs) * Math.PI) * 0.38 + rng() * 0.15;
    const start = new T.Vector3(0.025, y, 0),
      tip = new T.Vector3(
        Math.cos(angle) * reach,
        y + (conifer ? 0.08 : 0.55),
        Math.sin(angle) * reach,
      );
    if (distant !== 'impostor') branch(start, tip, conifer ? 0.018 : 0.026);
    tips.push(tip);
    if (!distant)
      for (const side of [-1, 1]) {
        const fork = start.clone().lerp(tip, 0.58),
          end = tip
            .clone()
            .add(
              new T.Vector3(
                Math.cos(angle + side * 0.8) * 0.28,
                0.18,
                Math.sin(angle + side * 0.8) * 0.28,
              ),
            );
        branch(fork, end, 0.009);
        tips.push(end);
      }
  }
  tips.push(new T.Vector3(0.04, conifer ? 3.25 : 3.0, 0));
  if (!conifer) tips.push(new T.Vector3(0, 2.4, 0), new T.Vector3(0.15, 2.0, 0.1));
  // Sprays overlap in three dimensions around each branch tip. Their normals
  // follow the crown volume, avoiding a flat-card lighting pattern.
  const count = distant === 'impostor' ? 24 : distant ? (conifer ? 128 : 132) : conifer ? 180 : 192;
  for (let i = 0; i < count; i++) {
    const tip = tips[i % tips.length],
      angle = rng() * Math.PI * 2;
    const spread = conifer ? 0.22 : 0.45,
      radius = Math.sqrt(rng()) * spread;
    // Evergreen needles occupy the branch, not only its outer tip. Keep
    // the same spray budget while filling the hollow middle of the crown.
    const along = conifer ? 0.55 + 0.45 * Math.sqrt(rng()) : 1;
    const x = tip.x * along + Math.cos(angle) * radius,
      z = tip.z * along + Math.sin(angle) * radius,
      y = tip.y + (rng() - 0.35) * (conifer ? 0.3 : 0.65);
    // Lower boughs carry broader sprays; the leader stays narrow. This
    // gives the crown a continuous taper instead of equally sized tufts.
    const spraySize = conifer ? 0.55 + 0.65 * Math.max(0, (3.4 - tip.y) / 2.8) : 1;
    const size =
      spraySize * (0.8 + rng() * 0.4) * (distant === 'impostor' ? (conifer ? 1.65 : 1.3) : 1);
    const g = new T.PlaneGeometry(size, size, 1, 1);
    g.rotateZ(rng() * Math.PI * 2);
    g.rotateX(-Math.PI / 2 + (rng() - 0.5) * (conifer ? 2.2 : Math.PI));
    g.rotateY(angle);
    g.translate(x, y, z);
    const positions = g.attributes.position,
      normals = g.attributes.normal;
    const colors = [];
    const shade = (0.72 + rng() * 0.2) * (0.9 + Math.min(1, Math.hypot(x, z)) * 0.1);
    for (let k = 0; k < positions.count; k++) {
      const normal = new T.Vector3(
        positions.getX(k) * 0.65,
        (positions.getY(k) - 1.5) * 0.5 + 0.55,
        positions.getZ(k) * 0.65,
      ).normalize();
      normals.setXYZ(k, normal.x, normal.y, normal.z);
      colors.push(shade, shade, shade);
    }
    g.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    foliage.push(g);
  }
  const bark = mergeGeometries(wood),
    leaves = mergeGeometries(foliage);
  [...wood, ...foliage].forEach((g) => g.dispose());
  return { bark, leaves };
}

export function grove(points, seed = 'grove', distant = false) {
  const group = new T.Group();
  for (let species = 0; species < 2; species++) {
    const selected = points.filter((p, i) => (p.species ?? i % 2) === species);
    if (!selected.length) continue;
    const kit = treeKit(seed + species, species === 1, distant);
    const bark = new T.MeshStandardMaterial({ color: '#60564b', roughness: 1 });
    const leaves = new T.MeshStandardMaterial({
      color: '#c4cbb6',
      vertexColors: true,
      map: foliageTexture(species === 1, Boolean(distant)),
      alphaTest: 0.3,
      alphaToCoverage: true,
      roughness: 0.92,
      side: T.DoubleSide,
    });
    for (const [geometry, material] of [
      [kit.bark, bark],
      [kit.leaves, leaves],
    ]) {
      const mesh = new T.InstancedMesh(geometry, material, selected.length),
        dummy = new T.Object3D();
      selected.forEach((p, i) => {
        dummy.position.set(p.x, p.y || 0, p.z);
        const scale = p.scale || 1;
        const variation = random(`${seed}:${p.x.toFixed(3)}:${p.z.toFixed(3)}`);
        dummy.scale.set(
          scale * (0.9 + variation() * 0.2),
          scale * (0.92 + variation() * 0.16),
          scale * (0.9 + variation() * 0.2),
        );
        dummy.rotation.y = p.rotation || 0;
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
        // Per-tree mineral/leaf variation stays in the existing instance batch.
        // Consume the same seeded sequence for bark and foliage, and both LODs.
        const tone = variation();
        mesh.setColorAt(
          i,
          geometry === kit.leaves
            ? new T.Color().setRGB(0.86 + tone * 0.14, 0.91 + tone * 0.09, 0.79 + tone * 0.21)
            : new T.Color().setRGB(0.88 + tone * 0.12, 0.88 + tone * 0.12, 0.88 + tone * 0.12),
        );
      });
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.computeBoundingSphere();
      if (geometry === kit.leaves) movingFoliage(mesh);
      group.add(mesh);
    }
  }
  return group;
}

// Transfer instances between two fixed geometry kits as the camera moves.
// This keeps a whole owner's remote courts from drawing close-up branches.
export function streamingGrove(points, seed = 'grove') {
  const group = new T.Group();
  const detailed = grove(points, seed, false),
    coarse = grove(points, seed, 'impostor');
  group.add(detailed, coarse);
  const cameraLocal = new T.Vector3();
  const last = new T.Vector3(Infinity, Infinity, Infinity);
  const batches = detailed.children.map((mesh, index) => {
    const remote = coarse.children[index];
    const matrices = Array.from({ length: mesh.count }, (_, i) => {
      const matrix = new T.Matrix4();
      mesh.getMatrixAt(i, matrix);
      return matrix;
    });
    const colors = Array.from({ length: mesh.count }, (_, i) => {
      const color = new T.Color();
      mesh.getColorAt(i, color);
      return color;
    });
    mesh.count = 0;
    remote.castShadow = false;
    return { mesh, remote, matrices, colors, near: matrices.map(() => false) };
  });
  group.userData.updateVegetation = (camera) => {
    cameraLocal.copy(camera);
    group.worldToLocal(cameraLocal);
    if (cameraLocal.distanceToSquared(last) < 4) return;
    last.copy(cameraLocal);
    for (const { mesh, remote, matrices, colors, near } of batches) {
      let nearCount = 0,
        farCount = 0;
      matrices.forEach((matrix, i) => {
        const p = matrix.elements;
        const distance = Math.hypot(p[12] - cameraLocal.x, p[14] - cameraLocal.z, cameraLocal.y);
        near[i] = distance < (near[i] ? 90 : 70);
        if (near[i]) {
          mesh.setMatrixAt(nearCount, matrix);
          mesh.setColorAt(nearCount++, colors[i]);
        } else {
          remote.setMatrixAt(farCount, matrix);
          remote.setColorAt(farCount++, colors[i]);
        }
      });
      mesh.count = nearCount;
      remote.count = farCount;
      mesh.instanceMatrix.needsUpdate = true;
      remote.instanceMatrix.needsUpdate = true;
      mesh.instanceColor.needsUpdate = true;
      remote.instanceColor.needsUpdate = true;
    }
  };
  return group;
}
