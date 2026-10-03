// Boot, the game loop, and turning taps into orders.

import { World, isMilitary } from './world.js';
import { AI } from './ai.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { BUILDINGS, FACTIONS, UNITS, DIFFICULTY } from './config.js';

const $ = (id) => document.getElementById(id);
const canvas = $('game');

// ------------------------------------------------------------- settings
const SAVE_KEY = 'studwars';
const save = (() => {
  let s = {};
  try { s = JSON.parse(localStorage.getItem(SAVE_KEY)) || {}; } catch { /* private mode */ }
  return { diff: 'normal', sfx: true, music: true, wins: {}, games: 0, ...s };
})();
const persist = () => { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch { /* ignore */ } };

const renderer = new Renderer(canvas);
const pics = Renderer.portraits();
let world = null, ai = null, ui = null;
let state = 'title';
let sel = new Set();
let selBuilding = null, selEnemy = null;
let placing = null;
let alertT = 0;
let endT = 0;
let tutorial = 0;

ui = new UI(pics, onAction);
audio.setSfx(save.sfx);
audio.setMusic(save.music);

$('t-king').src = pics.kKing || '';
$('t-captain').src = pics.pCaptain || '';

// ------------------------------------------------------------- screens
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('show', s.id === id);
}

function refreshTitle() {
  for (const b of document.querySelectorAll('.diff button')) b.classList.toggle('on', b.dataset.diff === save.diff);
  const w = save.wins;
  const won = Object.keys(DIFFICULTY).filter((d) => w[d]).map((d) => `${DIFFICULTY[d].label} ✓`);
  $('best').textContent = won.length ? `Won on: ${won.join('  ')}` : '';
  for (const id of ['btn-sound', 'btn-sound2']) $(id).textContent = save.sfx ? '🔊' : '🔇';
  for (const id of ['btn-music', 'btn-music2']) { $(id).textContent = '🎵'; $(id).style.opacity = save.music ? 1 : 0.45; }
}

function newGame() {
  world = new World({ difficulty: save.diff });
  ai = new AI(world, 1);
  renderer.setWorld(world);
  ui.setWorld(world);
  sel = new Set(); selBuilding = null; selEnemy = null;
  setPlacing(null);
  tutorial = save.games ? 99 : 0;
  endT = 0;
  state = 'play';
  show(null);
  $('hud').hidden = false;
  audio.startMusic();
  ui.toast('Knock down the Pirate Fort!', '');
}

document.querySelectorAll('.diff button').forEach((b) => b.addEventListener('click', () => {
  save.diff = b.dataset.diff; persist(); refreshTitle(); audio.ui();
}));
$('btn-play').onclick = () => { audio.unlock(); audio.ui(); newGame(); };
$('btn-help').onclick = () => { audio.ui(); helpFrom = 'screen-title'; show('screen-help'); };
$('btn-pause-help').onclick = () => { audio.ui(); helpFrom = 'screen-pause'; show('screen-help'); };
let helpFrom = 'screen-title';
$('btn-help-close').onclick = () => { audio.ui(); show(helpFrom); };
const toggleSfx = () => { save.sfx = !save.sfx; audio.setSfx(save.sfx); persist(); refreshTitle(); audio.ui(); };
const toggleMusic = () => {
  save.music = !save.music; audio.setMusic(save.music); persist(); refreshTitle();
  if (save.music && state !== 'title') audio.startMusic();
};
$('btn-sound').onclick = toggleSfx; $('btn-sound2').onclick = toggleSfx;
$('btn-music').onclick = () => { audio.unlock(); toggleMusic(); };
$('btn-music2').onclick = toggleMusic;
$('b-pause').onclick = () => { if (state !== 'play') return; audio.ui(); state = 'pause'; show('screen-pause'); };
$('btn-resume').onclick = () => { audio.ui(); state = 'play'; show(null); };
$('btn-restart').onclick = () => { audio.ui(); newGame(); };
$('btn-quit').onclick = toTitle;
$('btn-menu').onclick = toTitle;
$('btn-again').onclick = () => { audio.ui(); newGame(); };

function toTitle() {
  audio.ui();
  audio.stopMusic();
  state = 'title';
  $('hud').hidden = true;
  refreshTitle();
  show('screen-title');
}

