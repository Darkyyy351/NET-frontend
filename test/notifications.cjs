const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      let notices = [];
      let fail = false;
      await page.route('**/api/v1/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/notifications')) return route.fulfill({ status: fail ? 503 : 200, json: { success: !fail, data: notices } });
        if (url.pathname.includes('/system/')) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: { success: true, data: [] } });
      });
      await page.goto('http://127.0.0.1:5174/');
      await page.getByRole('button', { name: 'Upozornění', exact: true }).waitFor();
      await page.waitForTimeout(500);
      assert.equal(await page.locator('.device-notice-toast').count(), 0);
      notices = [{ id: 'offline-1', time: new Date().toISOString(), deviceId: 'esp1', deviceName: 'Testovací ESP dlouhý název zařízení', state: 'offline', message: 'Offline' }];
      await page.locator('.device-notice-toast.offline').waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Skrýt upozornění', exact: true }).click();
      await page.waitForTimeout(5500);
      assert.equal(await page.locator('.device-notice-toast').count(), 0);
      fail = true;
      await page.waitForTimeout(5500);
      assert.equal(await page.locator('.device-notice-toast').count(), 0);
      fail = false;
      notices = [{ ...notices[0], id: 'online-2', state: 'online', time: new Date().toISOString() }, ...notices];
      await page.locator('.device-notice-toast.online').waitFor({ timeout: 10000 });
      await page.getByRole('button', { name: 'Upozornění', exact: true }).click();
      assert.equal(await page.locator('.notice-item').count(), 2);
      await page.getByRole('button', { name: 'Označit vše jako přečtené', exact: true }).click();
      assert.equal(await page.locator('.notice-count').count(), 0);
      await page.getByLabel('Zobrazovat upozornění', { exact: true }).uncheck();
      assert.equal(await page.locator('.device-notice-toast').count(), 0);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('.notification-panel').screenshot({ path: path.join(os.tmpdir(), `net-notifications-${width}.png`) });
      await page.reload();
      await page.waitForTimeout(1000);
      assert.equal(await page.locator('.device-notice-toast').count(), 0);
      assert.equal(await page.locator('.notice-count').count(), 0);
      await page.close();
    }
    console.log('Notification transitions, deduplication, API failure, read state, mute and responsive tests passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
