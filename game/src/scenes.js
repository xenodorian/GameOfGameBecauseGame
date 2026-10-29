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
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Input check", 16, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#9fb0c0";
    ctx.fillText("Press each key or button. X or B returns to the title.", 16, 46);

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
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText(label, x + 8, y + 20);
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
  ctx.font = "22px system-ui, sans-serif";
  ctx.fillText(title, Engine.W / 2, 74);
  ctx.font = "14px system-ui, sans-serif";
  items.forEach((label, i) => {
    const y = 120 + i * 30;
    ctx.fillStyle = i === sel ? "#d9a441" : "#e8e4d8";
    ctx.fillText((i === sel ? "> " : "  ") + label, Engine.W / 2, y);
  });
  ctx.font = "11px system-ui, sans-serif";
  ctx.fillStyle = "#9fb0c0";
  ctx.fillText(footer, Engine.W / 2, Engine.H - 16);
  ctx.textAlign = "left";
}

// Title screen: start, input check, credits.
class TitleScene {
  constructor() {
    this.items = ["Play", "Input check", "Credits"];
    this.sel = 0;
  }

  update() {
    this.sel = menuStep(this.sel, this.items.length);
    if (menuConfirm()) {
      if (this.sel === 0) Engine.setScene(new PlayScene());
      if (this.sel === 1) Engine.setScene(new InputTestScene());
      if (this.sel === 2) Engine.setScene(new CreditsScene());
    }
  }

  draw(ctx) {
    drawMenu(ctx, "Changeling", this.items, this.sel, "Knight of a thousand faces");
  }
}

// Credits: sources and licenses for the art and code.
class CreditsScene {
  update() {
    if (menuBack() || menuConfirm()) Engine.setScene(new TitleScene());
  }

  draw(ctx) {
    ctx.fillStyle = "#1b2430";
    ctx.fillRect(0, 0, Engine.W, Engine.H);
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Credits", 16, 28);
    ctx.font = "10px system-ui, sans-serif";
    const lines = [
      "Liberated Pixel Cup (LPC) base sprites and animations: many authors (see method_5 CREDITS.csv).",
      "  Licensed OGA-BY 3.0, CC-BY-SA 3.0, GPL 3.0.",
      "Dungeon Crawl Stone Soup tiles: DCSS team. Mostly CC0; see assets/tiles/LICENSE_DCSS.txt.",
      "Sprite Foundry Fantasy Heroes (48px and HD), Monster Pack, Goblin Warband: MIT.",
      "Game code and build: this repository.",
    ];
    lines.forEach((line, i) => ctx.fillText(line, 16, 56 + i * 18));
    ctx.fillStyle = "#9fb0c0";
    ctx.fillText("Press Z, A, X, or B to return.", 16, Engine.H - 16);
  }
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
//
// Modes:
//   play         normal play
//   select       after a death or a discard: pick a hand card to become
//   discardCard  pick a hand card to throw away (game paused)
//   complete     the exit flag was reached
//   pause        the pause menu: resume or back to title
class PlayScene {
  constructor() {
    this.images = {
      knight: IMG.knight_right,
      ranger_right: IMG.ranger_right,
      grunt: IMG.grunt,
      mud_revenant: IMG.mud_revenant,
      rat_king: IMG.rat_king,
      bone_weaver: IMG.bone_weaver,
      wall: IMG.wall,
      grass: IMG.grass,
      dirt: IMG.dirt,
      tree: IMG.tree,
    };
    this.cam = { x: 0, y: 0 };
    this.active = "knight";
    this.mode = "play";
    this.reason = "";
    this.sel = 0;
    this.deathPos = { x: 0, y: 0 };
    this.downActive = false;
    this.downTime = 0;
    this.downFired = false;
    this.dashT = 0;
    this.floatT = 0;
    this.pauseSel = 0;
    this.player = this.newBody(World.spawn.x, World.spawn.y);
    Enemies.spawnFromLevel();
  }

  newBody(x, y) {
    return { x, y, w: 18, h: 30, vx: 0, vy: 0, grounded: false, facing: 1, jumping: false, hopUsed: false };
  }

  update(dt) {
    if (this.mode === "select") this.updateSelect();
    else if (this.mode === "discardCard") this.updateDiscardCard();
    else if (this.mode === "complete") {
      if (Input.pressed("start")) Engine.setScene(new PlayScene());
    } else if (this.mode === "pause") this.updatePause();
    else this.updatePlay(dt);
  }

