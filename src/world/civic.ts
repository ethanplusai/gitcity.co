import { pavingFinish } from './paving-finish.mjs';
import { brickwork } from './masonry.mjs';
import * as T from 'three';
import { random } from '../../shared/model.mjs';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { interiorGlazing } from './glazing.mjs';
import { limestone } from './stone.mjs';
import { slateRoof } from './slate.mjs';
import { foliageTexture } from './foliage-texture.mjs';
// A municipal building, with a street-facing public entrance at -Z.
export function civicHall() {
  const group = new T.Group();
  const materials = [
    new T.MeshStandardMaterial({ color: '#c6bba5', roughness: 0.88 }),
    new T.MeshStandardMaterial({ color: '#99765e', roughness: 0.92 }),
    new T.MeshStandardMaterial({ color: '#343c3c', roughness: 0.47, metalness: 0.35 }),
    new T.MeshStandardMaterial({
      color: '#556267',
      roughness: 0.22,
      metalness: 0.35,
      emissive: '#d3ae78',
      emissiveIntensity: 0.06,
    }),
    new T.MeshStandardMaterial({ color: '#90958f', roughness: 0.96 }),
    new T.MeshStandardMaterial({ color: '#615449', roughness: 0.9 }),
    new T.MeshStandardMaterial({ color: '#485151', roughness: 0.86, metalness: 0.08 }),
  ];
  limestone(materials[0]);
  brickwork(materials[1]);
  pavingFinish(materials[4]);
  slateRoof(materials[6]);
  materials[3].userData.nightWindow = true;
  materials[3].userData.activityGlow = 0.04;
  interiorGlazing(materials[3]);
  const parts: T.BufferGeometry[][] = materials.map(() => []);
  const rooms = random('civic-window-rooms');
  const box = (n: number, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const g = new T.BoxGeometry(w, h, d).translate(x, y, z);
    if (n === 3) {
      const uv = g.attributes.uv;
      const roomX = Math.floor(rooms() * 127),
        roomY = Math.floor(rooms() * 127);
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) + roomX, uv.getY(i) + roomY);
    } else {
      const p = g.attributes.position,
        norm = g.attributes.normal,
        uv = g.attributes.uv;
      for (let i = 0; i < p.count; i++)
        uv.setXY(
          i,
          (Math.abs(norm.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i)) * 3.9,
          (Math.abs(norm.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i)) * 3.9,
        );
    }
    parts[n].push(g);
  };
  const hipRoof = (x: number) => {
    const eave = 2.4,
      ridge = 2.97,
      w = 1.48,
      d = 2.32,
      end = 0.95;
    const vertices = [
      [-w, eave, -d],
      [w, eave, -d],
      [w, eave, d],
      [-w, eave, d],
      [0, ridge, -end],
      [0, ridge, end],
    ];
    const positions: number[] = [],
      uvs: number[] = [];
    for (const face of [
      [0, 4, 1],
      [1, 4, 5],
      [1, 5, 2],
      [2, 5, 3],
      [3, 5, 4],
      [3, 4, 0],
    ]) {
      for (const index of face) {
        const p = vertices[index];
        positions.push(p[0] + x, p[1], p[2]);
        uvs.push(p[0] * 4, p[2] * 4);
      }
    }
    const geometry = new T.BufferGeometry();
    geometry.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new T.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(Array.from({ length: positions.length / 3 }, (_, i) => i));
    geometry.computeVertexNormals();
    parts[6].push(geometry);
    // Ridge cap, boxed eaves, gutter and downpipes form a legible roof edge.
    box(2, 0.065, 0.04, end * 2 + 0.08, x, ridge + 0.012, 0);
    for (const side of [-1, 1]) {
      box(0, 0.09, 0.1, d * 2, x + side * (w - 0.035), eave - 0.035, 0);
      box(2, 0.055, 0.045, d * 2 + 0.04, x + side * (w + 0.012), eave - 0.04, 0);
      box(0, w * 2, 0.1, 0.09, x, eave - 0.035, side * (d - 0.035));
      const pipe = new T.CylinderGeometry(0.018, 0.018, 2.2, 8).translate(
        x + side * 1.42,
        1.28,
        2.24,
      );
      parts[2].push(pipe);
    }
    // A masonry exhaust stack with a dark cap gives the civic roof a useful silhouette.
    box(1, 0.28, 0.5, 0.32, x + 0.64, 2.91, 0.85);
    box(0, 0.34, 0.055, 0.38, x + 0.64, 3.16, 0.85);
    box(2, 0.18, 0.07, 0.2, x + 0.64, 3.2, 0.85);
  };
  // Two wings frame a recessed glazed public lobby; roofline stays human-scaled.
  for (const side of [-1, 1]) {
    // Build the wall around openings, leaving the glass behind the masonry
    // face. Reveals now receive real shadows instead of covering a solid box.
    const wall = (centers: number[], low: number, high: number, outer: boolean, face: number) => {
      const strip = (start: number, end: number, bottom: number, top: number) => {
        if (end <= start || top <= bottom) return;
        if (outer)
          box(
            1,
            0.18,
            top - bottom,
            end - start,
            side * 3.91,
            (top + bottom) / 2,
            (start + end) / 2,
          );
        else
          box(
            1,
            end - start,
            top - bottom,
            0.18,
            side * 2.6 + (start + end) / 2,
            (top + bottom) / 2,
            face * 2.11,
          );
      };
      let bottom = 0.15;
      for (const y of [0.78, 1.72]) {
        strip(low, high, bottom, y - 0.34);
        let start = low;
        for (const center of centers) {
          strip(start, center - 0.285, y - 0.34, y + 0.34);
          start = center + 0.285;
        }
        strip(start, high, y - 0.34, y + 0.34);
        bottom = y + 0.34;
      }
      strip(low, high, bottom, 2.25);
    };
    for (const face of [-1, 1]) wall([-0.8, 0, 0.8], -1.4, 1.4, false, face);
    wall([-1.4, -0.45, 0.5, 1.45], -2.02, 2.02, true, 0);
    box(1, 0.18, 2.1, 4.04, side * 1.29, 1.2, 0);
    box(0, 2.95, 0.22, 4.65, side * 2.6, 0.21, 0);
    box(0, 2.95, 0.12, 4.65, side * 2.6, 2.31, 0);
    hipRoof(side * 2.6);
    for (const level of [0, 1])
      for (const k of [-1, 0, 1]) {
        const x = side * 2.6 + k * 0.8,
          y = 0.78 + level * 0.94;
        // Narrow cut-stone dressings surround dark recessed frames on both
        // elevations; the sill projects independently of the lintel.
        for (const face of [-1, 1]) {
          for (const sign of [-1, 1]) {
            box(0, 0.042, 0.76, 0.11, x + sign * 0.31, y, face * 2.235);
            box(0, 0.66, 0.045, 0.11, x, y + sign * 0.36, face * 2.235);
          }
          box(2, 0.57, 0.68, 0.025, x, y, face * 2.095);
          box(3, 0.51, 0.61, 0.026, x, y, face * 2.115);
          box(0, 0.7, 0.045, 0.17, x, y - 0.4, face * 2.255);
          box(2, 0.018, 0.63, 0.024, x, y, face * 2.138);
          box(2, 0.52, 0.016, 0.024, x, y + 0.16, face * 2.138);
        }
      }
    for (const z of [-1.4, -0.45, 0.5, 1.45])
      for (const y of [0.78, 1.72]) {
        for (const sign of [-1, 1]) {
          box(0, 0.11, 0.76, 0.042, side * 4.035, y, z + sign * 0.31);
          box(0, 0.11, 0.045, 0.66, side * 4.035, y + sign * 0.36, z);
        }
        box(2, 0.025, 0.68, 0.57, side * 3.895, y, z);
        box(3, 0.026, 0.61, 0.51, side * 3.915, y, z);
        box(0, 0.17, 0.045, 0.7, side * 4.055, y - 0.4, z);
        box(2, 0.024, 0.63, 0.018, side * 3.938, y, z);
        box(2, 0.024, 0.016, 0.52, side * 3.938, y + 0.16, z);
      }
  }
  box(0, 2.45, 2.65, 3.25, 0, 1.48, 0.35);
  for (const side of [-1, 1]) {
    box(0, 0.12, 0.14, 3.33, side * 1.205, 2.84, 0.35);
    box(0, 2.53, 0.14, 0.12, 0, 2.84, 0.35 + side * 1.605);
    box(2, 0.14, 0.025, 3.35, side * 1.205, 2.922, 0.35);
    box(2, 2.55, 0.025, 0.14, 0, 2.922, 0.35 + side * 1.605);
  }
  box(6, 2.25, 0.025, 3.05, 0, 2.82, 0.35);
  box(2, 1.28, 0.16, 1.7, 0, 2.9, 0.5);
  box(3, 1.18, 0.025, 1.6, 0, 2.99, 0.5);
  for (const z of [-0.02, 0.51, 1.04]) box(2, 1.2, 0.04, 0.025, 0, 3.008, z);
  // Lobby frame stands in front of an inset, lower wall, giving the entrance real depth.
  box(2, 2.15, 1.8, 0.08, 0, 1.18, -1.36);
  box(3, 1.9, 1.62, 0.03, 0, 1.18, -1.42);
  for (const x of [-1.15, 1.15]) box(0, 0.18, 2.1, 0.85, x, 1.2, -1.8);
  box(0, 2.6, 0.26, 1.15, 0, 2.36, -1.9);
  box(2, 2.7, 0.07, 1.25, 0, 2.53, -1.93);
  // A two-storey glazed lobby has ordinary human-scale doors below a
  // transom, rather than making the entire curtain wall one giant door.
  for (const x of [-0.34, 0.34]) box(2, 0.025, 1.64, 0.04, x, 1.18, -1.455);
  box(2, 1.92, 0.025, 0.04, 0, 1.12, -1.455);
  box(2, 0.025, 0.74, 0.04, 0, 0.735, -1.455);
  box(2, 1.92, 0.025, 0.04, 0, 0.36, -1.455);
  for (const x of [-0.075, 0.075]) box(2, 0.014, 0.12, 0.035, x, 0.69, -1.495);
  // The landing links a central stair and a separate sloped side approach.
  // Keep the approach inside the lobby recess, clear of both masonry wings.
  const plazaHeight = 0.0525,
    landingHeight = 0.3525;
  box(0, 2.25, 0.3, 0.5, 0, plazaHeight + 0.15, -1.65);
  for (let i = 0; i < 5; i++) {
    const rise = 0.06 * (5 - i);
    box(0, 1.3, rise, 0.3, -0.1, plazaHeight + rise / 2, -2.05 - i * 0.3);
  }
  box(4, 10, 0.65, 8.9, 0, -0.2725, -0.4);
  const rampFront = -5.5,
    rampRear = -1.9;
  const rampShape = new T.Shape();
  rampShape.moveTo(rampFront, plazaHeight);
  rampShape.lineTo(rampRear, plazaHeight);
  rampShape.lineTo(rampRear, landingHeight);
  rampShape.closePath();
  const ramp = new T.ExtrudeGeometry(rampShape, { depth: 0.45, bevelEnabled: false, steps: 1 });
  ramp.setIndex(Array.from({ length: ramp.attributes.position.count }, (_, i) => i));
  // Shape X becomes world Z; extrusion becomes world X.
  ramp.rotateY(-Math.PI / 2).translate(1.04, 0, 0);
  parts[0].push(ramp);
  const railSlope = Math.atan2(landingHeight - plazaHeight, rampRear - rampFront);
  for (const x of [0.58, 1.05]) {
    for (const t of [0, 0.5, 1]) {
      const ground = plazaHeight + (landingHeight - plazaHeight) * t;
      box(2, 0.018, 0.3, 0.018, x, ground + 0.15, rampFront + (rampRear - rampFront) * t);
    }
    const rail = new T.CylinderGeometry(0.013, 0.013, Math.hypot(3.6, 0.3), 8);
    rail
      .rotateX(Math.PI / 2 - railSlope)
      .translate(x, (plazaHeight + landingHeight) / 2 + 0.3, (rampFront + rampRear) / 2);
    parts[2].push(rail);
  }
  for (const side of [-1, 1]) {
    box(0, 1.25, 0.23, 1.35, side * 3.75, 0.14, -3.65);
    box(5, 1.08, 0.025, 1.18, side * 3.75, 0.265, -3.65);
    for (let slat = 0; slat < 5; slat++)
      box(5, 1.3, 0.035, 0.044, side * 2.05, 0.26, -3.9 + slat * 0.056);
    for (const x of [-0.5, 0.5]) box(2, 0.035, 0.23, 0.32, side * 2.05 + x, 0.13, -3.77);
    for (const z of [-4.3, -3.2]) {
      box(2, 0.06, 0.46, 0.06, side * 1.65, 0.28, z);
      box(0, 0.07, 0.025, 0.07, side * 1.65, 0.52, z);
    }
  }
  const branchRandom = random('civic-shrub-stems');
  for (const side of [-1, 1])
    for (let i = 0; i < 18; i++) {
      const angle = branchRandom() * Math.PI * 2;
      const radius = Math.sqrt(branchRandom()) * 0.36;
      const stem = new T.CylinderGeometry(0.004, 0.009, 0.23, 5);
      stem
        .rotateZ((branchRandom() - 0.5) * 0.65)
        .translate(side * 3.75 + Math.cos(angle) * radius, 0.36, -3.65 + Math.sin(angle) * radius);
      parts[5].push(stem);
    }
  parts.forEach((geometries, i) => {
    const mesh = new T.Mesh(mergeGeometries(geometries), materials[i]);
    geometries.forEach((g) => g.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.hall = true;
    group.add(mesh);
  });
  // Botanical sprays form a clipped but irregular canopy. Individual leaf
  // edges replace the opaque pebbles that previously represented these shrubs.
  const shrubGeometry = new T.PlaneGeometry(1, 1),
    shrubMaterial = new T.MeshStandardMaterial({
      color: '#b1b79f',
      map: foliageTexture(false),
      alphaTest: 0.3,
      alphaToCoverage: true,
      side: T.DoubleSide,
      roughness: 0.85,
    });
  const shrubs = new T.InstancedMesh(shrubGeometry, shrubMaterial, 480),
    dummy = new T.Object3D(),
    rng = random('civic-boxwood');
  for (let i = 0; i < 480; i++) {
    const side = i < 240 ? -1 : 1,
      angle = rng() * Math.PI * 2,
      radius = Math.sqrt(rng()) * 0.46;
    dummy.position.set(
      side * 3.75 + Math.cos(angle) * radius,
      0.34 + rng() * 0.25 * Math.sqrt(1 - (radius * radius) / (0.5 * 0.5)),
      -3.65 + Math.sin(angle) * radius,
    );
    const spraySize = 0.19 + rng() * 0.08;
    dummy.scale.setScalar(spraySize);
    dummy.rotation.set(-Math.PI / 2 + (rng() - 0.5) * 1.6, rng() * Math.PI, rng() * Math.PI);
    dummy.updateMatrix();
    shrubs.setMatrixAt(i, dummy.matrix);
    shrubs.setColorAt(i, new T.Color(i % 3 === 0 ? '#c5cbaa' : '#a5b496'));
  }
  shrubs.castShadow = true;
  shrubs.receiveShadow = true;
  group.add(shrubs);
  if (typeof document !== 'undefined') {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    ctx.fillStyle = '#c6bba5';
    ctx.fillRect(0, 0, 1024, 128);
    ctx.fillStyle = '#343c3c';
    ctx.font = '500 58px Georgia';
    ctx.textAlign = 'center';
    ctx.fillText('C I T Y   H A L L', 512, 84);
    const texture = new T.CanvasTexture(canvas);
    texture.colorSpace = T.SRGBColorSpace;
    const material = new T.MeshStandardMaterial({ map: texture, roughness: 0.85 });
    material.addEventListener('dispose', () => texture.dispose());
    const sign = new T.Mesh(new T.PlaneGeometry(2.04, 0.255), material);
    sign.rotation.y = Math.PI;
    sign.position.set(0, 2.365, -2.481);
    sign.userData.hall = true;
    group.add(sign);
  }
  group.userData.civic = true;
  return group;
}
