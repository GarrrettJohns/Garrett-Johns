// All persistence lives here. Two buckets: lifetime stats/settings, and the
// snapshot of a run in progress so the game survives being swiped away.

const KEY = 'bowmaster.prelude.v1';

const DEFAULTS = {
  best: { wave: 0, score: 0, kills: 0, headshots: 0, runs: 0 },
  settings: { sound: true, guide: true },
  run: null,
};

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : structuredClone(DEFAULTS);
    cache.best = { ...DEFAULTS.best, ...cache.best };
    cache.settings = { ...DEFAULTS.settings, ...cache.settings };
  } catch {
    cache = structuredClone(DEFAULTS);
  }
  return cache;
}

function write() {
  try {
    localStorage.setItem(KEY, JSON.stringify(read()));
  } catch {
    /* private mode or full quota — the game still plays, it just forgets. */
  }
}

export const save = {
  get best() { return read().best; },
  get settings() { return read().settings; },
  get run() { return read().run; },

  setSetting(key, value) {
    read().settings[key] = value;
    write();
  },

  saveRun(snapshot) {
    read().run = snapshot;
    write();
  },

  clearRun() {
    read().run = null;
    write();
  },

  recordRun({ wave, score, kills, headshots }) {
    const b = read().best;
    b.runs += 1;
    b.kills += kills;
    b.headshots += headshots;
    b.wave = Math.max(b.wave, wave);
    b.score = Math.max(b.score, score);
    write();
  },

  wipe() {
    cache = structuredClone(DEFAULTS);
    write();
  },
};
