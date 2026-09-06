import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openStore } from '../server/store.mjs';
const store = openStore(':memory:'),
  base = JSON.parse(await readFile('server/atlas.json', 'utf8'))[0];
const repos = ['studio/engine', 'studio/interface', 'studio/documentation'].map((id, index) => {
  const files = base.files
    .slice(index * 12, index * 12 + 18)
    .map((f, i) => ({ ...f, path: `src/module-${i}.ts` }));
  return {
    ...base,
    id,
    name: id.split('/')[1],
    files,
    totalFiles: files.length,
    directories: [{ name: 'src', count: files.length }],
    commits: [],
    residents: [],
    civic: [],
    dependencies: [],
    issues: [],
    openPRs: 0,
    city: store.locateOwner('studio'),
    coordinates: store.locate(id),
    landPlan: store.reserveLand(id, 3),
    fetchedAt: '2026-09-05T12:00:00Z',
  };
});
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args:
    process.env.GITCITY_GPU === 'metal'
      ? ['--use-angle=metal']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  errors = [];
await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text());
});
let releaseAtlas;
const held = new Promise((resolve) => {
  releaseAtlas = resolve;
});
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/atlas') {
    await held;
    data = [
      {
        ...repos[0],
        id: 'STUDIO/engine',
        fetchedAt: 'older',
        files: [{ path: 'obsolete-snapshot.ts' }],
      },
    ];
  } else if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname.startsWith('/api/owners/'))
    data = [{ id: repos[0].id, name: repos[0].name, ...repos[0].coordinates, city: repos[0].city }];
  else if (url.pathname.startsWith('/api/repos/')) data = repos[0];
  else if (url.pathname.startsWith('/api/governance/'))
    data = { role: 'Tourist', districtRole: null };
  else return route.fulfill({ status: 404, json: { error: 'No fixture' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/studio/engine');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-owner-street-groups', '1', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-construction-count', '18');
  const snapshot = () =>
    canvas.evaluate((c) => ({
      rebuilds: c.dataset.ownerRebuilds,
      construction: c.dataset.constructionCount,
      x: c.dataset.cameraX,
      z: c.dataset.cameraZ,
    }));
  const before = await snapshot();
  releaseAtlas();
  await expect(canvas).toHaveAttribute('data-skipped-active-previews', '1');
  expect(await snapshot()).toEqual(before);
  // Leaving must still materialize the up-to-date district in the owner view.
  await page.locator('.breadcrumb button').filter({ hasText: 'studio' }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.locator('.owner-list button')).toHaveCount(1);
  await expect(canvas).toHaveAttribute('data-owner-neighborhoods', '1');
  await expect(canvas).toHaveAttribute('data-construction-count', '18');
  await page.screenshot({ path: '/private/tmp/gitcity-active-preview-owner.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: delayed active atlas snapshot does not rebuild streets, add stale buildings or move the camera; leaving retains the current neighborhood.',
  );
} finally {
  releaseAtlas();
  await browser.close();
  store.db.close();
}
