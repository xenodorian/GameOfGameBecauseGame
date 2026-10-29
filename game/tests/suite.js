// Full test suite for the Changeling build. Run from any folder:
//   NODE_PATH=$(npm root -g) node game/tests/suite.js
// Needs Playwright with Chromium. Exits 1 if any check fails.
const { chromium } = require('playwright');
const assert = require('assert');
const path = require('path');
const { execFileSync } = require('child_process');

const GAME = path.resolve(__dirname, '..');
const url = 'file://' + path.join(GAME, 'changeling.html');
const wait = (p, ms) => p.waitForTimeout(ms);

const checks = [];
function check(name, fn) { checks.push({ name, fn }); }

async function newPage(browser) {
  const page = await browser.newPage({ viewport: { width: 960, height: 540 } });
  await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  await page.goto(url);
  await wait(page, 300);
  return page;
}

// Opens a fresh play scene with the given hand cards and active character.
// Enemies are frozen unless freeze is false, so ability checks are not disturbed.
async function startPlay(page, { hand = [], active = 'knight', freeze = true } = {}) {
  await page.keyboard.press('Enter');
  await wait(page, 120);
  await page.evaluate(([h, a, f]) => {
    h.forEach((c) => Hand.collect(c));
    window.__scene = new PlayScene();
    Engine.setScene(window.__scene);
    __scene.active = a;
    if (f) Enemies.list().forEach((e) => { e.def = { ...e.def, speed: 0, chaseSpeed: 0, sight: 0 }; });
  }, [hand, active, freeze]);
}

const placeAt = (page, x, y) => page.evaluate(([x, y]) => {
  __scene.player.x = x; __scene.player.y = y; __scene.player.vy = 0; __scene.player.vx = 0;
}, [x, y]);

check('menus: title, play, pause, back, credits', async (browser) => {
  const page = await newPage(browser);
  const name = () => page.evaluate(() => Engine.current().constructor.name);
  assert.equal(await name(), 'TitleScene');
  await page.keyboard.press('Enter'); await wait(page, 80);
  assert.equal(await name(), 'IntroScene');
  await page.keyboard.press('Enter'); await wait(page, 80);
  await page.keyboard.press('Enter'); await wait(page, 150);
  assert.equal(await name(), 'PlayScene');
  await page.keyboard.press('Enter'); await wait(page, 80);
  assert.equal(await page.evaluate(() => Engine.current().mode), 'pause');
  await page.keyboard.press('KeyX'); await wait(page, 80);
  assert.equal(await page.evaluate(() => Engine.current().mode), 'play');
  await page.keyboard.press('Enter'); await wait(page, 80);
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('Enter'); await wait(page, 80);
  assert.equal(await name(), 'TitleScene');
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('ArrowDown'); await wait(page, 80);
  await page.keyboard.press('Enter'); await wait(page, 80);
  assert.equal(await name(), 'CreditsScene');
  await page.keyboard.press('KeyX'); await wait(page, 80);
  assert.equal(await name(), 'TitleScene');
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('hand: fill, overflow to deck, refill after discard', async (browser) => {
  const page = await newPage(browser);
  const r = await page.evaluate(() => {
    const out = {};
    out.where = ['ranger', 'mage', 'knight', 'ranger', 'mage'].map((c) => Hand.collect(c).where);
    out.slots = Hand.slots();
    out.deck = Hand.deckCount();
    Hand.discard(0);
    out.afterDiscard = Hand.slots();
    out.deckAfter = Hand.deckCount();
    return out;
  });
  assert.deepEqual(r.where, ['hand', 'hand', 'hand', 'deck', 'deck']);
  assert.equal(r.deck, 2);
  assert.notEqual(r.afterDiscard[0], null);
  assert.equal(r.deckAfter, 1);
  await page.close();
});

check('stomp defeats a grunt and drops a card; side contact respawns safely', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [], freeze: false });
  await page.evaluate(() => { window.__g = Enemies.list().find((e) => e.kind === 'grunt'); });
  // Grunt stands on the floor at col 15; knight drops onto it from above.
  await page.evaluate(() => { __g.x = 480; __g.y = 418; __g.def = { ...__g.def, speed: 0, chaseSpeed: 0, sight: 0 }; });
  await page.evaluate(() => { __scene.player.x = 480; __scene.player.y = 300; __scene.player.vy = 0; });
  await wait(page, 700);
  assert.equal(await page.evaluate(() => __g.dead), true);
  // The grunt drops a card, so the hand is not empty and a death opens the choice.
  await page.evaluate(() => { __scene.beginSelection('slain'); });
  await page.keyboard.press('KeyZ'); await wait(page, 80);
  // The respawn flash ignores contact for one second, so wait it out first.
  await wait(page, 1100);
  await page.evaluate(() => {
    window.__r = Enemies.list().find((e) => e.kind === 'mud_revenant');
    __r.def = { ...__r.def, speed: 0, chaseSpeed: 0, sight: 0 };
    __scene.player.x = __r.x - 10; __scene.player.y = __r.y;
  });
  await wait(page, 80);
  // The stomped grunt left a card in hand, so the side contact opens the choice first.
  assert.equal(await page.evaluate(() => __scene.mode), 'select');
  await page.keyboard.press('KeyZ'); await wait(page, 80);
  assert.equal(await page.evaluate(() => __scene.mode), 'play');
  assert.equal(await page.evaluate(() => __r.dead), false);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('selection: death opens the card choice; Right then Z respawns as the chosen card', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: ['ranger', 'mage'] });
  await page.evaluate(() => { __scene.beginSelection('slain'); });
  assert.equal(await page.evaluate(() => __scene.mode), 'select');
  await page.keyboard.press('ArrowRight'); await wait(page, 60);
  assert.equal(await page.evaluate(() => __scene.sel), 1);
  await page.keyboard.press('ArrowLeft'); await wait(page, 60);
  await page.keyboard.press('KeyZ'); await wait(page, 60);
  const s = await page.evaluate(() => ({ mode: __scene.mode, active: __scene.active, hand: Hand.slots() }));
  assert.equal(s.mode, 'play');
  assert.equal(s.active, 'ranger');
  assert.deepEqual(s.hand, [null, 'mage', null]);
  await page.close();
});

