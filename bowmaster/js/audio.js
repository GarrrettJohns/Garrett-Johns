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
  draw() { this.noise({ time: 0.22, gain: 0.07, freq: 300, sweepTo: 900, q: 3 }); },
  shoot() {
    this.noise({ time: 0.12, gain: 0.3, freq: 1800, sweepTo: 400, q: 0.8 });
    this.tone({ freq: 220, to: 90, time: 0.1, type: 'triangle', gain: 0.16 });
  },
  hit() {
    this.tone({ freq: 160, to: 60, time: 0.12, type: 'square', gain: 0.14 });
    this.noise({ time: 0.09, gain: 0.18, freq: 500, q: 1.2 });
  },
  headshot() {
    this.tone({ freq: 1400, to: 900, time: 0.18, type: 'sine', gain: 0.22 });
    this.tone({ freq: 2100, to: 1500, time: 0.2, type: 'sine', gain: 0.12, delay: 0.03 });
    this.noise({ time: 0.12, gain: 0.2, freq: 900, q: 1 });
  },
  block() { this.noise({ time: 0.1, gain: 0.22, freq: 3200, q: 4 }); },
  explode() {
    this.noise({ time: 0.5, gain: 0.42, freq: 900, sweepTo: 60, q: 0.6, type: 'lowpass' });
    this.tone({ freq: 90, to: 30, time: 0.45, type: 'sawtooth', gain: 0.2 });
  },
  frost() {
    this.tone({ freq: 2400, to: 700, time: 0.4, type: 'sine', gain: 0.16 });
    this.noise({ time: 0.35, gain: 0.14, freq: 4000, sweepTo: 1200, q: 2 });
  },
  fire() { this.noise({ time: 0.4, gain: 0.16, freq: 700, sweepTo: 240, q: 0.8 }); },
  coin() {
    this.tone({ freq: 1180, time: 0.07, type: 'square', gain: 0.1 });
    this.tone({ freq: 1760, time: 0.09, type: 'square', gain: 0.09, delay: 0.05 });
  },
  towerHit() {
    this.tone({ freq: 120, to: 40, time: 0.35, type: 'sawtooth', gain: 0.24 });
    this.noise({ time: 0.3, gain: 0.2, freq: 400, sweepTo: 80, type: 'lowpass' });
  },
  waveStart() {
    [392, 523, 659].forEach((f, i) => this.tone({ freq: f, time: 0.45, type: 'triangle', gain: 0.13, delay: i * 0.09 }));
  },
  waveClear() {
    [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, time: 0.4, type: 'triangle', gain: 0.14, delay: i * 0.08 }));
  },
  buy() {
    this.tone({ freq: 660, time: 0.08, type: 'square', gain: 0.12 });
    this.tone({ freq: 990, time: 0.12, type: 'square', gain: 0.1, delay: 0.06 });
  },
  deny() { this.tone({ freq: 180, to: 120, time: 0.16, type: 'square', gain: 0.12 }); },
  gameOver() {
    [523, 440, 349, 262].forEach((f, i) => this.tone({ freq: f, time: 0.6, type: 'triangle', gain: 0.16, delay: i * 0.16 }));
  },
};
