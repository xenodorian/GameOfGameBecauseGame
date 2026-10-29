# Changeling: Knight of a thousand faces

## Project overview
An HTML browser game. The player downloads a single HTML file and plays it in the browser on a computer or mobile phone. Landscape orientation only, with a full screen toggle.

## Core concept
Similar to Kirby, one character can take on the powers of many different characters by defeating enemies. Unlike Kirby, the player does not swallow enemies. When an enemy is defeated, it drops a card. Collecting a card adds that character to the player's deck.

## Cards, hand, and deck
- The player holds a hand of 3 cards at any time. Hand slots fill as the player progresses through the level.
- When the player collects more cards than there are open hand slots, the extra cards go into the deck in random order.
- Each card represents a character. Each character card has unique powers and abilities.

## Death and respawn
- When the player dies, they select one of the 3 cards in their hand.
- They respawn as that character in the closest safe space to where they died.

## Abilities
- Each character's ability is activated by a key or button.
  - Keyboard: A, S, Z, or X.
  - Gamepad: X, Y, A, or B.

## Discard
- At any time, the player can discard a card from their hand.
- At any time, the player can discard the character they are currently playing as.

## Levels and secrets
- The main level must be completable with any character.
- Secret levels, power-ups, and character cards are placed in areas reachable only with specific character abilities.
- This forces the player to cycle through their characters to find one that can reach a given unlockable, if they choose to pursue it.

## Controls
- Fully playable on a keyboard using the letter keys and the arrow keys.
- Fully playable on a simple gamepad that has only a directional pad and the A, B, X, and Y buttons.

## Platform and format
- Delivered as a single downloadable HTML file.
- Runs in desktop and mobile browsers.
- Landscape only.
- Includes a full screen toggle.

## Decisions (all questions closed)

### Art (decided)
- Character animation: Universal LPC spritesheets (walk, slash, thrust, shoot, spellcast, 64px cells, 4 directions). Source copies live in `method_5_lpc_walk/assets/lpc/`. Credits are in `assets/lpc/CREDITS.csv` (OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0 per asset).
- Level tiles and terrain: Dungeon Crawl Stone Soup tiles (`method_4_sourced_assets/assets/dcss/`). Walls, floors, grass, trees.
- Card portraits and HD art: Sprite Foundry HD packs (MIT). Copies in `method_4_sourced_assets/assets/heroes_hd/`.
- Enemies: Sprite Foundry 48px monster and goblin packs (MIT), or LPC if a matching layer exists.
- Weapons: none. Attack animations are unarmed, per the design decision.
- Art pipeline rule: all sprites are prepared as sheets and bundled into the single HTML file.

### Game rules (defaults set)
- **Jump:** Up arrow on keyboard, Up on the d-pad. Movement is Left and Right.
- **Ability keys:** keyboard A, S, Z, X map to gamepad X, Y, A, B. Ability 1 is A/X, ability 2 is S/Y, ability 3 is Z/A, ability 4 is X/B. The character's four abilities are bound to these slots in order.
- **Discard current character:** Q on keyboard. Down on the d-pad, held for 0.5 seconds.
- **Discard a hand card:** C on keyboard toggles discard mode. Left and Right move the highlight across the 3 hand slots. C confirms. On a gamepad, Down toggles discard mode, Left and Right move the highlight, and Down confirms.
- **Death and respawn:** the death screen shows the 3 hand cards. Left and Right select, Z or A confirms. The player respawns as the selected character.
- **Closest safe space:** the nearest grounded tile with a clear 2 by 3 tile area, with no enemy or hazard within 3 tiles of the spawn point. Search expands outward from the death point up to 20 tiles. If nothing is found, respawn at the last checkpoint.
- **Deck display:** the deck count is shown as a number. Deck contents are hidden.
- **Hand fill:** hand slots fill left to right. Extra cards go to the deck in random order.

