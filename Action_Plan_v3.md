# Action Plan v3: weapons, animation, and the Opus review items

Source: `Opus_Review_Log.txt`. Written for a small model. Follow `CLAUDE.md` rules. Do the tasks in order. Mark each `[x]` when done (or `[~]` per rule 11). Commit message starts with the task id. Push to `main` after each commit.

Facts already checked (2026-10-29, do not re-research):
- The LPC generator has a sword with walk, slash, and thrust: the longsword. Walk and hurt are 64 px cells. Slash is `slash_oversize` and thrust is `thrust_oversize`: 192 px cells, 4 rows (up, left, down, right), 6 and 8 frames, one-to-one with the body's slash and thrust frames. The arming sword has no thrust, so the knight switches to the longsword.
- Oversize rule from the generator (`sources/canvas/draw-frames.ts`): a 64 px body frame sits centred in a bigger cell, offset `(cell - 64) / 2` on x and y. So 32 px in a 128 cell, 64 px in a 192 cell.
- The normal bow has walk frames at `weapon/ranged/bow/normal/walk/foreground/light.png` and `.../walk/background/light.png` (custom animation `walk_128`, 128 px cells, right row 3, 9 frames used). The old builder missed them because the path has a different shape.
- The arrow layer `weapon/ranged/bow/arrow/shoot/arrow.png` shows the nocked arrow on shoot frames 0 to 8 and is gone from frame 9 (release). On frame 8 the arrow sits at cell x 26 to 57, y 29 to 34 (64 px cell, feet at the cell bottom).
- LPC walk frame 0 is a standing pose. A smooth walk loops frames 1 to 8.
- The warlord spawns with its top at the top of the `W` tile (`world.js`, `enemySpawns.push`). It is 58 px tall, so its feet start 26 px inside the ground. That is the "snap" in review item G1.
- Enemy hitbox heights: grunt 30, mud revenant 30, rat king 26, archer 30, warlord 58. Player is 18 by 30.

## X1 [x]: Get the LPC source (no commit)

```bash
cd /home/user && git clone -q --depth 1 --filter=blob:none --sparse https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator lpc_gen
cd /home/user/lpc_gen && git sparse-checkout set spritesheets/body spritesheets/head spritesheets/legs spritesheets/feet spritesheets/torso spritesheets/arms spritesheets/hat spritesheets/shield spritesheets/weapon sheet_definitions
```
If `/home/user/lpc_gen` already exists, run only the second line. Then run `python3 game/tools/build_lpc.py /home/user/lpc_gen` once and run `git status`. If any `game/assets/lpc/*.png` changed, write that in the Decisions log and run `git checkout -- game/assets`.

## X2 [x]: One 192 px composer (W8, fallbacks)

File: `game/tools/build_lpc.py` only. Goal: compose every row in 192 px cells, then write two sheets.

1. Add near the top:
   - `BIG = 192`
   - `COUNT = {"idle": 2, "walk": 9, "slash": 6, "thrust": 8, "spellcast": 7, "shoot": 13, "hurt": 6, "jump": 5}` (must match `ANIM_ROWS` in `game/src/anim.js`).
   - `BIG_KEYS = ["knight", "ranger", "mage", "rat", "weaver"]`
   - `PATH_OVERRIDE = {}` (filled in X3). Maps a layer pattern to `{anim: fixed path}`.
2. `layer_path(lpc, pattern, anim)`: if `pattern in PATH_OVERRIDE` and `anim in PATH_OVERRIDE[pattern]`, return `lpc / "spritesheets" / PATH_OVERRIDE[pattern][anim]`. Otherwise keep the old line.
3. Replace `frames_of` with a version that returns 192 px frames:
   - Open the image. `H` is its height. Cell size `cell = 64 if H == 64 else H // 4`. If `cell` is not 64, 128, or 192, return None.
   - For each column `c` in `range(width // cell)`: crop `(c*cell, row*cell, c*cell+cell, row*cell+cell)`, make a new transparent `BIG` by `BIG` image, paste the crop at `((BIG - cell) // 2, (BIG - cell) // 2)`. Return the list.
4. In `compose`, for each layer, after its frames are found, make the list exactly `COUNT[anim]` long: cut extra frames; if short, repeat the last frame. Special case: when a weapon layer used the walk fallback (idle or jump), use only walk frame 0, repeated `COUNT[anim]` times. Then composite as before. The composite list is then always `COUNT[anim]` long.
5. Write the big sheet (`COLS*BIG` by `len(ANIMS)*BIG`). Make the small sheet from it: for each cell, crop `(64, 64, 128, 128)` of that 192 cell and paste at the 64 px cell. Save the small sheet as `<key>.png` (as before). Save the big sheet as `<key>_big.png` only if `key in BIG_KEYS`.
6. Run the builder. Check: `python3 -c "from PIL import Image; im=Image.open('game/assets/lpc/knight_big.png'); print(im.size)"` must print `(2496, 1536)`.
7. Regression check for enemies. Save as `/tmp/cmp.py` and run it. It must print 5 lines ending in `diff 0`:
```python
import io, subprocess
from PIL import Image, ImageChops
for k in ["archer", "grunt", "mud_revenant", "rat_king", "warlord"]:
    old = Image.open(io.BytesIO(subprocess.check_output(["git", "show", f"HEAD:game/assets/lpc/{k}.png"]))).convert("RGBA")
    new = Image.open(f"game/assets/lpc/{k}.png").convert("RGBA")
    d = 0
    for r, n in enumerate([2, 9, 6, 8, 7, 13, 6, 5]):
        for c in range(n):
            box = (c*64, r*64, c*64+64, r*64+64)
            if old.crop(box).getbbox() and ImageChops.difference(old.crop(box), new.crop(box)).getbbox():
                d += 1
    print(k, "diff", d)
```
   If a number is not 0, the offset or crop is wrong. Fix it (rule 11 applies).
