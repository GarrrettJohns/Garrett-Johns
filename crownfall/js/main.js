// Boot, the game loop, and the flow between title, play, pause and defeat.

import { World, snapToGrid } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { BUILDINGS, HERO_UPGRADES, levelInfo } from './config.js';
import { CASTLE_R, FOREST_Z, inHighland } from './map.js';

const $ = (id) => document.getElementById(id);
const stage = $('stage');
const canvas = $('game');

const renderer = new Renderer(canvas);
const input = new Input(stage, $('joy'), $('joy-knob'));

let world = save.kingdom ? safeLoad(save.kingdom) : new World();
let state = 'title';
let placing = null;
let saveT = 0;
let dirty = false;
let pickStreak = 0;
let pickT = 0;
let lostAt = 0;
const hintGather = {};

// The closest grid spot to (x, z) where a building of this type fits.
function nearestSpot(type, x, z) {
  const R = world.wallRadius;
  let best = null, bd = Infinity;
  for (let gx = -R; gx <= R; gx += 2) for (let gz = -R; gz <= R; gz += 2) {
    const p = snapToGrid(type, gx, gz);
    const d = Math.hypot(p.x - x, p.z - z);
    if (d < bd && world.canPlace(type, p.x, p.z).ok) { bd = d; best = p; }
  }
  return best || snapToGrid(type, x, z);
}

function safeLoad(snap) {
  try { return new World(snap); } catch (err) { console.warn('Save could not be loaded', err); return new World(); }
}

// ------------------------------------------------------------------- UI
const ui = new UI({
  tap: () => audio.tap(),
  deny: (msg) => { audio.deny(); ui.toast(msg, true); },
  onPause: () => { audio.tap(); pause(); },
  onStartWave: () => {
    if (world.phase !== 'build') return;
    persist();
    placing = null;
    ui.closeMenu();
    ui.closeBuild();
    world.startWave();
  },
  onPickBuild: (type) => {
    placing = { type, x: 0, z: 0, ok: false, reason: '' };
    // Start at the nearest open spot to the middle of the view; drag to move it.
    const c = renderer.groundAt(renderer.w / 2, renderer.h * 0.42);
    const spot = nearestSpot(type, c.x, c.z);
    placing.x = spot.x; placing.z = spot.z;
  },
  onPlaceOk: () => {
    if (!placing || !placing.ok) { audio.deny(); return; }
    const b = world.place(placing.type, placing.x, placing.z);
    if (b) { audio.buy(); ui.toast(`Stand on the pad to pay for the ${BUILDINGS[b.type].name}`); dirty = true; }
    placing = null;
  },
  onPlaceCancel: () => { audio.tap(); placing = null; },
  onFund: (key, bid) => {
    // All or nothing: world.fund refuses (and says what's missing) unless the
    // king has every coin, log and stone it costs.
    const it = world.item(key);
    const paid = world.fund(key);
    const b = world.b[bid];
    if (paid && b && it.cost.gold) world.emit('spend', { n: it.cost.gold, x: b.x, z: b.z });
    dirty = true;
  },
  onEquip: (w) => { world.equip(w); audio.buy(); dirty = true; },
});

// --------------------------------------------------------------- screens
function show(id) {
  for (const s of document.querySelectorAll('.screen')) s.classList.toggle('on', s.id === id);
}

function refreshTitle() {
  const k = save.kingdom;
  const btn = $('btn-continue');
  btn.hidden = !k;
  if (k) btn.textContent = `Continue · Level ${k.level || 1} · Wave ${k.wave + 1}`;
  $('btn-new').className = k ? 'btn ghost' : 'btn primary';
  const standalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;
  $('install-tip').hidden = standalone || !/iPhone|iPad|iPod/.test(navigator.userAgent);
  syncSoundChips();
}

function syncSoundChips() {
  for (const c of document.querySelectorAll('.js-sound')) c.textContent = save.settings.sound ? '🔊 Sound on' : '🔈 Sound off';
}

function play() {
  state = 'play';
  show(null);
  input.enabled = true;
}

function pause() {
  if (state !== 'play') return;
  state = 'paused';
  input.release();
  persist();
  show('screen-pause');
}

