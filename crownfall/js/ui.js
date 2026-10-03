// DOM overlay: HUD, objective, banners, toasts, floating labels, the building
// menu that opens when the king rides up to something, and the build picker.

import { BUILDINGS } from './config.js';

const $ = (id) => document.getElementById(id);
const PLACEABLE = ['house', 'farm', 'barracks'];
const LIMIT = { barracks: 2 };
const TAB_ICON = { King: '👑', Army: '⚔️', Castle: '🏰' };

export class UI {
  constructor(h) {
    this.h = h;
    this.el = {
      coins: $('hud-coins'), cap: $('hud-cap'), wood: $('hud-wood'), stone: $('hud-stone'), pop: $('hud-pop'), beds: $('hud-beds'),
      wave: $('hud-wave'), castle: $('hud-castle'), objective: $('objective'), objectiveText: $('objective-text'),
      boss: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'), left: $('enemies-left'),
      banner: $('banner'), toasts: $('toasts'), floats: $('floats'),
      waveBtn: $('btn-wave'), buildBtn: $('btn-build'), controls: $('controls'),
      sheet: $('sheet'), sheetIcon: $('sheet-icon'), sheetName: $('sheet-name'), sheetSub: $('sheet-sub'), sheetList: $('sheet-list'),
      buildSheet: $('build-sheet'), buildList: $('build-list'),
      placeBar: $('place-bar'), placeText: $('place-text'), placeOk: $('btn-place-ok'), threats: $('threats'),
      load: $('hud-load'), loadN: $('hud-load-n'), loadCap: $('hud-load-cap'), loadI: $('hud-load-i'), padtip: $('padtip'),
    };
    this.prev = {};
    this.menuFor = null;
    this.sig = '';
    this.sigT = 0;
    this.bannerT = 0;
    this.toastSeen = new Map();

    this.el.waveBtn.addEventListener('click', () => h.onStartWave());
    this.el.buildBtn.addEventListener('click', () => { h.tap(); this.openBuild(); });
    $('build-close').addEventListener('click', () => { h.tap(); this.closeBuild(); });
    $('sheet-close').addEventListener('click', () => { h.tap(); this.closeMenu(); });
    $('btn-place-ok').addEventListener('click', () => h.onPlaceOk());
    $('btn-place-cancel').addEventListener('click', () => h.onPlaceCancel());
    $('btn-pause').addEventListener('click', () => h.onPause());

    this.el.sheetList.addEventListener('click', (e) => {
      const wk = e.target.closest('button[data-workers]');
      if (wk) { const [id, d] = wk.dataset.workers.split(':'); h.onWorkers(id, Number(d)); this.sig = ''; this.sigT = 0; return; }
      const tab = e.target.closest('button[data-tab]');
      if (tab) { h.tap(); this.tab = tab.dataset.tab; this.sig = ''; this.sigT = 0; return; }
      const btn = e.target.closest('button[data-key]');
      if (!btn) return;
      if (btn.dataset.equip) h.onEquip(btn.dataset.equip);
      else h.onFund(btn.dataset.key, this.menuFor);
      this.sig = '';
    });
    this.el.buildList.addEventListener('click', (e) => {
      const card = e.target.closest('button[data-type]');
      if (!card) return;
      if (card.dataset.lock) { h.deny(card.dataset.lock); return; }
      h.tap();
      this.closeBuild();
      h.onPickBuild(card.dataset.type);
    });
  }

  get sheetOpen() { return !this.el.sheet.hidden || !this.el.buildSheet.hidden; }

