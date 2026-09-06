// Keep the explored city legible at every altitude. Exponential fog still
// thickens beyond the focus, but orbit distance must not wash out that focus.
export function atmosphereDensity(focusDistance, storm = false) {
  const distance = Math.max(1, Number.isFinite(focusDistance) ? focusDistance : 1);
  return Math.min(storm ? 0.003 : 0.0012, (storm ? 0.45 : 0.22) / distance);
}
