import { DatabaseSync } from 'node:sqlite';
import { connectPostgres } from '../server/postgres.mjs';
import { importWorld } from '../server/import-world.mjs';
const sourcePath = process.argv[2];
if (!sourcePath)
  throw new Error(
    'Provide the SQLite backup path. Destination must be a migrated, empty database.',
  );
const source = new DatabaseSync(sourcePath, { readOnly: true }),
  target = connectPostgres();
try {
  console.log('Imported durable record counts:', await importWorld(source, target));
} finally {
  source.close();
  await target.close();
}
