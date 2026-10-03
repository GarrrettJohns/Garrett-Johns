// The kingdom's fixed layout: the paths enemies march down, the river that
// separates the grassland from the forest, the wall rings, and every fixed
// build pad. Pure data and geometry — no three.js — so the simulation can run
// headless for balance testing.
//
// World is the XZ plane in metres. The castle sits at the origin. North is -z,
// which is "up" on screen because the camera looks down from +z.

import { mulberry32 } from './util.js';

export const BOUNDS = 56;          // hero stays inside ±BOUNDS across (and north)
export const RIVER_Z = -29;        // centre line of the river
export const RIVER_HALF = 2.2;     // half width of the water
export const FOREST_Z = -32;       // the forest starts north of this line
export const WALL_HALF = [16, 20, 24];  // the square fortress walls, by level (half widths)
export const CASTLE_R = 4.5;       // half width of the (square) castle
export const GATE_GAP = 2.5;       // half width of the opening a gate fills
export const PATH_HALF = 1.7;      // half width of a dirt road
export const GRID = 2;             // placement grid cell size

// The enemy stronghold at the far end of the south road, and the stretch of
// road the king claims on the way there. Each outpost pushes the frontier
// (how far south he can ride, and where southern enemies muster) further on.
export const STRONGHOLD = { x: 0, z: 190, gateZ: 179, half: 15 };
export const FRONTIERS = [62, 110, 156, 212];
export const OUTPOSTS = [
  { id: 'outpost-1', name: 'Riverford Outpost', wave: 4, cost: { gold: 120, wood: 40 } },
  { id: 'outpost-2', name: 'Stonehill Outpost', wave: 9, cost: { gold: 220, wood: 80, stone: 60 } },
  { id: 'outpost-3', name: 'Siege Camp', wave: 14, cost: { gold: 340, wood: 120, stone: 120 } },
];

// The rocky highland east of the castle, walled in by crags between the east
// road and the river. The only way in is a narrow gorge on its west side,
// sealed by a rockfall until the king clears the Mountain Pass. Enemy camps
// hold the trail inside.
export const HIGHLAND = { x0: 30, x1: 57, z0: -26.6, z1: -11, gorgeZ: -18.5, gorgeHalf: 2.4 };
export const MOUNTAIN = { x: (HIGHLAND.x0 + HIGHLAND.x1) / 2, z: (HIGHLAND.z0 + HIGHLAND.z1) / 2, r: 12 };
export const inHighland = (x, z) => x > HIGHLAND.x0 && z < HIGHLAND.z1 && z > HIGHLAND.z0 - 3;
export const GORGE_OUT = { x: HIGHLAND.x0 - 4.5, z: HIGHLAND.gorgeZ };   // just outside the gorge
export const GORGE_IN = { x: HIGHLAND.x0 + 3.5, z: HIGHLAND.gorgeZ };    // just inside it
// Trails inside the highland, from the gorge to each mine and quarry.
export const HIGHLAND_TRAILS = [
  [[24, -18.5], [33.5, -18.5], [38, -17], [44, -16.5], [48.5, -16]],
  [[38, -17], [38.5, -20.5]],
  [[44, -16.5], [47, -20.5]],
];
// Enemy camps guarding the trail. Each is a list of enemy kinds.
export const CAMPS = [
  { id: 'camp-1', x: 36, z: -15, kinds: ['grunt', 'grunt', 'grunt', 'archer'] },
  { id: 'camp-2', x: 43, z: -20.5, kinds: ['grunt', 'grunt', 'brute', 'archer'] },
  { id: 'camp-3', x: 53, z: -21, kinds: ['grunt', 'grunt', 'archer', 'archer', 'brute'] },
];

