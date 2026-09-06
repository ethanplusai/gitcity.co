import { chromium } from '@playwright/test';
const browser = await chromium.launch({
  headless: true,
  channel: 'chrome',
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
await page.waitForTimeout(3500);
await page.screenshot({ path: '/private/tmp/gitcity-desktop.png' });
console.log(await page.locator('canvas').count(), 'canvases', await page.title());
await page.setViewportSize({ width: 390, height: 844 });
await page.waitForTimeout(1200);
await page.screenshot({ path: '/private/tmp/gitcity-mobile.png' });
await browser.close();
