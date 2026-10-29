// Tile map, tile legend, and axis-separated collision.
const TILE = 32;

// Colors per theme. "field" keeps the original outdoor look.
const THEMES = {
  field: { sky: "#7fb6e0", far: "#a8cde8", near: "#6f9fbf" },
  dungeon: { sky: "#17141f", far: "#2a2533", near: "#3a3242" },
};

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
//   W  warlord boss spawn (drawn as empty)
//   F  level exit flag (drawn as a pole and flag)
//   c  card pickup on the ground (random character card)
//   k  card pickup on the main route (not a secret)
//   p  power-up on the ground (draws a random card into hand or deck)
//   ^  spikes (not solid; touching them is deadly)
//   i  sign post (decor; shows its text while the player stands at it)
//   x  cracked wall (solid; broken by the knight's shield bash or charge)
//   .  empty air
const World = (() => {
  let index = 0;
  let tiles = [];
  let rows = 0;
  let cols = 0;
  let width = 0;
  let height = 0;
  let spawn = { x: 0, y: 0 };
  let exit = null;
  // The flag is drawn dimmed while a boss keeps it closed.
  let flagOpen = true;
  // Temporary one-way platforms made in play (arrow anchor rope). Each has a life in seconds.
  const platforms = [];
  const enemySpawns = [];
  const pickupSpawns = [];
  const signs = [];
  const MARKERS = { g: "grunt", m: "mud_revenant", j: "rat_king", a: "archer", W: "warlord" };

  // Loads level i from LEVELS. Every system reads the current level through these values.
  function load(i) {
    index = i;
    const level = LEVELS[i];
    tiles = level.rows.map((row) => row.split(""));
    rows = tiles.length;
    cols = tiles[0].length;
    width = cols * TILE;
    height = rows * TILE;
    spawn = { x: 0, y: 0 };
    exit = null;
    platforms.length = 0;
    enemySpawns.length = 0;
    pickupSpawns.length = 0;
    signs.length = 0;
    let signN = 0;
    tiles.forEach((row, ty) =>
      row.forEach((ch, tx) => {
        if (ch === "S") spawn = { x: tx * TILE, y: ty * TILE };
        // The exit zone is 4 tiles tall, reaching 3 tiles above the flag, so a
        // jump that clears the flag's tile still completes the level.
        if (ch === "F") exit = { x: tx * TILE, y: (ty - 3) * TILE, w: TILE, h: 4 * TILE };
        if (MARKERS[ch]) enemySpawns.push({ kind: MARKERS[ch], x: tx * TILE, y: ty * TILE });
        if (ch === "c" || ch === "k" || ch === "p") pickupSpawns.push({ power: ch === "p", x: tx * TILE, y: ty * TILE });
        if (ch === "i") signs.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE, text: (level.signs || [])[signN++] || "" });
      })
    );
  }

  function setFlagOpen(open) {
    flagOpen = open;
  }

  // Flag pole and pennant on the exit tile.
  function drawFlag(ctx, px, py) {
    ctx.globalAlpha = flagOpen ? 1 : 0.3;
    ctx.fillStyle = "#5b4a3a";
    ctx.fillRect(px + 14, py - 24, 3, 56);
    ctx.fillStyle = "#e0b84a";
    ctx.beginPath();
    ctx.moveTo(px + 17, py - 24);
    ctx.lineTo(px + 30, py - 18);
    ctx.lineTo(px + 17, py - 12);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  // Sets one tile (used by tests and by the sign and spike code).
  function setTile(tx, ty, ch) {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return;
    tiles[ty][tx] = ch;
  }

  function at(tx, ty) {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return ".";
    return tiles[ty][tx];
  }

  function isSolid(ch) {
    return ch === "#" || ch === "=" || ch === "x";
  }

  // Breaks every cracked wall the box touches. Returns true if any broke.
  function breakCracked(x, y, w, h) {
    let broke = false;
    for (const c of overlapping(x, y, w, h)) {
      if (c.ch === "x") {
        setTile(c.tx, c.ty, ".");
        broke = true;
      }
    }
    return broke;
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
      ctx.fillStyle = pl.color || "#7a5230";
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
        // A spot is not safe if spikes lie within 3 columns on the body's row.
        let spiky = false;
        for (let dx = -3; dx <= 3; dx++) if (at(tx + dx, ty - 1) === "^") spiky = true;
        if (spiky) continue;

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

  // A wall tile with dark zigzag cracks across it.
  function drawCracked(ctx, wallImg, px, py) {
    ctx.drawImage(wallImg, px, py, TILE, TILE);
    ctx.strokeStyle = "#2a1d14";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 2, py + 4);
    ctx.lineTo(px + 12, py + 12);
    ctx.lineTo(px + 8, py + 20);
    ctx.lineTo(px + 22, py + 28);
    ctx.stroke();
    ctx.lineWidth = 1;
  }

  // Sign posts from World.signs: a brown stick with a board on top.
  function drawSigns(ctx, camX, camY) {
    for (const sg of signs) {
      const px = Math.round(sg.x - camX);
      const py = Math.round(sg.y - camY);
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(px + 14, py + 16, 4, 16);
      ctx.fillStyle = "#a87a4a";
      ctx.fillRect(px + 6, py + 4, 20, 12);
    }
  }

  // Three grey spikes standing on the bottom edge of the tile.
  function drawSpikes(ctx, px, py) {
    ctx.fillStyle = "#9aa0a8";
    ctx.strokeStyle = "#5b6068";
    for (let i = 0; i < 3; i++) {
      const x0 = px + 1 + i * 10;
      const base = py + TILE;
      ctx.beginPath();
      ctx.moveTo(x0, base);
      ctx.lineTo(x0 + 5, base - 12);
      ctx.lineTo(x0 + 10, base);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
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
        else if (ch === "x") drawCracked(ctx, images.wall, px, py);
        else if (ch === "=" && LEVELS[index].theme === "dungeon") {
          // Dungeon ground is bare dirt, shaded darker.
          ctx.drawImage(images.dirt, px, py, TILE, TILE);
          ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
          ctx.fillRect(px, py, TILE, TILE);
        } else if (ch === "=") {
          ctx.drawImage(images.dirt, px, py, TILE, TILE);
          ctx.drawImage(images.grass, px, py, TILE, TILE);
        } else if (ch === "_") {
          ctx.drawImage(images.grass, px, py, TILE, TILE);
        } else if (ch === "T" && LEVELS[index].theme !== "dungeon") {
          ctx.drawImage(images.tree, px, py, TILE, TILE);
        } else if (ch === "^") {
          drawSpikes(ctx, px, py);
        } else if (ch === "F") {
          drawFlag(ctx, px, py);
        }
      }
    }
  }

  const api = {
    TILE,
    get width() { return width; },
    get height() { return height; },
    get cols() { return cols; },
    get rows() { return rows; },
    get spawn() { return spawn; },
    get enemySpawns() { return enemySpawns; },
    get pickupSpawns() { return pickupSpawns; },
    get index() { return index; },
    get level() { return LEVELS[index]; },
    count: LEVELS.length,
    signs,
    exit: () => exit,
    at,
    setTile,
    isSolid,
    isStandable,
    breakCracked,
    moveBody,
    closestSafeSpace,
    addPlatform,
    updatePlatforms,
    drawPlatforms,
    platforms,
    draw,
    drawSigns,
    setFlagOpen,
    THEMES,
    overlapping,
    load,
  };
  load(0);
  return api;
})();
