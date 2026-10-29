# Expansion Plan: from one level to a complete game

Written by Opus for executor agents. This file is the only task list. Do the tasks in order, top to bottom.

## Rules (read every time)

1. The user does not want to be asked anything. Never ask the user a question. When something is unclear, pick the simplest choice that keeps the game fun and working, then write one line about it in the "Decisions log" at the bottom of this file.
2. Work on `main`. Push to `main`. Never create a branch.
3. One task per commit. The commit message starts with the task id, for example `A1: move level data into levels.js`.
4. After every task, run all three checks. Do not start the next task until all three pass.
   - Rebuild: `python3 game/tools/build_single_html.py`
   - Gates: `python3 game/tools/validate_gates.py` (must exit 0)
   - Suite: `NODE_PATH=$(npm root -g) node game/tests/suite.js` (must end with `0 failed`). It takes 6 to 15 minutes. If your tool stops commands after 10 minutes, run it in the background and wait for it to finish.
5. Commit the rebuilt `game/changeling.html` in the same commit as the source change.
6. Mark each task `[x]` in this file when it is done and its checks pass, in the same commit. Use `[~]` and a one-line note if you had to stop partway.
7. Never delete or weaken an existing test to make it pass. If a test breaks because the behavior was meant to change (the task says so), update that test to check the new behavior.
8. Do not add any file from the internet. All new art is drawn in code (canvas shapes) or made by tinting existing images. All sound is made in code.
9. Text shown to the player must be plain and short. No em dashes. No emoji.
10. If a task fails three times in a row, mark it `[~]`, write what failed in the Decisions log, and move to the next task. Come back to it at the end.

## Facts about the code (verified)

- Source is in `game/src/`. Script load order is the `SCRIPTS` list in `game/tools/build_single_html.py`. Images are the `IMAGES` dict in the same file.
- `game/src/world.js`: `World` is one IIFE. Today it reads a single global `LEVEL_ROWS` once. Tiles are 32 px. Legend is at the top of the file. `isSolid` treats `#` and `=` as solid. `_` is one-way. `World.overlapping(x, y, w, h)` returns cells with `ch`, `tx`, `ty`.
- `game/src/enemies.js`: `ENEMY_DEFS` holds each enemy type, including the `card` it drops. `Enemies.defeat(enemy)` kills an enemy and drops its card.
- `game/src/scenes.js`: `PlayScene` runs play. Modes: `play`, `select`, `discardCard`, `pause`, `complete`. The stomp code in `checkEnemyContact` sets `enemy.dead = true` directly instead of calling `Enemies.defeat`. The exit check is `if (exit && this.mode === "play" && this.overlaps(p, exit)) this.mode = "complete";`. Falling below `World.height` opens the selection with reason `fell`.
- `game/src/abilities.js`: `CHARACTERS` maps each character to a sprite key and four ability ids. `Attacks.use(id, scene)` has one `case` per ability id.
- `game/src/cards.js`: `CARD_DEFS` (name and color per character) and `Hand` (3 slots plus deck). `Hand` is never reset today.
- Player physics: walk 130 px/s, jump vy -340, gravity 900. A plain jump rises 2 tiles and crosses 3 tiles.
- `game/tools/validate_gates.py` checks that every character can reach the exit, and that each `c` and `p` pickup is reachable by some character but not by basic moves. `MAIN_ROUTE_PICKUPS` exempts the col 22 card in level 1.
- The view is 480 by 270 px (15 by 8.4 tiles).

## Target game (decided, do not change)

- 8 levels. Levels 1 to 4 are outdoors (theme `field`). Levels 5 to 7 are inside a castle (theme `dungeon`). Level 8 is a boss arena (theme `dungeon`).
- 5 playable characters: Knight, Ranger, Mage, Rat, Bone Weaver.
- Enemy card drops: grunt drops Ranger, mud revenant drops Mage, rat king drops Rat, archer drops Bone Weaver. Random cards (`c`, `p`, and `k`) can be any of the 5.
- New tiles: `^` spikes, `x` cracked wall, `k` main-route card, `i` sign.
- A short intro, level name banners, a secrets counter, a boss, an ending with stats, sound effects, and save and continue.
- Target play time for a first-time player: 20 to 40 minutes.

