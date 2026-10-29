# Action Plan: finish Changeling

For a small, fast model. Read this whole section first. Then do the tasks in order, one at a time. Background facts are in `Claude_Notes.md`. Read it once before Task 0.

## How to work (read before every task)

1. Do ONE task at a time, in order. Do not start the next task until the current one is committed and pushed.
2. Do only what the task says. Do not refactor, rename, reformat, or "improve" anything else. Extra changes cause test failures.
3. Never ask the user a question. If something is unclear, pick the simplest option that works and add one line to the Decisions log in `Claude_Notes.md` (section 8).
4. Line numbers in this plan are approximate. To find code, search for the exact name with the Grep tool (for example `Grep pattern="beginSelection" path="game/src"`). Then Read about 40 lines around the match before you edit.
5. Edit with the Edit tool. The `old_string` must be copied exactly from the file. If an edit fails, Read the file again and retry. Do not guess.
6. Work on branch `main` only. Never make a branch. Check with `git branch --show-current`; it must print `main`.
7. Never delete, skip, or weaken a test to get green. If a test fails because the behavior was changed on purpose (the task says so), update that test to check the new behavior.
8. Text shown to the player: plain and short. No em dashes. No emojis.
9. If a task fails 3 times in a row, STOP that task. Run `git checkout -- game` to drop its unfinished edits (only if you have not committed them). Add a line to the Decisions log saying what failed and why. Mark it `[~]` below. Move to the next task.
10. Mark a task `[x]` in this file in the same commit that finishes it.

## The check routine (run after every code task)

Run these four steps in this order. All must pass before you commit.

Step A. Rebuild the single HTML file:
```bash
python3 game/tools/build_single_html.py
```
It must print no error.

Step B. Gate check. It must exit with code 0:
```bash
python3 game/tools/validate_gates.py; echo "exit=$?"
```
Look for `exit=0`. If you did not touch `levels.js` or the validator, this should already pass.

Step C. Quick syntax check of every file you edited (replace the name):
```bash
node --check game/src/enemies.js
```

Step D. Full suite. It takes 6 to 15 minutes and your tool may stop commands after 10 minutes, so run it in the background and write output to a file:
```bash
NODE_PATH=$(npm root -g) node game/tests/suite.js > /tmp/suite_out.txt 2>&1; echo "exit=$?" >> /tmp/suite_out.txt
```
Use `run_in_background: true` on the Bash tool. When it finishes, read the end of `/tmp/suite_out.txt` with the Read tool (offset near the end). Pass means the last lines show `0 failed` and `exit=0`. Do not pipe the suite through `tail` or `grep` when you run it (that hides the exit code).

If the suite shows a failure:
- Read the failing check name and message.
- If the failing check is `ability: knight charge (S) dashes` and Task 1 is not done yet, that is the known flake. Run the suite once more. If it fails again with only that check, continue and note it in the Results log. After Task 1 is done, it must not fail.
- Any other failure is caused by your change. Fix it, or undo your change and mark the task `[~]`.

To commit (use this exact form; the task id goes first):
```bash
git add -A game Claude_Notes.md Action_Plan.md
git commit -m "T1: short description

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_015KE1euu6obZg1ZWXrQ9Jsq"
git push origin main
```
If the push fails with a network error, wait 2 s and retry, then 4 s, 8 s, 16 s. If it is rejected because `main` moved, run `git pull --rebase origin main` then push again.

After the commit, add one row to the Results log (section 7 of `Claude_Notes.md`) with the commit hash (`git rev-parse --short HEAD`), gates result, and the real suite pass and fail counts. Put that in the NEXT commit together with the next task, or in a small commit of its own. Only write numbers you actually saw.

For visual tasks, also run the screenshot tool and open the PNGs with the Read tool (it shows images):
```bash
NODE_PATH=$(npm root -g) node game/tests/screenshots.js
ls game/tests/shots
```
Write one line in the commit message saying what you saw.

---

## Task 0 [x]: Baseline and sanity

1. Run `git branch --show-current`. It must print `main`. If not, run `git checkout main`.
2. Run `git status`. It must be clean. If not, stop and log it.
3. Confirm these files exist: `Claude_Notes.md`, `Action_Plan.md`, `CLAUDE.md`, `game/changeling.html`, `game/src/enemies.js`, `game/tests/suite.js`. Use `ls`.
4. Run Step A, Step B, and Step D from the check routine. Write the real result in the Results log. Expect the known flake (`knight charge`) to fail sometimes. That is fine here.
5. Do not commit anything else in this task unless you changed the Results log.

