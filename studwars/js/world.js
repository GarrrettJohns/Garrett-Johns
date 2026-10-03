// The match itself: map, units, buildings, resources, combat and fog. It knows
// nothing about drawing; the renderer and UI read it each frame and consume
// the events it leaves behind.

import {
  MAP_N, UNITS, BUILDINGS, FACTIONS, RESOURCES, STUDS, DIFFICULTY, POP_MAX, START_BRICKS, HERO_RESPAWN, SPECIAL_CD,
} from './config.js';
import { generateMap, T_WATER } from './map.js';
import { Pathfinder } from './path.js';

const B_WATER = 1, B_RES = 2, B_BLD = 3;
const PROJ_SPEED = { arrow: 15, shot: 26, ball: 11 };

export const isMilitary = (u) => u.def.role !== 'builder';

// Ring offsets for spreading a group around a destination.
const SPREAD = [];
for (let r = 0; r <= 5; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
  if (Math.max(Math.abs(di), Math.abs(dj)) === r) SPREAD.push([di, dj]);
}
SPREAD.sort((a, b) => Math.hypot(a[0], a[1]) - Math.hypot(b[0], b[1]));

// Cells within each sight radius, for fog.
const CIRCLES = {};
function circle(r) {
  const k = Math.round(r * 2) / 2;
  if (!CIRCLES[k]) {
    const out = [];
    const R = Math.ceil(k);
    for (let dj = -R; dj <= R; dj++) for (let di = -R; di <= R; di++) if (di * di + dj * dj <= k * k) out.push(di, dj);
    CIRCLES[k] = out;
  }
  return CIRCLES[k];
}

export class World {
  constructor({ seed = (Math.random() * 1e9) | 0, difficulty = 'normal', factions = ['knights', 'pirates'] } = {}) {
    this.seed = seed;
    this.difficulty = difficulty;
    this.diff = DIFFICULTY[difficulty];
    this.map = generateMap(seed);
    const N = this.N = MAP_N;
    this.block = new Uint8Array(N * N);
    this.cellEnt = new Int32Array(N * N);
    for (let k = 0; k < N * N; k++) if (this.map.terrain[k] === T_WATER) this.block[k] = B_WATER;
    this.pf = new Pathfinder(N, this.block);
    this.nextId = 1;
    this.ents = new Map();
    this.units = [];
    this.buildings = [];
    this.resources = [];
    this.proj = [];
    this.studs = [];
    this.events = [];
    this.pathQueue = [];
    this.time = 0;
    this.over = null;
    this.vis = new Uint8Array(N * N);
    this.explored = new Uint8Array(N * N);
    this.fogT = 0;
    this.fogVersion = 0;

    this.teams = factions.map((f, t) => ({
      id: t, faction: f, F: FACTIONS[f],
      bricks: START_BRICKS + (t === 1 ? this.diff.startBonus : 0),
      studs: 0, pop: 0, popCap: 0,
      gather: t === 1 ? this.diff.gather : 1, build: t === 1 ? this.diff.build : 1,
      heroT: 0, hero: null,
      stats: { trained: 0, lost: 0, kills: 0, built: 0, bricks: 0, razed: 0 },
    }));

    for (const r of this.map.resources) this.addResource(r);
    for (const s of this.map.studs) this.addStud(s.kind, s.x, s.z, false);

    this.map.bases.forEach((b, t) => {
      const keep = this.addBuilding(t, 'keep', b.x, b.z, true);
      const team = this.teams[t];
      this.spawnHero(t);
      for (let n = 0; n < 3; n++) this.spawnUnit(t, team.F.builder, keep);
    });
    this.recount();
    this.updateFog();
  }

  // ------------------------------------------------------------- helpers
  idx(i, j) { return j * this.N + i; }
  emit(type, o = {}) { this.events.push({ type, ...o }); }
  team(t) { return this.teams[t]; }
  enemyOf(t) { return t === 0 ? 1 : 0; }
  alive(e) { return e && !e.dead; }
  get(id) { const e = this.ents.get(id); return e && !e.dead ? e : null; }

  // Distance from a point to an entity's edge.
  distPt(x, z, e) {
    if (e.kind === 'unit') return Math.hypot(e.x - x, e.z - z) - e.def.r;
    let x0, x1, z0, z1;
    if (e.kind === 'bld') { const h = e.size / 2; x0 = e.x - h; x1 = e.x + h; z0 = e.z - h; z1 = e.z + h; }
    else { x0 = e.i; x1 = e.i + 1; z0 = e.j; z1 = e.j + 1; }
    const dx = Math.max(x0 - x, 0, x - x1), dz = Math.max(z0 - z, 0, z - z1);
    return Math.hypot(dx, dz);
  }
  dist(u, e) { return this.distPt(u.x, u.z, e) - u.def.r; }

