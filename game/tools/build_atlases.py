#!/usr/bin/env python3
"""Make animation atlases from the 48 by 48 right-facing still images (Pillow only).

Each sprite is cut at its hip line into an upper part and two leg parts. The parts are
moved, sheared, stretched, or turned to make frames. Every atlas has the same layout:
8 columns and 7 rows of 48 by 48 cells. Unused cells are transparent.

    python3 game/tools/build_atlases.py

Writes game/assets/atlas/<key>.png and game/tests/shots/atlas_preview.png.
"""
import pathlib

from PIL import Image

GAME = pathlib.Path(__file__).resolve().parent.parent
ASSETS = GAME / "assets"
OUT = ASSETS / "atlas"
PREVIEW = GAME / "tests" / "shots" / "atlas_preview.png"

CELL = 48
COLS = 8
ROWS = 7

SOURCES = {
    "knight_right": "sprites/knight_right.png",
    "ranger_right": "sprites/ranger_right.png",
    "mage_right": "sprites/mage_right.png",
    "rat_king": "enemies/rat_king_right.png",
    "bone_weaver": "enemies/bone_weaver_right.png",
    "grunt": "enemies/grunt_right.png",
    "mud_revenant": "enemies/mud_revenant_right.png",
}


def blank():
    return Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))


def shift(part, dx, dy):
    out = blank()
    out.paste(part, (dx, dy))
    return out


def cut(img):
    """Split a sprite at its hip line. Returns (upper, lower, lc, hip, bottom)."""
    left, top, right, bottom = img.getchannel("A").getbbox()
    h = bottom - top
    hip = top + round(h * 0.62)
    lc = (left + right) // 2
    upper = blank()
    lower = blank()
    for y in range(CELL):
        for x in range(CELL):
            px = img.getpixel((x, y))
            if px[3] == 0:
                continue
            if y < hip:
                upper.putpixel((x, y), px)
            else:
                lower.putpixel((x, y), px)
    return upper, lower, lc, hip, bottom


def shear_legs(lower, lc, hip, bottom, a):
    """Front leg (x >= lc) moves by +offset, back leg by -offset, growing toward the feet."""
    out = blank()
    for y in range(hip, CELL):
        off = round(a * (y - hip) / max(1, bottom - hip))
        for x in range(CELL):
            px = lower.getpixel((x, y))
            if px[3] == 0:
                continue
            nx = x + off if x >= lc else x - off
            if 0 <= nx < CELL:
                out.putpixel((nx, y), px)
    return out


def stretch(img, sx, sy):
    """Scale the whole sprite around its bottom centre, so the feet stay put."""
    w = max(1, round(CELL * sx))
    h = max(1, round(CELL * sy))
    scaled = img.resize((w, h), Image.NEAREST)
    out = blank()
    out.paste(scaled, (CELL // 2 - w // 2, CELL - h))
    return out


def rotate_upper(upper, lc, hip, deg):
    return upper.rotate(deg, resample=Image.NEAREST, center=(lc, hip))


def white(img):
    out = Image.new("RGBA", img.size, (255, 255, 255, 0))
    out.putalpha(img.getchannel("A"))
    solid = Image.new("RGBA", img.size, (255, 255, 255, 255))
    solid.putalpha(img.getchannel("A"))
    return solid


def frame(img, dx=0, dy=0, a=0, upper_dy=0, rot=0, sx=1.0, sy=1.0):
    upper, lower, lc, hip, bottom = cut(img)
    if a:
        lower = shear_legs(lower, lc, hip, bottom, a)
    if rot:
        upper = rotate_upper(upper, lc, hip, rot)
    if upper_dy:
        upper = shift(upper, 0, upper_dy)
    body = blank()
    body.alpha_composite(lower)
    body.alpha_composite(upper)
    if sx != 1.0 or sy != 1.0:
        body = stretch(body, sx, sy)
    return shift(body, dx, dy)


# Rows, in order: name, then the frames (left to right).
ROW_FRAMES = [
    [dict(upper_dy=0), dict(upper_dy=0), dict(upper_dy=1), dict(upper_dy=1)],                 # 0 idle
    [dict(a=a, upper_dy=u) for a, u in zip([3, 1, -1, -3, -1, 1], [0, -1, 0, 0, -1, 0])],     # 1 walk
    [dict(dx=-2, rot=8), dict(dx=3, rot=-12), dict(dx=2, rot=-6), dict(dx=1)],                # 2 melee
    [dict(dx=-1), dict(dx=2, sy=1.04), dict(dx=1)],                                           # 3 cast
    [dict(sx=0.92, sy=1.08), dict(a=2, upper_dy=-1)],                                         # 4 jump
    [dict(sx=1.12, sy=0.88)],                                                                 # 5 land
    None,                                                                                     # 6 hurt
]


def build_atlas(img):
    atlas = Image.new("RGBA", (COLS * CELL, ROWS * CELL), (0, 0, 0, 0))
    for r, frames in enumerate(ROW_FRAMES):
        if frames is None:
            cells = [white(img)]
        else:
            cells = [frame(img, **kw) for kw in frames]
        for c, cell in enumerate(cells[:COLS]):
            atlas.paste(cell, (c * CELL, r * CELL), cell)
    return atlas


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    made = []
    for key, rel in SOURCES.items():
        img = Image.open(ASSETS / rel).convert("RGBA")
        if img.size != (CELL, CELL):
            img = img.resize((CELL, CELL), Image.NEAREST)
        atlas = build_atlas(img)
        atlas.save(OUT / (key + ".png"))
        made.append((key, atlas))
        print("wrote", OUT / (key + ".png"))
    # Preview: every atlas scaled 3x with nearest neighbour, one under another.
    scale = 3
    w = COLS * CELL * scale
    h = ROWS * CELL * scale
    sheet = Image.new("RGBA", (w, h * len(made)), (40, 40, 48, 255))
    for i, (_, atlas) in enumerate(made):
        big = atlas.resize((w, h), Image.NEAREST)
        sheet.alpha_composite(big, (0, i * h))
    sheet.save(PREVIEW)
    print("wrote", PREVIEW)


if __name__ == "__main__":
    main()
