import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// A small tower-crane kit, with one separately rotating assembly. All trusses
// share material batches; adding braces does not add a draw call per member.
export function towerCrane(height: number) {
  const group = new T.Group(),
    arm = new T.Group();
  const materials = [
    new T.MeshStandardMaterial({ color: '#bfa467', roughness: 0.72, metalness: 0.3 }),
    new T.MeshStandardMaterial({ color: '#626866', roughness: 0.9 }),
    new T.MeshStandardMaterial({ color: '#344a52', roughness: 0.28, metalness: 0.25 }),
  ];
  const build = (
    parent: T.Group,
    assemble: (
      box: (
        bucket: number,
        w: number,
        h: number,
        d: number,
        x: number,
        y: number,
        z: number,
      ) => void,
      beam: (a: number[], b: number[], radius: number) => void,
    ) => void,
  ) => {
    const parts: T.BufferGeometry[][] = materials.map(() => []);
    const box = (
      bucket: number,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      parts[bucket].push(new T.BoxGeometry(w, h, d).translate(x, y, z));
    };
    const beam = (a: number[], b: number[], radius: number) => {
      const from = new T.Vector3(...a),
        to = new T.Vector3(...b),
        delta = to.clone().sub(from);
      const geometry = new T.CylinderGeometry(radius, radius, delta.length(), 5);
      geometry.applyQuaternion(
        new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), delta.normalize()),
      );
      geometry.translate(...from.add(to).multiplyScalar(0.5).toArray());
      parts[0].push(geometry);
    };
    assemble(box, beam);
    parts.forEach((pieces, i) => {
      if (!pieces.length) return;
      const mesh = new T.Mesh(mergeGeometries(pieces), materials[i]);
      pieces.forEach((p) => p.dispose());
      mesh.castShadow = mesh.receiveShadow = true;
      parent.add(mesh);
    });
  };
  build(group, (box, beam) => {
    box(1, 0.8, 0.18, 0.8, 0, 0.09, 0);
    // A low protective enclosure makes the fixed worksite legible at eye level.
    for (const x of [-0.65, 0.65])
      for (const z of [-0.65, 0.65]) box(1, 0.035, 0.5, 0.035, x, 0.25, z);
    for (const side of [-0.65, 0.65])
      for (const y of [0.16, 0.46]) {
        box(1, 1.3, 0.025, 0.025, 0, y, side);
        box(1, 0.025, 0.025, 1.3, side, y, 0);
      }

    for (const x of [-0.18, 0.18])
      for (const z of [-0.18, 0.18]) beam([x, 0.18, z], [x, height, z], 0.025);
    const levels = Math.ceil(height / 0.65);
    for (let i = 0; i < levels; i++) {
      const y = 0.18 + ((height - 0.18) * i) / levels,
        next = 0.18 + ((height - 0.18) * (i + 1)) / levels;
      for (const side of [-0.18, 0.18]) {
        beam([-0.18, y, side], [0.18, next, side], 0.012);
        beam([side, y, -0.18], [side, next, 0.18], 0.012);
        beam([-0.18, next, side], [0.18, next, side], 0.016);
        beam([side, next, -0.18], [side, next, 0.18], 0.016);
      }
    }
  });
  arm.position.y = height - 0.5;
  build(arm, (box, beam) => {
    for (const z of [-0.17, 0.17]) beam([-2, 0, z], [5, 0, z], 0.027);
    beam([-2, 0.38, 0], [5, 0.38, 0], 0.023);
    for (let x = -2; x < 5; x += 0.5) {
      for (const z of [-0.17, 0.17]) {
        beam([x, 0, z], [x + 0.5, 0.38, 0], 0.012);
        beam([x, 0.38, 0], [x + 0.5, 0, z], 0.012);
      }
      beam([x, 0, -0.17], [x, 0, 0.17], 0.015);
    }
    beam([0, 0.38, 0], [0, 1.1, 0], 0.03);
    beam([0, 1.1, 0], [4, 0.38, 0], 0.01);
    beam([0, 1.1, 0], [-1.8, 0.38, 0], 0.01);
    box(1, 0.75, 0.35, 0.55, -1.65, -0.08, 0);
    box(0, 0.48, 0.42, 0.5, 0.35, -0.15, 0.37);
    box(2, 0.4, 0.29, 0.025, 0.35, -0.11, 0.633);
    box(2, 0.025, 0.29, 0.42, 0.6, -0.11, 0.37);
    box(1, 0.28, 0.14, 0.4, 4.5, -0.07, 0);
    box(1, 0.016, 1.2, 0.016, 4.5, -0.72, 0);
    box(0, 0.13, 0.17, 0.1, 4.5, -1.32, 0);
  });
  group.add(arm);
  group.name = 'tower-crane';
  return { group, arm, groundFootprint: 1.3 };
}
