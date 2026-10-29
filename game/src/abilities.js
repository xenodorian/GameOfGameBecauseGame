// Character data and the ability effects.
//
// Each character has four abilities, bound in order to A/S/Z/X on the
// keyboard and X/Y/A/B on a gamepad (ability 1 to 4).
const CHARACTERS = {
  knight: {
    name: "Knight",
    sprite: "knight",
    abilities: ["shield_bash", "charge", "slash", "thrust"],
  },
  ranger: {
    name: "Ranger",
    sprite: "ranger_right",
    abilities: ["shoot", "arrow_anchor", "slash", "hop"],
  },
  // Ability ids here are defined in C2 and C3. Until then they do nothing.
  rat: {
    name: "Rat",
    sprite: "rat_king",
    abilities: ["leap", "scurry", "slash", "thrust"],
  },
  weaver: {
    name: "Bone Weaver",
    sprite: "bone_weaver",
    abilities: ["shoot", "bone_bridge", "slash", "ghost"],
  },
  // Mage art is the Knight sprite tinted purple (see main.js).
  mage: {
    name: "Mage",
    sprite: "mage_right",
    abilities: ["spell_bolt", "float", "slash", "blink"],
  },
};

const ABILITY_NAMES = {
  shield_bash: "Shield bash",
  charge: "Charge",
  slash: "Slash",
  thrust: "Thrust",
  shoot: "Shoot",
  arrow_anchor: "Arrow anchor",
  hop: "Hop",
  spell_bolt: "Spell bolt",
  float: "Float",
  blink: "Blink",
  leap: "Leap",
  scurry: "Scurry",
  bone_bridge: "Bone bridge",
  ghost: "Ghost",
};