---

## Phase A: Multi-level support

### [x] A1: Move level data into `game/src/levels.js`
1. Create `game/src/levels.js` with exactly this shape. Copy the 16 rows of `LEVEL_ROWS` from `world.js` into `rows`, unchanged except one edit: in row 12, change the `c` at column 22 to `k`.
   ```js
   // All levels, in play order. Each row string must be the same length.
   // signs: texts for the "i" tiles, in reading order (top row first, left to right).
   const LEVELS = [
     {
       name: "Greenwood Road",
       theme: "field",
       rows: [
         "....",
       ],
       signs: [],
     },
   ];
   ```
   Keep the key order `name`, `theme`, `rows`, `signs`. The validator depends on that order. Sign text must not contain `"` or `]`.
2. Delete `LEVEL_ROWS` from `world.js`.
3. Add `"levels.js"` to `SCRIPTS` in `build_single_html.py`, right before `"world.js"`. (`game/src/index.html` has one inline script slot that the build fills, so it needs no change.)
4. Search the whole repo for `LEVEL_ROWS` (`grep -rn LEVEL_ROWS game`) and update every use. The validator is fixed in A3; for this task only, change its `load_rows()` to read `game/src/levels.js` and take the first `rows: [` block.
5. Add `k` to the legend comment in `world.js`: `k  card pickup on the main route (not a secret)`. In the marker parsing, treat `k` like `c` (push a pickup with `power: false`).

### [x] A2: `World.load(index)`
Rewrite the top of the `World` IIFE so a level can be loaded at any time. Use this structure:
```js
const World = (() => {
  let index = 0;
  let tiles = [];
  let rows = 0;
  let cols = 0;
  let width = 0;
  let height = 0;
  let spawn = { x: 0, y: 0 };
  let exit = null;
  // Temporary one-way platforms made in play (arrow anchor rope). Each has a life in seconds.
  const platforms = [];
  const enemySpawns = [];
  const pickupSpawns = [];
  const signs = [];
  const MARKERS = { g: "grunt", m: "mud_revenant", j: "rat_king", a: "archer" };

  function load(i) {
    index = i;
    const level = LEVELS[i];
    tiles = level.rows.map((row) => row.split(""));
    rows = tiles.length;
    cols = tiles[0].length;
    width = cols * TILE;
    height = rows * TILE;
    exit = null;
    platforms.length = 0;
    enemySpawns.length = 0;
    pickupSpawns.length = 0;
    signs.length = 0;
    let signN = 0;
    tiles.forEach((row, ty) =>
      row.forEach((ch, tx) => {
        // (move the existing marker parsing here unchanged, plus:)
        if (ch === "i") signs.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE, text: (level.signs || [])[signN++] || "" });
      })
    );
  }
```
Then in the object the IIFE returns, replace the plain data fields with getters, so other files always see the current level:
```js
    get width() { return width; },
    get height() { return height; },
    get cols() { return cols; },
    get rows() { return rows; },
    get spawn() { return spawn; },
    get enemySpawns() { return enemySpawns; },
    get pickupSpawns() { return pickupSpawns; },
    get index() { return index; },
    get level() { return LEVELS[index]; },
    count: LEVELS.length,
    signs,
    load,
```
Keep every other field (`TILE`, `exit`, `at`, functions, `platforms`). Build the object as `const api = { ... }`, then call `load(0)`, then `return api;`. Add `setTile(tx, ty, ch)` that sets `tiles[ty][tx] = ch` when in bounds, and export it.

Check: the suite still passes with no other change.

