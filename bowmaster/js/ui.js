// DOM overlay: HUD, ammo dock, shop and menus. Text and buttons stay in HTML so
// they are crisp at any density and get native tap handling on iOS.

import { UPGRADES, AMMO, AMMO_ORDER, REPAIR, ammoStats } from './config.js';
import { formatNumber } from './util.js';
import { save } from './save.js';
import { audio } from './audio.js';

const $ = (sel) => document.querySelector(sel);

export function upgradeCost(u, level) {
  return Math.round(u.cost * Math.pow(u.growth, level));
}

export function ammoCost(id, level) {
  const a = AMMO[id];
  if (level === 0) return a.unlock;
  return Math.round(a.upgrade * Math.pow(1.5, level - 1));
}

export function repairCost(wave, bought) {
  return Math.round(REPAIR.cost * (1 + wave * 0.12) * Math.pow(REPAIR.growth, bought));
}

export class UI {
  constructor(game) {
    this.game = game;
    this.el = {
      screens: $('#screens'),
      hud: $('#hud'),
      wave: $('#hud-wave'),
      hp: $('#hud-hp-fill'),
      hpText: $('#hud-hp-text'),
      gold: $('#hud-gold'),
      combo: $('#hud-combo'),
      boss: $('#boss-bar'),
      bossFill: $('#boss-fill'),
      bossName: $('#boss-name'),
      dock: $('#dock-ammo'),
      banner: $('#banner'),
      shopGold: $('#shop-gold'),
      shopList: $('#shop-list'),
      shopWave: $('#shop-wave'),
      shopNext: $('#shop-next'),
      shopRepair: $('#shop-repair'),
    };
    this.cache = {};
    this.ammoButtons = new Map();
    this.bind();
  }

  bind() {
    const g = this.game;
    const on = (sel, fn) => {
      const el = $(sel);
      if (el) el.addEventListener('click', (e) => { e.preventDefault(); audio.unlock(); fn(e); });
    };

    on('#btn-play', () => g.newRun());
    on('#btn-continue', () => g.continueRun());
    on('#btn-howto', () => this.showScreen('howto'));
    on('#btn-howto-back', () => this.showScreen('title'));
    on('#btn-pause', () => g.pause());
    on('#btn-resume', () => g.resume());
    on('#btn-quit', () => g.quitToTitle());
    on('#btn-restart', () => g.newRun());
    on('#btn-over-menu', () => g.quitToTitle());
    on('#shop-next', () => g.beginNextWave());
    on('#shop-repair', () => g.buyRepair());

    this.toggle('sound', (on) => (on ? '🔊 Sound on' : '🔇 Sound off'), (on) => audio.setEnabled(on));
    this.toggle('guide', (on) => (on ? '🎯 Long aim guide' : '🎯 Short aim guide'));
  }

  // A setting can have a button on more than one screen; keep them in step.
  toggle(key, label, onChange) {
    const buttons = [...document.querySelectorAll(`.js-${key}`)];
    const paint = () => {
      const on = save.settings[key];
      for (const b of buttons) {
        b.textContent = label(on);
        b.setAttribute('aria-pressed', String(on));
        b.classList.toggle('off', !on);
      }
    };
    for (const b of buttons) {
      b.addEventListener('click', (e) => {
        e.preventDefault();
        audio.unlock();
        save.setSetting(key, !save.settings[key]);
        if (onChange) onChange(save.settings[key]);
        paint();
      });
    }
    paint();
  }

  // ---- screens -----------------------------------------------------------
  showScreen(name) {
    for (const s of document.querySelectorAll('#screens > section')) {
      s.classList.toggle('on', s.id === `screen-${name}`);
    }
    this.el.screens.classList.add('open');
  }

  hideScreens() {
    for (const s of document.querySelectorAll('#screens > section')) s.classList.remove('on');
    this.el.screens.classList.remove('open');
  }

  refreshTitle() {
    const best = save.best;
    $('#title-best').textContent = best.wave
      ? `Best: wave ${best.wave} · ${formatNumber(best.score)} pts`
      : 'No runs yet — loose the first arrow.';
    const cont = $('#btn-continue');
    const run = save.run;
    if (run) {
      cont.hidden = false;
      cont.textContent = `Continue — wave ${run.wave}`;
    } else {
      cont.hidden = true;
    }
  }

  banner(text, sub = '') {
    const el = this.el.banner;
    el.innerHTML = `<b>${text}</b>${sub ? `<span>${sub}</span>` : ''}`;
    el.classList.remove('show');
    void el.offsetWidth; // restart the animation
    el.classList.add('show');
  }

