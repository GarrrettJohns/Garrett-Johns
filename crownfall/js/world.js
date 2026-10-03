// The simulation: the king, his coins, buildings and their upgrades, villagers
// and the resources they haul, soldiers, enemies, projectiles and waves.
// Nothing here touches three.js or the DOM; it reports what happened through
// `events`, which main.js drains each frame for sound, effects and UI.

import {
  BUILDINGS, HERO, HERO_UPGRADES, WEAPONS, WALLS, UNITS, ENEMIES, VILLAGER,
  ARMOR_UPGRADE, waveSpec, levelInfo, levelMul,
} from './config.js';
import {
  LANES, LANE, lanePoint, laneCrossing, laneAtZ, FIXED_PADS, START, BRIDGE, RIVER_Z,
  RIVER_HALF, BOUNDS, CASTLE_R, distToLanes, PATH_HALF, GRID, STRONGHOLD, FRONTIERS, OUTPOSTS,
  HIGHLAND, inHighland, GORGE_OUT, GORGE_IN, CAMPS, FOREST_Z, scenery,
} from './map.js';

// Trees the king can chop (the forest and southern grove) and boulders he can
// mine (in the highland). Same seeded scenery the renderer draws.
const SCENE = scenery();
const CHOP_TREES = SCENE.trees.filter((t) => t.forest);
const MINE_ROCKS = SCENE.rocks.filter((r) => r.highland);
const GATHER_REACH = 3.2;
const GATHER_EVERY = 0.8;

const JOB_TYPES = ['goldmine', 'lumber', 'quarry', 'farm'];
const OUTPOST = Object.fromEntries(OUTPOSTS.map((o, i) => [o.id, { ...o, index: i }]));
// Distance from a point to the castle's square footprint (0 inside).
const castleDist = (x, z) => hyp(Math.max(Math.abs(x) - CASTLE_R, 0), Math.max(Math.abs(z) - CASTLE_R, 0));

