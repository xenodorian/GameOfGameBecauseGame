"""Showcase GIF: every LPC animation for the knight and the ranger.

Layout: one row per character (knight, ranger), one column per animation
(walk, slash, thrust, shoot, spellcast). Each panel plays its own frame
sequence at a shared tick rate, so cycles of different lengths stay in sync
on a 10-second loop.

Output: output/showcase_all_animations.gif

Run:  python3 build_showcase.py   (requires Pillow)
"""
import os

from PIL import Image, ImageDraw

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets", "lpc")
OUT = os.path.join(HERE, "output")
os.makedirs(OUT, exist_ok=True)

CELL = 64
RIGHT_ROW = 3            # LPC sheet rows: up, left, down, right
PANEL = 128              # each panel is 2x the 64px cell
LABEL_H = 22
PAD = 8
TICK_MS = 50             # GIF frame duration
FRAME_MS = 90            # time each animation frame is shown
LOOP_MS = 10000          # total loop length

ANIMS = [
    # name, sheet suffix, frame count
    ("walk", "walk", 9),
    ("slash", "slash", 6),
    ("thrust", "thrust", 8),
    ("shoot", "shoot", 13),
    ("spellcast", "spellcast", 7),
]

KNIGHT = {
    "behind": ["shield/heater/revised/trim/bg"],
    "body": [
        "body/bodies/male",
        "legs/armour/plate/male",
        "feet/armour/plate/male",
        "torso/armour/plate/male",
        "arms/armour/plate/male",
        "head/heads/human/male",
        "hat/helmet/greathelm/male",
    ],
    "front": ["shield/heater/revised/trim/fg"],
}
RANGER = {
    "behind": ["quiver"],
    "body": [
        "body/bodies/male",
        "legs/pants/male",
        "feet/boots/revised/male",
        "torso/armour/leather/male",
        "head/heads/human/male",
        "hat/cloth/hood/adult",
    ],
    "front": [],
}


def sheet_path(rel, anim):
    """Return the file path for a layer's sheet for this animation."""
    if rel == "quiver":
        return os.path.join(ASSETS, "quiver", anim, "quiver.png") if anim != "walk" \
            else os.path.join(ASSETS, "quiver", "walk", "quiver.png")
    return os.path.join(ASSETS, rel, anim + ".png" if not rel.endswith(("bg", "fg")) else anim + ".png")


_cache = {}


def load_sheet(path):
    if path not in _cache:
        _cache[path] = Image.open(path).convert("RGBA")
    return _cache[path]


def cell(rel, anim, index):
    if rel in ("quiver",) or rel.startswith("shield/"):
        p = sheet_path(rel, anim)
    else:
        p = os.path.join(ASSETS, rel, anim + ".png")
    sheet = load_sheet(p)
    x = index * CELL
    y = RIGHT_ROW * CELL
    return sheet.crop((x, y, x + CELL, y + CELL))


def compose(char, anim, index):
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    for rel in char["behind"] + char["body"] + char["front"]:
        # shield and quiver sheets live under their own folders, handled above
        if rel == "quiver":
            p = os.path.join(ASSETS, "quiver", "walk", "quiver.png") if anim == "walk" \
                else os.path.join(ASSETS, "quiver", anim, "quiver.png")
            sheet = load_sheet(p)
            out.alpha_composite(sheet.crop((index * CELL, RIGHT_ROW * CELL, index * CELL + CELL, RIGHT_ROW * CELL + CELL)))
        else:
            p = os.path.join(ASSETS, rel, anim + ".png")
            if not os.path.exists(p):
                p = os.path.join(ASSETS, rel, "walk.png")
            sheet = load_sheet(p)
            out.alpha_composite(sheet.crop((index * CELL, RIGHT_ROW * CELL, index * CELL + CELL, RIGHT_ROW * CELL + CELL)))
    return out


def frame_index(t_ms, count):
    return (t_ms // FRAME_MS) % count


def build_frame(t_ms):
    cols = len(ANIMS)
    rows = 2
    width = cols * (PANEL + PAD) + PAD
    height = rows * (PANEL + PAD + LABEL_H) + PAD
    canvas = Image.new("RGB", (width, height), (24, 24, 30))
    d = ImageDraw.Draw(canvas)

    for r, (label, char) in enumerate([("KNIGHT", KNIGHT), ("RANGER", RANGER)]):
        for c, (anim, sheet_suffix, count) in enumerate(ANIMS):
            x0 = PAD + c * (PANEL + PAD)
            y0 = PAD + r * (PANEL + PAD + LABEL_H)
            # panel background: brick interior strip for context
            d.rectangle([x0, y0, x0 + PANEL, y0 + PANEL], fill=(44, 40, 48))
            idx = frame_index(t_ms, count)
            img = compose(char, sheet_suffix, idx).resize((PANEL, PANEL), Image.NEAREST)
            canvas.paste(img, (x0, y0), img)
            d.text((x0 + 4, y0 + PANEL + 4), f"{label[0] + label[1:].lower()} {anim}", fill=(230, 230, 230))
    return canvas


def main():
    frames = []
    steps = LOOP_MS // TICK_MS
    for s in range(steps):
        frames.append(build_frame(s * TICK_MS))
    path = os.path.join(OUT, "showcase_all_animations.gif")
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=TICK_MS,
        loop=0,
        disposal=2,
    )
    print("wrote", path, len(frames), "frames")


if __name__ == "__main__":
    main()
