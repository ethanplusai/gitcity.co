import { BoxBatch } from './box-batch.mjs';
import { brickwork } from './masonry.mjs';
import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { building, random } from '../../shared/model.mjs';
import { grove } from './vegetation.mjs';
import { limestone } from './stone.mjs';
import { interiorGlazing } from './glazing.mjs';
import { asphalt } from './road-finish.mjs';
import type { CodeFile } from './types';
import { roofProfile, pitchedRoof } from './roof-kit.ts';
import { slateRoof } from './slate.mjs';

// All dimensions come from the source model. Path seeds choose finishes and kit parts.
export function architectureStyle(file: CodeFile) {
  const b = building(file),
    rng = random(file.path);
  const family =
    (file.symbols || 0) > 35 ? 'glass' : (file.complexity || 0) > 12 ? 'concrete' : 'brick';
  const color = new T.Color(
    family === 'brick'
      ? ['#986f58', '#947b62', '#a27d64'][Math.floor(rng() * 3)]
      : family === 'glass'
        ? '#b0b6b2'
        : '#bcb6a8',
  ).lerp(new T.Color('#7c7e72'), b.decay * 0.25);
  const body = new T.MeshStandardMaterial({ color, roughness: 0.9 });
  if (family === 'brick') brickwork(body);
  else limestone(body);
  body.userData.originalColor = color.clone();
  const recent = Boolean(
    file.lastCommit && Date.now() - Date.parse(file.lastCommit) < 7 * 86400000,
  );
  const glass = new T.MeshStandardMaterial({
    color: '#64777c',
    metalness: 0.4,
    roughness: 0.23,
    emissive: '#b49b70',
    emissiveIntensity: 0.025,
  });
  glass.userData.nightWindow = true;
  glass.userData.activityGlow = recent ? 0.05 : 0.015;
  glass.userData.originalColor = glass.color.clone();
  glass.userData.originalEmissive = glass.emissive.clone();
  const materials = [
    body,
    glass,
    new T.MeshStandardMaterial({ color: '#bcb5a5', roughness: 0.86 }),
    new T.MeshStandardMaterial({ color: '#424744', metalness: 0.35, roughness: 0.48 }),
    new T.MeshStandardMaterial({
      color: ['#53554c', '#68726e', '#414e4f'][b.roof],
      roughness: 0.9,
    }),
    new T.MeshStandardMaterial({ color: '#64747a', metalness: 0.45, roughness: 0.24 }),
  ];
  limestone(materials[2]);
  if (roofProfile(file).kind !== 'terrace') slateRoof(materials[4]);
  interiorGlazing(glass);
  interiorGlazing(materials[5]);
  return { b, rng, family, body, glass, materials, recent };
}

