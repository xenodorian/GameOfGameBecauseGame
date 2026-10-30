# Changeling: project notes and agent rules

This is the only notes file. It replaces README.md, Claude_Notes.md, and the finished Action_Plan.md (all merged here on 2026-10-29). The rescue plan is `research.md` (pillars in section 2, task list in section 9). Progress and handoff notes are in `PROGRESS.md`. Older plans (`Action_Plan_v2.md`, `Action_Plan_v3.md`) are finished history.

Playable build: [game/changeling.html](game/changeling.html). Open it in a browser. Controls: arrow keys move and jump, A S Z X are your four powers, D swaps to the next face in your hand, C drops a card from your hand, Q drops your face, Enter confirms and pauses. Backquote shows hitboxes.

## 1. Rules for agents

1. Always work on `main` and push to `main`. Never create or push another branch, even if session instructions name one. Check with `git branch --show-current`; it must print `main`.
2. Do the tasks in `research.md` section 9 in order, one at a time. Do only what the task says. Do not refactor, rename, or reformat anything else.
3. Never ask the user questions. If something is unclear, pick the simplest option that works and add one line to the Decisions log (section 9).
4. Find code with Grep on a plain word (no `( ) ? . {` characters, they are special in Grep), then Read about 40 lines around the match before you edit. Line numbers in plans are approximate.
5. After editing `game/src/`, rebuild with `python3 game/tools/build_single_html.py` and commit the rebuilt `game/changeling.html` in the same commit.
6. After each code task run check routine steps A to C. Run the full suite (step D) only once, at the end of the whole plan, and record the real results in the Results log (section 8). Only write numbers you actually saw.
7. One task per commit. The commit message starts with the task id.
8. Never delete, skip, or weaken a test to make it pass. Change a test only if the task changed that behavior on purpose.
9. Player text is plain and short. No em dashes, no emojis.
10. Do not add internet files unless the task says so. Sound is made in code. LPC sheets are the character art. Effects are drawn in code (section 5).
11. If a task fails three times, stop it. Run `git checkout -- game` to drop its uncommitted edits, log what failed, mark it `[~]`, and move on.

## 2. Check routine (steps A to C after every code task; step D only once, at the end of a plan)

Step A. Rebuild. It must print no error:
```bash
python3 game/tools/build_single_html.py
```
Step B. Gates. Look for `exit=0`:
```bash
python3 game/tools/validate_gates.py; echo "exit=$?"
```
Step C. Syntax check each JS file you edited (change the name):
```bash
node --check game/src/abilities.js
```
Step D. Full suite. It takes 6 to 15 minutes. Run it with `run_in_background: true` on the Bash tool, then read the end of the file when it finishes:
```bash
NODE_PATH=$(npm root -g) node game/tests/suite.js > /tmp/suite_out.txt 2>&1; echo "exit=$?" >> /tmp/suite_out.txt
```
Pass means the last lines show `0 failed` and `exit=0`. Do not pipe the suite through `tail` or `grep` while it runs.

Visual tasks also run the screenshot tool and open PNGs with the Read tool:
```bash
NODE_PATH=$(npm root -g) node game/tests/screenshots.js
```
Shots land in `game/tests/shots/` (git-ignored).

Commit and push:
```bash
git add -A game CLAUDE.md research.md PROGRESS.md
git commit -m "V1: short description"
git push origin main
```
On a network error retry after 2 s, 4 s, 8 s, 16 s. If rejected because `main` moved: `git pull --rebase origin main`, then push again.

## 3. What the game is

