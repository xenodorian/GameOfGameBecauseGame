// Enemies, their patrol and chase AI, and the card pickups they drop.
//
// Provisional rule: until the ability attacks arrive in Phase 4, a stomp
// (landing on an enemy from above) defeats it. Side contact hurts the player.
const ENEMY_DEFS = {
  grunt: {
    sprite: "grunt",
    w: 22,
    h: 30,
    speed: 45,
    chaseSpeed: 75,
    sight: 140,
    card: "ranger",
  },
  mud_revenant: {
    sprite: "mud_revenant",
    w: 24,
    h: 30,
    speed: 28,
    chaseSpeed: 40,
    sight: 110,
    card: "mage",
  },
  // Hops toward the player when it is near and on the ground.
  rat_king: {
    sprite: "rat_king",
    w: 22,
    h: 26,
    speed: 35,
    chaseSpeed: 60,
    sight: 160,
    card: "rat",
    jumpVy: -330,
    jumpEvery: 1.4,
  },
  // Stands its ground and fires a hostile arrow at the player when lined up.
  // Boss. Walks at the player, jumps, and fires. Takes 8 hits.
  warlord: {
    sprite: "warlord",
    w: 44,
    h: 58,
    drawW: 128,
    drawH: 128,
    speed: 50,
    chaseSpeed: 80,
    sight: 400,
    hp: 8,
    card: "knight",
    jumpVy: -420,
    jumpEvery: 3.0,
    fireEvery: 2.2,
  },
  archer: {
    idle: true,
    sprite: "bone_weaver",
    w: 22,
    h: 30,
    speed: 0,
    chaseSpeed: 0,
    sight: 200,
    card: "weaver",
    fireEvery: 1.6,
  },
};

class Enemy {
  constructor(kind, x, y) {
    const def = ENEMY_DEFS[kind];
    this.kind = kind;
    this.def = def;
    this.x = x;
    this.y = y;
    this.w = def.w;
    this.h = def.h;
    this.vx = 0;
    this.vy = 0;
    this.grounded = false;
    this.dir = -1;
    this.dead = false;
    this.stunT = 0;
    this.knockT = 0;
    this.knockVx = 0;
    this.jumpT = def.jumpEvery || 0;
    this.fireT = def.fireEvery || 0;
    this.hp = def.hp || 1;
    this.hurtT = 0;
    this.animT = 0;
  }

  // Jump on a timer while the enemy is on the ground and the player is near.
  tryJump(dt, chasing) {
    const d = this.def;
    this.jumpT -= dt;
    if (this.grounded && chasing && this.jumpT <= 0) {
      this.vy = d.jumpVy;
      this.jumpT = d.jumpEvery;
    }
  }

  // Fire a hostile arrow on a timer while the player is lined up.
  tryFire(dt, chasing, dx) {
    const d = this.def;
    this.fireT -= dt;
    if (chasing && this.fireT <= 0) {
      this.dir = dx >= 0 ? 1 : -1;
      Attacks.fireHostile(this.x + this.w / 2, this.y + 12, this.dir);
      this.fireT = d.fireEvery;
    }
  }

  update(dt, player) {
    // Animation clock for the walk, idle, and hurt frames. Draw only reads it.
    this.animT += dt;
    const d = this.def;
    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + player.h / 2 - (this.y + this.h / 2);
    const chasing = Math.abs(dx) < d.sight && Math.abs(dy) < 64;
    if (this.hurtT > 0) this.hurtT -= dt;

    if (this.stunT > 0) {
      // Stunned by shield bash: no walking or chasing, gravity still applies.
      this.stunT -= dt;
      this.vx = 0;
      this.vy = Math.min(this.vy + 900 * dt, 600);
      World.moveBody(this, dt);
      return;
    }
    if (this.knockT > 0) {
      // Knocked back by a hit: slide away, no walking or chasing.
      this.knockT -= dt;
      this.vx = this.knockVx;
      World.moveBody(this, dt);
      return;
    }

    if (d.jumpVy) this.tryJump(dt, chasing);
    if (d.fireEvery) this.tryFire(dt, chasing, dx);

    if (chasing) {
      this.dir = dx >= 0 ? 1 : -1;
      this.vx = this.dir * d.chaseSpeed;
    } else {
      // Patrol: turn around at walls and at ledges.
      this.vx = this.dir * d.speed;
    }

    const before = this.x;
    this.vy = Math.min(this.vy + 900 * dt, 600);
    World.moveBody(this, dt);

    if (!chasing) {
      const blocked = this.grounded && Math.abs(this.x - before) < 0.01;
      const aheadX = this.dir > 0 ? this.x + this.w + 2 : this.x - 2;
      const footY = this.y + this.h + 2;
      const groundAhead = World.isStandable(aheadX, footY);
      if (blocked || !groundAhead) this.dir = -this.dir;
    }
  }

