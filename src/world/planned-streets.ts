import { planFixtures } from './plan-fixtures.mjs';
import { yieldFrame } from './frame-yield.mjs';
import { streetPavement } from './street-pavement.mjs';
import { BoxBatch } from './box-batch.mjs';
import { directoryCourts, courtPlanting } from '../../shared/directory-courts.mjs';
import { directoryGreens } from '../../shared/directory-greens.mjs';
import { streetMarkings } from '../../shared/street-markings.mjs';
import { pavingFinish } from './paving-finish.mjs';
import { groundCover } from './ground-cover.mjs';
import * as T from 'three';
import { mergeTransformed } from './merge-transformed.mjs';
import { streamingGrove } from './vegetation.mjs';
import { insetPolygon } from '../../shared/street-surfaces.mjs';
import { asphalt } from './road-finish.mjs';
import { building } from '../../shared/model.mjs';
import type { PlannedLayout } from './planned-layout';
export function* streetBuildSteps(plan: PlannedLayout): Generator<void, T.Group, void> {
  let stage = process.env.NODE_ENV === 'production' ? 0 : performance.now();
  const measure = (name: string) => {
    if (process.env.NODE_ENV === 'production') return;
    const now = performance.now();
    console.debug(`[city-work] streets-${name}: ${(now - stage).toFixed(1)}ms`);
    stage = now;
  };
  function* checkpoint(): Generator<void, void, void> {
    const paused = process.env.NODE_ENV === 'production' ? 0 : performance.now();
    yield;
    if (process.env.NODE_ENV !== 'production') stage += performance.now() - paused;
  }
  const group = new T.Group(),
    parts: T.BufferGeometry[][] = Array.from({ length: 8 }, () => []);
  let complete = false;
  try {
    let work = 0;
    const boxes = Array.from({ length: 8 }, () => new BoxBatch());
    const box = (
      bucket: number,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
      rotation = 0,
    ) => {
      boxes[bucket].add(w, h, d, x, y, z, rotation);
    };
    type Point = { x: number; z: number };
    const surface = (bucket: number, outer: Point[], inner: Point[] | null, height: number) => {
      const shape = new T.Shape(outer.map((p) => new T.Vector2(p.x, -p.z)));
      if (inner) shape.holes.push(new T.Path(inner.map((p) => new T.Vector2(p.x, -p.z))));
      const geometry = new T.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, height, 0);
      parts[bucket].push(geometry);
    };
    for (const [bucket, geometry] of streetPavement(plan.graph)) parts[bucket].push(geometry);
    measure('pavement');
    yield* checkpoint();
    const markings = streetMarkings(plan.graph);
    for (const crossing of markings.crossings) {
      if (++work % 32 === 0) yield* checkpoint();
      for (
        let stripe = -crossing.halfWidth + 0.16;
        stripe <= crossing.halfWidth - 0.16;
        stripe += 0.26
      )
        box(
          2,
          0.15,
          0.006,
          0.55,
          crossing.x + Math.cos(crossing.angle) * stripe,
          0.115,
          crossing.z - Math.sin(crossing.angle) * stripe,
          crossing.angle,
        );
    }
    for (const dash of markings.dashes) {
      if (++work % 64 === 0) yield* checkpoint();
      box(2, 0.035, 0.012, 0.7, dash.x, 0.118, dash.z, dash.angle);
    }
    const fixtures = planFixtures(plan);
    for (const lamp of fixtures) {
      if (++work % 64 === 0) yield* checkpoint();
      // A planted base, slimmer upper shaft and shielded lantern replace the
      // glowing cube. Only the underside emits; the metal hood catches light.
      box(3, 0.12, 0.075, 0.12, lamp.x, 0.1775, lamp.z);
      box(3, 0.065, 0.65, 0.065, lamp.x, 0.54, lamp.z);
      box(3, 0.036, 1.61, 0.036, lamp.x, 1.665, lamp.z);
      box(3, 0.085, 0.05, 0.085, lamp.x, 2.47, lamp.z);
      box(3, 0.24, 0.065, 0.24, lamp.x, 2.515, lamp.z);
      box(4, 0.175, 0.012, 0.175, lamp.x, 2.477, lamp.z);
    }
    // Distant lamp pools keep the whole network readable without allocating a
    // point light per fixture. Nearby lamps still illuminate actual surfaces.
    const poolMaterial = new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      uniforms: { nightStrength: { value: 0 } },
      vertexShader: `varying vec2 poolUV;
      void main(){poolUV=uv;gl_Position=projectionMatrix*modelViewMatrix*instanceMatrix*vec4(position,1.);}`,
      fragmentShader: `uniform float nightStrength; varying vec2 poolUV;
      void main(){vec2 p=(poolUV-.5)*2.;float r=length(p);
        float falloff=pow(max(0.,1.-r*r),3.);
        gl_FragColor=vec4(vec3(.95,.72,.39),falloff*nightStrength*.16);
      }`,
    });
    const pools = new T.InstancedMesh(
      new T.PlaneGeometry(4.8, 4.8).rotateX(-Math.PI / 2),
      poolMaterial,
      fixtures.length,
    );
    const poolTransform = new T.Object3D();
    fixtures.forEach((lamp, index) => {
      poolTransform.position.set(lamp.x, 0.151, lamp.z);
      poolTransform.updateMatrix();
      pools.setMatrixAt(index, poolTransform.matrix);
    });
    pools.name = 'street-light-pools';
    pools.renderOrder = 1;
    group.add(pools);
    // Frontage paving bridges the entire facade to the sidewalk. Narrow side
    // strips and a rear service pad ground each footprint within its own plot.
    for (const lot of plan.parcels) {
      if (++work % 32 === 0) yield* checkpoint();
      const outward = { x: Math.sin(lot.rotation), z: Math.cos(lot.rotation) };
      const across = { x: Math.cos(lot.rotation), z: -Math.sin(lot.rotation) };
      const model = building(lot.file);
      const width = Math.min(lot.width, model.width + 0.16);
      const strip = Math.max(0, (width - model.width) / 2);
      box(0, width, 0.035, 0.3, lot.front.x, 0.1275, lot.front.z, lot.rotation);
      if (strip > 0.005)
        for (const side of [-1, 1]) {
          const offset = side * (model.width / 2 + strip / 2);
          box(
            0,
            strip,
            0.025,
            model.depth,
            lot.x + across.x * offset,
            0.1225,
            lot.z + across.z * offset,
            lot.rotation,
          );
        }
      const rear = Math.max(0, Math.min(0.45, lot.depth - model.depth));
      if (rear > 0.025)
        box(
          0,
          width,
          0.025,
          rear,
          lot.front.x - outward.x * (model.depth + rear / 2),
          0.1225,
          lot.front.z - outward.z * (model.depth + rear / 2),
          lot.rotation,
        );
    }
    // Courtyards have lawn, a shared garden path and modest furniture.

    const trees = [];
    for (const region of plan.regions) {
      yield* checkpoint();
      trees.push(...directoryGreens(region));
      for (const court of directoryCourts(region)) {
        surface(0, court.polygon, null, 0.145);
        const entryLength = Math.abs(court.entry.z - court.z);
        box(0, 1.15, 0.03, entryLength, court.entry.x, 0.13, (court.entry.z + court.z) / 2);
        const planting = courtPlanting(court);
        surface(6, planting.polygon, null, 0.164);
        for (let i = 0; i < planting.polygon.length; i++) {
          const a = planting.polygon[i],
            b = planting.polygon[(i + 1) % planting.polygon.length];
          const dx = b.x - a.x,
            dz = b.z - a.z;
          box(
            5,
            Math.hypot(dx, dz),
            0.12,
            0.07,
            (a.x + b.x) / 2,
            0.19,
            (a.z + b.z) / 2,
            Math.atan2(-dz, dx),
          );
        }
        trees.push(...planting.trees);
        for (const side of [-1, 1]) {
          box(7, 1.2, 0.065, 0.35, court.x + side * court.width * 0.24, 0.37, court.z + 2.05);
          for (const foot of [-0.45, 0.45])
            box(
              3,
              0.08,
              0.32,
              0.28,
              court.x + side * court.width * 0.24 + foot,
              0.18,
              court.z + 2.05,
            );
        }
      }
    }
    for (const block of plan.blocks) {
      if (++work % 16 === 0) yield* checkpoint();
      if (block.directory) continue;
      const garden = insetPolygon(block.polygon, 5.4);
      surface(6, garden, null, -0.045);
      const width = Math.max(1, block.width - 11),
        depth = Math.max(1, block.depth - 11);
      box(7, 0.65, 0.018, depth, block.center.x, -0.032, block.center.z);
      box(7, width, 0.018, 0.65, block.center.x, -0.032, block.center.z);
      for (const sign of [-1, 1]) {
        box(3, 0.11, 0.3, 0.11, block.center.x + sign * 0.47, 0.15, block.center.z + 1.7);
      }
      box(7, 1.15, 0.07, 0.32, block.center.x, 0.31, block.center.z + 1.7);
      for (const dx of [-1.8, 1.8])
        trees.push({
          x: block.center.x + dx,
          z: block.center.z,
          scale: 0.65,
          rotation: block.block * 0.8,
        });
    }
    // The civic block is public landscape, connected to all four sidewalks.
    // Its forecourt meets the existing hall apron, rather than becoming another
    // raised board underneath the building.
    const civicBlock = plan.streets.find((cell) => cell.column === 0 && cell.row === 0);
    if (civicBlock) {
      const garden = insetPolygon(civicBlock.polygon, 1.725);
      surface(6, garden, null, -0.045);
      const cx = plan.civic.x,
        cz = plan.civic.z;
      const path = (a: Point, b: Point, width: number, startHeight = 0.055, endHeight = 0.055) => {
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const nx = ((-(b.z - a.z) / length) * width) / 2;
        const nz = (((b.x - a.x) / length) * width) / 2;
        const geometry = new T.BufferGeometry();
        geometry.setAttribute(
          'position',
          new T.Float32BufferAttribute(
            [
              a.x + nx,
              startHeight,
              a.z + nz,
              a.x - nx,
              startHeight,
              a.z - nz,
              b.x + nx,
              endHeight,
              b.z + nz,
              b.x - nx,
              endHeight,
              b.z - nz,
            ],
            3,
          ),
        );
        geometry.setAttribute(
          'uv',
          new T.Float32BufferAttribute([0, 0, 1, 0, 0, length, 1, length], 2),
        );
        geometry.setIndex([0, 2, 1, 1, 2, 3]);
        geometry.computeVertexNormals();
        parts[0].push(geometry);
      };
      const front = { x: cx, z: cz - 5.8 },
        rear = { x: cx, z: cz + 5.5 };
      // A broad approach continues the hall's ten-unit forecourt. Side routes
      // leave space for planting and earned civic additions beside the building.
      path({ x: cx, z: cz - 4.8 }, front, 10);
      path(
        front,
        { x: (garden[0].x + garden[1].x) / 2, z: (garden[0].z + garden[1].z) / 2 },
        3,
        0.055,
        0.145,
      );
      path(
        rear,
        { x: (garden[2].x + garden[3].x) / 2, z: (garden[2].z + garden[3].z) / 2 },
        1.2,
        0.055,
        0.145,
      );
      for (const side of [-1, 1]) {
        const x = cx + side * 5.7;
        path(front, { x, z: front.z }, 1.2);
        path({ x, z: front.z }, { x, z: rear.z }, 1.2);
        path({ x, z: rear.z }, rear, 1.2);
        const edge = side < 0 ? [garden[3], garden[0]] : [garden[1], garden[2]];
        path(
          { x, z: cz + 3.5 },
          { x: (edge[0].x + edge[1].x) / 2, z: cz + 3.5 },
          1.2,
          0.055,
          0.145,
        );
        for (const dz of [-5.8, 5.5]) {
          trees.push({ x: cx + side * 7.25, z: cz + dz, scale: 0.9, rotation: side });
          const seatX = cx + side * 3.5,
            seatZ = cz + dz + 0.8;
          // A paved seating pocket joins the loop, rather than leaving a bench
          // marooned on grass. Seat height follows the 0.55-unit citizen scale.
          path({ x: seatX, z: cz + dz }, { x: seatX, z: seatZ + 0.25 }, 1.65);
          for (let slat = 0; slat < 5; slat++)
            box(7, 1.2, 0.026, 0.046, seatX, 0.225, seatZ - 0.13 + slat * 0.065);
          for (let slat = 0; slat < 3; slat++)
            box(7, 1.2, 0.046, 0.025, seatX, 0.31 + slat * 0.061, seatZ + 0.15);
          for (const dx of [-0.45, 0.45]) {
            box(3, 0.035, 0.16, 0.28, seatX + dx, 0.135, seatZ);
            box(3, 0.025, 0.28, 0.025, seatX + dx, 0.3, seatZ + 0.17);
            box(3, 0.025, 0.025, 0.31, seatX + dx, 0.32, seatZ);
            box(3, 0.025, 0.09, 0.025, seatX + dx, 0.275, seatZ - 0.13);
          }
        }
      }
    }
    measure('furniture');
    yield* checkpoint();
    group.add(streamingGrove(trees, 'courtyard-canopy'));
    measure('vegetation');
    yield* checkpoint();
    const colors = [
      '#9b9a90',
      '#303638',
      '#c8c9bc',
      '#424944',
      '#fff0c6',
      '#b5b3a7',
      '#66744c',
      '#a39882',
    ];
    for (const [i, geometries] of parts.entries()) {
      yield* checkpoint();
      const boxed = boxes[i].geometry();
      if (boxed) geometries.push(boxed);
      if (!geometries.length) continue;
      const material = new T.MeshStandardMaterial({ color: colors[i], roughness: 0.95 });
      if (i === 0) pavingFinish(material);
      if (i === 1) asphalt(material);
      if (i === 6) groundCover(material, true);
      if (i === 4) {
        material.userData.nightLamp = true;
        material.emissive.set('#ffc77e');
        material.emissiveIntensity = 1.5;
      }
      const mesh = new T.Mesh(
        mergeTransformed(geometries.map((geometry) => ({ geometry })))!,
        material,
      );
      geometries.forEach((g) => g.dispose());
      geometries.length = 0;
      mesh.receiveShadow = true;
      mesh.userData.streetCuttable = i === 0 || i === 2 || i === 5;
      group.add(mesh);
    }
    measure('merge');
    complete = true;
    return group;
  } finally {
    if (!complete) {
      for (const geometries of parts) for (const geometry of geometries) geometry.dispose();
      disposePreparedStreets(group);
    }
  }
}

export function disposePreparedStreets(group: T.Group) {
  group.traverse((object) => {
    if (object instanceof T.InstancedMesh) object.dispose();
    if (object instanceof T.Mesh) {
      object.geometry.dispose();
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      materials.forEach((material) => material.dispose());
    }
  });
}

export function plannedStreets(plan: PlannedLayout) {
  const steps = streetBuildSteps(plan);
  let step = steps.next();
  while (!step.done) step = steps.next();
  return step.value;
}

export async function preparePlannedStreets(
  plan: PlannedLayout,
  signal?: AbortSignal,
  canceled = () => false,
) {
  const steps = streetBuildSteps(plan);
  let completed = false;
  try {
    let started = performance.now();
    while (!signal?.aborted && !canceled()) {
      const step = steps.next();
      if (step.done) {
        completed = true;
        return step.value;
      }
      if (performance.now() - started >= 8) {
        await yieldFrame(signal);
        started = performance.now();
      }
    }
    return null;
  } finally {
    if (!completed) steps.return(undefined as never);
  }
}