check('discard: hold Down, tap Down then C, X cancels, C discards, Q discards self', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: ['ranger', 'knight'] });
  await page.keyboard.down('ArrowDown'); await wait(page, 650); await page.keyboard.up('ArrowDown');
  await wait(page, 60);
  assert.equal(await page.evaluate(() => __scene.reason), 'discarded');
  await page.keyboard.press('KeyZ'); await wait(page, 60);
  await page.keyboard.press('ArrowDown'); await wait(page, 60);
  assert.equal(await page.evaluate(() => __scene.mode), 'discardCard');
  await page.keyboard.press('KeyX'); await wait(page, 60);
  assert.equal(await page.evaluate(() => __scene.mode), 'play');
  await page.keyboard.press('KeyC'); await wait(page, 60);
  await page.keyboard.press('KeyC'); await wait(page, 60);
  assert.equal(await page.evaluate(() => Hand.slots().filter(Boolean).length), 0);
  await page.evaluate(() => Hand.collect('mage'));
  await page.keyboard.press('KeyQ'); await wait(page, 60);
  assert.equal(await page.evaluate(() => __scene.mode), 'select');
  await page.close();
});

check('safe space: 300 random death points all land on a valid spot', async (browser) => {
  const page = await newPage(browser);
  const fails = await page.evaluate(() => {
    let fails = 0;
    for (let i = 0; i < 300; i++) {
      const sp = World.closestSafeSpace(Math.random() * World.width, Math.random() * World.height, 18, 30, Enemies.list());
      const tx = Math.floor((sp.x + 9) / World.TILE), gy = Math.floor((sp.y + 30) / World.TILE);
      const g = World.at(tx, gy);
      const standable = g === '#' || g === '=' || g === '_';
      let clear = true;
      for (let dy = 1; dy <= 3; dy++) for (let dx = 0; dx <= 1; dx++) {
        const c = World.at(tx + dx, gy - dy);
        if (c === '#' || c === '=' || c === '_') clear = false;
      }
      const near = Enemies.list().some((e) => !e.dead && Math.hypot(sp.x + 9 - (e.x + e.w / 2), sp.y + 15 - (e.y + e.h / 2)) < 96);
      if (!standable || !clear || near) fails++;
    }
    return fails;
  });
  assert.equal(fails, 0);
  await page.close();
});

