// The battlefield simulation: units, projectiles, damage, waves.
// Rendering and UI read from here but never write to it.

import {
  BASE_FIELD, PHYS, TOWER, ARCHER, ENEMIES, AMMO, ammoStats,
  buildWave, waveScaling,
} from './config.js';
import { clamp, lerp, rand, mulberry32, segmentBox, dist2 } from './util.js';
import { audio } from './audio.js';

const ALLY = {
  hp: 46, damage: 9, speed: 58, attackTime: 1.05, reach: 52, height: 60,
};

export class World {
  constructor(profile) {
    this.profile = profile; // { levels, ammoLevels, gold, ... } owned by the Game
    this.units = [];
    this.corpses = [];
    this.arrows = [];
    this.hostile = [];   // enemy arrows and boulders
    this.particles = [];
    this.floaters = [];
    this.stuck = [];     // spent arrows in the dirt
    this.coins = [];
    this.shake = 0;
    this.timeScale = 1;
    this.slowmo = 0;
    this.combo = 0;
    this.bestCombo = 0;
    this.wave = 0;
    this.queue = [];
    this.waveTime = 0;
    this.phase = 'idle';
    this.tower = { hp: 0, maxHp: 0, flash: 0 };
    this.reload = 0;
    this.kills = 0;
    this.headshots = 0;
    this.shotsFired = 0;
    this.shotsHit = 0;
    this.goldEarned = 0;
    this.allyTimer = 0;
    this.viewW = BASE_FIELD;
    this.viewH = 640;
    this.groundY = 512;
    this.f = 1;
  }

  // ---- layout ------------------------------------------------------------
  // Called whenever the canvas resizes. Positions scale with the view so the
  // battle reads the same in portrait and landscape.
  layout(viewW, viewH, groundY) {
    const prev = this.f;
    this.viewW = viewW;
    this.viewH = viewH;
    this.groundY = groundY;
    this.f = viewW / BASE_FIELD;
    this.spawnX = viewW + 60;
    this.towerX = TOWER.x * Math.min(1, Math.max(0.7, this.f));
    this.towerTop = groundY - TOWER.height;
    this.archer = { x: this.towerX + TOWER.width * 0.52, y: this.towerTop - 4 };
    this.bow = { x: this.archer.x + 6, y: this.archer.y - 38 };

    // Keep everything at the same fraction of the field across a rotation.
    if (prev !== this.f && prev > 0) {
      const k = this.f / prev;
      for (const list of [this.units, this.corpses, this.arrows, this.hostile]) {
        for (const e of list) e.x *= k;
      }
    }
    for (const list of [this.units, this.corpses]) {
      for (const e of list) e.y = groundY;
    }
  }

  // ---- run setup ---------------------------------------------------------
  resetTower(full = true) {
    const lvl = this.profile.levels.tower || 0;
    this.tower.maxHp = TOWER.baseHp + lvl * 45;
    if (full) this.tower.hp = this.tower.maxHp;
    this.tower.hp = Math.min(this.tower.hp, this.tower.maxHp);
  }

  startWave(n) {
    this.wave = n;
    this.queue = buildWave(n, mulberry32(n * 7919 + 13));
    this.waveTime = 0;
    this.phase = 'fighting';
    this.scaling = waveScaling(n);
    this.allyTimer = 0;
    this.spawnAllies(this.profile.levels.allies || 0);
    audio.waveStart();
  }

  spawnAllies(count) {
    for (let i = 0; i < count; i++) {
      const lvl = this.profile.levels.allies || 1;
      this.units.push(this.makeUnit({
        team: 'ally', kind: 'militia',
        name: 'Militia',
        hp: ALLY.hp + lvl * 16, damage: ALLY.damage + lvl * 2.5, speed: ALLY.speed,
        attackTime: ALLY.attackTime, reach: ALLY.reach, height: ALLY.height,
        tint: '#5bc0eb', bounty: 0,
      }, this.towerX + TOWER.width + 10 + i * 26));
    }
  }

  makeUnit(def, x) {
    return {
      ...def,
      x,
      y: this.groundY,
      maxHp: def.hp,
      facing: def.team === 'ally' ? 1 : -1,
      walk: Math.random() * Math.PI * 2,
      attackTimer: def.attackTime * Math.random() * 0.5,
      slowT: 0, slowAmt: 0, burnT: 0, burnDps: 0,
      hitFlash: 0, stuckArrows: [], target: null, state: 'walk',
      knock: 0, recoil: 0,
    };
  }

