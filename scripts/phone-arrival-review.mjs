import { writeFile } from 'node:fs/promises';
import { chromium, expect } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=metal'],
});
const page = await browser.newPage({
  viewport: { width: 390, height: 844 },
  reducedMotion: process.env.GITCITY_MOTION === '1' ? 'no-preference' : 'reduce',
});
const errors = [];
const profiler =
  process.env.GITCITY_PROFILE === '1' ? await page.context().newCDPSession(page) : null;
if (profiler) await profiler.send('Profiler.enable');
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.text().startsWith('[city-work]')) console.log(m.text());
  if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text());
});
try {
  await page.goto('http://localhost:3010/vercel/next.js');
  const canvas = page.locator('canvas');
  const floorDelta = () =>
    canvas.evaluate((c) =>
      Math.abs(Number(c.dataset.cameraHeight) - Number(c.dataset.cameraFloor)),
    );
  await expect(page.getByRole('button', { name: 'View the whole city', exact: true })).toBeVisible({
    timeout: 60000,
  });
  await expect.poll(floorDelta).toBeLessThan(0.1);
  await page.evaluate(() => {
    const state = { samples: [], last: performance.now(), request: 0 };
    window.__arrivalFrames = state;
    const sample = (now) => {
      state.samples.push(now - state.last);
      state.last = now;
      state.request = requestAnimationFrame(sample);
    };
    state.request = requestAnimationFrame(sample);
  });
  if (profiler) await profiler.send('Profiler.start');
  await page.getByRole('button', { name: 'View the whole city', exact: true }).click();
  await expect.poll(floorDelta).toBeGreaterThan(10);
  await page.getByRole('button', { name: 'Walk through this neighborhood', exact: true }).click();
  await expect
    .poll(
      async () => {
        console.log(
          await canvas.evaluate((c) => ({
            height: c.dataset.cameraHeight,
            goal: c.dataset.cameraDestinationHeight,
            walking: c.dataset.walking,
            frame: c.dataset.frameMs,
          })),
        );
        return floorDelta();
      },
      { timeout: 15000 },
    )
    .toBeLessThan(0.1);
  await expect(
    page.getByRole('button', { name: 'View the whole city', exact: true }),
  ).toBeVisible();
  if (process.env.GITCITY_SETTLE === '1') {
    await expect
      .poll(() => canvas.evaluate((c) => Number(c.dataset.pavementWorkerBuilds || 0)), {
        timeout: 60000,
      })
      .toBeGreaterThan(0);
    await expect
      .poll(() => canvas.evaluate((c) => Number(c.dataset.pendingPreviewBatches || 0)), {
        timeout: 60000,
      })
      .toBe(0);
    await page.waitForTimeout(1000);
    console.log(
      'Settled preview diagnostics:',
      await canvas.evaluate((c) => ({
        workers: c.dataset.pavementWorkerBuilds,
        pending: c.dataset.pendingPreviewBatches,
        rebuilds: c.dataset.ownerRebuilds,
      })),
    );
  }
  if (profiler) {
    const { profile } = await profiler.send('Profiler.stop');
    await writeFile('/private/tmp/gitcity-camera-profile.json', JSON.stringify(profile));
  }
  const frames = await page.evaluate(() => {
    const state = window.__arrivalFrames;
    cancelAnimationFrame(state.request);
    const sorted = state.samples.slice().sort((a, b) => a - b);
    return {
      samples: sorted.length,
      maxMs: sorted.at(-1),
      p95Ms: sorted[Math.floor(sorted.length * 0.95)],
      over100Ms: sorted.filter((ms) => ms > 100),
    };
  });
  console.log('Navigation frame intervals:', frames);
  expect(errors).toEqual([]);
  await page.screenshot({ path: '/private/tmp/gitcity-phone-street-arrival.png' });
  console.log(
    'PASS: phone shared link arrives on the street, opens city overview and returns to walking.',
  );
} finally {
  await browser.close();
}