### Starting roster (defaults, to be confirmed in playtest)
| Character | Sprite source | Ability 1 | Ability 2 | Ability 3 | Ability 4 |
|---|---|---|---|---|---|
| Knight | LPC plate body, greathelm, heater shield | Shield bash (stuns enemies in front) | Charge (fast horizontal dash) | Slash (melee) | Thrust (reach melee) |
| Ranger | LPC leather, hood, quiver | Shoot (arrow, up to 2 shots) | Arrow anchor (pins a rope across a gap) | Slash | Hop (extra mid-air jump) |
| Mage | LPC robe layers (verify) | Spellcast bolt | Float (short hover) | Slash | Blink (short teleport) |

Gating examples for secret areas: Ranger's arrow anchor reaches high ledges. Mage's float crosses gaps. Knight's shield bash breaks cracked walls.

---

## Build status (updated this session)

- Playable build: `game/changeling.html` (one file). Rebuild with `python3 game/tools/build_single_html.py`. Source is in `game/src/`.
- Full test suite: `NODE_PATH=$(npm root -g) node game/tests/suite.js` (Playwright with Chromium). It runs 28 checks, including all keyboard playthroughs and the gate validator, and exits non-zero on failure. Last run: 28 of 28 pass.
- Done or partly done: Phases 0 to 9, except real-device checks, LPC attack animations, mage art, and sound. Phase 4 has all 12 abilities coded, each with a suite check.
- Open items for the next session: a real-device pass (gamepad, phone, iOS full screen), and LPC attack sheets and mage art.
- Decisions (all made by the build agent; no open questions remain):
  - Stomp defeats enemies, alongside the abilities. Decided: keep it.
  - Death and discard open the card selection. The chosen card leaves the hand and becomes the active character. The dead or discarded character is lost. An empty hand returns the Knight at the closest safe space.
  - Enemies and pickups persist across deaths. Only the player respawns.
  - Discard-card mode pauses the game. X or B cancels.
  - Q, or holding Down for 0.5 s, discards the current character. A quick Down tap or C opens discard-card mode.
  - A freed hand slot refills from the top of the deck.
  - Float is a hover. Hold Up to climb at 120 px/s for 1.2 s. Without Up, the fall slows. Decided because a float that cannot climb cannot open a ledge.
  - There is no game-over state. Deaths are unlimited, and the selection replaces a lives system.
  - Voluntary character swap: not added. Characters change only through death or discard (see above).
  - Enemy variety: a third enemy, the rat king (jumper), hops toward a nearby player. Drops a ranger card.
  - Power-up (gold pickup): draws two random cards, one into the hand or deck, then one more.
  - The mage keeps the Knight sprite as placeholder art until the robe layers are made.
  - Gate validation is a tile-level model (game/tools/validate_gates.py). Gate reach, by character:
    - Float alcove card (col 38, row 10): knight (charged jump), ranger (hop), mage (float). Basic moves cannot reach it.
    - Chasm pocket power-up (col 70, row 13): knight (charge), ranger (rope and drop), mage (blink). Basic moves cannot reach it.
    - Main route: every character reaches the exit.

## Opus review notes: findings and task list for executor agents (2026-10-29)

Written by a review pass for cheaper models to execute. Do the tasks in order. Each task is small. After every task, run the two checks below and do not move on until they match the expected result.

Checks:
- Rebuild: `python3 game/tools/build_single_html.py`
- Gates: `python3 game/tools/validate_gates.py` (expect exit 0)
- Suite: `NODE_PATH=$(npm root -g) node game/tests/suite.js` (expect "25 passed, 0 failed", about 5 to 8 minutes). Do not pipe it through `tail` if you need the exit code.

Status when reviewed (verified by running both commands on commit dc37a7a): suite 21 of 25 pass. Gates exit 1. The "25 of 25" note in Build status is out of date. The last content commit (19c1df6) skipped testing, and it broke four checks.

### Task 1: Fix the gate validator failure (small)
- Failure text: `card at col 22 row 12 is reachable with basic moves, so it is not gated`.
- Cause (verified): `validate_gates.py` treats every `c` and `p` in the level as a secret. The col 22 card was added on purpose as main-route content, so it is not meant to be gated.
- Fix: in `game/tools/validate_gates.py`, add a set near the top, for example `MAIN_ROUTE_PICKUPS = {(22, 12)}` as (col, row). Skip the gated check for pickups in that set, but still print them as "main route pickup, reachable by: ...". Update the docstring at the top of the file to say so.
- Done when: gates exits 0 and the suite check "gates: validate_gates.py exits 0" passes.