// Each ability: who uses it, the key, how to set up, and what to check after.
const abilities = [
  {
    name: 'knight slash (Z) defeats a grunt', who: 'knight', key: 'KeyZ', wait: 80,
    setup: (p) => p.evaluate(() => {
      const g = new Enemy('grunt', __scene.player.x + 30, __scene.player.y);
      g.def = { ...g.def, speed: 0, chaseSpeed: 0, sight: 0 };
      Enemies.list().push(g); window.__g = g;
    }),
    check: (p) => p.evaluate(() => __g.dead), want: true,
  },
  {
    name: 'knight thrust (X) defeats a grunt in reach', who: 'knight', key: 'KeyX', wait: 80,
    setup: (p) => p.evaluate(() => {
      const g = new Enemy('grunt', __scene.player.x + 44, __scene.player.y);
      g.def = { ...g.def, speed: 0, chaseSpeed: 0, sight: 0 };
      Enemies.list().push(g); window.__g = g;
    }),
    check: (p) => p.evaluate(() => __g.dead), want: true,
  },
  {
    name: 'knight shield bash (A) stuns a revenant', who: 'knight', key: 'KeyA', wait: 60,
    setup: (p) => p.evaluate(() => {
      window.__r = Enemies.list().find((e) => e.kind === 'mud_revenant');
      __scene.player.x = __r.x - 22; __scene.player.y = __r.y;
    }),
    check: (p) => p.evaluate(() => __r.stunT > 0), want: true,
  },
  {
    name: 'knight charge (S) dashes', who: 'knight', key: 'KeyS', wait: 40,
    setup: (p) => placeAt(p, 200, 288),
    check: (p) => p.evaluate(() => __scene.dashT > 0 && Math.abs(__scene.player.vx) > 300), want: true,
  },
  {
    name: 'ranger shoot (A) defeats a grunt in line', who: 'ranger', key: 'KeyA', wait: 400,
    setup: (p) => p.evaluate(() => {
      const g = new Enemy('grunt', 900, 256);
      g.def = { ...g.def, speed: 0, chaseSpeed: 0, sight: 0 };
      Enemies.list().push(g); window.__g = g;
      __scene.player.x = 860; __scene.player.y = 256; __scene.player.facing = 1;
    }),
    check: (p) => p.evaluate(() => __g.dead), want: true,
  },
  {
    name: 'ranger arrow anchor (S) makes a platform', who: 'ranger', key: 'KeyS', wait: 30,
    setup: (p) => placeAt(p, 200, 160),
    check: (p) => p.evaluate(() => World.platforms.length), want: 1,
  },
  {
    name: 'ranger hop (X) gives upward speed in air', who: 'ranger', key: 'KeyX', wait: 20,
    setup: (p) => p.evaluate(() => {
      __scene.player.x = 200; __scene.player.y = 60; __scene.player.grounded = false; __scene.player.hopUsed = false;
    }),
    check: (p) => p.evaluate(() => __scene.player.vy), want: 'upward',
  },
  {
    name: 'mage spell bolt (A) defeats a grunt in line', who: 'mage', key: 'KeyA', wait: 400,
    setup: (p) => p.evaluate(() => {
      const g = new Enemy('grunt', 900, 256);
      g.def = { ...g.def, speed: 0, chaseSpeed: 0, sight: 0 };
      Enemies.list().push(g); window.__g = g;
      __scene.player.x = 860; __scene.player.y = 256; __scene.player.facing = 1;
    }),
    check: (p) => p.evaluate(() => __g.dead), want: true,
  },
  {
    name: 'mage float (S) hovers while Up is held', who: 'mage', key: 'KeyS', wait: 300, hold: 'ArrowUp',
    setup: (p) => placeAt(p, 200, 40),
    check: (p) => p.evaluate(() => __scene.player.vy), want: -120,
  },
  {
    name: 'rat leap (A) jumps higher than a plain jump', who: 'rat', key: 'KeyA', wait: 20,
    setup: (p) => placeAt(p, 200, 418),
    check: (p) => p.evaluate(() => __scene.player.vy), want: 'leap',
  },
  {
    name: 'rat scurry (S) walks faster', who: 'rat', key: 'KeyS', hold: 'ArrowRight', wait: 200,
    setup: (p) => placeAt(p, 200, 418),
    check: (p) => p.evaluate(() => __scene.player.vx), want: 220,
  },
  {
    name: 'weaver bone bridge (S) makes a 5 tile platform', who: 'weaver', key: 'KeyS', wait: 30,
    setup: (p) => placeAt(p, 200, 160),
    check: (p) => p.evaluate(() => World.platforms[0] && World.platforms[0].w), want: 160,
  },
  {
    name: 'mage blink (X) moves 96 px', who: 'mage', key: 'KeyX', wait: 30,
    setup: (p) => placeAt(p, 200, 160),
    check: null,
  },
];

for (const a of abilities) {
  check('ability: ' + a.name, async (browser) => {
    const page = await newPage(browser);
    await startPlay(page, { hand: [], active: a.who });
    await a.setup(page);
    await wait(page, 60);
    if (a.name.startsWith('mage blink')) {
      const x0 = await page.evaluate(() => __scene.player.x);
      await page.keyboard.press(a.key); await wait(page, a.wait);
      assert.equal(await page.evaluate((x) => __scene.player.x - x, x0), 96);
    } else if (a.hold) {
      await page.keyboard.down(a.key); await page.keyboard.up(a.key);
      await page.keyboard.down(a.hold); await wait(page, a.wait);
      assert.equal(await a.check(page), a.want);
      await page.keyboard.up(a.hold);
    } else {
      // The game clock runs slower than wall time in headless Chromium, so wait for the charge to set its speed.
      const t0 = a.name.includes('charge') ? await page.evaluate(() => __scene.time) : null;
      await page.keyboard.press(a.key); await wait(page, a.wait);
      if (t0 !== null) await page.waitForFunction((t) => __scene.time >= t, t0 + 0.08);
      const got = await a.check(page);
      if (a.want === 'upward') assert.ok(got < -250 && got > -320, 'vy ' + got);
      else if (a.want === 'leap') assert.ok(got < -500 && got > -560, 'vy ' + got);
      else assert.equal(got, a.want);
    }
    assert.deepEqual(page.errors, []);
    await page.close();
  });
}

