// Boot, the game loop, and the flow between title, play, pause and defeat.

import { World, snapToGrid } from './world.js';
import { Renderer } from './render.js';
import { Input } from './input.js';
import { UI } from './ui.js';
import { audio } from './audio.js';
import { save } from './save.js';
import { BUILDINGS, HERO_UPGRADES, WALLS, levelInfo } from './config.js';
import { CASTLE_R, FOREST_Z, FORT, inHighland } from './map.js';
import { rand } from './util.js';

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
  let best = null, bd = Infinity;
  // The castle grounds and every claimed outpost's land.
  for (const zn of world.buildZones()) {
    for (let gx = zn.x - zn.h; gx <= zn.x + zn.h; gx += 2) for (let gz = zn.z - zn.h; gz <= zn.z + zn.h; gz += 2) {
      const p = snapToGrid(type, gx, gz);
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd && world.canPlace(type, p.x, p.z).ok) { bd = d; best = p; }
    }
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
  onWorkers: (id, d) => { world.setWorkers(id, d); audio.tap(); dirty = true; },
  onFollow: () => { audio.tap(); world.setRally(!world.rally); dirty = true; },
});

// Tutorial cards: shown once each, when the guide first reaches them.
const TIPS = {
  house: ['🏠 Why build houses?', `
    <p>Every person in your kingdom needs a bed. Houses add beds, and free beds draw new families who move in over time.</p>
    <ul>
      <li><b>Villagers work.</b> Tap a lumber camp, quarry, mine, farm or warehouse and use 👷 + to put them to work: chopping wood, cutting stone, digging gold and hauling it home.</li>
      <li><b>Soldiers are villagers too.</b> Each one you train at the Barracks needs a free villager.</li>
    </ul>
    <p>More houses → more people → faster resources and a bigger army.</p>`],
  archer: ['🏹 What archers do', `
    <p>A trained archer walks to the nearest tower with a free post and climbs in. Every archer posted in a tower adds its own arrows, so the tower kills enemies much faster.</p>
    <p>With no free post, archers guard a gate on the busiest road.</p>
    <p>Want them with you instead? Tap <b>🚩 Follow me</b>, or tap a tower and <b>Call an archer</b> down.</p>`],
  fortprep: ['⛰ Getting ready for the Mountain Fort', `
    <p>The fort's two towers outshoot a starting bow and hit hard. Before you attack:</p>
    <ul>
      <li>Raise <b>Arrow damage</b> and <b>Fire rate</b> at the Castle.</li>
      <li>Give your horse more <b>health</b> and your bow more <b>range</b>.</li>
      <li>Bring a few <b>soldiers</b> with 🚩 Follow me.</li>
    </ul>
    <p>Then hit the towers, back off out of range to heal, and go again.</p>`],
  castle: ['🏰 Why upgrade the castle?', () => {
    const un = world.castleUnlocks(world.b.castle.level + 2);
    return `
    <p>The castle is the heart of the kingdom: if it falls, so does everything. Each level makes it tougher and opens up new things to build and buy.</p>
    <p><b>Castle Lv ${world.b.castle.level + 2} unlocks:</b></p>
    <ul>${un.map((u) => `<li>${u}</li>`).join('')}</ul>
    <p>Enemy waves keep growing. Without this, your towers and gates stop at their gold tiers and you can't cut stone, so the next waves will break through.</p>`;
  }],
  smith: ['🛠️ The Blacksmith', `
    <p>The king's own forge. Build one inside the walls (🔨 Build) and tap it:</p>
    <ul>
      <li><b>🏹 Bow</b>: forge his <b>Royal Bow</b> into ever grander bows that hit harder, and choose its finish and the gem in its grip.</li>
      <li><b>✨ Style</b>: pick a bowstring and the trail his arrows leave.</li>
      <li><b>⚔️ Weapons</b>: forge the Crossbow, Fire arrows, Multishot and the Storm Bow. Switch between them at the castle or any outpost.</li>
      <li><b>⚙️ Iron</b>: once you mine iron, iron tools and arrowheads.</li>
    </ul>`],
  army: ['⚔️ Raising an army', `
    <p>Only <b>one Barracks</b> fits inside the castle walls. Every outpost's land can hold <b>one more</b>, and each Barracks you build and upgrade lets you field more soldiers.</p>
    <ul>
      <li>Soldiers are villagers who enlist, so build <b>Houses</b> on the outpost land too.</li>
      <li>Train troops at any outpost's Army tab once it has Barracks.</li>
    </ul>`],
  siege: ['🏰 The enemy stronghold', `
    <p>The stronghold is held by a <b>garrison of elite troops</b>, towers, a massive gate and keep, and fresh troops pour out every few seconds. The king cannot take it alone.</p>
    <ul>
      <li>Muster at least <b>65 soldiers</b>: that takes fully upgraded Barracks at the castle <b>and every outpost</b>, with Houses to fill them.</li>
      <li>Columns of troops <b>keep pouring out of the gate</b> and march up the road, wrecking every tower, catapult and outpost they reach. Hold the road.</li>
      <li>Tap 🚩 Follow me so they march with you, and keep the king behind the line.</li>
      <li>Leave your home towers and gates strong: the enemy still attacks the castle while you're away.</li>
    </ul>`],
  catapult: ['☄️ Catapults', `
    <p>Your stone builds a new kind of defence. A catapult hurls a boulder into the <b>thickest pack of enemies</b> it can reach, hurting everyone in the blast.</p>
    <ul>
      <li>Long range, but slow, and it can't hit anything right beside it: pair it with towers.</li>
      <li>Upgrade it to a Heavy Catapult, then a <b>Trebuchet</b> once you have iron.</li>
    </ul>`],
  outpostland: ['⛺ New land', `
    <p>Every outpost you claim brings <b>the land around it</b> under your rule. The flags mark its edges.</p>
    <ul>
      <li>Tap 🔨 Build and drag houses, farms, warehouses or workshops onto it, just like inside the castle walls.</li>
      <li>Two more <b>tower</b> spots and a <b>catapult</b> spot appear beside the road there, to hold it.</li>
    </ul>`],
  iron: ['⚙️ Iron', `
    <p>Past the Riverford Outpost lie the <b>Iron Hills</b>: dark, rust-streaked rocks full of ore.</p>
    <ul>
      <li>Build the <b>Iron Mine</b> and add miners. Warehouse haulers bring the ore home, or the king can break the rocks himself with his pickaxe.</li>
      <li>Then build a <b>Blacksmith</b> (🔨) to forge iron tools for the king and your workers, and iron arrowheads for every bow.</li>
      <li>Iron also turns a catapult into a Trebuchet.</li>
    </ul>`],
  follow: ['🚩 Follow me', `
    <p>Tap it and every soldier in the field rides with you: knights fight at your side, archers shoot whatever comes near, raiders charge.</p>
    <p>Tap it again to send them back to their posts. At a tower, use <b>Call an archer</b> to bring posted archers along one at a time.</p>`],
};
function checkTip() {
  if (state !== 'play' || world.phase !== 'build' || placing || ui.sheetOpen) return;
  const o = world.objectiveInfo();
  if (!o || !o.tip) return;
  const seen = save.settings.tips || [];
  if (seen.includes(o.tip)) return;
  save.setSetting('tips', [...seen, o.tip]);
  const [title, html] = TIPS[o.tip];
  ui.showTip(title, typeof html === 'function' ? html() : html);
}

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
  // Show where the mountains are: a fly-over to the Mountain Fort and back.
  setTimeout(() => {
    if (state !== 'play' || world.wave > 0) return;
    renderer.flyTo(FORT.x + 8, FORT.z, 4);
    ui.toast('⛰ Stone and gold lie in the eastern mountains. Take the Mountain Fort to open them.');
  }, 3000);
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

