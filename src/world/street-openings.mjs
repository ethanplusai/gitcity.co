import * as T from 'three';

// Subtract axis-aligned entrance rectangles from street finish triangles.
// Interpolate every attribute so clipping preserves paving UVs and curb normals.
export function cutStreetGeometry(geometry, openings) {
  const attributes = Object.entries(geometry.attributes);
  const positionOffset = attributes
    .slice(
      0,
      attributes.findIndex(([name]) => name === 'position'),
    )
    .reduce((n, [, a]) => n + a.itemSize, 0);
  const output = attributes.map(() => []);
  const index = geometry.index;
  const read = (i) =>
    attributes.flatMap(([, a]) =>
      Array.from({ length: a.itemSize }, (_, c) => a.array[i * a.itemSize + c]),
    );
  const split = (polygon, axis, boundary, sign) => {
    const inside = [],
      outside = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i],
        b = polygon[(i + 1) % polygon.length];
      const da = (a[positionOffset + axis] - boundary) * sign,
        db = (b[positionOffset + axis] - boundary) * sign;
      (da >= 0 ? inside : outside).push(a);
      if (da < 0 !== db < 0) {
        const t = da / (da - db),
          point = a.map((value, j) => value + (b[j] - value) * t);
        inside.push(point);
        outside.push(point);
      }
    }
    return { inside, outside };
  };
  const count = index ? index.count : geometry.attributes.position.count;
  for (let i = 0; i < count; i += 3) {
    let polygons = [[0, 1, 2].map((j) => read(index ? index.getX(i + j) : i + j))];
    for (const box of openings) {
      const remaining = [];
      for (let polygon of polygons) {
        for (const [axis, boundary, sign] of [
          [0, box.minX, 1],
          [0, box.maxX, -1],
          [2, box.minZ, 1],
          [2, box.maxZ, -1],
        ]) {
          const result = split(polygon, axis, boundary, sign);
          if (result.outside.length >= 3) remaining.push(result.outside);
          polygon = result.inside;
          if (polygon.length < 3) break;
        }
      }
      polygons = remaining;
    }
    for (const polygon of polygons)
      for (let j = 1; j < polygon.length - 1; j++) {
        for (const vertex of [polygon[0], polygon[j], polygon[j + 1]]) {
          let offset = 0;
          attributes.forEach(([, a], k) => {
            output[k].push(...vertex.slice(offset, offset + a.itemSize));
            offset += a.itemSize;
          });
        }
      }
  }
  const result = new T.BufferGeometry();
  attributes.forEach(([name, a], i) =>
    result.setAttribute(name, new T.Float32BufferAttribute(output[i], a.itemSize)),
  );
  return result;
}

const appliedOpenings = new WeakMap();
export function applyStreetOpenings(group, openings) {
  const signature = JSON.stringify(openings);
  for (const mesh of group.children) {
    if (!mesh.userData.streetCuttable) continue;
    const previous = appliedOpenings.get(mesh);
    if (previous?.signature === signature && previous.geometry === mesh.geometry) continue;
    const original = mesh.userData.uncutStreetGeometry || mesh.geometry;
    mesh.userData.uncutStreetGeometry = original;
    if (mesh.geometry !== original) mesh.geometry.dispose();
    mesh.geometry = openings.length ? cutStreetGeometry(original, openings) : original;
    if (mesh.geometry !== original) original.dispose();
    appliedOpenings.set(mesh, { signature, geometry: mesh.geometry });
  }
}
