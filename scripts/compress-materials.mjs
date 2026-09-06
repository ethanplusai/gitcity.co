import { readFile, writeFile, mkdir, mkdtemp, copyFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import sharp from 'sharp';

const revision = '99f52d63aa6799cbdaecfe977111dc5ec3b31d47';
const temporary = await mkdtemp(join(tmpdir(), 'gitcity-basis-'));
for (const [remote, local] of [
  ['basis_encoder.js', 'encoder.cjs'],
  ['basis_encoder.wasm', 'encoder.wasm'],
]) {
  const response = await fetch(
    `https://raw.githubusercontent.com/BinomialLLC/basis_universal/${revision}/webgl/encoder/build/${remote}`,
  );
  if (!response.ok) throw new Error(`Encoder download failed: ${response.status}`);
  await writeFile(join(temporary, local), Buffer.from(await response.arrayBuffer()));
}
const BASIS = createRequire(import.meta.url)(join(temporary, 'encoder.cjs'));
const module = await BASIS({
  wasmBinary: await readFile(join(temporary, 'encoder.wasm')),
  print: () => {},
});
module.initializeBasis();
const manifest = [];
for (const name of [
  'brick-color',
  'brick-normal',
  'brick-rough',
  'concrete-color',
  'concrete-normal',
  'concrete-rough',
  'grass-color',
]) {
  const source = await readFile(`public/materials/${name}.jpg`);
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const encoder = new module.BasisEncoder();
  const color = name.endsWith('color'),
    normal = name.endsWith('normal');
  encoder.setCreateKTX2File(true);
  encoder.setYFlip(true);
  encoder.setKTX2UASTCSupercompression(true);
  encoder.setUASTC(normal);
  encoder.setQualityLevel(220);
  encoder.setETC1SCompressionLevel(2);
  encoder.setPerceptual(color);
  encoder.setKTX2AndBasisSRGBTransferFunc(color);
  encoder.setMipGen(true);
  encoder.setMipSRGB(color);
  encoder.setMipWrapping(true);
  encoder.setCheckForAlpha(false);
  encoder.setStatusOutput(false);
  if (normal) {
    encoder.setNormalMapPreset();
    encoder.setMipRenormalize(true);
    encoder.setPackUASTCFlags(2);
    encoder.setRDOUASTC(true);
    encoder.setRDOUASTCQualityScalar(1);
  }
  encoder.setSliceSourceImage(0, data, info.width, info.height, false);
  const output = new Uint8Array(info.width * info.height * 8);
  let size;
  try {
    size = encoder.encode(output);
  } finally {
    encoder.delete();
  }
  if (!size) throw new Error(`Encoding failed: ${name}`);
  await writeFile(`public/materials/${name}.ktx2`, output.subarray(0, size));
  manifest.push({
    name,
    bytes: size,
    width: info.width,
    height: info.height,
    codec: normal ? 'UASTC' : 'ETC1S',
    srgb: color,
    sourceSHA256: createHash('sha256').update(source).digest('hex'),
    encoderRevision: revision,
  });
  console.log(name, size, 'bytes');
}
await mkdir('public/materials/basis', { recursive: true });
const license = await fetch(
  `https://raw.githubusercontent.com/BinomialLLC/basis_universal/${revision}/LICENSE`,
);
if (!license.ok) throw new Error(`License download failed: ${license.status}`);
await writeFile('public/materials/basis/LICENSE', await license.text());
for (const name of ['basis_transcoder.js', 'basis_transcoder.wasm', 'README.md'])
  await copyFile(
    `node_modules/three/examples/jsm/libs/basis/${name}`,
    `public/materials/basis/${name}`,
  );
await writeFile(
  'public/materials/compressed-manifest.json',
  JSON.stringify(manifest, null, 2) + '\n',
);
console.log(
  'Total compressed map bytes:',
  manifest.reduce((sum, item) => sum + item.bytes, 0),
);
