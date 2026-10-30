// Quick human-style playtest: real key presses, a few screenshots, console errors.
// Cheap smoke check (about 20 s). Not a replacement for suite.js.
//   NODE_PATH=$(npm root -g) node game/tests/playtest.js [outDir]
// Shots go to outDir (default game/tests/shots/playtest, git-ignored).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const GAME = path.resolve(__dirname, '..');
const url = 'file://' + path.join(GAME, 'changeling.html');
const out = path.resolve(process.argv[2] || path.join(__dirname, 'shots', 'playtest'));
fs.mkdirSync(out, { recursive: true });
const wait = (p, ms) => p.waitForTimeout(ms);
const results = [];
const ok = (name, pass, info = '') => { results.push({ name, pass }); console.log((pass ? 'PASS ' : 'FAIL ') + name + (info ? '  ' + info : '')); };

async function hold(page, key, ms) { await page.keyboard.down(key); await wait(page, ms); await page.keyboard.up(key); }

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(url);
  await wait(page, 400);
  await page.screenshot({ path: path.join(out, '00_title.png') });
  for (let i = 0; i < 3; i++) { await page.keyboard.press('Enter'); await wait(page, 250); }
  await wait(page, 600);
  ok('reached play scene', await page.evaluate(() => Engine.current().constructor.name === 'PlayScene'));
  await page.screenshot({ path: path.join(out, '01_level1_start.png') });
  // Walk right, jump, attack: the first seconds a new player sees.
  await page.keyboard.down('ArrowRight');
  await wait(page, 700);
  await page.keyboard.press('ArrowUp');
  await wait(page, 250);
  await page.screenshot({ path: path.join(out, '02_level1_jump.png') });
  await wait(page, 500);
  await page.keyboard.up('ArrowRight');
  await page.keyboard.press('KeyZ');
  await wait(page, 60);
  await page.screenshot({ path: path.join(out, '03_level1_slash.png') });

  // Jump apex in px from a standing jump with Up held.
  const apex = await page.evaluate(async () => {
    const s = Engine.current(); const p = s.player;
    return p.y;
  });
  await page.keyboard.down('ArrowUp');
  let minY = apex;
  for (let i = 0; i < 40; i++) { await wait(page, 16); minY = Math.min(minY, await page.evaluate(() => Engine.current().player.y)); }
  await page.keyboard.up('ArrowUp');
  ok('jump apex in 64..80 px', apex - minY >= 64 && apex - minY <= 80, 'apex ' + (apex - minY).toFixed(1) + ' px');
  await wait(page, 600);

  // Mage beam against a grounded grunt 100 px away (the original complaint).
  const beam = await page.evaluate(async () => {
    const s = Engine.current();
    s.active = 'mage';
    const p = s.player;
    const e = Enemies.list().find((q) => q.kind === 'grunt') || Enemies.list()[0];
    e.def = { ...e.def, speed: 0, chaseSpeed: 0, sight: 0 };
    p.facing = 1;
    e.x = p.x + p.w + 90; e.y = p.y + p.h - e.h; e.vy = 0;
    window.__beamTarget = e;
    return { kind: e.kind };
  });
  await page.keyboard.press('KeyA');
  await wait(page, 220);
  await page.screenshot({ path: path.join(out, '04_mage_beam.png') });
  await wait(page, 500);
  ok('mage beam kills a grounded ' + beam.kind, await page.evaluate(() => window.__beamTarget.dead));

  // Every face's four abilities fire without errors.
  for (const who of ['knight', 'ranger', 'mage', 'rat', 'weaver']) {
    await page.evaluate((w) => { const s = Engine.current(); s.active = w; s.cooldowns = [0, 0, 0, 0]; s.hp = 10; }, who);
    for (const k of ['KeyA', 'KeyS', 'KeyZ', 'KeyX']) {
      await page.keyboard.press(k); await wait(page, 180);
      if (who === 'weaver' && k === 'KeyZ') await page.screenshot({ path: path.join(out, '05_weaver_z.png') });
    }
    await wait(page, 300);
  }
  await page.screenshot({ path: path.join(out, '06_after_abilities.png') });

  // A later level for the look.
  await page.evaluate(() => { Engine.setScene(new PlayScene(4, 'knight')); });
  await wait(page, 900);
  await hold(page, 'ArrowRight', 900);
  await page.screenshot({ path: path.join(out, '07_level5.png') });
  await page.evaluate(() => { Engine.setScene(new PlayScene(7, 'knight')); });
  await wait(page, 900);
  await hold(page, 'ArrowRight', 1200);
  await page.screenshot({ path: path.join(out, '08_boss.png') });

  ok('no console or page errors', errors.length === 0, errors.slice(0, 3).join(' | '));
  await browser.close();
  const failed = results.filter((r) => !r.pass).length;
  console.log(`${results.length - failed} passed, ${failed} failed. Shots in ${out}`);
  process.exit(failed ? 1 : 0);
})();
