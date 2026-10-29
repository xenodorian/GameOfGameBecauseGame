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
  archer: {
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
    this.jumpT = def.jumpEvery || 0;
    this.fireT = def.fireEvery || 0;
  }

  update(dt, player) {
    const d = this.def;
    const dx = player.x + player.w / 2 - (this.x + this.w / 2);
    const dy = player.y + player.h / 2 - (this.y + this.h / 2);
    const chasing = Math.abs(dx) < d.sight && Math.abs(dy) < 64;

    if (this.stunT > 0) {
      // Stunned by shield bash: no walking or chasing, gravity still applies.
      this.stunT -= dt;
      this.vx = 0;
      this.vy = Math.min(this.vy + 900 * dt, 600);
      World.moveBody(this, dt);
      return;
    }

    if (d.jumpVy) {
      this.jumpT -= dt;
      if (this.grounded && chasing && this.jumpT <= 0) {
        this.vy = d.jumpVy;
        this.jumpT = d.jumpEvery;
      }
    }

    if (d.fireEvery) {
      this.fireT -= dt;
      if (chasing && this.fireT <= 0) {
        this.dir = dx >= 0 ? 1 : -1;
        Attacks.fireHostile(this.x + this.w / 2, this.y + 12, this.dir);
        this.fireT = d.fireEvery;
      }
    }

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
    const img = images[this.def.sprite];
    const sx = Math.round(this.x + this.w / 2 - 24 - camX);
    const sy = Math.round(this.y + this.h - 48 - camY);
    ctx.save();
    if (this.dir > 0) {
      ctx.translate(sx + 48, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, 48, 48);
    } else {
      ctx.drawImage(img, sx, sy, 48, 48);
    }
    ctx.restore();
  }
}

// A card on the ground. Falls with gravity until the player touches it.
// cardId is a character id, or "random" to pick one when it is collected.
// A power-up is a gold pickup. It draws one card and then one more.
class CardPickup {
  constructor(cardId, x, y, { power = false, pop = true } = {}) {
    this.cardId = cardId;
    this.power = power;
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

// Places enemies and card pickups for one level, and runs their updates.
const Enemies = (() => {
  let list = [];
  let pickups = [];

  function spawnFromLevel() {
    list = World.enemySpawns.map((s) => new Enemy(s.kind, s.x, s.y));
    pickups = World.pickupSpawns.map(
      (s) => new CardPickup("random", s.x, s.y, { power: s.power, pop: false })
    );
  }

  function dropCard(enemy) {
    const cardId = ENEMY_DEFS[enemy.kind].card;
    pickups.push(new CardPickup(cardId, enemy.x + enemy.w / 2 - 7, enemy.y));
  }

  // Removes an enemy and drops its card. Used by stomps, melee, and arrows.
  function defeat(enemy) {
    if (enemy.dead) return;
    enemy.dead = true;
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