function toTitle() {
  persist();
  state = 'title';
  placing = null;
  ui.closeMenu();
  ui.closeBuild();
  if (world.phase !== 'build') world = save.kingdom ? safeLoad(save.kingdom) : new World();
  renderer.reset();
  refreshTitle();
  show('screen-title');
}

function newGame() {
  save.clearKingdom();
  world = new World();
  renderer.reset();
  placing = null;
  persist();
  play();
  ui.banner('Crownfall', 'Build your kingdom, then march on the enemy stronghold', 2.8);
}

$('btn-continue').addEventListener('click', () => {
  audio.unlock(); audio.tap();
  world = safeLoad(save.kingdom);
  renderer.reset();
  play();
  ui.banner(`${world.levelInfo.name} · Wave ${world.wave + 1}`, 'Welcome back, your majesty', 2);
});
$('btn-new').addEventListener('click', () => {
  audio.unlock(); audio.tap();
  if (save.kingdom) show('screen-confirm');
  else newGame();
});
$('btn-confirm-yes').addEventListener('click', () => { audio.tap(); newGame(); });
$('btn-confirm-no').addEventListener('click', () => { audio.tap(); refreshTitle(); show('screen-title'); });
let howtoBack = 'screen-title';
$('btn-howto').addEventListener('click', () => { audio.unlock(); audio.tap(); howtoBack = 'screen-title'; show('screen-howto'); });
$('btn-howto2').addEventListener('click', () => { audio.tap(); howtoBack = 'screen-pause'; show('screen-howto'); });
$('btn-howto-back').addEventListener('click', () => { audio.tap(); show(howtoBack); });
$('btn-resume').addEventListener('click', () => { audio.tap(); play(); });

// ------------------------------------------------------------ dev tools
// Jump between levels and battles for testing. Reached from the pause menu.
const MAX_LEVELS = 4;

// What a king who has fought his way to level n might carry.
function devCarry(n) {
  const up = {};
  for (const [k, u] of Object.entries(HERO_UPGRADES)) up[k] = Math.min(u.values.length - 1, (n - 1) * 2);
  const weapons = { bow: true };
  if (n >= 2) weapons.crossbow = true;
  if (n >= 3) { weapons.fire = true; weapons.multi = true; }
  const army = [];
  for (let i = 0; i < (n - 1) * 3; i++) army.push(i % 3 === 2 ? 'knight' : 'archer');
  return { up, weapons, weapon: n >= 3 ? 'multi' : n >= 2 ? 'crossbow' : 'bow', armor: Math.min(3, n - 1), army, coins: 250 };
}

// Stop any battle in progress and return to the build phase.
function devCalm() {
  world.enemies = [];
  world.spawnQueue = [];
  world.projectiles = [];
  world.siege = false;
  world.sgGate = world.sgKeep = null;
  if (world.phase !== 'won') world.phase = 'build';
  world.castleHp = world.castleMax;
  for (const g of Object.values(world.gates)) g.hp = g.max;
  if (!world.hero.alive) { world.hero.alive = true; world.hero.hp = world.heroMaxHp; world.hero.x = 0; world.hero.z = 8; }
  lostAt = 0;
}

const DEV = {
  level(n) {
    world = new World(null, { level: n, carry: devCarry(n) });
    renderer.reset();
    return `Level ${n}: ${world.levelInfo.name}`;
  },
  wave(n) {
    devCalm();
    world.wave = n - 1;
    world.hero.coins = Math.max(world.hero.coins, 200);
    return `Ready for wave ${n} — tap Start Wave`;
  },
  siege() {
    devCalm();
    world.wave = Math.max(world.wave, 15);
    DEV.outposts();
    return 'Siege Camp built — tap Lay Siege!';
  },
  outposts() {
    world.wave = Math.max(world.wave, 14);
    for (const id of ['outpost-1', 'outpost-2', 'outpost-3']) if (!world.built(id)) world.finishBuilding(world.b[id]);
    return 'All outposts claimed';
  },
  gold() { world.hero.coins += 500; return '+500 gold'; },
  mats() { world.res.wood += 300; world.res.stone += 300; return '+300 wood and stone'; },
  king() {
    const h = world.hero;
    for (const [k, u] of Object.entries(HERO_UPGRADES)) h.up[k] = u.values.length - 1;
    h.weapons = { bow: true, crossbow: true, fire: true, multi: true };
    h.hp = world.heroMaxHp;
    return 'The king is maxed out';
  },
  army() {
    for (let i = 0; i < 6; i++) world.addSoldier(['knight', 'archer', 'raider'][i % 3], (i % 3) * 1.5 - 1.5, CASTLE_R + 2 + Math.floor(i / 3));
    return '+6 soldiers';
  },
  castle() {
    const c = world.b.castle;
    c.level = Math.max(c.level, 2);
    world.castleHp = world.castleMax;
    world.walls.level = Math.max(world.walls.level, 2);
    world.rebuildGates();
    return 'Castle Lv 3, walls fully expanded';
  },
  win() { devCalm(); world.winLevel(); return null; },
  lose() {
    if (world.phase !== 'wave') return 'Start a wave first';
    world.hurtHero(1e9);
    return null;
  },
};