### [~] A3: Validator handles many levels, plus debug output (gates and build pass; suite run pending)
Edit `game/tools/validate_gates.py`:
1. Replace `load_rows()` with:
   ```python
   LEVELS_JS = GAME / "src" / "levels.js"

   def load_levels():
       src = LEVELS_JS.read_text(encoding="utf-8")
       levels = []
       for m in re.finditer(r'name:\s*"([^"]+)".*?rows:\s*\[(.*?)\]', src, re.S):
           rows = re.findall(r'"([^"]*)"', m.group(2))
           widths = {len(r) for r in rows}
           if len(widths) != 1:
               raise SystemExit(f"level {m.group(1)}: rows have unequal widths: {sorted(widths)}")
           levels.append((m.group(1), rows))
       return levels
   ```
2. Move the body of `main()` into `check_level(name, rows)`, which returns a list of failure strings. Prefix each printed section with the level number and name. `main()` loops over all levels and exits 1 if any level has failures.
3. Delete `MAIN_ROUTE_PICKUPS`. Pickups marked `k` are main-route pickups: list them as `main route card ... reachable by: ...` and never require them to be gated. Only `c` and `p` must be gated.
4. Each level must have exactly one `S` and exactly one `F`. Fail otherwise.
5. Treat `k`, `i`, `T`, `S`, `F`, `c`, `p`, and enemy letters as air (they already are, since only `#` and `=` are solid; keep it that way).
6. Add command line options (use `argparse`):
   - `--level N` (1-based): check only level N.
   - `--show N`: print level N with a column ruler (a line of `0123456789` repeated) above it and the row number at the start of each line, then exit 0.
   - `--map N NAME`: print level N with `*` on every standing tile that character NAME can reach, then exit 0. NAME is a key of `ABILITY_SETS`.
7. Update the docstring to describe the new options.

Check: `python3 game/tools/validate_gates.py` exits 0. `--show 1` and `--map 1 basic` print sensible maps.

### [ ] A4: Level progression and ending
1. `PlayScene` constructor takes `(levelIndex = 0, active = "knight")`. First lines: `World.load(levelIndex); Attacks.reset();` Keep the existing `Enemies.spawnFromLevel()` call. Set `this.active = active`.
2. On `complete`, pressing Enter or Start:
   - if `World.index + 1 < World.count`: `Engine.setScene(new PlayScene(World.index + 1, this.active))`
   - else: `Engine.setScene(new EndingScene())`
   The complete screen says `Level complete` and, under it, `Enter: next level` (or `Enter: continue` on the last level).
3. Add `Hand.reset()` to `cards.js`: empties the hand and the deck. Call it when a new game starts from the title (Title "Play").
4. Add `EndingScene` in `scenes.js`, built like `CreditsScene`. For now it shows `The end` and `Enter: credits`. Enter opens `CreditsScene`. (Text is filled in task F2.)
5. Update the suite: the check `exit: reaching the flag shows level complete; Enter replays` must now check that Enter loads level 2 (`World.index === 1`). Until level 2 exists (Phase E), `World.count` is 1, so the check must accept the ending scene. Write it so it works either way: if `World.count > 1` expect `World.index === 1`, else expect the current scene to be an `EndingScene`.
6. Add a suite check `levels: every level loads, has a spawn and an exit, and completing it moves on`. For each `i` in `0 .. World.count - 1`: create `new PlayScene(i)`, set it as the scene, move the player onto `World.exit()`, wait 100 ms, assert `mode === "complete"`, press Enter, wait 100 ms, assert the next level index or the ending scene.
7. In the suite's `newPage` helper, clear storage before the page loads: `await page.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });`

---

## Phase B: New tiles and themes