  spawnEnemy(entry) {
    const s = this.scaling;
    let def;
    if (entry.type === 'boss') {
      const b = entry.boss;
      const tierMul = 1 + entry.tier * 0.5;
      def = {
        ...b, team: 'foe', boss: true,
        hp: Math.round(b.hp * s.hp * 0.55 * tierMul),
        damage: b.damage * s.damage,
        bounty: Math.round(b.bounty * (1 + entry.tier * 0.5)),
      };
    } else {
      const e = ENEMIES[entry.type];
      def = {
        ...e, team: 'foe', id: entry.type,
        hp: Math.round(e.hp * s.hp),
        damage: e.damage * s.damage,
        speed: e.speed * s.speed,
      };
    }
    const u = this.makeUnit(def, this.spawnX + rand(0, 90));
    if (def.ranged) u.reach = def.reach * this.f;
    this.units.push(u);
    if (def.boss) this.boss = u;
  }

  // ---- shooting ----------------------------------------------------------
  get reloadTime() {
    return ARCHER.reloadTime * Math.pow(0.88, this.profile.levels.nock || 0);
  }

  get arrowDamage() {
    return ARCHER.baseDamage + 5 * (this.profile.levels.damage || 0);
  }

  get headMultiplier() {
    return ARCHER.headMultiplier + 0.3 * (this.profile.levels.crit || 0);
  }

  get launchSpeed() {
    return PHYS.arrowSpeed * (1 + 0.07 * (this.profile.levels.power || 0)) * this.f;
  }

  get gravity() {
    return PHYS.gravity * this.f;
  }

  canFire(ammoId) {
    if (this.phase === 'over') return false;
    if (this.reload > 0) return false;
    if (ammoId !== 'normal') {
      if (!(this.profile.ammo[ammoId] > 0)) return false;
      if ((this.profile.cooldowns[ammoId] || 0) > 0) return false;
    }
    return true;
  }

  fire(angle, power, ammoId) {
    if (!this.canFire(ammoId)) return false;
    const speed = this.launchSpeed * power;
    const level = this.profile.ammo[ammoId] || 0;
    const stats = ammoStats(ammoId, level - 1);

    const shots = ammoId === 'storm' ? stats.count : 1;
    for (let i = 0; i < shots; i++) {
      const spread = shots > 1 ? (i / (shots - 1) - 0.5) * stats.spread : 0;
      const a = angle + spread;
      this.arrows.push({
        x: this.bow.x + Math.cos(a) * 26,
        y: this.bow.y + Math.sin(a) * 26,
        px: this.bow.x, py: this.bow.y,
        vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
        ammo: ammoId, stats, life: 6,
        power,
        pierced: 0, trail: [],
        counted: false,
      });
    }

    this.reload = this.reloadTime * (ammoId === 'storm' ? 1.4 : 1);
    if (ammoId !== 'normal') this.profile.cooldowns[ammoId] = stats.cooldown;
    this.shotsFired++;
    audio.shoot();
    this.shake = Math.max(this.shake, 3 * power);
    return true;
  }

  // Sample the flight path for the aiming guide.
  predict(angle, power, seconds, step = 1 / 30) {
    const pts = [];
    let x = this.bow.x + Math.cos(angle) * 26;
    let y = this.bow.y + Math.sin(angle) * 26;
    let vx = Math.cos(angle) * this.launchSpeed * power;
    let vy = Math.sin(angle) * this.launchSpeed * power;
    for (let t = 0; t < seconds; t += step) {
      vy += this.gravity * step;
      const drag = 1 - PHYS.drag * step;
      vx *= drag; vy *= drag;
      x += vx * step; y += vy * step;
      if (y > this.groundY || x > this.viewW + 40) break;
      pts.push({ x, y });
    }
    return pts;
  }

