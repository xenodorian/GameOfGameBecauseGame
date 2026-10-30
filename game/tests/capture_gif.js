// Records a short scripted moment to a GIF (and a PNG strip) so feel can be judged in motion.
//   NODE_PATH=$(npm root -g) node game/tests/capture_gif.js <scenario> [outDir]
// Scenarios: kill (knight slashes two grunts), beam (mage beam through two grunts),
//            jump (run and jump), hurt (grunt walks into the knight),
//            grunt, rat, archer, revenant (each enemy's tell and attack against a standing knight).
// Needs ffmpeg. Output: <outDir>/<scenario>.gif and <scenario>_strip.png (default game/tests/shots/gif).
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');

const scenario = process.argv[2] || 'kill';
const out = path.resolve(process.argv[3] || path.join(__dirname, 'shots', 'gif'));
const url = 'file://' + path.join(path.resolve(__dirname, '..'), 'changeling.html');
fs.mkdirSync(out, { recursive: true });
const tmp = fs.mkdtempSync(path.join(require('os').tmpdir(), 'cap-'));

const SETUP = {
  kill: { who: 'knight', enemies: [[90, 'grunt'], [150, 'grunt']], keys: [[100, 'ArrowRight', 'down'], [250, 'KeyZ'], [700, 'KeyZ'], [1100, 'ArrowRight', 'up']] },
  beam: { who: 'mage', enemies: [[70, 'grunt'], [150, 'rat_king']], keys: [[150, 'KeyA']] },
  jump: { who: 'knight', enemies: [], keys: [[50, 'ArrowRight', 'down'], [300, 'ArrowUp', 'down'], [700, 'ArrowUp', 'up'], [1000, 'ArrowUp', 'down'], [1150, 'ArrowUp', 'up'], [1500, 'ArrowRight', 'up']] },
  hurt: { who: 'knight', enemies: [[60, 'grunt', true]], keys: [] },
  grunt: { who: 'knight', enemies: [[90, 'grunt', true]], keys: [], ms: 2000 },
  rat: { who: 'knight', enemies: [[110, 'rat_king', true]], keys: [], ms: 2200 },
  archer: { who: 'knight', enemies: [[150, 'archer', true]], keys: [], ms: 2400 },
  // Warlord at the given hp (phase 1: 8 to 6, 2: 5 to 3, 3: 2 to 1), knight 150 px away.
  boss1: { who: 'knight', level: 7, bossHp: 8, keys: [], ms: 3500 },
  boss2: { who: 'knight', level: 7, bossHp: 5, keys: [], ms: 3500 },
  boss3: { who: 'knight', level: 7, bossHp: 2, keys: [], ms: 3500 },
  revenant: { who: 'knight', enemies: [[120, 'mud_revenant', true]], keys: [], ms: 2600 },
}[scenario];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  await page.goto(url);
  await page.waitForTimeout(300);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  await page.evaluate(([who, enemies, level, bossHp]) => {
    const s = new PlayScene(level || 0, who); Engine.setScene(s); s.bannerT = 0;
    const p = s.player;
    if (bossHp) {
      const w = Enemies.list().find((e) => e.kind === 'warlord');
      w.hp = bossHp; w.x = p.x + 150; w.y = p.y + p.h - w.h;
      s.updateCamera(0, true);
      s.hp = 99;
      return;
    }
    Enemies.list().length = 0;
    for (const [dx, kind, live] of enemies) {
      const e = new Enemy(kind, p.x + p.w + dx, p.y + p.h - ENEMY_DEFS[kind].h);
      e.dir = -1;
      if (!live) e.def = { ...e.def, speed: 0, chaseSpeed: 0, sight: 0 };
      Enemies.list().push(e);
    }
  }, [SETUP.who, SETUP.enemies || [], SETUP.level, SETUP.bossHp]);
  const t0 = Date.now();
  const pending = SETUP.keys.slice();
  let n = 0;
  while (Date.now() - t0 < (SETUP.ms || 1600)) {
    const now = Date.now() - t0;
    while (pending.length && pending[0][0] <= now) {
      const [, key, mode] = pending.shift();
      if (mode === 'down') await page.keyboard.down(key); else if (mode === 'up') await page.keyboard.up(key); else await page.keyboard.press(key);
    }
    await page.screenshot({ path: path.join(tmp, String(n++).padStart(3, '0') + '.png'), clip: { x: 0, y: 60, width: 960, height: 420 } });
  }
  await browser.close();
  const gif = path.join(out, scenario + '.gif');
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', path.join(tmp, '%03d.png'), '-vf', 'scale=480:-1:flags=neighbor,split[a][b];[a]palettegen[p];[b][p]paletteuse', gif]);
  // Strip: up to 12 evenly spaced frames, 4 per row.
  const pick = Math.max(1, Math.floor(n / 12));
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', path.join(tmp, '%03d.png'), '-vf', `select='not(mod(n\\,${pick}))',scale=320:-1:flags=neighbor,tile=4x3`, '-frames:v', '1', path.join(out, scenario + '_strip.png')]);
  console.log(`${n} frames -> ${gif}`);
})();
