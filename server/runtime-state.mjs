import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
export function secretCodec(key) {
  const bytes = Buffer.from(key || '', 'base64');
  if (bytes.length !== 32)
    throw new Error('SESSION_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return {
    seal(value) {
      const iv = randomBytes(12),
        cipher = createCipheriv('aes-256-gcm', bytes, iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
      return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64');
    },
    open(value) {
      const data = Buffer.from(value, 'base64');
      const cipher = createDecipheriv('aes-256-gcm', bytes, data.subarray(0, 12));
      cipher.setAuthTag(data.subarray(12, 28));
      return JSON.parse(
        Buffer.concat([cipher.update(data.subarray(28)), cipher.final()]).toString('utf8'),
      );
    },
  };
}
export function runtimeState(db, encryptionKey) {
  const codec = secretCodec(encryptionKey);
  const records = (table) => ({
    async get(id) {
      const row = await db
        .prepare(`SELECT payload FROM ${table} WHERE id=? AND expires>?`)
        .get(id, Date.now());
      return row ? codec.open(row.payload) : undefined;
    },
    async set(id, value) {
      await db
        .prepare(
          `INSERT INTO ${table}(id,payload,expires) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET payload=excluded.payload,expires=excluded.expires`,
        )
        .run(id, codec.seal(value), value.expires);
    },
    async delete(id) {
      await db.prepare(`DELETE FROM ${table} WHERE id=?`).run(id);
    },
    async take(id) {
      const row = await db
        .prepare(`DELETE FROM ${table} WHERE id=? RETURNING payload,expires`)
        .get(id);
      return row && Number(row.expires) > Date.now() ? codec.open(row.payload) : undefined;
    },
  });
  const pending = new Map();
  let lastCacheCleanup = 0;
  return {
    sessions: records('sessions'),
    oauthStates: records('oauth_states'),
    async cached(key, ttl, load) {
      if (Date.now() - lastCacheCleanup > 600000) {
        lastCacheCleanup = Date.now();
        await db
          .prepare('DELETE FROM repo_cache WHERE expires<? AND lease_until<?')
          .run(Date.now(), Date.now());
        await db.prepare('DELETE FROM request_limits WHERE expires<?').run(Date.now());
      }
      if (pending.has(key)) return pending.get(key);
      const task = (async () => {
        const deadline = Date.now() + 20000;
        for (;;) {
          const now = Date.now();
          const row = await db
            .prepare('SELECT payload FROM repo_cache WHERE key=? AND expires>?')
            .get(key, now);
          if (row) return JSON.parse(row.payload);
          const lease = randomBytes(16).toString('hex');
          const claimed = await db
            .prepare(
              "INSERT INTO repo_cache(key,payload,expires,lease,lease_until) VALUES(?,'null',0,?,?) ON CONFLICT(key) DO UPDATE SET lease=excluded.lease,lease_until=excluded.lease_until WHERE repo_cache.expires<=? AND repo_cache.lease_until<? RETURNING key",
            )
            .get(key, lease, now + 330000, now, now);
          if (claimed) {
            try {
              const value = await load(),
                payload = JSON.stringify(value);
              if (Buffer.byteLength(payload) <= 16000000)
                await db
                  .prepare('UPDATE repo_cache SET payload=?,expires=? WHERE key=? AND lease=?')
                  .run(payload, Date.now() + ttl, key, lease);
              return value;
            } finally {
              await db
                .prepare('UPDATE repo_cache SET lease=NULL,lease_until=0 WHERE key=? AND lease=?')
                .run(key, lease);
            }
          }
          if (Date.now() >= deadline)
            throw Object.assign(
              new Error('This city is being prepared. Please try again shortly.'),
              { status: 503 },
            );
          await new Promise((resolve) => setTimeout(resolve, 200));
        }
      })().finally(() => pending.delete(key));
      pending.set(key, task);
      return task;
    },
    async allow(key, limit, interval = 60000) {
      const now = Date.now();
      const row = await db
        .prepare(
          'INSERT INTO request_limits(key,count,expires) VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN request_limits.expires<=? THEN 1 ELSE request_limits.count+1 END,expires=CASE WHEN request_limits.expires<=? THEN excluded.expires ELSE request_limits.expires END RETURNING count',
        )
        .get(key, now + interval, now, now);
      return row.count <= limit;
    },
    async cleanup() {
      for (const table of ['sessions', 'oauth_states', 'request_limits'])
        await db.prepare(`DELETE FROM ${table} WHERE expires<?`).run(Date.now());
      await db
        .prepare('DELETE FROM repo_cache WHERE expires<? AND lease_until<?')
        .run(Date.now(), Date.now());
    },
  };
}
