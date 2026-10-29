#!/usr/bin/env python3
"""Bundle the Changeling game into one self-contained HTML file.

Reads game/src/index.html, inlines the CSS and JS sources in load order,
and embeds every asset in game/assets as a base64 data URI. Output goes to
game/changeling.html. Run from any directory:

    python3 game/tools/build_single_html.py
"""
import base64
import json
import pathlib

GAME = pathlib.Path(__file__).resolve().parent.parent
SRC = GAME / "src"
ASSETS = GAME / "assets"
OUT = GAME / "changeling.html"

# Load order matters. Each file may use the globals from the files above it.
SCRIPTS = ["engine.js", "ui.js", "sfx.js", "input.js", "levels.js", "world.js", "cards.js", "glow.js", "enemies.js", "abilities.js", "anim.js", "scenes.js", "main.js"]

# Asset key -> file under game/assets. Keys are what the JS asks for.
IMAGES = {
    "wall": "tiles/brick_brown0.png",
    "grass": "tiles/grass0.png",
    "dirt": "tiles/grey_dirt0.png",
    "tree": "tiles/tree1.png",
    "lpc_knight": "lpc/knight.png",
    "lpc_knight_big": "lpc/knight_big.png",
    "lpc_knight_weapon_big": "lpc/knight_weapon_big.png",
    "lpc_ranger": "lpc/ranger.png",
    "lpc_ranger_big": "lpc/ranger_big.png",
    "lpc_ranger_weapon_big": "lpc/ranger_weapon_big.png",
    "lpc_mage": "lpc/mage.png",
    "lpc_mage_big": "lpc/mage_big.png",
    "lpc_mage_weapon_big": "lpc/mage_weapon_big.png",
    "lpc_rat": "lpc/rat.png",
    "lpc_rat_big": "lpc/rat_big.png",
    "lpc_rat_weapon_big": "lpc/rat_weapon_big.png",
    "lpc_weaver": "lpc/weaver.png",
    "lpc_weaver_big": "lpc/weaver_big.png",
    "lpc_weaver_weapon_big": "lpc/weaver_weapon_big.png",
    "lpc_archer": "lpc/archer.png",
    "lpc_grunt": "lpc/grunt.png",
    "lpc_mud_revenant": "lpc/mud_revenant.png",
    "lpc_rat_king": "lpc/rat_king.png",
    "lpc_warlord": "lpc/warlord.png",
}

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif"}


def data_uri(path):
    mime = MIME[path.suffix.lower()]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


# Fonts embedded as base64 @font-face rules under one family name, GameFont.
FONTS = [
    ("fonts/pixelify-sans-latin-400-normal.woff2", 400),
    ("fonts/pixelify-sans-latin-700-normal.woff2", 700),
]


def font_faces():
    rules = []
    for rel, weight in FONTS:
        data = base64.b64encode((ASSETS / rel).read_bytes()).decode("ascii")
        rules.append(
            "@font-face { font-family: \"GameFont\"; font-weight: %d; font-style: normal; "
            "font-display: block; src: url(data:font/woff2;base64,%s) format(\"woff2\"); }" % (weight, data)
        )
    return "\n".join(rules) + "\n"


def build():
    template = (SRC / "index.html").read_text(encoding="utf-8")

    style = font_faces() + (SRC / "style.css").read_text(encoding="utf-8")

    urls = {key: data_uri(ASSETS / rel) for key, rel in IMAGES.items()}
    assets_js = "const ASSET_URLS = " + json.dumps(urls, indent=2) + ";\n"

    scripts = "\n".join(
        f"// ---- {name} ----\n" + (SRC / name).read_text(encoding="utf-8")
        for name in SCRIPTS
    )

    html = (
        template.replace("/*STYLE*/", style)
        .replace("/*ASSETS*/", assets_js)
        .replace("/*SCRIPTS*/", scripts)
    )
    OUT.write_text(html, encoding="utf-8")
    print(f"wrote {OUT} ({OUT.stat().st_size / 1024:.0f} KB)")


if __name__ == "__main__":
    build()
