"""Walk-in-and-out animation: knight and ranger walk from a brick dungeon
interior, pass the doorway, and continue into an outdoor field with a
parallax background.

Two styles, written as separate GIFs:
  output/walk_pixel.gif  pixel art (48px sprites, DCSS tiles at 2x)
  output/walk_2d.gif     high quality 2D (512px HD sprites, smoothed backgrounds)

Walk cycle is procedural: the upper body bobs, and the legs (lower part of the
sprite) slide side to side out of phase. The source packs contain only single
side-view frames, so there is no hand-drawn walk cycle.

Parallax: sky is fixed, far hills move at 0.25x camera speed, mid trees at
0.5x, and the ground, near trees, and the interior walls at 1.0x.

Run:  python3 build_walk.py   (requires Pillow)
"""
import math
import os

from PIL import Image, ImageDraw, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(HERE, "assets")
OUT = os.path.join(HERE, "output")
os.makedirs(OUT, exist_ok=True)

SIZE = 512
GROUND = 430          # feet line on screen
FLOOR_TOP = 380       # top of the floor band (interior) and grass band (outdoor)
DOOR_X = 880          # world x where the outdoor begins
BLEND = 60            # width of the interior-to-outdoor fade
FRAMES = 72
SPEED = 22            # world px per frame for the camera

FACTORS = {"sky": 0.0, "far": 0.25, "mid": 0.5, "near": 1.0}


def load(rel):
    return Image.open(os.path.join(ASSETS, rel)).convert("RGBA")


def walk_frame(sprite, phase, bob_max, leg_dx_max):
    """Return a copy of sprite with upper body bobbed and legs shifted."""
    w, h = sprite.size
    split = int(h * 0.62)
    upper = sprite.crop((0, 0, w, split))
    lower = sprite.crop((0, split, w, h))
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    bob = round(bob_max * abs(math.sin(phase)))
    dx = round(leg_dx_max * math.sin(phase))
    out.alpha_composite(upper, (0, -bob))
    out.alpha_composite(lower, (dx, split))
    return out


def tile_row(canvas, tiles, x_offset, y, tile_w, tile_h, pick, cam_factor, cam, start_x=None):
    """Draw a repeating row of tiles at a camera-relative offset."""
    shift = cam * cam_factor
    first = int(math.floor((shift + 0) / tile_w)) - 1
    k = first
    while True:
        sx = k * tile_w - shift
        if sx > SIZE:
            break
        if sx + tile_w >= 0:
            t = tiles[pick(k) % len(tiles)]
            canvas.alpha_composite(t, (int(sx), y))
        k += 1


