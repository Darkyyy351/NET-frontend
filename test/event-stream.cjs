const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      let fail = false;
      let reads = 0;
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      const logs = [
        { id: '1', time: new Date().toISOString(), type: 'cmd', level: 'info', message: 'Identify confirmed', meta: { privateField: 'not-exported' } },
        { id: '2', time: new Date().toISOString(), type: 'device', level: 'warn', message: 'Device removed', meta: null },
        { id: '3', time: new Date().toISOString(), type: 'auth', level: 'error', message: 'Access denied', meta: null },
      ];
      await page.route('**/api/v1/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.endsWith('/logs')) {
          reads++;
          return route.fulfill({ status: fail ? 503 : 200, json: { success: !fail, data: logs } });
        }
        if (url.pathname.includes('/system/')) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: { success: true, data: [] } });
      });
      await page.goto('http://127.0.0.1:5174/');
      await page.getByRole('button', { name: 'Logs', exact: true }).click();
      await page.getByText('Identify confirmed', { exact: true }).waitFor();
      const before = reads;
      await page.waitForTimeout(5500);
      assert.ok(reads > before);
      await page.getByLabel('Automaticky', { exact: true }).uncheck();
      await page.getByLabel('Hledat události', { exact: true }).fill('identify');
      assert.equal(await page.locator('.log-line').count(), 1);
      const downloadPromise = page.waitForEvent('download');
      await page.getByRole('button', { name: 'Export filtrovaných událostí', exact: true }).click();
      const download = await downloadPromise;
      const exported = JSON.parse(await fs.readFile(await download.path(), 'utf8'));
      assert.equal(exported.events.length, 1);
      assert.equal(exported.events[0].meta, undefined);
      await page.getByLabel('Hledat události', { exact: true }).fill('');
      await page.getByLabel('Závažnost', { exact: true }).selectOption('error');
      assert.equal(await page.locator('.log-line').count(), 1);
      await page.getByLabel('Typ události', { exact: true }).selectOption('cmd');
      assert.equal(await page.locator('.log-line').count(), 0);
      assert.ok(await page.getByRole('button', { name: 'Export filtrovaných událostí', exact: true }).isDisabled());
      await page.getByLabel('Závažnost', { exact: true }).selectOption('all');
      await page.getByLabel('Typ události', { exact: true }).selectOption('all');
      fail = true;
      await page.getByRole('button', { name: 'Obnovit události', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Události se nepodařilo načíst' }).waitFor();
      assert.equal(await page.locator('.log-line').count(), 3);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('.event-toolbar').scrollIntoViewIfNeeded();
      await page.screenshot({ path: path.join(os.tmpdir(), `net-event-stream-${width}.png`) });
      await page.reload();
      await page.getByRole('button', { name: 'Logs', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Události se nepodařilo načíst' }).waitFor();
      assert.equal(await page.locator('.log-line').count(), 0);
      assert.deepEqual(errors, []);
      await page.close();
    }
    console.log('Event search, filters, refresh, export, failure and responsive checks passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
