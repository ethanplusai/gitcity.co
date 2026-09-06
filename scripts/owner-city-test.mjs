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
    reducedMotion: process.env.GITCITY_ARRIVAL === '1' ? 'no-preference' : 'reduce',
  }),
  errors = [];
await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text());
});
let releaseDirectory, releaseDetail;
const directoryGate = new Promise((resolve) => (releaseDirectory = resolve));
const detailGate = new Promise((resolve) => (releaseDetail = resolve));
let surveyCamera;
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  if (process.env.GITCITY_ARRIVAL === '1') {
    if (url.pathname === '/api/owners/vuejs') return route.fulfill({ json: [] });
    if (url.pathname === '/api/owners/studio') await directoryGate;
    if (url.pathname.startsWith('/api/repos/studio/')) await detailGate;
  }
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
  await page.goto('http://localhost:3010/studio');
  if (process.env.GITCITY_ARRIVAL === '1') {
    await expect(page.locator('.city-arrival')).toBeVisible();
    await page.screenshot({ path: '/private/tmp/gitcity-arrival-blueprint.png' });
    releaseDirectory();
    await expect(page.locator('.city-arrival')).toHaveCount(0);
    await expect
      .poll(async () => Number(await page.locator('canvas').getAttribute('data-survey-districts')))
      .toBeGreaterThanOrEqual(9);
    await expect(page.locator('canvas')).toHaveAttribute('data-camera-destination-height', '', {
      timeout: 20000,
    });
    await page.mouse.move(1050, 450);
    await page.mouse.down();
    await page.mouse.move(1110, 490, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(1800);
    surveyCamera = await page
      .locator('canvas')
      .evaluate((c) => [c.dataset.cameraX, c.dataset.cameraZ, c.dataset.cameraHeight]);
    await page.screenshot({ path: '/private/tmp/gitcity-arrival-survey.png' });
    releaseDetail();
    await expect
      .poll(async () => Number(await page.locator('canvas').getAttribute('data-animating')), {
        timeout: 20000,
      })
      .toBeGreaterThan(0);
  }
  await expect(page.locator('.owner-list button')).toHaveCount(3);
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-street-groups', '1');
  await expect
    .poll(async () =>
      Number(await page.locator('canvas').getAttribute('data-pavement-worker-builds')),
    )
    .toBeGreaterThan(0);
  if (process.env.GITCITY_ARRIVAL === '1') {
    const settled = await page
      .locator('canvas')
      .evaluate((c) => [c.dataset.cameraX, c.dataset.cameraZ, c.dataset.cameraHeight].map(Number));
    expect(Math.hypot(...settled.map((value, i) => value - Number(surveyCamera[i])))).toBeLessThan(
      0.05,
    );
  }
  const hallId = await page.locator('canvas').getAttribute('data-owner-hall-id');
  expect(hallId).toBeTruthy();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/private/tmp/gitcity-connected-owner.png' });
  if (process.env.GITCITY_PREVIEW_LOD === '1') {
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-pending-preview-batches', '0');
    const constructed = await canvas.getAttribute('data-construction-count');
    const rebuilt = await canvas.getAttribute('data-owner-rebuilds');
    await page.mouse.move(1050, 450);
    await page.mouse.wheel(0, 6000);
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-massing-previews')))
      .toBe(3);
    await page.mouse.wheel(0, -6000);
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-detailed-previews')))
      .toBeGreaterThan(0);
    await expect(canvas).toHaveAttribute('data-construction-count', constructed);
    await expect(canvas).toHaveAttribute('data-owner-rebuilds', rebuilt);
    console.log(
      'PASS: preview facades release at distance and restore near the camera without construction or street rebuilds.',
    );
  }

  await page.locator('.owner-list button').filter({ hasText: 'engine' }).click();
  await expect(page.getByRole('button', { name: 'Walk the streets' })).toBeVisible();
  await expect(page.locator('.repo-stats')).not.toContainText(/NaN|undefined/);
  await expect(page.locator('.repo-stats').getByText('—', { exact: true })).toBeVisible();
  await expect(page.locator('.city-condition')).toContainText('No commit status reported');
  await expect(page.locator('.coverage')).toContainText('History coverage unavailable');
  await page.getByRole('button', { name: 'Walk the streets' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-street-groups', '1');
  const construction = await page.locator('canvas').getAttribute('data-construction-count');
  await page.getByRole('button', { name: 'Bird’s-eye view' }).click();
  await page.getByRole('button', { name: 'Walk the streets' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-construction-count', construction);
  await expect(page.locator('canvas')).toHaveAttribute('data-camera-destination-height', '', {
    timeout: 20000,
  });
  await page.screenshot({ path: '/private/tmp/gitcity-connected-owner-street.png' });
  await expect(page.getByRole('button', { name: 'Walk to interface', exact: true })).toBeVisible();
  await page.evaluate(() => {
    window.cityTravel = { maxStep: 0, last: null };
    window.cityTravelTimer = setInterval(() => {
      const c = document.querySelector('canvas');
      if (!c) return;
      const p = [
        Number(c.dataset.cameraX),
        Number(c.dataset.cameraHeight),
        Number(c.dataset.cameraZ),
      ];
      const state = window.cityTravel;
      if (state.last)
        state.maxStep = Math.max(state.maxStep, Math.hypot(...p.map((v, i) => v - state.last[i])));
      state.last = p;
    }, 100);
  });
  if (process.env.GITCITY_WALK_SOUND === '1') {
    await page.evaluate(() => {
      window.walkingSteps = 0;
      const start = AudioBufferSourceNode.prototype.start;
      AudioBufferSourceNode.prototype.start = function (...args) {
        if (this.buffer && this.buffer.duration < 0.2) window.walkingSteps++;
        return start.apply(this, args);
      };
    });
    await page.getByRole('button', { name: 'Enable ambient sound', exact: true }).click();
  }
  await page.getByRole('button', { name: 'Walk to interface', exact: true }).click();
  if (process.env.GITCITY_WALK_GUIDANCE === '1') {
    const guidance = page.getByRole('region', { name: 'Walking route', exact: true });
    await expect(guidance).toContainText('studio/interface');
    await expect(guidance).toContainText(/\d+ m along the streets/);
    if (process.env.GITCITY_WALK_SOUND === '1')
      await expect.poll(() => page.evaluate(() => window.walkingSteps)).toBeGreaterThan(1);
    await page.setViewportSize({ width: 390, height: 844 });
    const bounds = await guidance.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: '/private/tmp/gitcity-walking-guidance-phone.png' });
    await guidance.getByRole('button', { name: 'Stop walking', exact: true }).click();
    await expect(guidance).toHaveCount(0);
    if (process.env.GITCITY_WALK_SOUND === '1') {
      const stoppedSteps = await page.evaluate(() => window.walkingSteps);
      await page.waitForTimeout(700);
      expect(await page.evaluate(() => window.walkingSteps)).toBe(stoppedSteps);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole('button', { name: 'Walk to interface', exact: true }).click();
    await expect(guidance).toBeVisible();
  }
  await expect(page).toHaveURL(/studio\/interface$/, { timeout: 90000 });
  await expect(page.locator('canvas')).toHaveAttribute('data-active-repo', 'studio/interface');
  const maxStep = await page.evaluate(() => {
    clearInterval(window.cityTravelTimer);
    return window.cityTravel.maxStep;
  });
  expect(maxStep).toBeLessThan(3);
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-street-groups', '1');
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-hall-id', hallId);
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-hall-builds', '1');
  console.log('Walked into interface without camera teleport; largest sampled step', maxStep);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3010/studio/interface');
  if (page.viewportSize().width < 700)
    await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Walk the streets' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-street-groups', '1');
  await expect(page.locator('canvas')).toHaveAttribute('data-owner-neighborhoods', '3');
  await page.waitForTimeout(1000);
  await expect(page.locator('canvas')).toHaveCount(1);
  expect(errors).toEqual([]);
  console.log(
    'PASS: three adjacent repositories, one shared owner street group, owner/district views, repeat-safe construction, phone shared link, no rendering errors.',
  );
} catch (error) {
  console.error('Runtime errors', errors);
  throw error;
} finally {
  await browser.close();
  store.db.close();
}
