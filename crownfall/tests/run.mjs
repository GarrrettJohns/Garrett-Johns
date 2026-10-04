// Headless checks for Crownfall. Run with:  node crownfall/tests/run.mjs
// No dependencies: the simulation, map, terrain and camera rules are plain
// ES modules with no three.js or DOM.

import { World } from '../js/world.js';
import { LANES, RIVER_Z, RIVER_HALF, RIVER_X1, FIXED_PADS, WALL_HALF, FORT, BRIDGE, LANDMARKS, inHighland, eastLimit } from '../js/map.js';
import { groundH, slopeAt, footing, standH, setBridge, DECK_Y, TERRAIN } from '../js/terrain.js';
import { ENCOUNTERS } from '../js/slice.js';
import { SITES, SITE_PROPS } from '../js/map.js';
import { initialCam, stepCam, cycleOverride, stickToWorld, CAM } from '../js/camera.js';

let pass = 0, fail = 0;
const test = (name, fn) => {
  try { fn(); pass++; console.log(`  ok   ${name}`); } catch (e) { fail++; console.log(`  FAIL ${name}\n       ${e.message}`); }
};
const assert = (c, msg) => { if (!c) throw new Error(msg); };
const near = (a, b, eps, msg) => assert(Math.abs(a - b) <= eps, `${msg}: ${a} vs ${b}`);
const inRiver = (x, z) => x < RIVER_X1 + 2 && Math.abs(z - RIVER_Z) < RIVER_HALF + 1.2;

console.log('terrain');
test('every enemy road is walkable (slope ≤ maxSlope, river crossing aside)', () => {
  for (const l of LANES) for (const [x, z] of l.pts) {
    if (inRiver(x, z)) continue;
    const s = slopeAt(x, z);
    assert(s <= TERRAIN.maxSlope, `lane ${l.id} at ${x.toFixed(1)},${z.toFixed(1)} slope ${s.toFixed(2)}`);
  }
});
test('the ridable map has no slope steeper than maxSlope', () => {
  for (let x = -54; x <= 120; x += 3) for (let z = -78; z <= 220; z += 3) {
    if (x > Math.min(eastLimit(z), eastLimit(z + 4)) - 2 || inRiver(x, z)) continue;   // beside the map edge
    if (inHighland(x, z) !== inHighland(x + 3, z)) continue;   // the crag line between regions
    const s = slopeAt(x, z);
    const lim = inHighland(x, z) ? TERRAIN.mountainSlope : TERRAIN.maxSlope;
    assert(s <= lim, `${x},${z} slope ${s.toFixed(2)}`);
  }
});
test('the castle grounds are level (where buildings go inside the widest walls)', () => {
  const R = WALL_HALF[WALL_HALF.length - 1] - 4;
  let lo = Infinity, hi = -Infinity;
  for (let x = -R; x <= R; x += 2) for (let z = -R; z <= R; z += 2) { const h = groundH(x, z); lo = Math.min(lo, h); hi = Math.max(hi, h); }
  assert(hi - lo < 0.5, `castle grounds vary by ${(hi - lo).toFixed(2)} m`);
});
test('fixed pads sit on level or gently sloping ground', () => {
  for (const p of FIXED_PADS) {
    if (p.type === 'bridge') continue;
    // Towers and catapults stand on gentle slopes; bigger sites are levelled.
    const small = p.type === 'tower' || p.type === 'catapult';
    const r = small ? 1.5 : 2.4;
    const spread = Math.max(...[[r, 0], [-r, 0], [0, r], [0, -r]].map(([dx, dz]) => Math.abs(groundH(p.x + dx, p.z + dz) - groundH(p.x, p.z))));
    assert(spread < (small ? 0.5 : 0.35), `${p.id} varies by ${spread.toFixed(2)} m`);
  }
});
test('the river channel lies below the water and the banks above it', () => {
  assert(groundH(0, RIVER_Z) < TERRAIN.water, 'river bed above water');
  assert(groundH(0, RIVER_Z + RIVER_HALF + 2) > TERRAIN.water, 'south bank under water');
});
test('footing never floats a building above its corners', () => {
  for (const [x, z] of [[0, 0], [30, 30], [FORT.x, FORT.z], [-40, 60]]) {
    const f = footing(x, z, 6);
    for (const [dx, dz] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) assert(f <= groundH(x + dx, z + dz) + 1e-9, `${x},${z}`);
  }
});
test('riders cross the built bridge on its deck, not the river bed', () => {
  setBridge(true);
  for (let dz = -4; dz <= 4; dz += 0.5) {
    const h = standH(BRIDGE.x, RIVER_Z + dz);
    assert(h >= DECK_Y - 1e-9 && h > TERRAIN.water, `sinks at dz ${dz}: ${h.toFixed(2)}`);
    assert(Math.abs(h - standH(BRIDGE.x, RIVER_Z + dz + 0.5)) < 0.35, `step at dz ${dz}`);
  }
  setBridge(false);
  assert(standH(BRIDGE.x, RIVER_Z) === groundH(BRIDGE.x, RIVER_Z), 'deck present before the bridge is built');
  assert(standH(10, 10) === groundH(10, 10), 'stand height differs from the ground away from the bridge');
});

