# Changeling: Knight of a thousand faces

## Project overview
An HTML browser game. The player downloads a single HTML file and plays it in the browser on a computer or mobile phone. Landscape orientation only, with a full screen toggle.

## Core concept
Similar to Kirby, one character can take on the powers of many different characters by defeating enemies. Unlike Kirby, the player does not swallow enemies. When an enemy is defeated, it drops a card. Collecting a card adds that character to the player's deck.

## Cards, hand, and deck
- The player holds a hand of 3 cards at any time. Hand slots fill as the player progresses through the level.
- When the player collects more cards than there are open hand slots, the extra cards go into the deck in random order.
- Each card represents a character. Each character card has unique powers and abilities.

## Death and respawn
- When the player dies, they select one of the 3 cards in their hand.
- They respawn as that character in the closest safe space to where they died.

## Abilities
- Each character's ability is activated by a key or button.
  - Keyboard: A, S, Z, or X.
  - Gamepad: X, Y, A, or B.

## Discard
- At any time, the player can discard a card from their hand.
- At any time, the player can discard the character they are currently playing as.

## Levels and secrets
- The main level must be completable with any character.
- Secret levels, power-ups, and character cards are placed in areas reachable only with specific character abilities.
- This forces the player to cycle through their characters to find one that can reach a given unlockable, if they choose to pursue it.

## Controls
- Fully playable on a keyboard using the letter keys and the arrow keys.
- Fully playable on a simple gamepad that has only a directional pad and the A, B, X, and Y buttons.

## Platform and format
- Delivered as a single downloadable HTML file.
- Runs in desktop and mobile browsers.
- Landscape only.
- Includes a full screen toggle.

## Open questions for the next session
- Define "closest safe space" (for example, nearest standable tile not overlapping an enemy or hazard).
- Define how many cards are visible in the deck, or whether the deck is hidden.
- Choose the character roster and each character's ability.
- Decide the art source. The sprite methods in the notes below are candidates.

---

## Earlier work: sprite generation tests


## Goal
Build the same four scenes with three methods, so future agents can compare them:

1. `pixel_dungeon`: Pixel art character in a dungeon
2. `pixel_field`: Pixel art character in a pixel art field with trees
3. `hq_dungeon`: High quality 2D character sprite in a high quality 2D art dungeon
4. `hq_field`: High quality 2D character sprite in a high quality 2D art field with trees

## Status summary

| Method | Folder | Status | Scenes produced |
|---|---|---|---|
| 1. Hugging Face hosted image models | `method_1_huggingface/` | Blocked (invoke disabled) | 0 of 4 |
| 2. SVG/code, rasterized with resvg | `method_2_svg_code/` | Complete | 4 of 4 |
| 3. Procedural raster with Pillow | `method_3_pillow/` | Complete | 4 of 4 |
| 4. Sourced pre-made assets (npm + GitHub) | `method_4_sourced_assets/` | Complete | 4 of 4 |

## Environment findings (read before retrying)
- Session shell egress allows PyPI and npm (`registry.npmjs.org`) and GitHub (for git). It does NOT allow `huggingface.co`, `kenney.nl`, or `opengameart.org`. Direct downloads from those hosts fail at the proxy with HTTP 403 or `connect_rejected`.
- Python 3.13 with Pillow 12.3 is preinstalled. Node v22 is available.
- The Hugging Face MCP connector's `dynamic_space` `invoke` operation returns: `disabled because gradio=none is set`. `view_parameters` and `discover` still work, and `hub_repo_search` works.
- To get premade assets, a user would need to download them from Kenney.nl, OpenGameArt, or itch.io and attach them to the chat. Files in `/mnt/user-data/uploads/` or the working tree can then be processed.

## Method 1: Hugging Face (blocked)
- Found candidate Spaces: `mcp-tools/Qwen-Image` (chosen), `mcp-tools/FLUX.1-Krea-dev` (rejected, photorealism-tuned), and `friedpierogi/pixel-art-sprite-generator` (1 like, untested).
- Prompts for all four scenes are saved in `method_1_huggingface/README.md`, with seeds and a retry procedure.
- No images were generated. Retried invoke after the first attempt; still blocked with the same `gradio=none` error. The connector setting must be changed outside this session before this method can run.