  updatePlay(dt) {
    if (Input.pressed("start")) {
      this.mode = "pause";
      this.pauseSel = 0;
      return;
    }
    this.handleDiscardKeys(dt);
    if (this.mode !== "play") return;

    const p = this.player;
    const move = (Input.down("right") ? 1 : 0) - (Input.down("left") ? 1 : 0);

    if (move !== 0) p.facing = move;
    p.vx = move * 130;
    if (this.dashT > 0) {
      this.dashT -= dt;
      p.vx = p.facing * 320;
    }

    if (p.grounded) p.hopUsed = false;
    if (Input.pressed("up") && p.grounded) {
      p.vy = -340;
      p.jumping = true;
    }
    // Releasing jump early cuts the arc short.
    if (p.jumping && !Input.down("up") && p.vy < 0) {
      p.vy *= 0.5;
      p.jumping = false;
    }

    // Abilities 1 to 4 fire the active character's ability in that slot.
    const abilities = CHARACTERS[this.active].abilities;
    for (let i = 0; i < abilities.length; i++) {
      if (Input.pressed("ab" + (i + 1))) Attacks.use(abilities[i], this);
    }

    // Float: hold Up to climb at 120 px/s. Without Up, the fall is slowed.
    if (this.floatT > 0) {
      this.floatT -= dt;
      p.vy = Input.down("up") ? -120 : Math.min(p.vy + 200 * dt, 40);
    } else {
      p.vy = Math.min(p.vy + 900 * dt, 600);
    }
    const prevBottom = p.y + p.h;
    World.moveBody(p, dt);

    for (const enemy of Enemies.list()) {
      if (enemy.dead) continue;
      enemy.update(dt, p);
    }
    Attacks.update(dt);
    World.updatePlatforms(dt);
    this.checkEnemyContact(p, prevBottom);
    if (this.mode !== "play") return;
    if (Attacks.hitByHostile(p)) {
      this.beginSelection("slain");
      return;
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
          // A power-up also draws one more random card.
          if (pickup.power) Hand.collect(Object.keys(CARD_DEFS)[Math.floor(Math.random() * 3)]);
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

    const exit = World.exit();
    if (exit && this.mode === "play" && this.overlaps(p, exit)) this.mode = "complete";
  }

  updatePause() {
    this.pauseSel = menuStep(this.pauseSel, 2);
    if (menuBack()) this.mode = "play";
    if (menuConfirm()) {
      if (this.pauseSel === 0) this.mode = "play";
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
    for (const enemy of Enemies.list()) {
      if (enemy.dead || !this.overlaps(p, enemy)) continue;
      const stomp = p.vy > 0 && prevBottom <= enemy.y + 6;
      if (stomp) {
        enemy.dead = true;
        Enemies.dropCard(enemy);
        p.vy = -260;
      } else {
        this.beginSelection("slain");
        return;
      }
    }
  }

  // Death or discard: the current character is lost. The player picks a
  // hand card to become. With an empty hand, the Knight returns.
  beginSelection(reason) {
    this.reason = reason;
    this.deathPos = { x: this.player.x, y: this.player.y };
    if (Hand.slots().every((c) => c === null)) {
      this.respawn("knight");
      return;
    }
    this.mode = "select";
    this.sel = this.firstOccupied();
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
    this.floatT = 0;
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
    ctx.fillStyle = "#7fb6e0";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    const cx = Math.round(this.cam.x);
    const cy = Math.round(this.cam.y);
    drawHills(ctx, cx * 0.25, "#a8cde8", 150, 0.012, 14);
    drawHills(ctx, cx * 0.5, "#6f9fbf", 190, 0.02, 20);
    World.draw(ctx, this.images, cx, cy, Engine.W, Engine.H);
    World.drawPlatforms(ctx, cx, cy);
    Attacks.draw(ctx, cx, cy);

    for (const enemy of Enemies.list()) {
      if (!enemy.dead) enemy.draw(ctx, this.images, cx, cy);
    }
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
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Paused", Engine.W / 2, 110);
      ctx.font = "14px system-ui, sans-serif";
      ["Resume", "Title screen"].forEach((label, i) => {
        ctx.fillStyle = i === this.pauseSel ? "#d9a441" : "#e8e4d8";
        ctx.fillText((i === this.pauseSel ? "> " : "  ") + label, Engine.W / 2, 144 + i * 26);
      });
      ctx.textAlign = "left";
    } else if (this.mode === "complete") {
      HUD.draw(ctx, -1);
      ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
      ctx.fillRect(0, 0, Engine.W, Engine.H);
      ctx.fillStyle = "#e8e4d8";
      ctx.textAlign = "center";
      ctx.font = "16px system-ui, sans-serif";
      ctx.fillText("Level complete", Engine.W / 2, 110);
      ctx.font = "11px system-ui, sans-serif";
      ctx.fillText("Press Enter or Start to play again.", Engine.W / 2, 132);
      ctx.textAlign = "left";
    } else if (this.mode === "discardCard") {
      HUD.draw(ctx, this.sel);
      this.drawBanner(ctx, "Discard: Left/Right to choose. C or Down to discard. X or B to cancel.");
    } else if (this.mode === "select") {
      HUD.draw(ctx, -1);
      this.drawSelect(ctx);
    } else {
      HUD.draw(ctx, -1);
      this.drawBanner(ctx, CHARACTERS[this.active].name + ". Left/Right walk, Up jump, A S Z X abilities.");
    }
  }

  drawBody(ctx, cx, cy) {
    const p = this.player;
    const img = this.images[CHARACTERS[this.active].sprite];
    const sx = Math.round(p.x + p.w / 2 - 24 - cx);
    const sy = Math.round(p.y + p.h - 48 - cy);
    ctx.save();
    if (p.facing < 0) {
      ctx.translate(sx + 48, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, 48, 48);
    } else {
      ctx.drawImage(img, sx, sy, 48, 48);
    }
    ctx.restore();
  }

  drawBanner(ctx, text) {
    ctx.font = "11px system-ui, sans-serif";
    const w = Math.ceil(ctx.measureText(text).width) + 12;
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(8, 8, w, 22);
    ctx.fillStyle = "#e8e4d8";
    ctx.fillText(text, 14, 22);
  }

  drawSelect(ctx) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.55)";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    const title = this.reason === "fell" ? "You fell." : this.reason === "discarded" ? "Discarded." : "You were slain.";
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText(title, Engine.W / 2, 70);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Choose a card to become. Left/Right to choose, Z or A to confirm.", Engine.W / 2, 90);
    ctx.textAlign = "left";

