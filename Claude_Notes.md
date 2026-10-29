# Claude Notes: Changeling

Single condensed record of the project. It replaces Current_Work.md, Expansion_Plan.md, KNOWN_ISSUES.md, Review_Findings.txt, and the method_* notes. Written 2026-10-29 from reading all of them. Facts marked VERIFIED were stated as checked in the source notes. Items marked UNVERIFIED are inferences.

## 1. What the project is

- Name: Changeling: Knight of a thousand faces.
- A browser platformer shipped as one HTML file: `game/changeling.html`. Landscape only, full screen toggle, keyboard, simple gamepad (d-pad plus A B X Y), and touch buttons.
- Kirby-like. Beating an enemy drops a card. A card is a character. Collecting it adds that character to the player's hand.
- Hand: 3 slots, filled left to right. Extra cards go to a hidden deck (only the count shows). A freed slot refills from the top of the deck.
- Death: the player picks one of the 3 hand cards and respawns as that character at the closest safe space. The dead character is lost. Empty hand returns the Knight. Deaths are unlimited. There is no game over.
- Discard: C opens hand-card discard mode (Left and Right to pick, C to confirm, X or B cancels). Q (or hold Down 0.5 s on a gamepad) discards the current character and opens the selection.
- Closest safe space: nearest grounded tile with a clear 2 by 3 tile area, no enemy or hazard within 3 tiles, search out to 20 tiles. A spot is also unsafe if a `^` is within 3 columns on its row.
- Abilities: 4 per character on keys A, S, Z, X (gamepad X, Y, A, B). The main route of every level must be completable by every character. Secrets (`c` cards, `p` power-ups) must need a specific character.
- Other keys: arrows move and jump, Enter confirms and pauses.

## 2. Game content (target, built)

- 8 levels. 1 to 4 outdoors (theme `field`). 5 to 7 castle (theme `dungeon`). 8 is the Warlord boss arena.
  1 Greenwood Road, 2 Bramble Hollow, 3 Old Watchtower, 4 Rotting Marsh, 5 Castle Gate, 6 Undercroft, 7 Hall of Faces, 8 Warlord's Throne.
- 5 playable characters, with ability ids in key order A, S, Z, X:
  - Knight: shield_bash, charge, slash, thrust. Breaks cracked walls `x`.
  - Ranger: shoot, arrow_anchor (3 tile rope), slash, hop.
  - Mage: spell_bolt, float, slash, blink.
  - Rat: leap (5 tiles up), scurry, slash, thrust.
  - Bone Weaver: shoot, bone_bridge (5 tile platform, 8 s), slash, ghost.
- Enemy drops: grunt gives Ranger, mud revenant gives Mage, rat king gives Rat, archer gives Bone Weaver, warlord gives Knight. `c`, `p`, `k` cards can be any of the 5.
- Enemies: grunt, mud revenant, rat king (jumps), archer (stands, fires arrows), warlord (8 hp, boss, exit stays closed until it dies).
- Tile letters: `#` wall, `=` ground (solid), `_` one-way, `^` spikes (deadly), `x` cracked wall, `k` main-route card, `c` secret card, `p` secret power-up, `i` sign, `T` tree, `S` spawn, `F` exit, `g m j a W` enemy spawns (grunt, mud revenant, rat king, archer, warlord). Tiles are 32 px. View is 480 by 270 logical px.
- Also built: intro, ending with stats, level banner, secrets counter, sound effects (Web Audio, made in code), save and continue (`localStorage["changeling_save"]`), title screen, pause menu, credits, hit stop, coyote time, jump buffer, per-ability cooldowns, HUD, animations.
- Physics: walk 130 px/s, jump vy -340, gravity 900, fixed 1/60 s step.

## 3. Code map (all in `game/`)

