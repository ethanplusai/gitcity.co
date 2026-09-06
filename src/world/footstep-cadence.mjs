// Accumulate accepted movement only: blocked input and camera flights are silent.
export class FootstepCadence {
  distance = 0;
  advance(distance, scale = 1) {
    const traveled = distance / Math.max(0.0001, scale);
    if (!Number.isFinite(traveled) || traveled <= 0) return false;
    // Never turn a teleport or restoration into a burst of steps.
    if (traveled > 2) {
      this.distance = 0;
      return false;
    }
    this.distance += traveled;
    if (this.distance < 1.65) return false;
    this.distance %= 1.65;
    return true;
  }
}

export function walkingLookBlend(seconds) {
  return 1 - Math.exp(-Math.max(0, seconds) * 8);
}
