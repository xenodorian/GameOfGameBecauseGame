// Animation frames for the player and enemies. Frames come from the atlases made by
// game/tools/build_atlases.py: 8 columns by 7 rows of 48 by 48 cells.
// Rows: idle, walk, melee, cast, jump, land, hurt. ANIM_ROWS gives [row, frame count].
const ANIM_ROWS = {
  idle: [0, 4],
  walk: [1, 6],
  melee: [2, 4],
  cast: [3, 3],
  jump: [4, 2],
  land: [5, 1],
  hurt: [6, 1],
};

// Seconds for one melee or cast action. Frames are spread evenly over it.
const ACTION_LENGTH = { melee: 0.16, cast: 0.18 };

// Abilities that hit up close play the melee row. Ranged and magic ones play cast.
const ACTION_FOR_ABILITY = {
  slash: "melee", thrust: "melee", shield_bash: "melee", charge: "melee",
  shoot: "cast", spell_bolt: "cast", arrow_anchor: "cast", bone_bridge: "cast",
  blink: "cast", float: "cast", ghost: "cast", leap: "cast", scurry: "cast", hop: "cast",
};

// Atlas image key for each character (see CHARACTERS in abilities.js).
const ATLAS_KEY = {
  knight: "atlas_knight_right",
  ranger: "atlas_ranger_right",
  mage: "atlas_mage_right",
  rat: "atlas_rat_king",
  weaver: "atlas_bone_weaver",
};

// Starts a melee or cast action on a body when its ability fires.
function startAction(body, abilityId) {
  const action = ACTION_FOR_ABILITY[abilityId];
  if (!action) return;
  body.action = action;
  body.animT = 0;
}

// Picks the frame for a body this step. Pure: reads state, changes nothing.
function pickFrame(body, time) {
  if (body.action) {
    const [row, count] = ANIM_ROWS[body.action];
    const col = Math.min(count - 1, Math.floor(body.animT / (ACTION_LENGTH[body.action] / count)));
    return { row, col };
  }
  if (!body.grounded) return { row: ANIM_ROWS.jump[0], col: body.vy < 0 ? 0 : 1 };
  if (body.landT > 0) return { row: ANIM_ROWS.land[0], col: 0 };
  if (Math.abs(body.vx) > 1) return { row: ANIM_ROWS.walk[0], col: Math.floor(body.walkDist / 7) % 6 };
  return { row: ANIM_ROWS.idle[0], col: Math.floor(time * 3) % 4 };
}

// Draws one 48 by 48 cell from an atlas with its bottom centre at (x, y). Flipped when facing left.
function drawFrame(ctx, atlas, frame, x, y, facing) {
  const sx = frame.col * 48;
  const sy = frame.row * 48;
  if (facing < 0) {
    ctx.save();
    ctx.translate(x + 48, y);
    ctx.scale(-1, 1);
    ctx.drawImage(atlas, sx, sy, 48, 48, 0, 0, 48, 48);
    ctx.restore();
  } else {
    ctx.drawImage(atlas, sx, sy, 48, 48, x, y, 48, 48);
  }
}