console.log('camera');
const ctx = (o) => ({ uiBusy: false, nearEnemy: Infinity, atHome: true, alive: true, ...o });
const run = (s, c, secs, dt = 0.1) => { for (let t = 0; t < secs; t += dt) s = stepCam(s, c, dt); return s; };
test('at home the view is the kingdom view', () => assert(run(initialCam(), ctx(), 3).mode === 'kingdom', 'not kingdom'));
test('riding out switches to the adventure view after leaveHome', () => {
  let s = run(initialCam(), ctx({ atHome: false }), CAM.leaveHome * 0.5);
  assert(s.mode === 'kingdom', 'switched too soon');
  s = run(s, ctx({ atHome: false }), CAM.leaveHome);
  assert(s.mode === 'adventure', 'did not switch');
});
test('an enemy close by brings the combat view, which holds through brief gaps', () => {
  let s = run(initialCam(), ctx({ atHome: false, nearEnemy: CAM.enterCombat - 1 }), 0.2);
  assert(s.mode === 'combat', 'no combat');
  s = run(s, ctx({ atHome: false, nearEnemy: CAM.leaveCombat + 5 }), CAM.combatHold * 0.6);
  assert(s.mode === 'combat', 'combat dropped during hysteresis');
  s = run(s, ctx({ atHome: false, nearEnemy: (CAM.enterCombat + CAM.leaveCombat) / 2 }), 5);
  assert(s.mode === 'combat', 'enemy still in leave range should keep combat');
  s = run(s, ctx({ atHome: false, nearEnemy: Infinity }), CAM.combatHold + 1.5);
  assert(s.mode === 'adventure', `ended in ${s.mode}`);
});
test('menus and placement always use the kingdom view (even mid-fight)', () => {
  const s = run(initialCam(), ctx({ nearEnemy: 2, uiBusy: true }), 1);
  assert(s.mode === 'kingdom', s.mode);
});
test('manual override cycles and is respected; menus still win', () => {
  let s = cycleOverride(initialCam());
  assert(s.override === 'kingdom', s.override);
  s = cycleOverride(cycleOverride(s));
  assert(s.override === 'combat', s.override);
  assert(stepCam(s, ctx(), 0.1).mode === 'combat', 'override ignored');
  assert(stepCam(s, ctx({ uiBusy: true }), 0.1).mode === 'kingdom', 'menu should force kingdom');
  assert(cycleOverride(s).override === 'auto', 'did not wrap');
});
test('stick input is identity in the kingdom view and turns with the camera', () => {
  const a = stickToWorld({ x: 1, z: 0 }, Math.PI);
  near(a.x, 1, 1e-9, 'right x'); near(a.z, 0, 1e-9, 'right z');
  const b = stickToWorld({ x: 0, z: -1 }, Math.PI);
  near(b.x, 0, 1e-9, 'up x'); near(b.z, -1, 1e-9, 'up z');
  // Camera looking east (yaw π/2): stick up rides east, stick right rides south.
  const c = stickToWorld({ x: 0, z: -1 }, Math.PI / 2);
  near(c.x, 1, 1e-9, 'east x'); near(c.z, 0, 1e-9, 'east z');
  const d = stickToWorld({ x: 1, z: 0 }, Math.PI / 2);
  near(d.x, 0, 1e-9, 'south x'); near(d.z, 1, 1e-9, 'south z');
});

