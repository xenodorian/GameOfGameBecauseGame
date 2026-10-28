# Method 4: Scenes from sourced third-party assets

Composes all four scenes from real, pre-made pixel and painted sprite assets rather than generated art.

## Sources (all reachable from this session)

| Asset | Used for | Source | License |
|---|---|---|---|
| Sprite Foundry Fantasy Heroes HD (512px knight, ranger, front view) | HQ scenes | npm `@sprite-foundry/fantasy-heroes-hd` | MIT |
| Sprite Foundry Fantasy Heroes 48px (knight, ranger) | Pixel scenes | npm `@sprite-foundry/fantasy-heroes-48` | MIT |
| DCSS brick walls (`dngn/wall/brick_brown0`, `brick_brown1`) | Dungeon walls | github.com/crawl/crawl (rltiles) | Mostly CC0; per-tile licenses vary |
| DCSS grey dirt floors (`dngn/floor/grey_dirt0`, `grey_dirt1`) | Dungeon floor | github.com/crawl/crawl | Mostly CC0; per-tile licenses vary |
| DCSS dark grass (`dngn/floor/grass/grass-dark0` to `3`) | Field ground | github.com/crawl/crawl | Mostly CC0; per-tile licenses vary |
| DCSS trees (`dngn/trees/tree1` to `tree3`) | Field trees | github.com/crawl/crawl | Mostly CC0; per-tile licenses vary |

## License caveats
- Sprite Foundry packs are MIT. Copies and the LICENSE files are in `assets/heroes_hd/` and `assets/heroes_48/`.
- DCSS states that "the majority of Crawl's tiles and artwork are released under the CC0 license", but that licensing "may be complex, especially for older pieces." Per-tile credits are at github.com/crawl/tiles. The DCSS tiles used here have NOT been checked one by one. Confirm each tile before shipping a commercial project. A copy of the DCSS LICENSE is in `assets/dcss/LICENSE_DCSS.txt`.
- Kenney packs were reachable through npm (CC0) but were not used. The Hex Pack contains isometric hex tiles and the Space Kit is sci-fi, so neither matches these scenes.

## Build
```
python3 build_scenes.py   # Pillow only
```
Writes `output/pixel_dungeon.png`, `pixel_field.png`, `hq_dungeon.png`, `hq_field.png`, and `grid_2x2.png`.

## Scene layout
- `pixel_dungeon`: DCSS brick wall (2x), dirt floor band, 48px knight at 4x.
- `pixel_field`: DCSS grass (2x), DCSS trees, 48px ranger at 4x.
- `hq_dungeon`: DCSS wall at 4x with a darkening overlay, HD knight at 380px tall.
- `hq_field`: DCSS grass at 4x, DCSS trees at 5x, HD ranger at 380px tall.
