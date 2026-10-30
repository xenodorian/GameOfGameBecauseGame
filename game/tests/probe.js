// Movement probe: can this face really make this move? Ground truth for level design,
// since validate_gates.py is only a tile model.
// Usage: NODE_PATH=... node game/tests/probe.js <level 1-8> <face> <col> <row> "<macro>" [shot.png]
//   macro: comma-separated steps "Keys:ms", keys joined with + (Left Right Up Down A S Z X D),
//   e.g. "Right:300,Right+Up:400,Right+Up+X:60,Right:500".
//   Keys: A=ab1 S=ab2 Z=ab3 X=ab4 (knight bash charge slash thrust; ranger shoot anchor volley hop;
//   rat leap scurry gnaw thrust; weaver shoot bridge toss ghost; mage bolt float nova blink).
// Prints the body tile each step, the highest row reached, and the final tile. Enemies frozen.
const { chromium } = require('playwright');
const path = require('path');
const url = 'file://' + path.resolve(__dirname, '..', 'changeling.html');
const [lv, face, col, row, macro, shot] = process.argv.slice(2);
const KEY = { Left: 'ArrowLeft', Right: 'ArrowRight', Up: 'ArrowUp', Down: 'ArrowDown', A: 'KeyA', S: 'KeyS', Z: 'KeyZ', X: 'KeyX', D: 'KeyD' };
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(url);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(120);
  await page.evaluate(([lv, face, col, row]) => {
    window.__scene = new PlayScene(lv - 1, face);
    Engine.setScene(window.__scene);
    __scene.active = face;
    __scene.mode = 'play';
    Enemies.list().forEach((e) => { e.def = { ...e.def, speed: 0, chaseSpeed: 0, sight: 0, range: 0 }; e.x = -9999; });
    const p = __scene.player;
    p.x = col * 32 + 16 - p.w / 2; p.y = (row + 1) * 32 - p.h; p.vx = 0; p.vy = 0;
    window.__peak = 99;
    setInterval(() => { const q = __scene.player; window.__peak = Math.min(window.__peak, Math.floor((q.y + q.h - 1) / 32)); }, 5);
  }, [Number(lv), face, Number(col), Number(row)]);
  await page.waitForTimeout(400);
  const tile = () => page.evaluate(() => { const p = __scene.player; return [Math.floor((p.x + p.w / 2) / 32), Math.floor((p.y + p.h - 1) / 32), p.grounded, Math.round(__scene.hp || 0)]; });
  console.log('start', JSON.stringify(await tile()));
  await page.evaluate(() => { window.__peak = 99; });
  let down = new Set();
  for (const step of macro.split(',')) {
    const [keys, ms] = step.split(':');
    const want = new Set(keys ? keys.split('+').filter(Boolean) : []);
    for (const k of down) if (!want.has(k)) await page.keyboard.up(KEY[k]);
    for (const k of want) if (!down.has(k)) await page.keyboard.down(KEY[k]);
    down = want;
    await page.waitForTimeout(Number(ms));
    console.log(step.padEnd(22), JSON.stringify(await tile()));
  }
  for (const k of down) await page.keyboard.up(KEY[k]);
  await page.waitForTimeout(700);
  console.log('final', JSON.stringify(await tile()), 'peak row', await page.evaluate(() => window.__peak));
  if (shot) await page.screenshot({ path: shot });
  await browser.close();
})();
