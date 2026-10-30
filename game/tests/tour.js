// Fresh-player tour: a simple bot plays each level (walks right, jumps walls and gaps, attacks foes ahead)
// while the script screenshots every ~1.2 s. It logs time, damage, deaths and where they happened,
// so pacing problems and difficulty spikes show up as numbers and a contact sheet.
//   NODE_PATH=$(npm root -g) node game/tests/tour.js [levels=1-8] [who=knight] [outDir]
// Output: <outDir>/tour_L<n>.png (contact sheet) and a summary line per level on stdout.
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const spec = process.argv[2] || '1-8';
const who = process.argv[3] || 'knight';
const out = path.resolve(process.argv[4] || path.join(__dirname, 'shots', 'tour'));
const url = 'file://' + path.join(path.resolve(__dirname, '..'), 'changeling.html');
fs.mkdirSync(out, { recursive: true });
const levels = [];
for (const part of spec.split(',')) {
  const [a, b] = part.split('-').map(Number);
  for (let i = a; i <= (b || a); i++) levels.push(i);
}

(async () => {
  const browser = await chromium.launch();
  for (const n of levels) {
    const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
    await page.goto(url);
    await page.waitForTimeout(300);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(100);
    await page.evaluate(([n, who]) => {
      ['ranger', 'mage', 'weaver'].forEach((c) => Hand.collect(c));
      const s = new PlayScene(n - 1, who); Engine.setScene(s);
      window.__log = { hits: [], deaths: [], start: performance.now(), done: false, maxX: 0, stuck: 0 };
      const press = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
      let jumpUntil = 0, lastX = 0, still = 0, lastHp = s.hp;
      window.__timer = setInterval(() => {
        const sc = Engine.current();
        const L = window.__log;
        if (sc.mode === 'complete') { L.done = true; L.time = (performance.now() - L.start) / 1000; clearInterval(window.__timer); return; }
        if (sc.mode === 'select') { L.deaths.push(Math.floor(sc.deathPos.x / 32)); press('keydown', 'KeyZ'); setTimeout(() => press('keyup', 'KeyZ'), 30); return; }
        if (sc.mode !== 'play') return;
        const p = sc.player;
        if (sc.hp < lastHp) L.hits.push(Math.floor(p.x / 32));
        lastHp = sc.hp;
        L.maxX = Math.max(L.maxX, p.x);
        const ex = World.exit();
        const dir = ex && p.x > ex.x + 16 ? -1 : 1;
        press('keydown', dir > 0 ? 'ArrowRight' : 'ArrowLeft');
        press('keyup', dir > 0 ? 'ArrowLeft' : 'ArrowRight');
        const row = Math.floor((p.y + p.h - 1) / 32);
        const col = Math.floor((p.x + (dir > 0 ? p.w + 8 : -8)) / 32);
        const solid = (c) => ['#', '=', 'x'].includes(c);
        const blocked = solid(World.at(col, row)) || solid(World.at(col, row - 1));
        const gap = !['#', '=', '_', 'x'].includes(World.at(col, row + 1));
        // Stuck for 1 s: jump anyway (a human would try).
        if (Math.abs(p.x - lastX) < 0.5) still++; else still = 0;
        lastX = p.x;
        if (p.grounded && (blocked || gap || still > 60) && performance.now() > jumpUntil) {
          press('keydown', 'ArrowUp'); setTimeout(() => press('keyup', 'ArrowUp'), 450);
          jumpUntil = performance.now() + 600;
          if (still > 60) L.stuck++;
        }
        // Attack a foe ahead on about the same height; cracked walls get a bash.
        const foe = Enemies.list().find((e) => !e.dead && Math.sign(e.x - p.x) === dir && Math.abs(e.x - p.x) < 70 && Math.abs(e.y + e.h - p.y - p.h) < 40);
        if (foe) { press('keydown', 'KeyZ'); setTimeout(() => press('keyup', 'KeyZ'), 30); }
        if (World.at(col, row) === 'x' || World.at(col, row - 1) === 'x') { press('keydown', 'KeyA'); setTimeout(() => press('keyup', 'KeyA'), 30); }
      }, 16);
    }, [n, who]);
    const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tour-'));
    let k = 0;
    const t0 = Date.now();
    while (Date.now() - t0 < 75000) {
      const L = await page.evaluate(() => window.__log);
      if (L.done) break;
      await page.screenshot({ path: path.join(tmp, String(k++).padStart(3, '0') + '.png') });
      await page.waitForTimeout(1200);
    }
    const L = await page.evaluate(() => ({ ...window.__log, width: World.width / 32, name: World.level.name }));
    // At most 12 evenly spaced frames, 4 per row.
    const pick = Math.max(1, Math.ceil(k / 12));
    const used = Math.ceil(k / pick);
    const cols = Math.min(4, used);
    const rows = Math.ceil(used / cols);
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '1', '-i', path.join(tmp, '%03d.png'), '-vf', `select='not(mod(n\\,${pick}))',scale=320:-1:flags=neighbor,tile=${cols}x${rows}`, '-frames:v', '1', path.join(out, `tour_L${n}.png`)]);
    console.log(`L${n} ${L.name}: ${L.done ? 'done in ' + L.time.toFixed(1) + ' s' : 'NOT done (reached col ' + Math.floor(L.maxX / 32) + ' of ' + L.width + ')'}; hits at cols [${L.hits}]; deaths at [${L.deaths}]; stuck jumps ${L.stuck}; shots ${k}${errors.length ? '; ERRORS ' + errors.slice(0, 2).join(' | ') : ''}`);
    await page.close();
  }
  await browser.close();
})();
