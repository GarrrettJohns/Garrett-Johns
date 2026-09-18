// Balance data and content tables for Bowmaster Prelude.
// Distances and sizes are in "world units"; the camera picks a scale so the
// battlefield fills the screen. Anything that moves is additionally multiplied
// by world.f (field factor) so a wave takes the same time to cross the field
// in portrait and in landscape.

export const BASE_FIELD = 1150; // field width the tuning numbers were written for

export const PHYS = {
  gravity: 1250,
  arrowSpeed: 1050, // at full draw, before upgrades
  minDraw: 0.34,
  drag: 0.02,
  enemyArrowSpeed: 620,
  boulderSpeed: 540,
};

export const TOWER = {
  x: 104,
  width: 92,
  height: 206,
  baseHp: 120,
};

export const ARCHER = {
  baseDamage: 18,
  headMultiplier: 2.75,
  legMultiplier: 0.65,
  reloadTime: 0.62,
};

// ---------------------------------------------------------------------------
// Enemies
// ---------------------------------------------------------------------------

export const ENEMIES = {
  grunt: {
    name: 'Footman', kind: 'soldier', cost: 8, unlockWave: 1,
    hp: 24, speed: 44, damage: 7, attackTime: 1.1, reach: 54, bounty: 8,
    height: 62, tint: '#e2564a',
  },
  runner: {
    name: 'Scout', kind: 'runner', cost: 11, unlockWave: 2,
    hp: 18, speed: 104, damage: 5, attackTime: 0.8, reach: 50, bounty: 11,
    height: 58, tint: '#f0a03c',
  },
  bowman: {
    name: 'Bowman', kind: 'archer', cost: 15, unlockWave: 3,
    hp: 22, speed: 48, damage: 6, attackTime: 2.2, reach: 420, bounty: 14,
    height: 60, tint: '#7fcf6a', ranged: 'arrow',
  },
  shield: {
    name: 'Shieldbearer', kind: 'shield', cost: 18, unlockWave: 4,
    hp: 52, speed: 33, damage: 10, attackTime: 1.3, reach: 56, bounty: 17,
    height: 64, tint: '#7ea6d8', shield: true,
  },
  rider: {
    name: 'Rider', kind: 'rider', cost: 28, unlockWave: 6,
    hp: 86, speed: 126, damage: 16, attackTime: 1.0, reach: 68, bounty: 27,
    height: 84, tint: '#d9605f',
  },
  siege: {
    name: 'Catapult', kind: 'siege', cost: 42, unlockWave: 8,
    hp: 130, speed: 21, damage: 30, attackTime: 4.2, reach: 640, bounty: 44,
    height: 96, tint: '#b98a4e', ranged: 'boulder', armor: 0.15,
  },
  brute: {
    name: 'Brute', kind: 'brute', cost: 62, unlockWave: 11,
    hp: 250, speed: 31, damage: 28, attackTime: 1.6, reach: 74, bounty: 66,
    height: 100, tint: '#9d5fd0', armor: 0.2,
  },
};
export const BOSSES = [
  { name: 'Warlord Karrik', kind: 'boss', hp: 620, speed: 32, damage: 42,
    attackTime: 1.5, reach: 90, bounty: 240, height: 136, tint: '#8f3b5e', armor: 0.22 },
  { name: 'Ironhide Gorr', kind: 'boss', hp: 900, speed: 28, damage: 52,
    attackTime: 1.6, reach: 96, bounty: 340, height: 148, tint: '#4f6f8f', armor: 0.28 },
  { name: 'The Black Marshal', kind: 'boss', hp: 1300, speed: 36, damage: 60,
    attackTime: 1.4, reach: 100, bounty: 460, height: 152, tint: '#2f3b4f', armor: 0.32 },
];

// ---------------------------------------------------------------------------
// Special arrows — unlocked in the shop, fired on a cooldown
// ---------------------------------------------------------------------------

export const AMMO = {
  normal: {
    name: 'Arrow', short: 'ARROW', glyph: '➶', color: '#e9d9b8',
    cooldown: 0, blurb: 'Your standard shaft. No cooldown.',
  },
  pierce: {
    name: 'Bodkin', short: 'BODKIN', glyph: '⟶', color: '#9fd6ff',
    cooldown: 7, unlock: 220, maxLevel: 4, upgrade: 190,
    blurb: 'Punches through shields and bodies.',
  },
  fire: {
    name: 'Fire Arrow', short: 'FIRE', glyph: '🔥', color: '#ff9b4a',
    cooldown: 8, unlock: 300, maxLevel: 4, upgrade: 240,
    blurb: 'Sets the target alight.',
  },
  frost: {
    name: 'Frost Arrow', short: 'FROST', glyph: '❄', color: '#8fe8ff',
    cooldown: 11, unlock: 380, maxLevel: 4, upgrade: 280,
    blurb: 'Bursts and slows everything nearby.',
  },
  bomb: {
    name: 'Bomb Arrow', short: 'BOMB', glyph: '💥', color: '#ffd166',
    cooldown: 14, unlock: 520, maxLevel: 4, upgrade: 360,
    blurb: 'Explodes for heavy area damage.',
  },
  storm: {
    name: 'Storm Volley', short: 'STORM', glyph: '⁂', color: '#c9a7ff',
    cooldown: 18, unlock: 640, maxLevel: 3, upgrade: 420,
    blurb: 'Looses a fan of arrows in one draw.',
  },
};

export const AMMO_ORDER = ['normal', 'pierce', 'fire', 'frost', 'bomb', 'storm'];

