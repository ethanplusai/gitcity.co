import { landCandidates } from '../shared/city-plan.mjs';
import { chromium, expect as baseExpect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
const expect = baseExpect.configure({ timeout: 20000 });
const snapshots = JSON.parse(await readFile('server/atlas.json', 'utf8'));
const files = snapshots[0].files.slice(0, 18).map((f, i) => ({
  ...f,
  path: `src/module-${i}.ts`,
  lastCommit: '2026-09-04T12:00:00Z',
  contributor: 'contributor',
}));
const fixture = {
  ...snapshots[0],
  id: 'test/city',
  name: 'city',
  description: 'A verified-source test fixture',
  language: 'TypeScript',
  stars: 321,
  forks: 20,
  openPRs: 2,
  ci: 'success',
  files,
  totalFiles: 18,
  truncated: false,
  directories: [{ name: 'src', count: 18 }],
  commits: [
    {
      sha: 'commit-one',
      message: 'Build the public archive',
      date: '2026-09-04T12:00:00Z',
      author: 'contributor',
    },
  ],
  dependencies: [{ name: 'react', repo: 'facebook/react' }],
  issues: [
    {
      number: 12,
      title: 'Improve keyboard navigation',
      url: 'https://github.com/test/city/issues/12',
    },
  ],
  defaultBranch: 'main',
  historyCoverage: 'Test fixture, 18 parsed sources',
  timezone: 0,
  codeowners: '/src/ @contributor',
  coordinates: { x: 95, z: 30 },
  residents: [{ login: 'contributor', path: 'src/module-0.ts', pr: 5 }],
  civic: [],
  treasury: 10,
};
if (process.env.GITCITY_PLAN === '1') {
  fixture.city = { x: 95, z: 30 };
  fixture.landPlan = {
    version: 2,
    city: fixture.city,
    anchor: fixture.coordinates,
    blocks: landCandidates('test', { x: 0, z: 0 }, new Set(), 3).map((cell, block) => ({
      ...cell,
      block,
    })),
  };
}
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args:
    process.env.GITCITY_GPU === 'metal'
      ? ['--use-angle=metal']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date(process.env.GITCITY_TIME || '2026-09-05T16:00:00Z'));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text()))
    errors.push(message.text());
});
let releaseAtlas;
const destination = {
  ...fixture,
  id: 'facebook/react',
  name: 'react',
  dependencies: [],
  coordinates: { x: 500, z: 30 },
  city: { x: 500, z: 30 },
  landPlan: {
    ...fixture.landPlan,
    city: { x: 500, z: 30 },
    anchor: { x: 500, z: 30 },
    blocks: landCandidates('facebook', { x: 0, z: 0 }, new Set(), 3).map((cell, block) => ({
      ...cell,
      block,
    })),
  },
};
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname === '/api/atlas') {
    await new Promise((resolve) => {
      releaseAtlas = resolve;
    });
    data = [destination];
    if (process.env.GITCITY_TRAFFIC_CONTINUITY === '1') data.unshift({
      ...fixture, id: 'test/neighbor', name: 'neighbor', dependencies: [],
      landPlan: { ...fixture.landPlan, blocks: landCandidates('test', {x:0,z:0}, new Set(fixture.landPlan.blocks.map((b) => `${b.column}:${b.row}`)), 3).map((cell, block) => ({...cell,block})) },
    });
  } else if (url.pathname.startsWith('/api/repos/'))
    data = url.pathname.endsWith('facebook/react') ? destination : fixture;
  else if (url.pathname.startsWith('/api/governance/'))
    data = { role: 'Tourist', districtRole: null };
  else if (url.pathname.startsWith('/api/source/'))
    data = {
      source: 'export function example() { return 42; }',
      file: files.find((f) => f.path === url.searchParams.get('path')) || files[0],
    };
  else if (url.pathname.startsWith('/api/owners/'))
    data = [{ id: 'test/city', name: 'city', language: 'TypeScript', x: 95, z: 30 }];
  else if (url.pathname.startsWith('/api/district/')) data = { directory: 'src', files, total: 18 };
  else return route.fulfill({ status: 404, json: { error: 'Test endpoint not found' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/test/city');
  const canvas = page.locator('canvas');
  await expect(canvas).toHaveAttribute('data-dependency-terminals', '1');
  await expect(canvas).toHaveAttribute('data-traffic-destinations', '19');
  await expect(canvas).toHaveAttribute('data-structures', '18');
  await expect(canvas).toHaveAttribute('data-animating', '0');
  let vehiclePositions;
  if (process.env.GITCITY_TRAFFIC_CONTINUITY === '1') {
    await page.getByRole('button', { name: 'Pause street life', exact: true }).click();
    vehiclePositions = await canvas.evaluate((c) => c.readTrafficState().vehicles.actors.map((a) => a.position));
    expect(vehiclePositions.length).toBeGreaterThan(0);
  }
  releaseAtlas();
  await expect(canvas).toHaveAttribute('data-dependency-terminals', '2');
  await expect(canvas).toHaveAttribute('data-traffic-destinations', process.env.GITCITY_TRAFFIC_CONTINUITY === '1' ? '56' : '38');
  if (vehiclePositions) {
    const after = await canvas.evaluate((c) => c.readTrafficState().vehicles.actors.map((a) => a.position));
    expect(after).toEqual(vehiclePositions);
  }
  await expect(canvas).toHaveAttribute('data-dependency-routes', '1');
  await expect(canvas).toHaveAttribute('data-structures', '18');
  await expect(canvas).toHaveAttribute('data-animating', '0');
  await page.screenshot({ path: '/private/tmp/gitcity-highway-refresh.png' });
  await page.getByRole('button', { name: 'Bird’s-eye view', exact: true }).click();
  await page.waitForTimeout(700);
  const roadPoints = await canvas.evaluate((c) => c.projectHighwayPoints().filter((p) => document.elementFromPoint(p.x, p.y) === c));
  expect(roadPoints.length).toBeGreaterThan(0);
  // Sample the rendered road in the current camera instead of assuming a pixel.
  await page.mouse.click(roadPoints[0].x, roadPoints[0].y);
  const choices = page.getByRole('dialog', { name: 'Dependency destinations' });
  await expect(choices).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.mouse.move(1050, 350);
  await page.mouse.down();
  await page.mouse.move(1110, 375, { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(700);
  const rotatedPoints = await canvas.evaluate((c) => c.projectHighwayPoints().filter((p) => document.elementFromPoint(p.x, p.y) === c));
  expect(rotatedPoints.length).toBeGreaterThan(0);
  await page.mouse.click(rotatedPoints[0].x, rotatedPoints[0].y);
  await expect(choices).toBeVisible();
  await expect(
    choices.getByRole('button', { name: /facebook/ }).filter({ hasText: 'Visit' }),
  ).toBeVisible();
  if (process.env.GITCITY_HIGHWAY_WALK === '1') {
    await choices.getByRole('button', { name: 'Walk to facebook/react', exact: true }).click();
    await page.waitForTimeout(1500);
    await page.evaluate(() => {
      window.travelSample = { max: 0, last: null };
      window.travelTimer = setInterval(() => {
        const c = document.querySelector('canvas');
        const point = [
          Number(c.dataset.cameraX),
          Number(c.dataset.cameraHeight),
          Number(c.dataset.cameraZ),
        ];
        if (window.travelSample.last)
          window.travelSample.max = Math.max(
            window.travelSample.max,
            Math.hypot(...point.map((v, i) => v - window.travelSample.last[i])),
          );
        window.travelSample.last = point;
      }, 100);
    });
    await expect(page).toHaveURL('http://localhost:3010/facebook/react', { timeout: 180000 });
    await expect(canvas).toHaveAttribute('data-active-repo', 'facebook/react');
    const movement = await page.evaluate(() => {
      clearInterval(window.travelTimer);
      return window.travelSample.max;
    });
    expect(movement).toBeLessThan(3);
    await expect
      .poll(async () =>
        Math.abs(
          Number(await canvas.getAttribute('data-camera-height')) -
            Number(await canvas.getAttribute('data-camera-floor')),
        ),
      )
      .toBeLessThan(0.03);
    await page.screenshot({ path: '/private/tmp/gitcity-highway-arrival.png' });
    console.log('Continuous highway arrival, largest sampled camera step:', movement);
  } else {
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
    await page.getByRole('button', { name: 'Dependency destinations', exact: true }).click();
    await expect(choices).toBeVisible();
    await choices.getByRole('button', { name: 'Walk to facebook/react', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-highway-destination', 'facebook/react');
    const journey = page.getByRole('region', { name: 'Highway journey' });
    await expect(journey).toContainText('facebook/react');
    await expect(journey).toContainText('remaining');
    const bounds = await journey.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await expect(page.locator('.repo-panel')).not.toBeVisible();
    await expect(page.getByRole('button', { name: 'Walk forward', exact: true })).toBeVisible();
    await page.screenshot({ path: '/private/tmp/gitcity-phone-highway-journey.png' });

    const forward = await page
      .getByRole('button', { name: 'Walk forward', exact: true })
      .boundingBox();
    await page.mouse.move(forward.x + forward.width / 2, forward.y + forward.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(250);
    await page.mouse.up();
    await expect(canvas).toHaveAttribute('data-highway-destination', '');
    await expect(journey).not.toBeVisible();
    await expect(page.locator('.repo-panel')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Walk forward', exact: true })).toBeVisible();
    const stopped = await canvas.evaluate((c) => [
      Number(c.dataset.cameraX),
      Number(c.dataset.cameraZ),
    ]);
    await page.waitForTimeout(500);
    const released = await canvas.evaluate((c) => [
      Number(c.dataset.cameraX),
      Number(c.dataset.cameraZ),
    ]);
    expect(Math.hypot(released[0] - stopped[0], released[1] - stopped[1])).toBeLessThan(0.05);
    await expect(page).toHaveURL('http://localhost:3010/test/city');
    await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
    await page.getByRole('button', { name: 'Dependency destinations', exact: true }).click();
    await choices.getByRole('button', { name: 'Walk to facebook/react', exact: true }).click();
    await page.getByRole('button', { name: 'Stop walking', exact: true }).click();
    await expect(journey).not.toBeVisible();
    await expect(canvas).toHaveAttribute('data-highway-destination', '');
    await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
    await page.getByRole('button', { name: 'Dependency destinations', exact: true }).click();

    await choices
      .getByRole('button', { name: /facebook/ })
      .filter({ hasText: 'Visit' })
      .click();
    await expect(page).toHaveURL('http://localhost:3010/facebook/react');
    await expect(page.getByRole('heading', { name: 'react', exact: true })).toBeVisible();
  }
  await expect(canvas).toHaveAttribute('data-dependency-routes', '1');
  await expect(canvas).toHaveAttribute('data-dependency-terminals', '2');
  await page.getByRole('button', { name: 'Gitcity world', exact: true }).click();
  await expect(page).toHaveURL('http://localhost:3010/');
  await expect(canvas).toHaveAttribute('data-dependency-routes', '1');
  await expect(canvas).toHaveAttribute('data-dependency-terminals', '2');
  await expect(canvas).toHaveAttribute('data-highway-meshes', '3');
  expect(errors).toEqual([]);
  console.log(
    'PASS: delayed highway terminal refresh, settled active district, camera-projected road picking before/after orbit, phone selector, chosen repository navigation and retained visible highway meshes in world view.',
  );
} finally {
  await browser.close();
}
