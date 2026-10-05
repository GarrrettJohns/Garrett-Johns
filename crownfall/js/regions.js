// The six realms on one map, after the approved world concept
// (asset-workup/references/approved/04_world_and_cameras.jpeg) and
// regional_environments.png: Greenwood around the castle, the Eastern
// Mountains to the north-east, the volcanic Iron Hills east of the road
// south, golden Sunscorch to the south-west, snowy Frostmarch to the
// south-east and the Warlord's corrupted realm round the Stronghold.
// Region weights paint the ground and pick trees; the landmark models
// below are placed as sites in map.js.

import * as THREE from './vendor/three.js';
import { Builder, C, palmGeo, cactusGeo, snowPineGeo } from './models.js';
import { emblem } from './units.js';
import { K, banner, flag, roundTower, houseGeo } from './buildings.js';

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

// How much of each realm a point belongs to (0..1). Greenwood is the rest.
export function regionWeights(x, z) {
  const warlord = Math.max(1 - smooth(26, 46, Math.hypot(x * 0.8, z - 212)), smooth(198, 214, z));
  const desert = smooth(-12, -26, x) * smooth(62, 80, z) * (1 - smooth(172, 188, z)) * (1 - warlord);
  const frost = smooth(16, 30, x) * smooth(122, 138, z) * (1 - warlord);
  const iron = smooth(30, 42, x) * smooth(54, 66, z) * (1 - smooth(112, 124, z)) * (1 - warlord);
  return { desert, frost, iron, warlord };
}
export function regionAt(x, z) {
  const w = regionWeights(x, z);
  let best = 'greenwood', v = 0.5;
  for (const [k, n] of Object.entries(w)) if (n > v) { v = n; best = k; }
  return best;
}

// Ground colours for each realm: [base, light, dark].
export const REGION_GROUND = {
  desert: [0xe3c48a, 0xedd5a2, 0xcda56a],
  frost: [0xeef3f8, 0xffffff, 0xd2dde8],
  iron: [0x5e534c, 0x6e625a, 0x463c38],
  warlord: [0x4a3a38, 0x5a4440, 0x3a2a2a],
};
export const REGION_ROCK = { desert: [1.2, 0.98, 0.72], frost: [1.12, 1.18, 1.3], iron: [0.55, 0.45, 0.42], warlord: [0.48, 0.42, 0.45] };

// ---------------------------------------------------------------- trees
export function deadTreeGeo(color = 0x3a2e2a) {
  const b = new Builder();
  b.cyl(0.14, 0.24, 2.2, 5, color, { rz: 0.06 });
  for (const [y, r, l] of [[1.4, 0.8, 0.9], [1.8, -0.9, 0.8], [2.1, 0.5, 0.6], [1.0, -1.1, 0.6]]) b.cyl(0.04, 0.08, l, 4, color, { x: Math.sin(r) * l * 0.45, y, rz: -r });
  return b.build();
}
export function ashTreeGeo() { return deadTreeGeo(0x4a3a32); }
export { palmGeo, cactusGeo, snowPineGeo };

// ---------------------------------------------------------------- Greenwood
export function windmillGeo() {
  const b = new Builder();
  b.cyl(1.1, 1.5, 4.2, 8, K.cream);
  b.cone(1.35, 1.6, 8, K.red, { y: 4.2 });
  b.box(0.7, 1.2, 0.08, K.woodDark, { y: 0, z: 1.38 });
  b.box(0.36, 0.42, 0.06, K.window, { y: 2.6, z: 1.22 });
  return b.build();
}
// The sails turn: built about the hub, facing +z.
export function windmillSailsGeo() {
  const b = new Builder();
  b.cyl(0.2, 0.2, 0.3, 8, K.woodDark, { rx: Math.PI / 2 });
  for (let i = 0; i < 4; i++) {
    const m = new THREE.Matrix4().makeRotationZ((i / 4) * Math.PI * 2);
    b.box(0.12, 2.6, 0.08, K.woodDark, { y: 1.3, m });
    b.box(0.7, 2.0, 0.04, 0xf4f0e6, { x: 0.42, y: 1.55, z: 0.05, m });
  }
  return b.build();
}
export function homeGeo() { return houseGeo(1); }
export function fenceGeo() {
  const b = new Builder();
  for (let i = 0; i < 6; i++) b.box(0.1, 0.7, 0.1, K.woodLight, { x: -2.5 + i });
  for (const y of [0.3, 0.6]) b.box(5.2, 0.07, 0.07, K.woodLight, { y });
  return b.build();
}

