// The kingdom's fixed layout: the paths enemies march down, the river that
// separates the grassland from the forest, the wall rings, and every fixed
// build pad. Pure data and geometry — no three.js — so the simulation can run
// headless for balance testing.
//
// World is the XZ plane in metres. The castle sits at the origin. North is -z,
// which is "up" on screen because the camera looks down from +z.

import { mulberry32 } from './util.js';

export const BOUNDS = 56;          // hero and units stay inside ±BOUNDS
export const RIVER_Z = -29;        // centre line of the river
export const RIVER_HALF = 2.2;     // half width of the water
export const FOREST_Z = -32;       // the forest starts north of this line
export const WALL_RADII = [17, 23, 30];
export const CASTLE_R = 4.6;       // castle footprint radius
export const PATH_HALF = 1.7;      // half width of a dirt road
export const GRID = 2;             // placement grid cell size

// Enemy lanes, from the map edge in to the castle. `opens` is the first wave
// that uses the lane.
const LANE_DEFS = [
  { id: 'S', name: 'South', opens: 1, pts: [[8, 64], [14, 48], [4, 38], [-8, 30], [-6, 20], [0, 12], [0, 5]] },
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

// Distance along the lane where it first comes within radius r of the centre.
export function laneCrossing(lane, r) {
  for (let i = 0; i < lane.pts.length; i++) {
    const [x, z] = lane.pts[i];
    if (Math.hypot(x, z) <= r) return lane.cum[i];
  }
  return lane.length;
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
  { id: 'goldmine', type: 'goldmine', x: -15, z: 15 },
  { id: 'bridge', type: 'bridge', x: BRIDGE.x, z: BRIDGE.z },
  { id: 'lumber-1', type: 'lumber', x: -14, z: -38 },
  { id: 'lumber-2', type: 'lumber', x: 13, z: -38 },
  { id: 'lumber-3', type: 'lumber', x: 27, z: -43 },
  { id: 'quarry-1', type: 'quarry', x: 21, z: -15 },
  { id: 'quarry-2', type: 'quarry', x: 30, z: -18 },
  ...towerPads(),
];

// Where the starting buildings stand.
export const START = {
  house: { x: -6, z: 6 },
  hero: { x: 3, z: 9 },
  tower: 'tower-S1',
  coins: { x: 4, z: 13, n: 14 },
};

// Scenery: trees in the forest and scattered across the grassland, rocks by
// the quarry and the mine. Seeded so the kingdom looks the same every load.
export function scenery() {
  const rnd = mulberry32(1337);
  const trees = [];
  const rocks = [];
  const pads = FIXED_PADS;
  const clearOf = (x, z, r) => pads.every((p) => Math.hypot(p.x - x, p.z - z) > r);

  // The forest: dense pines north of the river.
  for (let i = 0; i < 2600 && trees.length < 520; i++) {
    const x = -62 + rnd() * 124;
    const z = FOREST_Z - 1 - rnd() * 32;
    if (distToLanes(x, z, [LANE.N]) < PATH_HALF + 1.4) continue;
    if (!clearOf(x, z, 4.6)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 1.7)) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.6, r: rnd() * 6.28, forest: true });
  }
  // A thinner fringe on the grassland side of the river bank.
  for (let i = 0; i < 400; i++) {
    const x = -60 + rnd() * 120;
    const z = RIVER_Z + RIVER_HALF + 1 + rnd() * 3;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (Math.hypot(x, z) < WALL_RADII[2] + 3) continue;
    if (rnd() < 0.7) continue;
    trees.push({ x, z, s: 0.7 + rnd() * 0.4, r: rnd() * 6.28 });
  }
  // Scattered pines out in the grassland, beyond the outermost wall.
  for (let i = 0; i < 900 && trees.length < 640; i++) {
    const x = -60 + rnd() * 120;
    const z = RIVER_Z + RIVER_HALF + 2 + rnd() * (62 - RIVER_Z);
    const r = Math.hypot(x, z);
    if (r < WALL_RADII[2] + 4) continue;
    if (distToLanes(x, z) < PATH_HALF + 2.5) continue;
    if (!clearOf(x, z, 5)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 4)) continue;
    // Clumps: more likely near the map edge.
    if (rnd() > 0.25 + (r - 30) / 50) continue;
    trees.push({ x, z, s: 0.8 + rnd() * 0.5, r: rnd() * 6.28 });
  }

  // Rocks around the quarries and the mine.
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
  for (let i = 0; i < 40 && rocks.length < 70; i++) {
    const x = -55 + rnd() * 110, z = -24 + rnd() * 80;
    if (Math.hypot(x, z) < WALL_RADII[2] + 3) continue;
    if (distToLanes(x, z) < PATH_HALF + 2) continue;
    if (!clearOf(x, z, 5)) continue;
    rocks.push({ x, z, s: 0.4 + rnd() * 0.5, r: rnd() * 6.28 });
  }

  // Mountains ringing the map, like the cliffs in the reference shots.
  const cliffs = [];
  for (let i = 0; i < 120; i++) {
    const t = i / 120;
    const side = Math.floor(t * 4);
    const u = (t * 4 - side) * 2 - 1;
    const e = 60 + rnd() * 8;
    let x, z;
    if (side === 0) { x = u * 68; z = -e; }
    else if (side === 1) { x = e; z = u * 68; }
    else if (side === 2) { x = -u * 68; z = e; }
    else { x = -e; z = -u * 68; }
    // Leave the lane mouths open.
    if (distToLanes(x, z) < 6) continue;
    cliffs.push({ x, z, w: 7 + rnd() * 6, h: 4 + rnd() * 7, d: 7 + rnd() * 6, r: rnd() * 6.28 });
  }

  return { trees, rocks, cliffs };
}
