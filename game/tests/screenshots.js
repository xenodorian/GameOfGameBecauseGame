// Takes screenshots of every screen and level for a visual check.
// Run: NODE_PATH=$(npm root -g) node game/tests/screenshots.js
// Output: game/tests/shots/*.png (git-ignored). Open each PNG and look at it.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const GAME = path.join(__dirname, '..');
const OUT = path.join(__dirname, 'shots');

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('file://' + path.join(GAME, 'changeling.html'));
  await page.waitForTimeout(800);
  const shot = (name) => page.screenshot({ path: path.join(OUT, name + '.png') });
  await shot('00_title');
  const count = await page.evaluate(() => World.count);
  for (let i = 0; i < count; i++) {
    await page.evaluate((idx) => { window.__s = new PlayScene(idx); Engine.setScene(__s); }, i);
    await page.waitForTimeout(400);
    await shot(`l${i + 1}_start`);
    // Mid level: drop the player halfway along, let the camera settle.
    await page.evaluate(() => { __s.player.x = World.width / 2; __s.player.y = 0; });
    await page.waitForTimeout(1500);
    await shot(`l${i + 1}_mid`);
  }
  // Each character in level 1, mid-attack (ability 3, then ability 1).
  for (const who of ['knight', 'ranger', 'mage', 'rat', 'weaver']) {
    await page.evaluate((w) => { window.__s = new PlayScene(0, w); Engine.setScene(__s); __s.bannerT = 0; }, who);
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyZ'); await page.waitForTimeout(50);
    await shot(`c_${who}_ab3`);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyA'); await page.waitForTimeout(80);
    await shot(`c_${who}_ab1`);
  }
  await page.evaluate(() => { Engine.current().beginSelection('slain'); });
  await page.waitForTimeout(200);
  await shot('z_select');
  await page.evaluate(() => Engine.setScene(new EndingScene()));
  await page.waitForTimeout(500);
  await shot('z_ending');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
})();
