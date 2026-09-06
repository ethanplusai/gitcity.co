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
    viewport:
      process.env.GITCITY_PHONE === '1'
        ? { width: 390, height: 844 }
        : { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  errors = [];
await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text());
});
await page.route('**/api/**', (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname === '/api/atlas') data = [];
  else if (url.pathname.startsWith('/api/owners/'))
    data = repos.map((r) => ({ id: r.id, name: r.name, ...r.coordinates, city: r.city }));
  else if (url.pathname.startsWith('/api/repos/'))
    data = repos.find((r) => url.pathname.endsWith(r.id));
  else if (url.pathname.startsWith('/api/governance/'))
    data = { role: 'Tourist', districtRole: null };
  else return route.fulfill({ status: 404, json: { error: 'No fixture' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/studio/engine');
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-neighborhoods', '3');
  await page.getByRole('button', { name: /Archive courier Carry/ }).click();
  const visited = new Set();
  for (let stop = 0; stop < 4; stop++) {
    const action = page.locator('.mission-hud .primary');
    await expect(page.getByRole('region', { name: 'Active service round' })).toBeVisible();
    console.log(
      'Cross-city stop',
      stop + 1,
      await page.locator('.mission-hud p').first().innerText(),
    );
    if (await action.isDisabled())
      await page.getByRole('button', { name: 'Follow streets to stop' }).click();
    await expect(action).toBeEnabled({ timeout: 120000 });
    if (stop < 3) {
      const address = await page.locator('.mission-hud p').first().innerText();
      const district = address.split('/').slice(0, 2).join('/');
      await expect(page).toHaveURL(new RegExp('/' + district + '$'), { timeout: 15000 });
    }
    visited.add(new URL(page.url()).pathname);
    if (stop === 2) await page.screenshot({ path: '/private/tmp/gitcity-cross-city-courier.png' });
    await action.click();
    if (stop < 3) await expect(page.locator('.mission-progress .current')).toHaveCount(stop + 2);
  }
  expect(visited.size).toBeGreaterThanOrEqual(3);
  await expect(page.locator('.service-report')).toContainText('Round complete');
  await expect(page.locator('.service-standing')).toContainText('60 reputation');
  await page.reload();
  await expect(page.locator('.service-standing')).toContainText('60 reputation');
  expect(errors).toEqual([]);
  console.log(
    'PASS: cross-neighborhood courier, three repository URLs, preserved mission, physical delivery, return to civic depot and persistent reward.',
    [...visited],
  );
} catch (error) {
  await page.screenshot({ path: '/private/tmp/gitcity-cross-city-failure.png' });
  console.error(
    await page
      .locator('.mission-hud')
      .innerText()
      .catch(() => 'No mission HUD'),
    errors,
  );
  throw error;
} finally {
  await browser.close();
  store.db.close();
}
