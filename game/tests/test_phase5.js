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
  await page.keyboard.press('Enter');
  await wait(page, 150);
  const out = {};
  // Start the play scene with two hand cards.
  await page.evaluate(() => {
    Hand.collect('ranger'); Hand.collect('mage');
    window.__scene = new PlayScene(); Engine.setScene(window.__scene);
  });
  const st = () => page.evaluate(() => ({ mode: __scene.mode, sel: __scene.sel, active: __scene.active, x: __scene.player.x, y: __scene.player.y, hand: Hand.slots(), deck: Hand.deckCount() }));

  // 1. Side contact with the grunt -> selection screen.
  await page.evaluate(() => {
    const g = Enemies.list().find(e => e.kind === 'grunt');
    __scene.player.x = g.x - 10; __scene.player.y = g.y; __scene.player.vx = 0; __scene.player.vy = 0;
  });
  await wait(page, 60);
  out.afterSlain = await st();

  // 2. Right then Left, then Z to confirm. Hand index 1 is mage, index 0 is ranger.
  await page.keyboard.press('ArrowRight'); await wait(page, 60);
  out.selRight = await st();
  await page.keyboard.press('ArrowLeft'); await wait(page, 60);
  await page.keyboard.press('KeyZ'); await wait(page, 60);
  out.afterConfirm = await st();

  // 3. Hold Down for 0.6 s -> discard the current character -> selection.
  await page.keyboard.down('ArrowDown'); await wait(page, 650); await page.keyboard.up('ArrowDown');
  await wait(page, 60);
  out.afterHoldDown = await st();
  await page.keyboard.press('KeyZ'); await wait(page, 60);
  out.afterChooseAfterDiscard = await st();

  // 4. Quick tap Down -> discard-card mode, then X cancels.
  await page.evaluate(() => { Hand.collect('ranger'); Hand.collect('knight'); });
  await page.keyboard.press('ArrowDown'); await wait(page, 60);
  out.afterTapDown = await st();
  await page.keyboard.press('KeyX'); await wait(page, 60);
  out.afterCancel = await st();

  // 5. C opens discard-card mode, C discards the highlighted card.
  await page.keyboard.press('KeyC'); await wait(page, 60);
  await page.keyboard.press('KeyX'); await wait(page, 60);
  await page.keyboard.press('KeyC'); await wait(page, 60);
  const before = await st();
  await page.keyboard.press('KeyC'); await wait(page, 60);
  out.discardCard = { before: before.hand, after: await st() };

  // 6. Randomized check of the closest safe space rule.
  out.safe = await page.evaluate(() => {
    let fails = 0, n = 0;
    for (let i = 0; i < 300; i++) {
      const x = Math.random() * World.width, y = Math.random() * World.height;
      const sp = World.closestSafeSpace(x, y, 18, 30, Enemies.list());
      n++;
      const tx = Math.floor((sp.x + 9) / World.TILE), gy = Math.floor((sp.y + 30) / World.TILE);
      const ground = World.at(tx, gy);
      const standable = ground === '#' || ground === '=' || ground === '_';
      let clear = true;
      for (let dy = 1; dy <= 3; dy++) for (let dx = 0; dx <= 1; dx++) {
        const c = World.at(tx + dx, gy - dy);
        if (c === '#' || c === '=' || c === '_') clear = false;
      }
      const enemyNear = Enemies.list().some(e => !e.dead && Math.hypot(sp.x + 9 - (e.x + e.w / 2), sp.y + 15 - (e.y + e.h / 2)) < 96);
      if (!standable || !clear || enemyNear) fails++;
    }
    return { checked: n, fails };
  });
  out.errors = errors;
  console.log(JSON.stringify(out, null, 1));
  await page.screenshot({ path: __dirname + '/08_select.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
