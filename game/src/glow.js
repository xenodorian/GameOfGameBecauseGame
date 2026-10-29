// Banded pixel glow, after the wizard beam method: every effect is a smooth
// energy value cut into a few flat colour bands (white core, pale, mid, deep,
// faint halo), so soft maths still reads as crisp pixel art. Light on the
// scene is drawn through a 4 by 4 ordered dither pattern.
const Glow = (() => {
  // Ramps run core to edge. Five colours each.
  const RAMPS = {
    arcane: ["#ffffff", "#f0e6ff", "#d9c8ff", "#b9a2f0", "#7a5cc8"],
    steel: ["#ffffff", "#e6f2ff", "#b4dcff", "#7fb2ff", "#4a78d8"],
    ember: ["#ffffff", "#fff4c0", "#ffd166", "#ff9a3c", "#c2452d"],
    bone: ["#ffffff", "#effbe8", "#cdeec0", "#9fd39a", "#5a9a6a"],
  };
  // Energy thresholds for the bands, highest first.
  const BANDS = [0.92, 0.8, 0.66, 0.5, 0.3];
  const PROFILE = 1.08;

  // Distance from the axis where a beam of half width w falls to each band.
  // Profile: 1.08 * (1 - (d / (w + 2.5)) ^ 1.6).
  function bandWidths(w) {
    return BANDS.map((th) => (w + 2.5) * Math.pow(1 - th / PROFILE, 1 / 1.6));
  }

  // Seeded random, so one step's jitter draws the same way every frame of that step.
  function rng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
      s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
      return ((s >>> 0) % 10000) / 10000;
    };
  }

  // A filled disc in bands. r is the outer (deep) band radius.
  function disc(ctx, x, y, r, ramp, alpha = 1) {
    const c = RAMPS[ramp] || ramp;
    const bw = bandWidths(r - 2.5);
    x = Math.round(x); y = Math.round(y);
    ctx.globalAlpha = alpha * 0.25;
    ctx.fillStyle = c[3];
    ctx.beginPath(); ctx.arc(x, y, r + 2, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = alpha;
    for (let i = 4; i >= 0; i--) {
      if (bw[i] < 0.6) continue;
      ctx.fillStyle = c[i];
      ctx.beginPath(); ctx.arc(x, y, bw[i], 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // Four-ray star. Turns 45 degrees on odd phases so it flickers.
  function star(ctx, x, y, r, phase, ramp, alpha = 1) {
    const c = RAMPS[ramp] || ramp;
    x = Math.round(x); y = Math.round(y);
    const diag = phase % 2 === 1;
    ctx.globalAlpha = alpha;
    for (let k = 1; k <= r; k++) {
      ctx.fillStyle = k < r * 0.5 ? c[1] : c[3];
      if (diag) {
        ctx.fillRect(x + k, y + k, 1, 1); ctx.fillRect(x - k, y + k, 1, 1);
        ctx.fillRect(x + k, y - k, 1, 1); ctx.fillRect(x - k, y - k, 1, 1);
      } else {
        ctx.fillRect(x + k, y, 1, 1); ctx.fillRect(x - k, y, 1, 1);
        ctx.fillRect(x, y + k, 1, 1); ctx.fillRect(x, y - k, 1, 1);
      }
    }
    ctx.fillStyle = c[0];
    ctx.fillRect(x, y, 1, 1);
    ctx.globalAlpha = 1;
  }

  // Lightning by midpoint displacement: 1 px core and a 1 px glow cross.
  function bolt(ctx, x0, y0, x1, y1, ramp, rand, amp = 6, levels = 3) {
    const c = RAMPS[ramp] || ramp;
    let pts = [[x0, y0], [x1, y1]];
    for (let l = 0; l < levels; l++) {
      const next = [pts[0]];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        next.push([(ax + bx) / 2 + (rand() - 0.5) * amp * 0.4, (ay + by) / 2 + (rand() - 0.5) * amp], pts[i]);
      }
      pts = next;
      amp /= 2;
    }
    for (let pass = 0; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? c[3] : c[1];
      for (let i = 1; i < pts.length; i++) {
        const [ax, ay] = pts[i - 1];
        const [bx, by] = pts[i];
        const n = Math.max(1, Math.round(Math.max(Math.abs(bx - ax), Math.abs(by - ay))));
        for (let s = 0; s <= n; s++) {
          const px = Math.round(ax + ((bx - ax) * s) / n);
          const py = Math.round(ay + ((by - ay) * s) / n);
          if (pass === 0) { ctx.fillRect(px - 1, py, 3, 1); ctx.fillRect(px, py - 1, 1, 3); }
          else ctx.fillRect(px, py, 1, 1);
        }
      }
    }
    return pts;
  }

  // Ordered dither patterns, one per light level (1 to 4 of 4).
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  const patterns = {};
  function pattern(ctx, color, level) {
    const key = color + level;
    if (patterns[key]) return patterns[key];
    const cv = document.createElement("canvas");
    cv.width = 4; cv.height = 4;
    const g = cv.getContext("2d");
    g.fillStyle = color;
    for (let i = 0; i < 16; i++) if (BAYER[i] < level * 4) g.fillRect(i % 4, i >> 2, 1, 1);
    patterns[key] = ctx.createPattern(cv, "repeat");
    return patterns[key];
  }

  // A pool of light on the scene: three dithered rings, denser near the middle.
  function light(ctx, x, y, r, color, strength = 0.35) {
    if (r < 2) return;
    const prev = ctx.globalCompositeOperation;
    ctx.globalCompositeOperation = "lighter";
    ctx.globalAlpha = strength;
    for (let k = 3; k >= 1; k--) {
      ctx.fillStyle = pattern(ctx, color, k);
      ctx.beginPath(); ctx.arc(Math.round(x), Math.round(y), (r * (4 - k)) / 3, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = prev;
  }

  return { RAMPS, bandWidths, rng, disc, star, bolt, light };
})();