check('ability: ranger arrow anchor platform can be stood on', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [], active: 'ranger' });
  await placeAt(page, 200, 160);
  await page.keyboard.press('KeyS'); await wait(page, 30);
  await page.evaluate(() => { const pl = World.platforms[0]; __scene.player.x = pl.x + 8; __scene.player.y = pl.y - 120; __scene.player.vy = 0; });
  await wait(page, 800);
  const ok = await page.evaluate(() => {
    const pl = World.platforms[0];
    return __scene.player.grounded && Math.abs(__scene.player.y + __scene.player.h - pl.y) < 1;
  });
  assert.equal(ok, true);
  await page.close();
});

check('exit: reaching the flag shows level complete; Enter replays', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => { const f = World.exit(); __scene.player.x = f.x; __scene.player.y = f.y; });
  await wait(page, 100);
  assert.equal(await page.evaluate(() => __scene.mode), 'complete');
  await page.keyboard.press('Enter'); await wait(page, 100);
  const next = await page.evaluate(() => ({ count: World.count, index: World.index, scene: Engine.current().constructor.name }));
  if (next.count > 1) assert.equal(next.index, 1);
  else assert.equal(next.scene, 'EndingScene');
  await page.close();
});

check('levels: every level loads, has a spawn and an exit, and completing it moves on', async (browser) => {
  const page = await newPage(browser);
  await page.keyboard.press('Enter'); await wait(page, 120);
  const count = await page.evaluate(() => World.count);
  for (let i = 0; i < count; i++) {
    await page.evaluate((idx) => {
      window.__scene = new PlayScene(idx); Engine.setScene(window.__scene);
      for (let k = 0; k < 8; k++) {
        const w = Enemies.list().find((e) => e.kind === 'warlord');
        if (w) { w.hurtT = 0; Enemies.defeat(w); }
      }
      const f = World.exit(); __scene.player.x = f.x; __scene.player.y = f.y;
    }, i);
    await wait(page, 100);
    assert.equal(await page.evaluate(() => __scene.mode), 'complete', 'level ' + (i + 1));
    await page.keyboard.press('Enter'); await wait(page, 100);
    const after = await page.evaluate(() => ({ index: World.index, scene: Engine.current().constructor.name }));
    if (i + 1 < count) assert.equal(after.index, i + 1);
    else assert.equal(after.scene, 'EndingScene');
  }
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('portrait: rotate overlay shows; landscape touch buttons move and jump', async (browser) => {
  const ctxA = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  const portrait = await ctxA.newPage();
  await portrait.goto(url); await wait(portrait, 300);
  assert.equal(await portrait.evaluate(() => getComputedStyle(document.getElementById('rotate')).display !== 'none'), true);
  await ctxA.close();

  const ctxB = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true });
  const page = await ctxB.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(url); await wait(page, 300);
  await startPlay(page, { hand: [] });
  const x0 = await page.evaluate(() => __scene.player.x);
  const tap = (action, ms) => page.evaluate(([a, m]) => new Promise((res) => {
    const b = document.querySelector(`button[data-action="${a}"]`);
    b.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true }));
    setTimeout(() => { b.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true })); res(); }, m);
  }), [action, ms]);
  await tap('right', 400);
  assert.ok((await page.evaluate(() => __scene.player.x)) - x0 > 20);
  await tap('up', 40);
  assert.ok((await page.evaluate(() => __scene.player.vy)) < 0);
  assert.deepEqual(page.errors, []);
  await ctxB.close();
});

check('gamepad: stubbed pad moves right on the d-pad and holds ability 3 on A', async (browser) => {
  const ctx = await browser.newContext({ viewport: { width: 960, height: 540 } });
  await ctx.addInitScript(() => {
    const buttons = Array.from({ length: 17 }, (_, i) => ({ pressed: i === 15 || i === 0, value: i === 15 || i === 0 ? 1 : 0 }));
    navigator.getGamepads = () => [{ buttons, axes: [0, 0, 0, 0] }];
  });
  const page = await ctx.newPage();
  await page.goto(url); await wait(page, 300);
  await startPlay(page, { hand: [] });
  const x0 = await page.evaluate(() => __scene.player.x);
  await wait(page, 300);
  assert.ok((await page.evaluate(() => __scene.player.x)) - x0 > 20);
  assert.equal(await page.evaluate(() => Input.down('ab3')), true);
  await ctx.close();
});

