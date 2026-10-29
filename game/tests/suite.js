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
  assert.equal(await name(), 'PlayScene');
  await page.keyboard.press('Enter'); await wait(page, 80);
  assert.equal(await page.evaluate(() => Engine.current().mode), 'pause');
  await page.keyboard.press('KeyX'); await wait(page, 80);
  assert.equal(await page.evaluate(() => Engine.current().mode), 'play');
  await page.keyboard.press('Enter'); await wait(page, 80);
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
      await page.keyboard.press(a.key); await wait(page, a.wait);
      const got = await a.check(page);
      if (a.want === 'upward') assert.ok(got < -250 && got > -320, 'vy ' + got);
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
  assert.equal(await page.evaluate(() => Engine.current().mode), 'play');
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