  // ---- main step ---------------------------------------------------------
  update(rawDt) {
    if (this.slowmo > 0) {
      this.slowmo -= rawDt;
      this.timeScale = lerp(this.timeScale, 0.32, 0.4);
    } else {
      this.timeScale = lerp(this.timeScale, 1, 0.12);
    }
    const dt = rawDt * this.timeScale;

    if (this.reload > 0) this.reload -= rawDt;
    for (const id of Object.keys(this.profile.cooldowns)) {
      if (this.profile.cooldowns[id] > 0) this.profile.cooldowns[id] -= rawDt;
    }

    if (this.phase === 'fighting') {
      this.waveTime += dt;
      while (this.queue.length && this.queue[0].at <= this.waveTime) {
        this.spawnEnemy(this.queue.shift());
      }
      // Militia trickle in as the fight drags on.
      const allyLvl = this.profile.levels.allies || 0;
      if (allyLvl > 0) {
        this.allyTimer += dt;
        const alive = this.units.filter((u) => u.team === 'ally').length;
        if (this.allyTimer > 13 && alive < allyLvl * 2) {
          this.allyTimer = 0;
          this.spawnAllies(1);
        }
      }
    }

    this.stepUnits(dt);
    this.stepArrows(dt);
    this.stepHostile(dt);
    this.stepEffects(dt);

    this.shake *= Math.pow(0.001, rawDt);
    this.tower.flash = Math.max(0, this.tower.flash - rawDt * 3);

    if (this.phase === 'fighting' && !this.queue.length &&
        !this.units.some((u) => u.team === 'foe')) {
      this.phase = 'cleared';
      this.boss = null;
      audio.waveClear();
    }
    if (this.tower.hp <= 0 && this.phase !== 'over') {
      this.tower.hp = 0;
      this.phase = 'over';
      this.shake = 26;
      audio.gameOver();
    }
  }

  stepUnits(dt) {
    const towerFront = this.towerX + TOWER.width;
    for (let i = this.units.length - 1; i >= 0; i--) {
      const u = this.units[i];

      if (u.burnT > 0) {
        u.burnT -= dt;
        this.damage(u, u.burnDps * dt, { silent: true, source: 'burn' });
        if (Math.random() < dt * 26) {
          this.spawnParticle(u.x + rand(-10, 10), u.y - u.height * rand(0.2, 0.9),
            rand(-16, 16), rand(-50, -20), '#ff9b4a', 0.5, 3);
        }
      }
      if (u.slowT > 0) u.slowT -= dt;
      if (u.hitFlash > 0) u.hitFlash -= dt * 4;
      if (u.recoil > 0) u.recoil -= dt * 3;
      if (u.hp <= 0) { this.kill(u, i); continue; }

      const slow = u.slowT > 0 ? 1 - u.slowAmt : 1;
      const speed = u.speed * this.f * slow;

      // Pick the nearest enemy in the direction of travel.
      let target = null;
      let bestDx = Infinity;
      for (const o of this.units) {
        if (o.team === u.team || o.hp <= 0) continue;
        const dx = (o.x - u.x) * u.facing;
        if (dx < -12) continue;
        if (dx < bestDx) { bestDx = dx; target = o; }
      }

      const reach = u.reach + (u.height + (target ? target.height : 60)) * 0.12;
      if (target && bestDx <= reach) {
        u.state = 'fight';
        u.target = target;
        u.attackTimer -= dt;
        if (u.attackTimer <= 0) {
          u.attackTimer = u.attackTime;
          u.recoil = 1;
          if (u.ranged) this.launchHostile(u, target);
          else {
            this.damage(target, u.damage);
            this.spawnParticle(target.x, target.y - target.height * 0.5,
              rand(-40, 40), rand(-60, 0), '#ff5566', 0.4, 3, 4);
          }
        }
      } else if (u.team === 'foe' && u.x - towerFront <= u.reach) {
        u.state = 'siege';
        u.attackTimer -= dt;
        if (u.attackTimer <= 0) {
          u.attackTimer = u.attackTime;
          u.recoil = 1;
          if (u.ranged) this.launchHostile(u, null);
          else this.hitTower(u.damage);
        }
      } else {
        u.state = 'walk';
        u.x += speed * u.facing * dt;
        u.walk += dt * speed * 0.055;
        if (u.team === 'ally' && u.x > this.viewW - 40) u.x = this.viewW - 40;
      }
    }
  }