### Task 2: Fix the three playthrough failures (medium; diagnose first)
- Failure: `playthrough: keyboard bot reaches the exit as knight/ranger/mage` returns `{"ok":false,"mode":"play"}` after 90 s. The bot never reaches the flag.
- Unverified hypothesis: the archer added at row 13, col 56 stands two tiles before the exit flag (col 58). The bot only walks right and jumps at walls and gaps. It likely touches the archer or its arrow, dies, respawns behind it, and loops. The grunt at col 34 may also play a part.
- Diagnose step (do this before changing code): in the suite's playthrough check (`game/tests/suite.js`, around line 346), temporarily make the timeout result also return `x: Math.round(s.player.x / World.TILE)` and a death counter if one exists on the scene. Run only that check (comment out others locally, do not commit that). Record the column where the bot stalls.
- Fix options, pick the smallest that works and say which in the commit message:
  a. If the archer is the cause: move the archer so it is not on the last stretch before the flag (for example to col 50, `m` is at 52, so check spacing), or put it on a raised platform off the main path. Keep the "main level completable with any character" rule.
  b. If the bot is simply bad at enemies: make the bot jump when an enemy is within 2 tiles ahead (`Enemies.list()` gives positions). Stomps defeat enemies, so jumping onto them is valid play.
- Prefer option b if the stall is at an enemy, because it tests real play. Do not raise the 90 s timeout as the fix.
- Done when: all three playthrough checks pass.

### Task 3: Add tests for the untested archer (small)
- The archer (`game/src/enemies.js`, `archer` entry at about line 37) has no suite check. Copy the shape of the rat king check (`enemy: rat king hops toward a nearby player`) and add two checks:
  1. Archer fires an arrow when the player is level with it and within 200 px.
  2. An arrow hitting the player opens the death selection (scene `mode` becomes `select`).
- Update the expected count in this file from 25 to the new total.

### Task 4: Correct the docs in this file (small, text only)
- Build status says "Last run: 25 of 25 pass". Replace with the real result after Tasks 1 to 3.
- Phase 6 and Phase 8 lines name `test_playthrough.js`, `test_menus.js`, and `test_phase5.js`. Those files no longer exist. They were merged into `game/tests/suite.js`. Replace the names.
- "Open items for the next session" under Build status lists items that are now done (secret areas, gate tool, title, pause, credits). Remove the done ones.
- Gated secret note says the col 47 card is reachable by "mage float plus jump". The validator says only ranger reaches it. Change the note to "ranger only (per validate_gates.py)". Do not change the level unless the user asks for the mage to reach it.
- Phase 9 says "about 77 KB". Check with `ls -l game/changeling.html` and update.

### Task 5: Repo hygiene (small)
- `method_4_sourced_assets/__pycache__/build_walk.cpython-313.pyc` is committed even though `.gitignore` lists `__pycache__/`. Run `git rm --cached -r method_4_sourced_assets/__pycache__`.

### Task 6: Untested code paths (small each, optional)
Add one suite check each, copying the shape of nearby ability checks:
- Thrust (knight ability 4) defeats an enemy at reach range.
- Spell bolt (mage ability 1) defeats an enemy.
- Q discards the current character (Down-hold is tested, Q is not).
- One-way platform (`=`): the player can jump up through it from below and stand on it.

### Out of scope for executor agents (needs the user)
- Real-device checks (gamepad, phone, iOS full screen), other browsers, mage art, LPC attack animations, and sound. Do not start these without the user.

### Rules for executor agents
- Work on the current branch. Commit after each task with a clear message. Push with `git push -u origin <branch>`.
- Always rebuild `game/changeling.html` after editing `game/src/` and commit the rebuilt file in the same commit.
- Never mark a task done without running the checks. Write the real pass count into this file.
- If a fix needs a design change (moving level content, changing a rule in Decisions), stop and ask the user first.

