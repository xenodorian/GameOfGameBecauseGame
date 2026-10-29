// Music made in code. Songs are ZzFXM data built from simple chord loops (zzfx.js renders them).
// Each song is rendered once, the first time it is needed, into an AudioBuffer and then looped.
// Nothing is loaded from disk. Music waits for the first key press or tap (browser autoplay rules).

// ZzFX parameter order: volume, randomness, frequency, attack, sustain, release, shape (0 sine,
// 1 triangle, 2 saw, 3 square-ish, 4 noise), shapeCurve, slide, deltaSlide, pitchJump, pitchJumpTime,
// repeatTime, noise, modulation, bitCrush, delay, sustainVolume, decay, tremolo.
// Note 12 plays the instrument's base frequency; each step is one semitone.
const MUSIC_INSTR = {
  lead: [0.5, 0, 261.63, 0.01, 0.1, 0.14, 1],
  stab: [0.45, 0, 261.63, 0.005, 0.05, 0.08, 1],
  arp: [0.32, 0, 261.63, 0.005, 0.03, 0.2, 0],
  bass: [0.65, 0, 130.81, 0.01, 0.12, 0.15, 1],
  drone: [0.4, 0, 130.81, 0.4, 2.2, 0.6, 1],
  kick: [0.9, 0, 120, 0, 0.02, 0.12, 0, 1, -1.4],
  hat: [0.18, 0, 3000, 0, 0.004, 0.04, 4, 1, 0, 0, 0, 0, 0, 1],
  snare: [0.3, 0, 400, 0, 0.02, 0.12, 4, 1, 0, 0, 0, 0, 0, 2],
  tom: [0.7, 0, 90, 0, 0.03, 0.2, 0, 1, -0.5],
};
const MUSIC_ORDER = ["lead", "stab", "arp", "bass", "drone", "kick", "hat", "snare", "tom"];
const MI = {};
MUSIC_ORDER.forEach((k, i) => (MI[k] = i));

// Chords by name: bass root (semitones above C3), arp tones (above C4), and the root above C4.
const MUSIC_CHORDS = {
  C: { bass: 0, arp: [0, 4, 7] },
  G: { bass: -5, arp: [-1, 2, 7] },
  Am: { bass: -3, arp: [0, 4, 9] },
  F: { bass: -7, arp: [0, 5, 9] },
  Em: { bass: -8, arp: [-1, 4, 7] },
};

// One bar is 16 slots (sixteenth notes). These helpers fill a 16 slot channel.
function musicSlots(fn) {
  const a = [];
  for (let i = 0; i < 16; i++) a.push(fn(i) || 0);
  return a;
}

// Lead: 8 eighth-note entries (offsets above C4, null for rest) placed on even slots.
function musicLead(inst, notes) {
  return [MI[inst], -0.3, ...musicSlots((i) => (i % 2 === 0 && notes[i / 2] != null ? notes[i / 2] + 12 : 0))];
}

function musicArp(chord, step) {
  const t = MUSIC_CHORDS[chord].arp;
  const seq = [t[0], t[1], t[2], t[1]];
  return [MI.arp, 0.3, ...musicSlots((i) => (i % step === 0 ? seq[(i / step) % 4] + 12 : 0))];
}

function musicBass(chord, hits) {
  const r = MUSIC_CHORDS[chord].bass + 12;
  return [MI.bass, 0, ...musicSlots((i) => (hits[i] === undefined ? 0 : r + hits[i]))];
}

function musicDrums(inst, slots, pan) {
  return [MI[inst], pan || 0, ...musicSlots((i) => (slots.indexOf(i) >= 0 ? 12 : 0))];
}

// Each song: bpm, bars. A bar is {chord, melody}. build() makes the ZzFXM data.
const MUSIC_SONGS = {
  // Field: C major, I V vi IV, twice with a different melody the second time. 8 bars at 110 bpm = 17.5 s.
  field: {
    bpm: 110,
    bar(chord, melody) {
      return [
        musicLead("lead", melody),
        musicArp(chord, 2),
        musicBass(chord, { 0: 0, 4: 0, 8: 7, 12: 0 }),
        musicDrums("kick", [0, 8]),
        musicDrums("hat", [2, 6, 10, 14], 0.2),
      ];
    },
    bars: [
      ["C", [16, null, 19, null, 16, 12, 14, null]],
      ["G", [14, null, 19, null, 14, 11, 14, null]],
      ["Am", [12, null, 16, null, 21, null, 19, 16]],
      ["F", [17, null, 21, null, 17, 16, 12, null]],
      ["C", [19, null, 24, null, 19, 16, 19, null]],
      ["G", [23, null, 19, null, 14, null, 19, null]],
      ["Am", [21, null, 19, null, 16, null, 12, 16]],
      ["F", [17, null, 16, null, 14, null, 12, null]],
    ],
  },
  // Dungeon: A minor, i VI III VII (Am F C G), slow, with a low drone. 8 bars at 84 bpm = 22.9 s.
  dungeon: {
    bpm: 84,
    bar(chord, melody) {
      const r = MUSIC_CHORDS[chord].bass + 12;
      return [
        musicLead("lead", melody),
        musicArp(chord, 4),
        [MI.drone, -0.2, r, ...musicSlots(() => 0).slice(1)],
        musicBass(chord, { 0: 0, 8: 0 }),
        musicDrums("kick", [0]),
        musicDrums("tom", [10], 0.2),
      ];
    },
    bars: [
      ["Am", [16, null, null, null, 12, null, 14, null]],
      ["F", [17, null, null, null, 12, null, null, null]],
      ["C", [19, null, 16, null, null, null, 12, null]],
      ["G", [14, null, null, null, 11, null, 14, null]],
      ["Am", [21, null, null, null, 19, null, 16, null]],
      ["F", [17, null, 16, null, 12, null, null, null]],
      ["C", [16, null, 19, null, 24, null, 19, null]],
      ["G", [14, null, 11, null, 14, null, null, null]],
    ],
  },
};

