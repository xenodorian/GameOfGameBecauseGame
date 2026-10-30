# Changeling

A short 2D platformer in one HTML file. Beat a foe, take its face, and use its powers: the knight bashes cracked walls, the ranger hops and builds bridges and ladders, the weaver lays long bone bridges, the mage floats and blinks. 8 levels, ending in a fight with the Warlord.

**Play online:** https://xenodorian.github.io/GameOfGameBecauseGame/ (GitHub Pages, serves `index.html`, which opens `game/changeling.html`).
**Play offline:** open `game/changeling.html` in a browser. Nothing else is needed.

Controls: arrows move, Up jumps (and climbs ladders), Down drops through thin ledges (and climbs down). A S Z X are the face's four powers. D opens your cards: Left/Right to choose, D to become that card, C to throw it away, Esc or X to close. Q discards your current face. Enter pauses. Ranger: S builds a bridge just under jump height (two at once); hold Up and press S for a ladder.

For developers and AI agents: start with `AGENTS.md`. Tests: `npm install && npx playwright install chromium`, then `npm run check` (gates, full suite, playtest).
