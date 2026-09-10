// Bound network and renderer work, but never leave the directory's tail unbuilt.
// Each completed city is published immediately; a slow neighbor cannot hold it up.
export async function progressiveCities(
  cities,
  {
    load,
    publish,
    progress,
    signal,
    concurrency = 2,
    eligible,
    onFailure,
    directoryComplete = () => true,
  },
) {
  const scheduled = new Set();
  let completed = 0;
  const failures = [];
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (!signal.aborted) {
        const index = cities.findIndex(
          (city) => !scheduled.has(city) && (!eligible || eligible(city)),
        );
        if (index < 0) {
          if (scheduled.size === cities.length && directoryComplete()) return;
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        const city = cities[index];
        scheduled.add(city);
        try {
          const data = await load(city);
          if (signal.aborted) return;
          await publish(data, city);
        } catch (error) {
          if (signal.aborted) return;
          failures.push({ city, error });
          onFailure?.(city, error);
        }
        if (signal.aborted) return;
        progress?.(++completed, cities.length, failures.length);
      }
    }),
  );
  return failures;
}