// ---- Dev build-up: a kingdom as an average player would have it by a given
// point. Stages are cumulative and only ever add (nothing already built is
// torn down), so jumping ahead from a real game keeps what you made.
const STAGES = ['start', 'w4', 'w5', 'w8', 'w10', 'siege'];
function devBuild(stage) {
  devCalm();
  const w = world;
  const at = (s) => STAGES.indexOf(stage) >= STAGES.indexOf(s);
  const pad = (id, level = 0) => {
    const b = w.b[id];
    if (!b) return null;
    if (b.state !== 'built') w.finishBuilding(b);
    b.level = Math.max(b.level, Math.min(level, BUILDINGS[b.type].levels.length - 1));
    return b;
  };
  // Put a building on open ground in an area (castle grounds or an outpost).
  const zoneOf = (id) => w.buildZones().find((z) => (id ? z.id === id : z.castle));
  const have = (type, zone) => w.list(type).filter((b) => Math.abs(b.x - zone.x) <= zone.h && Math.abs(b.z - zone.z) <= zone.h);
  const place = (type, n, zoneId = null, level = 0) => {
    const zone = zoneOf(zoneId);
    if (!zone) return;
    for (let k = have(type, zone).length; k < n; k++) {
      let best = null, bd = Infinity;
      for (let gx = zone.x - zone.h; gx <= zone.x + zone.h; gx += 2) for (let gz = zone.z - zone.h; gz <= zone.z + zone.h; gz += 2) {
        const p = snapToGrid(type, gx, gz);
        const d = Math.hypot(p.x - zone.x, p.z - zone.z + 3) + Math.random() * 0.01;
        if (d < bd && w.canPlace(type, p.x, p.z).ok) { bd = d; best = p; }
      }
      if (!best) return;
      const b = w.place(type, best.x, best.z);
      if (b) w.finishBuilding(b);
    }
    for (const b of have(type, zone)) { if (b.state !== 'built') w.finishBuilding(b); b.level = Math.max(b.level, level); }
  };
  const king = (up, extra = {}) => {
    const h = w.hero;
    for (const [k, v] of Object.entries(up)) h.up[k] = Math.max(h.up[k], Math.min(v, HERO_UPGRADES[k].values.length - 1));
    for (const wp of extra.weapons || []) h.weapons[wp] = true;
    if (extra.bow) h.bow = Math.max(h.bow || 0, extra.bow);
    if (extra.weapon) h.weapon = extra.weapon;
    h.hp = w.heroMaxHp;
  };
  const army = (n) => {
    const kinds = ['knight', 'archer', 'knight', 'raider', 'archer'];
    for (let i = w.soldiers; i < n; i++) w.addSoldier(kinds[i % kinds.length], (i % 6) * 1.4 - 3.5, CASTLE_R + 2 + Math.floor((i % 30) / 6) * 1.3);
  };
  const people = () => { while (w.pop < w.beds) w.spawnVillager(rand(-6, 6), CASTLE_R + 3 + Math.random() * 2); };
  const staff = () => {
    for (const b of w.jobBuildings()) for (let i = 0; i < 8 && w.freeVillagers > 0 && w.wantedAt(b) < w.workerSlots(b); i++) w.setWorkers(b.id, 1);
  };
  const clearFort = () => {
    w.enemies = w.enemies.filter((e) => !e.fort && !e.guard);
    if (!w.built('pass')) w.finishBuilding(w.b.pass);
    w.enemies = w.enemies.filter((e) => !e.guard);   // the camps are cleared too
  };
  const castle = (lv) => { w.b.castle.level = Math.max(w.b.castle.level, lv); w.castleHp = w.castleMax; };

  if (at('w4')) {
    for (const id of ['tower-S1', 'tower-S2', 'tower-S3', 'tower-E1']) pad(id, 1);
    place('house', 3);
    place('barracks', 1);
    pad('bridge'); pad('lumber-1');
    place('warehouse', 1);
    place('blacksmith', 1);
    king({ damage: 1, rate: 1, hp: 1 });
    army(3);
  }
  if (at('w5')) {
    pad('lumber-2'); pad('tower-E2', 1);
    place('house', 4);
    king({ damage: 2, rate: 2, hp: 2, range: 1 }, { bow: 1 });
    army(5);
  }
  if (at('w8')) {
    clearFort();
    castle(1);
    pad('quarry-1'); pad('goldmine'); pad('catapult-S'); pad('catapult-E');
    for (const id of ['tower-S1', 'tower-S2', 'tower-E1', 'tower-E2']) pad(id, 2);
    for (const id of ['tower-W1', 'tower-W2']) pad(id, 1);
    w.walls.level = Math.max(w.walls.level, 1); w.walls.gate = Math.max(w.walls.gate, 2);
    place('house', 6); place('farm', 1);
    w.wave = Math.max(w.wave, 7);
    pad('outpost-1');
    place('house', 2, 'outpost-1'); place('farm', 1, 'outpost-1'); place('barracks', 1, 'outpost-1');
    pad('ironmine-1');
    king({ damage: 3, rate: 3, hp: 3, range: 2, speed: 2, carry: 2 }, { weapons: ['crossbow'], bow: 2, weapon: 'crossbow' });
    army(14);
  }
  if (at('w10')) {
    castle(2);
    for (const id of ['tower-S1', 'tower-S2', 'tower-S3', 'tower-E1', 'tower-E2', 'tower-E3', 'tower-W1', 'tower-W2', 'tower-W3']) pad(id, 3);
    for (const id of ['tower-N1', 'tower-N2']) pad(id, 2);
    pad('catapult-S', 1); pad('catapult-E', 1); pad('catapult-O1');
    pad('tower-O1a', 2); pad('tower-O1b', 2);
    w.walls.level = Math.max(w.walls.level, 2); w.walls.gate = Math.max(w.walls.gate, 3);
    place('house', 8);
    w.wave = Math.max(w.wave, 9);
    pad('outpost-2');
    place('house', 2, 'outpost-2'); place('barracks', 1, 'outpost-2');
    king({ damage: 4, rate: 4, hp: 4, range: 3, speed: 3, carry: 3, magnet: 2 }, { weapons: ['crossbow', 'fire', 'multi'], bow: 3, weapon: 'multi' });
    w.smith = { king: Math.max(w.smith.king, 1), workers: Math.max(w.smith.workers, 1), arrows: Math.max(w.smith.arrows, 1) };
    army(24);
  }
  if (at('siege')) {
    // Everything the final battle asks for: every outpost settled with
    // upgraded Barracks and Houses, home defences up, and 55+ soldiers.
    castle(BUILDINGS.castle.levels.length - 1);
    w.armor = Math.max(w.armor, 3);
    for (const b of w.list('tower')) pad(b.id, 3);
    for (const b of w.list('catapult')) pad(b.id, 1);
    w.walls.level = Math.max(w.walls.level, 3); w.walls.gate = Math.max(w.walls.gate, 3);
    w.wave = Math.max(w.wave, 14);
    pad('outpost-3');
    place('barracks', 1, null, 2);
    for (const o of ['outpost-1', 'outpost-2', 'outpost-3']) { place('house', 3, o, 2); place('barracks', 1, o, 2); }
    place('house', 10, null, 2);
    king(Object.fromEntries(Object.keys(HERO_UPGRADES).map((k) => [k, 99])), { weapons: ['crossbow', 'fire', 'multi', 'storm'], bow: 4, weapon: 'storm' });
    w.smith = { king: 3, workers: 3, arrows: 3 };
    army(66);
    w.wave = Math.max(w.wave, 15);
  }
  w.rebuildGates();
  w.castleHp = w.castleMax;
  people();
  staff();
  w.hero.coins = Math.max(w.hero.coins, 200);
  w.res.wood = Math.max(w.res.wood, at('w8') ? 200 : 60);
  if (at('w8')) w.res.stone = Math.max(w.res.stone, 120);
  if (at('w10')) w.res.iron = Math.max(w.res.iron, 60);
}

