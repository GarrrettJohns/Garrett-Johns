// The royal building kit, built to building_progression.png and the
// Greenwood column of regional_buildings.png (asset workup, selected
// 2026-10-05: "match the images"): cream stone, blue cone roofs with gold
// finials, blue banners with the gold crown, timber and red-roofed homes.
// Every model sits on its footprint centre with the door facing +z.

import * as THREE from './vendor/three.js';
import { Builder, C } from './models.js';
import { emblem } from './units.js';

export const K = {
  stone: 0xe8dfca, stoneMid: 0xd2c8b0, stoneDark: 0xa8a090, base: 0x8a8478,
  roof: 0x2f5fc4, roofDark: 0x234a9e, gold: 0xf2c33a, banner: 0x2f62c8,
  wood: 0x9a6a41, woodDark: 0x6e4a2c, woodLight: 0xc08a55, plank: 0xb47d4c,
  red: 0xc0503a, redDark: 0x9a3a2a, cream: 0xf2ead8, window: 0x2e3a52, moss: 0x6fae4f,
  iron: 0x6a7078, ironDark: 0x464c54,
};

const M = (x, y, z, ry = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry));

// A hanging royal banner: a blue cloth with a pointed foot and a gold crown,
// facing along ry (0 = +z).
export function banner(b, x, y, z, ry = 0, w = 0.7, h = 1.3, color = K.banner) {
  const m = M(x, y, z, ry);
  b.box(w + 0.1, 0.08, 0.08, K.woodDark, { y: 0, m });
  b.box(w, h, 0.05, color, { y: -h, m });
  b.box(w + 0.02, 0.07, 0.06, K.gold, { y: -h + 0.02, m });
  b.cone(w / 2, h * 0.3, 4, color, { y: -h - h * 0.28, rx: Math.PI, ry: Math.PI / 4, sz: 0.08, sx: 1.4, m });
  emblem(b, 'crown', M(x, y - h * 0.45, z, ry).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.03)), w * 0.9, K.gold);
}

// A flag on a pole.
export function flag(b, x, y, z, color = K.banner, h = 1.0) {
  b.box(0.06, h, 0.06, K.ironDark, { x, y, z });
  b.ball(0.07, K.gold, { x, y: y + h + 0.04, z });
  b.box(0.55, 0.32, 0.04, color, { x: x + 0.3, y: y + h - 0.36, z });
}

// Crenellations along a square top (or a ring if round).
function crenels(b, w, d, y, color = K.stone, round = 0) {
  if (round) {
    const n = Math.max(6, Math.round(round * 6));
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; b.box(0.36, 0.42, 0.3, color, { x: Math.cos(a) * round, y, z: Math.sin(a) * round, ry: -a }); }
    return;
  }
  for (const [len, axis, at] of [[w, 'x', d / 2], [w, 'x', -d / 2], [d, 'z', w / 2], [d, 'z', -w / 2]]) {
    const n = Math.max(2, Math.round(len / 0.7));
    for (let i = 0; i < n; i += 2) {
      const u = -len / 2 + (i + 0.5) * (len / n);
      b.box(axis === 'x' ? len / n : 0.32, 0.42, axis === 'x' ? 0.32 : len / n, color, axis === 'x' ? { x: u, y, z: at } : { x: at, y, z: u });
    }
  }
}

// A round tower with crenellations, a blue cone roof, a gold finial and an
// optional flag.
export function roundTower(b, x, z, r, h, roofH = r * 2.2, { flagC = K.banner, base = 0, bannerFace = null } = {}) {
  b.cyl(r, r * 1.08, h, 10, K.stone, { x, y: base, z });
  b.cyl(r * 1.1, r * 1.1, 0.12, 10, K.stoneDark, { x, y: base + 0.02, z });
  b.cyl(r * 1.16, r * 1.04, 0.3, 10, K.stoneMid, { x, y: base + h - 0.1, z });
  b.cone(r * 1.22, roofH, 10, K.roof, { x, y: base + h + 0.2, z });
  b.cyl(r * 1.24, r * 1.24, 0.08, 10, K.gold, { x, y: base + h + 0.18, z });
  b.ball(0.1, K.gold, { x, y: base + h + 0.2 + roofH + 0.02, z });
  if (flagC) flag(b, x, base + h + 0.2 + roofH, z, flagC, 0.8);
  b.box(0.18, 0.32, 0.05, K.window, { x, y: base + h * 0.6, z: z + r * 1.02 });
  if (bannerFace !== null) banner(b, x + Math.sin(bannerFace) * r * 1.06, base + h * 0.82, z + Math.cos(bannerFace) * r * 1.06, bannerFace, 0.5, 0.95);
}

