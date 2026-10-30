# Agents start here

Any AI agent (Claude, Grok Bot, Codex, others) working on this repo: read `CLAUDE.md` (rules, check routine, code map), then `research.md` (pillars in section 2, task list in section 9), then the newest entry in `PROGRESS.md`. Work on `main`, push to `main`, one task per commit, task id first in the message. Leave a handoff entry in `PROGRESS.md` before you stop.

Before you change a level: run `python3 game/tools/validate_gates.py` and check any new jump or gate in the real game with `game/tests/probe.js` (the validator is a tile model). `game/tests/tour.js` gives a quick bot run of every level.

Play it live: https://xenodorian.github.io/GameOfGameBecauseGame/ (GitHub Pages from `main`, root; `index.html` redirects to `game/changeling.html`, so rebuild and commit `game/changeling.html` with any `game/src` change or the live game goes stale).

Tests from a clean clone: `npm install` then `npx playwright install chromium` (once per machine), then `npm run check` (validate_gates.py, the full suite, playtest.js). `npm test` or `npm run playtest` run one. On the shared Grok Bot box Playwright is already at `/workspace/GameOfGameBecauseGame-tools/node_modules`: `NODE_PATH=/workspace/GameOfGameBecauseGame-tools/node_modules node game/tests/suite.js`. Run playtest.js as well as the suite: they are separate scripts and the suite does not include it.

