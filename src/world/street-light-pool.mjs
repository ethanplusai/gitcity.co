const key = (point) => `${point.x},${point.y},${point.z}`;
export class StreetLightPool {
  constructor(count = 4) {
    /** @type {{position: {x:number,y:number,z:number}|null, target: {x:number,y:number,z:number}|null, weight:number}[]} */
    this.slots = Array.from({ length: count }, () => ({ position: null, target: null, weight: 0 }));
  }
  select(points, camera) {
    const retained = new Set(this.slots.flatMap((slot) => (slot.target ? [key(slot.target)] : [])));
    const selected = [],
      seen = new Set();
    for (const point of points) {
      const id = key(point);
      if (seen.has(id)) continue;
      seen.add(id);
      const score =
        ((point.x - camera.x) ** 2 + (point.y - camera.y) ** 2 + (point.z - camera.z) ** 2) *
        (retained.has(id) ? 0.8 : 1);
      const index = selected.findIndex(
        (other) => score < other.score || (score === other.score && id.localeCompare(other.id) < 0),
      );
      const rank = index < 0 ? selected.length : index;
      if (rank >= this.slots.length) continue;
      selected.splice(rank, 0, { id, score, point });
      if (selected.length > this.slots.length) selected.pop();
    }
    const wanted = new Map(selected.map(({ id, point }) => [id, point]));
    const vacant = [];
    for (const slot of this.slots) {
      if (slot.target && wanted.has(key(slot.target))) wanted.delete(key(slot.target));
      else vacant.push(slot);
    }
    const pending = [...wanted.values()];
    for (const slot of vacant) slot.target = pending.shift() || null;
  }
  update(dt) {
    const step = Math.max(0, Math.min(dt, 0.1)) * 4;
    for (const slot of this.slots) {
      const same = slot.position && slot.target && key(slot.position) === key(slot.target);
      if (!same) {
        slot.weight = Math.max(0, slot.weight - step);
        if (slot.weight === 0) slot.position = slot.target ? { ...slot.target } : null;
      } else slot.weight = Math.min(1, slot.weight + step);
    }
    return this.slots;
  }
}
