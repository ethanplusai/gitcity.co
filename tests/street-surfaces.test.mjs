import test from 'node:test';
import assert from 'node:assert/strict';
import { cityCell, streetGraph } from '../shared/city-plan.mjs';
import {
  insetPolygon,
  insetPolygonEdges,
  streetWidths,
  polygonArea,
  streetBoundaryLoops,
} from '../shared/street-surfaces.mjs';
import { plannedLayout } from '../src/world/planned-layout.ts';
import { plannedStreets } from '../src/world/planned-streets.ts';
import { Box3 } from 'three';

test('street boundaries enclose precisely the adjoining blocks, including stepped T junctions', () => {
  for (const owner of ['vercel', 'facebook', 'demo'])
    for (const coordinates of [
      [[0, 0]],
      [
        [0, 0],
        [1, 0],
        [0, 1],
      ],
      [
        [0, 0],
        [1, 0],
        [2, 0],
        [2, 1],
        [2, 2],
      ],
    ]) {
      const cells = coordinates.map(([x, z]) => cityCell(owner, x, z)),
        graph = streetGraph(cells),
        loops = streetBoundaryLoops(cells, graph);
      assert.ok(
        Math.abs(
          loops.reduce((sum, p) => sum + polygonArea(p), 0) -
            cells.reduce((sum, c) => sum + polygonArea(c.polygon), 0),
        ) < 1e-6,
      );
      for (const loop of loops) {
        const outer = insetPolygon(loop, -1.725);
        assert.ok(outer.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)));
        assert.ok(polygonArea(outer) > polygonArea(loop));
      }
      for (const cell of cells)
        assert.ok(polygonArea(insetPolygon(cell.polygon, 1.725)) < polygonArea(cell.polygon));
    }
});

test('joined street surfaces triangulate to the intended pavement area and use bounded material batches', () => {
  const plan = plannedLayout({
    id: 'demo/one',
    coordinates: { x: 0, z: 0 },
    files: Array.from({ length: 32 }, (_, i) => ({ path: `src/${i}.ts` })),
  });
  const streets = plannedStreets(plan);
  const asphalt = streets.children.find((o) =>
    o.material?.customProgramCacheKey?.().startsWith('asphalt-aggregate-'),
  );
  assert.ok(asphalt);
  const geometry = asphalt.geometry,
    positions = geometry.attributes.position,
    indices = geometry.index;
  let area = 0;
  for (let i = 0; i < indices.count; i += 3) {
    const a = indices.getX(i),
      b = indices.getX(i + 1),
      c = indices.getX(i + 2);
    area +=
      Math.abs(
        (positions.getX(b) - positions.getX(a)) * (positions.getZ(c) - positions.getZ(a)) -
          (positions.getZ(b) - positions.getZ(a)) * (positions.getX(c) - positions.getX(a)),
      ) / 2;
  }
  const expected =
    streetBoundaryLoops(plan.streets, plan.graph).reduce(
      (sum, p) =>
        sum +
        polygonArea(
          insetPolygonEdges(
            p,
            streetWidths(p, plan.graph).map((w) => -w),
          ),
        ),
      0,
    ) -
    plan.streets.reduce(
      (sum, c) =>
        sum + polygonArea(insetPolygonEdges(c.polygon, streetWidths(c.polygon, plan.graph))),
      0,
    );
  assert.ok(Math.abs(area - expected) < 0.005, `area ${area} expected ${expected}`);
  assert.ok(streets.children.length <= 10);
  const pools = streets.getObjectByName('street-light-pools');
  assert.equal(pools.count, plan.lamps.length + 4, 'road lamps plus four civic loop lamps');
  assert.equal(pools.material.depthWrite, false);
  assert.equal(pools.material.uniforms.nightStrength.value, 0);
  const bounds = new Box3().setFromObject(streets);
  assert.ok(Number.isFinite(bounds.max.x));
  streets.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});

test('street hierarchy is shared across adjacent blocks and survives coordinate rebasing', () => {
  const cells = [-1, 0, 1].flatMap((row) =>
    [-1, 0, 1].map((column) => cityCell('vercel', column, row)),
  );
  const graph = streetGraph(cells);
  assert.deepEqual(
    new Set(graph.edges.map((e) => e.kind)),
    new Set(['avenue', 'collector', 'local']),
  );
  const shifted = cells.map((c) => ({
    ...c,
    polygon: c.polygon.map((p) => ({ x: p.x + 137, z: p.z - 81 })),
  }));
  const rebased = streetGraph(shifted);
  assert.deepEqual(
    graph.edges.map((e) => [e.kind, e.halfWidth]),
    rebased.edges.map((e) => [e.kind, e.halfWidth]),
  );
  for (const c of cells) {
    const widths = streetWidths(c.polygon, graph);
    assert.ok(widths.every((w) => w >= 0.7 && w <= 0.95));
    const curb = insetPolygonEdges(c.polygon, widths);
    assert.ok(curb.every((p) => Number.isFinite(p.x) && Number.isFinite(p.z)));
    assert.ok(polygonArea(curb) < polygonArea(c.polygon));
  }
});