test('switching views never changes how far the stick moves the king, and never mutates state', () => {
  for (let yaw = 0; yaw < 6.3; yaw += 0.7) {
    const w = stickToWorld({ x: 0.6, z: -0.8 }, yaw);
    near(Math.hypot(w.x, w.z), 1, 1e-9, `magnitude at yaw ${yaw}`);
  }
  const s0 = initialCam(), frozen = JSON.stringify(s0);
  run(s0, ctx({ atHome: false, nearEnemy: 3 }), 2);
  assert(JSON.stringify(s0) === frozen, 'stepCam mutated its input');
});

console.log('saves and discovery');
const dt = 1 / 30;
test('a legacy save without the new fields still loads', () => {
  const w = new World();
  w.wave = 6; w.res.wood = 77;
  const snap = JSON.parse(JSON.stringify(w.snapshot()));
  for (const k of ['discovered', 'order', 'stations', 'smith']) delete snap[k];
  delete snap.res.iron; delete snap.res.gold;
  delete snap.hero.bow; delete snap.hero.style; delete snap.hero.styles;
  snap.rally = true;
  const w2 = new World(snap);
  assert(w2.wave === 6 && w2.res.wood === 77, 'progress lost');
  assert(w2.order === 'follow', `old rally flag not carried: ${w2.order}`);
  assert(Array.isArray(w2.discovered) && w2.discovered.length === 0, 'discovered not defaulted');
  assert(w2.res.iron === 0 && w2.hero.bow === 0 && w2.hero.style.finish === 'gold', 'new fields not defaulted');
  for (let i = 0; i < 60; i++) w2.update(dt, { x: 0, z: 0 });
});
test('a landmark is discovered once, and remembered across a save', () => {
  const w = new World();
  const L = LANDMARKS.find((l) => l.id === 'fort');
  w.hero.x = L.x - L.sight + 2; w.hero.z = L.z;
  let n = 0;
  for (let i = 0; i < 30; i++) { w.update(dt, { x: 0, z: 0 }); n += w.events.filter((e) => e.type === 'discovered' && e.id === 'fort').length; w.events.length = 0; }
  assert(n === 1, `discovered ${n} times`);
  const w2 = new World(JSON.parse(JSON.stringify(w.snapshot())));
  w2.hero.x = L.x - L.sight + 2; w2.hero.z = L.z;
  for (let i = 0; i < 10; i++) { w2.update(dt, { x: 0, z: 0 }); assert(!w2.events.some((e) => e.type === 'discovered'), 'rediscovered after reload'); w2.events.length = 0; }
});
test('landmarks beyond the claimed road stay hidden', () => {
  const w = new World();
  const L = LANDMARKS.find((l) => l.id === 'stronghold');
  w.hero.x = L.x; w.hero.z = L.z - 20;
  for (let i = 0; i < 5; i++) { w.update(dt, { x: 0, z: 0 }); }
  assert(!w.discovered.includes('stronghold'), 'revealed through the fog');
});

test('a malformed save is rejected rather than half-loaded', () => {
  let ok = false;
  try { const w = new World({ v: 1, hero: null, buildings: 'nope' }); ok = !!w.hero; } catch { ok = true; /* main.js safeLoad falls back to a new game */ }
  assert(ok, 'malformed save produced a world without a king');
});

console.log('the Greenwood journey');
const step = (w, n = 1, input = { x: 0, z: 0 }) => { for (let i = 0; i < n; i++) { w.update(dt, input); } };
const evs = (w, type) => { const n = w.events.filter((e) => e.type === type).length; w.events.length = 0; return n; };
const guardsAt = (w, id) => w.enemies.filter((e) => e.guard && e.guard.camp === 'enc:' + id && e.hp > 0);
const killAll = (w, id, n = Infinity) => { for (const e of guardsAt(w, id).slice(0, n)) { e.hp = 0; w.killEnemy(e); } step(w); };
// Ride the king along waypoints with the stick, as a player would.
function ride(w, pts, limit = 90) {
  const h = w.hero;
  for (const [x, z] of pts) {
    let t = 0;
    while (Math.hypot(x - h.x, z - h.z) > 2.2) {
      const dx = x - h.x, dz = z - h.z, d = Math.hypot(dx, dz);
      w.update(dt, { x: dx / d, z: dz / d });
      w.events.length = 0;
      t += dt;
      assert(h.alive, `king fell on the way to ${x},${z}`);
      if (!inRiver(h.x, h.z)) assert(slopeAt(h.x, h.z) <= TERRAIN.maxSlope + 0.05, `too steep at ${h.x.toFixed(1)},${h.z.toFixed(1)}`);
      if (t > limit) throw new Error(`stuck at ${h.x.toFixed(1)},${h.z.toFixed(1)} on the way to ${x},${z}`);
    }
  }
}

