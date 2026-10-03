// Every sound is synthesised at runtime, so there are no files to download.
// iOS only lets audio start inside a touch, so unlock() runs on the first one.

let ctx = null, master = null, sfx = null, music = null, noise = null;
let sfxOn = true, musicOn = true;
const last = {};

function makeNoise() {
  const len = Math.floor(ctx.sampleRate * 0.6);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

// Don't stack the same sound many times in one instant.
function gate(name, gap) {
  const t = performance.now();
  if (last[name] && t - last[name] < gap) return false;
  last[name] = t;
  return true;
}

function tone({ freq = 440, to = freq, time = 0.15, type = 'sine', gain = 0.3, delay = 0, out = sfx }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (to !== freq) o.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + time);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + time);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + time + 0.05);
}

function hiss({ time = 0.1, freq = 2000, q = 1, gain = 0.3, delay = 0, type = 'bandpass' }) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  const s = ctx.createBufferSource();
  s.buffer = noise;
  const f = ctx.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + time);
  s.connect(f).connect(g).connect(sfx);
  s.start(t, Math.random() * 0.3);
  s.stop(t + time + 0.05);
}

// Plastic bricks clicking together.
function click(delay = 0, pitch = 1) {
  hiss({ time: 0.035, freq: 3800 * pitch, q: 3, gain: 0.35, delay });
  tone({ freq: 1900 * pitch, to: 1500 * pitch, time: 0.03, type: 'square', gain: 0.05, delay });
}

// ------------------------------------------------------------- music
// A short, bouncy march, looped.
const SONG = {
  bpm: 112,
  lead: 'E4 G4 A4 B4 | A4 G4 E4 D4 | E4 G4 A4 C5 | B4 . G4 . | C5 B4 A4 G4 | A4 B4 G4 E4 | D4 E4 G4 A4 | G4 . . . |',
  bass: 'E2 B2 E2 B2 | A2 E3 A2 E3 | E2 B2 E2 B2 | G2 D3 G2 D3 | C3 G2 C3 G2 | A2 E3 A2 E3 | D3 A2 D3 A2 | G2 D3 G2 . |',
};
const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const hz = (n) => 440 * Math.pow(2, ((parseInt(n.slice(-1), 10) + 1) * 12 + NOTE[n[0]] + (n[1] === '#' ? 1 : 0) - 69) / 12);
const parse = (s) => s.replace(/\|/g, ' ').trim().split(/\s+/);
let songT = 0, songStep = 0, songTimer = null;

