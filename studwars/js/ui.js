// The overlay: selection panel and its action buttons, minimap, toasts and
// floating numbers. It reads the world and calls back into main for actions.

import { UNITS, BUILDINGS, BUILD_ORDER, FACTIONS } from './config.js';
import { isMilitary } from './world.js';

const $ = (id) => document.getElementById(id);
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export class UI {
  constructor(pics, act) {
    this.pics = pics;
    this.act = act;
    this.sig = '';
    this.panelT = 0;
    this.miniT = 0;
    this.pings = [];
    this.el = {
      bricks: $('h-bricks'), pop: $('h-pop'), cap: $('h-cap'), studs: $('h-studs'), time: $('h-time'),
      card: $('sel-card'), actions: $('actions'), panel: $('panel'), toasts: $('toasts'), floats: $('floats'),
      objective: $('objective'), mini: $('minimap'), heroBtn: $('q-hero'), idleBtn: $('q-idle'),
    };
    this.mctx = this.el.mini.getContext('2d');
    this.el.actions.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b) this.act(b.dataset.a, b.dataset.v);
    });
    this.el.card.addEventListener('click', (e) => {
      const b = e.target.closest('[data-a]');
      if (b) this.act(b.dataset.a, b.dataset.v);
    });
    new ResizeObserver(() => document.documentElement.style.setProperty('--panel-h', `${this.el.panel.offsetHeight}px`)).observe(this.el.panel);
  }

  pic(key, emoji = '❔') {
    const src = this.pics[key];
    return src ? `<img src="${src}" alt="">` : `<span class="em">${emoji}</span>`;
  }

  setWorld(w) {
    this.w = w;
    this.sig = '';
    this.pings = [];
    // Minimap terrain, drawn once.
    const N = w.N;
    const cv = document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const img = g.createImageData(N, N);
    for (let k = 0; k < N * N; k++) {
      const t = w.map.terrain[k];
      const c = t === 1 ? [58, 142, 224] : t === 2 ? [230, 207, 143] : [92, 174, 62];
      img.data.set([...c, 255], k * 4);
    }
    g.putImageData(img, 0, 0);
    this.terrainCv = cv;
    this.fogCv = document.createElement('canvas');
    this.fogCv.width = this.fogCv.height = N;
    this.fogImg = this.fogCv.getContext('2d').createImageData(N, N);
    const F = FACTIONS[w.teams[0].faction];
    $('q-hero').querySelector('img').src = this.pics[F.hero] || '';
    $('q-army').querySelector('img').src = this.pics[F.army[0]] || '';
    $('q-idle').querySelector('img').src = this.pics[F.builder] || '';
  }

  toast(text, kind = '') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`;
    t.textContent = text;
    this.el.toasts.appendChild(t);
    while (this.el.toasts.children.length > 3) this.el.toasts.firstChild.remove();
    setTimeout(() => t.remove(), 2500);
  }

  float(x, y, text, kind) {
    const f = document.createElement('div');
    f.className = `float ${kind || ''}`;
    f.textContent = text;
    f.style.left = `${x}px`; f.style.top = `${y}px`;
    this.el.floats.appendChild(f);
    setTimeout(() => f.remove(), 1000);
  }

  ping(x, z) { this.pings.push({ x, z, t: 0 }); }

  flashBricks() {
    const p = this.el.bricks.parentElement;
    p.classList.remove('flash'); void p.offsetWidth; p.classList.add('flash');
  }

  objective(html) {
    if (!html) { this.el.objective.hidden = true; return; }
    this.el.objective.hidden = false;
    if (this.el.objective.innerHTML !== html) this.el.objective.innerHTML = html;
  }

  // ------------------------------------------------------------- per frame
  update(dt, view, cam) {
    const w = this.w;
    const team = w.teams[0];
    this.el.bricks.textContent = Math.floor(team.bricks);
    this.el.pop.textContent = team.pop;
    this.el.cap.textContent = team.popCap;
    this.el.studs.textContent = team.studs.toLocaleString();
    this.el.time.textContent = fmtTime(w.time);

    // Hero button.
    const cd = this.el.heroBtn.querySelector('.cd');
    if (!team.hero || team.hero.dead) { cd.hidden = false; cd.textContent = Math.ceil(Math.max(0, team.heroT)); }
    else if (team.hero.specialT > 0) { cd.hidden = true; }
    else cd.hidden = true;
    const idle = w.units.filter((u) => u.team === 0 && u.def.role === 'builder' && u.order.type === 'idle').length;
    const cnt = this.el.idleBtn.querySelector('.count');
    cnt.hidden = !idle; cnt.textContent = idle;

    this.panelT -= dt;
    if (this.panelT <= 0) { this.panelT = 0.2; this.panel(view); }
    this.miniT -= dt;
    if (this.miniT <= 0) { this.miniT = 0.1; this.minimap(view, cam); }
    for (const p of this.pings) p.t += dt;
    this.pings = this.pings.filter((p) => p.t < 3);
  }

  panel(view) {
    const w = this.w, team = w.teams[0];
    const F = FACTIONS[team.faction];
    const units = [...view.sel].map((id) => w.get(id)).filter(Boolean);
    const b = view.selBuilding && !view.selBuilding.dead ? view.selBuilding : null;
    const foe = view.selEnemy && !view.selEnemy.dead ? view.selEnemy : null;

    let sig, card = '', acts = '';
    if (units.length) {
      const hero = units.find((u) => u.def.role === 'hero');
      const builders = units.some((u) => u.def.role === 'builder');
      sig = `u|${units.map((u) => u.id).join(',')}|${builders}|${hero ? Math.ceil(Math.max(0, hero.specialT)) : ''}|${BUILD_ORDER.map((t) => team.bricks >= BUILDINGS[t].cost).join('')}`;
      if (sig !== this.sig) {
        const lead = hero || units[0];
        const single = units.length === 1;
        card = `<div class="por">${this.pic(lead.type, lead.def.icon)}${single ? '' : `<span class="n">${units.length}</span>`}</div>
          <div class="txt"><div class="nm">${single ? lead.def.name : `${units.length} units`}</div>
          ${single ? `<div class="hp"><span data-hp="${lead.id}" style="width:${(lead.hp / lead.maxHp) * 100}%"></span></div><div class="st" data-st="${lead.id}">${this.status(lead)}</div>`
            : `<div class="mix">${units.slice(0, 14).map((u) => this.pic(u.type, u.def.icon)).join('')}</div>`}</div>`;
        if (builders) {
          for (const t of BUILD_ORDER) {
            const d = BUILDINGS[t];
            acts += `<button class="act ${team.bricks < d.cost ? 'poor' : ''}" data-a="build" data-v="${t}" type="button">${this.pic(`${team.faction}:${t}`, d.icon)}<span class="cost">${d.cost}</span></button>`;
          }
        }
        if (hero) {
          const c = Math.ceil(Math.max(0, hero.specialT));
          acts += `<button class="act blue" data-a="special" type="button"><span class="em">${hero.def.specialIcon}</span><span class="lbl">${hero.def.specialName}</span>${c > 0 ? `<span class="cd">${c}</span>` : ''}</button>`;
        }
        if (units.some(isMilitary)) acts += `<button class="act grey" data-a="stop" type="button"><span class="em">✋</span><span class="lbl">Hold</span></button>`;
      }
    } else if (b && b.team === 0) {
      const d = b.def;
      const trains = d.trains === 'builder' ? [F.builder] : d.trains === 'army' ? F.army : [];
      sig = `b|${b.id}|${b.done}|${b.queue.join(',')}|${trains.map((t) => team.bricks >= UNITS[t].cost).join('')}`;
      if (sig !== this.sig) {
        card = `<div class="por">${this.pic(`${b.faction}:${b.type}`, d.icon)}</div>
          <div class="txt"><div class="nm">${F.names[b.type]}</div>
          <div class="hp"><span data-hp="${b.id}" style="width:${(b.hp / b.maxHp) * 100}%"></span></div>
          <div class="st" data-st="${b.id}">${this.bstatus(b)}</div>
          ${b.queue.length ? `<div class="queue">${b.queue.map((q, i) => `<button data-a="cancel" data-v="${i}" type="button">${this.pic(q, UNITS[q].icon)}${i === 0 ? '<i data-prog></i>' : ''}</button>`).join('')}</div>` : ''}</div>`;
        if (b.done) {
          for (const t of trains) {
            const u = UNITS[t];
            acts += `<button class="act ${team.bricks < u.cost ? 'poor' : ''}" data-a="train" data-v="${t}" type="button">${this.pic(t, u.icon)}<span class="cost">${u.cost}</span></button>`;
          }
        }
        if (!trains.length || !b.done) acts += `<div class="hint">${b.done ? d.blurb : 'Under construction. Select builders and tap it to help.'}</div>`;
      }
    } else if (foe) {
      sig = `e|${foe.id}`;
      if (sig !== this.sig) {
        const isB = foe.kind === 'bld';
        const name = isB ? FACTIONS[foe.faction].names[foe.type] : foe.def.name;
        card = `<div class="por">${this.pic(isB ? `${foe.faction}:${foe.type}` : foe.type, '☠️')}</div>
          <div class="txt"><div class="nm">${name}</div><div class="hp enemy"><span data-hp="${foe.id}" style="width:${(foe.hp / foe.maxHp) * 100}%"></span></div>
          <div class="st">Enemy</div></div>`;
        acts = `<div class="hint">Select your soldiers, then tap this to attack it.</div>`;
      }
    } else {
      sig = 'none';
      if (sig !== this.sig) {
        acts = `<div class="hint">Tap a unit to select it. Double-tap to pick all of that kind. Long-press and drag to box a group. Tap a building to train.</div>`;
      }
    }
    if (sig !== this.sig) {
      this.sig = sig;
      this.el.card.innerHTML = card;
      this.el.actions.innerHTML = acts;
    }
    // Live bits.
    for (const el of this.el.card.querySelectorAll('[data-hp]')) {
      const e = w.ents.get(+el.dataset.hp);
      if (e) el.style.width = `${(e.hp / e.maxHp) * 100}%`;
    }
    for (const el of this.el.card.querySelectorAll('[data-st]')) {
      const e = w.ents.get(+el.dataset.st);
      if (e) el.textContent = e.kind === 'bld' ? this.bstatus(e) : this.status(e);
    }
    const prog = this.el.card.querySelector('[data-prog]');
    if (prog && b && b.queue.length) prog.style.width = `${(b.prodT / UNITS[b.queue[0]].time) * 100}%`;
  }

  status(u) {
    const o = u.order;
    const busy = u.engage && this.w.get(u.engage);
    if (busy && o.type !== 'gather' && o.type !== 'build') return 'Fighting!';
    switch (o.type) {
      case 'gather': return o.phase === 'return' ? `Carrying ${u.carry} bricks` : o.phase === 'work' ? (u.carryKind === 'ore' || (this.w.get(o.res) || {}).type === 'ore' ? 'Mining bricks' : 'Chopping a tree') : 'Off to gather';
      case 'build': { const b = this.w.get(o.bld); return b && b.done ? 'Repairing' : 'Building'; }
      case 'move': return 'Moving';
      case 'amove': return 'Marching';
      case 'attack': return 'Attacking';
      default: return u.def.role === 'hero' && u.specialT > 0 ? `${u.def.specialName} ready in ${Math.ceil(u.specialT)}s` : 'Ready';
    }
  }

  bstatus(b) {
    if (!b.done) return `Building… ${Math.floor(b.built * 100)}%`;
    if (b.queue.length) return `Training ${UNITS[b.queue[0]].name}`;
    if (b.def.pop) return `${Math.ceil(b.hp)} / ${b.maxHp} · feeds ${b.def.pop}`;
    return `${Math.ceil(b.hp)} / ${b.maxHp}`;
  }

  // ------------------------------------------------------------- minimap
  minimap(view, cam) {
    const w = this.w, N = w.N, g = this.mctx;
    const S = this.el.mini.width, k = S / N;
    g.imageSmoothingEnabled = false;
    g.drawImage(this.terrainCv, 0, 0, S, S);
    const d = this.fogImg.data;
    for (let i = 0; i < N * N; i++) {
      d[i * 4 + 3] = w.vis[i] ? 0 : w.explored[i] ? 110 : 235;
      d[i * 4] = 12; d[i * 4 + 1] = 18; d[i * 4 + 2] = 36;
    }
    this.fogCv.getContext('2d').putImageData(this.fogImg, 0, 0);
    g.drawImage(this.fogCv, 0, 0, S, S);
    for (const r of w.resources) {
      if (r.type !== 'ore' || !w.explored[w.idx(r.i, r.j)]) continue;
      g.fillStyle = '#ffd23a';
      g.fillRect(r.i * k, r.j * k, k * 1.4, k * 1.4);
    }
    for (const b of w.buildings) {
      if (b.team !== 0 && !b.seen) continue;
      g.fillStyle = b.team === 0 ? '#3a7cff' : '#ff3a2a';
      g.fillRect(b.i0 * k, b.j0 * k, b.size * k, b.size * k);
      g.strokeStyle = '#000'; g.lineWidth = 1;
      g.strokeRect(b.i0 * k + 0.5, b.j0 * k + 0.5, b.size * k - 1, b.size * k - 1);
    }
    for (const u of w.units) {
      if (u.team !== 0 && !w.isVisible(u.x, u.z)) continue;
      g.fillStyle = view.sel.has(u.id) ? '#9dff8a' : u.team === 0 ? '#bfe0ff' : '#ff8a7a';
      const s = u.def.role === 'hero' ? 4 : 2.6;
      g.fillRect(u.x * k - s / 2, u.z * k - s / 2, s, s);
    }
    for (const p of this.pings) {
      g.strokeStyle = `rgba(255,60,40,${1 - p.t / 3})`;
      g.lineWidth = 2;
      g.beginPath(); g.arc(p.x * k, p.z * k, 4 + (p.t % 1) * 10, 0, Math.PI * 2); g.stroke();
    }
    const q = cam.viewQuad();
    g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath();
    q.forEach((p, i) => (i ? g.lineTo(p.x * k, p.z * k) : g.moveTo(p.x * k, p.z * k)));
    g.closePath(); g.stroke();
  }
}
