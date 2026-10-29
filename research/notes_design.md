# Design research notes for Changeling (rescue pass)

Date: 2026-10-29. Method: web search and fetch, then notes. Where a source could not be opened, the note says "secondary". Items marked (general practice) are common industry knowledge that I could not tie to a fetched page; treat them as starting points to tune by feel.

Game facts used for the "Apply to Changeling" lines (from CLAUDE.md): 8 levels, 5 characters with 4 abilities each (A S Z X), enemy kill drops a card, hand of 3, death means pick a card and respawn, walk 130 px/s, jump vy -340, gravity 900, 480x270 view, coyote time, jump buffer and hit stop already exist, 10 HP per character.

---------------------------------------------------------------------
## 1. Game feel and juice
---------------------------------------------------------------------

### 1.1 Steve Swink, Game Feel
- Swink's "Principles of Virtual Sensation" (Game Developer) lists seven principles: Predictable Results, Novelty, Traction (good feedback), Low Skill Floor / High Skill Ceiling, Context, Impact and Satisfying Resolution, Appealing Reaction.
  https://www.gamedeveloper.com/design/principles-of-virtual-sensation
- Useful numbers from that article: the player should feel success within "two minutes or less" (traction). Objects seen 5 to 10 seconds ahead make steering easy; objects that appear milliseconds before a reaction is needed make it very hard. Feedback must be immediate; delayed response kills the sensation. Impact is helped by exaggeration, camera shake and particles.
- Another Gamasutra feature describes his categories as input, response, context, polish, metaphor, rules. Sources disagree on the exact list, so do not quote it as canon.
  https://www.gamedeveloper.com/game-platforms/feature-game-feel---the-secret-ingredient-
- Same feature: object placement in a level is a "variable" like jump height. The level and the movement tune each other.
- Apply to Changeling: every ability press must give instant visible and audible response on the same frame. Then tune level gaps to the character's real jump (Rat leap 5 tiles, Knight normal jump) so the level is part of the feel.

### 1.2 Jan Willem Nijman (Vlambeer), "The Art of Screenshake" (2013, INDIGO Classes, Control Conference)
- Live teardown: take a dull side-scrolling shooter and apply about 30 small tweaks, each making it better. Roughly 45 minutes.
  https://gamedeveloper.com/design/vlambeer-co-founder-shares-advice-on-building-better-action-games
- Tweak order from a fan recreation write-up (secondary): lower time to kill, higher rate of fire, bigger bullets, muzzle flash, faster bullets, enemy knockback, permanence (bodies and shells stay), camera lerp, screen shake, player knockback, hit pause, weapon recoil.
  https://dkliao.itch.io/the-art-of-screenshake-recreation (page 404 when fetched; list came from search snippet)
- Example numbers (secondary, Nuclear Throne pistol): camera kicked back 6 px opposite the aim, "add 4 to screenshake", shake fades quickly.
- Camera lerp tip from community: the lerped camera leaves the player behind, so add player velocity and facing to the camera target to look ahead.
- Warnings: shake on fast-firing weapons gets obnoxious; offer a toggle; scale shake to the weapon.
- Apply: Changeling already has hit spark, 1 px shake, flash. Missing candidates: permanence (corpses or dropped debris), enemy knockback on every hit, camera look-ahead, recoil kick on the Ranger shot and Mage beam, and shake scaled by ability weight (bash big, arrow small).

### 1.3 Martin Jonasson and Petri Purho, "Juice It or Lose It" (GDC Europe 2012)
- They took a plain Breakout clone and added about 20 tweaks live. Juice defined loosely as "maximum output for minimum input". Purho's point: interactivity matters more than graphic quality.
  https://gdcvault.com/play/1016487/Juice-It-or-Lose-It (free video; summary via https://jikguard.com/news/video-indies-resist-the-urge-to-juice-it-or-lose-it )
- Tools they used: tweening, squash and stretch, scale pops, color flashes, particles, sound for every event, screen shake, easing. A third-party breakdown recommends starting with sound.
- Counter view: Folmer Kelly's "Don't Juice It or Lose It" (same summit) says polish costs immersion and context is under-considered. Juice must serve the game's tone.
- Apply: juice the card system most. A card drop, pickup, hand fill and respawn-as-new-character should be the most juiced events in the game, because they are the game's identity.