export function architecture(file: CodeFile, scale = 1) {
  const { b, rng, family, body, glass, materials, recent } = architectureStyle(file);
  const group = new T.Group(),
    width = b.width * scale,
    depth = b.depth * scale,
    roof = roofProfile(file),
    height = roof.eave;
  group.userData.family = family;
  group.userData.roof = roof.kind;
  const parts: T.BufferGeometry[][] = materials.map(() => []);
  const boxes = materials.map(() => new BoxBatch());
  const flush = (n: number) => {
    const geometry = boxes[n].geometry();
    if (geometry) parts[n].push(geometry);
    boxes[n] = new BoxBatch();
  };
  const windowRandom = random(file.path + ':window-interiors');
  const add = (n: number, w: number, h: number, d: number, x: number, y: number, z: number) => {
    if (w <= 0 || h <= 0 || d <= 0) return;
    const glass = n === 1 || n === 5;
    boxes[n].add(
      w,
      h,
      d,
      x,
      y,
      z,
      0,
      glass ? 2 : 1,
      glass ? Math.floor(windowRandom() * 64) : 0,
      glass ? Math.floor(windowRandom() * 64) : 0,
    );
  };
  const reveal = Math.min(0.14, width * 0.06, depth * 0.06);
  const doorway = Math.min(width * 0.32, 0.65 * scale);
  const entryWidth = doorway + 0.04;
  add(0, width - reveal * 2, height, depth - reveal * 2, 0, height / 2, 0);
  add(2, width, 0.13, depth - reveal, 0, 0.065, -reveal / 2);
  for (const side of [-1, 1])
    add(
      2,
      (width - entryWidth) / 2,
      0.13,
      reveal,
      (side * (width + entryWidth)) / 4,
      0.065,
      depth / 2 - reveal / 2,
    );
  add(2, entryWidth, 0.035, reveal, 0, 0.0175, depth / 2 - reveal / 2);
  const floors = Math.max(1, Math.floor(height / 0.83)),
    storey = height / floors;
  // Each face has actual masonry piers and spandrels around inset glass.
  for (let face = 0; face < 4; face++) {
    const span = face % 2 === 0 ? width : depth,
      offset = face % 2 === 0 ? depth / 2 : width / 2,
      sign = face < 2 ? 1 : -1;
    const plane = (
      n: number,
      w: number,
      h: number,
      d: number,
      u: number,
      y: number,
      inset: number,
    ) => {
      if (face === 0 && y - h / 2 < 0.79 && Math.abs(u) - w / 2 < entryWidth / 2) {
        // Reserve one continuous doorway through every facade layer. Split
        // intersecting piers, sills and shop windows around the same opening.
        const left = u - w / 2,
          right = u + w / 2;
        const bottom = y - h / 2,
          top = y + h / 2;
        const segment = (a: number, b: number, low: number, high: number) =>
          add(n, b - a, high - low, d, (a + b) / 2, (low + high) / 2, offset + inset);
        segment(left, right, Math.max(bottom, 0.79), top);
        segment(left, Math.min(right, -entryWidth / 2), bottom, Math.min(top, 0.79));
        segment(Math.max(left, entryWidth / 2), right, bottom, Math.min(top, 0.79));
      } else if (face % 2 === 0) add(n, w, h, d, u, y, sign * (offset + inset));
      else add(n, d, h, w, sign * (offset + inset), y, u);
    };
    const bays = Math.max(
        2,
        Math.round(span / ((family === 'glass' ? 0.82 : family === 'brick' ? 0.88 : 0.78) * scale)),
      ),
      bay = span / bays,
      pier = Math.min(
        (family === 'glass' ? 0.055 : family === 'brick' ? 0.21 : 0.16) * scale,
        bay * 0.3,
      );
    for (let floor = 0; floor < floors; floor++) {
      const bottom = floor * storey,
        ground = floor === 0,
        wh =
          storey *
          (ground && face === 0
            ? 0.73
            : family === 'glass'
              ? 0.86
              : family === 'brick'
                ? 0.55
                : 0.62),
        wy = bottom + storey * 0.52,
        sill = wy - wh / 2,
        head = wy + wh / 2;
      for (let k = 0; k <= bays; k++)
        plane(
          ground && face === 0 ? 2 : 0,
          pier,
          storey,
          reveal,
          Math.max(-span / 2 + pier / 2, Math.min(span / 2 - pier / 2, (k - bays / 2) * bay)),
          bottom + storey / 2,
          -reveal / 2,
        );
      plane(
        ground && face === 0 ? 2 : 0,
        span,
        sill - bottom,
        reveal,
        0,
        (bottom + sill) / 2,
        -reveal / 2,
      );
      plane(0, span, bottom + storey - head, reveal, 0, (head + bottom + storey) / 2, -reveal / 2);
      if (ground && floors > 1)
        plane(2, span, 0.045, reveal * 1.15, 0, bottom + storey - 0.0225, -reveal * 0.42);
      for (let k = 0; k < bays; k++) {
        const u = (k - (bays - 1) / 2) * bay,
          ww = bay - pier;
        plane(3, ww, wh, 0.026, u, wy, -reveal * 0.82);
        plane(
          rng() < (recent ? 0.38 : 0.2) ? 1 : 5,
          ww - 0.05 * scale,
          wh - 0.045,
          0.022,
          u,
          wy,
          -reveal * 0.7,
        );
        plane(
          2,
          ww + 0.045 * scale,
          ground ? 0.045 : 0.027,
          reveal * 1.25,
          u,
          wy - wh / 2,
          -reveal * 0.2,
        );
        if (family === 'brick' && !ground)
          plane(0, ww + 0.08 * scale, 0.07, 0.04, u, wy + wh / 2 + 0.05, -reveal * 0.15);
        plane(3, 0.018 * scale, wh, 0.04, u, wy, -reveal * 0.45);
        if (ground) plane(3, ww, 0.022, 0.04, u, wy + wh * 0.2, -reveal * 0.45);
      }
    }
    // A continuous stone cornice ends the facade, rather than a floating white roof slab.
    plane(2, span + 0.05 * scale, 0.1, 0.14 * scale, 0, height - 0.015, 0);
  }
  // Bronze entry frame and a thin supported canopy, at the same street scale in every district.
  add(3, doorway, 0.74, 0.05, 0, 0.38, depth / 2 - 0.065);
  add(5, doorway - 0.05, 0.68, 0.025, 0, 0.38, depth / 2 - 0.029);
  add(3, 0.018, 0.7, 0.04, 0, 0.38, depth / 2 - 0.01);
  add(
    3,
    Math.min(width * 0.65, 1.3 * scale),
    0.045,
    0.38 * scale,
    0,
    0.88,
    depth / 2 + 0.12 * scale,
  );
  for (const x of [-0.24, 0.24])
    add(3, 0.018, 0.15, 0.018, x * scale, 0.79, depth / 2 + 0.24 * scale);
  // Door furniture, kick plate and a modest entry light make the entrance legible on foot.
  add(3, doorway - 0.05, 0.1, 0.028, 0, 0.09, depth / 2 - 0.008);
  for (const x of [-0.07, 0.07]) add(2, 0.012, 0.12, 0.022, x, 0.41, depth / 2 + 0.012);
  add(3, 0.16, 0.09, 0.075, doorway * 0.75, 0.75, depth / 2 + 0.015);
  add(1, 0.12, 0.05, 0.02, doorway * 0.75, 0.75, depth / 2 + 0.055);
  // Rear rainwater pipes and a service grille are architectural details, not extra source volume.
  for (const x of [-width * 0.43, width * 0.43]) {
    add(3, 0.022, height - 0.15, 0.035, x, (height - 0.15) / 2, -depth / 2 - 0.014);
    for (let y = 0.2; y < height; y += 0.85) add(3, 0.045, 0.018, 0.035, x, y, -depth / 2 - 0.025);
  }
  for (let k = 0; k < 5; k++)
    add(3, width * 0.2, 0.018, 0.028, width * 0.22, 0.3 + k * 0.04, -depth / 2 - 0.018);
  if (roof.kind !== 'terrace') {
    if (roof.kind === 'gable') {
      flush(0);
      parts[0].push(pitchedRoof(width, depth, height, roof.rise, false, true));
    }
    flush(4);
    parts[4].push(
      pitchedRoof(
        width + 0.08 * scale,
        depth + 0.08 * scale,
        height,
        roof.rise,
        roof.kind === 'hip',
      ),
    );
    // Continuous eaves, narrow metal gutters and a ridge cap.
    for (const sign of [-1, 1]) {
      add(2, 0.08 * scale, 0.07, depth + 0.1 * scale, (sign * width) / 2, height - 0.025, 0);
      add(
        3,
        0.035 * scale,
        0.035,
        depth + 0.13 * scale,
        sign * (width / 2 + 0.04 * scale),
        height,
        0,
      );
    }
    const ridgeLength = roof.kind === 'hip' ? Math.max(0.04, depth - width * 0.7) : depth;
    add(3, 0.045 * scale, 0.035, ridgeLength, 0, b.height + 0.01, 0);
    // Masonry stack intersects the roof and ends below its source height bound.
    const stackHeight = Math.min(roof.rise * 0.72, 0.4);
    add(
      0,
      0.17 * scale,
      stackHeight,
      0.23 * scale,
      width * 0.22,
      height + stackHeight / 2,
      -depth * 0.2,
    );
    add(2, 0.21 * scale, 0.035, 0.27 * scale, width * 0.22, height + stackHeight, -depth * 0.2);
  } else {
    // Recessed dark roof, perimeter coping and one screened mechanical enclosure.
    add(4, width - 0.1 * scale, 0.06, depth - 0.1 * scale, 0, height + 0.015, 0);
    for (const sign of [-1, 1]) {
      add(0, width, 0.16, 0.07 * scale, 0, height + 0.08, sign * (depth / 2 - 0.035 * scale));
      add(0, 0.07 * scale, 0.16, depth, sign * (width / 2 - 0.035 * scale), height + 0.08, 0);
      add(
        2,
        width + 0.025 * scale,
        0.025,
        0.1 * scale,
        0,
        height + 0.17,
        sign * (depth / 2 - 0.035 * scale),
      );
      add(2, 0.1 * scale, 0.025, depth, sign * (width / 2 - 0.035 * scale), height + 0.17, 0);
    }
    add(4, width * 0.27, 0.22, depth * 0.25, -width * 0.18, height + 0.14, 0);
    for (let k = 0; k < 5; k++)
      add(
        3,
        width * 0.29,
        0.014,
        depth * 0.024,
        -width * 0.18,
        height + 0.26,
        (k - 2) * depth * 0.045,
      );
    if (b.roof === 1)
      for (let x = -width * 0.4; x < width * 0.45; x += 0.22 * scale)
        add(3, 0.012, 0.018, depth * 0.85, x, height + 0.055, 0);
    if (b.roof === 2)
      for (let k = 0; k < 3; k++)
        add(
          3,
          width * 0.25,
          0.025,
          depth * 0.13,
          width * 0.23,
          height + 0.08,
          (k - 1) * depth * 0.16,
        );
  }
  boxes.forEach((_, i) => flush(i));
  parts.forEach((geometries, i) => {
    if (!geometries.length) {
      materials[i].dispose();
      return;
    }
    const mesh = new T.Mesh(mergeGeometries(geometries), materials[i]);
    geometries.forEach((g) => g.dispose());
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.userData.file = file;
    group.add(mesh);
  });
  return { group, body, glass, roof: materials[4] };
}

