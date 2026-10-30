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
  for (const who of ['knight', 'ranger', 'mage', 'weaver']) {
    await page.evaluate((w) => { window.__s = new PlayScene(0, w); Engine.setScene(__s); __s.bannerT = 0; }, who);
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyZ'); await page.waitForTimeout(50);
    await shot(`c_${who}_ab3`);
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyA'); await page.waitForTimeout(80);
    await shot(`c_${who}_ab1`);
  }
  await page.evaluate(() => { Engine.current().beginSelection('slain'); });
  await page.waitForTimeout(500);
  await shot('z_select');
  // One shot per enemy type: the first level that has it, the player 80 px to its left.
  for (const kind of ['grunt', 'mud_revenant', 'rat_king', 'archer', 'warlord']) {
    const found = await page.evaluate((k) => {
      for (let i = 0; i < World.count; i++) {
        const s = new PlayScene(i);
        const e = Enemies.list().find((en) => en.kind === k);
        if (e) { window.__s = s; Engine.setScene(s); s.player.x = e.x - 80; s.player.y = e.y; return true; }
      }
      return false;
    }, kind);
    if (found) { await page.waitForTimeout(300); await shot(`e_${kind}`); }
  }
  // Level complete panel on level 1.
  await page.evaluate(() => { window.__s = new PlayScene(0); Engine.setScene(__s); __s.mode = 'complete'; });
  await page.waitForTimeout(300);
  await shot('z_complete');
  await page.evaluate(() => Engine.setScene(new EndingScene()));
  await page.waitForTimeout(500);
  await shot('z_ending');
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'no page errors');
  await browser.close();
})();
