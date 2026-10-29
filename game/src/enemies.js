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
    else frame = { row: ANIM_ROWS.walk[0], col: Math.floor(this.animT * 6) % ANIM_ROWS.walk[1] };
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
  bursts: [],
  reset() {
    this.shakeT = 0;
    this.shakeX = 0;
    this.shakeY = 0;
    this.bursts.length = 0;
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
      this.shakeX = Math.round((Math.random() * 2 - 1) * 3);
      this.shakeY = Math.round((Math.random() * 2 - 1) * 3);
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
  },
  draw(ctx, camX, camY) {
    for (const b of this.bursts) {
      ctx.globalAlpha = 1 - b.t / 0.4;
      ctx.fillStyle = b.color;
      for (const q of b.parts) ctx.fillRect(Math.round(q.x - camX), Math.round(q.y - camY), 4, 4);
    }
    ctx.globalAlpha = 1;
  },
};

// Places enemies and card pickups for one level, and runs their updates.
const Enemies = (() => {
  let list = [];
  let pickups = [];

  function spawnFromLevel() {
    list = World.enemySpawns.map((s) => new Enemy(s.kind, s.x, s.y));
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
      if (enemy.kind === "warlord") Effects.shakeT = 0.15;
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