  draw(ctx, images, camX, camY) {
    const dw = this.def.drawW || 64;
    const dh = this.def.drawH || 64;
    const sx = Math.round(this.x + this.w / 2 - dw / 2 - camX);
    const sy = Math.round(this.y + this.h - dh - camY);
    // Hurt: the hurt row, a white silhouette. Archers stand and idle. Others walk.
    let frame;
    if (this.hurtT > 0) frame = { row: ANIM_ROWS.hurt[0], col: 0 };
    else if (this.def.idle) frame = { row: ANIM_ROWS.idle[0], col: Math.floor(this.animT * 3) % ANIM_ROWS.idle[1] };
    else frame = { row: ANIM_ROWS.walk[0], col: 1 + Math.floor(this.animT * 6) % (ANIM_ROWS.walk[1] - 1) };
    const sheet = IMG["lpc_" + this.kind];
    ctx.save();
    if (this.dir < 0) {
      ctx.translate(sx + dw, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame.col * 64, frame.row * 64, 64, 64, 0, 0, dw, dh);
    } else {
      ctx.drawImage(sheet, frame.col * 64, frame.row * 64, 64, 64, sx, sy, dw, dh);
    }
    ctx.restore();
  }
}

// A card on the ground. Falls with gravity until the player touches it.
// cardId is a character id, or "random" to pick one when it is collected.
// A power-up is a gold pickup. It draws one card and then one more.
class CardPickup {
  constructor(cardId, x, y, { power = false, pop = true, secret = false } = {}) {
    this.cardId = cardId;
    this.power = power;
    this.secret = secret;
    this.x = x;
    this.y = y;
    this.w = 14;
    this.h = 18;
    this.vx = 0;
    this.vy = pop ? -120 : 0;
    this.grounded = false;
    this.state = "ground"; // ground, flying, done
    this.t = 0;
  }

  update(dt) {
    if (this.state !== "ground") return;
    this.vy = Math.min(this.vy + 900 * dt, 600);
    World.moveBody(this, dt);
  }

  draw(ctx, camX, camY, flyTo) {
    let sx;
    let sy;
    if (this.state === "flying") {
      const k = 1 - Math.pow(1 - Math.min(this.t / 0.3, 1), 3);
      sx = this.screenFrom.x + (flyTo.x - this.screenFrom.x) * k;
      sy = this.screenFrom.y + (flyTo.y - this.screenFrom.y) * k;
    } else {
      sx = this.x - camX;
      sy = this.y - camY;
    }
    // Unrolled cards (cardId "random") are drawn grey until they are collected.
    const def = this.power ? { color: "#e0b84a" } : CARD_DEFS[this.cardId] || { color: "#b8b8b8" };
    ctx.fillStyle = def.color;
    ctx.fillRect(Math.round(sx), Math.round(sy), this.w, this.h);
    ctx.strokeStyle = "#111418";
    ctx.strokeRect(Math.round(sx) + 0.5, Math.round(sy) + 0.5, this.w - 1, this.h - 1);
  }
}

