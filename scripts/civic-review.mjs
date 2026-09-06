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
if (process.env.GITCITY_COMPRESSED === '1') {
  await page.addInitScript(() => {
    window.__compressedUploads = [];
    for (const method of ['compressedTexImage2D', 'compressedTexSubImage2D']) {
      const original = WebGL2RenderingContext.prototype[method];
      const sub = method === 'compressedTexSubImage2D';
      WebGL2RenderingContext.prototype[method] = function (...args) {
        window.__compressedUploads.push({
          level: args[1],
          format: args[sub ? 6 : 2],
          width: args[sub ? 4 : 3],
          height: args[sub ? 5 : 4],
          bytes: args[sub ? 7 : 6]?.byteLength || 0,
        });
        return original.apply(this, args);
      };
    }
  });
}
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
  await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
  await page.goto('http://localhost:3010/test/city');
  await expect(page.locator('canvas')).toHaveAttribute('data-animating', '0');
  await page.getByRole('button', { name: 'Visit city hall', exact: true }).click();
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await page.waitForTimeout(1500);
  if (process.env.GITCITY_QUALITY === '1') {
    const canvas = page.locator('canvas');
    await page.evaluate(() => {
      const request = window.requestAnimationFrame.bind(window);
      window.requestAnimationFrame = (callback) => {
        const start = performance.now();
        const deliver = (time) => {
          if (window.__slowFrames && time - start < 80) request(deliver);
          else callback(time);
        };
        return request(deliver);
      };
      window.__slowFrames = true;
    });
    await expect(canvas).toHaveAttribute('data-quality', 'adaptive-lite');
    const construction = await canvas.getAttribute('data-construction-count');
    await page.evaluate(() => {
      window.__slowFrames = false;
    });
    await expect(canvas).toHaveAttribute('data-quality', 'full', { timeout: 50000 });
    await expect(canvas).toHaveAttribute('data-construction-count', construction);
    console.log('PASS: forced slow rendering recovers full quality without reconstruction.');
  }
  if (process.env.GITCITY_COMPRESSED === '1') {
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            window.__compressedUploads.filter((item) => item.level === 0 && item.width === 1024)
              .length,
        ),
      )
      .toBeGreaterThanOrEqual(4);
    console.log(
      'Compressed uploads:',
      JSON.stringify(await page.evaluate(() => window.__compressedUploads)),
    );
  }
  await page.screenshot({ path: '/private/tmp/gitcity-civic-day.png' });
  await page.clock.setFixedTime(new Date('2026-09-06T02:00:00Z'));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/private/tmp/gitcity-civic-night.png' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: '/private/tmp/gitcity-civic-phone.png' });
  const panel = page.locator('.repo-panel');
  expect((await panel.boundingBox()).height).toBeLessThan(110);
  await expect(page.getByRole('heading', { name: 'city', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Expand city details', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Collapse city details' })).toHaveAttribute(
    'aria-expanded',
    'true',
  );
  await page.getByRole('button', { name: /^Buildings/ }).click();
  await expect(page.locator('.file-list').last()).toBeVisible();
  await page.getByRole('button', { name: 'Overview', exact: true }).click();
  await page.getByRole('button', { name: 'Walk the streets', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Expand city details' })).toHaveAttribute(
    'aria-expanded',
    'false',
  );
  await expect(page.getByRole('button', { name: 'Walk forward', exact: true })).toBeVisible();
  expect((await panel.boundingBox()).height).toBeLessThan(110);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/private/tmp/gitcity-phone-street-panel.png' });
  if (process.env.GITCITY_PHONE_SHADOWS === '1') {
    const canvas = page.locator('canvas');
    await expect(canvas).toHaveAttribute('data-shadow-map-size', '512');
    await expect(canvas).toHaveAttribute('data-directional-shadows', 'true', { timeout: 45000 });
    await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
    await page.waitForTimeout(1500);
    await page.screenshot({ path: '/private/tmp/gitcity-phone-day-shadows.png' });
    await page.getByRole('button', { name: 'View the whole city', exact: true }).click();
    await expect(canvas).toHaveAttribute('data-directional-shadows', 'false');
  }
  expect(errors).toEqual([]);
  console.log(
    'PASS: city hall day/night/phone, compact details, file access, walking controls and clean shaders.',
  );
} finally {
  await browser.close();
}