  // ------------------------------------------------------------------ HUD
  update(world, dt, ctx) {
    const e = this.el;
    const h = world.hero;
    this.set('coins', h.coins, () => {
      e.coins.textContent = h.coins;
      if (h.coins > (this.prev.coinsN || 0)) bump(e.coins.parentElement);
      this.prev.coinsN = h.coins;
    });
    this.set('cap', world.carry, () => { e.cap.textContent = `/${world.carry}`; });
    this.set('wood', world.res.wood, () => { e.wood.textContent = world.res.wood; bump(e.wood.parentElement); });
    this.set('stone', world.res.stone, () => { e.stone.textContent = world.res.stone; bump(e.stone.parentElement); });
    this.set('pop', world.pop, () => { e.pop.textContent = world.pop; });
    const free = Math.max(0, world.freeVillagers);
    this.set('beds', `${world.beds}|${free}`, () => { e.beds.textContent = `/${world.beds}${free ? ` · ${free} free` : ''}`; });

    const waveN = world.phase === 'wave' ? world.wave + 1 : world.wave + 1;
    const label = world.siege ? `L${world.level} · Siege` : `L${world.level} · Wave ${waveN}`;
    this.set('wave', label, () => { e.wave.textContent = label; });
    const cf = world.castleHp / world.castleMax;
    this.set('castle', Math.round(cf * 100), () => {
      e.castle.style.width = `${cf * 100}%`;
      e.castle.classList.toggle('low', cf < 0.35);
    });

    const obj = world.objectiveInfo();
    const objText = obj ? obj.text : '';
    this.set('obj', objText, () => {
      e.objective.hidden = !objText;
      e.objectiveText.textContent = objText;
      e.objective.classList.remove('done');
      void e.objective.offsetWidth;
      if (this.prev.objShown) e.objective.classList.add('done');
      this.prev.objShown = true;
    });

    const inWave = world.phase === 'wave';
    const left = inWave ? world.enemiesLeft : 0;
    this.set('left', left, () => {
      e.left.hidden = !inWave;
      e.left.textContent = world.siege ? `⚔️ ${left} enemies in the field` : `⚔️ ${left} ${left === 1 ? 'enemy' : 'enemies'} left`;
    });
    // Boss bar: a named boss, or during a siege whatever stands in the way.
    const boss = world.enemies.find((x) => x.name)
      || (world.siege && (world.enemies.find((x) => x.kind === 'sgate') || world.enemies.find((x) => x.kind === 'skeep')));
    e.boss.hidden = !boss;
    if (boss) {
      e.bossName.textContent = boss.name || boss.def.name;
      e.bossFill.style.width = `${Math.max(0, boss.hp / boss.max) * 100}%`;
    }

    // Bottom controls.
    const placing = !!ctx.placing;
    const showControls = !inWave && !placing && !this.sheetOpen && world.phase === 'build';
    e.controls.hidden = !showControls;
    e.buildBtn.hidden = !showControls;
    this.set('waveBtn', `${world.wave + 1}|${world.siegeReady}`, () => {
      e.waveBtn.textContent = world.siegeReady ? '🏰 Lay Siege!' : `⚔️ Start Wave ${world.wave + 1}`;
    });
    e.waveBtn.classList.toggle('pulse', world.siegeReady || (!!obj && obj.text.startsWith('Tap Start Wave')));

    e.placeBar.hidden = !placing;
    if (placing) {
      const def = BUILDINGS[ctx.placing.type];
      const msg = ctx.placing.ok ? `${def.icon} ${def.name}: drag it into place, then tap Build here` : `${def.icon} ${ctx.placing.reason}`;
      if (msg !== this.prev.placeMsg) { e.placeText.textContent = msg; this.prev.placeMsg = msg; }
      e.placeOk.disabled = !ctx.placing.ok;
    }

    // Banner timeout.
    if (this.bannerT > 0) {
      this.bannerT -= dt;
      if (this.bannerT <= 0) e.banner.classList.remove('show');
    }

    const ld = world.hero.load;
    this.set('load', `${ld.n}|${ld.res}|${world.loadCap}`, () => {
      e.load.hidden = ld.n === 0;
      e.loadN.textContent = ld.n;
      e.loadCap.textContent = `/${world.loadCap}`;
      e.loadI.textContent = ld.res === 'stone' ? '🪨' : '🪵';
    });
    this.updateThreats(world, ctx);
    this.updatePadTip(world, ctx);
    this.updateMenu(world, dt, ctx);
    if (!e.buildSheet.hidden) this.renderBuild(world);
  }

