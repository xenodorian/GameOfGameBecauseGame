#!/usr/bin/env python3
"""Compose LPC character sheets for the game (Pillow only, no network).

Reads the Liberated Pixel Cup (Universal LPC) sprite layers from a checkout of
https://github.com/liberatedpixelcup/Universal-LPC-Spritesheet-Character-Generator
and writes one sheet per character to game/assets/lpc/<key>.png, plus
game/assets/lpc/CREDITS.txt listing the authors and licenses of every layer used.

    python3 game/tools/build_lpc.py /path/to/Universal-LPC-Spritesheet-Character-Generator

Sheet layout: 64 px cells, 13 columns, 8 rows. Rows (in order): idle, walk, slash,
thrust, spellcast, shoot, hurt, jump. Each row holds the right-facing frames; the game
flips them for left. Layers are stacked by the generator's zPos values.
"""
import json
import pathlib
import sys

from PIL import Image

GAME = pathlib.Path(__file__).resolve().parent.parent
OUT = GAME / "assets" / "lpc"
CELL = 64
COLS = 13
ANIMS = ["idle", "walk", "slash", "thrust", "spellcast", "shoot", "hurt", "jump"]
RIGHT_ROW = 3  # LPC rows are up, left, down, right
# If a layer has no frames for an animation, try these in order.
FALLBACK = {
    "idle": ["walk"], "jump": ["idle", "walk"], "thrust": ["slash"], "slash": ["thrust"],
    "shoot": ["spellcast", "thrust"], "spellcast": ["shoot", "thrust"], "hurt": ["idle"],
}

# Each character is a list of (item folder, zPos). zPos values come from the generator's
# sheet_definitions, looked up by folder in scan_zpos(); the value here is only a fallback.
CHARACTERS = {
    "knight": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/human/male/{anim}.png", 100),
        ("legs/armour/plate/male/{anim}.png", 20), ("feet/armour/plate/male/{anim}.png", 15),
        ("torso/armour/plate/male/{anim}.png", 60), ("arms/armour/plate/male/{anim}.png", 60),
        ("hat/helmet/greathelm/male/{anim}.png", 130),
        ("shield/heater/revised/trim/bg/{anim}.png", 3), ("shield/heater/revised/trim/fg/{anim}.png", 115),
        ("weapon/sword/arming/universal/bg/{anim}/steel.png", 9), ("weapon/sword/arming/universal/fg/{anim}/steel.png", 140),
    ],
    "ranger": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/human/male/{anim}.png", 100),
        ("legs/pants/male/{anim}.png", 20), ("feet/shoes/basic/thin/{anim}.png", 15),
        ("torso/armour/leather/male/{anim}.png", 60), ("hat/cloth/hood/adult/{anim}.png", 130),
        ("weapon/ranged/bow/normal/universal/background/{anim}/light.png", -1),
        ("weapon/ranged/bow/normal/universal/foreground/{anim}/light.png", 140),
    ],
    "mage": [
        ("body/bodies/female/{anim}.png", 10), ("head/heads/human/female/{anim}.png", 100),
        ("torso/clothes/robe/female/{anim}/blue.png", 35), ("hat/magic/wizard/base/adult/{anim}/base_black.png", 130),
        ("weapon/magic/simple/background/{anim}/simple.png", 9), ("weapon/magic/simple/foreground/{anim}/simple.png", 140),
    ],
    "rat": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/rat/adult/{anim}.png", 100),
        ("torso/armour/leather/male/{anim}.png", 60),
        ("weapon/sword/dagger/behind/{anim}/dagger.png", 9), ("weapon/sword/dagger/{anim}/dagger.png", 140),
    ],
    "weaver": [
        ("body/bodies/skeleton/{anim}.png", 10), ("head/heads/skeleton/adult/{anim}.png", 100),
        ("weapon/ranged/bow/normal/universal/background/{anim}/light.png", -1),
        ("weapon/ranged/bow/normal/universal/foreground/{anim}/light.png", 140),
    ],
    "archer": [("body/bodies/skeleton/{anim}.png", 10), ("head/heads/skeleton/adult/{anim}.png", 100)],
    "grunt": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/goblin/adult/{anim}.png", 100),
        ("torso/armour/leather/male/{anim}.png", 60),
    ],
    "mud_revenant": [("body/bodies/zombie/{anim}/zombie.png", 10), ("head/heads/zombie/adult/{anim}.png", 100)],
    "rat_king": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/rat/adult/{anim}.png", 100),
        ("torso/armour/plate/male/{anim}.png", 60), ("hat/formal/crown/adult/{anim}/crown_gold.png", 130),
    ],
    "warlord": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/orc/male/{anim}.png", 100),
        ("legs/armour/plate/male/{anim}.png", 20), ("feet/armour/plate/male/{anim}.png", 15),
        ("torso/armour/plate/male/{anim}.png", 60), ("arms/armour/plate/male/{anim}.png", 60),
        ("hat/helmet/greathelm/male/{anim}.png", 130),
    ],
}


