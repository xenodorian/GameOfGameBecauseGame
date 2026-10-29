# Notes: AI agents building games, and how to get fun out of them

Date: 2026-10-29. Method: WebSearch and WebFetch. Some sites failed (aiproductivity.ai returned 410). Items marked INFERENCE are my own reasoning, not from a source. Items marked ANECDOTE are single developer blog posts, not studies. I found no paper that measures whether LLM-built games are fun, and I found no hard tuning numbers for Celeste from its author. I did not open the arXiv papers themselves, only search summaries.

## 1. Anthropic guidance (primary sources, fetched)

### 1.1 Effective harnesses for long-running agents
URL: https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- Two-part setup. First session is an "initializer" that writes `init.sh` (start the app), a progress log, a first git commit, and a feature list. Later sessions are "coding" agents. Same tools, different first prompt.
- Feature list is a JSON file, 200+ items in their example. Each item has category, description, test steps, and a `passes` flag that starts false. Coding agents may only flip `passes`. JSON was picked because models alter it less than Markdown. Agents are told that removing or editing tests is unacceptable.
- One feature per session. Commit with a clear message. Update the progress file. Git lets the next session revert a bad change.
- Start of every session: check directory, read git log and progress file, read the feature list, run `init.sh`, run a basic end-to-end test BEFORE new work. This catches bugs left by the last session.
- Failure seen: the agent marked features done after unit tests or `curl` only. Fix: tell it to test like a human through browser automation (Puppeteer). That "substantially improved" results and found bugs code review missed. Limit: it could not see native browser alert dialogs.
- Failure seen: declaring the whole project finished too early. Fix: the explicit feature list.
- Open question the authors raise: would separate QA or testing agents beat one general agent.
- Relevance: our CLAUDE.md already copies much of this (one task per commit, plan file, results log). Missing piece: our "feature list" is engineering tasks, not player-facing experiences with a pass/fail check a human would do.

### 1.2 Multi-agent research system (orchestrator and workers)
URL: https://www.anthropic.com/engineering/multi-agent-research-system
- Vague briefs caused duplicated work and gaps. Each worker brief needs: objective, output format, which tools and sources to use, and clear task boundaries.
- Models misjudge how much effort a task deserves. Put explicit effort rules in the lead prompt (their example: 1 agent and 3 to 10 tool calls for a simple fact, 2 to 4 workers for a comparison, 10+ for complex work). Without rules the lead over-invested in simple tasks.
- Failure modes listed: spawning too many workers for simple tasks, searching forever for things that do not exist, workers sending each other too many updates, continuing after enough was found, over-long queries.
- Start wide, then narrow. Run workers in parallel (up to 90 percent time saved). Let the model rewrite its own flawed tool descriptions (40 percent faster later runs). Prefer heuristics over rigid rules plus explicit guardrails.
- Evaluation: about 20 test cases were enough to start. LLM judge with a rubric helps, but human testing caught problems automation missed.

### 1.3 Building effective agents
URL: https://www.anthropic.com/engineering/building-effective-agents
- Start with the simplest thing that works. Add complexity only when measurement shows it helps.
- Patterns: prompt chaining, routing, parallelization, orchestrator-workers, evaluator-optimizer (one model makes, another critiques, loop while criteria are clear).
- Agents should get "ground truth" from the environment at each step (tool results, code runs) and should pause at human checkpoints and have stop conditions such as a max iteration count.
- Tool design: make mistakes hard (example: require absolute paths). Clear boundaries between tools.

### 1.4 Claude Code best practices
URL: https://code.claude.com/docs/en/best-practices (old URL anthropic.com/engineering/claude-code-best-practices redirects here)
- Tell Claude what it cannot see; give it a check to run. Give success criteria, not just a task ("write a failing test that reproduces it, then fix it").
- Images can be pasted; a browser screenshot next to a mockup is a recommended check for UI work.
- Write a SPEC.md first, then start a FRESH session to build from it, so there is a written definition of done.
- Ask for evidence: the command and its output, or the screenshot. "All tests pass" alone tells you little. For sessions you did not watch it is the only evidence.
- Review by someone who did not write the code: a fresh subagent with no knowledge of the reasoning. A fresh reviewer helps; delegating the same task to a subagent does not give a better answer.
- A `/verify` style step: build and run the app and look at it. "That catches the kind of problem that tests and typechecks miss."
- Corrected the same thing twice and still wrong: clear the context and write one better prompt, do not try a third time. (Matches our rule 11 of three tries.)
- Subagents cost tokens, and a fresh one must rediscover context. Haiku is suggested for simple subagent jobs. A read-only reviewer can be limited to Read, Grep, Glob by tool config.
- Watch the first minute and stop it the moment it drifts.