  isVisible(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 0 || j < 0 || i >= this.N || j >= this.N) return false;
    return this.vis[this.idx(i, j)] > 0;
  }
  isExplored(x, z) {
    const i = Math.floor(x), j = Math.floor(z);
    if (i < 0 || j < 0 || i >= this.N || j >= this.N) return false;
    return this.explored[this.idx(i, j)] > 0;
  }
  // What the player can see of an entity.
  seen(e) {
    if (e.team === 0) return true;
    if (e.kind === 'unit') return this.isVisible(e.x, e.z);
    if (e.kind === 'bld') return e.seen;
    return this.isExplored(e.x, e.z);
  }

  // ------------------------------------------------------------- creation
  addResource(r) {
    const def = RESOURCES[r.kind];
    const e = { kind: 'res', id: this.nextId++, type: r.kind, i: r.i, j: r.j, x: r.i + 0.5, z: r.j + 0.5, amount: def.amount, max: def.amount, v: r.v || 0, dead: false };
    this.ents.set(e.id, e);
    this.resources.push(e);
    const k = this.idx(r.i, r.j);
    this.block[k] = B_RES;
    this.cellEnt[k] = e.id;
    return e;
  }

  addStud(kind, x, z, dropped = true) {
    const s = { id: this.nextId++, kind, value: STUDS[kind], x, z, y: dropped ? 0.4 : 0, vx: 0, vy: 0, vz: 0, age: 0, dropped };
    if (dropped) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 2;
      s.vx = Math.cos(a) * sp; s.vz = Math.sin(a) * sp; s.vy = 4 + Math.random() * 2;
    }
    this.studs.push(s);
    return s;
  }

  footprint(type, x, z) {
    const size = BUILDINGS[type].size;
    const i0 = Math.round(x - size / 2), j0 = Math.round(z - size / 2);
    return { i0, j0, size, x: i0 + size / 2, z: j0 + size / 2 };
  }

  canPlace(t, type, x, z) {
    const f = this.footprint(type, x, z);
    const N = this.N;
    if (f.i0 < 2 || f.j0 < 2 || f.i0 + f.size > N - 2 || f.j0 + f.size > N - 2) return { ...f, ok: false, why: 'Too close to the edge' };
    for (let j = f.j0 - 1; j < f.j0 + f.size + 1; j++) for (let i = f.i0 - 1; i < f.i0 + f.size + 1; i++) {
      const k = this.idx(i, j);
      const inside = i >= f.i0 && j >= f.j0 && i < f.i0 + f.size && j < f.j0 + f.size;
      if (this.block[k] === B_BLD) return { ...f, ok: false, why: 'Too close to another building' };
      if (!inside) continue;
      if (this.block[k] === B_WATER) return { ...f, ok: false, why: 'Can\'t build on water' };
      if (this.block[k] === B_RES) return { ...f, ok: false, why: 'Something is in the way' };
      if (t === 0 && !this.explored[k]) return { ...f, ok: false, why: 'Explore there first' };
    }
    for (const b of this.buildings) {
      if (b.team !== t && Math.hypot(b.x - f.x, b.z - f.z) < 9) return { ...f, ok: false, why: 'Too close to the enemy' };
    }
    return { ...f, ok: true };
  }

  addBuilding(t, type, x, z, done = false) {
    const def = BUILDINGS[type];
    const f = this.footprint(type, x, z);
    const b = {
      kind: 'bld', id: this.nextId++, team: t, type, def, faction: this.teams[t].faction,
      x: f.x, z: f.z, i0: f.i0, j0: f.j0, size: f.size,
      hp: done ? def.hp : Math.max(1, def.hp * 0.1), maxHp: def.hp, built: done ? 1 : 0, done,
      queue: [], prodT: 0, rally: null, atkT: 0, dead: false, seen: t === 0, lastHit: -99,
    };
    this.ents.set(b.id, b);
    this.buildings.push(b);
    for (let j = f.j0; j < f.j0 + f.size; j++) for (let i = f.i0; i < f.i0 + f.size; i++) {
      const k = this.idx(i, j);
      this.block[k] = B_BLD;
      this.cellEnt[k] = b.id;
    }
    return b;
  }

  placeBuilding(t, type, x, z, builders = []) {
    const team = this.teams[t];
    const def = BUILDINGS[type];
    const p = this.canPlace(t, type, x, z);
    if (!p.ok) return { err: p.why };
    if (team.bricks < def.cost) return { err: `Need ${def.cost} bricks` };
    team.bricks -= def.cost;
    const b = this.addBuilding(t, type, p.x, p.z, false);
    this.emit('place', { x: b.x, z: b.z, team: t });
    if (builders.length) this.cmdBuild(builders, b);
    return { b };
  }

  spawnUnit(t, type, near, at) {
    const def = UNITS[type];
    let x, z;
    if (at) { x = at.x; z = at.z; }
    else {
      // A free cell just outside the building, on the side facing its rally point (or the map centre).
      const tx = near.rally ? near.rally.x : this.N / 2, tz = near.rally ? near.rally.z : this.N / 2;
      const h = near.size / 2 + 0.6;
      let best = null, bd = Infinity;
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const cx = near.x + Math.cos(ang) * h * 1.2, cz = near.z + Math.sin(ang) * h * 1.2;
        const c = this.pf.nearestFree(cx, cz, 3);
        if (!c) continue;
        const d = Math.hypot(c[0] + 0.5 - tx, c[1] + 0.5 - tz) + Math.random() * 1.5;
        if (d < bd) { bd = d; best = c; }
      }
      x = best ? best[0] + 0.5 : near.x; z = best ? best[1] + 0.5 : near.z + near.size;
    }
    const u = {
      kind: 'unit', id: this.nextId++, team: t, type, def, faction: def.faction,
      x, z, face: t === 0 ? Math.PI * 0.75 : -Math.PI * 0.25, hp: def.hp, maxHp: def.hp,
      order: { type: 'idle' }, path: null, pathI: 0, pathKey: '', pathPending: false, want: null,
      carry: 0, carryKind: null, lastRes: null, atkT: Math.random() * 0.5, animT: 9, workT: 0, walkPh: 0, moving: false,
      engage: 0, scanT: Math.random() * 0.4, home: { x, z }, buffT: 0, specialT: def.special ? 8 : 0, chaseT: 0,
      dead: false, lastHit: -99, stuckT: 0,
    };
    this.ents.set(u.id, u);
    this.units.push(u);
    return u;
  }

  spawnHero(t) {
    const team = this.teams[t];
    const keep = this.buildings.find((b) => b.team === t && b.type === 'keep' && !b.dead);
    if (!keep) return null;
    const h = this.spawnUnit(t, team.F.hero, keep);
    team.hero = h;
    return h;
  }

  // ------------------------------------------------------------- commands
  setOrder(u, order) {
    u.order = order;
    u.path = null; u.pathPending = false; u.pathKey = '';
    u.stuckT = 0; u.sx0 = u.x; u.sz0 = u.z;
    u.engage = 0;
    if (order.type === 'idle') u.home = { x: u.x, z: u.z };
  }

  cmdMove(units, x, z, attack = true) {
    units = units.filter((u) => !u.dead);
    if (!units.length) return;
    units.sort((a, b) => Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z));
    const c = this.pf.nearestFree(x, z) || [Math.floor(x), Math.floor(z)];
    let k = 0;
    for (const u of units) {
      let dx = c[0] + 0.5, dz = c[1] + 0.5;
      while (k < SPREAD.length) {
        const [di, dj] = SPREAD[k++];
        if (this.pf.walkable(c[0] + di, c[1] + dj)) { dx = c[0] + di + 0.5; dz = c[1] + dj + 0.5; break; }
      }
      if (u.def.r > 0.45) k++;
      this.setOrder(u, { type: attack && isMilitary(u) ? 'amove' : 'move', x: dx, z: dz });
    }
    this.emit('order', { x, z, team: units[0].team, kind: attack ? 'move' : 'move' });
  }

  cmdAttack(units, target) {
    for (const u of units) if (!u.dead) {
      if (u.def.role === 'builder' && target.kind === 'bld') { this.setOrder(u, { type: 'attack', target: target.id }); continue; }
      this.setOrder(u, { type: 'attack', target: target.id });
    }
    this.emit('order', { x: target.x, z: target.z, team: units[0] && units[0].team, kind: 'attack' });
  }

  cmdGather(units, res) {
    for (const u of units) if (!u.dead && u.def.role === 'builder') {
      this.setOrder(u, { type: 'gather', res: res.id, phase: u.carry > 0 ? 'return' : 'go' });
      u.lastRes = res.id;
    }
    this.emit('order', { x: res.x, z: res.z, team: units[0] && units[0].team, kind: 'gather' });
  }

  cmdBuild(units, b) {
    for (const u of units) if (!u.dead && u.def.role === 'builder') this.setOrder(u, { type: 'build', bld: b.id });
    this.emit('order', { x: b.x, z: b.z, team: units[0] && units[0].team, kind: 'build' });
  }

  train(b, type) {
    const team = this.teams[b.team];
    const def = UNITS[type];
    if (!b.done) return 'Still being built';
    if (b.queue.length >= 5) return 'Queue is full';
    if (team.bricks < def.cost) return `Need ${def.cost} bricks`;
    if (team.pop + def.pop > team.popCap) return team.popCap >= POP_MAX ? 'Army is at the limit' : 'Build more farms';
    team.bricks -= def.cost;
    b.queue.push(type);
    this.recount();
    return null;
  }

  cancelTrain(b, i) {
    const type = b.queue[i];
    if (!type) return;
    b.queue.splice(i, 1);
    if (i === 0) b.prodT = 0;
    this.teams[b.team].bricks += UNITS[type].cost;
    this.recount();
  }

  useSpecial(h) {
    if (!h || h.dead || h.specialT > 0) return false;
    const enemy = this.enemyOf(h.team);
    if (h.def.special === 'rally') {
      for (const u of this.units) {
        if (u.team !== h.team || u.dead || Math.hypot(u.x - h.x, u.z - h.z) > 7) continue;
        u.hp = Math.min(u.maxHp, u.hp + u.maxHp * 0.35);
        u.buffT = 10;
      }
      this.emit('rally', { x: h.x, z: h.z, team: h.team });
    } else if (h.def.special === 'broadside') {
      // Aim at the thickest knot of enemies near the captain.
      let best = null, bs = 0;
      const cands = [...this.units, ...this.buildings].filter((e) => e.team === enemy && !e.dead && Math.hypot(e.x - h.x, e.z - h.z) < 11);
      for (const c of cands) {
        let s = 0;
        for (const o of cands) if (Math.hypot(o.x - c.x, o.z - c.z) < 3) s += o.kind === 'bld' ? 2 : 1;
        if (s > bs) { bs = s; best = c; }
      }
      if (!best) return false;
      for (let n = 0; n < 7; n++) {
        const tx = best.x + (Math.random() - 0.5) * 4, tz = best.z + (Math.random() - 0.5) * 4;
        this.proj.push({
          kind: 'ball', team: h.team, sx: tx - 6, sy: 12, sz: tz + 4, x: tx - 6, y: 12, z: tz + 4, tx, ty: 0, tz,
          t: -n * 0.22, dur: 1.1, dmg: 45, splash: 1.8, vsB: 2, target: 0, arc: 0, src: h.id,
        });
      }
      this.emit('broadside', { x: best.x, z: best.z, team: h.team });
    }
    h.specialT = SPECIAL_CD;
    return true;
  }

  // ------------------------------------------------------------- update
  update(dt) {
    if (this.over) return;
    this.time += dt;
    this.processPaths(10);
    for (const u of this.units) if (!u.dead) this.updateUnit(u, dt);
    this.separate(dt);
    for (const b of this.buildings) if (!b.dead) this.updateBuilding(b, dt);
    this.updateProjectiles(dt);
    this.updateStuds(dt);
    for (const team of this.teams) {
      if (team.hero && team.hero.dead) {
        team.heroT -= dt;
        if (team.heroT <= 0) {
          const h = this.spawnHero(team.id);
          if (h) this.emit('heroBack', { team: team.id, x: h.x, z: h.z });
        }
      }
    }
    if (this.units.some((u) => u.dead)) this.units = this.units.filter((u) => !u.dead);
    if (this.buildings.some((b) => b.dead)) this.buildings = this.buildings.filter((b) => !b.dead);
    if (this.resources.some((r) => r.dead)) this.resources = this.resources.filter((r) => !r.dead);
    this.fogT -= dt;
    if (this.fogT <= 0) { this.fogT = 0.2; this.updateFog(); this.recount(); }
    this.checkOver();
  }

  recount() {
    for (const team of this.teams) {
      let pop = 0, cap = 0;
      for (const u of this.units) if (u.team === team.id && !u.dead) pop += u.def.pop;
      for (const b of this.buildings) if (b.team === team.id && !b.dead) {
        for (const q of b.queue) pop += UNITS[q].pop;
        if (b.done) cap += b.def.pop || 0;
      }
      team.pop = pop;
      team.popCap = Math.min(POP_MAX, cap);
    }
  }

  checkOver() {
    for (const t of [0, 1]) {
      const keep = this.buildings.some((b) => b.team === t && b.type === 'keep' && !b.dead);
      if (!keep) {
        this.over = t === 0 ? 'defeat' : 'victory';
        this.emit('over', { result: this.over });
        return;
      }
    }
  }

  // ------------------------------------------------------------- paths
  requestPath(u, spec, key) {
    if (u.pathKey === key && (u.path || u.pathPending)) return;
    u.pathKey = key;
    u.path = null;
    u.want = spec;
    if (!u.pathPending) { u.pathPending = true; this.pathQueue.push(u); }
  }

  processPaths(budget) {
    while (budget > 0 && this.pathQueue.length) {
      const u = this.pathQueue.shift();
      if (u.dead || !u.pathPending) continue;
      budget--;
      const s = u.want;
      let goal, hx, hz;
      if (s.ent) {
        const e = s.ent, reach = s.reach;
        if (e.dead) { u.pathPending = false; u.path = []; continue; }
        goal = (i, j) => this.distPt(i + 0.5, j + 0.5, e) <= reach;
        hx = e.x; hz = e.z;
      } else {
        const c = this.pf.nearestFree(s.x, s.z) || [Math.floor(s.x), Math.floor(s.z)];
        goal = (i, j) => i === c[0] && j === c[1];
        hx = c[0] + 0.5; hz = c[1] + 0.5;
      }
      const r = this.pf.find(u.x, u.z, goal, hx, hz);
      u.pathPending = false;
      u.path = r ? r.points : [];
      if (r && !s.ent && r.reached && u.path.length) u.path[u.path.length - 1] = [s.x, s.z];
      u.pathI = 0;
    }
  }

  // Move along the current path. Returns true once at the end.
  walk(u, dt) {
    if (u.pathPending) return false;
    if (!u.path) return true;
    if (u.pathI >= u.path.length) return true;
    const [px, pz] = u.path[u.pathI];
    const dx = px - u.x, dz = pz - u.z;
    const d = Math.hypot(dx, dz);
    const step = this.speed(u) * dt;
    const lastLeg = u.pathI === u.path.length - 1;
    // Crowds jostle: if we've barely moved for a second, call it arrived when
    // close, or look for a new way round.
    u.stuckT += dt;
    if (u.stuckT > 1) {
      const moved = Math.hypot(u.x - (u.sx0 ?? u.x), u.z - (u.sz0 ?? u.z));
      u.sx0 = u.x; u.sz0 = u.z; u.stuckT = 0;
      if (moved < 0.25 * this.speed(u)) {
        if (lastLeg && d < 3) { u.pathI = u.path.length; return true; }
        u.path = null; u.pathKey = '';
        return false;
      }
    }
    if (d <= Math.max(step, lastLeg ? 0.25 : 0.08)) {
      this.moveBy(u, dx, dz);
      u.pathI++;
      if (u.pathI >= u.path.length) return true;
    } else {
      this.moveBy(u, (dx / d) * step, (dz / d) * step);
      this.faceTo(u, dx, dz, dt);
    }
    u.moving = true;
    u.walkPh += step * 3.2;
    return false;
  }

  speed(u) { return u.def.speed * (u.buffT > 0 ? 1.25 : 1); }

  faceTo(u, dx, dz, dt) {
    const want = Math.atan2(dx, dz);
    let d = want - u.face;
    while (d > Math.PI) d -= Math.PI * 2;
    while (d < -Math.PI) d += Math.PI * 2;
    u.face += d * Math.min(1, dt * 12);
  }

  moveBy(u, dx, dz) {
    const nx = u.x + dx, nz = u.z + dz;
    if (this.pf.walkable(Math.floor(nx), Math.floor(u.z))) u.x = nx;
    if (this.pf.walkable(Math.floor(u.x), Math.floor(nz))) u.z = nz;
  }

  // Head straight for an entity when the way is clear, else path to it.
  approach(u, e, reach, dt, key) {
    const straight = Math.hypot(e.x - u.x, e.z - u.z) < 10 && this.pf.clear(u.x, u.z, e.x, e.z) && e.kind === 'unit';
    if (straight) {
      u.path = null; u.pathPending = false; u.pathKey = '';
      const dx = e.x - u.x, dz = e.z - u.z, d = Math.hypot(dx, dz) || 1;
      const step = this.speed(u) * dt;
      this.moveBy(u, (dx / d) * step, (dz / d) * step);
      this.faceTo(u, dx, dz, dt);
      u.moving = true;
      u.walkPh += step * 3.2;
      return;
    }
    u.chaseT -= dt;
    if (u.pathKey !== key || (u.chaseT <= 0 && e.kind === 'unit') || (u.path && u.pathI >= u.path.length)) {
      u.chaseT = 1.0;
      u.pathKey = '';
      this.requestPath(u, { ent: e, reach }, key);
    }
    if (!u.pathPending && u.path && u.pathI < u.path.length) this.walk(u, dt);
    else if (u.pathPending) {
      // Drift toward the goal while the path is being worked out.
      this.faceTo(u, e.x - u.x, e.z - u.z, dt);
    }
  }

  // ------------------------------------------------------------- units
  updateUnit(u, dt) {
    u.atkT -= dt;
    u.animT += dt;
    if (u.buffT > 0) u.buffT -= dt;
    if (u.specialT > 0) u.specialT -= dt;
    u.moving = false;
    u.working = false;

    // Pushed into a wall or a new building: slide out to the nearest open cell.
    if (!this.pf.walkable(Math.floor(u.x), Math.floor(u.z))) {
      const c = this.pf.nearestFree(u.x, u.z, 6);
      if (c) {
        const dx = c[0] + 0.5 - u.x, dz = c[1] + 0.5 - u.z, d = Math.hypot(dx, dz) || 1;
        const s = Math.min(d, 4 * dt);
        u.x += (dx / d) * s; u.z += (dz / d) * s;
      }
      return;
    }

    const o = u.order;
    switch (o.type) {
      case 'idle': this.idle(u, dt); break;
      case 'move':
        if (!u.path && !u.pathPending) this.requestPath(u, { x: o.x, z: o.z }, `m${o.x},${o.z}`);
        if (this.walk(u, dt)) this.setOrder(u, { type: 'idle' });
        break;
      case 'amove': this.attackMove(u, dt); break;
      case 'attack': {
        const t = this.get(o.target);
        if (!t || (t.team === 0 && u.team === 1 && false)) { this.setOrder(u, { type: 'idle' }); break; }
        this.fight(u, t, dt);
        break;
      }
      case 'gather': this.gather(u, dt); break;
      case 'build': this.construct(u, dt); break;
    }
  }

  // Nearest enemy within r: units first, then buildings (for soldiers).
  findEnemy(u, r) {
    const en = this.enemyOf(u.team);
    let best = null, bd = r;
    for (const e of this.units) {
      if (e.team !== en || e.dead) continue;
      const d = this.dist(u, e);
      if (d < bd) { bd = d; best = e; }
    }
    if (best || u.def.role === 'builder') return best;
    for (const b of this.buildings) {
      if (b.team !== en || b.dead) continue;
      const d = this.dist(u, b);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  idle(u, dt) {
    if (u.def.role === 'builder') {
      // Builders only defend themselves when struck.
      if (u.engage) {
        const t = this.get(u.engage);
        if (t && this.dist(u, t) < 2.5) { this.fight(u, t, dt); return; }
        u.engage = 0;
      }
      return;
    }
    u.scanT -= dt;
    if (u.scanT <= 0) {
      u.scanT = 0.4;
      const cur = this.get(u.engage);
      if (!cur || cur.kind !== 'unit') {
        const e = this.findEnemy(u, u.def.sight);
        if (e && (!cur || e.kind === 'unit')) u.engage = e.id;
      }
    }
    const t = this.get(u.engage);
    if (t) {
      const leash = Math.hypot(u.x - u.home.x, u.z - u.home.z);
      if (leash > u.def.sight + 5 && this.dist(u, t) > u.def.range + 0.5) {
        u.engage = 0;
      } else {
        this.fight(u, t, dt);
        return;
      }
    }
    u.engage = 0;
    // Wander back to where we were told to stand.
    const dh = Math.hypot(u.x - u.home.x, u.z - u.home.z);
    if (dh > 1.2) {
      this.requestPath(u, { x: u.home.x, z: u.home.z }, `h${u.home.x},${u.home.z}`);
      this.walk(u, dt);
    } else if (u.pathKey && u.pathKey[0] === 'h') {
      u.path = null; u.pathKey = '';
    }
  }

  attackMove(u, dt) {
    const o = u.order;
    u.scanT -= dt;
    if (u.scanT <= 0) {
      u.scanT = 0.4;
      const cur = this.get(u.engage);
      if (!cur || cur.kind !== 'unit') {
        const e = this.findEnemy(u, u.def.sight);
        if (e && (!cur || e.kind === 'unit')) u.engage = e.id;
      }
    }
    const t = this.get(u.engage);
    if (t) { this.fight(u, t, dt); return; }
    if (u.engage) { u.engage = 0; u.pathKey = ''; u.path = null; }
    if (!u.path && !u.pathPending) this.requestPath(u, { x: o.x, z: o.z }, `a${o.x},${o.z}`);
    if (this.walk(u, dt)) this.setOrder(u, { type: 'idle' });
  }

  fight(u, t, dt) {
    const range = u.def.range;
    const d = this.dist(u, t);
    if (d <= range) {
      u.path = null; u.pathPending = false; u.pathKey = '';
      this.faceTo(u, t.x - u.x, t.z - u.z, dt * 2);
      if (u.atkT <= 0) {
        u.atkT = u.def.cd;
        u.animT = 0;
        this.strike(u, t);
      }
      return;
    }
    this.approach(u, t, range + u.def.r - 0.05, dt, `f${t.id}`);
  }

  strike(u, t) {
    const dmg = u.def.dmg * (u.buffT > 0 ? 1.5 : 1);
    if (u.def.proj) {
      this.shoot(u.def.proj, u.team, u.x, 0.85, u.z, t, dmg, u.def.splash || 0, u.def.vsBuilding || 1, u.id);
    } else {
      this.damage(t, dmg, u);
      this.emit('hit', { x: t.x, z: t.z, team: t.team, melee: true, src: u.type });
    }
  }

  shoot(kind, team, x, y, z, t, dmg, splash, vsB, src) {
    const d = Math.hypot(t.x - x, t.z - z);
    this.proj.push({
      kind, team, sx: x, sy: y, sz: z, x, y, z, tx: t.x, ty: 0.7, tz: t.z, t: 0, dur: Math.max(0.12, d / PROJ_SPEED[kind]),
      dmg, splash, vsB, target: t.id, arc: kind === 'arrow' ? d * 0.12 : kind === 'ball' ? d * 0.22 : 0, src,
    });
    this.emit('shoot', { kind, x, z, team });
  }

  damage(t, dmg, src, vsB = 1) {
    if (t.dead) return;
    if (t.kind === 'bld') dmg *= vsB;
    t.hp -= dmg;
    t.lastHit = this.time;
    if (t.team === 0) this.emit('attacked', { x: t.x, z: t.z, kind: t.kind });
    // Fight back.
    if (src && src.kind === 'unit' && !src.dead && t.kind === 'unit') {
      const o = t.order.type;
      if ((o === 'idle' || (o === 'gather' && t.def.role !== 'builder')) && !this.get(t.engage)) t.engage = src.id;
      if (t.def.role === 'builder' && o === 'idle') t.engage = src.id;
    }
    if (t.hp <= 0) {
      if (t.kind === 'unit') this.killUnit(t, src);
      else if (t.kind === 'bld') this.destroyBuilding(t, src);
    }
  }

  killUnit(u, src) {
    u.dead = true;
    u.hp = 0;
    this.ents.delete(u.id);
    const team = this.teams[u.team];
    team.stats.lost++;
    if (src && src.team !== undefined && src.team !== u.team) this.teams[src.team].stats.kills++;
    this.emit('die', { x: u.x, z: u.z, team: u.team, type: u.type, hero: u.def.role === 'hero' });
    if (u.team === 1) {
      const n = u.def.role === 'hero' ? 6 : 2;
      for (let i = 0; i < n; i++) this.addStud(u.def.role === 'hero' && i === 0 ? 'gold' : 'silver', u.x, u.z);
    }
    if (u.def.role === 'hero') {
      team.heroT = HERO_RESPAWN;
      this.emit('heroDown', { team: u.team, x: u.x, z: u.z });
    }
  }

  destroyBuilding(b, src) {
    b.dead = true;
    b.hp = 0;
    this.ents.delete(b.id);
    for (let j = b.j0; j < b.j0 + b.size; j++) for (let i = b.i0; i < b.i0 + b.size; i++) {
      const k = this.idx(i, j);
      this.block[k] = 0;
      this.cellEnt[k] = 0;
    }
    if (src && src.team !== undefined && src.team !== b.team) this.teams[src.team].stats.razed++;
    this.emit('collapse', { x: b.x, z: b.z, team: b.team, size: b.size, type: b.type });
    if (b.team === 1) {
      for (let i = 0; i < 3 + b.size * 2; i++) this.addStud(i < b.size - 1 ? 'gold' : 'silver', b.x, b.z);
    }
    // Refund what was waiting in the queue.
    for (const q of b.queue) this.teams[b.team].bricks += UNITS[q].cost;
    b.queue = [];
    this.recount();
  }

  // ------------------------------------------------------------- builders
  nearestDrop(u) {
    let best = null, bd = Infinity;
    for (const b of this.buildings) {
      if (b.team !== u.team || b.dead || !b.done || !b.def.deposit) continue;
      const d = this.dist(u, b);
      if (d < bd) { bd = d; best = b; }
    }
    return best;
  }

  nearestRes(x, z, r, kind) {
    let best = null, bd = r;
    for (const e of this.resources) {
      if (e.dead || (kind && e.type !== kind)) continue;
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }

  gather(u, dt) {
    const o = u.order;
    const team = this.teams[u.team];
    if (u.engage) {
      const t = this.get(u.engage);
      if (t && this.dist(u, t) < 2) { this.fight(u, t, dt); return; }
      u.engage = 0;
    }
    if (o.phase === 'go') {
      let r = this.get(o.res);
      if (!r) {
        r = this.nearestRes(o.lx || u.x, o.lz || u.z, 12, o.kind);
        if (!r) { this.setOrder(u, { type: 'idle' }); return; }
        o.res = r.id;
        u.lastRes = r.id;
      }
      o.kind = r.type; o.lx = r.x; o.lz = r.z;
      if (this.dist(u, r) <= 0.55) {
        o.phase = 'work';
        u.workT = RESOURCES[r.type].time;
        u.path = null; u.pathKey = '';
      } else this.approach(u, r, 0.55 + u.def.r - 0.05, dt, `r${r.id}`);
    } else if (o.phase === 'work') {
      const r = this.get(o.res);
      if (!r) { o.phase = 'go'; return; }
      this.faceTo(u, r.x - u.x, r.z - u.z, dt);
      u.working = true;
      u.workT -= dt;
      if (Math.floor((u.workT + dt) / 0.6) !== Math.floor(u.workT / 0.6)) this.emit('chop', { x: r.x, z: r.z, kind: r.type, team: u.team });
      if (u.workT <= 0) {
        const def = RESOURCES[r.type];
        const amt = Math.min(def.trip, r.amount);
        r.amount -= amt;
        u.carry = amt;
        u.carryKind = r.type;
        if (r.amount <= 0) this.removeRes(r);
        o.phase = 'return';
      }
    } else {
      const d = this.nearestDrop(u);
      if (!d) { u.working = false; return; }
      if (this.dist(u, d) <= 0.55) {
        const amt = Math.round(u.carry * team.gather);
        team.bricks += amt;
        team.stats.bricks += amt;
        this.emit('deposit', { x: u.x, z: u.z, team: u.team, amt });
        u.carry = 0;
        o.phase = 'go';
        u.path = null; u.pathKey = '';
      } else this.approach(u, d, 0.55 + u.def.r - 0.05, dt, `d${d.id}`);
    }
  }

  removeRes(r) {
    r.dead = true;
    this.ents.delete(r.id);
    const k = this.idx(r.i, r.j);
    this.block[k] = 0;
    this.cellEnt[k] = 0;
    this.emit('resGone', { x: r.x, z: r.z, kind: r.type, id: r.id });
  }

  construct(u, dt) {
    const b = this.get(u.order.bld);
    if (!b || b.team !== u.team || (b.done && b.hp >= b.maxHp)) { this.afterBuild(u); return; }
    if (this.dist(u, b) <= 0.55) {
      u.path = null; u.pathKey = '';
      this.faceTo(u, b.x - u.x, b.z - u.z, dt);
      u.working = true;
      const team = this.teams[u.team];
      u.workT -= dt;
      if (u.workT <= 0) { u.workT = 0.55; this.emit('hammer', { x: b.x, z: b.z, team: u.team, bid: b.id }); }
      if (!b.done) {
        const rate = (dt * team.build) / b.def.time;
        b.built = Math.min(1, b.built + rate);
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * rate * 0.9);
        if (b.built >= 1) {
          b.done = true;
          team.stats.built++;
          this.emit('built', { x: b.x, z: b.z, team: b.team, type: b.type, id: b.id });
          this.recount();
        }
      } else {
        b.hp = Math.min(b.maxHp, b.hp + b.maxHp * 0.04 * dt);
      }
    } else this.approach(u, b, 0.55 + u.def.r - 0.05, dt, `b${b.id}`);
  }

  afterBuild(u) {
    let best = null, bd = 14;
    for (const b of this.buildings) {
      if (b.team !== u.team || b.dead || (b.done && b.hp >= b.maxHp)) continue;
      const d = this.dist(u, b);
      if (d < bd) { bd = d; best = b; }
    }
    if (best) { this.setOrder(u, { type: 'build', bld: best.id }); return; }
    const r = this.get(u.lastRes) || this.nearestRes(u.x, u.z, 12);
    if (r) { this.setOrder(u, { type: 'gather', res: r.id, phase: u.carry ? 'return' : 'go' }); u.lastRes = r.id; return; }
    this.setOrder(u, { type: 'idle' });
  }

  // ------------------------------------------------------------- crowding
  separate(dt) {
    const cells = new Map();
    const key = (i, j) => i * 1000 + j;
    for (const u of this.units) {
      if (u.dead) continue;
      const k = key(Math.floor(u.x / 2), Math.floor(u.z / 2));
      let l = cells.get(k);
      if (!l) cells.set(k, (l = []));
      l.push(u);
    }
    for (const u of this.units) {
      if (u.dead) continue;
      const ci = Math.floor(u.x / 2), cj = Math.floor(u.z / 2);
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const l = cells.get(key(ci + di, cj + dj));
        if (!l) continue;
        for (const v of l) {
          if (v.id <= u.id) continue;
          const rr = (u.def.r + v.def.r) * 0.9;
          let dx = v.x - u.x, dz = v.z - u.z;
          const d2 = dx * dx + dz * dz;
          if (d2 >= rr * rr) continue;
          let d = Math.sqrt(d2);
          if (d < 0.001) { dx = Math.random() - 0.5; dz = Math.random() - 0.5; d = Math.hypot(dx, dz); }
          const push = Math.min(rr - d, 0.6 * dt * 10) * 0.5;
          // Busy or moving units shove idle ones aside.
          const uw = u.moving && !v.moving ? 0.2 : !u.moving && v.moving ? 0.8 : 0.5;
          const uFix = u.working ? 0.1 : 1, vFix = v.working ? 0.1 : 1;
          this.moveBy(u, (-dx / d) * push * 2 * uw * uFix, (-dz / d) * push * 2 * uw * uFix);
          this.moveBy(v, (dx / d) * push * 2 * (1 - uw) * vFix, (dz / d) * push * 2 * (1 - uw) * vFix);
        }
      }
    }
  }

  // ------------------------------------------------------------- buildings
  updateBuilding(b, dt) {
    if (!b.done) return;
    const team = this.teams[b.team];
    if (b.queue.length) {
      b.prodT += dt * team.build;
      const type = b.queue[0];
      if (b.prodT >= UNITS[type].time) {
        b.queue.shift();
        b.prodT = 0;
        const u = this.spawnUnit(b.team, type, b);
        team.stats.trained++;
        const n = this.events.length;
        if (b.rally) {
          const r = b.rally.res && this.get(b.rally.res);
          if (r && u.def.role === 'builder') this.cmdGather([u], r);
          else {
            const a = Math.random() * Math.PI * 2, r = Math.random() * 1.8;
            const c = this.pf.nearestFree(b.rally.x + Math.cos(a) * r, b.rally.z + Math.sin(a) * r) || [Math.floor(b.rally.x), Math.floor(b.rally.z)];
            this.setOrder(u, { type: isMilitary(u) ? 'amove' : 'move', x: c[0] + 0.5, z: c[1] + 0.5 });
          }
        } else if (u.def.role === 'builder') {
          const r = this.nearestRes(u.x, u.z, 14);
          if (r) this.cmdGather([u], r);
        }
        this.events.length = n;
        this.emit('trained', { x: u.x, z: u.z, team: b.team, type });
      }
    }
    const atk = b.def.attack;
    if (atk) {
      b.atkT -= dt;
      if (b.atkT <= 0) {
        const en = this.enemyOf(b.team);
        let best = null, bd = atk.range;
        for (const u of this.units) {
          if (u.team !== en || u.dead) continue;
          const d = this.distPt(u.x, u.z, b) - u.def.r;
          if (d < bd) { bd = d; best = u; }
        }
        if (best) {
          b.atkT = atk.cd;
          const kind = b.faction === 'pirates' && b.type === 'tower' ? 'ball' : atk.proj;
          this.shoot(kind, b.team, b.x, b.type === 'tower' ? 3.6 : 2.8, b.z, best, atk.dmg, kind === 'ball' ? 1.0 : 0, 1, 0);
        } else b.atkT = 0.3;
      }
    }
  }

  // ------------------------------------------------------------- projectiles
  updateProjectiles(dt) {
    for (const p of this.proj) {
      p.t += dt;
      if (p.t < 0) continue;
      const t = p.target ? this.get(p.target) : null;
      if (t && p.kind !== 'ball') { p.tx = t.x; p.tz = t.z; }
      const k = Math.min(1, p.t / p.dur);
      p.px = p.x; p.py = p.y; p.pz = p.z;
      p.x = p.sx + (p.tx - p.sx) * k;
      p.z = p.sz + (p.tz - p.sz) * k;
      p.y = p.sy + (p.ty - p.sy) * k + Math.sin(k * Math.PI) * p.arc;
      if (k >= 1) {
        p.done = true;
        const src = this.get(p.src) || { team: p.team, kind: 'none' };
        if (p.splash) {
          const en = this.enemyOf(p.team);
          for (const e of [...this.units, ...this.buildings]) {
            if (e.team !== en || e.dead) continue;
            if (this.distPt(p.tx, p.tz, e) <= p.splash) this.damage(e, p.dmg, src, p.vsB);
          }
          this.emit('boom', { x: p.tx, z: p.tz, big: p.dmg > 30 });
        } else if (t) {
          this.damage(t, p.dmg, src, p.vsB);
          this.emit('hit', { x: t.x, z: t.z, team: t.team, kind: p.kind });
        }
      }
    }
    if (this.proj.some((p) => p.done)) this.proj = this.proj.filter((p) => !p.done);
  }

  // ------------------------------------------------------------- studs
  updateStuds(dt) {
    for (const s of this.studs) {
      s.age += dt;
      if (s.vy || s.y > 0) {
        s.vy -= 18 * dt;
        s.x += s.vx * dt; s.z += s.vz * dt; s.y += s.vy * dt;
        if (s.y <= 0) { s.y = 0; s.vy = Math.abs(s.vy) > 3 ? -s.vy * 0.35 : 0; s.vx *= 0.5; s.vz *= 0.5; if (!s.vy) { s.vx = s.vz = 0; } }
      }
      if (s.age < 0.5) continue;
      for (const u of this.units) {
        if (u.team !== 0 || u.dead) continue;
        if (Math.abs(u.x - s.x) < 0.7 && Math.abs(u.z - s.z) < 0.7) {
          s.taken = true;
          this.teams[0].studs += s.value;
          this.emit('stud', { x: s.x, z: s.z, kind: s.kind, value: s.value });
          break;
        }
      }
      if (s.dropped && s.age > 45) s.taken = true;
    }
    if (this.studs.some((s) => s.taken)) this.studs = this.studs.filter((s) => !s.taken);
  }

  // ------------------------------------------------------------- fog
  updateFog() {
    const N = this.N;
    this.vis.fill(0);
    const stamp = (x, z, r) => {
      const ci = Math.floor(x), cj = Math.floor(z);
      const c = circle(r);
      for (let n = 0; n < c.length; n += 2) {
        const i = ci + c[n], j = cj + c[n + 1];
        if (i < 0 || j < 0 || i >= N || j >= N) continue;
        const k = j * N + i;
        this.vis[k] = 1;
        this.explored[k] = 1;
      }
    };
    for (const u of this.units) if (u.team === 0 && !u.dead) stamp(u.x, u.z, u.def.sight);
    for (const b of this.buildings) if (b.team === 0 && !b.dead) stamp(b.x, b.z, b.def.sight + b.size / 2);
    for (const b of this.buildings) {
      if (b.team === 0 || b.seen) continue;
      for (let j = b.j0; j < b.j0 + b.size && !b.seen; j++) for (let i = b.i0; i < b.i0 + b.size; i++) {
        if (this.vis[j * N + i]) { b.seen = true; break; }
      }
    }
    this.fogVersion++;
  }
}
