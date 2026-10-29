// Animation frames for the player and enemies. Frames come from the Liberated Pixel Cup
// sheets made by game/tools/build_lpc.py: 13 columns by 8 rows of 64 px cells.
// ANIM_ROWS gives [row, frame count] for each animation. The sheets hold right-facing
// frames; left is drawn by flipping.
const ANIM_ROWS = {
  idle: [0, 2],
  walk: [1, 9],
  slash: [2, 6],
  thrust: [3, 8],
  spellcast: [4, 7],
  shoot: [5, 13],
  hurt: [6, 6],
  jump: [7, 5],
};

// Seconds for one melee, cast, shoot, or jump action. Frames are spread evenly over it.
const ACTION_LENGTH = { slash: 0.2, thrust: 0.24, spellcast: 0.3, shoot: 0.3, jump: 0.25 };

// The animation each ability plays. Abilities not listed play no action.
const ACTION_FOR_ABILITY = {
  slash: "slash", thrust: "thrust", shield_bash: "slash", charge: "thrust",
  shoot: "shoot", arrow_anchor: "shoot", spell_bolt: "spellcast", bone_bridge: "spellcast",
  blink: "spellcast", float: "spellcast", ghost: "spellcast",
  leap: "jump", hop: "jump", scurry: "walk",
};

// Sheet key for each character (see CHARACTERS in abilities.js).
const LPC_KEY = {
  knight: "lpc_knight",
  ranger: "lpc_ranger",
  mage: "lpc_mage",
  rat: "lpc_rat",
  weaver: "lpc_weaver",
};

// Starts an action on a body when its ability fires. Scurry is a walk, so it has no action.
function startAction(body, abilityId) {
  const action = ACTION_FOR_ABILITY[abilityId];
  if (!action || action === "walk") return;
  body.action = action;
  body.animT = 0;
}

// First frame an action plays. Shoot starts at frame 7, so the action runs through the release (frame 9) as the arrow flies.
const ACTION_FIRST = { shoot: 7 };

// Picks the frame for a body this step. Pure: reads state, changes nothing.
function pickFrame(body, time) {
  if (body.action) {
    const [row, count] = ANIM_ROWS[body.action];
    const first = ACTION_FIRST[body.action] || 0;
    const n = count - first;
    const col = first + Math.min(n - 1, Math.floor(body.animT / (ACTION_LENGTH[body.action] / n)));
    return { row, col };
  }
  if (!body.grounded) return { row: ANIM_ROWS.jump[0], col: body.vy < -120 ? 1 : body.vy < 120 ? 2 : 3 };
  if (body.landT > 0) return { row: ANIM_ROWS.idle[0], col: 0 };
  if (Math.abs(body.vx) > 1) return { row: ANIM_ROWS.walk[0], col: 1 + Math.floor(body.walkDist / 6) % (ANIM_ROWS.walk[1] - 1) };
  return { row: ANIM_ROWS.idle[0], col: Math.floor(time * 2) % ANIM_ROWS.idle[1] };
}

// Offscreen canvas for the ghost outline's cyan copy. Made once at load.
const GhostCanvas = (() => {
  const c = document.createElement("canvas");
  c.width = 192;
  c.height = 192;
  return c;
})();

// Draws one size by size cell (64 by default, 192 for the big player sheets) from a sheet with its bottom centre at (x, y). Flipped when facing left.
function drawFrame(ctx, sheet, frame, x, y, facing, size = 64) {
  const sx = frame.col * size;
  const sy = frame.row * size;
  if (facing < 0) {
    ctx.save();
    ctx.translate(x + size, y);
    ctx.scale(-1, 1);
    ctx.drawImage(sheet, sx, sy, size, size, 0, 0, size, size);
    ctx.restore();
  } else {
    ctx.drawImage(sheet, sx, sy, size, size, x, y, size, size);
  }
}