const WAVE_STAGE = (n) => (n >= 15 ? 'siege' : n >= 10 ? 'w10' : n >= 8 ? 'w8' : n >= 5 ? 'w5' : n >= 4 ? 'w4' : 'start');

const DEV = {
  level(n) {
    world = new World(null, { level: n, carry: devCarry(n) });
    renderer.reset();
    // A fresh map, so give the new biome a settled kingdom to test from.
    if (n > 1) devBuild('w5');
    return `Level ${n}: ${world.levelInfo.name}, with a settled kingdom`;
  },
  wave(n) {
    devBuild(WAVE_STAGE(n));
    world.wave = n - 1;
    return `Ready for wave ${n}, built up as a player would be by then`;
  },
  // An average king around waves 5-6 (wood-tier upgrades, 3 troops) in Level 1,
  // waiting just outside the Mountain Fort.
  fort() {
    world = new World(null, {
      level: 1,
      carry: { up: { damage: 2, rate: 2, hp: 2, range: 1 }, weapons: { bow: true }, weapon: 'bow', army: ['knight', 'archer', 'archer'], coins: 100 },
    });
    world.wave = 5;
    const h = world.hero;
    h.x = FORT.x - 18; h.z = FORT.z;
    for (const a of world.allies) { a.x = h.x - 2 + Math.random(); a.z = h.z + Math.random() * 2 - 1; }
    renderer.reset();
    return 'Average king at wave 6 — take the Mountain Fort!';
  },
  siege() {
    devBuild('siege');
    world.setRally(true);
    // Start at the Siege Camp with the army formed up behind the king.
    const camp = world.b['outpost-3'], h = world.hero;
    h.x = camp.x + 6; h.z = camp.z + 8;
    world.allies.forEach((a, i) => { a.x = h.x + (i % 8) * 1.3 - 4.5; a.z = h.z - 3 - Math.floor(i / 8) * 1.3; });
    renderer.recenter();
    return `Siege ready: ${world.soldiers} soldiers, every outpost settled. Close this, then tap Lay Siege!`;
  },
  outposts() {
    world.wave = Math.max(world.wave, 14);
    for (const id of ['outpost-1', 'outpost-2', 'outpost-3']) if (!world.built(id)) world.finishBuilding(world.b[id]);
    return 'All outposts claimed';
  },
  gold() { world.hero.coins += 500; return '+500 gold'; },
  mats() { world.res.wood += 300; world.res.stone += 300; world.res.iron += 150; return '+300 wood & stone, +150 iron'; },
  king() {
    const h = world.hero;
    for (const [k, u] of Object.entries(HERO_UPGRADES)) h.up[k] = u.values.length - 1;
    h.weapons = { bow: true, crossbow: true, fire: true, multi: true, storm: true };
    h.bow = 4;
    h.hp = world.heroMaxHp;
    return 'The king is maxed out';
  },
  army() {
    for (let i = 0; i < 6; i++) world.addSoldier(['knight', 'archer', 'raider'][i % 3], (i % 3) * 1.5 - 1.5, CASTLE_R + 2 + Math.floor(i / 3));
    return '+6 soldiers';
  },
  castle() {
    const c = world.b.castle;
    c.level = BUILDINGS.castle.levels.length - 1;
    world.castleHp = world.castleMax;
    world.walls.level = WALLS.levels.length - 1;
    world.rebuildGates();
    return 'Castle maxed, walls fully expanded';
  },
  win() { devCalm(); world.winLevel(); return null; },
  lose() {
    if (world.phase !== 'wave') return 'Start a wave first';
    world.hurtHero(1e9);
    return null;
  },
};