// ---------------------------------------------------------------- Sunscorch
const SAND = 0xe6cc96, SAND2 = 0xd4b47a, SANDDARK = 0xb8945a, DOME = 0xf2c33a, GREEN = 0x3f8a3a;
export function mesaGeo() {
  const b = new Builder();
  b.cyl(2.6, 3.2, 2.4, 7, 0xc8784a, { ry: 0.3 });
  b.cyl(2.2, 2.6, 2.0, 7, 0xd8905a, { y: 2.4, ry: 0.8 });
  b.cyl(1.7, 2.2, 1.6, 7, 0xe0a068, { y: 4.4, ry: 1.3 });
  b.cyl(1.72, 1.72, 0.1, 7, 0xe8b07a, { y: 6.0, ry: 1.3 });
  return b.build();
}
export function sunCityGeo() {
  const b = new Builder();
  // Walls with crenellations and a great arched gate facing the road (east).
  const R = 10;
  for (const [x, z, w, d] of [[0, -R, 2 * R, 1.2], [0, R, 2 * R, 1.2], [-R, 0, 1.2, 2 * R], [R, -6, 1.2, 8], [R, 6, 1.2, 8]]) {
    b.box(w, 3.2, d, SAND, { x, z });
    const n = Math.round(Math.max(w, d) / 1.1);
    const len = Math.max(w, d);
    for (let i = 0; i < n; i += 2) { const u = -len / 2 + (i + 0.5) * (len / n); b.box(w > d ? len / n : w, 0.5, w > d ? d : len / n, SAND2, w > d ? { x: x + u, y: 3.2, z } : { x, y: 3.2, z: z + u }); }
  }
  b.box(1.4, 3.0, 3.6, SANDDARK, { x: R + 0.2, y: 0 });
  b.cyl(1.5, 1.5, 1.4, 10, SANDDARK, { x: R + 0.2, y: 2.6, rx: Math.PI / 2, sz: 0.7 });
  b.box(0.2, 2.4, 2.4, 0x6a4a2a, { x: R + 0.95 });
  // Corner towers with gold domes and green banners.
  for (const x of [-R, R]) for (const z of [-R, R]) {
    b.cyl(1.4, 1.6, 6.5, 8, SAND, { x, z });
    b.cyl(1.6, 1.6, 0.3, 8, SAND2, { x, y: 6.5, z });
    b.ball(1.3, DOME, { x, y: 7.2, z, sy: 1.1 }, 1);
    b.cone(0.2, 0.9, 6, DOME, { x, y: 8.4, z });
    b.box(0.08, 1.6, 0.9, GREEN, { x: x + Math.sign(x) * 1.62, y: 3.4, z });
  }
  // The palace: tiers, a great golden dome and minarets.
  b.box(9, 4.5, 9, SAND, { x: -1 });
  b.box(9.4, 0.3, 9.4, SAND2, { x: -1, y: 4.5 });
  b.box(6, 3.5, 6, SAND, { x: -1, y: 4.8 });
  b.cyl(2.6, 2.6, 1.0, 10, SAND2, { x: -1, y: 8.3 });
  b.ball(2.8, DOME, { x: -1, y: 10.2, sy: 1.15 }, 1);
  b.cone(0.3, 1.6, 6, DOME, { x: -1, y: 13.1 });
  for (const [x, z] of [[-5, -4], [3, -4], [-5, 4], [3, 4]]) {
    b.cyl(0.6, 0.7, 9, 8, SAND, { x, z });
    b.cyl(0.8, 0.8, 0.4, 8, SAND2, { x, y: 8.6, z });
    b.ball(0.7, DOME, { x, y: 9.4, z }, 1);
  }
  for (const z of [-2, 2]) { b.box(0.08, 2.4, 1.2, GREEN, { x: 3.55, y: 1.4, z }); emblem(b, 'sun', new THREE.Matrix4().makeTranslation(3.6, 2.2, z).multiply(new THREE.Matrix4().makeRotationY(Math.PI / 2)), 0.9, DOME); }
  // Market awnings outside the gate.
  for (const [z, c] of [[-4.5, 0xc8332c], [4.5, 0x2f62c8]]) { for (const dx of [0, 2.4]) for (const dz of [-1, 1]) b.box(0.08, 1.8, 0.08, 0x6a4a2a, { x: R + 3 + dx, z: z + dz }); b.box(3, 0.1, 2.4, c, { x: R + 4.2, y: 1.8, z, rz: 0.15 }); }
  return b.build();
}
export function oasisGeo() {
  const b = new Builder();
  b.cyl(6.4, 6.6, 0.15, 12, 0xd8c08a);
  b.cyl(5.6, 5.6, 0.1, 12, 0x6aa84a, { y: 0.1 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; b.add(new THREE.IcosahedronGeometry(0.5, 0), 0x5aa83e, { x: Math.cos(a) * 5.3, y: 0.3, z: Math.sin(a) * 5.3 }); }
  return b.build();
}
// Water surfaces glow-free but flat; drawn with the lit material.
export function poolGeo(r = 4.4, color = 0x3fb4c9) {
  const b = new Builder();
  b.cyl(r, r, 0.08, 14, color, { y: 0.12 });
  return b.build();
}

// ---------------------------------------------------------------- Frostmarch
const ICE = 0xbfe4f6, FROSTSTONE = 0xa8b0bc, PURPLE = 0x6a3fa0, PURPLE2 = 0x8a5ac8;
export function frostCitadelGeo() {
  const b = new Builder();
  // A rock and ice mound with the citadel on top.
  b.cyl(9.5, 11, 3, 9, 0x9aa4b2);
  b.cyl(8.6, 9.5, 0.6, 9, 0xf2f6fa, { y: 3 });
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; b.cone(0.7, 2.6, 5, ICE, { x: Math.cos(a) * 10, y: 0.4, z: Math.sin(a) * 10, rx: Math.sin(a) * 0.3, rz: -Math.cos(a) * 0.3 }); }
  const y0 = 3.5;
  b.box(11, 4, 9, FROSTSTONE, { y: y0 });
  for (let i = 0; i < 8; i += 2) b.box(1.3, 0.6, 9.1, 0x8a92a0, { x: -5 + i * 1.4, y: y0 + 4 });
  b.box(6, 5, 5, FROSTSTONE, { y: y0 + 4 });
  for (const [x, z, h, r] of [[-5, -4, 9, 1.1], [5, -4, 9, 1.1], [-5, 4, 7, 1.0], [5, 4, 7, 1.0], [0, -1, 13, 1.5], [-2.6, 1.5, 10, 0.9], [2.6, 1.5, 10, 0.9]]) {
    b.cyl(r, r * 1.1, h, 8, FROSTSTONE, { x, y: y0, z });
    b.cyl(r * 1.15, r * 1.15, 0.3, 8, 0x8a92a0, { x, y: y0 + h, z });
    b.cone(r * 1.1, r * 3.6, 8, PURPLE, { x, y: y0 + h + 0.3, z });
    b.box(0.3, 0.7, 0.06, 0xb47aff, { x, y: y0 + h * 0.7, z: z + r * 1.02 });
  }
  b.box(2.2, 3, 0.2, 0x2a2632, { y: y0, z: 4.55 });
  for (const x of [-1.6, 1.6]) { b.box(1.0, 2.2, 0.06, PURPLE, { x, y: y0 + 1.4, z: 4.56 }); emblem(b, 'snowflake', new THREE.Matrix4().makeTranslation(x, y0 + 2.6, 4.6), 0.8, 0xe8e8f0); }
  // Snow on the roofs.
  b.box(11.2, 0.2, 9.2, 0xf8fafc, { y: y0 + 4.0 });
  return b.build();
}
// The citadel's glowing purple windows (unlit material).
export function frostGlowGeo() {
  const b = new Builder();
  const y0 = 3.5;
  for (const [x, z, h, r] of [[-5, -4, 9, 1.1], [5, -4, 9, 1.1], [0, -1, 13, 1.5], [-2.6, 1.5, 10, 0.9], [2.6, 1.5, 10, 0.9]]) b.box(0.28, 0.66, 0.05, 0xc890ff, { x, y: y0 + h * 0.7 + 0.02, z: z + r * 1.06 });
  b.box(1.6, 2.4, 0.05, 0x9a5aff, { y: y0, z: 4.68 });
  return b.build();
}
export function frozenLakeGeo() {
  const b = new Builder();
  b.cyl(7.2, 7.4, 0.1, 14, 0xe8f0f6);
  b.cyl(6.4, 6.4, 0.1, 14, 0xa8dcf2, { y: 0.06 });
  for (let i = 0; i < 6; i++) b.box(2.0, 0.02, 0.06, 0xf4fbff, { x: -3 + i * 1.2, y: 0.17, z: (i % 3) - 1, ry: i * 0.7 });
  for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2 + 0.3; b.cone(0.35, 1.2 + (i % 3) * 0.4, 5, ICE, { x: Math.cos(a) * 7.4, z: Math.sin(a) * 7.4 }); }
  return b.build();
}
export function iceCrystalGeo() {
  const b = new Builder();
  for (const [x, z, h, r] of [[0, 0, 2.4, 0.45], [0.6, 0.3, 1.6, 0.3], [-0.5, 0.4, 1.3, 0.28], [0.2, -0.6, 1.1, 0.25]]) b.cone(r, h, 5, ICE, { x, z, rz: x * 0.4, rx: z * -0.4 });
  return b.build();
}