function devRun(cmd) {
  const [name, arg] = cmd.split(':');
  const msg = DEV[name](arg !== undefined ? Number(arg) : undefined);
  placing = null;
  ui.closeMenu();
  ui.closeBuild();
  play();
  if (world.phase === 'build') persist();
  if (msg) ui.banner('🛠 Dev', msg, 2.2);
}

$('dev-levels').innerHTML = Array.from({ length: MAX_LEVELS }, (_, i) => `<button class="chip" data-dev="level:${i + 1}">${i + 1} · ${levelInfo(i + 1).name}</button>`).join('');
$('btn-dev').addEventListener('click', () => {
  audio.tap();
  for (const b of document.querySelectorAll('#dev-levels .chip')) b.classList.toggle('on', b.dataset.dev === `level:${world.level}`);
  show('screen-dev');
});
$('btn-dev-back').addEventListener('click', () => { audio.tap(); show('screen-pause'); });
$('screen-dev').addEventListener('click', (e) => {
  const b = e.target.closest('[data-dev]');
  if (!b) return;
  audio.tap();
  devRun(b.dataset.dev);
});
$('btn-quit').addEventListener('click', () => { audio.tap(); toTitle(); });
$('btn-retry').addEventListener('click', () => {
  audio.tap();
  world = safeLoad(save.kingdom);
  renderer.reset();
  play();
  ui.banner(`Wave ${world.wave + 1}`, 'Shore up the defences and try again', 2.4);
});
$('btn-over-menu').addEventListener('click', () => { audio.tap(); world = safeLoad(save.kingdom); toTitle(); });
// On to the next level: a new land, with the king's upgrades and army.
$('btn-endless').addEventListener('click', () => {
  audio.tap();
  const carry = world.carryOver();
  world = new World(null, { level: world.level + 1, carry });
  renderer.reset();
  placing = null;
  play();
  persist();
  ui.banner(world.levelInfo.name, `Level ${world.level}: build anew and march on the stronghold`, 3);
});
for (const c of document.querySelectorAll('.js-sound')) {
  c.addEventListener('click', () => {
    audio.unlock();
    save.setSetting('sound', !save.settings.sound);
    audio.setEnabled(save.settings.sound);
    syncSoundChips();
    audio.tap();
  });
}
audio.setEnabled(save.settings.sound);
input.onFirstTouch = () => audio.unlock();
// Tap a building to open its menu; tap open ground to close it.
input.onDrag = (x, y) => {
  if (!placing) return;
  // Hold the building a little above the finger so it stays in view.
  const g = renderer.groundAt(x, y - 50);
  const p = snapToGrid(placing.type, g.x, g.z);
  placing.x = p.x; placing.z = p.z;
};
input.onTap = (x, y) => {
  if (state !== 'play' || placing) return;
  const b = renderer.pick(x, y, world);
  if (b) { audio.tap(); ui.openMenu(b.id); }
  else ui.closeMenu();
};
$('btn-recenter').addEventListener('click', () => { audio.tap(); renderer.recenter(); });
window.addEventListener('pointerdown', () => audio.unlock(), { once: true });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) { pause(); audio.suspend(); }
  else audio.resume();
});
window.addEventListener('pagehide', () => persist());

function persist() {
  if (world && world.phase === 'build' && state !== 'title') save.saveKingdom(world.snapshot());
  dirty = false;
  saveT = 0;
}

