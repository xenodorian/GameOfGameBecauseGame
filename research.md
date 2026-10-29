# Changeling rescue: research and direction

Director's document. Written 2026-10-29 after a full research round. This file is the source of truth for the rescue: why the game is not fun, what we will change, in what order, with what tools, and how agents work on it. The task list is section 9. Progress and handoff notes go in `PROGRESS.md`.

Raw research (with source URLs) lives in `research/`:
- `research/notes_design.md`: game feel, platformer level design, Kirby copy ability design, enemy and boss design, demo design, visuals, audio. Ends with 25 ranked principles.
- `research/notes_ai.md`: strengths and weaknesses of AI agents in game development, Anthropic harness and multi-agent guidance, failure modes mapped to this repo, 25 swarm rules.
- `research/notes_tools.md`: templates and reference code, every tool tried in this sandbox with PASS or FAIL and install commands, reachable asset sources.
- `research/notes_audit.md`: a measured, human-eye audit of the current build (bugs, feel, all 20 abilities, enemies, each level, visuals, audio, flow).

Anything below marked UNVERIFIED was not measured or not located in a source.

---

## 1. The verdict

The game works. It is not fun. The audit and the research agree on why:

1. **The core fantasy is broken or absent.** The game is called Changeling. The fun should be in becoming things. Today:
   - Two signature moves do nothing. The mage beam flies 1 px over every grounded enemy (MEASURED: 20 of 20 grounded enemies survived). The knight charge has no hitbox and the knight takes damage running through the enemy (MEASURED: hp 10 to 8).
   - All five characters share `slash` on Z. Three share some other move. Every fight is solved by spamming slash. Picking a card barely changes how you play.
   - You only change form when you die. A death queue is not a fantasy. There is no way to swap forms on purpose.
   - Every character can finish every main route (a good rule) but nothing on the main route ever rewards a specific form, so the choice never matters outside hidden secrets.
2. **Nothing telegraphs, nothing threatens.** Enemies walk into you. Contact is the only attack. All non-boss enemies die in one hit. The warlord's arrows fly 12 px over a standing player's head (MEASURED: 22 s of standing, 0 damage). The boss is a slow walk.
3. **Movement is functional, not pleasant.** No acceleration, no variable jump height, symmetric gravity, no apex hang, no corner correction, camera with no look-ahead. Coyote time and jump buffer exist.
4. **The world is flat to look at.** LPC characters and the new effects look good. Terrain is flat green slabs, the exit is a grey box, cards and spikes are plain shapes, level 4 "Rotting Marsh" looks like level 1, one parallax layer, no scene fades, black-text intro.
5. **The world is silent.** About eight single-oscillator blips. No music. Every non-beam ability plays the same "ability" sound.
6. **Pacing is front-loaded and flat.** Level 1 shows all four regular enemy types in 72 tiles. Levels 6 and 7 are long and repetitive (UNVERIFIED by play). Level 3, the vertical tower, is the best level.
7. **The process optimised for green tests, not for a player.** Previous plans checked physics numbers and called static screenshots "OK". No design pillars existed. This is the main AI failure mode in `research/notes_ai.md` (section 3).

## 2. Design pillars (put these at the top of every worker brief)

1. **Every face plays differently.** Each character has one signature verb no one else has. Picking a card changes how you cross the next screen.
2. **Change on purpose.** Swapping faces is a fast, flashy, deliberate move, not only a death penalty.
3. **Hits you can feel, threats you can read.** Every attack has a tell, every hit has weight (hit stop, flash, knockback, sound), every danger is visible before it hurts.
4. **Clean and readable at a glance.** Playfield bright, background quiet, one idea per level, the next goal visible.
5. **A short demo that ends on a peak.** Polish over breadth. No new levels. No new enemy types. Make what exists sing.

Test for every task: "Would a new player notice this within a minute of play, and would it make them smile or understand more?" If no, it does not go in.

## 3. What a good small platformer has, versus us

From `research/notes_tools.md` A2 and A3, and `research/notes_design.md`.

