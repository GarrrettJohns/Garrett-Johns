// DOM overlay: HUD, objective, banners, toasts, floating labels, the building
// menu that opens when the king rides up to something, and the build picker.

import { BUILDINGS } from './config.js';

const $ = (id) => document.getElementById(id);
const PLACEABLE = ['house', 'warehouse', 'farm', 'barracks', 'blacksmith'];
const LIMIT = { barracks: 4, blacksmith: 1 };
const TAB_ICON = { King: '👑', Army: '⚔️', Castle: '🏰', Defence: '🛡️', Bow: '🏹', Style: '✨', Weapons: '⚔️', Iron: '⚙️' };

export class UI {
  constructor(h) {
    this.h = h;
    this.el = {
      coins: $('hud-coins'), cap: $('hud-cap'), wood: $('hud-wood'), stone: $('hud-stone'), iron: $('hud-iron'), ironPill: $('hud-iron-pill'), pop: $('hud-pop'), beds: $('hud-beds'),
      wave: $('hud-wave'), castle: $('hud-castle'), objective: $('objective'), objectiveText: $('objective-text'),
      boss: $('boss-bar'), bossName: $('boss-name'), bossFill: $('boss-fill'), left: $('enemies-left'),
      banner: $('banner'), toasts: $('toasts'), floats: $('floats'),
      waveBtn: $('btn-wave'), buildBtn: $('btn-build'), controls: $('controls'),
      sheet: $('sheet'), sheetIcon: $('sheet-icon'), sheetName: $('sheet-name'), sheetSub: $('sheet-sub'), sheetList: $('sheet-list'),
      buildSheet: $('build-sheet'), buildList: $('build-list'),
      placeBar: $('place-bar'), placeText: $('place-text'), placeOk: $('btn-place-ok'), threats: $('threats'),
      bank: $('hud-bank'), bankN: $('hud-bank-n'), follow: $('btn-follow'), orders: $('orders'), guards: $('guards'),
      tip: $('tip'), tipTitle: $('tip-title'), tipText: $('tip-text'),
      rates: $('rates'), ratesTitle: $('rates-title'), ratesBody: $('rates-body'),
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
    this.el.follow.addEventListener('click', () => { h.tap(); this.el.orders.hidden = !this.el.orders.hidden; });
    this.el.orders.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-order]');
      if (!b) return;
      this.el.orders.hidden = true;
      h.onOrder(b.dataset.order);
    });
    $('tip-ok').addEventListener('click', () => { h.tap(); this.el.tip.hidden = true; });
    // Tap a resource in the HUD for where it comes from, per minute.
    for (const pill of document.querySelectorAll('.pill[data-res]')) {
      pill.addEventListener('click', () => {
        h.tap();
        const res = pill.dataset.res;
        this.ratesFor = this.ratesFor === res && !this.el.rates.hidden ? null : res;
        this.el.rates.hidden = !this.ratesFor;
        this.ratesT = 0;
      });
    }
    $('rates-close').addEventListener('click', () => { h.tap(); this.ratesFor = null; this.el.rates.hidden = true; });

    this.el.sheetList.addEventListener('click', (e) => {
      const st = e.target.closest('button[data-station]');
      if (st) { const [lane, d] = st.dataset.station.split(':'); h.onStation(lane, Number(d)); this.sig = ''; this.sigT = 0; return; }
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
    const bank = world.res.gold || 0;
    this.set('bank', bank, () => { e.bank.hidden = !bank; e.bankN.textContent = bank; bump(e.bank); });
    this.set('wood', world.res.wood, () => { e.wood.textContent = world.res.wood; bump(e.wood.parentElement); });
    this.set('stone', world.res.stone, () => { e.stone.textContent = world.res.stone; bump(e.stone.parentElement); });
    // Iron shows up once the Iron Hills are in reach.
    const showIron = world.res.iron > 0 || world.padVisible(world.b['ironmine-1']);
    this.set('iron', `${world.res.iron}|${showIron}`, () => { e.ironPill.hidden = !showIron; e.iron.textContent = world.res.iron; if (world.res.iron) bump(e.ironPill); });
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

    // Tutorial prompts step aside while a wave is on.
    const obj = world.objectiveInfo();
    const objText = obj && world.phase !== 'wave' ? obj.text : '';
    this.set('obj', objText, () => {
      e.objective.hidden = !objText;
      e.objectiveText.textContent = objText;
      e.objective.classList.remove('done');
      void e.objective.offsetWidth;
      if (this.prev.objShown) e.objective.classList.add('done');
      this.prev.objShown = true;
    });

    const inWave = world.phase === 'wave';
    // 🚩 Follow me: shown once there are soldiers out in the field.
    const field = world.allies.length;
    const order = world.order || 'posts';
    this.set('follow', `${field > 0 || order !== 'posts'}|${order}|${!!ctx.placing}`, () => {
      const show = (field > 0 || order !== 'posts') && !ctx.placing;
      e.follow.hidden = !show;
      if (!show) e.orders.hidden = true;
      e.follow.classList.toggle('on', order === 'follow');
      e.follow.classList.toggle('march', order === 'march');
      e.follow.innerHTML = { posts: '<span>🏰</span><small>Posts</small>', follow: '<span>🚩</span><small>Following</small>', march: '<span>⚔️</span><small>Marching</small>' }[order];
      for (const b of e.orders.querySelectorAll('button')) b.classList.toggle('on', b.dataset.order === order);
    });
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
      e.loadI.textContent = ld.res === 'stone' ? '🪨' : ld.res === 'iron' ? '⚙️' : '🪵';
    });
    this.updateThreats(world, ctx);
    this.updateRates(world, dt);
    this.updateGuards(world, ctx);
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
    const sig = JSON.stringify([best.id, tip, world.gold >= (tip.cost.gold || 0), world.res]);
    if (sig !== this.tipSig) {
      this.tipSig = sig;
      const c = tip.cost;
      const lack = (k, have) => ((c[k] || 0) > have ? 'lack' : '');
      el.innerHTML = `<b>${tip.icon} ${esc(tip.title)}</b>${esc(tip.desc)}`
        + (tip.locked ? `<div class="lock">🔒 ${esc(tip.locked)}</div>`
          : `<div class="cost">${c.gold ? `<span class="${lack('gold', world.gold)}"><i class="coin"></i>${c.gold}</span>` : ''}${c.wood ? `<span class="${lack('wood', world.res.wood)}">🪵 ${c.wood}</span>` : ''}${c.stone ? `<span class="${lack('stone', world.res.stone)}">🪨 ${c.stone}</span>` : ''}${c.iron ? `<span class="${lack('iron', world.res.iron)}">⚙️ ${c.iron}</span>` : ''}</div>`);
    }
    el.style.transform = `translate(${p.x}px, ${p.y - el.offsetHeight - 12}px)`;
    el.hidden = false;
  }

  // Red arrows round the screen edge pointing at each road enemies are on.
  // An arrow hides once that group is on screen.
  updateThreats(world, ctx) {
    const box = this.el.threats;
    const list = ctx.view ? world.laneThreats() : [];
    // Point at the Mountain Fort until it falls, so the east is easy to find.
    if (ctx.view && world.phase !== 'wave') {
      const fort = world.enemies.find((e) => e.fort && e.kind === 'fgate' && e.hp > 0);
      if (fort) list.push({ lane: 'fort', x: fort.x, z: fort.z, label: '⛰ Mountain Fort', landmark: true });
      // And at the next place on the Greenwood journey.
      const next = world.nextEncounter();
      if (next) list.push({ lane: 'journey', x: next.at.x, z: next.at.z, label: `${next.icon} ${next.at.name}`, landmark: true });
    }
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
        el.className = th.landmark ? 'threat landmark' : 'threat';
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
      el.lastChild.textContent = th.label || `${th.name} ×${th.count}`;
      // Keep the label on screen at the left and right edges.
      el.lastChild.style.transform = x > w - 90 ? 'translate(calc(-100% + 22px), 0)' : x < 90 ? 'translate(-22px, 0)' : '';
      el.hidden = false;
    }
    for (const [id, el] of Object.entries(this.threatEls)) if (!seen.has(id)) el.hidden = true;
  }

  // A tag over each road gate that has soldiers on guard.
  updateGuards(world, ctx) {
    const box = this.el.guards;
    this.guardEls = this.guardEls || {};
    for (const lane of ['S', 'E', 'W', 'N']) {
      let el = this.guardEls[lane];
      const n = world.allies.filter((a) => a.station === lane).length;
      const g = world.gates[lane];
      const p = n && g && ctx.view ? ctx.view.project(g.x, 4.2, g.z) : null;
      const on = p && !p.behind && p.x > -40 && p.x < ctx.view.w + 40 && p.y > 0 && p.y < ctx.view.h;
      if (!on) { if (el) el.hidden = true; continue; }
      if (!el) { el = document.createElement('div'); el.className = 'guard-tag'; box.appendChild(el); this.guardEls[lane] = el; }
      const txt = `🛡️ ${n} on guard`;
      if (el.textContent !== txt) el.textContent = txt;
      el.style.left = `${p.x}px`; el.style.top = `${p.y}px`;
      el.hidden = false;
    }
  }

  updateRates(world, dt) {
    if (!this.ratesFor) return;
    this.ratesT -= dt;
    if (this.ratesT > 0) return;
    this.ratesT = 1;
    const r = world.rates(this.ratesFor);
    const NAME = { gold: ['🪙', 'Gold'], wood: ['🪵', 'Wood'], stone: ['🪨', 'Stone'], iron: ['⚙️', 'Iron'] }[r.res];
    this.el.ratesTitle.textContent = `${NAME[0]} ${NAME[1]}`;
    const row = (x) => `<div class="row"><span class="ic">${x.icon}</span><span class="nm">${esc(x.name)}${x.workers ? ` <span class="wk">${x.workers}</span>` : ''}</span><span class="v">${x.perMin}/min</span></div>`;
    const stored = r.res === 'gold' ? `${world.hero.coins} on your horse · ${world.res.gold || 0} banked` : `${world.res[r.res]} in your stores`;
    let html = `<div class="total">${r.total}<small> /min</small></div><p class="sub">${stored} · last ${r.span}s</p>`;
    html += '<h4>Made by</h4>' + (r.rows.length ? r.rows.map(row).join('') : `<div class="empty">Nothing yet. ${r.res === 'gold' ? 'Fallen enemies drop coins; the Gold Mine is in the eastern mountains.' : r.res === 'wood' ? 'Build a Lumber Camp in the forest, or let the king chop trees.' : 'Take the Mountain Fort, then build a Quarry or let the king break boulders.'}</div>`);
    if (r.res !== 'gold' || r.homeRows.length) {
      html += `<h4>Brought home</h4>` + (r.homeRows.length ? r.homeRows.map(row).join('') : '<div class="empty">Nothing brought home yet.</div>');
    }
    if (r.waiting) html += `<p class="sub">${r.waiting} waiting at ${r.res === 'gold' ? 'the mines' : r.res === 'wood' ? 'lumber camps' : 'quarries'}</p>`;
    if (r.advice) html += `<div class="advice">💡 ${esc(r.advice.text)}</div>`;
    this.el.ratesBody.innerHTML = html;
  }

  setCamLabel(cs) {
    const sig = `${cs.override}|${cs.mode}`;
    if (sig === this.camSig) return;
    this.camSig = sig;
    const el = $('btn-cam');
    const icon = { kingdom: '🏰', adventure: '🐎', combat: '⚔️' }[cs.mode];
    el.innerHTML = `<span>${icon}</span><small>${cs.override === 'auto' ? 'Auto' : 'Fixed'}</small>`;
    el.setAttribute('aria-label', `Camera: ${cs.mode}, ${cs.override === 'auto' ? 'automatic' : 'fixed'}. Tap to change.`);
  }

  // A tutorial card that explains a new idea, with a Got it button.
  showTip(title, html) {
    this.el.tipTitle.textContent = title;
    this.el.tipText.innerHTML = html;
    this.el.tip.hidden = false;
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
    const sig = JSON.stringify([info, this.tab, items.map((i) => [i.key, i.locked, i.maxed, i.owned, i.equipped, i.level, i.cost, i.assigned, i.working, i.free, i.on, i.want, i.desc]), world.gold, world.res]);
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
    if (it.kind === 'station') {
      return `<div class="row workers station ${it.rating}">
        <div class="ri">${it.icon}</div>
        <div class="rb">
          <div class="rt">${esc(it.title)} · ${it.on} on guard</div>
          <div class="rd">${esc(it.desc)}</div>
          <div class="rd free">${it.free} soldier${it.free === 1 ? '' : 's'} free in the field</div>
        </div>
        <div class="stepper">
          <button class="rbtn step ${it.want <= 0 ? 'off' : ''}" type="button" data-station="${it.lane}:-1">−</button>
          <button class="rbtn step ${it.free <= 0 ? 'off' : ''}" type="button" data-station="${it.lane}:1">+</button>
        </div>
      </div>`;
    }
    if (it.kind === 'workers') {
      const dots = Array.from({ length: it.slots }, (_, i) => `<i class="${i < it.working ? 'on' : i < it.assigned ? 'coming' : ''}"></i>`).join('');
      return `<div class="row workers">
        <div class="ri">${it.swatch !== undefined ? `<span class="swatch" style="background:${it.swatch == null ? 'transparent' : '#' + it.swatch.toString(16).padStart(6, '0')}">${it.swatch == null ? '∅' : ''}</span>` : it.icon}</div>
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
    const lackG = gold > world.gold;
    const lackW = (it.cost.wood || 0) > world.res.wood;
    const lackS = (it.cost.stone || 0) > world.res.stone;
    const lackI = (it.cost.iron || 0) > world.res.iron;
    const pips = it.max > 1 ? `<span class="pips">${Array.from({ length: it.max }, (_, i) => `<i class="${i < it.level ? 'on' : ''}"></i>`).join('')}</span>` : '';
    let btn;
    if (it.maxed) btn = '<button class="rbtn max" type="button" disabled>MAX</button>';
    else if (it.owned) btn = it.equipped ? '<button class="rbtn max" type="button" disabled>Equipped</button>' : `<button class="rbtn blue" type="button" data-key="${it.key}" data-equip="${it.equipKey || it.key}">Equip</button>`;
    else if (it.locked) btn = `<button class="rbtn off" type="button" disabled>🔒 ${esc(it.locked)}</button>`;
    else {
      const verb = it.key.startsWith('train') ? 'Train' : it.key.startsWith('style') ? 'Buy' : it.forge ? 'Forge' : it.key.startsWith('weapon') ? 'Unlock' : 'Upgrade';
      const need = lackG ? 'gold' : lackW ? 'wood' : lackS ? 'stone' : lackI ? 'iron' : '';
      btn = `<button class="rbtn ${need ? 'off' : ''}" type="button" data-key="${it.key}">${need ? 'Need ' + need : verb}</button>`;
    }
    const cost = it.maxed || it.owned ? '' : `<div class="cost">
      ${gold ? `<span class="${lackG ? 'lack' : ''}"><i class="coin"></i>${gold}</span>` : ''}
      ${it.cost.wood ? `<span class="${lackW ? 'lack' : ''}">🪵 ${it.cost.wood}</span>` : ''}
      ${it.cost.stone ? `<span class="${lackS ? 'lack' : ''}">🪨 ${it.cost.stone}</span>` : ''}
      ${it.cost.iron ? `<span class="${lackI ? 'lack' : ''}">⚙️ ${it.cost.iron}</span>` : ''}
    </div>`;
    return `<div class="row">
      <div class="ri">${it.swatch !== undefined ? `<span class="swatch" style="background:${it.swatch == null ? 'transparent' : '#' + it.swatch.toString(16).padStart(6, '0')}">${it.swatch == null ? '∅' : ''}</span>` : it.icon}</div>
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
      if (!lock && type === 'blacksmith' && !world.built('ironmine-1')) lock = 'Needs the Iron Mine';
      const have = world.list(type).length;
      if (!lock && LIMIT[type] && have >= LIMIT[type]) lock = LIMIT[type] === 1 ? 'Already built' : `Limit ${LIMIT[type]}`;
      const costTxt = [`${cost.gold} gold`, cost.wood ? `${cost.wood} wood` : '', cost.stone ? `${cost.stone} stone` : '', cost.iron ? `${cost.iron} iron` : ''].filter(Boolean).join(' · ');
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

  // Notifications sit at the top under the objective and stay for 15 seconds
  // or until tapped away. A repeat of one already showing just restarts it.
  toast(text, warn = false) {
    const box = this.el.toasts;
    for (const d of box.children) {
      if (d.dataset.text === text && !d.classList.contains('out')) { this.armToast(d); return; }
    }
    const d = document.createElement('div');
    d.className = `toast${warn ? ' warn' : ''}`;
    d.dataset.text = text;
    const span = document.createElement('span');
    span.textContent = text;
    const x = document.createElement('button');
    x.type = 'button';
    x.setAttribute('aria-label', 'Dismiss');
    x.textContent = '✕';
    x.addEventListener('click', (e) => { e.stopPropagation(); this.dropToast(d); });
    d.append(span, x);
    box.appendChild(d);
    this.armToast(d);
    const live = [...box.children].filter((c) => !c.classList.contains('out'));
    while (live.length > 4) this.dropToast(live.shift());
  }

  armToast(d) {
    clearTimeout(d._t);
    d._t = setTimeout(() => this.dropToast(d), 15000);
  }

  dropToast(d) {
    if (!d || d.classList.contains('out')) return;
    clearTimeout(d._t);
    d.classList.add('out');
    setTimeout(() => d.remove(), 320);
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
