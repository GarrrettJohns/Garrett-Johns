// The computer side. It runs the same commands the player does: keep the
// builders busy, follow a build order, train an army and send it in waves.

import { BUILDINGS, UNITS } from './config.js';
import { isMilitary } from './world.js';

const PLAN = ['farm', 'barracks', 'depot', 'farm', 'tower', 'farm', 'barracks', 'farm', 'tower', 'farm', 'farm', 'tower', 'farm'];

export class AI {
  constructor(world, team) {
    this.w = world;
    this.t = team;
    this.thinkT = 1;
    this.step = 0;
    this.wave = world.diff.wave;
    this.nextAttack = world.diff.firstAttack;
    this.attacking = false;
    this.attackTarget = null;
  }

  update(dt) {
    this.thinkT -= dt;
    if (this.thinkT > 0) return;
    this.thinkT = 0.6;
    const w = this.w, t = this.t;
    const team = w.teams[t];
    const mine = w.units.filter((u) => u.team === t && !u.dead);
    const blds = w.buildings.filter((b) => b.team === t && !b.dead);
    const keep = blds.find((b) => b.type === 'keep');
    if (!keep) return;
    const builders = mine.filter((u) => u.def.role === 'builder');
    const army = mine.filter((u) => isMilitary(u) && u.def.role !== 'hero');
    const hero = team.hero && !team.hero.dead ? team.hero : null;

    // Builders: finish what's started, then gather.
    const unfinished = blds.filter((b) => !b.done || b.hp < b.maxHp * 0.7);
    for (const b of unfinished) {
      const on = builders.filter((u) => u.order.type === 'build' && u.order.bld === b.id);
      const want = b.done ? 1 : 2;
      if (on.length < want) {
        const free = builders.filter((u) => u.order.type !== 'build').sort((a, c) => w.dist(a, b) - w.dist(c, b));
        if (free.length) w.cmdBuild(free.slice(0, want - on.length), b);
      }
    }
    for (const u of builders) {
      if (u.order.type !== 'idle') continue;
      const r = w.nearestRes(u.x, u.z, 20, Math.random() < 0.5 ? 'ore' : null) || w.nearestRes(u.x, u.z, 40);
      if (r) w.cmdGather([u], r);
    }

    // Build order.
    const building = blds.some((b) => !b.done);
    if (!building && this.step < PLAN.length + 20) {
      const type = this.step < PLAN.length ? PLAN[this.step] : (this.step % 2 ? 'farm' : 'tower');
      const need = team.popCap >= 40 && type === 'farm';
      if (need) this.step++;
      else if (team.bricks >= BUILDINGS[type].cost + (army.length < 3 && this.step > 2 ? 60 : 0)) {
        const spot = this.findSpot(type, keep);
        if (spot) {
          const helpers = builders.filter((u) => u.order.type !== 'build').sort((a, b) => Math.hypot(a.x - spot.x, a.z - spot.z) - Math.hypot(b.x - spot.x, b.z - spot.z)).slice(0, 2);
          const res = w.placeBuilding(t, type, spot.x, spot.z, helpers);
          if (res.b) this.step++;
        } else this.step++;
      }
    }

    // Training.
    if (builders.length < w.diff.builders && !keep.queue.length) w.train(keep, team.F.builder);
    const reserve = building ? 0 : 40;
    for (const b of blds) {
      if (b.type !== 'barracks' || !b.done || b.queue.length >= 2) continue;
      const roll = Math.random();
      const [melee, ranged, heavy] = team.F.army;
      let type = roll < 0.45 ? melee : roll < 0.8 ? ranged : heavy;
      if (team.bricks < UNITS[type].cost + reserve) type = melee;
      if (team.bricks >= UNITS[type].cost + reserve) {
        if (!b.rally) b.rally = { x: keep.x + (w.N / 2 - keep.x) * 0.25, z: keep.z + (w.N / 2 - keep.z) * 0.25 };
        w.train(b, type);
      }
    }

    // Defend: any enemy near our buildings pulls the whole army back.
    const en = w.enemyOf(t);
    let threat = null;
    for (const u of w.units) {
      if (u.team !== en || u.dead) continue;
      for (const b of blds) if (Math.hypot(u.x - b.x, u.z - b.z) < 11) { threat = u; break; }
      if (threat) break;
    }
    if (threat && !this.attacking) {
      const defenders = [...army, ...(hero ? [hero] : [])].filter((u) => u.order.type === 'idle' || (u.order.type === 'amove' && Math.hypot(u.order.x - threat.x, u.order.z - threat.z) > 6));
      if (defenders.length) w.cmdMove(defenders, threat.x, threat.z, true);
    }

    // Attack in waves.
    if (!this.attacking && w.time >= this.nextAttack && army.length >= this.wave) {
      this.attacking = true;
      this.attackTarget = null;
    }
    if (this.attacking) {
      const force = [...army, ...(hero ? [hero] : [])];
      if (army.length < Math.max(2, this.wave * 0.3)) {
        // The wave is spent: regroup and grow the next one.
        this.attacking = false;
        this.wave += w.diff.growth;
        this.nextAttack = w.time + w.diff.waveGap;
        const home = { x: keep.x + (w.N / 2 - keep.x) * 0.25, z: keep.z + (w.N / 2 - keep.z) * 0.25 };
        w.cmdMove(force, home.x, home.z, true);
      } else {
        let target = this.attackTarget && w.get(this.attackTarget);
        if (!target) {
          // Head for the nearest enemy building, keep last.
          const theirs = w.buildings.filter((b) => b.team === en && !b.dead);
          theirs.sort((a, b) => (a.type === 'keep') - (b.type === 'keep') || Math.hypot(a.x - keep.x, a.z - keep.z) - Math.hypot(b.x - keep.x, b.z - keep.z));
          target = theirs[0];
          if (target) this.attackTarget = target.id;
        }
        if (target) {
          const idle = force.filter((u) => u.order.type === 'idle' || (u.order.type === 'amove' && !w.get(u.engage) && Math.hypot(u.order.x - target.x, u.order.z - target.z) > 7));
          if (idle.length) {
            w.cmdMove(idle, target.x, target.z, true);
          }
          for (const u of force) if (u.order.type === 'amove' && w.dist(u, target) < 3 && !w.get(u.engage)) w.cmdAttack([u], target);
        }
      }
    }

    // Hero power.
    if (hero && hero.specialT <= 0) {
      let near = 0;
      for (const u of w.units) if (u.team === en && !u.dead && Math.hypot(u.x - hero.x, u.z - hero.z) < 8) near++;
      if (near >= 3) w.useSpecial(hero);
    }
  }

