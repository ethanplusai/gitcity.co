/** Procedural audio: no network assets, and never starts before a user gesture. */
export class CityAudio {
  context: AudioContext | null = null;
  gain: GainNode | null = null;
  enabled = false;
  source: AudioBufferSourceNode | null = null;
  private footstepBuffer: AudioBuffer | null = null;
  private leftFoot = false;
  async toggle() {
    if (!this.context) {
      this.context = new AudioContext();
      this.gain = this.context.createGain();
      this.gain.gain.value = 0;
      this.gain.connect(this.context.destination);
      const buffer = this.context.createBuffer(
        1,
        this.context.sampleRate * 4,
        this.context.sampleRate,
      );
      const data = buffer.getChannelData(0);
      let previous = 0;
      for (let i = 0; i < data.length; i++) {
        previous = (previous + (Math.random() * 2 - 1) * 0.02) / 1.02;
        data[i] = previous * 3;
      }
      this.source = this.context.createBufferSource();
      this.source.buffer = buffer;
      this.source.loop = true;
      const filter = this.context.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 220;
      this.source.connect(filter).connect(this.gain);
      this.source.start();
    }
    await this.context.resume();
    this.enabled = !this.enabled;
    this.gain!.gain.setTargetAtTime(this.enabled ? 0.15 : 0, this.context.currentTime, 0.5);
    return this.enabled;
  }
  tone(frequency: number, duration = 0.2, volume = 0.04) {
    if (!this.enabled || !this.context || !this.gain) return;
    const c = this.context,
      o = c.createOscillator(),
      g = c.createGain();
    o.type = 'sine';
    o.frequency.value = frequency;
    g.gain.setValueAtTime(volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + duration);
    o.connect(g).connect(this.gain);
    o.start();
    o.stop(c.currentTime + duration);
  }
  commit() {
    this.tone(660, 0.7, 0.3);
    setTimeout(() => this.tone(990, 1, 0.2), 140);
  }
  step() {
    if (!this.enabled || !this.context || !this.gain) return;
    const context = this.context;
    if (!this.footstepBuffer) {
      this.footstepBuffer = context.createBuffer(
        1,
        Math.ceil(context.sampleRate * 0.16),
        context.sampleRate,
      );
      const samples = this.footstepBuffer.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
    }
    this.leftFoot = !this.leftFoot;
    const source = context.createBufferSource();
    source.buffer = this.footstepBuffer;
    source.playbackRate.value = this.leftFoot ? 0.96 : 1.04;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.leftFoot ? 900 : 780;
    const envelope = context.createGain();
    const now = context.currentTime;
    envelope.gain.setValueAtTime(0.001, now);
    envelope.gain.linearRampToValueAtTime(0.48, now + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.07, now + 0.045);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    source.connect(filter).connect(envelope).connect(this.gain);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
    source.start();
    source.stop(now + 0.17);
    this.tone(this.leftFoot ? 82 : 89, 0.065, 0.16);
  }
  construction() {
    this.tone(155, 0.13, 0.08);
  }
  dispose() {
    this.enabled = false;
    this.source?.stop();
    this.footstepBuffer = null;
    void this.context?.close();
  }
}