// Dev buttons act on the game behind the panel, which stays open until it's
// closed; each one reports what it did in the panel's status line.
function devRun(cmd) {
  const [name, arg] = cmd.split(':');
  let msg;
  try { msg = DEV[name](arg !== undefined ? Number(arg) : undefined); } catch (err) { console.error(err); msg = `⚠️ ${err.message}`; }
  placing = null;
  ui.closeMenu();
  ui.closeBuild();
  if (world.phase === 'build') persist();
  dirty = true;
  devStatus(msg || 'Done');
  for (const b of document.querySelectorAll('#dev-levels .chip')) b.classList.toggle('on', b.dataset.dev === `level:${world.level}`);
}
function devStatus(msg) {
  const el = $('dev-status');
  const w = world;
  el.innerHTML = `<b>${msg}</b><span>L${w.level} · wave ${w.wave + 1} · ${w.soldiers} soldiers · ${w.pop}/${w.beds} people · castle Lv ${w.b.castle.level + 1} · 🪙 ${w.gold} 🪵 ${w.res.wood} 🪨 ${w.res.stone} ⚙️ ${w.res.iron}</span>`;
}

$('dev-levels').innerHTML = Array.from({ length: MAX_LEVELS }, (_, i) => `<button class="chip" data-dev="level:${i + 1}">${i + 1} · ${levelInfo(i + 1).name}</button>`).join('');
$('btn-dev').addEventListener('click', () => {
  audio.tap();
  for (const b of document.querySelectorAll('#dev-levels .chip')) b.classList.toggle('on', b.dataset.dev === `level:${world.level}`);
  devStatus('Pick something to test. This panel stays open until you close it.');
  show('screen-dev');
});
$('btn-dev-back').addEventListener('click', () => { audio.tap(); play(); });
$('btn-dev-x').addEventListener('click', () => { audio.tap(); play(); });
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
    case 'advice': audio.villager(); ui.toast(`💡 ${ev.text}`); break;
    case 'forged': audio.buy(); ui.banner('⚒️ Forged!', ev.title.replace(/^Forge the /, ''), 1.6); break;
    case 'column': if (ev.n === 1 || ev.n % 3 === 0) ui.toast(`⚔️ A column of ${ev.size} marches out of the stronghold!`, true); break;
    case 'wrecked': audio.crash(); ui.toast(`🔥 ${ev.name} ${ev.outpost ? 'has fallen' : 'was wrecked'}!`, true); break;
    case 'deposit': audio.spend(); ui.float(at(ev.x, 2.6, ev.z), `🏦 +${ev.n} banked`, '#ffe28a'); break;
    case 'rally': ui.toast(ev.on ? '🚩 Your troops ride with you' : '🏰 Troops head back to their posts'); break;
    case 'toast': ui.toast(ev.text); break;
    case 'deliver':
      audio.deliver();
      ui.float(at(ev.x, 2.4, ev.z), `+${ev.amt} ${{ wood: '🪵', stone: '🪨', iron: '⚙️', gold: '🪙' }[ev.res] || ''}`, '#fff');
      break;
    case 'nodeHit':
      if (Math.hypot(ev.x - world.hero.x, ev.z - world.hero.z) < 14) audio.chop(ev.wood ? 'wood' : 'stone');
      break;
    case 'treeFell':
    case 'rockBroke':
      if (Math.hypot(ev.x - world.hero.x, ev.z - world.hero.z) < 16) audio.fell(ev.type === 'treeFell');
      break;
    case 'gather':
      ui.float(at(ev.x, 4.5, ev.z), `+${ev.k} ${{ wood: '🪵', stone: '🪨', iron: '⚙️' }[ev.res]} (${ev.n}/${ev.cap})`, '#fff');
      if (!hintGather[ev.res]) {
        hintGather[ev.res] = true;
        ui.toast(`The king ${{ wood: 'chops wood', stone: 'mines stone', iron: 'mines iron ore' }[ev.res]}! Carry it to the castle or a warehouse to bank it.`);
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
    case 'fortTaken':
      audio.victory();
      ui.banner('The Mountain Fort has fallen!', 'The mountains are yours: build quarries and a gold mine', 3.2);
      dirty = true;
      break;
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
  // No guide arrows during a battle.
  const obj = state === 'play' && !placing && world.phase !== 'wave' ? world.objectiveInfo() : null;
  checkTip();
  const menuB = ui.menuFor ? world.b[ui.menuFor] : null;
  const rangeOf = menuB && menuB.type === 'tower' ? { x: menuB.x, z: menuB.z, r: BUILDINGS.tower.levels[menuB.level].range } : null;
  renderer.frame(dt, world, { trail: obj && obj.target, placing, rangeOf, sheetOpen: ui.sheetOpen });
  requestAnimationFrame(frame);
}

refreshTitle();
show('screen-title');
requestAnimationFrame(frame);

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
  // A page that was running an older version reloads once when the new one takes over.
  if (navigator.serviceWorker.controller) {
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloaded || state === 'play') return;
      reloaded = true;
      location.reload();
    });
  }
}

// For automated testing.
window.__crownfall = { get world() { return world; }, renderer, input, ui, get state() { return state; }, newGame, persist };