// ---------------------------------------------------------------- events
function handle(ev, events = []) {
  renderer.onEvent(ev, world);
  const at = (x, y, z) => renderer.project(x, y, z);
  switch (ev.type) {
    case 'shoot':
      if (ev.from === 'hero') audio.shoot();
      else if (ev.from === 'tower') audio.towerShot();
      break;
    case 'hit': audio.hit(); break;
    case 'kill': audio.kill(); break;
    case 'pickup':
      pickStreak = pickT > 0 ? pickStreak + 1 : 0;
      pickT = 0.6;
      audio.pickup(pickStreak);
      break;
    case 'spend': audio.spend(); break;
    case 'built':
      audio.build();
      ui.float(at(ev.x, 4, ev.z), `${BUILDINGS[ev.type].icon} Built!`, '#fff27a');
      dirty = true;
      break;
    case 'upgraded':
      audio.build();
      ui.float(at(ev.x, 4, ev.z), '⬆️ Upgraded!', '#9cff9c');
      dirty = true;
      break;
    case 'bought':
      if (!ev.key.startsWith('build') && !ev.key.startsWith('up:')) { audio.buy(); ui.toast(`${ev.title} ✓`); }
      dirty = true;
      break;
    case 'need': audio.deny(); ui.toast(ev.text, true); break;
    case 'toast': ui.toast(ev.text); break;
    case 'deliver':
      audio.deliver();
      ui.float(at(ev.x, 2.4, ev.z), `+${ev.amt} ${ev.res === 'wood' ? '🪵' : '🪨'}`, '#fff');
      break;
    case 'gather':
      audio.chop(ev.res);
      ui.float(at(ev.x, 4.5, ev.z), `+1 ${ev.res === 'wood' ? '🪵' : '🪨'} (${ev.n}/${ev.cap})`, '#fff');
      if (ev.n === 1 && !hintGather[ev.res]) {
        hintGather[ev.res] = true;
        ui.toast(`The king ${ev.res === 'wood' ? 'chops wood' : 'mines stone'}! Carry it to the castle to bank it.`);
      }
      break;
    case 'villager':
      audio.villager();
      ui.float(at(ev.x, 3, ev.z), '+1 👤', '#bff3ff');
      break;
    case 'trained': audio.buy(); ui.float(at(ev.x, 2.6, ev.z), '⚔️ Ready!', '#bff3ff'); break;
    case 'waveStart': {
      audio.horn();
      const extra = ev.fresh.length ? `New attack from the ${ev.fresh.join(' & ')}!` : `${ev.total} enemies approach`;
      if (ev.siege) ui.banner('The Siege begins!', 'Ride south, break the gate, bring down the keep', 3);
      else ui.banner(`Wave ${ev.n}`, ev.boss ? `${ev.boss} leads the attack!` : extra, 2.4);
      if (ev.fresh.length && ev.boss) ui.toast(extra, true);
      break;
    }
    case 'boss': ui.toast(`${ev.name} has arrived!`, true); break;
    case 'waveClear':
      audio.waveClear();
      ui.banner(`Wave ${ev.n} cleared!`, `+${ev.bonus} gold at the castle`, 2.4);
      if (ev.n >= 2 && !world.count('barracks')) setTimeout(() => ui.toast('Build Barracks (🔨) to raise an army!'), 2600);
      // Save once the bonus is on the ground.
      setTimeout(persist, 0);
      break;
    case 'levelWon': {
      audio.victory();
      const next = levelInfo(ev.level + 1);
      ui.banner('Victory!', 'The stronghold has fallen', 3);
      setTimeout(() => {
        $('win-title').textContent = `Level ${ev.level} complete!`;
        $('win-text').textContent = `The enemy stronghold has fallen. Your king and his army march on to ${next.name}, where a new kingdom must be built.`;
        $('btn-endless').textContent = `March on to ${next.name} →`;
        state = 'win';
        show('screen-win');
      }, 2200);
      break;
    }
    case 'gateFallen': audio.crash(); ui.banner('The gate is down!', 'Storm the keep — its warlord rides out', 2.6); break;
    case 'blocked': ui.toast('Break the stronghold gate first!', true); break;
    case 'outpost':
      audio.victory();
      ui.banner(`${ev.name} claimed!`, ev.last ? 'The stronghold is in sight. Start the next battle to lay siege!' : 'New land to the south is yours', 3);
      dirty = true;
      break;
    case 'heroHurt': audio.hurt(); break;
    case 'heroDown':
      audio.crash();
      if (!events.some((e) => e.type === 'waveLost')) ui.banner('The king has fallen!', 'He will ride again in a moment', 2.4);
      placing = null;
      break;
    case 'waveLost':
      audio.defeat();
      ui.banner('The king has fallen!', ev.siege ? 'The siege is lost. Regroup and try again.' : `Wave ${ev.wave} is lost. Regroup and fight it again.`, 3.2);
      input.release();
      // When he rides again, it's back to just before the wave.
      lostAt = performance.now() + 3400;
      break;
    case 'heroUp': ui.toast('The king rides again!'); break;
    case 'gateHit': audio.gate(); break;
    case 'gateBroken': audio.crash(); ui.toast('A gate has been broken!', true); break;
    case 'castleHit': if (world.castleHp < world.castleMax * 0.3) ui.toast('The castle is under attack!', true); break;
    case 'slam': audio.slam(); break;
    case 'defeat':
      audio.defeat();
      state = 'over';
      input.release();
      $('over-text').textContent = world.siege
        ? 'The enemy broke through while the king was away. Your kingdom is saved from before the siege.'
        : `Wave ${ev.wave} broke through. Your kingdom is saved from before the wave.`;
      setTimeout(() => show('screen-over'), 900);
      break;
    case 'objective': if (ev.text) audio.villager(); break;
    case 'walls': dirty = true; break;
    default: break;
  }
}