## Opus review 2 of executor work (2026-10-29, commits a68c56c to 7774d33)

Verified by running the checks on commit 7774d33: rebuild produces no diff, `validate_gates.py` exits 0, suite 28 of 28 pass.

### Grades for the Opus review notes tasks
- Task 1 (gate validator): done well. `MAIN_ROUTE_PICKUPS` added, docstring updated, the output still lists the pickup.
- Task 2 (playthrough): fixed, but by a different route than planned. The bot now walks back left if it overshoots the flag, and the exit zone in `world.js` grows from 1 tile to 4 tiles tall (3 above the flag). That second part changes gameplay: a player who jumps over the flag now completes the level. It is a reasonable change, but it is a design change made without asking. The commit does not say what the diagnosis found. Kept as is; flagged for the user below.
- Task 3 (archer checks): done well. Both checks isolate the archer and assert no page errors. `Attacks.hostileCount()` was added as a small test hook.
- Task 4 (docs): mostly done. Two stale lines were left (the "Phases 7 to 9 are mostly open" line and "Not tested, per instruction" on the archer). Fixed in this review.
- Task 5 (pycache): done.
- Task 6 (untested paths): done. The executor added the platform check. Thrust, spell bolt, and Q discard already had checks (the ability table in `suite.js`, and the discard check), so my Task 6 was partly wrong. The executor should have recorded why it skipped them.
- Correction to my own notes: Task 6 called `=` a one-way platform. That was wrong. In `world.js`, `isSolid` treats `=` as a solid tile. The executor tested the rope platform (`World.addPlatform`), which is the real one-way surface, so the check is valid. The tile one-way path (`isOneWay`, used by `_`) has no check, and the level has no `_` tiles.

### Needs the user (do not do these without asking)
- Exit zone: keep the 4-tile-tall exit zone (jumping over the flag counts), or go back to the 1-tile zone and move the archer away from the flag? Current state: 4 tiles tall.
- The level is short (72 columns, about 16 s to finish). A second level, or a longer first level, is a design decision.

### Next tasks for executor agents
Same rules as the Opus review notes section: one task per commit, run the checks after each, write the real pass count here, push to `main`.

Task A: Tile one-way platform check (small)
- The only tile one-way path is `_` (`isOneWay` in `game/src/world.js`). The level has none. In a new check, set one tile to `_` above the floor at runtime (look at how `World.at` reads `tiles`; if there is no setter, add `setTile(tx, ty, ch)` to the returned object in `world.js` and rebuild). Then copy the shape of the platform check: jump up through it, assert the knight stands on it.

Task B: Record results (small, text only)
- Update the suite count in Build status (28 plus the new checks). Mark Task A done here with the real pass count.

Out of scope: anything in "Needs the user" above, real-device checks, art, sound.

## Open work checklist (next round)

Status key: [ ] not started, [~] in progress, [x] done. Hardware, other browsers, art, and sound are out of scope for this round.

- [x] Main level content: added a grunt (row 13, col 34), a card (row 12, col 22), and the archer (row 13, col 56) along the main route. Route geometry unchanged.
- [x] Gated secret: a card on a platform at row 10, cols 46 to 49 (card at row 8, col 47). Ranger hop from col 45 reaches it. `validate_gates.py` confirms the ranger is the only character that reaches it, and basic moves cannot.
- [x] Enemy type: archer (Sprite Foundry bone weaver sprite, MIT). Stands still, fires a hostile arrow when lined up within 200 px every 1.6 s. A hit opens the death selection. Tested by two suite checks.

## Build workflow (task list)

Status key: [ ] not started, [~] in progress, [x] done.

### Phase 0: Project setup
- [x] Create folder layout: `game/src/` (engine, input, world, scenes, main, style, index), `game/assets/` (sprites and tiles copied from method folders with licenses), `game/tools/build_single_html.py`. Cards and abilities modules come in Phases 3 and 4.
- [x] Write the build script. `python3 game/tools/build_single_html.py` inlines the CSS and JS in load order and embeds every asset as a base64 data URI into `game/changeling.html` (about 37 KB now).
- [~] Confirm the single HTML file loads offline. Verified in headless Chromium: no network, no console errors, scenes and assets load. Firefox, Safari, and Chrome on Android not yet tested.

