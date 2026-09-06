import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openStore } from '../server/store.mjs';
const store = openStore(':memory:');
const snapshots = JSON.parse(await readFile('server/atlas.json', 'utf8'));
const count = Number(process.env.GITCITY_INVENTORY_COUNT || 258);
const files = Array.from({ length: count }, (_, i) => ({
  ...snapshots[0].files[i % snapshots[0].files.length],
  path: `src/module-${String(i).padStart(5, '0')}.ts`,
}));
const id = 'test/city';
const auto = process.env.GITCITY_AUTO_REVIEW === '1';
const requests = [];
const legacy = store.sourceLand(id, auto ? [] : files.slice(0, 8).map((f) => f.path));
const inventory = store.directoryInventory(
  id,
  files.map((f) => f.path),
  files.slice(0, 8),
  true,
);
inventory.directories = store.inventoryLand(id, inventory.directories);
const fixture = {
  ...snapshots[0],
  id,
  commits: [],
  forks: 0,
  ci: 'success',
  defaultBranch: 'main',
  timezone: 0,
  treasury: 0,
  name: 'city',
  coordinates: store.locate(id),
  city: legacy.landPlan.city,
  landPlan: legacy.landPlan,
  sourceInventory: { ...inventory, ref: 'test-ref' },
  files: store
    .inventoryFiles(id, inventory.files)
    .map((f) => ({ ...f, address: legacy.addresses[f.path] })),
  totalFiles: count,
  directories: [{ name: 'src', count }],
  ref: 'test-ref',
  dependencies: [],
  openPRs: 0,
  stars: 5,
  issues: [],
  residents: [],
  civic: [],
};
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=metal'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  reducedMotion: 'reduce',
});
const errors = [];
page.on('pageerror', (e) => {
  errors.push(e.message);
  console.error(e.stack);
});
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text());
});
await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
let loaded = 8;
await page.route('**/api/**', async (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/session') data = { configured: false, player: null };
  else if (url.pathname === '/api/atlas') data = snapshots;
  else if (url.pathname.startsWith('/api/repos/')) data = fixture;
  else if (url.pathname.startsWith('/api/governance/')) data = { role: 'Tourist' };
  else if (url.pathname.startsWith('/api/district/')) {
    const block = url.searchParams.has('block') ? Number(url.searchParams.get('block')) : undefined;
    requests.push(block);
    const pageFiles =
      block === undefined
        ? files.slice(loaded, loaded + 64)
        : files.slice(block * 64, (block + 1) * 64);
    if (block === undefined) loaded += pageFiles.length;
    const updated = store.directoryInventory(
      id,
      files.map((f) => f.path),
      pageFiles,
      true,
    );
    updated.directories = store.inventoryLand(id, updated.directories);
    data = {
      directory: 'src',
      files: store.inventoryFiles(id, updated.files),
      total: count,
      ref: 'test-ref',
      nextCursor: block === undefined && loaded < count ? String(loaded) : null,
      landPlan: legacy.landPlan,
      sourceInventory: { ...updated, ref: 'test-ref' },
    };
  } else return route.fulfill({ status: 404, json: { error: 'Fixture endpoint not found' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/test/city' + (auto ? '' : '?view=overview'));
  const dismiss = page.getByRole('button', { name: 'Start exploring' });
  if (await dismiss.isVisible().catch(() => false)) await dismiss.click();
  const canvas = page.locator('canvas');
  if (!auto)
    await expect(canvas).toHaveAttribute('data-survey-plots', String(count - 8), {
      timeout: 60000,
    });
  await expect(canvas).toHaveAttribute('data-animating', '0', { timeout: auto ? 30000 : 5000 });
  await page.screenshot({ path: '/private/tmp/gitcity-inventory-before.png' });
  if (auto) {
    // Ordinary shared links enter walking mode and resolve nearby blocks automatically.
    await expect.poll(() => requests.length, { timeout: 60000 }).toBeGreaterThan(0);
    expect(requests[0]).toBe(0);
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-structures')), { timeout: 60000 })
      .toBeGreaterThanOrEqual(64);
    await expect(canvas).toHaveAttribute('data-animating', '0', { timeout: 30000 });
    expect(new Set(requests).size).toBe(requests.length);
    await expect
      .poll(async () =>
        canvas.evaluate((c) =>
          Math.abs(Number(c.dataset.cameraHeight) - Number(c.dataset.cameraFloor)),
        ),
      )
      .toBeLessThan(0.1);
    await page.screenshot({ path: '/private/tmp/gitcity-inventory-walking.png' });
  } else {
    await page.getByRole('button', { name: /^Buildings/ }).click();
    const directory = page.locator('.file-list button').filter({ hasText: 'source buildings' });
    await directory.click();
    await expect(canvas).toHaveAttribute('data-survey-plots', String(count - 72), {
      timeout: 60000,
    });
    await expect(canvas).toHaveAttribute('data-structures', '72');
    await expect(canvas).toHaveAttribute('data-animating', '0');
    await page.screenshot({ path: '/private/tmp/gitcity-inventory-after.png' });
  }
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(
    await canvas.evaluate((c) => ({
      surveyPlots: c.dataset.surveyPlots,
      structures: c.dataset.structures,
      drawCalls: c.dataset.drawCalls,
      triangles: c.dataset.triangles,
    })),
  );
} finally {
  await browser.close();
  store.db.close();
}
