// Bound network and renderer work, but never leave the directory's tail unbuilt.
// Each completed city is published immediately; a slow neighbor cannot hold it up.
export async function progressiveCities(
  cities,
  { load, publish, progress, signal, concurrency = 2 },
) {
  let cursor = 0;
  let completed = 0;
  const failures = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, cities.length) }, async () => {
      while (!signal.aborted && cursor < cities.length) {
        const city = cities[cursor++];
        try {
          const data = await load(city);
          if (signal.aborted) return;
          await publish(data);
        } catch (error) {
          if (signal.aborted) return;
          failures.push({ city, error });
        }
        if (signal.aborted) return;
        progress?.(++completed, cities.length, failures.length);
      }
    }),
  );
  return failures;
}