document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    if (state === 'play') { state = 'pause'; show('screen-pause'); }
    audio.suspend();
  } else audio.resume();
});
window.addEventListener('resize', () => renderer.resize());

// ------------------------------------------------------------- selection
const myUnits = () => world.units.filter((u) => u.team === 0 && !u.dead);
const selUnits = () => [...sel].map((id) => world.get(id)).filter(Boolean);

function select(units, sound = true) {
  sel = new Set(units.map((u) => u.id));
  selBuilding = null; selEnemy = null;
  if (sound && units.length) audio.select();
}

function onScreen(x, y, z) {
  const p = renderer.project(x, y, z);
  return p.x > 0 && p.y > 0 && p.x < renderer.W && p.y < renderer.H && !p.behind;
}

function pxPerUnit() {
  return renderer.H / (2 * Math.tan((renderer.camera.fov * Math.PI) / 360) * renderer.cam.zoom);
}

// What's under a screen point: a unit, a building, a resource, or ground.
function pick(px, py) {
  const ppu = pxPerUnit();
  let best = null, bd = Infinity;
  for (const u of world.units) {
    if (u.dead || (u.team !== 0 && !world.isVisible(u.x, u.z))) continue;
    const p = renderer.project(u.x, 0.7 * (u.def.r > 0.45 ? 1.4 : 1), u.z);
    const d = Math.hypot(p.x - px, p.y - py);
    const r = Math.max(22, ppu * (u.def.r + 0.45));
    if (d < r && d < bd) { bd = d; best = u; }
  }
  if (best) return { unit: best };
  const g = renderer.screenToGround(px, py);
  for (const b of world.buildings) {
    if (b.dead || (b.team !== 0 && !b.seen)) continue;
    const h = { keep: 2.5, tower: 2.0, barracks: 1.4, farm: 0.6, depot: 0.6 }[b.type];
    const p = renderer.project(b.x, h, b.z);
    if (Math.hypot(p.x - px, p.y - py) < ppu * b.size * 0.55) return { bld: b, g };
    if (g && Math.abs(g.x - b.x) <= b.size / 2 + 0.2 && Math.abs(g.z - b.z) <= b.size / 2 + 0.2) return { bld: b, g };
  }
  let rb = null, rd = Infinity;
  for (const r of world.resources) {
    if (r.dead || !world.isExplored(r.x, r.z)) continue;
    const p = renderer.project(r.x, r.type === 'tree' ? 0.9 : 0.4, r.z);
    const d = Math.hypot(p.x - px, p.y - py);
    if (d < Math.max(20, ppu * 0.6) && d < rd) { rd = d; rb = r; }
  }
  if (rb) return { res: rb, g };
  return { g };
}

function onTap(px, py) {
  if (state !== 'play') return;
  audio.unlock();
  const hit = pick(px, py);
  if (placing) {
    if (hit.g) {
      const spot = nearestSpot(placing.type, hit.g.x, hit.g.z, 2) || hit.g;
      placing.x = spot.x; placing.z = spot.z;
      updateGhost();
    }
    return;
  }
  const units = selUnits();
  const builders = units.filter((u) => u.def.role === 'builder');

  if (hit.unit) {
    const u = hit.unit;
    if (u.team === 0) { select([u]); return; }
    if (units.length) { world.cmdAttack(units, u); audio.order(); return; }
    sel = new Set(); selBuilding = null; selEnemy = u; audio.select();
    return;
  }
  if (hit.bld) {
    const b = hit.bld;
    if (b.team !== 0) {
      if (units.length) { world.cmdAttack(units, b); audio.order(); return; }
      sel = new Set(); selBuilding = null; selEnemy = b; audio.select();
      return;
    }
    if (builders.length && (!b.done || b.hp < b.maxHp)) {
      world.cmdBuild(builders, b);
      const rest = units.filter((u) => u.def.role !== 'builder');
      if (rest.length) world.cmdMove(rest, b.x, b.z + b.size, false);
      audio.order();
      return;
    }
    if (units.length && units.some(isMilitary)) {
      // Pull soldiers back home.
      world.cmdMove(units, b.x, b.z + b.size / 2 + 1.5, false);
      audio.order();
      return;
    }
    if (builders.length && b.def.deposit) {
      for (const u of builders) if (u.carry) world.setOrder(u, { type: 'gather', res: u.lastRes, phase: 'return' });
    }
    sel = new Set(); selEnemy = null; selBuilding = b; audio.select();
    return;
  }
  if (hit.res) {
    if (builders.length) {
      world.cmdGather(builders, hit.res);
      const rest = units.filter((u) => u.def.role !== 'builder');
      if (rest.length) world.cmdMove(rest, hit.res.x, hit.res.z, true);
      audio.order();
      return;
    }
    if (selBuilding && selBuilding.def.trains === 'builder') {
      selBuilding.rally = { x: hit.res.x, z: hit.res.z, res: hit.res.id };
      ui.toast('New builders will gather here');
      audio.order();
      return;
    }
  }
  if (hit.g) {
    if (units.length) {
      world.cmdMove(units, hit.g.x, hit.g.z, true);
      audio.order();
      return;
    }
    if (selBuilding && selBuilding.def.trains && selBuilding.done) {
      selBuilding.rally = { x: hit.g.x, z: hit.g.z };
      world.emit('order', { x: hit.g.x, z: hit.g.z, team: 0, kind: 'move' });
      audio.order();
      return;
    }
  }
  sel = new Set(); selBuilding = null; selEnemy = null;
}

