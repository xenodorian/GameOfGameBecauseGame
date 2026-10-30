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
    // E1: inside 64 px on the same row it winds up 0.4 s, lunges 0.2 s at 240 px/s, then recovers 0.5 s.
    lunge: { range: 64, windup: 0.4, time: 0.2, speed: 240, recover: 0.5, every: 1.2 },
  },
  mud_revenant: {
    sprite: "mud_revenant",
    w: 24,
    h: 30,
    speed: 28,
    chaseSpeed: 40,
    sight: 110,
    card: "mage",
    // E4: every 3 s it rises for 0.5 s, then lobs a mud blob that lands near the player.
    lob: { every: 3.0, tell: 0.5, vy: -260, gravity: 700 },
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
    // E2: crouches 0.3 s before each hop.
    crouch: 0.3,
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
    // Arrow top at 41 px so its centre is at standing player centre height (feet - 15).
    fireY: 41,
    // E5 phases by hp: 1 (8 to 6) walk, sword swing, arrows; 2 (5 to 3) adds a charge that stuns
    // itself at the arena edge; 3 (2 to 1) adds a jump slam with floor shockwaves, and tells get faster.
    boss: { raise: 0.5, raiseFast: 0.35, swingReach: 56, stamp: 0.6, stampFast: 0.4, chargeSpeed: 270, stun: 1.4, slamVy: -440, waveSpeed: 190, between: 1.1 },
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
    // Round 4 tells. state: "" (walk), "windup", "lunge", "recover". tellT > 0 blinks the sprite white.
    this.state = "";
    this.stateT = 0;
    this.lungeCd = 0;
    this.crouchT = 0;
    this.tellT = 0;
    // The first lob comes soon after the player is seen.
    this.lobT = def.lob ? 1.2 : 0;
  }

  // Jump on a timer while the enemy is on the ground and the player is near.
  tryJump(dt, chasing) {
    const d = this.def;
    this.jumpT -= dt;
    if (this.grounded && chasing && this.jumpT <= 0) {
      // E2: a crouch first, so the hop can be read and dodged.
      if (d.crouch && this.crouchT <= 0) { this.crouchT = d.crouch; this.tellT = d.crouch; return; }
      if (this.crouchT > 0) return;
      this.vy = d.jumpVy;
      this.jumpT = d.jumpEvery;
      Effects.dust(this.x + this.w / 2, this.y + this.h, "#8a7a66", 3, 2, 0.2);
    }
  }

  // Fire a hostile arrow on a timer while the player is lined up.
  tryFire(dt, chasing, dx) {
    const d = this.def;
    this.fireT -= dt;
    // E3: the last 0.4 s before a shot is a visible draw (pose, aim line, blink).
    this.aiming = chasing && this.fireT <= 0.4;
    if (this.aiming) { this.dir = dx >= 0 ? 1 : -1; this.tellT = Math.max(this.tellT, this.fireT); }
    if (chasing && this.fireT <= 0) {
      this.dir = dx >= 0 ? 1 : -1;
      Attacks.fireHostile(this.x + this.w / 2, this.y + (d.fireY || 12), this.dir);
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
    if (this.tellT > 0) this.tellT -= dt;
    if (this.lungeCd > 0) this.lungeCd -= dt;

    if (this.stunT > 0) {
      this.state = "";
      this.crouchT = 0;
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

    if (d.boss) { this.updateBoss(dt, chasing, dx); return; }
    if (d.jumpVy) this.tryJump(dt, chasing);
    if (d.fireEvery) this.tryFire(dt, chasing, dx);
    if (this.crouchT > 0) {
      // Crouching rat king: holds still, then the next tryJump hops.
      this.crouchT -= dt;
      this.vx = 0;
      if (this.crouchT <= 0) {
        this.crouchT = 0;
        this.vy = d.jumpVy;
        this.jumpT = d.jumpEvery;
        Effects.dust(this.x + this.w / 2, this.y + this.h, "#8a7a66", 3, 2, 0.2);
      }
      this.vy = Math.min(this.vy + 900 * dt, 600);
      World.moveBody(this, dt);
      return;
    }
    if (d.lunge && this.updateLunge(dt, chasing, dx, dy)) return;
    if (d.lob && this.updateLob(dt, chasing, dx, player)) return;

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

  // E1 grunt: windup (still, crouched, blinking), lunge (fast dash), recover (still: punish window).
  // Returns true while it owns the movement this step.
  updateLunge(dt, chasing, dx, dy) {
    const L = this.def.lunge;
    if (!this.state) {
      if (!(chasing && this.grounded && this.lungeCd <= 0 && Math.abs(dx) < L.range && Math.abs(dy) < 20)) return false;
      this.state = "windup";
      this.stateT = L.windup;
      this.tellT = L.windup;
      this.dir = dx >= 0 ? 1 : -1;
      Sfx.play("tell");
    }
    this.stateT -= dt;
    if (this.state === "lunge") {
      this.vx = this.dir * L.speed;
      if (Math.random() < 0.5) Effects.dust(this.x + this.w / 2 - this.dir * 8, this.y + this.h, "#8a7a66", 1, 2, 0.2);
    } else this.vx = 0;
    if (this.stateT <= 0) {
      if (this.state === "windup") { this.state = "lunge"; this.stateT = L.time; }
      else if (this.state === "lunge") { this.state = "recover"; this.stateT = L.recover; }
      else { this.state = ""; this.lungeCd = L.every; }
    }
    this.vy = Math.min(this.vy + 900 * dt, 600);
    World.moveBody(this, dt);
    return true;
  }

  // E5 warlord. state: "" (walk and shoot), roar (phase change), raise then swing (sword), stamp then
  // charge (phase 2+), slam (phase 3 jump), recover (punish window). Every tell blinks.
  updateBoss(dt, chasing, dx) {
    const B = this.def.boss;
    const phase = this.hp >= 6 ? 1 : this.hp >= 3 ? 2 : 3;
    if (this.phase === undefined) { this.phase = 1; this.bossCd = 1.0; }
    if (phase !== this.phase) {
      this.phase = phase;
      this.state = "roar"; this.stateT = 0.6; this.tellT = 0.6;
      Effects.shake(0.5, 3); Effects.flash(0.08); Sfx.play("boss");
    }
    if (this.bossCd > 0) this.bossCd -= dt;
    const fast = phase === 3;
    const toward = dx >= 0 ? 1 : -1;
    this.stateT -= dt;
    const before = this.x;
    switch (this.state) {
      case "roar":
      case "recover":
        this.vx = 0;
        if (this.stateT <= 0) this.state = "";
        break;
      case "raise":
        this.vx = 0;
        if (this.stateT <= 0) {
          this.state = "swing"; this.stateT = 0.2;
          const reach = B.swingReach;
          const x = this.dir > 0 ? this.x + this.w - 8 : this.x + 8 - reach;
          Attacks.fireHostile(x, this.y + 4, this.dir, { kind: "swing", w: reach, h: this.h - 4, life: 0.15 });
          Effects.shake(0.1, 2);
          Sfx.play("hit");
        }
        break;
      case "swing":
        this.vx = 0;
        if (this.stateT <= 0) { this.state = "recover"; this.stateT = fast ? 0.35 : 0.55; }
        break;
      case "stamp":
        this.vx = 0;
        if (Math.random() < 0.4) Effects.dust(this.x + this.w / 2 - this.dir * 14, this.y + this.h, "#8a7a66", 2, 2, 0.3, -30);
        if (this.stateT <= 0) { this.state = "charge"; this.stateT = 2.5; }
        break;
      case "charge":
        this.vx = this.dir * B.chargeSpeed;
        if (Math.random() < 0.6) Effects.dust(this.x + this.w / 2 - this.dir * 18, this.y + this.h, "#8a7a66", 1, 2, 0.25);
        break;
      case "slam":
        if (this.grounded && this.vy >= 0 && this.stateT < 0.5) {
          // Landing: shockwaves run along the floor both ways. Jump over them.
          for (const s of [-1, 1]) Attacks.fireHostile(this.x + this.w / 2 - 6 + s * 20, this.y + this.h - 12, s, { kind: "wave", vx: s * B.waveSpeed, w: 12, h: 12, life: 1.6 });
          Effects.shake(0.3, 4);
          Effects.dust(this.x + this.w / 2, this.y + this.h, "#8a7a66", 9, 3, 0.4, -80);
          Sfx.play("boss");
          this.vx = 0;
          this.state = "recover"; this.stateT = 0.6;
        }
        break;
      default: {
        // Walk and shoot, and pick the next attack when ready.
        this.state = "";
        this.dir = toward;
        if (this.def.fireEvery) this.tryFire(dt, chasing, dx);
        this.vx = this.aiming ? 0 : this.dir * (chasing ? this.def.chaseSpeed : this.def.speed);
        if (this.bossCd <= 0 && this.grounded && chasing && !this.aiming) {
          const far = Math.abs(dx);
          if (far < 70) {
            this.state = "raise"; this.stateT = this.tellT = fast ? B.raiseFast : B.raise;
            Sfx.play("tell");
          } else if (phase >= 3 && Math.random() < 0.5) {
            this.state = "slam"; this.stateT = 1.5;
            this.vy = B.slamVy; this.vx = Math.max(-160, Math.min(160, dx / 0.9));
            this.tellT = 0.2;
          } else if (phase >= 2 && far > 90) {
            this.state = "stamp"; this.stateT = this.tellT = fast ? B.stampFast : B.stamp;
            Sfx.play("tell");
          }
          if (this.state) this.bossCd = B.between;
        }
      }
    }
    this.vy = Math.min(this.vy + 900 * dt, 600);
    World.moveBody(this, dt);
    // A charge that hits the arena edge or a wall stuns the warlord: the punish window.
    if (this.state === "charge" && (Math.abs(this.x - before) < 0.5 || this.stateT <= 0)) {
      this.state = "";
      this.stunT = B.stun;
      this.vx = 0;
      Effects.shake(0.3, 3);
      Effects.dust(this.x + this.w / 2 + this.dir * 20, this.y + this.h / 2, "#cfc6b0", 6, 3, 0.4, -40);
      Sfx.play("hit");
    }
  }

  // E4 mud revenant: every few seconds it stops, rises with bubbles, and lobs a blob in an arc
  // timed to land where the player stands.
  updateLob(dt, chasing, dx, player) {
    const L = this.def.lob;
    if (!chasing) return false;
    this.lobT -= dt;
    if (this.lobT > L.tell) return false;
    if (this.tellT <= 0 && this.lobT > 0) this.tellT = this.lobT;
    this.dir = dx >= 0 ? 1 : -1;
    this.vx = 0;
    if (Math.random() < 0.3) Effects.dust(this.x + this.w / 2 + (Math.random() - 0.5) * 16, this.y + this.h - 4, "#6b5a3a", 1, 2, 0.4, -40);
    if (this.lobT <= 0) {
      const flight = (2 * -L.vy) / L.gravity;
      const vx = Math.max(-200, Math.min(200, dx / flight));
      Attacks.fireHostile(this.x + this.w / 2 - 4, this.y + 4, this.dir, { vx, vy: L.vy, gravity: L.gravity, kind: "mud" });
      this.lobT = L.every;
    }
    this.vy = Math.min(this.vy + 900 * dt, 600);
    World.moveBody(this, dt);
    return true;
  }

  draw(ctx, images, camX, camY) {
    const dw = this.def.drawW || 64;
    const dh = this.def.drawH || 64;
    const sx = Math.round(this.x + this.w / 2 - dw / 2 - camX);
    // Feet are on row 62 of a 64 px cell. Drawn 3 px into the hitbox bottom to meet the grass texture.
    const sy = Math.round(this.y + this.h - dh * (59 / 64) - camY);
    // Hurt: the hurt row, a white silhouette. Archers stand and idle. Others walk.
    let frame;
    if (this.hurtT > 0) frame = { row: ANIM_ROWS.hurt[0], col: 0 };
    else if (this.aiming) frame = { row: ANIM_ROWS.shoot[0], col: Math.min(ANIM_ROWS.shoot[1] - 1, 4) };
    else if (this.state === "raise" || this.state === "roar") frame = { row: ANIM_ROWS.slash[0], col: 1 };
    else if (this.state === "swing") frame = { row: ANIM_ROWS.slash[0], col: 4 };
    else if (this.state === "charge") frame = { row: ANIM_ROWS.walk[0], col: 1 + Math.floor(this.animT * 14) % (ANIM_ROWS.walk[1] - 1) };
    else if (this.state === "windup" || this.state === "recover" || this.state === "stamp" || this.crouchT > 0) frame = { row: ANIM_ROWS.idle[0], col: 0 };
    else if (this.def.idle) frame = { row: ANIM_ROWS.idle[0], col: Math.floor(this.animT * 3) % ANIM_ROWS.idle[1] };
    else frame = { row: ANIM_ROWS.walk[0], col: 1 + Math.floor(this.animT * 6) % (ANIM_ROWS.walk[1] - 1) };
    let sheet = IMG["lpc_" + this.kind];
    // F4: the first 0.1 s of a hit draws the frame pure white.
    if (this.hurtT > (this.hurtMax || 0.6) - 0.1) {
      sheet = Effects.tinted(sheet, frame.col, frame.row, "#ffffff");
      frame = { row: 0, col: 0 };
    } else if (this.tellT > 0 && Math.floor(this.tellT / 0.08) % 2 === 0) {
      // Round 4 tell: blink warm white while winding up.
      sheet = Effects.tinted(sheet, frame.col, frame.row, "#fff2c0");
      frame = { row: 0, col: 0 };
    }
    ctx.save();
    // Wind-up and crouch squash about the feet; the lunge stretches forward.
    const squash = this.state === "windup" || this.crouchT > 0 ? 0.12 : 0;
    const lean = this.state === "lunge" ? 0.12 : 0;
    if (squash || lean) {
      const fx0 = Math.round(this.x + this.w / 2 - camX);
      const fy0 = Math.round(this.y + this.h - camY);
      ctx.translate(fx0, fy0);
      ctx.scale(1 + squash + lean, 1 - squash - lean * 0.5);
      ctx.translate(-fx0, -fy0);
    }
    if (this.dir < 0) {
      ctx.translate(sx + dw, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(sheet, frame.col * 64, frame.row * 64, 64, 64, 0, 0, dw, dh);
    } else {
      ctx.drawImage(sheet, frame.col * 64, frame.row * 64, 64, 64, sx, sy, dw, dh);
    }
    ctx.restore();
    // E3: an archer drawing its bow shows a dotted aim line along the arrow's path.
    if (this.aiming) {
      const ay = Math.round(this.y + (this.def.fireY || 12) + 2 - camY);
      const ax = Math.round(this.x + this.w / 2 + this.dir * 10 - camX);
      ctx.fillStyle = "rgba(255, 90, 60, 0.85)";
      const n = Math.floor((0.4 - Math.max(0, this.fireT)) / 0.4 * 14);
      for (let i = 0; i < n; i++) ctx.fillRect(ax + this.dir * i * 6, ay, 3, 1);
    }
    // Stunned: three small stars circle over the head.
    if (this.stunT > 0) {
      const cx = Math.round(this.x + this.w / 2 - camX);
      const cy = Math.round(this.y - 4 - camY);
      for (let i = 0; i < 3; i++) {
        const a = this.animT * 6 + (i * Math.PI * 2) / 3;
        ctx.fillStyle = i === 0 ? "#fff6c0" : "#f2d04a";
        ctx.fillRect(Math.round(cx + Math.cos(a) * 9) - 1, Math.round(cy + Math.sin(a) * 3) - 1, 3, 3);
      }
    }
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
    const def = CARD_DEFS[this.cardId];
    World.drawCardIcon(ctx, sx, sy, this.w, this.h, def && def.color, this.power, this.state === "ground");
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
  // F4: defeated enemies tumble away as a sprite (white for the first frames), then fade.
  corpses: [],
  // F4: red screen-edge flash when the player is hurt.
  hurtT: 0,
  reset() {
    this.corpses.length = 0;
    this.hurtT = 0;
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
  hurt(t) {
    this.hurtT = Math.max(this.hurtT, t);
  },
  // A 64 px frame of sheet filled with one colour (hit flash). Shared scratch canvas, so draw it at once.
  tinted(sheet, col, row, color) {
    if (!this.tintCanvas) { this.tintCanvas = document.createElement("canvas"); this.tintCanvas.width = 64; this.tintCanvas.height = 64; }
    const g = this.tintCanvas.getContext("2d");
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, 64, 64);
    g.drawImage(sheet, col * 64, row * 64, 64, 64, 0, 0, 64, 64);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = color;
    g.fillRect(0, 0, 64, 64);
    g.globalCompositeOperation = "source-over";
    return this.tintCanvas;
  },
  corpse(enemy, fromX) {
    const away = fromX === undefined ? -enemy.dir || 1 : (enemy.x + enemy.w / 2 >= fromX ? 1 : -1);
    this.corpses.push({
      kind: enemy.kind, dir: enemy.dir, dw: enemy.def.drawW || 64, dh: enemy.def.drawH || 64,
      x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h, vx: away * 150, vy: -210, rot: 0, vr: away * 9, t: 0,
    });
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
    for (const c of this.corpses) {
      c.t += dt;
      c.vy += 900 * dt;
      c.x += c.vx * dt;
      c.y += c.vy * dt;
      c.rot += c.vr * dt;
    }
    this.corpses = this.corpses.filter((c) => c.t < 0.45);
    if (this.hurtT > 0) this.hurtT -= dt;
    for (const f of this.flares) f.t += dt;
    this.flares = this.flares.filter((f) => f.t < 0.1);
  },
  draw(ctx, camX, camY) {
    for (const c of this.corpses) {
      const sheet = IMG["lpc_" + c.kind];
      if (!sheet) continue;
      const row = ANIM_ROWS.hurt[0];
      const src = c.t < 0.07 ? this.tinted(sheet, 0, row, "#ffffff") : null;
      ctx.save();
      ctx.globalAlpha = c.t > 0.3 ? 1 - (c.t - 0.3) / 0.15 : 1;
      // Pivot at the sprite's middle (feet sit at 59 of 64 rows).
      ctx.translate(Math.round(c.x - camX), Math.round(c.y - camY - c.dh * 0.45));
      ctx.rotate(c.rot);
      if (c.dir < 0) ctx.scale(-1, 1);
      if (src) ctx.drawImage(src, 0, 0, 64, 64, -c.dw / 2, -c.dh / 2, c.dw, c.dh);
      else ctx.drawImage(sheet, 0, row * 64, 64, 64, -c.dw / 2, -c.dh / 2, c.dw, c.dh);
      ctx.restore();
    }
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
    if (this.hurtT > 0) {
      // Red edges, strongest at the start, in 3 stepped bands so it reads as pixel art.
      const a = Math.min(1, this.hurtT / 0.3);
      for (let i = 0; i < 3; i++) {
        ctx.fillStyle = "rgba(200, 30, 30, " + (0.4 * a * (1 - i / 3)).toFixed(3) + ")";
        const m = 6 + i * 6;
        ctx.fillRect(-4, -4, Engine.W + 8, m);
        ctx.fillRect(-4, Engine.H - m + 4, Engine.W + 8, m);
        ctx.fillRect(-4, -4, m, Engine.H + 8);
        ctx.fillRect(Engine.W - m + 4, -4, m, Engine.H + 8);
      }
    }
  },
};

// Places enemies and card pickups for one level, and runs their updates.
const Enemies = (() => {
  let list = [];
  let pickups = [];
  // Set when an enemy dies this step. The scene reads and clears it (heavier hit stop on kills).
  let killed = false;

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
    killed = true;
    Effects.corpse(enemy, fromX);
    Sfx.play(enemy.kind === "warlord" ? "bossdown" : "hit");
    Effects.burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, CARD_DEFS[ENEMY_DEFS[enemy.kind].card].color);
    dropCard(enemy);
  }

  return {
    spawnFromLevel,
    dropCard,
    defeat,
    list: () => list,
    consumeKill: () => { const k = killed; killed = false; return k; },
    pickups: () => pickups,
    cleanup: () => {
      list = list.filter((e) => !e.dead);
      pickups = pickups.filter((p) => p.state !== "done");
    },
  };
})();