  // ---- HUD ---------------------------------------------------------------
  set(key, el, value) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    el.textContent = value;
  }

  updateHud(world, profile) {
    this.set('wave', this.el.wave, `WAVE ${world.wave}`);
    this.set('gold', this.el.gold, formatNumber(profile.gold));
    const pct = world.tower.maxHp ? Math.max(0, world.tower.hp / world.tower.maxHp) : 0;
    this.el.hp.style.transform = `scaleX(${pct})`;
    this.el.hp.style.background = pct > 0.5 ? '#54d67f' : pct > 0.25 ? '#ffc247' : '#ff5a5a';
    this.set('hpText', this.el.hpText, `${Math.ceil(Math.max(0, world.tower.hp))}`);

    if (world.combo >= 3) {
      this.el.combo.hidden = false;
      this.set('combo', this.el.combo, `${world.combo}× STREAK`);
    } else {
      this.el.combo.hidden = true;
    }

    const boss = world.boss;
    if (boss && boss.hp > 0) {
      this.el.boss.hidden = false;
      this.el.bossFill.style.transform = `scaleX(${Math.max(0, boss.hp / boss.maxHp)})`;
      this.set('bossName', this.el.bossName, boss.name.toUpperCase());
    } else {
      this.el.boss.hidden = true;
    }

    for (const [id, btn] of this.ammoButtons) {
      const cd = profile.cooldowns[id] || 0;
      const total = id === 'normal' ? 0 : ammoStats(id, (profile.ammo[id] || 1) - 1).cooldown;
      const frac = total > 0 ? Math.max(0, cd / total) : 0;
      btn.fill.style.transform = `scaleY(${frac})`;
      btn.el.classList.toggle('cooling', frac > 0);
      btn.el.classList.toggle('selected', profile.selected === id);
    }
  }

  // ---- ammo dock ---------------------------------------------------------
  buildDock(profile) {
    const dock = this.el.dock;
    dock.innerHTML = '';
    this.ammoButtons.clear();
    for (const id of AMMO_ORDER) {
      if (id !== 'normal' && !(profile.ammo[id] > 0)) continue;
      const a = AMMO[id];
      const el = document.createElement('button');
      el.className = 'ammo';
      el.type = 'button';
      el.setAttribute('aria-label', a.name);
      el.innerHTML = `
        <span class="ammo-fill"></span>
        <span class="ammo-glyph" style="color:${a.color}">${a.glyph}</span>
        <span class="ammo-name">${a.short}</span>`;
      el.addEventListener('click', (e) => {
        e.preventDefault();
        audio.unlock();
        profile.selected = profile.selected === id ? 'normal' : id;
        if (id === 'normal') profile.selected = 'normal';
        audio.tone({ freq: 700, time: 0.05, type: 'square', gain: 0.08 });
      });
      dock.appendChild(el);
      this.ammoButtons.set(id, { el, fill: el.querySelector('.ammo-fill') });
    }
  }

  // ---- shop --------------------------------------------------------------
  renderShop() {
    const g = this.game;
    const p = g.profile;
    this.el.shopGold.textContent = formatNumber(p.gold);
    this.el.shopWave.textContent = `Wave ${p.wave - 1} cleared`;
    this.el.shopNext.textContent = `Begin wave ${p.wave} →`;

    const hurt = g.world.tower.hp < g.world.tower.maxHp;
    const rcost = repairCost(p.wave, p.repairs);
    this.el.shopRepair.hidden = !hurt;
    this.el.shopRepair.disabled = p.gold < rcost;
    this.el.shopRepair.innerHTML = `🔧 Repair keep <b>+${Math.round(g.world.tower.maxHp * REPAIR.fraction)} HP</b> <i>${rcost}</i>`;

    const list = this.el.shopList;
    list.innerHTML = '';

    list.appendChild(this.sectionTitle('Arsenal', 'Unlock and sharpen special shafts'));
    for (const id of AMMO_ORDER) {
      if (id === 'normal') continue;
      const a = AMMO[id];
      const level = p.ammo[id] || 0;
      const maxed = level >= a.maxLevel;
      const cost = maxed ? 0 : ammoCost(id, level);
      const stats = ammoStats(id, Math.max(0, level - 1));
      const detail = level === 0
        ? a.blurb
        : `${a.blurb} · ${stats.cooldown.toFixed(1)}s cooldown`;
      list.appendChild(this.card({
        glyph: a.glyph, color: a.color, name: a.name, detail,
        level, max: a.maxLevel, cost, maxed,
        locked: level === 0,
        afford: p.gold >= cost,
        onBuy: () => g.buyAmmo(id),
      }));
    }

    list.appendChild(this.sectionTitle('Upgrades', 'Spend gold between waves — it carries through the run'));
    for (const u of UPGRADES) {
      const level = p.levels[u.id] || 0;
      const maxed = level >= u.max;
      const cost = maxed ? 0 : upgradeCost(u, level);
      list.appendChild(this.card({
        glyph: u.glyph, name: u.name,
        // Show what the next level buys, not the level you already own.
        detail: maxed ? u.detail(level) : `${u.blurb} — next: ${u.detail(level + 1)}`,
        level, max: u.max, cost, maxed,
        afford: p.gold >= cost,
        onBuy: () => g.buyUpgrade(u.id),
      }));
    }
  }

  sectionTitle(text, sub) {
    const h = document.createElement('div');
    h.className = 'shop-section';
    h.innerHTML = `<h3>${text}</h3><p>${sub}</p>`;
    return h;
  }

  card({ glyph, color, name, detail, level, max, cost, maxed, locked, afford, onBuy }) {
    const el = document.createElement('div');
    el.className = 'card' + (maxed ? ' maxed' : '') + (locked ? ' locked' : '');
    const pips = Array.from({ length: max }, (_, i) =>
      `<i class="${i < level ? 'on' : ''}"></i>`).join('');
    el.innerHTML = `
      <div class="card-glyph"${color ? ` style="color:${color}"` : ''}>${glyph}</div>
      <div class="card-body">
        <div class="card-top"><b>${name}</b><span class="pips">${pips}</span></div>
        <p>${detail}</p>
      </div>
      <button class="buy${afford || maxed ? '' : ' poor'}" type="button" ${maxed ? 'disabled' : ''}>
        ${maxed ? 'MAX' : `<i>◈</i>${formatNumber(cost)}`}
      </button>`;
    if (!maxed) {
      el.querySelector('.buy').addEventListener('click', (e) => {
        e.preventDefault();
        audio.unlock();
        onBuy();
      });
    }
    return el;
  }
}