function onDoubleTap(px, py) {
  if (state !== 'play' || placing) return onTap(px, py);
  const hit = pick(px, py);
  if (hit.unit && hit.unit.team === 0) {
    const type = hit.unit.type;
    select(myUnits().filter((u) => u.type === type && onScreen(u.x, 0.5, u.z)));
    return;
  }
  onTap(px, py);
}

// Box select.
let box = null;
const boxEl = $('box');
function drawBox() {
  const x0 = Math.min(box.x0, box.x1), y0 = Math.min(box.y0, box.y1);
  Object.assign(boxEl.style, { left: `${x0}px`, top: `${y0}px`, width: `${Math.abs(box.x1 - box.x0)}px`, height: `${Math.abs(box.y1 - box.y0)}px` });
}

const input = new Input(canvas, {
  touch: () => audio.unlock(),
  tap: (x, y) => onTap(x, y),
  doubleTap: (x, y) => onDoubleTap(x, y),
  pan: (dx, dy) => { if (state === 'play') renderer.pan(dx, dy); },
  zoom: (f, x, y) => { if (state === 'play') renderer.zoomAt(f, x, y); },
  boxStart: (x, y) => { if (state !== 'play') return; box = { x0: x, y0: y, x1: x, y1: y }; boxEl.hidden = false; drawBox(); },
  boxMove: (x, y) => { if (!box) return; box.x1 = x; box.y1 = y; drawBox(); },
  boxCancel: () => { box = null; boxEl.hidden = true; },
  boxEnd: () => {
    if (!box) return;
    boxEl.hidden = true;
    const x0 = Math.min(box.x0, box.x1), x1 = Math.max(box.x0, box.x1), y0 = Math.min(box.y0, box.y1), y1 = Math.max(box.y0, box.y1);
    box = null;
    if (x1 - x0 < 8 && y1 - y0 < 8) return;
    let got = myUnits().filter((u) => { const p = renderer.project(u.x, 0.5, u.z); return p.x >= x0 && p.x <= x1 && p.y >= y0 && p.y <= y1; });
    if (got.some(isMilitary)) got = got.filter(isMilitary);
    if (got.length) select(got);
    if (input.boxMode) { input.boxMode = false; $('q-box').classList.remove('on'); }
  },
});

// Minimap: tap or drag to look somewhere.
{
  const mm = $('minimap');
  let down = false;
  const go = (e) => {
    const r = mm.getBoundingClientRect();
    renderer.cam.x = ((e.clientX - r.left) / r.width) * world.N;
    renderer.cam.z = ((e.clientY - r.top) / r.height) * world.N + 2;
    renderer.clampCam();
  };
  mm.addEventListener('pointerdown', (e) => { e.stopPropagation(); down = true; mm.setPointerCapture(e.pointerId); go(e); });
  mm.addEventListener('pointermove', (e) => { if (down) go(e); });
  mm.addEventListener('pointerup', () => { down = false; });
  mm.addEventListener('pointercancel', () => { down = false; });
}