| Part | Good template | Changeling now | Action |
|---|---|---|---|
| Fixed step loop | yes | yes, 1/60 s | keep |
| Player state machine, accel and decel | yes | instant speed | add (F1) |
| Variable jump, fall gravity, apex hang, fall cap | yes (Celeste: half gravity near apex, jump hold 0.2 s) | none | add (F1) |
| Corner correction | Celeste 4 px | none | add (F2) |
| Coyote time, jump buffer | Celeste coyote 0.1 s | coyote 0.08 s, buffer exists | keep, tune to 0.1 |
| Camera look-ahead and deadzone | Phaser lerp plus deadzone | plain lerp 0.15 | add (F3) |
| Parallax, 2 to 3 layers | yes | 1 far layer | add (V3) |
| Scene transitions | fade or wipe | hard cuts | add (V5) |
| Music per area, stingers | yes | none | add (A1, A2) |
| Layered SFX | yes | blips | add (A3) |
| Particles | yes | yes, good (Glow system) | keep |
| Hit stop | yes | yes | tune per attack (F4) |
| Tuning constants in one place | yes | spread across files | add `tuning.js` (F0) |
| Debug overlay (hitboxes) | yes | none | add (F0) |
| Enemy state machines with tells | yes | walk and contact | add (E1 to E4) |

## 4. Every resource we have

### 4.1 Models (the swarm)
- **Director (Opus):** writes this document, briefs, decides taste questions, reviews contact sheets and GIFs between rounds. Does not write large code itself.
- **Sonnet workers:** one bounded code task each (about 3 files, 150 changed lines). Research tasks.
- **Haiku workers:** mechanical work only: run the build and gates, take screenshots, make contact sheets and GIFs, grep, read-only review of a diff against acceptance criteria. Never touches feel, physics, or levels.

### 4.2 Tools verified in this sandbox (details and commands in `research/notes_tools.md`)
- Built in: Node 22, Python 3, Playwright with Chromium (`NODE_PATH=$(npm root -g)`), ffmpeg 6.1.1, ImageMagick 6, eslint 10, prettier 3 (check only, never `--write`).
- Installed and PASS: ZzFX and ZzFXM (cloned from GitHub; `zzfxm.min.js` is 622 bytes; renders songs headless), jsfxr 1.4.1, gifenc, sharp, pngjs, Pillow, numpy, scikit-image, imageio, pyxel, pygame.
- Capture: Playwright frames to GIF and MP4 through ffmpeg (proven, 57 KB each). This is our "watch it move" loop, which still screenshots cannot give.
- FAIL: pyxelate, hitherdither (not on PyPI), gifski (use ffmpeg), Tiled and LDtk (GUI only; levels stay ASCII).
- Repo tools: `game/tools/build_single_html.py`, `validate_gates.py` (reachability per character, `--show N`, `--map N NAME`), `build_lpc.py`, `game/tests/suite.js`, `game/tests/screenshots.js`.

### 4.3 Reference code (read only, never copy unlicensed code)
- `NoelFB/Celeste` (MIT): `Player.cs` real movement constants; `Classic.cs` is Celeste Classic.
- Kaplay examples (camera, particle, platformer), Phaser 4 camera follow with deadzone, Excalibur.
- `gavilanbe/plumo`: Kirby-like in plain canvas with WebAudio chiptune. No license file: read only, do not copy.

### 4.4 Assets reachable
- LPC generator source (sparse clone, see Action_Plan_v3 X1) for character layers.
- `ETdoFresh/kenney.nl` GitHub mirror of Kenney packs (CC0, license checked in `kenney_digitalaudio` and `kenney_impactsounds`). Usable for tiles or sounds if code-made sound is not enough. Rule: record every file in CREDITS.
- Lospec palettes: `https://lospec.com/palette-list/<slug>.json`.
- DCSS tiles already in `game/assets/tiles/`.
- Network note: jsDelivr and unpkg answered (CLAUDE.md section 10 said blocked; out of date). kenney.nl itself is 403.

### 4.5 Knowledge (sources in the notes)
Celeste forgiveness tricks (Thorson), Swink "Game Feel", Vlambeer screenshake, "Juice it or lose it", Sakurai on hit stop, GMTK Platformer Toolkit parameters, Mario 3D World four-beat level structure, Hollow Knight tutorial analysis, presskit.gg demo guide, Anthropic long-running harness and multi-agent articles, Claude Code best practices, LLM game papers (GameGPT, ScriptDoctor, lmgame-Bench).

## 5. Design decisions (director calls, final unless playtest proves them wrong)

### 5.1 Scope
- Keep 8 levels and 5 enemy types. Do not add levels, enemies, or characters.
- Priority levels for polish: 1 (first impression), 3 (best layout), 5 (theme change), 8 (boss). Levels 6 and 7 get trims only if a round shows them dragging.
- The rule "every character can finish every main route" stays. It is what makes death-swap fair.

