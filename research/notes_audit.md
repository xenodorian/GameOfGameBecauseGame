# Human-perspective audit of Changeling (2026-10-29)

Method: Playwright drove game/changeling.html. Screenshots in game/tests/shots (sheet1.png, sheet2.png, sheet3.png are
contact sheets; a_<char>_<n>.png are the 20 abilities next to a grunt; t_*.png are intro). Numbers marked MEASURED were
read from the running game. Anything else is from code reading, or marked UNVERIFIED. No source was edited, no git run.

Headline: the director's beam hypothesis is CONFIRMED, and an even worse sibling bug exists (Knight Charge hurts the
player and does not damage enemies). The game is also mechanically thin: every non-boss enemy dies in one hit of anything,
and nothing the enemies do requires a decision.

## 1. Bugs that break the fantasy

### 1.1 Mage beam cannot hit a ground enemy. Severity: critical. CONFIRMED.
- File: game/src/abilities.js, beamOrigin ~line 283 and updateBeam hit rect ~line 325.
- Numbers: player body is 18x30. beamOrigin uses cy = p.y + p.h - 32 = p.y - 2, and the final swing frame STAFF_TIP[5] adds
  dy = -4, so the beam axis is at p.y - 6 (36 px above the feet, 6 px ABOVE the top of the player's head).
  Hit rect: y = o.y - BEAM.half - 1 = p.y - 11, h = 10, so it spans p.y-11 .. p.y-1.
  Grunt, mud revenant, archer are 30 px tall standing on the same ground, so they span p.y .. p.y+30. Gap: 1 px. Rat king
  (26 tall) spans p.y+4 .. p.y+30. Gap: 5 px. The beam passes over all of them.
- MEASURED: mage on flat ground, frozen grunt at 60 px and at 140 px, rat king the same, key A pressed: dead=false in all 20
  trials (enemies settle to ground level). Then with the enemy pinned in the air each frame at top = player top + dy:
  dy 3, 0, -1 -> alive; dy -2, -6, -20, -34, -35, -40 -> dead. So an enemy only dies if its top is 2+ px above the
  mage's head, i.e. it is on a higher ledge or hopping. A mage standing next to a grunt, the exact case the user tried,
  never kills it.
- Why tests pass: the suite places the target in the air or on a different row (UNVERIFIED which; the user report matches
  my result either way).
- Fix: aim the rect at the body band. Use the beam origin for drawing, but test hits with y = p.y .. p.y+p.h (or a rect
  from p.y-6 to p.y+30), plus make half about 8 to 10. Effort S.

### 1.2 Knight Charge (S) does not damage enemies and costs HP. Severity: critical. MEASURED.
- File: game/src/abilities.js case "charge" (~line 108) only sets scene.dashT = 0.25. scenes.js ~line 439 sets vx 320 and
  breaks cracked walls. Nothing hits enemies.
- MEASURED: grunt 50 px ahead, press S: knight dashed 85 px through the grunt position, grunt alive, knight hp 10 -> 8
  (contact damage applies during the dash; the stomp test needs vy > 0).
- A dash named "Charge" that makes you take damage when you hit an enemy is the opposite of the fantasy. Fix: give the dash
  a hitbox (stun or knockback or kill) and make the player immune to contact while dashT > 0. Effort S.

### 1.3 Shield Bash (A) does not kill. Severity: medium. MEASURED.
- Knight A stuns for 1.2 s (hitbox stun, abilities.js ~line 106). Grunt stayed alive. It sets up a hit but nothing rewards
  the combo (no extra damage on stunned enemies, stunned enemy still hurts on contact? UNVERIFIED). Reads as a broken
  attack to a new player. Effort S.

### 1.4 Warlord arrows never hit a standing player. Severity: high. MEASURED.
- File: game/src/enemies.js ~line 106 tryFire fires at this.y + 12. Warlord is 58 tall, so on the arena floor the arrow is at
  y 338..342, while the player (feet 384, h 30) spans 354..384. The arrow flies 12 px over the player's head.
- MEASURED: stood still on the arena for the whole approach (about 22 s, many fireEvery 2.2 s volleys): hp stayed 10 until
  the warlord reached me. The boss's only ranged attack is cosmetic unless you jump. Fix: aim at the player's centre y, or
  fire from y + 36. Effort S.

### 1.5 Warlord is a slow walk with 1.5 hit cycle. Severity: medium. MEASURED.
- Walks at about 50 px/s from 400 px away, so it takes about 22 s to arrive while you wait. Once on you it deals 2 HP per
  second of overlap and you cannot be hit more than once per 1 s window. A stationary player lost 10 HP in about 8 s and
  respawned (the HP bar reset). There is no telegraph, no pattern, no phase change. 8 hits with 0.6 s i-frames means a
  minimum 4.8 s fight. It is a damage sponge. See section 4.

### 1.6 Level banner and HUD cover the play area. Severity: low. Screenshots.
- Banner (2.5 s) sits at screen y 80..110 of 270 over the sprite's head in l1 to l7 starts and mids (known in CLAUDE.md as by design).
  Ability bar sits on the bottom 20 px over the ground tiles and clips mid-word at narrow widths ("Arrow anc", "Bone bridg"
  in my crops; the full screenshots show the bar full width, so this is my crop only; UNVERIFIED at phone size).

### 1.7 Mid-level screenshots show the player falling into the start of nothing. Severity: low.
- l3_mid, l4_mid in the screenshot tool drop the player at width/2 and often into a pit (selection screen shown on l4_mid per notes). Not a game bug, but
  it means nobody has visually reviewed real mid-level moments of the level.

## 2. Feel problems

Constants read from code: walk 130 px/s, jump vy -340, gravity 900, fixed 1/60. Jump apex = 340^2/(2*900) = 64 px, exactly 2 tiles.
Releasing jump halves vy, so a tap hop is about 16 px, a very small hop. No air control tuning (vx set directly every frame, so
instant start and stop). Camera: cam += (target - cam) * 0.15 each frame, no look-ahead, no deadzone (scenes.js ~560).

- Movement is stiff. Velocity is set to move*130 each frame: zero acceleration, zero deceleration, no run speed. Instant
  digital movement feels like a prototype, not Kirby. Effort M to add ramp (about 8 to 10 frames) and a faster ground speed.
- Walk speed (130) is only 1.7x the fastest chase (grunt 75), so enemies are easy to outrun and never pressure you.
- Jump is a fixed 2 tiles with a half-height tap. Fine for platforming, but there is no double jump, glide or fly, which is
  the core Kirby verb. Only the Ranger Hop (+50 px) and Mage Float (1.2 s) approximate it, and only if you are that card.
  The Knight, the starting character you hold for the first minutes, has no mobility option except the Charge dash.
- Attack hitboxes: slash 36x24 reach in front, 0.15 s; thrust 56x12 with a 0.16 s lunge; bash 22x30. Slash has no
  cooldown beyond 0.18 s. Because every enemy dies in one touch, spamming Z is the dominant strategy against everything.
- Hit feedback is the best part: hit stop 0.05 s, spark, 1 px shake, flash, thud, card burst. But it is the same for all
  attacks and all enemies, and there is no enemy hit reaction (they simply vanish with a burst).
- Knockback: enemies killed in one hit so none. The player gets a bounce (vy -200, vx -120) on damage, with 1 s of
  invulnerability and no flicker or visible feedback beyond the sound and a 1 px shake (the HP bar is tiny, see section 6).
- Stomp: landing on an enemy kills it and bounces (-260). Good and Mario-familiar, but prevBottom <= e.y + 6 means 6 px
  of forgiveness only; side contact punishes.
- Camera: 0.15 lerp both axes with no vertical dead zone means the screen bobs with every hop (UNVERIFIED by eye; from code).
- Player cannot duck, so projectiles at head height are unavoidable except by jumping (and the warlord's are the reverse, see 1.4).

## 3. Ability audit (all 20; 14 distinct ids, slash is shared by all 5)

Slots A, S, Z, X. Slash is Z for every character, so 5 of 20 slots are the same ability. Thrust is shared by Knight and Rat (X).
Shoot is shared by Ranger and Weaver (A). So distinct abilities: 20 - 4 (slash) - 1 (thrust) - 1 (shoot) = 14.

Knight
- A shield_bash: stun only, no damage. Meh, reads broken (1.3). Redundant w/ slash because stun does not enable anything.
- S charge: BROKEN (1.2). Would be the knight's best verb if fixed.
- Z slash: works, kills grunt. Core attack. Fine.
- X thrust: works, longer reach 56 but narrower. Slightly different (lunge). Redundant with slash since any hit kills.
Ranger
- A shoot: works, killed grunt. Arrow release delayed 0.1 s, speed 380, max 2 in flight. Good ranged option, the one
  genuinely different attack. Pierce? No (arrow is used up).
- S arrow_anchor: 3 tile plank at foot level that lasts 6 s. Makes a short bridge. Useful for gaps, but only one on screen.
  It is drawn as a flat plank in front of you (screenshot) which does not look like an arrow anchor. Situational, level design needed.
- Z slash: same as everybody.
- X hop: air jump +50 px. Useful but tiny. Did nothing visible from the ground (needs air). Weak.
Mage
- A beam: BROKEN against ground enemies (1.1). Cooldown 0.5 s. Visually the best effect in the game.
- S float: 1.2 s hover/slow fall, hold Up to climb at 120 px/s. This is the best traversal verb in the game. Fun. UNVERIFIED in play (read code).
- Z slash: shared.
- X blink: 96 px teleport, also passes through enemies without invulnerability (MEASURED dx 96). Good, a real escape.
Rat
- A leap: -540 vy is about 162 px (5 tiles). A real high jump. MEASURED dy -119 at sample time. Fun, but then the rat's Z/X are weak.
- S scurry: 220 px/s for 2 s, 3 s cooldown. Fine, but speed only. Does not cross anything the normal walk cannot.
- Z slash: shared. X thrust: shared with Knight.
Bone Weaver
- A shoot: shared with Ranger (same arrow, different tint).
- S bone_bridge: 5 tiles for 8 s. Same as arrow anchor but longer. Redundant with the Ranger's S. Also drawn flat.
- Z slash: shared.
- X ghost: 1.5 s contact/arrow immunity, 4 s cooldown. The only defensive tool in the game. Useful against the archer and the boss. Visual (cyan outline) is good.

Verdict: about 5 abilities are both different and fun in principle (arrow, float, blink, leap, ghost). 6 are redundant or
weak (slash x4 duplicates, thrust, bash). 2 are broken (beam, charge). The characters do not "feel" different because the
main kill button is the same slash and because everything dies in one hit regardless.
Suggestions: give each character one unique primary attack on Z instead of slash (Mage beam on Z, Rat dagger flurry, Weaver bone
throw), make bridges one ability with two lengths, and give the mage a free-aim or arc projectile.

## 4. Enemy audit

- Variety on paper: grunt (walks, chases at 75), mud revenant (walks 28, chases 40), rat king (hops every 1.4 s), archer (stands, fires
  every 1.6 s), warlord. In play, grunt and mud revenant behave the same (slow chase, contact damage), only speed differs.
- Telegraphs: none. Archer shows a small ember flare at the muzzle on fire frame only (enemies.js tryFire, Effects.flare), at the same moment the
  arrow exists. Rat king has no crouch before its hop. Grunts have no wind-up. Contact is the only attack, so there is nothing to
  read. The arrow is 240 px/s, 8x4, hard to see at 480x270 (screenshots).
- Threat: contact costs 2 of 10 HP with 1 s of i-frames, so each enemy can take at most 2 HP per second and you have 5 hits per character.
  Plus deaths are free and unlimited, with the hand giving the next character. Net: enemies are a minor tax, not a threat.
- Sight: chase requires |dy| < 64, so enemies on a different row never notice you; they patrol and turn at ledges (fine).
- Distribution: level 1 contains all four non-boss types in 72 tiles (grunt 2, rat king 1, archer 1, revenant 1; MEASURED). There is no
  introduction ramp. Level 7 has 14 enemies in 160 tiles.
- Boss: see 1.4 and 1.5. Walks in, damage sponge, arrows pass overhead, no phases, no arena features. The arena is a flat
  40 x 14 tile room (MEASURED) with one small ledge at mid height. The boss sprite and its huge sword are the most
  impressive visual (sheet1, bottom right), which makes the empty fight a bigger letdown. The exit stays shut until it dies, so
  it is a forced fight. Rating: 2/10. Needs a charge attack with a telegraph, a jump slam, and a phase at 4 HP.

## 5. Level audit (from MEASURED sizes and enemy counts, screenshots, and map for L3)

Size and counts: L1 72x16; L2 120x18; L3 100x26; L4 140x18; L5 130x20; L6 150x22; L7 160x22; L8 40x14.
Each of L1..L7 has 2 to 4 main-route cards, 0 to 4 secret cards, spikes 0 to 10.

- L1 Greenwood Road: flat, a pit, and signs (the first sign teaches "Beat a foe to win its card", seen in screenshot). It has all four enemy
  types in 72 tiles, so it teaches by overwhelming. First pit and first arrow appear almost together. Nothing memorable except the pit.
  Pacing: too dense too early. No safe place to learn each character.
- L2 Bramble Hollow: longer, 6 spikes, rat kings start. Mostly flat ground with floating platforms. Teaches nothing new (spikes are visible, simple).
- L3 Old Watchtower: only 26 rows tall, the only vertical level (gate map shows a staircase of one-way platforms climbing to the exit at top right).
  Climbing is the best idea in the first four levels; 3 archers shoot down the tower which is the first real threat. The exit pocket with
  `=` and `F` at the top is a good payoff. Still one hit, no puzzle.
- L4 Rotting Marsh: 140 wide, 5 mud revenants (the most repetitive crowd), 8 spikes, pits. Screenshots show the marsh as the same green ground and sky as L1, nothing
  marsh-like (no water, no fog, same blue sky; l4 uses the field theme). Theme mismatch with the name.
- L5 Castle Gate: first dark theme. The jump from field to dungeon is the best visual transition in the game (sheet2). Gameplay is the same.
- L6 Undercroft: 150 wide, 10 spikes, 4 archers. Screenshots show a very flat black corridor with a lighter brick floor; hard to read depth (see section 6).
  Long stretches (UNVERIFIED by play) with no new idea. Only 1 secret card and no signs.
- L7 Hall of Faces: 160 wide, 14 enemies, 6 spikes, no power-up. The longest level, and enemies cluster (screenshot: ratking, grunt, archer on one screen).
  Named for the card/hand theme but nothing in the layout uses it (no "choose your character" gating other than secrets).
- L8 Warlord's Throne: 40x14 flat room, the warlord walks 22 s. The only level without any decoration or gating.

Cross-level: the main route is deliberately finishable by any character (design rule), which means no level ever requires a character's ability to
progress. So the card/hand fantasy never matters for the main route. That is the central reason it feels generic. Secrets are the only content that
uses abilities.

## 6. Visual audit (screenshots)

- Good: LPC characters read clearly at 2x, the dark castle theme and level 8 hill silhouettes look good, the beam and slash
  effects have real polish, selection screen cards are clear and the best-designed UI.
- Title: pleasant, but the five heroes just stand at the bottom with the hint text; nothing animated other than idle (UNVERIFIED). "Input check" is
  a menu item that players will not understand.
- Intro: black screen, three lines of text, no art. It reads as a placeholder. Enter works.
- Backgrounds and parallax: one procedural ridge at a fraction of camera speed (scenes.js ~326), same hills in every outdoor level. No clouds, trees in back,
  nothing for marsh, none for dungeon except a darker ridge. Levels all feel the same.
- Terrain: DCSS tiles (brick) plus a bright green flat grass top. Every platform is a flat green rectangle with no edges, so one-way
  platforms and solid tiles look the same in the screenshots (l1_mid, l3_mid); players cannot tell what is passable.
  Dungeon floors are a dark grey slab on orange brick (clashes: the orange brick is the same texture as outdoor soil).
- Art consistency: three styles mixed: LPC characters, DCSS tiles, flat-color procedural pickups (cards are plain rectangles, exit door is a grey rectangle, spikes are tiny).
  The exit `F` is a small grey box that is easy to miss.
- UI: HUD top-left is small (portrait, name, red segmented HP) and tiny at 480x270 logical: the HP bar is 3 px high. The hand slots, card count "0" and secrets counter are fine. The
  ability bar at the bottom with key chips is useful but covers the ground row.
- Text: pixel font is readable at 960x540, but sign text is small, and the selection screen's ability names run to the card's edge ("Blink" clipped at the bottom in the screenshot).
- Effects: some are strong (beam, slash). Arrows are very thin (8x4).

## 7. Audio audit (game/src/sfx.js, 85 lines)

- Only short Web Audio blips: jump, hit, pickup, hurt, ability, beam, complete, boss. Seven or eight effects, all single oscillator tones (tone() = one
  oscillator and an envelope). No music at all, no ambience, no footsteps, no landing, no per-character sounds (every non-beam ability uses "ability").
- With no music, the game has no mood; menus and levels are silent apart from blips. Effort for a looping procedural track per theme: M. Per-ability sounds: S.
- Not tested by ear (UNVERIFIED sound quality; headless).

## 8. Onboarding and flow; card, hand and death system

Flow: title (Play, Input check, Credits) -> intro (3 lines, Enter x2) -> level 1 with banner -> signs -> ... -> level complete panel -> next level -> ending with stats.
- Onboarding: one intro line says what a changeling is ("Beat a foe, its face is yours"). First sign repeats it. There is no tutorial of the 4 abilities, the
  3-slot hand, C to discard, Q to drop, or why dying is okay. The title shows "Arrows move, Up jump, A S Z X powers, Enter pause" which is okay for desktop.
- Everything you need to know to play the Knight is on the ability bar. Good.
- Card system: killing an enemy drops a card (character), you touch it, it flies to the hand (3 slots, extra goes to a hidden deck). On death you pick one of the hand cards and
  become that character; the dead one is lost. Concept is readable in the selection screen (sheet1: "You were slain" with Ranger and Mage cards listing 4 abilities each).
- Problems: (a) the player never needs to choose strategically because the main route does not need any character, and all enemies die to slash; (b) the hand is filled by whichever
  enemy you killed (fixed mapping grunt gives Ranger, etc.), so the choice is not "what do I want to become" but "what did I happen to kill"; (c) you can only become a card by dying or discarding, so using the
  hand voluntarily costs your current character (Q) or a card, which is an actual cost but nothing needs the swap; (d) there is no way to swap without losing your current form, so playing as the Knight to keep him means never
  using the other faces; (e) death is cheap (10 HP, lose the character, lose nothing else), so it never creates tension; (f) HP, hand and deck are all in a small HUD that is easy to miss.
- Interesting hook that is underused: the "lose the face when you die" idea is Fire-Emblem-like and could make characters precious. It would work if the main route had character-specific
  lock-and-key moments and if the player could swap on demand (hold a button to cycle forms for a cost).
- Ending: "The Warlord falls" with stats (deaths, secrets, time). Short and fine; "Secrets: 0 of 23" total.

## 9. Top 15 changes, ranked by fun gained per effort

1. Fix mage beam hit rect to cover the body band (1.1). S. Also lets the user's complaint be closed.
2. Fix Knight Charge: hitbox plus contact immunity while dashing, make it a bowling-ball kill/knockback (1.2). S.
3. Make non-Knight characters not use slash: Z should be a different primary per character (mage beam on Z, rat flurry, weaver bone toss, ranger quick shot). M.
4. Give enemies real behaviors with a telegraph: grunt windup lunge, rat king crouch before hop, archer aim line / flash 0.3 s before shot, mud revenant lobs slime. M.
5. Rebuild the warlord fight: fix the arrow height (1.4), add a charge with telegraph, jump slam with a shockwave, a phase at 4 HP, arena platforms. M to L.
6. Movement polish: acceleration and deceleration, a bit more walk speed (160), variable jump with real tap height, camera look-ahead and a vertical deadzone. M.
7. Add music (one loop per theme, procedural) and per-ability sounds. M.
8. Make the card system matter: add lock-and-key spots in the main route (a gap only the weaver bridge or mage float can cross, a wall only the knight bash breaks) and signs that point to them. M to L.
9. Fix level 1 pacing: introduce one enemy type per level; level 1 is grunts only plus a hop gap, level 2 adds rat kings, 3 archers, 4 revenants. S to M.
10. Distinct terrain art: edge tiles on grass, one-way platform sprite (thin plank), exit door sprite, a coloured spike sprite, marsh theme for level 4 (water, fog tint). M.
11. Make hits and damage readable: flicker the player during invulnerability, bigger HP (hearts or a 6 px bar), screen-edge flash on damage, enemy hit flash and brief knockback for stunned enemies. S.
12. Let the player swap forms voluntarily with a cost (hold Q to cycle through hand cards, current one goes to the bottom, 3 s cooldown). M. Makes the hand a loadout, not a death queue.
13. Make bash do something satisfying: stunned enemies take a guaranteed kill and a shockwave that stuns neighbors; show stun stars. S.
14. Replace the intro with a title card and one painted or silhouette image; show a short "how to play" overlay of the 4 ability slots on first level start and a one-time hint for C and Q. S.
15. Add pick-ups that are not just cards: health hearts dropped by enemies, a checkpoint flag, coins, so exploration and combat feed something besides the hand. M.

Items not verified: any audio quality, real gamepad or touch feel, whether the camera bobs on small hops, whether the Knight bash stun makes contact harmless,
level 6 and 7 layouts beyond screenshots and counts, float behaviour in play, and mobile layout.
