# Progress and handoff log

Read `research.md` first (pillars in section 2, task list in section 9). Newest entry on top. Use the handoff format in research.md section 7 item 9.

## 2026-10-30 Session 6 (Grok Bot): fresh-clone playtest fix, clean-clone tests, live on GitHub Pages
- Cause of the fresh-clone playtest FAIL (mage beam): playtest.js put the grunt 90 px ahead of wherever the opening walk ended. On a slower run that spot is over the level 1 pit (cols 12 and 13); the grunt fell in, a tile below the mage, and the beam band (head to feet) missed. The suite passed because playtest.js is a separate script and the suite's beam checks use fixed coordinates. Level 1 itself was fine.
- Fixes (commit "B7", b122940): beam hit band reaches 20 px below the feet (hits a foe one tile lower right in front); playtest places bodies on fixed flat tiles; new suite check for the one-tile-lower case (fails on the old band).
- Z5: root `package.json` (playwright 1.64.1; `npm run check` = gates, suite, playtest), root `index.html` redirecting to `game/changeling.html`, `README.md`, AGENTS.md run notes.
- GitHub Pages on (main, root): https://xenodorian.github.io/GameOfGameBecauseGame/ returns 200, the game file is served byte-identical, and a browser reaches the play scene there with no errors.
- Fresh clone of 1f24cdc: validator exit 0; suite 65 passed, 0 failed; playtest 4 passed, 0 failed (with NODE_PATH and with `npm install` only).

## 2026-10-29 Director session 5 (Grok Bot): L4 pit, music per look, feel audit
Done (47f6154):
- L4 rat king moved from col 100 to 95, away from the 2-wide pit at 105-106. Tour: done 33.4 s, no deaths.
- Music: crypt (L6, eerie, sparse, 66 bpm) and hall (L7, D minor march that builds over three passes, 96 bpm). Code only, about 2 KB. Checked playing in the browser; not yet heard by a person.
- Feel audit (no human available; measured with probe.js, the suite and the tell numbers in ENEMY_DEFS). Human reaction is about 250 to 400 ms, plus a key press:
  - Grunt: 0.4 s wind-up, then a 0.2 s lunge; about 0.6 s from tell to contact at its 64 px trigger range. OK. Walking into it shortens this, but that is the player's choice.
  - Rat king: 0.3 s crouch, then a visible hop (vy -330), so about 0.6 s or more before contact. OK.
  - Archer: 0.4 s aim line plus the arrow at 240 px/s; at least 0.8 s at its usual range. OK.
  - Revenant: 0.5 s rise plus a lobbed blob. OK.
  - Warlord: raise 0.5 s, stamp 0.6/0.4 s. Phase 3 sword raise was 0.35 s, the only tell under 0.4 s, and its swing reaches 56 px at close range. Raised to 0.4 s (light; the rest of the fight is untouched).
  - Shockwaves (12 px tall, 190 px/s): every face's plain jump clears one when the jump is pressed 350 ms after it appears, about 110 px away. Now a suite check, with a negative control (no jump: hit).
  - L3 blink gap was unreadable: a too-wide gap with no cue that blink crosses it. Added faint blink-coloured motes across it (`runes` level field), brighter while you wear the mage.
Suite 64 passed, 0 failed; validator exit 0. Screen: /workspace/GameOfGameBecauseGame-shots/s5_l3_gap2.png. Music renders: music_crypt.wav, music_hall.wav in the same folder (this box only).
Director view: the demo is at the point of diminishing returns without human feedback. What is left is taste and feel (music by ear, jump and float feel, boss difficulty, whether the side paths get found), which the bots cannot judge. Next: H1 human playtest of all 8 levels with notes, then tune from those notes; Q2 device check.