### 1.4 Celeste forgiveness tricks (Maddy Thorson)
Source: https://maddymakesgames.com/articles/celeste_and_forgiveness/ (fetched in full).
Core idea: nearly every technique widens a timing or position window so the game quietly favors the player. The game "wants you to succeed."
- Coyote time: jump still allowed a short time after leaving a ledge.
- Jump buffering: jump pressed shortly before landing fires on the landing frame.
- Half gravity at the jump peak while jump is held: more time to adjust landing, and looks pleasant (apex hang).
- Jump corner correction: if the head hits a ledge corner, nudge the player sideways around it.
- Dash corner correction: sideways dash that clips a corner pops you up onto the ledge.
- Semi-solid popping, lift momentum storage (platform speed adds to jump).
- Wall jump allowed from 2 px away (quarter tile at 320x180); up to about 5 px when dashing.
- Stamina refunds for a certain input.
- Apply: Changeling has coyote and buffer. Add (a) apex half gravity, (b) head corner correction (nudge up to about 4 px), (c) ledge step-up correction when feet clip a tile edge by 1 to 4 px, (d) generous hit and pickup boxes, (e) smaller player hurtbox than sprite.

### 1.5 Typical numbers for movement (general community values, tune by feel)
- Coyote time about 6 frames (about 100 ms at 60 fps); some use up to 0.1 to 0.2 s. Source: https://tilebasedworlds-com.pages.dev/tutorial/a-side-scrolling-world/going-further (comment "~100ms at 60fps") and GMTK Platformer Toolkit devlog https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code (suggests about 0.2).
- Jump buffer about 6 frames before landing (secondary).
- Variable jump height: on early release multiply upward velocity by about 0.7 to 0.85 (tilebasedworlds page above), or apply a stronger gravity multiplier while rising and released ("jump cutoff", GMTK devlog).
- Falling gravity multiplier above 1 for a "snappier landing" (GMTK devlog). Typical 1.3 to 2.0 (general practice).
- Separate ground and air acceleration, a separate turn speed when input opposes motion, deceleration when no input (GMTK devlog).
- Gravity from jump height H and time to apex t: g = -2H / t^2 (GMTK devlog).
- Fall speed cap (terminal velocity) so the player can read the landing: about 1.5x to 2x jump speed (general practice).
- Squash and stretch: stretch vertically on jump launch and fall, squash on landing for 3 to 6 frames, keep the collision box unchanged (general practice; also in Juice It or Lose It).
- Apply: Changeling jump vy -340 and gravity 900 gives apex height 340^2 / (2*900) = about 64 px (2 tiles) and time to apex 0.38 s. Check: is there a fall cap, a rise/fall gravity split, and a jump cut? If not, add all three. Visible before/after is large.

### 1.6 Super Meat Boy
- Movement is three verbs: run, jump, wall slide. Jump height depends on button hold. Variance raises the skill ceiling, since a single fixed jump makes many layouts trivial or impossible.
  https://www.gamedeveloper.com/design/making-meat-boy-move
- Level rules: hazards shape the jump; spikes above force short hops. Levels act as tutorials for one movement skill each. Instant restart keeps flow (general knowledge, not in the fetched article).
- Apply: Changeling death is a pick screen, which is slower than a restart. Keep that screen fast (under 2 s to first input) and make the respawn instant after the choice.

