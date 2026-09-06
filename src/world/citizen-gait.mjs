// One cycle spans a two-step stride. Distance, not wall-clock time, drives feet.
export function citizenGait(state, position, moving, dt, paused, reduced) {
  const distance = state.position
    ? Math.hypot(position.x - state.position.x, position.z - state.position.z)
    : 0;
  state.position = { x: position.x, z: position.z };
  state.idlePhase ??= state.phase;
  if (reduced) {
    state.weight = 0;
  } else if (!paused) {
    state.idlePhase = (state.idlePhase + Math.max(0, dt) / (25 / 6)) % 1;
    // Network restoration and teleportation must not spin the gait forward.
    if (moving && dt > 0 && distance < 1) state.phase = (state.phase + distance / 0.36) % 1;
    const target = moving && distance > 0.00001 ? 1 : 0;
    state.weight += (target - state.weight) * (1 - Math.exp(-Math.max(0, dt) * 12));
    if (state.weight < 0.001) state.weight = 0;
  }
  const phase = state.phase * 8,
    frame = Math.floor(phase),
    blend = phase - frame;
  const idle = reduced ? 0 : state.idlePhase * 3,
    idleFrame = Math.floor(idle),
    idleBlend = idle - idleFrame;
  const idleWeights = [0, 0, 0];
  idleWeights[idleFrame] = (1 - idleBlend) * (1 - state.weight);
  idleWeights[(idleFrame + 1) % 3] = idleBlend * (1 - state.weight);
  return {
    idleFirst: idleWeights[1],
    idleSecond: idleWeights[2],
    frame,
    next: (frame + 1) % 8,
    first: (1 - blend) * state.weight,
    second: blend * state.weight,
  };
}