8. Do not add the big sheets to the HTML yet. Commit the tool and the changed PNGs. Message `X2: compose sheets in 192 px cells, crop rows to frame counts`.

## X3 [x]: Knight longsword, bows on walk and idle

File: `game/tools/build_lpc.py`.

1. In `CHARACTERS["knight"]` replace the two arming sword layers with:
   `("weapon/sword/longsword/universal_behind/{anim}/longsword.png", 9)` and `("weapon/sword/longsword/{anim}/longsword.png", 140)`.
2. Add to `PATH_OVERRIDE`:
   - `"weapon/sword/longsword/universal_behind/{anim}/longsword.png": {"slash": "weapon/sword/longsword/attack_slash/behind/longsword.png", "thrust": "weapon/sword/longsword/attack_thrust/behind/longsword.png"}`
   - `"weapon/sword/longsword/{anim}/longsword.png": {"slash": "weapon/sword/longsword/attack_slash/longsword.png", "thrust": "weapon/sword/longsword/attack_thrust/longsword.png"}`
   - `"weapon/ranged/bow/normal/universal/background/{anim}/light.png": {"walk": "weapon/ranged/bow/normal/walk/background/light.png"}`
   - `"weapon/ranged/bow/normal/universal/foreground/{anim}/light.png": {"walk": "weapon/ranged/bow/normal/walk/foreground/light.png"}`
   The ranger and weaver both use those bow patterns, so both get the walk bow, and idle and jump get walk frame 0.
