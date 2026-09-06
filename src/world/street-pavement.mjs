import * as T from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { polygonArea, streetContours } from '../../shared/street-surfaces.mjs';

export function buildStreetPavement(graph) {
  const parts = new Map([
    [0, []],
    [1, []],
    [5, []],
  ]);
  const surface = (bucket, outer, inner, height) => {
    const shape = new T.Shape(outer.map((p) => new T.Vector2(p.x, -p.z)));
    for (const hole of inner)
      shape.holes.push(new T.Path(hole.map((p) => new T.Vector2(p.x, -p.z))));
    parts
      .get(bucket)
      .push(new T.ShapeGeometry(shape).rotateX(-Math.PI / 2).translate(0, height, 0));
  };
  const ring = (bucket, a, b, height) =>
    Math.abs(polygonArea(a)) > Math.abs(polygonArea(b))
      ? surface(bucket, a, [b], height)
      : surface(bucket, b, [a], height);
  const roads = streetContours(graph),
    bevels = streetContours(graph, 0.012),
    kerbs = streetContours(graph, 0.075),
    walks = streetContours(graph, 0, 1.725);
  for (const outer of roads.filter((c) => !c.interior))
    surface(
      1,
      outer.points,
      roads.filter((c) => c.interior).map((c) => c.points),
      0.11,
    );
  roads.forEach((road, i) => {
    const bevel = bevels[i].points.length === road.points.length ? bevels[i].points : null;
    const faceTop = bevel ? 0.13 : 0.145;
    for (let j = 0; j < road.points.length; j++) {
      const a = road.points[j],
        b = road.points[(j + 1) % road.points.length];
      const geometry = new T.BufferGeometry();
      geometry.setAttribute(
        'position',
        new T.Float32BufferAttribute(
          [a.x, 0.11, a.z, b.x, 0.11, b.z, a.x, faceTop, a.z, b.x, faceTop, b.z],
          3,
        ),
      );
      geometry.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
      geometry.setIndex([0, 2, 1, 1, 2, 3]);
      geometry.computeVertexNormals();
      parts.get(5).push(geometry);
      if (bevel) {
        const c = bevel[j],
          d = bevel[(j + 1) % bevel.length];
        const chamfer = new T.BufferGeometry();
        chamfer.setAttribute(
          'position',
          new T.Float32BufferAttribute(
            [a.x, faceTop, a.z, b.x, faceTop, b.z, c.x, 0.145, c.z, d.x, 0.145, d.z],
            3,
          ),
        );
        chamfer.setAttribute('uv', new T.Float32BufferAttribute([0, 0, 1, 0, 0, 1, 1, 1], 2));
        chamfer.setIndex([0, 2, 1, 1, 2, 3]);
        chamfer.computeVertexNormals();
        parts.get(5).push(chamfer);
      }
    }
    ring(5, bevel || road.points, kerbs[i].points, 0.145);
    ring(0, kerbs[i].points, walks[i].points, 0.145);
  });
  const merged = [];
  for (const [bucket, pieces] of parts) {
    if (!pieces.length) continue;
    merged.push([bucket, mergeGeometries(pieces)]);
    for (const geometry of pieces) geometry.dispose();
  }
  return merged;
}

export function pavementKey(graph) {
  return JSON.stringify([
    graph.nodes.map((n) => [n.id, n.x, n.z]),
    graph.edges.map((e) => [e.from, e.to, e.halfWidth]),
  ]);
}

// CPU-only templates. Callers receive owned clones so renderer disposal and
// highway opening edits cannot corrupt another city's cached pavement.
export class StreetPavementCache {
  constructor(maxBytes = 16 * 1024 * 1024, maxEntries = 3) {
    this.maxBytes = maxBytes;
    this.maxEntries = maxEntries;
    this.bytes = 0;
    this.entries = new Map();
  }
  get(graph) {
    const key = pavementKey(graph);
    const old = this.entries.get(key);
    if (old) {
      this.entries.delete(key);
      this.entries.set(key, old);
      return old.parts.map(([bucket, geometry]) => [bucket, geometry.clone()]);
    }
    const parts = buildStreetPavement(graph);
    if (!this.prime(graph, parts)) return parts;
    return parts.map(([bucket, geometry]) => [bucket, geometry.clone()]);
  }
  has(graph) {
    return this.entries.has(pavementKey(graph));
  }
  prime(graph, parts) {
    const key = pavementKey(graph);
    if (this.entries.has(key)) {
      for (const [, geometry] of parts) geometry.dispose();
      return true;
    }
    const bytes =
      key.length * 2 +
      parts.reduce(
        (sum, [, g]) =>
          sum +
          g.index.array.byteLength +
          Object.values(g.attributes).reduce((n, a) => n + a.array.byteLength, 0),
        0,
      );
    if (bytes > this.maxBytes || this.maxEntries < 1) return false;
    while (this.bytes + bytes > this.maxBytes || this.entries.size >= this.maxEntries) {
      const oldest = this.entries.keys().next().value;
      const entry = this.entries.get(oldest);
      for (const [, geometry] of entry.parts) geometry.dispose();
      this.bytes -= entry.bytes;
      this.entries.delete(oldest);
    }
    this.entries.set(key, { parts, bytes });
    this.bytes += bytes;
    return true;
  }
}
export const pavement = new StreetPavementCache();
/** @returns {Array<[number, T.BufferGeometry]>} */
export function streetPavement(graph) {
  return pavement.get(graph);
}
