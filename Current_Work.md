# Current Work: Character Scene Generation Test

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
| Premade asset packs | (none) | Blocked (downloads not allowed) | 0 |

## Environment findings (read before retrying)
- Session shell egress allows PyPI and npm (`registry.npmjs.org`) and GitHub (for git). It does NOT allow `huggingface.co`, `kenney.nl`, or `opengameart.org`. Direct downloads from those hosts fail at the proxy with HTTP 403 or `connect_rejected`.
- Python 3.13 with Pillow 12.3 is preinstalled. Node v22 is available.
- The Hugging Face MCP connector's `dynamic_space` `invoke` operation returns: `disabled because gradio=none is set`. `view_parameters` and `discover` still work, and `hub_repo_search` works.
- To get premade assets, a user would need to download them from Kenney.nl, OpenGameArt, or itch.io and attach them to the chat. Files in `/mnt/user-data/uploads/` or the working tree can then be processed.

## Method 1: Hugging Face (blocked)
- Found candidate Spaces: `mcp-tools/Qwen-Image` (chosen), `mcp-tools/FLUX.1-Krea-dev` (rejected, photorealism-tuned), and `friedpierogi/pixel-art-sprite-generator` (1 like, untested).
- Prompts for all four scenes are saved in `method_1_huggingface/README.md`, with seeds and a retry procedure.
- No images were generated. Next step: enable invoke, then run the four prompts.

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

## Premade assets
- Attempted list: Kenney.nl (CC0), OpenGameArt.org (license varies per asset), itch.io, and Liberated Pixel Cup assets.
- None were downloaded. Kenney.nl and OpenGameArt are unreachable from this session's shell.
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
