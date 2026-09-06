import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const selections = [
  ['kloppenheim_06_puresky', 'hdri', 'hdr', 'sky.hdr'],
  ['brick_wall_001', 'Diffuse', 'jpg', 'brick-color.jpg'],
  ['brick_wall_001', 'nor_gl', 'jpg', 'brick-normal.jpg'],
  ['brick_wall_001', 'Rough', 'jpg', 'brick-rough.jpg'],
  ['concrete_pavement_02', 'Diffuse', 'jpg', 'concrete-color.jpg'],
  ['concrete_pavement_02', 'nor_gl', 'jpg', 'concrete-normal.jpg'],
  ['concrete_pavement_02', 'Rough', 'jpg', 'concrete-rough.jpg'],
  ['aerial_grass_rock', 'Diffuse', 'jpg', 'grass-color.jpg'],
];
await mkdir('public/materials', { recursive: true });
const metadata = new Map();
const manifest = [];
for (const [id, map, format, name] of selections) {
  if (!metadata.has(id)) {
    const response = await fetch('https://api.polyhaven.com/files/' + id);
    if (!response.ok) throw new Error('Asset metadata unavailable');
    metadata.set(id, await response.json());
  }
  const source = metadata.get(id)[map]['1k'][format];
  const response = await fetch(source.url);
  if (!response.ok) throw new Error('Asset download failed');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (createHash('md5').update(bytes).digest('hex') !== source.md5)
    throw new Error('Asset checksum mismatch');
  await writeFile('public/materials/' + name, bytes);
  manifest.push({
    file: name,
    bytes: bytes.length,
    source: source.url,
    asset: 'https://polyhaven.com/a/' + id,
    license: 'CC0-1.0',
  });
}
await writeFile('public/materials/manifest.json', JSON.stringify(manifest, null, 2) + '\n');
console.log(
  'Verified material payload:',
  manifest.reduce((n, a) => n + a.bytes, 0),
  'bytes',
);
