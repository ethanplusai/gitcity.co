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
      labels: ['bug'],
      body: 'Keyboard focus gets lost in src/module-0.ts.',
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
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const errors = [];
let issueState = 'open';
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.log('PAGE ERROR', e.message);
});
page.on('console', (message) => {
  if (message.type() === 'error' && /THREE|shader|WebGL/i.test(message.text()))
    errors.push(message.text());
});
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname === '/api/atlas') data = snapshots;
  else if (url.pathname.startsWith('/api/issues/'))
    data = { number: 12, state: issueState, updatedAt: '2026-09-05T20:00:00Z' };
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
  await page.clock.setFixedTime(new Date('2026-09-06T03:00:00Z'));
  await page.goto('http://localhost:3010/test/city');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toBeVisible({ timeout: 30000 });
  await page.screenshot({ path: '/private/tmp/gitcity-camera-model-initial.png' });
  if (await page.getByRole('button', { name: 'Expand city details', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
  await page.getByRole('button', { name: 'Walk the streets', exact: true }).click();
  await expect(canvas).toHaveAttribute('data-street-models', '4', { timeout: 30000 });
  await page.waitForTimeout(3500);
  const before = Number(await canvas.getAttribute('data-camera-height'));
  for (const [x, y] of [
    [600, 500],
    [420, 760],
    [690, 130],
    [410, 400],
  ]) {
    await page.mouse.move(600, 450);
    await page.mouse.down();
    await page.mouse.move(x, y, { steps: 18 });
    await page.mouse.up();
    await page.waitForTimeout(150);
    const h = Number(await canvas.getAttribute('data-camera-height')),
      f = Number(await canvas.getAttribute('data-camera-floor'));
    expect(h).toBeGreaterThanOrEqual(f - 0.001);
    expect(Math.abs(h - before)).toBeLessThan(0.01);
  }
  await page.mouse.wheel(0, -2500);
  await page.waitForTimeout(500);
  expect(Number(await canvas.getAttribute('data-camera-height'))).toBeGreaterThanOrEqual(
    Number(await canvas.getAttribute('data-camera-floor')) - 0.001,
  );
  if (await page.getByRole('button', { name: 'Expand city details', exact: true }).isVisible())
    await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
  await page.getByRole('button', { name: 'Bird’s-eye view' }).click();
  await page.waitForTimeout(3000);
  await page.mouse.move(680, 450);
  await page.mouse.down({ button: 'right' });
  await page.mouse.move(660, 780, { steps: 20 });
  await page.mouse.up({ button: 'right' });
  await page.mouse.wheel(0, -4000);
  await page.waitForTimeout(1500);
  expect(Number(await canvas.getAttribute('data-camera-height'))).toBeGreaterThanOrEqual(
    Number(await canvas.getAttribute('data-camera-floor')) - 0.001,
  );
  await page.getByRole('button', { name: 'Walk the streets', exact: true }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({ path: '/private/tmp/gitcity-authored-night.png' });
  expect(errors).toEqual([]);
  console.log(
    'PASS: authored models loaded, GPU morph animation, walking drag preserves eye height, wheel and orbit pan remain above terrain, no shader errors.',
  );
} finally {
  await browser.close();
}
