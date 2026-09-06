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
const other = {
  ...repos[0],
  id: 'other/landing',
  name: 'landing',
  city: store.locateOwner('other'),
  coordinates: store.locate('other/landing'),
  landPlan: store.reserveLand('other/landing', 3),
};
await page.addInitScript(() => {
  const NativeWorker = window.Worker;
  window.Worker = class extends NativeWorker {
    set onmessage(callback) {
      super.onmessage = (event) => {
        if (window.holdPavement !== false)
          window.releasePavement = () => {
            window.holdPavement = false;
            callback(event);
          };
        else callback(event);
      };
    }
  };
});
await page.route('**/api/**', (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/atlas') data = [];
  else if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname.startsWith('/api/owners/'))
    data = (url.pathname.endsWith('/other') ? [other] : repos).map((r) => ({
      id: r.id,
      name: r.name,
      ...r.coordinates,
      city: r.city,
    }));
  else if (url.pathname.startsWith('/api/repos/'))
    data = [other, ...repos].find((r) => url.pathname.endsWith(r.id));
  else if (url.pathname.startsWith('/api/governance/'))
    data = { role: 'Tourist', districtRole: null };
  else return route.fulfill({ status: 404, json: { error: 'No fixture' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/studio');
  await expect.poll(() => page.evaluate(() => typeof window.releasePavement)).toBe('function');
  await page.evaluate(() => {
    history.pushState({}, '', '/other/landing');
    window.dispatchEvent(new PopStateEvent('popstate'));
  });
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-owner-street-groups', '1', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-construction-count', '18');
  const before = await canvas.evaluate((c) => ({
    x: c.dataset.cameraX,
    z: c.dataset.cameraZ,
    rebuilds: c.dataset.ownerRebuilds,
  }));
  await page.evaluate(() => window.releasePavement());
  await expect(canvas).toHaveAttribute('data-pavement-worker-builds', '1');
  await page.waitForTimeout(250);
  expect(
    await canvas.evaluate((c) => ({
      x: c.dataset.cameraX,
      z: c.dataset.cameraZ,
      rebuilds: c.dataset.ownerRebuilds,
    })),
  ).toEqual(before);
  await expect(page).toHaveURL(/\/other\/landing$/);
  await expect(canvas).toHaveAttribute('data-owner-street-groups', '1');
  await expect(canvas).toHaveAttribute('data-construction-count', '18');
  expect(errors).toEqual([]);
  console.log(
    'PASS: navigation during worker preparation discards the canceled owner batch without moving the new camera or adding stale buildings.',
  );
} finally {
  await browser.close();
  store.db.close();
}