## 2. Developer postmortems and blogs (ANECDOTE level)

### 2.1 Building an MMO with Claude Code
URL: https://portfolio-9vb.pages.dev/post/building-an-mmo-with-claude-code
Worked: boilerplate, well-specified systems (XP skill system), network desync debugging, integration of established patterns.
Failed or weak:
- Game feel. The agent "can change a hit delay from 200ms to 150ms but cannot make the taste call." Combat timing, movement weight, animation, hit feedback needed the human playing.
- Architecture. Suggestions solved the task at hand and caused trouble later when several sensible systems had to agree.
- Visual coherence. A technically fine asset can be wrong for the established look.
- Assets, map development, progression scaling were weak areas.
Advice: write specs first; do not accept code just because tests pass; do not generate more than you can evaluate; scrutinize core rules, skim routine parts.

### 2.2 Cookie Clicker simulation lessons
URL: https://dev.to/hamurda/what-cookie-clicker-taught-me-about-ai-assisted-development-3o25
- Detailed unambiguous spec gave correct core logic first time. Spec quality sets output quality. Describe what should happen, not how.
- Fresh session per phase with a short recap beat long correction-filled sessions.
- Build, then review in a new session, curate findings, then fix in another new session. Separating review from implementation prevented silent regressions.
- Bounded tasks with exact requirements gave clean output. Open-ended feature work gave dead code.
- Refactors reintroduced already-fixed bugs (the model forgets why a fix existed). Dead code and duplicated logic appeared. It did not challenge risky architecture.
- The less sure the human was about "done", the more iterations it took.

### 2.3 Search-result summaries (not opened in full; treat as pointers)
URL: https://dev.to/hamurda/what-cookie-clicker-taught-me-about-ai-assisted-development-3o25 (above)
- A search snippet about a bullet-hell game shipped on Steam said the first prototype came from one prompt and production took two full rewrites. A guide warned that a quick early win pulls you into a long polish loop. I did not verify these pages. Search listings also included https://cxyda.github.io/ProjectAegisDevLog , https://srikardurgi-com.pages.dev/blog/how-i-built-a-full-arcade-game-without-writing-a-single-line-of-code and https://ai-first.techwolf.ai/course/build-a-game.md which I did not read. Candidates for a later pass.

## 3. Research papers (from search summaries only)

- GameGPT, multi-agent framework for game development. https://arxiv.org/abs/2310.08067 . Aim: cut hallucination and redundancy across planning, task identification, and implementation, with decoupled code generation. Not about fun or playtesting.
- ScriptDoctor, LLM writes PuzzleScript games, grounded by human examples, engine compile errors, and search-based playtest agents. https://arxiv.org/pdf/2506.06524 . Pattern worth copying: generate, run, let a bot play, feed results back.
- Lap, LLM playtesting of match-3 games from numeric board state. https://arxiv.org/abs/2507.09490 . Found more crashes and more coverage than existing tools. It also says LLMs are weak at icon positions in images, so give them numbers, not pictures.
- KLPEG, knowledge-graph-assisted LLM playtesting of evolving games (Overcooked, Minecraft). https://www.arxiv.org/pdf/2511.02534
- Survey: Leveraging LLM Agents for Automated Video Game Testing. https://arxiv.org/pdf/2509.22170
- lmgame-Bench, how good LLMs are at playing games. https://arxiv.org/html/2505.15146v2 . Reported (via search summary): screenshots straight to a vision model often give near-random play; weak at precise spatial control; no learning across repeated situations; adding vision sometimes hurts.
- Gap: I found no paper that tests whether LLM-designed games are fun or whether a vision model can judge game feel.
- INFERENCE from the above: a vision model looking at one static screenshot can check "is the sprite on the ground, is the HUD readable, is it the right colour". It cannot judge feel. Use telemetry numbers (jump height, hang time, input latency) and a human for feel.

## 4. Game feel references (human craft, to feed into briefs)

