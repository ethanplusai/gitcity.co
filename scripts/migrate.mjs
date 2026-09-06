import { connectPostgres, migrate } from '../server/postgres.mjs';
const db = connectPostgres();
try { await migrate(db); console.log('Database migrations applied.'); }
finally { await db.close(); }