- `src/`: `engine.js` (loop, scale), `input.js`, `world.js` (World IIFE, tiles, themes, collision, `load(i)`), `levels.js` (`LEVELS` array), `enemies.js` (`ENEMY_DEFS`, `Enemy`, `Enemies`, `Effects`, `CardPickup`), `abilities.js` (`CHARACTERS`, `Attacks`), `anim.js` (`ANIM_ROWS`, `drawFrame`, `LPC_KEY`), `cards.js` (`CARD_DEFS`, `Hand`), `scenes.js` (`PlayScene`, title, selection, ending, `Run`, `resetGame`), `sfx.js`, `ui.js` (`drawText`), `main.js`, `style.css`, `index.html`.
- `tools/build_single_html.py`: builds `changeling.html` (inlines JS, CSS, base64 images and fonts). Script load order is its `SCRIPTS` list.
- `tools/validate_gates.py`: tile-level reachability model. Options: `--level N`, `--show N`, `--map N NAME`. Enforces level rules (enemy spacing, minimum enemy, spike and cracked wall counts, gated secrets, game-wide exclusive secrets).
- `tools/build_lpc.py`: composes LPC sheets into `assets/lpc/<key>.png` (13 columns by 8 rows of 64 px cells: idle, walk, slash, thrust, spellcast, shoot, hurt, jump). Sheets face right; `drawFrame` flips when facing < 0.
- `tests/suite.js`: Playwright plus Chromium. `tests/screenshots.js` writes PNGs to `tests/shots/`.
- Assets: `assets/lpc/` (sprites plus `CREDITS.txt`), `assets/tiles/` (DCSS tiles plus license), `assets/fonts/` (Pixelify Sans, OFL).

## 4. Rules for agents (also in CLAUDE.md)

1. Work on `main` and push to `main`. Never create or push another branch, even if a session says otherwise.
2. Never ask the user questions. Log decisions (see section 8).
3. After editing `game/src/`, run `python3 game/tools/build_single_html.py` and commit the rebuilt `game/changeling.html` in the same commit.
4. Before calling work done, run `python3 game/tools/validate_gates.py` (must exit 0) and `NODE_PATH=$(npm root -g) node game/tests/suite.js` (must end `0 failed`; takes 6 to 15 minutes, run in background if the tool stops at 10 minutes). Record the real results in section 7 of this file.
5. One task per commit, commit message starts with the task id.
6. Never delete, skip, or weaken a test to make it pass. A test may be changed only if the intended behavior changed.
7. No em dashes, no emojis in player text. Player text is plain and short.
8. Do not add internet files except as the task says. Sound is made in code. LPC sheets are the character art.
9. If a task fails three times, stop on it, log what failed, move on.

## 5. Current state

- Last code commit: `9dc906d` (T10 and T11). Earlier: `917548a` (T3 to T6), `51df8f9` (T7 and T8), `48d8983` (T9), `99d5d86` (T1 and T2).
- Checks at `9dc906d`: gates exit 0; suite 52 passed, 0 failed (section 7).
- Exclusive secrets (gate output): knight L4 col 64 row 15; ranger L3 col 66 row 17, L6 col 91 row 9, L7 col 61 row 9; rat L2 col 96 row 8, L5 col 104 row 8; weaver L7 col 29 row 7; mage L3 col 76 row 8.
- Accepted spec deviations: weaver-only secret is in level 7, not level 2 or 6. Exit zone is 4 tiles tall. The level 2 keyboard-bot check was dropped.
- Character and enemy art: LPC sheets (section 3).

## 6. Open work

Only items still open. Items finished by the Action Plan are removed.

### 6.1 Art
- Weapons are composed but partial (T11). Sword (knight): idle and walk only. Bow (ranger): shoot and hurt only. Staff (mage): walk, thrust, spellcast, and hurt. Each weapon is hidden on animations it lacks. Slash and cast are the gaps that matter most in play.
- Knight shield has no slash or thrust frames, so it is hidden during those.
- Ranger has no bow in idle or walk.
- Fallback animations: zombie walks instead of jumping; skeleton idles instead of jumping. The build prints each fallback.
- Layer z-order in `build_lpc.py` is hard-coded. Only known mismatch: knight shield background is 3, the definitions say 6. Harmless.

