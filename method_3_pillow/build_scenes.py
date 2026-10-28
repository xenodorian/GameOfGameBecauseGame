"""Method 3: procedural raster generation with Pillow.

Writes four 512x512 PNGs to ./output/:
  pixel_dungeon.png, pixel_field.png, hq_dungeon.png, hq_field.png

Pixel scenes are drawn on a 64x64 cell grid and scaled up with NEAREST
resampling so edges stay hard. HQ scenes are drawn at 2x and downsampled
with LANCZOS for antialiasing.

Run:  python3 build_scenes.py   (requires Pillow)
"""
import hashlib
import math
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "output")
os.makedirs(OUT, exist_ok=True)

SIZE = 512
GRID = 64
CELL = SIZE // GRID  # 8


def h01(x, y):
    """Deterministic pseudo-random value in [0, 1) for a cell."""
    d = hashlib.md5(f"{x},{y}".encode()).digest()
    return d[0] / 255.0


PAL = {
    "k": (27, 27, 42),
    "h": (200, 204, 214),
    "H": (138, 144, 160),
    "e": (34, 34, 48),
    "s": (240, 195, 154),
    "b": (61, 95, 191),
    "B": (43, 63, 134),
    "g": (232, 183, 48),
    "w": (90, 58, 34),
}
ADV_PAL = dict(PAL, h=(107, 74, 47), H=(74, 50, 32), b=(63, 122, 74), B=(45, 90, 54), g=(198, 154, 91))

# 12 cols x 17 rows knight sprite (same silhouette as method 2)
KNIGHT = [
    "....kkkk....",
    "...kHHHHk...",
    "...kHhhHk...",
    "...keeeek...",
    "...kkkkkk...",
    "..kbbbbbbk..",
    ".kbbggggbbk.",
    ".kbbggggbbk.",
    "kHkbbbbbbkHk",
    "kHkBBBBBBkHk",
    "kHkBBBBBBkHk",
    "..kBBBBBBk..",
    "..kBBk.kBBk.",
    "..kBBk.kBBk.",
    "..kwwk.kwwk.",
    "..kwwk.kwwk.",
    ".kkkkk.kkkkk",
]


def draw_sprite(d, grid, x0, y0, pal):
    for r, row in enumerate(grid):
        for c, ch in enumerate(row):
            col = pal.get(ch)
            if col is None:
                continue
            x, y = (x0 + c), (y0 + r)
            d.rectangle([x, y, x, y], fill=col)


