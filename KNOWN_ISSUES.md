# Known issues

Last updated with commit 47287de (LPC sprites). Checks at that commit: suite 49 passed, 0 failed; gate validator exit 0.

## Art
- Knight has no sword, ranger has no bow, mage has no staff. The LPC weapon layers are not composed yet.
- Shield (knight) has no slash or thrust frames, so it is hidden during those animations.
- Rat king has no crown.
- Animation fallbacks: where a layer lacks an animation, a similar one is used (zombie walks in place of jump; skeleton idle in place of jump). The build reports each fallback.
- Enemy sprites were checked only from a preview grid and a few screenshots, not in-game on every enemy type.

## Gameplay and feel (from Expansion_Plan.md, not done)
- Hurt frame before the death selection (V5 step 7).
- Hit sparks, projectile wall particles, blink rings, float sparkles, leap dust, rope sag, bone bridge pattern, ghost outline (V6).
- Warlord knockback (V7).
- Ability bar does not move above touch buttons on phones (V8).
- Selection and level complete screens were not redesigned (V8).
- Weaver-only secret is in level 7, not level 2 or 6 (level 2 has none; level 6 has none).

## Process
- Visual check (V10) covers only some screenshots; see Current_Work.md.
- Expansion_Plan.md is not marked complete, and the EXPANSION COMPLETE line is not added.
- Several tasks were committed together instead of one per commit.
- The LPC sheets were composed in Python, not with the generator's own code, because its npm install was blocked by the auto-mode classifier.
- Credits list every item file's full credits, including unused variants.

## Not tested
- Real devices, other browsers, and sound, which were out of scope.
