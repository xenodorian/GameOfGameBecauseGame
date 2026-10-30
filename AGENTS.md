# Agents start here

Any AI agent (Claude, Grok Bot, Codex, others) working on this repo: read `CLAUDE.md` (rules, check routine, code map), then `research.md` (pillars in section 2, task list in section 9), then the newest entry in `PROGRESS.md`. Work on `main`, push to `main`, one task per commit, task id first in the message. Leave a handoff entry in `PROGRESS.md` before you stop.

Before you change a level: run `python3 game/tools/validate_gates.py` and check any new jump or gate in the real game with `game/tests/probe.js` (the validator is a tile model). `game/tests/tour.js` gives a quick bot run of every level.
