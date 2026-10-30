// Tile map, tile legend, and axis-separated collision.
const TILE = 32;

// Colors per theme. "field" keeps the original outdoor look.
const THEMES = {
  field: { sky: "#7fb6e0", far: "#a8cde8", near: "#6f9fbf" },
  dungeon: { sky: "#17141f", far: "#2a2533", near: "#3a3242" },
  // Looks (a level's optional "look" field): visual only, game rules still read the theme.
  crypt: { sky: "#0c171d", far: "#14242b", near: "#1b2f37" },
  hall: { sky: "#1c1012", far: "#2c181a", near: "#3a2021" },
};
// Tint laid over solid tiles per look.
const LOOK_TINT = { marsh: "rgba(40, 50, 15, 0.5)", crypt: "rgba(15, 60, 95, 0.5)", hall: "rgba(120, 50, 25, 0.22)" };

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
  // Ranger ladders (Up + bridge): { x, w, top, bottom, life }. One at a time. The top is a ledge.
  const ladders = [];
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
    ladders.length = 0;
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
        if (ch === "c" || ch === "k" || ch === "p") {
          pickupSpawns.push({ power: ch === "p", secret: ch !== "k", x: tx * TILE, y: ty * TILE });
        }
        if (ch === "i") signs.push({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE, text: (level.signs || [])[signN++] || "" });
      })
    );
  }

  function setFlagOpen(open) {
    flagOpen = open;
  }

  // Exit door on the F tile. Field: wooden arched door. Dungeon: iron portcullis.
  // Shut while a boss keeps the exit closed (flagOpen false); open otherwise.
  function drawFlag(ctx, px, py, dungeon) {
    const x = px + 2;
    const w = 28;
    const top = py - 20;
    const bot = py + TILE;
    const r = w / 2;
    // Door opening path: rectangle with a round top.
    const opening = () => {
      ctx.beginPath();
      ctx.moveTo(x, bot);
      ctx.lineTo(x, top + r);
      ctx.arc(x + r, top + r, r, Math.PI, 0);
      ctx.lineTo(x + w, bot);
      ctx.closePath();
    };
    // Stone frame.
    ctx.fillStyle = dungeon ? "#6d667a" : "#8c8a84";
    ctx.fillRect(x - 2, top + r - 1, w + 4, bot - top - r + 1);
    ctx.beginPath();
    ctx.arc(x + r, top + r, r + 2, Math.PI, 0);
    ctx.fill();
    // Dark inside.
    ctx.fillStyle = "#14101a";
    opening();
    ctx.fill();
    if (flagOpen) {
      // Warm light inside the open doorway.
      ctx.fillStyle = "#e8c070";
      ctx.fillRect(x + 8, top + r + 2, w - 16, bot - top - r - 2);
    }
    ctx.save();
    opening();
    ctx.clip();
    if (dungeon) {
      // Portcullis: raised to the top when open, down when shut.
      const drop = flagOpen ? 0.22 : 1;
      const gateBot = top + (bot - top) * drop;
      ctx.fillStyle = "#8a909a";
      for (let gx = x + 3; gx < x + w; gx += 6) ctx.fillRect(gx, top, 2, gateBot - top);
      ctx.fillRect(x, top + 10, w, 2);
      if (!flagOpen) ctx.fillRect(x, top + 30, w, 2);
      ctx.fillStyle = "#c8ced6";
      for (let gx = x + 3; gx < x + w; gx += 6) ctx.fillRect(gx, top, 1, gateBot - top);
      ctx.fillStyle = "#4a4f58";
      for (let gx = x + 3; gx < x + w; gx += 6) ctx.fillRect(gx, gateBot - 3, 2, 3);
    } else {
      // Wooden door. Open: a thin leaf on the hinge side. Shut: fills the arch.
      const leaf = flagOpen ? 7 : w;
      ctx.fillStyle = "#7a4e2a";
      ctx.fillRect(x, top, leaf, bot - top);
      ctx.fillStyle = "#4a2e18";
      for (let gx = x + 7; gx < x + leaf; gx += 7) ctx.fillRect(gx, top, 1, bot - top);
      ctx.fillStyle = "#3a3d44";
      ctx.fillRect(x, top + 16, leaf, 3);
      ctx.fillRect(x, top + 36, leaf, 3);
      if (!flagOpen) {
        ctx.fillStyle = "#e0b84a";
        ctx.fillRect(x + w - 8, top + 28, 3, 3);
      }
    }
    ctx.restore();
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
      } else if (isOneWay(c.ch) && !(e.dropT > 0) && e.vy >= 0 && prevBottom <= c.ty * TILE + 0.5) {
        e.y = c.ty * TILE - e.h;
        e.vy = 0;
        e.grounded = true;
      }
    }
    // Made platforms and ladder tops are one-way too. Down drops through them (dropT), and a
    // climbing body passes its ladder's top. Only the player (ladderable) stands on ladder tops.
    if (e.dropT > 0 || e.climbing) return;
    const tops = e.ladderable ? platforms.concat(ladders.map((l) => ({ x: l.x, y: l.top, w: l.w }))) : platforms;
    for (const pl of tops) {
      const overlapX = e.x + e.w > pl.x && e.x < pl.x + pl.w;
      if (overlapX && e.vy >= 0 && prevBottom <= pl.y + 0.5 && e.y + e.h >= pl.y) {
        e.y = pl.y - e.h;
        e.vy = 0;
        e.grounded = true;
      }
    }
  }

  // What the body stands on: "solid" (cannot drop), "oneway" (Down drops through), "ladder"
  // (the top of a ladder: Down climbs down), or null in the air.
  function standingOn(e) {
    const y = e.y + e.h + 1;
    const ty = Math.floor(y / TILE);
    const x0 = Math.floor((e.x + 1) / TILE);
    const x1 = Math.floor((e.x + e.w - 1) / TILE);
    let kind = null;
    for (let tx = x0; tx <= x1; tx++) {
      const ch = at(tx, ty);
      if (isSolid(ch)) return "solid";
      if (isOneWay(ch) && Math.abs(ty * TILE - (e.y + e.h)) < 2) kind = "oneway";
    }
    const over = (pl) => e.x + e.w > pl.x && e.x < pl.x + pl.w && Math.abs(pl.y - (e.y + e.h)) < 2;
    if (!kind && platforms.some(over)) kind = "oneway";
    if (ladders.some((l) => over({ x: l.x, y: l.top, w: l.w }))) kind = kind || "ladder";
    return kind;
  }

  // Ranger bridges: at most two at once, a third replaces the oldest. Other made platforms
  // (bone bridge) replace everything, as before.
  function addPlatform(pl) {
    if (pl.kind === "rope") {
      const ropes = platforms.filter((q) => q.kind === "rope");
      if (ropes.length >= 2) platforms.splice(platforms.indexOf(ropes[0]), 1);
    } else {
      platforms.length = 0;
    }
    platforms.push(pl);
  }

  // A ladder in tile column col, standing on the first floor at or below row fromRow (up to 4
  // rows down; never in mid-air or on spikes), up to n tiles tall, stopped by solid tiles.
  // Returns { x, w, top, bottom } or null when there is no room for a tile.
  function ladderIn(col, fromRow, n) {
    if (col < 0 || col >= cols) return null;
    let base = -1;
    for (let r = fromRow; r <= fromRow + 4 && r < rows - 1; r++) {
      if (isSolid(at(col, r))) break;
      if (isSolid(at(col, r + 1)) || isOneWay(at(col, r + 1))) { base = r; break; }
    }
    if (base < 0 || at(col, base) === "^") return null;
    let h = 0;
    while (h < n && base - h >= 0 && !isSolid(at(col, base - h))) h++;
    if (h === 0) return null;
    return { x: col * TILE + 4, w: TILE - 8, top: (base - h + 1) * TILE, bottom: (base + 1) * TILE };
  }

  function addLadder(l) {
    ladders.length = 0;
    ladders.push(l);
  }

  // The ladder the body's centre is on (x inside it, body overlapping its height), or null.
  function ladderAt(e) {
    const cx = e.x + e.w / 2;
    return ladders.find((l) => cx >= l.x - 4 && cx <= l.x + l.w + 4 && e.y < l.bottom && e.y + e.h > l.top - 1) || null;
  }

  function updatePlatforms(dt) {
    for (let i = platforms.length - 1; i >= 0; i--) {
      platforms[i].life -= dt;
      if (platforms[i].life <= 0) platforms.splice(i, 1);
    }
    for (let i = ladders.length - 1; i >= 0; i--) {
      ladders[i].life -= dt;
      if (ladders[i].life <= 0) ladders.splice(i, 1);
    }
  }

  // Ladder: two rails and a rung every 8 px, rope-coloured like the bridge plank. Fades at the end.
  function drawLadders(ctx, camX, camY) {
    for (const l of ladders) {
      const x = Math.round(l.x - camX);
      const y = Math.round(l.top - camY);
      const h = l.bottom - l.top;
      ctx.save();
      ctx.globalAlpha = Math.min(1, l.life / 1.5);
      ctx.fillStyle = "#4a2e18";
      ctx.fillRect(x - 1, y - 2, 5, h + 2);
      ctx.fillRect(x + l.w - 4, y - 2, 5, h + 2);
      ctx.fillStyle = "#8a5a32";
      ctx.fillRect(x, y - 2, 3, h + 2);
      ctx.fillRect(x + l.w - 3, y - 2, 3, h + 2);
      for (let ry = 6; ry < h; ry += 8) {
        ctx.fillStyle = "#4a2e18";
        ctx.fillRect(x + 3, y + ry + 1, l.w - 6, 1);
        ctx.fillStyle = "#c9955a";
        ctx.fillRect(x + 3, y + ry, l.w - 6, 1);
      }
      // The top rung is a small ledge you can stand on.
      ctx.fillStyle = "#c9955a";
      ctx.fillRect(x - 1, y - 2, l.w + 2, 1);
      ctx.restore();
    }
  }

  // Only the drawing changes; collision stays a flat platform.
  function drawPlatforms(ctx, camX, camY) {
    drawLadders(ctx, camX, camY);
    for (const pl of platforms) {
      const x = Math.round(pl.x - camX);
      const y = Math.round(pl.y - camY);
      if (pl.color) {
        // Bone bridge: alternating 6 px segments with a dark outline.
        for (let sx = 0; sx < pl.w; sx += 6) {
          const w = Math.min(6, pl.w - sx);
          ctx.fillStyle = (sx / 6) % 2 === 0 ? pl.color : "#c8c0a8";
          ctx.fillRect(x + sx, y, w, 3);
          ctx.fillStyle = "#3a3020";
          ctx.fillRect(x + sx, y + 3, w, 1);
        }
        ctx.fillStyle = pl.color || "#7a5230";
        ctx.fillRect(x, y, 3, pl.h + 6);
        ctx.fillRect(x + pl.w - 3, y, 3, pl.h + 6);
      } else {
        // Rope platform (arrow anchor): a plank you can stand on, with a light top edge,
        // joints every tile, and two ropes running up from the ends. It fades over its last 1.5 s.
        ctx.save();
        ctx.globalAlpha = Math.min(1, pl.life / 1.5);
        ctx.fillStyle = "#8a5a32";
        ctx.fillRect(x, y, pl.w, 5);
        ctx.fillStyle = "#c9955a";
        ctx.fillRect(x, y, pl.w, 1);
        ctx.fillStyle = "#4a2e18";
        ctx.fillRect(x, y + 4, pl.w, 1);
        for (let sx = TILE; sx < pl.w; sx += TILE) ctx.fillRect(x + sx - 1, y, 2, 5);
        ctx.fillStyle = "#e8d9b0";
        ctx.fillRect(x + 2, y - 10, 1, 10);
        ctx.fillRect(x + pl.w - 3, y - 10, 1, 10);
        ctx.restore();
      }
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
        // The warlord needs more room: 3 tiles put a respawn between it and the arena wall, pinned again.
        const near = enemies.some(
          (e) =>
            !e.dead &&
            Math.hypot(sx + w / 2 - (e.x + e.w / 2), sy + h / 2 - (e.y + e.h / 2)) < (e.kind === "warlord" ? 7 : 3) * TILE
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
      // The post runs 5 px into the ground; drawGrounding then covers its foot with grass.
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(px + 14, py + 16, 4, 21);
      ctx.fillStyle = "#a87a4a";
      ctx.fillRect(px + 6, py + 4, 20, 12);
    }
  }

  // A tree is drawn 3x its tile size (96 px) and stands on the first solid tile below it, so its
  // trunk meets the ground. Trees are decor: they use no collision.
  const TREE_SCALE = 3;
  function drawTree(ctx, img, tx, ty, px, py) {
    let by = ty + 1;
    while (by < rows && !isSolid(at(tx, by))) by++;
    const size = TILE * TREE_SCALE;
    // py is the tile's screen row, so the base is measured from it, not from world coordinates.
    // The tile has 1 to 2 empty rows under the trunk (3 to 6 px at this scale), so the image sinks 6 px:
    // the ground tile drawn after it covers the bottom and the trunk meets the grass line.
    const baseY = py + (by - ty) * TILE + TREE_SINK;
    ctx.drawImage(img, px + TILE / 2 - size / 2, baseY - size, size, size);
  }
  const TREE_SINK = 6;

  // Drawn after the tiles: a soft contact shadow and grass blades (pebbles indoors) over the foot of every
  // tree and sign post, so decorations read as planted in the ground, not standing on its surface.
  function drawGrounding(ctx, camX, camY) {
    const dungeon = LEVELS[index].theme === "dungeon";
    const feet = [];
    for (const sg of signs) feet.push({ x: sg.x + 16, y: sg.y + TILE, w: 10 });
    if (!dungeon) {
      for (let ty = 0; ty < rows; ty++) {
        for (let tx = 0; tx < cols; tx++) {
          if (at(tx, ty) !== "T") continue;
          let by = ty + 1;
          while (by < rows && !isSolid(at(tx, by))) by++;
          // The trunk in tree1.png sits at source x 11 to 15, drawn 3x around the tile centre.
          feet.push({ x: tx * TILE + TILE / 2 - 48 + 13 * 3 + 1, y: by * TILE, w: 16 });
        }
      }
    }
    for (const f of feet) {
      const x = Math.round(f.x - camX);
      const y = Math.round(f.y - camY);
      if (x < -40 || x > 520 || y < -10 || y > 290) continue;
      ctx.fillStyle = "rgba(0, 0, 0, 0.28)";
      ctx.beginPath();
      ctx.ellipse(x, y + 1, f.w, 3, 0, 0, Math.PI * 2);
      ctx.fill();
      const n = Math.round(f.w / 2) + 2;
      for (let i = 0; i < n; i++) {
        const bx = x - f.w + Math.round((i * 2 * f.w) / (n - 1));
        const h = 3 + ((i * 7 + (f.x | 0)) % 4);
        if (dungeon) {
          ctx.fillStyle = i % 2 ? "#4a4258" : "#6b6080";
          ctx.fillRect(bx, y - 1, 2, 2);
        } else {
          ctx.fillStyle = i % 3 === 0 ? "#8fd36a" : i % 3 === 1 ? "#3f9a3a" : "#2c6e2c";
          ctx.fillRect(bx, y + 2 - h, 1, h);
          ctx.fillRect(bx + 1, y + 3 - h, 1, h - 1);
        }
      }
    }
  }

  // Four metal spikes on a dark base, with a pale tip and a shaded right side.
  function drawSpikes(ctx, px, py) {
    ctx.fillStyle = "#2e3138";
    ctx.fillRect(px, py + TILE - 4, TILE, 4);
    for (let i = 0; i < 4; i++) {
      const x0 = px + i * 8;
      const base = py + TILE - 4;
      ctx.fillStyle = "#a4abb6";
      ctx.beginPath();
      ctx.moveTo(x0 + 1, base);
      ctx.lineTo(x0 + 4, base - 15);
      ctx.lineTo(x0 + 7, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#626874";
      ctx.beginPath();
      ctx.moveTo(x0 + 4, base - 15);
      ctx.lineTo(x0 + 7, base);
      ctx.lineTo(x0 + 4, base);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#f4f7fa";
      ctx.fillRect(x0 + 3, base - 15, 2, 3);
    }
  }

  // One-way platform: a thin wooden plank with nail dots.
  function drawPlank(ctx, px, py) {
    ctx.fillStyle = "#8a5a32";
    ctx.fillRect(px, py, TILE, 7);
    ctx.fillStyle = "#c9955a";
    ctx.fillRect(px, py, TILE, 1);
    ctx.fillStyle = "#4a2e18";
    ctx.fillRect(px, py + 6, TILE, 1);
    ctx.fillStyle = "#2a1a0e";
    ctx.fillRect(px + 3, py + 3, 2, 2);
    ctx.fillRect(px + TILE - 5, py + 3, 2, 2);
  }

  // Card pickup: a small card with a white border and a coloured back (gold if the character
  // is not known yet). A power-up is a glowing gem. Bobs while it rests on the ground.
  function drawCardIcon(ctx, sx, sy, w, h, color, power, bob) {
    const now = performance.now() / 1000;
    const dy = bob ? Math.round(Math.sin(now * 3) * 1.5) - 1 : 0;
    const x = Math.round(sx);
    const y = Math.round(sy) + dy;
    if (power) {
      const cx = x + w / 2;
      const cy = y + h / 2;
      const g = ctx.createRadialGradient(cx, cy, 1, cx, cy, 13);
      const a = 0.35 + 0.15 * Math.sin(now * 4);
      g.addColorStop(0, "rgba(255, 240, 160, " + a + ")");
      g.addColorStop(1, "rgba(255, 240, 160, 0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - 13, cy - 13, 26, 26);
      ctx.fillStyle = "#e0b84a";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 8);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#fff3b0";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx - 6, cy);
      ctx.lineTo(cx, cy - 1);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = "#7a5a14";
      ctx.beginPath();
      ctx.moveTo(cx, cy - 8);
      ctx.lineTo(cx + 6, cy);
      ctx.lineTo(cx, cy + 8);
      ctx.lineTo(cx - 6, cy);
      ctx.closePath();
      ctx.stroke();
      return;
    }
    ctx.fillStyle = "#f4f1e8";
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color || "#e0b84a";
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y + 5);
    ctx.lineTo(x + w - 5, y + h / 2);
    ctx.lineTo(x + w / 2, y + h - 5);
    ctx.lineTo(x + 5, y + h / 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#111418";
    ctx.fillRect(x, y + h, w, 1);
  }

  // Which look the current level uses. Level 4 is the marsh; game rules still read the theme.
  function visual() {
    if (LEVELS[index].look) return LEVELS[index].look;
    return index === 3 ? "marsh" : LEVELS[index].theme;
  }

  // ---- Parallax: code-drawn layers, built once per look on offscreen canvases. ----
  const PERIOD = 640;
  const VIEW_H = 270;
  const layerCache = {};
  function makeCanvas(w, h) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  function seeded(seed) {
    let n = seed;
    return () => {
      n = (n * 1664525 + 1013904223) % 4294967296;
      return n / 4294967296;
    };
  }
  // A wavy hill silhouette whose waves repeat across PERIOD, so the layer tiles.
  function hillsLayer(color, base, a1, a2) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(0, VIEW_H);
    for (let x = 0; x <= PERIOD; x += 4) {
      const y = base - Math.sin((x / PERIOD) * Math.PI * 4) * a1 - Math.sin((x / PERIOD) * Math.PI * 10 + 1) * a2;
      g.lineTo(x, y);
    }
    g.lineTo(PERIOD, VIEW_H);
    g.closePath();
    g.fill();
    return c;
  }
  function blobsLayer(color, base, seed) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    const rnd = seeded(seed);
    g.fillStyle = color;
    g.fillRect(0, base, PERIOD, VIEW_H - base);
    for (let x = 0; x < PERIOD; x += 18 + rnd() * 10) {
      const r = 10 + rnd() * 9;
      for (const ox of [0, PERIOD, -PERIOD]) {
        g.beginPath();
        g.arc(x + ox, base, r, 0, Math.PI * 2);
        g.fill();
      }
    }
    return c;
  }
  function archesLayer(wall) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    g.fillStyle = wall;
    g.fillRect(0, 50, PERIOD, VIEW_H - 50);
    g.globalCompositeOperation = "destination-out";
    for (let x = 0; x < PERIOD; x += 128) {
      g.beginPath();
      g.moveTo(x + 28, VIEW_H);
      g.lineTo(x + 28, 120);
      g.arc(x + 64, 120, 36, Math.PI, 0);
      g.lineTo(x + 100, VIEW_H);
      g.closePath();
      g.fill();
    }
    return c;
  }
  function pillarsLayer(color, edge) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    for (let x = 60; x < PERIOD; x += 160) {
      g.fillStyle = color;
      g.fillRect(x, 0, 16, VIEW_H);
      g.fillRect(x - 4, 0, 24, 8);
      g.fillRect(x - 4, VIEW_H - 10, 24, 10);
      g.fillStyle = edge;
      g.fillRect(x + 12, 0, 4, VIEW_H);
    }
    return c;
  }
  function deadTreesLayer(color) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    const rnd = seeded(7);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineWidth = 2;
    for (let x = 30; x < PERIOD - 30; x += 70 + rnd() * 50) {
      const h = 60 + rnd() * 50;
      g.fillRect(x, 238 - h, 4, h + 40);
      g.beginPath();
      g.moveTo(x + 2, 238 - h * 0.6);
      g.lineTo(x + 14, 238 - h * 0.85);
      g.moveTo(x + 2, 238 - h * 0.8);
      g.lineTo(x - 10, 238 - h);
      g.stroke();
    }
    g.fillRect(0, 238, PERIOD, VIEW_H - 238);
    return c;
  }
  function fogLayer() {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    const rnd = seeded(11);
    g.fillStyle = "rgba(170, 182, 140, 0.07)";
    for (let i = 0; i < 14; i++) {
      const x = rnd() * PERIOD;
      const y = 130 + rnd() * 110;
      const rx = 50 + rnd() * 70;
      for (const ox of [0, PERIOD, -PERIOD]) {
        g.beginPath();
        g.ellipse(x + ox, y, rx, 9 + rnd() * 8, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return c;
  }
  // Crypt: a catacomb wall of bone niches (a pale skull in some), then cold pillars.
  function nichesLayer(wall, hole, bone) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    const rnd = seeded(5);
    g.fillStyle = wall;
    g.fillRect(0, 40, PERIOD, VIEW_H - 40);
    for (let y = 70; y < VIEW_H - 20; y += 34) {
      for (let x = 8 + ((y / 34) % 2) * 20; x < PERIOD - 30; x += 40) {
        g.fillStyle = hole;
        g.fillRect(x, y, 24, 14);
        g.beginPath();
        g.arc(x + 12, y, 12, Math.PI, 0);
        g.fill();
        if (rnd() < 0.45) {
          g.fillStyle = bone;
          g.fillRect(x + 8, y + 2, 8, 7);
          g.fillRect(x + 9, y + 9, 6, 3);
          g.fillStyle = hole;
          g.fillRect(x + 9, y + 4, 2, 2);
          g.fillRect(x + 13, y + 4, 2, 2);
        }
      }
    }
    return c;
  }
  function dripLayer() {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    const rnd = seeded(13);
    g.fillStyle = "rgba(120, 190, 200, 0.06)";
    for (let i = 0; i < 12; i++) {
      const x = rnd() * PERIOD;
      const y = 150 + rnd() * 100;
      for (const ox of [0, PERIOD, -PERIOD]) {
        g.beginPath();
        g.ellipse(x + ox, y, 40 + rnd() * 60, 8 + rnd() * 6, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
    return c;
  }
  // Hall: tall lit windows behind, then red banners with a gold face mask between pillars.
  function windowsLayer(wall, glow) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    g.fillStyle = wall;
    g.fillRect(0, 30, PERIOD, VIEW_H - 30);
    for (let x = 40; x < PERIOD; x += 160) {
      g.fillStyle = glow;
      g.fillRect(x, 90, 28, 90);
      g.beginPath();
      g.arc(x + 14, 90, 14, Math.PI, 0);
      g.fill();
      g.fillStyle = wall;
      g.fillRect(x + 13, 76, 2, 104);
      g.fillRect(x, 130, 28, 2);
    }
    return c;
  }
  function bannersLayer(pillar, cloth, trim) {
    const c = makeCanvas(PERIOD, VIEW_H);
    const g = c.getContext("2d");
    for (let x = 0; x < PERIOD; x += 160) {
      g.fillStyle = pillar;
      g.fillRect(x, 0, 18, VIEW_H);
      g.fillRect(x - 4, 0, 26, 10);
      const bx = x + 64;
      g.fillStyle = trim;
      g.fillRect(bx - 2, 20, 36, 3);
      g.fillStyle = cloth;
      g.beginPath();
      g.moveTo(bx, 23);
      g.lineTo(bx + 32, 23);
      g.lineTo(bx + 32, 110);
      g.lineTo(bx + 16, 98);
      g.lineTo(bx, 110);
      g.closePath();
      g.fill();
      // A gold mask: the hall of faces.
      g.fillStyle = trim;
      g.beginPath();
      g.ellipse(bx + 16, 55, 9, 11, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = cloth;
      g.fillRect(bx + 10, 51, 4, 3);
      g.fillRect(bx + 18, 51, 4, 3);
      g.fillRect(bx + 13, 60, 6, 2);
    }
    return c;
  }
  function layersFor(v) {
    if (layerCache[v]) return layerCache[v];
    let set;
    if (v === "dungeon") {
      set = [{ c: archesLayer("#221d2d"), f: 0.15 }, { c: pillarsLayer("#2b2536", "#241f2e"), f: 0.35 }];
    } else if (v === "crypt") {
      set = [{ c: nichesLayer("#13232a", "#0a1418", "#8fa6a0"), f: 0.15 }, { c: pillarsLayer("#1a2f37", "#142630"), f: 0.35 }];
      set.fog = dripLayer();
    } else if (v === "hall") {
      set = [{ c: windowsLayer("#2a1719", "#6b4426"), f: 0.15 }, { c: bannersLayer("#3d2326", "#7a1f2a", "#c99a3e"), f: 0.35 }];
    } else if (v === "marsh") {
      set = [{ c: hillsLayer("#3a4530", 165, 14, 6), f: 0.15 }, { c: deadTreesLayer("#2c3522"), f: 0.35 }];
      set.fog = fogLayer();
    } else {
      set = [{ c: hillsLayer("#92b8d3", 170, 16, 7), f: 0.15 }, { c: blobsLayer("#6b97a8", 214, 3), f: 0.35 }];
    }
    layerCache[v] = set;
    return set;
  }
  function blitLayer(ctx, c, scroll) {
    const o = -Math.round(((scroll % PERIOD) + PERIOD) % PERIOD);
    ctx.drawImage(c, o, 0);
    ctx.drawImage(c, o + PERIOD, 0);
  }
  // Called after the sky and the old hills, before the tiles.
  function drawParallax(ctx, camX) {
    const v = visual();
    if (v === "marsh") {
      ctx.fillStyle = "rgba(48, 56, 30, 0.7)";
      ctx.fillRect(0, 0, 480, VIEW_H);
    }
    const set = layersFor(v);
    for (const l of set) blitLayer(ctx, l.c, camX * l.f);
    if (set.fog) blitLayer(ctx, set.fog, camX * 0.5 + (performance.now() / 1000) * 8);
    if (v === "hall") {
      // Wall torches on the pillars, with a flickering warm glow.
      const t = performance.now() / 1000;
      const o = -(((camX * 0.35) % PERIOD) + PERIOD) % PERIOD;
      for (let x = o; x < 480 + PERIOD; x += 160) {
        const fx = x + 9;
        const f = 0.8 + Math.sin(t * 9 + x) * 0.12 + Math.sin(t * 23 + x * 2) * 0.08;
        ctx.fillStyle = `rgba(255, 170, 70, ${0.12 * f})`;
        ctx.beginPath();
        ctx.arc(fx, 128, 34 * f, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#4a2c1c";
        ctx.fillRect(fx - 2, 128, 4, 12);
        ctx.fillStyle = "#ffb347";
        ctx.fillRect(fx - 3, 121 - f * 3, 6, 7 + f * 3);
        ctx.fillStyle = "#fff0b0";
        ctx.fillRect(fx - 1, 124, 2, 3);
      }
    }
  }

  // True when this tile is open air with no solid tile below it down to the map bottom.
  function pitBelow(tx, ty) {
    for (let y = ty; y < rows; y++) if (isSolid(at(tx, y)) || isOneWay(at(tx, y))) return false;
    return true;
  }

  // Bright top edge where a solid tile meets air above, dark edge where it meets air below or beside.
  // Marsh tiles get a murky green-brown tint.
  function drawEdges(ctx, tx, ty, px, py, tint) {
    if (tint) {
      ctx.fillStyle = tint;
      ctx.fillRect(px, py, TILE, TILE);
    }
    if (!isSolid(at(tx, ty - 1))) {
      ctx.fillStyle = "rgba(255, 255, 235, 0.35)";
      ctx.fillRect(px, py, TILE, 1);
      ctx.fillStyle = "rgba(255, 255, 235, 0.15)";
      ctx.fillRect(px, py + 1, TILE, 1);
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    if (!isSolid(at(tx, ty + 1))) ctx.fillRect(px, py + TILE - 1, TILE, 1);
    if (!isSolid(at(tx - 1, ty))) ctx.fillRect(px, py, 1, TILE);
    if (!isSolid(at(tx + 1, ty))) ctx.fillRect(px + TILE - 1, py, 1, TILE);
  }

  // Murky pit water with a 1 px surface line that waves over time.
  function drawWater(ctx, tx, ty, px, py) {
    const top = ty === rows - 4 ? 10 : 0;
    ctx.fillStyle = "rgba(38, 52, 28, 0.78)";
    ctx.fillRect(px, py + top, TILE, TILE - top);
    if (top) {
      const t = performance.now() / 1000;
      ctx.fillStyle = "#9bb07a";
      for (let x = 0; x < TILE; x += 2) {
        ctx.fillRect(px + x, py + top + Math.round(Math.sin(t * 2.2 + (tx * TILE + x) * 0.18)), 2, 1);
      }
    }
  }

  function draw(ctx, images, camX, camY, viewW, viewH) {
    const tx0 = Math.max(0, Math.floor(camX / TILE));
    const ty0 = Math.max(0, Math.floor(camY / TILE));
    const tx1 = Math.min(cols - 1, Math.floor((camX + viewW) / TILE));
    const ty1 = Math.min(rows - 1, Math.floor((camY + viewH) / TILE));

    const look = visual();
    const marsh = look === "marsh";
    const tint = LOOK_TINT[look];
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
          // A light top edge makes ledges readable against the dark sky.
          if (!isSolid(ty > 0 ? at(tx, ty - 1) : ".")) {
            if (look === "hall") {
              // A red carpet with gold trim runs along the hall floor.
              ctx.fillStyle = "#8a2230";
              ctx.fillRect(px, py, TILE, 5);
              ctx.fillStyle = "#d9a441";
              ctx.fillRect(px, py + 5, TILE, 1);
            } else {
              ctx.fillStyle = look === "crypt" ? "#86b9bf" : "#9c8fb0";
              ctx.fillRect(px, py, TILE, 3);
            }
          }
        } else if (ch === "=") {
          ctx.drawImage(images.dirt, px, py, TILE, TILE);
          ctx.drawImage(images.grass, px, py, TILE, TILE);
        } else if (ch === "_") {
          drawPlank(ctx, px, py);
        } else if (ch === "T" && LEVELS[index].theme !== "dungeon") {
          drawTree(ctx, images.tree, tx, ty, px, py);
        } else if (ch === "^") {
          drawSpikes(ctx, px, py);
        } else if (ch === "F") {
          drawFlag(ctx, px, py, LEVELS[index].theme === "dungeon");
        }
        if (isSolid(ch)) {
          drawEdges(ctx, tx, ty, px, py, tint);
          // Depth shade: brick buried under more solid tiles is darker, so the ground reads as a
          // mass with a lit top instead of a flat wall of brick.
          let depth = 0;
          while (depth < 3 && isSolid(at(tx, ty - depth - 1))) depth++;
          if (depth > 0) {
            ctx.fillStyle = `rgba(0, 0, 0, ${[0, 0.16, 0.3, 0.42][depth]})`;
            ctx.fillRect(px, py, TILE, TILE);
          }
        }
        else if (marsh && ty >= rows - 4 && (ch === "." || ch === "^") && pitBelow(tx, ty)) drawWater(ctx, tx, ty, px, py);
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
    addLadder,
    ladderIn,
    ladderAt,
    standingOn,
    ladders,
    updatePlatforms,
    drawPlatforms,
    platforms,
    draw,
    drawParallax,
    drawGrounding,
    drawCardIcon,
    visual,
    drawSigns,
    setFlagOpen,
    // Secrets (c and p markers) in level i.
    countSecrets: (i) => LEVELS[i].rows.reduce((n, row) => n + [...row].filter((ch) => ch === "c" || ch === "p").length, 0),
    THEMES,
    overlapping,
    load,
  };
  load(0);
  return api;
})();