  launchHostile(u, target) {
    const boulder = u.ranged === 'boulder';
    const tx = target ? target.x : this.towerX + TOWER.width * 0.5;
    const ty = target ? target.y - target.height * 0.5 : this.towerTop + 60;
    const sx = u.x - u.height * 0.3 * (u.facing === -1 ? 1 : -1);
    const sy = u.y - u.height * 0.72;
    const g = this.gravity * (boulder ? 0.85 : 1);
    const speed = (boulder ? PHYS.boulderSpeed : PHYS.enemyArrowSpeed) * this.f;
    const dx = tx - sx;
    const dy = ty - sy;
    // Aim by flight time so the shot actually lands where it is meant to.
    const T = Math.max(0.35, Math.abs(dx) / (speed * 0.78));
    this.hostile.push({
      x: sx, y: sy, px: sx, py: sy,
      vx: dx / T + rand(-18, 18),
      vy: (dy - 0.5 * g * T * T) / T + rand(-12, 12),
      g, kind: boulder ? 'boulder' : 'arrow',
      damage: u.damage, life: 8, spin: 0,
    });
    audio.tone({ freq: boulder ? 150 : 520, to: boulder ? 90 : 300, time: 0.18, type: 'triangle', gain: 0.08 });
  }

  hitTower(amount) {
    this.tower.hp -= amount;
    this.tower.flash = 1;
    this.shake = Math.max(this.shake, Math.min(14, 3 + amount * 0.25));
    this.floaters.push({
      x: this.towerX + TOWER.width * 0.5, y: this.towerTop - 16,
      text: `-${Math.round(amount)}`, color: '#ff6b6b', life: 1, vy: -38, size: 20,
    });
    audio.towerHit();
    for (let i = 0; i < 8; i++) {
      this.spawnParticle(this.towerX + TOWER.width, this.towerTop + rand(20, 160),
        rand(10, 90), rand(-120, 20), '#c8b89a', 0.7, 3);
    }
  }

  // ---- projectiles -------------------------------------------------------
  stepArrows(dt) {
    for (let i = this.arrows.length - 1; i >= 0; i--) {
      const a = this.arrows[i];
      a.px = a.x; a.py = a.y;
      a.vy += this.gravity * dt;
      const drag = 1 - PHYS.drag * dt;
      a.vx *= drag; a.vy *= drag;
      a.x += a.vx * dt; a.y += a.vy * dt;
      a.life -= dt;

      a.trail.push(a.x, a.y);
      if (a.trail.length > 16) a.trail.splice(0, 2);

      if (a.ammo === 'fire' && Math.random() < dt * 60) {
        this.spawnParticle(a.x, a.y, rand(-20, 20), rand(-30, 10), '#ff8a3c', 0.4, 3);
      }

      const hit = this.traceHit(a);
      if (hit) {
        const done = this.resolveArrowHit(a, hit);
        if (done) { this.arrows.splice(i, 1); continue; }
      }

      if (a.y >= this.groundY) {
        this.arrowLanded(a);
        this.arrows.splice(i, 1);
        continue;
      }
      if (a.x > this.viewW + 160 || a.x < -80 || a.life <= 0) {
        this.missed(a);
        this.arrows.splice(i, 1);
      }
    }
  }

  // Segment sweep against every hostile unit; returns the earliest zone hit.
  traceHit(a) {
    let best = null;
    for (const u of this.units) {
      if (u.team !== 'foe' || u.hp <= 0) continue;
      if (a.hitIds && a.hitIds.includes(u)) continue;
      const boxes = unitBoxes(u);
      if (u.shield && a.ammo !== 'pierce') {
        const s = boxes.shield;
        const t = segmentBox(a.px, a.py, a.x, a.y, s[0], s[1], s[2], s[3]);
        if (t >= 0 && (!best || t < best.t)) { best = { t, u, zone: 'shield' }; }
      }
      for (const zone of ['head', 'torso', 'legs']) {
        const b = boxes[zone];
        if (!b) continue;
        const t = segmentBox(a.px, a.py, a.x, a.y, b[0], b[1], b[2], b[3]);
        if (t >= 0 && (!best || t < best.t)) best = { t, u, zone };
      }
    }
    return best;
  }

