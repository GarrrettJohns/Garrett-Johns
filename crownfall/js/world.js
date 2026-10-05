// The simulation: the king, his coins, buildings and their upgrades, villagers
// and the resources they haul, soldiers, enemies, projectiles and waves.
// Nothing here touches three.js or the DOM; it reports what happened through
// `events`, which main.js drains each frame for sound, effects and UI.

import {
  BUILDINGS, HERO, HERO_UPGRADES, WEAPONS, WALLS, UNITS, ENEMIES, VILLAGER, SMITH, ROYAL_BOW, STYLES,
  ARMOR_UPGRADE, waveSpec, levelInfo, levelMul, KINGS,
} from './config.js';
import {
  LANES, LANE, lanePoint, laneCrossing, laneAtZ, FIXED_PADS, START, BRIDGE, RIVER_Z,
  RIVER_HALF, BOUNDS, CASTLE_R, distToLanes, PATH_HALF, GRID, STRONGHOLD, FRONTIERS, OUTPOSTS,
  HIGHLAND, inHighland, GORGE_OUT, GORGE_IN, CAMPS, FOREST_Z, scenery, FORT, RIVER_X1, eastLimit, OUTPOST_ZONE, LANDMARKS, SITES, SITE_PROPS,
} from './map.js';
import { ENCOUNTERS, ENCOUNTER } from './slice.js';

// Trees the king can chop (the forest and southern grove) and boulders he can
// mine (in the highland). Same seeded scenery the renderer draws.
const SCENE = scenery();
// Trees and boulders come in three sizes: more swings, more yield.
const NODE_SWINGS = [3, 5, 8];
const NODE_YIELD = [1, 3, 6];
const sizeClass = (s, lo, hi) => (s < lo ? 0 : s < hi ? 1 : 2);
const CHOP_TREES = SCENE.trees.map((t, si) => ({ ...t, si })).filter((t) => t.forest);
const MINE_ROCKS = SCENE.rocks.map((r, si) => ({ ...r, si })).filter((r) => r.highland || r.iron);
const SWING_EVERY = 0.75;    // a worker's swing
export const KING_SWING = 0.5;      // the king swings faster
const HUT_REACH = 24;        // how far from their hut workers will go for trees and rocks
const STOCK_CAP = 60;        // a hut's stockpile
const GOLD_PER_ITEM = 5;
// The stronghold's garrison: [kind, x from centre, z from the gate line].
// Negative z stands in front of the gate, positive inside the courtyard.
const GARRISON = [
  ...[-9, -6, -3, 0, 3, 6, 9].map((x) => ['grunt', x, -6]),
  ...[-7.5, -2.5, 2.5, 7.5].map((x) => ['brute', x, -9]),
  ...[-8, -4, 4, 8].map((x) => ['archer', x, -3]),
  ...[-10, 10].map((x) => ['hound', x, -11]),
  ...[-6, -2, 2, 6].map((x) => ['grunt', x, 6]),
  ...[-4, 0, 4].map((x) => ['brute', x, 9]),
  ...[-9, 9].map((x) => ['archer', x, 8]),
  // The keep's own guard.
  ...[-6, -3, 0, 3, 6].map((x) => ['brute', x, 15]),
  ...[-8, -4, 4, 8].map((x) => ['grunt', x, 13]),
];
// How far soldiers riding with the king reach out to fight.
const ESCORT = {
  guard: 15,   // enemies this close to the king draw the whole escort
  rush: 34,    // ...if the soldier is within this distance of them
  reach: 16,   // otherwise each soldier takes on enemies this close to it
  leash: 26,   // as long as they're within this of the king
};
// Hit points for defences the siege's columns can wreck, by level.
const STRUCT_HP = {
  tower: (lv) => 500 + 300 * lv,
  catapult: (lv) => 900 + 300 * lv,
  outpost: () => 3000,
};
// A road whose defences score this much holds on its own while the king is
// away (two Stone Towers with posted archers, for example).
const ROAD_HOLDS = 110;
const DEFAULT_STYLE = { finish: 'gold', gem: 'none', string: 'white', trail: 'gold' };
const HUT_RES = { lumber: 'wood', quarry: 'stone', ironmine: 'iron' };     // a wheelbarrow "item" of gold is a sack of 5 coins
const GATHER_REACH = 3.2;
const GATHER_EVERY = 0.8;

const JOB_TYPES = ['goldmine', 'lumber', 'quarry', 'ironmine', 'farm', 'warehouse'];
const OUTPOST = Object.fromEntries(OUTPOSTS.map((o, i) => [o.id, { ...o, index: i }]));
// Distance from a point to the castle's square footprint (0 inside).
const castleDist = (x, z) => hyp(Math.max(Math.abs(x) - CASTLE_R, 0), Math.max(Math.abs(z) - CASTLE_R, 0));

const TAU = Math.PI * 2;
const SOLID_PROPS = SITE_PROPS.filter((p) => p.r > 0);   // the journey's buildings, wells, columns...
const MAX_GROUND_COINS = 360;
const tmpP = { x: 0, z: 0, dx: 0, dz: 1 };

const rand = (a, b) => a + Math.random() * (b - a);
const hyp = Math.hypot;

// Distance from a point to an axis-aligned square footprint (0 inside).
function rectDist(px, pz, b) {
  const h = b.size / 2;
  const dx = Math.max(Math.abs(px - b.x) - h, 0);
  const dz = Math.max(Math.abs(pz - b.z) - h, 0);
  return hyp(dx, dz);
}

export function snapToGrid(type, x, z) {
  const s = BUILDINGS[type].size;
  const snap = (v) => Math.round((v - s / 2) / GRID) * GRID + s / 2;
  return { x: snap(x), z: snap(z) };
}

const costText = (c) => c || {};

// --------------------------------------------------------------------------
// Objectives: the guided path through the early game. `at` returns where the
// trail of arrows should point.
// --------------------------------------------------------------------------
const OBJECTIVES = [
  {
    text: 'Ride over the coins to collect them',
    done: (w) => w.hero.coins >= 25 || w.count('tower') >= 2,
    at: (w) => w.nearestCoin(),
  },
  {
    text: 'Stand on the pad to build a second tower',
    done: (w) => w.count('tower') >= 2,
    at: (w) => w.b['tower-S2'],
  },
  {
    text: 'Tap Start Wave when you are ready',
    done: (w) => w.phase === 'wave' || w.wave >= 1,
    at: () => null,
  },
  {
    text: 'Defend the castle! Hurt? Ride back to the castle to heal',
    done: (w) => w.wave >= 1,
    at: () => null,
  },
  {
    text: 'Tap the Castle and upgrade your bow',
    done: (w) => w.hero.up.damage + w.hero.up.rate + w.hero.up.range >= 1,
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Tap a tower and strengthen it with gold',
    done: (w) => w.list('tower').some((t) => t.level >= 1),
    at: (w) => w.firstOf('tower'),
  },
  {
    text: 'Tap 🔨 Build and place a House inside the walls',
    tip: 'house',
    done: (w) => w.count('house') >= 2,
    at: (w) => w.siteOf('house'),
  },
  {
    text: 'Raise an army: tap 🔨 Build and place Barracks',
    done: (w) => w.count('barracks') >= 1,
    at: (w) => w.siteOf('barracks'),
  },
  {
    text: 'Tap the Barracks and train an Archer for your towers',
    tip: 'archer',
    done: (w) => w.armyCount('archer') >= 1,
    at: (w) => w.firstOf('barracks'),
  },
  {
    text: 'Build the bridge into the forest',
    done: (w) => w.built('bridge'),
    at: (w) => w.b.bridge,
  },
  {
    text: 'Build a Lumber Camp in the forest',
    done: (w) => w.count('lumber') >= 1,
    at: (w) => w.b['lumber-1'],
  },
  {
    text: 'Build a Warehouse (🔨) so wood reaches your stores',
    done: (w) => w.count('warehouse') >= 1,
    at: (w) => w.siteOf('warehouse'),
  },
  {
    text: 'Tap the Lumber Camp and add a worker with 👷 +',
    done: (w) => w.jobBuildings().some((b) => w.wantedAt(b) >= 2),
    at: (w) => w.firstOf('lumber'),
  },
  {
    text: 'Build a Blacksmith (🔨) and forge the king a finer bow',
    tip: 'smith',
    done: (w) => (w.hero.bow || 0) >= 1,
    at: (w) => w.firstOf('blacksmith') || null,
  },
  {
    text: 'Make the bow yours: pick a finish, gem or arrow trail at the Blacksmith',
    done: (w) => Object.keys(w.hero.styles).length > 0,
    at: (w) => w.firstOf('blacksmith') || null,
  },
  // Get the king ready before sending him at the Mountain Fort.
  {
    text: 'Ready for the fort: at the Castle, raise Arrow damage and Fire rate to Lv 3',
    tip: 'fortprep',
    done: (w) => w.built('pass') || (w.hero.up.damage >= 2 && w.hero.up.rate >= 2),
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Toughen up: Horse health to Lv 3 and Bow range to Lv 2 (Castle)',
    done: (w) => w.built('pass') || (w.hero.up.hp >= 2 && w.hero.up.range >= 1),
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Train 3 soldiers at the Barracks to fight at your side',
    done: (w) => w.built('pass') || w.soldiers >= 3,
    at: (w) => w.firstOf('barracks'),
  },
  {
    text: 'Tap the orders button (bottom left) and pick Follow me or March',
    tip: 'follow',
    done: (w) => w.built('pass') || w.order !== 'posts',
    at: () => null,
  },
  {
    text: 'Storm the Mountain Fort to the east: break its gate and towers',
    done: (w) => w.built('pass'),
    at: () => ({ x: FORT.x - 4, z: FORT.z }),
  },
  {
    text: 'Fight past the enemy camps and build the Gold Mine',
    done: (w) => w.built('goldmine'),
    at: (w) => w.b.goldmine,
  },
  {
    text: 'Upgrade the Castle to Lv 2: Timber Forts, Timber gates, the Crossbow, Quarries',
    tip: 'castle',
    done: (w) => w.b.castle.level >= 1,
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Shore up your defences: upgrade a tower with wood',
    done: (w) => w.list('tower').some((t) => t.level >= 2),
    at: (w) => w.list('tower').find((t) => t.state === 'built' && t.level < 2) || null,
  },
  {
    text: 'Defences holding? Now build a Quarry for stone',
    done: (w) => w.count('quarry') >= 1,
    at: (w) => w.b['quarry-1'],
  },
  {
    text: 'Build a Catapult beside a road: it hurls boulders into packs of enemies',
    tip: 'catapult',
    done: (w) => w.count('catapult') >= 1,
    at: (w) => w.list('catapult').find((c) => w.padVisible(c) && c.state !== 'built') || null,
  },
  {
    text: 'Tap the Castle to expand the walls',
    done: (w) => w.walls.level >= 1,
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Claim the road south: build the Riverford Outpost',
    done: (w) => w.built('outpost-1'),
    at: (w) => w.b['outpost-1'],
  },
  {
    text: 'The outpost claims new land: build a House and a Farm beside it',
    tip: 'outpostland',
    done: (w) => w.list('house').some((b) => b.state === 'built' && w.inOutpostLand(b)) && w.list('farm').some((b) => b.state === 'built' && w.inOutpostLand(b)),
    at: (w) => w.b['outpost-1'],
  },
  {
    text: 'Build Barracks on Riverford’s land: each outpost can raise its own troops',
    tip: 'army',
    done: (w) => w.list('barracks').some((b) => b.state === 'built' && w.inOutpostLand(b)),
    at: (w) => w.b['outpost-1'],
  },
  {
    text: 'Build the Iron Mine in the Iron Hills past Riverford',
    tip: 'iron',
    done: (w) => w.built('ironmine-1'),
    at: (w) => w.b['ironmine-1'],
  },
  {
    text: 'At the Blacksmith, forge iron tools (Iron tab)',
    done: (w) => Object.values(w.smith).some((v) => v > 0),
    at: (w) => w.firstOf('blacksmith') || null,
  },
  {
    text: 'Push on: build the Stonehill Outpost',
    done: (w) => w.built('outpost-2'),
    at: (w) => w.b['outpost-2'],
  },
  {
    text: 'Build the Siege Camp in sight of the stronghold',
    done: (w) => w.built('outpost-3'),
    at: (w) => w.b['outpost-3'],
  },
  {
    text: 'Make the roads home hold without you: Castle → Defence shows each one',
    tip: 'roads',
    done: (w) => w.won || ['E', 'W', 'N'].every((l) => w.roadStrength(l).rating === 'holds'),
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Muster 60 soldiers for the siege: upgraded Barracks and Houses at every outpost',
    tip: 'siege',
    done: (w) => w.won || w.soldiers >= 60,
    at: () => null,
  },
  {
    text: 'Lay siege! Break the gate and bring down the keep',
    done: (w) => w.won,
    at: (w) => (w.phase === 'wave' ? { x: STRONGHOLD.x, z: STRONGHOLD.gateZ - 2 } : null),
  },
];

export class World {
  // `carry` brings the king's upgrades and army into a new level.
  constructor(snapshot = null, { level = 1, carry = null } = {}) {
    this.events = [];
    this.nextId = 1;
    this.t = 0;
    this.level = level;
    this.reset();
    if (carry) this.applyCarry(carry);
    if (snapshot) this.load(snapshot);
  }

  get levelInfo() { return levelInfo(this.level); }

  // What the king takes with him when a level is won.
  carryOver() {
    const h = this.hero;
    return {
      up: { ...h.up }, weapons: { ...h.weapons }, weapon: h.weapon, armor: this.armor,
      bow: h.bow, style: { ...h.style }, styles: { ...h.styles }, kit: h.kit,
      army: [...this.allies.map((a) => a.kind), ...this.list('tower').flatMap((t) => Array(t.garrison).fill('archer'))],
      coins: Math.min(h.coins, 150),
    };
  }

  applyCarry(c) {
    const h = this.hero;
    h.up = { ...h.up, ...c.up };
    h.weapons = { ...c.weapons };
    if (c.bow) h.bow = c.bow;
    if (c.style) h.style = { ...DEFAULT_STYLE, ...c.style };
    if (c.styles) h.styles = { ...c.styles };
    if (c.kit) h.kit = c.kit;
    h.weapon = c.weapon;
    h.hp = this.heroMaxHp;
    h.coins = c.coins || 0;
    this.armor = c.armor || 0;
    for (const k of c.army || []) this.addSoldier(k, rand(-3, 3), CASTLE_R + 2 + rand(0, 2));
  }

  emit(type, data = {}) { this.events.push({ type, ...data }); }
  id() { return this.nextId++; }

  // ------------------------------------------------------------------ setup
  reset() {
    this.phase = 'build';
    this.wave = 0;
    this.res = { wood: 0, stone: 0, iron: 0, gold: 0 };   // gold here is banked at a warehouse
    this.smith = { king: 0, workers: 0, arrows: 0 };
    this.discovered = [];   // landmarks the king has seen (ids)
    this.enc = Object.fromEntries(ENCOUNTERS.map((e) => [e.id, 'locked']));   // the journey: locked | open | done
    this.encLeft = {};      // guards still standing at each camp encounter
    this.awayTip = false;
    this.order = 'posts';   // standing order for soldiers in the field: posts | follow | march
    this.stations = { S: 0, E: 0, W: 0, N: 0 };   // soldiers wanted on guard at each road's gate
    this.income = [];     // recent production: { t, res, src, n, kind: 'made' | 'home' }
    this.adviceT = 20;
    this.adviceSeen = {};
    this.funds = {};
    this.objective = 0;
    this.stats = { kills: 0 };

    this.hero = {
      x: START.hero.x, z: START.hero.z, vx: 0, vz: 0, yaw: Math.PI, healing: false,
      hp: HERO.hp, alive: true, respawnT: 0, atkCd: 0, lastHurt: -99,
      coins: 0, moving: false, fundT: 0, fundAcc: 0, fundId: null,
      up: { damage: 0, rate: 0, range: 0, speed: 0, hp: 0, carry: 0, magnet: 0 },
      weapons: { bow: true }, weapon: 'bow', anim: 0, shootT: 0, flash: 0, needShown: false,
      bow: 0, style: { ...DEFAULT_STYLE }, styles: {}, kit: 'greenwood',
      load: { res: null, n: 0 }, tool: null, gatherT: 0, warned: null,
    };

    this.b = {};
    this.walls = { level: 0, gate: 0 };
    this.armor = 0;
    this.siege = false;
    this.won = false;

    this.addBuilding({ id: 'castle', type: 'castle', x: 0, z: 0, state: 'built', level: 0 });
    this.castleHp = BUILDINGS.castle.levels[0].hp;
    for (const p of FIXED_PADS) {
      this.addBuilding({ id: p.id, type: p.type, x: p.x, z: p.z, lane: p.lane, needs: p.needs, fixed: true, state: 'site', level: 0 });
    }
    this.addBuilding({ id: 'house-start', type: 'house', ...START.house, state: 'built', level: 0 });
    this.b[START.tower].state = 'built';

    // Living trees and boulders that workers and the king cut down.
    const node = (t, cls) => ({ si: t.si, x: t.x, z: t.z, s: t.s, cls, iron: !!t.iron, hp: NODE_SWINGS[cls], state: 'up', pieces: 0, regrow: 0, grow: 1, by: null, fall: rand(0, TAU) });
    this.trees = CHOP_TREES.map((t) => node(t, sizeClass(t.s, 0.95, 1.2)));
    this.stones = MINE_ROCKS.map((r) => node(r, sizeClass(r.s, 0.62, 0.85)));
    this.natureVer = 0;
    this.natureT = 0;

    this.villagers = [];
    this.allies = [];
    this.enemies = [];
    this.projectiles = [];
    this.coins = [];
    this.spawnQueue = [];
    this.spawnT = 0;
    this.growT = 0;
    this.assignT = 0;
    this.postT = 0;

    for (let i = 0; i < VILLAGER.startPop; i++) this.spawnVillager(START.house.x + rand(-2, 2), START.house.z + rand(2, 3));
    for (let i = 0; i < START.coins.n; i++) {
      const a = (i / START.coins.n) * TAU;
      this.dropCoin(START.coins.x + Math.cos(a) * rand(0.4, 2.2), START.coins.z + Math.sin(a) * rand(0.4, 2.2), 1, 0);
    }
    this.rebuildGates();
    this.raiseFort();
  }

