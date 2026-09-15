const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 900 } });
      let state = 'live';
      await page.route('**/api/v1/**', route => {
        const url = new URL(route.request().url());
        if (url.pathname.includes('/system/')) return route.fulfill({ status: 503, json: {} });
        const device = { id: 'telemetry-test', name: 'NodeMCU telemetry', type: 'esp',
          ip: '192.0.2.10', status: state === 'offline' ? 'offline' : 'online',
          firmware: 'test', capabilities: [], lastSeen: new Date().toISOString(),
          createdAt: '', updatedAt: '', pendingCommands: 0,
          telemetry: state === 'legacy' ? null : { rssi: -63, uptimeSeconds: 0,
            freeHeapBytes: 32768, receivedAt: new Date(Date.now() - (state === 'stale' ? 60000 : 0)).toISOString() } };
        return route.fulfill({ json: { success: true, data: url.pathname.endsWith('/devices') ? [device] : [] } });
      });
      for (state of ['live', 'offline', 'stale', 'legacy']) {
        await page.goto('http://127.0.0.1:5174/');
        const card = page.locator('.v4-device-card').filter({ hasText: 'NodeMCU telemetry' });
        await card.waitFor();
        const text = await card.innerText();
        assert.equal(text.includes('-63 dBm'), state === 'live');
        assert.equal(text.includes('32.0 kB'), state === 'live');
        assert.equal(text.includes('0h 0m'), state === 'live');
        const signal = card.locator('.wifi-signal');
        if (state === 'live') {
          assert.equal(await signal.evaluate(e => Number(e.style.getPropertyValue('--net-rssi-hue')) > 0), true);
          await signal.evaluate(e => e.style.setProperty('--net-rssi-hue', '0'));
          await page.waitForTimeout(1000);
          await signal.evaluate(e => e.style.setProperty('--net-rssi-hue', '120'));
          await page.waitForTimeout(450);
          const hue = await signal.evaluate(e => Number(getComputedStyle(e).getPropertyValue('--net-rssi-hue')));
          assert.ok(hue > 0 && hue < 120, `Expected intermediate hue, got ${hue}`);
          await page.waitForTimeout(600);
          assert.equal(await signal.evaluate(e => Number(getComputedStyle(e).getPropertyValue('--net-rssi-hue'))), 120);
        } else {
          assert.ok(await signal.evaluate(e => e.classList.contains('signal-off')));
        }
        assert.equal(await card.evaluate(e => e.scrollWidth <= e.clientWidth), true);
        const metrics = await card.locator('.device-card-data').boundingBox();
        const footer = await card.locator('.card-footer').boundingBox();
        assert.ok(metrics.y + metrics.height <= footer.y + 1);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
        if (state === 'live') await card.screenshot({ path: path.join(os.tmpdir(), `net-telemetry-${width}.png`) });
      }
      await page.close();
    }
    console.log('Telemetry display and layout checks passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