// Visual effects: defeat bursts and a short screen shake. Drawn in code.
const Effects = {
  shakeT: 0,
  // Shake offset for this step, set in update so draw only reads it.
  shakeX: 0,
  shakeY: 0,
  shakeAmp: 3,
  // White screen flash time left (beam fire).
  flashT: 0,
  bursts: [],
  // Short effects: sparks (hit points), dust squares, and rings. All move in update, never in draw.
  sparks: [],
  dusts: [],
  rings: [],
  // Hot particles with a 1 px trail, and muzzle flares.
  bits: [],
  flares: [],
  reset() {
    this.shakeT = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.bursts.length = 0;
    this.sparks.length = 0;
    this.dusts.length = 0;
    this.rings.length = 0;
    this.bits.length = 0;
    this.flares.length = 0;
    this.flashT = 0;
  },
  // Shake for t seconds, up to amp px. A stronger shake is never cut short by a weaker one.
  shake(t, amp) {
    if (this.shakeT > 0 && this.shakeAmp > amp) return;
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeAmp = amp;
  },
  flash(t) {
    this.flashT = Math.max(this.flashT, t);
  },
  // n hot bits thrown toward dir (1 right, -1 left), in a ramp from Glow.RAMPS.
  spray(x, y, dir, ramp = "ember", n = 4) {
    for (let i = 0; i < n; i++) {
      const a = (Math.random() - 0.5) * 1.6;
      const v = 80 + Math.random() * 90;
      this.bits.push({ x, y, px: x, py: y, vx: dir * Math.cos(a) * v, vy: Math.sin(a) * v - 60, ramp, t: 0, life: 0.25 + Math.random() * 0.15 });
    }
  },
  // A four-ray glint at a bow or staff on release.
  flare(x, y, ramp = "steel") {
    this.flares.push({ x, y, ramp, t: 0 });
  },
  // Impact: a banded flash, six jagged rays for 0.12 s, hot bits thrown back
  // toward the attacker (dir is the attack direction), and a small shake.
  spark(x, y, dir = 0, ramp = "ember") {
    this.sparks.push({ x, y, t: 0, ramp, seed: (Math.random() * 1e9) | 0 });
    if (dir) this.spray(x, y, -dir, ramp, 4);
    this.shake(0.06, 1);
  },
  // n small squares. vy is the starting upward speed (negative rises). Lives for life seconds.
  dust(x, y, color, n, size = 2, life = 0.25, vy = 0) {
    for (let i = 0; i < n; i++) {
      const vx = (i - (n - 1) / 2) * 20;
      this.dusts.push({ x, y, vx, vy: vy - 20 * (i % 2), size, color, life, t: 0 });
    }
  },
  // A circle outline growing from radius 6 to 16 over 0.2 s.
  ring(x, y, color) {
    this.rings.push({ x, y, color, t: 0 });
  },
  burst(x, y, color) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      parts.push({ x, y, vx: Math.cos(a) * 60, vy: -80 + Math.sin(a) * 30 });
    }
    this.bursts.push({ parts, color, t: 0 });
  },
  update(dt) {
    if (this.shakeT > 0) {
      this.shakeT -= dt;
      this.shakeX = Math.round((Math.random() * 2 - 1) * this.shakeAmp);
      this.shakeY = Math.round((Math.random() * 2 - 1) * this.shakeAmp);
    } else {
      this.shakeX = 0;
      this.shakeY = 0;
    }
    for (const b of this.bursts) {
      b.t += dt;
      for (const q of b.parts) {
        q.vy += 400 * dt;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
      }
    }
    this.bursts = this.bursts.filter((b) => b.t < 0.4);
    for (const s of this.sparks) s.t += dt;
    this.sparks = this.sparks.filter((s) => s.t < 0.12);
    for (const q of this.dusts) {
      q.t += dt;
      q.vy += 300 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.dusts = this.dusts.filter((q) => q.t < q.life);
    for (const r of this.rings) r.t += dt;
    this.rings = this.rings.filter((r) => r.t < 0.2);
    if (this.flashT > 0) this.flashT -= dt;
    for (const q of this.bits) {
      q.t += dt;
      q.px = q.x; q.py = q.y;
      q.vy += 400 * dt;
      q.x += q.vx * dt;
      q.y += q.vy * dt;
    }
    this.bits = this.bits.filter((q) => q.t < q.life);
    for (const f of this.flares) f.t += dt;
    this.flares = this.flares.filter((f) => f.t < 0.1);
  },
  draw(ctx, camX, camY) {
    for (const b of this.bursts) {
      ctx.globalAlpha = 1 - b.t / 0.4;
      ctx.fillStyle = b.color;
      for (const q of b.parts) ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 4, 4);
    }
    ctx.globalAlpha = 1;
    for (const s of this.sparks) {
      const cx = s.x - camX;
      const cy = s.y - camY;
      const k = s.t / 0.12;
      if (k < 0.5) {
        Glow.light(ctx, cx, cy, 14, Glow.RAMPS[s.ramp][3], 0.3);
        Glow.disc(ctx, cx, cy, 6 - k * 6, s.ramp);
      }
      const rand = Glow.rng(s.seed);
      ctx.globalAlpha = 1 - k;
      for (let r = 0; r < 6; r++) {
        const a = (r * Math.PI) / 3 + (rand() - 0.5) * 0.5;
        const len = 4 + k * 3 + rand() * 2;
        const x0 = cx + Math.cos(a) * 2;
        const y0 = cy + Math.sin(a) * 2;
        Glow.bolt(ctx, x0, y0, cx + Math.cos(a) * (2 + len), cy + Math.sin(a) * (2 + len), s.ramp, rand, 2, 1);
      }
      ctx.globalAlpha = 1;
    }
    for (const q of this.bits) {
      const c = Glow.RAMPS[q.ramp];
      const young = q.t < q.life * 0.4;
      ctx.globalAlpha = 1 - q.t / q.life;
      if (young) {
        ctx.fillStyle = c[3];
        ctx.fillRect(Math.round(q.px - camX), Math.round(q.py - camY), 1, 1);
      }
      ctx.fillStyle = young ? c[0] : c[2];
      ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 1, 1);
    }
    ctx.globalAlpha = 1;
    for (const f of this.flares) {
      Glow.disc(ctx, f.x - camX, f.y - camY, 3, f.ramp, 1 - f.t / 0.1);
      Glow.star(ctx, f.x - camX, f.y - camY, 5, Math.floor(f.t * 60), f.ramp, 1 - f.t / 0.1);
    }
    for (const q of this.dusts) {
      ctx.globalAlpha = 1 - q.t / q.life;
      ctx.fillStyle = q.color;
      ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), q.size, q.size);
    }
    for (const r of this.rings) {
      ctx.globalAlpha = 1 - r.t / 0.2;
      ctx.strokeStyle = r.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(r.x - camX), Math.round(r.y - camY), 6 + (r.t / 0.2) * 10, 0, Math.PI * 2);
      ctx.stroke();
      Glow.light(ctx, r.x - camX, r.y - camY, 20, r.color, 0.25 * (1 - r.t / 0.2));
    }
    ctx.globalAlpha = 1;
    if (this.flashT > 0) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.22)";
      ctx.fillRect(-4, -4, Engine.W + 8, Engine.H + 8);
    }
  },
};