// ---------------------------------------------------------------- Iron Hills
const BLACK = 0x3a3436, BLACK2 = 0x2a2628, RUST = 0x8a4a32;
export function foundryGeo() {
  const b = new Builder();
  b.cyl(7.5, 8.5, 1.2, 8, 0x4a3e3a);
  b.box(9, 5, 7, BLACK, { y: 1.2 });
  for (let i = 0; i < 6; i += 2) b.box(1.4, 0.7, 7.1, BLACK2, { x: -3.5 + i * 1.5, y: 6.2 });
  for (const [x, z, h] of [[-4.5, -3.5, 9], [4.5, -3.5, 10], [-4.5, 3.5, 7], [4.5, 3.5, 7]]) {
    b.box(2.2, h, 2.2, BLACK2, { x, y: 1.2, z });
    for (const dx of [-0.7, 0.7]) b.box(0.6, 0.6, 2.3, BLACK2, { x: x + dx, y: 1.2 + h, z });
  }
  // Chimneys and a red war banner with the crossed hammers.
  for (const [x, z] of [[-1.5, -2], [1.8, -1]]) { b.cyl(0.6, 0.8, 7, 7, 0x4a4446, { x, y: 6, z }); b.cyl(0.7, 0.7, 0.3, 7, RUST, { x, y: 13, z }); }
  b.box(1.6, 2.6, 0.08, 0xb02a24, { y: 2.8, z: 3.56 });
  emblem(b, 'hammers', new THREE.Matrix4().makeTranslation(0, 4.3, 3.62), 1.3, 0xf2c33a);
  // Ramps and ore carts.
  b.box(3, 0.4, 5, 0x5a4a3e, { x: 6.5, y: 0.6, z: 1, rz: -0.25 });
  b.box(1, 0.6, 1.4, RUST, { x: 6.8, y: 0.9, z: 4.2 });
  return b.build();
}
export function foundryGlowGeo() {
  const b = new Builder();
  for (const x of [-2.5, 0, 2.5]) b.box(0.9, 1.4, 0.05, 0xff8a2a, { x, y: 2.4, z: 3.53 });
  for (const [x, z] of [[-4.5, 3.5], [4.5, 3.5]]) b.box(0.6, 1.0, 0.05, 0xffa040, { x, y: 4.5, z: z + 1.12 });
  b.box(2.2, 2.2, 0.05, 0xff6a1a, { x: 0, y: 1.2, z: -3.53 });
  return b.build();
}
// Lava: a glowing pool with dark crust (unlit).
export function lavaGeo(r = 3) {
  const b = new Builder();
  b.cyl(r, r * 1.05, 0.1, 10, 0xff5a1a, { y: 0.06 });
  b.cyl(r * 0.6, r * 0.6, 0.12, 8, 0xffb03a, { x: r * 0.15, y: 0.07, z: -r * 0.1 });
  return b.build();
}
export function lavaCrustGeo(r = 3) {
  const b = new Builder();
  for (let i = 0; i < 9; i++) { const a = (i / 9) * Math.PI * 2; b.add(new THREE.DodecahedronGeometry(0.6 + (i % 3) * 0.2, 0), BLACK2, { x: Math.cos(a) * r * 1.1, y: 0.2, z: Math.sin(a) * r * 1.1, sy: 0.6 }); }
  return b.build();
}
export function slagGeo() {
  const b = new Builder();
  for (const [x, z, s] of [[0, 0, 1.0], [1.1, 0.4, 0.7], [-0.9, 0.6, 0.6], [0.3, -1, 0.5]]) b.add(new THREE.DodecahedronGeometry(s, 0), x > 0 ? BLACK : RUST, { x, y: s * 0.5, z, sy: 0.8 });
  return b.build();
}