  // The Mountain Fort: a gate and two towers on the mountains' west face,
  // with a garrison inside. Take it and the mountains open up.
  raiseFort(garrison = true) {
    if (this.built('pass')) return;
    const mul = levelMul(this.level);
    const add = (kind, x, z) => {
      const def = ENEMIES[kind];
      this.enemies.push({
        id: this.id(), kind, static: true, fort: true, lane: LANE.E, s: 0, off: 0, x, z, yaw: -Math.PI / 2,
        hp: def.hp * mul, max: def.hp * mul, dmg: def.dmg * mul, atkCd: rand(0, 1), speed: 0, target: null, retarget: 0,
        burn: 0, burnDps: 0, flash: 0, anim: 0, moving: false, attackT: 0, def, scale: 1, coins: def.coins, name: null,
      });
    };
    add('fgate', FORT.x, FORT.z);
    add('ftower', FORT.x + 0.5, FORT.z - 6.5);
    add('ftower', FORT.x + 0.5, FORT.z + 6.5);
    if (garrison) {
      ['grunt', 'grunt', 'grunt', 'archer', 'archer'].forEach((kind, i) => {
        const def = ENEMIES[kind];
        const gx = FORT.x + 4 + (i % 2) * 1.6, gz = FORT.z - 3 + i * 1.5;
        this.enemies.push({
          id: this.id(), kind, lane: LANE.E, s: 0, off: 0, x: gx, z: gz, yaw: -Math.PI / 2, guard: { x: gx, z: gz, camp: 'fort' },
          hp: def.hp * mul, max: def.hp * mul, dmg: def.dmg * mul, atkCd: rand(0, 1), speed: def.speed * 1.2,
          target: null, retarget: Math.random() * 0.3, burn: 0, burnDps: 0, flash: 0, anim: Math.random() * 10, moving: false,
          attackT: 0, def, scale: 1, coins: def.coins + 2, name: null,
        });
      });
    }
  }

  addBuilding(def) {
    const t = BUILDINGS[def.type];
    const b = {
      size: t.size, lane: null, fixed: false, level: 0, atkCd: 0, garrison: 0, slotCd: [0, 0, 0],
      pile: 0, mineT: 0, born: this.t, pop: 0, ...def,
    };
    this.b[b.id] = b;
    return b;
  }

  // -------------------------------------------------------------- queries
  built(id) { return this.b[id] && this.b[id].state === 'built'; }
  list(type) { return Object.values(this.b).filter((b) => b.type === type); }
  count(type) { return this.list(type).filter((b) => b.state === 'built').length; }
  firstOf(type) { return this.list(type).find((b) => b.state === 'built') || null; }
  siteOf(type) { return this.list(type).find((b) => b.state === 'site') || null; }
  // Production log for the resource breakdown (the HUD's per-minute rates).
  // `made` is output where it's produced; `home` is what reaches the stores.
  logIncome(res, src, n, kind = 'made') {
    if (!(n > 0)) return;
    this.income.push({ t: this.t, res, src, n, kind });
    if (this.income.length > 600) this.income.splice(0, this.income.length - 500);
  }

  // Per-minute rates for one resource over the last two minutes, by source.
  rates(res) {
    const WIN = 120;
    const span = Math.max(30, Math.min(WIN, this.t));
    const since = this.t - WIN;
    const made = {}, home = {};
    for (const e of this.income) {
      if (e.t < since || e.res !== res) continue;
      const tgt = e.kind === 'home' ? home : made;
      tgt[e.src] = (tgt[e.src] || 0) + e.n;
    }
    const perMin = (v) => Math.round((v * 60) / span * 10) / 10;
    const label = (src) => {
      if (src === 'king') return { icon: '👑', name: 'The king' };
      if (src === 'battle') return { icon: '⚔️', name: 'Battle loot' };
      if (src === 'wave') return { icon: '🎉', name: 'Wave rewards' };
      const b = this.b[src];
      if (!b) return { icon: '•', name: src };
      const t = BUILDINGS[b.type];
      const same = this.list(b.type).filter((x) => x.state === 'built');
      const n = same.length > 1 ? ` ${same.indexOf(b) + 1}` : '';
      return { icon: t.icon, name: `${t.name}${n}`, workers: JOB_TYPES.includes(b.type) ? `${b.assigned || 0} 👷` : '' };
    };
    const rows = Object.entries(made).map(([src, v]) => ({ ...label(src), src, perMin: perMin(v) })).sort((a, b) => b.perMin - a.perMin);
    const homeRows = Object.entries(home).map(([src, v]) => ({ ...label(src), src, perMin: perMin(v) })).sort((a, b) => b.perMin - a.perMin);
    const waiting = res === 'gold'
      ? this.list('goldmine').reduce((a, m) => a + (m.state === 'built' ? m.pile : 0), 0)
      : this.list({ wood: 'lumber', stone: 'quarry', iron: 'ironmine' }[res]).reduce((a, h) => a + (h.stock || 0), 0);
    return {
      res, rows, homeRows, waiting, span: Math.round(span),
      total: perMin(Object.values(made).reduce((a, v) => a + v, 0)),
      homeTotal: perMin(Object.values(home).reduce((a, v) => a + v, 0)),
      advice: this.stockAdvice(res),
    };
  }

  // Stock piling up at camps, quarries or mines: what would move it home?
  stockAdvice(res = null) {
    const srcs = [
      ...(res && res !== 'wood' ? [] : this.list('lumber')),
      ...(res && res !== 'stone' ? [] : this.list('quarry')),
      ...(res && res !== 'iron' ? [] : this.list('ironmine')),
      ...(res && res !== 'gold' ? [] : this.list('goldmine')),
    ].filter((b) => b.state === 'built');
    const full = srcs.find((b) => (b.type === 'goldmine' ? b.pile / BUILDINGS.goldmine.levels[b.level].pile : (b.stock || 0) / STOCK_CAP) >= 0.6);
    if (!full) return null;
    const what = full.type === 'goldmine' ? 'Gold is piling up at the Gold Mine' : `${{ lumber: 'Logs', quarry: 'Stone', ironmine: 'Iron ore' }[full.type]} ${full.type === 'quarry' ? 'is' : 'are'} piling up at the ${BUILDINGS[full.type].name}`;
    const whs = this.list('warehouse').filter((w) => w.state === 'built');
    if (!whs.length) return { key: 'nowh', text: `${what}: build a Warehouse so haulers bring it home`, at: full };
    const open = whs.find((w) => (w.assigned || 0) < this.workerSlots(w));
    if (open && this.freeVillagers > 0) return { key: 'haulers', text: `${what}: tap the Warehouse and add haulers (👷 +)`, at: open };
    if (open) return { key: 'houses', text: `${what}: build Houses so more villagers can haul`, at: null };
    const up = whs.find((w) => w.level < BUILDINGS.warehouse.levels.length - 1);
    if (up) return { key: 'whup', text: `${what}: upgrade the Warehouse for more haulers`, at: up };
    return { key: 'wh2', text: `${what}: build another Warehouse near it`, at: full };
  }

  // The first time the king comes within sight of a landmark, reveal it.
  updateDiscovery() {
    const h = this.hero;
    if (!h.alive) return;
    for (const L of LANDMARKS) {
      if (this.discovered.includes(L.id)) continue;
      const seen = Math.hypot(L.x - h.x, L.z - h.z) <= L.sight || (L.view && Math.hypot(L.view.x - h.x, L.view.z - h.z) <= L.view.r);
      if (!seen) continue;
      // Beyond the claimed road the fog still hides it.
      if (L.z > this.frontier + 25) continue;
      this.discovered.push(L.id);
      this.emit('discovered', { id: L.id, name: L.name, sub: L.sub, x: L.x, z: L.z });
    }
  }

  // ------------------------------------------------------------ the journey
  // Authored encounters along the opening route (slice.js). They run beside
  // the waves: guards stay at their camp and never count towards a wave, and
  // a wave goes on while the king is away.
  updateEncounters() {
    const h = this.hero;
    if (this.phase === 'wave' && !this.awayTip && h.alive && Math.max(Math.abs(h.x), Math.abs(h.z)) > this.wallRadius + 22) {
      this.awayTip = true;
      this.emit('toast', { text: '🏰 The wave goes on while you ride. Towers and road guards hold the gates until you are back.' });
    }
    for (const E of ENCOUNTERS) {
      const st = this.enc[E.id];
      if (st === 'done') continue;
      if (st !== 'open') {
        if (!E.opens(this)) continue;
        this.enc[E.id] = 'open';
        if (E.guards) this.encLeft[E.id] = E.guards.length;
        if (E.hint) this.emit('toast', { text: `${E.icon} ${E.hint}` });
        if (E.scout) this.sendScout(E);
        continue;
      }
      const S = SITES[E.site];
      if (!E.guards) {
        if (h.alive && hyp(h.x - S.x, h.z - S.z) < E.reach) this.finishEncounter(E);
        continue;
      }
      const left = this.encLeft[E.id] ?? E.guards.length;
      if (left <= 0) { this.finishEncounter(E); continue; }
      // Guards (re)appear at their camp: on opening, and after a reload.
      const camp = 'enc:' + E.id;
      if (!this.enemies.some((e) => e.guard && e.guard.camp === camp && e.hp > 0)) this.spawnGuards(E, left);
    }
  }

  spawnGuards(E, n) {
    const S = SITES[E.site];
    const mul = levelMul(this.level) * (1 + 0.08 * this.wave);
    E.guards.slice(0, n).forEach((kind, i) => {
      const def = ENEMIES[kind];
      const a = (i / n) * TAU;
      const gx = S.x + Math.cos(a) * 3.2, gz = S.z + Math.sin(a) * 3.2;
      this.enemies.push({
        id: this.id(), kind, lane: LANE.E, s: 0, off: 0, x: gx, z: gz, yaw: rand(0, TAU), guard: { x: gx, z: gz, camp: 'enc:' + E.id },
        hp: def.hp * mul, max: def.hp * mul, dmg: def.dmg * levelMul(this.level), atkCd: rand(0, 1), speed: def.speed * 1.2,
        target: null, retarget: Math.random() * 0.3, burn: 0, burnDps: 0, flash: 0, anim: Math.random() * 10, moving: false,
        attackT: 0, def, scale: def.scale || 1, coins: def.coins + 1, name: null,
      });
    });
  }

  finishEncounter(E) {
    this.enc[E.id] = 'done';
    delete this.encLeft[E.id];
    const S = SITES[E.site], r = E.reward || {};
    if (r.coins) this.burstCoins(S.x, S.z, r.coins);
    if (r.wood) for (let i = 0; i < 5; i++) this.dropCoin(S.x, S.z, Math.ceil(r.wood / 5), 1, 'wood');
    for (let i = 0; i < (r.people || 0); i++) {
      const v = this.spawnVillager(S.x + rand(-2, 2), S.z + rand(-2, 2));
      this.emit('villager', { x: v.x, z: v.z });
    }
    // Where the reveal looks: the next place on the journey, or the fort.
    const look = E.look === 'fort' ? FORT : E.look ? SITES[E.look] : S;
    if (E.look === 'fort' && !this.discovered.includes('fort')) this.discovered.push('fort');
    this.emit('encounter', { id: E.id, icon: E.icon, title: E.title, sub: E.sub, x: look.x, z: look.z });
    if (ENCOUNTERS.every((e) => this.enc[e.id] === 'done')) this.emit('journeyDone', {});
  }

  // The next place on the journey to point the player at, if any.
  nextEncounter() {
    const E = ENCOUNTERS.find((e) => this.enc[e.id] === 'open');
    return E ? { ...E, at: SITES[E.site] } : null;
  }

  // A scout rides in from the ridge to warn the king, and the soldiers in
  // the field fall in behind him.
  sendScout(E) {
    const S = SITES[E.site];
    const a = this.addSoldier('raider', S.x - 6, S.z + 5);
    a.scout = { text: E.scout.text, t: 0 };
  }

  updateScout(a, dt) {
    const h = this.hero;
    const tx = h.alive ? h.x : 0, tz = h.alive ? h.z : CASTLE_R + 2;
    const dx = tx - a.x, dz = tz - a.z, d = hyp(dx, dz);
    a.scout.t += dt;
    if (d < 3.5 || a.scout.t > 40) {
      this.emit('scout', { text: a.scout.text, x: a.x, z: a.z });
      a.scout = null;
      for (const s of this.allies) if (!s.station) s.follow = true;
      return;
    }
    const sp = 7.5;
    a.x += (dx / d) * sp * dt; a.z += (dz / d) * sp * dt;
    // He keeps to the bridge like everyone else.
    if (a.x < RIVER_X1 && Math.abs(a.z - RIVER_Z) < RIVER_HALF + 0.4 && Math.abs(a.x - BRIDGE.x) > 2.1) a.z = a.z < RIVER_Z ? RIVER_Z - RIVER_HALF - 0.4 : RIVER_Z + RIVER_HALF + 0.4;
    a.yaw = Math.atan2(dx, dz);
    a.moving = true;
    a.anim += dt * 9;
  }

  // Remind the player (now and then, between waves) when stock is stuck.
  updateAdvice(dt) {
    this.adviceT -= dt;
    if (this.adviceT > 0) return;
    this.adviceT = 8;
    if (this.phase !== 'build') return;
    const a = this.stockAdvice();
    if (!a) return;
    const last = this.adviceSeen[a.key] || -1e9;
    if (this.t - last < 75) return;
    this.adviceSeen[a.key] = this.t;
    this.emit('advice', { text: a.text, x: a.at?.x, z: a.at?.z });
  }

  // What the next castle level opens up, read from the requirements.
  castleUnlocks(lv) {
    const out = [];
    const army = BUILDINGS.castle.levels[lv - 1]?.army - (BUILDINGS.castle.levels[lv - 2]?.army || 0);
    if (army > 0) out.push(`+${army} army size`);
    for (const [k, w] of Object.entries(WEAPONS)) if (w.castle === lv) out.push(`${w.icon} ${w.name}`);
    BUILDINGS.tower.levels.forEach((t) => { if (t.castle === lv) out.push(`🗼 ${t.name} towers`); });
    WALLS.gates.forEach((g) => { if (g.castle === lv) out.push(`🚪 ${g.name}`); });
    WALLS.levels.forEach((w) => { if (w.castle === lv) out.push(`🧱 Walls out to ${w.radius} m`); });
    for (const [k, t] of Object.entries(BUILDINGS)) if (t.castle === lv && !t.place) out.push(`${t.icon} ${t.name}`);
    return out;
  }

  // Where buildings can go: inside the castle walls, and on the land each
  // claimed outpost holds.
  inOutpostLand(b) { return this.buildZones().some((zn) => !zn.castle && Math.abs(b.x - zn.x) <= zn.h && Math.abs(b.z - zn.z) <= zn.h); }

  buildZones() {
    const zones = [{ x: 0, z: 0, h: this.wallRadius - 1.4, castle: true }];
    for (const o of this.list('outpost')) if (o.state === 'built') zones.push({ x: o.x, z: o.z, h: OUTPOST_ZONE, id: o.id });
    return zones;
  }

  // Gold to spend: on the king's horse plus what's banked in warehouses.
  get gold() { return this.hero.coins + (this.res.gold || 0); }

  armyCount(kind) {
    let n = this.allies.filter((a) => a.kind === kind).length;
    if (kind === 'archer') for (const b of this.list('tower')) n += b.garrison;
    return n;
  }
  get soldiers() { return this.allies.length + this.list('tower').reduce((a, b) => a + b.garrison, 0); }
  get beds() { return this.list('house').filter((b) => b.state === 'built').reduce((a, b) => a + BUILDINGS.house.levels[b.level].beds, 0); }
  get pop() { return this.villagers.length + this.soldiers; }
  get armyCap() {
    return BUILDINGS.castle.levels[this.b.castle.level].army
      + this.list('barracks').filter((b) => b.state === 'built').reduce((a, b) => a + BUILDINGS.barracks.levels[b.level].army, 0);
  }
  // How far south the king has claimed the road.
  get outposts() { return OUTPOSTS.filter((o) => this.built(o.id)).length; }
  get frontier() { return FRONTIERS[this.outposts]; }
  get siegeReady() { return this.outposts === OUTPOSTS.length; }
  get wallRadius() { return WALLS.levels[this.walls.level].radius; }
  get castleMax() { return BUILDINGS.castle.levels[this.b.castle.level].hp; }
  get lanesOpen() { return LANES.filter((l) => l.opens <= Math.max(1, this.wave + (this.phase === 'wave' ? 0 : 1))); }

  heroStat(k) { return HERO_UPGRADES[k].values[this.hero.up[k]]; }
  smithMul(k) { return SMITH[k].values[this.smith?.[k] || 0]; }
  // How many logs or stones the king can carry home himself.
  get loadCap() { return HERO_UPGRADES.carry.load[this.hero.up.carry]; }
  get carry() { return this.heroStat('carry'); }
  get heroMaxHp() { return this.heroStat('hp'); }

  nearestCoin() {
    let best = null, bd = Infinity;
    for (const c of this.coins) {
      if (c.res) continue;
      const d = hyp(c.x - this.hero.x, c.z - this.hero.z);
      if (d < bd) { bd = d; best = c; }
    }
    return best;
  }

  // Is a fixed pad on the map yet, and can it be paid into?
  padVisible(b) {
    if (b.state === 'built') return true;
    const t = BUILDINGS[b.type];
    if (b.needs && !this.built(b.needs)) return false;
    if (b.type === 'tower') return LANE[b.lane].opens <= this.wave + 3;
    if (b.type === 'outpost') return OUTPOST[b.id].index === 0 || this.built(OUTPOSTS[OUTPOST[b.id].index - 1].id);
    if (b.needs && !this.built(b.needs)) return false;
    if (t.needs && !this.built(t.needs)) return false;
    if (b.id === 'lumber-3') return this.b.castle.level >= 1;
    if (b.type === 'pass') return false;   // the fort, not a pad
    return true;
  }

