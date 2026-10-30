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
# Frames are composed in BIG px cells so that weapons can reach past the 64 px body.
BIG = 192
COUNT = {"idle": 2, "walk": 9, "slash": 6, "thrust": 8, "spellcast": 7, "shoot": 13, "hurt": 6, "jump": 5}
BIG_KEYS = ["knight", "ranger", "mage", "rat", "weaver"]
# A layer pattern -> {anim: fixed path}, for animations that live in another folder (filled below).
PATH_OVERRIDE = {
    "weapon/sword/longsword/universal_behind/{anim}/longsword.png": {
        "slash": "weapon/sword/longsword/attack_slash/behind/longsword.png",
        "thrust": "weapon/sword/longsword/attack_thrust/behind/longsword.png",
    },
    "weapon/sword/longsword/{anim}/longsword.png": {
        "slash": "weapon/sword/longsword/attack_slash/longsword.png",
        "thrust": "weapon/sword/longsword/attack_thrust/longsword.png",
    },
    "weapon/ranged/bow/normal/universal/background/{anim}/light.png": {
        "walk": "weapon/ranged/bow/normal/walk/background/light.png",
    },
    "weapon/ranged/bow/normal/universal/foreground/{anim}/light.png": {
        "walk": "weapon/ranged/bow/normal/walk/foreground/light.png",
    },
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
        ("weapon/sword/longsword/universal_behind/{anim}/longsword.png", 9), ("weapon/sword/longsword/{anim}/longsword.png", 140),
    ],
    "ranger": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/human/male/{anim}.png", 100),
        ("legs/pants/male/{anim}.png", 20), ("feet/shoes/basic/thin/{anim}.png", 15),
        ("torso/armour/leather/male/{anim}.png", 60), ("hat/cloth/hood/adult/{anim}.png", 130),
        ("weapon/ranged/bow/normal/universal/background/{anim}/light.png", -1),
        ("weapon/ranged/bow/normal/universal/foreground/{anim}/light.png", 140),
    ],
    # Session 7: the robe (torso/clothes/robe) only has walk, slash, spellcast and hurt, so idle, thrust,
    # shoot and jump fell back to other poses and the body showed through. Long-sleeve top, pants and
    # boots have every animation the game uses; they are recoloured to the old robe's blues.
    "mage": [
        ("body/bodies/female/{anim}.png", 10), ("head/heads/human/female/{anim}.png", 100),
        ("feet/boots/basic/thin/{anim}.png", 15, "boot"), ("legs/pants/thin/{anim}.png", 20, "navy"),
        ("torso/clothes/longsleeve/longsleeve/female/{anim}.png", 35, "robe"),
        ("hat/magic/wizard/base/adult/{anim}/base_black.png", 130),
        ("weapon/magic/wand/male/{anim}/wand.png", 140),
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
    "archer": [
        ("body/bodies/skeleton/{anim}.png", 10), ("head/heads/skeleton/adult/{anim}.png", 100),
        ("weapon/ranged/bow/normal/universal/background/{anim}/light.png", -1),
        ("weapon/ranged/bow/normal/universal/foreground/{anim}/light.png", 140),
    ],
    "grunt": [
        ("body/bodies/male/{anim}.png", 10), ("head/heads/goblin/adult/{anim}.png", 100),
        ("torso/armour/leather/male/{anim}.png", 60),
        ("weapon/sword/dagger/behind/{anim}/dagger.png", 9), ("weapon/sword/dagger/{anim}/dagger.png", 140),
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
        ("weapon/sword/longsword/universal_behind/{anim}/longsword.png", 9), ("weapon/sword/longsword/{anim}/longsword.png", 140),
    ],
}


# Recolour ramps (dark to light) for uncoloured base sheets. Pixels darker than OUTLINE_LUM keep a dark
# outline; the rest map by brightness onto the ramp.
RAMPS = {
    "robe": [(8, 17, 35), (12, 25, 50), (16, 32, 65), (22, 44, 89), (32, 58, 112)],
    "navy": [(7, 14, 30), (12, 24, 50), (18, 34, 68), (26, 46, 88)],
    "boot": [(40, 26, 20), (62, 42, 30), (88, 60, 40), (116, 82, 54)],
}
OUTLINE_LUM = 60


def recolor(img, ramp_name):
    ramp = RAMPS[ramp_name]
    px = img.load()
    for y in range(img.size[1]):
        for x in range(img.size[0]):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            lum = 0.299 * r + 0.587 * g + 0.114 * b
            if lum < OUTLINE_LUM:
                px[x, y] = (6, 10, 20, a)
                continue
            t = min(0.999, (lum - OUTLINE_LUM) / (255 - OUTLINE_LUM))
            c = ramp[int(t * len(ramp))]
            px[x, y] = (c[0], c[1], c[2], a)
    return img


def item_folder(pattern):
    """The item folder a layer pattern belongs to, for example body/bodies/male."""
    parts = pattern.split("/")
    cut = next((i for i, p in enumerate(parts) if p.startswith("{anim}") or p.endswith(".png")), len(parts))
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
    if pattern in PATH_OVERRIDE and anim in PATH_OVERRIDE[pattern]:
        return lpc / "spritesheets" / PATH_OVERRIDE[pattern][anim]
    return lpc / "spritesheets" / pattern.replace("{anim}", anim)


