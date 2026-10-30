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
      ["swap", "D"],
      ["discardCard", "C"],
      ["back", "Esc"],
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

// Title screen: level 1 sky and hills, the four characters walking along the bottom, and the menu.
function drawTitle(ctx, scene) {
  const theme = World.THEMES.field;
  ctx.fillStyle = theme.sky;
  ctx.fillRect(0, 0, Engine.W, Engine.H);
  const drift = scene.t * 12;
  drawHills(ctx, drift * 0.25, theme.far, 150, 0.012, 14);
  drawHills(ctx, drift * 0.5, theme.near, 190, 0.02, 20);

  // Walkers, left to right, looping. Each uses its own walk frames.
  const cast = ["knight", "ranger", "mage", "weaver"];
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
  drawText(ctx, "Arrows move   Up jump   Down drop   A S Z X powers   D cards   Enter pause", Engine.W / 2, Engine.H - 8);
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
    this.t = 0;
  }

  update(dt) {
    this.t += dt;
    if (menuConfirm()) Engine.setScene(new CreditsScene());
  }

  // P1: the intro's title card at dawn. The throne stands empty and the four faces fly out
  // of it into the sky, trailing light. Then the words and the stats.
  draw(ctx) {
    const t = this.t;
    const g = ctx.createLinearGradient(0, 0, 0, Engine.H);
    g.addColorStop(0, "#2a3a6a");
    g.addColorStop(0.55, "#c07a6a");
    g.addColorStop(1, "#f2c27a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Engine.W, Engine.H);
    const cx = Engine.W / 2;
    const sun = ctx.createRadialGradient(cx, 120, 6, cx, 120, 110);
    sun.addColorStop(0, "rgba(255, 240, 190, 0.9)");
    sun.addColorStop(1, "rgba(255, 240, 190, 0)");
    ctx.fillStyle = sun;
    ctx.fillRect(cx - 120, 0, 240, 240);
    ctx.fillStyle = "#1a1424";
    ctx.beginPath();
    ctx.moveTo(0, 170);
    ctx.quadraticCurveTo(cx, 108, Engine.W, 170);
    ctx.lineTo(Engine.W, Engine.H);
    ctx.lineTo(0, Engine.H);
    ctx.fill();
    ctx.fillStyle = "#2a1e36";
    ctx.beginPath();
    ctx.moveTo(cx - 26, 132); ctx.lineTo(cx - 26, 52); ctx.lineTo(cx, 30); ctx.lineTo(cx + 26, 52); ctx.lineTo(cx + 26, 132);
    ctx.fill();
    ctx.fillRect(cx - 34, 84, 8, 48);
    ctx.fillRect(cx + 26, 84, 8, 48);
    const faces = ["knight", "ranger", "mage", "weaver"];
    faces.forEach((id, i) => {
      const k = Math.min(1, Math.max(0, (t - i * 0.25) / 2.2));
      const e = 1 - Math.pow(1 - k, 3);
      const a = -Math.PI / 2 + (i - 2) * 0.55;
      const fx = Math.round(cx + Math.cos(a) * 190 * e);
      const fy = Math.round(90 + Math.sin(a) * 45 * e - 10 * e + Math.sin(t * 2 + i) * 2 * e);
      // A short light trail back toward the throne.
      for (let s2 = 1; s2 <= 4; s2++) {
        const e2 = Math.max(0, e - s2 * 0.04);
        Glow.light(ctx, cx + Math.cos(a) * 190 * e2, 90 + Math.sin(a) * 45 * e2 - 10 * e2, 6, CARD_DEFS[id].color, 0.15);
      }
      ctx.fillStyle = "#f4efe2";
      ctx.fillRect(fx - 9, fy - 12, 18, 24);
      ctx.strokeStyle = CARD_DEFS[id].color;
      ctx.lineWidth = 2;
      ctx.strokeRect(fx - 9, fy - 12, 18, 24);
      ctx.lineWidth = 1;
      const sh = IMG[LPC_KEY[id]];
      if (sh) ctx.drawImage(sh, 22, 10, 20, 26, fx - 7, fy - 10, 14, 18);
    });
    ctx.textAlign = "center";
    const line = (text, y, at, font, color) => {
      const k = Math.max(0, Math.min(1, (t - at) / 0.6));
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.font = font;
      ctx.fillStyle = color;
      drawText(ctx, text, cx, y);
      ctx.globalAlpha = 1;
    };
    line("The Warlord falls. The faces return to their owners.", 186, 1.8, "14px GameFont, system-ui, sans-serif", "#f4efe2");
    line(this.stats, 210, 2.6, "12px GameFont, system-ui, sans-serif", "#f2d04a");
    line("Thanks for playing.", 234, 3.2, "12px GameFont, system-ui, sans-serif", "#f4efe2");
    line("Enter: credits", 258, 3.8, "11px GameFont, system-ui, sans-serif", "#d9c8a0");
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

  // V5 title card: a dusk sky, the warlord as a black silhouette on his hill, and the stolen faces
  // circling him as dark cards with coloured rims. The three lines fade in underneath.
  draw(ctx) {
    const g = ctx.createLinearGradient(0, 0, 0, Engine.H);
    g.addColorStop(0, "#120e1e");
    g.addColorStop(0.6, "#3a2440");
    g.addColorStop(1, "#6a3a3a");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, Engine.W, Engine.H);
    // Hill and throne silhouette.
    ctx.fillStyle = "#0a0810";
    ctx.beginPath();
    ctx.moveTo(0, 170);
    ctx.quadraticCurveTo(Engine.W / 2, 108, Engine.W, 170);
    ctx.lineTo(Engine.W, Engine.H);
    ctx.lineTo(0, Engine.H);
    ctx.fill();
    const cx = Engine.W / 2;
    // A red backlight so the black warlord reads against the throne.
    const glow = ctx.createRadialGradient(cx, 80, 4, cx, 80, 70);
    glow.addColorStop(0, "rgba(220, 70, 50, 0.55)");
    glow.addColorStop(1, "rgba(220, 70, 50, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(cx - 80, 10, 160, 140);
    // Throne: a tall pointed back and two posts, a shade lighter than the hill.
    ctx.fillStyle = "#2a1e36";
    ctx.beginPath();
    ctx.moveTo(cx - 26, 132); ctx.lineTo(cx - 26, 52); ctx.lineTo(cx, 30); ctx.lineTo(cx + 26, 52); ctx.lineTo(cx + 26, 132);
    ctx.fill();
    ctx.fillRect(cx - 34, 84, 8, 48);
    ctx.fillRect(cx + 26, 84, 8, 48);
    const sheet = IMG.lpc_warlord;
    if (sheet) ctx.drawImage(Effects.tinted(sheet, 0, 0, "#05040a"), 0, 0, 64, 64, cx - 48, 32, 96, 96);
    // Stolen faces orbit the throne.
    const faces = ["knight", "ranger", "mage", "weaver"];
    faces.forEach((id, i) => {
      const a = this.t * 0.6 + (i * Math.PI * 2) / faces.length;
      const fx = Math.round(cx + Math.cos(a) * 92);
      const fy = Math.round(78 + Math.sin(a) * 22);
      const front = Math.sin(a) > 0;
      ctx.globalAlpha = front ? 1 : 0.55;
      ctx.fillStyle = "#0d0b14";
      ctx.fillRect(fx - 9, fy - 12, 18, 24);
      ctx.strokeStyle = CARD_DEFS[id].color;
      ctx.strokeRect(fx - 8.5, fy - 11.5, 17, 23);
      const sh = IMG[LPC_KEY[id]];
      if (sh) ctx.drawImage(Effects.tinted(sh, 0, 0, CARD_DEFS[id].color), 22, 10, 20, 26, fx - 7, fy - 10, 14, 18);
      ctx.globalAlpha = 1;
    });
    ctx.textAlign = "center";
    ctx.font = "13px GameFont, system-ui, sans-serif";
    this.lines.forEach((line, i) => {
      const k = Math.max(0, Math.min(1, (this.t - (i * 1.5 + 0.5)) / 0.5));
      if (k <= 0) return;
      ctx.globalAlpha = k;
      ctx.fillStyle = "#f4efe2";
      drawText(ctx, line, Engine.W / 2, 184 + i * 22);
    });
    ctx.globalAlpha = 1;
    if (this.t >= this.lines.length * 1.5) {
      ctx.font = "11px GameFont, system-ui, sans-serif";
      ctx.fillStyle = Math.floor(this.t * 2) % 2 ? "#d9a441" : "#f2d04a";
      drawText(ctx, "Enter: begin", Engine.W / 2, 258);
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
      "Design and code: built with Claude Code and Grok Bot",
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
    // A look with its own song (crypt, hall) plays it; other levels play their theme's song.
    const look = World.visual();
    Music.setTheme(World.level.boss ? "boss" : MUSIC_SONGS[look] ? look : World.level.theme);
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
    this.dashT = 0;
    this.dashGraceT = 0;
    this.lungeT = 0;
    this.hp = MAX_HP;
    this.hpInvT = 0;
    this.floatT = 0;
    this.ghostT = 0;
    this.hurtShowT = 0;
    this.sparkleT = 0;
    this.pauseSel = 0;
    // Face change from the card menu: a short safety window after it.
    this.swapT = 0;
    this.flashT = 0;
    this.secretsFound = 0;
    this.secretsTotal = World.countSecrets(World.index);
    this.bannerT = 2.5;
    this.player = this.newBody(World.spawn.x, World.spawn.y);
    Enemies.spawnFromLevel();
    this.updateCamera(0, true);
    if (World.index >= 1) SaveGame.save({ level: World.index, active: this.active, cards: Hand.serialize(), run: { ...Run } });
  }

  newBody(x, y) {
    return {
      x, y, w: 18, h: 30, vx: 0, vy: 0, grounded: false, facing: 1, jumping: false, hopUsed: false,
      // Ladders: the player stands on ladder tops; climbing is the ladder held, dropT drops through ledges.
      ladderable: true, climbing: null, dropT: 0,
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
    // E5: slow motion after the final blow on the warlord.
    if (this.slowT > 0) {
      this.slowT -= dt;
      dt *= 0.3;
    }
    if (Input.pressed("debug")) Attacks.debug.on = !Attacks.debug.on;
    this.handleDiscardKeys();
    if (this.mode !== "play") return;
    if (this.swapT > 0) this.swapT -= dt;

    const p = this.player;
    const move = (Input.down("right") ? 1 : 0) - (Input.down("left") ? 1 : 0);

    if (move !== 0) p.facing = move;
    // F1: ease toward the target speed. Turning or stopping uses the stronger decel; air control is softer.
    const R = TUNING.run;
    const target = move * R.max;
    const speeding = move !== 0 && Math.sign(p.vx) !== -move && Math.abs(target) >= Math.abs(p.vx);
    const rate = p.grounded ? (speeding ? R.groundAccel : R.groundDecel) : (speeding ? R.airAccel : R.airDecel);
    if (p.vx < target) p.vx = Math.min(target, p.vx + rate * dt);
    else if (p.vx > target) p.vx = Math.max(target, p.vx - rate * dt);
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

    // Down: on a ladder top, climb down; on a one-way ledge or a made platform, drop through it.
    // Solid ground does not drop. Up on a ladder climbs it (instead of jumping).
    if (p.dropT > 0) p.dropT -= dt;
    if (!p.climbing) {
      const lad = World.ladderAt(p);
      const under = p.grounded ? World.standingOn(p) : null;
      if (lad && Input.down("up") && p.y + p.h > lad.top + 1) this.startClimb(p, lad);
      else if (lad && under === "ladder" && Input.pressed("down")) {
        this.startClimb(p, lad);
        p.y += 2;
      } else if (Input.pressed("down") && (under === "oneway" || under === "ladder")) {
        p.dropT = 0.25;
        p.grounded = false;
        p.y += 1;
        p.vy = Math.max(p.vy, 40);
      }
    }
    if (p.climbing) {
      // Left or Right steps off the ladder; Up/Down climb at 120 px/s.
      if (!World.ladders.includes(p.climbing) || move !== 0) {
        p.climbing = null;
      } else {
        const lad = p.climbing;
        p.vx = 0;
        p.x = lad.x + lad.w / 2 - p.w / 2;
        p.vy = ((Input.down("down") ? 1 : 0) - (Input.down("up") ? 1 : 0)) * 120;
        p.jumpBufT = 0;
        p.jumping = false;
        p.hopUsed = false;
        p.floatUsed = false;
        this.floatT = 0;
      }
    }
    if (p.grounded) {
      p.hopUsed = false;
      p.floatUsed = false;
      p.coyoteT = TUNING.jump.coyote;
    } else if (p.coyoteT > 0) {
      p.coyoteT -= dt;
    }
    // Coyote time and the jump buffer: a jump pressed just before landing, or just after leaving a ledge, still counts.
    if (Input.pressed("up")) p.jumpBufT = TUNING.jump.buffer;
    if (p.jumpBufT > 0) p.jumpBufT -= dt;
    if (p.jumpBufT > 0 && (p.grounded || p.coyoteT > 0) && !p.climbing) {
      p.vy = TUNING.jump.vy;
      // Take-off stretch (drawn in drawBody) and a puff of dust.
      p.stretchT = 0.12;
      if (p.grounded) Effects.dust(p.x + p.w / 2, p.y + p.h, "#8a7a66", 3, 2, 0.2);
      Sfx.play("jump");
      p.jumping = true;
      p.jumpBufT = 0;
      p.coyoteT = 0;
    }
    // Releasing jump early cuts the arc short.
    if (p.jumping && !Input.down("up") && p.vy < 0) {
      p.vy *= TUNING.jump.releaseCut;
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

    // Float: hold Up to climb at 120 px/s for the first 0.7 s (about 4.5 rows with the jump before it),
    // then hover: the fall is slowed. Five-row shafts stay ranger-ladder secrets.
    if (p.climbing) {
      // On a ladder: no gravity, the climb speed set above.
    } else if (this.floatT > 0) {
      this.floatT -= dt;
      // The hover starts from rest, so leftover climb speed does not carry the body higher.
      p.vy = Input.down("up") && this.floatT > 0.5 ? -120 : Math.min(Math.max(p.vy, 0) + 200 * dt, 40);
      // Float sparkles: two purple motes under the feet every 0.05 s.
      this.sparkleT += dt;
      if (this.sparkleT >= 0.05) {
        this.sparkleT = 0;
        Effects.dust(p.x + p.w / 2 - 3, p.y + p.h, "#b9a2f0", 2, 1, 0.3, -30);
      }
    } else {
      // F1: lighter gravity going up, heavier coming down, a short hang at the apex while jump is held.
      const J = TUNING.jump;
      let g = p.vy < 0 ? J.riseGravity : J.fallGravity;
      if (Math.abs(p.vy) < J.apexBand && Input.down("up") && p.jumping) g *= J.apexScale;
      if (p.vy >= J.apexBand) p.jumping = false;
      p.vy = Math.min(p.vy + g * dt, J.fallCap);
    }
    this.cornerCorrect(p, dt, move);
    const prevBottom = p.y + p.h;
    // A charge breaks cracked walls it runs into.
    if (this.dashT > 0) World.breakCracked(p.facing > 0 ? p.x + p.w : p.x - 6, p.y, 6, p.h);
    const fallSpeed = p.vy;
    World.moveBody(p, dt);
    if (p.climbing) {
      const lad = p.climbing;
      if (p.y + p.h <= lad.top) {
        // Off the top: stand on it.
        p.y = lad.top - p.h;
        p.vy = 0;
        p.grounded = true;
        p.climbing = null;
      } else if (p.vy > 0 && (p.grounded || p.y + p.h > lad.bottom + 2)) {
        // Down at the bottom: back on the floor, or off a hanging ladder's end.
        p.climbing = null;
      } else {
        p.grounded = false;
      }
    }
    // A hard landing shows the land frame for a moment.
    if (p.grounded && !p.prevGrounded && fallSpeed > 250) {
      p.landT = 0.08;
      p.squashT = 0.1;
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
    // F4: a kill freezes longer than a plain hit and kicks the screen a little.
    const landed = Attacks.consumeHit();
    if (Enemies.consumeKill()) {
      this.hitstopT = 0.08;
      Effects.shake(0.1, 2);
      // E5: the final blow on the warlord: a long freeze, a big flash, then slow motion.
      if (World.level.boss && !this.bossDone && !Enemies.list().some((e) => e.kind === "warlord" && !e.dead)) {
        this.bossDone = true;
        this.hitstopT = 0.4;
        this.slowT = 0.5;
        Effects.flash(0.35);
        Effects.shake(0.6, 4);
      }
    }
    else if (landed) this.hitstopT = 0.05;
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

    this.updateCamera(dt, false);

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

  // F3: the camera looks ahead where the player faces. Vertically it holds still through a jump
  // and only follows on landing or when the player leaves a deadzone, so jumps do not bob the screen.
  updateCamera(dt, snap) {
    const p = this.player;
    const C = TUNING.camera;
    if (this.lookX === undefined || snap) { this.lookX = p.facing * C.lookAhead; this.anchorY = p.y + p.h / 2; }
    this.lookX += (p.facing * C.lookAhead - this.lookX) * Math.min(1, C.lookLerp * dt);
    const pcy = p.y + p.h / 2;
    let fast = false;
    if (p.grounded || this.floatT > 0) this.anchorY = pcy;
    else if (pcy > this.anchorY + C.deadzone) { this.anchorY = pcy - C.deadzone; fast = true; }
    else if (pcy < this.anchorY - C.deadzone * 2) this.anchorY = pcy + C.deadzone * 2;
    const targetX = p.x + p.w / 2 + this.lookX - Engine.W / 2;
    const targetY = this.anchorY - Engine.H / 2;
    const kx = snap ? 1 : 1 - Math.exp(-C.xLerp * dt);
    const ky = snap ? 1 : 1 - Math.exp(-(fast ? C.yLerpFast : C.yLerp) * dt);
    this.cam.x += (targetX - this.cam.x) * kx;
    this.cam.y += (targetY - this.cam.y) * ky;
    this.cam.x = Math.max(0, Math.min(this.cam.x, World.width - Engine.W));
    this.cam.y = Math.max(0, Math.min(this.cam.y, World.height - Engine.H));
  }

  // F2: corner correction. A head bump on a ceiling corner slides the body up to 4 px sideways;
  // rising into a ledge lip lifts it up to 4 px onto the ledge. Both run before the move.
  cornerCorrect(p, dt, move) {
    const solidAt = (x, y) => World.overlapping(x, y, p.w, p.h).some((c) => World.isSolid(c.ch));
    if (p.vy < 0) {
      const ny = p.y + p.vy * dt;
      if (solidAt(p.x, ny) ) {
        for (let k = 1; k <= TUNING.corner.head; k++) {
          for (const d of [1, -1]) {
            if (!solidAt(p.x + d * k, ny) && !solidAt(p.x + d * k, p.y)) { p.x += d * k; return; }
          }
        }
      }
    }
    if (!p.grounded && move !== 0 && p.vy < 60) {
      const nx = p.x + move * Math.max(1, Math.abs(p.vx) * dt);
      if (solidAt(nx, p.y)) {
        for (let k = 1; k <= TUNING.corner.ledge; k++) {
          if (!solidAt(nx, p.y - k) && !solidAt(p.x, p.y - k)) { p.y -= k; return; }
        }
      }
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

  startClimb(p, lad) {
    p.climbing = lad;
    p.vx = 0;
    p.vy = 0;
    p.grounded = false;
    p.jumpBufT = 0;
    p.action = "";
  }

  // D (or C) opens the card menu when a card is held. Q discards the current character.
  handleDiscardKeys() {
    if (Input.pressed("swap") || Input.pressed("discardCard")) {
      if (Hand.slots().some((c) => c !== null)) this.openDiscardCard();
    }
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

  // Card menu, D on a card: that card is used up and the player becomes its character. The old
  // face goes to the back of the hand. HP carries over (no free heal), cooldowns reset, timed
  // powers end, 0.3 s of safety.
  swapFace(slot) {
    const next = Hand.useCard(slot, this.active);
    if (!next) return;
    this.active = next;
    this.swapT = 0.3;
    PlayScene.swapUsed = true;
    this.cooldowns = [0, 0, 0, 0];
    this.abBuf = [0, 0, 0, 0];
    this.floatT = 0;
    this.ghostT = 0;
    this.dashT = 0;
    this.lungeT = 0;
    const p = this.player;
    p.action = "";
    p.holdPose = false;
    p.stretchT = 0.12;
    const color = CARD_DEFS[next].color;
    const x = p.x + p.w / 2;
    const y = p.y + p.h / 2;
    Effects.ring(x, y, color);
    Effects.ring(x, y - 6, "#ffffff");
    Effects.burst(x, y, color);
    Effects.dust(x, p.y + p.h, color, 6, 2, 0.35, -60);
    this.hitstopT = 0.04;
    Sfx.play("swap");
  }

  // A hit takes HP and gives a second of safety with a short knockback. At 0 HP the character is lost.
  takeDamage(amount) {
    if (this.hpInvT > 0 || this.flashT > 0 || this.swapT > 0 || this.mode !== "play") return;
    this.hp = Math.max(0, this.hp - amount);
    this.hpInvT = 1.0;
    this.player.vy = -200;
    this.player.vx = -this.player.facing * 120;
    Sfx.play("hurt");
    // F4: getting hit should sting: a short freeze, a stronger shake, red screen edges.
    this.hitstopT = 0.06;
    Effects.shake(0.15, 2);
    Effects.hurt(0.3);
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
    // D: become the highlighted card. C: throw it away. Escape or X/B: close.
    if (Input.pressed("swap") && Hand.get(this.sel)) {
      this.mode = "play";
      this.swapFace(this.sel);
      this.sel = this.firstOccupied();
      return;
    }
    if (Input.pressed("discardCard") && Hand.get(this.sel)) {
      Hand.discard(this.sel);
      Sfx.play("hurt");
      if (Hand.slots().every((c) => c === null)) this.mode = "play";
      else this.sel = Hand.get(this.sel) ? this.sel : this.firstOccupied();
      return;
    }
    if (Input.pressed("ab4") || Input.pressed("back")) this.mode = "play";
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
    const theme = THEMES[World.visual()] || THEMES[World.level.theme];
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
    World.drawGrounding(ctx, cx, cy);
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
    this.drawHints(ctx, cx, cy);

    if (this.mode === "play" || this.mode === "discardCard") this.drawBody(ctx, cx, cy);
    // F0: backquote toggles hitbox outlines (player green, enemies orange, attacks red).
    if (Attacks.debug.on) {
      const box = (b, c) => { ctx.strokeStyle = c; ctx.strokeRect(Math.round(b.x - cx) + 0.5, Math.round(b.y - cy) + 0.5, b.w - 1, b.h - 1); };
      box(this.player, "#4f4");
      for (const e of Enemies.list()) if (!e.dead) box(e, "#fa4");
    }

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
      // Under the hand, so the cards stay visible; it names the highlighted card.
      const id = Hand.get(this.sel);
      const text = (id ? CARD_DEFS[id].name + ": D to become it, C to throw it away." : "") + "  Left/Right: choose.  Esc or X: close.";
      ctx.font = "11px GameFont, system-ui, sans-serif";
      this.drawBanner(ctx, text, Math.round((Engine.W - ctx.measureText(text).width - 12) / 2), 52);
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
    if (p.stretchT > 0) p.stretchT -= dt;
    if (p.squashT > 0) p.squashT -= dt;
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
    // Squash and stretch about the feet: tall and thin on take-off, short and wide on a hard landing.
    let scx = 1, scy = 1;
    if (p.stretchT > 0) { const k = p.stretchT / 0.12; scx = 1 - 0.12 * k; scy = 1 + 0.14 * k; }
    else if (p.squashT > 0) { const k = p.squashT / 0.1; scx = 1 + 0.16 * k; scy = 1 - 0.14 * k; }
    if (scx !== 1) {
      const fx0 = Math.round(p.x + p.w / 2 - cx);
      const fy0 = Math.round(p.y + p.h - cy);
      ctx.translate(fx0, fy0);
      ctx.scale(scx, scy);
      ctx.translate(-fx0, -fy0);
    }
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

  // L2: a small face badge bobs over a secret that needs that face. It glows gold while you wear it,
  // so the level tells you which face to swap to. Gone once the card is taken.
  drawHints(ctx, cx, cy) {
    // Session 5: `runes: [{ col, row, len }]` draws a faint line of twinkling blink-coloured motes across
    // a gap only a blink can cross (L3), brighter while the mage is worn.
    for (const r of World.level.runes || []) {
      const mage = this.active === "mage";
      for (let i = 0; i < r.len * 4; i++) {
        const x = Math.round(r.col * World.TILE + 4 + i * 8 - cx);
        const y = Math.round(r.row * World.TILE + 14 - cy + Math.sin(this.time * 2 + i * 0.7) * 3);
        const a = (mage ? 0.85 : 0.35) * (0.45 + 0.55 * Math.abs(Math.sin(this.time * 2.5 + i * 0.9)));
        ctx.fillStyle = `rgba(185, 162, 240, ${a.toFixed(2)})`;
        ctx.fillRect(x, y, 2, 2);
      }
    }
    const hints = World.level.hints;
    if (!hints) return;
    const T = World.TILE;
    for (const h of hints) {
      const hx = h.col * T;
      const hy = h.row * T;
      // Secret cards fall onto the floor below their tile, so follow the live pickup.
      const q = Enemies.pickups().find((c) => c.state === "ground" && c.secret && Math.abs(c.x - hx) < T && c.y >= hy - T);
      if (!q) continue;
      const x = Math.round(q.x + q.w / 2 - cx);
      let y = Math.round(q.y - 16 - cy + Math.sin(this.time * 3 + h.col) * 2);
      if (x < -20 || x > Engine.W + 20 || y < -200 || y > Engine.H + 10) continue;
      // A secret up to about 6 rows overhead is hidden behind the HUD: pin the badge just under it,
      // pointing up, so the player knows something is up there.
      const above = y < 72;
      if (above) y = 72;
      const wearing = this.active === h.face;
      if (wearing) Glow.light(ctx, x, y, 18, "#f2d04a", 0.35);
      ctx.fillStyle = "rgba(10, 12, 18, 0.8)";
      ctx.fillRect(x - 8, y - 10, 16, 20);
      ctx.strokeStyle = wearing ? "#f2d04a" : CARD_DEFS[h.face].color;
      ctx.strokeRect(x - 7.5, y - 9.5, 15, 19);
      ctx.drawImage(IMG[LPC_KEY[h.face]], 22, 10, 20, 26, x - 6, y - 8, 12, 16);
      // A small pointer at the secret: down when it is in view, up when it is overhead.
      ctx.fillStyle = ctx.strokeStyle;
      if (above) {
        ctx.fillRect(x - 1, y - 11, 3, 1);
        ctx.fillRect(x, y - 12, 1, 1);
      } else {
        ctx.fillRect(x - 1, y + 11, 3, 1);
        ctx.fillRect(x, y + 12, 1, 1);
      }
    }
  }

  // V1: HP as five pixel hearts under the character name, each heart 2 HP (half hearts for odd HP).
  // While the hit safety lasts, the hearts shake a little.
  drawHp(ctx) {
    const x0 = 52;
    const y = 28;
    const HEART = ["0110110", "1111111", "1111111", "0111110", "0011100", "0001000"];
    const jig = this.hpInvT > 0.7 ? Math.round(Math.sin(this.time * 60)) : 0;
    for (let h = 0; h < MAX_HP / 2; h++) {
      const fill = Math.max(0, Math.min(2, this.hp - h * 2));
      const hx = x0 + h * 10 + jig;
      for (let r = 0; r < HEART.length; r++) {
        for (let c = 0; c < 7; c++) {
          if (HEART[r][c] !== "1") continue;
          const lit = fill === 2 || (fill === 1 && c < 4);
          ctx.fillStyle = lit ? (r === 1 && c < 3 ? "#ff9a8a" : "#e0493c") : "rgba(40, 30, 30, 0.7)";
          ctx.fillRect(hx + c, y + r, 1, 1);
        }
      }
    }
  }

  // Level name for the first 2.5 seconds, fading out over the last 0.5.
  drawBanner2(ctx) {
    if (this.bannerT <= 0) return;
    ctx.globalAlpha = Math.min(1, this.bannerT / 0.5);
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(120, 60, 240, 26);
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "14px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    drawText(ctx, "Level " + (World.index + 1) + ": " + World.level.name, Engine.W / 2, 78);
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
    // Just under the HUD, above the player's head (the camera keeps the player near y 135).
    ctx.fillRect(40, 60, 400, 38);
    ctx.fillStyle = "#ffffff";
    ctx.font = "10px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    const lines = wrapText(ctx, this.signText, 380);
    lines.forEach((line, i) => drawText(ctx, line, Engine.W / 2, 75 + i * 14));
    ctx.textAlign = "left";
  }

  drawBanner(ctx, text, x = 8, y = 8) {
    ctx.font = "11px GameFont, system-ui, sans-serif";
    const w = Math.ceil(ctx.measureText(text).width) + 12;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(x, y, w, 22);
    ctx.fillStyle = "#e8e4d8";
    drawText(ctx, text, x + 6, y + 14);
  }

  drawSelect(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    const title = this.reason === "fell" ? "You fell." : this.reason === "discarded" ? "Discarded." : "You were slain.";
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    drawText(ctx, title, Engine.W / 2, 62);
    ctx.font = "11px GameFont, system-ui, sans-serif";
    drawText(ctx, "Choose a card to become. Left/Right to choose, Z or A to confirm.", Engine.W / 2, 82);
    ctx.textAlign = "left";

    // Three cards, 116 px wide with 12 px gaps. The highlighted card lifts 4 px and gets a gold border.
    Hand.slots().forEach((cardId, i) => {
      const x = Engine.W / 2 - 186 + i * 128;
      const lift = i === this.sel ? 4 : 0;
      const y = 96 - lift;
      const w = 116;
      const h = 152;
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
        // C6: one line on what this face is for, then its four powers with their keys.
        ctx.font = "9px GameFont, system-ui, sans-serif";
        ctx.fillStyle = "#f2d04a";
        drawText(ctx, CHARACTERS[cardId].role, x + w / 2, y + 103);
        ctx.fillStyle = "#f4efe2";
        ctx.font = "10px GameFont, system-ui, sans-serif";
        CHARACTERS[cardId].abilities.forEach((id, k) => {
          drawText(ctx, "ASZX"[k] + "  " + ABILITY_NAMES[id], x + w / 2, y + 117 + k * 11);
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

  // C5: the swap badge right of the deck.
  function swapRect() {
    const d = deckRect();
    return { x: d.x + d.w + 12, y: Y + 6, w: 20, h: 28 };
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
    if (scene.mode === "play") drawSwap(ctx, scene);
    drawSecrets(ctx, scene);
  }

  // A "D" key badge with a swap arrow: D opens the card menu. Until the player has changed face
  // once, a bobbing "D: cards" hint points at it when a card is held.
  function drawSwap(ctx, scene) {
    const r = swapRect();
    const has = Hand.slots().some((c) => c !== null);
    const ready = has;
    roundRect(ctx, r.x, r.y, r.w, r.h, 3);
    ctx.fillStyle = ready ? "rgba(217, 164, 65, 0.85)" : "rgba(10, 12, 18, 0.6)";
    ctx.fill();
    ctx.strokeStyle = ready ? "#f4efe2" : "#6a7686";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = ready ? "#1a1420" : "#9fb0c0";
    ctx.font = "bold 11px GameFont, system-ui, sans-serif";
    ctx.textAlign = "center";
    drawText(ctx, "D", r.x + r.w / 2, r.y + 13);
    // Two small arrows chasing each other: swap.
    const cx = r.x + r.w / 2;
    const cy = r.y + 21;
    ctx.fillRect(cx - 5, cy - 2, 7, 1); ctx.fillRect(cx + 1, cy - 3, 1, 3);
    ctx.fillRect(cx - 2, cy + 2, 7, 1); ctx.fillRect(cx - 2, cy + 1, 1, 3);
    if (has && !PlayScene.swapUsed && !World.level.boss) {
      const bob = Math.round(Math.sin(scene.time * 6) * 2);
      ctx.font = "10px GameFont, system-ui, sans-serif";
      ctx.fillStyle = "rgba(10, 12, 18, 0.75)";
      ctx.fillRect(r.x + r.w / 2 - 30, r.y + r.h + 4 + bob, 60, 14);
      ctx.fillStyle = "#f2d04a";
      drawText(ctx, "D: cards", r.x + r.w / 2, r.y + r.h + 14 + bob);
    }
    ctx.textAlign = "left";
  }

  return { slotRect, deckRect, draw, drawAbilities, abilityLift };
})();
