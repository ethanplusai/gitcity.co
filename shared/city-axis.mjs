import { hash } from './model.mjs';

// Exact prefix sums preserve permanent city coordinates. Retained storage is
// bounded to 64 * 1025 doubles (about 513 KiB), plus map keys/entry metadata.
export class CityAxisCache {
  constructor(maxEntries = 64, maxIndex = 1024) {
    this.maxEntries = maxEntries;
    this.maxIndex = maxIndex;
    this.entries = new Map();
  }
  get(index, seed, minimum, variation) {
    if (index === 0) return 0;
    const negative = index < 0;
    const count = Math.ceil(Math.abs(index));
    const key = JSON.stringify([seed, minimum, variation, negative]);
    let entry = this.entries.get(key);
    if (entry) this.entries.delete(key);
    else {
      entry = { values: new Float64Array(this.maxIndex + 1), count: 0 };
      if (this.entries.size >= this.maxEntries)
        this.entries.delete(this.entries.keys().next().value);
    }
    this.entries.set(key, entry);
    const retained = Math.min(count, this.maxIndex);
    for (let i = entry.count; i < retained; i++)
      entry.values[i + 1] =
        entry.values[i] + minimum + (hash(`${seed}:${negative ? -i - 1 : i}`) % variation);
    entry.count = Math.max(entry.count, retained);
    let value = entry.values[retained];
    // Remote coordinates remain supported without expanding retained storage.
    for (let i = retained; i < count; i++)
      value += minimum + (hash(`${seed}:${negative ? -i - 1 : i}`) % variation);
    return negative ? -value : value;
  }
}
