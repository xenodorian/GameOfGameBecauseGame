const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  const errors = [];
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('' + require('path').resolve(__dirname, '..', 'changeling.html').replace(/^/, 'file://') + '');
  await page.waitForTimeout(500);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  // Take over the play scene so the test can place the knight.
  const r = await page.evaluate(async () => {
    const out = {};
    window.__scene = new PlayScene();
    Engine.setScene(window.__scene);
    const s = window.__scene;
    const wait = (ms) => new Promise(res => setTimeout(res, ms));
    out.enemies = Enemies.list().map(e => [e.kind, e.x, e.y]);
    // Death: put the knight beside the grunt at the same height.
    const g = Enemies.list().find(e => e.kind === 'grunt');
    s.player.x = g.x - 10; s.player.y = g.y; s.player.vx = 0; s.player.vy = 0;
    await wait(120);
    out.afterSideContact = { x: s.player.x, spawnX: World.spawn.x, grunt_dead: g.dead };
    // Stomp: drop the knight from just above the grunt.
    s.respawn('knight');
    const g2 = Enemies.list().find(e => e.kind === 'grunt');
    s.player.x = g2.x; s.player.y = g2.y - 60; s.player.vy = 0;
    await wait(700);
    out.afterStomp = { grunt_dead: g2.dead, pickups: Enemies.pickups().map(p => p.cardId + ':' + p.state), playerY: s.player.y };
    await wait(900);
    out.hand = Hand.slots(); out.deck = Hand.deckCount();
    out.pickupsAfter = Enemies.pickups().map(p => p.cardId + ':' + p.state);
    out.dropCardOk = Enemies.pickups().length >= 0;
    return out;
  });
  console.log(JSON.stringify(r, null, 1));
  console.log('errors', errors);
  await page.screenshot({ path: '' + __dirname + '/07_phase3.png' });
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
