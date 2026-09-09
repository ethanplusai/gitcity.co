// Bound network and renderer work, but never leave the directory's tail unbuilt.
// Each completed city is published immediately; a slow neighbor cannot hold it up.
export async function progressiveCities(
  cities,
  { load, publish, progress, signal, concurrency = 2, eligible, onFailure },
) {
  const pending = [...cities];
  let completed = 0;
  const failures = [];
  await Promise.all(
    Array.from({ length: Math.min(concurrency, cities.length) }, async () => {
      while (!signal.aborted && pending.length) {
        const index = eligible ? pending.findIndex(eligible) : 0;
        if (index < 0) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        const [city] = pending.splice(index, 1);
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
