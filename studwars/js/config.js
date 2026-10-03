// Every number that shapes a match: factions, units, buildings, resources and
// how hard the computer plays.

export const MAP_N = 64;          // the map is MAP_N x MAP_N cells, one world unit each
export const POP_MAX = 40;
export const START_BRICKS = 200;

export const FACTIONS = {
  knights: {
    name: 'Knights', color: 0x2f6fdc, ui: '#2f6fdc',
    builder: 'kBuilder', hero: 'kKing',
    army: ['kSoldier', 'kArcher', 'kRider'],
    names: { keep: 'Castle Keep', farm: 'Farm', barracks: 'Barracks', tower: 'Archer Tower', depot: 'Brick Depot' },
  },
  pirates: {
    name: 'Pirates', color: 0xd03a2c, ui: '#d03a2c',
    builder: 'pBuilder', hero: 'pCaptain',
    army: ['pSwabbie', 'pGunner', 'pCannon'],
    names: { keep: 'Pirate Fort', farm: 'Fish Shack', barracks: 'Tavern', tower: 'Cannon Tower', depot: 'Treasure Cove' },
  },
};

// role: builder | melee | ranged | heavy | hero
// range is measured from the unit's edge to the target's edge.
export const UNITS = {
  kBuilder: { name: 'Builder', faction: 'knights', role: 'builder', icon: '🔨', hp: 70, dmg: 5, range: 0.5, cd: 1.0, speed: 3.0, sight: 6, cost: 40, time: 6, pop: 1, r: 0.32,
    blurb: 'Gathers bricks and builds. Tap a tree or a brick pile to gather.' },
  kSoldier: { name: 'Swordsman', faction: 'knights', role: 'melee', icon: '⚔️', hp: 150, dmg: 13, range: 0.5, cd: 1.0, speed: 2.9, sight: 7, cost: 60, time: 8, pop: 1, r: 0.34,
    blurb: 'Tough front-line fighter.' },
  kArcher: { name: 'Archer', faction: 'knights', role: 'ranged', icon: '🏹', hp: 90, dmg: 10, range: 6.5, cd: 1.4, speed: 2.9, sight: 8.5, cost: 70, time: 9, pop: 1, r: 0.32, proj: 'arrow', vsBuilding: 0.5,
    blurb: 'Shoots from range. Weak against buildings.' },
  kRider: { name: 'Knight Rider', faction: 'knights', role: 'heavy', icon: '🐴', hp: 280, dmg: 22, range: 0.6, cd: 1.2, speed: 4.3, sight: 7.5, cost: 120, time: 13, pop: 2, r: 0.55,
    blurb: 'Fast mounted knight. Hits hard.' },
  kKing: { name: 'King Bramwell', faction: 'knights', role: 'hero', icon: '👑', hp: 650, dmg: 30, range: 0.6, cd: 1.0, speed: 3.4, sight: 9, cost: 0, pop: 0, r: 0.4,
    special: 'rally', specialName: 'Rally', specialIcon: '📯',
    blurb: 'Hero. Rally heals nearby allies and makes them stronger for a while.' },

  pBuilder: { name: 'Deckhand', faction: 'pirates', role: 'builder', icon: '🔨', hp: 70, dmg: 5, range: 0.5, cd: 1.0, speed: 3.0, sight: 6, cost: 40, time: 6, pop: 1, r: 0.32,
    blurb: 'Gathers bricks and builds.' },
  pSwabbie: { name: 'Cutlass Pirate', faction: 'pirates', role: 'melee', icon: '🗡️', hp: 135, dmg: 14, range: 0.5, cd: 0.95, speed: 3.0, sight: 7, cost: 60, time: 8, pop: 1, r: 0.34,
    blurb: 'Quick fighter with a cutlass.' },
  pGunner: { name: 'Musketeer', faction: 'pirates', role: 'ranged', icon: '🔫', hp: 85, dmg: 14, range: 7, cd: 1.9, speed: 2.8, sight: 8.5, cost: 70, time: 9, pop: 1, r: 0.32, proj: 'shot', vsBuilding: 0.5,
    blurb: 'Long-range musket. Slow to reload.' },
  pCannon: { name: 'Cannoneer', faction: 'pirates', role: 'heavy', icon: '💣', hp: 170, dmg: 26, range: 8, cd: 3.2, speed: 2.3, sight: 8.5, cost: 130, time: 13, pop: 2, r: 0.5, proj: 'ball', splash: 1.3, vsBuilding: 2.2,
    blurb: 'Rolls a cannon. Wrecks buildings.' },
  pCaptain: { name: 'Captain Saltbeard', faction: 'pirates', role: 'hero', icon: '🏴‍☠️', hp: 560, dmg: 24, range: 5, cd: 1.1, speed: 3.3, sight: 9, cost: 0, pop: 0, r: 0.4, proj: 'shot',
    special: 'broadside', specialName: 'Broadside', specialIcon: '💥',
    blurb: 'Hero. Broadside calls a rain of cannonballs on the enemy.' },
};

export const HERO_RESPAWN = 25;
export const SPECIAL_CD = 35;

// size is the footprint in cells (square).
export const BUILDINGS = {
  keep: { size: 4, hp: 1800, cost: 0, time: 0, pop: 5, deposit: true, sight: 10, trains: 'builder', icon: '🏰',
    attack: { range: 7, dmg: 8, cd: 1.6, proj: 'arrow' }, blurb: 'Your home. Trains builders and takes in bricks. Lose it and you lose the battle.' },
  farm: { size: 2, hp: 380, cost: 100, time: 14, pop: 4, sight: 5, icon: '🌾',
    blurb: 'Feeds 4 more units.' },
  barracks: { size: 3, hp: 750, cost: 150, time: 22, sight: 6, trains: 'army', icon: '⚔️',
    blurb: 'Trains your army.' },
  tower: { size: 2, hp: 650, cost: 130, time: 20, sight: 9.5, icon: '🗼',
    attack: { range: 8.5, dmg: 14, cd: 1.3, proj: 'arrow' }, blurb: 'Shoots any enemy that comes close.' },
  depot: { size: 2, hp: 420, cost: 90, time: 14, deposit: true, sight: 6, icon: '📦',
    blurb: 'Builders can drop bricks here. Put it near trees or brick piles.' },
};
export const BUILD_ORDER = ['farm', 'barracks', 'tower', 'depot'];

export const RESOURCES = {
  tree: { amount: 60, trip: 8, time: 2.2 },
  ore: { amount: 600, trip: 12, time: 2.6 },
};

export const STUDS = { silver: 10, gold: 100, blue: 1000 };

export const DIFFICULTY = {
  easy: { label: 'Easy', gather: 0.7, build: 0.8, firstAttack: 330, wave: 4, growth: 1, builders: 4, startBonus: 0, waveGap: 150 },
  normal: { label: 'Normal', gather: 1.0, build: 1.0, firstAttack: 230, wave: 6, growth: 2, builders: 6, startBonus: 0, waveGap: 120 },
  hard: { label: 'Hard', gather: 1.3, build: 1.25, firstAttack: 150, wave: 7, growth: 3, builders: 7, startBonus: 150, waveGap: 90 },
};