### Phase 1: Engine and display
- [x] Canvas game loop with fixed-timestep updates (60 Hz step, render every frame, paused in portrait).
- [x] Landscape-only scaling. Letterboxed 480x270 logical canvas. Portrait shows the "rotate your device" overlay and pauses. Verified in headless Chromium.
- [~] Full screen toggle (Fullscreen API) with a fallback message when `document.fullscreenEnabled` is false. Implemented; not yet tested on a real device, including iOS Safari.
- [~] Input layer. Keyboard (arrows, A, S, Z, X, Q, C, Enter) verified in headless Chromium. Gamepad (d-pad, A, B, X, Y, Start, left stick) and on-screen touch buttons are implemented but not yet tested on hardware. Quick taps are latched so they are never lost between frames.
- [x] Input mapping test scene (the first screen). Lights each action while held and flashes on press. Enter or Start opens the play slice. Verified in headless Chromium.

### Phase 2: Movement and world
- [x] Tile map loader and collision (grounded, wall, one-way platform). Axis-separated AABB against the tile grid. One-way platform logic is implemented; not yet exercised by a test.
- [x] Player physics: walk, jump (Up), variable jump height (releasing Up cuts the arc). Verified in headless Chromium.
- [x] Camera follow with level bounds (eased follow, clamped to the level).
- [x] Tile render using DCSS tiles (walls, grass, dirt, trees). Two procedural parallax ridges at 0.25x and 0.5x camera speed. Drawn in code, not from method_5's Pillow render, so there is no asset dependency.

### Phase 3: Enemies and cards
- [x] Basic enemy AI: patrol with turns at walls and ledges, chase within sight, contact hurts the player, stun from shield bash.
- [x] Enemy defeat drops a card. Stomp, melee, and arrow hits defeat enemies. The card pickup falls with gravity and flies into the hand or deck when touched. Provisional: stomp works from Phase 3 until the abilities arrive.
- [x] Hand (3 slots) and deck (random order, count only). Verified: 3 fill, then the deck takes the rest at random positions; a freed slot refills from the top of the deck.
- [x] Hand HUD and deck count HUD.

### Phase 4: Characters and abilities
- [x] Character data format: `CHARACTERS` in `game/src/abilities.js` (sprite key, four ability ids).
- [~] Knight, Ranger, and Mage implemented with all four abilities each. All 12 abilities are coded. Verified in headless Chromium: slash, shield bash, charge, shoot, arrow anchor (stand on the rope), hop, blink, float. Thrust and spell bolt also have suite checks. Mage uses the Knight sprite as placeholder art.
- [ ] Ability effects use the LPC attack sheets for animation timing. Not done: abilities currently draw simple hitboxes and bolts.
- [ ] Verify each LPC layer for each character renders correctly. Not done: no mage art yet. The Ranger uses the Sprite Foundry 48px sprite, not LPC layers.
- [x] Character switch. Decided: characters change only through the selection after a death or discard. There is no voluntary swap key, so the design needs no extra input. The swapped-out character is lost, as in the death rule.

### Phase 5: Death, respawn, and discard
- [x] Death screen with 3 hand cards, left and right selection, confirm with Z or A. Verified in headless Chromium.
- [x] Respawn uses the closest safe space rule. Verified: 300 random death points, zero failures (standable, 2x3 clear, no enemy within 3 tiles).
- [x] Discard current character (Q, or hold Down 0.5 s). Verified in headless Chromium for both Down and Q. The discarded character goes to the selection screen.
- [x] Discard hand card (C or quick Down tap to open, Left and Right to highlight, C or Down to confirm, X or B to cancel). Verified in headless Chromium.