def hills_layer(factor_cam, scale, color_far, color_near):
    """Procedural hill silhouette as RGBA, drawn over a 1024-wide repeat."""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    period = 360
    shift = factor_cam
    for k in range(-2, SIZE // period + 3):
        base_x = k * period - shift
        for x in range(0, period, 4):
            y = FLOOR_TOP - 60 - int(40 * math.sin((x + k * 37) / 52.0)) - int(20 * math.sin(x / 19.0 + k))
            d.rectangle([base_x + x, y, base_x + x + 4, FLOOR_TOP], fill=color_far)
    return img


def trees_layer(cam_factor_cam, scale, tree, period):
    """Place a tree every `period` world px along the outdoor band."""
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    shift = cam_factor_cam
    k = int(math.floor(shift / period)) - 1
    while True:
        sx = k * period - shift + 40
        if sx > SIZE + 200:
            break
        t = tree
        img.alpha_composite(t, (int(sx), FLOOR_TOP - t.height + 12))
        k += 1
    return img


def mask_outdoor(cam, blend, boundary):
    """Alpha mask: 0 left of the door, 255 right of it, linear fade."""
    mask = Image.new("L", (SIZE, SIZE), 0)
    d = ImageDraw.Draw(mask)
    edge = DOOR_X - cam  # screen x of the doorway
    for x in range(SIZE):
        t = (x - (edge - blend / 2)) / blend
        a = max(0, min(255, int(255 * t)))
        d.line([(x, 0), (x, SIZE)], fill=a)
    return mask


def shadow(canvas, cx, base_y, rx, ry):
    layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(layer).ellipse([cx - rx, base_y - ry, cx + rx, base_y + ry], fill=(0, 0, 0, 90))
    canvas.alpha_composite(layer)


def place(canvas, sprite, cx, base_y, height):
    ratio = height / sprite.height
    w = int(sprite.width * ratio)
    s = sprite.resize((w, height), Image.NEAREST if sprite.width <= 64 else Image.LANCZOS)
    canvas.alpha_composite(s, (cx - w // 2, base_y - height))


# ---------------------------------------------------------------- pixel style

def pixel_background(cam):
    """Return (interior_layer, outdoor_layer) as RGBA 512x512 images."""
    brick = [load("dcss/walls/brick_brown0.png").resize((64, 64), Image.NEAREST),
             load("dcss/walls/brick_brown1.png").resize((64, 64), Image.NEAREST)]
    dirt = [load("dcss/floors/grey_dirt0.png").resize((64, 64), Image.NEAREST),
            load("dcss/floors/grey_dirt1.png").resize((64, 64), Image.NEAREST)]
    grass = [load("dcss/grass/grass-dark0.png").resize((64, 64), Image.NEAREST),
             load("dcss/grass/grass-dark1.png").resize((64, 64), Image.NEAREST),
             load("dcss/grass/grass-dark2.png").resize((64, 64), Image.NEAREST),
             load("dcss/grass/grass-dark3.png").resize((64, 64), Image.NEAREST)]
    tree = load("dcss/trees/tree1.png").resize((96, 96), Image.NEAREST)
    tree2 = load("dcss/trees/tree2.png").resize((96, 96), Image.NEAREST)

    # interior: brick wall above, dirt floor below, with a doorway arch at DOOR_X
    interior = Image.new("RGBA", (SIZE, SIZE), (18, 16, 22, 255))
    shift = cam
    k0 = int(math.floor(shift / 64)) - 1
    for k in range(k0, k0 + 12):
        for row in range(0, FLOOR_TOP // 64 + 1):
            sx = k * 64 - shift
            sy = row * 64
            interior.alpha_composite(brick[(k + row) % 2], (int(sx), sy))
    k0 = int(math.floor(shift / 64)) - 1
    for k in range(k0, k0 + 12):
        sx = k * 64 - shift
        interior.alpha_composite(dirt[k % 2], (int(sx), FLOOR_TOP))
    # doorway arch, on the interior side of DOOR_X
    dx = DOOR_X - cam
    d = ImageDraw.Draw(interior)
    d.rounded_rectangle([dx - 40, FLOOR_TOP - 130, dx + 40, FLOOR_TOP + 60], radius=30, fill=(10, 9, 14, 255), outline=(60, 55, 70, 255), width=4)

    # outdoor: sky bands (fixed), parallax far hills, mid trees, grass ground, near trees
    outdoor = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
    sky = [(168, 224, 255), (143, 209, 250), (116, 191, 240), (90, 174, 232)]
    od = ImageDraw.Draw(outdoor)
    for y in range(0, FLOOR_TOP):
        od.line([(0, y), (SIZE, y)], fill=sky[min(3, y // 90)] + (255,))
    od.ellipse([400, 30, 460, 90], fill=(255, 230, 110, 255))

    far = hills_layer(cam * FACTORS["far"], 1, (111, 179, 106, 255), (143, 207, 126, 255))
    outdoor.alpha_composite(far)
    mid = trees_layer(cam * FACTORS["mid"], 1, tree2, 220)
    outdoor.alpha_composite(mid)

    # ground grass band, parallax factor 1.0
    k0 = int(math.floor(cam / 64)) - 1
    for k in range(k0, k0 + 12):
        for row in range(0, 2):
            sx = k * 64 - cam
            sy = FLOOR_TOP + row * 64
            outdoor.alpha_composite(grass[(k * 3 + row) % 4], (int(sx), sy))

    # near trees, factor 1.0 (foreground, fastest)
    k0 = int(math.floor(cam / 300)) - 1
    for k in range(k0, k0 + 6):
        sx = k * 300 + 150 - cam
        outdoor.alpha_composite(tree, (int(sx), FLOOR_TOP - 60))
    return interior, outdoor


def pixel_frame(cam, phase):
    interior, outdoor = pixel_background(cam)
    mask = mask_outdoor(cam, BLEND, DOOR_X)
    canvas = Image.composite(outdoor, interior, mask)
    # characters, standing side by side (ranger in front, knight behind)
    knight = walk_frame(load("heroes_48/knight_right.png"), phase, bob_max=1, leg_dx_max=2)
    ranger = walk_frame(load("heroes_48/ranger_right.png"), phase + math.pi, bob_max=1, leg_dx_max=2)
    shadow(canvas, 180, GROUND, 40, 9)
    place(canvas, knight, 180, GROUND, 192)
    shadow(canvas, 330, GROUND, 40, 9)
    place(canvas, ranger, 330, GROUND, 192)
    return canvas.convert("RGB")


# ----------------------------------------------------------------- 2D style

def hq_background(cam):
    """Smoother backgrounds: DCSS textures upscaled, soft layers for depth."""
    brick = [load("dcss/walls/brick_brown0.png").resize((128, 128), Image.LANCZOS),
             load("dcss/walls/brick_brown1.png").resize((128, 128), Image.LANCZOS)]
    dirt = [load("dcss/floors/grey_dirt0.png").resize((128, 128), Image.LANCZOS),
            load("dcss/floors/grey_dirt1.png").resize((128, 128), Image.LANCZOS)]
    grass = [load("dcss/grass/grass-dark0.png").resize((128, 128), Image.LANCZOS),
             load("dcss/grass/grass-dark1.png").resize((128, 128), Image.LANCZOS),
             load("dcss/grass/grass-dark2.png").resize((128, 128), Image.LANCZOS),
             load("dcss/grass/grass-dark3.png").resize((128, 128), Image.LANCZOS)]
    tree = load("dcss/trees/tree1.png").resize((192, 192), Image.LANCZOS)
    tree2 = load("dcss/trees/tree2.png").resize((192, 192), Image.LANCZOS)

    interior = Image.new("RGBA", (SIZE, SIZE), (18, 16, 22, 255))
    k0 = int(math.floor(cam / 128)) - 1
    for k in range(k0, k0 + 7):
        for row in range(0, FLOOR_TOP // 128 + 1):
            interior.alpha_composite(brick[(k + row) % 2], (int(k * 128 - cam), row * 128))
        interior.alpha_composite(dirt[k % 2], (int(k * 128 - cam), FLOOR_TOP))
    interior = interior.filter(ImageFilter.GaussianBlur(0.6))
    dx = DOOR_X - cam
    d = ImageDraw.Draw(interior)
    d.rounded_rectangle([dx - 40, FLOOR_TOP - 130, dx + 40, FLOOR_TOP + 60], radius=30, fill=(10, 9, 14, 255), outline=(60, 55, 70, 255), width=4)

    outdoor = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 255))
    od = ImageDraw.Draw(outdoor)
    for y in range(0, FLOOR_TOP):
        t = y / FLOOR_TOP
        c = (int(90 + (244 - 90) * t), int(168 + (251 - 168) * t), int(238 + (255 - 238) * t), 255)
        od.line([(0, y), (SIZE, y)], fill=c)
    od.ellipse([380, 40, 450, 110], fill=(255, 246, 194, 255))
    far = hills_layer(cam * FACTORS["far"], 1, (143, 191, 127, 255), (94, 154, 94, 255))
    far = far.filter(ImageFilter.GaussianBlur(2.0))  # atmospheric depth
    outdoor.alpha_composite(far)
    mid = trees_layer(cam * FACTORS["mid"], 1, tree2, 260)
    mid = mid.filter(ImageFilter.GaussianBlur(1.0))
    outdoor.alpha_composite(mid)
    k0 = int(math.floor(cam / 128)) - 1
    for k in range(k0, k0 + 7):
        for row in range(0, 2):
            outdoor.alpha_composite(grass[(k * 3 + row) % 4], (int(k * 128 - cam), FLOOR_TOP + row * 128))
    k0 = int(math.floor(cam / 420)) - 1
    for k in range(k0, k0 + 4):
        outdoor.alpha_composite(tree, (int(k * 420 + 210 - cam), FLOOR_TOP - 110))
    return interior, outdoor


def hq_frame(cam, phase):
    interior, outdoor = hq_background(cam)
    mask = mask_outdoor(cam, BLEND, DOOR_X)
    canvas = Image.composite(outdoor, interior, mask)
    knight = walk_frame(load("heroes_hd/knight_right.png"), phase, bob_max=8, leg_dx_max=10)
    ranger = walk_frame(load("heroes_hd/ranger_right.png"), phase + math.pi, bob_max=8, leg_dx_max=10)
    shadow(canvas, 180, GROUND, 80, 16)
    place(canvas, knight, 180, GROUND, 340)
    shadow(canvas, 330, GROUND, 80, 16)
    place(canvas, ranger, 330, GROUND, 340)
    return canvas.convert("RGB")


def build(name, frame_fn, colors):
    frames = []
    for i in range(FRAMES):
        cam = i * SPEED
        phase = i * (2 * math.pi / 8)  # 8 frames per stride cycle
        frames.append(frame_fn(cam, phase))
    path = os.path.join(OUT, name)
    frames[0].save(
        path,
        save_all=True,
        append_images=frames[1:],
        duration=70,
        loop=0,
        optimize=False,
        disposal=2,
    )
    print("wrote", path, len(frames), "frames")
    return path


if __name__ == "__main__":
    build("walk_pixel.gif", pixel_frame, None)
    build("walk_2d.gif", hq_frame, None)