// ---------------------------------------------------------------- Eastern Mountains
export function mountainCastleGeo() {
  const b = new Builder();
  const S = 0x8a8e96, S2 = 0x6a6e76;
  b.cyl(7, 8, 3, 8, 0x7a7e86);
  b.cyl(6.2, 7, 0.4, 8, 0xf2f6fa, { y: 3 });
  b.box(8, 4.5, 6, S, { y: 3.2 });
  for (const [x, z, h] of [[-3.6, -2.6, 8], [3.6, -2.6, 8], [-3.6, 2.6, 6], [3.6, 2.6, 6], [0, 0, 10]]) {
    b.box(2, h, 2, S2, { x, y: 3.2, z });
    for (const dx of [-0.6, 0.6]) b.box(0.5, 0.6, 2.1, S2, { x: x + dx, y: 3.2 + h, z });
    b.cone(1.5, 2.2, 4, 0x4a3e48, { x, y: 3.8 + h, z, ry: Math.PI / 4 });
    b.box(0.6, 1.4, 0.06, 0xb02a24, { x, y: 3.2 + h * 0.6, z: z + 1.04 });
  }
  b.box(1.6, 2.4, 0.1, 0x2a2628, { y: 3.2, z: 3.05 });
  return b.build();
}
export function viaductGeo() {
  const b = new Builder();
  const S = 0x9a9ea6, S2 = 0x7a7e86;
  for (const z of [-7.5, -2.5, 2.5, 7.5]) b.box(2.4, 6.5, 1.6, S2, { z });
  for (const z of [-5, 0, 5]) b.add(new THREE.TorusGeometry(1.7, 0.45, 4, 10, Math.PI), S, { y: 4.3, z, ry: Math.PI / 2, sz: 5 });
  b.box(2.8, 0.7, 18, S, { y: 6.3 });
  for (let i = 0; i < 12; i++) b.box(0.4, 0.5, 0.6, S2, { x: i % 2 ? 1.2 : -1.2, y: 7.0, z: -8.2 + Math.floor(i / 2) * 3.2 });
  b.box(2.9, 0.12, 18.1, 0xf2f6fa, { y: 6.95 });
  return b.build();
}

