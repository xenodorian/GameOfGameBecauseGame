# Method 1: Hugging Face hosted image models (BLOCKED in this session)

## What was attempted
- Searched the Hub for pixel-art sprite Spaces. Found `friedpierogi/pixel-art-sprite-generator` (Gradio, 1 like, created 6 Mar 2025). Not tested, since invoke was blocked.
- Listed available image Spaces through `dynamic_space` discover. Chose `mcp-tools/Qwen-Image` for all four scenes. `mcp-tools/FLUX.1-Krea-dev` was rejected because it is tuned for photorealism, not 2D art.
- Ran `view_parameters` on both Spaces. This succeeded.
- Attempted `invoke` on `mcp-tools/Qwen-Image` four times, one per scene.

## Result
Every `invoke` call failed with:

> The invoke operation is disabled because gradio=none is set. To use invoke, remove gradio=none from your headers or set gradio to a space ID.

This is a session configuration limit on the Hugging Face MCP connector, not a model failure. No images were generated.
A direct shell fetch of huggingface.co also returns HTTP 403 from the egress proxy, so the Spaces cannot be reached from `curl` either.

## Prompts that were prepared (ready to run once invoke is enabled)
Parameters: `aspect_ratio` 1:1, `randomize_seed` false, seeds 101 to 104, default negative prompt.

1. `pixel_dungeon`: "Pixel art character standing in a dungeon. A small armored knight with a sword and shield, side view, full body, chunky 16-bit pixel art style with crisp outlines and limited palette. Stone brick dungeon walls, torches, dark blue-gray tones, game sprite scene, flat 2D, no blur."
2. `pixel_field`: "Pixel art character standing in a field with trees. A small adventurer with a backpack and cloak, side view, full body, chunky 16-bit pixel art style with crisp outlines and limited palette. Grassy meadow, pixel trees, bright daytime sky, game sprite scene, flat 2D, no blur."
3. `hq_dungeon`: "High quality 2D character sprite of a knight in a high quality 2D art dungeon. Painted digital illustration, detailed armor with soft shading, full body, side view, dramatic torchlight, stone dungeon interior with arches and chains, rich color depth, clean game art style."
4. `hq_field`: "High quality 2D character sprite of an adventurer in a high quality 2D art field with trees. Painted digital illustration, detailed cloak and leather gear with soft shading, full body, side view, golden afternoon light, open meadow with tall trees and wildflowers, rich color depth, clean game art style."

## To retry
Enable `invoke` for the Hugging Face connector (or set `gradio` to a Space ID in the connector headers), then call `dynamic_space` with `operation: invoke`, `space_name: mcp-tools/Qwen-Image`, `tool_name: Qwen_Image_generate_image`. Save the returned images into this folder's `output/` directory.