// Enemy lanes, from the map edge in to the castle. `opens` is the first wave
// that uses the lane.
const LANE_DEFS = [
  {
    id: 'S', name: 'South', opens: 1,
    pts: [[0, 179], [-10, 166], [-8, 148], [9, 133], [11, 117], [-3, 102], [-9, 86], [1, 73], [8, 63], [14, 48], [4, 38], [-8, 30], [-6, 20], [0, 12], [0, 5]],
  },
  { id: 'E', name: 'East', opens: 4, pts: [[64, -4], [48, 2], [38, -6], [28, 2], [18, 0], [5, 0]] },
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

export const LANES = LANE_DEFS.map((d) => ({ ...d, ...sampleLane(d.pts) }));
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
  const back = [13, 23, 33];
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

// Every fixed pad. `size` is the footprint in metres.
export const FIXED_PADS = [
  { id: 'bridge', type: 'bridge', x: BRIDGE.x, z: BRIDGE.z },
  { id: 'pass', type: 'pass', x: 27.5, z: -18.5 },
  { id: 'goldmine', type: 'goldmine', x: 52, z: -15 },
  { id: 'lumber-1', type: 'lumber', x: -14, z: -38 },
  { id: 'lumber-2', type: 'lumber', x: 13, z: -38 },
  { id: 'lumber-3', type: 'lumber', x: 27, z: -43 },
  { id: 'quarry-1', type: 'quarry', x: 38.5, z: -23 },
  { id: 'quarry-2', type: 'quarry', x: 47, z: -23.2 },
  // The road south.
  { id: 'outpost-1', type: 'outpost', x: 1, z: 58 },
  { id: 'outpost-2', type: 'outpost', x: -12, z: 106 },
  { id: 'outpost-3', type: 'outpost', x: 9, z: 151 },
  { id: 'goldmine-2', type: 'goldmine', x: -24, z: 82, needs: 'outpost-1' },
  { id: 'lumber-4', type: 'lumber', x: 27, z: 92, needs: 'outpost-1' },
  { id: 'quarry-3', type: 'quarry', x: -26, z: 126, needs: 'outpost-2' },
  { id: 'goldmine-3', type: 'goldmine', x: 28, z: 128, needs: 'outpost-2' },
  ...towerPads(),
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
const outside = (x, z, pad) => Math.max(Math.abs(x), Math.abs(z)) > WALL_HALF[2] + pad;
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
    const x = -62 + rnd() * 124;
    const z = FOREST_Z - 1 - rnd() * 32;
    if (distToLanes(x, z, [LANE.N]) < PATH_HALF + 1.4) continue;
    if (!clearOf(x, z, 4.6)) continue;
    if (!spaced(x, z, 1.7)) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28, forest: true });
  }
  // A thinner fringe on the grassland side of the river bank.
  for (let i = 0; i < 400; i++) {
    const x = -60 + rnd() * 120;
    const z = RIVER_Z + RIVER_HALF + 1 + rnd() * 3;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (!outside(x, z, 3)) continue;
    if (inHighland(x + 2, z)) continue;
    if (rnd() < 0.7) continue;
    trees.push({ x, z, s: 0.7 + rnd() * 0.4, r: rnd() * 6.28 });
  }
  // Scattered pines across the grassland and down the road south.
  for (let i = 0; i < 3000 && trees.length < 900; i++) {
    const x = -54 + rnd() * 108;
    const z = RIVER_Z + RIVER_HALF + 2 + rnd() * (215 - RIVER_Z);
    if (!outside(x, z, 4)) continue;
    if (inHighland(x + 3, z - 3)) continue;
    if (nearStronghold(x, z, 4)) continue;
    if (distToLanes(x, z) < PATH_HALF + 2.5) continue;
    if (!clearOf(x, z, 5)) continue;
    if (!spaced(x, z, 3.6)) continue;
    // Clumps: thicker towards the cliffs at the edges.
    if (rnd() > 0.18 + Math.abs(x) / 70) continue;
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
      rocks.push({ x, z, s: 0.6 + rnd() * 0.9, r: rnd() * 6.28 });
    }
  }
  // A few loose boulders.
  for (let i = 0; i < 80 && rocks.length < 110; i++) {
    const x = -50 + rnd() * 100, z = -24 + rnd() * 190;
    if (!outside(x, z, 3)) continue;
    if (nearStronghold(x, z, 2)) continue;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (!clearOf(x, z, 5)) continue;
    rocks.push({ x, z, s: 0.4 + rnd() * 0.5, r: rnd() * 6.28 });
  }

  const cliffs = [];
  // Crags walling in the highland: its south edge above the east road, and its
  // west edge, broken only by the gorge — itself a short corridor of rock.
  const crag = (x, z, big = 1) => clearOf(x, z, 3.4) && cliffs.push({ x, z, w: (2.6 + rnd() * 1.6) * big, h: 2.2 + rnd() * 2.2, d: (2.6 + rnd() * 1.6) * big, r: rnd() * 6.28 });
  const H = HIGHLAND;
  for (let x = H.x0; x <= H.x1 + 2; x += 2.6) crag(x, H.z1 + 0.6 + rnd() * 0.8);
  for (let z = H.z0 + 1; z <= H.z1; z += 2.6) {
    if (Math.abs(z - H.gorgeZ) < H.gorgeHalf + 1.3) continue;
    crag(H.x0 - 0.4 - rnd() * 0.8, z);
  }
  for (let x = H.x0 - 3.5; x <= H.x0 + 2.5; x += 2.2) {
    crag(x, H.gorgeZ - H.gorgeHalf - 1.8, 0.8);
    crag(x, H.gorgeZ + H.gorgeHalf + 1.8, 0.8);
  }
  // Boulders across the highland: the king can mine these for stone.
  for (let i = 0; i < 160 && rocks.length < 200; i++) {
    const x = H.x0 + 2 + rnd() * (H.x1 - H.x0 - 4), z = H.z0 + 1.5 + rnd() * (H.z1 - H.z0 - 3);
    if (!clearOf(x, z, 4.2)) continue;
    if (HIGHLAND_TRAILS.some((t) => t.some((p, k) => k && segDist(x, z, t[k - 1][0], t[k - 1][1], p[0], p[1]) < 2.2))) continue;
    if (rocks.some((r) => Math.hypot(r.x - x, r.z - z) < 2.2)) continue;
    rocks.push({ x, z, s: 0.45 + rnd() * 0.6, r: rnd() * 6.28, highland: true });
  }

  // Mountains walling in the map: the north edge, both sides all the way down
  // the road, and behind the stronghold. Lane mouths stay open.
  const wall = (x, z) => {
    if (distToLanes(x, z) < 6) return;
    cliffs.push({ x, z, w: 7 + rnd() * 6, h: 4 + rnd() * 7, d: 7 + rnd() * 6, r: rnd() * 6.28 });
  };
  for (let x = -68; x <= 68; x += 4.6) wall(x, -60 - rnd() * 8);
  for (let z = -68; z <= 222; z += 4.6) { wall(60 + rnd() * 8, z); wall(-60 - rnd() * 8, z); }
  for (let x = -68; x <= 68; x += 4.6) wall(x, 214 + rnd() * 8);

  return { trees, rocks, cliffs };
}
