// Boot, game loop, input and run flow.

import { PHYS, UPGRADES, AMMO, REPAIR } from './config.js';
import { clamp, lerp, formatNumber } from './util.js';
import { save } from './save.js';
import { audio } from './audio.js';
import { World } from './world.js';
import { Renderer } from './render.js';
import { UI, upgradeCost, ammoCost, repairCost } from './ui.js';

function freshProfile() {
  return {
    gold: 0,
    wave: 1,
    repairs: 0,
    selected: 'normal',
    levels: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    ammo: { pierce: 0, fire: 0, frost: 0, bomb: 0, storm: 0 },
    cooldowns: {},
  };
}

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.stage = document.getElementById('stage');
    this.renderer = new Renderer(this.canvas);
    this.profile = freshProfile();
    this.world = new World(this.profile);
    this.ui = new UI(this);
    this.state = 'menu';
    this.aim = { active: false, angle: -0.5, power: 0, guideTime: 1 };
    this.pointerId = null;
    this.clearedTimer = 0;
    this.overTimer = 0;

    audio.setEnabled(save.settings.sound);
    this.installInput();
    this.installLifecycle();
    this.resize();
    this.ui.buildDock(this.profile);
    this.ui.refreshTitle();
    this.ui.showScreen('title');

    this.last = performance.now();
    requestAnimationFrame(this.frame);
  }

  // ---- layout ------------------------------------------------------------
  resize() {
    const rect = this.stage.getBoundingClientRect();
    const cssW = Math.max(1, rect.width);
    const cssH = Math.max(1, rect.height);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.renderer.resize(cssW, cssH, dpr);

    // Zoom is chosen so a soldier is a readable size on screen, then pulled back
    // if that would leave too little sky for an arrow's arc. The field ends up
    // shorter on a narrow screen, but World normalises speeds so a wave still
    // takes the same time to arrive.
    const MIN_VIEW_H = 560;
    const soldierPx = clamp(cssW * 0.095, 26, 52);
    const scale = Math.min(soldierPx / 62, cssH / MIN_VIEW_H);
    const viewW = cssW / scale;
    const viewH = cssH / scale;
    const groundY = Math.min(viewH * 0.87, viewH - 60);
    this.world.layout(viewW, viewH, groundY);
    this.maxDrag = Math.min(cssW, cssH) * 0.3;
  }

  // ---- input -------------------------------------------------------------
  installInput() {
    // Listening on the whole app (not just the canvas) means the portrait aim
    // pad below the battlefield works too — your thumb never covers the fight.
    const stage = document.getElementById('app');
    const point = (e) => {
      const r = stage.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    };

    const down = (e) => {
      audio.unlock();
      if (this.state !== 'playing') return;
      if (this.pointerId !== null) return;
      if (e.target.closest && e.target.closest('button')) return;
      this.pointerId = e.pointerId ?? 0;
      const p = point(e);
      this.aim.active = true;
      this.aim.startX = p.x;
      this.aim.startY = p.y;
      this.aim.power = 0;
      this.drew = false;
      if (stage.setPointerCapture && e.pointerId != null) {
        try { stage.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      }
    };

    const move = (e) => {
      if (!this.aim.active || (e.pointerId ?? 0) !== this.pointerId) return;
      const p = point(e);
      const dx = this.aim.startX - p.x;
      const dy = this.aim.startY - p.y;
      const len = Math.hypot(dx, dy);
      if (len > 6) {
        let a = Math.atan2(dy, dx);
        // Never let the archer aim behind the keep.
        a = clamp(a, -1.47, 1.0);
        if (Math.cos(a) <= 0) a = a < 0 ? -1.47 : 1.0;
        this.aim.angle = a;
      }
      const raw = clamp(len / this.maxDrag, 0, 1);
      this.aim.power = lerp(PHYS.minDraw, 1, raw);
      if (raw > 0.05 && !this.drew) {
        this.drew = true;
        document.body.classList.add('drawn');
        audio.draw();
      }
      if (e.cancelable) e.preventDefault();
    };

    const up = (e) => {
      if ((e.pointerId ?? 0) !== this.pointerId) return;
      this.pointerId = null;
      const wasDrawn = this.drew;
      this.aim.active = false;
      if (!wasDrawn || this.state !== 'playing') { this.aim.power = 0; return; }
      const ammo = this.profile.selected;
      const fired = this.world.fire(this.aim.angle, this.aim.power, ammo);
      if (fired && ammo !== 'normal') this.profile.selected = 'normal';
      if (!fired) audio.deny();
      this.aim.power = 0;
    };

    if (window.PointerEvent) {
      stage.addEventListener('pointerdown', down);
      stage.addEventListener('pointermove', move, { passive: false });
      stage.addEventListener('pointerup', up);
      stage.addEventListener('pointercancel', up);
    } else {
      const wrap = (fn) => (e) => {
        const t = e.changedTouches[0];
        fn({ clientX: t.clientX, clientY: t.clientY, pointerId: t.identifier, cancelable: e.cancelable, preventDefault: () => e.preventDefault() });
      };
      stage.addEventListener('touchstart', wrap(down), { passive: false });
      stage.addEventListener('touchmove', wrap(move), { passive: false });
      stage.addEventListener('touchend', wrap(up));
      stage.addEventListener('touchcancel', wrap(up));
    }

    // Keyboard, for anyone playing on a desktop browser.
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.state === 'playing') this.pause();
      if (e.key === ' ' && this.state === 'shop') { e.preventDefault(); this.beginNextWave(); }
    });
  }

  installLifecycle() {
    const ro = new ResizeObserver(() => this.resize());
    ro.observe(this.stage);
    window.addEventListener('orientationchange', () => setTimeout(() => this.resize(), 250));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        audio.suspend();
        if (this.state === 'playing') this.pause();
      } else {
        audio.resume();
      }
    });
  }

  // ---- run flow ----------------------------------------------------------
  newRun() {
    this.profile = freshProfile();
    this.world = new World(this.profile);
    this.resize();
    this.world.resetTower(true);
    this.ui.buildDock(this.profile);
    this.ui.hideScreens();
    this.state = 'playing';
    this.clearedTimer = 0;
    this.clearedShown = false;
    this.overTimer = 0;
    save.clearRun();
    this.world.startWave(1);
    this.ui.banner('WAVE 1', 'Drag back to draw, release to loose');
  }

  continueRun() {
    const snap = save.run;
    if (!snap) return this.newRun();
    this.profile = { ...freshProfile(), ...snap.profile, cooldowns: {} };
    this.world = new World(this.profile);
    this.resize();
    this.world.resetTower(true);
    this.world.tower.hp = clamp(snap.hp, 1, this.world.tower.maxHp);
    Object.assign(this.world, snap.stats);
    this.ui.buildDock(this.profile);
    this.ui.hideScreens();
    this.state = 'playing';
    this.clearedTimer = 0;
    this.clearedShown = false;
    this.overTimer = 0;
    this.world.startWave(this.profile.wave);
    this.ui.banner(`WAVE ${this.profile.wave}`, 'Hold the line');
  }

  snapshot() {
    const w = this.world;
    save.saveRun({
      wave: this.profile.wave,
      hp: w.tower.hp,
      profile: {
        gold: this.profile.gold, wave: this.profile.wave, repairs: this.profile.repairs,
        levels: this.profile.levels, ammo: this.profile.ammo, selected: 'normal',
      },
      stats: {
        kills: w.kills, headshots: w.headshots, shotsFired: w.shotsFired,
        shotsHit: w.shotsHit, goldEarned: w.goldEarned, bestCombo: w.bestCombo,
      },
    });
  }

  onWaveCleared() {
    const w = this.world;
    const bonus = Math.round(30 + w.wave * 16 + w.accuracy * 60);
    this.profile.gold += bonus;
    w.goldEarned += bonus;
    this.profile.wave = w.wave + 1;
    this.snapshot();
    this.state = 'shop';
    this.ui.renderShop();
    document.getElementById('shop-bonus').textContent =
      `+${bonus} gold · ${Math.round(w.accuracy * 100)}% accuracy`;
    this.ui.showScreen('shop');
  }

  beginNextWave() {
    this.ui.hideScreens();
    this.state = 'playing';
    this.clearedTimer = 0;
    this.clearedShown = false;
    this.world.phase = 'idle';
    this.world.startWave(this.profile.wave);
    this.ui.banner(`WAVE ${this.profile.wave}`, this.profile.wave % 5 === 0 ? 'A champion marches with them' : '');
  }

  score() {
    const w = this.world;
    return Math.round(w.goldEarned + w.kills * 6 + (w.wave - 1) * 120 + w.bestCombo * 15);
  }

  gameOver() {
    const w = this.world;
    const score = this.score();
    save.recordRun({ wave: w.wave, score, kills: w.kills, headshots: w.headshots });
    save.clearRun();
    this.state = 'over';
    const best = save.best;
    document.getElementById('over-wave').textContent = w.wave;
    document.getElementById('over-score').textContent = formatNumber(score);
    document.getElementById('over-stats').innerHTML = `
      <li><b>${w.kills}</b><span>Kills</span></li>
      <li><b>${w.headshots}</b><span>Headshots</span></li>
      <li><b>${Math.round(w.accuracy * 100)}%</b><span>Accuracy</span></li>
      <li><b>${w.bestCombo}×</b><span>Best streak</span></li>`;
    document.getElementById('over-best').textContent =
      score >= best.score ? 'New personal best!' : `Best: wave ${best.wave} · ${formatNumber(best.score)} pts`;
    this.ui.showScreen('over');
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this.aim.active = false;
    this.pointerId = null;
    this.ui.showScreen('pause');
  }

  resume() {
    if (this.state !== 'paused') return;
    this.ui.hideScreens();
    this.state = 'playing';
    audio.resume();
  }

  quitToTitle() {
    if (this.state === 'paused' || this.state === 'shop') this.snapshot();
    this.state = 'menu';
    this.ui.refreshTitle();
    this.ui.showScreen('title');
  }

  // ---- purchases ---------------------------------------------------------
  buyUpgrade(id) {
    const u = UPGRADES.find((x) => x.id === id);
    const level = this.profile.levels[id] || 0;
    if (level >= u.max) return;
    const cost = upgradeCost(u, level);
    if (this.profile.gold < cost) { audio.deny(); return; }
    this.profile.gold -= cost;
    this.profile.levels[id] = level + 1;
    if (id === 'tower') this.world.resetTower(true);
    audio.buy();
    this.snapshot();
    this.ui.renderShop();
  }

  buyAmmo(id) {
    const level = this.profile.ammo[id] || 0;
    if (level >= AMMO[id].maxLevel) return;
    const cost = ammoCost(id, level);
    if (this.profile.gold < cost) { audio.deny(); return; }
    this.profile.gold -= cost;
    this.profile.ammo[id] = level + 1;
    audio.buy();
    this.ui.buildDock(this.profile);
    this.snapshot();
    this.ui.renderShop();
  }

  buyRepair() {
    const cost = repairCost(this.profile.wave, this.profile.repairs);
    const w = this.world;
    if (this.profile.gold < cost || w.tower.hp >= w.tower.maxHp) { audio.deny(); return; }
    this.profile.gold -= cost;
    this.profile.repairs++;
    w.tower.hp = Math.min(w.tower.maxHp, w.tower.hp + w.tower.maxHp * REPAIR.fraction);
    audio.buy();
    this.snapshot();
    this.ui.renderShop();
  }

  // ---- loop --------------------------------------------------------------
  frame = (now) => {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;

    if (this.state === 'playing') {
      this.world.update(dt);
      if (this.world.phase === 'cleared') {
        if (!this.clearedShown) {
          this.clearedShown = true;
          this.ui.banner('WAVE CLEARED', 'Spend your gold');
        }
        this.clearedTimer += dt;
        if (this.clearedTimer > 1.5) { this.clearedTimer = 0; this.onWaveCleared(); }
      }
      if (this.world.phase === 'over') {
        this.overTimer += dt;
        if (this.overTimer > 1.8) { this.overTimer = 0; this.gameOver(); }
      }
    }

    this.aim.guideTime = save.settings.guide ? 1.35 : 0.5;
    const showAim = this.state === 'playing' ? this.aim : null;
    this.renderer.draw(this.world, showAim, this.state === 'playing' ? dt : 0);
    this.ui.updateHud(this.world, this.profile);
    requestAnimationFrame(this.frame);
  };
}

// --- boot ------------------------------------------------------------------
function setupChrome() {
  // iOS: stop rubber-banding, pinch-zoom and the double-tap zoom gesture.
  document.addEventListener('touchmove', (e) => {
    if (e.touches.length > 1) e.preventDefault();
  }, { passive: false });
  document.addEventListener('gesturestart', (e) => e.preventDefault());
  document.addEventListener('dblclick', (e) => e.preventDefault());

  const standalone = window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches;
  const iOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const tip = document.getElementById('install-tip');
  if (tip && iOS && !standalone) tip.hidden = false;
  document.body.classList.toggle('standalone', standalone);
}

setupChrome();
window.game = new Game();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline play is a bonus, not a requirement */ });
  });
}