### [ ] B1: Spikes `^`
1. Legend: `^  spikes (not solid; touching them is deadly)`.
2. Draw: in `World.draw`, for `^` draw three grey triangles (`#9aa0a8` fill, `#5b6068` outline) whose bases sit on the bottom edge of the tile, each 10 px wide and 12 px tall.
3. Damage: in `PlayScene.updatePlay`, right after `World.moveBody(p, dt)`, if any cell from `World.overlapping(p.x + 2, p.y + p.h - 8, p.w - 4, 8)` has `ch === "^"`, call `this.beginSelection("slain")` and return.
4. Safe respawn: read `closestSafeSpace` in `world.js`. A spot is not safe if any tile from 3 columns left to 3 columns right of the spot, on the spot's row, is `^`. Add that rule.
5. Validator: in `explore`, `push()` must reject a state `(x, y)` when `rows[y][x] == "^"`. Pass `rows` in or keep a reference on `Grid`.
6. Suite check `spikes: touching spikes opens the selection`: set a tile next to the player to `^` with `World.setTile`, walk into it, assert `mode === "select"`.

### [ ] B2: Cracked walls `x`
1. Legend: `x  cracked wall (solid; broken by the knight's shield bash or charge)`.
2. `isSolid` returns true for `x`. In `abilities.js`, the two checks `ch === "#" || ch === "="` (projectile and blink) must also treat `x` as solid.
3. Draw: the wall image, then three dark lines (`#2a1d14`, 2 px) in a zigzag across the tile.
4. Add `World.breakCracked(x, y, w, h)`: every overlapping cell with `ch === "x"` becomes `.`. Return true if any broke.
5. Call it: in `Attacks.update`, for each live hitbox of kind `bash`, call `World.breakCracked(hb.x, hb.y, hb.w, hb.h)`. In `PlayScene.updatePlay`, while `this.dashT > 0`, call `World.breakCracked(p.facing > 0 ? p.x + p.w : p.x - 6, p.y, 6, p.h)` before `World.moveBody`.
6. Validator: add `"bash"` to the knight's set. In `Grid`, when the ability set has `bash`, `x` counts as air; otherwise it counts as solid. Pass the ability set into `Grid`.
7. Suite check `cracked wall: knight shield bash breaks it`.

### [ ] B3: Signs `i`
1. Legend: `i  sign post (decor; shows its text while the player stands at it)`.
2. Draw each sign from `World.signs` as a post: a 4 by 16 px brown (`#7a5230`) stick from the tile's bottom and a 20 by 12 px board (`#a87a4a`) on top.
3. In `PlayScene.draw`, if the player overlaps a sign, draw a box at the top of the screen (x 40 to 440, y 8, height 40, fill `rgba(0,0,0,0.75)`, white 10 px text, centered, wrap to two lines if needed) with the sign's text.
4. Validator: `i` is air (already true).
5. Suite check `signs: standing at a sign shows its text` (check a scene field such as `this.signText` that the draw code sets, rather than pixels).

### [ ] B4: Level themes
1. The sky fill and the two ridges are drawn in `PlayScene.draw` in `scenes.js` (the two `drawHills(...)` calls and the `fillRect` just above them).
2. Add a `THEMES` table in `world.js`:
   ```js
   const THEMES = {
     field: { sky: "#8fc3e8", far: "#7a9cb8", near: "#5f8a6a", ground: "grass" },
     dungeon: { sky: "#17141f", far: "#2a2533", near: "#3a3242", ground: "brick" },
   };
   ```
   Use the existing colors for `field` if they differ (keep the current look exactly). Export it.
3. The sky and ridge drawing read colors from `THEMES[World.level.theme]`.
4. In `World.draw`, when the theme is `dungeon`, draw `=` as the dirt image only (no grass on top) and darken it with a `rgba(0,0,0,0.25)` rect. Trees `T` should not be used in dungeon levels.

---

## Phase C: Two new characters and the ability bar

### [ ] C1: Card defs and drops
1. `CARD_DEFS` gets `rat: { name: "Rat", color: "#a0826d" }` and `weaver: { name: "Bone Weaver", color: "#d8d2c0" }`.
2. `ENEMY_DEFS`: `rat_king.card = "rat"`, `archer.card = "weaver"`. Grunt and revenant stay.
3. Every place that picks a random card must pick from all keys of `CARD_DEFS`. Search for `Math.random() * 3` and for `"random"` in `enemies.js` and `scenes.js` and fix each one to use `Object.keys(CARD_DEFS).length`.

