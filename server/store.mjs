import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { atlas } from '../shared/model.mjs';
import { ownerSeed, neighborhoodOffset } from '../shared/geography.mjs';
import { landCandidates, PLAN_VERSION, cityCell, frontageLots } from '../shared/city-plan.mjs';
import { allocateReward } from '../shared/governance.mjs';
import { directoryBlock, directoryCandidates } from '../shared/directory-block.mjs';
export function openStore(path = 'data/gitcity.sqlite') {
  if (path !== ':memory:') mkdirSync('data', { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS players(login TEXT PRIMARY KEY,soft INTEGER DEFAULT 0,hard INTEGER DEFAULT 0);
    CREATE TABLE IF NOT EXISTS ledger(id TEXT PRIMARY KEY,login TEXT,amount INTEGER,repo TEXT);
    CREATE TABLE IF NOT EXISTS cities(id TEXT PRIMARY KEY,x REAL,z REAL);
    CREATE TABLE IF NOT EXISTS owner_cities(id TEXT PRIMARY KEY,x REAL,z REAL);
    CREATE TABLE IF NOT EXISTS neighborhoods(id TEXT PRIMARY KEY,owner TEXT,slot INTEGER,x REAL,z REAL,UNIQUE(owner,slot));
    CREATE TABLE IF NOT EXISTS land_claims(owner TEXT,column_index INTEGER,row_index INTEGER,repo TEXT,block_index INTEGER,version INTEGER,PRIMARY KEY(owner,column_index,row_index),UNIQUE(repo,block_index));
    CREATE TABLE IF NOT EXISTS source_addresses(repo TEXT,path TEXT,slot INTEGER,PRIMARY KEY(repo,path),UNIQUE(repo,slot));
    CREATE TABLE IF NOT EXISTS directory_addresses(repo TEXT,path TEXT,directory TEXT,slot INTEGER,PRIMARY KEY(repo,path),UNIQUE(repo,directory,slot));
    CREATE TABLE IF NOT EXISTS directory_regions(repo TEXT,directory TEXT,ordinal INTEGER,PRIMARY KEY(repo,directory),UNIQUE(repo,ordinal));
    CREATE TABLE IF NOT EXISTS directory_land(owner TEXT,repo TEXT,directory TEXT,chunk INTEGER,column_index INTEGER,row_index INTEGER,PRIMARY KEY(repo,directory,chunk),UNIQUE(owner,column_index,row_index));
    CREATE TABLE IF NOT EXISTS directory_legacy(repo TEXT,path TEXT,slot INTEGER,PRIMARY KEY(repo,path));
    CREATE TABLE IF NOT EXISTS possessions(login TEXT,repo TEXT,item TEXT,PRIMARY KEY(login,repo,item));
    CREATE TABLE IF NOT EXISTS ownership(login TEXT,repo TEXT,path TEXT,pr INTEGER,PRIMARY KEY(login,repo,path));
    CREATE TABLE IF NOT EXISTS treasury(repo TEXT PRIMARY KEY,balance INTEGER DEFAULT 0);
    CREATE INDEX IF NOT EXISTS ownership_repo ON ownership(repo);`);
  function locateOwner(owner) {
    owner = owner.toLowerCase();
    const existing = db.prepare('SELECT x,z FROM owner_cities WHERE id=?').get(owner);
    if (existing) return { ...existing };
    const seed = ownerSeed(owner);
    let position = seed;
    for (let i = 0; i < 10000; i++) {
      if (
        !db
          .prepare('SELECT 1 FROM owner_cities WHERE ABS(x-?)<640 AND ABS(z-?)<640')
          .get(position.x, position.z) &&
        landClearance(owner, position)(cityCell(owner, 0, 0))
      ) {
        db.prepare('INSERT INTO owner_cities(id,x,z) VALUES(?,?,?)').run(
          owner,
          position.x,
          position.z,
        );
        return position;
      }
      const angle = i * 2.399963229728653,
        radius = 720 * Math.sqrt(i + 1);
      position = { x: seed.x + Math.cos(angle) * radius, z: seed.z + Math.sin(angle) * radius };
    }
    throw new Error('No free city anchor was found in the current search region.');
  }
  function locate(id) {
    id = id.toLowerCase();
    const previous = db.prepare('SELECT x,z FROM neighborhoods WHERE id=?').get(id);
    if (previous) return { ...previous };
    const owner = id.split('/')[0],
      center = locateOwner(owner);
    const slot = db.prepare('SELECT COUNT(*) AS n FROM neighborhoods WHERE owner=?').get(owner).n;
    const offset = neighborhoodOffset(slot),
      position = { x: center.x + offset.x, z: center.z + offset.z };
    db.prepare('INSERT INTO neighborhoods(id,owner,slot,x,z) VALUES(?,?,?,?,?)').run(
      id,
      owner,
      slot,
      position.x,
      position.z,
    );
    return position;
  }
  for (const city of atlas) locate(city.id);
  function transact(fn) {
    db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      db.exec('COMMIT');
      return result;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }
  function reserveLand(id, blockCount) {
    id = id.toLowerCase();
    if (!Number.isInteger(blockCount) || blockCount < 1 || blockCount > 512)
      throw new Error('Invalid district land request.');
    const owner = id.split('/')[0],
      city = locateOwner(owner),
      anchor = locate(id);
    return transact(() => {
      const existing = db
        .prepare(
          'SELECT column_index AS column,row_index AS row,block_index AS block FROM land_claims WHERE repo=? ORDER BY block_index',
        )
        .all(id);
      const occupied = new Set(
        db
          .prepare('SELECT column_index,row_index FROM land_claims WHERE owner=?')
          .all(owner)
          .map((r) => `${r.column_index}:${r.row_index}`),
      );
      for (const region of db
        .prepare('SELECT column_index,row_index FROM directory_land WHERE owner=?')
        .all(owner))
        for (let z = 0; z < 2; z++)
          for (let x = 0; x < 3; x++)
            occupied.add(`${region.column_index + x}:${region.row_index + z}`);
      const additions = landCandidates(
        owner,
        { x: anchor.x - city.x, z: anchor.z - city.z },
        occupied,
        Math.max(0, blockCount - existing.length),
        blockCount > existing.length ? landClearance(owner, city) : null,
      );
      for (const [i, cell] of additions.entries()) {
        const block = existing.length + i;
        db.prepare(
          'INSERT INTO land_claims(owner,column_index,row_index,repo,block_index,version) VALUES(?,?,?,?,?,?)',
        ).run(owner, cell.column, cell.row, id, block, PLAN_VERSION);
      }
      const claims = db
        .prepare(
          'SELECT column_index AS column,row_index AS row,block_index AS block FROM land_claims WHERE repo=? ORDER BY block_index',
        )
        .all(id);
      return {
        version: PLAN_VERSION,
        city,
        anchor,
        blocks: claims.map((claim) => ({
          ...cityCell(owner, claim.column, claim.row),
          block: claim.block,
        })),
      };
    });
  }
  function sourceLand(id, paths) {
    id = id.toLowerCase();
    const requested = [...new Set(paths)].sort();
    const existing = db
      .prepare('SELECT path,slot FROM source_addresses WHERE repo=? ORDER BY slot')
      .all(id);
    const known = new Map(existing.map((r) => [r.path, r.slot]));
    const additions = requested.filter((path) => !known.has(path));
    const land = reserveLand(
      id,
      Math.min(512, Math.max(1, Math.ceil((existing.length + additions.length) / 8))),
    );
    const capacity = land.blocks.reduce((sum, block) => sum + frontageLots(block).length, 0);
    if (existing.length + additions.length > capacity)
      throw Object.assign(
        new Error('This district has reached its current detailed-address capacity.'),
        { status: 503 },
      );
    transact(() => {
      let slot = existing.length ? Math.max(...existing.map((r) => r.slot)) + 1 : 0;
      for (const path of additions) {
        db.prepare('INSERT INTO source_addresses(repo,path,slot) VALUES(?,?,?)').run(
          id,
          path,
          slot,
        );
        known.set(path, slot++);
      }
    });
    return {
      landPlan: land,
      addresses: Object.fromEntries(requested.map((path) => [path, known.get(path)])),
    };
  }
  // Survey slots precede parsing. Retired paths retain their slots, so adding,
  // removing or exploring files cannot reshuffle a directory's eventual blocks.
  function directoryInventory(id, paths, files = [], complete = false, measurements = files) {
    id = id.toLowerCase();
    const active = [...new Set(paths)].sort();
    const rows = db
      .prepare('SELECT path,directory,slot FROM directory_addresses WHERE repo=?')
      .all(id);
    const known = new Map(rows.map((r) => [r.path, r]));
    const regions = new Map(
      db
        .prepare('SELECT directory,ordinal FROM directory_regions WHERE repo=?')
        .all(id)
        .map((r) => [r.directory, r.ordinal]),
    );
    const capacity = new Map();
    for (const row of rows)
      capacity.set(row.directory, Math.max(capacity.get(row.directory) || 0, row.slot + 1));
    const insert = db.prepare(
      'INSERT INTO directory_addresses(repo,path,directory,slot) VALUES(?,?,?,?)',
    );
    transact(() => {
      for (const path of active) {
        if (known.has(path)) continue;
        const directory = path.includes('/') ? path.split('/')[0] : '.';
        if (!regions.has(directory)) {
          const ordinal = regions.size;
          db.prepare('INSERT INTO directory_regions(repo,directory,ordinal) VALUES(?,?,?)').run(
            id,
            directory,
            ordinal,
          );
          regions.set(directory, ordinal);
        }
        const slot = capacity.get(directory) || 0;
        insert.run(id, path, directory, slot);
        known.set(path, { path, directory, slot });
        capacity.set(directory, slot + 1);
      }
    });
    const analyzed = new Map(measurements.map((file) => [file.path, file]));
    const directories = new Map();
    for (const path of active) {
      const address = known.get(path);
      let directory = directories.get(address.directory);
      if (!directory) {
        directory = {
          name: address.directory,
          address: regions.get(address.directory),
          count: 0,
          capacity: capacity.get(address.directory),
          blocks: new Map(),
        };
        directories.set(address.directory, directory);
      }
      directory.count++;
      const index = Math.floor(address.slot / 64);
      const block = directory.blocks.get(index) || {
        index,
        count: 0,
        parsed: 0,
        symbols: 0,
        complexity: 0,
        mask: '0',
      };
      block.count++;
      block.mask = (BigInt('0x' + block.mask) | (1n << BigInt(address.slot % 64))).toString(16);
      const file = analyzed.get(path);
      // These are measured subtotals, not estimates for unparsed files.
      if (file && Number.isFinite(file.symbols) && Number.isFinite(file.complexity)) {
        block.parsed++;
        block.symbols += file.symbols;
        block.complexity += file.complexity;
      }
      directory.blocks.set(index, block);
    }
    return {
      version: 1,
      complete,
      directories: [...directories.values()]
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((d) => ({ ...d, blocks: [...d.blocks.values()].sort((a, b) => a.index - b.index) })),
      files: files.map((file) => ({
        ...file,
        ...(known.has(file.path) ? { directoryAddress: known.get(file.path).slot } : {}),
      })),
    };
  }
  // Index actual world footprints, including other owners' civic reservations.
  // A large directory must not grow through a city whose anchor is already fixed.
  function landClearance(owner, origin) {
    const bins = new Map();
    const bounds = (polygon, center) => ({
      minX: Math.min(...polygon.map((p) => p.x)) + center.x,
      maxX: Math.max(...polygon.map((p) => p.x)) + center.x,
      minZ: Math.min(...polygon.map((p) => p.z)) + center.z,
      maxZ: Math.max(...polygon.map((p) => p.z)) + center.z,
    });
    const keys = function* (box) {
      for (let z = Math.floor(box.minZ / 64); z <= Math.floor(box.maxZ / 64); z++)
        for (let x = Math.floor(box.minX / 64); x <= Math.floor(box.maxX / 64); x++)
          yield `${x}:${z}`;
    };
    const add = (polygon, center) => {
      const box = bounds(polygon, center);
      for (const key of keys(box)) {
        const bucket = bins.get(key) || [];
        bucket.push(box);
        bins.set(key, bucket);
      }
    };
    for (const city of db.prepare('SELECT id,x,z FROM owner_cities WHERE id<>?').all(owner))
      add(cityCell(city.id, 0, 0).polygon, city);
    for (const cell of db
      .prepare(
        'SELECT l.owner,l.column_index,l.row_index,c.x,c.z FROM land_claims l JOIN owner_cities c ON c.id=l.owner WHERE l.owner<>?',
      )
      .all(owner))
      add(cityCell(cell.owner, cell.column_index, cell.row_index).polygon, cell);
    for (const cell of db
      .prepare(
        'SELECT l.owner,l.column_index,l.row_index,c.x,c.z FROM directory_land l JOIN owner_cities c ON c.id=l.owner WHERE l.owner<>?',
      )
      .all(owner))
      add(directoryBlock(cell.owner, cell.column_index, cell.row_index).polygon, cell);
    return (cell) => {
      const box = bounds(cell.polygon, origin);
      for (const key of keys(box))
        for (const other of bins.get(key) || [])
          if (
            box.minX < other.maxX &&
            box.maxX > other.minX &&
            box.minZ < other.maxZ &&
            box.maxZ > other.minZ
          )
            return false;
      return true;
    };
  }
  function inventoryLand(id, directories) {
    id = id.toLowerCase();
    const owner = id.split('/')[0],
      city = locateOwner(owner),
      anchor = locate(id);
    return transact(() => {
      const rows = db
        .prepare(
          'SELECT directory,chunk,column_index AS column,row_index AS row FROM directory_land WHERE repo=?',
        )
        .all(id);
      if (!rows.length && directories.length)
        db.prepare(
          'INSERT OR IGNORE INTO directory_legacy(repo,path,slot) SELECT repo,path,slot FROM source_addresses WHERE repo=?',
        ).run(id);
      const known = new Map(rows.map((row) => [`${row.directory}:${row.chunk}`, row]));
      const needed = directories
        .flatMap((d) => d.blocks.map((block) => ({ directory: d.name, chunk: block.index })))
        .filter((r) => !known.has(`${r.directory}:${r.chunk}`));
      const occupied = new Set(
        db
          .prepare('SELECT column_index,row_index FROM land_claims WHERE owner=?')
          .all(owner)
          .map((r) => `${r.column_index}:${r.row_index}`),
      );
      for (const region of db
        .prepare('SELECT column_index,row_index FROM directory_land WHERE owner=?')
        .all(owner))
        for (let z = 0; z < 2; z++)
          for (let x = 0; x < 3; x++)
            occupied.add(`${region.column_index + x}:${region.row_index + z}`);
      const claims = directoryCandidates(
        owner,
        { x: anchor.x - city.x, z: anchor.z - city.z },
        occupied,
        needed.length,
        needed.length ? landClearance(owner, city) : null,
      );
      const insert = db.prepare(
        'INSERT INTO directory_land(owner,repo,directory,chunk,column_index,row_index) VALUES(?,?,?,?,?,?)',
      );
      needed.forEach((region, index) => {
        const claim = { ...region, ...claims[index] };
        insert.run(owner, id, region.directory, region.chunk, claim.column, claim.row);
        known.set(`${region.directory}:${region.chunk}`, claim);
      });
      const legacyMasks = new Map();
      for (const file of db
        .prepare(
          'SELECT a.directory,a.slot FROM directory_addresses a JOIN directory_legacy l ON l.repo=a.repo AND l.path=a.path WHERE a.repo=?',
        )
        .all(id)) {
        const key = `${file.directory}:${Math.floor(file.slot / 64)}`;
        legacyMasks.set(key, (legacyMasks.get(key) || 0n) | (1n << BigInt(file.slot % 64)));
      }
      return directories.map((directory) => ({
        ...directory,
        blocks: directory.blocks.map((block) => {
          const claim = known.get(`${directory.name}:${block.index}`);
          return {
            ...block,
            column: claim.column,
            row: claim.row,
            ...(block.mask
              ? {
                  legacyMask: (
                    (legacyMasks.get(`${directory.name}:${block.index}`) || 0n) &
                    BigInt('0x' + block.mask)
                  ).toString(16),
                }
              : {}),
          };
        }),
      }));
    });
  }
  function inventoryFiles(id, files) {
    const legacy = new Set(
      db
        .prepare('SELECT path FROM directory_legacy WHERE repo=?')
        .all(id.toLowerCase())
        .map((row) => row.path),
    );
    return files.map((file) => ({
      ...file,
      directoryLocated: Number.isInteger(file.directoryAddress) && !legacy.has(file.path),
    }));
  }
  function inventoryBlockPaths(id, directory, block) {
    if (!Number.isSafeInteger(block) || block < 0 || block > 1000000)
      throw Object.assign(new Error('Invalid directory block.'), { status: 400 });
    return db
      .prepare(
        'SELECT path,slot AS directoryAddress FROM directory_addresses WHERE repo=? AND directory=? AND slot>=? AND slot<? ORDER BY slot',
      )
      .all(id.toLowerCase(), directory, block * 64, (block + 1) * 64);
  }
  function creditSoft(login, total) {
    return transact(() => {
      const earned =
        db.prepare('SELECT amount FROM ledger WHERE id=?').get(`soft:${login}`)?.amount || 0;
      db.prepare('UPDATE players SET soft=soft+? WHERE login=?').run(
        Math.max(0, total - earned),
        login,
      );
      db.prepare(
        'INSERT INTO ledger(id,login,amount) VALUES(?,?,?) ON CONFLICT(id) DO UPDATE SET amount=MAX(amount,excluded.amount)',
      ).run(`soft:${login}`, login, total);
    });
  }
  function acceptWork({ id, login, amount, repo, paths, pr, dependencies = [] }) {
    return transact(() => {
      const split = allocateReward(
        amount,
        dependencies.filter((d) => d !== repo),
      );
      const inserted = db
        .prepare('INSERT OR IGNORE INTO ledger(id,login,amount,repo) VALUES(?,?,?,?)')
        .run(id, login, split.personal, repo);
      if (!inserted.changes) return 0;
      db.prepare('UPDATE players SET hard=hard+? WHERE login=?').run(split.personal, login);
      db.prepare('INSERT OR IGNORE INTO possessions(login,repo,item) VALUES(?,?,?)').run(
        login,
        repo,
        'resident',
      );
      for (const path of paths)
        db.prepare('INSERT OR IGNORE INTO ownership(login,repo,path,pr) VALUES(?,?,?,?)').run(
          login,
          repo,
          path,
          pr,
        );
      for (const entry of split.upstream)
        db.prepare(
          'INSERT INTO treasury(repo,balance) VALUES(?,?) ON CONFLICT(repo) DO UPDATE SET balance=balance+excluded.balance',
        ).run(entry.repo, entry.amount);
      return split.personal;
    });
  }
  function purchase(login, repo, item) {
    const catalog = {
      amber: { currency: 'soft', price: 20 },
      sage: { currency: 'soft', price: 20 },
      pavilion: { currency: 'hard', price: 50 },
    };
    const product = catalog[item];
    if (!product) throw new Error('Unknown item.');
    return transact(() => {
      if (
        db
          .prepare('SELECT 1 FROM possessions WHERE login=? AND repo=? AND item=?')
          .get(login, repo, item)
      )
        throw new Error('You already own this item.');
      const result = db
        .prepare(
          `UPDATE players SET ${product.currency}=${product.currency}-? WHERE login=? AND ${product.currency}>=?`,
        )
        .run(product.price, login, product.price);
      if (!result.changes) throw new Error('You have not earned enough currency yet.');
      db.prepare('INSERT INTO possessions(login,repo,item) VALUES(?,?,?)').run(login, repo, item);
    });
  }
  function buildCivic(repo) {
    return transact(() => {
      if (
        db
          .prepare("SELECT 1 FROM possessions WHERE login='@civic' AND repo=? AND item='pavilion'")
          .get(repo)
      )
        throw new Error('The community pavilion already stands here.');
      const result = db
        .prepare('UPDATE treasury SET balance=balance-50 WHERE repo=? AND balance>=50')
        .run(repo);
      if (!result.changes) throw new Error('The city needs 50 earned upstream credits.');
      db.prepare("INSERT INTO possessions(login,repo,item) VALUES('@civic',?,'pavilion')").run(
        repo,
      );
      db.prepare("INSERT INTO ledger(id,login,amount,repo) VALUES(?,'@civic',-50,?)").run(
        `civic:${repo}:pavilion`,
        repo,
      );
    });
  }
  return {
    db,
    creditSoft,
    acceptWork,
    purchase,
    locate,
    locateOwner,
    buildCivic,
    reserveLand,
    sourceLand,
    directoryInventory,
    inventoryLand,
    inventoryFiles,
    inventoryBlockPaths,
  };
}
