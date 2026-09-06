// Static bounds tree for exact nearest-street and overlap queries. Original
// edge ordinals break distance ties, preserving deterministic route choices.
export class SegmentIndex {
  constructor(graph, nodes) {
    this.root = this.build(
      graph.edges.map((edge, order) => {
        const a = nodes.get(edge.from),
          b = nodes.get(edge.to);
        return {
          edge,
          order,
          a,
          b,
          centerX: a.x + b.x,
          centerZ: a.z + b.z,
          minX: Math.min(a.x, b.x),
          maxX: Math.max(a.x, b.x),
          minZ: Math.min(a.z, b.z),
          maxZ: Math.max(a.z, b.z),
        };
      }),
    );
  }
  build(items, start = 0, end = items.length) {
    if (start === end) return null;
    const node = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
    for (let i = start; i < end; i++) {
      const item = items[i];
      node.minX = Math.min(node.minX, item.minX);
      node.maxX = Math.max(node.maxX, item.maxX);
      node.minZ = Math.min(node.minZ, item.minZ);
      node.maxZ = Math.max(node.maxZ, item.maxZ);
    }
    if (end - start <= 8) return { ...node, items: items.slice(start, end) };
    const axis = node.maxX - node.minX >= node.maxZ - node.minZ ? 'centerX' : 'centerZ';
    const compare = (a, b) => a[axis] - b[axis] || a.order - b.order;
    const middle = Math.floor((start + end) / 2);
    // Select the median without sorting/copying each subtree. Only leaf arrays
    // survive construction; the graph's original edge array is never reordered.
    let left = start,
      right = end - 1;
    while (left < right) {
      const pivot = items[Math.floor((left + right) / 2)];
      let low = left,
        high = right;
      while (low <= high) {
        while (compare(items[low], pivot) < 0) low++;
        while (compare(items[high], pivot) > 0) high--;
        if (low <= high) {
          const item = items[low];
          items[low++] = items[high];
          items[high--] = item;
        }
      }
      if (middle <= high) right = high;
      else if (middle >= low) left = low;
      else break;
    }
    return {
      ...node,
      left: this.build(items, start, middle),
      right: this.build(items, middle, end),
    };
  }
  nearest(p) {
    let best = null,
      order = Infinity;
    const gapTo = (n) =>
      Math.hypot(Math.max(n.minX - p.x, 0, p.x - n.maxX), Math.max(n.minZ - p.z, 0, p.z - n.maxZ));
    const visit = (node) => {
      if (!node || (best && gapTo(node) > best.gap + 1e-10)) return;
      if (node.items) {
        for (const item of node.items) {
          const { a, b, edge } = item,
            dx = b.x - a.x,
            dz = b.z - a.z;
          const t = Math.max(
            0,
            Math.min(1, ((p.x - a.x) * dx + (p.z - a.z) * dz) / (dx * dx + dz * dz)),
          );
          const point = { x: a.x + dx * t, z: a.z + dz * t },
            gap = Math.hypot(p.x - point.x, p.z - point.z);
          if (!best || gap < best.gap || (gap === best.gap && item.order < order)) {
            best = { edge, point, gap };
            order = item.order;
          }
        }
      } else {
        const first = gapTo(node.left) <= gapTo(node.right) ? node.left : node.right;
        visit(first);
        visit(first === node.left ? node.right : node.left);
      }
    };
    visit(this.root);
    return best;
  }
  overlaps(minX, minZ, maxX, maxZ) {
    const found = [];
    const intersects = (n) => n.maxX >= minX && n.minX <= maxX && n.maxZ >= minZ && n.minZ <= maxZ;
    const visit = (node) => {
      if (!node || !intersects(node)) return;
      if (node.items) {
        for (const item of node.items) if (intersects(item)) found.push(item);
      } else {
        visit(node.left);
        visit(node.right);
      }
    };
    visit(this.root);
    return found.sort((a, b) => a.order - b.order).map((item) => item.edge);
  }
}