  set(key, val, fn) {
    if (this.prev[key] === val) return;
    this.prev[key] = val;
    fn();
  }

  // ----------------------------------------------------------- menu sheet
  // A card over the nearest build pad saying what it does and what it costs.
  updatePadTip(world, ctx) {
    const el = this.el.padtip;
    const h = world.hero;
    let best = null, bd = 7;
    if (h.alive && !ctx.placing && !this.sheetOpen && ctx.view) {
      for (const b of Object.values(world.b)) {
        if (b.state !== 'site' || !world.padVisible(b)) continue;
        const d = Math.hypot(b.x - h.x, b.z - h.z) - b.size / 2;
        if (d < bd) { bd = d; best = b; }
      }
    }
    if (!best) { el.hidden = true; this.tipFor = null; return; }
    const p = ctx.view.project(best.x, 2.2, best.z - best.size / 2);
    if (p.behind) { el.hidden = true; return; }
    const tip = world.padTip(best);
    const sig = JSON.stringify([best.id, tip, world.hero.coins >= (tip.cost.gold || 0), world.res]);
    if (sig !== this.tipSig) {
      this.tipSig = sig;
      const c = tip.cost;
      const lack = (k, have) => ((c[k] || 0) > have ? 'lack' : '');
      el.innerHTML = `<b>${tip.icon} ${esc(tip.title)}</b>${esc(tip.desc)}`
        + (tip.locked ? `<div class="lock">🔒 ${esc(tip.locked)}</div>`
          : `<div class="cost">${c.gold ? `<span class="${lack('gold', world.hero.coins)}"><i class="coin"></i>${c.gold}</span>` : ''}${c.wood ? `<span class="${lack('wood', world.res.wood)}">🪵 ${c.wood}</span>` : ''}${c.stone ? `<span class="${lack('stone', world.res.stone)}">🪨 ${c.stone}</span>` : ''}</div>`);
    }
    el.style.transform = `translate(${p.x}px, ${p.y - el.offsetHeight - 12}px)`;
    el.hidden = false;
  }

  // Red arrows round the screen edge pointing at each road enemies are on.
  // An arrow hides once that group is on screen.
  updateThreats(world, ctx) {
    const box = this.el.threats;
    const list = ctx.view ? world.laneThreats() : [];
    this.threatEls = this.threatEls || {};
    const seen = new Set();
    const { w, h, project } = ctx.view || {};
    for (const th of list) {
      const p = project(th.x, 1.5, th.z);
      let x = p.x, y = p.y;
      const top = 150, bottom = h - 120, left = 30, right = w - 30;
      const onScreen = !p.behind && x > left && x < right && y > top && y < bottom;
      if (onScreen) continue;
      seen.add(th.lane);
      let el = this.threatEls[th.lane];
      if (!el) {
        el = document.createElement('div');
        el.className = 'threat';
        el.innerHTML = '<div class="arrow"></div><div class="label"></div>';
        box.appendChild(el);
        this.threatEls[th.lane] = el;
      }
      // Clamp the direction from the screen centre onto the inset rectangle.
      const cx = w / 2, cy = (top + bottom) / 2;
      let dx = x - cx, dy = y - cy;
      if (p.behind) { dx = -dx; dy = -dy; }
      const k = Math.min(Math.abs((right - cx) / (dx || 1e-6)), Math.abs((bottom - cy) / (dy || 1e-6)));
      x = cx + dx * k; y = cy + dy * k;
      el.style.transform = `translate(${x}px, ${y}px)`;
      el.firstChild.style.rotate = `${Math.atan2(dy, dx)}rad`;
      el.lastChild.textContent = `${th.name} ×${th.count}`;
      el.hidden = false;
    }
    for (const [id, el] of Object.entries(this.threatEls)) if (!seen.has(id)) el.hidden = true;
  }