// Builds a song's ZzFXM arguments: instruments, patterns, sequence, bpm.
function musicBuild(name) {
  const s = MUSIC_SONGS[name];
  const patterns = s.bars.map(([chord, melody]) => s.bar(chord, melody));
  return [MUSIC_ORDER.map((k) => MUSIC_INSTR[k]), patterns, patterns.map((_, i) => i), s.bpm];
}

// Renders a song to [left, right] arrays scaled so the peak is at most `peak`.
function musicRender(name, peak) {
  const out = zzfxM(...musicBuild(name));
  let max = 0;
  for (const ch of out) for (let i = 0; i < ch.length; i++) max = Math.max(max, Math.abs(ch[i]));
  const k = max > 0 ? (peak || 0.85) / max : 1;
  return out.map((ch) => Float32Array.from(ch, (v) => v * k));
}

const Music = {
  enabled: true,
  started: false,
  wanted: null,
  current: null,
  master: null,
  buffers: {},
  VOLUME: 0.35,
  FADE: 0.8,

  loadSetting() {
    try {
      this.enabled = window.localStorage.getItem("changeling_music") !== "0";
    } catch (e) {
      this.enabled = true;
    }
  },

  saveSetting() {
    try {
      window.localStorage.setItem("changeling_music", this.enabled ? "1" : "0");
    } catch (e) {
      // Storage may be blocked. The choice then lasts for this visit only.
    }
  },

  // The audio context is shared with Sfx.
  ensure() {
    if (this.master) return true;
    Sfx.init();
    if (!Sfx.ctx) return false;
    this.master = Sfx.ctx.createGain();
    this.master.gain.value = this.VOLUME;
    this.master.connect(Sfx.ctx.destination);
    return true;
  },

  buffer(name) {
    if (!this.buffers[name]) {
      const [l, r] = musicRender(name);
      const buf = Sfx.ctx.createBuffer(2, l.length, zzfxR);
      buf.getChannelData(0).set(l);
      buf.getChannelData(1).set(r);
      this.buffers[name] = buf;
    }
    return this.buffers[name];
  },

  // Renders the other songs one at a time, so a level change does not stall.
  prewarm() {
    const todo = Object.keys(MUSIC_SONGS).filter((n) => !this.buffers[n]);
    if (!todo.length) return;
    try {
      this.buffer(todo[0]);
    } catch (e) {
      return;
    }
    setTimeout(() => this.prewarm(), 500);
  },

  // First key press or tap.
  start() {
    if (this.started) return;
    try {
      if (!this.ensure()) return;
      Sfx.resume();
      this.started = true;
      this.apply();
      setTimeout(() => this.prewarm(), 3000);
    } catch (e) {
      this.started = false;
    }
  },

  // Asks for a theme ("field", "dungeon", or null for silence). Plays as soon as it may.
  setTheme(name) {
    this.wanted = name;
    this.apply();
  },

  // Crossfades from the current loop to the wanted one.
  apply() {
    if (!this.started) return;
    const want = this.enabled ? this.wanted : null;
    if (want === this.current) return;
    try {
      const ctx = Sfx.ctx;
      const t = ctx.currentTime;
      if (this.node) {
        const old = this.node;
        old.gain.gain.cancelScheduledValues(t);
        old.gain.gain.setValueAtTime(old.gain.gain.value, t);
        old.gain.gain.linearRampToValueAtTime(0, t + this.FADE);
        old.src.stop(t + this.FADE + 0.05);
        this.node = null;
      }
      this.current = want;
      if (!want) return;
      const src = ctx.createBufferSource();
      src.buffer = this.buffer(want);
      src.loop = true;
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(1, t + this.FADE);
      src.connect(gain);
      gain.connect(this.master);
      src.start(t);
      this.node = { src, gain };
    } catch (e) {
      this.current = null;
    }
  },

  toggle() {
    this.enabled = !this.enabled;
    this.saveSetting();
    this.apply();
  },
};

Music.loadSetting();
if (typeof window !== "undefined" && window.addEventListener) {
  ["keydown", "pointerdown", "touchend"].forEach((ev) => window.addEventListener(ev, () => Music.start(), { once: true }));
}