- Changeling: Knight of a thousand faces. A browser platformer shipped as one HTML file. Landscape only, full screen toggle, keyboard, simple gamepad (d-pad plus A B X Y), touch buttons.
- Kirby-like. Beating an enemy drops a card. A card is a character. Collecting it adds that character to the hand.
- Hand: 3 slots, filled left to right. Extra cards go to a hidden deck (only the count shows). A freed slot refills from the top of the deck.
- Death: the player picks one of the 3 hand cards and respawns as that character at the closest safe space. The dead character is lost. Empty hand returns the Knight. Deaths are unlimited. No game over.
- Face swap (C5): D (gamepad LB or Select, touch D) makes the leftmost hand card the active face; the old face goes to the back of the hand, so repeated presses cycle every face held. HP carries over, cooldowns reset, 2 s cooldown, 0.3 s safety. HUD badge right of the deck; a 'D: swap face' hint shows until the first swap (`PlayScene.swapUsed`, not saved).
- Discard: C opens hand-card discard mode (Left and Right pick, C confirms, X or B cancels). Q (or hold Down 0.5 s on a gamepad) discards the current character and opens the selection.
- Closest safe space: nearest grounded tile with a clear 2 by 3 tile area, no enemy or hazard within 3 tiles, search out to 20 tiles. A spot is unsafe if a `^` is within 3 columns on its row.
- Face badges (L2): a level's optional `hints: [{ col, row, face }]` draws a bobbing face card over the secret at that tile (it follows the live pickup, which falls) until it is taken; gold glow while you wear that face. Pick hint spots from `validate_gates.py --level N` (secrets reachable by one face).
- Abilities: 4 per character on A, S, Z, X (gamepad X, Y, A, B). Every character must be able to finish the main route of every level. Secrets (`c` cards, `p` power-ups) need a specific character.
- 8 levels. 1 to 4 outdoors (theme `field`), 5 to 7 castle (theme `dungeon`), 8 the Warlord arena: 1 Greenwood Road, 2 Bramble Hollow, 3 Old Watchtower, 4 Rotting Marsh, 5 Castle Gate, 6 Undercroft, 7 Hall of Faces, 8 Warlord's Throne.
- Characters and ability ids (A, S, Z, X):
  - Knight: shield_bash, charge, slash, thrust. Breaks cracked walls `x`.
  - Ranger: shoot, arrow_anchor (3 tile rope), volley (3 arrows fanned up-forward, 1 s cooldown), hop.
  - Mage: spell_bolt (shown as "Beam", see section 5), float, nova (ring burst, radius 40 px, pushes survivors, 1.2 s cooldown), blink.
  - Rat: leap (5 tiles up), scurry, gnaw (3 bites in 0.3 s, 16 px reach, each bite ignores hit flash), thrust.
  - Bone Weaver: shoot, bone_bridge (5 tile platform, 8 s), bone_toss (arcing bone, vx 160, vy -260, gravity 900, 0.6 s cooldown; hits below ledges and behind low walls), ghost.
- Drops: grunt gives Ranger, mud revenant Mage, rat king Rat, archer Bone Weaver, warlord Knight. `c`, `p`, `k` cards can be any of the 5.
- Enemies (Round 4 tells; every tell blinks the sprite warm white): grunt winds up 0.4 s (crouch, growl) within 64 px on its row, lunges 0.2 s at 240 px/s, then stands 0.5 s (punish window), 1.2 s between lunges. Rat king crouches 0.3 s before each hop. Archer (and warlord) shows the shoot pose and a growing red dotted aim line for 0.4 s before each arrow. Mud revenant stops and bubbles 0.5 s, then lobs a mud blob (vy -260, gravity 700) timed to land on the player, first lob 1.2 s after it sees you, then every 3 s. Warlord (E5, `updateBoss`, numbers in `ENEMY_DEFS.warlord.boss`): 8 hp, three phases by hp. Phase 1 (8 to 6): walks, shoots arrows at range (aim tell), and inside 70 px raises its sword 0.5 s (blink) then swings an ember arc (hostile 'swing' box, 56 px) and recovers 0.55 s. Phase 2 (5 to 3) adds a 0.6 s stamp then a 270 px/s charge that stuns it 1.4 s at the arena edge (punish window). Phase 3 (2 to 1) adds a jump slam with floor shockwaves both ways (jump over them); tells shorten to 0.35 to 0.4 s. Each phase change: 0.6 s roar, flash, shake. Final blow: 0.4 s freeze, big flash, 0.5 s slow motion (`slowT`, dt x 0.3). The exit stays shut until it dies.
- Tiles: `#` wall, `=` ground, `_` one-way, `^` spikes, `x` cracked wall, `k` main-route card, `c` secret card, `p` secret power-up, `i` sign, `T` tree, `S` spawn, `F` exit, `g m j a W` enemy spawns. Tiles are 32 px. View is 480 by 270 logical px.
- V1 and V5: HP shows as 5 pixel hearts (2 HP each, half hearts), shaking for 0.3 s after a hit. Every scene change fades in from black over 0.3 s (`Engine.setScene`). The intro is a title card: dusk sky, the warlord's black silhouette on a throne with a red backlight, the five stolen faces orbiting as cards, lines fading in.
- Also built: intro, ending with stats, level banner, secrets counter, Web Audio sound made in code, save and continue (`localStorage["changeling_save"]`), title, pause menu, credits, hit stop, coyote time, jump buffer, cooldowns, HUD, animations.
- Physics (F1, all numbers in `game/src/tuning.js`): run 140 px/s with accel 1600 and decel 2000 (air 1100 and 600), jump vy -350, rise gravity 900, fall gravity 1400, half gravity at the apex while Up is held, release cut 0.45, fall cap 420, coyote 0.1 s, buffer 0.12 s. Jump apex about 66 to 70 px. Corner correction 4 px (F2). Camera looks ahead 40 px and holds still vertically through jumps (F3). Fixed 1/60 s step.
- Debug: backquote toggles hitbox outlines (F0).

