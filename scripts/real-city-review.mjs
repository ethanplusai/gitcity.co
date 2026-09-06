import { chromium, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';

// Live API review: no fixture interception. Captures the actual data and layout
// a shared-link visitor receives, separately from deterministic browser tests.
const origin = process.env.GITCITY_ORIGIN || 'http://localhost:3010';
const owner = process.env.GITCITY_OWNER || 'vercel';
const repo = process.env.GITCITY_REPO || 'next.js';
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=metal'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors = [],
  responses = [];
page.on('pageerror', (error) => errors.push(error.message));
page.on('response', (response) => {
  if (new URL(response.url()).pathname.startsWith('/api/'))
    responses.push({ path: new URL(response.url()).pathname, status: response.status() });
});
const captures = [];
try {
  await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
  await page.goto(`${origin}/${owner}`);
  await expect(page.locator('.owner-list button').first()).toBeVisible({ timeout: 60000 });
  await expect
    .poll(
      async () => Number(await page.locator('canvas').getAttribute('data-owner-neighborhoods')),
      { timeout: 90000 },
    )
    .toBeGreaterThanOrEqual(3);
  await page.waitForTimeout(1500);
  const capture = async (name) => {
    const path = `/private/tmp/gitcity-real-${name}.png`;
    await page.screenshot({ path });
    captures.push({
      path,
      diagnostics: await page.locator('canvas').evaluate((c) => ({ ...c.dataset })),
    });
  };
  await capture('owner-day');
  await page.clock.setFixedTime(new Date('2026-09-06T02:00:00Z'));
  await page.waitForTimeout(1500);
  await capture('owner-night');
  await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
  await page.goto(`${origin}/${owner}/${repo}`);
  await expect(page.getByRole('button', { name: 'Walk the streets' })).toBeVisible({
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await capture('district-day');
  await page.getByRole('button', { name: 'Walk the streets' }).click();
  await page.waitForTimeout(1000);
  await capture('street-day');
  await page.clock.setFixedTime(new Date('2026-09-06T02:00:00Z'));
  await page.waitForTimeout(1500);
  await capture('street-night');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/${owner}/${repo}`);
  await expect(page.getByRole('heading', { name: repo, exact: true })).toBeVisible({
    timeout: 60000,
  });
  await page.waitForTimeout(1500);
  await capture('phone-night');
  expect(errors).toEqual([]);
  console.log(JSON.stringify({ captures: captures.map((c) => c.path), errors }));
} finally {
  await writeFile(
    '/private/tmp/gitcity-real-review.json',
    JSON.stringify({ owner, repo, captures, responses, errors }, null, 2),
  );
  await browser.close();
}
