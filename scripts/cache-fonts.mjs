import { mkdir, writeFile } from 'node:fs/promises';
await mkdir('public/fonts', { recursive: true });
for (const [family, file, folder] of [
  ['DM Sans', 'dm-sans', 'dmsans'],
  ['Space Grotesk', 'space-grotesk', 'spacegrotesk'],
]) {
  const response = await fetch(
    `https://fonts.googleapis.com/css2?family=${family.replaceAll(' ', '+')}:wght@400..700&display=swap`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!response.ok) throw new Error('Font stylesheet unavailable');
  const css = await response.text();
  const latin = css.split('/* latin */').at(-1);
  const url = latin.match(/url\(([^)]+)\)/)?.[1];
  if (!url) throw new Error('Latin font was not found');
  const font = await fetch(url);
  if (!font.ok) throw new Error('Font unavailable');
  await writeFile(`public/fonts/${file}.woff2`, Buffer.from(await font.arrayBuffer()));
  const license = await fetch(
    `https://raw.githubusercontent.com/google/fonts/main/ofl/${folder}/OFL.txt`,
  );
  if (license.ok) await writeFile(`public/fonts/${file}-LICENSE.txt`, await license.text());
  console.log(`Cached ${family}`);
}