## 4. Code map (all in `game/`)

- `src/`: `engine.js` (loop, scale), `tuning.js` (`TUNING`: movement, jump, corner, camera numbers), `input.js`, `world.js` (tiles, themes, collision, `load(i)`), `levels.js` (`LEVELS`), `cards.js` (`CARD_DEFS`, `Hand`), `glow.js` (`Glow`, banded effects, section 5), `enemies.js` (`ENEMY_DEFS`, `Enemy`, `Enemies`, `Effects`, `CardPickup`), `abilities.js` (`CHARACTERS`, `Attacks`, mage beam), `anim.js` (`ANIM_ROWS`, `drawFrame`, `LPC_KEY`), `scenes.js` (`PlayScene`, title, selection, ending, `Run`, `resetGame`), `sfx.js`, `ui.js`, `main.js`, `style.css`, `index.html`.
- `tools/build_single_html.py`: builds `changeling.html` (inlines JS, CSS, base64 images and fonts). Script load order is its `SCRIPTS` list. A new JS file must be added there.
- `tools/validate_gates.py`: tile-level reachability model. Options `--level N`, `--show N`, `--map N NAME`. Enforces level rules (enemy spacing, minimum enemy, spike and cracked wall counts, gated secrets, game-wide exclusive secrets).
- `tools/build_lpc.py`: composes LPC sheets into `assets/lpc/<key>.png` (13 columns by 8 rows of 64 px: idle, walk, slash, thrust, spellcast, shoot, hurt, jump). Sheets face right; `drawFrame` flips when facing < 0.
- `tests/suite.js`: Playwright plus Chromium (`SUITE_ONLY=regex` runs a subset). `tests/screenshots.js` writes PNGs to `tests/shots/`. `tests/playtest.js [outDir]`: 20 s real-key smoke test (apex, beam kill, all 20 abilities, console errors) with shots. `tests/capture_gif.js <kill|beam|jump|hurt> [outDir]`: GIF plus 12-frame strip of a scripted moment (needs ffmpeg).
- Assets: `assets/lpc/` (sprites plus `CREDITS.txt`), `assets/tiles/` (DCSS tiles plus license), `assets/fonts/` (Pixelify Sans, OFL).
- Other folders: `method_1_huggingface/` to `method_5_lpc_walk/` are early art experiments. Finished or dead. The game does not use them. Do not edit them.

## 5. Effects system (added 2026-10-29)

Reverse engineered from a user-supplied wizard beam pixel animation (procedural Python, Pillow plus numpy). The original is in `reference/wizard_beam_pixel_art.zip` (PROCESS.txt explains the method; src/render.py is the renderer). Its key ideas, now in the game:

- Energy bands. Each effect is a smooth energy value cut into flat colour bands by thresholds 0.92, 0.80, 0.66, 0.50, 0.30 (white core, pale, mid, deep), plus a faint halo below 0.30. Beam profile: `1.08 * (1 - (d / (w + 2.5)) ^ 1.6)`. `Glow.bandWidths(w)` returns the distance of each band from the axis.
- Ramps in `Glow.RAMPS`, 5 colours core to edge: `arcane` (violet, mage), `steel` (blue white, blades and bows), `ember` (warm, hits; warm against cold, like the torch in the source), `bone` (pale green, unused so far).
- Lightning: midpoint displacement, 1 px core plus 1 px glow cross, redrawn each step (`Glow.bolt`).
- Flares: four-ray star that turns 45 degrees every other frame (`Glow.star`); banded disc (`Glow.disc`).
- Lighting: `Glow.light` draws three dithered rings (4 by 4 Bayer pattern) with additive blending.
- Random jitter uses a seed picked in update (`Glow.rng`), so draw stays read-only.
- Timing: short charge, fast fire, held sustain, broken-up fade with motes. 1 px shake and a brief white flash on fire.

