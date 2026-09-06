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
  reducedMotion: 'no-preference',
});
const page = await context.newPage();
const errors = [];
let issueState = 'open';
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
let carRequests = 0;
let femaleRequests = 0;
let releaseFemale;
if (process.env.GITCITY_MODEL_RETRY === '1') {
  await page.route('**/models/city-car.glb', async (route) => {
    if (++carRequests === 1) return route.abort('failed');
    return route.continue();
  });
  await page.route('**/models/citizen-female.glb', async (route) => {
    if (++femaleRequests === 1) {
      await new Promise((resolve) => {
        releaseFemale = resolve;
      });
      return route.abort('failed');
    }
    return route.continue();
  });
}
try {
  await page.clock.setFixedTime(new Date('2026-09-05T16:00:00Z'));
  await page.goto('http://localhost:3010/test/city');
  const canvas = page.locator('canvas').first();
  await expect(canvas).toHaveAttribute('data-street-issues', '1', { timeout: 30000 });
  await expect(canvas).toHaveAttribute('data-visitors', '42');
  if (process.env.GITCITY_PLAN === '1') {
    await expect(canvas).toHaveAttribute('data-journey-destinations', '19');
    await expect(canvas).toHaveAttribute('data-traffic-closures', '1');
  }
  if (process.env.GITCITY_MODEL_RETRY === '1') {
    // One held request must not prevent failed siblings from retrying.
    await expect(canvas).toHaveAttribute('data-street-models', '3', { timeout: 20000 });
    releaseFemale();
    await expect(canvas).toHaveAttribute('data-street-models', '4', { timeout: 15000 });
    expect(carRequests).toBe(2);
    expect(femaleRequests).toBe(2);
  }
  if (process.env.GITCITY_DISCOVERY === '1') {
    const filter = page.getByRole('combobox', { name: 'Find work' });
    await filter.selectOption('newcomer');
    await expect(
      page.getByText('No sites match this filter. Try another kind of work.'),
    ).toBeVisible();
    await expect(page.locator('.work-order')).toHaveCount(0);
    await filter.selectOption('pothole');
    await expect(page.locator('.work-order')).toHaveCount(1);
    await filter.selectOption('all');
  }
  await page.getByRole('button', { name: 'Pause street life' }).click();
  await page.waitForTimeout(600);
  const time = await canvas.getAttribute('data-street-time');
  await page.waitForTimeout(600);
  expect(await canvas.getAttribute('data-street-time')).toBe(time);
  await page.getByRole('button', { name: 'Resume street life' }).click();
  await page.getByRole('button', { name: 'Meet a city guide' }).click();
  if (process.env.GITCITY_PLAN === '1') {
    await expect(page.getByRole('region', { name: 'Traveler destination' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Walk to this destination' })).toBeVisible();
  }
  if (process.env.GITCITY_HALL === '1') {
    await page.getByRole('button', { name: 'Close street encounter' }).click();
    await page.getByRole('button', { name: 'Visit city hall' }).click();
    await page.getByRole('button', { name: 'Explore issue #12' }).click();
    await expect(page.locator('dialog')).not.toBeVisible();
  } else if (process.env.GITCITY_DISCOVERY === '1') {
    await page.getByRole('button', { name: 'Close street encounter' }).click();
    await page.getByRole('button', { name: 'Explore next work site · #12' }).click();
  } else await page.getByRole('button', { name: 'Visit #12: Improve keyboard navigation' }).click();
  const save = page.getByRole('button', { name: 'Save field notes' });
  await expect(save).toBeDisabled();
  if (process.env.GITCITY_HALL !== '1' && process.env.GITCITY_DISCOVERY !== '1')
    await page.getByRole('button', { name: 'Walk to this issue' }).click();
  await expect(save).toBeEnabled({ timeout: 90000 });
  await page
    .getByRole('textbox', { name: 'Contribution plan' })
    .fill('Trace the focus handler and add a keyboard regression check.');
  await save.click();
  await expect(page.getByRole('status')).toContainText('Field notes saved');
  if (process.env.GITCITY_DISCOVERY === '1')
    await expect(page.getByRole('button', { name: 'Explore next work site · #12' })).toHaveCount(0);
  await page.waitForTimeout(1500);
  await expect(save).toBeEnabled();
  await page.screenshot({ path: '/private/tmp/gitcity-issue-street.png' });
  // Returning visitors can discover their saved investigation and reopen it.
  await page.reload();
  const notebook = page.getByRole('region', { name: 'Your field notebook' }).first();
  await expect(notebook).toContainText('Trace the focus handler');
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async (text) => {
          window.copiedPlan = text;
        },
      },
    }),
  );
  await notebook.getByRole('button', { name: 'Copy contribution plan' }).click();
  await expect(notebook.getByRole('status')).toContainText('copied');
  const brief = await page.evaluate(() => window.copiedPlan);
  expect(brief).toContain('https://github.com/test/city/issues/12');
  expect(brief).toContain('http://localhost:3010/test/city');
  expect(brief).toContain('Trace the focus handler and add a keyboard regression check.');
  if (process.env.GITCITY_NOTEBOOK_SIGNIN === '1') {
    await notebook
      .getByLabel('Track your pull request')
      .fill('https://github.com/test/city/pull/42');
    await notebook.getByRole('button', { name: 'Save pull request' }).click();
    await expect(notebook).toContainText('sign in after it merges to verify acceptance');
    await expect(notebook.getByRole('button', { name: 'Verify saved pull request' })).toHaveCount(
      0,
    );
    await notebook.getByRole('button', { name: 'Sign in to verify your contribution' }).click();
    await expect(page.locator('dialog')).toBeVisible();
    await page.getByRole('button', { name: 'Close dialog' }).click();
    await expect(notebook.getByLabel('Track your pull request')).toHaveValue(
      'https://github.com/test/city/pull/42',
    );
    await expect(notebook).toContainText('Trace the focus handler');
  }
  await page
    .getByRole('button', { name: 'Continue your investigation · #12', exact: true })
    .click();
  await expect(page.getByRole('textbox', { name: 'Contribution plan' })).toHaveValue(
    'Trace the focus handler and add a keyboard regression check.',
  );
  await page.getByRole('button', { name: 'Check GitHub status' }).click();
  await expect(page.getByRole('status')).toContainText('still open');
  if (process.env.GITCITY_PLAN === '1')
    await expect
      .poll(async () => Number(await canvas.getAttribute('data-visitor-arrivals')), {
        timeout: 30000,
      })
      .toBeGreaterThan(0);
  issueState = 'closed';
  await page.getByRole('button', { name: 'Check GitHub status' }).click();
  await expect(page.getByRole('status')).toContainText('confirms this issue is closed');
  await expect(canvas).toHaveAttribute('data-street-issues', '0');
  if (process.env.GITCITY_PLAN === '1')
    await expect(canvas).toHaveAttribute('data-traffic-closures', '0');
  expect(
    await page.evaluate(
      () => JSON.parse(localStorage.getItem('gitcity.issue-notes.v1'))['test/city#12'].note,
    ),
  ).toContain('focus handler');
  await page.getByRole('button', { name: 'Close street encounter' }).click();
  await expect(
    page.getByRole('button', { name: 'Continue your investigation · #12', exact: true }),
  ).toHaveCount(0);
  await page.getByRole('button', { name: 'Visit city hall' }).click();
  await expect(page.getByRole('button', { name: 'Explore issue #12' })).toHaveCount(0);
  await expect(page.locator('.bounties')).toContainText('No open issues in the current sample');
  const hallNotebook = page.locator('dialog').getByRole('region', { name: 'Your field notebook' });
  await expect(hallNotebook).toContainText('Trace the focus handler');
  await expect(hallNotebook.getByRole('button', { name: 'Resume investigation' })).toHaveCount(0);
  await expect(hallNotebook.getByRole('link', { name: 'Open GitHub issue ↗' })).toHaveAttribute(
    'href',
    'https://github.com/test/city/issues/12',
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() =>
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {
          throw new Error('Denied');
        },
      },
    }),
  );
  await hallNotebook.getByRole('button', { name: 'Copy contribution plan' }).click();
  await expect(
    hallNotebook.getByRole('textbox', { name: 'Contribution plan to copy' }),
  ).toHaveValue(/Trace the focus handler/);
  await hallNotebook.scrollIntoViewIfNeeded();
  const closeVisible = await page
    .getByRole('button', { name: 'Close dialog', exact: true })
    .evaluate((button) => {
      const r = button.getBoundingClientRect();
      return (
        r.width >= 44 &&
        r.height >= 44 &&
        r.top >= 0 &&
        r.bottom <= innerHeight &&
        button.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      );
    });
  expect(closeVisible).toBe(true);
  await page.screenshot({ path: '/private/tmp/gitcity-field-notebook-phone.png' });
  await hallNotebook.getByRole('button', { name: 'Remove note for issue #12' }).click();
  await expect(hallNotebook).not.toContainText('Trace the focus handler');
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click();
  await expect(page.locator('dialog')).not.toBeVisible();
  expect(errors).toEqual([]);
  console.log(
    'PASS: crowd simulation and pause, guide interaction, physical issue route, proximity-gated notes, reload/resume, city-hall notebook, confirmed GitHub closure, mobile note removal, clean shaders.',
  );
} catch (error) {
  console.error(
    'Street state',
    await page
      .locator('canvas')
      .evaluate((c) => ({ ...c.dataset }))
      .catch(() => null),
    errors,
  );
  await page.screenshot({ path: '/private/tmp/gitcity-street-life-failure.png' });
  throw error;
} finally {
  await browser.close();
}
