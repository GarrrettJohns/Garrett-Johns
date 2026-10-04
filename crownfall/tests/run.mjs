// Headless checks for Crownfall. Run with:  node crownfall/tests/run.mjs
// No dependencies: the simulation, map, terrain and camera rules are plain
// ES modules with no three.js or DOM.

import { World } from '../js/world.js';
import { LANES, RIVER_Z, RIVER_HALF, RIVER_X1, FIXED_PADS, WALL_HALF, FORT, BRIDGE, LANDMARKS, inHighland, eastLimit } from '../js/map.js';
import { groundH, slopeAt, footing, standH, setBridge, DECK_Y, TERRAIN } from '../js/terrain.js';
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
  w.hero.x = L.x - 30; w.hero.z = L.z;
  let n = 0;
  for (let i = 0; i < 30; i++) { w.update(dt, { x: 0, z: 0 }); n += w.events.filter((e) => e.type === 'discovered' && e.id === 'fort').length; w.events.length = 0; }
  assert(n === 1, `discovered ${n} times`);
  const w2 = new World(JSON.parse(JSON.stringify(w.snapshot())));
  w2.hero.x = L.x - 30; w2.hero.z = L.z;
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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