function scheduleSong() {
  if (!ctx || !musicOn) return;
  const lead = parse(SONG.lead), bass = parse(SONG.bass);
  const step = 60 / SONG.bpm / 2;
  while (songT < ctx.currentTime + 0.4) {
    const i = songStep % lead.length;
    const delay = Math.max(0, songT - ctx.currentTime);
    if (lead[i] !== '.') tone({ freq: hz(lead[i]), time: step * 1.6, type: 'triangle', gain: 0.11, delay, out: music });
    if (bass[i] !== '.') tone({ freq: hz(bass[i]), time: step * 0.9, type: 'square', gain: 0.035, delay, out: music });
    if (songStep % 2 === 0) {
      const t = songT;
      const s = ctx.createBufferSource(); s.buffer = noise;
      const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 6000;
      const g = ctx.createGain(); g.gain.setValueAtTime(songStep % 8 === 4 ? 0.05 : 0.02, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
      s.connect(f).connect(g).connect(music); s.start(t, Math.random() * 0.3); s.stop(t + 0.08);
    }
    songT += step;
    songStep++;
  }
}

export const audio = {
  unlock() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
    sfx = ctx.createGain(); sfx.gain.value = sfxOn ? 0.8 : 0; sfx.connect(master);
    music = ctx.createGain(); music.gain.value = musicOn ? 0.55 : 0; music.connect(master);
    noise = makeNoise();
    if (ctx.state === 'suspended') ctx.resume();
  },
  setSfx(on) { sfxOn = on; if (sfx) sfx.gain.value = on ? 0.8 : 0; },
  setMusic(on) { musicOn = on; if (music) music.gain.value = on ? 0.55 : 0; },
  startMusic() {
    if (!ctx) return;
    clearInterval(songTimer);
    songT = ctx.currentTime + 0.1; songStep = 0;
    songTimer = setInterval(scheduleSong, 150);
  },
  stopMusic() { clearInterval(songTimer); songTimer = null; },
  suspend() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); },

  ui() { if (gate('ui', 40)) click(0, 1.2); },
  select() { if (gate('sel', 60)) { tone({ freq: 660, to: 880, time: 0.08, type: 'triangle', gain: 0.12 }); } },
  order() { if (gate('ord', 60)) { tone({ freq: 520, to: 700, time: 0.07, type: 'square', gain: 0.05 }); click(0.02); } },
  error() { if (gate('err', 200)) tone({ freq: 200, to: 150, time: 0.18, type: 'square', gain: 0.08 }); },
  chop(kind) { if (gate('chop', 90)) { if (kind === 'tree') { hiss({ time: 0.06, freq: 900, q: 2, gain: 0.25 }); tone({ freq: 240, to: 160, time: 0.06, type: 'triangle', gain: 0.12 }); } else { click(0, 0.8); tone({ freq: 1200, to: 900, time: 0.05, type: 'square', gain: 0.04 }); } } },
  hammer() { if (gate('ham', 110)) { click(0, 0.9); click(0.05, 1.1); } },
  deposit() { if (gate('dep', 80)) { click(0); click(0.04, 1.15); click(0.08, 1.3); } },
  sword() { if (gate('sw', 70)) { hiss({ time: 0.07, freq: 5000, q: 0.8, gain: 0.18 }); tone({ freq: 1400, to: 900, time: 0.08, type: 'square', gain: 0.04 }); } },
  arrow() { if (gate('ar', 70)) hiss({ time: 0.12, freq: 2600, q: 1.5, gain: 0.12, type: 'bandpass' }); },
  shot() { if (gate('sh', 70)) { hiss({ time: 0.14, freq: 1200, q: 0.6, gain: 0.35, type: 'lowpass' }); tone({ freq: 160, to: 60, time: 0.12, type: 'square', gain: 0.08 }); } },
  boom() { if (gate('bm', 90)) { hiss({ time: 0.35, freq: 500, q: 0.5, gain: 0.5, type: 'lowpass' }); tone({ freq: 110, to: 35, time: 0.35, type: 'sine', gain: 0.4 }); } },
  die() {
    if (!gate('die', 60)) return;
    for (let i = 0; i < 6; i++) click(i * 0.025 + Math.random() * 0.02, 0.8 + Math.random() * 0.5);
  },
  collapse() {
    for (let i = 0; i < 22; i++) click(i * 0.03 + Math.random() * 0.03, 0.6 + Math.random() * 0.6);
    hiss({ time: 0.6, freq: 400, q: 0.4, gain: 0.35, type: 'lowpass' });
  },
  stud(kind) {
    const base = kind === 'blue' ? 1320 : kind === 'gold' ? 1100 : 990;
    if (!gate('stud', 40)) return;
    tone({ freq: base, time: 0.09, type: 'square', gain: 0.05 });
    tone({ freq: base * 1.5, time: 0.14, type: 'square', gain: 0.05, delay: 0.06 });
  },
  built() { [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, time: 0.16, type: 'triangle', gain: 0.14, delay: i * 0.08 })); },
  trained() { tone({ freq: 784, time: 0.1, type: 'triangle', gain: 0.12 }); tone({ freq: 1047, time: 0.16, type: 'triangle', gain: 0.12, delay: 0.08 }); },
  place() { click(0); click(0.06, 0.9); },
  rally() { [392, 523, 659, 784].forEach((f, i) => tone({ freq: f, time: 0.3, type: 'sawtooth', gain: 0.07, delay: i * 0.1 })); },
  broadside() { for (let i = 0; i < 5; i++) { tone({ freq: 90, to: 40, time: 0.3, gain: 0.3, delay: i * 0.15 }); hiss({ time: 0.25, freq: 600, gain: 0.3, type: 'lowpass', delay: i * 0.15 }); } },
  alarm() { if (gate('alarm', 6000)) { tone({ freq: 880, time: 0.14, type: 'square', gain: 0.06 }); tone({ freq: 660, time: 0.18, type: 'square', gain: 0.06, delay: 0.16 }); } },
  win() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone({ freq: f, time: 0.3, type: 'triangle', gain: 0.18, delay: i * 0.14 })); },
  lose() { [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, time: 0.4, type: 'triangle', gain: 0.18, delay: i * 0.22 })); },
};
