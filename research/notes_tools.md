# Research notes: templates, references, and local tools

Date: 2026-10-29. Run in the sandbox. Nothing in `game/` was changed. Scratch work was in /tmp/claude-0.

## 0. Network facts (checked with curl)

| Host | Result |
|---|---|
| github.com (git clone, public repos) | PASS. `git clone --depth 1 https://github.com/OWNER/REPO.git` works |
| raw.githubusercontent.com | PASS (follows redirect with `curl -L`) |
| api.github.com via `gh` CLI | FAIL (403, bound to session repos). Use the GitHub MCP search tool or git clone instead |
| codeload.github.com zip | FAIL (403). Use git clone |
| registry.npmjs.org, pypi.org | PASS |
| lospec.com | PASS. Palette JSON works (see section 4) |
| huggingface.co | 200 on HEAD (not tried further; CLAUDE.md says gradio spaces blocked) |
| opengameart.org | 200 on HEAD for pages. Direct file URLs not tested |
| itch.io | 200 on HEAD |
| kenney.nl | FAIL 403 |
| cdn.jsdelivr.net | HEAD 301, a real `/npm/zzfx@1.4.0/package.json` GET gave 200. So jsDelivr is reachable now (CLAUDE.md says blocked; out of date) |
| unpkg.com | 200 |

Note: CLAUDE.md section 10 lists jsDelivr, unpkg, OpenGameArt, itch.io as blocked. Today they answered. Only kenney.nl was refused. Actual file downloads from OGA and itch were not tried.

## A. Templates and references

### A1. What was found and what is usable

All cloned with `git clone --depth 1`. All PASS.

