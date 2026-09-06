import assert from 'node:assert/strict';
const origin = process.env.GITCITY_ORIGIN || 'http://localhost:3010';
const id = process.env.GITCITY_REPO || 'vercel/next.js';
async function get(path) {
  const response = await fetch(origin + path);
  const data = await response.json();
  if (!response.ok) throw new Error(`${response.status}: ${data.error}`);
  return data;
}
const initial = await get(`/api/repos/${id}`);
assert.ok(initial.sourceInventory.complete);
const count = initial.sourceInventory.directories.reduce((n, d) => n + d.count, 0);
assert.equal(
  count,
  initial.directories.reduce((n, d) => n + d.count, 0),
);
assert.ok(count > initial.files.length);
assert.ok(initial.files.every((f) => Number.isInteger(f.directoryAddress)));
const regions = initial.sourceInventory.directories.flatMap((d) => d.blocks);
assert.ok(
  regions.every(
    (b) => Number.isInteger(b.column) && Number.isInteger(b.row) && /^[0-9a-f]{1,16}$/.test(b.mask),
  ),
);
assert.equal(new Set(regions.map((b) => `${b.column}:${b.row}`)).size, regions.length);

const chosen = initial.directories.find(
  (d) =>
    d.count > 8 &&
    d.count <= 32 &&
    initial.files.filter((f) => (f.path.includes('/') ? f.path.split('/')[0] : '.') === d.name)
      .length < d.count,
);
assert.ok(chosen);
const page = await get(`/api/district/${id}?directory=${encodeURIComponent(chosen.name)}`);
assert.equal(page.ref, initial.ref);
assert.ok(page.files.length > 0);
assert.ok(page.files.every((f) => Number.isInteger(f.directoryAddress)));
const again = await get(`/api/repos/${id}`);
assert.deepEqual(
  again.files.map((f) => [f.path, f.address, f.directoryAddress]),
  initial.files.map((f) => [f.path, f.address, f.directoryAddress]),
);
const parsed = (data) =>
  data.sourceInventory.directories.flatMap((d) => d.blocks).reduce((n, b) => n + b.parsed, 0);
// Repeated reviews can reuse already parsed pages; coverage must never regress.
assert.ok(parsed(again) >= parsed(initial));
const targetDirectory = again.sourceInventory.directories.find(
  (d) => d.blocks.length > 2 && d.blocks.at(-1).count <= 16,
);
assert.ok(targetDirectory);
const target = targetDirectory.blocks.at(-1);
const endpoint = `/api/district/${id}?directory=${encodeURIComponent(targetDirectory.name)}&block=${target.index}`;
const selected = await get(endpoint + `&ref=${encodeURIComponent(again.ref)}`);
assert.equal(selected.block, target.index);
assert.equal(selected.files.length, target.count);
assert.ok(selected.files.every((file) => Math.floor(file.directoryAddress / 64) === target.index));
assert.equal((await fetch(origin + endpoint + '&ref=outdated-snapshot')).status, 409);
assert.equal((await fetch(origin + `/api/district/${id}?block=-1&ref=${again.ref}`)).status, 400);
console.log(
  JSON.stringify({
    id,
    sourceFiles: count,
    detailedInitially: initial.files.length,
    directoryBlocks: initial.sourceInventory.directories.reduce((n, d) => n + d.blocks.length, 0),
    summaryBytes: Buffer.byteLength(JSON.stringify(initial.sourceInventory)),
    parsedBefore: parsed(initial),
    parsedAfter: parsed(again),
    expanded: chosen.name,
    pageFiles: page.files.length,
    stableAddresses: true,
    physicalRegions: regions.length,
    selectedDirectory: targetDirectory.name,
    selectedBlock: target.index,
    selectedFiles: selected.files.length,
  }),
);