### 5.2 Each face gets one signature move (Z slot)
Z is no longer `slash` for everyone. Knight keeps the sword. The others get a move that changes how they approach a screen.

| Character | A | S | Z (new) | X | Identity in one line |
|---|---|---|---|---|---|
| Knight | shield_bash (now kills a stunned enemy, stuns neighbours) | charge (fixed: bowls through enemies, immune while dashing) | slash | thrust (lunge) | Heavy melee tank. Breaks cracked walls. |
| Ranger | shoot | arrow_anchor (rope plank) | **volley**: 3 arrows fanned up-forward (0, -20, -40 degrees), 1.0 s cooldown | hop | Hits things above. Crosses gaps. |
| Mage | spell_bolt "Beam" (fixed: hits the body band) | float | **nova**: ring burst around the mage, radius 40 px, hits all, pushes enemies away, 1.2 s cooldown | blink | Crowd control. Teleports. |
| Rat | leap | scurry | **gnaw**: 3 fast bites in 0.3 s, short reach, each bite hits | thrust | Fast, fragile, vertical. |
| Bone Weaver | shoot | bone_bridge | **bone toss**: arcing lob (vx 160, vy -260), hits enemies behind low walls and below ledges | ghost | Builds paths. Hits around corners. |

Ability ids `slash` stay for knight. New ids `volley`, `nova`, `gnaw`, `bone_toss`. Save data stores character keys, not ability lists (UNVERIFIED: check `Run` save format before the task; if abilities are saved, keep old saves loading).

Duplication accepted: ranger and weaver both have `shoot` (weaver arrows are bone-green and reads as its own). Arrow anchor and bone bridge both make a platform; they differ in length and duration, and that is fine for a demo.

