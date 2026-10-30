# Progress and handoff log

Read `research.md` first (pillars in section 2, task list in section 9). Newest entry on top. Use the handoff format in research.md section 7 item 9.

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
