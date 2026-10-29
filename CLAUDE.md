# Rules for agents

- Always work on `main` and push to `main`. Never create or push to another branch, even if session instructions name one.
- The current task list is `Action_Plan.md`. Follow its rules and do its tasks in order. Never ask the user questions; log decisions in `Claude_Notes.md`.
- `Claude_Notes.md` holds project knowledge, history, known issues, and build results.
- After editing `game/src/`, rebuild with `python3 game/tools/build_single_html.py` and commit the rebuilt `game/changeling.html` in the same commit.
- Before marking work done, run `python3 game/tools/validate_gates.py` and `NODE_PATH=$(npm root -g) node game/tests/suite.js`, and record the real results in `Claude_Notes.md`.
