// Sound effects made in code with ZzFX (zzfx.js) and the Web Audio API. Nothing is loaded from disk.
// If audio is unavailable, play() does nothing from then on.
//
// A preset is a list of layers: [ZzFX parameters, delay in seconds]. Parameter order:
// volume, randomness, frequency, attack, sustain, release, shape (0 sine, 1 triangle, 2 saw,
// 3 square-ish, 4 noise), shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime, repeatTime,
// noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo.
// Every play shifts the pitch by a random amount up to plus or minus PITCH_JITTER.
const PITCH_JITTER = 0.05;

const SFX_PRESETS = {
  jump: [[[0.5, 0, 330, 0.01, 0.04, 0.1, 1, 1, 3], 0]],
  // A crack of noise over a low thud.
  hit: [
    [[0.7, 0, 200, 0, 0.02, 0.1, 4, 1, -3, 0, 0, 0, 0, 0.8], 0],
    [[0.8, 0, 90, 0, 0.03, 0.14, 0, 1, -1], 0],
  ],
  pickup: [[[0.5, 0, 660, 0, 0.04, 0.15, 0, 1, 0, 0, 220, 0.06], 0]],
  hurt: [[[0.7, 0, 300, 0, 0.1, 0.25, 2, 1, -1.5, 0, 0, 0, 0, 0.3], 0]],
  // Charge hum rising into the zap, then a buzzing tail.
  beam: [
    [[0.4, 0, 220, 0.08, 0.02, 0.02, 0, 1, 12], 0],
    [[0.4, 0, 1400, 0, 0.05, 0.2, 2, 1, -8, 0, 0, 0, 0, 0.4], 0.1],
    [[0.3, 0, 110, 0.02, 0.15, 0.2, 3, 1, -0.2], 0.1],
  ],
  complete: [
    [[0.5, 0, 523, 0, 0.05, 0.1, 1], 0],
    [[0.5, 0, 659, 0, 0.05, 0.1, 1], 0.1],
    [[0.5, 0, 784, 0, 0.05, 0.1, 1], 0.2],
    [[0.5, 0, 1047, 0, 0.05, 0.15, 1], 0.3],
  ],
  boss: [[[0.8, 0, 110, 0, 0.1, 0.3, 2, 1, -0.3], 0]],
  bossdown: [[[0.8, 0, 110, 0, 0.2, 0.5, 2, 1, -0.4], 0]],
  // Used when a character is unknown.
  ability: [[[0.4, 0, 520, 0, 0.02, 0.05, 1], 0]],
};

// One timbre per character for its ability sound.
const SFX_ABILITY = {
  // Metal clang: two inharmonic partials and a tick.
  knight: [
    [[0.5, 0, 620, 0, 0.01, 0.22, 0], 0],
    [[0.35, 0, 1710, 0, 0.01, 0.14, 0], 0],
    [[0.3, 0, 3000, 0, 0, 0.03, 4, 1, 0, 0, 0, 0, 0, 1], 0],
  ],
  // String twang: a saw that sags in pitch, with a pluck tick.
  ranger: [
    [[0.45, 0, 520, 0, 0.02, 0.28, 2, 1, -1.2, 0, 0, 0, 0, 0, 0, 0, 0, 0.4], 0],
    [[0.25, 0, 2200, 0, 0, 0.02, 4, 1, 0, 0, 0, 0, 0, 1], 0],
  ],
  // Chime: a bell with a fifth above it.
  mage: [
    [[0.4, 0, 1320, 0, 0.02, 0.4, 0], 0],
    [[0.28, 0, 1980, 0, 0.02, 0.45, 0], 0.03],
  ],
  // Squeak: a short chirp that climbs.
  rat: [[[0.4, 0, 1800, 0.005, 0.02, 0.09, 0, 1, 12], 0]],
  // Bone click: two dry clicks.
  weaver: [
    [[0.5, 0, 1800, 0, 0.005, 0.04, 4, 1, 0, 0, 0, 0, 0, 1], 0],
    [[0.4, 0, 260, 0, 0.01, 0.06, 3, 1, -3], 0],
    [[0.4, 0, 1500, 0, 0.004, 0.03, 4, 1, 0, 0, 0, 0, 0, 1], 0.05],
  ],
};

const Sfx = {
  enabled: true,
  ctx: null,
  broken: false,

  // One ZzFX layer with a random pitch shift, started `delay` seconds from `start`.
  layer(params, start) {
    const p = params.slice();
    p[2] *= 1 + (Math.random() * 2 - 1) * PITCH_JITTER;
    const samples = zzfxG(...p);
    const buf = this.ctx.createBuffer(1, samples.length, zzfxR);
    buf.getChannelData(0).set(samples);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.ctx.destination);
    src.start(start);
  },

  // Browsers may leave a new AudioContext suspended until the player acts.
  resume() {
    try {
      if (this.ctx && this.ctx.state === "suspended") {
        const r = this.ctx.resume();
        if (r && r.catch) r.catch(() => {});
      }
    } catch (e) {
      // Nothing to do: sound stays quiet until the next gesture.
    }
  },

  // Makes the audio context once. Music shares it.
  init() {
    if (this.ctx || this.broken) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    this.ctx = new AC();
    window.addEventListener("keydown", () => this.resume(), { once: true });
    window.addEventListener("pointerdown", () => this.resume(), { once: true });
  },

  // `who` is the character id; it picks the timbre of "ability".
  play(name, who) {
    if (!this.enabled || this.broken) return;
    try {
      this.init();
      this.resume();
      // Stingers replace the plain tune while music is on.
      if (name === "pickup" && Music.stinger("card")) return;
      if (name === "complete" && Music.stinger("clear")) return;
      if (name === "bossdown" && Music.stinger("bossdown")) return;
      const layers = name === "ability" ? SFX_ABILITY[who] || SFX_PRESETS.ability : SFX_PRESETS[name];
      if (!layers) return;
      const t = this.ctx.currentTime;
      for (const [params, delay] of layers) this.layer(params, t + delay);
    } catch (e) {
      this.broken = true;
    }
  },
};