## Method 2: SVG/code (complete)
- **Tooling:** Node.js plus `@resvg/resvg-js@2`, installed from npm into `method_2_svg_code/`.
- **Script:** `method_2_svg_code/build_scenes.js`. Run with `node build_scenes.js` from that folder.
- **Process:**
  - Pixel scenes: a 64x64 cell grid rendered as SVG `<rect>` cells at 8px each. Brick walls and checker floor for the dungeon. Sky bands, dithered grass, and stepped round trees for the field.
  - Character: a 12x17 text-grid sprite with a palette map. The field version recolors the same sprite to a green cloak and brown hood.
  - HQ scenes: gradients, radial glows, and layered vector shapes for the knight (plate armor, shield, sword) and the adventurer (hooded cloak, backpack, staff).
- **Outputs:** `method_2_svg_code/output/*.png` (512x512) and matching `.svg` source files.
- **Quality notes:** Pixel scenes read clearly as pixel art. The HQ field is the strongest result. The HQ dungeon is clean but flat compared with painted art. Sprite details are simplified shapes, not hand-painted.

## Method 3: Pillow (complete)
- **Tooling:** Python 3 with Pillow (already installed; no new dependencies).
- **Script:** `method_3_pillow/build_scenes.py`. Run with `python3 build_scenes.py`.
- **Process:**
  - Pixel scenes: drawn on a 64x64 grid with `ImageDraw.point` and `rectangle`, then scaled to 512 with `Image.NEAREST`. Same layout logic as Method 2.
  - HQ scenes: drawn at 2x, using vertical gradients, Gaussian-blurred radial glows, and polygon/ellipse shapes, then downsampled with `Image.LANCZOS`.
- **Outputs:** `method_3_pillow/output/*.png` (512x512).
- **Quality notes:** Pixel scenes are equivalent to Method 2. The HQ knight is blocky and the HQ dungeon has less detail than Method 2. The HQ field is competent but simpler than Method 2's version.


## Method 4: Sourced pre-made assets (complete)
- **Reachable sources** (tested this session): PyPI, npm registry, GitHub (git clone and raw). Blocked: kenney.nl, opengameart.org, itch.io, huggingface.co, Wikimedia, Archive.org, jsDelivr, unpkg, GitHub search API.
- **Used:**
  - Sprite Foundry Fantasy Heroes HD and 48px (npm, MIT) for character sprites.
  - Dungeon Crawl Stone Soup tiles (sparse git clone of github.com/crawl/crawl, mostly CC0) for walls, floor, grass, and trees.
- **Not used:** Kenney Hex Pack and Space Kit (npm, CC0). Wrong genre for these scenes.
- **Script:** `method_4_sourced_assets/build_scenes.py`. Requires Pillow.
- **Outputs:** `method_4_sourced_assets/output/*.png` and `grid_2x2.png`.
- **License caveat:** DCSS tile licenses vary by piece. Per-tile credits must be checked before any commercial use. See `method_4_sourced_assets/README.md`.
- **Quality:** Best of the four methods. The HD characters are painted art, and the DCSS tiles are consistent.

## Premade assets (earlier attempt, superseded by Method 4)
- Attempted list: Kenney.nl (CC0), OpenGameArt.org (license varies per asset), itch.io, and Liberated Pixel Cup assets.
- None were downloaded. Kenney.nl and OpenGameArt are unreachable from this session's shell.
- Searched npm for CC0 pixel sprite packs. No suitable, verifiable package was found.
- Next step: a user downloads a pack (Kenney's Tiny Dungeon or Tiny Town, for example, both CC0) and attaches it. Then an agent can sort, slice, and combine the sprites.

## Recommended next steps for other agents
1. Enable Hugging Face `invoke` for this session and run the prompts in `method_1_huggingface/README.md`. Compare the output against Methods 2 and 3.
2. Attach a CC0 pixel pack (Kenney) for a fourth comparison row and to test sprite integration.
3. If higher-fidelity HQ art is required, a painted approach would need a hosted image model, so Method 1 is the path forward.

## Reproduce
```
# Method 2
cd method_2_svg_code && npm install && node build_scenes.js

# Method 3
cd method_3_pillow && python3 build_scenes.py
```