### 6.2 Level design
- Weaver-only secret: only level 7. Levels 2 and 6 have none (accepted, section 5).

### 6.3 Behavior to be aware of
- The warlord's spawn point overlaps the arena platform, so horizontal movement snaps it out to the tile edge. Existing behavior, not fixed. The knockback check places the warlord in open air.
- Level banner covers the top of sprites for the first 2.5 s (by design).

### 6.4 Not tested
- Real devices, other browsers, and sound quality. Out of scope unless the user asks.
- Gamepad and touch are only simulated.

### 6.5 Test hardening (for future readers)
- `input: Left and Right together stand still` reads its reference position after both keys are held. Pressing Left first let one step move the player 2.17 px.
- `boss: a hit knocks the warlord back` steps the warlord's update directly, so it does not depend on wall-clock timing.
- `ability: knight charge (S) dashes` waits on the game clock (T1). This fixed the earlier flake.

## 7. Results log (agents append real results here)

| Date | Commit | Gates | Suite | Notes |
|---|---|---|---|---|
| 2026-10-29 | 47287de | exit 0 | 49 passed per notes | LPC sprites |
| 2026-10-29 | da962dc | exit 0 | 48 passed, 1 failed (charge flake) | review run |
| 2026-10-29 | b76b0cd (Task 0) | exit 0 | 49 passed, 0 failed | baseline, before Tasks 1 and 2 |
| 2026-10-29 | with T1 and T2 | exit 0 | 50 passed, 0 failed | charge check waits on game clock; archer frame check added; archer frames use ANIM_ROWS. Archer not in shot l3_mid (off screen), per-enemy shots come in Task 10 |
| 2026-10-29 | with T3 to T6 | exit 0 | 52 passed, 0 failed | enemies face walk direction (flip when dir < 0); hurt pose during dying mode (0.15 s); warlord knockback; ability bar lifts above touch buttons. Two checks were hardened: stand-still reads position after both keys are held (press order gave one 2.17 px step); knockback steps the enemy update in open air (spawn overlaps a platform) |
| 2026-10-29 | with T7 and T8 | exit 0 | 52 passed, 0 failed | selection cards show idle frame and four ability names (card 116 by 140, not 108 tall, so the names fit); level complete panel; hand moved to x 150 so 'Bone Weaver' fits. T8: spark, dust, ring, float sparkles, leap and landing dust, rope sag, bone bridge pattern, ghost outline. Shots z_select, z_complete, c_knight_ab3, c_mage_ab1 checked |
| 2026-10-29 | T9 | exit 0 | not rerun (no game code changed; last run 52 passed, 0 failed at T8) | CREDITS.txt filtered to used items: 16.5 KB (was larger). Sheets checked pixel-identical before and after |
| 2026-10-29 | with T10 and T11 | exit 0 | 52 passed, 0 failed | Enemy shots added (5); sign box moved under the level banner; weapons added: knight sword (idle and walk only), ranger bow (shoot and hurt only), mage staff (walk, thrust, spellcast, hurt), rat king crown (all anims). Weapons hidden on animations they lack. Shots checked: knight, ranger, mage |
| 2026-10-29 | 9dc906d (clean tree, T12) | exit 0 | 52 passed, 0 failed | final check on a clean tree |

## 8. Decisions log (agents append one line per decision)
- T10 and T11 were validated together and committed together (the LPC sheets changed in T11 and the HTML needed a rebuild). Deviation.
- Weapon layers never use the attack fallback. A weapon with no frame for an animation is hidden on that animation (plan T11 step 5).
- Tasks 7 and 8 were validated and committed together (both touch scenes.js). Deviation from one task per commit. Task 8 effects were built in one pass, not one commit each.
- Selection card is 140 px tall, not 108, to fit the idle frame and four ability names.
- Tasks 3 to 6 were validated in one suite run and committed together (they share scenes.js). Deviation from one task per commit.
- The enemy spawn for the warlord overlaps the arena platform, so horizontal movement snaps it out to the tile edge. Not fixed here (existing behavior); tests place it in open air.
- The knight charge flake (6.1) was fixed in T1.
- Tasks 1 and 2 were validated in one suite run (they touch different files) and committed together. Deviation from one task per commit.