function centerOn(x, z) { renderer.cam.x = x; renderer.cam.z = z + 2; renderer.clampCam(); }

$('q-hero').onclick = () => {
  const h = world.teams[0].hero;
  if (!h || h.dead) { ui.toast(`The King returns in ${Math.ceil(world.teams[0].heroT)}s`); return; }
  const already = sel.size === 1 && sel.has(h.id);
  select([h]);
  if (already || !onScreen(h.x, 0.5, h.z)) centerOn(h.x, h.z);
};
let armyTap = 0;
$('q-army').onclick = () => {
  const army = myUnits().filter(isMilitary);
  if (!army.length) { ui.toast('No soldiers yet. Build Barracks!'); audio.error(); return; }
  select(army);
  const now = performance.now();
  if (now - armyTap < 400) {
    const cx = army.reduce((s, u) => s + u.x, 0) / army.length, cz = army.reduce((s, u) => s + u.z, 0) / army.length;
    centerOn(cx, cz);
  }
  armyTap = now;
};
let idleI = 0;
$('q-idle').onclick = () => {
  const idle = myUnits().filter((u) => u.def.role === 'builder' && u.order.type === 'idle');
  const list = idle.length ? idle : myUnits().filter((u) => u.def.role === 'builder');
  if (!list.length) { ui.toast('No builders. Train one at the Keep.'); audio.error(); return; }
  const u = list[idleI++ % list.length];
  select([u]);
  centerOn(u.x, u.z);
};
$('q-box').onclick = () => {
  input.boxMode = !input.boxMode;
  $('q-box').classList.toggle('on', input.boxMode);
  if (input.boxMode) ui.toast('Drag a box around your units');
};

// ------------------------------------------------------------- actions
function onAction(a, v) {
  audio.ui();
  const team = world.teams[0];
  if (a === 'build') {
    const def = BUILDINGS[v];
    if (team.bricks < def.cost) { ui.toast(`Need ${def.cost} bricks for a ${FACTIONS[team.faction].names[v]}`, 'bad'); ui.flashBricks(); audio.error(); return; }
    const c = renderer.screenToGround(renderer.W / 2, renderer.H * 0.42) || { x: renderer.cam.x, z: renderer.cam.z };
    const spot = nearestSpot(v, c.x, c.z, 10) || c;
    setPlacing({ type: v, x: spot.x, z: spot.z, builders: selUnits().filter((u) => u.def.role === 'builder').map((u) => u.id) });
  } else if (a === 'train') {
    if (!selBuilding) return;
    const err = world.train(selBuilding, v);
    if (err) { ui.toast(err, 'bad'); if (err.startsWith('Need')) ui.flashBricks(); audio.error(); }
  } else if (a === 'cancel') {
    if (selBuilding) world.cancelTrain(selBuilding, +v);
  } else if (a === 'special') {
    const h = selUnits().find((u) => u.def.role === 'hero');
    if (!h) return;
    if (h.specialT > 0) { ui.toast(`Ready in ${Math.ceil(h.specialT)}s`); return; }
    if (!world.useSpecial(h)) { ui.toast('No enemies close enough'); audio.error(); }
  } else if (a === 'stop') {
    for (const u of selUnits()) world.setOrder(u, { type: 'idle' });
  }
  ui.sig = '';
}

// The closest open spot for a building near (x, z).
function nearestSpot(type, x, z, maxR = 6) {
  let best = null, bd = Infinity;
  for (let dz = -maxR; dz <= maxR; dz++) for (let dx = -maxR; dx <= maxR; dx++) {
    const d = Math.hypot(dx, dz);
    if (d > maxR || d >= bd) continue;
    if (world.canPlace(0, type, x + dx, z + dz).ok) { bd = d; best = { x: x + dx, z: z + dz }; }
  }
  return best;
}

function setPlacing(p) {
  placing = p;
  $('placebar').hidden = !p;
  $('quick').hidden = !!p;
  updateGhost();
}