### [ ] C2: Rat
1. `CHARACTERS.rat = { name: "Rat", sprite: "rat_king", abilities: ["leap", "scurry", "slash", "thrust"] }`. Add `rat_king` to the image lookup used to draw the player if it is not there.
2. `leap`: only when grounded. `p.vy = -540; p.jumping = false;` (5 tiles high).
3. `scurry`: `scene.scurryT = 2.0`. In `updatePlay`, the walk speed is `220` while `scurryT > 0`, else `130`. Count `scurryT` down each step. Reset it to 0 in the respawn code next to `dashT`.
4. Validator: `ABILITY_SETS["rat"] = {"leap"}`. In `explore`, `max_up = 5 if leap else (4 if hop else 2)`.
5. Suite: add rows to the ability table in `suite.js` (copy the shape of the existing rows): `rat leap (A) jumps higher than a plain jump`, `rat scurry (S) walks faster`.

### [ ] C3: Bone Weaver
1. `CHARACTERS.weaver = { name: "Bone Weaver", sprite: "bone_weaver", abilities: ["shoot", "bone_bridge", "slash", "ghost"] }`.
2. `bone_bridge`: copy `arrow_anchor` but 5 tiles long and `life: 8`. Draw it with a bone color (`#e8e2d0`) instead of rope brown: add `color` to the platform object and use it in `drawPlatforms` (default stays `#7a5230`).
3. `ghost`: `scene.ghostT = 1.5`. While `ghostT > 0`, side contact with enemies does not kill and hostile arrows pass through. Find the hostile hit check (`hitByHostile` in `scenes.js`) and the side-contact branch in `checkEnemyContact`, and skip both while `ghostT > 0`. Draw the player at `globalAlpha = 0.5` while `ghostT > 0`. Spikes and falling still kill. Reset `ghostT` on respawn.
4. Validator: `ABILITY_SETS["weaver"] = {"bridge"}`. Rope length is 5 for `bridge`, 3 for `rope`. In both `explore` (the rope source check) and `reachable` (the cells added), replace the fixed `(1, 2, 3)` with `range(1, L + 1)` where `L` is that length.
5. Suite: ability rows `weaver bone bridge (S) makes a 5 tile platform`, `weaver ghost (X) survives touching a grunt`.

### [ ] C4: Mage art
The mage uses the knight image. Make a purple version at load time:
1. In `main.js`, after images load, build `IMG.mage` as a canvas the size of `IMG.knight_right`: draw the knight, then set `globalCompositeOperation = "source-atop"`, fill the whole canvas with `rgba(120, 70, 200, 0.45)`, then reset the composite operation.
2. Set `CHARACTERS.mage.sprite = "mage"` and add `mage: IMG.mage` to the `PlayScene` images map.

### [ ] C5: Ability bar
At the bottom center of the play screen, show the active character's four abilities, one per slot: `A Shield bash   S Charge   Z Slash   X Thrust`. Use a readable name for each ability id (add an `ABILITY_NAMES` map in `abilities.js`). 8 px text on a dark translucent strip. Keep it clear of the touch buttons and the hand HUD; if it overlaps, move it up.

---

## Phase D: The boss

### [ ] D1: Enemy hit points
1. Enemies may have `hp` in `ENEMY_DEFS` (default 1). The `Enemy` constructor sets `this.hp = def.hp || 1` and `this.hurtT = 0`.
2. `Enemies.defeat(enemy)`: if `enemy.hurtT > 0` return. If `enemy.hp > 1`: `enemy.hp -= 1; enemy.hurtT = 0.6;` return. Otherwise the current code (dead, drop card).
3. `Enemy.update` counts `hurtT` down. While `hurtT > 0` the enemy flashes (skip drawing it on every other 0.1 s).
4. Change the stomp code in `checkEnemyContact` to call `Enemies.defeat(enemy)` instead of setting `dead` and calling `dropCard` itself. Keep the bounce `p.vy = -260`. If the enemy is still alive after the stomp, the stomp still counts as a stomp (no death for the player).
5. All current enemies have 1 hp, so the suite must still pass unchanged.