### Phase 6: Level content
- [x] Main level: completable with any character. `game/tests/suite.js` reaches the exit with knight, ranger, and mage. `validate_gates.py` checks basic, knight, ranger, and mage.
- [x] Secret areas gated by ability. Float alcove card (col 38, row 10) and chasm pocket power-up (col 70, row 13). Basic moves cannot reach either. See Decisions for reach by character.
- [x] Power-ups and card pickups placed in secret areas and in the main level. Card markers `c`, power-up markers `p`.
- [x] Gate validation tool. `game/tools/validate_gates.py`. Tile-level model, documented in its header.

### Phase 7: Screens and polish
- [x] Title screen, pause menu, and level complete. Verified by `game/tests/suite.js`. Game over is not used: deaths are unlimited (see Decisions).
- [x] Credits screen listing the LPC, DCSS, and Sprite Foundry licenses and authors.
- [ ] Sound is out of scope unless added later.

### Phase 8: Testing
- [x] Keyboard-only playthrough of the main level with each character. `game/tests/suite.js` playthrough checks pass for knight, ranger, and mage.
- [~] Gamepad-only playthrough. Simulated only (stubbed Gamepad API): d-pad moves, A triggers ability 3. Not tested on a real pad.
- [~] Mobile test in landscape. Simulated touch in phone-sized landscape: touch right moves, touch jump jumps. Portrait overlay shows. Not tested on a real phone.
- [x] Respawn test: 300 random death points checked, zero failures (`game/tests/suite.js`).
- [x] Gate validation passes. `game/tools/validate_gates.py` exits 0.

### Phase 9: Release
- [x] Final single HTML file under a size target. `game/changeling.html` is about 96 KB, well under 20 MB.
- [~] Upload to the repo under `game/`. Done. Link in `README.md` added.

---

## Earlier work: sprite generation tests


## Goal
Build the same four scenes with three methods, so future agents can compare them:

1. `pixel_dungeon`: Pixel art character in a dungeon
2. `pixel_field`: Pixel art character in a pixel art field with trees
3. `hq_dungeon`: High quality 2D character sprite in a high quality 2D art dungeon
4. `hq_field`: High quality 2D character sprite in a high quality 2D art field with trees

## Status summary

| Method | Folder | Status | Scenes produced |
|---|---|---|---|
| 1. Hugging Face hosted image models | `method_1_huggingface/` | Blocked (invoke disabled) | 0 of 4 |
| 2. SVG/code, rasterized with resvg | `method_2_svg_code/` | Complete | 4 of 4 |
| 3. Procedural raster with Pillow | `method_3_pillow/` | Complete | 4 of 4 |
| 4. Sourced pre-made assets (npm + GitHub) | `method_4_sourced_assets/` | Complete | 4 of 4 |

## Environment findings (read before retrying)
- Session shell egress allows PyPI and npm (`registry.npmjs.org`) and GitHub (for git). It does NOT allow `huggingface.co`, `kenney.nl`, or `opengameart.org`. Direct downloads from those hosts fail at the proxy with HTTP 403 or `connect_rejected`.
- Python 3.13 with Pillow 12.3 is preinstalled. Node v22 is available.
- The Hugging Face MCP connector's `dynamic_space` `invoke` operation returns: `disabled because gradio=none is set`. `view_parameters` and `discover` still work, and `hub_repo_search` works.
- To get premade assets, a user would need to download them from Kenney.nl, OpenGameArt, or itch.io and attach them to the chat. Files in `/mnt/user-data/uploads/` or the working tree can then be processed.

## Method 1: Hugging Face (blocked)
- Found candidate Spaces: `mcp-tools/Qwen-Image` (chosen), `mcp-tools/FLUX.1-Krea-dev` (rejected, photorealism-tuned), and `friedpierogi/pixel-art-sprite-generator` (1 like, untested).
- Prompts for all four scenes are saved in `method_1_huggingface/README.md`, with seeds and a retry procedure.
- No images were generated. Retried invoke after the first attempt; still blocked with the same `gradio=none` error. The connector setting must be changed outside this session before this method can run.