// ---------------------------------------------------------------- Warlord realm
export function spikesGeo() {
  const b = new Builder();
  for (let i = 0; i < 5; i++) {
    b.box(0.22, 0.22, 2.2, 0x4a3426, { x: -2 + i, y: 0.6, rx: 0.7 });
    b.cone(0.12, 0.3, 4, 0xc8ccd2, { x: -2 + i, y: 1.35, z: 0.78, rx: 0.7 });
  }
  b.box(5, 0.2, 0.2, 0x3a2a20, { y: 0.4 });
  return b.build();
}
export function brokenCartGeo() {
  const b = new Builder();
  b.box(2.2, 0.5, 1.2, 0x5a3a26, { y: 0.35, rz: 0.25 });
  b.cyl(0.55, 0.55, 0.14, 10, 0x3a2a20, { x: -0.8, y: 0.5, z: 0.7, rx: Math.PI / 2 });
  b.cyl(0.55, 0.55, 0.14, 10, 0x3a2a20, { x: 1.2, y: 0.1, z: -0.4, rx: 0.3 });
  b.box(0.2, 0.2, 2.4, 0x4a3426, { x: 1.2, y: 0.9, z: 0.4, rx: 0.4, ry: 0.6 });
  return b.build();
}
export function warBannerGeo() {
  const b = new Builder();
  b.box(0.14, 4.6, 0.14, 0x1e1c20);
  b.box(1.4, 0.1, 0.1, 0x1e1c20, { y: 4.4 });
  b.box(1.2, 2.2, 0.06, 0xb02a24, { y: 2.2, z: 0.1 });
  b.cone(0.6, 0.6, 4, 0xb02a24, { y: 1.65, z: 0.1, rx: Math.PI, ry: Math.PI / 4, sz: 0.08, sx: 1.4 });
  emblem(b, 'brokencrown', new THREE.Matrix4().makeTranslation(0, 3.4, 0.15), 0.9, 0xd8a83a);
  return b.build();
}
export function blackRockGeo() {
  const b = new Builder();
  for (const [x, z, h, r] of [[0, 0, 4.2, 1.1], [1.2, 0.6, 2.8, 0.8], [-1.0, 0.8, 2.2, 0.7]]) b.cone(r, h, 5, 0x2e2a2e, { x, z, rz: x * 0.1 });
  return b.build();
}
export function emberCrackGeo() {
  const b = new Builder();
  for (let i = 0; i < 4; i++) b.box(3.2 - i * 0.5, 0.04, 0.22, i % 2 ? 0xff6a1a : 0xd8341a, { x: i * 0.6 - 0.8, y: 0.06, z: i * 0.7 - 1, ry: 0.5 + i * 0.6 });
  return b.build();
}