Where it is used:
- Mage `spell_bolt` is now a beam (`abilities.js`, `BEAM` constants): 0.1 s charge with motes spiralling into the staff tip, the head grows at 1400 px/s up to 224 px or the first wall, sustained to 0.42 s, then 0.14 s fade. It hits every enemy along it once (pierces). Cooldown 0.5 s. Per column: separate upper and lower widths with jitter, two sine wobbles, a travelling pulse, taper at the staff. Impact disc and rays at a wall. Sound `beam`.
- Slash: banded smear crescent plus a glint on the leading tip. Thrust: banded streak plus tip glint. Shield bash: banded half ring plus light.
- Arrows (ranger, weaver): release flare (`Effects.flare`).
- F4 hit feedback: a kill freezes 0.08 s (plain hit 0.05 s) with a 2 px shake; the defeated enemy tumbles away as its hurt frame (white for 0.07 s) and fades over 0.45 s (`Effects.corpse`). A surviving enemy draws pure white for the first 0.1 s of a hit. Player hurt: 0.06 s freeze, 2 px shake, red stepped screen edges for 0.3 s (`Effects.hurt`).
- Every hit (`Effects.spark(x, y, dir, ramp)`): banded flash, jagged rays, hot bits with 1 px trails thrown back toward the attacker (`Effects.spray`), light pool, 1 px shake for 0.06 s.
- `Effects.shake(t, amp)` replaces setting `shakeT` directly (warlord hit uses 3 px). `Effects.flash(t)` draws a light white screen flash.
- Blink rings cast a light pool. The `hit` sound has a low thud under it.
- Source file guide (not in repo): frame timing hold on wind-up, 2 to 4 frame swing, one smear frame, flash on fire, 1 to 2 px shake. View a contact sheet plus one or two crops, not every frame.

## 6. Current state

- Last finished plan: `Action_Plan.md` T0 to T12, all done (history in section 7). Effects pass done after it (section 5).
- Exclusive secrets (gate output): knight L4 col 64 row 15; ranger L3 col 66 row 17, L6 col 91 row 9, L7 col 61 row 9; rat L2 col 96 row 8, L5 col 104 row 8; weaver L7 col 29 row 7; mage L3 col 76 row 8.
- Accepted spec deviations: weaver-only secret is in level 7, not levels 2 or 6. Exit zone is 4 tiles tall. The level 2 keyboard-bot check was dropped.

Open work:
- Art: knight sword on all rows except spellcast and shoot. Bows (ranger, weaver, archer) on idle, walk, jump, shoot, hurt. Staff (mage): walk, thrust, spellcast, hurt; still hidden on slash and shoot (no LPC frames). Knight shield hides on slash and thrust. Zombie walks instead of jumping; skeleton idles instead of jumping. Layer z-order in `build_lpc.py` is hard-coded (knight shield background 3, definitions say 6; harmless).
- Behavior: the warlord spawn overlaps the arena platform, so horizontal movement snaps it to the tile edge (not fixed; tests place it in open air). The level banner covers the top of sprites for the first 2.5 s (by design).
- Not tested: real devices, other browsers, sound quality. Gamepad and touch are only simulated.
- Test notes: `input: Left and Right together stand still` reads its reference position after both keys are held. `boss: a hit knocks the warlord back` steps the warlord update directly. `ability: knight charge (S) dashes` waits on the game clock.

## 7. History