  lockReason(req) {
    if (req.castle && this.b.castle.level + 1 < req.castle) return `Castle Lv ${req.castle}`;
    if (req.barracks && !this.list('barracks').some((b) => b.state === 'built' && b.level + 1 >= req.barracks)) return `Barracks Lv ${req.barracks}`;
    return null;
  }

  objectiveInfo() {
    const o = OBJECTIVES[this.objective];
    if (!o) return null;
    return { text: o.text, target: o.at(this), index: this.objective, total: OBJECTIVES.length, tip: o.tip || null };
  }

  // ------------------------------------------------------------ purchases
  // Every purchase is identified by a key. Gold is paid in over time and kept
  // in `funds`; materials are taken when the gold is complete.
  item(key) {
    const [kind, a, c] = key.split(':');
    const w = this;
    if (kind === 'smith') {
      const u = SMITH[a];
      const lv = this.smith[a] || 0;
      const next = u.costs[lv];
      return {
        key, icon: u.icon, title: u.name, level: lv + 1, max: u.values.length,
        cost: next ? costText(next) : {}, maxed: !next,
        desc: `${u.desc} ${fmt(u.values[lv])}${next ? ` → ${fmt(u.values[lv + 1])}` : ''} ${u.unit}${next ? '' : ' · max'}`,
        apply: () => { w.smith[a] = lv + 1; },
      };
    }
    if (kind === 'callout') {
      const t = this.b[a];
      if (!t) return null;
      return {
        key, icon: '🚩', title: 'Call an archer to follow you', repeat: true, cost: {},
        desc: t.garrison ? `${t.garrison} posted here. One climbs down and rides with the king, shooting as he goes.` : 'No archers posted here',
        locked: t.garrison ? null : 'No archers here',
        apply: () => w.callOut(t),
      };
    }
    if (kind === 'build') {
      const b = this.b[a];
      const t = BUILDINGS[b.type];
      const lvl = t.levels[0];
      if (b.type === 'outpost') {
        const o = OUTPOST[b.id];
        return {
          key, icon: t.icon, title: o.name, cost: costText(o.cost),
          locked: this.wave < o.wave ? `Clear wave ${o.wave}` : null,
          apply: () => w.finishBuilding(b),
        };
      }
      return {
        key, icon: t.icon, title: b.type === 'tower' ? lvl.name : t.name, cost: costText(lvl.cost),
        locked: this.lockReason({ castle: t.castle || lvl.castle }),
        apply: () => w.finishBuilding(b),
      };
    }
    if (kind === 'up') {
      const b = this.b[a];
      const t = BUILDINGS[b.type];
      const next = t.levels[b.level + 1];
      const cur = t.levels[b.level];
      const title = b.type === 'tower' ? (next ? `Upgrade to ${next.name}` : cur.name) : `Upgrade ${t.name}`;
      return {
        key, icon: t.icon, title, level: b.level + 1, max: t.levels.length,
        cost: next ? costText(next.cost) : {}, maxed: !next,
        desc: next ? upgradeDesc(b.type, cur, next) : 'Fully upgraded',
        locked: next ? this.lockReason({ castle: next.castle }) : null,
        apply: () => w.levelUp(b),
      };
    }
    if (kind === 'hero') {
      const u = HERO_UPGRADES[a];
      const lv = this.hero.up[a];
      const next = u.costs[lv];
      const v = u.values[lv], nv = u.values[lv + 1];
      return {
        key, icon: u.icon, title: u.name, level: lv + 1, max: u.values.length,
        cost: next ? costText(next) : {}, maxed: !next,
        desc: (next ? `${fmt(v)} → ${fmt(nv)} ${u.unit}` : `${fmt(v)} ${u.unit} · max`)
          + (u.load ? ` · ${u.load[lv]}${next ? ` → ${u.load[lv + 1]}` : ''} logs or stones` : ''),
        apply: () => { w.hero.up[a]++; if (a === 'hp') w.hero.hp = w.heroMaxHp; },
      };
    }
    if (kind === 'weapon' || kind === 'forge') {
      // Weapons are forged at the Blacksmith; the castle and outposts can
      // only switch between the ones the king already owns.
      const wp = WEAPONS[a];
      const owned = !!this.hero.weapons[a];
      const lock = owned ? null : kind === 'weapon' ? 'Forge at the Blacksmith' : this.lockReason({ castle: wp.castle });
      return {
        key, icon: wp.icon, title: wp.name, desc: wp.desc, cost: owned ? {} : costText(wp.cost),
        owned, equipped: this.hero.weapon === a, equipKey: `weapon:${a}`, locked: lock, forge: kind === 'forge',
        apply: () => { w.hero.weapons[a] = true; w.hero.weapon = a; },
      };
    }
    if (kind === 'bow') {
      const tier = this.hero.bow || 0;
      const cur = ROYAL_BOW[tier], next = ROYAL_BOW[tier + 1];
      return {
        key, icon: '🏹', title: next ? `Forge the ${next.name}` : cur.name, level: tier + 1, max: ROYAL_BOW.length,
        cost: next ? costText(next.cost) : {}, maxed: !next, forge: true,
        locked: next ? this.lockReason({ castle: next.castle }) : null,
        desc: next ? `A bigger, grander bow. Arrow damage ×${fmt(cur.mul)} → ×${fmt(next.mul)}` : `The finest bow in the realm · arrow damage ×${fmt(cur.mul)}`,
        apply: () => { w.hero.bow = tier + 1; },
      };
    }
    if (kind === 'style') {
      const opt = STYLES[a].options[c];
      const owned = this.styleOwned(a, c);
      return {
        key, icon: { finish: '🎨', gem: '💎', string: '🧵', trail: '✨' }[a], title: opt.name, desc: STYLES[a].label,
        cost: owned ? {} : costText(opt.cost), owned, equipped: this.hero.style[a] === c, equipKey: key, forge: true, swatch: opt.color,
        apply: () => { w.hero.styles[`${a}:${c}`] = true; w.hero.style[a] = c; },
      };
    }
    if (kind === 'station') {
      const lane = LANE[a];
      const r = this.roadStrength(a);
      const on = this.allies.filter((x) => x.station === a).length;
      const field = this.allies.filter((x) => !x.station).length;
      const label = { holds: '✅ Holds on its own', fair: '⚠️ Needs a hand', weak: '❌ Weak' }[r.rating];
      return {
        key, kind: 'station', icon: '🛡️', title: `${lane.name} road`, lane: a, want: this.stations[a] || 0, on, free: field, rating: r.rating,
        desc: `${label} · defence ${r.score}/${ROAD_HOLDS}`, cost: {},
      };
    }
    if (kind === 'workers') {
      const b = this.b[a];
      const per = {
        goldmine: 'digs gold into the pile', lumber: 'fells trees and stacks the logs here', quarry: 'breaks boulders and stacks the stone here', ironmine: 'breaks iron rocks and stacks the ore here',
        farm: 'helps families grow', warehouse: 'fetches wood and stone from the camps and quarries into your stores',
      }[b.type];
      return {
        key, kind: 'workers', icon: '👷', title: 'Workers', id: b.id,
        assigned: this.wantedAt(b), working: this.workersAt(b), slots: this.workerSlots(b), free: this.freeVillagers,
        desc: `Each worker ${per}. More workers, more ${b.type === 'farm' ? 'growth' : 'output'}.`, cost: {},
      };
    }
    if (kind === 'walls') {
      const next = WALLS.levels[this.walls.level + 1];
      return {
        key, icon: '🧱', title: 'Expand the walls', level: this.walls.level + 1, max: WALLS.levels.length,
        cost: next ? costText(next.cost) : {}, maxed: !next,
        desc: next ? `More room to build: ${WALLS.levels[this.walls.level].radius}m → ${next.radius}m` : 'The walls reach as far as they can',
        locked: next ? this.lockReason({ castle: next.castle }) : null,
        apply: () => { w.walls.level++; w.rebuildGates(); w.emit('walls'); },
      };
    }
    if (kind === 'gates') {
      const cur = WALLS.gates[this.walls.gate];
      const next = WALLS.gates[this.walls.gate + 1];
      return {
        key, icon: '🚪', title: next ? next.name : cur.name, level: this.walls.gate + 1, max: WALLS.gates.length,
        cost: next ? costText(next.cost) : {}, maxed: !next,
        desc: next ? `Gate strength ${cur.hp} → ${next.hp}` : `Gate strength ${cur.hp}`,
        locked: next ? this.lockReason({ castle: next.castle }) : null,
        apply: () => { w.walls.gate++; w.rebuildGates(); w.emit('walls'); },
      };
    }
    if (kind === 'armor') {
      const lv = this.armor;
      const next = ARMOR_UPGRADE.costs[lv];
      return {
        key, icon: ARMOR_UPGRADE.icon, title: ARMOR_UPGRADE.name, level: lv + 1, max: ARMOR_UPGRADE.values.length,
        cost: next ? costText(next) : {}, maxed: !next,
        desc: next ? `Soldiers take ${Math.round((1 - 1 / ARMOR_UPGRADE.values[lv + 1]) * 100)}% less damage` : 'Best armour in the land',
        apply: () => { w.armor++; },
      };
    }
    if (kind === 'train') {
      const u = UNITS[c];
      const b = this.b[a];
      let locked = this.lockReason({ barracks: u.barracks });
      if (!locked && b?.type === 'outpost' && !this.count('barracks')) locked = 'Build Barracks first';
      if (!locked && this.soldiers >= this.armyCap) locked = 'Army full';
      if (!locked && this.villagers.length === 0) locked = 'No free villagers';
      return {
        key, icon: u.icon, title: `Train ${u.name}`, desc: u.desc, cost: costText(u.cost), repeat: true, locked,
        apply: () => w.train(b, c),
      };
    }
    return null;
  }

  // Menu contents for a built building, as tabs of items. The castle holds
  // the king's own upgrades and trains troops as well as upgrading itself.
  menu(b) {
    const t = b.type;
    let tabs;
    const KING = ['hero:damage', 'hero:rate', 'hero:range', 'weapon:bow', 'weapon:crossbow', 'weapon:fire', 'weapon:multi', 'weapon:storm', 'hero:speed', 'hero:hp', 'hero:carry', 'hero:magnet'];
    if (t === 'castle') {
      tabs = [
        { tab: 'King', items: KING },
        { tab: 'Castle', items: ['up:castle', 'walls', 'gates'] },
        { tab: 'Defence', items: this.lanesOpen.map((l) => `station:${l.id}`) },
      ];
    } else if (t === 'outpost') {
      // Outposts serve the king in the field: the same upgrades as the
      // castle, and troops raised on the spot (once there are Barracks).
      tabs = [
        { tab: 'King', items: KING },
        { tab: 'Army', items: [`train:${b.id}:knight`, `train:${b.id}:archer`, `train:${b.id}:raider`, 'armor'] },
        { tab: 'Defence', items: this.lanesOpen.map((l) => `station:${l.id}`) },
      ];
    } else if (t === 'barracks') {
      tabs = [
        { tab: 'Barracks', items: [`train:${b.id}:knight`, `train:${b.id}:archer`, `train:${b.id}:raider`, `up:${b.id}`, 'armor'] },
        { tab: 'Defence', items: this.lanesOpen.map((l) => `station:${l.id}`) },
      ];
    } else if (t === 'blacksmith') {
      const opts = (cat) => Object.keys(STYLES[cat].options).map((o) => `style:${cat}:${o}`);
      tabs = [
        { tab: 'Bow', items: ['bow', ...opts('finish'), ...opts('gem')] },
        { tab: 'Style', items: [...opts('string'), ...opts('trail')] },
        { tab: 'Weapons', items: ['forge:crossbow', 'forge:fire', 'forge:multi', 'forge:storm'] },
        { tab: 'Iron', items: ['smith:king', 'smith:workers', 'smith:arrows'] },
      ];
    } else if (t === 'stable') {
      tabs = [{ tab: 'Stable', items: ['hero:speed', 'hero:hp', 'hero:carry', 'hero:magnet'] }];
    } else if (t === 'range') {
      tabs = [{ tab: 'Range', items: ['hero:damage', 'hero:rate', 'hero:range', 'weapon:bow', 'weapon:crossbow', 'weapon:fire', 'weapon:multi'] }];
    } else {
      const items = [];
      if (JOB_TYPES.includes(t)) items.push(`workers:${b.id}`);
      if (t === 'tower') items.push(`callout:${b.id}`);
      if (BUILDINGS[t].levels.length > 1) items.push(`up:${b.id}`);
      tabs = [{ tab: BUILDINGS[t].name, items }];
    }
    return tabs.map((g) => ({ tab: g.tab, items: g.items.map((k) => this.item(k)).filter(Boolean) }));
  }

  info(b) {
    const t = BUILDINGS[b.type];
    const lv = t.levels[b.level];
    const lines = [];
    if (b.type === 'castle') lines.push(`Castle ${Math.ceil(this.castleHp)}/${this.castleMax}`, `Army ${this.soldiers}/${this.armyCap}`, `${this.pop}/${this.beds} people · ${this.villagers.length} free`);
    if (b.type === 'outpost') lines.push(`${OUTPOST[b.id].name} · fires on passing enemies`);
    if (b.type === 'house') lines.push(`${lv.beds} beds`);
    if (b.type === 'goldmine') lines.push(`Pile ${b.pile}/${lv.pile}`);
    if (HUT_RES[b.type]) {
      lines.push(`Stock ${b.stock || 0}/${STOCK_CAP} ${HUT_RES[b.type]}`);
      if (!this.count('warehouse')) lines.push('No warehouse yet: build one to bring this home');
    }
    if (b.type === 'warehouse') lines.push(`Waiting at camps: ${this.list('lumber').reduce((a, x) => a + (x.stock || 0), 0)} wood, ${this.list('quarry').reduce((a, x) => a + (x.stock || 0), 0)} stone, ${this.list('ironmine').reduce((a, x) => a + (x.stock || 0), 0)} iron`);
    if (b.type === 'catapult') { const lv = BUILDINGS.catapult.levels[b.level]; lines.push(`${lv.name} · hits ${lv.dmg} in a ${lv.splash} m blast, ${lv.minRange}–${lv.range} m`); }
    if (JOB_TYPES.includes(b.type) || b.type === 'house' || b.type === 'castle') lines.push(`${Math.max(0, this.freeVillagers)} free villagers`);
    if (b.type === 'tower') lines.push(`${lv.name} · ${b.garrison}/${lv.slots} archers posted`);
    if (b.type === 'barracks') lines.push(`Army ${this.soldiers}/${this.armyCap} · ${this.villagers.length} villagers free to enlist`);
    return { name: b.type === 'tower' ? lv.name : b.type === 'outpost' ? OUTPOST[b.id].name : t.name, icon: t.icon, level: b.level + 1, max: t.levels.length, desc: t.desc, lines };
  }

  // What a pad is for, shown to the player when the king rides near it.
  padTip(b) {
    const t = BUILDINGS[b.type];
    const it = this.item(`build:${b.id}`);
    let desc = t.desc;
    if (b.type === 'outpost') desc = 'Claim the road south: the fog lifts on new land with mines and camps, and southern enemies gather further away. Its watchtower guards the road.';
    if (b.type === 'tower') desc = 'Builds a tower that shoots enemies on this road. Archers posted inside add more arrows.';
    return { icon: t.icon, title: it.title, desc, cost: it.cost, locked: it.locked };
  }

  missing(cost) {
    const m = [];
    if ((cost.wood || 0) > this.res.wood) m.push(`${cost.wood - this.res.wood} wood`);
    if ((cost.stone || 0) > this.res.stone) m.push(`${cost.stone - this.res.stone} stone`);
    if ((cost.iron || 0) > this.res.iron) m.push(`${cost.iron - this.res.iron} iron`);
    return m;
  }

  // Everything the king is short of, gold included.
  shortfall(cost) {
    const m = [];
    if ((cost.gold || 0) > this.gold) m.push(`${cost.gold - this.gold} more gold`);
    return m.concat(this.missing(cost));
  }

  canAfford(cost) { return this.shortfall(cost).length === 0; }

  // Buy an item outright. Nothing is spent unless everything is in hand.
  // Returns the gold paid (0 if it couldn't be bought).
  fund(key, quiet = false) {
    const it = this.item(key);
    if (!it || it.maxed || it.locked || it.owned) return 0;
    const short = this.shortfall(it.cost);
    if (short.length) {
      if (!quiet) this.emit('need', { text: `Need ${short.join(' and ')}` });
      return 0;
    }
    const gold = it.cost.gold || 0;
    // Spend what the king carries first, then the warehouse's bank.
    const hand = Math.min(gold, this.hero.coins);
    this.hero.coins -= hand;
    this.res.gold -= gold - hand;
    this.res.wood -= it.cost.wood || 0;
    this.res.stone -= it.cost.stone || 0;
    this.res.iron -= it.cost.iron || 0;
    it.apply();
    this.emit('bought', { key, title: it.title, gold });
    if (it.forge) this.emit('forged', { key, title: it.title, x: this.hero.x, z: this.hero.z });
    return gold || 1;
  }

  // Switch weapon ('crossbow' or 'weapon:crossbow') or bow style ('style:gem:ruby').
  equip(key) {
    const h = this.hero;
    const [kind, a, c] = key.includes(':') ? key.split(':') : ['weapon', key];
    if (kind === 'style') {
      if (!this.styleOwned(a, c)) return;
      h.style[a] = c;
      this.emit('equip', { style: a, value: c });
      return;
    }
    if (h.weapons[a]) { h.weapon = a; this.emit('equip', { w: a }); }
  }

  styleOwned(cat, opt) { return !STYLES[cat].options[opt].cost || !!this.hero.styles[`${cat}:${opt}`]; }

