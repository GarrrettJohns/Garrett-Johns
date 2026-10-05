// The kingdom's fixed layout: the paths enemies march down, the river that
// separates the grassland from the forest, the wall rings, and every fixed
// build pad. Pure data and geometry — no three.js — so the simulation can run
// headless for balance testing.
//
// World is the XZ plane in metres. The castle sits at the origin. North is -z,
// which is "up" on screen because the camera looks down from +z.

import { mulberry32 } from './util.js';

// The castle grounds can grow a long way, so everything beyond them sits
// further out than the raw numbers below: a band around the castle is
// stretched by SPREAD metres, and everything past it moves out by SPREAD.
// The castle itself (|x|, |z| < 10) is unchanged.
const SPREAD = 24, IN0 = 10, IN1 = 26;
export const spread = (v) => v + Math.sign(v) * SPREAD * Math.min(1, Math.max(0, (Math.abs(v) - IN0) / (IN1 - IN0)));
const P = ([x, z]) => [spread(x), spread(z)];
const PP = (o) => ({ ...o, x: spread(o.x), z: spread(o.z) });

export const BOUNDS = spread(56);          // hero stays inside ±BOUNDS across (and north)
export const RIVER_Z = spread(-29);        // centre line of the river
export const RIVER_HALF = 2.2;     // half width of the water
export const FOREST_Z = spread(-32);       // the forest starts north of this line
export const WALL_HALF = [20, 25, 30, 35, 40, 46];  // the square fortress walls, by level (half widths)
export const CASTLE_R = 4.5;       // half width of the (square) castle
export const GATE_GAP = 2.5;       // half width of the opening a gate fills
export const PATH_HALF = 1.7;      // half width of a dirt road
export const GRID = 2;             // placement grid cell size

// The enemy stronghold at the far end of the south road, and the stretch of
// road the king claims on the way there. Each outpost pushes the frontier
// (how far south he can ride, and where southern enemies muster) further on.
export const STRONGHOLD = { x: 0, z: spread(190), gateZ: spread(179), half: 15 };
export const FRONTIERS = [62, 110, 156, 212].map(spread);
export const OUTPOSTS = [
  { id: 'outpost-1', name: 'Riverford Outpost', wave: 4, cost: { gold: 120, wood: 40 } },
  { id: 'outpost-2', name: 'Stonehill Outpost', wave: 9, cost: { gold: 220, wood: 80, stone: 60 } },
  { id: 'outpost-3', name: 'Siege Camp', wave: 14, cost: { gold: 340, wood: 120, stone: 120 } },
];