3. Credits: in `main`, `folders` must also hold the override paths. Add each override path's folder (`str(pathlib.Path(p).parent)`) for layers of that character before calling `credits_for`. Then check `grep -n "longsword" game/assets/lpc/CREDITS.txt` prints at least one line.
4. Add the file `game/tools/check_sheets.py` (new). It loads each `game/assets/lpc/<k>_big.png` for the 5 big keys and prints `FAIL` lines for:
   - any row r, col c below `COUNT` that is fully transparent;
   - any col at or above `COUNT` that is not transparent;
   - knight: slash row (2) and thrust row (3): no frame with an opaque pixel outside the centre box `(64, 64, 128, 128)` (the blade must reach out);
   - ranger and weaver: walk row (1) col 1: fewer than 40 opaque pixels outside the body (compare with the same cell of a build without the bow is too hard, so just require the bow's light wood colour: any pixel with r > 150, g > 100, b < 90 and alpha 255). If this check is noisy, drop only this one check and log it.
   It prints `sheets OK` when nothing failed and exits 1 on any failure.
5. Rebuild sheets, run `python3 game/tools/check_sheets.py`. Commit. Message `X3: knight longsword on slash and thrust, bow on walk and idle`.

## X4 [x]: Draw the player from the big sheet

1. `game/tools/build_single_html.py`: next to `"lpc_knight": "lpc/knight.png",` add `"lpc_knight_big": "lpc/knight_big.png",` and the same for ranger, mage, rat, weaver.
2. `game/src/anim.js`:
   - `GhostCanvas` size 64 becomes 192.
   - `drawFrame(ctx, sheet, frame, x, y, facing, size = 64)`: use `size` in place of every `64`.
3. `game/src/scenes.js`, the player draw (grep `GhostCanvas`, about line 838):
   - After `const sheet = ...` add a big sheet pick: `const big = IMG[LPC_KEY[this.active] + "_big"];` `const size = big ? 192 : 64;` `const pad = (size - 64) / 2;` and use `big || sheet`.
   - `sx` and `sy` subtract `pad`.
   - In the ghost block replace `64` with `size` (clearRect, drawImage source and target, fillRect) and pass `size` to both `drawFrame` calls.
   Do not change cards, title, or enemies; they keep the 64 px sheet.
4. Check routine A to C. Screenshot tool once. Read `game/tests/shots/c_knight_ab3.png` only. The knight must show a sword arc or blade, and must not be shifted from its old spot. Commit. Message `X4: player uses 192 px sheets so weapons can reach out`.

## X5 [x]: Arrow leaves the bow (A1)

1. `game/src/anim.js`: add `const ACTION_FIRST = { shoot: 7 };` In `pickFrame` action branch: `const first = ACTION_FIRST[body.action] || 0; const n = count - first;` and `col = first + Math.min(n - 1, Math.floor(body.animT / (ACTION_LENGTH[body.action] / n)));`. The shot now shows the full draw then the release (frame 9) right as the arrow flies.
2. `game/src/abilities.js`, case `shoot` (grep `Effects.flare`): let `cx = p.x + p.w / 2`.
   - Arrow `x`: `p.facing > 0 ? cx + 14 : cx - 22`. Arrow `y`: `p.y + 6`. Keep `w: 8, h: 4`. (y 6 still hits the 26 px rat king, whose top is at `p.y + 4`.)
   - Flare: `Effects.flare(cx + 22 * p.facing, p.y + 8, ...)` keeping the ramp argument.
3. Check routine A to C. Commit. Message `X5: arrows spawn at the bow, shoot plays its release`.

## X6 [x]: Smoother walk and jump (A4, A5)

1. `game/src/anim.js` `pickFrame`:
   - Walk: `col: 1 + Math.floor(body.walkDist / 6) % (ANIM_ROWS.walk[1] - 1)`.
   - Airborne: `col: body.vy < -120 ? 1 : body.vy < 120 ? 2 : 3`.
2. `game/src/enemies.js` walk frame (grep `animT * 6`): `col: 1 + Math.floor(this.animT * 6) % (ANIM_ROWS.walk[1] - 1)`.
3. Check routine A to C. Commit. Message `X6: walk loops frames 1 to 8, jump has rise, apex, fall`.

## X7 [ ]: Warlord stands on the floor (G1)

`game/src/enemies.js`, grep `new Enemy(s.kind`. Replace the map body so that a tall enemy has its feet on the bottom of its tile:
```js
list = World.enemySpawns.map((s) => {
  const h = ENEMY_DEFS[s.kind].h;
  return new Enemy(s.kind, s.x, h > World.TILE ? s.y + World.TILE - h : s.y);
});
```
Only the warlord is taller than a tile, so nothing else moves. Check routine A to C. Commit. Message `X7: warlord spawns with its feet on the floor`.

## X8 [ ]: Banner under the sprites (G2)

`game/src/scenes.js`: remove the line `this.drawBanner2(ctx);` from the play-mode HUD branch (about line 816) and add it right after `World.drawPlatforms(ctx, cx, cy);` (about line 756). Sprites and attacks now draw over the banner. Check routine A to C. Commit. Message `X8: level banner draws under sprites`.

## X9 [ ]: Enemy weapons (W6)

Decision (rule 3): the user asked for all characters, so enemies get a walk-pose weapon. File: `build_lpc.py` `CHARACTERS`.
- `warlord`: add the two longsword layers from X3.
- `grunt`: add `("weapon/sword/dagger/behind/{anim}/dagger.png", 9), ("weapon/sword/dagger/{anim}/dagger.png", 140)`.
- `archer`: add the two bow layers the ranger uses.
Rebuild sheets and run `check_sheets.py`. Enemies draw from the small sheet, so a bow can be cut at the cell edge. In X10 look at the archer; if its bow is cut badly, remove the archer bow layers, rebuild, and log it. The X2 compare script will now show diffs for these three; that is expected, do not rerun it. Commit. Message `X9: warlord sword, grunt dagger, archer bow`.

## X10 [ ]: Visual check at sprite scale (W11)

1. Make a contact sheet (scratch script, not committed): for each of the 5 big sheets and the 3 armed enemy small sheets, paste rows walk, slash, thrust, shoot, jump, scaled 2x with `Image.NEAREST`, into one PNG per character in `game/tests/shots/` (git-ignored). Limit each to 1600 px wide.
2. Read only `knight` and `ranger` sheets plus the `archer` one. Write one line each under `CLAUDE.md` section 10 `Weapon visual check (X10):`. Say OK or what looks wrong. Do not fix anything here except the X9 archer rule.
3. Update `CLAUDE.md` section 6 "Open work" art line to the new truth: knight sword on all rows but spellcast and shoot; bows on idle, walk, jump, shoot, hurt; mage staff still hidden on slash and shoot. Commit. Message `X10: weapon visual check`.

## X11 [ ]: Close out (the only suite run)

1. `git status` clean. Step B, then step D once in the background.
2. If a check fails, write its name and the last 10 lines of its output in the Decisions log. Do not rerun. Exception: if the only failures are about arrow timing or the shoot frame, and they wait less than the arrow needs to travel the extra 5 px, raise that wait by 50 ms once and rerun once.
3. Add one Results log row with the real counts. Mark X11 `[x]`, add `ACTION PLAN V3 COMPLETE` at the end of this file. Commit and push. Message `X11: close out`.

## Not in this plan (do not do these)

- Mage staff on slash and shoot (no LPC frames). Weaver bow colour vs bone arrows. Licenses L1, L2.
- Hostile archer arrow origin. Mage beam origin (V6 said it is fine).
- Any level layout change, `method_*` folders, `reference/`.