  finishBuilding(b) {
    b.state = 'built';
    b.level = 0;
    if (JOB_TYPES.includes(b.type)) { b.assigned = 0; b.assigned = Math.min(1, Math.max(0, this.freeVillagers)); }
    b.born = this.t;
    this.emit('built', { id: b.id, x: b.x, z: b.z, type: b.type });
    if (b.type === 'bridge') this.emit('toast', { text: 'The forest is open! Build a Lumber Camp.' });
    if (b.type === 'pass') {
      this.spawnCamps();
      this.emit('toast', { text: 'Enemy camps still hold the mountain trails. Clear them to work the mines safely.' });
    }
    if (b.type === 'outpost') {
      this.emit('outpost', { name: OUTPOST[b.id].name, last: this.siegeReady });
      // Anyone already beyond the old frontier stays put; new troops muster further back.
    }
  }

  levelUp(b) {
    b.level++;
    if (b.type === 'castle') {
      this.castleHp = this.castleMax;
      this.emit('toast', { text: `Castle Lv ${b.level + 1}: new buildings unlocked` });
    }
    this.emit('upgraded', { id: b.id, x: b.x, z: b.z, type: b.type });
  }

  // ----------------------------------------------------------- placement
  canPlace(type, x, z) {
    const t = BUILDINGS[type];
    const lock = this.lockReason({ castle: t.castle });
    if (lock) return { ok: false, reason: lock };
    const h = t.size / 2;
    if (!this.buildZones().some((zn) => Math.abs(x - zn.x) + h <= zn.h && Math.abs(z - zn.z) + h <= zn.h)) {
      return { ok: false, reason: 'Build inside the walls or on an outpost\'s land' };
    }
    // Keep a lane open around everything so the king can always ride between.
    const GAP = 2;
    // One Barracks per area: the castle grounds and each outpost's land.
    if (type === 'barracks') {
      const zn = this.buildZones().find((z0) => Math.abs(x - z0.x) + h <= z0.h && Math.abs(z - z0.z) + h <= z0.h);
      if (zn && this.list('barracks').some((b) => Math.abs(b.x - zn.x) <= zn.h && Math.abs(b.z - zn.z) <= zn.h)) {
        return { ok: false, reason: zn.castle ? 'One Barracks here: build the next on an outpost\'s land' : 'This outpost already has Barracks' };
      }
    }
    if (Math.abs(x) < CASTLE_R + h + GAP && Math.abs(z) < CASTLE_R + h + GAP) return { ok: false, reason: 'Too close to the castle' };
    for (const o of Object.values(this.b)) {
      if (o.type === 'castle') continue;
      const oh = o.size / 2 + GAP;
      if (Math.abs(o.x - x) < h + oh && Math.abs(o.z - z) < h + oh) return { ok: false, reason: 'Too close to another building' };
    }
    for (let i = 0; i <= 2; i++) for (let j = 0; j <= 2; j++) {
      const px = x - h + i * h, pz = z - h + j * h;
      if (distToLanes(px, pz) < PATH_HALF + 0.4) return { ok: false, reason: 'Keep the road clear' };
    }
    return { ok: true };
  }

  place(type, x, z) {
    if (this.phase !== 'build') return null;
    if (!this.canPlace(type, x, z).ok) return null;
    const b = this.addBuilding({ id: `${type}-${this.id()}`, type, x, z, state: 'site', level: 0 });
    this.emit('placed', { id: b.id, x, z, type });
    return b;
  }

  // Cancel a site nobody has paid into yet; refund whatever was paid.
  cancelSite(id) {
    const b = this.b[id];
    if (!b || b.fixed || b.state !== 'site') return;
    const paid = this.funds[`build:${id}`] || 0;
    delete this.funds[`build:${id}`];
    if (paid) this.burstCoins(b.x, b.z, paid);
    delete this.b[id];
    this.emit('removed', { id });
  }

  // --------------------------------------------------------------- gates
  rebuildGates() {
    const R = this.wallRadius;
    const old = this.gates || {};
    const max = WALLS.gates[this.walls.gate].hp;
    this.gates = {};
    for (const lane of LANES) {
      const s = laneCrossing(lane, R);
      const p = lanePoint(lane, s);
      const prev = old[lane.id];
      const frac = prev ? prev.hp / prev.max : 1;
      // Sit the gate squarely in the wall it passes through.
      const ns = Math.abs(p.z) >= Math.abs(p.x);
      const x = ns ? p.x : Math.sign(p.x) * R, z = ns ? Math.sign(p.z) * R : p.z;
      this.gates[lane.id] = {
        gate: true, lane: lane.id, s, x, z, side: ns ? 'ns' : 'ew', dx: ns ? 0 : Math.sign(p.x), dz: ns ? Math.sign(p.z) : 0,
        max, hp: this.phase === 'wave' ? max * frac : max,
      };
    }
  }

  // --------------------------------------------------------------- waves
  startWave() {
    if (this.phase !== 'build') return false;
    const n = this.wave + 1;
    const lanes = LANES.filter((l) => l.opens <= n);
    const spec = waveSpec(n, lanes.map((l) => l.id), this.level);
    // During a siege the king is away, so the attack on home is lighter.
    if (this.siegeReady) for (const g of spec.groups) g.count = Math.ceil(g.count * 0.5);
    const list = [];
    for (const g of spec.groups) for (let i = 0; i < g.count; i++) list.push(g.kind);
    // Grunts lead, heavier units are mixed into the back half.
    list.sort((a, b) => order(a) - order(b) + rand(-1.2, 1.2));
    this.spawnQueue = list.map((kind, i) => ({ kind, lane: lanes[i % lanes.length].id }));
    this.siege = this.siegeReady;
    // The siege's warlord waits inside the keep instead of marching.
    if (spec.boss && !this.siege) this.spawnQueue.push({ kind: spec.boss.kind, lane: lanes[0].id, boss: spec.boss });
    this.spec = spec;
    this.spawnT = 1;
    this.phase = 'wave';
    for (const g of Object.values(this.gates)) g.hp = g.max;
    if (this.siege) this.raiseStronghold();
    const fresh = lanes.filter((l) => l.opens === n && n > 1);
    this.emit('waveStart', { n, total: spec.total, fresh: fresh.map((l) => l.name), boss: spec.boss?.name, siege: this.siege });
    return true;
  }

  // The siege: the stronghold's gate, two towers and keep become targets.
  // The keep can't be harmed until the gate is down.
  raiseStronghold() {
    const S = STRONGHOLD;
    const mul = levelMul(this.level);
    const add = (kind, x, z, extra = {}) => {
      const def = ENEMIES[kind];
      const e = {
        id: this.id(), kind, static: true, lane: LANE.S, s: 0, off: 0, x, z, yaw: 0,
        hp: def.hp * mul, max: def.hp * mul, dmg: def.dmg * mul, atkCd: rand(0, 1), speed: 0, target: null, retarget: 0,
        burn: 0, burnDps: 0, flash: 0, anim: 0, moving: false, attackT: 0, def, scale: 1, coins: def.coins, name: null, ...extra,
      };
      this.enemies.push(e);
      return e;
    };
    this.sgGate = add('sgate', S.x, S.gateZ + 1);
    add('stower', S.x - 11, S.gateZ + 3);
    add('stower', S.x + 11, S.gateZ + 3);
    this.sgKeep = add('skeep', S.x, S.z + 4, { invuln: true });
    this.reinforceT = 20;
    this.reinforceN = 0;
    // The enemy marches on the road: towers, catapults and outposts in its
    // way can now be battered down.
    for (const b of Object.values(this.b)) {
      if (b.state !== 'built' || !STRUCT_HP[b.type]) continue;
      b.bld = true; b.gone = false;
      b.max = b.hp = STRUCT_HP[b.type](b.level);
    }
    // The garrison: elite defenders who hold the ground before the gate and
    // the courtyard behind it. The king can't win this alone.
    const hpK = 2.8 * this.spec.hpMul * mul, dmgK = this.spec.dmgMul * 1.4;
    const post = (kind, x, z) => {
      const def = ENEMIES[kind];
      this.enemies.push({
        id: this.id(), kind, lane: LANE.S, s: 0, off: 0, x, z, yaw: Math.PI, guard: { x, z, camp: 'stronghold' },
        hp: def.hp * hpK, max: def.hp * hpK, dmg: def.dmg * dmgK, atkCd: rand(0, 1), speed: def.speed * 1.1,
        target: null, retarget: Math.random() * 0.3, burn: 0, burnDps: 0, flash: 0, anim: Math.random() * 10, moving: false,
        attackT: 0, def, scale: (def.scale || 1) * 1.1, coins: def.coins + 3, name: null, elite: true,
      });
    };
    GARRISON.forEach(([kind, dx, dz]) => post(kind, S.x + dx, S.gateZ + dz));
  }

  spawnEnemy(q) {
    const def = ENEMIES[q.kind];
    const spec = this.spec;
    const hp = def.hp * spec.hpMul * (q.boss ? q.boss.hpMul : 1) * (q.hpK || 1);
    const lane = LANE[q.lane];
    // Southern troops muster just past the frontier (or at the stronghold gate).
    const s0 = q.s ?? (lane.id === 'S' ? laneAtZ(lane, this.siege ? STRONGHOLD.gateZ : Math.min(STRONGHOLD.gateZ, this.frontier + 10)) : 0);
    const e = {
      id: this.id(), kind: q.kind, lane, s: s0, off: rand(-1, 1) * (q.kind === 'boss' ? 0 : 1.1),
      x: 0, z: 0, yaw: 0, hp, max: hp, dmg: def.dmg * spec.dmgMul, atkCd: rand(0, 0.5),
      speed: def.speed * rand(0.92, 1.08), target: null, retarget: Math.random() * 0.25,
      burn: 0, burnDps: 0, flash: 0, anim: Math.random() * 10, moving: true, attackT: 0,
      def, scale: q.boss ? q.boss.scale : def.scale || 1, coins: q.boss ? q.boss.coins : def.coins,
      name: q.boss ? q.boss.name : null,
      elite: !!this.siege,   // siege columns wear the Warlord's colours
    };
    lanePoint(lane, s0, tmpP);
    e.x = tmpP.x - tmpP.dz * e.off;
    e.z = tmpP.z + tmpP.dx * e.off;
    this.enemies.push(e);
    if (q.boss) this.emit('boss', { name: e.name, id: e.id });
  }

  // --------------------------------------------------------------- coins
  // Coins on the ground. `res: 'wood'` makes it a bundle of logs instead,
  // which goes to the kingdom's stores rather than the king's stack.
  dropCoin(x, z, value = 1, pop = 1, res = null) {
    if (this.coins.length >= MAX_GROUND_COINS) {
      // Fold into the nearest coin rather than spawn another.
      let best = null, bd = Infinity;
      for (const c of this.coins) { if (c.res !== res) continue; const d = hyp(c.x - x, c.z - z); if (d < bd) { bd = d; best = c; } }
      if (best) { best.value += value; return; }
    }
    const a = Math.random() * TAU;
    const sp = pop ? rand(1.5, 4) : 0;
    this.coins.push({
      id: this.id(), x, z, y: pop ? 0.6 : 0.15, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: pop ? rand(4, 7) : 0,
      value, fly: false, age: 0, spin: Math.random() * TAU, res,
    });
  }


  burstCoins(x, z, total) {
    const n = Math.min(total, 30);
    let left = total;
    for (let i = 0; i < n; i++) {
      const v = i === n - 1 ? left : Math.floor(total / n);
      left -= v;
      if (v > 0) this.dropCoin(x, z, v, 1);
    }
  }

  // ----------------------------------------------------------- villagers
  spawnVillager(x, z) {
    const v = { id: this.id(), x, z, yaw: rand(0, TAU), job: null, state: 'idle', t: rand(0, 3), carry: null, path: [], anim: 0, moving: false, tx: x, tz: z };
    this.villagers.push(v);
    return v;
  }

  workersAt(b) { return this.villagers.filter((v) => v.job === b.id).length; }

  // Workers are assigned by the player: each job building has slots (its
  // level's `workers`) and an `assigned` count.
  workerSlots(b) { return BUILDINGS[b.type].levels[b.level].workers; }
  wantedAt(b) { return Math.min(b.assigned ?? this.workerSlots(b), this.workerSlots(b)); }
  get freeVillagers() { return this.villagers.length - this.jobBuildings().reduce((a, b) => a + this.wantedAt(b), 0); }

  setWorkers(id, delta) {
    const b = this.b[id];
    if (!b || b.state !== 'built' || !JOB_TYPES.includes(b.type)) return;
    const cur = this.wantedAt(b);
    if (delta > 0) {
      if (cur >= this.workerSlots(b)) { this.emit('need', { text: 'No more room here: upgrade it for more slots' }); return; }
      if (this.freeVillagers <= 0) { this.emit('need', { text: 'No free villagers: build houses so more families move in' }); return; }
    }
    b.assigned = Math.max(0, Math.min(this.workerSlots(b), cur + delta));
    this.assignT = 0;
    this.emit('workers', { id, n: b.assigned });
  }

  jobBuildings() {
    return Object.values(this.b)
      .filter((b) => b.state === 'built' && JOB_TYPES.includes(b.type))
      .sort((a, b) => jobPriority(a) - jobPriority(b) || a.born - b.born);
  }

  // A walking route from a to b. Anything across the river goes by the bridge.
  route(ax, az, bx, bz) {
    // In or out of the highland: through the gorge.
    if (inHighland(ax, az) !== inHighland(bx, bz)) {
      const a = inHighland(ax, az) ? [GORGE_IN, GORGE_OUT] : [GORGE_OUT, GORGE_IN];
      return [{ ...a[0] }, { ...a[1] }, { x: bx, z: bz }];
    }
    const north = (x, z) => z < RIVER_Z && x < RIVER_X1;
    if (north(ax, az) !== north(bx, bz)) {
      const s = { x: BRIDGE.x, z: RIVER_Z + RIVER_HALF + 1.5 };
      const n = { x: BRIDGE.x, z: RIVER_Z - RIVER_HALF - 1.5 };
      return north(ax, az) ? [n, s, { x: bx, z: bz }] : [s, n, { x: bx, z: bz }];
    }
    return [{ x: bx, z: bz }];
  }