// Places enemies and card pickups for one level, and runs their updates.
const Enemies = (() => {
  let list = [];
  let pickups = [];

  function spawnFromLevel() {
    list = World.enemySpawns.map((s) => {
      const h = ENEMY_DEFS[s.kind].h;
      // A tall enemy (only the warlord) starts with its feet on the bottom of its tile.
      return new Enemy(s.kind, s.x, h > World.TILE ? s.y + World.TILE - h : s.y);
    });
    pickups = World.pickupSpawns.map(
      (s) => new CardPickup("random", s.x, s.y, { power: s.power, pop: false, secret: s.secret })
    );
  }

  function dropCard(enemy) {
    const cardId = ENEMY_DEFS[enemy.kind].card;
    pickups.push(new CardPickup(cardId, enemy.x + enemy.w / 2 - 7, enemy.y));
  }

  // Removes an enemy and drops its card. Used by stomps, melee, and arrows.
  // A hit. Enemies with more than 1 hp survive and flash for 0.6 s.
  // fromX is the attacker's x. A surviving enemy is pushed away from it.
  function defeat(enemy, fromX) {
    if (enemy.dead || enemy.hurtT > 0) return;
    if (enemy.hp > 1) {
      enemy.hp -= 1;
      enemy.hurtT = 0.6;
      if (fromX !== undefined) {
        enemy.knockT = 0.12;
        enemy.knockVx = enemy.x + enemy.w / 2 >= fromX ? 160 : -160;
      }
      Sfx.play(enemy.kind === "warlord" ? "boss" : "hit");
      if (enemy.kind === "warlord") { Effects.shake(0.15, 3); Effects.flash(0.04); }
      return;
    }
    enemy.dead = true;
    Sfx.play("hit");
    Effects.burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, CARD_DEFS[ENEMY_DEFS[enemy.kind].card].color);
    dropCard(enemy);
  }

  return {
    spawnFromLevel,
    dropCard,
    defeat,
    list: () => list,
    pickups: () => pickups,
    cleanup: () => {
      list = list.filter((e) => !e.dead);
      pickups = pickups.filter((p) => p.state !== "done");
    },
  };
})();
