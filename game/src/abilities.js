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
    sprite: "mage",
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

  function faceRect(p, reach, h, dy) {
    const x = p.facing > 0 ? p.x + p.w : p.x - reach;
    return { x, y: p.y + dy, w: reach, h };
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
        hitboxes.push({ ...faceRect(p, 36, 24, 4), t: 0.15, kind: "slash" });
        break;
      case "thrust":
        hitboxes.push({ ...faceRect(p, 56, 12, 10), t: 0.15, kind: "thrust" });
        break;
      case "shield_bash":
        hitboxes.push({ ...faceRect(p, 22, 30, 0), t: 0.12, kind: "bash", stun: 1.2 });
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
        World.addPlatform({ x, y, w: 3 * World.TILE, h: 6, life: 6 });
        break;
      }
      case "bone_bridge": {
        // Bone bridge: the anchor, but 5 tiles long and it lasts longer.
        const x = p.facing > 0 ? p.x + p.w + 4 : p.x - 4 - 5 * World.TILE;
        const y = p.y + p.h - 2 * World.TILE;
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
    for (const dist of [96, 64, 32]) {
      const nx = p.x + p.facing * dist;
      const clear = World.overlapping(nx, p.y, p.w, p.h).every((c) => {
        const ch = c.ch;
        return !World.isSolid(ch);
      });
      if (clear) {
        p.x = Math.max(0, Math.min(nx, World.width - p.w));
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
        if (hb.stun) e.stunT = hb.stun;
        else Enemies.defeat(e);
      });
    }
    for (let i = hitboxes.length - 1; i >= 0; i--) {
      if (hitboxes[i].t <= 0) hitboxes.splice(i, 1);
    }

    for (const q of projectiles) {
      q.life -= dt;
      q.x += q.vx * dt;
      if (World.overlapping(q.x, q.y, q.w, q.h).some((c) => World.isSolid(c.ch))) q.life = 0;
      for (const e of Enemies.list()) {
        if (!e.dead && overlaps(q, e)) {
          Enemies.defeat(e);
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

  function draw(ctx, cx, cy) {
    for (const hb of hitboxes) {
      ctx.fillStyle = hb.kind === "bash" ? "rgba(200, 220, 255, 0.6)" : "rgba(255, 255, 255, 0.55)";
      ctx.fillRect(Math.round(hb.x - cx), Math.round(hb.y - cy), hb.w, hb.h);
    }
    for (const q of projectiles) {
      ctx.fillStyle = q.kind === "spell_bolt" ? "#b9a2f0" : "#e8e4d8";
      ctx.fillRect(Math.round(q.x - cx), Math.round(q.y - cy), q.w, q.h);
    }
    for (const h of hostile) {
      ctx.fillStyle = "#c2452d";
      ctx.fillRect(Math.round(h.x - cx), Math.round(h.y - cy), h.w, h.h);
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

  function reset() {
    hitboxes.length = 0;
    projectiles.length = 0;
    hostile.length = 0;
  }

  return { use, update, draw, fireHostile, hitByHostile, hostileCount: () => hostile.length, reset };
})();