- Early: art experiments in `method_*` folders; Sprite Foundry sprites and 48 px atlases removed; LPC sheets became the only character art (composed in Python because the generator's npm install was blocked). Hugging Face `invoke` was blocked (`gradio=none`), so no AI art exists.
- Action_Plan.md (all done): T0 baseline. T1 fixed the flaky charge test. T2 archer idle and walk frame counts (it was invisible). T3 enemies face walk direction. T4 hurt pose before death selection. T5 warlord knockback. T6 ability bar above touch buttons. T7 selection and level complete screens redesigned. T8 spark, dust, ring, float sparkles, leap and landing dust, rope sag, bone bridge pattern, ghost outline. T9 credits list only used assets. T10 visual pass, enemy shots, sign box under the banner. T11 LPC sword, bow, staff, rat king crown. T12 close out.
- Docs cleanup 1 (2026-10-29): notes merged into Claude_Notes.md; stale local `main` moved to tag `backup-stale-local-main`.
- Docs cleanup 2 (2026-10-29): README.md, Claude_Notes.md, Action_Plan.md merged into this file. New plan `Action_Plan_v2.md`.

## 8. Results log (append real results)

| Date | Commit | Gates | Suite | Notes |
|---|---|---|---|---|
| 2026-10-29 | 47287de | exit 0 | 49 passed per notes | LPC sprites |
| 2026-10-29 | da962dc | exit 0 | 48 passed, 1 failed (charge flake) | review run |
| 2026-10-29 | b76b0cd (T0) | exit 0 | 49 passed, 0 failed | baseline |
| 2026-10-29 | T1 and T2 | exit 0 | 50 passed, 0 failed | charge waits on game clock; archer frame check added |
| 2026-10-29 | T3 to T6 | exit 0 | 52 passed, 0 failed | two checks hardened (stand-still, knockback) |
| 2026-10-29 | T7 and T8 | exit 0 | 52 passed, 0 failed | selection card 116 by 140; hand at x 150 |
| 2026-10-29 | T9 | exit 0 | not rerun (no game code) | CREDITS.txt 16.5 KB; sheets pixel-identical |
| 2026-10-29 | T10 and T11 | exit 0 | 52 passed, 0 failed | enemy shots; weapons partial |
| 2026-10-29 | 9dc906d (T12) | exit 0 | 52 passed, 0 failed | clean tree |
| 2026-10-29 | 427aced (V7, Action Plan v2) | exit 0 | 53 passed, 0 failed | stomp check fixed (V0); beam test added (V1). Run once. |
| 2026-10-29 | effects pass | exit 0 | 51 passed, 1 failed | mage beam, banded slash, thrust, bash, hits, flares, shake, flash. Screenshots checked: beam charge, sustain, fade; knight slash, thrust, bash; ranger shot. No page errors. Failed: `stomp defeats a grunt...; side contact respawns safely` (mode was play, not select, after the side contact). Not investigated or rerun: the user stopped test runs. UNVERIFIED cause: wall-clock waits in that check vs heavier effect drawing |
| 2026-10-29 | X1 to X10 (Action Plan v3) | exit 0 | 51 passed, 2 failed | stomp side-contact timeout (also failed in effects pass); ranger hop vy -195 (timing). Not rerun. |
| 2026-10-29 | 17dc508 (feedback pass, bridges) | exit 0 | 53 passed, 0 failed | full suite run on the committed build |

## 9. Decisions log (append one line per decision)

- Effects pass: mage `spell_bolt` id kept (tests and saves use it); label changed to "Beam". Beam pierces enemies, range 224 px (the old bolt flew about 360 px but hit one enemy). Cooldown 0.3 to 0.5 s so only one beam exists.
- Effects pass: beam ramp is violet (`arcane`) to match the mage's existing colour, not the source's blue.
- Effects pass: hit sparks now cause a 1 px shake for 0.06 s. A weaker shake never cuts a stronger one short.
- Docs cleanup 2: all notes in CLAUDE.md, because Claude Code loads that file on its own.
- T10 and T11 committed together (sheets changed in T11; HTML needed a rebuild). T7 and T8 together; T3 to T6 together; T1 and T2 together. Deviations from one task per commit.
- Weapon layers never use the attack fallback; a weapon with no frame for an animation is hidden there.
- Weapons on idle and jump reuse their walk frames (`build_lpc.py` compose), so a held weapon stays in hand while standing. Rat now has a dagger (LPC dagger, 64 px frames) and the bone weaver has the normal bow (shoot and hurt only; hidden elsewhere).
- Knight attack sword still missing on slash and thrust. The LPC arming sword has no such frames; the longsword slash is 128 px on another grid, which the 64 px builder cannot place yet.
- Selection card is 140 px tall, not 108, to fit the idle frame and four ability names.
- Spec deviations accepted: see section 6.
- Action Plan v2 V3 and V4: committed together (both touch the rebuilt HTML). Deviation from one task per commit.
- Action Plan v2: local `main` was 53 commits behind `origin/main` (old history). Kept it at tag `backup-stale-local-main-2`, reset `main` to `origin/main`.
- Action Plan v3 (X8): the banner moved under the sprites but still draws only in play and dying modes, as before.
- Action Plan v3: local `main` had 12 commits that `origin/main` lacks (origin was force-updated to `10c28e6`). Local `main` was left as it is. Work went to `origin/main` from a detached HEAD with `git push origin HEAD:main`.
- Action Plan v3 (X3): `build_lpc.py` `item_folder` returns the whole path when no `{anim}` or `.png` part exists, so override folders can be credited.

- Action Plan v3 (X11) suite, not rerun: `stomp defeats a grunt and drops a card; side contact respawns safely` failed with `page.waitForFunction: Timeout 5000ms exceeded.` (same check as the effects pass; cause not verified). `ability: ranger hop (X) gives upward speed in air` failed with `vy -195` (expects -250 to -320). Hop code is unchanged; the sample looks taken about 0.04 s late under load (cause not verified). Neither is arrow or shoot timing, so no rerun.

- Attack visuals pass: knight and rat melee trails come from the weapon-only sheets (`<key>_weapon_big.png`), tinted, so they stay on the blade. The arc is the fallback when a weapon has no frame on that row.
- Ranger arrow leaves the bowstring on the release frame (0.1 s into the shoot action), 4 px in front of the body centre, on the string span. A 0.25 s follow-through holds the shoot pose.
- Mage beam: the staff swing uses the wand's slash frames from the LPC library (`magic/wand/male/slash`), since the library has no staff swing. The beam starts at the wand tip on the swing and holds the final swing frame while the beam lasts.
- Suite: ranger shoot and mage beam checks now start on the ground and wait on the game clock, because the shot and beam release later in game time.
- Known gap: a ranger's bow on idle uses the walk-art pose (LPC has no bow-idle frames), so it sits horizontal after a shot.

- Feedback pass: each character has 10 HP. Enemy contact and archer arrows take 2 HP, spikes take 2 HP, and a hit gives 1 s of safety with a short knockback. A fall, or 0 HP, ends the character. Suite checks for contact, arrows, and spikes now expect HP loss, not the selection screen. The rat king hop check starts 110 px away, since the first hop must come before contact.
- Feedback pass: the ranger's bow shows on idle again, using the walk frame (the earlier idle hide is reverted at the user's request). The mage holds the wand (the staff layer is removed); the wand's slash frames are its only frames.
- Feedback pass: sprites stand on the grass. The player is drawn 3 px lower, and enemies use the same offset in their own scale.
- Feedback pass: trees draw at 3x their tile (96 px) and stand on the first solid tile below them.
- Feedback pass: the knight's stab lunges forward 0.16 s at 210 px/s, and the stab no longer leaves an afterimage (it read as repeated stabs). Only slashes do.
- Bridges: the arrow anchor and bone bridge sit at foot level, so the plank top is at the feet and they cross the gap in front of the caster. The rope plank is drawn as a plank with joints and ropes at the ends, and it fades over its last 1.5 s.

