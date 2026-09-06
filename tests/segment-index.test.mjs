import test from 'node:test';
import assert from 'node:assert/strict';
import { SegmentIndex } from '../shared/segment-index.mjs';

test('street bounds index matches exhaustive projection, ties and bounds queries', () => {
  const nodes = new Map(),
    edges = [];
  for (let i = 0; i < 240; i++) {
    nodes.set(i * 2, { x: Math.sin(i * 3) * 700, z: Math.cos(i * 7) * 800 });
    nodes.set(i * 2 + 1, {
      x: Math.sin(i * 3) * 700 + (i % 13) + 1,
      z: Math.cos(i * 7) * 800 + (i % 17),
    });
    edges.push({ from: i * 2, to: i * 2 + 1 });
  }
  edges.push({ ...edges[0] });
  const index = new SegmentIndex({ edges }, nodes);
  for (let i = 0; i < 500; i++) {
    const p = i === 0 ? nodes.get(0) : { x: Math.sin(i) * 2000, z: Math.cos(i * 5) * 1900 };
    let best = null;
    for (const edge of edges) {
      const a = nodes.get(edge.from),
        b = nodes.get(edge.to),
        dx = b.x - a.x,
        dz = b.z - a.z;
      const t = Math.max(
        0,
        Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
      );
      const point = { x: a.x + dx * t, z: a.z + dz * t },
        gap = Math.hypot(p.x - point.x, p.z - point.z);
      if (!best || gap < best.gap) best = { edge, point, gap };
    }
    assert.deepEqual(index.nearest(p), best);
    assert.equal(index.nearest(p).edge, best.edge);
    const expected = edges.filter((e) => {
      const a = nodes.get(e.from),
        b = nodes.get(e.to);
      return (
        Math.max(a.x, b.x) >= p.x - 50 &&
        Math.min(a.x, b.x) <= p.x + 50 &&
        Math.max(a.z, b.z) >= p.z - 50 &&
        Math.min(a.z, b.z) <= p.z + 50
      );
    });
    assert.deepEqual(index.overlaps(p.x - 50, p.z - 50, p.x + 50, p.z + 50), expected);
  }
  assert.equal(new SegmentIndex({ edges: [] }, new Map()).nearest({ x: 0, z: 0 }), null);
});

test('median partitions retain every edge and original ties for sorted and coincident inputs', () => {
  for (const coincident of [false, true]) {
    const nodes = new Map(),
      edges = [];
    for (let i = 0; i < 4096; i++) {
      const x = coincident ? 0 : 4096 - i;
      nodes.set(i * 2, { x, z: 0 });
      nodes.set(i * 2 + 1, { x: x + 1, z: 1 });
      edges.push({ from: i * 2, to: i * 2 + 1 });
    }
    const original = [...edges],
      index = new SegmentIndex({ edges }, nodes),
      orders = [];
    const visit = (node, depth = 0) => {
      assert.ok(depth <= 10);
      if (node.items) {
        assert.ok(node.items.length <= 8);
        orders.push(...node.items.map((item) => item.order));
      } else {
        visit(node.left, depth + 1);
        visit(node.right, depth + 1);
      }
    };
    visit(index.root);
    assert.deepEqual(
      orders.sort((a, b) => a - b),
      edges.map((_, i) => i),
    );
    assert.deepEqual(edges, original);
    assert.deepEqual(index.overlaps(-1, -1, 5000, 2), edges);
    if (coincident) assert.equal(index.nearest({ x: 0.5, z: 0.5 }).edge, edges[0]);
  }
});