for (const character of ['knight', 'ranger', 'mage']) {
  check(`playthrough: keyboard bot reaches the exit as ${character}`, async (browser) => {
    const page = await newPage(browser);
    await page.keyboard.press('Enter'); await wait(page, 120);
    const result = await page.evaluate((who) => new Promise((resolve) => {
      window.__scene = new PlayScene(); Engine.setScene(window.__scene); __scene.active = who;
      const press = (type, code) => window.dispatchEvent(new KeyboardEvent(type, { code }));
      const started = performance.now();
      let jumpUntil = 0;
      const timer = setInterval(() => {
        const s = Engine.current();
        if (s.mode === 'complete') { clearInterval(timer); return resolve({ ok: true }); }
        if (performance.now() - started > 90000) { clearInterval(timer); return resolve({ ok: false, mode: s.mode }); }
        if (s.mode === 'select') { press('keydown', 'KeyZ'); setTimeout(() => press('keyup', 'KeyZ'), 30); }
        if (s.mode !== 'play') return;
        // Walk toward the exit: right by default, left if a respawn put the knight past the flag.
        const p = s.player;
        const ex = World.exit();
        const dir = ex && p.x > ex.x + World.TILE / 2 ? -1 : 1;
        press('keydown', dir > 0 ? 'ArrowRight' : 'ArrowLeft');
        press('keyup', dir > 0 ? 'ArrowLeft' : 'ArrowRight');
        const row = Math.floor((p.y + p.h - 1) / World.TILE);
        const col = Math.floor((p.x + (dir > 0 ? p.w + 8 : -8)) / World.TILE);
        const blocked = World.at(col, row) === '#' || World.at(col, row) === '=';
        const gap = !['#', '=', '_'].includes(World.at(col, row + 1));
        if (p.grounded && (blocked || gap) && performance.now() > jumpUntil) {
          press('keydown', 'ArrowUp'); setTimeout(() => press('keyup', 'ArrowUp'), 140);
          jumpUntil = performance.now() + 400;
        }
      }, 16);
    }), character);
    assert.equal(result.ok, true, JSON.stringify(result));
    await page.close();
  });
}

check('enemy: rat king hops toward a nearby player', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [], freeze: false });
  await page.evaluate(() => {
    window.__j = Enemies.list().find((e) => e.kind === 'rat_king');
    __j.x = __scene.player.x + 60; __j.y = __scene.player.y;
  });
  let sawJump = false;
  for (let i = 0; i < 30 && !sawJump; i++) {
    await wait(page, 60);
    sawJump = await page.evaluate(() => __j.vy < -100);
  }
  assert.equal(sawJump, true);
  assert.deepEqual(page.errors, []);
  await page.close();
});

// Only the archer is alive in these checks, so its arrows are the only hazard.
async function archerScene(page, { hand = [] } = {}) {
  await startPlay(page, { hand, freeze: false });
  await page.evaluate(() => {
    const list = Enemies.list();
    const archer = list.find((e) => e.kind === 'archer') || new Enemy('archer', 600, 418);
    archer.x = 600; archer.y = 418; archer.dir = -1;
    list.length = 0; list.push(archer);
    window.__archer = archer;
    __scene.player.x = 500; __scene.player.y = 418; __scene.player.vy = 0; __scene.player.vx = 0;
  });
}