## Task 1 [x]: Fix the flaky charge test

Why: the suite waits in real milliseconds, but the headless game clock runs slower. The check reads the player before the charge has set its speed.

1. Find the check: `Grep pattern="knight charge" path="game/tests/suite.js"`. Read about 60 lines around it. Also read how other checks in the file wait (look for `waitForTimeout` and `page.evaluate`).
2. Find how the file reaches the scene object in the page. Search the file for `__scene`. Use the same way the neighbors do.
3. In the charge check, right BEFORE the line that presses the S key, add code that reads the scene clock and saves it:
   ```js
   const t0 = await page.evaluate(() => __scene.time);
   ```
   (If the neighbors use a different way to reach the scene, use theirs.)
4. Right AFTER the key press and the short wait, add a wait for the game clock to advance by 0.08 seconds:
   ```js
   await page.waitForFunction((t) => __scene.time >= t, t0 + 0.08);
   ```
   Keep every assertion in the check exactly as it is. Do not change the numbers the check expects.
5. Run Step A, B, C (on `game/tests/suite.js`, use `node --check game/tests/suite.js`).
6. Run only that check many times, if the suite file supports a filter (search the top of `suite.js` for `process.argv`). If there is no filter, run the full suite twice. The charge check must pass both times.
7. Commit as `T1: make charge check wait on game clock, not wall clock`. This task changes only the test, so the HTML rebuild will produce no diff; that is fine.

## Task 2 [x]: Fix invisible archer (idle and walk frame counts)

Why: the idle row has 2 frames and the walk row has 9, but the code uses 4 and 6, so the sprite is drawn from empty cells half the time.

1. Open `game/src/enemies.js`. Find `class Enemy` and its `draw` method (search for `lpc_` to land on the right spot). Find these lines:
   ```js
   if (this.hurtT > 0) frame = { row: 6, col: 0 };
   else if (this.def.idle) frame = { row: 0, col: Math.floor(this.animT * 3) % 4 };
   else frame = { row: 1, col: Math.floor(this.animT * 6) % 6 };
   ```
2. Replace them with:
   ```js
   if (this.hurtT > 0) frame = { row: ANIM_ROWS.hurt[0], col: 0 };
   else if (this.def.idle) frame = { row: ANIM_ROWS.idle[0], col: Math.floor(this.animT * 3) % ANIM_ROWS.idle[1] };
   else frame = { row: ANIM_ROWS.walk[0], col: Math.floor(this.animT * 6) % ANIM_ROWS.walk[1] };
   ```
3. Check the load order: `ANIM_ROWS` is defined in `game/src/anim.js`. Open `game/tools/build_single_html.py`, find the `SCRIPTS` list, and make sure `anim.js` comes BEFORE `enemies.js`, OR that the use is inside a method that only runs later (it is, since `draw` runs after load, so a later definition is fine for a `const` at top level of another script only if both are plain scripts; they share the global scope). If you are unsure, check that the page loads with no errors in step 5.
4. Add a suite check named `enemy: archer is drawn on every idle frame`. Copy the shape of the nearby archer check in `suite.js`. It should read the sheet pixels or, simpler, assert that for `animT` values 0, 0.34, 0.67, 1.0 the computed idle column is less than `ANIM_ROWS.idle[1]`. If this is hard to do inside the page, instead assert in the page: `ANIM_ROWS.idle[1] === 2` and `ANIM_ROWS.walk[1] === 9`, and that `Math.floor(5 * 3) % ANIM_ROWS.idle[1] < 2`. Keep the check simple.
5. Run the check routine. Take screenshots and look for the archer in a level that has one (level 3 has 3 archers, look at `l3_start.png` or `l3_mid.png`). Say what you saw in the commit message.
6. Commit as `T2: archer idle and walk use real frame counts`.

## Task 3 [ ]: Fix enemy facing

Why: LPC sheets face right. The enemy draw code flips the sprite when the enemy moves right, which makes it face backwards. UNVERIFIED until you look.

