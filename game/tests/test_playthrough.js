// Keyboard-only playthrough of the main route, once per character.
// A simple bot holds Right, jumps at gaps and steps, and confirms card
// selections with Z. It passes when the level reaches the complete mode.
const { chromium } = require('playwright');
const path = require('path');

const url = 'file://' + path.resolve(__dirname, '..', 'changeling.html');

(async () => {
  const browser = await chromium.launch();
  const results = {};
  for (const character of ['knight', 'ranger', 'mage']) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(url);
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(120);
    const result = await page.evaluate(async (who) => {
      window.__scene = new PlayScene();
      Engine.setScene(window.__scene);
      __scene.active = who;
      const press = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
      let deaths = 0;
      let jumpUntil = 0;
      let lastMode = 'play';
      const started = performance.now();
      return await new Promise((resolve) => {
        const timer = setInterval(() => {
          const s = Engine.current();
          if (s.mode === 'complete') {
            clearInterval(timer);
            resolve({ ok: true, deaths, seconds: ((performance.now() - started) / 1000).toFixed(1) });
            return;
          }
          if (performance.now() - started > 90000) {
            clearInterval(timer);
            resolve({ ok: false, deaths, reason: 'timeout', mode: s.mode, x: s.player.x });
            return;
          }
          if (s.mode === 'select') {
            if (lastMode !== 'select') deaths++;
            press('keydown', 'KeyZ');
            setTimeout(() => press('keyup', 'KeyZ'), 30);
          }
          lastMode = s.mode;
          if (s.mode !== 'play') return;

          press('keydown', 'ArrowRight');
          const p = s.player;
          const row = Math.floor((p.y + p.h - 1) / World.TILE);
          const aheadX = p.x + p.w + 8;
          const aheadCol = Math.floor(aheadX / World.TILE);
          const blocked = World.at(aheadCol, row) === '#' || World.at(aheadCol, row) === '=';
          const gap = !(World.at(aheadCol, row + 1) === '#' || World.at(aheadCol, row + 1) === '=' || World.at(aheadCol, row + 1) === '_');
          if (p.grounded && (blocked || gap) && performance.now() > jumpUntil) {
            press('keydown', 'ArrowUp');
            setTimeout(() => press('keyup', 'ArrowUp'), 140);
            jumpUntil = performance.now() + 400;
          }
        }, 16);
      });
    }, character);
    results[character] = { ...result, errors };
    await page.close();
  }
  console.log(JSON.stringify(results, null, 1));
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