  // Loads go to the castle, or to an outpost if one is closer.
  deliveryPoint(v) {
    const a = Math.atan2(v.z, v.x);
    let best = { x: Math.cos(a) * (CASTLE_R + 1), z: Math.sin(a) * (CASTLE_R + 1) };
    let bd = hyp(best.x - v.x, best.z - v.z);
    for (const o of this.list('outpost')) {
      if (o.state !== 'built') continue;
      const p = { x: o.x - 3.6, z: o.z };
      const d = hyp(p.x - v.x, p.z - v.z);
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  updateVillagers(dt) {
    // Population growth: free beds bring new villagers, farms speed it up.
    if (this.pop < this.beds) {
      let growth = 1;
      for (const f of this.list('farm')) {
        if (f.state === 'built' && this.workersAt(f) > 0) growth += BUILDINGS.farm.levels[f.level].growth * Math.min(1, this.workersAt(f) / BUILDINGS.farm.levels[f.level].workers);
      }
      this.growT += dt * growth;
      if (this.growT >= VILLAGER.growthEvery) {
        this.growT = 0;
        const houses = this.list('house').filter((b) => b.state === 'built');
        const h = houses[Math.floor(Math.random() * houses.length)] || { x: 0, z: 6 };
        this.spawnVillager(h.x + rand(-1.5, 1.5), h.z + h.size / 2 + 0.6);
        this.emit('villager', { x: h.x, z: h.z });
      }
    } else {
      this.growT = Math.min(this.growT, VILLAGER.growthEvery * 0.5);
    }

    // Job assignment.
    this.assignT -= dt;
    if (this.assignT <= 0) {
      this.assignT = 0.5;
      for (const v of this.villagers) if (v.job && !this.built(v.job)) this.releaseVillager(v);
      for (const b of this.jobBuildings()) {
        const need = this.wantedAt(b);
        let have = this.workersAt(b);
        // Sent home: release the extras.
        for (const v of this.villagers) {
          if (have <= need) break;
          if (v.job !== b.id) continue;
          this.releaseVillager(v);
          have--;
        }
        while (have < need) {
          let best = null, bd = Infinity;
          for (const v of this.villagers) {
            if (v.job) continue;
            const d = hyp(v.x - b.x, v.z - b.z);
            if (d < bd) { bd = d; best = v; }
          }
          if (!best) break;
          best.job = b.id;
          best.state = 'toWork';
          best.path = this.route(best.x, best.z, b.x + rand(-1.5, 1.5), b.z + b.size / 2 + 0.8);
          have++;
        }
      }
    }

    const sp = VILLAGER.speed;
    for (const v of this.villagers) {
      v.moving = false;
      const b = v.job ? this.b[v.job] : null;
      if (v.path.length) {
        const p = v.path[0];
        const dx = p.x - v.x, dz = p.z - v.z;
        const d = hyp(dx, dz);
        if (d < 0.3) v.path.shift();
        else {
          const hauler = b && b.type === 'warehouse';
          const step = Math.min(d, sp * dt * (hauler ? 2 : v.carry ? 0.85 : 1));
          v.x += (dx / d) * step; v.z += (dz / d) * step;
          v.yaw = Math.atan2(dx, dz);
          v.moving = true;
          v.anim += dt * 9;
        }
        continue;
      }
      if (!b) {
        // Idle: wander near the houses.
        v.t -= dt;
        if (v.t <= 0) {
          v.t = rand(2, 6);
          const houses = this.list('house').filter((h) => h.state === 'built');
          const h = houses[Math.floor(Math.random() * houses.length)] || { x: 0, z: 6, size: 4 };
          const a = rand(0, TAU), r = rand(h.size / 2 + 0.8, h.size / 2 + 3);
          v.path = [{ x: h.x + Math.cos(a) * r, z: h.z + Math.sin(a) * r }];
        }
        continue;
      }
      if (b.type === 'lumber' || b.type === 'quarry' || b.type === 'ironmine') { this.updateCutter(v, b, dt); continue; }
      if (b.type === 'warehouse') { this.updateHauler(v, b, dt); continue; }
      const lv = BUILDINGS[b.type].levels[b.level];
      if (v.state === 'toWork') { v.state = 'work'; v.t = b.type === 'goldmine' ? lv.every : (lv.work || 4); v.yaw = Math.atan2(b.x - v.x, b.z - v.z); }
      if (v.state === 'work') {
        v.t -= dt;
        if (b.type === 'farm') {
          // Farmers potter around the field.
          if (v.t <= 0) {
            v.t = rand(2, 4);
            v.path = [{ x: b.x + rand(-2.2, 2.2), z: b.z + rand(-2.2, 2.2) }];
          }
        } else if (b.type === 'goldmine') {
          if (v.t <= 0) {
            v.t = lv.every;
            if (b.pile < lv.pile) { b.pile++; this.logIncome('gold', b.id, 1); this.emit('dig', { x: b.x, z: b.z }); }
          }
        } else if (v.t <= 0) {
          v.state = 'haul';
          v.carry = { res: b.type === 'lumber' ? 'wood' : 'stone', amt: lv.carry };
          const d = this.deliveryPoint(v);
          v.path = this.route(v.x, v.z, d.x, d.z);
        }
        continue;
      }
      if (v.state === 'haul') {
        // Arrived at the castle.
        this.res[v.carry.res] += v.carry.amt;
        this.emit('deliver', { x: v.x, z: v.z, res: v.carry.res, amt: v.carry.amt });
        v.carry = null;
        v.state = 'toWork';
        v.path = this.route(v.x, v.z, b.x + rand(-1.5, 1.5), b.z + b.size / 2 + 0.8);
      }
    }
  }

  releaseVillager(v) {
    if (v.node && v.node.by === v.id) v.node.by = null;
    if (v.src && this.b[v.src]) this.b[v.src].reserved = Math.max(0, (this.b[v.src].reserved || 0) - (v.plan || 0));
    v.job = null; v.state = 'idle'; v.carry = null; v.path = []; v.t = 0; v.node = null; v.src = null; v.plan = 0;
  }

  // Woodcutters and masons: walk to the nearest tree or boulder by the hut,
  // cut it down (or pick up what's left of one), carry the pieces home and
  // stack them in the hut for a warehouse hauler.
  updateCutter(v, b, dt) {
    const lv = BUILDINGS[b.type].levels[b.level];
    const wood = b.type === 'lumber';
    const iron = b.type === 'ironmine';
    const list = wood ? this.trees : this.stones.filter((n) => n.iron === iron);
    const res = wood ? 'wood' : iron ? 'iron' : 'stone';
    const home = { x: b.x + rand(-1.2, 1.2), z: b.z + b.size / 2 + 0.8 };
    switch (v.state) {
      case 'chop': {
        const n = v.node;
        if (!n || n.state !== 'up') {
          // Someone else (the king) got there first.
          if (n && n.by === v.id) n.by = null;
          v.node = null; v.state = 'seek'; return;
        }
        v.yaw = Math.atan2(n.x - v.x, n.z - v.z);
        v.t -= dt;
        if (v.t <= 0) { v.t = SWING_EVERY / this.smithMul('workers'); this.hitNode(n, wood, v.x, v.z); }
        if (n.state === 'down') { v.state = 'gather'; v.t = 0.5; }
        return;
      }
      case 'gather': {
        v.t -= dt;
        if (v.t > 0) return;
        const n = v.node;
        const take = n ? Math.min(n.pieces, lv.carry) : 0;
        if (n) { this.takePieces(n, take); n.by = null; }
        v.node = null;
        v.carry = take ? { res, amt: take } : null;
        v.state = 'return';
        v.path = this.route(v.x, v.z, home.x, home.z);
        return;
      }
      case 'return':
        if (v.carry) {
          b.stock = Math.min(STOCK_CAP, (b.stock || 0) + v.carry.amt);
          this.logIncome(v.carry.res, b.id, v.carry.amt);
          this.emit('stock', { x: b.x, z: b.z, res, amt: v.carry.amt });
        }
        v.carry = null;
        v.state = 'seek';
        return;
      case 'wait':
        v.t -= dt;
        if (v.t <= 0) v.state = 'seek';
        return;
      default: {
        // Look for work: leftover pieces first, then a standing tree or rock.
        if ((b.stock || 0) >= STOCK_CAP) { v.state = 'wait'; v.t = 3; return; }
        let best = null, bd = HUT_REACH;
        for (const n of list) {
          if (n.by || (n.state !== 'up' && !(n.state === 'down' && n.pieces > 0))) continue;
          const d = hyp(n.x - b.x, n.z - b.z) - (n.state === 'down' ? 6 : 0);
          if (d < bd) { bd = d; best = n; }
        }
        if (!best) { v.state = 'wait'; v.t = 4; return; }
        best.by = v.id;
        v.node = best;
        const a = Math.atan2(b.z - best.z, b.x - best.x);
        v.path = this.route(v.x, v.z, best.x + Math.cos(a) * 1.1, best.z + Math.sin(a) * 1.1);
        v.state = best.state === 'up' ? 'chop' : 'gather';
        v.t = best.state === 'up' ? SWING_EVERY : 0.5;
      }
    }
  }

  // Warehouse haulers: fetch from whichever camp or quarry has the most
  // waiting, bring it to the warehouse, into the kingdom's stores.
  updateHauler(v, b, dt) {
    const lv = BUILDINGS.warehouse.levels[b.level];
    switch (v.state) {
      case 'fetch': {
        const src = this.b[v.src];
        v.src = null;
        if (!src) { v.state = 'seek'; return; }
        src.reserved = Math.max(0, (src.reserved || 0) - v.plan);
        const gold = src.type === 'goldmine';
        const take = gold ? Math.min(src.pile || 0, lv.carry * GOLD_PER_ITEM) : Math.min(src.stock || 0, lv.carry);
        v.plan = 0;
        if (gold) src.pile -= take; else src.stock = (src.stock || 0) - take;
        v.carry = take ? { res: gold ? 'gold' : HUT_RES[src.type], amt: take, from: src.id } : null;
        v.state = 'deliver';
        v.path = this.route(v.x, v.z, b.x + rand(-1.5, 1.5), b.z + b.size / 2 + 0.8);
        return;
      }
      case 'deliver':
        if (v.carry) {
          this.res[v.carry.res] += v.carry.amt;
          this.logIncome(v.carry.res, b.id, v.carry.amt, 'home');
          this.emit('deliver', { x: v.x, z: v.z, res: v.carry.res, amt: v.carry.amt });
        }
        v.carry = null;
        v.state = 'seek';
        return;
      case 'wait':
        v.t -= dt;
        if (v.t <= 0) v.state = 'seek';
        return;
      default: {
        let best = null, bs = 0;
        // Whichever camp, quarry or mine has the most loads waiting.
        for (const src of [...this.list('lumber'), ...this.list('quarry'), ...this.list('ironmine'), ...this.list('goldmine')]) {
          if (src.state !== 'built') continue;
          const per = src.type === 'goldmine' ? GOLD_PER_ITEM : 1;
          const avail = ((src.type === 'goldmine' ? src.pile : src.stock || 0) - (src.reserved || 0)) / per;
          if (avail >= 1 && avail > bs) { bs = avail; best = src; }
        }
        if (!best) {
          v.state = 'wait'; v.t = 3;
          if (hyp(v.x - b.x, v.z - b.z) > b.size) v.path = [{ x: b.x + rand(-2, 2), z: b.z + b.size / 2 + 1 }];
          return;
        }
        v.plan = Math.min(bs, lv.carry) * (best.type === 'goldmine' ? GOLD_PER_ITEM : 1);
        best.reserved = (best.reserved || 0) + v.plan;
        v.src = best.id;
        v.state = 'fetch';
        v.path = this.route(v.x, v.z, best.x + rand(-1, 1), best.z + best.size / 2 + 0.8);
      }
    }
  }

  // One swing at a tree or boulder. At zero it falls (or breaks) into pieces.
  hitNode(n, wood, x, z) {
    if (n.state !== 'up') return;
    n.hp--;
    this.emit('nodeHit', { x: n.x, z: n.z, wood, si: n.si });
    if (n.hp <= 0) {
      n.state = 'down';
      n.pieces = NODE_YIELD[n.cls];
      n.fall = Math.atan2(n.x - x, n.z - z);
      this.natureVer++;
      this.emit(wood ? 'treeFell' : 'rockBroke', { si: n.si, x: n.x, z: n.z, s: n.s, dir: n.fall, cls: n.cls });
    }
  }

  takePieces(n, k) {
    n.pieces -= k;
    if (n.pieces <= 0) { n.pieces = 0; n.state = 'gone'; n.regrow = rand(50, 80); }
    this.natureVer++;
  }

  // Stumps and rubble regrow: a sapling appears and grows back to full size.
  updateNature(dt) {
    this.natureT -= dt;
    let growing = false;
    for (const list of [this.trees, this.stones]) {
      for (const n of list) {
        if (n.state === 'gone') {
          n.regrow -= dt;
          if (n.regrow <= 0 && !n.by) { n.state = 'grow'; n.grow = 0.15; this.natureVer++; }
        } else if (n.state === 'grow') {
          n.grow = Math.min(1, n.grow + dt / 30);
          growing = true;
          if (n.grow >= 1) { n.state = 'up'; n.hp = NODE_SWINGS[n.cls]; this.natureVer++; }
        }
      }
    }
    if (growing && this.natureT <= 0) { this.natureT = 0.5; this.natureVer++; }
  }

  // --------------------------------------------------------------- army
  train(b, kind) {
    // Take an idle villager first, else pull one off the least important job.
    let v = this.villagers.find((x) => !x.job);
    if (!v) v = [...this.villagers].sort((a, c) => jobPriority(this.b[c.job]) - jobPriority(this.b[a.job]))[0];
    if (!v) return;
    if (v.job && this.b[v.job]) this.b[v.job].assigned = Math.max(0, this.wantedAt(this.b[v.job]) - 1);
    this.releaseVillager(v);
    this.villagers.splice(this.villagers.indexOf(v), 1);
    const a = this.addSoldier(kind, b.x, b.z + b.size / 2 + 0.6);
    this.emit('trained', { kind, x: a.x, z: a.z });
  }

  // Road guards: keep the wanted number of soldiers stationed at each road,
  // taking them from the field (knights and raiders first) and releasing
  // any extra.
  assignStations() {
    for (const lane of ['S', 'E', 'W', 'N']) {
      const want = this.gates[lane] ? this.stations[lane] || 0 : 0;
      const on = this.allies.filter((a) => a.station === lane);
      for (const a of on.slice(want)) a.station = null;
      if (on.length < want) {
        const free = this.allies.filter((a) => !a.station && !a.follow).sort((a, b) => (a.kind === 'archer') - (b.kind === 'archer'));
        for (const a of free.slice(0, want - on.length)) a.station = lane;
      }
      this.allies.filter((a) => a.station === lane).forEach((a, i) => { a.stationIdx = i; });
    }
  }

  setStation(lane, d) {
    const cur = this.stations[lane] || 0;
    const field = this.allies.filter((a) => !a.station || a.station === lane).length;
    if (d > 0 && cur >= field) { this.emit('need', { text: 'No soldiers free in the field: train more at the Barracks' }); return; }
    this.stations[lane] = Math.max(0, Math.min(16, cur + d));
    this.assignStations();
    this.emit('station', { lane, n: this.stations[lane] });
  }

  // How well a road holds without the king: its towers (and their posted
  // archers) plus the soldiers stationed at its gate.
  roadStrength(lane) {
    let score = 0;
    for (const t of this.list('tower')) {
      if (t.state !== 'built' || t.lane !== lane) continue;
      const lv = BUILDINGS.tower.levels[t.level];
      score += (lv.dmg / lv.interval) * (1 + 0.6 * t.garrison) * (lv.pierce ? 1.6 : 1);
    }
    for (const c of this.list('catapult')) {
      if (c.state !== 'built') continue;
      const p = LANE[lane] && hyp(c.x - this.gates[lane]?.x, c.z - this.gates[lane]?.z);
      if (p < 40) { const lv = BUILDINGS.catapult.levels[c.level]; score += (lv.dmg / lv.interval) * 2; }
    }
    for (const a of this.allies) if (a.station === lane) { const u = UNITS[a.kind]; score += (u.dmg / u.interval) * 2; }
    score *= this.smithMul('arrows');
    return { score: Math.round(score), rating: score >= ROAD_HOLDS ? 'holds' : score >= ROAD_HOLDS / 2 ? 'fair' : 'weak' };
  }

  // 🚩 Follow me: every soldier in the field rides with the king. Tapping it
  // again sends them back to their posts (archers to free tower slots).
  get rally() { return this.order === 'follow'; }
  setRally(on) { this.setOrder(on ? 'follow' : 'posts'); }

  // Standing orders for soldiers in the field (not those on guard at a road):
  // hold their posts, ride with the king, or march on the stronghold.
  // Newly trained soldiers obey whichever is set.
  setOrder(order) {
    if (!['posts', 'follow', 'march'].includes(order)) return;
    this.order = order;
    if (order !== 'follow') for (const a of this.allies) a.follow = false;
    this.emit('rally', { on: order === 'follow', order });
  }

  // Where marching soldiers head: the stronghold in a siege (its gate, then
  // the keep), otherwise a muster point at the furthest claimed outpost.
  marchPoint() {
    const S = STRONGHOLD;
    if (this.siege && this.sgGate) return this.sgGate.hp > 0 ? { x: S.x, z: S.gateZ - 5, siege: true } : { x: S.x, z: S.z, siege: true };
    const out = [...OUTPOSTS].reverse().map((o) => this.b[o.id]).find((b) => b && b.state === 'built');
    if (out) {
      const s0 = laneAtZ(LANE.S, out.z);
      lanePoint(LANE.S, s0, tmpP);
      return { x: tmpP.x, z: tmpP.z };
    }
    return { x: 0, z: this.wallRadius + 4 };
  }

  // Call one archer down from a tower to ride with the king.
  callOut(t) {
    if (!t || t.type !== 'tower' || !(t.garrison > 0)) return;
    t.garrison--;
    const a = this.addSoldier('archer', t.x, t.z + t.size / 2 + 0.8);
    a.follow = true;
    this.emit('trained', { kind: 'archer', x: a.x, z: a.z });
  }

  addSoldier(kind, x, z) {
    const u = UNITS[kind];
    const a = {
      id: this.id(), kind, x, z, yaw: 0, hp: u.hp, max: u.hp, atkCd: 0,
      target: null, post: null, lastHurt: -99, flash: 0, anim: 0, moving: false, slot: this.allies.length, attackT: 0,
    };
    this.allies.push(a);
    return a;
  }

  freeTowerSlot(x, z) {
    let best = null, bd = Infinity;
    for (const t of this.list('tower')) {
      if (t.state !== 'built') continue;
      const slots = BUILDINGS.tower.levels[t.level].slots;
      const coming = this.allies.filter((a) => a.post === t.id).length;
      if (t.garrison + coming >= slots) continue;
      const d = hyp(t.x - x, t.z - z) + LANE[t.lane].opens * 4;
      if (d < bd) { bd = d; best = t; }
    }
    return best;
  }

  armorMul() { return ARMOR_UPGRADE.values[this.armor]; }

  updateAllies(dt) {
    const hero = this.hero;
    this.postT -= dt;
    const repost = this.postT <= 0;
    if (repost) this.postT = 1.5;

    this.assignStations();
    // Knights, and anyone called with 🚩 Follow me, take formation slots
    // behind the king (not those on guard at a road).
    let ki = 0;
    const marching = this.order === 'march';
    const muster = marching ? this.marchPoint() : null;
    for (const a of this.allies) if (!a.station && (a.kind === 'knight' || a.follow || this.rally || marching)) a.slot = ki++;

    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      if (a.scout) { this.updateScout(a, dt); continue; }
      const u = UNITS[a.kind];
      a.flash = Math.max(0, a.flash - dt * 4);
      a.atkCd -= dt;
      a.attackT = Math.max(0, a.attackT - dt);
      a.moving = false;
      if (this.t - a.lastHurt > 4) a.hp = Math.min(a.max, a.hp + 4 * dt);

      let gx = a.x, gz = a.z;           // where it wants to be
      let target = null;

      const follows = hero.alive && a.kind !== 'knight' && (a.follow || this.rally);
      if (a.station && this.gates[a.station]) {
        // On guard at a road's gate: hold just outside it and fight whatever
        // comes down that road, without wandering off.
        const g = this.gates[a.station];
        const out = Math.hypot(g.x, g.z) || 1;
        const k = a.stationIdx || 0;
        const side = ((k % 5) - 2) * 1.5, row = Math.floor(k / 5);
        const ox = g.x / out, oz = g.z / out;
        gx = g.x + ox * (a.kind === 'archer' ? 1 : 3 + row * 1.3) - oz * side;
        gz = g.z + oz * (a.kind === 'archer' ? 1 : 3 + row * 1.3) + ox * side;
        a.post = null;
        const e = this.nearestEnemy(a.x, a.z, a.kind === 'archer' ? u.range : 12);
        if (e && hyp(e.x - g.x, e.z - g.z) < 18) target = e;
      } else if (marching && !a.follow) {
        // Marching on the stronghold, independent of the king.
        const col = a.slot % 6, row = Math.floor(a.slot / 6);
        gx = muster.x + (col - 2.5) * 1.5;
        gz = muster.z - 2 - row * 1.4;
        a.post = null;
        const reach = muster.siege ? 30 : a.kind === 'archer' ? u.range : 14;
        const e = this.nearestEnemy(a.x, a.z, reach);
        if (e && (muster.siege || hyp(e.x - muster.x, e.z - muster.z) < 26)) target = e;
      } else if (follows) {
        const row = Math.floor(a.slot / 5), col = a.slot % 5;
        const ang = Math.PI + (col - 2) * 0.55;
        const r = 2.2 + row * 1.4;
        const fx = Math.sin(hero.yaw), fz = Math.cos(hero.yaw);
        const lx = Math.sin(ang) * r, lz = Math.cos(ang) * r;
        gx = hero.x + fz * lx + fx * lz;
        gz = hero.z - fx * lx + fz * lz;
        a.post = null;
        target = this.escortTarget(a);
      } else if (a.kind === 'archer') {
        if (repost && !a.post?.startsWith?.('tower')) {
          const t = this.freeTowerSlot(a.x, a.z);
          if (t) a.post = t.id;
        }
        if (a.post && this.b[a.post]?.type === 'tower') {
          const t = this.b[a.post];
          gx = t.x; gz = t.z;
          if (hyp(t.x - a.x, t.z - a.z) < 1.6) {
            t.garrison++;
            this.allies.splice(i, 1);
            this.emit('posted', { x: t.x, z: t.z });
            continue;
          }
        } else {
          // Guard the gate on the most dangerous open lane.
          a.post = null;
          const lanes = this.lanesOpen;
          const lane = lanes[a.id % lanes.length];
          const g = this.gates[lane.id];
          const side = (a.id % 3) - 1;
          gx = g.x * 0.86 - g.dz * side * 2.2;
          gz = g.z * 0.86 + g.dx * side * 2.2;
          target = this.nearestEnemy(a.x, a.z, u.range);
        }
      } else if (a.kind === 'knight') {
        if (hero.alive) {
          const row = Math.floor(a.slot / 5), col = a.slot % 5;
          const ang = Math.PI + (col - 2) * 0.55;
          const r = 2.2 + row * 1.4;
          const fx = Math.sin(hero.yaw), fz = Math.cos(hero.yaw);
          // Arc behind the king, relative to his facing.
          const lx = Math.sin(ang) * r, lz = Math.cos(ang) * r;
          gx = hero.x + fz * lx + fx * lz;
          gz = hero.z - fx * lx + fz * lz;
        } else { gx = (a.slot % 4) * 1.5 - 2.25; gz = CASTLE_R + 2 + Math.floor(a.slot / 4) * 1.4; }
        if (hero.alive) target = this.escortTarget(a);
        else { const e = this.nearestEnemy(a.x, a.z, 7); if (e && hyp(e.x - gx, e.z - gz) < 11) target = e; }
      } else if (a.kind === 'raider') {
        gx = (a.id % 5) * 1.4 - 2.8; gz = CASTLE_R + 3.5;
        target = this.nearestEnemy(a.x, a.z, 60);
      }

      if (target) {
        const d = hyp(target.x - a.x, target.z - a.z);
        a.yaw = Math.atan2(target.x - a.x, target.z - a.z);
        if (d > u.range + target.def.radius) {
          // Escorting archers close to bow range; everyone else charges.
          if (a.kind !== 'archer' || ((a.follow || this.rally || marching) && !a.station)) { gx = target.x; gz = target.z; }
        } else {
          gx = a.x; gz = a.z;
          if (a.atkCd <= 0) {
            a.atkCd = u.interval;
            a.attackT = 0.25;
            const dmg = u.dmg * (this.armor ? 1 + this.armor * 0.15 : 1);
            if (a.kind === 'archer') this.shoot(a.x, a.z, 1.3, target, { dmg: dmg * this.smithMul('arrows'), speed: 28, from: 'ally' });
            else this.damageEnemy(target, dmg, 'melee');
          }
        }
      }

      const dx = gx - a.x, dz = gz - a.z;
      const d = hyp(dx, dz);
      if (d > 0.25) {
        const escort = !a.station && (a.kind === 'knight' || a.follow || this.rally) && hero.alive && !target;
        const sp = escort ? Math.max(u.speed, this.heroStat('speed') * (d > 3 ? 1.15 : 0.9)) : u.speed;
        const step = Math.min(d, sp * dt);
        a.x += (dx / d) * step; a.z += (dz / d) * step;
        if (!target || a.kind !== 'archer') a.yaw = Math.atan2(dx, dz);
        a.moving = step > 0.01;
        a.anim += dt * 10;
      }
    }
    separate(this.allies, 0.45);
  }

  // Who a soldier riding with the king should fight: anything closing on the
  // king first (the whole escort turns on it), else whatever is near the
  // soldier, as long as the king isn't left too far behind.
  escortTarget(a) {
    const hero = this.hero;
    const threat = this.nearestEnemy(hero.x, hero.z, ESCORT.guard);
    if (threat && hyp(threat.x - a.x, threat.z - a.z) < ESCORT.rush) return threat;
    const own = this.nearestEnemy(a.x, a.z, a.kind === 'archer' ? Math.max(UNITS.archer.range, ESCORT.reach) : ESCORT.reach);
    if (own && hyp(own.x - hero.x, own.z - hero.z) < ESCORT.leash) return own;
    return null;
  }

  nearestEnemy(x, z, range) {
    let best = null, bd = range;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.invuln) continue;
      const d = hyp(e.x - x, e.z - z) - e.def.radius;
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  nearestEnemies(x, z, range, n) {
    const list = [];
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.invuln) continue;
      // Soldiers come before walls: structures only when nothing else is near.
      const d = hyp(e.x - x, e.z - z) - e.def.radius + (e.static ? 6 : 0);
      if (d - (e.static ? 6 : 0) < range) list.push([d, e]);
    }
    list.sort((a, b) => a[0] - b[0]);
    return list.slice(0, n).map((p) => p[1]);
  }

  // ---------------------------------------------------------- projectiles
  shoot(x, z, y, target, o) {
    const p = {
      x, z, y, y0: y, target, tx: target.x, tz: target.z, speed: o.speed || 30, dmg: o.dmg,
      from: o.from, pierce: o.pierce || 0, burn: o.burn || 0, splash: o.splash || 0, splashK: o.splashK || 0.4, lob: !!o.lob, chain: o.chain || 0, kind: o.kind || 'arrow',
      dist0: Math.max(1, hyp(target.x - x, target.z - z)), travelled: 0, hit: null, dirX: 0, dirZ: 0, straight: 0, yaw: 0,
    };
    this.projectiles.push(p);
    this.emit('shoot', { from: o.from, kind: p.kind, x, z });
    return p;
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const step = p.speed * dt;
      let dead = false;
      if (p.straight > 0) {
        // Piercing flight after the first hit.
        p.x += p.dirX * step; p.z += p.dirZ * step;
        p.straight -= step;
        p.y = Math.max(0.6, p.y - dt * 1.5);
        for (const e of this.enemies) {
          if (e.hp <= 0 || p.hit.has(e)) continue;
          if (hyp(e.x - p.x, e.z - p.z) < e.def.radius + 0.5) {
            p.hit.add(e);
            this.damageEnemy(e, p.dmg * 0.8, 'pierce');
            if (--p.pierce <= 0) { dead = true; break; }
          }
        }
        if (p.straight <= 0) dead = true;
      } else {
        const t = p.target;
        const alive = p.from === 'enemy' ? (t === this.hero ? this.hero.alive : t.hp > 0 && !t.gone) : t.hp > 0;
        if (alive) { p.tx = t.x; p.tz = t.z; }
        const dx = p.tx - p.x, dz = p.tz - p.z;
        const d = hyp(dx, dz);
        p.yaw = Math.atan2(dx, dz);
        if (d <= step + 0.3) {
          p.x = p.tx; p.z = p.tz;
          if (alive) this.projectileHit(p, t, dx / (d || 1), dz / (d || 1));
          if (!p.straight) dead = true;
        } else {
          p.x += (dx / d) * step; p.z += (dz / d) * step;
          p.travelled += step;
          const k = Math.min(1, p.travelled / p.dist0);
          p.y = p.y0 + (1.1 - p.y0) * k + Math.sin(k * Math.PI) * (p.lob ? Math.min(10, p.dist0 * 0.45) : Math.min(3, p.dist0 * 0.12));
        }
      }
      if (dead) this.projectiles.splice(i, 1);
    }
  }

  projectileHit(p, t, dirX, dirZ) {
    if (p.from === 'enemy') {
      if (t === this.hero) this.hurtHero(p.dmg);
      else if (t.gate) this.hurtGate(t, p.dmg);
      else if (t.bld) this.hurtStructure(t, p.dmg);
      else if (t.castle) this.hurtCastle(p.dmg);
      else this.hurtAlly(t, p.dmg);
      return;
    }
    this.damageEnemy(t, p.dmg, p.kind);
    if (p.burn) { t.burn = 3; t.burnDps = Math.max(t.burnDps, p.dmg * p.burn); }
    if (p.chain) {
      // Lightning leaps on to the nearest enemies the arrow didn't hit.
      let from = t;
      const hit = new Set([t]);
      for (let k = 0; k < p.chain; k++) {
        let next = null, bd = 6;
        for (const e of this.enemies) {
          if (e.hp <= 0 || hit.has(e) || e.invuln) continue;
          const d = hyp(e.x - from.x, e.z - from.z);
          if (d < bd) { bd = d; next = e; }
        }
        if (!next) break;
        hit.add(next);
        this.emit('chain', { x0: from.x, z0: from.z, x1: next.x, z1: next.z });
        this.damageEnemy(next, p.dmg * 0.65, 'chain');
        from = next;
      }
    }
    if (p.splash) {
      for (const e of this.enemies) {
        if (e === t || e.hp <= 0) continue;
        if (hyp(e.x - t.x, e.z - t.z) < p.splash) {
          this.damageEnemy(e, p.dmg * p.splashK, 'splash');
          if (p.burn) { e.burn = 2; e.burnDps = Math.max(e.burnDps, p.dmg * p.burn * 0.5); }
        }
      }
      this.emit('splash', { x: t.x, z: t.z, r: p.splash, kind: p.kind });
    }
    if (p.pierce > 0) {
      p.hit = new Set([t]);
      p.dirX = dirX; p.dirZ = dirZ;
      p.straight = 9;
    }
  }

  damageEnemy(e, dmg, src) {
    if (e.hp <= 0) return;
    if (e.invuln) { if (src !== 'burn') this.emit('blocked', { x: e.x, z: e.z }); return; }
    const armor = e.def.armor || 0;
    const real = src === 'burn' ? dmg : Math.max(dmg * 0.25, dmg - armor);
    e.hp -= real;
    e.flash = 1;
    if (src !== 'burn') this.emit('hit', { x: e.x, z: e.z, kind: e.kind, src, dmg: real });
    if (e.hp <= 0) this.killEnemy(e);
  }

  killEnemy(e) {
    this.stats.kills++;
    const camp = e.guard && String(e.guard.camp);
    if (camp && camp.startsWith('enc:')) { const id = camp.slice(4); this.encLeft[id] = Math.max(0, (this.encLeft[id] ?? 1) - 1); }
    this.emit('kill', { x: e.x, z: e.z, kind: e.kind, scale: e.scale, boss: !!e.name, structure: !!e.static });
    const n = e.coins;
    if (n > 12) this.burstCoins(e.x, e.z, n);
    else for (let i = 0; i < n; i++) this.dropCoin(e.x, e.z, 1, 1);
    // The treant drops bundles of logs.
    if (e.def.wood) for (let i = 0; i < 9; i++) this.dropCoin(e.x, e.z, Math.ceil(e.def.wood / 9), 1, 'wood');
    if (e.kind === 'sgate') {
      this.sgKeep.invuln = false;
      this.emit('gateFallen', {});
      // The warlord comes out of the keep to meet the king.
      const n2 = this.wave + 1;
      this.spawnEnemy({
        kind: 'boss', lane: 'S', s: 0,
        boss: { name: 'Warlord of the Stronghold', hpMul: 2.2 * (1 + (n2 - 15) * 0.1), coins: 250, scale: 3.4 },
      });
    }
    if (e.kind === 'skeep') this.winLevel();
    if (e.fort && !this.enemies.some((x) => x.fort && x !== e && x.hp > 0)) {
      this.finishBuilding(this.b.pass);
      this.emit('fortTaken', { x: e.x, z: e.z });
    }
  }

  winLevel() {
    this.phase = 'won';
    this.won = true;
    this.siege = false;
    this.emit('levelWon', { level: this.level });
  }

  // ---------------------------------------------------------------- hurt
  hurtHero(dmg) {
    const h = this.hero;
    if (!h.alive) return;
    h.hp -= dmg;
    h.lastHurt = this.t;
    h.flash = 1;
    this.emit('heroHurt', { dmg });
    if (h.hp <= 0) {
      h.alive = false;
      h.hp = 0;
      h.respawnT = HERO.respawn;
      if (h.coins > 0) { this.burstCoins(h.x, h.z, h.coins); h.coins = 0; }
      h.load = { res: null, n: 0 };
      h.tool = null;
      this.emit('heroDown', { x: h.x, z: h.z });
      // Losing the king loses the wave: it has to be fought again from the start.
      if (this.phase === 'wave') {
        this.phase = 'lost';
        this.emit('waveLost', { wave: this.wave + 1, siege: this.siege });
      }
    }
  }

  hurtAlly(a, dmg) {
    if (a.gone) return;
    a.hp -= dmg / this.armorMul();
    a.flash = 1;
    a.lastHurt = this.t;
    if (a.hp <= 0) {
      a.gone = true;
      const i = this.allies.indexOf(a);
      if (i >= 0) this.allies.splice(i, 1);
      this.emit('allyDown', { x: a.x, z: a.z, kind: a.kind });
    }
  }

  hurtGate(g, dmg) {
    if (g.hp <= 0) return;
    g.hp -= dmg;
    this.emit('gateHit', { x: g.x, z: g.z });
    if (g.hp <= 0) { g.hp = 0; this.emit('gateBroken', { lane: g.lane, x: g.x, z: g.z }); }
  }

  // A tower, catapult or outpost under attack in the siege. At zero it is
  // wrecked back to a build pad (its posted archers are lost).
  hurtStructure(b, dmg) {
    if (b.state !== 'built' || !(b.hp > 0)) return;
    b.hp -= dmg;
    b.flash = 1;
    this.emit('structHit', { x: b.x, z: b.z });
    if (b.hp > 0) return;
    const name = b.type === 'outpost' ? OUTPOST[b.id].name : b.type === 'catapult' ? BUILDINGS.catapult.levels[b.level].name : BUILDINGS.tower.levels[b.level].name;
    b.hp = 0; b.gone = true; b.bld = false;
    b.state = 'site'; b.level = 0; b.garrison = 0;
    this.emit('wrecked', { x: b.x, z: b.z, name, outpost: b.type === 'outpost' });
  }

  hurtCastle(dmg) {
    if (this.phase !== 'wave') return;
    this.castleHp -= dmg;
    this.emit('castleHit', { dmg });
    if (this.castleHp <= 0) {
      this.castleHp = 0;
      this.phase = 'defeat';
      this.emit('defeat', { wave: this.wave + 1 });
    }
  }

  // ------------------------------------------------------------- enemies
  updateEnemies(dt) {
    const hero = this.hero;
    for (const e of this.enemies) {
      if (e.hp <= 0) continue;
      e.flash = Math.max(0, e.flash - dt * 5);
      e.atkCd -= dt;
      e.attackT = Math.max(0, e.attackT - dt);
      if (e.burn > 0) {
        e.burn -= dt;
        this.damageEnemy(e, e.burnDps * dt, 'burn');
        if (e.hp <= 0) continue;
      }
      const def = e.def;
      if (e.static) { this.updateStructure(e); continue; }
      const lane = e.lane;
      lanePoint(lane, e.s, tmpP);
      // Camp guards hold their post instead of marching down a road.
      const homeX = e.guard ? e.guard.x : tmpP.x - tmpP.dz * e.off, homeZ = e.guard ? e.guard.z : tmpP.z + tmpP.dx * e.off;

      // Pick a fight with anyone nearby.
      e.retarget -= dt;
      if (e.retarget <= 0) {
        e.retarget = 0.3;
        if (e.target && (e.target.gone || (e.target === hero && !hero.alive) || hyp(e.target.x - e.x, e.target.z - e.z) > (def.onPath ? def.range : def.aggro * 1.7))) e.target = null;
        if (!e.target && def.onPath && !e.guard) {
          // Bowmen keep to the road and shoot whoever is nearest in range.
          let best = null, bd = def.range;
          if (hero.alive) { const d = hyp(hero.x - e.x, hero.z - e.z); if (d < bd) { bd = d; best = hero; } }
          for (const a of this.allies) { const d = hyp(a.x - e.x, a.z - e.z); if (d < bd) { bd = d; best = a; } }
          e.target = best;
        } else if (!e.target && def.aggro > 0) {
          let best = null, bd = e.guard ? Math.max(def.aggro, 8) : def.aggro;
          if (hero.alive) { const d = hyp(hero.x - e.x, hero.z - e.z); if (d < bd) { bd = d; best = hero; } }
          for (const a of this.allies) { const d = hyp(a.x - e.x, a.z - e.z); if (d < bd) { bd = d; best = a; } }
          e.target = best;
        }
        // In the siege, columns marching on the road turn on any tower,
        // catapult or outpost they come across.
        if (!e.target && this.siege && !e.guard) {
          let best = null, bd = def.ranged ? def.range : 7;
          for (const b of Object.values(this.b)) {
            if (!b.bld || b.state !== 'built' || !(b.hp > 0)) continue;
            const d = hyp(b.x - e.x, b.z - e.z) - b.size / 2;
            if (d < bd) { bd = d; best = b; }
          }
          if (best) e.target = best;
        }
        if (e.target && !e.target.bld && hyp(e.x - homeX, e.z - homeZ) > (e.guard ? 10 : def.leash || 10)) e.target = null;
        if (e.target?.bld && (e.target.state !== 'built' || !(e.target.hp > 0))) e.target = null;
      }

      let mx = 0, mz = 0, want = 0;
      const t = e.target;
      if (t && def.onPath && !e.guard) {
        // Stand on the road and loose arrows.
        e.yaw = Math.atan2(t.x - e.x, t.z - e.z);
        if (e.atkCd <= 0) this.enemyAttack(e, t);
      } else if (t) {
        const d = hyp(t.x - e.x, t.z - e.z);
        e.yaw = Math.atan2(t.x - e.x, t.z - e.z);
        if (d > def.range + 0.6 + (t.bld ? t.size / 2 : 0)) { mx = (t.x - e.x) / d; mz = (t.z - e.z) / d; want = e.speed * 1.1; }
        else if (e.atkCd <= 0) this.enemyAttack(e, t);
      } else if (e.guard) {
        const dHome = hyp(homeX - e.x, homeZ - e.z);
        if (dHome > 0.8) { mx = (homeX - e.x) / dHome; mz = (homeZ - e.z) / dHome; want = e.speed; e.yaw = Math.atan2(mx, mz); }
      } else {
        // Gate in the way?
        const g = this.gates[lane.id];
        const reach = def.ranged ? def.range * 0.85 : 1.1 + def.radius;
        const stopAt = g && g.hp > 0 ? g.s - reach : lane.length - (def.ranged ? def.range * 0.8 : CASTLE_R * 0.4 + def.radius);
        const dHome = hyp(homeX - e.x, homeZ - e.z);
        if (dHome > 1.5) {
          // Wandered off the road chasing someone: head back first.
          mx = (homeX - e.x) / dHome; mz = (homeZ - e.z) / dHome; want = e.speed;
          e.yaw = Math.atan2(mx, mz);
        } else if (e.s < stopAt) {
          e.s = Math.min(stopAt, e.s + e.speed * dt);
          lanePoint(lane, e.s, tmpP);
          const nx = tmpP.x - tmpP.dz * e.off, nz = tmpP.z + tmpP.dx * e.off;
          const dx = nx - e.x, dz = nz - e.z;
          const dd = hyp(dx, dz);
          if (dd > 0.001) { mx = dx / dd; mz = dz / dd; want = Math.min(dd / dt, e.speed * 1.4); e.yaw = Math.atan2(dx, dz); }
        } else if (e.atkCd <= 0) {
          if (g && g.hp > 0) { e.yaw = Math.atan2(g.x - e.x, g.z - e.z); this.enemyAttack(e, g); }
          else { e.yaw = Math.atan2(-e.x, -e.z); this.enemyAttack(e, 'castle'); }
        }
      }
      // Fording the river is slow going.
      if (Math.abs(e.z - RIVER_Z) < RIVER_HALF && e.x < RIVER_X1 && !this.built('bridge')) want *= 0.55;
      e.x += mx * want * dt;
      e.z += mz * want * dt;
      e.moving = want > 0.05;
      if (e.moving) e.anim += dt * e.speed * 3.2;
    }
    // Clear out the dead.
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].hp <= 0) { this.enemies[i].gone = true; this.enemies.splice(i, 1); }
    separate(this.enemies.filter((e) => !e.static), 0.5);
  }

  // Stronghold towers shoot whoever comes in range; gates and keeps just stand.
  updateStructure(e) {
    const def = e.def;
    if (!def.ranged || e.atkCd > 0) return;
    const hero = this.hero;
    let best = null, bd = def.range;
    if (hero.alive) { const d = hyp(hero.x - e.x, hero.z - e.z); if (d < bd) { bd = d; best = hero; } }
    for (const a of this.allies) { const d = hyp(a.x - e.x, a.z - e.z); if (d < bd) { bd = d; best = a; } }
    if (best) this.enemyAttack(e, best);
    else e.atkCd = 0.3;
  }

  // Where each attacking road's front-runner is (or where it will appear),
  // for the arrows that point the king towards incoming enemies.
  laneThreats() {
    if (this.phase !== 'wave') return [];
    const by = {};
    const slot = (id) => (by[id] = by[id] || { count: 0, lead: null, rem: Infinity });
    for (const q of this.spawnQueue) slot(q.lane).count++;
    for (const e of this.enemies) {
      if (e.static || e.guard || e.hp <= 0) continue;
      const v = slot(e.lane.id);
      v.count++;
      const rem = e.lane.length - e.s;
      if (rem < v.rem) { v.rem = rem; v.lead = e; }
    }
    return Object.entries(by).map(([id, v]) => {
      const lane = LANE[id];
      let x, z;
      if (v.lead) { x = v.lead.x; z = v.lead.z; }
      else {
        const s0 = id === 'S' ? laneAtZ(lane, Math.min(STRONGHOLD.gateZ, this.frontier + 10)) : 0;
        lanePoint(lane, s0, tmpP); x = tmpP.x; z = tmpP.z;
      }
      return { lane: id, name: lane.name, count: v.count, x, z, gate: this.gates[id] };
    });
  }

  // Enemies still to beat this wave (the stronghold itself isn't counted).
  get enemiesLeft() { return this.spawnQueue.length + this.enemies.filter((e) => !e.static && !e.guard).length; }

  // Raise the enemy camps in the highland (the ones not yet beaten).
  spawnCamps(alive = null) {
    const mul = levelMul(this.level) * (1 + 0.08 * this.wave);
    for (const c of CAMPS) {
      const n = alive ? alive[c.id] ?? 0 : c.kinds.length;
      c.kinds.slice(0, n).forEach((kind, i) => {
        const def = ENEMIES[kind];
        const a = (i / c.kinds.length) * TAU;
        const gx = c.x + Math.cos(a) * 1.6, gz = c.z + Math.sin(a) * 1.6;
        this.enemies.push({
          id: this.id(), kind, lane: LANE.E, s: 0, off: 0, x: gx, z: gz, yaw: rand(0, TAU), guard: { x: gx, z: gz, camp: c.id },
          hp: def.hp * mul, max: def.hp * mul, dmg: def.dmg * levelMul(this.level), atkCd: rand(0, 1), speed: def.speed * 1.2,
          target: null, retarget: Math.random() * 0.3, burn: 0, burnDps: 0, flash: 0, anim: Math.random() * 10, moving: false,
          attackT: 0, def, scale: def.scale || 1, coins: def.coins + 2, name: null,
        });
      });
    }
  }

  campsAlive() {
    const out = {};
    for (const c of CAMPS) out[c.id] = 0;
    for (const e of this.enemies) if (e.guard && e.hp > 0 && e.guard.camp in out) out[e.guard.camp]++;
    return out;
  }

  enemyAttack(e, t) {
    const def = e.def;
    e.atkCd = def.interval;
    e.attackT = 0.3;
    if (def.ranged) {
      let target = t;
      if (t === 'castle') {
        const d = hyp(e.x, e.z) || 1;
        target = { x: (e.x / d) * CASTLE_R, z: (e.z / d) * CASTLE_R, castle: true, hp: 1 };
      }
      this.shoot(e.x, e.z, 1.4, target, { dmg: e.dmg, speed: 22, from: 'enemy' });
      return;
    }
    if (def.slam) {
      // Boss: ground slam hits everyone around the target.
      const cx = t === 'castle' ? e.x : t.x, cz = t === 'castle' ? e.z : t.z;
      this.emit('slam', { x: cx, z: cz, r: def.slam });
      if (hero_in(this.hero, cx, cz, def.slam)) this.hurtHero(e.dmg);
      for (const a of [...this.allies]) if (hyp(a.x - cx, a.z - cz) < def.slam) this.hurtAlly(a, e.dmg);
      if (t === 'castle') this.hurtCastle(e.dmg);
      else if (t.gate) this.hurtGate(t, e.dmg * 1.5);
      return;
    }
    if (t === 'castle') this.hurtCastle(e.dmg);
    else if (t.gate) this.hurtGate(t, e.dmg * (e.kind === 'brute' ? 2 : 1));
    else if (t.bld) this.hurtStructure(t, e.dmg * (e.kind === 'brute' ? 2.5 : 1.2));
    else if (t === this.hero) this.hurtHero(e.dmg);
    else this.hurtAlly(t, e.dmg);
  }

  // ---------------------------------------------------------------- hero
  updateHero(dt, input) {
    const h = this.hero;
    h.flash = Math.max(0, (h.flash || 0) - dt * 4);
    if (!h.alive) {
      h.respawnT -= dt;
      if (h.respawnT <= 0) {
        h.alive = true;
        h.hp = this.heroMaxHp;
        h.x = 0; h.z = CASTLE_R + 2;
        h.vx = h.vz = 0;
        this.emit('heroUp', {});
      }
      return;
    }
    // In a wave the king only heals at the castle; between waves, anywhere.
    h.healing = false;
    if (this.phase === 'wave') {
      if (this.atCastle() && h.hp < this.heroMaxHp) {
        h.hp = Math.min(this.heroMaxHp, h.hp + HERO.castleHeal * dt);
        h.healing = true;
      }
    } else if (this.t - h.lastHurt > HERO.regenDelay) h.hp = Math.min(this.heroMaxHp, h.hp + HERO.regen * dt);

    // Movement.
    const sp = this.heroStat('speed');
    const ix = input.x, iz = input.z;
    const im = Math.min(1, hyp(ix, iz));
    const tx = im > 0.05 ? (ix / (hyp(ix, iz) || 1)) * im * sp : 0;
    const tz = im > 0.05 ? (iz / (hyp(ix, iz) || 1)) * im * sp : 0;
    const k = Math.min(1, dt * 12);
    h.vx += (tx - h.vx) * k;
    h.vz += (tz - h.vz) * k;
    let nx = h.x + h.vx * dt, nz = h.z + h.vz * dt;

    // River: only crossable on the bridge. (`noclip` is for the balance bot.)
    const onBridge = this.built('bridge') && Math.abs(nx - BRIDGE.x) < 2.1;
    if (!onBridge && !this.noclip && nx < RIVER_X1 && Math.abs(nz - RIVER_Z) < RIVER_HALF + 0.4) {
      nz = h.z < RIVER_Z ? Math.min(nz, RIVER_Z - RIVER_HALF - 0.4) : Math.max(nz, RIVER_Z + RIVER_HALF + 0.4);
      if (this.built('bridge') && Math.abs(nx - BRIDGE.x) < 3.2) nx += (BRIDGE.x - nx) * Math.min(1, dt * 6);
    }
    nx = Math.max(-BOUNDS, Math.min(eastLimit(nz), nx));
    // South, the king can ride as far as the road he has claimed. At the
    // stronghold its gate holds him out until it is broken.
    let zMax = this.frontier - 1.5;
    if (this.siegeReady || this.siege) {
      const gateUp = !this.sgGate || this.sgGate.hp > 0;
      if (Math.abs(nx - STRONGHOLD.x) < STRONGHOLD.half + 1) zMax = gateUp ? STRONGHOLD.gateZ - 2.5 : STRONGHOLD.z + 4;
      else zMax = STRONGHOLD.gateZ - 3;
    }
    nz = Math.max(-BOUNDS, Math.min(zMax, nz));
    // Gate down: in through the gateway only, and not through the walls.
    if ((this.siegeReady || this.siege) && this.sgGate && this.sgGate.hp <= 0 && !this.noclip) {
      const S = STRONGHOLD, r = HERO.radius, open = 2.9 - r;
      const z0 = S.gateZ - 1.1 - r, z1 = S.gateZ + 1.1 + r;
      if (nz > z0 && nz < z1 && Math.abs(nx - S.x) > open) nz = h.z < S.gateZ ? z0 : z1;
      if (nz >= z1) nx = Math.max(S.x - S.half + 1.1 + r, Math.min(S.x + S.half - 1.1 - r, nx));
    }

    // The highland's crags: in and out only through the gorge, once cleared.
    if (!this.noclip && inHighland(nx, nz) !== inHighland(h.x, h.z)) {
      const gorge = this.built('pass') && Math.abs(nz - HIGHLAND.gorgeZ) < HIGHLAND.gorgeHalf && Math.abs(nx - HIGHLAND.x0) < 1.5;
      if (!gorge) {
        if (inHighland(h.x, nz) === inHighland(h.x, h.z)) nx = h.x;
        else if (inHighland(nx, h.z) === inHighland(h.x, h.z)) nz = h.z;
        else { nx = h.x; nz = h.z; }
      }
    }

    // Buildings are solid; pads and sites are not.
    const R = HERO.radius;
    for (const b of this.noclip ? [] : Object.values(this.b)) {
      if (b.state !== 'built' || b.type === 'bridge' || b.type === 'pass') continue;
      const hs = (b.type === 'castle' ? CASTLE_R : b.size / 2 * 0.8) + R;
      const dx = nx - b.x, dz = nz - b.z;
      if (Math.abs(dx) < hs && Math.abs(dz) < hs) {
        const px = hs - Math.abs(dx), pz = hs - Math.abs(dz);
        if (px < pz) nx += Math.sign(dx || 1) * px;
        else nz += Math.sign(dz || 1) * pz;
      }
    }
    // The journey's cottages, wells, columns and towers are solid too.
    if (!this.noclip) for (const p of SOLID_PROPS) {
      const dx = nx - p.x, dz = nz - p.z, d = hyp(dx, dz), rr = p.r + R;
      if (d < rr && d > 1e-6) { nx = p.x + (dx / d) * rr; nz = p.z + (dz / d) * rr; }
    }
    h.x = nx; h.z = nz;
    const v = hyp(h.vx, h.vz);
    h.moving = v > 0.6;
    if (h.moving) { h.yaw = turn(h.yaw, Math.atan2(h.vx, h.vz), dt * 12); h.anim += dt * (4 + v * 0.75); }

    this.updateGathering(dt);

    // Shooting.
    h.atkCd -= dt;
    h.shootT = Math.max(0, h.shootT - dt);
    const wp = WEAPONS[h.weapon];
    const range = this.heroStat('range');
    if (h.atkCd <= 0) {
      const targets = this.nearestEnemies(h.x, h.z, range, wp.count || 1);
      if (targets.length) {
        h.atkCd = wp.interval / this.heroStat('rate');
        h.shootT = 0.32;
        h.lastShot = this.t;
        const dmg = this.heroStat('damage') * wp.dmg * this.smithMul('arrows') * ROYAL_BOW[h.bow || 0].mul;
        for (const t of targets) {
          this.shoot(h.x, h.z, 2.3, t, {
            dmg, speed: wp.speed, from: 'hero', pierce: wp.pierce, burn: wp.burn, splash: wp.splash, chain: wp.chain,
            kind: h.weapon === 'fire' ? 'fire' : h.weapon === 'crossbow' ? 'bolt' : h.weapon === 'storm' ? 'storm' : 'arrow',
          });
        }
        if (!h.moving) h.yaw = turn(h.yaw, Math.atan2(targets[0].x - h.x, targets[0].z - h.z), 1);
      } else h.atkCd = 0.1;
    }

    // Coins: the magnet pulls them in, the stack catches them.
    const mag = this.heroStat('magnet');
    const cap = this.carry;
    let got = 0;
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      if (c.vy !== 0 || c.y > 0.2) continue;
      const d = hyp(c.x - h.x, c.z - h.z);
      const wood = c.res === 'wood';   // logs go to the stores, so they never fill the stack
      if (!wood && h.coins >= cap) { c.fly = false; continue; }
      if (d < mag) c.fly = true;
      else if (d > mag + 3) c.fly = false;   // outran it: let it drop
      if (c.fly) {
        const s = Math.min(d, Math.max(20, 24 + (mag - d) * 6) * dt);
        c.x += ((h.x - c.x) / (d || 1)) * s;
        c.z += ((h.z - c.z) / (d || 1)) * s;
        if (d < 0.7) {
          if (wood) {
            this.res.wood += c.value;
            this.emit('deliver', { x: h.x, z: h.z, res: 'wood', amt: c.value });
            this.coins.splice(i, 1);
            continue;
          }
          const take = Math.min(c.value, cap - h.coins);
          h.coins += take;
          this.logIncome('gold', 'battle', take);
          c.value -= take;
          got += take;
          if (c.value <= 0) this.coins.splice(i, 1);
        }
      }
    }
    if (got) this.emit('pickup', { n: got });

    // Gold mine pile.
    for (const m of this.list('goldmine')) {
      if (m.state !== 'built' || m.pile <= 0) continue;
      if (rectDist(h.x, h.z, m) < 2.2 && h.coins < cap) {
        m.pileAcc = (m.pileAcc || 0) + dt * 45;
        const n = Math.min(Math.floor(m.pileAcc), m.pile, cap - h.coins);
        if (n > 0) { m.pileAcc -= n; m.pile -= n; h.coins += n; this.logIncome('gold', m.id, n, 'home'); this.emit('pickup', { n, from: m.id }); }
      }
    }

    // Standing on a pad buys it, if the king has everything it costs.
    let site = null;
    for (const b of Object.values(this.b)) {
      if (b.state !== 'site' || !this.padVisible(b)) continue;
      // The bridge pad sits over water, so the bank counts as standing on it.
      if (rectDist(h.x, h.z, b) <= (b.type === 'bridge' ? 0.8 : 0.3)) { site = b; break; }
    }
    if (site && site.id === h.fundId) h.fundT += dt;
    else { h.fundT = 0; h.fundId = site ? site.id : null; h.needShown = false; }
    if (site && h.fundT > 0.3 && !h.needShown) {
      const key = `build:${site.id}`;
      const it = this.item(key);
      h.needShown = true;  // one attempt per visit
      if (it.locked) this.emit('need', { text: `Needs ${it.locked}` });
      else {
        const paid = this.fund(key);
        if (paid) this.emit('spend', { n: it.cost.gold || 0, x: site.x, z: site.z });
      }
    }
  }

  // The king gathers too. Standing still by a forest tree he chops it down,
  // by a highland boulder he breaks it up, and the pieces go on his horse.
  // Riding past a lumber camp or quarry he scoops up its stockpile. He banks
  // it all at the castle, a warehouse or an outpost.
  updateGathering(dt) {
    const h = this.hero;
    h.tool = null;
    const room = () => this.loadCap - h.load.n;
    const can = (res) => (h.load.n === 0 || h.load.res === res) && room() > 0;
    const add = (res, k) => { h.load.res = res; h.load.n += k; this.logIncome(res, 'king', k); this.emit('gather', { res, x: h.x, z: h.z, k, n: h.load.n, cap: this.loadCap }); };
    // Bank the load.
    const depot = this.atCastle()
      || this.list('outpost').some((o) => o.state === 'built' && hyp(o.x - h.x, o.z - h.z) < 6)
      || this.list('warehouse').some((w) => w.state === 'built' && rectDist(h.x, h.z, w) < 2.5);
    if (h.load.n > 0 && depot) {
      this.res[h.load.res] += h.load.n;
      this.logIncome(h.load.res, 'king', h.load.n, 'home');
      this.emit('deliver', { x: h.x, z: h.z, res: h.load.res, amt: h.load.n });
      h.load = { res: null, n: 0 };
      h.warned = null;
    }
    // Coins go into the bank at a warehouse, safe and still spendable.
    if (h.coins > 0 && this.list('warehouse').some((w) => w.state === 'built' && rectDist(h.x, h.z, w) < 2.5)) {
      this.res.gold += h.coins;
      this.emit('deposit', { x: h.x, z: h.z, n: h.coins });
      h.coins = 0;
    }
    // Scoop up a hut's stockpile.
    for (const hut of [...this.list('lumber'), ...this.list('quarry'), ...this.list('ironmine')]) {
      if (hut.state !== 'built' || !(hut.stock > 0) || rectDist(h.x, h.z, hut) > 2.4) continue;
      const res = HUT_RES[hut.type];
      const k = Math.min(room(), hut.stock - (hut.reserved || 0));
      if (can(res) && k > 0) { hut.stock -= k; add(res, k); }
    }
    if (hyp(h.vx, h.vz) > 1.0 || this.nearestEnemy(h.x, h.z, this.heroStat('range'))) { h.gatherT = 0; return; }
    // The nearest tree or boulder in reach: pieces on the ground first.
    let node = null, wood = false, bd = GATHER_REACH;
    for (const [list, w] of [[this.trees, true], [this.stones, false]]) {
      for (const n of list) {
        if (n.state !== 'up' && !(n.state === 'down' && n.pieces > 0)) continue;
        if (Math.abs(n.x - h.x) > GATHER_REACH || Math.abs(n.z - h.z) > GATHER_REACH) continue;
        const d = hyp(n.x - h.x, n.z - h.z) - (n.state === 'down' ? 1 : 0);
        if (d < bd) { bd = d; node = n; wood = w; }
      }
    }
    if (!node) { h.gatherT = 0; return; }
    const res = wood ? 'wood' : node.iron ? 'iron' : 'stone';
    const warn = (key, text) => { if (h.warned !== key) { h.warned = key; this.emit('need', { text }); } };
    if (h.load.n > 0 && h.load.res !== res) return warn('mix', `Drop your ${h.load.res} at the castle first`);
    if (room() <= 0) return warn('full', 'Your load is full: carry it back to the castle');
    h.gatherT += dt;
    if (node.state === 'down') {
      if (h.gatherT < 0.3) return;
      h.gatherT = 0;
      const k = Math.min(node.pieces, room());
      this.takePieces(node, k);
      add(res, k);
      return;
    }
    h.tool = wood ? 'axe' : 'pick';
    h.toolAt = node;
    // Face the tree or boulder being worked.
    h.yaw = turn(h.yaw, Math.atan2(node.x - h.x, node.z - h.z), dt * 10);
    if (h.gatherT >= KING_SWING / this.smithMul('king')) {
      h.gatherT = 0;
      h.swings = (h.swings || 0) + 1;
      this.hitNode(node, wood, h.x, h.z);
      if (node.state === 'down') { const k = Math.min(node.pieces, room()); this.takePieces(node, k); add(res, k); }
    }
  }

  atCastle() { return Math.max(Math.abs(this.hero.x), Math.abs(this.hero.z)) < CASTLE_R + HERO.healRadius; }

  // Which built building is at this ground point? Used for tapping buildings.
  buildingAt(x, z, pad = 0.6) {
    let best = null, bd = Infinity;
    for (const b of Object.values(this.b)) {
      if (b.state !== 'built' || b.type === 'bridge' || b.type === 'pass') continue;
      const d = b.type === 'castle' ? castleDist(x, z) : rectDist(x, z, b);
      if (d <= pad && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // Which built building is the king standing beside (for its menu)?
  nearBuilding() {
    const h = this.hero;
    if (!h.alive) return null;
    let best = null, bd = Infinity;
    for (const b of Object.values(this.b)) {
      if (b.state !== 'built' || b.type === 'bridge') continue;
      const d = b.type === 'castle' ? castleDist(h.x, h.z) : rectDist(h.x, h.z, b);
      if (d < 1.9 && d < bd) { bd = d; best = b; }
    }
    return best;
  }

  // --------------------------------------------------------------- towers
  updateTowers(dt) {
    for (const t of this.list('tower')) {
      if (t.state !== 'built') continue;
      const lv = BUILDINGS.tower.levels[t.level];
      t.atkCd -= dt;
      if (t.atkCd <= 0) {
        const e = this.nearestEnemy(t.x, t.z, lv.range);
        if (e) {
          t.atkCd = lv.interval;
          t.aim = Math.atan2(e.x - t.x, e.z - t.z);
          this.shoot(t.x, t.z, 4.2, e, { dmg: lv.dmg * this.smithMul('arrows'), speed: lv.pierce ? 40 : 30, from: 'tower', pierce: lv.pierce, kind: lv.pierce ? 'ballista' : 'bolt' });
        } else t.atkCd = 0.15;
      }
      for (let k = 0; k < t.garrison; k++) {
        t.slotCd[k] -= dt;
        if (t.slotCd[k] > 0) continue;
        const e = this.nearestEnemy(t.x, t.z, lv.range);
        if (e) {
          t.slotCd[k] = UNITS.archer.interval;
          this.shoot(t.x + (k - 1) * 0.5, t.z, 4.6, e, { dmg: UNITS.archer.dmg * (1 + this.armor * 0.15) * this.smithMul('arrows'), speed: 28, from: 'ally' });
        } else t.slotCd[k] = 0.2;
      }
    }
    // Catapults lob a boulder at the thickest knot of enemies in reach.
    for (const c of this.list('catapult')) {
      if (c.state !== 'built') continue;
      const lv = BUILDINGS.catapult.levels[c.level];
      c.atkCd -= dt;
      c.throwT = Math.max(0, (c.throwT || 0) - dt);
      if (c.atkCd > 0) continue;
      let best = null, bs = 0;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.invuln || e.static || e.guard) continue;
        const d = hyp(e.x - c.x, e.z - c.z);
        if (d > lv.range || d < lv.minRange) continue;
        let n = 1;
        for (const o of this.enemies) if (o !== e && o.hp > 0 && hyp(o.x - e.x, o.z - e.z) < lv.splash) n++;
        if (n > bs) { bs = n; best = e; }
      }
      if (best) {
        c.atkCd = lv.interval;
        c.throwT = 0.5;
        c.aim = Math.atan2(best.x - c.x, best.z - c.z);
        this.shoot(c.x, c.z, 3.2, best, { dmg: lv.dmg, speed: 15, from: 'tower', kind: 'boulder', splash: lv.splash, splashK: 0.8, lob: true });
      } else c.atkCd = 0.3;
    }
    // Outpost watchtowers.
    const ol = BUILDINGS.outpost.levels[0];
    for (const o of this.list('outpost')) {
      if (o.state !== 'built') continue;
      o.atkCd -= dt;
      if (o.atkCd > 0) continue;
      const e = this.nearestEnemy(o.x, o.z, ol.range);
      if (e && !e.static) {
        o.atkCd = ol.interval;
        o.aim = Math.atan2(e.x - o.x, e.z - o.z);
        this.shoot(o.x + 1.8, o.z - 1.8, 5, e, { dmg: ol.dmg * levelMul(this.level) * 0.8, speed: 30, from: 'tower', kind: 'bolt' });
      } else o.atkCd = 0.2;
    }
  }

  // ---------------------------------------------------------------- coins
  updateCoins(dt) {
    for (const c of this.coins) {
      c.age += dt;
      c.spin += dt * 3;
      if (c.vy !== 0 || c.y > 0.15) {
        c.vy -= 22 * dt;
        c.x += c.vx * dt; c.z += c.vz * dt;
        c.y += c.vy * dt;
        if (c.y <= 0.15) { c.y = 0.15; c.vy = 0; c.vx = c.vz = 0; }
      }
    }
  }

  // ----------------------------------------------------------------- step
  update(dt, input = { x: 0, z: 0 }) {
    if (this.phase === 'defeat') return;
    this.t += dt;

    if (this.phase === 'wave') {
      this.spawnT -= dt;
      if (this.spawnQueue.length && this.spawnT <= 0) {
        // One from each open lane per tick.
        const lanes = new Set();
        while (this.spawnQueue.length && !lanes.has(this.spawnQueue[0].lane)) {
          const q = this.spawnQueue.shift();
          lanes.add(q.lane);
          this.spawnEnemy(q);
        }
        this.spawnT = this.spec.spawnGap;
      }
      // During a siege the enemy keeps sending reinforcements from the gate.
      if (this.siege && !this.spawnQueue.length) {
        this.reinforceT -= dt;
        if (this.reinforceT <= 0) {
          // Ever bigger columns pour out of the gate and march up the road,
          // with a smaller raid on the other roads home.
          const n = ++this.reinforceN;
          this.reinforceT = 15;
          const lanes = this.lanesOpen.filter((l) => l.id !== 'S');
          const MIX = ['grunt', 'grunt', 'brute', 'archer', 'grunt', 'hound', 'brute', 'raider', 'archer', 'grunt'];
          const column = Math.min(30, 10 + 3 * n), raid = Math.min(8, 2 + Math.floor(n / 2));
          const hpK = 1.3 * (1 + 0.06 * n);
          this.spawnQueue = [
            ...Array.from({ length: column }, (_, i) => ({ kind: MIX[i % MIX.length], lane: 'S', hpK })),
            ...Array.from({ length: raid }, (_, i) => ({ kind: MIX[(i + 3) % MIX.length], lane: lanes[i % lanes.length]?.id || 'S' })),
          ];
          this.emit('column', { n, size: column });
        }
      }
    }

    this.updateHero(dt, input);
    this.updateVillagers(dt);
    this.updateNature(dt);
    this.updateAllies(dt);
    this.updateAdvice(dt);
    this.updateDiscovery();
    this.updateEncounters();
    this.updateTowers(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateCoins(dt);

    if (this.phase === 'wave' && !this.siege && !this.spawnQueue.length && !this.enemies.some((e) => !e.guard && !e.static)) this.endWave();

    // Objectives.
    let o = OBJECTIVES[this.objective];
    while (o && o.done(this)) {
      this.objective++;
      o = OBJECTIVES[this.objective];
      this.emit('objective', { text: o ? o.text : null });
    }
  }

  endWave() {
    this.wave++;
    this.phase = 'build';
    this.projectiles = this.projectiles.filter((p) => p.from !== 'enemy');
    this.castleHp = this.castleMax;
    for (const g of Object.values(this.gates)) g.hp = g.max;
    const bonus = this.spec.bonus;
    this.burstCoins(0, CASTLE_R + 2.5, bonus);
    this.emit('waveClear', { n: this.wave, bonus });
  }

  // --------------------------------------------------------------- saving
  // Saved in the build phase only; a mid-wave reload restarts that wave.
  snapshot() {
    const h = this.hero;
    return {
      v: 1,
      wave: this.wave,
      res: { ...this.res },
      funds: { ...this.funds },
      objective: this.objective,
      order: this.order,
      discovered: [...this.discovered],
      enc: { ...this.enc },
      encLeft: { ...this.encLeft },
      stations: { ...this.stations },
      smith: { ...this.smith },
      level: this.level,
      camps: this.built('pass') ? this.campsAlive() : null,
      stats: { ...this.stats },
      walls: { ...this.walls },
      armor: this.armor,
      hero: { x: h.x, z: h.z, coins: h.coins, up: { ...h.up }, weapons: { ...h.weapons }, weapon: h.weapon, load: { ...h.load }, bow: h.bow, style: { ...h.style }, styles: { ...h.styles }, kit: h.kit },
      buildings: Object.values(this.b).map((b) => ({ id: b.id, type: b.type, x: b.x, z: b.z, state: b.state, level: b.level, fixed: b.fixed, lane: b.lane, garrison: b.garrison, pile: b.pile, assigned: b.assigned, stock: b.stock || 0 })),
      villagers: this.villagers.length,
      allies: this.allies.map((a) => a.kind),
      coins: this.coins.map((c) => [Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10, c.value]),
      growT: this.growT,
    };
  }

  load(s) {
    this.phase = 'build';
    this.wave = s.wave;
    this.res = { gold: 0, iron: 0, ...s.res };
    this.smith = { king: 0, workers: 0, arrows: 0, ...(s.smith || {}) };
    this.order = s.order || (s.rally ? 'follow' : 'posts');
    this.discovered = [...(s.discovered || [])];
    this.enc = { ...this.enc, ...(s.enc || {}) };
    this.encLeft = { ...(s.encLeft || {}) };
    this.stations = { S: 0, E: 0, W: 0, N: 0, ...(s.stations || {}) };
    this.funds = {};
    this.objective = s.objective;
    this.level = s.level || 1;
    this.stats = { ...this.stats, ...s.stats };
    this.walls = { ...s.walls };
    this.armor = s.armor || 0;
    const h = this.hero;
    h.x = s.hero.x; h.z = s.hero.z;
    h.up = { ...h.up, ...s.hero.up };
    // Older saves could hold part-paid upgrades; hand that gold back.
    h.coins = s.hero.coins + Object.values(s.funds || {}).reduce((a, v) => a + v, 0);
    h.weapons = { ...s.hero.weapons };
    if (s.hero.load) h.load = { ...s.hero.load };
    h.weapon = s.hero.weapon;
    h.bow = s.hero.bow || 0;
    h.style = { ...DEFAULT_STYLE, ...(s.hero.style || {}) };
    h.styles = { ...(s.hero.styles || {}) };
    h.kit = KINGS[s.hero.kit] ? s.hero.kit : 'greenwood';
    h.hp = this.heroMaxHp;
    this.b = {};
    const fixed = Object.fromEntries(FIXED_PADS.map((p) => [p.id, p]));
    for (const d of s.buildings) {
      // Fixed pads always sit where the current map puts them.
      const f = d.fixed && fixed[d.id];
      if (d.fixed && !f) continue;
      this.addBuilding({ ...d, ...(f ? { x: f.x, z: f.z } : {}), born: 0 });
    }
    // Pads added in a later version of the map.
    for (const p of FIXED_PADS) if (!this.b[p.id]) this.addBuilding({ id: p.id, type: p.type, x: p.x, z: p.z, lane: p.lane, fixed: true, state: 'site', level: 0 });
    for (const d of s.buildings) {
      const n = Number(String(d.id).split('-').pop());
      if (n >= this.nextId) this.nextId = n + 1;
    }
    this.castleHp = this.castleMax;
    this.villagers = [];
    for (let i = 0; i < s.villagers; i++) this.spawnVillager(rand(-6, 6), CASTLE_R + rand(1, 4));
    this.allies = [];
    const barracks = this.firstOf('barracks') || { x: 0, z: CASTLE_R + 1, size: 0 };
    for (const k of s.allies) {
      const u = UNITS[k];
      this.allies.push({ id: this.id(), kind: k, x: barracks.x + rand(-1, 1), z: barracks.z + barracks.size / 2 + 1, yaw: 0, hp: u.hp, max: u.hp, atkCd: 0, target: null, post: null, lastHurt: -99, flash: 0, anim: 0, moving: false, slot: 0, attackT: 0 });
    }
    this.coins = [];
    for (const [x, z, v] of s.coins) this.dropCoin(x, z, v, 0);
    this.growT = s.growT || 0;
    this.enemies = [];
    this.projectiles = [];
    this.spawnQueue = [];
    this.gates = null;
    this.rebuildGates();
    if (this.built('pass')) this.spawnCamps(s.camps || null);
    else this.raiseFort();
  }
}

// ------------------------------------------------------------------ helpers
function order(kind) { return { grunt: 0, raider: 1, archer: 2, brute: 3 }[kind] ?? 0; }

function jobPriority(b) {
  if (!b) return 9;
  return { goldmine: 0, lumber: 1, warehouse: 2, quarry: 3, ironmine: 4, farm: 5 }[b.type] ?? 6;
}

function hero_in(h, x, z, r) { return h.alive && hyp(h.x - x, h.z - z) < r; }

function turn(a, b, k) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return a + d * Math.min(1, k);
}

