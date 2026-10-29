const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto('' + require('path').resolve(__dirname, '..', 'changeling.html').replace(/^/, 'file://') + '');
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter'); await page.waitForTimeout(150);
  await page.evaluate(() => { window.__scene = new PlayScene(); Engine.setScene(window.__scene); const f = World.exit(); __scene.player.x = f.x; __scene.player.y = f.y; });
  await page.waitForTimeout(100);
  const mode = await page.evaluate(() => __scene.mode);
  await page.screenshot({ path: __dirname + '/' + require('path').basename(__filename, '.js') + '.png' });
  await page.keyboard.press('Enter'); await page.waitForTimeout(100);
  const after = await page.evaluate(() => Engine.current().mode);
  console.log(JSON.stringify({ mode, after, errors }));
  await browser.close();
})();