  findSpot(type, keep) {
    const w = this.w;
    const toward = { x: w.N / 2 - keep.x, z: w.N / 2 - keep.z };
    const tl = Math.hypot(toward.x, toward.z) || 1;
    toward.x /= tl; toward.z /= tl;
    let anchor = { x: keep.x, z: keep.z }, rMin = 4, rMax = 11;
    if (type === 'tower') { anchor = { x: keep.x + toward.x * 6, z: keep.z + toward.z * 6 }; rMin = 0; rMax = 5; }
    if (type === 'farm') { anchor = { x: keep.x - toward.x * 4, z: keep.z - toward.z * 4 }; rMin = 2; rMax = 9; }
    if (type === 'depot') {
      const r = w.nearestRes(keep.x, keep.z, 22, 'ore') || w.nearestRes(keep.x, keep.z, 22);
      if (r) { anchor = { x: r.x, z: r.z }; rMin = 2; rMax = 5; }
    }
    let best = null, bd = Infinity;
    for (let dz = -rMax; dz <= rMax; dz++) for (let dx = -rMax; dx <= rMax; dx++) {
      const d = Math.hypot(dx, dz);
      if (d < rMin || d > rMax) continue;
      const x = anchor.x + dx, z = anchor.z + dz;
      if (Math.hypot(x - keep.x, z - keep.z) < 4.5) continue;
      const p = w.canPlace(this.t, type, x, z);
      if (!p.ok) continue;
      const score = d + Math.random() * 1.5;
      if (score < bd) { bd = score; best = p; }
    }
    return best;
  }
}
