import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { random } from '../../shared/model.mjs';

// World units match the half-unit pedestrians: a modest wheel-track defect,
// not an excavation spanning the street. Both states share the same outline.
export function roadRepair(seed, repaired = false) {
  const rng = random(seed);
  const outline = Array.from({ length: 28 }, (_, i) => {
    const angle = (i / 28) * Math.PI * 2;
    const radius = 0.87 + rng() * 0.13;
    return new T.Vector2(Math.cos(angle) * radius * 0.29, Math.sin(angle) * radius * 0.19);
  });
  const group = new T.Group();
  const surface = (points, color, height) => {
    const geometry = new T.ShapeGeometry(new T.Shape(points));
    geometry.rotateX(-Math.PI / 2);
    const material = new T.MeshStandardMaterial({ color, roughness: 1 });
    const mesh = new T.Mesh(geometry, material);
    mesh.position.y = height;
    mesh.receiveShadow = true;
    group.add(mesh);
  };
  surface(outline, repaired ? '#303638' : '#363a37', 0.002);
  if (!repaired) {
    // A narrow fractured edge and darker aggregate read as shallow damage.
    surface(
      outline.map((p) => p.clone().multiplyScalar(0.94)),
      '#292f30',
      0.003,
    );
    const chips = [[], []];
    for (let i = 0; i < 24; i++) {
      const p = outline[i % outline.length];
      const radius = 0.003 + rng() * 0.005;
      const chip = new T.TetrahedronGeometry(radius);
      chip
        .rotateX(rng() * 3)
        .rotateY(rng() * 3)
        .rotateZ(rng() * 3);
      chip.translate(p.x * (0.92 + rng() * 0.2), 0.004, -p.y * (0.92 + rng() * 0.2));
      chips[i % 3 ? 0 : 1].push(chip);
    }
    chips.forEach((parts, i) => {
      group.add(
        new T.Mesh(
          mergeGeometries(parts),
          new T.MeshStandardMaterial({
            color: i ? '#393d3c' : '#55564f',
            roughness: 1,
          }),
        ),
      );
      parts.forEach((part) => part.dispose());
    });
  }
  return group;
}
