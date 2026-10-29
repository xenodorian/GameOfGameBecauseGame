# Action Plan v2: effects follow-up

Context: the effects method from `reference/wizard_beam_pixel_art.zip` is already in the game (`CLAUDE.md` section 5: mage beam, banded slash, thrust, bash, hits, flares, shake, flash). This plan fixes the one known test failure and spreads the effects to the remaining attacks.

For a small, fast model. Read `CLAUDE.md` sections 1 and 2 first. Then do the tasks below in order, one at a time.

## How to work

1. Work on `main` only. Run `git branch --show-current` first. It must print `main`. If not, run `git checkout main`.
2. One task at a time. Finish, check, commit, and push it before the next one.
3. Do only what the task says. Copy code exactly as written here.
4. Every code change below is an Edit tool call: an exact `old_string` and an exact `new_string`. Read the file first (the Edit tool needs it), then make the Edit with the strings given. Keep the leading spaces exactly as shown.
5. If you use Grep, search plain words only (for example `fireHostile`). Characters like `(` `)` `?` `.` `{` are special in Grep and will break or change the search.
6. If an Edit fails, Read about 20 lines around the place with the Read tool (offset and limit), copy the text exactly, and retry once. Do not guess.
7. After each code task, run check routine steps A to C in `CLAUDE.md` section 2. Do NOT run the full suite (step D) until V7. It is slow and expensive.
8. Commit message starts with the task id, for example `V2: weaver arrows glow`. Mark the task `[x]` in this file in the same commit.
9. If a task fails 3 times: run `git checkout -- game`, add one line to the Decisions log (`CLAUDE.md` section 9) saying what failed, mark the task `[~]`, move on.
10. Never ask the user questions.

## V0 [x]: Fix the stomp check failure

The last suite run had 1 failure: `stomp defeats a grunt and drops a card; side contact respawns safely`, message `'play' == 'select'`. The check waits a fixed wall-clock time, but the game clock runs slower in the test browser. Make it wait on the game instead (same idea as the T1 fix).

File: `game/tests/suite.js`. Edit:

old_string:
```js
  await wait(page, 80);
  // The side contact is a hit, so the hurt pose shows before the choice opens.
  await wait(page, 250);
```
new_string:
```js
  // The side contact is a hit, so the hurt pose shows before the choice opens. Wait on the game, not the wall clock.
  await page.waitForFunction(() => __scene.mode === 'select', null, { timeout: 5000 });
```
Then run `node --check game/tests/suite.js`. It must print nothing.

## V1 [x]: Test that the beam hits two enemies

File: `game/tests/suite.js`. Edit:

old_string:
```js
  {
    name: 'mage float (S) hovers
```
new_string:
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
  {
    name: 'mage float (S) hovers
```
Then run `node --check game/tests/suite.js`. It must print nothing.

## V2 [ ]: Weaver arrows glow bone green

File: `game/src/abilities.js`. Two Edits.

Edit 1, old_string:
```js
        Effects.flare(p.facing > 0 ? p.x + p.w + 2 : p.x - 2, p.y + 13, "steel");
```
new_string:
```js
        Effects.flare(p.facing > 0 ? p.x + p.w + 2 : p.x - 2, p.y + 13, scene.active === "weaver" ? "bone" : "steel");
```

Edit 2, old_string:
```js
      const dir = q.vx > 0 ? 1 : -1;
```
new_string:
```js
      const dir = q.vx > 0 ? 1 : -1;
      if (q.owner === "weaver") Glow.disc(ctx, q.x - cx + (dir > 0 ? 0 : 14), q.y - cy + 1, 4, "bone", 0.6);
```
Then check routine steps A to C (`node --check game/src/abilities.js`).

## V3 [ ]: Archer arrows flash on release

File: `game/src/abilities.js`. Edit:

old_string:
```js
  function fireHostile(x, y, dir) {
```
new_string:
```js
  function fireHostile(x, y, dir) {
    Effects.flare(x, y + 2, "ember");
```
Then check routine steps A to C.

## V4 [ ]: Warlord hits flash the screen

File: `game/src/enemies.js`. Edit:

old_string:
```js
      if (enemy.kind === "warlord") Effects.shake(0.15, 3);
```
new_string:
```js
      if (enemy.kind === "warlord") { Effects.shake(0.15, 3); Effects.flash(0.04); }
```
Then check routine steps A to C (`node --check game/src/enemies.js`).

## V5 [ ]: Blink throws arcane sparks

File: `game/src/abilities.js`. Edit (the `return;` line makes this match unique):

old_string:
```js
        Effects.ring(p.x + p.w / 2, p.y + p.h / 2, "#b9a2f0");
        return;
```
new_string:
```js
        Effects.ring(p.x + p.w / 2, p.y + p.h / 2, "#b9a2f0");
        Effects.spray(p.x + p.w / 2, p.y + p.h / 2, -p.facing, "arcane", 6);
        return;
```
Then check routine steps A to C.

## V6 [ ]: Visual check

No code change.

1. Run the screenshot tool once (`CLAUDE.md` section 2).
2. Open only these 4 PNGs with Read: `game/tests/shots/c_mage_ab1.png`, `c_knight_ab3.png`, `c_weaver_ab1.png`, `c_ranger_ab1.png`.
3. Look for: a violet beam from the mage; a blue white slash arc on the knight; an arrow on the weaver and ranger shots. Short flares (archer, warlord flash) last 0.1 s or less and usually do not show in shots. That is fine.
4. Add one line per PNG to `CLAUDE.md` section 10, under a new line `Effects visual check (V6):`. Say OK, or say what looks wrong. Do NOT fix anything here.
5. Commit `CLAUDE.md` and this file. Message: `V6: effects visual check`.

## V7 [ ]: Close out (the only suite run)

1. Run `git status`. It must show a clean tree.
2. Run check routine step B, then step D (the full suite) ONE time, in the background as `CLAUDE.md` section 2 says.
3. If the only failure is `mage beam (A) hits two grunts in a row`, change `950` to `930` in that check and run the suite one more time. For any other failure, do not rerun. Write the failing check names in the Decisions log.
4. Add one row to the Results log (`CLAUDE.md` section 8) with `git rev-parse --short HEAD`, the gates result, and the real pass and fail counts.
5. Mark V7 `[x]`. Add the line `ACTION PLAN V2 COMPLETE` at the end of this file.
6. Commit and push. Message: `V7: close out`.

## Not in this plan (do not do these)

- Weapon art gaps (sword slash frames, bow idle and walk). The LPC source has no frames for them.
- Level layouts, new levels, new characters. If you edit `levels.js` by mistake, run `git checkout -- game/src/levels.js`.
- A setting to turn off flash and shake. That needs the user to decide how it should look.
- Anything in the `method_*` folders or `reference/`.
- Real devices, other browsers, sound quality checks.
