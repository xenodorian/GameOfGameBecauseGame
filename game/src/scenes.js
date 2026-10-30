// Scenes: the input test screen and the play slice.

// Shows every logical action and lights it while it is held.
class InputTestScene {
  constructor() {
    this.labels = [
      ["left", "Left"],
      ["right", "Right"],
      ["up", "Jump"],
      ["down", "Down"],
      ["ab1", "A / X"],
      ["ab2", "S / Y"],
      ["ab3", "Z / A"],
      ["ab4", "X / B"],
      ["discardSelf", "Q"],
      ["discardCard", "C"],
      ["start", "Enter / Start"],
    ];
    this.flash = {};
  }

  update(dt) {
    for (const [action] of this.labels) {
      if (Input.pressed(action)) this.flash[action] = 0.3;
      else if (this.flash[action] > 0) this.flash[action] -= dt;
    }
    if (menuBack()) Engine.setScene(new TitleScene());
  }

  draw(ctx) {
    ctx.fillStyle = "#1b2430";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px GameFont, system-ui, sans-serif";
    drawText(ctx, "Input check", 16, 28);
    ctx.font = "11px GameFont, system-ui, sans-serif";
    ctx.fillStyle = "#9fb0c0";
    drawText(ctx, "Press each key or button. X or B returns to the title.", 16, 46);

    this.labels.forEach(([action, label], i) => {
      const col = i % 4;
      const row = Math.floor(i / 4);
      const x = 16 + col * 112;
      const y = 66 + row * 42;
      const held = Input.down(action);
      const flashing = (this.flash[action] || 0) > 0;
      ctx.fillStyle = held ? "#d9a441" : flashing ? "#6d8ea8" : "#2a3644";
      ctx.fillRect(x, y, 100, 32);
      ctx.fillStyle = held ? "#111418" : "#e8e4d8";
      ctx.font = "11px GameFont, system-ui, sans-serif";
      drawText(ctx, label, x + 8, y + 20);
    });
  }
}

// Shared menu helpers. Up and Down move the choice, Z or A or Enter confirms,
// X or B or Q backs out.
function menuStep(sel, count) {
  let next = sel;
  if (Input.pressed("up")) next = (sel + count - 1) % count;
  if (Input.pressed("down")) next = (sel + 1) % count;
  return next;
}

function menuConfirm() {
  return Input.pressed("ab3") || Input.pressed("start");
}

function menuBack() {
  return Input.pressed("ab4") || Input.pressed("discardSelf");
}

function drawMenu(ctx, title, items, sel, footer) {
  ctx.fillStyle = "#1b2430";
  ctx.fillRect(0, 0, Engine.W, Engine.H);
  ctx.fillStyle = "#e8e4d8";
  ctx.textAlign = "center";
  ctx.font = "22px GameFont, system-ui, sans-serif";
  drawText(ctx, title, Engine.W / 2, 74);
  ctx.font = "14px GameFont, system-ui, sans-serif";
  items.forEach((label, i) => {
    const y = 120 + i * 30;
    ctx.fillStyle = i === sel ? "#d9a441" : "#e8e4d8";
    drawText(ctx, (i === sel ? "> " : "  ") + label, Engine.W / 2, y);
  });
  ctx.font = "11px GameFont, system-ui, sans-serif";
  ctx.fillStyle = "#9fb0c0";
  drawText(ctx, footer, Engine.W / 2, Engine.H - 16);
  ctx.textAlign = "left";
}

// Title screen: level 1 sky and hills, the five characters walking along the bottom, and the menu.
function drawTitle(ctx, scene) {
  const theme = World.THEMES.field;
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, Engine.W, Engine.H);
  const drift = scene.t * 12;
  drawHills(ctx, drift * 0.25, theme.far, 150, 0.012, 14);
  drawHills(ctx, drift * 0.5, theme.near, 190, 0.02, 20);

  // Walkers, left to right, looping. Each uses its own walk frames.
  const cast = ["knight", "ranger", "mage", "rat", "weaver"];
  cast.forEach((id, i) => {
    const span = Engine.W + 120;
    const x = ((scene.t * 40 + i * 96) % span) - 60;
    const col = Math.floor(scene.t * 8 + i) % 6;
    drawFrame(ctx, IMG[LPC_KEY[id]] || IMG["lpc_" + id], { row: 1, col }, Math.round(x - 32), Engine.H - 96, 1);
  });

  ctx.textAlign = "center";
  ctx.font = "bold 28px GameFont, system-ui, sans-serif";
  ctx.fillStyle = "#f4efe2";
  drawText(ctx, "Changeling", Engine.W / 2, 56);
  ctx.font = "12px GameFont, system-ui, sans-serif";
  ctx.fillStyle = "#e8e4d8";
  drawText(ctx, "Knight of a thousand faces", Engine.W / 2, 74);
  ctx.font = "14px GameFont, system-ui, sans-serif";
  scene.items.forEach((label, i) => {
    const y = 104 + i * 22;
    ctx.fillStyle = i === scene.sel ? "#d9a441" : "#f4efe2";
    drawText(ctx, (i === scene.sel ? "> " : "") + label, Engine.W / 2, y);
  });
  ctx.font = "10px GameFont, system-ui, sans-serif";
  ctx.fillStyle = "#e8e4d8";
  drawText(ctx, "Arrows move   Up jump   A S Z X powers   Enter pause", Engine.W / 2, Engine.H - 8);
  ctx.textAlign = "left";
}