  // Returns true when the arrow should be removed.
  resolveArrowHit(a, hit) {
    const { u, zone, t } = hit;
    const hx = lerp(a.px, a.x, t);
    const hy = lerp(a.py, a.y, t);

    if (zone === 'shield') {
      audio.block();
      for (let i = 0; i < 7; i++) {
        this.spawnParticle(hx, hy, rand(-160, -40), rand(-110, 40), '#ffe6a8', 0.4, 2.4);
      }
      this.floaters.push({ x: hx, y: hy - 12, text: 'BLOCKED', color: '#9fc7ff', life: 0.7, vy: -46, size: 15 });
      this.breakCombo();
      return true;
    }

    const base = this.arrowDamage * a.power * (a.stats.damage || 1);
    let mult = zone === 'head' ? this.headMultiplier : zone === 'legs' ? ARCHER.legMultiplier : 1;
    let dmg = base * mult;
    const head = zone === 'head';

    if (!a.counted) { this.shotsHit++; a.counted = true; this.addCombo(); }
    if (head) this.headshots++;

    // Ammo effects land at the impact point.
    switch (a.ammo) {
      case 'fire':
        u.burnT = a.stats.burnTime;
        u.burnDps = a.stats.burnDps;
        this.splash(hx, hy, a.stats.radius, 0, { burn: a.stats });
        audio.fire();
        break;
      case 'frost':
        this.splash(hx, hy, a.stats.radius, base * 0.5, { slow: a.stats });
        audio.frost();
        break;
      case 'bomb':
        this.explode(hx, hy, a.stats.radius, a.stats.blast + base * 0.4);
        this.damage(u, dmg, { head, x: hx, y: hy });
        return true;
      default:
        break;
    }

    this.damage(u, dmg, { head, x: hx, y: hy });
    if (u.stuckArrows.length < 5) {
      u.stuckArrows.push({
        dx: (hx - u.x) * u.facing, dy: hy - u.y,
        angle: Math.atan2(a.vy, a.vx), color: AMMO[a.ammo].color,
      });
    }

    if (a.ammo === 'pierce' && a.pierced < a.stats.pierce) {
      a.pierced++;
      a.hitIds = a.hitIds || [];
      a.hitIds.push(u);
      a.vx *= 0.9; a.vy *= 0.9;
      return false;
    }
    return true;
  }

  arrowLanded(a) {
    a.y = this.groundY;
    if (a.ammo === 'bomb') {
      this.explode(a.x, this.groundY - 8, a.stats.radius, a.stats.blast);
    } else if (a.ammo === 'frost') {
      this.splash(a.x, this.groundY - 8, a.stats.radius, 0, { slow: a.stats });
      audio.frost();
    } else if (a.ammo === 'fire') {
      this.splash(a.x, this.groundY - 8, a.stats.radius, 0, { burn: a.stats });
      audio.fire();
    }
    if (!a.counted) this.missed(a);
    this.stuck.push({ x: a.x, y: this.groundY, angle: Math.atan2(a.vy, a.vx), life: 9, color: AMMO[a.ammo].color });
    if (this.stuck.length > 26) this.stuck.shift();
    for (let i = 0; i < 5; i++) {
      this.spawnParticle(a.x, this.groundY - 2, rand(-50, 50), rand(-90, -20), '#8b7355', 0.5, 2.6);
    }
    audio.tone({ freq: 240, to: 140, time: 0.08, type: 'triangle', gain: 0.07 });
  }

  missed(a) {
    if (!a.counted) this.breakCombo();
  }

  explode(x, y, radius, damage) {
    audio.explode();
    this.shake = Math.max(this.shake, 16);
    this.splash(x, y, radius, damage);
    this.particles.push({ x, y, kind: 'blast', r: 0, max: radius, life: 0.42, t: 0.42 });
    for (let i = 0; i < 26; i++) {
      const a = rand(0, Math.PI * 2);
      const s = rand(80, 400);
      this.spawnParticle(x, y, Math.cos(a) * s, Math.sin(a) * s - 60,
        i % 3 ? '#ffb347' : '#ffe9a8', rand(0.3, 0.8), rand(2, 5));
    }
  }

  splash(x, y, radius, damage, effects = {}) {
    const r2 = radius * radius;
    for (const u of this.units) {
      if (u.team !== 'foe' || u.hp <= 0) continue;
      const cx = u.x;
      const cy = u.y - u.height * 0.5;
      if (dist2(x, y, cx, cy) > r2) continue;
      const falloff = 1 - Math.sqrt(dist2(x, y, cx, cy)) / radius;
      if (damage > 0) this.damage(u, damage * (0.45 + 0.55 * falloff), { x: cx, y: cy });
      if (effects.burn) { u.burnT = effects.burn.burnTime; u.burnDps = effects.burn.burnDps; }
      if (effects.slow) { u.slowT = effects.slow.slowTime; u.slowAmt = effects.slow.slow; }
    }
    if (effects.slow) {
      for (let i = 0; i < 18; i++) {
        const a = rand(0, Math.PI * 2);
        this.spawnParticle(x, y, Math.cos(a) * rand(40, 220), Math.sin(a) * rand(40, 180) - 40,
          '#bff2ff', rand(0.4, 0.9), rand(2, 4));
      }
    }
  }