// A square stone block with crenellations.
function block(b, x, z, w, d, h, y = 0, color = K.stone) {
  b.box(w, h, d, color, { x, y, z });
  b.box(w + 0.08, 0.14, d + 0.08, K.stoneMid, { x, y: y + h - 0.02, z });
  crenels(b, w, d, y + h + 0.1, color);
  // A few light stone blocks for texture.
  for (let i = 0; i < 4; i++) b.box(0.42, 0.24, 0.04, K.stoneMid, { x: x - w * 0.3 + (i % 2) * w * 0.5, y: y + h * (0.25 + 0.2 * i), z: z + d / 2 + 0.01 });
}

function arch(b, x, z, w, h, y = 0, ry = 0) {
  const m = M(x, y, z, ry);
  b.box(w, h * 0.72, 0.12, K.woodDark, { m });
  b.cyl(w / 2, w / 2, 0.12, 10, K.woodDark, { y: h * 0.72, rx: Math.PI / 2, m });
  b.box(w + 0.3, 0.16, 0.2, K.stoneDark, { y: 0, z: 0.1, m });
  b.box(0.06, h * 0.7, 0.14, K.ironDark, { x: 0, y: 0.02, m });
}

// ---------------------------------------------------------------- castle
// Four levels: a fortified keep → curtain wall and corner towers → a larger
// inner town and gatehouse → the royal capital with its tall central spire.
export function castleGeo(level) {
  const b = new Builder();
  b.box(9.4, 0.3, 9.4, 0xcdbf9e);
  b.box(9.6, 0.1, 9.6, K.moss, { y: 0.02 });
  // Curtain wall with crenellations.
  const R = 4.2, wh = 1.6 + level * 0.25;
  for (const [x, z, w, d] of [[0, -R, 2 * R, 0.6], [-R, 0, 0.6, 2 * R], [R, 0, 0.6, 2 * R], [-2.7, R, 2.6, 0.6], [2.7, R, 2.6, 0.6]]) {
    b.box(w, wh, d, K.stone, { x, y: 0.3, z });
    crenels(b, w, d, 0.3 + wh + 0.1);
  }
  // Gatehouse.
  const gh = 2.6 + level * 0.35;
  block(b, 0, R + 0.05, 2.8, 1.0, gh, 0.3);
  arch(b, 0, R + 0.58, 1.3, 1.9, 0.3);
  banner(b, -0.9, 0.3 + gh - 0.15, R + 0.58, 0, 0.5, 1.0);
  banner(b, 0.9, 0.3 + gh - 0.15, R + 0.58, 0, 0.5, 1.0);
  // Corner towers.
  const ct = 3.0 + level * 0.55, cr = 0.75 + level * 0.06;
  for (const x of [-R, R]) for (const z of [-R, R]) roundTower(b, x, z, cr, ct, cr * 2.3, { base: 0.3, bannerFace: z > 0 ? 0 : null, flagC: level >= 1 ? K.banner : null });
  // The keep.
  const kw = 3.6 + level * 0.25, kh = 4.0 + level * 0.8;
  block(b, 0, -0.6, kw, kw * 0.9, kh, 0.3);
  for (let i = 0; i < 3; i++) b.box(0.32, 0.5, 0.05, K.window, { x: -1 + i, y: 0.3 + kh * 0.62, z: -0.6 + kw * 0.45 + 0.01 });
  b.box(1.0, 1.5, 0.08, K.woodDark, { y: 0.3, z: -0.6 + kw * 0.45 + 0.02 });
  banner(b, -1.1, 0.3 + kh * 0.95, -0.6 + kw * 0.45 + 0.04, 0, 0.6, 1.3);
  banner(b, 1.1, 0.3 + kh * 0.95, -0.6 + kw * 0.45 + 0.04, 0, 0.6, 1.3);
  // Keep turrets on its corners.
  const tk = 0.5 + level * 0.04;
  for (const x of [-kw / 2, kw / 2]) for (const z of [-0.6 - kw * 0.45, -0.6 + kw * 0.45]) roundTower(b, x, z, tk, 1.4 + level * 0.3, tk * 2.6, { base: 0.3 + kh - 0.2, flagC: null });
  // Central spire, growing with each level.
  const sh = 1.6 + level * 1.2, sr = 0.9 + level * 0.12;
  roundTower(b, 0, -0.9, sr, sh, sr * (2.6 + level * 0.3), { base: 0.3 + kh + 0.3 });
  b.box(0.6, 0.35, 0.05, K.gold, { y: 0.3 + kh + 0.3 + sh * 0.7, z: -0.9 + sr + 0.02 });
  if (level >= 2) {
    // An inner hall with a blue roof, a timber balcony and more towers.
    b.box(2.2, 1.8, 1.6, K.cream, { x: -2.6, y: 0.3, z: 1.6 });
    for (const x of [-3.6, -1.6]) b.box(0.16, 1.8, 0.16, K.woodDark, { x, y: 0.3, z: 2.4 });
    b.roof(2.5, 1.0, 1.9, K.roof, { x: -2.6, y: 2.1, z: 1.6 });
    b.box(2.2, 1.8, 1.6, K.cream, { x: 2.6, y: 0.3, z: 1.6 });
    b.roof(2.5, 1.0, 1.9, K.roof, { x: 2.6, y: 2.1, z: 1.6 });
    roundTower(b, -2.4, -3.0, 0.6, 3.6 + level * 0.5, 1.5, { base: 0.3 });
    roundTower(b, 2.4, -3.0, 0.6, 3.6 + level * 0.5, 1.5, { base: 0.3 });
  }
  if (level >= 3) {
    // The royal capital: gold crown on the spire, side towers on the walls.
    for (const [x, z] of [[-R, 0], [R, 0], [0, -R]]) roundTower(b, x, z, 0.6, 3.6, 1.6, { base: 0.3, bannerFace: x ? (x < 0 ? -Math.PI / 2 : Math.PI / 2) : null });
    const ty = 0.3 + kh + 0.3 + sh + 0.2 + sr * 3.5;
    b.cyl(0.24, 0.24, 0.12, 8, K.gold, { y: ty - 0.4 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; b.cone(0.05, 0.16, 4, K.gold, { x: Math.cos(a) * 0.2, y: ty - 0.3, z: Math.sin(a) * 0.2 }); }
  }
  // Brazier and greenery.
  b.cyl(0.25, 0.3, 0.9, 6, K.stoneDark, { x: 1.9, y: 0.3, z: 4.9 });
  b.cone(0.22, 0.4, 5, 0xff8a2a, { x: 1.9, y: 1.2, z: 4.9 });
  for (const [x, z] of [[-4.7, 3.5], [4.7, 3.3], [-4.6, -2], [4.6, -1.5]]) b.add(new THREE.IcosahedronGeometry(0.42, 0), 0x4f9a40, { x, y: 0.5, z });
  return b.build();
}

// ---------------------------------------------------------------- barracks
// A timber hall → a yard with a stone tower and armoury → a fortified complex.
export function barracksGeo(level) {
  const b = new Builder();
  b.box(6.0, 0.18, 6.0, 0xc8aa78);
  const hallC = level >= 2 ? K.stone : K.cream;
  // The hall.
  const w = 3.8, d = 2.6, h = 1.8 + level * 0.2;
  b.box(w + 0.2, 0.3, d + 0.2, K.base, { x: -0.6, y: 0.18, z: -1.0 });
  b.box(w, h, d, hallC, { x: -0.6, y: 0.48, z: -1.0 });
  for (const x of [-0.6 - w / 2, -0.6, -0.6 + w / 2]) for (const z of [-1 - d / 2, -1 + d / 2]) b.box(0.2, h, 0.2, K.woodDark, { x, y: 0.48, z });
  b.box(w, 0.16, 0.18, K.woodDark, { x: -0.6, y: 0.48 + h * 0.55, z: -1 + d / 2 });
  for (const x of [-1.6, 0.4]) b.box(0.42, 0.5, 0.05, K.window, { x, y: 1.4, z: -1 + d / 2 + 0.01 });
  b.box(0.8, 1.3, 0.06, K.woodDark, { x: -0.6, y: 0.48, z: -1 + d / 2 + 0.02 });
  b.roof(w + 0.5, 1.4, d + 0.6, K.roof, { x: -0.6, y: 0.48 + h });
  b.box(w + 0.5, 0.08, 0.1, K.gold, { x: -0.6, y: 0.48 + h + 0.02, z: -1 + d / 2 + 0.3 });
  banner(b, 1.5, 2.0, -1 + d / 2 + 0.03, 0, 0.55, 1.0);
  flag(b, -2.7, 0.18, 1.6, K.banner, 2.4);
  // Training yard: an archery target and a straw dummy.
  b.cyl(0.42, 0.42, 0.1, 10, 0xf4f0e6, { x: 1.9, y: 0.9, z: 1.6, rx: Math.PI / 2 });
  b.cyl(0.28, 0.28, 0.12, 10, 0xd8342c, { x: 1.9, y: 0.9, z: 1.6, rx: Math.PI / 2 });
  b.cyl(0.12, 0.12, 0.14, 10, 0xf2c33a, { x: 1.9, y: 0.9, z: 1.6, rx: Math.PI / 2 });
  b.box(0.08, 1.0, 0.08, K.woodDark, { x: 1.9, y: 0.18, z: 1.5 });
  b.box(0.1, 1.2, 0.1, K.woodDark, { x: 0.5, y: 0.18, z: 2.1 });
  b.box(0.7, 0.1, 0.1, K.woodDark, { x: 0.5, y: 1.1, z: 2.1 });
  b.ball(0.2, 0xe8c35a, { x: 0.5, y: 1.4, z: 2.1 });
  // A tent and a weapon rack.
  b.roof(1.4, 1.1, 1.6, 0xf4f0e6, { x: -2.2, y: 0.18, z: 1.8 });
  b.box(0.3, 0.9, 0.04, K.banner, { x: -2.2, y: 0.4, z: 2.61 });
  b.box(1.4, 0.1, 0.1, K.wood, { x: 2.4, y: 0.9, z: -0.4 });
  for (let i = 0; i < 4; i++) b.box(0.05, 1.3, 0.05, 0xc8ccd2, { x: 1.85 + i * 0.36, y: 0.2, z: -0.4 });
  if (level >= 1) {
    // A stone tower and a fenced yard.
    roundTower(b, 2.3, -2.2, 0.7, 3.0 + level * 0.4, 1.6, { base: 0.18, bannerFace: 0 });
    for (let i = 0; i < 7; i++) b.box(0.12, 0.7, 0.12, K.woodDark, { x: -2.8 + i * 0.95, y: 0.18, z: 2.85 });
    b.box(6.0, 0.08, 0.08, K.wood, { y: 0.65, z: 2.85 });
  }
  if (level >= 2) {
    // Fortified: stone walls with crenellations, a second hall and towers.
    for (const [x, z, w2, d2] of [[0, -2.95, 6.0, 0.4], [-2.95, -0.6, 0.4, 4.4], [2.95, 0.4, 0.4, 2.6]]) { b.box(w2, 1.4, d2, K.stone, { x, y: 0.18, z }); crenels(b, w2, d2, 1.68); }
    roundTower(b, -2.8, -2.8, 0.6, 3.4, 1.5, { base: 0.18 });
    b.box(1.8, 1.6, 1.4, K.stone, { x: 1.9, y: 0.18, z: 0.6 });
    b.roof(2.1, 0.9, 1.7, K.roof, { x: 1.9, y: 1.78, z: 0.6 });
  }
  return b.build();
}

// ---------------------------------------------------------------- towers
// Archer Tower → Sturdy Tower → Timber Fort → Stone Tower → Ballista. The
// archers stand on the platform at TOWER_TOP in render.js (3.15, 3.15, 3.15,
// 3.55, 3.95), so each roof sits high on posts.
function blueRoofOnPosts(b, w, y, h = 1.2, roofW = w + 0.4) {
  for (const x of [-w / 2, w / 2]) for (const z of [-w / 2, w / 2]) b.box(0.14, h, 0.14, K.woodDark, { x, y, z });
  b.cone(roofW * 0.74, 1.3, 4, K.roof, { y: y + h, ry: Math.PI / 4 });
  b.box(roofW * 1.02, 0.08, roofW * 1.02, K.gold, { y: y + h - 0.02 });
  flag(b, 0, y + h + 1.25, 0, K.banner, 0.8);
}
export function towerGeo(level) {
  const b = new Builder();
  if (level <= 1) {
    const sturdy = level === 1;
    const pw = sturdy ? 0.34 : 0.26;
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(pw, 3.0, pw, sturdy ? K.woodDark : K.wood, { x: x * 1.0, z: z * 1.0, rx: -z * 0.06, rz: x * 0.06 });
    for (const z of [-1, 1]) { b.box(2.5, 0.12, 0.12, K.woodDark, { y: 1.5, z, rz: 0.6 }); b.box(2.5, 0.12, 0.12, K.woodDark, { y: 1.5, z, rz: -0.6 }); }
    for (const x of [-1, 1]) b.box(0.12, 0.12, 2.5, K.woodDark, { x, y: 1.5 });
    b.box(2.8, 0.3, 2.8, K.plank, { y: 2.85 });
    for (const s of [-1, 1]) { b.box(2.8, 0.5, 0.1, K.wood, { y: 3.15, z: s * 1.35 }); b.box(0.1, 0.5, 2.8, K.wood, { x: s * 1.35, y: 3.15 }); }
    // Ladder.
    for (const x of [-0.25, 0.25]) b.box(0.06, 3.0, 0.06, K.woodLight, { x, z: 1.45, rx: -0.15 });
    for (let i = 0; i < 6; i++) b.box(0.5, 0.05, 0.05, K.woodLight, { y: 0.3 + i * 0.48, z: 1.45 - i * 0.07 });
    banner(b, 0.75, 3.4, 1.42, 0, 0.5, 0.95);
    blueRoofOnPosts(b, 2.6, 3.0, 1.5);
    if (sturdy) {
      // A palisade skirt and shields on the rail.
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; b.cyl(0.11, 0.13, 0.9, 5, K.wood, { x: Math.cos(a) * 1.5, z: Math.sin(a) * 1.5 }); b.cone(0.11, 0.25, 5, K.woodLight, { x: Math.cos(a) * 1.5, y: 0.9, z: Math.sin(a) * 1.5 }); }
      for (const x of [-0.8, 0.8]) { b.cyl(0.26, 0.26, 0.06, 8, K.banner, { x, y: 3.2, z: 1.42, rx: Math.PI / 2 }); b.cyl(0.1, 0.1, 0.08, 8, K.gold, { x, y: 3.2, z: 1.44, rx: Math.PI / 2 }); }
    }
    return b.build();
  }
  if (level === 2) {
    // Timber fort: a log-walled base inside a spiked palisade.
    for (let i = 0; i < 6; i++) {
      const y = i * 0.5, c = i % 2 ? K.wood : K.woodDark;
      b.box(2.7, 0.48, 0.4, c, { y, z: 1.15 }); b.box(2.7, 0.48, 0.4, c, { y, z: -1.15 });
      b.box(0.4, 0.48, 2.7, c, { x: 1.15, y }); b.box(0.4, 0.48, 2.7, c, { x: -1.15, y });
    }
    b.box(3.0, 0.3, 3.0, K.plank, { y: 2.85 });
    for (let i = 0; i < 7; i++) for (const s of [-1, 1]) {
      b.cyl(0.12, 0.13, 0.8, 5, K.wood, { x: -1.4 + i * 0.47, y: 3.0, z: s * 1.45 }); b.cone(0.12, 0.25, 5, K.woodLight, { x: -1.4 + i * 0.47, y: 3.8, z: s * 1.45 });
      b.cyl(0.12, 0.13, 0.8, 5, K.wood, { x: s * 1.45, y: 3.0, z: -1.4 + i * 0.47 }); b.cone(0.12, 0.25, 5, K.woodLight, { x: s * 1.45, y: 3.8, z: -1.4 + i * 0.47 });
    }
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; b.cyl(0.13, 0.15, 1.1, 5, K.wood, { x: Math.cos(a) * 1.75, z: Math.sin(a) * 1.75 }); b.cone(0.13, 0.3, 5, K.woodLight, { x: Math.cos(a) * 1.75, y: 1.1, z: Math.sin(a) * 1.75 }); }
    b.box(0.6, 1.2, 0.1, K.woodDark, { y: 0, z: 1.37 });
    banner(b, 0, 2.6, 1.38, 0, 0.6, 1.1);
    blueRoofOnPosts(b, 2.7, 3.0, 1.6, 3.4);
    return b.build();
  }
  if (level === 3) {
    // Stone tower: round, crenellated, with a blue cone over the archers.
    b.cyl(1.25, 1.45, 3.4, 10, K.stone);
    b.cyl(1.5, 1.5, 0.12, 10, K.stoneDark, { y: 0.02 });
    b.cyl(1.55, 1.4, 0.3, 10, K.stoneMid, { y: 3.3 });
    crenels(b, 0, 0, 3.75, K.stone, 1.4);
    b.box(0.6, 1.1, 0.1, K.woodDark, { y: 0, z: 1.42 });
    b.box(0.22, 0.42, 0.06, K.window, { y: 2.2, z: 1.3 });
    banner(b, 0, 3.2, 1.36, 0, 0.6, 1.1);
    for (const a of [0.8, 2.4, 3.9, 5.5]) b.box(0.12, 1.6, 0.12, K.woodDark, { x: Math.cos(a) * 1.15, y: 3.55, z: Math.sin(a) * 1.15 });
    b.cone(1.7, 1.6, 10, K.roof, { y: 5.15 });
    b.cyl(1.72, 1.72, 0.08, 10, K.gold, { y: 5.12 });
    flag(b, 0, 6.7, 0, K.banner, 0.8);
    return b.build();
  }
  // Ballista: a square stone tower with a big crossbow on top (the gun mesh).
  b.box(2.8, 3.8, 2.8, K.stone);
  b.box(3.0, 0.14, 3.0, K.stoneDark, { y: 0.02 });
  b.box(3.1, 0.3, 3.1, K.stoneMid, { y: 3.7 });
  crenels(b, 3.0, 3.0, 4.1);
  for (let i = 0; i < 4; i++) b.box(0.5, 0.26, 0.04, K.stoneMid, { x: -0.8 + (i % 2) * 1.4, y: 0.6 + i * 0.75, z: 1.41 });
  b.box(0.7, 1.2, 0.1, K.woodDark, { y: 0, z: 1.42 });
  banner(b, 0, 3.5, 1.44, 0, 0.7, 1.4);
  b.box(3.0, 0.3, 0.3, K.gold, { y: 3.4, z: 1.45 });
  return b.build();
}

