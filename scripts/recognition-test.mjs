import { chromium, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { openStore } from '../server/store.mjs';
const store = openStore(':memory:'),
  base = JSON.parse(await readFile('server/atlas.json', 'utf8'))[0];
const repos = ['studio/engine', 'studio/interface', 'studio/documentation'].map((id, index) => {
  const files = base.files
    .slice(index * 12, index * 12 + 18)
    .map((f, i) => ({ ...f, path: `src/module-${i}.ts` }));
  return {
    ...base,
    id,
    name: id.split('/')[1],
    files,
    totalFiles: files.length,
    directories: [{ name: 'src', count: files.length }],
    commits: [],
    residents: [],
    civic: [],
    dependencies: [],
    issues: [],
    openPRs: 0,
    city: store.locateOwner('studio'),
    coordinates: store.locate(id),
    landPlan: store.reserveLand(id, 3),
    fetchedAt: '2026-09-05T12:00:00Z',
  };
});
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args:
    process.env.GITCITY_GPU === 'metal'
      ? ['--use-angle=metal']
      : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
    reducedMotion: 'reduce',
  }),
  errors = [];
await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => {
  if (m.type() === 'error' && /THREE|shader|WebGL/i.test(m.text())) errors.push(m.text());
});
let targeted = false;
await page.route('**/api/**', (route) => {
  const url = new URL(route.request().url());
  let data;
  if (url.pathname === '/api/session')
    data = {
      configured: true,
      player: { login: 'contributor', soft: 0, hard: 10, possessions: [] },
    };
  else if (url.pathname === '/api/contributions/verify') {
    expect(route.request().postDataJSON().url).toBe('https://github.com/studio/engine/pull/42');
    repos[0].residents = [
      { login: 'contributor', path: 'src/module-0.ts', pr: 42 },
      { login: 'contributor', path: 'archive/unsampled.ts', pr: 43 },
    ];
    data = {
      reason: targeted ? 'already_recorded' : 'accepted',
      awarded: targeted ? 0 : 10,
      repo: 'studio/engine',
      number: 42,
    };
    targeted = true;
  } else if (url.pathname === '/api/sync') {
    repos[0].residents = [
      { login: 'contributor', path: 'src/module-0.ts', pr: 42 },
      { login: 'contributor', path: 'archive/unsampled.ts', pr: 43 },
    ];
    data = { running: false, phase: 'Complete', awarded: 10 };
  } else if (url.pathname === '/api/atlas') data = [];
  else if (url.pathname.startsWith('/api/owners/'))
    data = repos.map((r) => ({ id: r.id, name: r.name, ...r.coordinates, city: r.city }));
  else if (url.pathname.startsWith('/api/repos/'))
    data = repos.find((r) => url.pathname.endsWith(r.id));
  else if (url.pathname.startsWith('/api/source/'))
    data = {
      source: 'export const answer = 42;',
      file: { ...repos[0].files[0], path: url.searchParams.get('path') },
    };
  else if (url.pathname.startsWith('/api/governance/'))
    data = { role: 'Tourist', districtRole: null };
  else return route.fulfill({ status: 404, json: { error: 'No fixture' } });
  return route.fulfill({ json: data });
});
try {
  await page.goto('http://localhost:3010/studio/engine');
  await expect(page.getByRole('button', { name: 'Walk the streets' })).toBeVisible();
  await page.waitForTimeout(1500);
  let before = await page.locator('canvas').evaluate((c) => ({
    count: c.dataset.constructionCount,
    x: c.dataset.cameraX,
    z: c.dataset.cameraZ,
    height: c.dataset.cameraHeight,
  }));
  await expect(page.locator('.building-name')).toHaveCount(0);
  if (process.env.GITCITY_NOTEBOOK_VERIFY === '1')
    await page.evaluate(() => {
      localStorage.setItem(
        'gitcity.issue-notes.v1',
        JSON.stringify({
          'studio/engine#12': { note: 'Fix the focus handler', surveyedAt: Date.now() },
        }),
      );
      window.dispatchEvent(new Event('gitcity:field-notes'));
    });
  if (process.env.GITCITY_HALL_VERIFY === '1') {
    await page.getByRole('button', { name: 'Visit city hall', exact: true }).click();
    await page.waitForTimeout(1000);
    before = await page.locator('canvas').evaluate((c) => ({
      count: c.dataset.constructionCount,
      x: c.dataset.cameraX,
      z: c.dataset.cameraZ,
      height: c.dataset.cameraHeight,
    }));
  } else if (process.env.GITCITY_STREET_VERIFY !== '1') await page.locator('.signin').click();
  if (process.env.GITCITY_NOTEBOOK_VERIFY === '1') {
    const notebook = page.locator(
      process.env.GITCITY_STREET_VERIFY === '1'
        ? '.city-pulse + .field-notebook'
        : 'dialog .field-notebook',
    );
    await notebook
      .getByLabel('Track your pull request')
      .fill('https://github.com/studio/engine/pull/42');
    await notebook.getByRole('button', { name: 'Save pull request' }).click();
    await expect(notebook.getByRole('link', { name: 'Open saved pull request ↗' })).toHaveAttribute(
      'href',
      'https://github.com/studio/engine/pull/42',
    );
    await notebook.getByRole('button', { name: 'Verify saved pull request' }).click();
    await expect(notebook.getByLabel('Just got a pull request merged?')).toHaveValue(
      'https://github.com/studio/engine/pull/42',
    );
  }
  const verification = page.locator('.verify-contribution').last();
  if (process.env.GITCITY_TARGETED === '1') {
    await verification
      .getByRole('textbox', { name: 'Just got a pull request merged?' })
      .fill('https://github.com/studio/engine/pull/42');
    await verification.getByRole('button', { name: 'Verify pull request', exact: true }).click();
    await expect(verification.locator('[role=status]')).toContainText(
      targeted ? /verified|already recorded/ : 'verified',
    );
  } else {
    await page.getByRole('button', { name: 'Restore contribution history' }).click();
  }
  await expect(page.locator('.building-name')).toHaveText('@contributor', { timeout: 15000 });
  await expect(page.locator('.building-name')).toHaveAttribute(
    'title',
    'Accepted contribution · PR #42',
  );
  const after = await page.locator('canvas').evaluate((c) => ({
    count: c.dataset.constructionCount,
    x: c.dataset.cameraX,
    z: c.dataset.cameraZ,
    height: c.dataset.cameraHeight,
  }));
  expect(after).toEqual(before);
  if (process.env.GITCITY_NOTEBOOK_VERIFY === '1')
    await expect(
      page.locator(
        process.env.GITCITY_STREET_VERIFY === '1'
          ? '.city-pulse + .field-notebook .field-note-stage'
          : 'dialog .field-note-stage',
      ),
    ).toContainText('Acceptance verified on this device');
  if (process.env.GITCITY_TARGETED === '1') {
    await verification
      .getByRole('textbox', { name: 'Just got a pull request merged?' })
      .fill('https://github.com/studio/engine/pull/42');
    await verification.getByRole('button', { name: 'Verify pull request', exact: true }).click();
    await expect(verification.locator('[role=status]')).toContainText(
      targeted ? /verified|already recorded/ : 'verified',
    );
  } else {
    await page.getByRole('button', { name: 'Restore contribution history' }).click();
  }
  await page.waitForTimeout(3500);
  await expect(page.locator('.building-name')).toHaveCount(1);
  if (process.env.GITCITY_HALL_VERIFY === '1') {
    await page.setViewportSize({ width: 390, height: 844 });
    const form = verification;
    await form.scrollIntoViewIfNeeded();
    const bounds = await form.boundingBox();
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(390);
    await page.screenshot({ path: '/private/tmp/gitcity-hall-verify-phone.png' });
    await page.setViewportSize({ width: 1440, height: 1000 });
  }
  if (process.env.GITCITY_VISIT_RECOGNITION === '1') {
    await verification.getByRole('button', { name: 'Visit your contribution' }).click();
    await expect(page).toHaveURL(/studio\/engine\/src\/module-0.ts$/);
    await expect(
      page.locator('.building-plaque').filter({ hasText: 'Accepted contribution' }),
    ).toContainText('@contributor');
    await page.goto('http://localhost:3010/studio/engine');
    await expect(page.getByRole('button', { name: 'Visit city hall' })).toBeVisible();
  } else if (process.env.GITCITY_STREET_VERIFY !== '1')
    await page.getByRole('button', { name: 'Close dialog' }).click();
  await page.getByRole('button', { name: 'Visit city hall' }).click();
  if (process.env.GITCITY_NOTEBOOK_VERIFY === '1')
    await expect(page.locator('dialog .field-note-stage')).toContainText(
      'Acceptance verified on this device',
    );
  const work = page.getByRole('region', { name: 'Your accepted work' });
  await expect(work).toContainText('src/module-0.ts');
  await work.getByRole('button', { name: /archive\/unsampled.ts/ }).click();
  await expect(page).toHaveURL(/studio\/engine\/archive\/unsampled.ts$/);
  await expect(
    page.locator('.building-plaque').filter({ hasText: 'Accepted contribution' }),
  ).toContainText('@contributor');
  expect(errors).toEqual([]);
  console.log(
    'PASS: verified contribution sync adds a building plaque without camera movement, reconstruction, or duplicate recognition; city hall links to the attributed file archive.',
  );
} finally {
  await browser.close();
  store.db.close();
}
