"""Walk-in animation built from real LPC walk-cycle spritesheets.

Each character is composed from layered LPC spritesheets. Every layer is a
standard 9-frame walk cycle (64px cells, 4 rows: up, left, down, right). The
right-facing row is used for both characters, since they walk to the right.

Background, doorway, and parallax layers come from method_4_sourced_assets.

Outputs:
  output/walk_pixel_lpc.gif

Run:  python3 build_walk.py   (requires Pillow)
Licenses for the LPC art are listed in assets/lpc/CREDITS.csv (OGA-BY 3.0,
CC-BY-SA 3.0, GPL 3.0 depending on the asset).
"""
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
M4 = os.path.join(HERE, "..", "method_4_sourced_assets")
sys.path.insert(0, os.path.abspath(M4))
import build_walk as m4  # noqa: E402  (background and parallax helpers)

ASSETS = os.path.join(HERE, "assets", "lpc")
OUT = os.path.join(HERE, "output")
os.makedirs(OUT, exist_ok=True)

CELL = 64
FRAMES_PER_CYCLE = 9
RIGHT_ROW = 3          # LPC walk sheet row order: up, left, down, right
SCALE = 3              # 64px cell -> 192px on screen
GROUND = m4.GROUND     # 430
TOTAL_FRAMES = 72      # 8 full walk cycles
WORLD_PER_FRAME = 16   # camera movement per animation frame


def lpc_cell(rel, index):
    """Return one 64x64 RGBA cell from an LPC walk sheet (right-facing)."""
    sheet = Image.open(os.path.join(ASSETS, rel)).convert("RGBA")
    x = index * CELL
    y = RIGHT_ROW * CELL
    return sheet.crop((x, y, x + CELL, y + CELL))


KNIGHT_LAYERS_BEHIND = ["shield/heater/revised/trim/bg/walk.png"]
KNIGHT_LAYERS = [
    "body/bodies/male/walk.png",
    "legs/armour/plate/male/walk.png",
    "feet/armour/plate/male/walk.png",
    "torso/armour/plate/male/walk.png",
    "arms/armour/plate/male/walk.png",
    "head/heads/human/male/walk.png",
    "hat/helmet/greathelm/male/walk.png",
]
KNIGHT_LAYERS_FRONT = ["shield/heater/revised/trim/fg/walk.png"]

RANGER_LAYERS_BEHIND = ["quiver/walk/quiver.png"]
RANGER_LAYERS = [
    "body/bodies/male/walk.png",
    "legs/pants/male/walk.png",
    "feet/boots/revised/male/walk.png",
    "torso/armour/leather/male/walk.png",
    "head/heads/human/male/walk.png",
    "hat/cloth/hood/adult/walk.png",
]


def compose(behind, layers, front, index):
    """Stack layer cells for one animation frame into a 64x64 image."""
    out = Image.new("RGBA", (CELL, CELL), (0, 0, 0, 0))
    for rel in behind + layers + front:
        out.alpha_composite(lpc_cell(rel, index))
    return out


def place_cell(canvas, cell, cx, base_y):
    scaled = cell.resize((CELL * SCALE, CELL * SCALE), Image.NEAREST)
    # align the bottom of the cell with the ground line
    canvas.alpha_composite(scaled, (cx - scaled.width // 2, base_y - scaled.height))


def hard_cut_mask(edge):
    """Hard vertical edge at screen x = edge: 0 left of it, 255 right of it."""
    mask = Image.new("L", (512, 512), 0)
    mask.paste(255, (edge, 0, 512, 512))
    return mask


DOOR_L_WORLD = 840     # left edge of the door, in world x
DOOR_W = 64
DOOR_TOP = m4.FLOOR_TOP - 150


def draw_wall_patch(canvas, x0, x1, brick, dirt):
    """Re-tile brick over the area beside the door so no old arch shows through."""
    if x1 <= x0:
        return
    patch = Image.new("RGBA", (x1 - x0, 512), (0, 0, 0, 255))
    for y in range(0, m4.FLOOR_TOP, 64):
        for x in range(-64, x1 - x0 + 64, 64):
            patch.alpha_composite(brick[((x + 64) // 64 + y // 64) % 2], (x, y))
    for y in range(m4.FLOOR_TOP, 512, 64):
        for x in range(-64, x1 - x0 + 64, 64):
            patch.alpha_composite(dirt[((x + 64) // 64) % 2], (x, y))
    canvas.alpha_composite(patch, (x0, 0))


def draw_door(canvas, dl, dr):
    """Wooden door set into the wall: stone frame, planks, iron bands, handle."""
    d = m4.ImageDraw.Draw(canvas)
    top, bottom = DOOR_TOP, GROUND
    # stone frame and lintel
    d.rectangle([dl - 8, top - 18, dr + 8, bottom], fill=(92, 86, 84, 255), outline=(40, 38, 42, 255))
    d.rectangle([dl - 8, top - 18, dr + 8, top - 8], fill=(118, 110, 106, 255))
    # door panel
    d.rectangle([dl, top, dr, bottom], fill=(120, 74, 42, 255), outline=(52, 30, 18, 255))
    for x in range(dl + 8, dr, 10):
        d.line([(x, top + 2), (x, bottom - 2)], fill=(92, 54, 30, 255))
    # iron bands
    for yy in (top + 26, top + 112):
        d.rectangle([dl + 2, yy, dr - 2, yy + 6], fill=(70, 70, 78, 255))
    # handle
    d.ellipse([dr - 14, top + 74, dr - 8, top + 80], fill=(210, 180, 90, 255))


def hard_cut_edge(cut_x):
    return cut_x


def frame(i):
    cam = i * WORLD_PER_FRAME
    idx = i % FRAMES_PER_CYCLE
    interior, outdoor = m4.pixel_background(cam)
    dl = DOOR_L_WORLD - cam          # screen x, left edge of door
    dr = dl + DOOR_W                 # screen x, right edge of door
    cut = dr + 10                    # wall ends just past the door's far jamb
    brick = [m4.load("dcss/walls/brick_brown0.png").resize((64, 64), m4.Image.NEAREST),
             m4.load("dcss/walls/brick_brown1.png").resize((64, 64), m4.Image.NEAREST)]
    dirt = [m4.load("dcss/floors/grey_dirt0.png").resize((64, 64), m4.Image.NEAREST),
            m4.load("dcss/floors/grey_dirt1.png").resize((64, 64), m4.Image.NEAREST)]
    canvas = Image.composite(outdoor, interior, hard_cut_mask(cut))
    draw_wall_patch(canvas, dr, cut, brick, dirt)
    draw_door(canvas, dl, dr)

    knight = compose(KNIGHT_LAYERS_BEHIND, KNIGHT_LAYERS, KNIGHT_LAYERS_FRONT, idx)
    ranger = compose(RANGER_LAYERS_BEHIND, RANGER_LAYERS, [], (idx + 4) % FRAMES_PER_CYCLE)

    m4.shadow(canvas, 180, GROUND, 40, 9)
    place_cell(canvas, knight, 180, GROUND)
    m4.shadow(canvas, 330, GROUND, 40, 9)
    place_cell(canvas, ranger, 330, GROUND)
    return canvas.convert("RGB")


if __name__ == "__main__":
    frames = [frame(i) for i in range(TOTAL_FRAMES)]
    path = os.path.join(OUT, "walk_pixel_lpc.gif")
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=90,
        loop=0,
        disposal=2,
    )
    print("wrote", path, len(frames), "frames")