  // Menus open only when a building is tapped.
  openMenu(id) {
    this.closeBuild();
    if (id !== this.menuFor) this.tab = null;
    this.menuFor = id;
    this.sig = '';
    this.sigT = 0;
    this.el.sheet.hidden = false;
  }

  updateMenu(world, dt, ctx) {
    if (!this.menuFor) return;
    if (!world.b[this.menuFor] || ctx.placing || world.phase === 'defeat') { this.closeMenu(); return; }

    this.sigT -= dt;
    if (this.sigT > 0 && this.sig) return;
    this.sigT = 0.15;
    const b = world.b[this.menuFor];
    const info = world.info(b);
    const tabs = world.menu(b);
    if (!tabs.some((g) => g.tab === this.tab)) this.tab = tabs[0].tab;
    const items = tabs.find((g) => g.tab === this.tab).items;
    const sig = JSON.stringify([info, this.tab, items.map((i) => [i.key, i.locked, i.maxed, i.owned, i.equipped, i.level, i.cost, i.assigned, i.working, i.free]), world.hero.coins, world.res]);
    if (sig === this.sig) return;
    this.sig = sig;

    this.el.sheetIcon.textContent = info.icon;
    this.el.sheetName.textContent = info.max > 1 ? `${info.name} · Lv ${info.level}` : info.name;
    this.el.sheetSub.textContent = info.desc;
    const lines = info.lines.length ? `<div class="info-lines">${info.lines.map((l) => `<span>${esc(l)}</span>`).join('')}</div>` : '';
    const tabBar = tabs.length > 1 ? `<div class="tabs">${tabs.map((g) => `<button type="button" class="tab ${g.tab === this.tab ? 'on' : ''}" data-tab="${esc(g.tab)}">${esc(TAB_ICON[g.tab] || '')} ${esc(g.tab)}</button>`).join('')}</div>` : '';
    this.el.sheetList.innerHTML = tabBar + lines + (items.length ? items.map((it) => this.row(world, it)).join('') : '<div class="row"><div class="rb"><div class="rd">Nothing to upgrade here yet.</div></div></div>');
  }

