// Every sound is synthesised at runtime — no audio files to download, and
// nothing to fail on a cold offline launch. iOS only allows an AudioContext to
// start inside a user gesture, so `unlock()` runs on the first touch.

let ctx = null;
let master = null;
let noiseBuffer = null;
let enabled = true;

function makeNoise() {
  const len = Math.floor(ctx.sampleRate * 0.5);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export const audio = {
  unlock() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.32;
    master.connect(ctx.destination);
    noiseBuffer = makeNoise();
    if (ctx.state === 'suspended') ctx.resume();
  },

  setEnabled(on) {
    enabled = on;
    if (master) master.gain.value = on ? 0.32 : 0;
  },

  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

  tone({ freq = 440, to = freq, time = 0.15, type = 'sine', gain = 0.3, delay = 0, curve = 'exp' }) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to !== freq) {
      if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + time);
      else osc.frequency.linearRampToValueAtTime(to, t + time);
    }
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + time);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + time + 0.02);
  },

  noise({ time = 0.2, gain = 0.3, freq = 1200, q = 1, type = 'bandpass', sweepTo = 0, delay = 0 }) {
    if (!ctx || !enabled) return;
    const t = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.setValueAtTime(freq, t);
    if (sweepTo) filt.frequency.exponentialRampToValueAtTime(Math.max(20, sweepTo), t + time);
    filt.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + time);
    src.connect(filt).connect(g).connect(master);
    src.start(t);
    src.stop(t + time + 0.02);
  },

  // --- game events -------------------------------------------------------
  // Frequent sounds are rate-limited so a volley of tower fire doesn't clip.
  _last: {},
  limit(key, gap) {
    if (!ctx) return false;
    const now = ctx.currentTime;
    if (now - (this._last[key] || 0) < gap) return false;
    this._last[key] = now;
    return true;
  },

  shoot() {
    if (!this.limit('shoot', 0.07)) return;
    this.noise({ time: 0.09, gain: 0.12, freq: 2200, sweepTo: 600, q: 0.9 });
    this.tone({ freq: 260, to: 120, time: 0.07, type: 'triangle', gain: 0.07 });
  },
  towerShot() {
    if (!this.limit('tower', 0.12)) return;
    this.noise({ time: 0.12, gain: 0.08, freq: 1200, sweepTo: 300, q: 1 });
    this.tone({ freq: 140, to: 70, time: 0.1, type: 'triangle', gain: 0.07 });
  },
  hit() {
    if (!this.limit('hit', 0.05)) return;
    this.tone({ freq: 180, to: 80, time: 0.08, type: 'square', gain: 0.05 });
    this.noise({ time: 0.06, gain: 0.08, freq: 700, q: 1.2 });
  },
  kill() {
    if (!this.limit('kill', 0.06)) return;
    this.noise({ time: 0.16, gain: 0.12, freq: 500, sweepTo: 150, q: 0.7 });
    this.tone({ freq: 320, to: 120, time: 0.14, type: 'triangle', gain: 0.07 });
  },
  pickup(streak) {
    if (!this.limit('pick', 0.045)) return;
    const f = 900 + Math.min(16, streak) * 45;
    this.tone({ freq: f, time: 0.06, type: 'square', gain: 0.05 });
    this.tone({ freq: f * 1.5, time: 0.08, type: 'square', gain: 0.04, delay: 0.035 });
  },
  spend() {
    if (!this.limit('spend', 0.05)) return;
    this.tone({ freq: 1250, to: 980, time: 0.05, type: 'square', gain: 0.045 });
  },
  build() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, time: 0.3, type: 'triangle', gain: 0.12, delay: i * 0.06 }));
    this.noise({ time: 0.35, gain: 0.15, freq: 300, sweepTo: 80, type: 'lowpass' });
  },
  buy() {
    this.tone({ freq: 660, time: 0.08, type: 'square', gain: 0.1 });
    this.tone({ freq: 990, time: 0.14, type: 'square', gain: 0.08, delay: 0.06 });
  },
  deny() {
    if (!this.limit('deny', 0.3)) return;
    this.tone({ freq: 200, to: 130, time: 0.16, type: 'square', gain: 0.1 });
  },
  tap() { this.tone({ freq: 700, time: 0.04, type: 'triangle', gain: 0.08 }); },
  hurt() {
    if (!this.limit('hurt', 0.25)) return;
    this.tone({ freq: 220, to: 90, time: 0.18, type: 'sawtooth', gain: 0.1 });
  },
  gate() {
    if (!this.limit('gate', 0.3)) return;
    this.noise({ time: 0.18, gain: 0.16, freq: 260, sweepTo: 90, type: 'lowpass' });
  },
  crash() {
    this.noise({ time: 0.7, gain: 0.35, freq: 800, sweepTo: 60, q: 0.6, type: 'lowpass' });
    this.tone({ freq: 90, to: 30, time: 0.5, type: 'sawtooth', gain: 0.16 });
  },
  slam() {
    this.noise({ time: 0.5, gain: 0.3, freq: 400, sweepTo: 50, type: 'lowpass' });
    this.tone({ freq: 70, to: 30, time: 0.4, type: 'sine', gain: 0.3 });
  },
  horn() {
    this.tone({ freq: 196, time: 0.9, type: 'sawtooth', gain: 0.08 });
    this.tone({ freq: 294, time: 0.9, type: 'sawtooth', gain: 0.06, delay: 0.05 });
    this.tone({ freq: 392, time: 0.7, type: 'triangle', gain: 0.06, delay: 0.35 });
  },
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, time: 0.4, type: 'triangle', gain: 0.13, delay: i * 0.09 }));
  },
  villager() { this.tone({ freq: 880, time: 0.08, type: 'sine', gain: 0.06 }); this.tone({ freq: 1320, time: 0.12, type: 'sine', gain: 0.05, delay: 0.07 }); },
  deliver() { if (this.limit('deliver', 0.2)) this.tone({ freq: 520, to: 640, time: 0.08, type: 'triangle', gain: 0.05 }); },
  defeat() {
    [523, 440, 349, 262].forEach((f, i) => this.tone({ freq: f, time: 0.6, type: 'triangle', gain: 0.15, delay: i * 0.16 }));
  },
  victory() {
    [392, 523, 659, 784, 1047, 1319].forEach((f, i) => this.tone({ freq: f, time: 0.5, type: 'triangle', gain: 0.13, delay: i * 0.1 }));
  },
};