const TAU = Math.PI * 2;
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
    text: 'Tap the Lumber Camp and add a worker with 👷 +',
    done: (w) => w.jobBuildings().some((b) => w.wantedAt(b) >= 2),
    at: (w) => w.firstOf('lumber'),
  },
  {
    text: 'Clear the Mountain Pass (it needs wood)',
    done: (w) => w.built('pass'),
    at: (w) => w.b.pass,
  },
  {
    text: 'Fight past the enemy camps and build the Gold Mine',
    done: (w) => w.built('goldmine'),
    at: (w) => w.b.goldmine,
  },
  {
    text: 'Tap the Castle and upgrade it',
    done: (w) => w.b.castle.level >= 1,
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Shore up your defences: upgrade a tower with wood',
    done: (w) => w.list('tower').some((t) => t.level >= 2),
    at: (w) => w.list('tower').find((t) => t.state === 'built' && t.level < 2) || null,
  },
  {
    text: 'Tap the Castle → Castle tab and fit Timber gates',
    done: (w) => w.walls.gate >= 2,
    at: (w) => ({ x: 0, z: CASTLE_R + 1 }),
  },
  {
    text: 'Defences holding? Now build a Quarry for stone',
    done: (w) => w.count('quarry') >= 1,
    at: (w) => w.b['quarry-1'],
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
      army: [...this.allies.map((a) => a.kind), ...this.list('tower').flatMap((t) => Array(t.garrison).fill('archer'))],
      coins: Math.min(h.coins, 150),
    };
  }

  applyCarry(c) {
    const h = this.hero;
    h.up = { ...h.up, ...c.up };
    h.weapons = { ...c.weapons };
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
    this.res = { wood: 0, stone: 0 };
    this.funds = {};
    this.objective = 0;
    this.stats = { kills: 0 };

    this.hero = {
      x: START.hero.x, z: START.hero.z, vx: 0, vz: 0, yaw: Math.PI, healing: false,
      hp: HERO.hp, alive: true, respawnT: 0, atkCd: 0, lastHurt: -99,
      coins: 0, moving: false, fundT: 0, fundAcc: 0, fundId: null,
      up: { damage: 0, rate: 0, range: 0, speed: 0, hp: 0, carry: 0, magnet: 0 },
      weapons: { bow: true }, weapon: 'bow', anim: 0, shootT: 0, flash: 0, needShown: false,
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
  // How many logs or stones the king can carry home himself.
  get loadCap() { return 20 + 10 * this.hero.up.carry; }
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
    if (b.type === 'tower') return LANE[b.lane].opens <= this.wave + 3;
    if (b.type === 'outpost') return OUTPOST[b.id].index === 0 || this.built(OUTPOSTS[OUTPOST[b.id].index - 1].id);
    if (b.needs && !this.built(b.needs)) return false;
    if (t.needs && !this.built(t.needs)) return false;
    if (b.id === 'lumber-3') return this.b.castle.level >= 1;
    if (b.id === 'quarry-2') return this.count('quarry') >= 1;
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
    return { text: o.text, target: o.at(this), index: this.objective, total: OBJECTIVES.length };
  }

  // ------------------------------------------------------------ purchases
  // Every purchase is identified by a key. Gold is paid in over time and kept
  // in `funds`; materials are taken when the gold is complete.
  item(key) {
    const [kind, a, c] = key.split(':');
    const w = this;
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
        desc: next ? `${fmt(v)} → ${fmt(nv)} ${u.unit}` : `${fmt(v)} ${u.unit} · max`,
        apply: () => { w.hero.up[a]++; if (a === 'hp') w.hero.hp = w.heroMaxHp; },
      };
    }
    if (kind === 'weapon') {
      const wp = WEAPONS[a];
      const owned = !!this.hero.weapons[a];
      return {
        key, icon: wp.icon, title: wp.name, desc: wp.desc, cost: owned ? {} : costText(wp.cost),
        owned, equipped: this.hero.weapon === a, locked: owned ? null : this.lockReason({ castle: wp.castle }),
        apply: () => { w.hero.weapons[a] = true; w.hero.weapon = a; },
      };
    }
    if (kind === 'workers') {
      const b = this.b[a];
      const per = { goldmine: 'digs gold into the pile', lumber: 'chops and hauls wood', quarry: 'cuts and hauls stone', farm: 'helps families grow' }[b.type];
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
    if (t === 'castle') {
      tabs = [
        { tab: 'King', items: ['hero:damage', 'hero:rate', 'hero:range', 'weapon:bow', 'weapon:crossbow', 'weapon:fire', 'weapon:multi', 'hero:speed', 'hero:hp', 'hero:carry', 'hero:magnet'] },
        { tab: 'Castle', items: ['up:castle', 'walls', 'gates'] },
      ];
    } else if (t === 'barracks') {
      tabs = [{ tab: 'Barracks', items: [`train:${b.id}:knight`, `train:${b.id}:archer`, `train:${b.id}:raider`, `up:${b.id}`, 'armor'] }];
    } else if (t === 'stable') {
      tabs = [{ tab: 'Stable', items: ['hero:speed', 'hero:hp', 'hero:carry', 'hero:magnet'] }];
    } else if (t === 'range') {
      tabs = [{ tab: 'Range', items: ['hero:damage', 'hero:rate', 'hero:range', 'weapon:bow', 'weapon:crossbow', 'weapon:fire', 'weapon:multi'] }];
    } else {
      const items = [];
      if (JOB_TYPES.includes(t)) items.push(`workers:${b.id}`);
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
    if (b.type === 'lumber' || b.type === 'quarry') lines.push(`${lv.carry} per trip`);
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
    return m;
  }

  // Everything the king is short of, gold included.
  shortfall(cost) {
    const m = [];
    if ((cost.gold || 0) > this.hero.coins) m.push(`${cost.gold - this.hero.coins} more gold`);
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
    this.hero.coins -= gold;
    this.res.wood -= it.cost.wood || 0;
    this.res.stone -= it.cost.stone || 0;
    it.apply();
    this.emit('bought', { key, title: it.title, gold });
    return gold || 1;
  }

  equip(w) {
    if (this.hero.weapons[w]) { this.hero.weapon = w; this.emit('equip', { w }); }
  }

  finishBuilding(b) {
    b.state = 'built';
    b.level = 0;
    if (JOB_TYPES.includes(b.type)) { b.assigned = 0; b.assigned = Math.min(1, Math.max(0, this.freeVillagers)); }
    b.born = this.t;
    this.emit('built', { id: b.id, x: b.x, z: b.z, type: b.type });
    if (b.type === 'bridge') this.emit('toast', { text: 'The forest is open! Build a Lumber Camp.' });
    if (b.type === 'pass') {
      this.spawnCamps();
      this.emit('toast', { text: 'The pass is open! Enemy camps hold the trail. Fight through to the mines.' });
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
    const R = this.wallRadius - 1.4;
    if (Math.abs(x) + h > R || Math.abs(z) + h > R) return { ok: false, reason: 'Must be inside the walls' };
    // Keep a lane open around everything so the king can always ride between.
    const GAP = 2;
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
    this.reinforceT = 30;
  }

  spawnEnemy(q) {
    const def = ENEMIES[q.kind];
    const spec = this.spec;
    const hp = def.hp * spec.hpMul * (q.boss ? q.boss.hpMul : 1);
    const lane = LANE[q.lane];
    // Southern troops muster just past the frontier (or at the stronghold gate).
    const s0 = q.s ?? (lane.id === 'S' ? laneAtZ(lane, Math.min(STRONGHOLD.gateZ, this.frontier + 10)) : 0);
    const e = {
      id: this.id(), kind: q.kind, lane, s: s0, off: rand(-1, 1) * (q.kind === 'boss' ? 0 : 1.1),
      x: 0, z: 0, yaw: 0, hp, max: hp, dmg: def.dmg * spec.dmgMul, atkCd: rand(0, 0.5),
      speed: def.speed * rand(0.92, 1.08), target: null, retarget: Math.random() * 0.25,
      burn: 0, burnDps: 0, flash: 0, anim: Math.random() * 10, moving: true, attackT: 0,
      def, scale: q.boss ? q.boss.scale : def.scale || 1, coins: q.boss ? q.boss.coins : def.coins,
      name: q.boss ? q.boss.name : null,
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
    const north = (z) => z < RIVER_Z;
    if (north(az) !== north(bz)) {
      const s = { x: BRIDGE.x, z: RIVER_Z + RIVER_HALF + 1.5 };
      const n = { x: BRIDGE.x, z: RIVER_Z - RIVER_HALF - 1.5 };
      return north(az) ? [n, s, { x: bx, z: bz }] : [s, n, { x: bx, z: bz }];
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
      for (const v of this.villagers) if (v.job && !this.built(v.job)) { v.job = null; v.state = 'idle'; v.carry = null; }
      for (const b of this.jobBuildings()) {
        const need = this.wantedAt(b);
        let have = this.workersAt(b);
        // Sent home: release the extras.
        for (const v of this.villagers) {
          if (have <= need) break;
          if (v.job !== b.id) continue;
          v.job = null; v.state = 'idle'; v.carry = null; v.path = []; v.t = 0;
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
          const step = Math.min(d, sp * dt * (v.carry ? 0.85 : 1));
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
            if (b.pile < lv.pile) { b.pile++; this.emit('dig', { x: b.x, z: b.z }); }
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

  // --------------------------------------------------------------- army
  train(b, kind) {
    // Take an idle villager first, else pull one off the least important job.
    let v = this.villagers.find((x) => !x.job);
    if (!v) v = [...this.villagers].sort((a, c) => jobPriority(this.b[c.job]) - jobPriority(this.b[a.job]))[0];
    if (!v) return;
    if (v.job && this.b[v.job]) this.b[v.job].assigned = Math.max(0, this.wantedAt(this.b[v.job]) - 1);
    this.villagers.splice(this.villagers.indexOf(v), 1);
    const a = this.addSoldier(kind, b.x, b.z + b.size / 2 + 0.6);
    this.emit('trained', { kind, x: a.x, z: a.z });
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

    // Knights take formation slots behind the king.
    let ki = 0;
    for (const a of this.allies) if (a.kind === 'knight') a.slot = ki++;

    for (let i = this.allies.length - 1; i >= 0; i--) {
      const a = this.allies[i];
      const u = UNITS[a.kind];
      a.flash = Math.max(0, a.flash - dt * 4);
      a.atkCd -= dt;
      a.attackT = Math.max(0, a.attackT - dt);
      a.moving = false;
      if (this.t - a.lastHurt > 4) a.hp = Math.min(a.max, a.hp + 4 * dt);

      let gx = a.x, gz = a.z;           // where it wants to be
      let target = null;

      if (a.kind === 'archer') {
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
        const anchorX = hero.alive ? hero.x : 0, anchorZ = hero.alive ? hero.z : CASTLE_R;
        const e = this.nearestEnemy(a.x, a.z, 7);
        if (e && hyp(e.x - anchorX, e.z - anchorZ) < 11) target = e;
      } else if (a.kind === 'raider') {
        gx = (a.id % 5) * 1.4 - 2.8; gz = CASTLE_R + 3.5;
        target = this.nearestEnemy(a.x, a.z, 60);
      }

      if (target) {
        const d = hyp(target.x - a.x, target.z - a.z);
        a.yaw = Math.atan2(target.x - a.x, target.z - a.z);
        if (d > u.range + target.def.radius) {
          if (a.kind !== 'archer') { gx = target.x; gz = target.z; }
        } else {
          gx = a.x; gz = a.z;
          if (a.atkCd <= 0) {
            a.atkCd = u.interval;
            a.attackT = 0.25;
            const dmg = u.dmg * (this.armor ? 1 + this.armor * 0.15 : 1);
            if (a.kind === 'archer') this.shoot(a.x, a.z, 1.3, target, { dmg, speed: 28, from: 'ally' });
            else this.damageEnemy(target, dmg, 'melee');
          }
        }
      }

      const dx = gx - a.x, dz = gz - a.z;
      const d = hyp(dx, dz);
      if (d > 0.25) {
        const sp = a.kind === 'knight' && hero.alive && !target ? Math.max(u.speed, this.heroStat('speed') * (d > 3 ? 1.15 : 0.9)) : u.speed;
        const step = Math.min(d, sp * dt);
        a.x += (dx / d) * step; a.z += (dz / d) * step;
        if (!target || a.kind !== 'archer') a.yaw = Math.atan2(dx, dz);
        a.moving = step > 0.01;
        a.anim += dt * 10;
      }
    }
    separate(this.allies, 0.45);
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
      from: o.from, pierce: o.pierce || 0, burn: o.burn || 0, splash: o.splash || 0, kind: o.kind || 'arrow',
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
          p.y = p.y0 + (1.1 - p.y0) * k + Math.sin(k * Math.PI) * Math.min(3, p.dist0 * 0.12);
        }
      }
      if (dead) this.projectiles.splice(i, 1);
    }
  }

  projectileHit(p, t, dirX, dirZ) {
    if (p.from === 'enemy') {
      if (t === this.hero) this.hurtHero(p.dmg);
      else if (t.gate) this.hurtGate(t, p.dmg);
      else if (t.castle) this.hurtCastle(p.dmg);
      else this.hurtAlly(t, p.dmg);
      return;
    }
    this.damageEnemy(t, p.dmg, p.kind);
    if (p.burn) { t.burn = 3; t.burnDps = Math.max(t.burnDps, p.dmg * p.burn); }
    if (p.splash) {
      for (const e of this.enemies) {
        if (e === t || e.hp <= 0) continue;
        if (hyp(e.x - t.x, e.z - t.z) < p.splash) {
          this.damageEnemy(e, p.dmg * 0.4, 'splash');
          if (p.burn) { e.burn = 2; e.burnDps = Math.max(e.burnDps, p.dmg * p.burn * 0.5); }
        }
      }
      this.emit('splash', { x: t.x, z: t.z, r: p.splash });
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
        if (e.target && (e.target.gone || (e.target === hero && !hero.alive) || hyp(e.target.x - e.x, e.target.z - e.z) > def.aggro * 1.7)) e.target = null;
        if (!e.target && def.aggro > 0) {
          let best = null, bd = e.guard ? Math.max(def.aggro, 8) : def.aggro;
          if (hero.alive) { const d = hyp(hero.x - e.x, hero.z - e.z); if (d < bd) { bd = d; best = hero; } }
          for (const a of this.allies) { const d = hyp(a.x - e.x, a.z - e.z); if (d < bd) { bd = d; best = a; } }
          e.target = best;
        }
        if (e.target && hyp(e.x - homeX, e.z - homeZ) > 10) e.target = null;
      }

      let mx = 0, mz = 0, want = 0;
      const t = e.target;
      if (t) {
        const d = hyp(t.x - e.x, t.z - e.z);
        e.yaw = Math.atan2(t.x - e.x, t.z - e.z);
        if (d > def.range + 0.6) { mx = (t.x - e.x) / d; mz = (t.z - e.z) / d; want = e.speed * 1.1; }
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
      if (Math.abs(e.z - RIVER_Z) < RIVER_HALF && !this.built('bridge')) want *= 0.55;
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
    for (const e of this.enemies) if (e.guard && e.hp > 0) out[e.guard.camp]++;
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
    if (!onBridge && !this.noclip && Math.abs(nz - RIVER_Z) < RIVER_HALF + 0.4) {
      nz = h.z < RIVER_Z ? Math.min(nz, RIVER_Z - RIVER_HALF - 0.4) : Math.max(nz, RIVER_Z + RIVER_HALF + 0.4);
      if (this.built('bridge') && Math.abs(nx - BRIDGE.x) < 3.2) nx += (BRIDGE.x - nx) * Math.min(1, dt * 6);
    }
    nx = Math.max(-BOUNDS, Math.min(BOUNDS, nx));
    // South, the king can ride as far as the road he has claimed. At the
    // stronghold its gate holds him out until it is broken.
    let zMax = this.frontier - 1.5;
    if (this.siegeReady) {
      const gateUp = !this.sgGate || this.sgGate.hp > 0;
      if (Math.abs(nx - STRONGHOLD.x) < STRONGHOLD.half + 1) zMax = gateUp ? STRONGHOLD.gateZ - 2.5 : STRONGHOLD.z + 4;
      else zMax = STRONGHOLD.gateZ - 3;
    }
    nz = Math.max(-BOUNDS, Math.min(zMax, nz));

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
        h.shootT = 0.2;
        const dmg = this.heroStat('damage') * wp.dmg;
        for (const t of targets) {
          this.shoot(h.x, h.z, 2.3, t, {
            dmg, speed: wp.speed, from: 'hero', pierce: wp.pierce, burn: wp.burn, splash: wp.splash,
            kind: h.weapon === 'fire' ? 'fire' : h.weapon === 'crossbow' ? 'bolt' : 'arrow',
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
        if (n > 0) { m.pileAcc -= n; m.pile -= n; h.coins += n; this.emit('pickup', { n, from: m.id }); }
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

  // Standing still by a forest tree the king chops wood; by a highland
  // boulder he mines stone. He carries the load and drops it off at the
  // castle or an outpost.
  updateGathering(dt) {
    const h = this.hero;
    h.tool = null;
    // Drop off.
    if (h.load.n > 0 && (this.atCastle() || this.list('outpost').some((o) => o.state === 'built' && hyp(o.x - h.x, o.z - h.z) < 6))) {
      this.res[h.load.res] += h.load.n;
      this.emit('deliver', { x: h.x, z: h.z, res: h.load.res, amt: h.load.n });
      h.load = { res: null, n: 0 };
      h.warned = null;
    }
    if (hyp(h.vx, h.vz) > 1.0 || this.nearestEnemy(h.x, h.z, this.heroStat('range'))) { h.gatherT = 0; return; }
    const near = (list) => list.some((t) => Math.abs(t.x - h.x) < GATHER_REACH && Math.abs(t.z - h.z) < GATHER_REACH && hyp(t.x - h.x, t.z - h.z) < GATHER_REACH);
    const res = near(CHOP_TREES) ? 'wood' : near(MINE_ROCKS) ? 'stone' : null;
    if (!res) { h.gatherT = 0; return; }
    const warn = (key, text) => { if (h.warned !== key) { h.warned = key; this.emit('need', { text }); } };
    if (h.load.n > 0 && h.load.res !== res) return warn('mix', `Drop your ${h.load.res} at the castle first`);
    if (h.load.n >= this.loadCap) return warn('full', 'Your load is full: carry it back to the castle');
    h.tool = res === 'wood' ? 'axe' : 'pick';
    h.gatherT += dt;
    if (h.gatherT >= GATHER_EVERY) {
      h.gatherT = 0;
      h.load.res = res;
      h.load.n++;
      this.emit('gather', { res, x: h.x, z: h.z, n: h.load.n, cap: this.loadCap });
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
          this.shoot(t.x, t.z, 4.2, e, { dmg: lv.dmg, speed: lv.pierce ? 40 : 30, from: 'tower', pierce: lv.pierce, kind: lv.pierce ? 'ballista' : 'bolt' });
        } else t.atkCd = 0.15;
      }
      for (let k = 0; k < t.garrison; k++) {
        t.slotCd[k] -= dt;
        if (t.slotCd[k] > 0) continue;
        const e = this.nearestEnemy(t.x, t.z, lv.range);
        if (e) {
          t.slotCd[k] = UNITS.archer.interval;
          this.shoot(t.x + (k - 1) * 0.5, t.z, 4.6, e, { dmg: UNITS.archer.dmg * (1 + this.armor * 0.15), speed: 28, from: 'ally' });
        } else t.slotCd[k] = 0.2;
      }
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
          this.reinforceT = 26;
          const lanes = this.lanesOpen;
          const kinds = ['grunt', 'grunt', 'grunt', 'archer', 'brute', 'raider', 'grunt', 'archer'];
          this.spawnQueue = kinds.map((kind, i) => ({ kind, lane: i < 4 ? 'S' : lanes[i % lanes.length].id }));
        }
      }
    }

    this.updateHero(dt, input);
    this.updateVillagers(dt);
    this.updateAllies(dt);
    this.updateTowers(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    this.updateCoins(dt);

    if (this.phase === 'wave' && !this.siege && !this.spawnQueue.length && !this.enemies.some((e) => !e.guard)) this.endWave();

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
      level: this.level,
      camps: this.built('pass') ? this.campsAlive() : null,
      stats: { ...this.stats },
      walls: { ...this.walls },
      armor: this.armor,
      hero: { x: h.x, z: h.z, coins: h.coins, up: { ...h.up }, weapons: { ...h.weapons }, weapon: h.weapon, load: { ...h.load } },
      buildings: Object.values(this.b).map((b) => ({ id: b.id, type: b.type, x: b.x, z: b.z, state: b.state, level: b.level, fixed: b.fixed, lane: b.lane, garrison: b.garrison, pile: b.pile, assigned: b.assigned })),
      villagers: this.villagers.length,
      allies: this.allies.map((a) => a.kind),
      coins: this.coins.map((c) => [Math.round(c.x * 10) / 10, Math.round(c.z * 10) / 10, c.value]),
      growT: this.growT,
    };
  }

  load(s) {
    this.phase = 'build';
    this.wave = s.wave;
    this.res = { ...s.res };
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
  }
}

// ------------------------------------------------------------------ helpers
function order(kind) { return { grunt: 0, raider: 1, archer: 2, brute: 3 }[kind] ?? 0; }

function jobPriority(b) {
  if (!b) return 9;
  return { goldmine: 0, lumber: 1, quarry: 2, farm: 3 }[b.type] ?? 5;
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
    case 'castle': return `Castle strength ${cur.hp} → ${next.hp}, unlocks new buildings`;
    case 'house': return `Beds ${cur.beds} → ${next.beds}`;
    case 'farm': return `Growth +${Math.round(cur.growth * 100)}% → +${Math.round(next.growth * 100)}%, farmer slots ${cur.workers} → ${next.workers}`;
    case 'barracks': return `Army size ${cur.army} → ${next.army}, unlocks Raiders`;
    case 'goldmine': return `Miner slots ${cur.workers} → ${next.workers}, faster digging, pile ${cur.pile} → ${next.pile}`;
    case 'lumber':
    case 'quarry': return `Worker slots ${cur.workers} → ${next.workers}, ${cur.carry} → ${next.carry} per trip`;
    case 'tower': return `Damage ${cur.dmg} → ${next.dmg}, range ${cur.range} → ${next.range}m, archer posts ${cur.slots} → ${next.slots}`;
    default: return '';
  }
}