- Celeste source (official, MIT, C#): https://github.com/NoelFB/Celeste
  - `Source/Player/Player.cs` (5471 lines) has every movement constant. `Source/PICO-8/Classic.cs` is the Celeste Classic (PICO-8) game ported to C#. Best single reference for game feel.
  - Key constants read from Player.cs (px, seconds, at 1 px = 1 game px; Celeste screen is 320x180):
    - MaxRun 90, RunAccel 1000, RunReduce 400, AirMult 0.65 (air accel is 65 percent of ground)
    - Gravity 900, MaxFall 160, FastMaxFall 240, HalfGravThreshold 40 (gravity halves while jump held near the peak, speed under 40)
    - JumpSpeed -105, JumpHBoost 40, VarJumpTime 0.2 (hold jump up to 0.2 s for a higher jump)
    - JumpGraceTime 0.1 (coyote time), UpwardCornerCorrection 4 px (slide around ceiling corners), Dash speed 240, DashTime 0.15, DashCooldown 0.2
  - Maddy Thorson's tweet thread (March 2020) as reported by Gigazine: coyote time, jump buffer, halved gravity at jump apex, stored lift momentum from moving platforms. https://gigazine.net/gsc_news/en/20200317-celeste-action-feel-things . The post "Celeste and TowerFall Physics" itself was not fetched; WebSearch did not return it. Treat exact numbers from blogs as unverified, the Player.cs constants above are first-hand.
- Kaplay (Kaboom successor, MIT, v4000 alpha): https://github.com/kaplayjs/kaplay . `examples/` has 135 files, including `platformer.js`, `camera.js`, `particle.js`, `particleTrail.js`, `platformEffector.js`, `tiled.js`.
- Phaser 4 (MIT, v4.2.1): https://github.com/phaserjs/phaser (cloned as photonstorm/phaser, same repo). Source only; the examples live in a separate repo (phaserjs/examples, not cloned). Camera code: `src/cameras/` (follow with lerp and deadzone built in: `startFollow(target, roundPixels, lerpX, lerpY, offsetX, offsetY)`, `setDeadzone(w,h)`).
- Excalibur (BSD-2, v0.32): https://github.com/excaliburjs/Excalibur . 775 MB full clone, heavy. Has a `LockCameraToActorStrategy` and `ElasticToActorStrategy` for camera.
- Kirby-like in plain canvas: https://github.com/gavilanbe/plumo (live: https://gavilanbe.github.io/plumo/). Cloned. 1 file `game.js` 1405 lines, no assets, WebAudio chiptune and vector art. Inhale an enemy, swallow, copy its power. Very close to our design. No license file seen; use only as reading reference, do not copy code.
- GMTK Platformer Toolkit: https://gmtk.itch.io/platformer-toolkit (Unity, not open source on GitHub as far as search showed). Its parameter list is useful: run (max speed, acceleration, deceleration, turn speed), jump (height, duration, down gravity, air accel, air control, air brake, variable height), assists (coyote time, jump buffer, terminal velocity, rounded corners). Devlog: https://gmtk.itch.io/platformer-toolkit/devlog/395523/behind-the-code
- Celeste Classic JS ports: WebSearch found no dedicated JS port. Found C port https://github.com/lemon32767/ccleste (archived, has an experimental web build) and https://github.com/hteumeuleu/celeste (Lua, Playdate). Guessed repo names for JS ports returned "not found" on clone. Original Lua cart code is mirrored in the C# `Classic.cs` above.
- Kenney platformer starter kit repos on GitHub were guessed and not found.

### A2. What a solid platformer template contains

1. Player state machine: Normal, Jump, Fall, Dash or Attack, Hurt, Dead, with enter/update/exit per state (Celeste uses a StateMachine with named states and coroutine states).
2. Movement feel: fixed timestep, coyote time (about 0.1 s), jump buffer (about 0.1 to 0.15 s), variable jump height (cut velocity on release, or hold timer), half gravity at apex, max fall speed, air accel lower than ground accel, corner correction (nudge past ceiling and floor-edge corners), one-way platforms.
3. Camera: smooth follow (lerp), deadzone box, lookahead in facing direction, vertical snap to ground when landing, clamp to level, shake, optional room or zone locks.
4. Parallax: 2 to 4 layers scrolled at fractions of camera x (0.1, 0.25, 0.5), plus foreground tiles.
5. Tilemap from an editor (Tiled TMX/JSON or LDtk JSON) with layers: collision, decoration, entities (spawns, doors, triggers).
6. Particles: pooled emitters (dust on land and run, hit sparks, pickups), with lifetime, velocity, gravity, color ramp.
7. Scenes: title, play, pause, game over or level complete, with fade or iris transition between scenes.
8. Audio manager: SFX pool, music with loop and crossfade, mute toggle, volume buses, unlock on first input.
9. Tuning constants in one table at the top (so a designer can change numbers without reading code).
10. Juice: hit stop, screen shake, squash and stretch, flash on hit, input rumble.

### A3. Our game against that list (skim, grep only)

| Item | Our game | Where |
|---|---|---|
| Fixed 1/60 step | Yes | `engine.js` |
| Coyote time | Yes, 0.08 s | `scenes.js` ~line 452 |
| Jump buffer | Yes per CLAUDE.md; grep for "buffer" in src found no hit by that word, so it may be named differently (not confirmed) | |
| Hit stop | Yes (`hitstopT`) | `scenes.js` ~360 |
| Variable jump height / apex half gravity | Not checked | |
| Player state machine | Not seen as a named class; scenes.js is 1229 lines and mixes modes (`this.mode` strings: play, dying, select, complete, pause) | `scenes.js` |
| Camera | Simple lerp 0.15 to player centre, clamped to level. No deadzone, no lookahead, no vertical landing snap | `scenes.js` ~560 |
| Parallax | One far hill layer at 0.25 x camera (`drawHills`), procedural | `scenes.js` ~99, ~777 |
| Tilemap from editor | No. Levels are ASCII strings in `levels.js`, checked by `tools/validate_gates.py` | |
| Particles | Yes, hand written: `Effects.spark/spray/flare/shake/flash`, `Glow` banded effects | `enemies.js`, `glow.js` |
| Scene transitions | Not seen (no fade or iris found by grep) | |
| Audio: SFX | Yes, oscillator notes in code | `sfx.js` (85 lines) |
| Audio: music | None. grep for music found only the word "oscillator" in sfx.js | |
| Tuning constants in one table | Spread across files | |

Gaps worth filling, in order of value: music loop (ZzFXM, section B1), camera lookahead and deadzone (about 10 lines), second parallax layer, fade between scenes, jump apex half gravity.

Suggested camera tweak, from Phaser and Celeste practice: target x = player x + facing * 40, lerp 0.08 horizontally, deadzone about 24 px wide, vertical lerp 0.1 with a 40 px deadzone.

## B. Tools tried here

### B1. Sound and music

| Tool | Command | Result |
|---|---|---|
| ZzFX (sfx, MIT, tiny) | `git clone --depth 1 https://github.com/KilledByAPixel/ZzFX.git` ; also `npm i zzfx` | PASS. Cloned. `zzfxG(...)` returns sample array and ran in Node when `window` and `AudioContext` are stubbed (15975 samples). The npm package itself throws "AudioContext is not defined" in plain Node, since it makes a context on load. Works in browser. |
| ZzFXM (music tracker, MIT) | `git clone --depth 1 https://github.com/keithclark/ZzFXM.git` ; npm name `zzfxm` and `@keithclark/zzfxm` do NOT exist (404) | PASS. Files `zzfx.js` + `zzfxm.min.js` (622 bytes!). Rendered the sample song `examples/songs/cuddly.js` headless to 148.5 s stereo samples, wrote a WAV (13 MB) and converted to OGG with ffmpeg (1.3 MB). Song format is plain JS arrays, can be written by hand or with the tracker in `tools/tracker`. Fits our "sound made in code" rule: ship the song array, render at runtime with `zzfxM`, play with `zzfxP`. |
| jsfxr | `npm i jsfxr` (v1.4.1) | PASS. `const {sfxr}=require('jsfxr'); sfxr.generate('jump')` made a preset and `sfxr.toWave(s)` returned a 19982 byte WAV data URI in Node. Presets: pickupCoin, laserShoot, explosion, powerUp, hitHurt, jump, blipSelect, synth, tone, click, random. Good for generating `.wav` files offline or param objects. |
| sfxr (npm) | `npm view sfxr version` = 0.0.2 | Exists, not installed or tested (old). |
| Tone.js | `npm view tone` = 15.1.22 | Exists, not installed (big, needs browser audio). |
| ffmpeg audio encoders | preinstalled `/usr/bin/ffmpeg` 6.1.1 | PASS: libvorbis, libopus, libmp3lame present. |

Offline music recipe that worked: node script with stubbed `window` and `AudioContext`, eval `zzfx.js` then `zzfxm.min.js`, call `zzfxM(...song)`, get `[left, right]` Float32 arrays, write WAV, ffmpeg to OGG.

### B2. Level and map tools

- Tiled: `npm view tiled` = 0.3.0 (unrelated small package, not the Tiled editor). The real Tiled editor (https://www.mapeditor.org) has a CLI (`tiled --export-map`) but needs the app; not installed. FAIL / not attempted.
- LDtk: https://ldtk.io editor is a GUI app. npm `ldtk` 0.8.7 exists (JSON types, not tried), `@ldtk/ldtk` 404. Not attempted. Probably not useful headless.
- tmx-parser (npm, 1.5.0) exists; not installed. Our levels are ASCII, so a converter is optional.

### B3. Pixel art and images

| Tool | Command | Result |
|---|---|---|
| Pillow 12.3.0, numpy 2.5.3 | `pip install --user pillow numpy` | PASS (already present) |
| scikit-image 0.26.0 | `pip install --user scikit-image` | PASS |
| imageio 2.38.1 | `pip install --user imageio` | PASS |
| pyxelate | `pip install --user pyxelate` | FAIL: "No matching distribution found" (also pinned 2.1.1). Not on this index. |
| hitherdither | `pip install --user hitherdither` | FAIL: not on PyPI. Install from GitHub would need `git+https://github.com/hbldh/hitherdither` (not tried). Pillow `quantize(dither=...)` and a hand-written 4x4 Bayer (we already do this in `glow.js`) cover the need. |
| pyxel 2.9.9 | `pip install --user pyxel` | PASS installs (wheel includes its own sound engine). Not needed for the game. |
| pygame | `pip install --user pygame` | PASS (already importable). Not needed. |
| sharp 0.35.5 | `npm i sharp` | PASS. Created and encoded a PNG in Node. |
| pngjs 7.0.0 | `npm i pngjs` | PASS installs (not run). |
| ImageMagick 6.9.12 | preinstalled `convert` | PASS (`convert -version`). Only IM6, no `magick` command. |
| gifenc 1.0.3 | `npm i gifenc` | PASS installs, exports GIFEncoder, quantize, applyPalette. Not run on frames. |
| gifski | `npm view gifski` = 1.7.1 (npm wrapper) ; no `gifski` binary on PATH | FAIL / not available as binary. Use ffmpeg palettegen instead. |
| Lospec palettes | `curl -s https://lospec.com/palette-list/pico-8.json` | PASS. Returned JSON `{"name","author","colors":[...]}` (16 hex colors). Pattern: `https://lospec.com/palette-list/<slug>.json` and `.hex`. The GitHub repo guess `lospec/palette-list` failed to clone. |

### B4. Capture and checks

| Tool | Command | Result |
|---|---|---|
| Playwright frames to GIF/MP4 | script in /tmp/claude-0/cap.js: `NODE_PATH=$(npm root -g) node cap.js` took 12 screenshots of `game/changeling.html`; then `ffmpeg -framerate 12 -i f%03d.png -vf "scale=480:-1:flags=neighbor,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif` | PASS. out.gif 57 KB, out.mp4 57 KB (libx264, yuv420p). libx264 and libvpx both present. For real capture use Playwright `recordVideo` or step the game clock and screenshot per step. |
| eslint | preinstalled `/opt/node22/bin/eslint` v10.1.0 | PASS with a flat config (eslint 10 needs `eslint.config.js` or `-c file`). Ran on `abilities.js` and `world.js`: 0 errors, 4 warnings, all "assigned but never used" for top-level globals shared across script files (expected, since files load as plain scripts). Keep `no-undef` off. |
| prettier | preinstalled v3.8.1 | PASS runs. `prettier --check game/src/world.js` reports style differences, so the code is not prettier-formatted. Use check only, never `--write` (CLAUDE.md says no reformatting). |
| ffmpeg | preinstalled 6.1.1 | PASS |

### B5. Free asset sources reachable through GitHub

Found with the GitHub MCP repository search, then cloned with `--filter=blob:none --no-checkout` and sparse checkout.

- Kenney full mirror: https://github.com/ETdoFresh/kenney.nl (master, 46424 files, 4 stars). PASS. Folders include `1bitplatformerpack`, `kenney_platformerpack_industrial`, `kenney_simplifiedplatformer`, `pixeluipack`, `platformer-pack-medieval`, `kenney_digitalaudio`, `kenney_impactsounds`, `kenney_rpgaudio`, `kenney_uiaudio`, `kenney_casinoaudio`. Download recipe that worked:
  ```
  git clone --depth 1 --filter=blob:none --no-checkout https://github.com/ETdoFresh/kenney.nl.git m
  cd m && git sparse-checkout set kenney_digitalaudio kenney_impactsounds && git checkout
  ```
  Got `kenney_digitalaudio` (1.2 MB, .ogg files such as `laser3.ogg`, `powerUp10.ogg`) and `kenney_impactsounds` (1.3 MB). Their `License.txt` says Creative Commons Zero (CC0). Caveat: mirror is third party; CC0 content can be verified against the license file in each pack.
- Smaller Kenney mirror with manifest and SHA256: https://github.com/bill2432/kenney-2d-mirror (`packs/new-platformer-pack.zip`, `1-bit-pack.zip`, `foliage-pack.zip`, `micro-roguelike.zip`; 14 files). PASS listing.
- Another: https://github.com/ThinkingInTeraflops/dreamengine-assets (Kenney and Quaternius CC0). Listed only.
- LPC collections and CC0 music repos on GitHub: not searched in depth. Search "Liberated Pixel Cup" is a gap; our sheets already come from LPC pieces.
- Note on rules: CLAUDE.md says "Do not add internet files unless the task says so" and "Sound is made in code". Kenney audio is optional reference or reference timbre only.

## C. Install commands that worked (copy and paste)

```
# JS tools into a scratch folder (not the repo)
mkdir /tmp/work && cd /tmp/work && npm init -y
npm i zzfx jsfxr gifenc sharp pngjs eslint prettier

# Source repos (read only)
git clone --depth 1 https://github.com/keithclark/ZzFXM.git
git clone --depth 1 https://github.com/KilledByAPixel/ZzFX.git
git clone --depth 1 https://github.com/NoelFB/Celeste.git
git clone --depth 1 https://github.com/gavilanbe/plumo.git

# Python
pip install --user pillow numpy scikit-image imageio pyxel

# GIF from frames
ffmpeg -y -framerate 12 -i f%03d.png -vf "scale=480:-1:flags=neighbor,split[a][b];[a]palettegen[p];[b][p]paletteuse" out.gif
```

## D. Suggested next steps for the game

1. Music: add ZzFXM (`zzfx.js` + `zzfxm.min.js`, about 6 KB total) plus one or two short songs per theme (field, dungeon, boss). Needs a new JS file added to `SCRIPTS` in `build_single_html.py`. Must start on first key press.
2. Camera: add lookahead and a deadzone using the numbers in A3.
3. Optional second parallax layer and a fade between levels.
4. Keep using eslint with a no-undef-off config as a cheap extra syntax check. Do not run prettier --write.
5. GIF capture for sharing: Playwright frames plus the ffmpeg line above.