## 2026-10-29 Director session 4 (Grok Bot): two places, badges, boss arena, polish
Done (a38b354, one commit for four linked tasks; evidence in the body):
- V7 L6 and L7 look like two places: a per-level `look` field. L6 crypt (cold teal, bone niches with skulls, drip fog). L7 hall (warm, lit windows, red banners with gold masks, flickering torches, red carpet).
- L5 light L7 layout change: its tall blocks have a one-tile step at each end (stepped daises), L6 keeps sheer walls.
- L2 badges: rat over L2 96,8, knight over L4 64,15.
- B6 boss arena, fight numbers untouched: the pin was a respawn bug. After a death by the right wall, the respawn picked the corner behind the warlord. Respawn now keeps 7 tiles from it (death at col 38 now respawns at col 28). The high platforms the knight could not reach are now three one-way ledges 2 rows up (cols 10, 23, 33). The corner one is an escape by the exit.
- V8 polish from the tour sheets: overhead secret badges were hidden behind the HUD (the L2 rat secret was never visible from the ground); they now pin under the HUD with an up pointer. Buried brick darkens with depth.
Suite 63 passed, 0 failed; validator exit 0. Screens: /workspace/GameOfGameBecauseGame-shots/s4_l6_crypt2.png, s4_depth_l7.png, s4_l2_badge3.png (this box only).
Not verified: a human boss fight with the new ledges (the tour bot only walks right and attacks forward, so its col 38 deaths say little). Ledges might let a player wait out shockwaves; that is intended.
Next: H1 human feel check (float, blink gap, boss ledges); L4 col 102 (rat king knockback next to a 2-wide pit; the bot dies there every run); music per look (crypt and hall still use the dungeon theme); Q2 device check.

## 2026-10-29 Director session 3 (Grok Bot): levels 6 and 7, face side paths, fresh-player pass
Done and on main (evidence in each commit body):
- Tools: `game/tests/tour.js` (bot run per level, contact sheet plus hit, death and stuck columns) and `game/tests/probe.js` (can this face really make this move). 360fe89.
- F5 fresh-player pass, biggest find: mage float could be re-pressed in the air for free flight over every gate. Now one float per airtime, climb only in the first 0.7 s (360fe89).
- Validator heights now match probe.js measurements: hop 3 rows (was 4), float 4 (was 3). With real heights three "ranger-only" cards (L3 66,17 which had a ranger badge, L6 91,9, L7 61,9) were unreachable by anyone; lowered to hop height (5ab02e5).
- L3 levels 6 and 7 (5ab02e5, f171abe): the drag was traps, not length. L7 pit in front of a 2-tall wall (12 bot deaths in a row) filled; walk-off pits after tall blocks filled (one sat under the L6 main card at col 70 after my first move, fixed in f171abe); spikes moved off landing edges; one grunt removed from the L7 opening block. Tour: L7 stuck at col 106 to done in 39.9 s; L6 done in 37.2 s.
- L4 real face side paths, each checked in game with probe.js (5ab02e5): L1 ranger sky route (two hops, card and power-up); L3 mage room (blink the walkway gap, float the 1-wide shaft, card and power-up, hatch up beside the flag); L5 rat corridor (shaft to a hidden corridor, power-up, drop past both archers by the exit).
- Validator minimums lowered on purpose: L6 spikes 10 to 8, L7 enemies 14 to 13. Ranger left the game-wide "only this face" rule (impossible with real heights); now "ranger reaches, knight does not".
Suite 63 passed, 0 failed on f171abe; validator exit 0. Tour (knight bot, 2-tile jump fixed): L1 13 s, L2 28 s, L4 34 s, L5 31 s, L6 37 s, L7 40 s, L8 37 s; L3 is a vertical climb the bot cannot do.
Heart pickups (Q1): skipped. Bot deaths come from piled-up hits by a bot that never dodges, not from a damage spike.
Screens: /workspace/GameOfGameBecauseGame-shots/s3_l3_mage_room.png, s3_l5_rat_corridor.png, s3_l1_ranger_ledge.png, tour3/tour_L7.png (outside the repo, this box only).
Needs human check: the new float (jump, then hold Up with S) and whether players find the blink gap in L3; warlord fight (bot took 15 hits, 3 deaths, mostly cornered at the arena right edge, col 38).
Next: H1 human feel check; warlord corner pressure at col 38 (watch a human fight first); L2 rat card (96,8) and L4 knight card (64,15) badges if wanted; levels 6 and 7 still share one block template, so a light visual or layout difference would help them read as two places; Q2 device check.