    Hand.slots().forEach((cardId, i) => {
      const x = Engine.W / 2 - 1.5 * 124 + i * 124;
      const y = 110;
      ctx.fillStyle = cardId ? CARD_DEFS[cardId].color : "#2a3644";
      ctx.fillRect(x, y, 116, 90);
      ctx.strokeStyle = i === this.sel ? "#d9a441" : "#111418";
      ctx.lineWidth = i === this.sel ? 3 : 1;
      ctx.strokeRect(x + 0.5, y + 0.5, 115, 89);
      ctx.lineWidth = 1;
      if (cardId) {
        ctx.fillStyle = "#111418";
        ctx.font = "13px system-ui, sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(CARD_DEFS[cardId].name, x + 58, y + 50);
        ctx.textAlign = "left";
      }
    });
  }
}

// Bottom HUD: three hand slots and the deck count. Deck contents stay hidden.
const HUD = (() => {
  const SLOT_W = 84;
  const SLOT_H = 34;
  const Y = Engine.H - SLOT_H - 8;

  function slotRect(i) {
    return { x: 8 + i * (SLOT_W + 6), y: Y, w: SLOT_W, h: SLOT_H };
  }

  function deckRect() {
    return { x: 8 + Hand.SLOTS * (SLOT_W + 6) + 10, y: Y, w: 70, h: SLOT_H };
  }

  // highlight is a slot index to outline, or -1 for none.
  function draw(ctx, highlight) {
    ctx.font = "11px system-ui, sans-serif";
    Hand.slots().forEach((cardId, i) => {
      const r = slotRect(i);
      ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
      ctx.fillRect(r.x, r.y, r.w, r.h);
      if (cardId) {
        ctx.fillStyle = CARD_DEFS[cardId].color;
        ctx.fillRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);
        ctx.fillStyle = "#111418";
        ctx.fillText(CARD_DEFS[cardId].name, r.x + 8, r.y + 21);
      } else {
        ctx.strokeStyle = "#9fb0c0";
        ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
      }
      if (i === highlight) {
        ctx.strokeStyle = "#d9a441";
        ctx.lineWidth = 2;
        ctx.strokeRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
        ctx.lineWidth = 1;
      }
    });

    const d = deckRect();
    ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    ctx.fillRect(d.x, d.y, d.w, d.h);
    ctx.fillStyle = "#e8e4d8";
    ctx.fillText("Deck: " + Hand.deckCount(), d.x + 8, d.y + 21);
  }

  return { slotRect, deckRect, draw };
})();