// ---------------------------------------------------------------- siege
// Catapult → Heavy Catapult → Trebuchet. The base turns; the frame and arm
// sit in a turret at y 0.55; the arm swings about its axle at y 1.8.
export function catapultBaseGeo(level) {
  const b = new Builder();
  b.cyl(1.7, 1.9, 0.5, 10, level >= 2 ? K.stoneMid : K.stone);
  b.cyl(1.76, 1.76, 0.1, 10, K.woodDark, { y: 0.5 });
  return b.build();
}
export function catapultFrameGeo(level) {
  const b = new Builder();
  const W = level >= 1 ? K.woodDark : K.wood;
  const wheelR = level >= 1 ? 0.48 : 0.38;
  b.box(1.5, 0.25, 2.8, W, { y: 0.35 });
  for (const x of [-0.65, 0.65]) b.box(0.18, 0.18, 2.9, K.woodLight, { x, y: 0.45 });
  for (const x of [-0.85, 0.85]) for (const z of [-1.0, 1.0]) {
    b.cyl(wheelR, wheelR, 0.16, 12, K.woodDark, { x, y: wheelR - 0.1, z, rz: Math.PI / 2 });
    b.cyl(wheelR * 0.4, wheelR * 0.4, 0.2, 8, K.ironDark, { x, y: wheelR - 0.1, z, rz: Math.PI / 2 });
  }
  if (level < 2) {
    for (const x of [-0.6, 0.6]) { b.box(0.2, 1.6, 0.2, W, { x, y: 0.45, z: 0.1, rx: -0.25 }); b.box(0.2, 1.6, 0.2, W, { x, y: 0.45, z: -0.45, rx: 0.25 }); }
    b.box(1.5, 0.16, 0.16, K.ironDark, { y: 1.8 });
    b.box(1.3, 0.2, 0.2, W, { y: 1.2, z: 0.75 });   // stop bar
    b.box(0.08, 0.6, 0.6, K.banner, { x: 0.68, y: 1.0, z: -0.2 });
    emblem(b, 'crown', new THREE.Matrix4().makeTranslation(0.73, 1.3, -0.2).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), 0.5, K.gold);
    if (level === 1) {
      b.box(0.08, 0.6, 0.6, K.banner, { x: -0.68, y: 1.0, z: -0.2 });
      for (const x of [-0.75, 0.75]) b.box(0.12, 0.12, 0.6, K.ironDark, { x, y: 0.5, z: 1.4 });
    }
  } else {
    // Trebuchet: a tall A-frame and a hanging counterweight box.
    for (const x of [-0.6, 0.6]) { b.box(0.22, 2.2, 0.22, W, { x, y: 0.45, z: 0.45, rx: -0.3 }); b.box(0.22, 2.2, 0.22, W, { x, y: 0.45, z: -0.45, rx: 0.3 }); }
    b.box(1.5, 0.18, 0.18, K.ironDark, { y: 1.8 });
    b.box(0.08, 0.7, 0.6, K.banner, { x: 0.7, y: 1.0 });
  }
  return b.build();
}
export function catapultArmGeo(level) {
  const b = new Builder();
  const L = level >= 2 ? 3.6 : level >= 1 ? 3.0 : 2.5;
  b.box(0.2, 0.2, L, K.wood, { z: -L / 2 + 0.5 });
  for (let i = 0; i < 3; i++) b.box(0.24, 0.24, 0.06, K.ironDark, { z: -L * (0.2 + i * 0.25) });
  if (level >= 2) {
    // Counterweight on the short end, a sling on the long one.
    b.box(0.9, 0.8, 0.8, K.stoneMid, { y: -0.7, z: 0.6 });
    b.box(0.95, 0.12, 0.85, K.ironDark, { y: 0.0, z: 0.6 });
    b.box(0.04, 0.6, 0.04, 0x8a7a5a, { y: -0.3, z: -L + 0.5 });
    b.add(new THREE.DodecahedronGeometry(0.3, 0), C.rock, { y: -0.62, z: -L + 0.5 });
  } else {
    b.cyl(0.4, 0.3, 0.25, 8, K.woodDark, { y: 0.1, z: -L + 0.5 });
    b.add(new THREE.DodecahedronGeometry(level >= 1 ? 0.38 : 0.3, 0), C.rock, { y: 0.4, z: -L + 0.5 });
  }
  return b.build();
}