// Attacks in flight: melee hitboxes, projectiles, and rope platforms.
// The scene calls update and draw. Effects that touch enemies go through
// Enemies.defeat and stun.
const Attacks = (() => {
  const hitboxes = [];
  const projectiles = [];
  // Enemy arrows. They fly until they hit a wall or the player.
  const hostile = [];
  const MAX_PROJECTILES = 2;
  // Set when an attack hits an enemy this step. The scene reads and clears it (hit stop).
  let hitThisStep = false;
  // Seconds before each ability can fire again.
  const COOLDOWN = {
    slash: 0.18, thrust: 0.28, shield_bash: 0.45, charge: 0.6, shoot: 0.25, spell_bolt: 0.3,
    arrow_anchor: 0.8, bone_bridge: 1.0, hop: 0, float: 0, blink: 0.4, leap: 0, scurry: 3.0, ghost: 4.0,
  };

  function faceRect(p, reach, h, dy) {
    const x = p.facing > 0 ? p.x + p.w : p.x - reach;
    return { x, y: p.y + dy, w: reach, h };
  }

  // Drawing data for a melee hitbox: the body's shoulder point and facing.
  function fx(p) {
    return { dir: p.facing, ox: p.x + p.w / 2, oy: p.y + 10 };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // Fires one ability for the scene's player. Timed effects (charge, float)
  // are stored on the scene and read in its update.
  function use(id, scene) {
    const p = scene.player;
    Sfx.play("ability");
    switch (id) {
      case "slash":
        hitboxes.push({ ...faceRect(p, 36, 24, 4), ...fx(p), t: 0.15, total: 0.15, kind: "slash" });
        break;
      case "thrust":
        hitboxes.push({ ...faceRect(p, 56, 12, 10), ...fx(p), t: 0.15, total: 0.15, kind: "thrust" });
        break;
      case "shield_bash":
        hitboxes.push({ ...faceRect(p, 22, 30, 0), ...fx(p), t: 0.12, total: 0.12, kind: "bash", stun: 1.2 });
        break;
      case "charge":
        scene.dashT = 0.25;
        break;
      case "shoot":
      case "spell_bolt": {
        const magic = id === "spell_bolt";
        const live = projectiles.filter((q) => q.owner === scene.active).length;
        if (live >= MAX_PROJECTILES) break;
        projectiles.push({
          x: p.facing > 0 ? p.x + p.w : p.x - 8,
          y: p.y + 12,
          w: 8,
          h: 4,
          vx: p.facing * (magic ? 300 : 380),
          life: 1.2,
          owner: scene.active,
          kind: id,
        });
        break;
      }
      case "arrow_anchor": {
        // Rope platform three tiles long, one tile in front, two tiles above the feet.
        const x = p.facing > 0 ? p.x + p.w + 4 : p.x - 4 - 3 * World.TILE;
        const y = p.y + p.h - 2 * World.TILE;
        World.platforms.length = 0;
        World.addPlatform({ x, y, w: 3 * World.TILE, h: 6, life: 6 });
        break;
      }
      case "bone_bridge": {
        // Bone bridge: the anchor, but 5 tiles long and it lasts longer.
        const x = p.facing > 0 ? p.x + p.w + 4 : p.x - 4 - 5 * World.TILE;
        const y = p.y + p.h - 2 * World.TILE;
        World.platforms.length = 0;
        World.addPlatform({ x, y, w: 5 * World.TILE, h: 6, life: 8, color: "#e8e2d0" });
        break;
      }
      case "ghost":
        // Ghost: enemy contact and arrows pass through for a short time.
        scene.ghostT = 1.5;
        break;
      case "float":
        scene.floatT = 1.2;
        break;
      case "blink":
        blink(p);
        break;
      case "leap":
        // Rat leap: a high jump from the ground, about 5 tiles.
        if (p.grounded) {
          p.vy = -540;
          p.jumping = false;
          Effects.dust(p.x + p.w / 2, p.y + p.h, "#8a7a66", 5, 2, 0.3);
        }
        break;
      case "scurry":
        scene.scurryT = 2.0;
        break;
      case "hop":
        if (!p.grounded && !p.hopUsed) {
          p.vy = -300;
          p.hopUsed = true;
        }
        break;
      default:
        break;
    }
  }

  // Teleport forward up to 96 px. Shorter steps are tried if the target is solid.
  function blink(p) {
    Effects.ring(p.x + p.w / 2, p.y + p.h / 2, "#b9a2f0");
    for (const dist of [96, 64, 32]) {
      const nx = p.x + p.facing * dist;
      const clear = World.overlapping(nx, p.y, p.w, p.h).every((c) => {
        const ch = c.ch;
        return !World.isSolid(ch);
      });
      if (clear) {
        p.x = Math.max(0, Math.min(nx, World.width - p.w));
        Effects.ring(p.x + p.w / 2, p.y + p.h / 2, "#b9a2f0");
        return;
      }
    }
  }

  function update(dt) {
    for (const hb of hitboxes) {
      hb.t -= dt;
      if (hb.kind === "bash") World.breakCracked(hb.x, hb.y, hb.w, hb.h);
      Enemies.list().forEach((e) => {
        if (e.dead || !overlaps(hb, e)) return;
        hitThisStep = true;
        Effects.spark(e.x + e.w / 2, e.y + e.h / 2);
        if (hb.stun) e.stunT = hb.stun;
        else Enemies.defeat(e, hb.x + hb.w / 2);
      });
    }
    for (let i = hitboxes.length - 1; i >= 0; i--) {
      if (hitboxes[i].t <= 0) hitboxes.splice(i, 1);
    }

    for (const q of projectiles) {
      q.life -= dt;
      q.x += q.vx * dt;
      if (World.overlapping(q.x, q.y, q.w, q.h).some((c) => World.isSolid(c.ch))) {
        // Hitting a wall: a few dust squares in the arrow's colour.
        Effects.dust(q.x, q.y, q.kind === "spell_bolt" ? "#b9a2f0" : "#e8e4d8", 3, 2, 0.25);
        q.life = 0;
      }
      for (const e of Enemies.list()) {
        if (!e.dead && overlaps(q, e)) {
          hitThisStep = true;
          Effects.spark(q.x, q.y);
          Enemies.defeat(e, q.x);
          q.life = 0;
        }
      }
    }
    for (let i = projectiles.length - 1; i >= 0; i--) {
      if (projectiles[i].life <= 0) projectiles.splice(i, 1);
    }

    for (const h of hostile) {
      h.life -= dt;
      h.x += h.vx * dt;
      if (World.overlapping(h.x, h.y, h.w, h.h).some((c) => World.isSolid(c.ch))) h.life = 0;
    }
    for (let i = hostile.length - 1; i >= 0; i--) {
      if (hostile[i].life <= 0) hostile.splice(i, 1);
    }
  }

  // Set to true to outline the hitboxes, for checking reach.
  const debug = { on: false };
  const DEG = Math.PI / 180;

  // Slash: a crescent sweeping from -70 to +50 degrees over the hitbox's life. Only the last 60 degrees are drawn.
  function drawSlash(ctx, hb, cx, cy) {
    const prog = 1 - Math.max(0, hb.t) / hb.total;
    const a = 1 - prog;
    const end = -70 + 120 * prog;
    const start = end - 60;
    const x = hb.ox - cx;
    const y = hb.oy - cy;
    ctx.beginPath();
    if (hb.dir > 0) ctx.arc(x, y, 22, start * DEG, end * DEG);
    else ctx.arc(x, y, 22, (180 - end) * DEG, (180 - start) * DEG);
    ctx.lineWidth = 4;
    ctx.strokeStyle = `rgba(255, 255, 255, ${a})`;
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.strokeStyle = `rgba(180, 220, 255, ${a})`;
    ctx.stroke();
  }

  // Thrust: a white streak along the reach, fading in from the body.
  function drawThrust(ctx, hb, cx, cy) {
    const x = Math.round(hb.x - cx);
    const y = Math.round(hb.y - cy + hb.h / 2 - 1.5);
    const grad = ctx.createLinearGradient(x, 0, x + hb.w, 0);
    grad.addColorStop(0, "rgba(255, 255, 255, 0)");
    grad.addColorStop(1, "rgba(255, 255, 255, 0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, hb.w, 3);
  }

  // Shield bash: a half ring in front of the body, growing and fading.
  function drawBash(ctx, hb, cx, cy) {
    const prog = 1 - Math.max(0, hb.t) / hb.total;
    const x = hb.ox - cx + hb.dir * 6;
    const y = hb.oy - cy + 8;
    const r = 10 + 18 * prog;
    ctx.beginPath();
    if (hb.dir > 0) ctx.arc(x, y, r, -90 * DEG, 90 * DEG);
    else ctx.arc(x, y, r, 90 * DEG, 270 * DEG);
    ctx.lineWidth = 3;
    ctx.strokeStyle = `rgba(170, 215, 255, ${1 - prog})`;
    ctx.stroke();
  }

  // A 14 by 3 arrow pointing along its direction: shaft, head, and two fletching pixels.
  function drawArrow(ctx, x, y, dir, shaft, head, fletch) {
    const tail = dir > 0 ? x : x + 14;
    ctx.fillStyle = shaft;
    ctx.fillRect(dir > 0 ? x : x + 2, y + 1, 12, 1);
    ctx.fillStyle = head;
    ctx.beginPath();
    if (dir > 0) {
      ctx.moveTo(x + 14, y - 0.5); ctx.lineTo(x + 10, y + 1); ctx.lineTo(x + 14, y + 2.5);
    } else {
      ctx.moveTo(x, y - 0.5); ctx.lineTo(x + 4, y + 1); ctx.lineTo(x, y + 2.5);
    }
    ctx.fill();
    ctx.fillStyle = fletch;
    ctx.fillRect(tail - (dir > 0 ? 2 : -1), y, 1, 1);
    ctx.fillRect(tail - (dir > 0 ? 2 : -1), y + 2, 1, 1);
  }

  // Spell bolt: a glowing orb with a short trail.
  function drawOrb(ctx, q, cx, cy) {
    const x = q.x - cx + q.w / 2;
    const y = q.y - cy + q.h / 2;
    ctx.fillStyle = "rgba(185, 162, 240, 0.35)";
    ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#d9c8ff";
    ctx.beginPath(); ctx.arc(x, y, 3, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath(); ctx.arc(x, y, 1.5, 0, Math.PI * 2); ctx.fill();
  }

  function draw(ctx, cx, cy) {
    for (const hb of hitboxes) {
      if (debug.on) {
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.strokeRect(Math.round(hb.x - cx), Math.round(hb.y - cy), hb.w, hb.h);
      }
      if (hb.kind === "slash") drawSlash(ctx, hb, cx, cy);
      else if (hb.kind === "thrust") drawThrust(ctx, hb, cx, cy);
      else if (hb.kind === "bash") drawBash(ctx, hb, cx, cy);
    }
    for (const q of projectiles) {
      const dir = q.vx > 0 ? 1 : -1;
      if (q.kind === "spell_bolt") drawOrb(ctx, q, cx, cy);
      else drawArrow(ctx, Math.round(q.x - cx), Math.round(q.y - cy), dir, "#c8a46a", "#d8d8e0", "#e8e4d8");
    }
    for (const h of hostile) {
      drawArrow(ctx, Math.round(h.x - cx), Math.round(h.y - cy), h.vx > 0 ? 1 : -1, "#5a3a2a", "#d8d8e0", "#c2452d");
    }
  }

  function fireHostile(x, y, dir) {
    hostile.push({ x, y, w: 8, h: 4, vx: dir * 240, life: 2.5 });
  }

  // True if a hostile arrow hits the body. The arrow is used up on contact.
  function hitByHostile(body) {
    for (const h of hostile) {
      if (h.life > 0 && overlaps(h, body)) {
        h.life = 0;
        return true;
      }
    }
    return false;
  }

  // True once after an attack hit. Reading it clears it.
  function consumeHit() {
    const hit = hitThisStep;
    hitThisStep = false;
    return hit;
  }

  function reset() {
    hitboxes.length = 0;
    projectiles.length = 0;
    hostile.length = 0;
  }

  return { use, update, draw, fireHostile, hitByHostile, hostileCount: () => hostile.length, reset, consumeHit, debug, COOLDOWN };
})();
