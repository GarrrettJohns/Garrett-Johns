// The shape of the land: one height function for the whole map, shared by
// the renderer (ground mesh, where things stand, the camera) and anything in
// the simulation that needs to know how high the ground is. Pure maths, no
// three.js, so it runs headless in tests.
//
// The land rolls gently across the grassland, rises into a raised castle
// hill, dips into the river valley, climbs into the eastern mountains and
// walls the map in with hills behind its cliffs. Build areas (the castle
// grounds, outpost land) and fixed structures sit on flattened ground, and
// slopes stay gentle enough everywhere walkable that a horse can climb them.

import {
  HIGHLAND, RIVER_Z, RIVER_HALF, RIVER_X1, BOUNDS, STRONGHOLD, FIXED_PADS, WALL_HALF, FORT,
  OUTPOST_ZONE, eastLimit, LANES, BRIDGE,
} from './map.js';

// Where each enemy road enters the map: the rim hills open up there.
const MOUTHS = LANES.map((l) => l.pts[0]);

// Tuning, all in metres. See docs/crownfall/world-layout.json.
export const TERRAIN = {
  hillAmp: 2.4,          // rolling hills across the grassland
  forestAmp: 2.6,        // the forest beyond the river is hillier
  plateau: 2.2,          // the castle hill
  plateauFlat: WALL_HALF[WALL_HALF.length - 1] + 3,   // flat out to just past the widest walls
  plateauBlend: 22,
  riverBed: -1.1,
  riverBank: 0.3,
  water: -0.35,          // the water surface
  mountainRise: 3.5,     // the mountains climb this much past the fort, then keep rising east
  rimHeight: 16,         // hills beyond the map edge, behind the cliffs
  maxSlope: 0.65,        // walkable areas are tested against this (tests/run.mjs)
  mountainSlope: 0.75,   // the mountains may be a little steeper
};

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const mix = (a, b, t) => a + (b - a) * t;

// Smooth value noise, seeded so the land is the same every load.
function hash(ix, iz) {
  let h = (ix * 374761393 + iz * 668265263) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}
function noise(x, z) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = hash(ix, iz), b = hash(ix + 1, iz), c = hash(ix, iz + 1), d = hash(ix + 1, iz + 1);
  return mix(mix(a, b, ux), mix(c, d, ux), uz) * 2 - 1;
}
const fbm = (x, z) => noise(x / 38, z / 38) + 0.45 * noise(x / 17 + 31, z / 17 - 7) + 0.12 * noise(x / 8 - 13, z / 8 + 5);

// The land before anything is flattened for building.
function raw(x, z) {
  const T = TERRAIN;
  // Rolling grassland, hillier in the forest.
  const amp = mix(T.hillAmp, T.forestAmp, smooth(RIVER_Z, RIVER_Z - 14, z));
  let h = 0.6 + fbm(x, z) * amp;

  // The castle hill: a broad flat-topped rise under the walls.
  const d = Math.max(Math.abs(x), Math.abs(z)) - T.plateauFlat;
  const top = T.plateau + noise(x / 9, z / 9) * 0.1;
  h = mix(h, top, 1 - smooth(0, T.plateauBlend, d));

  // The eastern mountains climb away from the fort, higher to the east.
  const into = x - HIGHLAND.x0;
  const wz = 1 - smooth(HIGHLAND.z1 - 4, HIGHLAND.z1 + 18, z);
  const rise = smooth(-2, 24, into) * (T.mountainRise + Math.max(0, into) * 0.06) + clamp01(into / 30) * noise(x / 16, z / 16) * 0.9;
  h += rise * wz;

  // Hills behind the cliffs at the map edge hide its border.
  const e = Math.max(-BOUNDS - x, -BOUNDS - z, x - eastLimit(z), z - (STRONGHOLD.z + 22));
  let mouth = 1;
  for (const [mx, mz] of MOUTHS) mouth = Math.min(mouth, smooth(8, 26, Math.hypot(x - mx, z - mz)));
  h += smooth(-2, 20, e) * mouth * (T.rimHeight + noise(x / 13, z / 13) * 4);

  // The river valley: banks at a common level, a channel below the water.
  const rd = Math.abs(z - RIVER_Z);
  const onRiver = 1 - smooth(RIVER_X1 - 2, RIVER_X1 + 6, x);
  if (onRiver > 0) {
    // Banks rise within a few metres, so the river doesn't eat into the castle hill.
    const bank = mix(h, T.riverBank, (1 - smooth(RIVER_HALF + 1, z < RIVER_Z ? 13 : 8, rd)) * onRiver);
    const bed = mix(T.riverBed, T.riverBank, smooth(RIVER_HALF - 0.6, RIVER_HALF + 0.9, rd));
    h = rd < RIVER_HALF + 0.9 ? mix(bank, bed, onRiver) : bank;
  }
  return h;
}

// Flat ground for structures and build areas: [x, z, half width (square) or
// radius (round), blend distance, round?], levelled to the land at its centre.
const FLATS = [];
const flat = (x, z, r, blend, round = false) => FLATS.push({ x, z, r, blend, round, h: raw(x, z) });
// Small pads first; outpost land and the fort afterwards, so pads inside an
// outpost's land end up level with it.
for (const p of FIXED_PADS) {
  if (['outpost', 'pass', 'bridge'].includes(p.type)) continue;
  // Towers and catapults get a small, tight pad so they don't disturb their surroundings.
  if (p.type === 'tower' || p.type === 'catapult') flat(p.x, p.z, 2, 3, true);
  else flat(p.x, p.z, 3.6, 7, true);
}
flat(STRONGHOLD.x, (STRONGHOLD.gateZ + STRONGHOLD.z) / 2 + 2, STRONGHOLD.half + 14, 10);
for (const p of FIXED_PADS) {
  if (p.type === 'outpost') flat(p.x, p.z, OUTPOST_ZONE + 1, 8);
  else if (p.type === 'pass') flat(FORT.x, FORT.z, 9, 14);
}

export function groundH(x, z) {
  let h = raw(x, z);
  for (let i = 0; i < FLATS.length; i++) {
    const f = FLATS[i];
    const dx = x - f.x, dz = z - f.z;
    const d = f.round ? Math.hypot(dx, dz) : Math.max(Math.abs(dx), Math.abs(dz));
    if (d >= f.r + f.blend) continue;
    h = mix(h, f.h, 1 - smooth(f.r, f.r + f.blend, d));
  }
  return h;
}

// Lowest ground under a square footprint, so a building never floats.
export function footing(x, z, size) {
  const s = size / 2;
  return Math.min(groundH(x - s, z - s), groundH(x + s, z - s), groundH(x - s, z + s), groundH(x + s, z + s), groundH(x, z));
}

// Steepest slope around a point (rise over run), for tests and tuning.
export function slopeAt(x, z, d = 1) {
  const h = groundH(x, z);
  return Math.max(Math.abs(groundH(x + d, z) - h), Math.abs(groundH(x, z + d) - h)) / d;
}

// What people and horses stand on: the ground, or the bridge deck once the
// bridge is built (the river bed lies under it). The bridge is 8.4 m of
// planks 0.44 m above the banks (models.js bridgeGeo).
export const DECK_Y = TERRAIN.riverBank + 0.44;
let bridgeOpen = false;
export const setBridge = (open) => { bridgeOpen = !!open; };
export function standH(x, z) {
  const h = groundH(x, z);
  if (!bridgeOpen || Math.abs(x - BRIDGE.x) > 1.9 || Math.abs(z - RIVER_Z) > 4.2) return h;
  return Math.max(h, DECK_Y);
}