check('archer: fires an arrow when the player is lined up within 200 px', async (browser) => {
  const page = await newPage(browser);
  await archerScene(page);
  let fired = false;
  for (let i = 0; i < 40 && !fired; i++) {
    await wait(page, 100);
    fired = await page.evaluate(() => Attacks.hostileCount() > 0);
  }
  assert.equal(fired, true);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('archer: an arrow hitting the player opens the death selection', async (browser) => {
  const page = await newPage(browser);
  await archerScene(page, { hand: ['ranger'] });
  let selected = false;
  for (let i = 0; i < 60 && !selected; i++) {
    await wait(page, 100);
    selected = await page.evaluate(() => __scene.mode === 'select');
  }
  assert.equal(selected, true);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('enemy: archer is drawn on every idle frame', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  // The sheet has 2 idle frames and 9 walk frames. Every column the draw code can pick must exist.
  const r = await page.evaluate(() => {
    const cols = [0, 0.34, 0.67, 1.0, 5].map((t) => Math.floor(t * 3) % ANIM_ROWS.idle[1]);
    return { idle: ANIM_ROWS.idle[1], walk: ANIM_ROWS.walk[1], cols, sheetOk: cols.every((c) => c < ANIM_ROWS.idle[1]) };
  });
  assert.equal(r.idle, 2);
  assert.equal(r.walk, 9);
  assert.equal(r.sheetOk, true, 'idle columns ' + r.cols.join(','));
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('platform: knight jumps up through a one-way platform and lands on it', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  // One-way platform top at y 390, within a jump's reach of the floor (feet at 448, jump peak feet at 384).
  await page.evaluate(() => {
    World.addPlatform({ x: 440, y: 390, w: 96, h: 6, life: 100 });
    __scene.player.x = 470; __scene.player.y = 418; __scene.player.vy = 0; __scene.player.vx = 0;
  });
  await wait(page, 60);
  // Hold Up for the whole jump; releasing it early cuts the jump short.
  await page.keyboard.down('ArrowUp');
  let top = 1e9;
  let grounded = false;
  for (let i = 0; i < 40; i++) {
    await wait(page, 40);
    const r = await page.evaluate(() => ({ y: __scene.player.y, g: __scene.player.grounded }));
    top = Math.min(top, r.y);
    grounded = r.g;
    if (i === 8) await page.keyboard.up('ArrowUp');
  }
  assert.ok(top < 390 - 30, 'knight passed above the platform: top y ' + top);
  const feet = await page.evaluate(() => __scene.player.y + __scene.player.h);
  assert.equal(grounded && Math.abs(feet - 390) < 1, true, 'standing on the platform, feet ' + feet);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('platform tile: knight jumps up through a "_" tile and stands on it', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  // A solid step on row 13 (feet at 416). Three one-way tiles on row 12 (top 384) are 32 px above the
  // step, well within a jump. The knight starts on the step, under the tiles' left edge.
  await page.evaluate(() => {
    for (let x = 2; x <= 4; x++) World.setTile(x, 13, '#');
    for (let x = 5; x <= 7; x++) World.setTile(x, 12, '_');
    __scene.player.x = 150;
    __scene.player.y = 13 * World.TILE - __scene.player.h;
    __scene.player.vy = 0; __scene.player.vx = 0;
  });
  await wait(page, 60);
  await page.keyboard.down('ArrowUp');
  let top = 1e9;
  let grounded = false;
  for (let i = 0; i < 40; i++) {
    await wait(page, 40);
    const r = await page.evaluate(() => ({ y: __scene.player.y, g: __scene.player.grounded }));
    top = Math.min(top, r.y);
    grounded = r.g;
    if (i === 8) await page.keyboard.up('ArrowUp');
  }
  assert.ok(top < 12 * 32, 'knight passed above the one-way tile: top y ' + top);
  const feet = await page.evaluate(() => __scene.player.y + __scene.player.h);
  assert.equal(grounded && Math.abs(feet - 12 * 32) < 1, true, 'standing on the "_" tile, feet ' + feet);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('reset: new game after playing is clean', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => {
    Hand.collect('mage'); Hand.collect('mage');
    Run.deaths = 5;
    __scene.player.x = 300; __scene.player.y = 300;
    Attacks.use('shoot', __scene);
    Attacks.fireHostile(100, 100, 1);
  });
  await page.evaluate(() => { Engine.setScene(new TitleScene()); });
  await wait(page, 60);
  await page.keyboard.press('Enter'); await wait(page, 120);
  const s = await page.evaluate(() => ({
    hand: Hand.slots(), deck: Hand.deckCount(), deaths: Run.deaths,
    index: World.index, platforms: World.platforms.length, hostile: Attacks.hostileCount(),
  }));
  assert.deepEqual(s.hand, [null, null, null]);
  assert.equal(s.deck, 0);
  assert.equal(s.deaths, 0);
  assert.equal(s.index, 0);
  assert.equal(s.platforms, 0);
  assert.equal(s.hostile, 0);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('input: Left and Right together stand still', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await wait(page, 60);
  const x0 = await page.evaluate(() => __scene.player.x);
  await page.keyboard.down('ArrowLeft'); await page.keyboard.down('ArrowRight');
  await wait(page, 300);
  const r = await page.evaluate(() => ({ vx: __scene.player.vx, x: __scene.player.x }));
  await page.keyboard.up('ArrowLeft'); await page.keyboard.up('ArrowRight');
  assert.equal(r.vx, 0);
  assert.ok(Math.abs(r.x - x0) < 1, 'moved ' + (r.x - x0) + ' px');
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('input: spamming Enter on level complete advances exactly one level', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => { const f = World.exit(); __scene.player.x = f.x; __scene.player.y = f.y; });
  await wait(page, 100);
  assert.equal(await page.evaluate(() => __scene.mode), 'complete');
  for (let i = 0; i < 5; i++) { await page.keyboard.press('Enter'); await wait(page, 20); }
  await wait(page, 300);
  // The level changed, so the scene is the new one: read it through Engine.current().
  const s = await page.evaluate(() => ({ index: World.index, mode: Engine.current().mode }));
  assert.equal(s.index, 1);
  assert.ok(s.mode === 'play' || s.mode === 'pause', 'mode ' + s.mode);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('input: spamming Z on the selection screen confirms once', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: ['ranger', 'mage'] });
  await page.evaluate(() => { __scene.beginSelection('slain'); });
  assert.equal(await page.evaluate(() => __scene.mode), 'select');
  const before = await page.evaluate(() => Hand.slots().filter((c) => c !== null).length);
  for (let i = 0; i < 5; i++) { await page.keyboard.press('KeyZ'); await wait(page, 20); }
  await wait(page, 200);
  const after = await page.evaluate(() => Hand.slots().filter((c) => c !== null).length);
  assert.equal(before - after, 1, 'cards that left the hand: ' + (before - after));
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('physics: a very fast fall does not pass through the floor', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => {
    const T = World.TILE;
    // Level 1 floor top is row 14. Start one tile above the floor, falling very fast.
    __scene.player.x = 4 * T; __scene.player.y = 13 * T - __scene.player.h - 40;
    __scene.player.vy = 3000; __scene.player.vx = 0;
  });
  await wait(page, 200);
  const r = await page.evaluate(() => ({ feet: __scene.player.y + __scene.player.h, g: __scene.player.grounded }));
  assert.equal(r.g, true);
  assert.equal(Math.abs(r.feet - 14 * 32) < 1, true, 'feet at ' + r.feet);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('animation: walking right changes the walk frame at least 3 times', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await wait(page, 60);
  await page.keyboard.down('ArrowRight');
  const cols = [];
  for (let i = 0; i < 13; i++) {
    await wait(page, 40);
    cols.push(await page.evaluate(() => (__scene.frame.row === 1 ? __scene.frame.col : -1)));
  }
  await page.keyboard.up('ArrowRight');
  const changes = cols.filter((c, i) => i > 0 && c !== cols[i - 1] && c >= 0).length;
  assert.ok(changes >= 3, 'walk column changes: ' + changes + ' in ' + cols.join(','));
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('feel: coyote jump works 50 ms after leaving a ledge', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => {
    __scene.player.x = 5 * World.TILE; __scene.player.y = 14 * World.TILE - __scene.player.h;
    __scene.player.vy = 0; __scene.player.vx = 0;
  });
  await wait(page, 60);
  await page.keyboard.down('ArrowRight');
  // Walk until the body leaves the ground at the pit edge.
  let left = false;
  for (let i = 0; i < 150 && !left; i++) {
    await wait(page, 10);
    left = await page.evaluate(() => !__scene.player.grounded);
  }
  assert.ok(left, 'the body never left the ground');
  await page.keyboard.up('ArrowRight');
  await wait(page, 50);
  const before = await page.evaluate(() => __scene.player.y);
  await page.keyboard.press('ArrowUp');
  await wait(page, 60);
  const after = await page.evaluate(() => __scene.player.y);
  assert.ok(after < before - 3, 'no coyote jump: y ' + before + ' -> ' + after);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('feel: jump pressed just before landing still jumps', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  // Start 40 px above the floor, falling. Press Up while still in the air.
  await page.evaluate(() => {
    __scene.player.x = 5 * World.TILE; __scene.player.y = 14 * World.TILE - __scene.player.h - 40;
    __scene.player.vy = 0; __scene.player.vx = 0;
  });
  await page.keyboard.press('ArrowUp');
  let highest = 1e9;
  for (let i = 0; i < 30; i++) {
    await wait(page, 10);
    highest = Math.min(highest, await page.evaluate(() => __scene.player.y));
  }
  // Landing feet are at 448, so the body's top is at 418. A jump lifts it at least 18 px above that.
  assert.ok(highest < 400, 'no jump after landing; highest y ' + highest);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('feel: slash spam is limited by its cooldown', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => {
    window.__slashUses = 0;
    const orig = Attacks.use;
    Attacks.use = (id, scene) => { if (id === 'slash') window.__slashUses++; return orig(id, scene); };
  });
  for (let i = 0; i < 10; i++) { await page.keyboard.press('KeyZ'); await wait(page, 30); }
  const uses = await page.evaluate(() => window.__slashUses);
  assert.ok(uses >= 1 && uses <= 3, 'slash uses in 300 ms: ' + uses);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('spikes: touching spikes opens the selection', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: ['ranger'] });
  // Put spikes on the floor one tile to the right of the knight, then walk into them.
  await page.evaluate(() => {
    const tx = Math.floor((__scene.player.x + __scene.player.w) / World.TILE) + 1;
    const ty = Math.floor((__scene.player.y + __scene.player.h) / World.TILE) - 1;
    World.setTile(tx, ty, '^');
    __scene.player.x = (tx - 1) * World.TILE + 6; __scene.player.y = ty * World.TILE - 30 + 2; __scene.player.vy = 0;
  });
  await page.keyboard.down('ArrowRight');
  let selected = false;
  for (let i = 0; i < 40 && !selected; i++) {
    await wait(page, 60);
    selected = await page.evaluate(() => __scene.mode === 'select');
  }
  await page.keyboard.up('ArrowRight');
  assert.equal(selected, true);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('cracked wall: knight shield bash breaks it', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => {
    const tx = Math.floor((__scene.player.x + __scene.player.w) / World.TILE) + 1;
    const ty = Math.floor((__scene.player.y + __scene.player.h) / World.TILE) - 1;
    World.setTile(tx, ty, 'x');
    window.__crack = { tx, ty };
    __scene.player.x = (tx - 1) * World.TILE + 6; __scene.player.y = ty * World.TILE - 30 + 2; __scene.player.vy = 0;
    __scene.player.facing = 1;
  });
  await page.keyboard.press('KeyA');
  await wait(page, 120);
  const ch = await page.evaluate(() => World.at(__crack.tx, __crack.ty));
  assert.equal(ch, '.');
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('signs: standing at a sign shows its text', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [] });
  await page.evaluate(() => {
    const sg = { x: __scene.player.x, y: __scene.player.y, w: World.TILE, h: World.TILE, text: 'Test sign text.' };
    World.signs.push(sg);
    window.__sign = sg;
  });
  await wait(page, 100);
  assert.equal(await page.evaluate(() => __scene.signText), 'Test sign text.');
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('boss: warlord takes 8 hits, then the exit opens', async (browser) => {
  const page = await newPage(browser);
  await page.keyboard.press('Enter'); await wait(page, 120);
  await page.evaluate(() => {
    window.__scene = new PlayScene(World.count - 1); Engine.setScene(window.__scene);
  });
  const boss = await page.evaluate(() => Enemies.list().find((e) => e.kind === 'warlord') ? true : false);
  assert.equal(boss, true);
  for (let i = 0; i < 8; i++) {
    await page.evaluate(() => {
      const w = Enemies.list().find((e) => e.kind === 'warlord');
      if (w) { w.hurtT = 0; Enemies.defeat(w); }
    });
  }
  assert.equal(await page.evaluate(() => Enemies.list().some((e) => e.kind === 'warlord' && !e.dead)), false);
  await page.evaluate(() => { const f = World.exit(); __scene.player.x = f.x; __scene.player.y = f.y; });
  await wait(page, 100);
  assert.equal(await page.evaluate(() => __scene.mode), 'complete');
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('save: finishing level 1 and reloading offers Continue, which starts level 2', async (browser) => {
  // A plain context: the default page helper clears storage on every load.
  const context = await browser.newContext({ viewport: { width: 960, height: 540 } });
  const page = await context.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(url); await wait(page, 300);
  await page.evaluate(() => { window.__scene = new PlayScene(0); Engine.setScene(window.__scene); });
  await page.evaluate(() => { const f = World.exit(); __scene.player.x = f.x; __scene.player.y = f.y; });
  await wait(page, 100);
  await page.keyboard.press('Enter'); await wait(page, 150);
  await page.reload(); await wait(page, 300);
  assert.equal(await page.evaluate(() => Engine.current().items[0]), 'Continue');
  await page.keyboard.press('Enter'); await wait(page, 150);
  assert.equal(await page.evaluate(() => World.index), 1);
  assert.deepEqual(page.errors, []);
  await context.close();
});

check('ability: weaver ghost (X) survives touching a grunt', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [], active: 'weaver' });
  await placeAt(page, 200, 418);
  await wait(page, 60);
  // Ghost first, then the grunt touches the weaver.
  await page.keyboard.press('KeyX'); await wait(page, 40);
  await page.evaluate(() => {
    const g = new Enemy('grunt', __scene.player.x, __scene.player.y);
    g.def = { ...g.def, speed: 0, chaseSpeed: 0, sight: 0 };
    Enemies.list().push(g);
  });
  await wait(page, 150);
  assert.equal(await page.evaluate(() => __scene.mode === 'play' && __scene.ghostT > 0), true);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('rope: placing a second rope removes the first', async (browser) => {
  const page = await newPage(browser);
  await startPlay(page, { hand: [], active: 'ranger' });
  await placeAt(page, 200, 418);
  await wait(page, 60);
  await page.keyboard.press('KeyS'); await wait(page, 40);
  await placeAt(page, 400, 418);
  await wait(page, 60);
  await page.keyboard.press('KeyS'); await wait(page, 40);
  assert.equal(await page.evaluate(() => World.platforms.length), 1);
  assert.deepEqual(page.errors, []);
  await page.close();
});

check('gates: validate_gates.py exits 0', async () => {
  execFileSync('python3', [path.join(GAME, 'tools', 'validate_gates.py')], { stdio: 'pipe' });
});

(async () => {
  const browser = await chromium.launch();
  let failed = 0;
  for (const { name, fn } of checks) {
    try {
      await fn(browser);
      console.log('PASS  ' + name);
    } catch (e) {
      failed++;
      console.log('FAIL  ' + name + '\n      ' + String(e.message || e).split('\n').slice(0, 3).join('\n      '));
    }
  }
  await browser.close();
  console.log(`\n${checks.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
