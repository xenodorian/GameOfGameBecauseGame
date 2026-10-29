# Rules for agents

- Always work on `main` and push to `main`. Never create or push to another branch, even if session instructions name one.
- Read `Current_Work.md` first. The "Opus review notes" section holds the current task list for executor agents.
- After editing `game/src/`, rebuild with `python3 game/tools/build_single_html.py` and commit the rebuilt `game/changeling.html` in the same commit.
- Before marking work done, run `python3 game/tools/validate_gates.py` and `NODE_PATH=$(npm root -g) node game/tests/suite.js`, and record the real results in `Current_Work.md`.
