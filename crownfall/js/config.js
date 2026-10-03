// All balance data lives here: buildings, upgrades, units, enemies, waves.
// Costs are { gold, wood, stone }. Gold is paid in from the king's coin stack
// a little at a time; wood and stone come out of the kingdom stores when the
// gold is complete.

export const FINAL_WAVE = 15;

export const HERO = {
  hp: 100,
  speed: 7,
  damage: 12,
  interval: 0.7,
  range: 9,
  carry: 60,
  magnet: 2.6,
  regen: 4,           // hp/s once out of combat
  regenDelay: 3,
  respawn: 5,
  radius: 0.8,
};

// Hero upgrades. Each entry: per-level values (index 0 = base) and costs to
// reach level i+1.
export const HERO_UPGRADES = {
  // Archery Range
  damage: {
    at: 'range', icon: '🎯', name: 'Arrow damage', unit: '',
    values: [12, 16, 21, 28, 37, 48],
    costs: [{ gold: 40 }, { gold: 80, wood: 20 }, { gold: 140, wood: 40 }, { gold: 220, stone: 60 }, { gold: 340, stone: 100 }],
  },
  rate: {
    at: 'range', icon: '⚡', name: 'Fire rate', unit: '/s',
    values: [1.33, 1.6, 1.9, 2.25, 2.65, 3.1],
    costs: [{ gold: 40 }, { gold: 80, wood: 20 }, { gold: 140, wood: 40 }, { gold: 220, stone: 60 }, { gold: 340, stone: 100 }],
  },
  range: {
    at: 'range', icon: '🔭', name: 'Bow range', unit: 'm',
    values: [9, 10.5, 12, 13.5, 15],
    costs: [{ gold: 60, wood: 10 }, { gold: 120, wood: 30 }, { gold: 200, stone: 50 }, { gold: 300, stone: 80 }],
  },
  // Stable
  speed: {
    at: 'stable', icon: '🐎', name: 'Horse speed', unit: 'm/s',
    values: [7, 8, 9, 10, 11, 12],
    costs: [{ gold: 30 }, { gold: 60, wood: 15 }, { gold: 110, wood: 30 }, { gold: 180, stone: 40 }, { gold: 260, stone: 70 }],
  },
  hp: {
    at: 'stable', icon: '❤️', name: 'Horse health', unit: 'hp',
    values: [100, 140, 190, 250, 330, 430],
    costs: [{ gold: 40 }, { gold: 80, wood: 20 }, { gold: 140, wood: 40 }, { gold: 220, stone: 60 }, { gold: 320, stone: 90 }],
  },
  carry: {
    at: 'stable', icon: '🎒', name: 'Saddlebags', unit: 'coins',
    values: [60, 120, 200, 320, 500, 800],
    costs: [{ gold: 40 }, { gold: 90, wood: 20 }, { gold: 160, wood: 40 }, { gold: 250, stone: 50 }, { gold: 400, stone: 90 }],
  },
  magnet: {
    at: 'stable', icon: '🧲', name: 'Coin magnet', unit: 'm',
    values: [2.6, 3.8, 5, 6.5, 8],
    costs: [{ gold: 30 }, { gold: 70, wood: 15 }, { gold: 130, wood: 30 }, { gold: 200, stone: 40 }],
  },
};

// Weapons. The king carries one at a time; unlock at the Archery Range.
export const WEAPONS = {
  bow: { name: 'Longbow', icon: '🏹', desc: 'Quick, reliable single arrows.', dmg: 1, interval: 1, speed: 34 },
  crossbow: {
    name: 'Crossbow', icon: '🎯', desc: 'Heavy bolts that punch through the first foe into the next.',
    dmg: 2.3, interval: 1.7, speed: 44, pierce: 1, cost: { gold: 90, wood: 30 }, castle: 2,
  },
  fire: {
    name: 'Fire arrows', icon: '🔥', desc: 'Set foes ablaze and splash the ones beside them.',
    dmg: 0.9, interval: 1.05, speed: 32, burn: 0.5, splash: 1.8, cost: { gold: 160, stone: 50 }, castle: 3,
  },
  multi: {
    name: 'Multishot', icon: '🌟', desc: 'Loose three arrows at three different targets.',
    dmg: 0.75, interval: 1.15, speed: 34, count: 3, cost: { gold: 220, wood: 60, stone: 40 }, castle: 3,
  },
};