// Title screen: start, input check, credits.
// Save for Continue: the level, character, hand, and run stats, in localStorage.
// Every call is guarded, since storage can be blocked.
const SaveGame = {
  key: "changeling_save",
  save(data) {
    try {
      localStorage.setItem(this.key, JSON.stringify(data));
    } catch (e) {
      /* storage unavailable: no save */
    }
  },
  load() {
    try {
      const raw = localStorage.getItem(this.key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  },
  clear() {
    try {
      localStorage.removeItem(this.key);
    } catch (e) {
      /* storage unavailable */
    }
  },
};

// Stats for the whole run, shown at the end.
const Run = { deaths: 0, secrets: 0, startTime: 0 };

function newRun() {
  Run.deaths = 0;
  Run.secrets = 0;
  Run.startTime = performance.now();
}

// Clears every system a new game touches. Continue does not call it.
function resetGame() {
  Hand.reset();
  newRun();
  Attacks.reset();
  Effects.reset();
  World.load(0);
  Input.clearAll();
}

class TitleScene {
  constructor() {
    const saved = SaveGame.load();
    this.items = saved ? ["Continue", "New game", "Input check", "Credits"] : ["Play", "Input check", "Credits"];
    this.sel = 0;
    this.saved = saved;
    // Clock for the walking characters and the sky drift.
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    this.sel = menuStep(this.sel, this.items.length);
    if (!menuConfirm()) return;
    const choice = this.items[this.sel];
    if (choice === "Continue") {
      Hand.restore(this.saved.cards);
      Object.assign(Run, this.saved.run);
      Engine.setScene(new PlayScene(this.saved.level, this.saved.active));
    } else if (choice === "Play" || choice === "New game") {
      SaveGame.clear();
      resetGame();
      Engine.setScene(new IntroScene());
    } else if (choice === "Input check") {
      Engine.setScene(new InputTestScene());
    } else if (choice === "Credits") {
      Engine.setScene(new CreditsScene());
    }
  }

  draw(ctx) {
    drawTitle(ctx, this);
  }
}

// Credits: sources and licenses for the art and code.
// Ending screen. Shown after the last level. Text is filled in by task F2.
class EndingScene {
  constructor() {
    this.total = 0;
    for (let i = 0; i < World.count; i++) this.total += World.countSecrets(i);
    const secs = Math.floor((performance.now() - Run.startTime) / 1000);
    const mm = String(Math.floor(secs / 60)).padStart(2, "0");
    const ss = String(secs % 60).padStart(2, "0");
    this.stats = "Deaths: " + Run.deaths + "    Secrets: " + Run.secrets + " of " + this.total + "    Time: " + mm + ":" + ss;
    SaveGame.clear();
  }

  update() {
    if (menuConfirm()) Engine.setScene(new CreditsScene());
  }

  draw(ctx) {
    ctx.fillStyle = "#1b2430";
    ctx.fillRect(0, 0, Engine.W, Engine.H);
    ctx.fillStyle = "#e8e4d8";
    ctx.textAlign = "center";
    ctx.font = "14px GameFont, system-ui, sans-serif";
    drawText(ctx, "The Warlord falls. The faces return to their owners.", Engine.W / 2, 80);
    ctx.font = "12px GameFont, system-ui, sans-serif";
    drawText(ctx, this.stats, Engine.W / 2, 116);
    ctx.font = "12px GameFont, system-ui, sans-serif";
    drawText(ctx, "Thanks for playing.", Engine.W / 2, 146);
    ctx.font = "11px GameFont, system-ui, sans-serif";
    drawText(ctx, "Enter: credits", Engine.W / 2, 180);
    ctx.textAlign = "left";
  }
}

// Black screen with three lines shown one at a time, then Enter to begin.
class IntroScene {
  constructor() {
    this.lines = [
      "A warlord has stolen every face in the kingdom.",
      "You are a changeling. Beat a foe and its face is yours.",
      "Take back the faces. Climb to the throne.",
    ];
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (menuConfirm()) {
      if (this.t < this.lines.length * 1.5) this.t = this.lines.length * 1.5;
      else Engine.setScene(new PlayScene(0));
    }
  }

  draw(ctx) {
    ctx.fillStyle = "#000000";
    ctx.fillRect(0, 0, Engine.W, Engine.H);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = "13px GameFont, system-ui, sans-serif";
    this.lines.forEach((line, i) => {
      if (this.t >= i * 1.5 + 0.5) drawText(ctx, line, Engine.W / 2, 90 + i * 34);
    });
    if (this.t >= this.lines.length * 1.5) {
      ctx.font = "11px GameFont, system-ui, sans-serif";
      drawText(ctx, "Enter: begin", Engine.W / 2, 220);
    }
    ctx.textAlign = "left";
  }
}

class CreditsScene {
  update() {
    if (menuBack() || menuConfirm()) Engine.setScene(new TitleScene());
  }

  draw(ctx) {
    ctx.fillStyle = "#1b2430";
    ctx.fillRect(0, 0, Engine.W, Engine.H);
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px GameFont, system-ui, sans-serif";
    drawText(ctx, "Credits", 16, 28);
    ctx.font = "10px GameFont, system-ui, sans-serif";
    const lines = [
      "Character and enemy sprites: Liberated Pixel Cup (LPC) sheets, many authors, CC-BY-SA, GPL, OGA-BY, CC0.",
      "  Full author list and licenses: assets/lpc/CREDITS.txt.",
      "Dungeon Crawl Stone Soup tiles: DCSS team. Mostly CC0; see assets/tiles/LICENSE_DCSS.txt.",
      "Sound and music: ZzFX by Frank Force and ZzFXM by Keith Clark, MIT. Songs written for this game.",
      "Game code and build: this repository.",
      "Design and code: built with Claude Code",
    ];
    lines.forEach((line, i) => drawText(ctx, line, 16, 56 + i * 18));
    ctx.fillStyle = "#9fb0c0";
    drawText(ctx, "Press Z, A, X, or B to return.", 16, Engine.H - 16);
  }
}

// Splits text into lines no wider than maxW pixels, at word boundaries.
function wrapText(ctx, text, maxW) {
  const words = text.split(" ");
  const lines = [];
  let line = "";
  for (const w of words) {
    const trial = line ? line + " " + w : w;
    if (ctx.measureText(trial).width > maxW && line) {
      lines.push(line);
      line = w;
    } else {
      line = trial;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Far background ridge. Drawn at a fraction of the camera's x so it scrolls
// slower than the level (parallax). Procedural, so it needs no asset.
function drawHills(ctx, scrollX, color, baseY, freq, amp) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(0, Engine.H);
  for (let x = 0; x <= Engine.W; x += 4) {
    const wx = x + scrollX;
    const y = baseY - Math.sin(wx * freq) * amp - Math.sin(wx * freq * 0.37 + 1.3) * amp * 0.6;
    ctx.lineTo(x, y);
  }
  ctx.lineTo(Engine.W, Engine.H);
  ctx.closePath();
  ctx.fill();
}

// Play slice: walk, jump, stomp, collect cards, die, pick a card, respawn.
// Each character has 10 HP. Hits and spikes take HP. A fall or 0 HP ends the character.
const MAX_HP = 10;
const HIT_DAMAGE = 2;
//
// Modes:
//   play         normal play
//   select       after a death or a discard: pick a hand card to become
//   discardCard  pick a hand card to throw away (game paused)
//   complete     the exit flag was reached
//   pause        the pause menu: resume or back to title
class PlayScene {
  constructor(levelIndex = 0, active = "knight") {
    World.load(levelIndex);
    Music.setTheme(World.level.boss ? "boss" : World.level.theme);
    Attacks.reset();
    // Seconds of play. Idle animation and blinks read it; draw never advances it.
    this.time = 0;
    this.frame = { row: 0, col: 0 };
    this.hitstopT = 0;
    this.cooldowns = [0, 0, 0, 0];
    this.abBuf = [0, 0, 0, 0];
    this.images = {
      wall: IMG.wall,
      grass: IMG.grass,
      dirt: IMG.dirt,
      tree: IMG.tree,
    };
    this.cam = { x: 0, y: 0 };
    this.active = active;
    this.mode = "play";
    this.reason = "";
    this.sel = 0;
    this.deathPos = { x: 0, y: 0 };
    this.downActive = false;
    this.downTime = 0;
    this.downFired = false;
    this.dashT = 0;
    this.dashGraceT = 0;
    this.lungeT = 0;
    this.hp = MAX_HP;
    this.hpInvT = 0;
    this.floatT = 0;
    this.scurryT = 0;
    this.ghostT = 0;
    this.hurtShowT = 0;
    this.sparkleT = 0;
    this.pauseSel = 0;
    this.flashT = 0;
    this.secretsFound = 0;
    this.secretsTotal = World.countSecrets(World.index);
    this.bannerT = 2.5;
    this.player = this.newBody(World.spawn.x, World.spawn.y);
    Enemies.spawnFromLevel();
    if (World.index >= 1) SaveGame.save({ level: World.index, active: this.active, cards: Hand.serialize(), run: { ...Run } });
  }

  newBody(x, y) {
    return {
      x, y, w: 18, h: 30, vx: 0, vy: 0, grounded: false, facing: 1, jumping: false, hopUsed: false,
      // Animation: time in the current action, the action name, distance walked, and landing time left.
      animT: 0, action: "", walkDist: 0, landT: 0, prevGrounded: false,
    };
  }

  update(dt) {
    if (this.mode !== "pause") this.time += dt;
    if (this.mode === "select") this.updateSelect();
    else if (this.mode === "discardCard") this.updateDiscardCard();
    else if (this.mode === "complete") {
      if (Input.pressed("start")) {
        const more = World.index + 1 < World.count;
        Engine.setScene(more ? new PlayScene(World.index + 1, this.active) : new EndingScene());
      }
    } else if (this.mode === "dying") this.updateDying(dt);
    else if (this.mode === "pause") this.updatePause();
    else this.updatePlay(dt);
  }

  updatePlay(dt) {
    if (Input.pressed("start")) {
      this.mode = "pause";
      this.pauseSel = 0;
      return;
    }
    // Hit stop: the world freezes for a moment when an attack lands. Draw still runs.
    if (this.hitstopT > 0) {
      this.hitstopT -= dt;
      return;
    }
    this.handleDiscardKeys(dt);
    if (this.mode !== "play") return;

    const p = this.player;
    const move = (Input.down("right") ? 1 : 0) - (Input.down("left") ? 1 : 0);

    if (move !== 0) p.facing = move;
    // Rat scurry: faster walking for a short time.
    if (this.scurryT > 0) this.scurryT -= dt;
    p.vx = move * (this.scurryT > 0 ? 220 : 130);
    if (this.dashT > 0) {
      this.dashT -= dt;
      if (this.dashT <= 0) this.dashGraceT = 0.15;
      p.vx = p.facing * 320;
    }
    // A stab lunges forward a short way, one motion with the thrust frames.
    if (this.lungeT > 0) {
      this.lungeT -= dt;
      p.vx = p.facing * 210;
    }

    if (p.grounded) {
      p.hopUsed = false;
      p.coyoteT = 0.08;
    } else if (p.coyoteT > 0) {
      p.coyoteT -= dt;
    }
    // Coyote time and the jump buffer: a jump pressed just before landing, or just after leaving a ledge, still counts.
    if (Input.pressed("up")) p.jumpBufT = 0.1;
    if (p.jumpBufT > 0) p.jumpBufT -= dt;
    if (p.jumpBufT > 0 && (p.grounded || p.coyoteT > 0)) {
      p.vy = -340;
      Sfx.play("jump");
      p.jumping = true;
      p.jumpBufT = 0;
      p.coyoteT = 0;
    }
    // Releasing jump early cuts the arc short.
    if (p.jumping && !Input.down("up") && p.vy < 0) {
      p.vy *= 0.5;
      p.jumping = false;
    }

    // Abilities 1 to 4 fire the active character's ability in that slot.
    // A press during a cooldown is kept for 0.1 s and fires when the cooldown ends.
    const abilities = CHARACTERS[this.active].abilities;
    for (let i = 0; i < abilities.length; i++) {
      this.cooldowns[i] = Math.max(0, this.cooldowns[i] - dt);
      if (this.abBuf[i] > 0) this.abBuf[i] -= dt;
      if (Input.pressed("ab" + (i + 1))) this.abBuf[i] = 0.1;
      if (this.abBuf[i] > 0 && this.cooldowns[i] <= 0) {
        this.abBuf[i] = 0;
        Attacks.use(abilities[i], this);
        startAction(p, abilities[i]);
        this.cooldowns[i] = Attacks.COOLDOWN[abilities[i]] || 0;
      }
    }

    // Float: hold Up to climb at 120 px/s. Without Up, the fall is slowed.
    if (this.floatT > 0) {
      this.floatT -= dt;
      p.vy = Input.down("up") ? -120 : Math.min(p.vy + 200 * dt, 40);
      // Float sparkles: two purple motes under the feet every 0.05 s.
      this.sparkleT += dt;
      if (this.sparkleT >= 0.05) {
        this.sparkleT = 0;
        Effects.dust(p.x + p.w / 2 - 3, p.y + p.h, "#b9a2f0", 2, 1, 0.3, -30);
      }
    } else {
      p.vy = Math.min(p.vy + 900 * dt, 600);
    }
    const prevBottom = p.y + p.h;
    // A charge breaks cracked walls it runs into.
    if (this.dashT > 0) World.breakCracked(p.facing > 0 ? p.x + p.w : p.x - 6, p.y, 6, p.h);
    const fallSpeed = p.vy;
    World.moveBody(p, dt);
    // A hard landing shows the land frame for a moment.
    if (p.grounded && !p.prevGrounded && fallSpeed > 250) {
      p.landT = 0.08;
      Effects.dust(p.x + p.w / 2, p.y + p.h, "#8a7a66", 5, 2, 0.3);
    }
    p.prevGrounded = p.grounded;
    // Spikes hurt: the bottom of the body touching one takes damage and bounces the player up.
    if (World.overlapping(p.x + 2, p.y + p.h - 8, p.w - 4, 8).some((c) => c.ch === "^")) {
      this.takeDamage(HIT_DAMAGE);
      if (this.mode !== "play") return;
      p.vy = -260;
    }

    // A charge bowls through: a box in front of the knight defeats each enemy it touches.
    if (this.dashGraceT > 0) this.dashGraceT -= dt;
    if (this.dashT > 0) {
      const box = { x: p.facing > 0 ? p.x + p.w - 4 : p.x - 14, y: p.y, w: 18, h: p.h };
      for (const enemy of Enemies.list()) {
        if (enemy.dead || !this.overlaps(box, enemy)) continue;
        Effects.spark(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, p.facing);
        Enemies.defeat(enemy, p.x + p.w / 2);
        this.hitstopT = 0.05;
      }
    }

    for (const enemy of Enemies.list()) {
      if (enemy.dead) continue;
      enemy.update(dt, p);
    }
    Attacks.update(dt);
    if (Attacks.consumeHit()) this.hitstopT = 0.05;
    World.updatePlatforms(dt);
    if (this.ghostT > 0) this.ghostT -= dt;
    if (this.bannerT > 0) this.bannerT -= dt;
    if (this.flashT > 0) this.flashT -= dt;
    if (this.hpInvT > 0) this.hpInvT -= dt;
    Effects.update(dt);
    this.updateAnimation(dt);
    this.checkEnemyContact(p, prevBottom);
    if (this.mode !== "play") return;
    if (this.ghostT <= 0 && Attacks.hitByHostile(p)) {
      this.takeDamage(HIT_DAMAGE);
      if (this.mode !== "play") return;
    }

    for (const pickup of Enemies.pickups()) {
      pickup.update(dt);
      if (pickup.state === "ground" && this.overlaps(p, pickup)) {
        this.startCollect(pickup);
      }
      if (pickup.state === "flying") {
        pickup.t += dt;
        if (pickup.t >= 0.3) {
          Hand.collect(pickup.cardId);
          Sfx.play("pickup");
          if (pickup.secret) {
            Run.secrets += 1;
            this.secretsFound += 1;
          }
          // A power-up also draws one more random card.
          if (pickup.power) Hand.collect(Object.keys(CARD_DEFS)[Math.floor(Math.random() * Object.keys(CARD_DEFS).length)]);
          pickup.state = "done";
        }
      }
    }
    Enemies.cleanup();

    // Camera eases toward the player and stays inside the level.
    const targetX = p.x + p.w / 2 - Engine.W / 2;
    const targetY = p.y + p.h / 2 - Engine.H / 2;
    this.cam.x += (targetX - this.cam.x) * 0.15;
    this.cam.y += (targetY - this.cam.y) * 0.15;
    this.cam.x = Math.max(0, Math.min(this.cam.x, World.width - Engine.W));
    this.cam.y = Math.max(0, Math.min(this.cam.y, World.height - Engine.H));

    if (p.y > World.height) this.beginSelection("fell");

    // Standing at a sign shows its text.
    this.signText = "";
    for (const sg of World.signs) {
      if (this.overlaps(p, sg)) this.signText = sg.text;
    }

    // A boss level keeps the exit closed while a warlord is alive.
    const bossLocked = World.level.boss && Enemies.list().some((e) => e.kind === "warlord" && !e.dead);
    World.setFlagOpen(!bossLocked);
    const exit = World.exit();
    if (exit && this.mode === "play" && !bossLocked && this.overlaps(p, exit)) {
      this.mode = "complete";
      Sfx.play("complete");
    }
  }

  updatePause() {
    this.pauseSel = menuStep(this.pauseSel, 4);
    if (menuBack()) this.mode = "play";
    if (menuConfirm()) {
      if (this.pauseSel === 0) this.mode = "play";
      else if (this.pauseSel === 1) Sfx.enabled = !Sfx.enabled;
      else if (this.pauseSel === 2) Music.toggle();
      else Engine.setScene(new TitleScene());
    }
  }

  // Hold Down for 0.5 s to discard the current character.
  // A quick Down tap, or C, opens discard-card mode. The press edge starts
  // the timer, so a tap shorter than one step still counts.
  handleDiscardKeys(dt) {
    if (Input.pressed("down")) {
      this.downActive = true;
      this.downTime = 0;
      this.downFired = false;
    }
    if (this.downActive) {
      if (Input.down("down")) {
        this.downTime += dt;
        if (!this.downFired && this.downTime >= 0.5) {
          this.downFired = true;
          this.downActive = false;
          this.beginSelection("discarded");
          return;
        }
      } else {
        if (!this.downFired) this.openDiscardCard();
        this.downActive = false;
      }
    }
    if (Input.pressed("discardCard")) this.openDiscardCard();
    if (Input.pressed("discardSelf")) {
      this.beginSelection("discarded");
      return;
    }
  }

  openDiscardCard() {
    this.mode = "discardCard";
    this.sel = this.firstOccupied();
  }

  overlaps(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  // A stomp needs the player falling and above the enemy's top on the last step.
  checkEnemyContact(p, prevBottom) {
    // Right after a respawn the player is safe for one second.
    if (this.flashT > 0) return;
    // A charge makes the knight immune to contact while it lasts, plus 0.15 s.
    if (this.dashT > 0 || this.dashGraceT > 0) return;
    for (const enemy of Enemies.list()) {
      if (enemy.dead || !this.overlaps(p, enemy)) continue;
      const stomp = p.vy > 0 && prevBottom <= enemy.y + 6;
      if (stomp) {
        Enemies.defeat(enemy, p.x + p.w / 2);
        p.vy = -260;
      } else if (this.ghostT <= 0 && enemy.stunT <= 0) {
        this.takeDamage(HIT_DAMAGE);
        return;
      }
    }
  }

  // A hit takes HP and gives a second of safety with a short knockback. At 0 HP the character is lost.
  takeDamage(amount) {
    if (this.hpInvT > 0 || this.flashT > 0 || this.mode !== "play") return;
    this.hp = Math.max(0, this.hp - amount);
    this.hpInvT = 1.0;
    this.player.vy = -200;
    this.player.vx = -this.player.facing * 120;
    Sfx.play("hurt");
    Effects.shake(0.1, 1);
    if (this.hp <= 0) this.beginSelection("slain");
  }

  // Death or discard: the current character is lost. The player picks a
  // hand card to become. With an empty hand, the Knight returns.
  beginSelection(reason) {
    this.reason = reason;
    Sfx.play("hurt");
    if (reason !== "discarded") Run.deaths += 1;
    this.deathPos = { x: this.player.x, y: this.player.y };
    if (Hand.slots().every((c) => c === null)) {
      this.respawn("knight");
      return;
    }
    if (reason === "discarded" || reason === "fell") {
      this.openSelection();
      return;
    }
    // A hit shows the hurt pose for 0.15 s before the choice opens.
    this.mode = "dying";
    this.hurtShowT = 0.15;
  }

  // Discards and falls open the choice at once. A hit shows the hurt pose first (see beginSelection).
  openSelection() {
    this.mode = "select";
    this.sel = this.firstOccupied();
  }

  // Counts down the hurt pose, then opens the choice.
  updateDying(dt) {
    this.hurtShowT -= dt;
    if (this.hurtShowT <= 0) this.openSelection();
  }

  updateSelect() {
    const dir = (Input.pressed("right") ? 1 : 0) - (Input.pressed("left") ? 1 : 0);
    if (dir) this.sel = this.nextOccupied(this.sel, dir);
    if (Input.pressed("ab3")) {
      const cardId = Hand.discard(this.sel);
      this.respawn(cardId);
    }
  }

  updateDiscardCard() {
    const dir = (Input.pressed("right") ? 1 : 0) - (Input.pressed("left") ? 1 : 0);
    if (dir) this.sel = this.nextOccupied(this.sel, dir);
    if (Input.pressed("discardCard") || Input.pressed("down")) {
      if (Hand.get(this.sel)) {
        Hand.discard(this.sel);
        this.mode = "play";
        this.sel = this.firstOccupied();
      }
    }
    if (Input.pressed("ab4")) this.mode = "play";
  }

  respawn(cardId) {
    const spot = World.closestSafeSpace(this.deathPos.x, this.deathPos.y, 18, 30, Enemies.list());
    this.player = this.newBody(spot.x, spot.y);
    this.active = cardId;
    this.mode = "play";
    this.dashT = 0;
    this.dashGraceT = 0;
    this.hp = MAX_HP;
    this.hpInvT = 0;
    this.floatT = 0;
    this.scurryT = 0;
    this.ghostT = 0;
    this.hurtShowT = 0;
    this.sparkleT = 0;
    this.hitstopT = 0;
    this.cooldowns = [0, 0, 0, 0];
    this.abBuf = [0, 0, 0, 0];
    this.flashT = 1.0;
    Attacks.reset();
  }

  firstOccupied() {
    const i = Hand.slots().findIndex((c) => c !== null);
    return i === -1 ? 0 : i;
  }

  // Next filled slot in direction dir (1 or -1). Stays put if none.
  nextOccupied(from, dir) {
    const slots = Hand.slots();
    for (let i = from + dir; i >= 0 && i < slots.length; i += dir) {
      if (slots[i] !== null) return i;
    }
    return from;
  }

  startCollect(pickup) {
    if (pickup.cardId === "random") {
      const ids = Object.keys(CARD_DEFS);
      pickup.cardId = ids[Math.floor(Math.random() * ids.length)];
    }
    pickup.state = "flying";
    pickup.t = 0;
    pickup.screenFrom = { x: pickup.x - this.cam.x, y: pickup.y - this.cam.y };
    pickup.target = this.targetFor(pickup.cardId);
  }

  // Screen position of the hand slot (or the deck box) the card flies into.
  targetFor(cardId) {
    const free = Hand.slots().indexOf(null);
    if (free !== -1) return HUD.slotRect(free);
    return HUD.deckRect();
  }

  draw(ctx) {
    const theme = THEMES[World.level.theme];
    ctx.fillStyle = theme.sky;
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    const cx = Math.round(this.cam.x);
    const cy = Math.round(this.cam.y);
    drawHills(ctx, cx * 0.25, theme.far, 150, 0.012, 14);
    drawHills(ctx, cx * 0.5, theme.near, 190, 0.02, 20);
    World.drawParallax(ctx, cx);
    World.draw(ctx, this.images, cx, cy, Engine.W, Engine.H);
    // Screen shake after a warlord hit (the engine resets the transform each frame).
    if (Effects.shakeT > 0) ctx.translate(Effects.shakeX, Effects.shakeY);
    World.drawSigns(ctx, cx, cy);
    World.drawPlatforms(ctx, cx, cy);
    // Same modes as before (play and dying). The banner now draws under the sprites.
    if (this.mode === "play" || this.mode === "dying") this.drawBanner2(ctx);
    Attacks.draw(ctx, cx, cy);

    for (const enemy of Enemies.list()) {
      if (!enemy.dead) enemy.draw(ctx, this.images, cx, cy);
    }
    Effects.draw(ctx, cx, cy);
    for (const pickup of Enemies.pickups()) {
      if (pickup.state !== "done") pickup.draw(ctx, cx, cy, pickup.target || { x: 0, y: 0 });
    }

    if (this.mode === "play" || this.mode === "discardCard") this.drawBody(ctx, cx, cy);

    if (this.mode === "pause") {
      HUD.draw(ctx, -1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, Engine.W, Engine.H);
      ctx.fillStyle = "#e8e4d8";
      ctx.textAlign = "center";
      ctx.font = "16px GameFont, system-ui, sans-serif";
      drawText(ctx, "Paused", Engine.W / 2, 110);
      ctx.font = "14px GameFont, system-ui, sans-serif";
      ["Resume", "Sound: " + (Sfx.enabled ? "On" : "Off"), "Music: " + (Music.enabled ? "On" : "Off"), "Title screen"].forEach((label, i) => {
        ctx.fillStyle = i === this.pauseSel ? "#d9a441" : "#e8e4d8";
        drawText(ctx, (i === this.pauseSel ? "> " : "  ") + label, Engine.W / 2, 144 + i * 26);
      });
      ctx.textAlign = "left";
    } else if (this.mode === "complete") {
      HUD.draw(ctx, -1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, Engine.W, Engine.H);
      // A centred panel with the result of the level.
      const pw = 240;
      const ph = 110;
      const px = Engine.W / 2 - pw / 2;
      const py = 92;
      ctx.fillStyle = "rgba(10, 12, 18, 0.85)";
      ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = "#cfd6df";
      ctx.strokeRect(px + 0.5, py + 0.5, pw - 1, ph - 1);
      ctx.fillStyle = "#f4efe2";
      ctx.textAlign = "center";
      ctx.font = "bold 16px GameFont, system-ui, sans-serif";
      drawText(ctx, "Level complete", Engine.W / 2, py + 26);
      ctx.font = "12px GameFont, system-ui, sans-serif";
      drawText(ctx, World.level.name, Engine.W / 2, py + 46);
      ctx.font = "11px GameFont, system-ui, sans-serif";
      drawText(ctx, "Secrets found: " + this.secretsFound + " of " + this.secretsTotal, Engine.W / 2, py + 68);
      const more = World.index + 1 < World.count;
      drawText(ctx, more ? "Enter: next level" : "Enter: continue", Engine.W / 2, py + 92);
      ctx.textAlign = "left";
    } else if (this.mode === "discardCard") {
      HUD.draw(ctx, this.sel);
      this.drawBanner(ctx, "Discard: Left/Right to choose. C or Down to discard. X or B to cancel.");
    } else if (this.mode === "select") {
      HUD.draw(ctx, -1);
      this.drawSelect(ctx);
    } else {
      HUD.draw(ctx, -1);
      this.drawSignBox(ctx);
      this.drawAbilityBar(ctx);
      this.drawHp(ctx);
      this.drawBossBar(ctx);
    }
  }

  // Advances the body's animation clock and picks this step's frame. Draw only reads it.
  updateAnimation(dt) {
    const p = this.player;
    if (p.action) {
      p.animT += dt;
      if (p.animT > ACTION_LENGTH[p.action] && !p.holdPose) p.action = "";
    }
    if (p.landT > 0) p.landT -= dt;
    if (p.grounded) p.walkDist += Math.abs(p.vx) * dt;
    this.frame = pickFrame(p, this.time);
  }

  drawBody(ctx, cx, cy) {
    // Flash after a respawn: skip every other 0.1 s.
    if (this.flashT > 0 && Math.floor(this.flashT / 0.1) % 2 === 0) return;
    // Hit flicker: skip every other 0.1 s while the hit safety lasts.
    if (this.hpInvT > 0 && this.mode === "play" && Math.floor(this.hpInvT / 0.1) % 2 === 0) return;
    const p = this.player;
    const sheet = IMG[LPC_KEY[this.active]];
    // The big 192 px sheet lets weapons reach out past the 64 px body. Its body sits in the centre.
    const big = IMG[LPC_KEY[this.active] + "_big"];
    const size = big ? 192 : 64;
    const pad = (size - 64) / 2;
    // The cell is centred on the body and its bottom sits on the feet.
    const sx = Math.round(p.x + p.w / 2 - 32 - pad - cx);
    // The lowest drawn pixel (row 127 of a big cell, row 62 of a 64 px cell) sits 3 px into the hitbox bottom,
    // because the grass texture starts about 3 px below the tile edge.
    const sy = Math.round(p.y + p.h - (big ? 124 : 59) - cy);
    ctx.save();
    const frame = this.mode === "dying" ? { row: ANIM_ROWS.hurt[0], col: 0 } : this.frame;
    if (this.ghostT > 0) {
      // Ghost outline: a cyan copy of the frame, one pixel out in four directions. It blinks every 0.05 s.
      if (Math.floor(this.time * 20) % 2 === 0) {
        const g = GhostCanvas.getContext("2d");
        g.clearRect(0, 0, size, size);
        g.drawImage(big || sheet, frame.col * size, frame.row * size, size, size, 0, 0, size, size);
        g.globalCompositeOperation = "source-atop";
        g.fillStyle = "#6fe3ff";
        g.fillRect(0, 0, size, size);
        g.globalCompositeOperation = "source-over";
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          drawFrame(ctx, GhostCanvas, { row: 0, col: 0 }, sx + dx, sy + dy, p.facing, size);
        }
      }
      // The body itself is drawn faded while the ghost ability lasts.
      ctx.globalAlpha = 0.5;
    }
    // Melee swings leave the weapon's afterimage behind the body (see drawWeaponTrail).
    const weapon = IMG[LPC_KEY[this.active] + "_weapon_big"];
    // Only slashes leave an afterimage. A stab would show as repeated stabs.
    if (weapon && big && this.mode !== "dying" && p.action === "slash") {
      drawWeaponTrail(ctx, weapon, frame.row, frame.col, 0, sx, sy, p.facing);
    }
    drawFrame(ctx, big || sheet, frame, sx, sy, p.facing, size);
    ctx.restore();
  }

  // HP as ten small pips under the character name.
  drawHp(ctx) {
    const x0 = 52;
    const y = 26;
    for (let i = 0; i < MAX_HP; i++) {
      ctx.fillStyle = i < this.hp ? "#e0493c" : "rgba(40, 30, 30, 0.6)";
      ctx.fillRect(x0 + i * 6, y, 4, 6);
    }
  }

  // Level name for the first 2.5 seconds, fading out over the last 0.5.
  drawBanner2(ctx) {
    if (this.bannerT <= 0) return;
    ctx.globalAlpha = Math.min(1, this.bannerT / 0.5);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(120, 80, 240, 30);
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "14px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    drawText(ctx, "Level " + (World.index + 1) + ": " + World.level.name, Engine.W / 2, 100);
    ctx.textAlign = "left";
    ctx.globalAlpha = 1;
  }

  // Health bar for the warlord while it is alive: 8 segments and a label.
  drawBossBar(ctx) {
    const boss = Enemies.list().find((e) => e.kind === "warlord" && !e.dead);
    if (!boss) return;
    const max = ENEMY_DEFS.warlord.hp;
    ctx.font = "10px GameFont, system-ui, sans-serif";
    ctx.fillStyle = "#e8e4d8";
    drawText(ctx, "Warlord", 150, 58);
    for (let i = 0; i < max; i++) {
      ctx.fillStyle = i < boss.hp ? "#c2452d" : "#3a2020";
      ctx.fillRect(210 + i * 14, 50, 12, 10);
    }
  }

  // Strip above the hand HUD: the active character's four abilities on A, S, Z, X.
  drawAbilityBar(ctx) {
    HUD.drawAbilities(ctx, this);
  }

  // Box across the top of the screen with the text of the sign under the player.
  drawSignBox(ctx) {
    if (!this.signText) return;
    ctx.fillStyle = "rgba(0, 0, 0, 0.75)";
    // Under the level banner, so neither the HUD nor the banner is covered.
    ctx.fillRect(40, 118, 400, 40);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    const lines = wrapText(ctx, this.signText, 380);
    lines.forEach((line, i) => drawText(ctx, line, Engine.W / 2, 134 + i * 14));
    ctx.textAlign = "left";
  }

  drawBanner(ctx, text) {
    ctx.font = "11px GameFont, system-ui, sans-serif";
    const w = Math.ceil(ctx.measureText(text).width) + 12;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(8, 8, w, 22);
    ctx.fillStyle = "#e8e4d8";
    drawText(ctx, text, 14, 22);
  }

  drawSelect(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    const title = this.reason === "fell" ? "You fell." : this.reason === "discarded" ? "Discarded." : "You were slain.";
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    drawText(ctx, title, Engine.W / 2, 70);
    ctx.font = "11px GameFont, system-ui, sans-serif";
    drawText(ctx, "Choose a card to become. Left/Right to choose, Z or A to confirm.", Engine.W / 2, 90);
    ctx.textAlign = "left";

    // Three cards, 116 px wide with 12 px gaps. The highlighted card lifts 4 px and gets a gold border.
    Hand.slots().forEach((cardId, i) => {
      const x = Engine.W / 2 - 186 + i * 128;
      const lift = i === this.sel ? 4 : 0;
      const y = 104 - lift;
      const w = 116;
      const h = 140;
      if (cardId) {
        ctx.fillStyle = CARD_DEFS[cardId].color;
        ctx.fillRect(x, y, w, h);
        ctx.fillStyle = "rgba(0, 0, 0, 0.25)";
        ctx.fillRect(x, y, w, h);
        // The idle frame of the character, cropped to the figure and drawn at 1.25x.
        ctx.drawImage(IMG[LPC_KEY[cardId]], 16, 8, 32, 56, x + (w - 40) / 2, y + 6, 40, 70);
        ctx.textAlign = "center";
        ctx.fillStyle = "#f4efe2";
        ctx.font = "bold 12px GameFont, system-ui, sans-serif";
        drawText(ctx, CARD_DEFS[cardId].name, x + w / 2, y + 90);
        ctx.font = "10px GameFont, system-ui, sans-serif";
        CHARACTERS[cardId].abilities.forEach((id, k) => {
          drawText(ctx, ABILITY_NAMES[id], x + w / 2, y + 104 + k * 11);
        });
        ctx.textAlign = "left";
      } else {
        ctx.fillStyle = "#2a3644";
        ctx.fillRect(x, y, w, h);
        ctx.setLineDash([3, 3]);
        ctx.strokeStyle = "#9fb0c0";
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
        ctx.setLineDash([]);
      }
      if (i === this.sel) {
        ctx.strokeStyle = "#d9a441";
        ctx.lineWidth = 2;
        ctx.strokeRect(x - 1, y - 1, w + 2, h + 2);
        ctx.lineWidth = 1;
      } else if (cardId) {
        ctx.strokeStyle = "#111418";
        ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
      }
    });
  }
}

// Bottom HUD: three hand slots and the deck count. Deck contents stay hidden.
// Rounded rectangle path. Uses arcTo so older browsers can draw it.
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// Head-up display: character panel and hand at the top left, deck, secrets at the top right,
// and the ability bar at the bottom centre. Every element reads the scene; none changes it.
const HUD = (() => {
  const SLOT_W = 30;
  const SLOT_H = 40;
  const SLOT_GAP = 4;
  const X0 = 150;
  const Y = 6;

  function slotRect(i) {
    return { x: X0 + i * (SLOT_W + SLOT_GAP), y: Y, w: SLOT_W, h: SLOT_H };
  }

  function deckRect() {
    return { x: X0 + Hand.SLOTS * (SLOT_W + SLOT_GAP) + 6, y: Y + 8, w: 18, h: 24 };
  }

  // Idle frame of a character, from its atlas.
  function idleIcon(ctx, cardId, x, y, size) {
    // The figure fills the middle of the 64 px idle cell, so crop to it.
    ctx.drawImage(IMG[LPC_KEY[cardId]], 16, 8, 32, 56, x, y, size * 32 / 56, size);
  }

  // Top-left panel: the active character, its name, and a small secrets count at the top right.
  function drawPanel(ctx, scene) {
    const color = CARD_DEFS[scene.active].color;
    roundRect(ctx, 6, 6, 40, 40, 4);
    ctx.fillStyle = "rgba(10, 12, 18, 0.7)";
    ctx.fill();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.stroke();
    idleIcon(ctx, scene.active, 10, 10, 32);
    ctx.font = "bold 11px GameFont, system-ui, sans-serif";
    ctx.fillStyle = "#f4efe2";
    drawText(ctx, CHARACTERS[scene.active].name, 52, 24);
  }

  // Hand: three slots. Each shows the character icon, or a dashed outline when empty.
  function drawHand(ctx, highlight) {
    Hand.slots().forEach((cardId, i) => {
      const r = slotRect(i);
      const lift = i === highlight ? 3 : 0;
      const y = r.y - lift;
      roundRect(ctx, r.x, y, r.w, r.h, 4);
      if (cardId) {
        ctx.fillStyle = CARD_DEFS[cardId].color;
        ctx.fill();
        ctx.fillStyle = "rgba(0, 0, 0, 0.3)";
        ctx.fill();
        ctx.strokeStyle = "rgba(230, 235, 240, 0.6)";
        ctx.lineWidth = 1;
        ctx.stroke();
        idleIcon(ctx, cardId, r.x + 1, y + 6, 28);
      } else {
        ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
        ctx.fill();
        ctx.setLineDash([2, 2]);
        ctx.strokeStyle = "#9fb0c0";
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      if (i === highlight) {
        roundRect(ctx, r.x - 1, y - 1, r.w + 2, r.h + 2, 5);
        ctx.strokeStyle = "#d9a441";
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.lineWidth = 1;
      }
    });
  }

  // Deck: three offset card backs and the count on top.
  function drawDeck(ctx) {
    const d = deckRect();
    for (let k = 2; k >= 0; k--) {
      roundRect(ctx, d.x + k * 2, d.y + (2 - k) * 2, d.w, d.h, 3);
      ctx.fillStyle = k === 0 ? "#4a4262" : "#332d46";
      ctx.fill();
      ctx.strokeStyle = "#9fb0c0";
      ctx.stroke();
    }
    ctx.font = "bold 11px GameFont, system-ui, sans-serif";
    ctx.fillStyle = "#f4efe2";
    drawText(ctx, String(Hand.deckCount()), d.x + 3, d.y + 16);
  }

  // Secrets: a gold star and the count, top right.
  function drawSecrets(ctx, scene) {
    const right = Engine.W - 10;
    const cx = right - 62;
    const cy = 44;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? 6 : 2.6;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px = cx + Math.cos(a) * rad;
      const py = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = "#d9a441";
    ctx.fill();
    ctx.font = "bold 11px GameFont, system-ui, sans-serif";
    ctx.fillStyle = "#f4efe2";
    ctx.textAlign = "right";
    drawText(ctx, "Secrets " + scene.secretsFound + " / " + scene.secretsTotal, right, 48);
    ctx.textAlign = "left";
  }

  // Logical pixels the ability bar must rise to clear the on-screen touch buttons. Zero without touch.
  // Reads the DOM only; it changes no state.
  function abilityLift() {
    try {
      if (!document.body.classList.contains("touch")) return 0;
      const face = document.querySelector("#touch .face");
      const cv = document.getElementById("screen");
      if (!face || !cv) return 0;
      const fr = face.getBoundingClientRect();
      const cr = cv.getBoundingClientRect();
      if (cr.height <= 0) return 0;
      return Math.max(0, ((cr.bottom - fr.top) * Engine.H) / cr.height);
    } catch (e) {
      return 0;
    }
  }

  // Ability bar: four key caps with names, centred, 6 px above the bottom edge.
  // A cap darkens from the bottom while its ability is on cooldown.
  function drawAbilities(ctx, scene) {
    const ids = CHARACTERS[scene.active].abilities;
    const keys = ["A", "S", "Z", "X"];
    ctx.font = "10px GameFont, system-ui, sans-serif";
    const cells = ids.map((id, i) => {
      const label = ABILITY_NAMES[id];
      return { id, i, label, w: 16 + 4 + Math.ceil(ctx.measureText(label).width) + 10 };
    });
    const total = cells.reduce((n, c) => n + c.w, 0) + 12;
    const bottom = Engine.H - 6 - abilityLift();
    const top = bottom - 20;
    ctx.fillStyle = "rgba(10, 12, 18, 0.6)";
    roundRect(ctx, Engine.W / 2 - total / 2, top, total, 20, 4);
    ctx.fill();
    let x = Engine.W / 2 - total / 2 + 6;
    for (const c of cells) {
      const capY = top + 2;
      roundRect(ctx, x, capY, 16, 16, 3);
      ctx.fillStyle = "#3c4452";
      ctx.fill();
      const total_cd = Attacks.COOLDOWN[c.id] || 0;
      const left = total_cd > 0 ? Math.max(0, scene.cooldowns[c.i]) / total_cd : 0;
      if (left > 0) {
        ctx.save();
        roundRect(ctx, x, capY, 16, 16, 3);
        ctx.clip();
        ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
        ctx.fillRect(x, capY + 16 * (1 - left), 16, 16 * left);
        ctx.restore();
      }
      ctx.strokeStyle = "rgba(255, 255, 255, 0.35)";
      ctx.lineWidth = 1;
      roundRect(ctx, x + 0.5, capY + 0.5, 15, 15, 3);
      ctx.stroke();
      ctx.font = "bold 10px GameFont, system-ui, sans-serif";
      ctx.fillStyle = "#f4efe2";
      ctx.textAlign = "center";
      drawText(ctx, keys[c.i], x + 8, capY + 12);
      ctx.textAlign = "left";
      ctx.font = "10px GameFont, system-ui, sans-serif";
      drawText(ctx, c.label, x + 20, top + 14);
      x += c.w;
    }
  }

  // highlight is a slot index to outline (and lift), or -1 for none.
  function draw(ctx, highlight) {
    const scene = Engine.current();
    drawPanel(ctx, scene);
    drawHand(ctx, highlight);
    drawDeck(ctx);
    drawSecrets(ctx, scene);
  }

  return { slotRect, deckRect, draw, drawAbilities, abilityLift };
})();
