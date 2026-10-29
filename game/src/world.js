// Tile map, tile legend, and axis-separated collision.
const TILE = 32;

// Legend:
//   #  solid brick wall
//   =  solid grass ground
//   _  one-way platform (solid only when landing from above)
//   T  tree (decor, no collision)
//   S  player spawn (drawn as empty)
//   .  empty air
const LEVEL_ROWS = [
  "........................................................................",
  "........................................................................",
  "........................................................................",
  "...........................T............................................",
  "...........................#...........___..............................",
  "..S........................#...........................TTT..............",
  "..=====...........____.....#...........................###..............",
  "..........................................####..........................",
  "..............TTT.........................................###...........",
  "=========.....==========.............#####......................=====...",
  "============================................................============",
  "########################################################################",
];

const World = (() => {
  const tiles = LEVEL_ROWS.map((row) => row.split(""));
  const rows = tiles.length;
  const cols = tiles[0].length;
  const width = cols * TILE;
  const height = rows * TILE;

  let spawn = { x: 0, y: 0 };
  tiles.forEach((row, ty) =>
    row.forEach((ch, tx) => {
      if (ch === "S") spawn = { x: tx * TILE, y: ty * TILE };
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

  return { TILE, width, height, cols, rows, spawn, at, moveBody, draw, overlapping };
})();