// ------------------------------------------------------------------ loop
function resize() {
  const r = stage.getBoundingClientRect();
  renderer.resize(Math.max(1, r.width), Math.max(1, r.height));
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 200));
resize();

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  pickT -= dt;

  if (lostAt && now >= lostAt) {
    lostAt = 0;
    {
      world = safeLoad(save.kingdom);
      renderer.reset();
      placing = null;
      ui.closeMenu();
      ui.banner(`Wave ${world.wave + 1}`, 'Shore up your defences, then start the wave again', 2.6);
      audio.horn();
    }
  }
  if (state === 'play') {
    if (placing && world.phase !== 'build') placing = null;
    input.dragMode = !!placing;
    world.update(dt, placing ? { x: 0, z: 0 } : input.read());
    if (placing) {
      const chk = world.canPlace(placing.type, placing.x, placing.z);
      placing.ok = chk.ok;
      placing.reason = chk.reason || '';
    }
    // First time in the forest or the highland: tell the player the king can gather.
    const h = world.hero;
    if (h.alive && h.z < FOREST_Z && !hintGather.forest) { hintGather.forest = true; ui.toast('🪓 Stand still by the trees and the king chops wood himself'); }
    if (h.alive && inHighland(h.x, h.z) && !hintGather.highland) { hintGather.highland = true; ui.toast('⛏️ Stand still by boulders and the king mines stone'); }
    if (world.phase === 'build') {
      saveT += dt;
      if ((dirty && saveT > 1.5) || saveT > 10) persist();
    }
  }
  if (document.body.dataset.state !== state) document.body.dataset.state = state;
  const events = world.events;
  world.events = [];
  for (const ev of events) handle(ev, events);

  ui.update(world, dt, { placing, view: { w: renderer.w, h: renderer.h, project: (x, y, z) => renderer.project(x, y, z) } });
  renderer.zoom = input.zoom;
  const pan = input.takePan();
  if (state === 'play') renderer.panBy(pan.x, pan.y);
  renderer.setBiome(world.levelInfo.biome);
  $('btn-recenter').hidden = !renderer.free || state !== 'play';

  // Point the trail at the objective, or at a tower's range while its menu is open.
  const obj = state === 'play' && !placing ? world.objectiveInfo() : null;
  const menuB = ui.menuFor ? world.b[ui.menuFor] : null;
  const rangeOf = menuB && menuB.type === 'tower' ? { x: menuB.x, z: menuB.z, r: BUILDINGS.tower.levels[menuB.level].range } : null;
  renderer.frame(dt, world, { trail: obj && obj.target, placing, rangeOf, sheetOpen: ui.sheetOpen });
  requestAnimationFrame(frame);
}

refreshTitle();
show('screen-title');
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

// For automated testing.
window.__crownfall = { get world() { return world; }, renderer, input, ui, get state() { return state; }, newGame, persist };
