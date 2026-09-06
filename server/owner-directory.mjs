// Cache public directory metadata, not expensive source analysis. Concurrent
// visitors share one paginated request; rejected requests can be retried.
export function ownerDirectoryCache(ttl = 900000, limit = 32) {
  const entries = new Map();
  return async (owner, load) => {
    const key = owner.toLowerCase(),
      now = Date.now(),
      existing = entries.get(key);
    if (existing && existing.expires > now) return existing.promise;
    const entry = { expires: now + ttl, promise: null };
    entry.promise = (async () => {
      const repos = [];
      for (let page = 1; ; page++) {
        const batch = await load(
          `/users/${encodeURIComponent(owner)}/repos?sort=full_name&per_page=100&page=${page}`,
        );
        repos.push(...batch);
        if (batch.length < 100) break;
      }
      return [
        ...new Map(
          repos
            .filter((repo) => !repo.private && !repo.topics?.includes('gitcity-opt-out'))
            .map((repo) => [repo.full_name.toLowerCase(), repo]),
        ).values(),
      ];
    })().catch((error) => {
      if (entries.get(key) === entry) entries.delete(key);
      throw error;
    });
    entries.delete(key);
    entries.set(key, entry);
    while (entries.size > limit) entries.delete(entries.keys().next().value);
    return entry.promise;
  };
}