// Buildings. `size` is the footprint in metres (square). `place` buildings
// are put down by the king inside the walls; the rest are fixed pads.
export const BUILDINGS = {
  castle: {
    name: 'Castle', icon: '🏰', size: 9,
    desc: 'The heart of the kingdom. If it falls, the kingdom falls.',
    levels: [
      { hp: 900 },
      { hp: 1250, cost: { gold: 120, wood: 40 } },
      { hp: 1700, cost: { gold: 280, wood: 90, stone: 60 } },
      { hp: 2200, cost: { gold: 520, wood: 160, stone: 150 } },
    ],
  },
  house: {
    name: 'House', icon: '🏠', size: 4, place: true,
    desc: 'Villagers need a roof. Free beds bring new families.',
    levels: [
      { beds: 4, cost: { gold: 20 } },
      { beds: 6, cost: { gold: 35, wood: 20 } },
      { beds: 9, cost: { gold: 70, stone: 30 } },
    ],
  },
  farm: {
    name: 'Farm', icon: '🌾', size: 6, place: true,
    desc: 'Fed families grow faster. Needs a farmer.',
    levels: [
      { growth: 0.6, workers: 1, cost: { gold: 30 } },
      { growth: 1.1, workers: 2, cost: { gold: 50, wood: 25 } },
      { growth: 1.7, workers: 2, cost: { gold: 90, stone: 30 } },
    ],
  },
  barracks: {
    name: 'Barracks', icon: '⚔️', size: 6, place: true, castle: 2,
    desc: 'Turn villagers into soldiers.',
    levels: [
      { army: 6, cost: { gold: 60, wood: 30 } },
      { army: 10, cost: { gold: 120, wood: 50 } },
      { army: 16, cost: { gold: 220, stone: 80 } },
    ],
  },
  stable: {
    name: 'Stable', icon: '🐴', size: 6, place: true, castle: 2,
    desc: 'Upgrade the king’s horse.',
    levels: [{ cost: { gold: 50, wood: 25 } }],
  },
  range: {
    name: 'Archery Range', icon: '🏹', size: 6, place: true, castle: 2,
    desc: 'Upgrade the king’s bow and unlock new weapons.',
    levels: [{ cost: { gold: 60, wood: 30 } }],
  },
  goldmine: {
    name: 'Gold Mine', icon: '⛏️', size: 5,
    desc: 'Miners dig coins into a pile. Ride by to scoop them up.',
    levels: [
      { workers: 2, every: 2.4, pile: 80, cost: { gold: 10 } },
      { workers: 3, every: 2.0, pile: 150, cost: { gold: 60, wood: 25 } },
      { workers: 4, every: 1.6, pile: 260, cost: { gold: 140, stone: 50 } },
    ],
  },
  bridge: {
    name: 'Forest Bridge', icon: '🌉', size: 5,
    desc: 'Opens the road into the forest.',
    levels: [{ cost: { gold: 40 } }],
  },
  lumber: {
    name: 'Lumber Camp', icon: '🪓', size: 5, needs: 'bridge',
    desc: 'Woodcutters fell pines and haul the logs to the castle.',
    levels: [
      { workers: 2, work: 5, carry: 3, cost: { gold: 25 } },
      { workers: 3, work: 4, carry: 4, cost: { gold: 60, wood: 30 } },
      { workers: 3, work: 3.2, carry: 6, cost: { gold: 110, stone: 40 } },
    ],
  },
  quarry: {
    name: 'Quarry', icon: '🪨', size: 5, castle: 2,
    desc: 'Masons cut stone and cart it to the castle.',
    levels: [
      { workers: 2, work: 6, carry: 3, cost: { gold: 50, wood: 30 } },
      { workers: 3, work: 5, carry: 4, cost: { gold: 90, wood: 40 } },
      { workers: 3, work: 4, carry: 6, cost: { gold: 160, wood: 60 } },
    ],
  },
  tower: {
    name: 'Tower', icon: '🗼', size: 3.2,
    desc: 'Shoots on its own. Archers posted inside add more arrows.',
    levels: [
      { name: 'Archer Tower', dmg: 10, interval: 0.9, range: 11, slots: 1, cost: { gold: 30 } },
      { name: 'Stone Tower', dmg: 15, interval: 0.85, range: 13, slots: 2, cost: { gold: 70, stone: 30 }, castle: 2 },
      { name: 'Ballista', dmg: 34, interval: 1.3, range: 15, slots: 3, pierce: 3, cost: { gold: 140, wood: 40, stone: 50 }, castle: 3 },
    ],
  },
};

