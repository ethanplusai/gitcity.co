// Popular, maintained source repositories make useful entrances. This only
// selects the camera destination; it never changes geometry or world addresses.
export function cityArrivalOrder(cities) {
  const ranked = [...cities].sort(
    (a, b) =>
      Number(Boolean(a.archived)) - Number(Boolean(b.archived)) ||
      Number(Boolean(a.fork)) - Number(Boolean(b.fork)) ||
      (b.stars || 0) - (a.stars || 0),
  );
  const first = ranked[0];
  if (!first) return ranked;
  return [
    first,
    ...ranked
      .slice(1)
      .sort(
        (a, b) =>
          Math.hypot(a.x - first.x, a.z - first.z) - Math.hypot(b.x - first.x, b.z - first.z),
      ),
  ];
}
