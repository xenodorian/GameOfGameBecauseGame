"""Method 4: scenes composed from real, licensed third-party assets.

Sources (see assets/ for copies and license files):
  - Dungeon Crawl Stone Soup tiles (mostly CC0; per-tile licenses vary, see LICENSE_DCSS.txt)
  - Sprite Foundry fantasy heroes, 48px and 512px HD (MIT)

Writes four 512x512 PNGs to ./output/:
  pixel_dungeon.png, pixel_field.png, hq_dungeon.png, hq_field.png

Run:  python3 build_scenes.py   (requires Pillow)
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "output")
os.makedirs(OUT, exist_ok=True)

SIZE = 512


def load(rel):
    return Image.open(os.path.join(ASSETS, rel)).convert("RGBA")


def tile_fill(canvas, tiles, top, scale, pattern):
    """Fill canvas from `top` downward with tiles, chosen by pattern(x, y)."""
    w, h = canvas.size
    t_w = tiles[0].width * scale
    t_h = tiles[0].height * scale
    scaled = [t.resize((t_w, t_h), Image.NEAREST) for t in tiles]
    y = top
    row = 0
    while y < h:
        x = 0
        col = 0
        while x < w:
            canvas.alpha_composite(scaled[pattern(col, row) % len(scaled)], (x, y))
            x += t_w
            col += 1
        y += t_h
        row += 1


def shadow(canvas, cx, base_y, rx, ry):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.ellipse([cx - rx, base_y - ry, cx + rx, base_y + ry], fill=(0, 0, 0, 90))
    canvas.alpha_composite(layer)


def place(canvas, sprite, cx, base_y, height):
    """Scale sprite to `height` and place it with feet at base_y, centered on cx."""
    ratio = height / sprite.height
    w = int(sprite.width * ratio)
    s = sprite.resize((w, height), Image.LANCZOS)
    canvas.alpha_composite(s, (cx - w // 2, base_y - height))


def pixel_dungeon():
    canvas = Image.new("RGBA", (SIZE, SIZE), (18, 16, 22, 255))
    walls = [load("dcss/walls/brick_brown0.png"), load("dcss/walls/brick_brown1.png")]
    floors = [load("dcss/floors/grey_dirt0.png"), load("dcss/floors/grey_dirt1.png")]
    tile_fill(canvas, walls, 0, 2, lambda c, r: (c + r) % 2)  # 64px wall cells
    # floor band: bottom 128px
    floor_band = Image.new("RGBA", (SIZE, 128), (0, 0, 0, 255))
    canvas.paste(floor_band, (0, SIZE - 128))
    tile_fill(canvas, floors, SIZE - 128, 2, lambda c, r: c * 3 + r)
    shadow(canvas, 256, 440, 56, 12)
    place(canvas, load("heroes_48/knight_front.png"), 256, 440, 192)
    return canvas.convert("RGB")


def pixel_field():
    canvas = Image.new("RGBA", (SIZE, SIZE), (120, 190, 240, 255))
    d = ImageDraw.Draw(canvas)
    d.ellipse([400, 30, 460, 90], fill=(255, 230, 110, 255))
    grass = [load("dcss/grass/grass-dark0.png"), load("dcss/grass/grass-dark1.png"), load("dcss/grass/grass-dark2.png"), load("dcss/grass/grass-dark3.png")]
    tile_fill(canvas, grass, 300, 2, lambda c, r: (c * 7 + r * 3) % 4)
    trees = [load("dcss/trees/tree1.png"), load("dcss/trees/tree2.png"), load("dcss/trees/tree3.png")]
    for x, base in [(40, 330), (410, 340), (150, 320)]:
        t = trees[(x // 40) % len(trees)].resize((96, 96), Image.NEAREST)
        canvas.alpha_composite(t, (x - 48, base - 96))
    shadow(canvas, 256, 440, 56, 12)
    place(canvas, load("heroes_48/ranger_front.png"), 256, 440, 192)
    return canvas.convert("RGB")


def hq_dungeon():
    canvas = Image.new("RGBA", (SIZE, SIZE), (18, 16, 22, 255))
    walls = [load("dcss/walls/brick_brown0.png"), load("dcss/walls/brick_brown1.png")]
    tile_fill(canvas, walls, 0, 4, lambda c, r: (c + r) % 2)  # 128px wall cells
    # darken the wall to push focus to the character
    dark = Image.new("RGBA", canvas.size, (0, 0, 0, 110))
    canvas.alpha_composite(dark)
    floor = Image.new("RGBA", (SIZE, 110), (34, 30, 42, 255))
    canvas.alpha_composite(floor, (0, SIZE - 110))
    shadow(canvas, 256, 440, 90, 16)
    place(canvas, load("heroes_hd/knight_front.png"), 256, 440, 380)
    return canvas.convert("RGB")


def hq_field():
    canvas = Image.new("RGBA", (SIZE, SIZE), (130, 200, 245, 255))
    d = ImageDraw.Draw(canvas)
    d.ellipse([380, 40, 450, 110], fill=(255, 240, 170, 255))
    grass = [load("dcss/grass/grass-dark0.png"), load("dcss/grass/grass-dark1.png"), load("dcss/grass/grass-dark2.png"), load("dcss/grass/grass-dark3.png")]
    tile_fill(canvas, grass, 330, 4, lambda c, r: (c * 5 + r * 2) % 4)  # 128px grass
    trees = [load("dcss/trees/tree1.png"), load("dcss/trees/tree2.png"), load("dcss/trees/tree3.png")]
    for x, base in [(70, 330), (430, 340)]:
        t = trees[(x // 70) % len(trees)].resize((160, 160), Image.NEAREST)
        canvas.alpha_composite(t, (x - 80, base - 160))
    shadow(canvas, 256, 440, 90, 16)
    place(canvas, load("heroes_hd/ranger_front.png"), 256, 440, 380)
    return canvas.convert("RGB")


if __name__ == "__main__":
    scenes = {
        "pixel_dungeon": pixel_dungeon(),
        "pixel_field": pixel_field(),
        "hq_dungeon": hq_dungeon(),
        "hq_field": hq_field(),
    }
    for name, img in scenes.items():
        path = os.path.join(OUT, name + ".png")
        img.save(path)
        print("wrote", path)