function updateGhost() {
  if (!placing) { renderer.setGhost(null); return; }
  const p = world.canPlace(0, placing.type, placing.x, placing.z);
  placing.ok = p.ok; placing.why = p.why;
  renderer.setGhost(placing.type, world.teams[0].faction, p.x, p.z, p.ok);
  const name = FACTIONS[world.teams[0].faction].names[placing.type];
  $('place-text').textContent = p.ok ? `${name}: tap to move it, then Build` : p.why;
  $('place-ok').disabled = !p.ok;
}

$('place-ok').onclick = () => {
  if (!placing) return;
  const builders = placing.builders.map((id) => world.get(id)).filter(Boolean);
  const r = world.placeBuilding(0, placing.type, placing.x, placing.z, builders);
  if (r.err) { ui.toast(r.err, 'bad'); audio.error(); return; }
  if (!builders.length) ui.toast('Select builders and tap it to build');
  setPlacing(null);
};
$('place-no').onclick = () => { audio.ui(); setPlacing(null); };

// ------------------------------------------------------------- events
function handleEvents(events) {
  for (const ev of events) {
    const vis = ev.x !== undefined && (ev.team === 0 || world.isVisible(ev.x, ev.z)) && onScreen(ev.x, 0.5, ev.z);
    switch (ev.type) {
      case 'hit': if (vis && ev.melee) audio.sword(); break;
      case 'shoot': if (vis) (ev.kind === 'arrow' ? audio.arrow() : audio.shot()); break;
      case 'boom': if (onScreen(ev.x, 0, ev.z)) audio.boom(); break;
      case 'die':
        if (vis) audio.die();
        break;
      case 'collapse': {
        if (onScreen(ev.x, 0, ev.z) || ev.team === 0) audio.collapse();
        const name = FACTIONS[world.teams[ev.team].faction].names[ev.type];
        if (ev.team === 0) ui.toast(`Your ${name} was destroyed!`, 'bad');
        else ui.toast(`Smashed the ${name}!`, 'good');
        break;
      }
      case 'chop': if (ev.team === 0 && vis) audio.chop(ev.kind); break;
      case 'hammer': if (vis) audio.hammer(); break;
      case 'deposit':
        if (ev.team === 0 && vis) {
          const p = renderer.project(ev.x, 1.8, ev.z);
          ui.float(p.x, p.y, `+${ev.amt}`, 'brick');
          audio.deposit();
        }
        break;
      case 'stud': {
        const p = renderer.project(ev.x, 0.8, ev.z);
        ui.float(p.x, p.y, `+${ev.value}`, 'stud');
        audio.stud(ev.kind);
        break;
      }
      case 'built':
        if (ev.team === 0) { audio.built(); ui.toast(`${FACTIONS[world.teams[0].faction].names[ev.type]} is ready!`, 'good'); }
        break;
      case 'trained': if (ev.team === 0) audio.trained(); break;
      case 'place': if (ev.team === 0) audio.place(); break;
      case 'rally': if (ev.team === 0 || vis) audio.rally(); break;
      case 'broadside': audio.broadside(); if (ev.team === 1) ui.toast('Broadside! Cannonballs incoming!', 'bad'); break;
      case 'attacked':
        if (!onScreen(ev.x, 0.5, ev.z) && world.time - alertT > 8) {
          alertT = world.time;
          ui.toast(ev.kind === 'bld' ? 'Your base is under attack!' : 'Your units are under attack!', 'bad');
          ui.ping(ev.x, ev.z);
          audio.alarm();
        }
        break;
      case 'heroDown':
        if (ev.team === 0) ui.toast('King Bramwell has fallen! He\'ll be back soon.', 'bad');
        else ui.toast('Captain Saltbeard is down!', 'good');
        break;
      case 'heroBack':
        if (ev.team === 0) ui.toast('The King is back!', 'good');
        break;
      case 'over':
        endT = 2.2;
        break;
    }
  }
}