export function streetscape(total: number, side: number) {
  const group = new T.Group();
  const parts: T.BufferGeometry[][] = [[], [], [], [], [], [], []];
  const trees: { x: number; z: number; scale: number; rotation: number }[] = [];
  const box = (n: number, w: number, h: number, d: number, x: number, y: number, z: number) => {
    const indexed = new T.BoxGeometry(w, h, d);
    const g = indexed.toNonIndexed();
    indexed.dispose();
    g.translate(x, y, z);
    masonryUV(g);
    parts[n].push(g);
  };
  for (let i = 0; i < side; i++)
    for (let j = 0; j < side; j++) {
      const x = (i - (side - 1) / 2) * 24,
        z = (j - (side - 1) / 2) * 24;
      box(0, 21.4, 0.16, 21.4, x, 0.025, z);
      // Expansion joints break large plazas into real paving courses.
      for (let seam = -10; seam <= 10; seam += 1.25) {
        box(1, 0.012, 0.005, 21.2, x + seam, 0.108, z);
        box(1, 21.2, 0.005, 0.012, x, 0.108, z + seam);
      }
      for (const sign of [-1, 1]) {
        box(0, 21.4, 0.12, 0.12, x, 0.08, z + sign * 10.7);
        box(0, 0.12, 0.12, 21.4, x + sign * 10.7, 0.08, z);
        // Dark gutters and expansion breaks keep road edges legible.
        box(1, 21.4, 0.015, 0.12, x, 0.035, z + sign * 10.84);
        box(1, 0.12, 0.015, 21.4, x + sign * 10.84, 0.035, z);
        for (let k = -8; k <= 8; k += 8) {
          const px = x + k,
            pz = z + sign * 10;
          box(1, 0.09, 2.5, 0.09, px, 1.3, pz);
          box(1, 0.65, 0.08, 0.12, px + 0.27, 2.55, pz);
          box(6, 0.4, 0.06, 0.16, px + 0.35, 2.5, pz);

          box(1, 0.035, 0.15, 0.16, px + 0.7, 0.18, pz);
          box(1, 0.035, 0.15, 0.16, px + 1.3, 0.18, pz);
          box(0, 0.85, 0.35, 0.85, px - 1.4, 0.22, pz);
          trees.push({ x: px - 1.4, z: pz, scale: 0.9, rotation: k * 0.7 + sign });
          // Slatted benches, separate backs and supports instead of solid blocks.
          for (let slat = 0; slat < 4; slat++)
            box(3, 0.8, 0.025, 0.035, px + 1, 0.26, pz - 0.075 + slat * 0.05);
          box(3, 0.8, 0.14, 0.025, px + 1, 0.36, pz + sign * 0.11);
        }
        for (let k = -0.8; k <= 0.8; k += 0.4) box(2, 0.2, 0.025, 2, x + sign * 11.5, 0.07, z + k);
      }
    }
  for (let i = 0; i <= side; i++) {
    const offset = (i - side / 2) * 24;
    box(5, total + 3, 0.055, 2.4, 0, 0.005, offset);
    box(5, 2.4, 0.055, total + 3, offset, 0.005, 0);
    for (let j = -total / 2; j < total / 2; j += 3) {
      box(2, 0.7, 0.015, 0.04, j, 0.04, offset);
      box(2, 0.04, 0.015, 0.7, offset, 0.04, j);
    }
  }
  const colors = ['#b1b0a5', '#303635', '#d3d0bc', '#71614d', '#45684b', '#343636', '#ffdf9a'];
  parts.forEach((p, i) => {
    if (!p.length) return;
    const m = new T.Mesh(
      mergeGeometries(p),
      new T.MeshStandardMaterial({
        color: colors[i],
        roughness: 0.9,
        ...(i === 6 ? { emissive: '#ffd595', emissiveIntensity: 1 } : {}),
      }),
    );
    if (i === 0) asphalt(m.material); // Light mineral aggregate, without brown wall-texture staining.
    if (i === 5) asphalt(m.material);
    if (i === 6) m.material.userData.nightLamp = true;
    p.forEach((g) => g.dispose());
    m.castShadow = true;
    m.receiveShadow = true;
    group.add(m);
  });
  group.add(grove(trees, 'avenue'));
  const pools: T.BufferGeometry[] = [];
  trees.forEach((tree) => {
    const g = new T.PlaneGeometry(3.4, 4.2);
    g.rotateX(-Math.PI / 2);
    g.translate(tree.x + 1.75, 0.113, tree.z);
    pools.push(g);
  });
  if (pools.length) {
    const material = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { night: { value: 0 } },
      vertexShader:
        'varying vec2 v;void main(){v=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
      fragmentShader:
        'varying vec2 v;uniform float night;void main(){float r=length((v-.5)*2.);float a=pow(max(0.,1.-r),2.)*.4*night;gl_FragColor=vec4(1.,.66,.28,a);}',
    });
    material.userData.lightPool = true;
    group.add(new T.Mesh(mergeGeometries(pools), material));
    pools.forEach((g) => g.dispose());
  }
  return group;
}

// Physical UV scale remains consistent across differently sized modular parts.
function masonryUV(geo: T.BufferGeometry) {
  const p = geo.getAttribute('position'),
    n = geo.getAttribute('normal'),
    uv = geo.getAttribute('uv');
  for (let i = 0; i < p.count; i++) {
    const u = Math.abs(n.getX(i)) > 0.5 ? p.getZ(i) : p.getX(i);
    const v = Math.abs(n.getY(i)) > 0.5 ? p.getZ(i) : p.getY(i);
    uv.setXY(i, u * 3.9, v * 3.9);
  }
}