## 2026-10-29 Director session 2 (Grok Bot, took over after Claude ran out of usage)
Where Claude stopped: research and plan done; Rounds 1, 5, most of 6 and C1 to C3 on main. C4 and F0 to F4 were in worktrees that never reached main; redone here.
Done and on main (evidence in each commit body):
- C4 weaver bone toss (7e41378).
- F0 to F3: tuning.js, backquote hitboxes, accel movement, variable jump, apex hang, corner correction, look-ahead camera, squash and stretch (bfa6dba).
- F4 hit feedback: kill freeze, death tumble, white hit flash, red hurt edges (4e2ae6b). capture_gif.js added.
- C5 face swap on D with HUD badge and first-time hint (8fc65b6).
- V2b tree tile shadow blob removed (8896547).
- E1 to E4 enemy tells: grunt wind-up lunge, rat king crouch, archer aim line, revenant mud lob (ade87d3).
- E5 warlord three phases: sword swing, charge and stun, jump slam shockwaves, final-blow slow motion (ab0daf7).
- V1 heart HP; V5 scene fades and title-card intro (3bfcd81).
- L1 level 1 enemy order and signs (cda4983). C6 selection cards show role and keyed powers (f04df00).
- L2 face badges over face-gated secrets in levels 1, 3, 5 (8b79197). V6 banner and sign text moved off the player (d146e51).
- P1 ending title card at dawn: empty throne, faces fly home, stats fade in (739e3a4).
- Tests: stale stomp check fixed; checks updated where behaviour changed on purpose (each named in its commit). Full suite 63 passed, 0 failed on d146e51.
Tools: `game/tests/playtest.js` (20 s smoke playtest), `game/tests/capture_gif.js <kill|beam|jump|hurt|grunt|rat|archer|revenant|boss1|boss2|boss3>`, `SUITE_ONLY=regex` for suite subsets. Playwright here: NODE_PATH=/workspace/GameOfGameBecauseGame-tools/node_modules.
Deviations (director calls): C5 is an instant cycle (leftmost card in, old face to the back), not the slowed-time picker. L2 is badges on existing secrets, not new routes. Level 1 keeps one mud revenant (drops the Mage early).
Needs human check: movement feel (F1 numbers), tell lengths, warlord difficulty, music and SFX by ear, touch and gamepad swap.
Next (research.md section 9, Round 9): H1 human feel check, L3 levels 6 and 7 trims from a recording, L4 one real optional face route per priority level, Q1 heart pickups only if H1 asks, Q2 real device check.

## 2026-10-30 Director, session 1 (checkpoint)
Done and on main (each commit body has its evidence):
- Research: research/notes_design.md, notes_ai.md, notes_tools.md, notes_audit.md; research.md plan.
- B1 mage beam hits grounded enemies (hit rect covers the body band; drawn beam unchanged). Suite check added.
- B2 knight charge defeats enemies in its path; no contact damage while dashing plus 0.15 s. Suite check added.
- B3 shield bash: stuns 1.2 s with stars, stuns enemies within 40 px, a bash on a stunned enemy defeats it, stunned enemies do no contact damage.
- B4 warlord arrows at player body height (`fireY: 41` on the warlord def; archer unchanged).
- B5 music renders in a Web Worker (Blob URL). Max frame gap after first input: 451 ms before, 53 ms after. Pause menu gained a Music item, so the menus suite check presses Down once more (intended change).
- A1 ZzFXM music in code (`zzfx.js`, `music.js`): field (C major, 110 bpm), dungeon (A minor, 84 bpm). Music toggle in the pause menu (`localStorage["changeling_music"]`). Starts on first input.
- A2 boss loop (level 8) and stingers: card, level clear, boss down. Music ducks to 50 percent under stingers.
- A3 ZzFX SFX with plus or minus 5 percent pitch; ability sound has a timbre per character.
- V0 music volume 0.22 (under SFX). V2 terrain dressing (edges, planks, door or portcullis exit, spikes, card and gem pickups). V3 two parallax layers per theme. V4 level 4 marsh look (`World.visual()`; theme stays `field`).
- C1 ranger volley, C2 mage nova, C3 rat gnaw replace slash on Z.
Suite: 57 passed, 0 failed after B5 (before C1 to C3). Not rerun since C1 to C3 landed; the C worker runs it after C4.

In progress (workers in worktrees under .claude/worktrees, not yet on main):
- C4 weaver bone_toss (Round 3 worker).
- F0 to F4 (tuning.js, hitbox overlay on backquote, capture_gif.js, movement, corner correction, camera, hit feedback). Uncommitted at this checkpoint. If that worker is gone, restart F0 from scratch from research.md 5.7.

Next after those: C5 face swap on D, C6 selection strip text, then Round 4 (E1 to E5 enemies and warlord), V1 and V5, Round 7 levels, Z1 close out.

Needs human check (nobody has heard or played these yet):
- Music and SFX taste and balance (A1 to A3). Only levels were measured: peaks 0.85 per render, no clipping.
- Feel of F1 to F3 once landed.

Known issues:
- Stomp side-contact suite check is a known load flake (passed on rerun).
- Wooden exit door shut state never seen (field levels never lock the exit).

## 2026-10-29 Director, session 1
- Done: research round (research/notes_*.md), research.md written.
- Next: Round 1 (B1 to B4).
- Needs human feel check: none yet.
