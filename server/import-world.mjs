// Import only durable world/economy records. Sessions, caches and jobs are excluded.
export const worldTables = [
  'players',
  'ledger',
  'cities',
  'owner_cities',
  'neighborhoods',
  'land_claims',
  'source_addresses',
  'directory_addresses',
  'directory_regions',
  'directory_land',
  'directory_legacy',
  'possessions',
  'ownership',
  'treasury',
];
export async function importWorld(source, target) {
  source.exec('BEGIN');
  try {
    const counts = await target.transaction(async () => {
      for (const table of worldTables) {
        const { rows } = await target.query(`SELECT 1 FROM ${table} LIMIT 1`);
        if (rows.length)
          throw new Error(
            'Import requires an empty destination world. Existing production data was not changed.',
          );
      }
      const counts = {};
      for (const table of worldTables) {
        const rows = source.prepare(`SELECT * FROM ${table}`).all();
        counts[table] = rows.length;
        const columns = Object.keys(rows[0] || {});
        if (columns.some((column) => !/^[a-z_]+$/.test(column)))
          throw new Error('Unexpected source schema.');
        for (let start = 0; start < rows.length; start += 500) {
          const batch = rows.slice(start, start + 500);
          const values = batch.flatMap((row) => columns.map((column) => row[column]));
          const tuples = batch.map(
            (_, row) =>
              '(' + columns.map((_, col) => '$' + (row * columns.length + col + 1)).join(',') + ')',
          );
          await target.query(
            `INSERT INTO ${table}(${columns.join(',')}) VALUES ${tuples.join(',')}`,
            values,
          );
        }
      }
      return counts;
    });
    source.exec('COMMIT');
    return counts;
  } catch (error) {
    source.exec('ROLLBACK');
    throw error;
  }
}