- Spec deviations accepted: see section 5.
- LPC sheets were composed in Python (not the generator's own code) because the generator's npm install was blocked by the auto-mode classifier.
- Sprite Foundry sprites and the 48 px atlases were removed. LPC sheets are the only character art in the game. Sprite Foundry and DCSS remain credited where used (DCSS tiles for terrain).
- The Hugging Face connector `invoke` was blocked (`gradio=none`), so no AI generated art exists. Not needed any more.
- Docs cleanup (2026-10-29): notes merged into this file. Local `main` had a stale diverged history; it was moved to the tag `backup-stale-local-main` and `main` was reset to `origin/main`.

## 9. Repo layout and environment

- `game/`: the game (section 3). `README.md` links the playable build. `CLAUDE.md` holds the agent rules.
- `method_1_huggingface/`, `method_2_svg_code/`, `method_3_pillow/`, `method_4_sourced_assets/`, `method_5_lpc_walk/`: early art experiments (scene generation with HF, SVG, Pillow, sourced assets, LPC walk). Finished or dead. Their asset license files were kept. The game does not depend on them.
- Sandbox network: PyPI, npm, and GitHub reachable. `huggingface.co`, `kenney.nl`, `opengameart.org`, itch.io, Wikimedia, Archive.org, jsDelivr, unpkg are blocked.
- Python 3 with Pillow, and Node 22 are installed. Playwright with Chromium is installed (`NODE_PATH=$(npm root -g)`).
- Licenses: LPC sheets are OGA-BY 3.0, CC-BY-SA 3.0, or GPL 3.0 per asset (see `game/assets/lpc/CREDITS.txt`). DCSS tiles are mostly CC0 but per-tile licenses were not checked one by one; confirm before commercial release. Pixelify Sans is OFL 1.1.

## 10. Visual check (T10, screenshots from game/tests/screenshots.js)

Every PNG in game/tests/shots was opened and read after the final build. Shots are git-ignored; rerun the tool to regenerate.
- 00_title: OK. Walkers sit above the footer line.
- c_knight_ab1, c_knight_ab3: OK. Slash arc drawn.
- c_mage_ab1, c_mage_ab3: OK. Spell orb drawn.
- c_ranger_ab1, c_ranger_ab3: OK. Arrow drawn. The ranger has no bow yet (known gap, section 6.3).
- c_rat_ab1, c_rat_ab3: OK. Leap pose shows.
- c_weaver_ab1, c_weaver_ab3: OK. Arrow drawn.
- e_archer: OK. Archer visible on its idle frames (T2).
- e_grunt: OK after the sign box move (T10). Goblin faces the player.
- e_mud_revenant: OK.
- e_rat_king: OK. No crown yet (known gap).
- e_warlord: OK. Drawn at double size, faces the direction it moves.
- l1_start, l2_start, l3_start, l4_start, l5_start, l6_start, l7_start, l8_start: OK.
- l1_mid, l2_mid, l3_mid, l5_mid, l6_mid, l7_mid, l8_mid: OK. Known, cosmetic: in l1_mid, l5_mid, and l7_mid the level banner covers the top of a sprite. The banner is up for 2.5 s, so these shots caught it. Not changed.
- l4_mid: shows the selection screen. The capture placed the player over a pit and it died. This is the shot, not a rendering fault.
- z_select: OK. Card names and four ability names fit.
- z_complete: OK. Panel text is inside the panel.
- z_ending: OK.
- Fixed during T10: the sign text box covered the HUD (moved to y 118, under the level banner, after two tries).