### [ ] D2: Warlord
1. `ENEMY_DEFS.warlord`: sprite `grunt`, `w: 44`, `h: 58`, `speed: 50`, `chaseSpeed: 80`, `sight: 400`, `hp: 8`, `card: "knight"`, `jumpVy: -420`, `jumpEvery: 3.0`, `fireEvery: 2.2`.
2. Its update reuses the rat king's jump logic and the archer's fire logic (read both in `enemies.js` and call the same code; if they are written inline, move them into small functions first). It walks toward the player all the time.
3. Draw the warlord's sprite at its full `w` and `h` (twice the grunt size), tinted dark red the same way as C4 (build `IMG.warlord` in `main.js`).
4. Marker `W` in `MARKERS`. Legend line `W  warlord boss spawn`.
5. Above the boss, while it is alive, draw a health bar: 8 segments, red, at the top of the screen with the label `Warlord`.
6. A level with `boss: true` in its `LEVELS` entry keeps the exit closed while any warlord is alive: the exit check in `PlayScene` is skipped, and the flag is drawn at 30% alpha. When the warlord dies, the flag is drawn normally.
7. Validator: `W` is air. No change needed besides that.
8. Suite check `boss: warlord takes 8 hits, then the exit opens` (call `Enemies.defeat` 8 times with `hurtT` set to 0 between calls, then check `dead` and that touching the exit completes the level).

---

## Phase E: Levels

General rules for every level:
- Build it in `levels.js`. Every row must be exactly the level's width. Ground row(s) at the bottom.
- Use `python3 game/tools/validate_gates.py --show N` to see columns, and `--map N basic` to see where basic moves reach.
- The main route (spawn to exit) must pass for `basic`. That means: gaps on the main route at most 3 tiles wide, steps up at most 2 tiles, no spikes that cannot be jumped.
- Place `S` in column 2 or 3. Place `F` within the last 5 columns.
- No enemy within 8 columns of `S`. No archer within 5 columns of `F`.
- About one enemy per 10 to 14 columns. Mix types as the level spec says.
- The level must not be a flat corridor. Use at least: 4 changes of ground height, 3 pits (falling in is a death, which is fine), 2 floating platforms (`=` or `_`), and stretches where the camera has to move up.
- Each secret is a `c` or `p` that the validator reports `OK` (gated). Each level spec lists which character must reach each secret. Run `--map N <character>` to confirm the right character reaches it, and confirm basic cannot.
- A secret must be visible or hinted from the main route (the player should see it and wonder how to get there).
- Add 2 to 4 `k` cards on the main route of each level so the player keeps getting new faces.
- Put each new mechanic's first appearance somewhere safe, with a sign right before it.

### [ ] E1: Level 1 signs
Keep "Greenwood Road" geometry. Put four `i` tiles on air tiles of row 13 (the row above the ground; pick `.` cells only) near columns 4, 11, 18, and 30. Signs, in order:
1. `Arrows move. Up jumps. Hold Up to jump higher.`
2. `A, S, Z and X use your powers. Try them all.`
3. `Beat a foe to win its card. Touch a card to take its face.`
4. `If you fall, pick a new face from your hand. C drops a card. Q drops your face.`

### [ ] E2: Level 2 "Bramble Hollow"
- Theme `field`. Width 120, height 18.
- Introduces spikes (sign: `Spikes hurt. Jump over them.`) and rat kings.
- Enemies: 4 grunts, 3 rat kings, 1 mud revenant.
- Secrets: one `c` on a ledge 5 tiles above the ground (Rat leap only), one `p` across a 5-tile gap high up (Bone Weaver or Ranger rope).

