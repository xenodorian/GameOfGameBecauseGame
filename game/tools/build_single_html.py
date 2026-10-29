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
SCRIPTS = ["engine.js", "input.js", "world.js", "cards.js", "enemies.js", "abilities.js", "scenes.js", "main.js"]

# Asset key -> file under game/assets. Keys are what the JS asks for.
IMAGES = {
    "knight_right": "sprites/knight_right.png",
    "knight_front": "sprites/knight_front.png",
    "ranger_right": "sprites/ranger_right.png",
    "wall": "tiles/brick_brown0.png",
    "grass": "tiles/grass0.png",
    "dirt": "tiles/grey_dirt0.png",
    "tree": "tiles/tree1.png",
    "grunt": "enemies/grunt_right.png",
    "mud_revenant": "enemies/mud_revenant_right.png",
}

MIME = {".png": "image/png", ".jpg": "image/jpeg", ".gif": "image/gif"}


def data_uri(path):
    mime = MIME[path.suffix.lower()]
    return f"data:{mime};base64," + base64.b64encode(path.read_bytes()).decode("ascii")


def build():
    template = (SRC / "index.html").read_text(encoding="utf-8")

    style = (SRC / "style.css").read_text(encoding="utf-8")

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