## 10. Environment and licenses

- Sandbox network: PyPI, npm, GitHub reachable. `huggingface.co`, `kenney.nl`, `opengameart.org`, itch.io, Wikimedia, Archive.org, jsDelivr, unpkg blocked.
- Python 3 with Pillow, Node 22, Playwright with Chromium (`NODE_PATH=$(npm root -g)`).
- Licenses: LPC sheets OGA-BY 3.0, CC-BY-SA 3.0, or GPL 3.0 per asset (`game/assets/lpc/CREDITS.txt`). DCSS tiles mostly CC0, per-tile licenses not checked; confirm before commercial release. Pixelify Sans OFL 1.1.
- Effects visual check (V6):
  - c_mage_ab1.png: OK. Violet beam from the staff tip.
  - c_knight_ab3.png: OK. Blue white slash arc in front of the knight.
  - c_weaver_ab1.png: OK. Pale green glint on the arrow tip.
  - c_ranger_ab1.png: Arrow shaft visible; no distinct glow seen in this frame. The release flare is short, so it may have ended before the shot. Not fixed (V6 says no fixes).
- Weapon visual check (X10): knight OK, sword reads on walk, idle, slash, thrust and jump. Ranger OK, bow on walk, shoot and hurt; slash and thrust hidden as planned. Archer OK, bow intact on walk and shoot, not cut at the cell edge, so the X9 archer rule was not triggered.
- Last visual check (T10): every screenshot OK. Known cosmetic: the level banner covers a sprite top in l1_mid, l5_mid, l7_mid. l4_mid shows the selection screen because the capture dropped the player in a pit.
