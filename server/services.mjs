import { createApi } from './api.mjs';
import { runtimeState, secretCodec } from './runtime-state.mjs';
import { configureSharedCache } from './github.mjs';
let pending;
export function getApi() {
  if (!pending)
    pending = initialize().catch((error) => {
      pending = undefined;
      throw error;
    });
  return pending;
}
async function initialize() {
  const production = process.env.NODE_ENV === 'production';
  const origin =
    process.env.APP_ORIGIN || (production ? '' : `http://localhost:${process.env.PORT || 3000}`);
  if (
    !origin ||
    new URL(origin).origin !== origin ||
    (production && !origin.startsWith('https://'))
  )
    throw new Error('APP_ORIGIN must be the canonical HTTPS origin in production.');
  secretCodec(process.env.SESSION_ENCRYPTION_KEY);
  let store;
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    const { connectPostgres } = await import('./postgres.mjs');
    const { createPostgresStore } = await import('./postgres-store.mjs');
    const db = connectPostgres();
    try {
      store = await createPostgresStore(db);
    } catch (error) {
      await db.close();
      throw error;
    }
  } else {
    if (production || process.env.VERCEL)
      throw new Error('DATABASE_URL is required; production cannot use local SQLite.');
    const { openStore } = await import('./store.mjs');
    store = openStore();
    store.db
      .exec(`CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY,payload TEXT,expires INTEGER);
      CREATE TABLE IF NOT EXISTS oauth_states(id TEXT PRIMARY KEY,payload TEXT,expires INTEGER);
      CREATE TABLE IF NOT EXISTS sync_jobs(login TEXT PRIMARY KEY,state TEXT,lease TEXT,lease_until INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS repo_cache(key TEXT PRIMARY KEY,payload TEXT,expires INTEGER,lease TEXT,lease_until INTEGER DEFAULT 0);
      CREATE TABLE IF NOT EXISTS request_limits(key TEXT PRIMARY KEY,count INTEGER,expires INTEGER);`);
  }
  if (!production && !process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    const columns = store.db
      .prepare('PRAGMA table_info(repo_cache)')
      .all()
      .map((row) => row.name);
    if (!columns.includes('lease')) store.db.exec('ALTER TABLE repo_cache ADD COLUMN lease TEXT');
    if (!columns.includes('lease_until'))
      store.db.exec('ALTER TABLE repo_cache ADD COLUMN lease_until INTEGER DEFAULT 0');
  }
  const runtime = runtimeState(store.db, process.env.SESSION_ENCRYPTION_KEY);
  configureSharedCache(runtime);
  return createApi({ store, runtime, origin, production });
}