function finish() {
  const r = world.over;
  const win = r === 'victory';
  const s = world.teams[0].stats;
  state = 'end';
  audio.stopMusic();
  win ? audio.win() : audio.lose();
  save.games++;
  if (win) save.wins[world.difficulty] = true;
  persist();
  $('end-crest').textContent = win ? '🏆' : '💥';
  $('end-title').textContent = win ? 'Victory!' : 'Defeat';
  $('end-text').textContent = win ? 'The Pirate Fort is rubble. The kingdom is safe!' : 'The pirates knocked down your Keep.';
  const mm = Math.floor(world.time / 60), ss = String(Math.floor(world.time % 60)).padStart(2, '0');
  $('end-stats').innerHTML = [
    ['Time', `${mm}:${ss}`], ['Studs collected', world.teams[0].studs.toLocaleString()], ['Bricks gathered', s.bricks],
    ['Units trained', s.trained], ['Enemies defeated', s.kills], ['Buildings smashed', s.razed], ['Units lost', s.lost],
  ].map(([a, b]) => `<span>${a}</span><b>${b}</b>`).join('');
  show('screen-end');
}

// ------------------------------------------------------------- tutorial
function objective() {
  if (!world) return;
  const team = world.teams[0];
  const mine = myUnits();
  const has = (t) => world.buildings.some((b) => b.team === 0 && b.type === t);
  if (tutorial < 99) {
    const steps = [
      [() => selUnits().some((u) => u.def.role === 'builder') || mine.some((u) => u.order.type === 'gather'), 'Tap one of your <b>builders</b> by the Keep.'],
      [() => mine.some((u) => u.order.type === 'gather'), 'Now tap a <b>tree</b> or a <b>brick pile</b> to gather bricks.'],
      [() => has('farm'), `Select a builder and build a <b>Farm</b> (100 bricks) so your army can grow.`],
      [() => has('barracks'), 'Build <b>Barracks</b> (150 bricks) to train soldiers.'],
      [() => mine.filter(isMilitary).length >= 4, 'Tap the Barracks and train <b>soldiers</b>. Get 3 or more.'],
      [() => world.time > 400 || team.stats.razed > 0, 'Tap <b>Army</b>, then tap the <b>Pirate Fort</b> (top right) to attack. Use the King\'s <b>Rally</b>!'],
    ];
    while (tutorial < steps.length && steps[tutorial][0]()) tutorial++;
    if (tutorial >= steps.length) tutorial = 99;
    else { ui.objective(steps[tutorial][1]); return; }
  }
  ui.objective(null);
}

// ------------------------------------------------------------- loop
let last = performance.now();
let objT = 0;
function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (!world) { renderer.resize(); return; }
  let events = [];
  if (state === 'play') {
    const steps = dt > 0.034 ? 2 : 1;
    for (let i = 0; i < steps; i++) {
      world.update(dt / steps);
      ai.update(dt / steps);
    }
    events = world.events;
    world.events = [];
    handleEvents(events);
    // Keep the selection tidy.
    for (const id of sel) if (!world.get(id)) sel.delete(id);
    if (selBuilding && selBuilding.dead) selBuilding = null;
    if (selEnemy && (selEnemy.dead || (selEnemy.kind === 'unit' && !world.isVisible(selEnemy.x, selEnemy.z)))) selEnemy = null;
    if (placing && Math.floor(now / 250) !== placing.tick) { placing.tick = Math.floor(now / 250); updateGhost(); }
    if ((objT -= dt) <= 0) { objT = 0.4; objective(); }
    if (endT > 0 && (endT -= dt) <= 0) finish();
  }
  renderer.frame(state === 'play' ? dt : state === 'end' ? dt : 0, { events, sel, selBuilding: selBuilding || selEnemy, hover: 0 });
  if (state === 'play' || state === 'end') ui.update(dt, { sel, selBuilding, selEnemy }, renderer);
}

// A battle in the background of the title screen.
function titleScene() {
  world = new World({ difficulty: 'normal' });
  ai = new AI(world, 1);
  renderer.setWorld(world);
  ui.setWorld(world);
  renderer.cam.x = world.N / 2; renderer.cam.z = world.N / 2 + 4; renderer.cam.zoom = 30;
}

refreshTitle();
titleScene();
requestAnimationFrame(loop);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For testing from the console.
window.__sw = { get world() { return world; }, get ai() { return ai; }, renderer, get sel() { return sel; }, select, onTap, newGame, UNITS };