  row(world, it) {
    if (it.kind === 'workers') {
      const dots = Array.from({ length: it.slots }, (_, i) => `<i class="${i < it.working ? 'on' : i < it.assigned ? 'coming' : ''}"></i>`).join('');
      return `<div class="row workers">
        <div class="ri">${it.icon}</div>
        <div class="rb">
          <div class="rt">Workers ${it.assigned}/${it.slots} <span class="pips big">${dots}</span></div>
          <div class="rd">${esc(it.desc)}</div>
          <div class="rd free">${Math.max(0, it.free)} free villager${it.free === 1 ? '' : 's'}${it.free <= 0 ? ' · build houses for more' : ''}</div>
        </div>
        <div class="stepper">
          <button class="rbtn step ${it.assigned <= 0 ? 'off' : ''}" type="button" data-workers="${it.id}:-1">−</button>
          <button class="rbtn step ${it.assigned >= it.slots || it.free <= 0 ? 'off' : ''}" type="button" data-workers="${it.id}:1">+</button>
        </div>
      </div>`;
    }
    const gold = it.cost.gold || 0;
    const lackG = gold > world.hero.coins;
    const lackW = (it.cost.wood || 0) > world.res.wood;
    const lackS = (it.cost.stone || 0) > world.res.stone;
    const pips = it.max > 1 ? `<span class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < it.level ? 'on' : ''}"></i>`).join('')}</span>` : '';
    let btn;
    if (it.maxed) btn = '<button class="rbtn max" type="button" disabled>MAX</button>';
    else if (it.owned) btn = it.equipped ? '<button class="rbtn max" type="button" disabled>Equipped</button>' : `<button class="rbtn blue" type="button" data-key="${it.key}" data-equip="${it.key.split(':')[1]}">Equip</button>`;
    else if (it.locked) btn = `<button class="rbtn off" type="button" disabled>🔒 ${esc(it.locked)}</button>`;
    else {
      const verb = it.key.startsWith('train') ? 'Train' : it.key.startsWith('weapon') ? 'Unlock' : 'Upgrade';
      const need = lackG ? 'gold' : lackW ? 'wood' : lackS ? 'stone' : '';
      btn = `<button class="rbtn ${need ? 'off' : ''}" type="button" data-key="${it.key}">${need ? 'Need ' + need : verb}</button>`;
    }
    const cost = it.maxed || it.owned ? '' : `<div class="cost">
      ${gold ? `<span class="${lackG ? 'lack' : ''}"><i class="coin"></i>${gold}</span>` : ''}
      ${it.cost.wood ? `<span class="${lackW ? 'lack' : ''}">🪵 ${it.cost.wood}</span>` : ''}
      ${it.cost.stone ? `<span class="${lackS ? 'lack' : ''}">🪨 ${it.cost.stone}</span>` : ''}
    </div>`;
    return `<div class="row">
      <div class="ri">${it.icon}</div>
      <div class="rb">
        <div class="rt">${esc(it.title)} ${pips}</div>
        ${it.desc ? `<div class="rd">${esc(it.desc)}</div>` : ''}
        ${cost}
      </div>
      ${btn}
    </div>`;
  }

  closeMenu() {
    this.menuFor = null;
    this.el.sheet.hidden = true;
  }

  // ---------------------------------------------------------- build sheet
  openBuild() {
    this.closeMenu();
    this.el.buildSheet.hidden = false;
    this.buildSig = '';
  }

  closeBuild() { this.el.buildSheet.hidden = true; }

  renderBuild(world) {
    const cards = PLACEABLE.map((type) => {
      const t = BUILDINGS[type];
      const cost = t.levels[0].cost;
      let lock = world.lockReason({ castle: t.castle });
      const have = world.list(type).length;
      if (!lock && LIMIT[type] && have >= LIMIT[type]) lock = LIMIT[type] === 1 ? 'Already built' : `Limit ${LIMIT[type]}`;
      const costTxt = [`${cost.gold} gold`, cost.wood ? `${cost.wood} wood` : '', cost.stone ? `${cost.stone} stone` : ''].filter(Boolean).join(' · ');
      return { type, t, lock, costTxt };
    });
    const sig = JSON.stringify(cards.map((c) => [c.type, c.lock]));
    if (sig === this.buildSig) return;
    this.buildSig = sig;
    this.el.buildList.innerHTML = cards.map((c) => `
      <button class="bcard ${c.lock ? 'locked' : ''}" type="button" data-type="${c.type}" ${c.lock ? `data-lock="${esc(c.lock)}"` : ''}>
        <span class="bi">${c.t.icon}</span>
        <b>${c.t.name}</b>
        <p>${esc(c.t.desc)}</p>
        <p><b style="font-size:12px">${c.lock ? '🔒 ' + esc(c.lock) : esc(c.costTxt)}</b></p>
      </button>`).join('');
  }

  // ---------------------------------------------------------- messaging
  banner(text, sub = '', dur = 2.2) {
    this.el.banner.innerHTML = `${esc(text)}${sub ? `<small>${esc(sub)}</small>` : ''}`;
    this.el.banner.classList.add('show');
    this.bannerT = dur;
  }

  toast(text, warn = false) {
    // Don't stack the same message.
    const now = performance.now();
    if (now - (this.toastSeen.get(text) || 0) < 1800) return;
    this.toastSeen.set(text, now);
    const d = document.createElement('div');
    d.className = `toast${warn ? ' warn' : ''}`;
    d.textContent = text;
    this.el.toasts.appendChild(d);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => d.remove(), 2700);
  }

  float(pt, text, color = '#fff') {
    if (!pt || pt.behind) return;
    const d = document.createElement('div');
    d.className = 'float';
    d.style.left = `${pt.x}px`;
    d.style.top = `${pt.y}px`;
    d.style.color = color;
    d.textContent = text;
    this.el.floats.appendChild(d);
    setTimeout(() => d.remove(), 1150);
  }
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}
