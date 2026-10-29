// Sound effects made in code with the Web Audio API. Nothing is loaded from disk.
// If audio is unavailable, play() does nothing from then on.
const Sfx = {
  enabled: true,
  ctx: null,
  broken: false,

  // One oscillator note with a short attack and a fade-out.
  tone(type, f0, f1, start, dur, vol) {
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, start);
    if (f1) osc.frequency.linearRampToValueAtTime(f1, start + dur);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.linearRampToValueAtTime(vol, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.001, start + dur);
    osc.connect(gain);
    gain.connect(this.ctx.destination);
    osc.start(start);
    osc.stop(start + dur + 0.02);
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

  play(name) {
    if (!this.enabled || this.broken) return;
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        this.ctx = new AC();
        window.addEventListener("keydown", () => this.resume(), { once: true });
        window.addEventListener("pointerdown", () => this.resume(), { once: true });
      }
      this.resume();
      const t = this.ctx.currentTime;
      switch (name) {
        case "jump":
          this.tone("square", 440, 660, t, 0.1, 0.08);
          break;
        case "hit":
          // A thud under a short crack.
          this.tone("square", 220, null, t, 0.08, 0.1);
          this.tone("triangle", 110, 60, t, 0.12, 0.08);
          break;
        case "pickup":
          this.tone("triangle", 660, null, t, 0.06, 0.1);
          this.tone("triangle", 880, null, t + 0.06, 0.06, 0.1);
          break;
        case "hurt":
          this.tone("sawtooth", 300, 80, t, 0.3, 0.1);
          break;
        case "ability":
          this.tone("triangle", 520, null, t, 0.05, 0.06);
          break;
        case "beam":
          // Charge hum rising into the zap, then a buzzing tail.
          this.tone("sine", 220, 880, t, 0.1, 0.06);
          this.tone("sawtooth", 1400, 300, t + 0.1, 0.12, 0.05);
          this.tone("square", 110, 90, t + 0.1, 0.35, 0.04);
          break;
        case "complete":
          [523, 659, 784, 1047].forEach((f, i) => this.tone("triangle", f, null, t + i * 0.1, 0.1, 0.1));
          break;
        case "boss":
          this.tone("sawtooth", 110, null, t, 0.4, 0.12);
          break;
        default:
          break;
      }
    } catch (e) {
      this.broken = true;
    }
  },
};
