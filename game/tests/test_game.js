const { chromium } = require('playwright');
(async () => {
  const file = '' + require('path').resolve(__dirname, '..', 'changeling.html').replace(/^/, 'file://') + '';
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  await page.goto(file);
  await page.waitForTimeout(600);
  const dir = __dirname;
  await page.screenshot({ path: dir + '/01_input.png' });

  // Hold A and check that the input test lights it (keyboard path works).
  await page.keyboard.down('KeyA');
  await page.waitForTimeout(100);
  await page.screenshot({ path: dir + '/02_keyA.png' });
  await page.keyboard.up('KeyA');

  // Enter opens the play slice.
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  const before = await page.evaluate(() => 'ok');
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(700);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(300);
  await page.screenshot({ path: dir + '/03_walk_right.png' });

  await page.keyboard.press('ArrowUp');
  await page.waitForTimeout(120);
  await page.screenshot({ path: dir + '/04_jump_air.png' });
  await page.waitForTimeout(800);
  await page.screenshot({ path: dir + '/05_landed.png' });

  // Portrait overlay check.
  await page.setViewportSize({ width: 400, height: 800 });
  await page.waitForTimeout(300);
  const portrait = await page.evaluate(() => document.body.classList.contains('portrait'));
  await page.screenshot({ path: dir + '/06_portrait.png' });
  console.log(JSON.stringify({ portrait, errors }, null, 2));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
