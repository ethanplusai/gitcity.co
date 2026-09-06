// Frame history controls presentation only; source geometry and addresses are unchanged.
export class AdaptiveQuality {
  economical = false;
  ready = false;
  slow = 0;
  fast = 0;
  recover = 0;
  retryAt = 0;
  observe(seconds, time) {
    if (!Number.isFinite(seconds) || seconds <= 0 || !Number.isFinite(time)) return false;
    const previous = this.economical;
    if (time > 2 && seconds > 0.029) this.slow += Math.min(seconds, 0.5);
    else this.slow = Math.max(0, this.slow - seconds * 2);
    this.fast = seconds < 0.025 ? this.fast + seconds : 0;
    if (this.fast > 2) this.ready = true;
    if (!this.economical && this.slow > 2) {
      this.economical = true;
      this.retryAt = time + 30;
      this.recover = 0;
      this.slow = 0;
    } else if (this.economical) {
      // Require headroom, not merely the absence of very slow frames. A long
      // suspended-tab interval never counts as time spent rendering smoothly.
      this.recover = seconds < 0.021 ? this.recover + seconds : 0;
      if (time >= this.retryAt && this.recover >= 8) {
        this.economical = false;
        this.slow = 0;
        this.recover = 0;
      }
    }
    return previous !== this.economical;
  }
}
