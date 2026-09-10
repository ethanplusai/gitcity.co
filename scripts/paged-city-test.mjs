import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openStore } from '../server/store.mjs';

const store = openStore(':memory:');
const sample = JSON.parse(await readFile('server/atlas.json', 'utf8'))[0];
const cities = Array.from({ length: 200 }, (_, index) => {
  const id = `paged-studio/repo-${index}`;
  return {
    id,
    name: `repo-${index}`,
    stars: 200 - index,
    ...store.locate(id),
    city: { owner: 'paged-studio', ...store.locateOwner('paged-studio') },
  };
});
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
let release;
const laterPage = new Promise((resolve) => {
  release = resolve;
});
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (url.pathname === '/api/session')
    return route.fulfill({ json: { configured: false, player: null } });
  if (url.pathname.startsWith('/api/owners/')) {
    const number = Number(url.searchParams.get('page'));
    if (number === 2) await laterPage;
    return route.fulfill({
      json: {
        cities: cities.slice(number === 2 ? 100 : 0, number === 2 ? 200 : 100),
        nextPage: number === 1 ? 2 : null,
      },
    });
  }
  if (url.pathname.startsWith('/api/repos/')) {
    const city = cities.find((city) => url.pathname.endsWith(city.id));
    const files = sample.files.slice(0, 12);
    return route.fulfill({
      json: {
        ...sample,
        ...city,
        coordinates: { x: city.x, z: city.z },
        files,
        totalFiles: files.length,
        directories: [{ name: 'src', count: files.length }],
        landPlan: store.reserveLand(city.id, 2),
        commits: [],
        dependencies: [],
        issues: [],
        openPRs: 0,
        civic: [],
        residents: [],
      },
    });
  }
  return route.fulfill({ status: 404, json: { error: 'No fixture' } });
});
try {
  await page.goto((process.env.GITCITY_TEST_URL || 'http://localhost:3015') + '/paged-studio');
  const canvas = page.locator('canvas');
  await expect
    .poll(() => canvas.getAttribute('data-construction-count'), { timeout: 30000 })
    .not.toBe('0');
  await expect(page.locator('.city-arrival')).toHaveCount(0, { timeout: 30000 });
  await expect(
    page.getByRole('button', { name: 'Show more neighborhoods (40 more)' }),
  ).toBeVisible();
  release();
  await expect(
    page.getByRole('button', { name: 'Show more neighborhoods (140 more)' }),
  ).toBeVisible();
  await expect(page.locator('.owner-list button')).toHaveCount(61);
  expect(Number(await canvas.getAttribute('data-survey-districts'))).toBeLessThan(20);
  expect(await page.locator('.map-label').count()).toBeLessThan(40);
  expect(errors).toEqual([]);
  console.log(
    'PASS: city visible before delayed directory page; 200 repos do not allocate 200 grids, labels, or sidebar rows.',
  );
} finally {
  release();
  await browser.close();
  store.db.close();
}