// The mountains: a big rocky range filling the east of the map, from the
// north edge down past the castle. Its only way in is on its west face,
// held by the enemy's Mountain Fort; take the fort and the mountains (their
// gold, stone and boulders) are yours. Enemy camps hold the trails inside.
export const HIGHLAND = { x0: spread(46), x1: spread(104), z0: spread(-60), z1: spread(30), gorgeZ: -8, gorgeHalf: 2.6 };
export const FORT = { x: HIGHLAND.x0, z: HIGHLAND.gorgeZ };
export const RIVER_X1 = spread(44);     // the river runs from the west edge to the foot of the mountains
export const inHighland = (x, z) => x > HIGHLAND.x0 && z < HIGHLAND.z1 && z > HIGHLAND.z0 - 10;
export const GORGE_OUT = { x: FORT.x - 5, z: FORT.z };   // just outside the fort gate
export const GORGE_IN = { x: FORT.x + 6, z: FORT.z };    // just inside it
// How far east the king can ride at a given z.
export const eastLimit = (z) => (z < spread(58) ? HIGHLAND.x1 - 2 : BOUNDS);
// Trails inside the mountains, from the fort gate out to each mine and quarry.
export const HIGHLAND_TRAILS = [
  [[40, -8], [56, -8], [66, -14], [76, -18], [88, -24], [96, -33]],
  [[56, -8], [62, 2], [72, 10], [80, 15]],
  [[66, -14], [63, -28], [61, -39]],
  [[76, -18], [83, -9]],
].map((t) => t.map(P));
// The Iron Hills: an iron-rich field east of the road past the Riverford
// Outpost. The outpost claims it; an Iron Mine works it.
export const IRON = { x: spread(40), z: spread(64), r: 12 };
// Landmarks the king discovers as he rides out: each gets a short camera
// reveal the first time he comes within `sight` metres. Working names.
export const LANDMARKS = [
  { id: 'forest', name: 'The Greenwood', sub: 'Pines and timber beyond the river', x: -4, z: spread(-29) - 14, sight: 22 },
  // Seen close up, or revealed from the foothill overlook (slice.js). A
  // landmark may also name a `view` point { x, z, r } it is seen from.
  { id: 'fort', name: 'The Mountain Fort', sub: 'It holds the only way into the eastern mountains', x: spread(46), z: -8, sight: 16 },
  { id: 'riverford', name: 'Riverford', sub: 'The first camp on the road south', x: spread(1), z: spread(58), sight: 40 },
  { id: 'iron', name: 'The Iron Hills', sub: 'Rust-streaked rock, full of ore', x: spread(40), z: spread(64), sight: 34 },
  { id: 'stonehill', name: 'Stonehill', sub: 'Halfway to the enemy', x: spread(-12), z: spread(106), sight: 40 },
  { id: 'stonebridge', name: 'The Old Stone Bridge', sub: 'Broken long ago. The new road crosses upstream', x: -46, z: spread(-29), sight: 20 },
  { id: 'stronghold', name: 'The Enemy Stronghold', sub: 'The Warlord waits behind its walls', x: 0, z: spread(179), sight: 75 },
];
// The Greenwood journey: authored places along the opening route (working
// names). Each is a site with props; slice.js says what happens there.
// Where the river rises: falls from the eastern mountains.
export const FALLS = { x: HIGHLAND.x0 + 1, z: RIVER_Z };
export const SITES = {
  farmland: { x: -64, z: 30, r: 13, name: "King's Farmland" },
  village: { x: -63, z: -30, r: 11, name: 'The Fallen Village' },
  ruin: { x: -36, z: -70, r: 6, name: 'The Old Ruin' },
  ridge: { x: 51, z: -37, r: 7, name: 'The East Ridge' },
  overlook: { x: 54, z: -28, r: 4, name: 'The Foothill Overlook' },
  // A landmark, not an encounter: the broken arches of an older crossing.
  stonebridge: { x: -46, z: RIVER_Z, r: 6, name: 'The Old Stone Bridge' },
  // The six realms' landmarks (world concept): scenery, not encounters.
  hamlet: { x: -58, z: 66, r: 7, name: 'Meadow hamlet' },
  hamlet2: { x: -62, z: -8, r: 7, name: 'West hamlet' },
  sunCity: { x: -64, z: 128, r: 11, name: 'The Golden City of Sunscorch' },
  oasis: { x: -38, z: 86, r: 7, name: 'The Oasis' },
  mesa1: { x: -72, z: 96, r: 4, name: 'Red mesa' },
  mesa2: { x: -30, z: 168, r: 4, name: 'Red mesa' },
  frostCitadel: { x: 60, z: 186, r: 11, name: 'The Frost Citadel' },
  frozenLake: { x: 32, z: 140, r: 7, name: 'The frozen lake' },
  foundry: { x: 68, z: 104, r: 8, name: 'The Iron Foundry' },
  lava1: { x: 76, z: 94, r: 3.5, name: 'Lava pool' },
  lava2: { x: 44, z: 70, r: 3.5, name: 'Lava pool' },
  mountainCastle: { x: 110, z: -70, r: 8, name: 'The Mountain Hold' },
  viaduct: { x: 96, z: -80, r: 6, name: 'The high viaduct' },
  warcamp: { x: -34, z: 204, r: 7, name: "The Warlord's camp" },
  warcamp2: { x: 34, z: 200, r: 7, name: "The Warlord's camp" },
};
// Props at each site, offsets from its centre. `r` > 0 makes it solid to the
// king (a circle). The renderer builds the same list.
const prop = (site, kind, dx, dz, r = 0, ry = 0) => ({ site, kind, x: SITES[site].x + dx, z: SITES[site].z + dz, r, ry });
export const SITE_PROPS = [
  prop('farmland', 'field', -6, -6, 0, 0), prop('farmland', 'field', 4, -6, 0, 0),
  prop('farmland', 'field', -6, 5, 0, Math.PI / 2), prop('farmland', 'field', 4, 5, 0, 0),
  prop('farmland', 'barn', 11, -1, 2.2, -Math.PI / 2), prop('farmland', 'hay', 9.5, 4, 0.8), prop('farmland', 'hay', 11, 5.5, 0.8),
  prop('farmland', 'scarecrow', -6, 5), prop('farmland', 'cart', -12, 0, 1.0, 0.4),
  prop('village', 'cottage', -5, -4, 2.2, 0.3), prop('village', 'cottage', 4, -5, 2.2, -0.2), prop('village', 'cottage', -1, 5, 2.2, Math.PI + 0.1),
  prop('village', 'well', 1, 0, 0.9), prop('village', 'cart', 6, 3, 1.0, -0.6), prop('village', 'hay', -6, 3, 0.8),
  prop('village', 'garden', -7.5, -0.5, 0, 0), prop('village', 'laundry', 3, 6.5, 0, 0.2),
  prop('village', 'tent', 8, -1, 0, -0.4), prop('village', 'tent', -8.5, -8.5, 0, 0.7), prop('village', 'campfire', -2.5, 0.5),
  prop('ruin', 'column', 3, 0, 0.6), prop('ruin', 'column', 0.9, 2.9, 0.6), prop('ruin', 'column', -2.4, 1.8, 0.6),
  prop('ruin', 'column', -2.4, -1.8, 0.6), prop('ruin', 'arch', 0.9, -2.9, 0.9, 1.2), prop('ruin', 'chest', 0, 0),
  prop('ridge', 'watchtower', 2.5, -2, 1.4), prop('ridge', 'tent', -3, -3, 0, 0.5), prop('ridge', 'tent', -2.5, 3, 0, -0.3), prop('ridge', 'campfire', 0, 0.5),
  prop('overlook', 'cairn', 0, 0, 0.8),
  prop('stonebridge', 'bridgeRuin', 0, 0),
  prop('farmland', 'windmill', -11, -9, 1.6),
  prop('hamlet', 'home', -3, -2, 2.2, 0.4), prop('hamlet', 'home', 3, 1, 2.2, -0.5), prop('hamlet', 'well', 0, 3.8, 0.9), prop('hamlet', 'fence', -1, 6, 0), prop('hamlet', 'hay', 4.5, -3.5, 0.8),
  prop('hamlet2', 'home', -2, 2, 2.2, 2.8), prop('hamlet2', 'home', 3, -2, 2.2, -2.4), prop('hamlet2', 'hay', -4, -3, 0.8), prop('hamlet2', 'cart', 4, 3, 1.0, 0.8), prop('hamlet2', 'garden', 0, -5, 0),
  prop('sunCity', 'sunCity', 0, 0, 10.6), prop('sunCity', 'palm', 13, -9), prop('sunCity', 'palm', 14, 8), prop('sunCity', 'palm', 12.5, 11.5),
  prop('oasis', 'oasis', 0, 0), prop('oasis', 'pool', 0, 0), prop('oasis', 'palm', 4.6, 1.5), prop('oasis', 'palm', -3.5, 3.4), prop('oasis', 'palm', -1, -4.8), prop('oasis', 'palm', 3, -3.8),
  prop('mesa1', 'mesa', 0, 0, 3.2), prop('mesa2', 'mesa', 0, 0, 3.2, 1.2),
  prop('frostCitadel', 'frostCitadel', 0, 0, 10.5), prop('frostCitadel', 'frostGlow', 0, 0),
  prop('frozenLake', 'frozenLake', 0, 0), prop('frozenLake', 'iceCrystal', 7.5, 4, 0.8), prop('frozenLake', 'iceCrystal', -7, -4, 0.8, 1),
  prop('foundry', 'foundry', 0, 0, 7.5), prop('foundry', 'foundryGlow', 0, 0), prop('foundry', 'slag', -7, 5, 1.0),
  prop('lava1', 'lava', 0, 0), prop('lava1', 'lavaCrust', 0, 0), prop('lava2', 'lava', 0, 0), prop('lava2', 'lavaCrust', 0, 0), prop('lava2', 'slag', 3.5, 3, 1.0),
  prop('mountainCastle', 'mountainCastle', 0, 0, 7.2),
  prop('viaduct', 'viaduct', 0, 0),
  prop('warcamp', 'warBanner', -2, -2, 0.3), prop('warcamp', 'spikes', 2, 3, 0, 0.3), prop('warcamp', 'brokenCart', -3, 3, 1.2, 0.6), prop('warcamp', 'blackRock', 4, -3, 1.4), prop('warcamp', 'emberCrack', 0, 0), prop('warcamp', 'deadTree', -5, -4), prop('warcamp', 'deadTree', 5, 4),
  prop('warcamp2', 'warBanner', 2, -2, 0.3), prop('warcamp2', 'spikes', -2, 3, 0, -0.3), prop('warcamp2', 'blackRock', -4, -3, 1.4), prop('warcamp2', 'emberCrack', 0, 0), prop('warcamp2', 'deadTree', 5, -4), prop('warcamp2', 'brokenCart', 3, 3.5, 1.2, -0.8),
];
const inSite = (x, z, pad) => Object.values(SITES).some((S) => Math.hypot(x - S.x, z - S.z) < S.r + pad);