// ---------------------------------------------------------------- walls
// Five materials, each with a straight 2.4 m segment, a corner, a gate frame
// and a door: Palisade, Reinforced, Timber, Stone, Iron.
export const WALL_SEG = 2.4;
export function wallKitGeo(tier, len = WALL_SEG) {
  const b = new Builder();
  if (tier <= 1) {
    const n = Math.max(3, Math.round(len / 0.42));
    for (let i = 0; i < n; i++) {
      const x = -len / 2 + (i + 0.5) * (len / n), h = 2.0 + ((i * 7) % 3) * 0.12 + tier * 0.2;
      b.cyl(0.2, 0.22, h, 6, i % 2 ? K.wood : K.woodDark, { x });
      b.cone(0.2, 0.42, 6, K.woodLight, { x, y: h });
    }
    b.box(len, 0.16, 0.14, K.woodDark, { y: 1.3, z: 0.2 });
    b.box(len, 0.16, 0.14, K.woodDark, { y: 0.6, z: 0.2 });
    if (tier === 1) {
      // Reinforced: cross braces and iron bands.
      b.box(len * 0.98, 0.14, 0.12, K.wood, { y: 1.0, z: 0.28, rz: 0.55 });
      b.box(len * 0.98, 0.14, 0.12, K.wood, { y: 1.0, z: 0.28, rz: -0.55 });
      b.box(len, 0.08, 0.3, K.ironDark, { y: 1.8, z: 0.0 });
    }
  } else if (tier === 2) {
    // Timber: a plank wall with a walkway on a stone footing.
    b.box(len, 0.5, 1.0, K.stoneDark);
    b.box(len, 2.2, 0.5, K.wood, { y: 0.5 });
    for (let i = 0; i < 4; i++) b.box(len, 0.06, 0.52, K.woodDark, { y: 0.9 + i * 0.5 });
    const n = Math.max(2, Math.round(len / 0.6));
    for (let i = 0; i < n; i += 2) b.box(len / n, 0.4, 0.5, K.woodDark, { x: -len / 2 + (i + 0.5) * (len / n), y: 2.7 });
  } else {
    const iron = tier === 4;
    const c = iron ? 0xb8b4ac : K.stone;
    b.box(len, 2.6, 1.0, c);
    b.box(len + 0.02, 0.25, 1.1, iron ? 0x7a7670 : K.stoneDark, { y: 0 });
    for (let i = 0; i < 3; i++) b.box(0.5, 0.22, 0.04, iron ? 0x9a968e : K.stoneMid, { x: -len * 0.3 + i * len * 0.3, y: 0.8 + (i % 2) * 0.7, z: 0.51 });
    const n = Math.max(2, Math.round(len / 0.8));
    for (let i = 0; i < n; i += 2) b.box(len / n, 0.45, 1.0, c, { x: -len / 2 + (i + 0.5) * (len / n), y: 2.6 });
    if (iron) { b.box(len, 0.1, 1.04, K.ironDark, { y: 2.0 }); for (const x of [-len / 3, len / 3]) b.cone(0.07, 0.3, 4, 0xc8ccd2, { x, y: 3.05, z: 0.3 }); }
  }
  return b.build();
}
export function wallCornerGeo(tier) {
  const b = new Builder();
  if (tier <= 1) {
    b.cyl(0.5, 0.55, 3.0, 8, K.woodDark);
    b.cone(0.55, 0.8, 8, K.woodLight, { y: 3.0 });
    flag(b, 0, 3.6, 0, K.banner, 0.9);
  } else if (tier === 2) {
    for (const x of [-0.8, 0.8]) for (const z of [-0.8, 0.8]) b.box(0.3, 3.6, 0.3, K.woodDark, { x, z });
    b.box(2.0, 0.3, 2.0, K.plank, { y: 2.6 });
    b.box(2.0, 0.6, 2.0, K.wood, { y: 2.9 });
    b.cone(1.6, 1.3, 4, K.roof, { y: 3.5, ry: Math.PI / 4 });
    flag(b, 0, 4.7, 0, K.banner, 0.8);
  } else {
    roundTower(b, 0, 0, 1.1, 3.6, 2.2, {});
    if (tier === 4) b.cyl(1.2, 1.2, 0.12, 10, K.ironDark, { y: 2.6 });
  }
  return b.build();
}
export function wallGateGeo(tier) {
  const b = new Builder();
  if (tier <= 1) {
    for (const x of [-2.1, 2.1]) { b.cyl(0.34, 0.38, 3.8, 7, K.wood, { x }); b.cone(0.4, 0.6, 7, K.woodLight, { x, y: 3.8 }); }
    b.box(5.0, 0.4, 0.5, K.woodDark, { y: 3.1 });
    banner(b, 0, 3.0, 0.3, 0, 0.6, 0.9);
    if (tier === 1) for (const x of [-2.1, 2.1]) flag(b, x, 4.3, 0, K.banner, 0.8);
  } else if (tier === 2) {
    for (const x of [-2.4, 2.4]) {
      for (const dx of [-0.6, 0.6]) for (const dz of [-0.6, 0.6]) b.box(0.26, 4.0, 0.26, K.woodDark, { x: x + dx, z: dz });
      b.box(1.6, 0.3, 1.6, K.plank, { x, y: 3.0 });
      b.box(1.6, 0.6, 1.6, K.wood, { x, y: 3.3 });
      b.cone(1.25, 1.2, 4, K.roof, { x, y: 4.0, ry: Math.PI / 4 });
      flag(b, x, 5.1, 0, K.banner, 0.7);
    }
    b.box(5.4, 0.5, 0.7, K.woodDark, { y: 3.2 });
    banner(b, 0, 3.15, 0.38, 0, 0.6, 0.9);
  } else {
    const iron = tier === 4;
    for (const x of [-2.4, 2.4]) roundTower(b, x, 0, 0.9, 3.8, 1.9, { bannerFace: 0 });
    b.box(4.0, 1.0, 1.6, iron ? 0xb8b4ac : K.stone, { y: 3.4 });
    crenels(b, 4.0, 1.6, 4.5, iron ? 0xb8b4ac : K.stone);
    banner(b, 0, 4.2, 0.82, 0, 0.7, 0.8);
  }
  return b.build();
}
export function wallDoorGeo(tier) {
  const b = new Builder();
  const iron = tier === 4;
  for (let i = 0; i < 7; i++) b.box(0.48, 2.9, 0.22, iron ? (i % 2 ? 0x5a6068 : 0x6e747c) : i % 2 ? K.wood : K.woodLight, { x: -1.55 + i * 0.52 });
  const band = tier >= 3 ? K.ironDark : K.woodDark;
  b.box(3.6, 0.2, 0.3, band, { y: 0.6 });
  b.box(3.6, 0.2, 0.3, band, { y: 2.1 });
  if (tier >= 3) { b.box(0.7, 0.5, 0.06, K.banner, { y: 1.3, z: 0.14 }); emblem(b, 'crown', new THREE.Matrix4().makeTranslation(0, 1.32, 0.18), 0.6, K.gold); }
  if (iron) for (let i = 0; i < 7; i++) b.cone(0.06, 0.25, 4, 0xc8ccd2, { x: -1.55 + i * 0.52, y: 2.9 });
  return b.build();
}

