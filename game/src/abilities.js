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
  spell_bolt: "Beam",
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
  // Mage beam (spell_bolt). One at a time. Phases in seconds: charge, fire, sustain, fade.
  let beam = null;
  // A ranger or weaver shot waiting for its release frame (see releaseShot).
  let pendingShot = null;
  // After the release, the shot pose holds for a short follow-through (shotHold seconds on shotBody).
  let shotHold = 0;
  let shotBody = null;
  const BEAM = { charge: 0.1, grow: 1400, range: 224, end: 0.42, fade: 0.14, half: 4 };
  // Set when an attack hits an enemy this step. The scene reads and clears it (hit stop).
  let hitThisStep = false;
  // Seconds before each ability can fire again.
  const COOLDOWN = {
    slash: 0.18, thrust: 0.28, shield_bash: 0.45, charge: 0.6, shoot: 0.25, spell_bolt: 0.5,
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
    Sfx.play(id === "spell_bolt" ? "beam" : "ability");
    switch (id) {
      case "slash":
        hitboxes.push({ ...faceRect(p, 36, 24, 4), ...fx(p), t: 0.15, total: 0.15, kind: "slash", weapon: weaponHasRow(LPC_KEY[scene.active], ANIM_ROWS.slash[0]) });
        break;
      case "thrust":
        // The stab lunges the knight a short way forward (see the lunge in PlayScene.update).
        scene.lungeT = 0.16;
        hitboxes.push({ ...faceRect(p, 56, 12, 10), ...fx(p), t: 0.15, total: 0.15, kind: "thrust", weapon: weaponHasRow(LPC_KEY[scene.active], ANIM_ROWS.thrust[0]) });
        break;
      case "shield_bash":
        hitboxes.push({ ...faceRect(p, 22, 30, 0), ...fx(p), t: 0.12, total: 0.12, kind: "bash", stun: 1.2 });
        break;
      case "charge":
        scene.dashT = 0.25;
        break;
      case "spell_bolt":
        if (!beam) beam = { body: p, dir: p.facing, t: -0.2, len: 0, hitWall: false, hit: new Set(), seed: 1, motes: [] };
        break;
      case "shoot":
        // The arrow leaves the bowstring on the release frame, not when the key is pressed.
        pendingShot = { t: 0, owner: scene.active, kind: id, scene };
        break;
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
        Effects.spray(p.x + p.w / 2, p.y + p.h / 2, -p.facing, "arcane", 6);
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
        Effects.spark(e.x + e.w / 2, e.y + e.h / 2, hb.dir);
        if (hb.stun) e.stunT = hb.stun;
        else Enemies.defeat(e, hb.x + hb.w / 2);
      });
    }
    for (let i = hitboxes.length - 1; i >= 0; i--) {
      if (hitboxes[i].t <= 0) hitboxes.splice(i, 1);
    }

    if (beam) updateBeam(dt);
    if (pendingShot) {
      pendingShot.t += dt;
      if (pendingShot.t >= SHOT_RELEASE) {
        releaseShot(pendingShot);
        pendingShot = null;
      }
    }
    if (shotBody) {
      // Pin the shoot pose through the follow-through, then let the body go back to idle.
      shotHold -= dt;
      shotBody.holdPose = shotHold > 0;
      if (shotHold > 0) {
        shotBody.action = "shoot";
        shotBody.animT = Math.max(shotBody.animT, ACTION_LENGTH.shoot);
      } else {
        shotBody = null;
      }
    }

    for (const q of projectiles) {
      q.life -= dt;
      q.x += q.vx * dt;
      if (World.overlapping(q.x, q.y, q.w, q.h).some((c) => World.isSolid(c.ch))) {
        // Hitting a wall: a few dust squares in the arrow's colour.
        Effects.dust(q.x, q.y, "#e8e4d8", 3, 2, 0.25);
        q.life = 0;
      }
      for (const e of Enemies.list()) {
        if (!e.dead && overlaps(q, e)) {
          hitThisStep = true;
          Effects.spark(q.x, q.y, q.vx > 0 ? 1 : -1);
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

  // Release frame of the 0.3 s shoot action (frame 9 is 0.1 s in). Measured from ranger_weapon_big.
  const SHOT_RELEASE = 0.1;
  // The bowstring sits 4 px in front of the body centre and spans about 17 px up and down on the release frame.
  // The arrow and its flare start on the string, inside the hitbox so the arrow can hit at the body's height.
  function releaseShot(s) {
    const p = s.scene.player;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h - 32;
    const nock = cx + 4 * p.facing;
    Effects.flare(nock, cy + 8, s.owner === "weaver" ? "bone" : "steel");
    shotBody = p;
    shotHold = 0.25;
    const live = projectiles.filter((q) => q.owner === s.owner).length;
    if (live >= MAX_PROJECTILES) return;
    projectiles.push({
      x: p.facing > 0 ? nock : nock - 8,
      y: cy + 6,
      w: 8,
      h: 4,
      vx: p.facing * 380,
      life: 1.2,
      owner: s.owner,
      kind: s.kind,
    });
  }

  // Staff tip offset from the body centre on each slash frame 0 to 5 (measured from mage_weapon_big).
  // The swing ends pointing forward, so the last frame is the aim point the beam starts from.
  const STAFF_TIP = [[23, 22], [11, 17], [8, 16], [18, 13], [31, -2], [31, -4]];
  // The beam starts at the staff tip on the current swing frame.
  function beamOrigin(b) {
    const p = b.body;
    const cx = p.x + p.w / 2;
    const cy = p.y + p.h - 32;
    const col = p.action === "slash" ? Math.min(5, Math.floor(p.animT / (ACTION_LENGTH.slash / 6))) : 5;
    return { x: cx + b.dir * STAFF_TIP[col][0], y: cy + STAFF_TIP[col][1] };
  }

  // Beam: charge, then the head races out to range or the first wall.
  // Every enemy along it is hit once. Then it breaks up into motes.
  function updateBeam(dt) {
    const b = beam;
    b.t += dt;
    // Hold the swing's end pose while the beam lasts, so the staff stays at the tip the beam starts from.
    b.body.holdPose = b.t < BEAM.end;
    if (b.body.holdPose) {
      b.body.action = "slash";
      b.body.animT = Math.max(b.body.animT, ACTION_LENGTH.slash);
    }
    b.seed = (Math.random() * 1e9) | 0;
    const o = beamOrigin(b);
    if (b.t < BEAM.charge) {
      // Motes spiral in to the staff tip.
      const a = Math.random() * Math.PI * 2;
      b.motes.push({ x: o.x + Math.cos(a) * 14, y: o.y + Math.sin(a) * 14, tx: o.x, ty: o.y, t: 0 });
    } else if (b.t < BEAM.end) {
      if (b.len === 0) {
        Effects.flash(0.05);
        Effects.shake(0.12, 1);
      }
      if (!b.hitWall) {
        const step = 4;
        const target = Math.min(BEAM.range, b.len + BEAM.grow * dt);
        while (b.len < target) {
          const nx = o.x + b.dir * (b.len + step);
          if (World.overlapping(nx - 2, o.y - 2, 4, 4).some((c) => World.isSolid(c.ch))) {
            b.hitWall = true;
            break;
          }
          b.len += step;
        }
      }
      const rect = { x: b.dir > 0 ? o.x : o.x - b.len, y: o.y - BEAM.half - 1, w: b.len, h: BEAM.half * 2 + 2 };
      for (const e of Enemies.list()) {
        if (e.dead || b.hit.has(e) || !overlaps(rect, e)) continue;
        b.hit.add(e);
        hitThisStep = true;
        Effects.spark(e.x + e.w / 2, o.y, b.dir, "arcane");
        Enemies.defeat(e, o.x);
      }
      if (b.hitWall && Math.random() < 0.5) Effects.spray(o.x + b.dir * b.len, o.y, -b.dir, "arcane", 1);
    } else if (b.t < BEAM.end + BEAM.fade) {
      // Rising motes where the beam breaks.
      const d = Math.random() * b.len;
      b.motes.push({ x: o.x + b.dir * d, y: o.y, tx: o.x + b.dir * d, ty: o.y - 14, t: 0 });
    } else {
      b.body.holdPose = false;
      beam = null;
      return;
    }
    for (const m of b.motes) {
      m.t += dt;
      m.x += (m.tx - m.x) * Math.min(1, dt * 12);
      m.y += (m.ty - m.y) * Math.min(1, dt * 12);
    }
    b.motes = b.motes.filter((m) => m.t < 0.25);
  }

  // Set to true to outline the hitboxes, for checking reach.
  const debug = { on: false };
  const DEG = Math.PI / 180;

  // Slash: a smear crescent sweeping from -70 to +50 degrees over the hitbox's life.
  // Only the last 60 degrees are drawn. Bands: faint halo, deep, pale, white core.
  function drawSlash(ctx, hb, cx, cy) {
    const prog = 1 - Math.max(0, hb.t) / hb.total;
    const a = 1 - prog;
    const end = -70 + 120 * prog;
    const start = end - 60;
    const x = hb.ox - cx;
    const y = hb.oy - cy;
    const c = Glow.RAMPS.steel;
    const arc = (r) => {
      ctx.beginPath();
      if (hb.dir > 0) ctx.arc(x, y, r, start * DEG, end * DEG);
      else ctx.arc(x, y, r, (180 - end) * DEG, (180 - start) * DEG);
    };
    ctx.globalAlpha = a * 0.3;
    arc(22); ctx.lineWidth = 8; ctx.strokeStyle = c[3]; ctx.stroke();
    ctx.globalAlpha = a;
    arc(22); ctx.lineWidth = 5; ctx.strokeStyle = c[3]; ctx.stroke();
    arc(22); ctx.lineWidth = 3; ctx.strokeStyle = c[1]; ctx.stroke();
    arc(23); ctx.lineWidth = 1; ctx.strokeStyle = c[0]; ctx.stroke();
    ctx.globalAlpha = 1;
    // Glint on the leading tip for the first half of the swing.
    if (prog < 0.5) {
      const ang = (hb.dir > 0 ? end : 180 - end) * DEG;
      Glow.star(ctx, x + Math.cos(ang) * 22, y + Math.sin(ang) * 22, 4, Math.floor(prog * 8), "steel", a);
    }
  }

  // Thrust: a banded streak along the reach, fading in from the body, with a tip glint.
  function drawThrust(ctx, hb, cx, cy) {
    const prog = 1 - Math.max(0, hb.t) / hb.total;
    const x = Math.round(hb.x - cx);
    const y = Math.round(hb.y - cy + hb.h / 2 - 1.5);
    const c = Glow.RAMPS.steel;
    const streak = (h, color, alpha) => {
      const grad = ctx.createLinearGradient(hb.dir > 0 ? x : x + hb.w, 0, hb.dir > 0 ? x + hb.w : x, 0);
      grad.addColorStop(0, "rgba(255, 255, 255, 0)");
      grad.addColorStop(1, color);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = grad;
      ctx.fillRect(x, y + 1 - Math.floor(h / 2), hb.w, h);
    };
    streak(5, c[3], 0.4 * (1 - prog));
    streak(3, c[2], 0.9);
    streak(1, c[0], 1);
    ctx.globalAlpha = 1;
    const tip = hb.dir > 0 ? x + hb.w : x;
    Glow.star(ctx, tip, y + 1, 4, Math.floor(prog * 8), "steel", 1 - prog);
  }

  // Shield bash: a banded half ring in front of the body, growing and fading.
  function drawBash(ctx, hb, cx, cy) {
    const prog = 1 - Math.max(0, hb.t) / hb.total;
    const x = hb.ox - cx + hb.dir * 6;
    const y = hb.oy - cy + 8;
    const r = 10 + 18 * prog;
    const c = Glow.RAMPS.steel;
    const half = (rr, w, color, alpha) => {
      ctx.beginPath();
      if (hb.dir > 0) ctx.arc(x, y, rr, -90 * DEG, 90 * DEG);
      else ctx.arc(x, y, rr, 90 * DEG, 270 * DEG);
      ctx.lineWidth = w;
      ctx.strokeStyle = color;
      ctx.globalAlpha = alpha;
      ctx.stroke();
    };
    half(r, 6, c[3], 0.3 * (1 - prog));
    half(r, 3, c[2], 1 - prog);
    half(r, 1, c[0], 1 - prog);
    ctx.globalAlpha = 1;
    Glow.light(ctx, x, y, r + 6, c[3], 0.25 * (1 - prog));
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

  // Mage beam. Per column, separate upper and lower half widths with jitter, a
  // wobble, and a pulse that travels out from the staff. Each column is cut into
  // the arcane bands. Lightning, a flare at the staff, and an impact at a wall.
  function drawBeam(ctx, b, cx, cy) {
    const o = beamOrigin(b);
    const ox = Math.round(o.x - cx);
    const oy = Math.round(o.y - cy);
    const rand = Glow.rng(b.seed);
    const c = Glow.RAMPS.arcane;
    const frame = Math.floor(b.t * 60);
    for (const m of b.motes) {
      ctx.fillStyle = m.t < 0.12 ? c[1] : c[3];
      ctx.fillRect(Math.round(m.x - cx), Math.round(m.y - cy), 1, 1);
    }
    if (b.t < BEAM.charge) {
      Glow.disc(ctx, ox, oy, 2 + (Math.max(0, b.t) / BEAM.charge) * 3, "arcane");
      return;
    }
    const fading = b.t >= BEAM.end;
    const f = fading ? (b.t - BEAM.end) / BEAM.fade : 0;
    for (let d = 0; d <= b.len; d += 40) Glow.light(ctx, ox + b.dir * d, oy, 20, c[3], 0.16 * (1 - f));
    for (let d = 0; d < b.len; d++) {
      // Breaking up: random gaps mixed with a slow wave, more of them as it fades.
      if (fading && rand() * 0.7 + 0.3 * Math.sin(d * 0.08 + b.t * 9) < f * 1.2) continue;
      const taper = Math.min(1, (d + 2) / 10);
      const wobble = Math.sin(d * 0.21 + b.t * 30) * 0.6 + Math.sin(d * 0.07 - b.t * 17) * 0.5;
      const pulse = Math.pow(Math.max(0, Math.sin(d * 0.12 - b.t * 40)), 6) * 1.5;
      const base = (BEAM.half + pulse) * taper * (1 - f * 0.6);
      const up = bandsAt(base + wobble * 0.5 + (rand() - 0.5) * 1.2);
      const dn = bandsAt(base - wobble * 0.5 + (rand() - 0.5) * 1.2);
      const x = ox + b.dir * d;
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = c[4];
      ctx.fillRect(x, oy - Math.round(up[4] + 2), 1, Math.round(up[4] + dn[4] + 4));
      ctx.globalAlpha = 1;
      for (let i = 4; i >= 0; i--) {
        const u = Math.round(up[i]);
        const l = Math.round(dn[i]);
        if (u + l < 1) continue;
        ctx.fillStyle = c[i];
        ctx.fillRect(x, oy - u, 1, u + l);
      }
    }
    if (!fading) {
      // Fresh lightning every step, a few with a short branch.
      const n = 2 + Math.floor(rand() * 2);
      for (let k = 0; k < n; k++) {
        const a = rand() * b.len;
        const l = 18 + rand() * 30;
        const side = rand() < 0.5 ? -1 : 1;
        const x0 = ox + b.dir * a;
        const x1 = ox + b.dir * Math.min(b.len, a + l);
        const pts = Glow.bolt(ctx, x0, oy + side * (BEAM.half + 1), x1, oy + side * (BEAM.half + 2 + rand() * 3), "arcane", rand, 7);
        if (rand() < 0.5) {
          const [bx, by] = pts[Math.floor(pts.length / 2)];
          Glow.bolt(ctx, bx, by, bx + b.dir * 8, by + side * (4 + rand() * 4), "arcane", rand, 4, 2);
        }
      }
      // Flare at the staff tip.
      Glow.disc(ctx, ox, oy, 6 + (frame % 4 < 2 ? 1 : 0), "arcane");
      Glow.star(ctx, ox, oy, 8, frame, "arcane");
      if (b.hitWall) {
        // Impact: a pulsing disc and short jagged rays aimed back at the caster.
        const hx = ox + b.dir * b.len;
        Glow.disc(ctx, hx, oy, 5 + (frame % 3), "arcane");
        for (let k = 0; k < 5; k++) {
          const ang = (rand() - 0.5) * 2.2;
          const len = 6 + rand() * 8;
          Glow.bolt(ctx, hx, oy, hx - b.dir * Math.cos(ang) * len, oy + Math.sin(ang) * len, "arcane", rand, 3, 2);
        }
        Glow.light(ctx, hx, oy, 20, c[3], 0.25);
      }
    }
  }

  // Band half widths for one side of a beam column.
  function bandsAt(w) {
    return w <= 0 ? [0, 0, 0, 0, 0] : Glow.bandWidths(w).map((v) => Math.max(0, v - 1.5));
  }

  function draw(ctx, cx, cy) {
    for (const hb of hitboxes) {
      if (debug.on) {
        ctx.strokeStyle = "rgba(255, 0, 0, 0.8)";
        ctx.strokeRect(Math.round(hb.x - cx), Math.round(hb.y - cy), hb.w, hb.h);
      }
      // When the weapon has its own frames, the body draws the blade trail (drawWeaponTrail). Arcs are the fallback.
      if (hb.kind === "slash" && !hb.weapon) drawSlash(ctx, hb, cx, cy);
      else if (hb.kind === "thrust" && !hb.weapon) drawThrust(ctx, hb, cx, cy);
      else if (hb.kind === "bash") drawBash(ctx, hb, cx, cy);
    }
    if (beam) drawBeam(ctx, beam, cx, cy);
    for (const q of projectiles) {
      const dir = q.vx > 0 ? 1 : -1;
      if (q.owner === "weaver") Glow.disc(ctx, q.x - cx + (dir > 0 ? 0 : 14), q.y - cy + 1, 4, "bone", 0.6);
      drawArrow(ctx, Math.round(q.x - cx), Math.round(q.y - cy), dir, "#c8a46a", "#d8d8e0", "#e8e4d8");
    }
    for (const h of hostile) {
      drawArrow(ctx, Math.round(h.x - cx), Math.round(h.y - cy), h.vx > 0 ? 1 : -1, "#5a3a2a", "#d8d8e0", "#c2452d");
    }
  }

  function fireHostile(x, y, dir) {
    Effects.flare(x, y + 2, "ember");
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
    beam = null;
    pendingShot = null;
    shotHold = 0;
    shotBody = null;
  }

  return { use, update, draw, fireHostile, beamActive: () => !!beam, hitByHostile, hostileCount: () => hostile.length, reset, consumeHit, debug, COOLDOWN };
})();