### [ ] E3: Level 3 "Old Watchtower"
- Theme `field`. Width 100, height 26. Most of the level climbs: the exit is near the top.
- Uses `_` one-way platforms for the climb (sign: `You can jump up through thin ledges.`).
- Enemies: 3 archers (sign before the first: `Archers shoot when you line up with them.`), 3 grunts, 2 rat kings.
- Secrets: one `c` reachable with Mage float, one `c` reachable with Bone Weaver bridge, one `p` reachable with Ranger hop.
- Add a suite check `platform tile: knight jumps up through a "_" tile and stands on it` using `World.setTile` in level 1 (this replaces the old tile one-way task).

### [ ] E4: Level 4 "Rotting Marsh"
- Theme `field`. Width 140, height 18.
- Many 3-wide pits and spike beds. Mud revenants (5), grunts (3), rat kings (2), archer (1).
- Introduces cracked walls (sign: `Cracked walls break. Who hits hard enough?`). The main route never needs to break one.
- Secrets: one `c` behind a cracked wall (Knight only), one `p` past a long gap (Knight charge or Mage blink), one `c` 5 tiles up (Rat).

### [ ] E5: Level 5 "Castle Gate"
- Theme `dungeon`. Width 130, height 20. Walls `#` frame the rooms. Sign at the start: `The castle. The Warlord waits at the top.`
- Enemies: 4 grunts, 3 archers, 2 mud revenants, 2 rat kings.
- Secrets: 3, gated by three different characters.

### [ ] E6: Level 6 "Undercroft"
- Theme `dungeon`. Width 150, height 22. Spike-heavy, low ceilings, some `_` climbs.
- Enemies: 5 archers, 3 rat kings, 3 grunts, 2 mud revenants.
- Secrets: 3, gated by three different characters, one of them the Bone Weaver.

### [ ] E7: Level 7 "Hall of Faces"
- Theme `dungeon`. Width 160, height 22. Uses every mechanic once more. Hardest normal level.
- Enemies: every type, at least 14 in total.
- Secrets: 3, gated by Rat, Bone Weaver, and Knight.

### [ ] E8: Level 8 "Warlord's Throne"
- Theme `dungeon`, `boss: true`. Width 40, height 14. A flat arena with two `=` platforms 3 tiles up, a `W` in the middle-right, `F` at the right end. One `k` card near the start. No pits, no spikes.

### [ ] E9: Balance pass (no art or code changes)
1. For each level, run `--map N basic` and confirm the exit is marked.
2. In the suite, add a check `bot: keyboard bot reaches the exit of level 2 as the knight` using the existing playthrough bot code with `new PlayScene(1)`. If the bot fails only because of its own simple logic (it walks right and jumps), not because the level is broken, write that in the Decisions log and do not add the check.
3. Read each level as a grid. If any stretch of 20 columns has no enemy, no pickup, and no height change, add something there.

---

## Phase F: Story, feedback, and polish

### [ ] F1: Level banner and secrets counter
1. When a `PlayScene` starts, show `Level N: Name` centered near the top for 2.5 seconds, fading out in the last 0.5 seconds.
2. Add a global `Run` object in `scenes.js`: `{ deaths: 0, secrets: 0, secretsTotal: 0, startTime: 0 }`, reset when a new game starts.
3. Pickups made from `c` and `p` markers are secrets (`secret: true` on the `CardPickup`). `k` pickups and enemy drops are not. When the player collects a secret, `Run.secrets += 1` and the level's counter goes up.
4. The level complete screen shows `Secrets found: a of b` for that level.
5. Every call to `beginSelection` adds 1 to `Run.deaths` (except reason `discarded`).

### [ ] F2: Intro and ending text
1. When "Play" is chosen on the title, show `IntroScene` first: black screen, white text, these three lines, one at a time (each appears after 1.5 s), then `Enter: begin`:
   - `A warlord has stolen every face in the kingdom.`
   - `You are a changeling. Beat a foe and its face is yours.`
   - `Take back the faces. Climb to the throne.`