def item_folder(pattern):
    """The item folder a layer pattern belongs to, for example body/bodies/male."""
    parts = pattern.split("/")
    cut = next(i for i, p in enumerate(parts) if p.startswith("{anim}") or p.endswith(".png"))
    return "/".join(parts[:cut]).rstrip("/")


def scan_zpos(defs):
    """Map each item folder (for example body/bodies/male) to its zPos and its definition file."""
    found = {}
    for f in defs.rglob("*.json"):
        if "meta" in f.name:
            continue
        try:
            d = json.loads(f.read_text(encoding="utf-8"))
        except Exception:
            continue
        if not isinstance(d, dict):
            continue
        for k, v in d.items():
            if not k.startswith("layer_") or not isinstance(v, dict):
                continue
            for bt, p in v.items():
                if isinstance(p, str) and "/" in p and bt != "zPos":
                    found.setdefault(p.rstrip("/"), (v.get("zPos"), f))
    return found


def layer_path(lpc, pattern, anim):
    return lpc / "spritesheets" / pattern.replace("{anim}", anim)


def frames_of(sheet_path, row):
    """Return the list of 64 px frames in one row of an animation sheet, or None if absent."""
    if not sheet_path.exists():
        return None
    im = Image.open(sheet_path).convert("RGBA")
    n = im.size[0] // CELL
    return [im.crop((c * CELL, row * CELL, c * CELL + CELL, row * CELL + CELL)) for c in range(n)]


def compose(lpc, key, layers, zmap, report):
    sheet = Image.new("RGBA", (COLS * CELL, len(ANIMS) * CELL), (0, 0, 0, 0))
    ordered = sorted(layers, key=lambda L: L[1])
    for r, anim in enumerate(ANIMS):
        row = 0 if anim == "hurt" else RIGHT_ROW
        frames = None
        for folder, z in ordered:
            layer_frames = frames_of(layer_path(lpc, folder, anim), row)
            if layer_frames is None:
                # Use a similar animation so the layer does not vanish from the frames. A weapon
                # only reuses its walk pose on idle and jump, so it stays in hand there.
                is_weapon = "/weapon/" in f"/{folder}"
                subs = (["walk"] if anim in ("idle", "jump") else []) if is_weapon else FALLBACK.get(anim, [])
                for sub in subs:
                    layer_frames = frames_of(layer_path(lpc, folder, sub), RIGHT_ROW if sub != "hurt" else 0)
                    if layer_frames is not None:
                        report.append(f"{key}: {folder} has no {anim}, used {sub}")
                        break
            if layer_frames is None:
                report.append(f"{key}: {folder} has no {anim}")
                continue
            if frames is None:
                frames = [Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0)) for _ in layer_frames]
            if len(layer_frames) > len(frames):
                frames += [Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0)) for _ in range(len(layer_frames) - len(frames))]
            for i, fr in enumerate(layer_frames):
                frames[i] = Image.alpha_composite(frames[i], fr)
        for c, fr in enumerate((frames or [])[:COLS]):
            sheet.paste(fr, (c * CELL, r * CELL), fr)
    OUT.mkdir(parents=True, exist_ok=True)
    sheet.save(OUT / f"{key}.png")
    return sheet


def credits_for(defs, zmap_files, folders):
    """Credit entries for the item folders this character uses. Unused variants are skipped."""
    lines = []
    seen = set()
    used = {item_folder(folder) for folder in folders}
    for folder in folders:
        f = zmap_files.get(item_folder(folder))
        if not f or f in seen:
            continue
        seen.add(f)
        d = json.loads(f.read_text(encoding="utf-8"))
        for cr in d.get("credits", []):
            file = cr.get("file", folder).rstrip("/")
            if not any(file == u or file.startswith(u + "/") or u.startswith(file + "/") for u in used):
                continue
            authors = ", ".join(cr.get("authors", []))
            licenses = ", ".join(cr.get("licenses", []))
            urls = " ".join(cr.get("urls", []))
            lines.append(f"{file}\n  authors: {authors}\n  licenses: {licenses}\n  {urls}")
    return lines


def main():
    if len(sys.argv) < 2:
        raise SystemExit("usage: build_lpc.py <path to LPC generator checkout>")
    lpc = pathlib.Path(sys.argv[1])
    defs = lpc / "sheet_definitions"
    zfound = scan_zpos(defs)
    zmap = {k: (v[0], v[1]) for k, v in zfound.items()}
    report = []
    all_credit_lines = []
    for key, layers in CHARACTERS.items():
        compose(lpc, key, layers, zmap, report)
        folders = [f for f, _ in layers]
        all_credit_lines += [f"[{key}]"] + credits_for(defs, {k: v[1] for k, v in zfound.items()}, folders)
        print("wrote", OUT / f"{key}.png")
    (OUT / "CREDITS.txt").write_text("\n".join(all_credit_lines) + "\n", encoding="utf-8")
    print("wrote", OUT / "CREDITS.txt")
    if report:
        print("missing layers (skipped):")
        for line in sorted(set(report)):
            print("  " + line)


if __name__ == "__main__":
    main()
