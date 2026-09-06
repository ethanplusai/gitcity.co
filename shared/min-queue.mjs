// Stable minimum-cost queue. Equal-cost entries retain insertion order.
export class MinQueue {
  entries = [];
  sequence = 0;
  get size() {
    return this.entries.length;
  }
  before(a, b) {
    return a.cost < b.cost || (a.cost === b.cost && a.order < b.order);
  }
  push(id, cost) {
    const entry = { id, cost, order: this.sequence++ };
    let index = this.entries.length;
    this.entries.push(entry);
    while (index > 0) {
      const parent = (index - 1) >> 1;
      if (!this.before(entry, this.entries[parent])) break;
      this.entries[index] = this.entries[parent];
      index = parent;
    }
    this.entries[index] = entry;
  }
  pop() {
    const first = this.entries[0],
      last = this.entries.pop();
    if (this.entries.length) {
      let index = 0;
      while (index * 2 + 1 < this.entries.length) {
        let child = index * 2 + 1;
        if (
          child + 1 < this.entries.length &&
          this.before(this.entries[child + 1], this.entries[child])
        )
          child++;
        if (!this.before(this.entries[child], last)) break;
        this.entries[index] = this.entries[child];
        index = child;
      }
      this.entries[index] = last;
    }
    return first;
  }
}