  stepHostile(dt) {
    const towerFront = this.towerX + TOWER.width;
    for (let i = this.hostile.length - 1; i >= 0; i--) {
      const p = this.hostile[i];
      p.px = p.x; p.py = p.y;
      p.vy += p.g * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.spin += dt * 6;
      p.life -= dt;

      // May strike a defender on the way in.
      let struck = null;
      for (const u of this.units) {
        if (u.team !== 'ally' || u.hp <= 0) continue;
        const b = unitBoxes(u);
        for (const zone of ['head', 'torso', 'legs']) {
          const t = segmentBox(p.px, p.py, p.x, p.y, b[zone][0], b[zone][1], b[zone][2], b[zone][3]);
          if (t >= 0) { struck = u; break; }
        }
        if (struck) break;
      }
      if (struck) {
        this.damage(struck, p.damage * (p.kind === 'boulder' ? 1.6 : 1));
        this.hostile.splice(i, 1);
        continue;
      }

      const hitsTower = p.x <= towerFront + 10 && p.y >= this.towerTop - 20;
      if (hitsTower || p.y >= this.groundY) {
        if (hitsTower) {
          this.hitTower(p.damage);
          if (p.kind === 'boulder') this.explode(p.x, p.y, 90 * this.f, 0);
        } else if (p.kind === 'boulder') {
          this.explode(p.x, this.groundY - 10, 80 * this.f, 0);
        }
        this.hostile.splice(i, 1);
        continue;
      }
      if (p.life <= 0 || p.x < -60) this.hostile.splice(i, 1);
    }
  }

  // ---- damage & death ----------------------------------------------------
  damage(u, amount, opts = {}) {
    if (u.hp <= 0) return;
    const armor = u.armor || 0;
    const dealt = amount * (1 - armor);
    u.hp -= dealt;
    u.hitFlash = 1;

    if (!opts.silent) {
      if (opts.head) audio.headshot(); else audio.hit();
      const x = opts.x ?? u.x;
      const y = opts.y ?? (u.y - u.height * 0.6);
      for (let i = 0; i < (opts.head ? 12 : 6); i++) {
        this.spawnParticle(x, y, rand(-130, 90), rand(-160, 30),
          u.team === 'ally' ? '#7fd3ff' : '#e03b48', rand(0.3, 0.7), rand(2, 4.5));
      }
      this.floaters.push({
        x, y: y - 10,
        text: opts.head ? `${Math.round(dealt)}!` : `${Math.round(dealt)}`,
        color: opts.head ? '#ffd166' : '#ffffff',
        life: opts.head ? 1 : 0.7, vy: -60, size: opts.head ? 26 : 18,
      });
      if (opts.head) {
        this.floaters.push({ x: x + 34, y: y - 34, text: 'HEADSHOT', color: '#ffd166', life: 1.1, vy: -34, size: 16 });
        this.shake = Math.max(this.shake, 7);
      }
    }
    if (u.hp <= 0) u.killedByHead = !!opts.head;
  }

  kill(u, index) {
    this.units.splice(index, 1);
    if (u.team === 'foe') {
      this.kills++;
      const mult = 1 + 0.14 * (this.profile.levels.bounty || 0);
      const combo = 1 + Math.min(0.6, this.combo * 0.04);
      const gold = Math.max(1, Math.round(u.bounty * mult * combo * (u.killedByHead ? 1.5 : 1)));
      this.profile.gold += gold;
      this.goldEarned += gold;
      this.coins.push({ x: u.x, y: u.y - u.height * 0.6, vx: rand(-60, 60), vy: rand(-260, -160), life: 1.1, gold });
      this.floaters.push({ x: u.x + 16, y: u.y - u.height - 6, text: `+${gold}`, color: '#ffd166', life: 0.9, vy: -50, size: 17 });
      audio.coin();
      if (u.killedByHead || u.boss) {
        this.slowmo = u.boss ? 0.5 : 0.18;
      }
      if (u.boss) {
        this.shake = 22;
        this.explode(u.x, u.y - u.height * 0.5, 120 * this.f, 0);
        this.boss = null;
      }
    }
    this.corpses.push({
      x: u.x, y: this.groundY, height: u.height, kind: u.kind, tint: u.tint,
      facing: u.facing, angle: 0, spin: rand(1.6, 3.4) * (u.facing === -1 ? 1 : -1),
      life: 5.5, stuckArrows: u.stuckArrows, team: u.team,
    });
    if (this.corpses.length > 22) this.corpses.shift();
    for (let i = 0; i < 10; i++) {
      this.spawnParticle(u.x, u.y - u.height * 0.5, rand(-120, 120), rand(-200, -40),
        u.team === 'ally' ? '#7fd3ff' : '#c4303f', rand(0.4, 0.9), rand(2, 5));
    }
  }