- Celeste platformer feel (Maddy Thorson thread, via search summary): coyote time, jump buffering, half gravity at the jump apex when jump is held, corner correction on head bumps, momentum kept from moving platforms. https://threadreaderapp.com/thread/1238338574220546049.html and https://maddymakesgames.com/articles/celeste_and_forgiveness/ . No official numbers found. A third-party blog claims 6 frames of coyote time; unverified.
- Juice and screenshake: Vlambeer "Art of Screenshake" and "Juice it or lose it" (summarised at https://rpgplayground.com/research-making-a-juicy-game/ and https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-). Principle: juice should echo the core gameplay and serve it, not decorate it.
- Steve Swink's definition of game feel: the input and perception loop between player and game. Key point for us: feel is about response to input, so it needs measuring input to screen, not art.
- Our game already has coyote time, jump buffer, hit stop, 1 px shake. INFERENCE: these existing parts are the generic "checklist" version. The unfun part is more likely level design, enemy behaviour variety, and ability payoff than missing juice.

## 5. Failure modes, grouped, with what they look like in OUR repo

1. Technically working, generic. Agents copy the most common pattern (grunt walks left and right, card drops, 3 hearts). Nothing asks "what is the one thing only this game does". Our one idea is "you are the card you hold". CLAUDE.md describes mechanics but has no design pillars, so agents have nothing to protect.
2. Tests check numbers, not fun. Our suite verifies things like vy in a range, 53 checks passing. A game can pass all of them and still be dull. Also those number checks flake under load (stomp check, hop vy -195 vs -250, noted in the Results log).
3. No visual feedback loop for feel. Screenshots are static; they cannot show jump arc or hit timing. Agents "checked" screenshots and wrote OK even when the beam was not visible (ranger flare note in section 10).
4. Feature creep and polish loops. Effects system, banded glow, LPC layers took long relative to whether levels are fun. The first win (it plays) pulls agents into polishing.
5. Endless refactoring and dead code. Cookie Clicker post: refactors reintroduce fixed bugs. Our rule 2 (do only what the task says) is the right guard.
6. Tuning scattered as magic numbers. Physics numbers (130 px/s, -340, 900) sit in code and in prose. A designer cannot tweak and re-feel quickly. A single tuning table would help (see rules).
7. Hitbox and art mismatch. Art comes from 64 px LPC sheets drawn lower by 3 px to stand on grass; hitbox is separate tile math. Agents tend to move the art and forget the box, or the reverse. Needs a debug overlay and a screenshot with boxes drawn.
8. Hallucinated or inconsistent assets. Hugging Face and OGA were blocked, so agents composed LPC layers in Python. Mixed sources lead to weapon layers missing on some rows (known gaps in section 6). Weapon-hidden-on-frame is a symptom.
9. Self-reporting. Agents write "OK" next to screenshots and "tests pass". The harness article and best practices page both say ask for evidence, and use a separate reviewer.
10. Wall-clock waits in tests. Fails under CPU load. Tests should wait on the game clock (already partly done).
11. Overspecified process, underspecified goal. Our CLAUDE.md is mostly process (commit rules, build steps). The goal (what should the player feel in 30 seconds of level 1) is absent. Cookie Clicker post: uncertainty about "done" drives iteration count.
12. Subjective calls are made by the model by default. Hit delay, speed, enemy placement. Quote: the agent "cannot make the taste call".

## 6. Mitigations that have support

| Technique | Source / basis | Use here |
|---|---|---|
| Design pillars doc, short, read first | INFERENCE, plus spec-first posts (2.1, 2.2) | 3 to 5 pillars, each with a "does a player notice" test |
| Feature list with pass flag a worker may only flip | 1.1 | Replace task checklists with player-facing scenarios |
| One feature per session, commit, progress file | 1.1 | Already in CLAUDE.md |
| Start of session smoke test before new work | 1.1 | Run gates plus a 10 second bot run |
| Evidence required with every claim | 1.4 | Screenshot path or test output pasted in the commit body |
| Fresh reviewer that did not write the code | 1.4, 2.2 | Haiku or Sonnet reviewer with read-only tools |
| Clear context after two failed corrections | 1.4 | Matches rule 11 |
| Orchestrator brief: objective, output, tools, boundaries | 1.2 | Template below |
| Explicit effort rules per task size | 1.2 | Task size table below |
| Ground truth per step, stop conditions | 1.3 | Max tries, max files |
| Numeric telemetry for bots, not pictures | 3 (Lap, lmgame-Bench), INFERENCE | Bot records jump apex, time to cross gaps, deaths per screen |
| Playtest bots that try the main route per character | 3 (ScriptDoctor pattern), our `validate_gates.py` | Already half there; add a timing-aware bot |
| Tuning table in one data file | INFERENCE | `tuning.json` or one JS object, one place |
| Human playtest checklist with yes/no questions | INFERENCE | Section 7 |
| Frame-strip or GIF review for motion | INFERENCE, since static shots miss feel | 6 to 12 frames per action, laid out in a contact sheet |
| Small tasks for small models | 1.4 (Haiku for simple jobs), 1.2 | Haiku: lists, checks, screenshots. Sonnet: code |

## 7. Human-style playtest checklist (for a worker or human to answer, yes or no)

Answer after actually running the game, with evidence (screenshot or recorded numbers).
1. Within 10 seconds of pressing Start, can the player move, jump and see one threat?
2. Is the first enemy beatable using only a jump or the first power, without reading text?
3. After defeating the first enemy, does the player want the dropped card (visible, clear what it is)?
4. Does using a new character change HOW the player crosses the next obstacle, not only the sprite?
5. Is there a moment in level 1 where the player chooses between two paths or two characters?
6. Does each ability have a different use (not four damage buttons)?
7. Does a hit feel different from a miss (sound, pause, shake)?
8. After dying, does the player lose something they care about, and can they recover?
9. Is any ability never used in the main route of levels 1 to 4? (If yes, either design a use or remove it.)
10. Can the player jump onto a ledge they can see without fighting the controls?
11. Does the camera show enough ahead of the player to react (at 480 by 270 logical px)?
12. Does any enemy do the same thing for the whole level?
13. Does the level have one memorable setpiece?
14. Is every sprite standing on the ground it is drawn on and hitting what it visually touches?
15. Is the text on screen readable at phone landscape size?

## 8. Ideas to make the game less generic (INFERENCE, for the director)

These are my suggestions from the research themes, not claims from sources.
- Make the card-hand the core loop. Examples: some obstacles only a certain card solves, an enemy weak to a certain character, a "swap on the fly" key with a short cooldown and a cost. Test pillar: "every room asks which face to wear".
- Give each enemy one clear rule the player can learn (telegraph, then punish) rather than only different sprites.
- Build levels around one idea each (level 3: ranged anchor use; level 6: ghost through gates) and test that the idea is used.
- Cut or merge abilities that are not used. Four per character is a lot for one hand on a keyboard.
- Get one human playtest per milestone; the research and postmortems agree this cannot be skipped.

## 9. Source list (flat)
- https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents
- https://www.anthropic.com/engineering/multi-agent-research-system
- https://www.anthropic.com/engineering/building-effective-agents
- https://code.claude.com/docs/en/best-practices
- https://portfolio-9vb.pages.dev/post/building-an-mmo-with-claude-code
- https://dev.to/hamurda/what-cookie-clicker-taught-me-about-ai-assisted-development-3o25
- https://arxiv.org/abs/2310.08067 (GameGPT)
- https://arxiv.org/pdf/2506.06524 (ScriptDoctor)
- https://arxiv.org/abs/2507.09490 (Lap)
- https://www.arxiv.org/pdf/2511.02534 (KLPEG)
- https://arxiv.org/pdf/2509.22170 (LLM game testing survey)
- https://arxiv.org/html/2505.15146v2 (lmgame-Bench)
- https://threadreaderapp.com/thread/1238338574220546049.html (Celeste feel)
- https://maddymakesgames.com/articles/celeste_and_forgiveness/
- https://rpgplayground.com/research-making-a-juicy-game/
- https://gamedeveloper.com/design/squeezing-more-juice-out-of-your-game-design-
- Not read, candidates: https://cxyda.github.io/ProjectAegisDevLog , https://srikardurgi-com.pages.dev/blog/how-i-built-a-full-arcade-game-without-writing-a-single-line-of-code , https://ai-first.techwolf.ai/course/build-a-game.md

## 10. Rules for our agent swarm

The director is the big model. Workers are Sonnet (code, multi-file) and Haiku (checks, screenshots, lists). These extend the rules already in CLAUDE.md section 1 and do not replace them.

Task sizing
1. One task, one outcome a player could notice, or one named bug. If the brief needs the word "and" twice, split it. Cap: about 3 files edited and 150 changed lines for Sonnet; 1 file or no code for Haiku.
2. Haiku gets only mechanical work: run the gates, take screenshots and contact sheets, list files, grep for magic numbers, fill a checklist with evidence, check that credits match assets. Haiku never changes game feel, level layouts, or physics.
3. Sonnet gets bounded code tasks with exact acceptance criteria. Nothing open ended like "make it more fun" or "polish". Fun decisions are made by the director or the human and handed down as concrete numbers or concrete behaviours.
4. State the effort budget in the brief: max files, max tool calls, max tries (three, then stop and log, matching rule 11). Say "stop when criteria are met; do not add extras".

What every brief must contain
5. Use this template: Goal (one sentence, player-facing). Why (which design pillar it serves). Files allowed to touch. Files forbidden. Acceptance criteria (observable). Evidence required (exact commands, screenshot paths). Out of scope. Stop condition.
6. Put the design pillars (3 to 5 lines) at the top of every brief, so workers do not drift to the generic version. Pillars live in one short file the director maintains.
7. Give numbers, not adjectives. "Jump apex 3.2 tiles, coyote 0.1 s" not "make jumping feel snappy". All tunable values go in one tuning table file; workers change values there and never inline a literal number in logic.

Verification
8. A claim without evidence does not count. Workers paste the command and its output, or the screenshot path, in the commit body. "Tests pass" with no output is rejected.
9. Visual tasks: worker produces a contact sheet (6 to 12 frames of the action) and one full-scale crop, reads them, and writes what it SEES in one sentence per frame group. If the thing is not visible, say "not visible" and do not mark it OK.
10. Add a debug overlay (hitboxes, ground line, tile grid) and take one screenshot with it on for every sprite or collision change. Check that the box and the art agree.
11. Feel cannot be verified by a model from a still image. For feel tasks the worker records numbers (jump apex height, hang time, time to reach top speed, input to action delay in frames) and compares to the target table. The director or human then plays it. Mark these tasks "needs human feel check" and do not close them.
12. A fresh reviewer, a different Haiku or Sonnet instance with read-only tools, checks each Sonnet diff against the brief's acceptance criteria and reports gaps only. The author never reviews its own work.
13. Tests must check player-visible outcomes (enemy can be beaten with starting kit; each character can finish the route; card changes available action), not just physics numbers. Waits use the game clock, not wall time. Never loosen a test to pass (existing rule 8).

Never do
14. Never refactor, rename, reformat, or "clean up" outside the brief. Never add a feature that was not asked. Never add polish effects unless the task is an effects task.
15. Never invent assets, credits, URLs, or licenses. If an asset is missing, report it; do not substitute silently or write "OK".
16. Never touch level layouts or enemy placement without running `validate_gates.py` and the route bot for all five characters, and never make a main-route change that needs a secret ability.
17. Never decide a design question alone. If unsure, choose the simplest option, write one line in the Decisions log, and keep going (existing rule 3). The director reviews the log between rounds.

Rhythm and handoff
18. Each session starts with a 2 minute smoke check before new work: `git branch --show-current`, build, gates, and one screenshot of level 1. If it is already broken, fix that first and say so (pattern from the harness article).
19. Work in rounds of 3 to 5 tasks, then stop for a human playtest using the section 7 checklist. Do not queue 12 tasks of engineering in a row; that is how we got a working but generic game.
20. Maintain two small files: a progress log (what is done, what is next, known problems) and a feature scenario list where each item is a player-facing scenario with a pass flag. Workers may only flip the flag, and only with evidence. Do not delete or reword scenarios.
21. Handoff when usage is running low or a worker is about to stop: commit what works (or `git checkout -- game` to drop broken edits), then write in the progress log, in this order: current task id, what is done and verified (with evidence paths), what is half done and exact next step, files touched, commands to rerun, one thing that surprised you, and any open question marked "needs director". Push to `main`. The next worker reads the log and runs the smoke check before touching code.
22. A worker that fails the same step twice stops, clears its approach, and writes a fresh one-paragraph plan; on the third failure it stops and logs. It does not keep patching.
23. The director rotates reviewers and keeps worker sessions short and fresh: one task per session, with a recap in the brief, not a long chat history.
24. After each round, the director asks one question before writing the next briefs: "what would a new player notice that is different from every other platformer?" If the answer is "nothing", the next round is a design task (an enemy rule, a card interaction, a level idea) written by the director and implemented by Sonnet, not more polish.
25. Keep the human in the loop for taste. After every round, list at most three "needs human eyes" items with a link to a recording or screenshot, and wait for feedback before building on them.