// Walls and gates, bought from the castle.
export const WALLS = {
  levels: [
    { radius: 17 },
    { radius: 23, cost: { gold: 80, wood: 60 }, castle: 2 },
    { radius: 30, cost: { gold: 180, wood: 90, stone: 80 }, castle: 3 },
  ],
  gates: [
    { name: 'Palisade gates', hp: 450 },
    { name: 'Stone gates', hp: 800, cost: { gold: 120, stone: 60 }, castle: 2 },
    { name: 'Iron gates', hp: 1600, cost: { gold: 260, stone: 140 }, castle: 3 },
  ],
};

// Soldiers. Each one is a villager who signed up, so they need a free villager
// and count against housing.
export const UNITS = {
  knight: {
    name: 'Knight', icon: '🛡️', desc: 'Rides at the king’s side and fights whatever he fights.',
    hp: 90, dmg: 9, interval: 0.9, range: 1.5, speed: 6.6, cost: { gold: 14 },
  },
  archer: {
    name: 'Archer', icon: '🏹', desc: 'Heads straight to a tower post. With none free, guards a gate.',
    hp: 45, dmg: 7, interval: 1.1, range: 10, speed: 4.5, cost: { gold: 12 },
  },
  raider: {
    name: 'Raider', icon: '🗡️', desc: 'Charges the nearest enemy anywhere in the kingdom.',
    hp: 70, dmg: 13, interval: 0.8, range: 1.5, speed: 6.2, cost: { gold: 18, wood: 5 }, barracks: 2,
  },
};

export const ARMOR_UPGRADE = {
  icon: '🪖', name: 'Soldier armour',
  values: [1, 1.3, 1.65, 2.05],
  costs: [{ gold: 60, wood: 20 }, { gold: 120, stone: 40 }, { gold: 220, stone: 90 }],
};

export const VILLAGER = { speed: 3.2, growthEvery: 22, startPop: 3 };

export const ENEMIES = {
  grunt: { name: 'Grunt', hp: 30, dmg: 5, interval: 1, range: 1.3, speed: 2.3, aggro: 5, coins: 2, radius: 0.5 },
  brute: { name: 'Brute', hp: 170, dmg: 18, interval: 1.4, range: 1.7, speed: 1.45, aggro: 4.5, coins: 6, radius: 0.85, armor: 3, scale: 1.55 },
  archer: { name: 'Bowman', hp: 24, dmg: 6, interval: 1.5, range: 9, speed: 2.1, aggro: 9, coins: 3, radius: 0.5, ranged: true },
  raider: { name: 'Outrider', hp: 42, dmg: 7, interval: 0.8, range: 1.4, speed: 4.6, aggro: 0, coins: 3, radius: 0.55 },
  boss: { name: 'Warlord', hp: 1100, dmg: 34, interval: 1.7, range: 2.6, speed: 1.25, aggro: 6, coins: 60, radius: 1.5, armor: 2, scale: 2.8, slam: 3.2 },
};

const BOSS_NAMES = { 5: 'Warlord Grosk', 10: 'Warlord Vexa', 15: 'The Iron King' };

// Wave n: what spawns, from which lanes, and how hard it hits.
export function waveSpec(n, lanesOpen) {
  const hpMul = 1 + 0.1 * (n - 1) + 0.004 * (n - 1) ** 2;
  const groups = [];
  const add = (kind, count) => { if (count > 0) groups.push({ kind, count }); };
  add('grunt', 5 + Math.round(n * 2.3));
  add('brute', n >= 3 ? Math.floor((n - 1) / 2) : 0);
  add('archer', n >= 4 ? Math.floor(n / 1.6) : 0);
  add('raider', n >= 6 ? Math.round((n - 4) * 1.2) : 0);

  let boss = null;
  if (n % 5 === 0) {
    const tier = n / 5;
    boss = {
      kind: 'boss',
      name: BOSS_NAMES[n] || `Warlord of wave ${n}`,
      hpMul: [1, 0.8, 1.4, 2.2][Math.min(3, tier)] * (n > 15 ? 1 + (n - 15) * 0.25 : 1),
      coins: [0, 60, 120, 250][Math.min(3, tier)] || 250,
      scale: n >= 15 ? 3.4 : 2.8,
    };
  }

  const total = groups.reduce((a, g) => a + g.count, 0) + (boss ? 1 : 0);
  return {
    n,
    hpMul,
    dmgMul: 1 + 0.05 * (n - 1),
    groups,
    boss,
    total,
    lanes: lanesOpen,
    spawnGap: Math.max(0.35, 1.1 - n * 0.05),
    bonus: 15 + n * 6,
  };
}
