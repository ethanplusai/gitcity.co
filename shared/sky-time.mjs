const clamp = (v) => Math.max(0, Math.min(1, v));
const smooth = (a, b, v) => {
  const t = clamp((v - a) / (b - a));
  return t * t * (3 - 2 * t);
};
// Browser-local civil time, including daylight saving. This is an artistic clock cycle,
// not a claim about astronomical sunrise (which would require a location).
export function localSky(date = new Date()) {
  const hour = date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600;
  const elevation = Math.sin(((hour - 6.5) / 13) * Math.PI);
  const daylight = smooth(-0.18, 0.22, elevation);
  return {
    hour,
    elevation,
    daylight,
    night: 1 - daylight,
    phase: daylight < 0.1 ? 'Night' : daylight < 0.85 ? (hour < 12 ? 'Dawn' : 'Dusk') : 'Day',
  };
}