def frames_of(sheet_path, row):
    """Return the list of BIG px frames in one row of an animation sheet, or None if absent.

    A 64 px cell is centred in a BIG cell. A 128 or 192 px cell (oversize weapons) is centred too.
    """
    if not sheet_path.exists():
        return None
    im = Image.open(sheet_path).convert("RGBA")
    cell = CELL if im.size[1] == CELL else im.size[1] // 4
    if cell not in (64, 128, 192):
        return None
    off = (BIG - cell) // 2
    out = []
    for c in range(im.size[0] // cell):
        big = Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0))
        big.paste(im.crop((c * cell, row * cell, c * cell + cell, row * cell + cell)), (off, off))
        out.append(big)
    return out


def fit(frames, n):
    """Cut a frame list to n frames, or repeat its last frame until it has n."""
    frames = frames[:n]
    while len(frames) < n:
        frames.append(frames[-1])
    return frames


def compose(lpc, key, layers, zmap, report, weapons_only=False):
    big_sheet = Image.new("RGBA", (COLS * BIG, len(ANIMS) * BIG), (0, 0, 0, 0))
    ordered = sorted(layers, key=lambda L: L[1])
    if weapons_only:
        ordered = [L for L in ordered if "/weapon/" in f"/{L[0]}"]
    tints = {L[0]: L[2] for L in layers if len(L) > 2}
    ordered = [(L[0], L[1]) for L in ordered]
    for r, anim in enumerate(ANIMS):
        row = 0 if anim == "hurt" else RIGHT_ROW
        n = COUNT[anim]
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
                        if is_weapon:
                            layer_frames = [layer_frames[0]] * n
                        break
            if layer_frames is None:
                report.append(f"{key}: {folder} has no {anim}")
                continue
            if folder in tints:
                layer_frames = [recolor(fr, tints[folder]) for fr in layer_frames]
            if frames is None:
                frames = [Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0)) for _ in layer_frames]
            if len(layer_frames) > len(frames):
                frames += [Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0)) for _ in range(len(layer_frames) - len(frames))]
            for i, fr in enumerate(layer_frames):
                frames[i] = Image.alpha_composite(frames[i], fr)
        frames = fit(frames or [Image.new("RGBA", (BIG, BIG), (0, 0, 0, 0))], n)
        for c, fr in enumerate(frames[:COLS]):
            big_sheet.paste(fr, (c * BIG, r * BIG), fr)
    # The small sheet is the centre 64 px of each BIG cell, the same size the game drew before.
    small = Image.new("RGBA", (COLS * CELL, len(ANIMS) * CELL), (0, 0, 0, 0))
    for r in range(len(ANIMS)):
        for c in range(COLS):
            x, y = c * BIG + (BIG - CELL) // 2, r * BIG + (BIG - CELL) // 2
            small.paste(big_sheet.crop((x, y, x + CELL, y + CELL)), (c * CELL, r * CELL))
    OUT.mkdir(parents=True, exist_ok=True)
    if not weapons_only:
        small.save(OUT / f"{key}.png")
    if key in BIG_KEYS:
        big_sheet.save(OUT / (f"{key}_weapon_big.png" if weapons_only else f"{key}_big.png"))
    return small


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
    # --only key1,key2 rebuilds just those characters and replaces only their CREDITS.txt sections.
    only = None
    if "--only" in sys.argv:
        only = sys.argv[sys.argv.index("--only") + 1].split(",")
    defs = lpc / "sheet_definitions"
    zfound = scan_zpos(defs)
    zmap = {k: (v[0], v[1]) for k, v in zfound.items()}
    report = []
    all_credit_lines = []
    for key, layers in CHARACTERS.items():
        if only and key not in only:
            continue
        compose(lpc, key, layers, zmap, report)
        if key in BIG_KEYS:
            compose(lpc, key, layers, zmap, report, weapons_only=True)
        folders = [L[0] for L in layers]
        folders += [str(pathlib.Path(p).parent) for f in list(folders) if f in PATH_OVERRIDE for p in PATH_OVERRIDE[f].values()]
        all_credit_lines += [f"[{key}]"] + credits_for(defs, {k: v[1] for k, v in zfound.items()}, folders)
        print("wrote", OUT / f"{key}.png")
    if only:
        # Keep the other characters' sections; replace the rebuilt ones.
        old = (OUT / "CREDITS.txt").read_text(encoding="utf-8").split("\n")
        sections, cur = {}, None
        order = []
        for line in old:
            if line.startswith("[") and line.endswith("]"):
                cur = line[1:-1]
                order.append(cur)
                sections[cur] = []
            elif cur:
                sections[cur].append(line)
        cur = None
        for line in all_credit_lines:
            if line.startswith("[") and line.endswith("]"):
                cur = line[1:-1]
                if cur not in sections:
                    order.append(cur)
                sections[cur] = []
            else:
                sections[cur].append(line)
        all_credit_lines = []
        for k in order:
            all_credit_lines += [f"[{k}]"] + sections[k]
    (OUT / "CREDITS.txt").write_text("\n".join(all_credit_lines) + "\n", encoding="utf-8")
    print("wrote", OUT / "CREDITS.txt")
    if report:
        print("missing layers (skipped):")
        for line in sorted(set(report)):
            print("  " + line)


if __name__ == "__main__":
    main()