1. Take a screenshot where an enemy is visible and walking. If `screenshots.js` has no such shot, add a shot: load level 1, place the player at the spawn, wait 1 second, and take a picture around the first grunt. Copy the shape of the shots already in `screenshots.js`.
2. Open the PNG with the Read tool. Look at which way the enemy faces compared with the way it walks. Enemies walk toward the player when they chase, so you can also check that: a chasing enemy must face the player.
3. If the enemy faces the wrong way: in `Enemy.draw` (`game/src/enemies.js`), change the flip condition from `if (this.dir > 0) {` to `if (this.dir < 0) {`. Do not change anything else in that block.
4. If the enemy already faces the right way, change nothing in the code. Write one line in the Decisions log saying you looked at the screenshot and it was already correct.
5. Run the check routine. Look at the new screenshot after the change.
6. Commit as `T3: enemies face their walking direction`.

## Task 4 [ ]: Hurt frame before the death selection

Why: when the player dies the selection screen opens at once. A short hurt pose makes the death readable.

1. Open `game/src/scenes.js`. Search for `beginSelection`. Read the whole function and the `PlayScene` constructor. Search for the existing mode names: `"play"`, `"select"`.
2. Plan (do exactly this):
   - Add a field `this.hurtShowT = 0;` in the constructor next to the other timers, and also reset it to 0 in the respawn code (search for `ghostT = 0` to find where timers are reset).
   - In `beginSelection(reason)`: if `reason` is `"discarded"` or `"fell"`, behave as today. For every other reason (the player was hit, slain, or shot), do NOT open the selection yet. Instead set `this.mode = "dying"`, `this.hurtShowT = 0.15`, and remember the reason in `this.dyingReason = reason`. Do not add to `Run.deaths` twice: keep the existing deaths increment exactly once, in whichever place it already is. If it is at the top of `beginSelection`, leave it there and make sure the deferred call does not run it again (use a separate helper `openSelection(reason)` that holds the rest, and have `beginSelection` call it right away for `discarded` and `fell`).
   - In `update`, when `this.mode === "dying"`: count `hurtShowT` down by `dt`; do nothing else that moves things. When it reaches 0, call `openSelection(this.dyingReason)`.
   - In `drawBody` (search for `drawBody`), when `this.mode === "dying"`, draw the hurt row: row `ANIM_ROWS.hurt[0]`, column 0.
   - Make sure input is ignored in mode `dying` (the update code for `play` and `select` is separate, so a new mode ignores them by default; check that no code does `if (this.mode !== "play" && this.mode !== "select") ...` in a way that breaks).
3. The suite has checks that expect `mode === "select"` right after a death. Find them: `Grep pattern='mode === "select"' path="game/tests/suite.js"` (also try `'select'`). For each check that triggers a death by touching spikes, an enemy, an arrow, or the `slain` reason, add `await page.waitForTimeout(400);` after the trigger and before the assertion. Do not change the assertion.
4. Run the check routine. Fix failures by adding waits only where a death is caused by a hit, never by removing assertions.
5. Commit as `T4: show hurt pose for 0.15 s before the death selection`.

## Task 5 [ ]: Warlord knockback

1. Open `game/src/enemies.js`. Find `Enemies.defeat` (search `defeat`). Read it. It currently takes `(enemy)`.
2. Change the signature to `defeat(enemy, fromX)`. In the branch where `enemy.hp > 1` (the enemy survives): after setting `hp` and `hurtT`, add:
   ```js
   if (fromX !== undefined) {
     enemy.knockT = 0.12;
     enemy.knockVx = enemy.x + enemy.w / 2 >= fromX ? 160 : -160;
   }
   ```
3. In `Enemy` constructor add `this.knockT = 0; this.knockVx = 0;`.
4. In `Enemy.update`, find the stun block (search `stun`). Right after it add: if `this.knockT > 0`, count it down by `dt` and move the enemy by `this.knockVx * dt` using the same horizontal movement helper the enemy already uses (search how `this.x` is changed with wall checks; reuse that, do not invent new collision code), then `return` so the enemy does not also walk.
5. Update the callers to pass the attacker's x:
   - In `game/src/abilities.js`, in `Attacks.update`, there are two calls to `Enemies.defeat` (one for melee hitboxes, one for projectiles). Pass `hb.x + hb.w / 2` for the hitbox and the projectile's `x` for the projectile.
   - In `game/src/scenes.js`, in `checkEnemyContact`, the stomp call: pass `p.x + p.w / 2`.
