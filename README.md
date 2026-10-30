# Changeling

A short 2D platformer in one HTML file. Beat a foe, take its face, and use its powers: the knight bashes cracked walls, the ranger hops and ropes, the rat leaps, the weaver bridges, the mage floats and blinks. 8 levels, ending in a fight with the Warlord.

**Play online:** https://xenodorian.github.io/GameOfGameBecauseGame/ (GitHub Pages, serves `index.html`, which opens `game/changeling.html`).
**Play offline:** open `game/changeling.html` in a browser. Nothing else is needed.

Controls: arrows move and jump, A S Z X are the face's four powers, D swaps faces, Enter pauses.

For developers and AI agents: start with `AGENTS.md`. Tests: `npm install && npx playwright install chromium`, then `npm run check` (gates, full suite, playtest).
