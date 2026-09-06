import { landCandidates } from '../shared/city-plan.mjs';
import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
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
  viewport: { width: 850, height: 850 },
  reducedMotion: 'reduce',
});
const page = await context.newPage();
await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
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
  await page.goto('http://localhost:3010/test/city');
  await page.getByRole('button', { name: /Archive courier Carry/ }).click();
  await expect(page.getByRole('region', { name: 'Active service round' })).toBeVisible();
  for (let stop = 0; stop < 4; stop++) {
    console.log('Visiting service stop', stop + 1);
    const action = page.locator('.mission-hud .primary');
    if (await action.isDisabled())
      await page.getByRole('button', { name: 'Follow streets to stop' }).click();
    await expect(action).toBeEnabled({ timeout: 90000 });
    if (stop === 0) await page.screenshot({ path: '/private/tmp/gitcity-dispatch.png' });
    await action.click();
    if (stop < 3) await expect(page.locator('.mission-progress .current')).toHaveCount(stop + 2);
  }
  await expect(page.locator('.service-report')).toContainText('Round complete');
  await expect(page.locator('.service-standing')).toContainText('60 reputation');
  await page.reload();
  await expect(page.locator('.service-standing')).toContainText('60 reputation');
  await page.getByRole('button', { name: /Street survey Survey/ }).click();
  await page.getByRole('button', { name: 'Abandon service round' }).click();
  await expect(page.locator('.service-standing')).toContainText('60 reputation');
  expect(errors).toEqual([]);
  console.log(
    'PASS: four-stop service round, physical travel, proximity gating, completion, persistence, cancellation without reward, no WebGL errors.',
  );
} catch (error) {
  console.error(
    await page
      .locator('.mission-hud')
      .innerText()
      .catch(() => 'No mission HUD'),
  );
  throw error;
} finally {
  await browser.close();
}