6. Add a suite check `boss: a hit knocks the warlord back`: spawn a warlord with `Enemies` (copy how the existing check `boss: warlord takes 8 hits` creates one), set `hurtT = 0`, record its x, call `Enemies.defeat(warlord, warlord.x - 50)`, wait 150 ms, assert its x is greater than before.
7. Run the check routine. Commit as `T5: warlord is knocked back when hit`.

## Task 6 [ ]: Lift the ability bar above touch buttons

1. Open `game/src/scenes.js`. Search `drawAbilities`. Note where the bar's y position is set (about `Engine.H - 6`).
2. Search `game/src/input.js` and `game/src/index.html` for `touch` to find the DOM node `#touch` and its `.face` buttons, and the CSS class `touch` on `body` (see also `game/src/style.css`).
3. In `drawAbilities`, compute a lift in logical pixels and subtract it from the bar's y:
   ```js
   let lift = 0;
   try {
     if (document.body.classList.contains("touch")) {
       const face = document.querySelector("#touch .face");
       const cv = document.querySelector("canvas");
       if (face && cv) {
         const fr = face.getBoundingClientRect();
         const cr = cv.getBoundingClientRect();
         lift = Math.max(0, (cr.bottom - fr.top) * Engine.H / cr.height);
       }
     }
   } catch (e) {}
   ```
   Because this is read-only work in a draw method, that is allowed. Use `lift` when drawing the strip, key caps, and text (add it to the bar's base y).
4. Add a suite check `hud: ability bar clears the touch buttons`. Find the existing touch test in `suite.js` (search `touch`) which already makes a phone-sized landscape page with touch on. In that page, call the draw once, then assert `lift > 0`. If `lift` is local, store it on the scene as `this.abilityLift` so the test can read it. Keep it simple.
5. Run the check routine. Commit as `T6: ability bar moves above touch buttons`.

## Task 7 [ ]: Redesign the selection screen and level complete screen

1. Open `game/src/scenes.js`. Find `drawSelect` (the death and discard selection) and the level complete draw (search `Level complete`). Read both fully. Find how `drawText` is used (`game/src/ui.js`) and copy its usage exactly, including how font and fill color are set before the call.
2. Selection screen changes (keep all existing logic and key handling, change only drawing):
   - Card size 116 wide by 108 tall. Space cards so three fit in 480 px with gaps (three cards at 116 plus two gaps of 12 gives 372; center that).
   - Inside each card: the character's idle frame drawn at 2x (use `drawFrame` from `anim.js` or the same idle draw the HUD uses), the name under it in size 12 bold, the four ability names below in size 10 (names come from `ABILITY_NAMES` in `abilities.js`).
   - Highlighted card: 2 px gold border `#d9a441` and lifted 4 px.
   - Empty hand slots: draw a dashed outline, same as the HUD.
3. Level complete screen: a centered panel (about 240 by 110, fill `rgba(10,12,18,0.85)`, 1 px light border) with these lines, each drawn with `drawText`: `Level complete` (size 16 bold), the level name (size 12), `Secrets found: a of b` (size 11), `Enter: next level` (size 11; keep the existing text rule: on the last level it says `Enter: continue`).
4. Do not change any text that tests read. Search `suite.js` for `Level complete` and `Enter: next level` to see what is checked. If a test reads draw output, keep the same words.
5. Run the check routine, then screenshots. Open `z_select.png` and the level complete shot (if none exists, add one to `screenshots.js`: go to the exit of level 1 and shoot after the scene says complete). Check: no text overlaps other text, nothing is cut off at the card edges, names like "Shield bash" fit.
6. Commit as `T7: redesign selection and level complete screens`.

## Task 8 [ ]: Small effects, one per commit

Do these in order. Each one is a separate commit. The idea is the same every time: spawn a few short-lived particles through the existing `Effects` object in `game/src/enemies.js`. First read `Effects` fully (search `const Effects`). Find what functions it already has (burst, shake, reset, update, draw). Reuse its particle list and update and draw code. If it can only make a burst of squares, add one small function per effect. Particles must be updated in update code, never in draw. Particles must be cleared by `Effects.reset()`.

After each one: run the check routine, run screenshots, and commit with the id shown.

- T8a [ ] Hit spark. In `Attacks.update` (`abilities.js`), at the two places where an enemy is hit (melee and projectile), call a new `Effects.spark(x, y)` that creates 6 short white lines radiating from the point, each 4 to 7 px, living 0.12 s. Draw them as 1 px white lines. Use a fixed set of 6 angles (0, 60, 120, 180, 240, 300 degrees) so there is no randomness in draw.
- T8b [ ] Projectile wall particles. In `Attacks.update`, where a projectile is removed because it hit a solid tile (look for `World.isSolid` or `ch === "#"`), call `Effects.dust(x, y, color, 3)`: 3 small squares, falling and fading over 0.25 s. Use the projectile's own color.
- T8c [ ] Blink rings. In `blink(p)` in `abilities.js`, call `Effects.ring(x, y, color)` at the start position and the end position. A ring is a circle outline growing from radius 6 to 16 over 0.2 s, color `#b9a2f0`, fading.
- T8d [ ] Float sparkles. In `PlayScene.update` (while `this.floatT > 0`), every 0.05 s spawn 2 purple 1 px particles under the feet that rise and fade over 0.3 s. Use an accumulator field `this.sparkleT` and reset it to 0 on respawn.
- T8e [ ] Leap and landing dust. Call `Effects.dust(footX, footY, "#8a7a66", 5)` when the rat's `leap` fires and where `landT` is set after a hard landing.
- T8f [ ] Rope sag and bone bridge pattern. In `World.drawPlatforms` (`world.js`): for a rope (no custom color), draw 3 segments with the middle one 2 px lower, plus a small post at each end. For a bone bridge (color `#e8e2d0`), alternate `#e8e2d0` and `#c8c0a8` rectangles every 6 px with a 1 px dark outline. Collision stays the same flat platform; only the drawing changes.
- T8g [ ] Ghost outline. In `PlayScene.drawBody`, while `ghostT > 0`: first draw a cyan version of the current frame offset by 1 px in each of the four directions, visible only on every other 0.05 s (use `this.time`, which update advances), then draw the normal sprite at alpha 0.5. To tint: draw the frame to a small offscreen canvas, then `globalCompositeOperation = "source-atop"` and fill `#6fe3ff`. Create that offscreen canvas once at load, not each frame.

If an effect needs a tool you do not have, skip it, log it, and go on. Do not spend more than 3 tries on any single effect.

## Task 9 [ ]: Trim the credits to used items only

1. Open `game/tools/build_lpc.py`. Find `credits_for` and where it writes `CREDITS.txt`.
2. Read the data: each definition file lists several credit entries, each with a `file` path. Change `credits_for` so it keeps only entries whose `file` value contains a folder name that the build actually used for any sheet. Use the same list of used folders the compose step already has (search for the layer lists such as `zPos` or the dict of layers per character).
3. Run `python3 game/tools/build_lpc.py`. It rewrites `game/assets/lpc/*.png` and `CREDITS.txt`. Check with `git status` that the PNGs did not change (they should be byte-identical or visually identical). If PNGs changed, run `git diff --stat` and stop; log it; undo with `git checkout -- game/assets/lpc`.
4. Check that `CREDITS.txt` is now shorter than 52,000 bytes (`wc -c game/assets/lpc/CREDITS.txt`) and still names the used items (knight armor, goblin, skeleton, rat, zombie, orc, robe, hat).
5. Rebuild the HTML (Step A). If the credits screen in the game reads this file or an inline copy, check where (`Grep pattern="CREDITS" path="game"`) and update that too.
6. Run the check routine. Commit as `T9: credits list only used assets`.

## Task 10 [ ]: Visual pass (screenshots)

1. Run the screenshot tool (see above). List the PNGs in `game/tests/shots`.
2. Add a shot per enemy type if none exists. Write a short script block in `screenshots.js` that, for each of `grunt`, `mud_revenant`, `rat_king`, `archer`, `warlord`, loads a level that contains it (any level; use `World.load(i)`), teleports the player 80 px left of that enemy, waits 300 ms, and shoots. Copy the shape of the existing shots.
3. Open EVERY PNG with the Read tool, one by one. For each, add one line under a heading `## Visual check` in `Claude_Notes.md` (add it as a new section 10): file name, then `OK` or what is wrong (overlapping text, cut-off sprite, sprite facing the wrong way, invisible sprite, unreadable text).
4. For each problem you can fix in under 3 tries, fix it, rebuild, shoot again, and update the line. For problems you cannot fix, leave the line saying what is wrong.
5. Commit as `T10: visual pass and screenshots`.

## Task 11 [ ] (hard, do last): LPC weapons and crown

This task is the riskiest. Do it only after Tasks 1 to 10 are committed. If it fails 3 times, undo with `git checkout -- game` and `git clean -fd game/tools` for new files only, log it, and finish with Task 12.

1. Make a work folder outside the repo: `mkdir -p /tmp/lpc_src && cd /tmp/lpc_src`.
2. Clone the generator with a sparse checkout:
   ```bash
   git clone --depth 1 --filter=blob:none --sparse https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator gen
   cd gen
   git sparse-checkout set sheet_definitions spritesheets/weapon spritesheets/hat
   ```
   If this fails, try without `--filter=blob:none`. If it still fails, log it and skip this task.
3. Open `game/tools/build_lpc.py` fully. Find how layers are listed for each character (knight, ranger, mage, rat_king) and how the source path to the sheets is set (it may point to a folder under `method_5_lpc_walk/assets/lpc` or a cache). Learn how a layer entry is written before adding one.
4. Add layers (paths relative to the generator `spritesheets/` folder; confirm each file exists with `ls` first, and use only animations that exist as 64 px sheets):
   - Knight sword: `weapon/sword/arming/universal/bg/{anim}/steel.png` (zPos 9) and `.../fg/{anim}/steel.png` (zPos 140). Anims available at 64 px: walk, idle, hurt, combat_idle. There is NO 64 px slash or thrust. So the sword will be missing during attacks. To avoid a weaponless-looking flash, hide the sword layer during slash and thrust frames (do not use fallbacks for weapon layers) and accept that.
   - Ranger bow: `weapon/ranged/bow/normal/universal/background/{anim}/light.png` (zPos -1) and `.../foreground/{anim}/light.png` (zPos 140). Anims: walk, shoot, hurt.
   - Mage staff: `weapon/magic/simple/background/{anim}/simple.png` (zPos 9) and `.../foreground/{anim}/simple.png` (zPos 140). Anims: spellcast, thrust, walk, hurt.
   - Rat king crown: `hat/formal/crown/adult/{anim}/crown_gold.png` (zPos 130). Check by eye on the rat head after composing; if it floats or misaligns, drop it and log it.
5. Weapon layers must NOT use the attack fallback logic (a staff thrust drawn over a body slash will not line up). Mark them so the compose step leaves their cells empty when the animation does not exist.
6. Run the build tool. Make a preview image of each changed sheet (copy the sheet scaled 2x with nearest neighbor into `game/tests/shots/`) and open it with the Read tool. Check that the weapon sits in the hand and is not on the wrong side.
7. Add each new layer's credit to `CREDITS.txt` (the build tool should do this through `credits_for`; check the new items appear).
8. Rebuild HTML, run the check routine, run screenshots, look at a knight, ranger, mage shot.
9. Commit as `T11: add sword, bow, staff, and crown layers`.

## Task 12 [ ]: Close out

1. Run the full check routine on a clean tree. Record the real numbers in the Results log (section 7 of `Claude_Notes.md`).
2. Update section 5 and section 6 of `Claude_Notes.md` so they list only items still open. Remove items you finished. Keep items you marked `[~]`.
3. Update `README.md`: keep the game link and controls line; change the sentence that points to `Current_Work.md` so it points to `Claude_Notes.md`.
4. Make sure `CLAUDE.md` says the task list is `Action_Plan.md` and the history is `Claude_Notes.md` (it was updated during cleanup; check it still does).
5. If every task above is `[x]`, add a final line to this file: `ACTION PLAN COMPLETE`. If some are `[~]`, do not add it.
6. Commit as `T12: close out and record results`. Push.

## Out of scope (do not do these)

- Real devices (gamepad, phone, iOS full screen), other browsers, sound quality checks.
- New levels, new characters, or any change to level layouts. If you edit `levels.js` by mistake, run `git checkout -- game/src/levels.js`.
- Anything in the `method_*` folders.
