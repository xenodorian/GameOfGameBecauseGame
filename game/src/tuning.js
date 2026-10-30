// Tunable feel numbers in one place (research.md 5.7). Change values here, not inline.
// Units: px, seconds, px/s, px/s^2.
const TUNING = {
  // Running. The body eases to top speed instead of snapping to it.
  run: { max: 140, scurryMax: 220, groundAccel: 1600, groundDecel: 2000, airAccel: 1100, airDecel: 600 },
  // Jumping. Apex stays near 2 tiles (64 to 76 px) so level gates do not change.
  jump: {
    vy: -350, riseGravity: 900, fallGravity: 1400,
    // Near the top of a held jump, gravity is halved for a floaty, readable apex.
    apexBand: 50, apexScale: 0.5,
    // Letting go of jump while rising cuts the upward speed.
    releaseCut: 0.45, fallCap: 420,
    coyote: 0.1, buffer: 0.12,
  },
  // Corner correction: nudge past a ceiling corner or onto a ledge lip instead of stopping dead.
  corner: { head: 4, ledge: 4 },
  // Camera: looks ahead where you face; vertical follow waits until you land or leave a deadzone.
  camera: { lookAhead: 40, lookLerp: 3, xLerp: 8, yLerp: 6, yLerpFast: 12, deadzone: 28 },
};
