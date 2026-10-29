const { chromium } = require('playwright');
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const url = '' + require('path').resolve(__dirname, '..', 'changeling.html').replace(/^/, 'file://') + '';
  const out = {};
  // Touch: phone landscape, tap-and-hold the right button and the jump button.
  {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForTimeout(400);
    out.touchClass = await page.evaluate(() => document.body.classList.contains('touch'));
    out.portraitLandscape = await page.evaluate(() => document.body.classList.contains('portrait'));
    await page.keyboard.press('Enter'); await page.waitForTimeout(150);
    await page.evaluate(() => { window.__scene = new PlayScene(); Engine.setScene(window.__scene); });
    const x0 = await page.evaluate(() => __scene.player.x);
    await page.evaluate(() => document.querySelector('button[data-action="right"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    await wait(400);
    await page.evaluate(() => document.querySelector('button[data-action="right"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true })));
    out.touchRightMoved = (await page.evaluate(() => __scene.player.x)) - x0;
    await page.evaluate(() => document.querySelector('button[data-action="up"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true })));
    await wait(40);
    await page.evaluate(() => document.querySelector('button[data-action="up"]').dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true })));
    out.touchJumpVy = await page.evaluate(() => __scene.player.vy);
    out.touchErrors = errors;
    await page.screenshot({ path: __dirname + '/11_touch_landscape.png' });
    await browser.close();
  }
  // Portrait phone: the rotate overlay should show.
  {
    const browser = await chromium.launch();
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.goto(url); await page.waitForTimeout(400);
    out.portraitOverlay = await page.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none');
    await page.screenshot({ path: __dirname + '/12_portrait.png' });
    await browser.close();
  }
  // Gamepad: stub the Gamepad API with d-pad right held and A (index 0) held.
  {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    await page.addInitScript(() => {
      const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === 15 || i === 0, value: (i === 15 || i === 0) ? 1 : 0 }));
      navigator.getGamepads = () => [{ buttons, axes: [0, 0, 0, 0] }];
    });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(url); await page.waitForTimeout(400);
    await page.evaluate(() => { window.__scene = new PlayScene(); Engine.setScene(window.__scene); });
    const x0 = await page.evaluate(() => __scene.player.x);
    await wait(400);
    out.padRightMoved = (await page.evaluate(() => __scene.player.x)) - x0;
    out.padAbilityOnA = await page.evaluate(() => Input.down('ab3'));
    out.padErrors = errors;
    await browser.close();
  }
  console.log(JSON.stringify(out, null, 1));
})().catch(e => { console.error(e); process.exit(1); });
