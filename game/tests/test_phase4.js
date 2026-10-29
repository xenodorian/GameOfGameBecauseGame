const { chromium } = require('playwright');
const wait = (p, ms) => p.waitForTimeout(ms);
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('' + require('path').resolve(__dirname, '..', 'changeling.html').replace(/^/, 'file://') + '');
  await wait(page, 400);
  await page.keyboard.press('Enter'); await wait(page, 150);
  await page.evaluate(() => { window.__scene = new PlayScene(); Engine.setScene(window.__scene); });
  const out = {};
  const grunt = () => Enemies.list().find(e => e.kind === 'grunt');
  const rev = () => Enemies.list().find(e => e.kind === 'mud_revenant');
  const freeze = () => page.evaluate(() => { Enemies.list().forEach(e => { e.def = { ...e.def, speed: 0, chaseSpeed: 0, sight: 0 }; }); });

  // Knight slash (ab3 = KeyZ) kills the grunt.
  await page.evaluate(() => { const g = Enemies.list().find(e => e.kind==='grunt'); window.__g = g; __scene.player.x = g.x - 40; __scene.player.y = g.y; __scene.player.facing = 1; __scene.player.vy = 0; });
  await freeze();
  await page.keyboard.press('KeyZ'); await wait(page, 80);
  out.knightSlashKillsGrunt = await page.evaluate(() => window.__g.dead);

  // Knight shield bash (ab1 = KeyA) stuns the revenant.
  await page.evaluate(() => { const r = Enemies.list().find(e => e.kind==='mud_revenant'); __scene.player.x = r.x - 22; __scene.player.y = r.y; __scene.player.vy = 0; });
  await page.keyboard.press('KeyA'); await wait(page, 60);
  out.bashStuns = await page.evaluate(() => Enemies.list().find(e => e.kind==='mud_revenant').stunT > 0);
  await wait(page, 1400);
  out.afterBash = await page.evaluate(() => ({ mode: __scene.mode, x: __scene.player.x, y: __scene.player.y, facing: __scene.player.facing, active: __scene.active }));

  // Knight charge (ab2 = KeyS) sets a dash. Enemies are frozen so the revenant cannot reach the knight.
  await freeze();
  await page.evaluate(() => { __scene.player.x = 200; __scene.player.y = 288; __scene.player.vy = 0; __scene.player.facing = 1; });
  await wait(page, 100);
  await page.keyboard.press('KeyS'); await wait(page, 40);
  out.chargeDbg = await page.evaluate(() => ({ dashT: __scene.dashT, vx: __scene.player.vx, x: __scene.player.x, mode: __scene.mode }));
  out.chargeDash = await page.evaluate(() => __scene.dashT > 0 && Math.abs(__scene.player.vx) > 300);
  await wait(page, 300);

  // Ranger: shoot (ab1 = KeyA) kills a grunt in line.
  await page.evaluate(() => {
    __scene.active = 'ranger';
    const g = new Enemy('grunt', 900, 256); g.dir = 1; Enemies.list().push(g);
    window.__h = g;
    __scene.player.x = 860; __scene.player.y = 256; __scene.player.facing = 1; __scene.player.vy = 0;
  });
  await page.keyboard.press('KeyA'); await wait(page, 400);
  out.rangerShootKills = await page.evaluate(() => window.__h.dead);

  // Ranger: arrow anchor (ab2 = KeyS) makes a platform; stand on it.
  await page.evaluate(() => { __scene.player.x = 200; __scene.player.y = 160; __scene.player.vy = 0; __scene.player.facing = 1; });
  await page.keyboard.press('KeyS'); await wait(page, 30);
  out.anchorPlatforms = await page.evaluate(() => World.platforms.length);
  await page.evaluate(() => { const pl = World.platforms[0]; __scene.player.x = pl.x + 8; __scene.player.y = pl.y - 120; __scene.player.vy = 0; });
  await wait(page, 800);
  out.standsOnRope = await page.evaluate(() => { const pl = World.platforms[0]; return { grounded: __scene.player.grounded, onTop: Math.abs(__scene.player.y + __scene.player.h - pl.y) < 1 }; });

  // Ranger: hop (ab4 = KeyX) in the air once.
  await page.evaluate(() => { __scene.player.x = 200; __scene.player.y = 60; __scene.player.vy = 0; __scene.player.grounded = false; __scene.player.hopUsed = false; });
  await wait(page, 30);
  await page.keyboard.press('KeyX'); await wait(page, 20);
  out.hopVy = await page.evaluate(() => __scene.player.vy);

  // Mage: blink (ab4 = KeyX) moves forward; float (ab2 = KeyS) caps fall speed.
  await page.evaluate(() => { __scene.active='mage'; __scene.player.x = 200; __scene.player.y = 160; __scene.player.vy=0; __scene.player.facing=1; __scene.floatT=0; });
  await wait(page, 60);
  const bx = await page.evaluate(() => __scene.player.x);
  await page.keyboard.press('KeyX'); await wait(page, 30);
  out.blinkDx = await page.evaluate((b) => __scene.player.x - b, bx);
  await page.evaluate(() => { __scene.player.x = 200; __scene.player.y = 40; __scene.player.vy = 0; });
  await page.keyboard.press('KeyS'); await wait(page, 500);
  out.floatCappedVy = await page.evaluate(() => __scene.player.vy <= 41);
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
