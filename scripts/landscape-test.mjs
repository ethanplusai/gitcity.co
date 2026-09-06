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
  timezoneId: 'America/New_York',
});
const page = await context.newPage();
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
  await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
  await page.goto('http://localhost:3010/');
  await expect(page.locator('canvas')).toHaveAttribute('data-local-phase', 'Day');
  await page.waitForTimeout(3000);
  console.log('Home budget', await page.locator('canvas').evaluate((c) => ({ ...c.dataset })));
  await page.screenshot({ path: '/private/tmp/gitcity-landscape-home.png' });
  await page.goto('http://localhost:3010/test/city');
  await expect(page.getByRole('button', { name: 'Walk the streets' })).toBeVisible();
  await expect(page.locator('canvas')).toHaveAttribute('data-local-phase', 'Day');
  await page.waitForTimeout(5000);
  await page.screenshot({ path: '/private/tmp/gitcity-landscape-day.png' });
  await page.getByRole('button', { name: 'Walk the streets' }).click();
  await page.screenshot({ path: '/private/tmp/gitcity-landscape-street.png' });
  const count = await page.locator('canvas').getAttribute('data-construction-count');
  await page.clock.setFixedTime(new Date('2026-09-06T03:00:00Z'));
  await expect(page.locator('canvas')).toHaveAttribute('data-local-phase', 'Night');
  await page.screenshot({ path: '/private/tmp/gitcity-landscape-night.png' });
  await expect(page.locator('canvas')).toHaveAttribute('data-construction-count', count);
  console.log(
    'Render diagnostics',
    await page.locator('canvas').evaluate((c) => ({ ...c.dataset })),
  );
  expect(errors).toEqual([]);
  const tokyo = await browser.newContext({
    viewport: { width: 390, height: 844 },
    timezoneId: 'Asia/Tokyo',
    reducedMotion: 'reduce',
  });
  const phone = await tokyo.newPage();
  phone.on('pageerror', (e) => errors.push(e.message));
  await phone.route('**/api/**', (route) => {
    const path = new URL(route.request().url()).pathname;
    return route.fulfill({
      json:
        path === '/api/atlas'
          ? []
          : path === '/api/session'
            ? { configured: false, player: null }
            : path.startsWith('/api/governance')
              ? { role: 'Tourist' }
              : fixture,
    });
  });
  await phone.clock.setFixedTime(new Date('2026-09-06T03:00:00Z'));
  await phone.goto('http://localhost:3010/test/city');
  await expect(phone.locator('canvas')).toHaveAttribute('data-timezone', 'Asia/Tokyo');
  await expect(phone.locator('canvas')).toHaveAttribute('data-local-phase', 'Day');
  await expect(phone.locator('canvas')).toHaveAttribute('data-local-hour', '12.00');
  await phone.getByRole('button', { name: 'Walk the streets' }).click();
  await phone.screenshot({ path: '/private/tmp/gitcity-landscape-tokyo-phone.png' });
  await tokyo.close();
  expect(errors).toEqual([]);
  console.log(
    'PASS: local noon/night and Tokyo phone rendering, unchanged construction identity, no WebGL errors.',
  );
} finally {
  await browser.close();
}