// Push overlapping units apart. Cheap enough at these unit counts.
function separate(list, r0) {
  const n = list.length;
  for (let i = 0; i < n; i++) {
    const a = list[i];
    const ra = a.def ? a.def.radius : r0;
    for (let j = i + 1; j < n; j++) {
      const b = list[j];
      const rb = b.def ? b.def.radius : r0;
      const dx = b.x - a.x, dz = b.z - a.z;
      const min = (ra + rb) * 0.9;
      if (Math.abs(dx) > min || Math.abs(dz) > min) continue;
      const d = hyp(dx, dz);
      if (d >= min || d < 1e-4) continue;
      const push = (min - d) * 0.5;
      const wa = rb / (ra + rb), wb = ra / (ra + rb);
      a.x -= (dx / d) * push * wa * 2; a.z -= (dz / d) * push * wa * 2;
      b.x += (dx / d) * push * wb * 2; b.z += (dz / d) * push * wb * 2;
    }
  }
}

function fmt(v) { return Number.isInteger(v) ? v : v.toFixed(1); }

function upgradeDesc(type, cur, next) {
  switch (type) {
    case 'castle': {
      const lv = BUILDINGS.castle.levels.indexOf(next) + 1;
      const un = World.prototype.castleUnlocks(lv);
      return `Castle strength ${cur.hp} → ${next.hp}${un.length ? `. Unlocks: ${un.join(', ')}` : ''}`;
    }
    case 'house': return `Beds ${cur.beds} → ${next.beds}`;
    case 'farm': return `Growth +${Math.round(cur.growth * 100)}% → +${Math.round(next.growth * 100)}%, farmer slots ${cur.workers} → ${next.workers}`;
    case 'barracks': return `Army size ${cur.army} → ${next.army}, unlocks Raiders`;
    case 'goldmine': return `Miner slots ${cur.workers} → ${next.workers}, faster digging, pile ${cur.pile} → ${next.pile}`;
    case 'lumber':
    case 'quarry':
    case 'ironmine': return `Worker slots ${cur.workers} → ${next.workers}, ${cur.carry} → ${next.carry} per trip`;
    case 'catapult': return `${next.name}: blast ${cur.dmg} → ${next.dmg}, range ${cur.range} → ${next.range} m`;
    case 'tower': return `Damage ${cur.dmg} → ${next.dmg}, range ${cur.range} → ${next.range}m, archer posts ${cur.slots} → ${next.slots}`;
    default: return '';
  }
}