2. `EndingScene` shows:
   - `The Warlord falls. The faces return to their owners.`
   - `Deaths: N    Secrets: a of b    Time: mm:ss`
   - `Thanks for playing.`
   - `Enter: credits`
3. Credits: add the line `Design and code: built with Claude Code` if no such line exists.

### [ ] F3: Sound effects
1. New file `game/src/sfx.js` (add to `SCRIPTS` after `engine.js`). It exports `Sfx.play(name)` and `Sfx.enabled` (default true).
2. Create the `AudioContext` the first time `play` is called, inside `try { } catch (e) { }`. If it fails, do nothing ever again.
3. Each sound is one or two short oscillator notes with a gain envelope (attack 0.01 s, release to 0.001 over the note length):
   - `jump`: square, 440 Hz to 660 Hz over 0.1 s, volume 0.08
   - `hit` (enemy hit or defeated): square, 220 Hz, 0.08 s, volume 0.1
   - `pickup`: triangle, 660 then 880 Hz, 0.06 s each, volume 0.1
   - `hurt` (selection opened): sawtooth, 300 Hz to 80 Hz over 0.3 s, volume 0.1
   - `ability`: triangle, 520 Hz, 0.05 s, volume 0.06
   - `complete`: triangle, 523, 659, 784, 1047 Hz, 0.1 s each, volume 0.1
   - `boss`: sawtooth, 110 Hz, 0.4 s, volume 0.12 (when the warlord is hit)
4. Call them from the matching places in `scenes.js`, `abilities.js`, and `enemies.js`.
5. Pause menu: add an item `Sound: On` / `Sound: Off` that toggles `Sfx.enabled`. Put it before the last item so existing pause tests keep working; if a pause test breaks because of item order, update it.
6. The suite must have no page errors from audio (headless Chromium allows `AudioContext`).

### [ ] F4: Save and continue
1. Add `Hand.serialize()` (returns `{ hand: [...], deck: [...] }`) and `Hand.restore(data)`.
2. When a `PlayScene` starts on level index 1 or more, save `{ level, active, cards: Hand.serialize(), run: Run }` to `localStorage["changeling_save"]` inside `try { } catch (e) { }`.
3. Title: when a save exists, the items are `Continue`, `New game`, `Input check`, `Credits`. When none exists, they stay `Play`, `Input check`, `Credits`. Rewrite `TitleScene.update` to act on the item's name, not its index.
4. `Continue` restores the hand, `Run`, and starts `new PlayScene(level, active)`. `New game` and `Play` clear the save and start at level 1 with the intro.
5. `EndingScene` clears the save.
6. Suite check `save: finishing level 1 and reloading offers Continue, which starts level 2`.

### [ ] F5: Small game-feel touches
1. When an enemy is defeated, draw a 6-particle burst (small squares in the enemy's card color) that falls and fades over 0.4 s.
2. When the player respawns, flash the player for 1 second (skip drawing every other 0.1 s) and ignore enemy contact during that second.
3. Screen shake of 3 px for 0.15 s when the warlord is hit.

---

## Phase G: Final checks

### [ ] G1: Full pass
1. Run all three checks. Record the real suite count in `Current_Work.md` under Build status.
2. Run `python3 game/tools/validate_gates.py` and paste its summary lines for each level into `Current_Work.md`.
3. Check `game/changeling.html` size with `ls -l` (it must be under 5 MB) and that it opens with no console errors (the suite already checks page errors).
4. Update `README.md`: one line saying the game has 8 levels and the controls (arrows, A S Z X, C, Q, Enter). Do not describe the story or the characters.
5. Mark this task `[x]` and add the line `EXPANSION COMPLETE` as the last line of this file.

---

## Decisions log

(Executor agents add one line per decision here: task id, what was unclear, what was chosen.)

- Opus: exit zone stays 4 tiles tall (jumping over the flag completes the level).