### 1.7 Hit stop (Sakurai Famitsu column, Smash Bros)
Source: https://sourcegaming.info/2015/11/11/thoughts-on-hitstop-sakurais-famitsu-column-vol-490-1/
- Both attacker and victim freeze the same time; stronger attacks freeze longer. Tune per attack (tip of a sword gets more than the edge). There is a maximum.
- Projectiles get less hitstop than melee. Electric attacks get more.
- During the freeze the victim vibrates: grounded characters shake side to side, airborne up and down (so the feet do not clip into the floor). The shake starts large and decays.
- After the first flinch frame, move into the pain pose over 4 frames, not a hard cut.
- Hurtboxes stay in place during vibration so hits do not miss.
- Reasonable range: 2 to 4 frames for light, more for heavy (about 33 to 67 ms at 60 fps) (secondary: https://www.ssbwiki.com/Hitlag , https://gamejuice.pages.dev/articles/hit-stop-frame-trick ). Use a fixed fraction of a second, not frames tied to frame rate, if the game runs variable fps (forum tip from the same search).
- Sakurai also says hit stop on death or a strong enemy kill gives the moment weight and gives the player a second to understand what happened (https://punishedbacklog.com/masahiro-sakurai-on-creating-games-is-wonderful/). Sources also say he coined "boss stop" for a freeze when a boss falls (secondary: https://www.gamesradar.com/smash-bros-masahiro-sakurai-has-started-a-fascinating-youtube-game-design-series ).
- Apply: Knight bash 0.08 s, slash 0.05 s, arrow 0.03 s, beam tick 0, warlord kill 0.25 s plus slow-mo. Add victim shake side to side only.

### 1.8 Knockback and hurt feedback (general practice)
- Hit: stop, flash white for 2 to 3 frames, knockback away from the attacker, and an audible thud.
- Player hurt: invulnerability blink (already 1 s), brief knockback, clear HP change, screen red edge for 0.1 s.
- Enemy death: a pop, a burst of particles, the card flying out with an arc, not appearing instantly.

### 1.9 Enemy readability under juice
- Telegraph state should be visible even with all effects on; do not let particles hide the enemy's wind-up. Keep enemy sprite brighter than effect layers.

---------------------------------------------------------------------
## 2. Platformer level design
---------------------------------------------------------------------

### 2.1 Teach, test, twist / kishotenketsu
- Mark Brown (GMTK) on Super Mario 3D World: each stage is a short, self-contained showcase of one idea. A mechanic is introduced, developed, given a twist, then dropped (about 5 minutes). Based on the East Asian narrative structure kishotenketsu per director Koichi Hayashida. First step is a safe place where the player can fall without dying.
  https://www.mcvuk.com/development/video-nintendos-level-design-secrets-in-four-steps (fetched), plus https://www.engadget.com/2015/03/17/super-mario-3d-world-design/ (secondary). Video itself not retrieved.
- Four beats: Introduction (safe), Development (more complex use), Twist (unexpected change or combination), Resolution (conclude, drop the idea).
- Contrast: kishotenketsu has no villain or conflict; the "twist" comes from new context, not harder enemies.
- Apply to each Changeling level: pick ONE idea per level. Example mapping:
  - L1 Greenwood Road: walking, jump, a sword hit, picking up a card. Twist: first death selection happens safely.
  - L2 Bramble Hollow: Ranger arrow anchor across a gap (teach safe, develop with spikes, twist: a gap that only the Ranger or Rat can pass, fine since every character can finish main route).
  - L3 Watchtower: vertical climb with one-ways, twist: enemy archer above.
  - L4 Marsh: hazard floor, bridges (Bone Weaver bridge shown by an NPC example).
  - L5 to L7: combine, "which card do I want to hold here" decisions.
  - L8 Warlord.
- Rule: if a level has two or three ideas, cut one.

### 2.2 World 1-1 as the model for the first 30 seconds
- Teaches jumps, hazards and power-ups with no text; about 90 seconds long; the first Goomba walks toward the player so the player learns to jump; the first mushroom is trapped so it slides into Mario; pits appear only after the player has a way to cross them.
  https://dev.to/gg_news/ign-miyamoto-explains-how-mario-world-1-1-was-created-36bm (repost of an IGN piece, secondary) and https://blakecrosley.com/blog/design-philosophy-shigeru-miyamoto
- Apply: first 30 seconds of Changeling: empty flat ground to feel movement (5 seconds), one slow grunt coming at the player, a kill, a visibly flying card, a pick-up with a big flash, the hand slot filling. No pit, no archer before this. The first thing the player learns must be the signature loop (kill, card, become).

### 2.3 Safe introduction of mechanics
- Hollow Knight King's Pass: environmental prompts (a roadblock invites attack), a dip forces a jump, the first enemy is lured to ground level so the player practices safely, the SOUL tutorial comes after the first fight, spikes cost 1 HP right away so stakes show early, visible but unreachable areas signal future goals, optional left path rewards curiosity.
  https://indiegameculture.com/hollow-knight/hollow-knights-tutorial-is-a-design-masterclass (fetched). Note: another essay (https://mechanicsofmagic.com/2025/05/17/critical-play-worldbuilding-28/) claims nearly no formal onboarding exists; the two disagree on how explicit it is.
- Apply: introduce each ability's use in a space that forces it once, with no penalty for missing (a shallow pit with a way back). Teach the death-selection screen in L1 by a harmless early death (e.g. a gentle spike at 2 HP cost, since HP is 10).

### 2.4 Pacing and rhythm
- Alternate tension and release: combat room, breather with a card or secret, vertical challenge, breather. Change the pace every 20 to 30 seconds (general practice).
- Vary the shape: flat run, climb, drop, tight corridor, open arena.
- Put a visual landmark (a tower, an unusual tree, the exit flag silhouette) visible from far, so the player always has a direction. Swink: objects seen 5 to 10 seconds ahead make steering easy (principles article above). In a 480x270 view, that means design sight lines so the next hazard is on screen at least 1 to 2 seconds before reaching it.

### 2.5 Secrets and reward placement
- Hollow Knight: a charm sits behind a spike pit crossable with pogo; the player who works it out early gets the reward, others return later (same Indie Game Culture article).
- Rules: foreshadow (a visible unreachable ledge, a suspicious cracked wall `x`), reward is a card or power-up the player cares about, never leave the main route's mastery dependent on it.
- Changeling has gated secrets by character; make the gate readable: a small icon or a glowing ledge at the right height, so the player thinks "I need a Rat here".
- Place the first secret in L1 and make it easy: a visible card on a ledge that needs the Knight's normal jump. This teaches that secrets exist.

### 2.6 Level layout checklist (general practice)
- Vertical variety, not only left to right.
- Enemy before hazard, never both together for the first time.
- A checkpoint-like safe space before a boss. Changeling has "closest safe space" respawn, which does the same job.
- Remove dead stretches longer than 10 seconds with nothing to do.

---------------------------------------------------------------------
## 3. Kirby style copy abilities and the card/hand system
---------------------------------------------------------------------

### 3.1 Why copy abilities exist
- Sakurai wanted Kirby to keep easy play for beginners but give skilled players more to do. Programmer Hiroaki Suga: each ability lets the player approach a level a different way, for example the Parasol lets a level be finished in a new way instead of just flying to the end. Over 40 enemy abilities were tried, only the strongest kept.
  https://en.wikipedia.org/wiki/Kirby%27s_Adventure and Prima eGuide excerpt (https://primagames.com/eguides/playing-with-super-power-nintendo-snes-classics-eguide/kirby-super-star/the-evolution-of-the-inhale , reached via search only; the direct fetch returned 403).
- Apply: cut or merge abilities that are not clearly distinct. Four per character is a lot; the weaker slots (many characters share slash) are the likeliest to feel redundant. Each character should have one signature verb that no other has, and the level should invite it.

### 3.2 Kirby Super Star
- Each ability "drastically expanded"; up to about a dozen moves per ability via direction plus button; first Kirby with an in-game move list.
  https://retronauts.com/article/565/super-nes-mini-countdown-11-kirby-super-star
  Uneven power between abilities is acknowledged there.
- Helper system: Kirby can sacrifice his ability to summon a helper using it. Created for co-op camera reasons (previous game had Kirby speed vary wildly with abilities). That concept also drove hats on abilities and helpers using abilities.
  https://nintendoeverything.com/sakurai-shares-development-details-on-kirby-super-star/ and https://en.wikipedia.org/wiki/Kirby_Super_Star
- Apply: Q to drop your face is the Kirby "discard". Consider making it do something useful: dropping a character leaves a short-lived ally or a decoy for 5 seconds (the helper idea). This turns the loss into an interesting choice rather than pure punishment.

### 3.3 Visual identity: hats and tells
- Hats highlight one prominent trait of the copied character; sound and pose can echo the source too.
  https://www.ssbwiki.com/Kirby_hat
- Fan critiques show legibility pressure: the costume must not hide Kirby's face and silhouette (same search).
- Apply: each Changeling character needs a silhouette readable at 32 px tiles: Knight (helmet plume), Ranger (hood and bow), Mage (pointed hat), Rat (long tail and ears), Weaver (skull mask). A colored outline or a tint on the HUD card matches.
- Each enemy should telegraph the card it gives by its look: grunt looks like the Ranger, archer has a bone mask, rat king has a crown and rats. Prior session notes say these exist in some form; check that on-screen the enemy sprite and the dropped card art match.

### 3.4 Distinct verbs
- Fun comes from each character changing how the same space is solved, not from damage numbers. Mapping to Changeling:
  - Knight: break (cracked walls), bash. Verb: smash.
  - Ranger: ranged, rope bridge. Verb: reach.
  - Mage: float, blink, beam. Verb: bypass.
  - Rat: tiny, high leap. Verb: climb.
  - Weaver: bone bridge, ghost. Verb: build / phase.
- Rule: each level should have at least two spots where character choice changes the solution, but always keep a baseline route for everyone (already a game rule).

### 3.5 Sakurai, "Masahiro Sakurai on Creating Games" (YouTube)
- Channel launched August 2022; topics include hit stop, frame rate, risk/reward systems; videos 5 to 10 minutes.
  https://www.gamesradar.com/smash-bros-masahiro-sakurai-has-started-a-fascinating-youtube-game-design-series , https://automaton-media.com/en/news/20220824-15208/
- Verified lessons: (1) design around hardware and screen: Kirby's Dream Land was made easy partly because the small Game Boy screen made threats hard to see; (2) low barrier raises audience; (3) hit stop gives weight; (4) boss fights with one prescribed solution feel like "tutorials" (source: https://www.levelup.com/noticias/son-como-tutoriales-sakurai-critica-las-peleas-contra-jefes-en-juegos-de-nintendo/ , in Spanish) and he prefers games where the player picks how to fight.
- I could not get a source for his exact words on telegraphing or risk/reward details. Do not quote him on those.
- Apply: the boss should allow several answers: Ranger from range, Knight melee in punish window, Mage beam from a safe platform.

### 3.6 Applying copy abilities to a hand of 3 cards
(design proposals, not sourced)
- The hand is the unique hook: pick a character before an encounter. Make the choice matter by having a visible "which card helps here" cue: e.g. a sign, a wall type, or the enemy mix.
- Allow quick swap between hand cards without dying (a button that cycles the active card with a short cooldown and a puff), otherwise the hand is just a lives counter. Currently death or Q is the only way to change; that makes the "changeling" fantasy rare. If swapping is out of scope, at least make Q fast and juicy.
- Show card portraits and HP clearly. The three cards should look like a hand of playing cards at the bottom with the active one raised.
- Dead character is lost: soften by making death selection feel like a tactical choice. Keep it quick.
- Drops: on a kill, the card should pop up, arc, and wait for a short time; kill rewards must feel like a gift.

---------------------------------------------------------------------
## 4. Enemy design for platformers
---------------------------------------------------------------------

### 4.1 Telegraphs
- Telegraph = tell the player what will happen so they can respond. Fairness: players must know damage is coming before it lands. Delivered by animation (wind-up for melee, aim for ranged), sound, VFX (charge particles, flash), voice, rumble. Not long: "it doesn't have to take 3 minutes."
  https://gamedeveloper.com/design/enemy-attacks-and-telegraphing (fetched).
- Rough timing scale from a low-authority design doc (illustrative only): light attacks 0.4 to 0.6 s, moderate 0.8 to 1.2 s, lethal 1.5 to 2.5 s.
  https://salt-and-steel.pages.dev/docs/15/boss-design
- Apply: Archer: 0.5 s aim pose with a lit line or flash before the arrow. Rat king: crouch for 0.3 s before the hop. Grunt: raises club 0.3 s when in range. Make the enemy sprite itself change (squash, color pop) plus a short sound.

### 4.2 Readable states
- Every enemy has at most 3 visible states: idle/patrol, alert/wind-up, attack/recover. Each with a distinct pose and a tiny icon or color flash (exclamation mark style) for alert.
- A stunned or vulnerable state needs a clear look (stars, tint) so the player knows the punish window.
- Enemies face their direction of motion (already fixed in T3).

### 4.3 Variety from few enemies
- Small roster used consistently (SRB2 level design guide, via search snippet; direct fetch returned 403): https://wiki.srb2.org/wiki/Level_Design_101/Enemy_placement
- Bobo the Cat placement notes (fetched): unique behavior per enemy, no reskins; roster should collectively require the player's whole ability set; give more than one way to beat each challenge; combine enemies (protect a priority target with another, stack to make a taller obstacle, stationary shooter on a mobile enemy); avoid overcrowding; do not lock players into rooms of random enemies.
  https://afterjourneysend.substack.com/p/bobo-the-cat-2022-placing-enemies
- Caveat from the SRB2 search result: moving one identical enemy one tile does not make a new challenge. Variation has to change the geometry: enemy on a ledge above, enemy below a one-way, archer covering a gap, rat king in a corridor with a low ceiling, grunt next to spikes so a knockback is dangerous.
- Behavior drives difficulty: a randomly hopping enemy is more dangerous than one that only walks or only hops (gamedev.net thread: https://gamedev.net/forums/topic/667381-basic-enemy-design ).
- Apply: 5 enemy types, 8 levels. A "combo recipe" list for placement: archer plus grunt (shield the archer), rat king over a pit, grunt before a spike line, two grunts from both sides, mud revenant at a choke point. Use each recipe once or twice; do not repeat the same setup three times.
- Which card does the enemy drop? Show it. A little card icon floating over the head of an enemy that drops a rare card is a strong pull.

### 4.4 Boss pattern design (phases, tells, punish windows)
(Low authority blog sources, treat as common ground.)
- Each attack has three moments: telegraph, react, punish. https://scoutski.github.io/posts/boss-design/ and https://salt-and-steel.pages.dev/docs/15/boss-design
- Fight rhythm = attack window, punish window, recovery window, learned by feel. A fair death is one where the player can name what to do differently ("oh, I see what I should have done").
- Phases should add new mechanics or recombine old moves at health thresholds, not just give bigger numbers; avoid unannounced instant-hit moves after a phase change. A late phase can speed up earlier moves, which keeps mastery relevant.
- The vulnerability window must be readable and have a noticeable payoff.
- Warlord proposal (8 HP, so 3 phases of about 3, 3, 2 hits):
  - Phase 1 (8 to 6 HP): charge across the arena. Tell: stomp and dust for 0.7 s. Punish: he is stunned for 1.5 s after hitting the wall.
  - Phase 2 (5 to 3 HP): jump slam creating shockwaves along the floor that must be jumped. Tell: crouch and glow. Punish: 1 s recover.
  - Phase 3 (2 to 1 HP): summon two grunts or fire arrows from the archer spots, plus faster charges. Last hit: freeze, white flash, slow motion (boss stop), card drop.
- Since the exit only opens after death, show the exit shutter unlocking.
- Let the player win with any card: Ranger shoots during the long stun, Mage beam hits during the tell, Knight bashes.
- Fight at 8 HP is short. Take 60 to 120 seconds, not more. Give each hit a big reaction (shake 3 px, hit stop, knockback) so 8 hits feel meaty.

---------------------------------------------------------------------
## 5. Demo and vertical slice design
---------------------------------------------------------------------

### 5.1 Length and shape
- Presskit.gg guide: aim for about 15 to 30 minutes for most genres; under 10 feels unfinished; over 45 rarely finished on stream. https://presskit.gg/field-guides/how-to-build-game-demo
- A marketing blog claims 30 to 60 minutes is the sweet spot and that demos with intro, escalation and climax convert 3 to 5 times better (unverified): https://gtstu.com/2026/06/06/game-demo-strategy-indie/ . The two sources disagree; the request here is 10 to 20 minutes so use the presskit range.
- Chris Zukowski's survey data (secondary): 68 to 88 percent of Next Fest wishlists came from people who did not download the demo; the store page does the converting. A demo should still be solid, but a good trailer and capsule art matter just as much. https://presskit.gg/field-guides/analyzing-next-fest-results , https://www.steampageanalyzer.com/blog/do-steam-demos-increase-sales
- Presskit.gg: include the polished core loop, your best visual moment, a clear sense of progression, and your most unique mechanic. Keep tutorials under about 3 minutes, no text walls. End at a cliffhanger at peak engagement and show an end screen immediately with a thanks, wishlist ask and feedback link. Common mistakes: half-finished systems, buggy content (players quit, they do not report), neat complete ending that satisfies the urge to buy, long tutorials.
- For a free browser game with no store: the "end screen" should be the credits plus a replay prompt.

### 5.2 Changeling demo outline (proposal)
- Total 12 to 18 minutes. Use levels 1 to 3 plus level 8 boss? Option: cut the middle levels out of the demo path and make 5 polished levels (1, 2, 4, 6, 8) rather than 8 rough. Reviewers say "flat design", so fewer, better levels is the stated goal.
- Minutes 0 to 1: movement, first kill, first card.
- Minutes 1 to 4: second ability use, first gap that asks for a card change.
- Minute 5 to 8: first death and selection screen taught in a safe place.
- Middle: one set piece (see 5.3).
- Final 3 minutes: Warlord with a visible health bar and readable phases.
- Ending: stats screen and "your hand" showing every character collected, and a stinger that hints at more.

### 5.3 Memorable set piece (proposals)
- The Hall of Faces: a long room of statues; the player must change card to pass each statue, ending in a mirror that shows all five forms. This showcases the one unique mechanic.
- The Watchtower chase: a rising hazard (flood or rot) chases the player up the tower; during the climb the player is forced to swap cards.
- A "card rain" moment after the boss: every defeated enemy type drops its card in a shower, visible reward and a fanfare.

### 5.4 Celeste Classic (PICO-8) lessons
- Made in four days for a jam; 128x128; minimal controls (jump, dash, climb); precision over visual detail. Drew on Super Mario Bros. 3 and bouldering.
  https://en.wikipedia.org/wiki/PICO-8 , https://www.wikipedia.com/wiki/Celeste_(video_game)
- I could not verify from sources that every room is one screen or the dash refill detail (general knowledge: it is, and it refills on ground). Lesson stays: few verbs, deep use of them, fast retry.

### 5.5 Hollow Knight demo
- Prototype demo had only Dirtmouth, King's Pass and Forgotten Crossroads; an attendee finished most of it in one two-hour session; bugs did not stop early-area progress. https://teamcherry.com.au/kings-pass-gameplay-playtests-conventions-team-cherrys-working-hard/ , https://tcrf.net/Proto:Hollow_Knight
- Lesson: a small slice with strong atmosphere and clear systems wins. Players tolerated roughness because the core felt good.

### 5.6 Polish over breadth (all sources agree)
- Cut weak content. A demo with 5 solid levels beats 8 uneven ones. Remove half-finished things (for Changeling: abilities that are duplicates or unclear).

---------------------------------------------------------------------
## 6. Visual presentation for small pixel art games
---------------------------------------------------------------------
(Sources: mostly blog-level; consistent.)
- Silhouette over detail at small size: player, enemies, pickups and hazards need shapes distinct at a glance. Backgrounds lower contrast and muted, with the strongest colors reserved for interactive objects. Clear delineation between foreground and background. Check art in motion at actual game size. Integer scaling avoids blur.
  https://bugnet.io/blog/how-to-make-pixel-art-that-reads-clearly (search snippet only; page fetch returned an index), https://www.sprite-ai.art/blog/pixel-art-backgrounds
- Parallax: three layers is a common start; far layer low contrast and desaturated.
- Palette discipline: a limited palette, with a separate palette per theme (field vs dungeon already exist). Use warm accents against cold backgrounds for hits (the effects pass already does this, per CLAUDE.md section 5).
- UI clarity: HUD small, high contrast, in the corners; the hand of three cards always visible; cooldowns shown as a fill on each ability icon; one font (Pixelify Sans exists).
- Screen transitions: iris wipe or quick fade (0.2 to 0.4 s) when entering a level, a short hit-pause before the death selection screen; avoid hard cuts (general practice).
- Particles: dust on run/land, pickup sparkles, ambient floaters (fireflies in field, embers in the castle). Use few but readable ones; do not cover the player.
- Landmarks and lighting: torches with a light pool in the castle (Glow.light exists). Fog or a gradient near the bottom adds depth cheaply.
- Foreground tiles with a bright 1 px top edge ("grass line") so the walkable surface reads instantly. Mid-ground decoration (trees, signs) must be darker or less saturated than the platform tiles.
- Level banner covering sprites for 2.5 s (known) is a readability problem: move to the top corner, smaller.

---------------------------------------------------------------------
## 7. Audio feel
---------------------------------------------------------------------
- Layer each effect: a sharp transient for snap, a body layer, a low boom for weight. Several variants per action (3 to 5), slight pitch randomization, about +-2 to 5 dB volume change, subtle stereo shift.
  https://creatorsoundspro.com/creating-game-juice-using-sound-effects-to-improve-player-feedback , https://sound.krotosaudio.com/?p=1523
- Trigger on input, not on animation end; sync impacts to the collision frame (same creatorsoundspro page).
- Jump sound: short impulse about 75 to 100 ms with a slight pitch rise, plus a longer sweep; character weight guides the sound (heavy = deep thump, agile = light swoosh). https://blog.criware.com/index.php/2023/09/06/platformer-jump/ (via search).
- Hit sounds as a sequence: swing, impact, enemy reaction, damage confirmation.
- Repeated identical jump or step sounds become tiring (itch.io jam feedback, https://itch.io/post/13390976 via search). Randomize pitch.
- Changeling is generated in code (Web Audio), so pitch randomization and layered noise plus sine thumps are easy. Per ability: distinct timbre per character (Knight metal clang, Ranger twang, Mage shimmer, Rat squeak, Weaver bone clatter), so the player hears who they are.
- Card pickup: rising arpeggio of 3 notes. Hand full: a soft dull note. Death selection: low drone with a tick as the cursor moves. Boss phase change: stinger.
- Music: a menu theme plus one loop per theme, with a vertical-layer intensity track in boss or combat. Minimal version: one base loop always plays, one intensity layer fades in based on one parameter such as "enemies near". Stems must have the same length and tempo and start at the same AudioContext time; fade with curves; smooth the parameter so it does not flutter. Add a stinger on boss defeat and level complete.
  https://bugnet.io/blog/adaptive-music-a-beginners-guide , https://abratabia.com/web-game-audio/dynamic-game-music.php , https://www.gamedeveloper.com/game-platforms/pure-vertical-layering-for-game-music-composers-from-spyder-to-sackboy-gdc-2021-
- No evidence found on how much adaptive music specifically matters for a platformer demo; treat it as nice to have. A simple catchy looped melody per theme matters more than layering.
- Ducking: lower the music 3 dB for 0.2 s on big hits so the sound pops through (general practice).

---------------------------------------------------------------------
## 8. Gaps and caveats
---------------------------------------------------------------------
- Could not open: the Art of Screenshake video itself, the GMTK video transcript, Sakurai's videos, the DK Liao list page (404), SRB2 wiki (403), Prima Games page (403), gamejuice.pages.dev pages (placeholder only).
- Sakurai's statements on telegraphing and risk/reward: not verified.
- Numeric tuning values (frames, multipliers) come from tutorials and blog posts; they are starting points.
- Boss timing numbers come from a low-authority design doc.
- The demo length numbers conflict across sources (15 to 30 vs 30 to 60).
- Anything marked "proposal" is mine, not sourced.

---------------------------------------------------------------------
## 9. Top 25 actionable principles for Changeling (ranked by player impact)
---------------------------------------------------------------------
1. Make the card loop the star: kill, card pops out in an arc, pickup with flash and sound, slot fills; this must feel great every time.
2. Fix the first 30 seconds: flat run, one slow grunt, kill, card, no hazards, no text wall.
3. Give each character one signature verb that opens a different route, and make every level have two or three places where card choice changes the solution.
4. Add jump polish: variable jump height with early-release cut, higher gravity on the fall, a fall-speed cap, and half gravity at the apex.
5. Add corner correction (head bonk nudge and ledge clip step-up) so the player is almost never blocked by a 1 to 4 px miss.
6. Every enemy attack gets a 0.3 to 0.6 s tell (pose change, flash, sound); the dangerous ones get more.
7. Hit stop per attack (2 to 4 frames light, 5 to 8 heavy, longer on kills), with side to side victim shake and a white flash.
8. Enemy knockback and a hurt pose on every hit, so the player sees cause and effect.
9. Build each level around one idea: teach safely, develop, twist, drop it.
10. Cut to fewer, better levels for the demo (5 polished beat 8 uneven), and cut or merge duplicate abilities.
11. Make the Warlord a real fight: three phases, a clear tell per move, a readable stun window, and a dramatic last hit with boss stop and slow-mo.
12. Add a set piece (Hall of Faces or a chase tower) that shows off card swapping.
13. Make death selection fast and tactical: under 2 s to first input, big card art, instant respawn after choice, and a good sound.
14. Let the player swap hand cards (or at least make Q fast) so the Changeling fantasy happens often, not only when failing.
15. Distinct silhouette and colour per character and enemy, readable at 32 px, with enemies showing which card they give.
16. Layered, pitch-randomised sound per action with a distinct timbre per character; trigger on input.
17. Add one looping music track per theme plus a boss track and stingers (pickup, level clear, boss kill).
18. Make backgrounds quieter than the playfield: low contrast far layers, bright 1 px top edge on walkable tiles, interactive things in the strongest colours.
19. Foreshadow secrets (visible unreachable ledge, cracked wall) and reward them with cards or power-ups; put one easy secret in level 1.
20. Pacing: alternate combat, breather, vertical climb, breather; no dead stretch over 10 seconds; place landmarks so the next goal is visible.
21. Vary enemies through placement recipes (archer above a gap, rat king in a low corridor, grunt beside spikes) rather than adding types; do not repeat a recipe three times.
22. Camera: look ahead in the facing direction and lerp smoothly; show the next hazard at least 1 to 2 s before reaching it.
23. Scale screen shake and flash by ability weight and offer a reduced-shake option; avoid shake on rapid fire.
24. Screen transitions and level intro: short wipe, small corner banner (not over the sprite), a one-second freeze before death selection.
25. End the demo at a peak: stats screen with all collected faces, a stinger, and a hint of what comes next; no cooldown before the end screen.
