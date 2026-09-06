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
  else if (url.pathname.startsWith('/api/district/')) data = { directory: 'src', files, total: 18 };
  else return route.fulfill({ status: 404, json: { error: 'Test endpoint not found' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010');
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'A world built by all of us.' })).toBeVisible();
  await expect
    .poll(async () => Number(await page.locator('canvas').getAttribute('data-structures')))
    .toBeGreaterThan(0);
  await page.screenshot({ path: '/private/tmp/gitcity-mesh-home.png' });
  await page.getByRole('button', { name: 'Find your city' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.getByLabel('GitHub destination').fill('not a repo');
  await page.getByRole('button', { name: 'Visit destination' }).click();
  await expect(page.locator('.form-error')).toContainText('Enter a GitHub');
  await page.getByLabel('GitHub destination').fill('https://github.com/test/city');
  await page.getByRole('button', { name: 'Visit destination' }).click();
  await expect(page).toHaveURL(/\/test\/city$/);
  await expect(page.getByRole('button', { name: 'Walk the streets' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Visit city hall' }).click();
  await expect(page.getByRole('link', { name: /Improve keyboard navigation/ })).toBeVisible();
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Next landmark' }).click();
  await expect(page.locator('.tour-target')).toBeVisible();
  await page.getByRole('button', { name: 'Bird’s-eye view' }).click();
  await page.screenshot({ path: '/private/tmp/gitcity-upgraded-overview.png' });
  await expect(page.locator('canvas')).toHaveAttribute('data-geometry', 'mesh');
  const count = await page.locator('canvas').getAttribute('data-construction-count');
  await page.getByRole('button', { name: 'Walk the streets' }).click();
  await page.getByRole('button', { name: 'Bird’s-eye view' }).click();
  await expect(page.locator('canvas')).toHaveAttribute('data-construction-count', count);
  await page.getByRole('button', { name: /Buildings 18/ }).click();
  await page.getByRole('button', { name: /src\/module-0.ts/ }).click();
  await expect(page).toHaveURL(/src\/module-0.ts$/);
  await expect(page.locator('.source-code')).toContainText('return 42');
  await expect(page.locator('.building-plaque').first()).toContainText('contributor');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.screenshot({ path: '/private/tmp/gitcity-street.png' });
  await page.goBack();
  await expect(page).toHaveURL(/\/test\/city$/);
  await expect(page.locator('canvas')).toHaveCount(1);
  await expect(page.locator('.field-summary')).toContainText('1 source buildings');
  await page.reload();
  await expect(page.locator('.field-summary')).toContainText('1 source buildings');
  await page.getByRole('button', { name: 'Walk the streets' }).click();
  await page.waitForTimeout(500);
  await page.screenshot({ path: '/private/tmp/gitcity-upgraded-street.png' });
  await page.keyboard.press('w');
  await page.getByRole('button', { name: 'Back to the world' }).click();
  await expect(page).toHaveURL('http://localhost:3010/');
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('sign-in is configured');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('http://localhost:3010/test/city/src/module-0.ts');
  await expect(page.locator('.source-code')).toContainText('return 42');
  await page.getByRole('button', { name: 'Close dialog' }).click();
  await expect(page.locator('canvas')).toHaveCount(1);
  await page.screenshot({ path: '/private/tmp/gitcity-mobile-direct.png' });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.goto('http://localhost:3010/city?repo=test%2Fcity');
  await expect(page).toHaveURL(/\/test\/city$/);
  await page.getByRole('button', { name: 'test', exact: true }).click();
  await expect(page).toHaveURL(/\/test$/);
  await expect(page.locator('.owner-list')).toContainText('city');
  expect(errors).toEqual([]);
  console.log(
    'PASS: world, search validation, repo, source interior, hall, tourist passport, history, legacy links, owner route, phone direct link, one persistent canvas, no runtime errors.',
  );
} catch (error) {
  console.error('Browser runtime errors:', errors);
  throw error;
} finally {
  await browser.close();
}