### 5.3 Change on purpose: face swap
- New action `swap` on **D** (gamepad: Select or LB, touch: a small face button). Opens the hand strip with time slowed to 0.25 (not paused). Left and Right pick, D or A confirms, X cancels. The current face goes into the picked slot, so nothing is lost.
- 2.0 s cooldown shown on the HUD. Swap gives 0.3 s of invulnerability and a poof (ring plus motes in the new face's ramp colour), plus a sound.
- Q (drop your face) and C (drop a card) stay as they are.
- This makes the hand a loadout. Secrets and the new optional routes (5.5) make it worth using.

### 5.4 Enemies: one readable rule each
| Enemy | Rule | Tell |
|---|---|---|
| Grunt | Walks; when the player is within 64 px on the same row it winds up 0.4 s then lunges 48 px | crouch pose, white flash, grunt sound |
| Rat king | Hops toward the player | 0.3 s crouch and squash before each hop |
| Archer | Fires an arrow aimed at the player's body (not the head line) | 0.4 s draw pose plus a thin dotted aim line |
| Mud revenant | Slow; every 3 s lobs a mud blob in an arc | 0.5 s rise and bubble |
| Warlord | Three phases (5.6) | see 5.6 |

All enemies: hit flash white for 0.06 s, knockback 60 px/s on non-lethal hits, death pop. Contact damage stays 2 HP.

### 5.5 Optional face routes on the main path
Each priority level (1, 3, 5) gets one or two short optional routes that only a specific face can use, which give a heart, a card, or a shortcut. Signposted by a small face icon on a sign. Main route is unchanged and still finishable by everyone (`validate_gates.py` must still pass for all five).

### 5.6 Warlord rebuild
- Fix arrow height so arrows travel at the player's body.
- Phase 1 (8 to 6 hp): walk, sword swing (0.5 s raise tell), arrows.
- Phase 2 (5 to 3 hp): adds a charge across the arena (0.6 s stamp and dust tell), stuns itself 1.2 s if it hits a wall (punish window, stars over head).
- Phase 3 (2 to 1 hp): adds a jump slam with a shockwave along the floor (jump over it), faster tells.
- Phase change: 0.5 s freeze, flash, roar sound, small shake. Final hit: 0.4 s boss stop, slow motion 0.5 s, big flash, then the exit opens.

### 5.7 Movement targets (go into `tuning.js`)
Keep jump peak close to the current 2 tiles so level gates do not change.
- Run: max 140 px/s, ground accel 1600 px/s^2, ground decel 2000, air accel 1100, air decel 600.
- Jump: vy -350, rise gravity 900, fall gravity 1400, apex band |vy| < 50 with jump held gives gravity x 0.5, release while rising multiplies vy by 0.45, fall cap 420 px/s.
- Coyote 0.1 s, jump buffer 0.12 s.
- Corner correction: up to 4 px sideways nudge on a head bump, up to 4 px step-up on a ledge clip while rising.
- Camera: look-ahead 40 px in facing direction (lerp 3/s), horizontal lerp 8/s, vertical deadzone 28 px, follow up only on landing or when the player leaves the deadzone.
- Check after F1: `validate_gates.py` exit 0 and a recorded jump apex in px (must be 64 to 76).

### 5.8 Look and sound
- Music: ZzFXM, made in code. One short loop per theme (field, dungeon), one boss loop, stingers for card pickup, level clear, boss down. Volume 0.35 under SFX, mute toggle in pause menu.
- SFX: ZzFX presets per action with small pitch randomisation; each character a timbre (knight metal, ranger string, mage chime, rat squeak, weaver bone click).
- Terrain: top edge highlight tiles, one-way platforms as thin planks, an exit door sprite (opens when the warlord dies), card pickups drawn as small cards with the character face, spikes in a coloured sprite.
- Level 4 marsh: dark green-brown palette, water strip with animated surface, fog layer.
- Two extra parallax layers per theme drawn in code (hills, castle silhouettes), low contrast.
- HUD: HP as 5 hearts (each heart 2 HP), i-frame flicker, red edge flash on damage, swap cooldown ring.
- Scene fades 0.25 s. Intro becomes a title card with a silhouette image and three short lines.

### 5.9 First 30 seconds (level 1)
Flat run, one slow grunt, kill, card pops in an arc, pickup flash and sting, a short "D: swap face" prompt the first time the hand has a card. Then a hop gap. Only grunts in level 1; rat kings first appear in level 2, archers in level 3, revenants in level 4.

## 6. How we check (cheap first)

1. Steps A to C of the CLAUDE.md check routine after every code task.
2. Visual tasks: one contact sheet (6 to 12 frames) plus one crop, read once. Write what is SEEN, one sentence per group. "Not visible" is a valid answer and blocks "OK".
3. Feel tasks: record numbers (apex px, time to top speed, frames input to action) against 5.7. Mark "needs human feel check" in `PROGRESS.md`.
4. Short GIF (3 to 5 s) per round for the director, via `game/tests/capture_gif.js` (task F0 makes it).
5. Full suite (step D) once per round, not per task. Tests change only where behaviour changed on purpose (CLAUDE.md rule 8).
6. Human-eye checklist per round (from `research/notes_ai.md` section 7): Can I tell what each face does within 5 s? Did a hit feel like a hit? Did I see the danger before it hurt me? Did I want to swap? Did anything look broken or placeholder?

## 7. Swarm protocol

Condensed from `research/notes_ai.md` section 10. These extend CLAUDE.md section 1.

1. One task, one player-visible outcome. About 3 files and 150 lines for Sonnet; 1 file or no code for Haiku.
2. Every brief has: pillars (section 2), goal (one player-facing sentence), files allowed, files forbidden, acceptance criteria, evidence required, out of scope, stop condition, max 3 tries.
3. Numbers, not adjectives. All tunable values in `game/src/tuning.js` once F0 lands.
4. Evidence in the commit body: the command and its output line, or the shot path.
5. The author never reviews its own work. A fresh Haiku reads the diff against the brief and reports gaps only.
6. Never refactor, rename, or reformat outside the brief. Never add unrequested features or effects.
7. Never edit level layouts without running `validate_gates.py` for all five characters.
8. Rounds of 3 to 6 tasks, then a director review (GIF plus checklist) before the next round.
9. Handoff (usage running low): commit what works or `git checkout -- game`, then write in `PROGRESS.md`: current task id, done and verified (with evidence), half done and the exact next step, files touched, commands to rerun, surprises, questions marked "needs director". Push to `main`.
10. Each new session: `git branch --show-current` must print `main`; build; gates; read `PROGRESS.md`; then take the next open task in section 9.

## 8. Risks

- Movement changes can break secrets gated by height. Mitigation: keep apex 64 to 76 px; gates after F1.
- New Z moves change tests that use `slash` on non-knights. Change those tests on purpose and say so in the commit.
- Music can get annoying. Short loops, low volume, mute option.
- Suite flakes under load (stomp side contact, ranger hop sample). Known; investigate only if they block a round.
- Scope creep. Section 2 test applies to every task.

## 9. Task list (do in order; mark [x] done, [~] stopped per CLAUDE.md rule 11)

Each line is a brief seed. The director or the worker expands it with the template in section 7. Commit message starts with the id.

### Round 1: make the fantasy work (bugs)
- [x] B1 Mage beam hits the body band. `abilities.js` updateBeam: hit rect y from player top - 6 to player bottom (keep the drawn beam where it is). Accept: grounded mage kills grounded grunt and rat king at 60 and 140 px. Add a suite check that places the enemy on the ground.
- [x] B2 Knight charge bowls through. Hitbox in front of the knight while dashing, defeats each enemy once, knight immune to contact during the dash plus 0.15 s. Accept: grunt dies, hp stays 10.
- [x] B3 Shield bash payoff. Bash defeats an already stunned enemy; a fresh hit stuns 1.2 s with stars, stuns other enemies within 40 px. Stunned enemies do no contact damage.
- [ ] B4 Warlord arrows at body height (warlord arrow spawn y so the arrow centre is at player centre height on flat ground).

### Round 2: feel
- [ ] F0 `game/src/tuning.js` (movement, camera, ability numbers moved from inline literals, added to `SCRIPTS`), a debug hitbox overlay toggled by backquote, and `game/tests/capture_gif.js` (Playwright frames to GIF via ffmpeg).
- [ ] F1 Movement targets from 5.7: accel, decel, variable jump, fall gravity, apex hang, fall cap, coyote 0.1. Record apex px. Gates exit 0.
- [ ] F2 Corner correction (head and ledge, 4 px).
- [ ] F3 Camera look-ahead and vertical deadzone (5.7).
- [ ] F4 Hit feedback: per-attack hit stop (light 0.04 s, heavy 0.08 s, kill +0.03 s), enemy white flash, knockback on non-lethal hits, player i-frame flicker, red edge flash on damage.

### Round 3: every face plays differently
- [ ] C1 Ranger `volley` on Z.
- [ ] C2 Mage `nova` on Z.
- [ ] C3 Rat `gnaw` on Z.
- [ ] C4 Weaver `bone_toss` on Z.
- [ ] C5 Face swap on D (5.3), with HUD cooldown and first-time prompt.
- [ ] C6 Selection and swap strip show each face's four ability names and a one-line identity.

### Round 4: threats you can read
- [ ] E1 Grunt wind-up lunge.
- [ ] E2 Rat king crouch tell.
- [ ] E3 Archer draw pose plus aim line, aims at body.
- [ ] E4 Mud revenant lob.
- [ ] E5 Warlord phases, tells, punish window, final hit boss stop (5.6). May split into E5a to E5c.

### Round 5: sound
- [ ] A1 ZzFXM player in code (`game/src/music.js`), field and dungeon loops, mute in pause menu.
- [ ] A2 Boss loop and stingers (card pickup, level clear, boss down).
- [ ] A3 ZzFX per-action SFX with a timbre per character; replace the shared "ability" sound.

### Round 6: look
- [ ] V1 HUD hearts, swap cooldown ring.
- [ ] V2 Terrain dressing: top edge highlight, one-way plank, exit door, card pickup as a card with a face, coloured spikes.
- [ ] V3 Two parallax layers per theme in code.
- [ ] V4 Level 4 marsh look (palette, water strip, fog).
- [ ] V5 Scene fades and a title-card intro.

### Round 7: levels
- [ ] L1 Level 1 first 30 seconds (5.9) and enemy introduction order across levels 1 to 4 (move or swap enemy spawns only).
- [ ] L2 Optional face routes in levels 1, 3, 5 (5.5) with face-icon signs.
- [ ] L3 Trim dead stretches in levels 6 and 7 if the round GIF shows them dragging. Otherwise skip and log.

### Round 8: close out
- [ ] Z1 Full suite once, record in CLAUDE.md section 8. Screenshot contact sheet of every level. Update CLAUDE.md sections 3 to 6 to match the game.

## 10. Not doing (and why)
- New levels, enemies, or characters: scope (pillar 5).
- A level editor (Tiled, LDtk): GUI only here; ASCII levels plus `validate_gates.py --show` are enough.
- AI image generation: Hugging Face inference was blocked before; LPC plus code-drawn art is consistent and licensed.
- Rewriting on an engine (Phaser, Kaplay): the code base is small and works; the problems are design, not engine.
- Lock-and-key main routes: they break death-swap fairness. Optional face routes give the same choice without the punishment.
