// Local persistence: settings plus the kingdom snapshot. The kingdom is only
// ever saved between waves, so a reload mid-wave replays that wave.

const KEY = 'crownfall.v1';

const DEFAULTS = {
  settings: { sound: true },
  kingdom: null,
};

let cache = null;

function read() {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = raw ? { ...DEFAULTS, ...JSON.parse(raw) } : structuredClone(DEFAULTS);
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
    /* Private mode or full storage: the game still plays, it just forgets. */
  }
}

export const save = {
  get settings() { return read().settings; },
  get kingdom() { return read().kingdom; },

  setSetting(key, value) {
    read().settings[key] = value;
    write();
  },

  saveKingdom(snapshot) {
    read().kingdom = snapshot;
    write();
  },

  clearKingdom() {
    read().kingdom = null;
    write();
  },
};
