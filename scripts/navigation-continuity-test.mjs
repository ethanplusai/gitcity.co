import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openStore } from '../server/store.mjs';
const store = openStore(':memory:');
const sample = JSON.parse(await readFile('server/atlas.json', 'utf8'))[0];
const make = (id) => ({
  ...sample,
  id,
  name: id.split('/')[1],
  files: sample.files.slice(0, 12),
  city: store.locateOwner(id.split('/')[0]),
  coordinates: store.locate(id),
  landPlan: store.reserveLand(id, 2),
  dependencies: [],
  commits: [],
  civic: [],
  residents: [],
  issues: [],
  openPRs: 0,
});
const source = make('continuity/source');
const home = make('vercel/next.js');
const destination = make('facebook/destination');
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal'],
});
let releaseHome, releaseCity;
const homeGate = new Promise((r) => {
  releaseHome = r;
});
const cityGate = new Promise((r) => {
  releaseCity = r;
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/session')
      return route.fulfill({ json: { configured: false, player: null } });
    if (path === '/api/atlas') {
      await homeGate;
      return route.fulfill({ json: [home] });
    }
    if (path === '/api/owners/facebook')
      return route.fulfill({
        json: [
          {
            id: destination.id,
            name: destination.name,
            ...destination.coordinates,
            city: destination.city,
          },
        ],
      });
    if (path.startsWith('/api/owners/')) return route.fulfill({ json: [] });
    if (path === '/api/repos/' + source.id) return route.fulfill({ json: source });
    if (path === '/api/repos/' + destination.id) {
      await cityGate;
      return route.fulfill({ json: destination });
    }
    if (path.startsWith('/api/governance/')) return route.fulfill({ json: { role: 'Tourist' } });
    return route.fulfill({ status: 404, json: { error: 'No fixture' } });
  });
  await page.goto((process.env.GITCITY_TEST_URL || 'http://localhost:3015') + '/' + source.id);
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-active-repo', source.id, { timeout: 30000 });
  await expect(page.locator('.city-arrival')).toHaveCount(0);
  await page.getByRole('button', { name: 'Gitcity world', exact: true }).click();
  await expect.poll(() => canvas.getAttribute('data-detailed-previews')).not.toBe('0');
  const position = () =>
    canvas.evaluate((c) => [Number(c.dataset.cameraX), Number(c.dataset.cameraZ)]);
  const sourcePosition = await position();
  expect(
    Math.hypot(sourcePosition[0] - source.coordinates.x, sourcePosition[1] - source.coordinates.z),
  ).toBeLessThan(200);
  await expect(page.getByRole('link', { name: 'GitHub', exact: true })).toHaveAttribute(
    'href',
    'https://github.com/ethanplusai/gitcity.co',
  );
  await expect(page.getByRole('link', { name: 'Created by Ethan' })).toHaveAttribute(
    'href',
    'https://x.com/ethanplusai',
  );
  await page.locator('.city-card').filter({ hasText: 'facebook' }).click();
  await expect(page.locator('.owner-list')).toContainText('destination');
  await page.waitForTimeout(500);
  expect(await position()).toEqual(sourcePosition);
  releaseCity();
  await expect(page.locator('.city-arrival')).toHaveCount(0, { timeout: 30000 });
  expect(await position()).not.toEqual(sourcePosition);
  releaseHome();
  await page.getByRole('button', { name: 'Gitcity world', exact: true }).click();
  await expect(page.locator('.city-arrival')).toHaveCount(0, { timeout: 30000 });
  await page.setViewportSize({ width: 390, height: 844 });
  for (const name of ['GitHub', 'Created by Ethan']) {
    const link = page.getByRole('link', { name, exact: true });
    await expect(link).toBeVisible();
    const box = await link.boundingBox();
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(390);
    expect(box.y + box.height).toBeLessThanOrEqual(100);
  }
  await page.screenshot({ path: '.vercel/live-audit/navigation-mobile-fixed.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: delayed home and organization transitions retain constructed city; destination arrives; header links remain visible on mobile.',
  );
} finally {
  releaseHome();
  releaseCity();
  await browser.close();
  store.db.close();
}