test('different street widths meet at exact corner intersections', () => {
  const square = [
    { x: 0, z: 0 },
    { x: 20, z: 0 },
    { x: 20, z: 20 },
    { x: 0, z: 20 },
  ];
  assert.deepEqual(insetPolygonEdges(square, [0.95, 0.7, 0.7, 0.85]), [
    { x: 0.85, z: 0.95 },
    { x: 19.3, z: 0.95 },
    { x: 19.3, z: 19.3 },
    { x: 0.85, z: 19.3 },
  ]);
});

test('sparse neighborhood connections retain frontage and render continuous pavement without unused road loops', async () => {
  const { connectedCityCells, connectedStreetGraph } = await import('../shared/city-plan.mjs');
  const developed = [cityCell('demo', 0, 0), cityCell('demo', 4, 2), cityCell('demo', -3, 1)];
  const cells = connectedCityCells('demo', developed);
  const full = streetGraph(cells),
    graph = connectedStreetGraph(cells, developed);
  assert.ok(graph.edges.length < full.edges.length * 0.85);
  const translate = (p) => ({ x: p.x + 137, z: p.z - 81 });
  const rebased = connectedStreetGraph(
    cells.map((c) => ({ ...c, polygon: c.polygon.map(translate) })),
    developed.map((c) => ({ ...c, polygon: c.polygon.map(translate) })),
  );
  assert.deepEqual(
    graph.edges.map((e) => [Number(e.length.toFixed(5)), e.connector]),
    rebased.edges.map((e) => [Number(e.length.toFixed(5)), e.connector]),
  );
  const plan = plannedLayout({ id: 'demo/one', files: [{ path: 'a.ts' }] });
  const rendered = plannedStreets({
    ...plan,
    graph,
    streets: cells,
    blocks: [],
    parcels: [],
    lamps: [],
  });
  const pavement = rendered.children.find((o) =>
    o.material?.customProgramCacheKey?.().startsWith('asphalt-aggregate-'),
  ).geometry;
  const positions = pavement.attributes.position,
    indices = pavement.index;
  const covered = (p) => {
    for (let i = 0; i < indices.count; i += 3) {
      const triangle = [0, 1, 2].map((j) => {
        const n = indices.getX(i + j);
        return { x: positions.getX(n), z: positions.getZ(n) };
      });
      const signs = triangle.map((a, j) => {
        const b = triangle[(j + 1) % 3];
        return (b.x - a.x) * (p.z - a.z) - (b.z - a.z) * (p.x - a.x);
      });
      if (signs.every((s) => s >= -1e-5) || signs.every((s) => s <= 1e-5)) return true;
    }
    return false;
  };
  const nodes = new Map(full.nodes.map((n) => [n.id, n]));
  for (const edge of graph.edges) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    for (const t of [0, 0.25, 0.5, 0.75, 1])
      assert.ok(
        covered({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t }),
        `unpaved route ${edge.id} at ${t}`,
      );
  }
  const kept = new Set(graph.edges.map((e) => e.id));
  for (const edge of full.edges.filter((e) => !kept.has(e.id) && e.length > 4)) {
    const a = nodes.get(edge.from),
      b = nodes.get(edge.to);
    assert.ok(
      !covered({ x: (a.x + b.x) / 2, z: (a.z + b.z) / 2 }),
      'removed road must return to landscape',
    );
  }
  rendered.traverse((o) => {
    o.geometry?.dispose();
    o.material?.dispose();
  });
});

test('kerb bevels have upward sloping faces inside the existing sidewalk height range', async () => {
  const { buildStreetPavement } = await import('../src/world/street-pavement.mjs');
  for (const owner of ['vercel', 'facebook', 'demo']) {
    const cells = [
      [0, 0],
      [1, 0],
      [1, 1],
    ].map(([x, z]) => cityCell(owner, x, z));
    const parts = buildStreetPavement(streetGraph(cells));
    try {
      const kerb = parts.find(([bucket]) => bucket === 5)[1];
      const p = kerb.attributes.position,
        n = kerb.attributes.normal;
      let slopes = 0;
      for (let i = 0; i < p.count; i++) {
        assert.ok(p.getY(i) >= 0.11 - 1e-7 && p.getY(i) <= 0.145 + 1e-7);
        assert.ok(
          Number.isFinite(n.getX(i)) && Number.isFinite(n.getY(i)) && Number.isFinite(n.getZ(i)),
        );
        if (n.getY(i) > 0.05 && n.getY(i) < 0.95) slopes++;
      }
      assert.ok(slopes > 24, 'joined junction kerbs retain light-catching sloped faces');
    } finally {
      for (const [, geometry] of parts) geometry.dispose();
    }
  }
});
