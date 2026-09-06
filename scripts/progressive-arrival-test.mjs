import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openStore } from '../server/store.mjs';
import { coordinates } from '../shared/model.mjs';

const baseUrl = process.env.GITCITY_TEST_URL || 'http://localhost:3015';
const store = openStore(':memory:');
const sample = JSON.parse(await readFile('server/atlas.json', 'utf8'))[0];
const repos = Array.from({ length: 6 }, (_, index) => {
  const id = `arrival-studio/repo-${index}`;
  const files = sample.files.slice(0, 12);
  return {
    ...sample,
    id,
    name: `repo-${index}`,
    files,
    totalFiles: files.length,
    directories: [{ name: 'src', count: files.length }],
    commits: [],
    residents: [],
    civic: [],
    dependencies: [],
    issues: [],
    openPRs: 0,
    city: store.locateOwner('arrival-studio'),
    coordinates: store.locate(id),
    landPlan: store.reserveLand(id, 2),
    fetchedAt: '2026-09-06T12:00:00Z',
  };
});
const browser = await chromium.launch({
  channel: 'chrome',
  headless: true,
  args: ['--use-angle=metal'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const errors = [];
let atlasRequests = 0;
page.on('pageerror', (e) => errors.push(e.message));
await page.clock.setFixedTime(new Date('2026-09-06T16:00:00Z'));
let release,
  gate = new Promise((resolve) => {
    release = resolve;
  });
await page.route('**/api/**', async (route) => {
  const path = new URL(route.request().url()).pathname;
  if (path === '/api/session') return route.fulfill({ json: { configured: false, player: null } });
  if (path === '/api/atlas') {
    atlasRequests++;
    return route.fulfill({ json: [] });
  }
  if (path.startsWith('/api/owners/'))
    return route.fulfill({
      json: [
        ...repos.map((r) => ({ id: r.id, name: r.name, ...r.coordinates, city: r.city })),
        { id: 'arrival-studio/removed', name: 'removed', ...repos[0].coordinates },
      ],
    });
  if (path.startsWith('/api/repos/')) {
    const repo = repos.find((r) => path.endsWith(r.id));
    if (!repo) return route.fulfill({ status: 404, json: { error: 'Repository is unavailable' } });
    if (repo === repos[0]) await gate;
    return route.fulfill({ json: repo });
  }
  if (path.startsWith('/api/governance/')) return route.fulfill({ json: { role: 'Tourist' } });
  return route.fulfill({ status: 404, json: { error: 'No fixture' } });
});
const canvas = page.locator('canvas');
const previews = () =>
  canvas.evaluate(
    (c) => Number(c.dataset.massingPreviews || 0) + Number(c.dataset.detailedPreviews || 0),
  );
try {
  await page.goto(baseUrl + '/arrival-studio');
  await expect.poll(previews, { timeout: 60000 }).toBe(5);
  await expect(page.locator('.city-arrival')).toContainText('5 of 7');
  await expect(canvas).toHaveAttribute('data-camera-destination-height', '', { timeout: 20000 });
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(960, 480, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  const position = () =>
    canvas.evaluate((c) => [
      Number(c.dataset.cameraX),
      Number(c.dataset.cameraHeight),
      Number(c.dataset.cameraZ),
    ]);
  const before = await position();
  release();
  await expect.poll(previews, { timeout: 30000 }).toBe(6);
  await expect.poll(() => canvas.getAttribute('data-animating')).not.toBe('0');
  await expect(page.locator('.city-arrival')).toHaveCount(0);
  await expect(page.locator('.owner-list button')).toHaveCount(6);
  await expect(page.locator('.error-panel')).toContainText('arrival-studio/removed');
  const after = await position();
  expect(Math.hypot(...after.map((n, i) => n - before[i]))).toBeLessThan(1);
  await page.screenshot({ path: '/private/tmp/gitcity-progressive-owner.png' });

  // A fresh shared link has no directory metadata, then gets a permanent address
  // far away from its seed. Orbiting while it loads must follow that relocation.
  gate = new Promise((resolve) => {
    release = resolve;
  });
  await page.goto(baseUrl + '/' + repos[0].id);
  await expect(canvas).toHaveAttribute('data-active-repo', repos[0].id);
  await expect(canvas).toHaveAttribute('data-camera-destination-height', '');
  const seed = coordinates(repos[0].id);
  const initial = await position();
  expect(Math.hypot(initial[0] - seed.x, initial[2] - seed.z)).toBeLessThan(100);
  await page.mouse.move(900, 450);
  await page.mouse.down();
  await page.mouse.move(970, 480, { steps: 8 });
  await page.mouse.up();
  await page.waitForTimeout(1000);
  const dragged = await position();
  release();
  await expect(page.getByRole('button', { name: 'Walk the streets', exact: true })).toBeVisible({
    timeout: 30000,
  });
  await page.waitForTimeout(500);
  const arrived = await position();
  expect(Math.abs(arrived[0] - dragged[0] - (repos[0].coordinates.x - seed.x))).toBeLessThan(1);
  expect(Math.abs(arrived[2] - dragged[2] - (repos[0].coordinates.z - seed.z))).toBeLessThan(1);
  await expect(canvas).toHaveAttribute('data-walking', 'false');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(baseUrl + '/' + repos[1].id);
  await expect(canvas).toHaveAttribute('data-active-repo', repos[1].id);
  await expect(page.locator('.city-arrival')).toHaveCount(0, { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-camera-destination-height', '', { timeout: 20000 });
  await expect(canvas).toHaveAttribute('data-walking', 'false');
  const phonePosition = await position();
  expect(
    Math.hypot(
      phonePosition[0] - repos[1].coordinates.x,
      phonePosition[2] - repos[1].coordinates.z,
    ),
  ).toBeLessThan(150);
  expect(atlasRequests).toBe(0);
  await page.screenshot({ path: '/private/tmp/gitcity-progressive-phone.png' });
  await page.getByRole('button', { name: 'Gitcity world', exact: true }).click();
  await expect.poll(() => atlasRequests).toBe(1);
  expect(errors).toEqual([]);
  console.log(
    'PASS: six neighborhoods, independent slow response, visible construction, stable owner camera, cold-link survey and camera relocation, no automatic street view.',
  );
} finally {
  release();
  await browser.close();
  store.db.close();
}