test('the journey opens in order: farmland after wave 1, the village after wave 2, the ruin with the bridge', () => {
  const w = new World();
  step(w, 2);
  assert(ENCOUNTERS.every((e) => w.enc[e.id] === 'locked'), `open before the first wave: ${JSON.stringify(w.enc)}`);
  w.wave = 1; step(w, 2);
  assert(w.enc.farmland === 'open' && w.enc.village === 'locked' && w.enc.ruin === 'locked', JSON.stringify(w.enc));
  w.wave = 2; step(w, 2);
  assert(w.enc.village === 'open' && guardsAt(w, 'village').length === ENCOUNTERS.find((e) => e.id === 'village').guards.length, 'village guards not posted');
  w.finishBuilding(w.b.bridge); step(w, 2);
  assert(w.enc.ruin === 'open', 'ruin did not open with the bridge');
});
test('camp guards never hold up a wave', () => {
  const w = new World();
  w.wave = 2; step(w, 2);
  const before = w.enemiesLeft;
  assert(before === 0, `guards counted as wave enemies: ${before}`);
  w.startWave(); w.spawnQueue = []; w.enemies = w.enemies.filter((e) => e.guard); step(w, 2);
  assert(w.phase === 'build' && w.wave === 3, `wave did not end with guards alive (${w.phase}, wave ${w.wave})`);
});
test('freeing the village pays once: villagers and coins, not again after a reload', () => {
  const w = new World();
  w.wave = 2; step(w, 2); w.events.length = 0;
  const pop = w.villagers.length, coins = w.coins.length;
  killAll(w, 'village');
  assert(w.enc.village === 'done', w.enc.village);
  assert(w.villagers.length === pop + 3, `villagers ${pop} -> ${w.villagers.length}`);
  assert(w.coins.length > coins, 'no reward coins');
  const w2 = new World(JSON.parse(JSON.stringify(w.snapshot())));
  const pop2 = w2.villagers.length;
  step(w2, 30);
  assert(w2.enc.village === 'done' && guardsAt(w2, 'village').length === 0, 'village camp came back');
  assert(w2.villagers.length === pop2, 'reward paid twice');
});
test('a half-cleared camp keeps its losses across a reload', () => {
  const w = new World();
  w.wave = 2; step(w, 2);
  killAll(w, 'village', 2);
  const left = guardsAt(w, 'village').length;
  const w2 = new World(JSON.parse(JSON.stringify(w.snapshot())));
  step(w2, 2);
  assert(guardsAt(w2, 'village').length === left, `${left} left before, ${guardsAt(w2, 'village').length} after`);
});
test('a camp wiped out of the world without a fight comes back (no free reward)', () => {
  const w = new World();
  w.wave = 2; step(w, 2);
  w.enemies = []; step(w, 2);
  assert(w.enc.village === 'open' && guardsAt(w, 'village').length > 0, 'village finished without its guards being beaten');
});
test('the ruin opens the ridge raid: a scout rides in and the troops fall in behind the king', () => {
  const w = new World();
  w.finishBuilding(w.b.bridge);
  for (const k of ['knight', 'archer']) w.addSoldier(k, 0, 8);
  step(w, 2);
  const R = SITES.ruin; w.hero.x = R.x; w.hero.z = R.z; step(w, 2);
  assert(w.enc.ruin === 'done' && w.enc.ridge === 'open', JSON.stringify(w.enc));
  const scout = w.allies.find((a) => a.scout);
  assert(scout, 'no scout');
  w.hero.x = 20; w.hero.z = -20;   // he finds the king wherever he is
  let warned = 0;
  for (let i = 0; i < 30 * 20 && !warned; i++) { w.update(dt, { x: 0, z: 0 }); warned += w.events.filter((e) => e.type === 'scout').length; w.events.length = 0; }
  assert(warned === 1, 'the scout never reached the king');
  assert(w.allies.filter((a) => !a.station).every((a) => a.follow), 'troops did not join');
  assert(guardsAt(w, 'ridge').length > 0, 'no raiders on the ridge');
});
test('clearing the ridge opens the overlook, which reveals the Mountain Fort and ends the journey', () => {
  const w = new World();
  for (const E of ENCOUNTERS) if (E.id !== 'ridge' && E.id !== 'overlook') w.enc[E.id] = 'done';
  w.enc.ridge = 'open'; w.encLeft.ridge = 6;
  step(w, 2); killAll(w, 'ridge'); step(w, 2);
  assert(w.enc.ridge === 'done' && w.enc.overlook === 'open', JSON.stringify(w.enc));
  const O = SITES.overlook; w.hero.x = O.x; w.hero.z = O.z;
  w.events.length = 0; w.update(dt, { x: 0, z: 0 });
  assert(w.events.some((e) => e.type === 'encounter' && e.id === 'overlook'), 'no overlook reveal');
  assert(w.events.some((e) => e.type === 'journeyDone'), 'journey not finished');
  assert(w.discovered.includes('fort'), 'fort not discovered');
});
test('the whole journey can be ridden: castle → farmland → village → bridge → ruin → ridge → overlook → home', () => {
  const w = new World();
  for (const E of ENCOUNTERS) w.enc[E.id] = 'done';   // just the ride here
  w.finishBuilding(w.b.bridge);
  const bx = BRIDGE.x, F = SITES;
  ride(w, [[0, 8], [F.farmland.x, F.farmland.z], [F.village.x, F.village.z], [bx, RIVER_Z + 6], [bx, RIVER_Z - 6],
    [F.ruin.x, F.ruin.z], [bx, RIVER_Z - 6], [bx, RIVER_Z + 6], [F.ridge.x - 3, F.ridge.z + 2], [F.overlook.x, F.overlook.z], [0, 8]]);
});
test('the journey props are solid and sit off the roads', () => {
  const w = new World();
  const p = SITE_PROPS.find((q) => q.kind === 'well');
  w.hero.x = p.x - 4; w.hero.z = p.z;
  for (let i = 0; i < 60; i++) w.update(dt, { x: 1, z: 0 });
  assert(Math.hypot(w.hero.x - p.x, w.hero.z - p.z) >= p.r, 'rode through the well');
  for (const q of SITE_PROPS) if (q.r > 0) for (const l of LANES) for (const [x, z] of l.pts) assert(Math.hypot(x - q.x, z - q.z) > q.r + 2, `${q.site} ${q.kind} on lane ${l.id}`);
});
test('saves from before the journey load with it at the start', () => {
  const w = new World();
  const snap = JSON.parse(JSON.stringify(w.snapshot()));
  delete snap.enc; delete snap.encLeft;
  const w2 = new World(snap);
  assert(ENCOUNTERS.every((e) => w2.enc[e.id] === 'locked'), JSON.stringify(w2.enc));
});

