# Action Plan v2: effects follow-up

Context: the effects method from `reference/wizard_beam_pixel_art.zip` is already in the game (`CLAUDE.md` section 5: mage beam, banded slash, thrust, bash, hits, flares, shake, flash). This plan fixes the one known test failure and spreads the effects to the remaining attacks.

For a small, fast model. Read `CLAUDE.md` sections 1, 2, and 5 first. Then do the tasks below in order, one at a time.

## How to work

1. Work on `main` only. Run `git branch --show-current` first. It must print `main`. If not, run `git checkout main`.
2. One task at a time. Finish, check, commit, and push it before the next one.
3. Do only what the task says. Copy code exactly as written here.
4. To find code: use Grep with the exact text given in the task (for example `Grep pattern="function fireHostile" path="game/src"`). Read about 20 lines around the match. Then Edit.
5. If an Edit fails, Read the file again and copy `old_string` exactly from it. Do not guess.
6. After each code task, run check routine steps A to C in `CLAUDE.md` section 2. Do NOT run the full suite (step D) until V7. It is slow and expensive.
7. Commit message starts with the task id, for example `V2: weaver arrows glow`. Mark the task `[x]` in this file in the same commit.
8. After the commit, add one row to the Results log (`CLAUDE.md` section 8): date, `git rev-parse --short HEAD`, gates result, and `suite not run` (the suite runs only in V7).
9. If a task fails 3 times: run `git checkout -- game`, add one line to the Decisions log (`CLAUDE.md` section 9) saying what failed, mark the task `[~]`, move on.
10. Never ask the user questions.

## V0 [ ]: Fix the stomp check failure

The last suite run (effects pass) had 1 failure: `stomp defeats a grunt and drops a card; side contact respawns safely`. Message: `'play' == 'select'` (game/tests/suite.js, the line `assert.equal(await page.evaluate(() => __scene.mode), 'select');`).

1. In that check, find the two lines `await wait(page, 80);` and `await wait(page, 250);` that come right after `__scene.player.x = __r.x - 10; __scene.player.y = __r.y;`. Replace both with one line:
```js
  await page.waitForFunction(() => __scene.mode === 'select', null, { timeout: 3000 });
```
   This waits for the game instead of the wall clock (same fix as T1).
2. Run `node --check game/tests/suite.js`. Do not run the suite; V7 does that.

## V1 [ ]: Test that the beam hits two enemies

File: `game/tests/suite.js`.

1. Grep for `name: 'mage spell bolt (A) defeats a grunt in line'`.
2. That entry ends with these two lines:
```js
    check: (p) => p.evaluate(() => __g.dead), want: true,
  },
```
3. Right after that `},` line, add this new entry:
```js
  {
    name: 'mage beam (A) hits two grunts in a row', who: 'mage', key: 'KeyA', wait: 400,
    setup: (p) => p.evaluate(() => {
      const a = new Enemy('grunt', 900, 256);
      const b = new Enemy('grunt', 950, 256);
      for (const g of [a, b]) { g.def = { ...g.def, speed: 0, chaseSpeed: 0, sight: 0 }; Enemies.list().push(g); }
      window.__g = a; window.__g2 = b;
      __scene.player.x = 860; __scene.player.y = 256; __scene.player.facing = 1;
    }),
    check: (p) => p.evaluate(() => __g.dead && __g2.dead), want: true,
  },
```
4. Run `node --check game/tests/suite.js`. Do not run the suite; V7 does that. If this check fails in V7, change `950` to `930` and run the suite one more time.

## V2 [ ]: Weaver arrows glow bone green

File: `game/src/abilities.js`.

1. Grep for `Effects.flare(p.facing > 0`. Replace that whole line with:
```js
        Effects.flare(p.facing > 0 ? p.x + p.w + 2 : p.x - 2, p.y + 13, scene.active === "weaver" ? "bone" : "steel");
```
2. Grep for `const dir = q.vx > 0 ? 1 : -1;`. Right after that line, add:
```js
      if (q.owner === "weaver") Glow.disc(ctx, q.x - cx + (dir > 0 ? 0 : 14), q.y - cy + 1, 4, "bone", 0.6);
```
3. Check routine steps A to C. V6 checks how it looks.

## V3 [ ]: Archer arrows flash on release

File: `game/src/abilities.js`.

1. Grep for `function fireHostile(x, y, dir) {`.
2. Right after that line, add:
```js
    Effects.flare(x, y + 2, "ember");
```
3. Check routine steps A to C.

## V4 [ ]: Warlord hits flash the screen

File: `game/src/enemies.js`.

1. Grep for `if (enemy.kind === "warlord") Effects.shake(0.15, 3);`.
2. Replace that line with:
```js
      if (enemy.kind === "warlord") { Effects.shake(0.15, 3); Effects.flash(0.04); }
```
3. Check routine steps A to C.

## V5 [ ]: Blink throws arcane sparks

File: `game/src/abilities.js`.

1. Grep for `function blink(p) {`. Read 15 lines from there.
2. Inside the `if (clear) {` block there is this line:
```js
        Effects.ring(p.x + p.w / 2, p.y + p.h / 2, "#b9a2f0");
```
3. Right after that line (the one inside `if (clear)`, not the first one in the function), add:
```js
        Effects.spray(p.x + p.w / 2, p.y + p.h / 2, -p.facing, "arcane", 6);
```
4. Check routine steps A to C.

## V6 [ ]: Visual check of all effects

No code change.

1. Run the screenshot tool (`CLAUDE.md` section 2).
2. Open these PNGs with Read, one at a time: `c_knight_ab1`, `c_knight_ab3`, `c_mage_ab1`, `c_ranger_ab1`, `c_weaver_ab1`, `e_archer`, `e_warlord`.
3. For each, write one line in `CLAUDE.md` section 10 under a new line `Effects visual check (V6):`. Say OK, or say what looks wrong.
4. If something looks wrong, do NOT fix it. Only write it down.
5. Commit `CLAUDE.md` and this file. Message: `V6: effects visual check`.

## V7 [ ]: Close out

1. Run `git status`. It must show a clean tree after your last commit.
2. Run check routine step B, then step D (the full suite) ONE time. This is the only suite run in the plan.
3. If checks fail, look only at the ones from V0, V1, or code changed in V2 to V5. Fix with the smallest change, then run the suite one more time. If it still fails, log the failing names in the Decisions log and do not run it again.
4. Add a final row to the Results log with the real numbers.
5. Mark V7 `[x]`. Add the line `ACTION PLAN V2 COMPLETE` at the end of this file.
6. Commit and push. Message: `V7: close out`.

## Not in this plan (do not do these)

- Weapon art gaps (sword slash frames, bow idle and walk). The LPC source has no frames for them.
- Level layouts, new levels, new characters. If you edit `levels.js` by mistake, run `git checkout -- game/src/levels.js`.
- A setting to turn off flash and shake. That needs the user to decide how it should look.
- Anything in the `method_*` folders.
- Real devices, other browsers, sound quality checks.
