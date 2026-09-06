import { sourcePage } from '../shared/source-pages.mjs';
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
const allFiles = Array.from({ length: 338 }, (_, i) => ({
  ...files[0],
  path: `src/module-${i}.ts`,
}));
fixture.directories = [{ name: 'src', count: 338 }];
fixture.totalFiles = 338;
fixture.openPRs = 0;
fixture.stars = 5;
{
  fixture.city = { x: 95, z: 30 };
  fixture.landPlan = {
    version: 2,
    city: fixture.city,
    anchor: fixture.coordinates,
    blocks: landCandidates('test', { x: 0, z: 0 }, new Set(), 32).map((cell, block) => ({
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
  reducedMotion: process.env.GITCITY_MOTION === '1' ? 'no-preference' : 'reduce',
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date(process.env.GITCITY_TIME || '2026-09-05T16:00:00Z'));
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (message) => {
  if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text()))
    errors.push(message.text());
});
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname === '/api/atlas') data = snapshots;
  else if (url.pathname.startsWith('/api/repos/')) data = fixture;
  else if (url.pathname.startsWith('/api/governance/'))
    data = { role: 'Tourist', districtRole: null };
  else if (url.pathname.startsWith('/api/source/'))
    data = {
      source: 'export function example() { return 42; }',
      file: files.find((f) => f.path === url.searchParams.get('path')) || files[0],
    };
  else if (url.pathname.startsWith('/api/owners/'))
    data = [{ id: 'test/city', name: 'city', language: 'TypeScript', x: 95, z: 30 }];
  else if (url.pathname.startsWith('/api/district/')) {
    const result = sourcePage(
      allFiles.filter((f) => !files.some((loaded) => loaded.path === f.path)),
      'test-ref',
      'src',
      url.searchParams.get('cursor') || '',
    );
    data = { ...result, directory: 'src', total: 338, landPlan: fixture.landPlan };
  } else return route.fulfill({ status: 404, json: { error: 'Test endpoint not found' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/test/city');
  const dismiss = page.getByRole('button', { name: 'Start exploring' });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  await expect(page.getByRole('heading', { name: 'city', exact: true })).toHaveText('city');
  // This fixture measures distant-block initialization; repo links now arrive
  // nearby, so explicitly choose the overview before expansion.
  await page.getByRole('button', { name: 'Bird’s-eye view', exact: true }).click();
  await page.getByRole('button', { name: /^Buildings/ }).click();
  const directory = page.locator('.file-list button').filter({ hasText: 'source buildings' });
  await expect(directory).toContainText('18 of 338');
  await expect(page.locator('canvas')).toHaveAttribute('data-animating', '0');
  let previousCamera;
  await expect
    .poll(
      async () => {
        const current = await page
          .locator('canvas')
          .evaluate((c) => [
            Number(c.dataset.cameraX),
            Number(c.dataset.cameraZ),
            Number(c.dataset.cameraHeight),
          ]);
        const delta = previousCamera
          ? Math.hypot(...current.map((n, i) => n - previousCamera[i]))
          : Infinity;
        previousCamera = current;
        return delta;
      },
      { intervals: [500] },
    )
    .toBeLessThan(0.005);
  const camera = await page
    .locator('canvas')
    .evaluate((c) => [c.dataset.cameraX, c.dataset.cameraZ, c.dataset.cameraHeight]);
  for (const count of [82, 146, 210, 274, 338]) {
    await directory.click();
    await expect(directory).toContainText(`${count} of 338`, { timeout: 60000 });
    await expect(page.locator('.file-list button').filter({ hasText: 'symbols' })).toHaveCount(
      count,
    );
    await expect(page.locator('canvas')).toHaveAttribute('data-structures', String(count));
    await expect(page.locator('canvas')).toHaveAttribute('data-animating', '0', { timeout: 8000 });
  }
  await expect(directory).toBeDisabled();
  const after = await page
    .locator('canvas')
    .evaluate((c) => [c.dataset.cameraX, c.dataset.cameraZ, c.dataset.cameraHeight]);
  for (let i = 0; i < 3; i++)
    if (Math.abs(Number(camera[i]) - Number(after[i])) > 0.1)
      throw new Error(`Directory expansion moved the camera: ${camera} to ${after}`);
  if (errors.length) throw new Error(errors.join('\n'));
  await expect
    .poll(async () => Number(await page.locator('canvas').getAttribute('data-batched-blocks')))
    .toBeGreaterThan(0);
  await page.screenshot({ path: '/private/tmp/gitcity-source-pages.png' });
  await expect
    .poll(async () =>
      Number(await page.locator('canvas').getAttribute('data-initial-detailed-files')),
    )
    .toBeLessThan(338);
  console.log(
    await page.locator('canvas').evaluate((c) => ({
      drawCalls: c.dataset.drawCalls,
      batchedBlocks: c.dataset.batchedBlocks,
      structures: c.dataset.structures,
      initialDetailedFiles: c.dataset.initialDetailedFiles,
    })),
  );

  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Walk the streets', exact: true }).click();
  await expect
    .poll(
      async () =>
        await page
          .locator('canvas')
          .evaluate((c) =>
            Math.abs(Number(c.dataset.cameraHeight) - Number(c.dataset.cameraFloor)),
          ),
    )
    .toBeLessThan(0.02);
  await page.screenshot({ path: '/private/tmp/gitcity-shared-buffer-street.png' });
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    'PASS: 338 source buildings through five pages, preserved earlier files and camera, completed directory disables further requests.',
  );
} finally {
  await browser.close();
}