console.log('the five kings');
const { KINGS, KING_ORDER } = await import('../js/config.js');
const { RIGS } = await import('../js/models.js');
test('every regional king has a complete colour kit and builds a mounted rig within budget', () => {
  const keys = Object.keys(KINGS.greenwood);
  assert(KING_ORDER.length === 5 && KING_ORDER.every((k) => KINGS[k]), 'five kings');
  for (const id of KING_ORDER) {
    for (const k of keys) assert(KINGS[id][k] !== undefined, `${id} lacks ${k}`);
    const r = RIGS.hero(KINGS[id]);
    let tris = 0;
    for (const p of r.parts) { assert(p.geo.attributes.position.count > 0, `${id} empty part`); tris += p.geo.attributes.position.count / 3; }
    assert(tris < 8000, `${id} rig ${tris} triangles`);   // well inside the 8-15k king+horse budget
  }
});
test('the chosen king is saved, carried to the next land, and old saves ride as the Greenwood king', () => {
  const w = new World();
  assert(w.hero.kit === 'greenwood', w.hero.kit);
  w.hero.kit = 'frostmarch';
  const w2 = new World(JSON.parse(JSON.stringify(w.snapshot())));
  assert(w2.hero.kit === 'frostmarch', 'kit lost on reload');
  const w3 = new World(null, { level: 2, carry: w2.carryOver() });
  assert(w3.hero.kit === 'frostmarch', 'kit lost between lands');
  const snap = JSON.parse(JSON.stringify(w.snapshot())); delete snap.hero.kit;
  assert(new World(snap).hero.kit === 'greenwood', 'legacy save');
  snap.hero.kit = 'nonsense';
  assert(new World(snap).hero.kit === 'greenwood', 'bad kit accepted');
});

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
