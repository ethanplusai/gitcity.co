import { AsyncLocalStorage } from 'node:async_hooks';
import pg from 'pg';
import { readFile } from 'node:fs/promises';

// SQL comes only from our store, never from request input.
export function postgresSql(sql) {
  let index = 0;
  const ignore = /INSERT OR IGNORE INTO/i.test(sql);
  let result = sql
    .replace(/INSERT OR IGNORE INTO/gi, 'INSERT INTO')
    .replace(/\?/g, () => `$${++index}`)
    .replace(/MAX\(amount,excluded.amount\)/g, 'GREATEST(ledger.amount,excluded.amount)')
    .replace(
      /SET balance=balance\+excluded.balance/g,
      'SET balance=treasury.balance+excluded.balance',
    )
    .replace(/COUNT\(\*\) AS n/g, 'COUNT(*)::integer AS n')
    .replace(/AS directoryAddress/g, 'AS "directoryAddress"');
  if (ignore) result += ' ON CONFLICT DO NOTHING';
  return result;
}
export function postgresDatabase(pool) {
  const context = new AsyncLocalStorage();
  const query = (sql, values = []) => (context.getStore() || pool).query(sql, values);
  const transaction = async (fn) => {
    if (context.getStore()) return fn();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Allocation and ledger writes are short; serialize them across instances.
      // No GitHub/network work belongs inside this transaction.
      await client.query('SELECT pg_advisory_xact_lock(72451901)');
      const result = await context.run(client, fn);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  };
  return {
    query,
    transaction,
    prepare(sql) {
      const execute = (...values) => query(postgresSql(sql), values);
      return {
        get: async (...values) => (await execute(...values)).rows[0],
        all: async (...values) => (await execute(...values)).rows,
        run: async (...values) => ({ changes: (await execute(...values)).rowCount }),
      };
    },
    close: () => pool.end(),
  };
}
export function connectPostgres(url = process.env.DATABASE_URL || process.env.POSTGRES_URL) {
  if (!url) throw new Error('DATABASE_URL is required for production storage.');
  const connection = new URL(url);
  if (['prefer', 'require', 'verify-ca'].includes(connection.searchParams.get('sslmode')))
    connection.searchParams.set('sslmode', 'verify-full');
  return postgresDatabase(
    new pg.Pool({
      connectionString: connection.toString(),
      max: 4,
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 10000,
      statement_timeout: 20000,
      allowExitOnIdle: true,
    }),
  );
}
export async function migrate(db) {
  await db.transaction(async () => {
    await db.query(
      'CREATE TABLE IF NOT EXISTS schema_migrations(version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    for (const [version, file] of [
      [1, '001-world.sql'],
      [2, '002-runtime.sql'],
      [3, '003-cache-limits.sql'],
    ]) {
      if (
        (await db.query('SELECT 1 FROM schema_migrations WHERE version=$1', [version])).rows.length
      )
        continue;
      const sql = await readFile(new URL(`./migrations/${file}`, import.meta.url), 'utf8');
      for (const statement of sql
        .split(';')
        .map((s) => s.trim())
        .filter(Boolean))
        await db.query(statement);
      await db.query('INSERT INTO schema_migrations(version) VALUES($1)', [version]);
    }
  });
}