  addCombo() {
    this.combo++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);
    if (this.combo >= 5 && this.combo % 5 === 0) {
      this.floaters.push({
        x: this.viewW * 0.5, y: this.groundY - 320,
        text: `${this.combo} HIT STREAK`, color: '#8ef1c0', life: 1.1, vy: -30, size: 20,
      });
    }
  }

  breakCombo() { this.combo = 0; }

  // ---- effects -----------------------------------------------------------
  spawnParticle(x, y, vx, vy, color, life, size, gravityScale = 1) {
    if (this.particles.length > 420) return;
    this.particles.push({ x, y, vx, vy, color, life, t: life, size, g: gravityScale });
  }

  stepEffects(dt) {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.t -= dt;
      if (p.t <= 0) { this.particles.splice(i, 1); continue; }
      if (p.kind === 'blast') { p.r = p.max * (1 - p.t / p.life); continue; }
      p.vy += 760 * (p.g ?? 1) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      if (p.y > this.groundY) { p.y = this.groundY; p.vy *= -0.32; p.vx *= 0.6; }
    }
    for (let i = this.floaters.length - 1; i >= 0; i--) {
      const f = this.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.vy *= 0.94;
      if (f.life <= 0) this.floaters.splice(i, 1);
    }
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      c.life -= dt;
      c.vy += 620 * dt;
      c.x += c.vx * dt; c.y += c.vy * dt;
      if (c.life <= 0) this.coins.splice(i, 1);
    }
    for (let i = this.corpses.length - 1; i >= 0; i--) {
      const c = this.corpses[i];
      c.life -= dt;
      c.angle = clamp(c.angle + c.spin * dt, -Math.PI / 2, Math.PI / 2);
      if (Math.abs(c.angle) >= Math.PI / 2 - 0.01) c.spin = 0;
      if (c.life <= 0) this.corpses.splice(i, 1);
    }
    for (let i = this.stuck.length - 1; i >= 0; i--) {
      this.stuck[i].life -= dt;
      if (this.stuck[i].life <= 0) this.stuck.splice(i, 1);
    }
  }

  get accuracy() {
    return this.shotsFired ? this.shotsHit / this.shotsFired : 0;
  }
}

// Hit zones, in world coordinates. Height drives every proportion so a boss
// and a scout use the same silhouette maths.
export function unitBoxes(u) {
  const h = u.height;
  const top = u.y - h;
  const f = u.facing;
  if (u.kind === 'rider') {
    return {
      head: [u.x - 0.13 * h, top, u.x + 0.13 * h, top + 0.17 * h],
      torso: [u.x - 0.17 * h, top + 0.17 * h, u.x + 0.19 * h, top + 0.46 * h],
      legs: [u.x - 0.42 * h, top + 0.46 * h, u.x + 0.34 * h, u.y],
    };
  }
  if (u.kind === 'siege') {
    return {
      head: null,
      torso: [u.x - 0.34 * h, top + 0.1 * h, u.x + 0.3 * h, top + 0.62 * h],
      legs: [u.x - 0.36 * h, top + 0.62 * h, u.x + 0.36 * h, u.y],
    };
  }
  const boxes = {
    head: [u.x - 0.16 * h, top, u.x + 0.16 * h, top + 0.19 * h],
    torso: [u.x - 0.21 * h, top + 0.19 * h, u.x + 0.21 * h, top + 0.58 * h],
    legs: [u.x - 0.19 * h, top + 0.58 * h, u.x + 0.19 * h, u.y],
  };
  if (u.shield) {
    const sx = u.x + 0.26 * h * f;
    boxes.shield = [Math.min(sx, sx + 0.16 * h * f), top + 0.14 * h,
      Math.max(sx, sx + 0.16 * h * f), top + 0.72 * h];
  }
  return boxes;
}