// Land around a claimed outpost where houses, farms and workshops can go.
export const OUTPOST_ZONE = 14;
// Enemy camps guarding the trails. Each is a list of enemy kinds.
export const CAMPS = [
  { id: 'camp-1', x: 66, z: -6, kinds: ['grunt', 'grunt', 'grunt', 'archer'] },
  { id: 'camp-2', x: 69, z: 7, kinds: ['grunt', 'grunt', 'brute', 'archer'] },
  { id: 'camp-3', x: 70, z: -26, kinds: ['grunt', 'grunt', 'archer', 'archer', 'brute'] },
  { id: 'camp-4', x: 90, z: -18, kinds: ['grunt', 'brute', 'brute', 'archer', 'archer'] },
].map(PP);

// Enemy lanes, from the map edge in to the castle. `opens` is the first wave
// that uses the lane.
const LANE_DEFS = [
  {
    id: 'S', name: 'South', opens: 1,
    pts: [[0, 179], [-10, 166], [-8, 148], [9, 133], [11, 117], [-3, 102], [-9, 86], [1, 73], [8, 63], [14, 48], [4, 38], [-8, 30], [-6, 20], [0, 12], [0, 5]],
  },
  { id: 'E', name: 'East', opens: 4, pts: [[108, 50], [88, 52], [68, 46], [52, 37], [38, 22], [26, 8], [16, 1], [5, 0]] },
  { id: 'W', name: 'West', opens: 8, pts: [[-64, 10], [-48, 4], [-36, 12], [-24, 6], [-14, 2], [-5, 0]] },
  { id: 'N', name: 'Forest', opens: 11, pts: [[-4, -64], [-10, -48], [0, -38], [-5, -26], [-2, -14], [0, -5]] },
];