export function ammoStats(id, level) {
  const l = level || 0;
  switch (id) {
    case 'pierce': return { pierce: 2 + l, damage: 1.35 + 0.15 * l, cooldown: 7 - 0.6 * l };
    case 'fire': return { burnDps: 9 + 4 * l, burnTime: 4 + 0.5 * l, radius: 52 + 8 * l, cooldown: 8 - 0.7 * l };
    case 'frost': return { slow: 0.5 + 0.06 * l, slowTime: 3 + 0.5 * l, radius: 96 + 14 * l, damage: 0.7, cooldown: 11 - 0.9 * l };
    case 'bomb': return { blast: 44 + 18 * l, radius: 108 + 16 * l, cooldown: 14 - 1.1 * l };
    case 'storm': return { count: 5 + 2 * l, spread: 0.26, damage: 0.72, cooldown: 18 - 1.6 * l };
    default: return {};
  }
}

// ---------------------------------------------------------------------------
// Permanent-for-the-run upgrades
// ---------------------------------------------------------------------------

export const UPGRADES = [
  { id: 'power', name: 'Draw Weight', glyph: '🏹', max: 6, cost: 70, growth: 1.55,
    blurb: 'Arrows fly faster and further.',
    detail: (l) => `+${(l * 7)}% arrow speed` },
  { id: 'damage', name: 'Arrowheads', glyph: '⬧', max: 8, cost: 80, growth: 1.5,
    blurb: 'Sharper heads bite deeper.',
    detail: (l) => `+${l * 5} damage` },
  { id: 'nock', name: 'Quick Nock', glyph: '⏱', max: 5, cost: 110, growth: 1.6,
    blurb: 'Draw the next arrow sooner.',
    detail: (l) => `-${Math.round((1 - Math.pow(0.88, l)) * 100)}% reload` },
  { id: 'crit', name: 'Keen Eye', glyph: '◎', max: 4, cost: 160, growth: 1.7,
    blurb: 'Headshots hurt a great deal more.',
    detail: (l) => `×${(ARCHER.headMultiplier + 0.3 * l).toFixed(2)} headshots` },
  { id: 'tower', name: 'Battlements', glyph: '🛡', max: 6, cost: 120, growth: 1.5,
    blurb: 'More keep health, and a full repair.',
    detail: (l) => `+${l * 45} max HP` },
  { id: 'bounty', name: 'War Chest', glyph: '◈', max: 5, cost: 140, growth: 1.6,
    blurb: 'Every kill pays better.',
    detail: (l) => `+${l * 14}% gold` },
  { id: 'allies', name: 'Militia', glyph: '⚔', max: 5, cost: 180, growth: 1.55,
    blurb: 'Townsfolk march out to hold the line.',
    detail: (l) => l ? `${l} defender${l > 1 ? 's' : ''} per wave` : 'No defenders' },
];

export const REPAIR = { fraction: 0.4, cost: 90, growth: 1.35 };

// ---------------------------------------------------------------------------
// Waves
// ---------------------------------------------------------------------------

export const BOSS_EVERY = 5;

export function waveBudget(wave) {
  return Math.round(18 + wave * 10 + Math.pow(wave, 1.75));
}

export function waveScaling(wave) {
  return {
    hp: 1 + 0.10 * (wave - 1) + Math.pow(Math.max(0, wave - 10), 1.6) * 0.012,
    speed: Math.min(1.45, 1 + 0.016 * (wave - 1)),
    damage: 1 + 0.06 * (wave - 1),
  };
}

// Returns a spawn list: [{ type, at }] with `at` in seconds from wave start.
export function buildWave(wave, rand) {
  const pool = Object.entries(ENEMIES)
    .filter(([, e]) => wave >= e.unlockWave)
    .map(([id, e]) => ({ id, ...e }));

  let budget = waveBudget(wave);
  const picks = [];
  let bossEntry = null;

  if (wave % BOSS_EVERY === 0) {
    const boss = BOSSES[Math.min(BOSSES.length - 1, Math.floor(wave / BOSS_EVERY) - 1)];
    const tier = Math.floor(wave / (BOSS_EVERY * BOSSES.length));
    bossEntry = { type: 'boss', boss, tier };
    budget = Math.round(budget * 0.55);
  }

  let guard = 400;
  while (budget > 0 && guard-- > 0) {
    const affordable = pool.filter((e) => e.cost <= budget + 4);
    if (!affordable.length) break;
    // Weight toward the newer, costlier units as waves go up.
    const weights = affordable.map((e) => 1 + (wave - e.unlockWave) * 0.12 + (e.cost / 10) * 0.25);
    const total = weights.reduce((a, b) => a + b, 0);
    let roll = rand() * total;
    let pick = affordable[0];
    for (let i = 0; i < affordable.length; i++) {
      roll -= weights[i];
      if (roll <= 0) { pick = affordable[i]; break; }
    }
    picks.push({ type: pick.id });
    budget -= pick.cost;
  }

  // The boss walks in behind its escort rather than leading the charge.
  if (bossEntry) picks.splice(Math.floor(picks.length * 0.45), 0, bossEntry);

  // Spread the spawns out; later waves arrive thicker and faster.
  const gap = Math.max(0.55, 2.4 - wave * 0.06);
  let t = 0;
  const list = [];
  for (const p of picks) {
    list.push({ ...p, at: t });
    t += gap * (0.55 + rand() * 0.9);
  }
  return list.sort((a, b) => a.at - b.at);
}
