// Run with Playwright available in NODE_PATH and the local Vite server running.
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 900 } });
      const page = await context.newPage();
      let device = { id: 'ui-board-test', name: 'Testovací NodeMCU', ip: '192.0.2.1', type: 'esp', status: 'offline', firmware: 'test', capabilities: [], lastSeen: null, createdAt: '', updatedAt: '', pendingCommands: 0 };
      let failSave = false;
      device.purpose = 'Dlouhý účel zařízení: ' + 'x'.repeat(58);
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await page.route('**/api/v1/**', async route => {
        const request = route.request();
        const url = new URL(request.url());
        let data;
        if (url.pathname.endsWith('/purpose')) {
          if (failSave) return route.fulfill({ status: 500, json: { success: false } });
          device = { ...device, purpose: request.postDataJSON().purpose };
          data = device;
        } else if (url.pathname.endsWith('/board-profile')) {
          if (failSave) return route.fulfill({ status: 500, json: { success: false } });
          device = { ...device, boardProfile: request.postDataJSON().boardProfile };
          data = device;
        } else if (url.pathname.endsWith('/devices')) data = [device, { ...device, id: 'other-test', name: 'Druhá karta', purpose: '' }];
        else if (url.pathname.includes('/system/')) return route.fulfill({ status: 503, json: { success: false } });
        else data = [];
        return route.fulfill({ json: { success: true, data } });
      });
      await page.goto('http://127.0.0.1:5174/');
      await page.getByRole('button', { name: 'Edit', exact: true }).click();
      const otherCard = page.locator('.v4-device-card').filter({ hasText: 'Druhá karta' });
      const originalOtherWidth = (await otherCard.boundingBox()).width;
      const handle = page.getByRole('button', { name: 'Změnit velikost karet: Testovací NodeMCU' });
      await handle.press('End');
      assert.equal(await page.locator('#card-size').inputValue(), '520');
      assert.equal((await otherCard.boundingBox()).width, originalOtherWidth);
      const corner = await handle.boundingBox();
      await page.mouse.move(corner.x + corner.width / 2, corner.y + corner.height / 2);
      await page.mouse.down();
      await page.mouse.move(corner.x - 300, corner.y + corner.height / 2, { steps: 12 });
      await page.mouse.up();
      assert.equal(await page.locator('#card-size').inputValue(), '280');
      assert.equal(await page.locator('.v4-device-card').first().evaluate(element => element.scrollWidth <= element.clientWidth), true);
      await page.screenshot({ path: path.join(os.tmpdir(), `net-card-small-${width}.png`) });
      await handle.press('End');
      await page.screenshot({ path: path.join(os.tmpdir(), `net-card-large-${width}.png`) });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      await page.getByRole('button', { name: 'Hotovo', exact: true }).click();
      await page.reload();
      assert.equal(await page.evaluate(() => JSON.parse(localStorage.getItem('net_dashboard_card_sizes'))['ui-board-test']), 520);
      assert.equal((await otherCard.boundingBox()).width, originalOtherWidth);
      await page.getByRole('button', { name: 'Details', exact: true }).first().click();
      await page.locator('#device-purpose').fill('Osvětlení pracovního stolu');
      await page.getByRole('button', { name: 'Uložit', exact: true }).click();
      await page.getByText('Účel uložen.', { exact: true }).waitFor();
      assert.equal(device.purpose, 'Osvětlení pracovního stolu');
      assert.equal(await page.locator('.device-purpose').innerText(), device.purpose);
      await page.getByLabel('Model desky', { exact: true }).selectOption('nodemcu-amica-esp12e-cp2102');
      failSave = true;
      await page.getByRole('button', { name: 'Uložit model' }).click();
      await page.getByRole('alert').filter({ hasText: 'Model se nepodařilo' }).waitFor();
      assert.equal(device.boardProfile, undefined);
      failSave = false;
      await page.getByRole('button', { name: 'Uložit model' }).click();
      await page.getByText('Model desky uložen.', { exact: true }).waitFor();
      assert.equal(device.boardProfile.revision, 1);
      await page.screenshot({ path: path.join(os.tmpdir(), `net-board-assignment-${width}.png`) });
      await page.getByRole('button', { name: 'Pinout zařízení' }).click();
      await page.locator('.device-detail-modal').waitFor({ state: 'hidden' });
      await page.locator('.board-device-context').getByText('Testovací NodeMCU').waitFor();
      await page.locator('.board-device-context').getByText('Offline', { exact: true }).waitFor();
      assert.equal(await page.getByLabel('Model desky', { exact: true }).count(), 0);
      await page.screenshot({ path: path.join(os.tmpdir(), `net-board-context-${width}.png`) });
      await page.getByRole('button', { name: 'Zpět na zařízení' }).click();
      await page.getByRole('button', { name: 'Details', exact: true }).first().click();
      await page.getByLabel('Model desky', { exact: true }).selectOption('');
      await page.getByRole('button', { name: 'Uložit model' }).click();
      await page.getByText('Přiřazení modelu odebráno.', { exact: true }).waitFor();
      assert.equal(device.boardProfile, null);
      assert.equal(await page.getByRole('button', { name: 'Pinout zařízení' }).isDisabled(), true);
      await page.keyboard.press('Escape');
      await page.getByRole('dialog', { name: 'Detail zařízení' }).waitFor({ state: 'hidden' });
      assert.deepEqual(errors, []);
      console.log(`PASS board assignment, errors, context and removal at ${width}px`);
      await context.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