// Uniform Catmull-Rom through the control points, resampled to ~1 m steps so
// "distance along the lane" is a simple index lookup.
function sampleLane(ctrl) {
  const raw = [];
  const P = (i) => ctrl[Math.max(0, Math.min(ctrl.length - 1, i))];
  for (let i = 0; i < ctrl.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * ((2 * b) + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      raw.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  raw.push(ctrl[ctrl.length - 1]);

  // Resample evenly.
  const pts = [raw[0]];
  const cum = [0];
  let acc = 0;
  let carry = 0;
  for (let i = 1; i < raw.length; i++) {
    const [ax, az] = raw[i - 1];
    const [bx, bz] = raw[i];
    const seg = Math.hypot(bx - ax, bz - az);
    let d = 1 - carry;
    while (d <= seg) {
      const t = d / seg;
      pts.push([ax + (bx - ax) * t, az + (bz - az) * t]);
      acc += 1;
      cum.push(acc);
      d += 1;
    }
    carry = seg - (d - 1);
  }
  const last = raw[raw.length - 1];
  const lp = pts[pts.length - 1];
  const tail = Math.hypot(last[0] - lp[0], last[1] - lp[1]);
  if (tail > 0.05) { pts.push(last); cum.push(acc + tail); }
  return { pts, cum, length: cum[cum.length - 1] };
}

export const LANES = LANE_DEFS.map((d) => ({ ...d, ...sampleLane(d.pts.map(P)) }));
export const LANE = Object.fromEntries(LANES.map((l) => [l.id, l]));

// Position (and heading) at distance s along a lane.
export function lanePoint(lane, s, out = { x: 0, z: 0, dx: 0, dz: 1 }) {
  const n = lane.pts.length;
  if (s <= 0) s = 0;
  if (s >= lane.length) s = lane.length - 0.0001;
  let i = Math.min(n - 2, Math.floor(s));
  while (i > 0 && lane.cum[i] > s) i--;
  while (i < n - 2 && lane.cum[i + 1] < s) i++;
  const a = lane.pts[i], b = lane.pts[i + 1];
  const segLen = lane.cum[i + 1] - lane.cum[i] || 1;
  const t = (s - lane.cum[i]) / segLen;
  out.x = a[0] + (b[0] - a[0]) * t;
  out.z = a[1] + (b[1] - a[1]) * t;
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  out.dx = (b[0] - a[0]) / len;
  out.dz = (b[1] - a[1]) / len;
  return out;
}

// Distance along the lane where it first enters the square of half width h.
export function laneCrossing(lane, h) {
  for (let i = 0; i < lane.pts.length; i++) {
    const [x, z] = lane.pts[i];
    if (Math.max(Math.abs(x), Math.abs(z)) <= h) return lane.cum[i];
  }
  return lane.length;
}

// Distance along a lane where it first comes south of (below) z.
export function laneAtZ(lane, z) {
  for (let i = 0; i < lane.pts.length; i++) if (lane.pts[i][1] <= z) return lane.cum[i];
  return 0;
}

// Shortest distance from a point to any lane centreline.
export function distToLanes(x, z, lanes = LANES) {
  let best = Infinity;
  for (const lane of lanes) {
    const p = lane.pts;
    for (let i = 0; i < p.length - 1; i++) {
      const d = segDist(x, z, p[i][0], p[i][1], p[i + 1][0], p[i + 1][1]);
      if (d < best) best = d;
    }
  }
  return best;
}

export function segDist(px, pz, ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az;
  const l2 = dx * dx + dz * dz || 1;
  let t = ((px - ax) * dx + (pz - az) * dz) / l2;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(px - (ax + dx * t), pz - (az + dz * t));
}

// Where the forest lane fords the river — the bridge goes here.
export const BRIDGE = (() => {
  const lane = LANE.N;
  for (let i = 0; i < lane.pts.length - 1; i++) {
    const [ax, az] = lane.pts[i], [bx, bz] = lane.pts[i + 1];
    if ((az - RIVER_Z) * (bz - RIVER_Z) <= 0) {
      const t = (RIVER_Z - az) / (bz - az || 1);
      return { x: ax + (bx - ax) * t, z: RIVER_Z, s: lane.cum[i] + t };
    }
  }
  return { x: 0, z: RIVER_Z, s: 0 };
})();

export function inRiver(x, z) {
  return Math.abs(z - RIVER_Z) < RIVER_HALF;
}

// Tower pads sit beside each lane at set distances back from the castle,
// alternating sides of the road.
function towerPads() {
  const out = [];
  const back = [21, 32, 43];
  for (const lane of LANES) {
    back.forEach((d, k) => {
      const s = lane.length - d;
      const p = lanePoint(lane, s);
      const side = k % 2 === 0 ? 1 : -1;
      // Perpendicular to the road.
      out.push({
        id: `tower-${lane.id}${k + 1}`,
        type: 'tower',
        lane: lane.id,
        x: Math.round((p.x - p.dz * 4.4 * side) * 2) / 2,
        z: Math.round((p.z + p.dx * 4.4 * side) * 2) / 2,
      });
    });
  }
  return out;
}

// Catapults: one covering each of the first roads in, and around each
// outpost a catapult and two more towers to hold the new land.
function defencePads() {
  const out = [];
  const side = (lane, back, off, id, type, needs) => {
    const p = lanePoint(lane, lane.length - back);
    out.push({ id, type, lane: lane.id, needs, x: Math.round((p.x - p.dz * off) * 2) / 2, z: Math.round((p.z + p.dx * off) * 2) / 2 });
  };
  side(LANE.S, 52, -6, 'catapult-S', 'catapult');
  side(LANE.E, 52, -6, 'catapult-E', 'catapult');
  const S = LANE.S;
  ['outpost-1', 'outpost-2', 'outpost-3'].forEach((oid, k) => {
    const o = OUTPOST_SPOTS[k];
    // Nearest point on the south road to the outpost.
    let best = 0, bd = Infinity;
    for (let i = 0; i < S.pts.length; i++) { const d = Math.hypot(S.pts[i][0] - o.x, S.pts[i][1] - o.z); if (d < bd) { bd = d; best = S.cum[i]; } }
    const at = S.length - best;
    // Which side of the road the outpost stands on: defences go opposite.
    const p = lanePoint(S, best);
    const sgn = Math.sign((o.x - p.x) * -p.dz + (o.z - p.z) * p.dx) || 1;
    side(S, at + 12, -sgn * 4.4, `tower-O${k + 1}a`, 'tower', oid);
    side(S, at - 12, -sgn * 4.4, `tower-O${k + 1}b`, 'tower', oid);
    side(S, at, -sgn * 6.5, `catapult-O${k + 1}`, 'catapult', oid);
  });
  return out;
}
const OUTPOST_SPOTS = [[1, 58], [-12, 106], [9, 151]].map(([x, z]) => ({ x: spread(x), z: spread(z) }));

// Every fixed pad. `size` is the footprint in metres.
export const FIXED_PADS = [
  { id: 'bridge', type: 'bridge', x: BRIDGE.x, z: BRIDGE.z },
  // Stands for the Mountain Fort: built once the fort is taken (never bought).
  { id: 'pass', type: 'pass', x: FORT.x, z: FORT.z },
  PP({ id: 'goldmine', type: 'goldmine', x: 87, z: -5 }),
  PP({ id: 'lumber-1', type: 'lumber', x: -14, z: -38 }),
  PP({ id: 'lumber-2', type: 'lumber', x: 13, z: -38 }),
  PP({ id: 'lumber-3', type: 'lumber', x: 27, z: -43 }),
  PP({ id: 'quarry-1', type: 'quarry', x: 61, z: -43 }),
  PP({ id: 'quarry-2', type: 'quarry', x: 84, z: 18 }),
  PP({ id: 'quarry-5', type: 'quarry', x: 99, z: -37, needs: 'pass' }),
  // The road south.
  PP({ id: 'outpost-1', type: 'outpost', x: 1, z: 58 }),
  PP({ id: 'outpost-2', type: 'outpost', x: -12, z: 106 }),
  PP({ id: 'outpost-3', type: 'outpost', x: 9, z: 151 }),
  PP({ id: 'goldmine-2', type: 'goldmine', x: -24, z: 82, needs: 'outpost-1' }),
  PP({ id: 'lumber-4', type: 'lumber', x: 27, z: 92, needs: 'outpost-1' }),
  PP({ id: 'quarry-3', type: 'quarry', x: -26, z: 126, needs: 'outpost-2' }),
  PP({ id: 'goldmine-3', type: 'goldmine', x: 28, z: 128, needs: 'outpost-2' }),
  { id: 'ironmine-1', type: 'ironmine', x: IRON.x - 13, z: IRON.z + 2 },
  ...towerPads(),
  ...defencePads(),
];

// Where the starting buildings stand.
export const START = {
  house: { x: -10, z: 8 },
  hero: { x: 3, z: 9 },
  tower: 'tower-S1',
  coins: { x: 4, z: 13, n: 30 },
};

// Scenery: trees in the forest and scattered across the land, rocks by the
// quarries and mines, crags around the highland and cliffs walling in the
// map. Seeded so the kingdom looks the same every load.
const outside = (x, z, pad) => Math.max(Math.abs(x), Math.abs(z)) > WALL_HALF[WALL_HALF.length - 1] + pad;
const nearStronghold = (x, z, pad) => Math.abs(x - STRONGHOLD.x) < STRONGHOLD.half + pad && z > STRONGHOLD.gateZ - 8 - pad;

export function scenery() {
  const rnd = mulberry32(1337);
  const trees = [];
  const rocks = [];
  const pads = FIXED_PADS;
  const clearOf = (x, z, r) => pads.every((p) => Math.hypot(p.x - x, p.z - z) > r);
  const spaced = (x, z, d) => !trees.some((t) => Math.abs(t.x - x) < d && Math.abs(t.z - z) < d && Math.hypot(t.x - x, t.z - z) < d);

  // The forest: dense pines north of the river.
  for (let i = 0; i < 2600 && trees.length < 520; i++) {
    const x = spread(-62) + rnd() * (RIVER_X1 - spread(-62));
    const z = FOREST_Z - 1 - rnd() * 32;
    if (distToLanes(x, z, [LANE.N]) < PATH_HALF + 1.4) continue;
    if (!clearOf(x, z, 4.6)) continue;
    if (!spaced(x, z, 1.7)) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28, forest: true });
  }
  // A thinner fringe on the grassland side of the river bank.
  for (let i = 0; i < 400; i++) {
    const x = spread(-60) + rnd() * (RIVER_X1 - spread(-60) - 2);
    const z = RIVER_Z + RIVER_HALF + 1 + rnd() * 3;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (!outside(x, z, 3)) continue;
    if (inHighland(x + 2, z)) continue;
    if (rnd() < 0.7) continue;
    trees.push({ x, z, s: 0.7 + rnd() * 0.4, r: rnd() * 6.28 });
  }
  // Scattered pines across the grassland and down the road south.
  for (let i = 0; i < 4000 && trees.length < 960; i++) {
    const z = RIVER_Z + RIVER_HALF + 2 + rnd() * (spread(215) - RIVER_Z);
    const x = spread(-54) + rnd() * (eastLimit(z) - spread(-54));
    if (!outside(x, z, 4)) continue;
    if (inHighland(x + 4, z - 4)) continue;
    if (Math.hypot(x - FORT.x, z - FORT.z) < 12) continue;
    if (nearStronghold(x, z, 4)) continue;
    if (distToLanes(x, z) < PATH_HALF + 2.5) continue;
    if (!clearOf(x, z, 5)) continue;
    if (!spaced(x, z, 3.6)) continue;
    // Clumps: thicker towards the cliffs at the edges.
    if (rnd() > 0.18 + Math.abs(Math.min(x, 84)) / 94) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28 });
  }
  // A grove around the southern lumber camp.
  const grove = pads.find((p) => p.id === 'lumber-4');
  for (let i = 0; i < 300; i++) {
    const a = rnd() * Math.PI * 2, d = 4.6 + rnd() * 11;
    const x = grove.x + Math.cos(a) * d, z = grove.z + Math.sin(a) * d;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (!clearOf(x, z, 4.6) || !spaced(x, z, 1.9)) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28, forest: true });
  }

  // Rocks around the quarries and the mines.
  for (const p of pads) {
    if (p.type !== 'quarry' && p.type !== 'goldmine') continue;
    for (let k = 0; k < 7; k++) {
      const a = rnd() * Math.PI * 2;
      const d = 3.6 + rnd() * 2.6;
      const x = p.x + Math.cos(a) * d, z = p.z + Math.sin(a) * d;
      if (distToLanes(x, z) < PATH_HALF + 1) continue;
      rocks.push({ x, z, s: 0.6 + rnd() * 0.9, r: rnd() * 6.28, highland: inHighland(x, z) || undefined });
    }
  }
  // The Iron Hills: rust-streaked rocks that hold iron ore.
  for (let i = 0; i < 1200 && rocks.filter((r) => r.iron).length < 46; i++) {
    const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd()) * IRON.r;
    const x = IRON.x + Math.cos(a) * d, z = IRON.z + Math.sin(a) * d;
    if (distToLanes(x, z) < PATH_HALF + 2 || !clearOf(x, z, 4.2)) continue;
    if (rocks.some((r) => Math.abs(r.x - x) < 2.1 && Math.abs(r.z - z) < 2.1)) continue;
    rocks.push({ x, z, s: 0.5 + rnd() * 0.55, r: rnd() * 6.28, iron: true });
  }
  // A few loose boulders.
  for (let i = 0; i < 80 && rocks.length < 110; i++) {
    const x = spread(-50) + rnd() * 2 * spread(50), z = spread(-24) + rnd() * (spread(166) - spread(-24));
    if (!outside(x, z, 3)) continue;
    if (nearStronghold(x, z, 2)) continue;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (!clearOf(x, z, 5)) continue;
    rocks.push({ x, z, s: 0.4 + rnd() * 0.5, r: rnd() * 6.28 });
  }

  const cliffs = [];
  // The mountains: a crag wall along the west face (broken only by the fort
  // gate) and the south face, peaks rising inside, and boulders everywhere.
  const H = HIGHLAND;
  const trailDist = (x, z) => Math.min(...HIGHLAND_TRAILS.flatMap((t) => t.slice(1).map((p, k) => segDist(x, z, t[k][0], t[k][1], p[0], p[1]))));
  const crag = (x, z, big = 1, h = 2.4 + rnd() * 2.6) => {
    if (!clearOf(x, z, 3.6) || distToLanes(x, z) < PATH_HALF + 3) return;
    cliffs.push({ x, z, w: (2.8 + rnd() * 1.8) * big, h, d: (2.8 + rnd() * 1.8) * big, r: rnd() * 6.28 });
  };
  for (let z = H.z0; z <= H.z1; z += 2.6) {
    if (Math.abs(z - H.gorgeZ) < 9) continue;   // the fort's walls fill the gap
    if (Math.abs(z - RIVER_Z) < 3.4) continue;   // the falls where the river rises
    crag(H.x0 - 0.3 - rnd() * 0.8, z, 1, 3 + rnd() * 3);
  }
  for (let x = H.x0; x <= H.x1 + 4; x += 2.6) crag(x, H.z1 + 0.6 + rnd() * 0.8, 1, 3 + rnd() * 3);
  // Peaks inside, taller towards the east.
  for (let i = 0; i < 900 && cliffs.filter((c) => c.peak).length < 46; i++) {
    const x = H.x0 + 8 + rnd() * (H.x1 - H.x0 - 6), z = H.z0 + 2 + rnd() * (H.z1 - H.z0 - 4);
    if (trailDist(x, z) < 6 || !clearOf(x, z, 9) || CAMPS.some((c) => Math.hypot(c.x - x, c.z - z) < 7)) continue;
    if (cliffs.some((c) => c.peak && Math.hypot(c.x - x, c.z - z) < 7)) continue;
    const k = (x - H.x0) / (H.x1 - H.x0);
    cliffs.push({ x, z, w: 4 + rnd() * 4, h: 5 + k * 9 + rnd() * 4, d: 4 + rnd() * 4, r: rnd() * 6.28, peak: true });
  }
  // Boulders: the king and masons break these up for stone.
  for (let i = 0; i < 4000 && rocks.filter((r) => r.highland).length < 150; i++) {
    const x = H.x0 + 3 + rnd() * (H.x1 - H.x0 - 5), z = H.z0 + 2 + rnd() * (H.z1 - H.z0 - 4);
    if (!clearOf(x, z, 3.8) || trailDist(x, z) < 1.9) continue;
    if (cliffs.some((c) => c.peak && Math.abs(c.x - x) < c.w / 2 + 1.2 && Math.abs(c.z - z) < c.d / 2 + 1.2)) continue;
    if (rocks.some((r) => Math.abs(r.x - x) < 2 && Math.abs(r.z - z) < 2)) continue;
    rocks.push({ x, z, s: 0.45 + rnd() * 0.6, r: rnd() * 6.28, highland: true });
  }

  // Mountains walling in the whole map. The south-east corner is open
  // ground where the east road comes in; lane mouths stay open.
  const wall = (x, z) => {
    if (distToLanes(x, z) < 7) return;
    cliffs.push({ x, z, w: 7 + rnd() * 6, h: 4 + rnd() * 7, d: 7 + rnd() * 6, r: rnd() * 6.28 });
  };
  const sp = spread;
  for (let x = sp(-68); x <= sp(114); x += 4.6) wall(x, sp(-60) - rnd() * 8);
  for (let z = sp(-68); z <= sp(222); z += 4.6) wall(sp(-60) - rnd() * 8, z);
  for (let z = sp(-68); z <= sp(66); z += 4.6) wall(sp(108) + rnd() * 8, z);
  for (let x = sp(58); x <= sp(114); x += 4.6) wall(x, sp(64) + rnd() * 6);
  for (let z = sp(64); z <= sp(222); z += 4.6) wall(sp(60) + rnd() * 8, z);
  for (let x = sp(-68); x <= sp(68); x += 4.6) wall(x, sp(214) + rnd() * 8);

  // Clear the journey's sites.
  return { trees: trees.filter((t) => !inSite(t.x, t.z, 3)), rocks: rocks.filter((r) => r.iron || !inSite(r.x, r.z, 2)), cliffs: cliffs.filter((c) => !c.peak || !inSite(c.x, c.z, c.w)) };
}