// ---------------------------------------------------------------- homes
// Timber-framed cottages with red roofs, a chimney and a little garden.
export function houseGeo(level) {
  const b = new Builder();
  const w = 3.0 + level * 0.25, d = 2.7, h = 1.8 + level * 0.35;
  b.box(w + 0.3, 0.3, d + 0.3, level >= 2 ? K.stoneDark : K.woodDark);
  b.box(w, h, d, level >= 2 ? K.stone : K.cream, { y: 0.3 });
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) b.box(0.2, h, 0.2, K.woodDark, { x, y: 0.3, z });
  b.box(w, 0.16, 0.2, K.woodDark, { y: 0.3 + h * 0.55, z: d / 2 });
  b.box(0.12, h * 0.55, 0.06, K.woodDark, { x: w / 4, y: 0.3 + h * 0.55, z: d / 2 + 0.01, rz: 0.6 });
  b.box(0.12, h * 0.55, 0.06, K.woodDark, { x: -w / 4, y: 0.3 + h * 0.55, z: d / 2 + 0.01, rz: -0.6 });
  b.box(0.75, 1.25, 0.08, K.woodDark, { x: -0.55, y: 0.3, z: d / 2 + 0.02 });
  b.box(0.55, 0.5, 0.06, K.window, { x: 0.75, y: 1.05, z: d / 2 + 0.02 });
  b.box(0.65, 0.14, 0.18, 0x6a8a3a, { x: 0.75, y: 0.78, z: d / 2 + 0.1 });
  for (let i = 0; i < 3; i++) b.ball(0.07, [0xe0603a, 0xf2c33a, 0xd8342c][i], { x: 0.55 + i * 0.2, y: 0.9, z: d / 2 + 0.14 });
  b.roof(w + 0.6, 1.4 + level * 0.15, d + 0.7, level >= 1 ? K.red : 0xa85a3a, { y: 0.3 + h });
  b.box(0.42, 1.3, 0.42, K.stoneDark, { x: w / 4, y: 0.3 + h + 0.35, z: -0.5 });
  if (level >= 1) {
    b.box(1.2, 1.1, 1.3, K.woodLight, { x: w / 2 + 0.25, y: 0.3, z: -0.4 });
    b.roof(1.5, 0.6, 1.5, K.red, { x: w / 2 + 0.25, y: 1.4, z: -0.4, ry: Math.PI / 2 });
  }
  // Garden fence.
  for (let i = 0; i < 5; i++) b.box(0.08, 0.5, 0.08, K.woodLight, { x: -w / 2 - 0.3 + i * 0.35, y: 0.0, z: d / 2 + 0.6 });
  b.box(1.5, 0.06, 0.06, K.woodLight, { x: -w / 2 + 0.4, y: 0.38, z: d / 2 + 0.6 });
  return b.build();
}
