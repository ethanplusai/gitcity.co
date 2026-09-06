// Resume after the next rendering opportunity. A timer also releases hidden
// tabs, where animation frames may stop, and abort settles immediately.
export function yieldFrame(signal) {
  if (signal?.aborted) return Promise.resolve(false);
  return new Promise((resolve) => {
    let frame = 0,
      afterFrame = 0,
      settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      clearTimeout(fallback);
      clearTimeout(afterFrame);
      if (frame) cancelAnimationFrame(frame);
      signal?.removeEventListener('abort', finish);
      resolve(!signal?.aborted);
    };
    const fallback = setTimeout(finish, 50);
    signal?.addEventListener('abort', finish, { once: true });
    frame = requestAnimationFrame(() => {
      afterFrame = setTimeout(finish, 0);
    });
  });
}
