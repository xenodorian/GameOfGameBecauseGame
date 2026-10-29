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
    if (Input.pressed("start")) Engine.setScene(new PlayScene());
  }

  draw(ctx) {
    ctx.fillStyle = "#1b2430";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    ctx.fillStyle = "#e8e4d8";
    ctx.font = "16px system-ui, sans-serif";
    ctx.fillText("Input check", 16, 28);
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillStyle = "#9fb0c0";
    ctx.fillText("Press each key or button. Enter or Start opens the play slice.", 16, 46);

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

// Phase 2 slice: one knight walking, jumping, and landing on the tile map.
class PlayScene {
  constructor() {
    this.player = {
      x: World.spawn.x,
      y: World.spawn.y,
      w: 18,
      h: 30,
      vx: 0,
      vy: 0,
      grounded: false,
      facing: 1,
      jumping: false,
    };
    this.cam = { x: 0, y: 0 };
    this.images = {
      knight: IMG.knight_right,
      wall: IMG.wall,
      grass: IMG.grass,
      dirt: IMG.dirt,
      tree: IMG.tree,
    };
  }

  update(dt) {
    const p = this.player;
    const move = (Input.down("right") ? 1 : 0) - (Input.down("left") ? 1 : 0);

    p.vx = move * 130;
    if (move !== 0) p.facing = move;

    if (Input.pressed("up") && p.grounded) {
      p.vy = -340;
      p.jumping = true;
    }
    // Releasing jump early cuts the arc short.
    if (p.jumping && !Input.down("up") && p.vy < 0) {
      p.vy *= 0.5;
      p.jumping = false;
    }

    p.vy = Math.min(p.vy + 900 * dt, 600);
    World.moveBody(p, dt);

    // Camera eases toward the player and stays inside the level.
    const targetX = p.x + p.w / 2 - Engine.W / 2;
    const targetY = p.y + p.h / 2 - Engine.H / 2;
    this.cam.x += (targetX - this.cam.x) * 0.15;
    this.cam.y += (targetY - this.cam.y) * 0.15;
    this.cam.x = Math.max(0, Math.min(this.cam.x, World.width - Engine.W));
    this.cam.y = Math.max(0, Math.min(this.cam.y, World.height - Engine.H));
  }

  draw(ctx) {
    ctx.fillStyle = "#7fb6e0";
    ctx.fillRect(0, 0, Engine.W, Engine.H);

    const cx = Math.round(this.cam.x);
    const cy = Math.round(this.cam.y);
    World.draw(ctx, this.images, cx, cy, Engine.W, Engine.H);

    const p = this.player;
    const sx = Math.round(p.x + p.w / 2 - 24 - cx);
    const sy = Math.round(p.y + p.h - 48 - cy);
    ctx.save();
    if (p.facing < 0) {
      ctx.translate(sx + 48, sy);
      ctx.scale(-1, 1);
      ctx.drawImage(this.images.knight, 0, 0, 48, 48);
    } else {
      ctx.drawImage(this.images.knight, sx, sy, 48, 48);
    }
    ctx.restore();

    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(8, 8, 232, 22);
    ctx.fillStyle = "#e8e4d8";
    ctx.font = "11px system-ui, sans-serif";
    ctx.fillText("Knight. Left/Right walk, Up jump.", 14, 22);
  }
}
