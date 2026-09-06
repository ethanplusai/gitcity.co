import { PGlite } from '@electric-sql/pglite';
import { postgresDatabase } from '../../server/postgres.mjs';
// PGlite executes PostgreSQL SQL. Its single connection needs an explicit pool
// queue; real multi-connection lock behavior also runs when TEST_DATABASE_URL is set.
export async function database() {
  if (process.env.TEST_DATABASE_URL) {
    const { connectPostgres } = await import('../../server/postgres.mjs');
    return connectPostgres(process.env.TEST_DATABASE_URL);
  }
  const pg = new PGlite();
  let tail = Promise.resolve();
  const pool = {
    async connect() {
      let release;
      const next = new Promise((r) => (release = r));
      const previous = tail;
      tail = next;
      await previous;
      return { query: (...a) => pg.query(...a), release };
    },
    async query(...args) {
      const c = await this.connect();
      try {
        return await c.query(...args);
      } finally {
        c.release();
      }
    },
    end: () => pg.close(),
  };
  return postgresDatabase(pool);
}