## Method 2: SVG/code (complete)
- **Tooling:** Node.js plus `@resvg/resvg-js@2`, installed from npm into `method_2_svg_code/`.
- **Script:** `method_2_svg_code/build_scenes.js`. Run with `node build_scenes.js` from that folder.
- **Process:**
  - Pixel scenes: a 64x64 cell grid rendered as SVG `<rect>` cells at 8px each. Brick walls and checker floor for the dungeon. Sky bands, dithered grass, and stepped round trees for the field.
  - Character: a 12x17 text-grid sprite with a palette map. The field version recolors the same sprite to a green cloak and brown hood.
  - HQ scenes: gradients, radial glows, and layered vector shapes for the knight (plate armor, shield, sword) and the adventurer (hooded cloak, backpack, staff).
- **Outputs:** `method_2_svg_code/output/*.png` (512x512) and matching `.svg` source files.
- **Quality notes:** Pixel scenes read clearly as pixel art. The HQ field is the strongest result. The HQ dungeon is clean but flat compared with painted art. Sprite details are simplified shapes, not hand-painted.

## Method 3: Pillow (complete)
- **Tooling:** Python 3 with Pillow (already installed; no new dependencies).
- **Script:** `method_3_pillow/build_scenes.py`. Run with `python3 build_scenes.py`.
- **Process:**
  - Pixel scenes: drawn on a 64x64 grid with `ImageDraw.point` and `rectangle`, then scaled to 512 with `Image.NEAREST`. Same layout logic as Method 2.
  - HQ scenes: drawn at 2x, using vertical gradients, Gaussian-blurred radial glows, and polygon/ellipse shapes, then downsampled with `Image.LANCZOS`.
- **Outputs:** `method_3_pillow/output/*.png` (512x512).
- **Quality notes:** Pixel scenes are equivalent to Method 2. The HQ knight is blocky and the HQ dungeon has less detail than Method 2. The HQ field is competent but simpler than Method 2's version.


## Method 4: Sourced pre-made assets (complete)
- **Reachable sources** (tested this session): PyPI, npm registry, GitHub (git clone and raw). Blocked: kenney.nl, opengameart.org, itch.io, huggingface.co, Wikimedia, Archive.org, jsDelivr, unpkg, GitHub search API.
- **Used:**
  - Sprite Foundry Fantasy Heroes HD and 48px (npm, MIT) for character sprites.
  - Dungeon Crawl Stone Soup tiles (sparse git clone of github.com/crawl/crawl, mostly CC0) for walls, floor, grass, and trees.
- **Not used:** Kenney Hex Pack and Space Kit (npm, CC0). Wrong genre for these scenes.
- **Script:** `method_4_sourced_assets/build_scenes.py`. Requires Pillow.
- **Outputs:** `method_4_sourced_assets/output/*.png` and `grid_2x2.png`.
- **License caveat:** DCSS tile licenses vary by piece. Per-tile credits must be checked before any commercial use. See `method_4_sourced_assets/README.md`.
- **Quality:** Best of the four methods. The HD characters are painted art, and the DCSS tiles are consistent.

## Premade assets (earlier attempt, superseded by Method 4)
- Attempted list: Kenney.nl (CC0), OpenGameArt.org (license varies per asset), itch.io, and Liberated Pixel Cup assets.
- None were downloaded. Kenney.nl and OpenGameArt are unreachable from this session's shell.
- Searched npm for CC0 pixel sprite packs. No suitable, verifiable package was found.
- Next step: a user downloads a pack (Kenney's Tiny Dungeon or Tiny Town, for example, both CC0) and attaches it. Then an agent can sort, slice, and combine the sprites.

## Recommended next steps for other agents
1. Enable Hugging Face `invoke` for this session and run the prompts in `method_1_huggingface/README.md`. Compare the output against Methods 2 and 3.
2. Attach a CC0 pixel pack (Kenney) for a fourth comparison row and to test sprite integration.
3. If higher-fidelity HQ art is required, a painted approach would need a hosted image model, so Method 1 is the path forward.

## Reproduce
```
# Method 2
cd method_2_svg_code && npm install && node build_scenes.js

# Method 3
cd method_3_pillow && python3 build_scenes.py
```
