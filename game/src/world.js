// Tile map, tile legend, and axis-separated collision.
const TILE = 32;

// Legend:
//   #  solid brick wall
//   =  solid grass ground
//   _  one-way platform (solid only when landing from above)
//   T  tree (decor, no collision)
//   S  player spawn (drawn as empty)
//   g  goblin grunt spawn (drawn as empty)
//   m  mud revenant spawn (drawn as empty)
//   j  rat king spawn (drawn as empty)
//   a  archer spawn (drawn as empty)
//   F  level exit flag (drawn as a pole and flag)
//   c  card pickup on the ground (random character card)
//   p  power-up on the ground (draws a random card into hand or deck)
//   .  empty air
const LEVEL_ROWS = [
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "...............................................c........................",
  "........................................................................",
  "......................................c.......====......................",
  "....................................====................................",
  "......................c.................................................",
  "..S......T..........g.......====..g.....j...T.......m...a.F...........p.",
  "============..==================================================....====",
  "############..##################################################....####",
];

const World = (() => {
  const tiles = LEVEL_ROWS.map((row) => row.split(""));
  // Temporary one-way platforms made in play (arrow anchor rope). Each has a life in seconds.
  const platforms = [];
  const rows = tiles.length;
  const cols = tiles[0].length;
  const width = cols * TILE;
  const height = rows * TILE;

  let spawn = { x: 0, y: 0 };
  const enemySpawns = [];
  const MARKERS = { g: "grunt", m: "mud_revenant", j: "rat_king", a: "archer" };
  const pickupSpawns = [];
  let exit = null;
  tiles.forEach((row, ty) =>
    row.forEach((ch, tx) => {
      if (ch === "S") spawn = { x: tx * TILE, y: ty * TILE };
      // The exit zone is 4 tiles tall, reaching 3 tiles above the flag, so a
      // jump that clears the flag's tile still completes the level.
      if (ch === "F") exit = { x: tx * TILE, y: (ty - 3) * TILE, w: TILE, h: 4 * TILE };
      if (MARKERS[ch]) enemySpawns.push({ kind: MARKERS[ch], x: tx * TILE, y: ty * TILE });
      if (ch === "c" || ch === "p") pickupSpawns.push({ power: ch === "p", x: tx * TILE, y: ty * TILE });
    })
  );

  function at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return ".";
    return tiles[ty][tx];
  }

  function isSolid(ch) {
    return ch === "#" || ch === "=";
  }

  function isOneWay(ch) {
    return ch === "_";
  }

  // True when the point sits on a tile that can hold up a body.
  function isStandable(x, y) {
    const ch = at(Math.floor(x / TILE), Math.floor(y / TILE));
    return isSolid(ch) || isOneWay(ch);
  }

  // Tile cells the box overlaps. Callers pick which kinds they care about.
  function overlapping(x, y, w, h) {
    const x0 = Math.floor(x / TILE);
    const y0 = Math.floor(y / TILE);
    const x1 = Math.floor((x + w - 0.001) / TILE);
    const y1 = Math.floor((y + h - 0.001) / TILE);
    const out = [];
    for (let ty = y0; ty <= y1; ty++) {
      for (let tx = x0; tx <= x1; tx++) {
        out.push({ tx, ty, ch: at(tx, ty) });
      }
    }
    return out;
  }

  // Move body e (x, y, w, h, vx, vy, grounded) by its velocity for one step.
  function moveBody(e, dt) {
    const prevBottom = e.y + e.h;

    // Horizontal first. Walls stop the body on the tile edge.
    e.x += e.vx * dt;
    for (const c of overlapping(e.x, e.y, e.w, e.h)) {
      if (!isSolid(c.ch)) continue;
      if (e.vx > 0) e.x = Math.min(e.x, c.tx * TILE - e.w);
      if (e.vx < 0) e.x = Math.max(e.x, (c.tx + 1) * TILE);
    }
    e.x = Math.max(0, Math.min(e.x, width - e.w));

    // Vertical second. Floors and ceilings stop the body on the tile edge.
    e.grounded = false;
    e.y += e.vy * dt;
    for (const c of overlapping(e.x, e.y, e.w, e.h)) {
      if (isSolid(c.ch)) {
        if (e.vy > 0) {
          e.y = c.ty * TILE - e.h;
          e.vy = 0;
          e.grounded = true;
        } else if (e.vy < 0) {
          e.y = (c.ty + 1) * TILE;
          e.vy = 0;
        }
      } else if (isOneWay(c.ch) && e.vy >= 0 && prevBottom <= c.ty * TILE + 0.5) {
        e.y = c.ty * TILE - e.h;
        e.vy = 0;
        e.grounded = true;
      }
    }
    for (const pl of platforms) {
      const overlapX = e.x + e.w > pl.x && e.x < pl.x + pl.w;
      if (overlapX && e.vy >= 0 && prevBottom <= pl.y + 0.5 && e.y + e.h >= pl.y) {
        e.y = pl.y - e.h;
        e.vy = 0;
        e.grounded = true;
      }
    }
  }

  function addPlatform(pl) {
    platforms.push(pl);
  }

  function updatePlatforms(dt) {
    for (let i = platforms.length - 1; i >= 0; i--) {
      platforms[i].life -= dt;
      if (platforms[i].life <= 0) platforms.splice(i, 1);
    }
  }

  function drawPlatforms(ctx, camX, camY) {
    for (const pl of platforms) {
      // Rope: a brown line with posts at both ends.
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(Math.round(pl.x - camX), Math.round(pl.y - camY), pl.w, 3);
      ctx.fillRect(Math.round(pl.x - camX), Math.round(pl.y - camY), 3, pl.h + 6);
      ctx.fillRect(Math.round(pl.x + pl.w - camX - 3), Math.round(pl.y - camY), 3, pl.h + 6);
    }
  }

  // Closest safe spot to (x, y) for a body of size w by h. A safe spot is a
  // standable tile with a clear 2 by 3 tile area above it, and no enemy
  // within 3 tiles. Searches up to 20 tiles out. Falls back to the spawn.
  function closestSafeSpace(x, y, w, h, enemies) {
    const cx = Math.min(cols - 1, Math.max(0, Math.floor((x + w / 2) / TILE)));
    const cy = Math.min(rows - 1, Math.max(0, Math.floor((y + h) / TILE)));
    const free = (ch) => !isSolid(ch) && !isOneWay(ch);
    let best = null;
    let bestDist = Infinity;

    for (let ty = cy - 20; ty <= cy + 20; ty++) {
      for (let tx = cx - 20; tx <= cx + 20; tx++) {
        const ground = at(tx, ty);
        if (!(isSolid(ground) || isOneWay(ground))) continue;
        let clear = true;
        for (let dy = 1; dy <= 3 && clear; dy++) {
          for (let dx = 0; dx <= 1 && clear; dx++) {
            clear = free(at(tx + dx, ty - dy));
          }
        }
        if (!clear) continue;

        const sx = tx * TILE + (TILE - w) / 2;
        const sy = ty * TILE - h;
        const near = enemies.some(
          (e) =>
            !e.dead &&
            Math.hypot(sx + w / 2 - (e.x + e.w / 2), sy + h / 2 - (e.y + e.h / 2)) < 3 * TILE
        );
        if (near) continue;

        const dist = Math.hypot(sx - x, sy - y);
        if (dist < bestDist) {
          bestDist = dist;
          best = { x: sx, y: sy };
        }
      }
    }
    return best || { x: spawn.x, y: spawn.y };
  }

  function draw(ctx, images, camX, camY, viewW, viewH) {
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const tx1 = Math.min(cols - 1, Math.floor((camX + viewW) / TILE));
    const ty1 = Math.min(rows - 1, Math.floor((camY + viewH) / TILE));

    for (let ty = ty0; ty <= ty1; ty++) {
      for (let tx = tx0; tx <= tx1; tx++) {
        const ch = at(tx, ty);
        const px = Math.round(tx * TILE - camX);
        const py = Math.round(ty * TILE - camY);
        if (ch === "#") ctx.drawImage(images.wall, px, py, TILE, TILE);
        else if (ch === "=") {
          ctx.drawImage(images.dirt, px, py, TILE, TILE);
          ctx.drawImage(images.grass, px, py, TILE, TILE);
        } else if (ch === "_") {
          ctx.drawImage(images.grass, px, py, TILE, TILE);
        } else if (ch === "T") {
          ctx.drawImage(images.tree, px, py, TILE, TILE);
        }
      }
    }
  }

  return {
    TILE,
    width,
    height,
    cols,
    rows,
    spawn,
    exit: () => exit,
    enemySpawns,
    pickupSpawns,
    at,
    isStandable,
    moveBody,
    closestSafeSpace,
    addPlatform,
    updatePlatforms,
    drawPlatforms,
    platforms,
    draw,
    overlapping,
  };
})();