def pixel_scene(kind):
    img = Image.new("RGB", (GRID, GRID), (0, 0, 0))
    d = ImageDraw.Draw(img)

    if kind == "dungeon":
        for y in range(50):
            course = y // 4
            off = (course % 2) * 4
            for x in range(GRID):
                mortar = y % 4 == 0 or (x + off) % 8 == 0
                if mortar:
                    c = (20, 19, 28)
                else:
                    t = h01(x, y)
                    c = (74, 79, 94) if t < 0.33 else (85, 91, 107) if t < 0.66 else (63, 67, 82)
                d.point((x, y), fill=c)
        for y in range(50, GRID):
            for x in range(GRID):
                alt = ((x >> 2) + (y >> 2)) % 2 == 0
                d.point((x, y), fill=(44, 47, 59) if alt else (37, 40, 47))
        # torch
        d.rectangle([12, 20, 12, 22], fill=(107, 74, 47))
        d.rectangle([11, 18, 13, 19], fill=(255, 157, 46))
        d.point((12, 17), fill=(255, 226, 122))
        # shadow + knight
        d.rectangle([24, 57, 37, 57], fill=(14, 13, 20))
        draw_sprite(d, KNIGHT, 26, 41, PAL)
    else:
        sky = [(168, 224, 255), (143, 209, 250), (116, 191, 240), (90, 174, 232)]
        for y in range(32):
            d.line([(0, y), (GRID, y)], fill=sky[min(3, y // 8)])
        for x in range(48, 57):
            for y in range(4, 11):
                if math.hypot(x - 52, y - 7) <= 4.2:
                    d.point((x, y), fill=(255, 227, 107))
        for x in range(GRID):
            top = 30 + round(3 * math.sin(x / 6))
            for y in range(top, 40):
                d.point((x, y), fill=(143, 207, 126) if y == top else (111, 179, 106))
        for y in range(40, GRID):
            for x in range(GRID):
                t = h01(x, y)
                c = (63, 138, 72) if t < 0.2 else (78, 163, 86) if t < 0.6 else (92, 184, 98)
                d.point((x, y), fill=c)
        for tx, ty, s in [(4, 30, 1.0), (20, 28, 0.85), (45, 27, 0.9), (57, 31, 1.1)]:
            r = round(5 * s)
            d.rectangle([tx, ty + r - 1, tx, ty + r + 5], fill=(107, 74, 47))
            for y in range(ty - r, ty + r + 1):
                for x in range(tx - r, tx + r + 1):
                    dist = math.hypot(x - tx, y - ty)
                    if dist <= r + 0.4:
                        light = (79, 166, 80) if (x < tx and y < ty) else (47, 125, 60)
                        edge = (30, 90, 43) if dist > r - 0.6 else light
                        d.point((x, y), fill=edge)
        d.rectangle([24, 57, 37, 57], fill=(45, 107, 56))
        draw_sprite(d, KNIGHT, 26, 41, ADV_PAL)

    return img.resize((SIZE, SIZE), Image.NEAREST)


def vgrad(size, top, bottom):
    w, h = size
    grad = Image.new("RGB", (w, h))
    gd = ImageDraw.Draw(grad)
    for y in range(h):
        t = y / (h - 1)
        c = tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3))
        gd.line([(0, y), (w, y)], fill=c)
    return grad


def radial_glow(img, center, radius, color, strength):
    glow = Image.new("L", img.size, 0)
    gd = ImageDraw.Draw(glow)
    cx, cy = center
    for r in range(radius, 0, -2):
        a = int(255 * strength * (1 - r / radius) ** 2)
        gd.ellipse([cx - r, cy - r, cx + r, cy + r], fill=a)
    layer = Image.new("RGB", img.size, color)
    return Image.composite(layer, img, glow.filter(ImageFilter.GaussianBlur(4)))


def hq_knight(d, cx, feet, s):
    """Knight drawn at 2x. s = scale factor."""
    def P(x, y):
        return (cx + x * s, feet + y * s)

    def box(x0, y0, x1, y1, **kw):
        d.rounded_rectangle([*P(x0, y0), *P(x1, y1)], **kw)

    steel = (170, 180, 196)
    d.ellipse([*P(-78, -6), *P(78, 14)], fill=(0, 0, 0, 0))  # shadow below (filled next pass)
    d.ellipse([*P(-70, -2), *P(70, 14)], fill=(25, 27, 35))
    box(-36, -80, -8, 2, radius=8 * s, fill=steel, outline=(26, 29, 38), width=3)
    box(8, -80, 36, 2, radius=8 * s, fill=steel, outline=(26, 29, 38), width=3)
    box(-42, -20, -6, -2, radius=5 * s, fill=(59, 42, 30), outline=(26, 29, 38), width=2)
    box(6, -20, 42, -2, radius=5 * s, fill=(59, 42, 30), outline=(26, 29, 38), width=2)
    d.polygon([P(-52, -190), P(52, -190), P(46, -70), P(-46, -70)], fill=(59, 106, 214), outline=(26, 29, 38))
    d.ellipse([*P(-14, -144), *P(14, -116)], fill=(232, 183, 48), outline=(138, 100, 16), width=2)
    box(-70, -186, -44, -68, radius=13 * s, fill=steel, outline=(26, 29, 38), width=3)
    box(44, -186, 70, -68, radius=13 * s, fill=steel, outline=(26, 29, 38), width=3)
    box(-40, -226, 40, -176, radius=16 * s, fill=steel, outline=(26, 29, 38), width=3)
    d.rectangle([*P(-26, -205), *P(26, -197)], fill=(17, 17, 17))
    d.polygon([P(0, -272), P(30, -258), P(22, -236), P(8, -250)], fill=(194, 54, 43), outline=(107, 21, 17))


def hq_dungeon():
    S = 2  # supersample factor
    W = SIZE * S
    img = vgrad((W, W), (42, 47, 61), (20, 23, 34))
    d = ImageDraw.Draw(img)
    # brick texture
    for row, y in enumerate(range(0, W, 32 * S // 2)):
        off = (row % 2) * 32
        d.line([(0, y), (W, y)], fill=(12, 13, 19), width=2)
        for x in range(-off, W, 64):
            d.line([(x, y), (x, y + 16 * S)], fill=(12, 13, 19), width=2)
    # arches
    for x0 in (40, 352):
        x0 *= S
        d.rounded_rectangle([x0, 150 * S, x0 + 120 * S, 470 * S], radius=60 * S, fill=(12, 14, 21), outline=(58, 65, 82), width=6)
    img = radial_glow(img, (100 * S, 200 * S), 120 * S, (255, 179, 71), 0.6)
    img = radial_glow(img, (412 * S, 200 * S), 120 * S, (255, 179, 71), 0.6)
    d = ImageDraw.Draw(img)
    d.rectangle([0, 380 * S, W, W], fill=(38, 34, 50))
    d.line([(0, 380 * S), (W, 380 * S)], fill=(74, 67, 88), width=3)
    hq_knight(d, 256 * S, 440 * S, S)
    return img.resize((SIZE, SIZE), Image.LANCZOS)


def hq_field():
    S = 2
    W = SIZE * S
    img = vgrad((W, W), (90, 168, 238), (244, 251, 255))
    img = radial_glow(img, (400 * S, 110 * S), 110 * S, (255, 246, 194), 0.7)
    d = ImageDraw.Draw(img)
    d.ellipse([(400 - 34) * S, (110 - 34) * S, (400 + 34) * S, (110 + 34) * S], fill=(255, 246, 194))
    for cx, cy, rx, ry in [(120, 90, 60, 18), (150, 78, 40, 16)]:
        d.ellipse([(cx - rx) * S, (cy - ry) * S, (cx + rx) * S, (cy + ry) * S], fill=(255, 255, 255))
    # far hills
    pts = [(0, 360)]
    for x in range(0, 513, 8):
        y = 300 + 40 * math.sin(x / 90.0) * 0.5 + (x / 512.0) * -10
        pts.append((x * S, y * S))
    pts.append((W, 512 * S)); pts.append((0, 512 * S))
    d.polygon(pts, fill=(111, 166, 106))
    # grass
    grass = vgrad((W, (512 - 350) * S), (124, 196, 106), (60, 122, 58))
    img.paste(grass, (0, 350 * S))
    d = ImageDraw.Draw(img)

    def tree(x, y, s):
        d.rounded_rectangle([(x - 7 * s) * S, y * S, (x + 7 * s) * S, (y + 90 * s) * S], radius=4 * S, fill=(107, 74, 47))
        d.ellipse([(x - 62 * s) * S, (y - 90 * s) * S, (x + 62 * s) * S, (y + 50 * s) * S], fill=(79, 166, 80), outline=(30, 90, 43), width=2)
        d.ellipse([(x - 40 * s) * S, (y - 80 * s) * S, (x - 4 * s) * S, (y - 40 * s) * S], fill=(155, 224, 138))

    tree(60, 300, 0.8)
    tree(440, 296, 0.9)
    tree(372, 358, 1.25)
    tree(150, 380, 1.1)

    # adventurer
    fx, fy = 256 * S, 450 * S

    def P(x, y):
        return (fx + x * S, fy + y * S)

    d.ellipse([*P(-90, -4), *P(90, 14)], fill=(25, 27, 35))
    d.polygon([P(-46, -140), P(-60, -4), P(-10, -4), P(0, -140)], fill=(74, 54, 32))
    d.polygon([P(4, -140), P(14, -4), P(58, -4), P(46, -140)], fill=(74, 54, 32))
    d.rounded_rectangle([*P(42, -270), *P(112, -150)], radius=16 * S, fill=(107, 74, 47), outline=(46, 31, 18), width=3)
    d.polygon([P(-52, -250), P(0, -282), P(52, -250), P(70, -110), P(0, -80), P(-70, -110)], fill=(63, 122, 74), outline=(29, 58, 37))
    d.polygon([P(-40, -250), P(0, -226), P(40, -250), P(38, -200), P(0, -190), P(-38, -200)], fill=(198, 154, 91))
    d.rectangle([*P(-40, -180), *P(40, -168)], fill=(58, 39, 22))
    d.rectangle([*P(-6, -182), *P(6, -166)], fill=(232, 183, 48))
    d.line([P(74, -290), P(86, -8)], fill=(122, 82, 48), width=7 * S)
    d.ellipse([*P(63, -303), *P(85, -281)], fill=(127, 214, 255), outline=(42, 110, 153), width=2)
    d.ellipse([*P(-44, -330), *P(44, -230)], fill=(63, 122, 74), outline=(29, 58, 37), width=3)
    d.chord([*P(-46, -346), *P(46, -250)], start=180, end=360, fill=(45, 90, 54))
    d.ellipse([*P(-24, -298), *P(28, -242)], fill=(198, 154, 91))
    d.ellipse([*P(-12, -278), *P(-4, -270)], fill=(34, 34, 34))
    d.ellipse([*P(4, -278), *P(12, -270)], fill=(34, 34, 34))
    return img.resize((SIZE, SIZE), Image.LANCZOS)


if __name__ == "__main__":
    scenes = {
        "pixel_dungeon": pixel_scene("dungeon"),
        "pixel_field": pixel_scene("field"),
        "hq_dungeon": hq_dungeon(),
        "hq_field": hq_field(),
    }
    for name, img in scenes.items():
        path = os.path.join(OUT, name + ".png")
        img.save(path)
        print("wrote", path)
