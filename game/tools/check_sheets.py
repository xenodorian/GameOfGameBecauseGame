#!/usr/bin/env python3
"""Check the 192 px sheets (game/assets/lpc/<key>_big.png). Prints FAIL lines, then "sheets OK".

    python3 game/tools/check_sheets.py

Exits 1 when any check fails. Run build_lpc.py first.
"""
import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
from build_lpc import ANIMS, BIG, BIG_KEYS, COLS, COUNT, OUT  # noqa: E402

ROW = {name: i for i, name in enumerate(ANIMS)}
CENTRE = (64, 64, 128, 128)  # the 64 px body inside a 192 px cell


def cell(sheet, r, c):
    return sheet.crop((c * BIG, r * BIG, c * BIG + BIG, r * BIG + BIG))


def opaque_outside_centre(frame):
    mask = frame.getchannel("A").point(lambda a: 255 if a else 0)
    mask.paste(0, CENTRE)
    return mask.getbbox() is not None


def has_bow_wood(frame):
    colors = frame.getcolors(BIG * BIG) or []
    return any(a == 255 and r > 150 and g > 100 and b < 90 for _, (r, g, b, a) in colors)


def main():
    fails = []
    for key in BIG_KEYS:
        sheet = Image.open(OUT / f"{key}_big.png").convert("RGBA")
        for anim, row in ROW.items():
            for c in range(COLS):
                opaque = cell(sheet, row, c).getchannel("A").getbbox() is not None
                if c < COUNT[anim] and not opaque:
                    fails.append(f"{key} {anim} col {c}: empty frame")
                if c >= COUNT[anim] and opaque:
                    fails.append(f"{key} {anim} col {c}: frame past the count")
        if key == "knight":
            for anim in ("slash", "thrust"):
                frames = [cell(sheet, ROW[anim], c) for c in range(COUNT[anim])]
                if not any(opaque_outside_centre(f) for f in frames):
                    fails.append(f"knight {anim}: no blade outside the body")
        if key in ("ranger", "weaver"):
            if not has_bow_wood(cell(sheet, ROW["walk"], 1)):
                fails.append(f"{key} walk col 1: no bow wood colour")
    for line in fails:
        print("FAIL", line)
    if fails:
        sys.exit(1)
    print("sheets OK")


if __name__ == "__main__":
    main()
