const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1280, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 950 } });
      let state = { available: true, powerAvailable: true, updateState: 'available', checkedAt: new Date().toISOString(), checking: false,
        release: { version: '0.2.1', backend: 'a'.repeat(40), frontend: 'b'.repeat(40), notes: ['Opravy monitoringu', 'Nové bezpečné ovládání hostitele'] }, operation: { state: 'idle' } };
      const calls = [];
      let unavailable = false;
      await page.route('**/api/v1/**', async route => {
        const req = route.request();
        const url = new URL(req.url());
        if (url.pathname.includes('/host-control')) {
          if (unavailable) return route.fulfill({ status: 503, json: {} });
          if (req.method() === 'POST') {
            calls.push({ action: url.pathname.split('/').pop(), ...req.postDataJSON() });
            state = { ...state, operation: { state: 'installing' } };
          }
          return route.fulfill({ json: { success: true, data: state } });
        }
        if (url.pathname.includes('/system/')) return route.fulfill({ status: 503, json: {} });
        return route.fulfill({ json: { success: true, data: [] } });
      });
      await page.goto('http://127.0.0.1:5174/');
      await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
      await page.getByText('Dostupná aktualizace', { exact: true }).waitFor();
      assert.equal(await page.locator('.deployment-panel .host-power').count(), 0);
      assert.equal(await page.locator('.settings-content > .host-power').count(), 1);
      await page.getByRole('button', { name: 'Instalovat', exact: true }).click();
      const modal = page.getByRole('dialog');
      await modal.waitFor();
      assert.ok(await modal.getByRole('button', { name: 'Instalovat aktualizaci', exact: true }).isDisabled());
      await modal.getByLabel('Administrační klíč', { exact: true }).fill('x'.repeat(64));
      await modal.getByLabel('Napište UPDATE NET', { exact: true }).fill('UPDATE NET');
      await modal.getByRole('button', { name: 'Instalovat aktualizaci', exact: true }).click();
      assert.equal(calls.length, 1);
      assert.equal(calls[0].backend, 'a'.repeat(40));
      assert.ok(await page.getByRole('button', { name: 'Restartovat CM5', exact: true }).isDisabled());
      assert.equal(await page.evaluate(() => Object.values(localStorage).some(v => v.includes('x'.repeat(64)))), false);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
      await page.locator('.host-management').screenshot({ path: path.join(os.tmpdir(), `net-host-${width}.png`) });
      state = { ...state, operation: { state: 'idle' }, updateState: 'current' };
      await page.reload();
      await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
      await page.getByText('Verze je aktuální', { exact: true }).waitFor();
      assert.ok(await page.getByRole('button', { name: 'Instalovat', exact: true }).isDisabled());
      await page.getByRole('button', { name: 'Vypnout CM5', exact: true }).click();
      await page.getByRole('dialog').getByText(/Opětovné zapnutí vyžaduje/).waitFor();
      await page.keyboard.press('Escape');
      assert.equal(calls.length, 1);
      unavailable = true;
      await page.reload();
      await page.getByRole('button', { name: 'Nastavení', exact: true }).click();
      await page.getByText('Kontrola není dostupná', { exact: true }).waitFor();
      assert.ok(await page.getByRole('button', { name: 'Restartovat CM5', exact: true }).isDisabled());
      await page.close();
    }
    console.log('Host UI release, confirmation, busy, unavailable and responsive tests passed');
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
