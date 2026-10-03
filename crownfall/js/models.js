// Every model in the game, built from primitives in code. Static models merge
// into a single vertex-coloured geometry (one draw call each). Animated units
// are "rigs": a few merged parts that swing around pivots, drawn instanced.

import * as THREE from './vendor/three.js';

export const C = {
  grass: 0x6cbf4f, grassDark: 0x5aa843, forest: 0x3f8c3a, sand: 0xe6c99a, sandDark: 0xd2b07a,
  water: 0x46a6d8, stone: 0xd8d3c6, stoneDark: 0xa9a49a, rock: 0x8f9298, rockDark: 0x6d7076,
  wood: 0x9a6a41, woodDark: 0x6e4a2c, woodLight: 0xc08a55, plank: 0xb47d4c,
  roofBlue: 0x2f62c8, roofBlueDark: 0x244c9c, roofRed: 0xb84a3a, roofBrown: 0x8a5a3a,
  gold: 0xf6c431, goldDark: 0xd99a14, skin: 0xf2c49b, hair: 0x5a3a22, black: 0x2a2a2e,
  white: 0xf4f1ea, cream: 0xefe6d6, blue: 0x2f6fdc, blueDark: 0x1f4fa8, red: 0xd8342c, redDark: 0x9e2420,
  green: 0x3f9a4a, leaf: 0x3d9b46, leafDark: 0x2f7d3a, trunk: 0x7a5232, hay: 0xe8c35a, crop: 0xd9b84a,
  iron: 0x8d939c, ironDark: 0x5d636c, cloth: 0xe9e2cf, purple: 0x6a3fa0,
};

const col = new THREE.Color();

// ----------------------------------------------------------------- builder
export class Builder {
  constructor() { this.parts = []; }

  add(geo, color, o = {}) {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(o.rx || 0, o.ry || 0, o.rz || 0, o.order || 'XYZ'));
    m.compose(new THREE.Vector3(o.x || 0, o.y || 0, o.z || 0), q, new THREE.Vector3(o.sx || 1, o.sy || 1, o.sz || 1));
    if (o.m) m.premultiply(o.m);
    this.parts.push({ geo, color, m });
    return this;
  }
  // Primitives are anchored at their base (y = bottom) unless noted.
  box(w, h, d, color, o = {}) { return this.add(new THREE.BoxGeometry(w, h, d), color, { ...o, y: (o.y || 0) + h / 2 }); }
  cyl(rt, rb, h, seg, color, o = {}) { return this.add(new THREE.CylinderGeometry(rt, rb, h, seg), color, { ...o, y: (o.y || 0) + h / 2 }); }
  cone(r, h, seg, color, o = {}) { return this.add(new THREE.ConeGeometry(r, h, seg), color, { ...o, y: (o.y || 0) + h / 2 }); }
  ball(r, color, o = {}, detail = 0) { return this.add(new THREE.IcosahedronGeometry(r, detail), color, o); }
  roof(w, h, d, color, o = {}) { return this.add(prismGeo(w, h, d), color, o); }

  build() { return mergeParts(this.parts); }
}

function prismGeo(w, h, d) {
  const x = w / 2, z = d / 2;
  const v = [
    // slopes
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
    x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0,
    // gables
    x, 0, z, x, 0, -z, x, h, 0,
    -x, 0, -z, -x, 0, z, -x, h, 0,
    // underside
    -x, 0, -z, x, 0, -z, x, 0, z, -x, 0, -z, x, 0, z, -x, 0, z,
  ];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
  return g;
}

export function mergeParts(parts) {
  let count = 0;
  const geos = parts.map((p) => {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone();
    g.applyMatrix4(p.m);
    count += g.attributes.position.count;
    return g;
  });
  const pos = new Float32Array(count * 3);
  const clr = new Float32Array(count * 3);
  let o = 0;
  geos.forEach((g, i) => {
    const a = g.attributes.position.array;
    pos.set(a, o * 3);
    col.set(parts[i].color);
    const n = g.attributes.position.count;
    for (let k = 0; k < n; k++) { clr[(o + k) * 3] = col.r; clr[(o + k) * 3 + 1] = col.g; clr[(o + k) * 3 + 2] = col.b; }
    o += n;
    g.dispose();
  });
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  out.setAttribute('color', new THREE.BufferAttribute(clr, 3));
  out.computeVertexNormals();
  out.computeBoundingSphere();
  return out;
}

export const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });

// ----------------------------------------------------------------- scenery
export function pineGeo() {
  const b = new Builder();
  b.cyl(0.18, 0.24, 1.0, 6, C.trunk);
  b.cone(1.25, 1.7, 7, C.leafDark, { y: 0.7 });
  b.cone(1.0, 1.5, 7, C.leaf, { y: 1.6 });
  b.cone(0.7, 1.3, 7, 0x4bb052, { y: 2.45 });
  return b.build();
}

export function rockGeo() {
  const b = new Builder();
  b.add(new THREE.DodecahedronGeometry(1, 0), C.rock, { y: 0.45, sy: 0.75 });
  b.add(new THREE.DodecahedronGeometry(0.55, 0), C.rockDark, { x: 0.8, y: 0.25, z: 0.3, sy: 0.8 });
  return b.build();
}

export function cliffGeo() {
  const b = new Builder();
  b.box(1, 1, 1, 0x7b7f86);
  b.box(0.8, 0.12, 0.8, 0x6fae4f, { y: 1 });
  return b.build();
}

// ----------------------------------------------------------------- walls
export function palisadeGeo(len) {
  const b = new Builder();
  const n = Math.max(3, Math.round(len / 0.42));
  for (let i = 0; i < n; i++) {
    const x = -len / 2 + (i + 0.5) * (len / n);
    const h = 2.0 + ((i * 7) % 3) * 0.12;
    b.cyl(0.2, 0.22, h, 6, i % 2 ? C.wood : C.woodDark, { x });
    b.cone(0.2, 0.4, 6, C.woodLight, { x, y: h });
  }
  b.box(len, 0.16, 0.14, C.woodDark, { y: 1.3, z: 0.2 });
  b.box(len, 0.16, 0.14, C.woodDark, { y: 0.6, z: 0.2 });
  return b.build();
}

export function stoneWallGeo(len) {
  const b = new Builder();
  b.box(len, 2.4, 1.0, C.stone);
  b.box(len + 0.02, 0.25, 1.1, C.stoneDark, { y: 0 });
  const n = Math.max(2, Math.round(len / 0.9));
  for (let i = 0; i < n; i += 2) b.box(len / n, 0.45, 1.0, C.stone, { x: -len / 2 + (i + 0.5) * (len / n), y: 2.4 });
  return b.build();
}

export function gateGeo(stone) {
  const b = new Builder();
  const post = stone ? C.stone : C.wood;
  if (stone) {
    b.box(1.4, 3.6, 1.6, C.stone, { x: -2.3 });
    b.box(1.4, 3.6, 1.6, C.stone, { x: 2.3 });
    b.box(6.0, 0.8, 1.6, C.stoneDark, { y: 3.6 });
    b.cone(1.0, 1.1, 4, C.roofBlue, { x: -2.3, y: 4.4, ry: Math.PI / 4 });
    b.cone(1.0, 1.1, 4, C.roofBlue, { x: 2.3, y: 4.4, ry: Math.PI / 4 });
  } else {
    b.cyl(0.32, 0.36, 3.6, 7, post, { x: -2.1 });
    b.cyl(0.32, 0.36, 3.6, 7, post, { x: 2.1 });
    b.box(5.0, 0.4, 0.5, C.woodDark, { y: 3.0 });
    b.cone(0.38, 0.6, 7, C.woodLight, { x: -2.1, y: 3.6 });
    b.cone(0.38, 0.6, 7, C.woodLight, { x: 2.1, y: 3.6 });
  }
  return b.build();
}

export function gateDoorGeo(stone) {
  const b = new Builder();
  const c = stone ? C.ironDark : C.woodDark;
  for (let i = 0; i < 7; i++) b.box(0.48, 2.7, 0.22, i % 2 ? C.wood : C.woodLight, { x: -1.55 + i * 0.52 });
  b.box(3.6, 0.2, 0.3, c, { y: 0.6 });
  b.box(3.6, 0.2, 0.3, c, { y: 2.0 });
  return b.build();
}

// --------------------------------------------------------------- buildings
function windowRow(b, w, y, z, n, color = 0x3b4b63) {
  for (let i = 0; i < n; i++) b.box(0.4, 0.5, 0.06, color, { x: -w / 2 + (i + 0.5) * (w / n), y, z });
}

export function castleGeo(level) {
  const b = new Builder();
  // Courtyard plinth.
  b.cyl(4.5, 4.7, 0.3, 10, C.sandDark);
  // Keep.
  const kh = 4.6 + level * 0.9;
  b.box(4.4, kh, 4.0, C.stone, { y: 0.3 });
  b.box(4.6, 0.3, 4.2, C.stoneDark, { y: 0.3 });
  // Timber frame.
  for (const x of [-2.2, 2.2]) for (const z of [-2.0, 2.0]) b.box(0.3, kh, 0.3, C.wood, { x, y: 0.3, z });
  b.box(4.5, 0.25, 0.3, C.wood, { y: 0.3 + kh * 0.5, z: 2.05 });
  windowRow(b, 4.4, 0.3 + kh * 0.7, 2.02, 3);
  // Door + steps.
  b.box(1.2, 1.8, 0.2, C.woodDark, { y: 0.3, z: 2.05 });
  b.cyl(0.62, 0.62, 0.2, 10, C.woodDark, { y: 1.95, z: 2.05, rx: Math.PI / 2, sz: 1 });
  b.box(2.0, 0.25, 0.8, C.stoneDark, { y: 0.3, z: 2.5 });
  // Blue roof with dormer.
  b.roof(4.9, 2.2, 4.5, C.roofBlue, { y: 0.3 + kh });
  b.box(1.0, 0.8, 0.8, C.roofBlueDark, { x: -0.8, y: 0.3 + kh + 0.5, z: 1.1 });
  b.cyl(0.08, 0.08, 1.4, 5, C.ironDark, { y: 0.3 + kh + 2.1 });
  // Golden crown emblem on the gable.
  b.box(0.9, 0.5, 0.2, C.gold, { x: 1.4, y: 0.3 + kh + 0.2, z: 2.2 });
  for (let i = 0; i < 3; i++) b.cone(0.13, 0.35, 4, C.gold, { x: 1.1 + i * 0.3, y: 0.3 + kh + 0.7, z: 2.2 });
  // Corner turrets.
  const turrets = level >= 1 ? [[-2.9, 2.5], [2.9, 2.5], [-2.9, -2.5], [2.9, -2.5]] : [[2.9, 2.4], [-2.9, -2.4]];
  for (const [x, z] of turrets) {
    const th = 3.6 + level * 0.7;
    b.cyl(0.85, 0.95, th, 8, C.stone, { x, y: 0.3, z });
    b.cyl(1.05, 1.05, 0.35, 8, C.stoneDark, { x, y: 0.3 + th, z });
    b.cone(1.1, 1.8, 8, C.roofBlue, { x, y: 0.65 + th, z });
    if (level >= 2) b.box(0.05, 0.9, 0.05, C.ironDark, { x, y: 2.45 + th, z });
    if (level >= 2) b.box(0.6, 0.35, 0.04, C.red, { x: x + 0.3, y: 3.0 + th, z });
  }
  if (level >= 2) {
    // A rear tower.
    b.box(2.4, kh + 2.2, 2.2, C.stone, { y: 0.3, z: -2.4 });
    b.cone(1.9, 2.4, 4, C.roofBlueDark, { y: 2.5 + kh, z: -2.4, ry: Math.PI / 4 });
  }
  if (level >= 3) {
    b.box(5.2, 0.3, 0.3, C.gold, { y: 0.3 + kh, z: 2.15 });
    b.ball(0.35, C.gold, { y: 0.3 + kh + 2.5 });
  }
  // Brazier like the reference.
  b.cyl(0.25, 0.3, 0.9, 6, C.stoneDark, { x: 3.2, y: 0.3, z: 3.2 });
  b.cyl(0.32, 0.22, 0.25, 6, C.ironDark, { x: 3.2, y: 1.2, z: 3.2 });
  return b.build();
}

export function houseGeo(level) {
  const b = new Builder();
  const w = 3.2 + level * 0.2, d = 3.0, h = 2.0 + level * 0.4;
  const wall = level >= 2 ? C.stone : C.cream;
  b.box(w + 0.3, 0.3, d + 0.3, level >= 2 ? C.stoneDark : C.woodDark);
  b.box(w, h, d, wall, { y: 0.3 });
  for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) b.box(0.22, h, 0.22, C.wood, { x, y: 0.3, z });
  b.box(w, 0.2, 0.22, C.wood, { y: 0.3 + h * 0.55, z: d / 2 });
  b.box(0.8, 1.3, 0.1, C.woodDark, { x: -0.6, y: 0.3, z: d / 2 + 0.02 });
  b.box(0.6, 0.55, 0.08, 0x3b4b63, { x: 0.8, y: 1.0, z: d / 2 + 0.02 });
  b.roof(w + 0.7, 1.5 + level * 0.2, d + 0.8, level >= 1 ? C.roofRed : C.roofBrown, { y: 0.3 + h });
  b.box(0.45, 1.2, 0.45, C.stoneDark, { x: w / 4, y: 0.3 + h + 0.4, z: -0.5 });
  if (level >= 1) {
    b.box(1.2, 1.0, 1.2, C.woodLight, { x: w / 2 + 0.2, y: 0.3, z: -0.6 });
    b.roof(1.5, 0.6, 1.4, C.roofRed, { x: w / 2 + 0.2, y: 1.3, z: -0.6, ry: Math.PI / 2 });
  }
  return b.build();
}

export function farmGeo(level) {
  const b = new Builder();
  b.box(5.8, 0.12, 5.8, 0x8a6a42);
  // Crop rows.
  const rows = 5;
  for (let i = 0; i < rows; i++) {
    const z = -2.2 + i * 1.1;
    b.box(4.0, 0.25, 0.55, 0x6a4f30, { x: -0.6, y: 0.12, z });
    for (let k = 0; k < 6; k++) b.cone(0.22, 0.55 + level * 0.1, 5, i % 2 ? C.crop : 0x9ac74a, { x: -2.3 + k * 0.68, y: 0.3, z });
  }
  // Fence.
  for (const s of [-1, 1]) {
    b.box(5.8, 0.1, 0.1, C.woodLight, { y: 0.55, z: s * 2.85 });
    b.box(0.1, 0.1, 5.8, C.woodLight, { x: s * 2.85, y: 0.55 });
  }
  for (let i = 0; i < 6; i++) for (const s of [-1, 1]) {
    b.box(0.14, 0.8, 0.14, C.wood, { x: -2.85 + i * 1.14, z: s * 2.85 });
    b.box(0.14, 0.8, 0.14, C.wood, { x: s * 2.85, z: -2.85 + i * 1.14 });
  }
  // Hay bales and a scarecrow-ish shed.
  b.cyl(0.45, 0.45, 0.7, 8, C.hay, { x: 2.1, y: 0.12, z: -1.6, rz: Math.PI / 2 });
  b.cyl(0.45, 0.45, 0.7, 8, C.hay, { x: 2.1, y: 0.12, z: -0.6, rz: Math.PI / 2 });
  if (level >= 1) {
    b.box(1.2, 1.4, 1.2, C.wood, { x: 2.1, y: 0.12, z: 1.6 });
    b.roof(1.5, 0.8, 1.5, C.roofRed, { x: 2.1, y: 1.52, z: 1.6 });
  }
  if (level >= 2) {
    b.cyl(0.5, 0.5, 2.0, 8, C.stone, { x: 2.1, y: 0.12, z: 0.5 });
    b.cone(0.6, 0.6, 8, C.roofRed, { x: 2.1, y: 2.12, z: 0.5 });
  }
  return b.build();
}

export function barracksGeo(level) {
  const b = new Builder();
  const w = 5.2, d = 3.6, h = 2.4 + level * 0.3;
  b.box(w + 0.4, 0.3, d + 0.4, C.stoneDark);
  b.box(w, h, d, level >= 2 ? C.stone : C.cream, { y: 0.3 });
  for (const x of [-w / 2, 0, w / 2]) for (const z of [-d / 2, d / 2]) b.box(0.26, h, 0.26, C.woodDark, { x, y: 0.3, z });
  b.box(1.2, 1.7, 0.1, C.woodDark, { y: 0.3, z: d / 2 + 0.02 });
  b.roof(w + 0.6, 1.6, d + 0.7, C.roofBlue, { y: 0.3 + h });
  // Banner and shield.
  b.box(0.08, 3.6, 0.08, C.ironDark, { x: -w / 2 - 0.5, z: d / 2 });
  b.box(0.9, 1.3, 0.05, C.blue, { x: -w / 2 - 0.02, y: 2.2, z: d / 2 });
  b.cyl(0.55, 0.55, 0.12, 8, C.gold, { x: 1.6, y: 1.5, z: d / 2 + 0.06, rx: Math.PI / 2 });
  b.box(0.7, 0.7, 0.14, C.red, { x: 1.6, y: 1.15, z: d / 2 + 0.1 });
  // Weapon rack.
  b.box(1.6, 0.12, 0.12, C.wood, { x: w / 2 + 0.6, y: 1.0, z: 0.5 });
  for (let i = 0; i < 4; i++) b.box(0.06, 1.6, 0.06, C.iron, { x: w / 2 + 0.05 + i * 0.36, y: 0.1, z: 0.5 });
  return b.build();
}

export function stableGeo() {
  const b = new Builder();
  b.box(5.6, 0.2, 4.4, C.sandDark);
  b.box(4.6, 2.4, 3.0, C.wood, { y: 0.2, z: -0.6 });
  b.roof(5.2, 1.4, 3.6, C.roofRed, { y: 2.6, z: -0.6 });
  for (let i = 0; i < 3; i++) b.box(1.1, 1.5, 0.1, C.woodDark, { x: -1.5 + i * 1.5, y: 0.2, z: 0.92 });
  // Fenced paddock.
  for (const x of [-2.6, 2.6]) b.box(0.12, 1.0, 1.8, C.woodLight, { x, y: 0.2, z: 1.8 });
  b.box(5.2, 0.12, 0.12, C.woodLight, { y: 0.9, z: 2.7 });
  b.box(5.2, 0.12, 0.12, C.woodLight, { y: 0.5, z: 2.7 });
  b.cyl(0.45, 0.45, 0.8, 8, C.hay, { x: 1.8, y: 0.2, z: 1.8, rz: Math.PI / 2 });
  b.box(0.8, 0.4, 0.5, C.woodDark, { x: -1.6, y: 0.2, z: 1.9 });
  b.box(0.7, 0.1, 0.4, C.water, { x: -1.6, y: 0.55, z: 1.9 });
  // Horseshoe sign.
  b.add(new THREE.TorusGeometry(0.35, 0.08, 4, 10, Math.PI * 1.4), C.ironDark, { y: 3.3, z: 0.95, rz: -Math.PI * 0.2 });
  return b.build();
}

export function rangeGeo() {
  const b = new Builder();
  b.box(5.6, 0.2, 5.6, C.sandDark);
  b.box(3.6, 2.4, 2.8, C.wood, { y: 0.2, z: -1.2 });
  b.roof(4.2, 1.5, 3.4, C.roofBrown, { y: 2.6, z: -1.2 });
  // Big bow sign over the door, like the reference.
  b.add(new THREE.TorusGeometry(0.9, 0.09, 4, 12, Math.PI), C.woodLight, { y: 2.8, z: 0.32, rz: -Math.PI / 2 });
  b.box(0.04, 1.8, 0.04, C.white, { x: 0, y: 1.9, z: 0.32 });
  b.box(1.9, 0.08, 0.08, C.iron, { x: 0.3, y: 2.8, z: 0.34 });
  b.cone(0.14, 0.35, 4, C.blue, { x: 1.35, y: 2.8, z: 0.34, rz: -Math.PI / 2 });
  // Targets.
  for (const x of [-1.8, 0, 1.8]) {
    b.box(0.12, 1.2, 0.12, C.woodDark, { x, z: 2.2 });
    b.cyl(0.55, 0.55, 0.16, 12, C.white, { x, y: 1.4, z: 2.2, rx: Math.PI / 2 });
    b.cyl(0.36, 0.36, 0.18, 12, C.red, { x, y: 1.4, z: 2.2, rx: Math.PI / 2 });
    b.cyl(0.14, 0.14, 0.2, 8, C.gold, { x, y: 1.4, z: 2.2, rx: Math.PI / 2 });
  }
  return b.build();
}

export function goldmineGeo(level) {
  const b = new Builder();
  // Rocky hill with a timbered entrance and gold veins.
  b.add(new THREE.DodecahedronGeometry(2.4, 0), C.rock, { x: -0.4, y: 0.9, z: -0.8, sy: 0.75 });
  b.add(new THREE.DodecahedronGeometry(1.6, 0), C.rockDark, { x: 1.4, y: 0.7, z: -1.0, sy: 0.8 });
  b.add(new THREE.DodecahedronGeometry(0.5, 0), C.gold, { x: -1.6, y: 1.3, z: 0.2 });
  b.add(new THREE.DodecahedronGeometry(0.4, 0), C.gold, { x: 0.8, y: 1.6, z: -0.2 });
  b.add(new THREE.DodecahedronGeometry(0.35, 0), C.goldDark, { x: -0.2, y: 2.2, z: -0.6 });
  b.box(1.6, 1.8, 0.4, 0x2a2420, { y: 0, z: 1.1 });
  b.box(0.25, 2.0, 0.25, C.wood, { x: -0.9, z: 1.25 });
  b.box(0.25, 2.0, 0.25, C.wood, { x: 0.9, z: 1.25 });
  b.box(2.2, 0.28, 0.3, C.wood, { y: 2.0, z: 1.25 });
  // Rails and a cart.
  b.box(0.08, 0.06, 2.2, C.ironDark, { x: -0.35, z: 2.0 });
  b.box(0.08, 0.06, 2.2, C.ironDark, { x: 0.35, z: 2.0 });
  b.box(1.0, 0.6, 0.9, C.woodDark, { y: 0.25, z: 2.3 });
  b.ball(0.38, C.gold, { y: 0.9, z: 2.3 });
  if (level >= 1) {
    b.box(1.4, 1.6, 1.2, C.wood, { x: 2.0, z: 1.3 });
    b.roof(1.7, 0.7, 1.5, C.roofBrown, { x: 2.0, y: 1.6, z: 1.3 });
  }
  if (level >= 2) {
    b.box(0.2, 3.2, 0.2, C.woodDark, { x: -1.9, z: 1.4 });
    b.box(1.6, 0.18, 0.18, C.woodDark, { x: -1.3, y: 3.1, z: 1.4 });
    b.cyl(0.25, 0.25, 0.3, 8, C.iron, { x: -0.6, y: 2.7, z: 1.4 });
  }
  return b.build();
}

export function lumberGeo(level) {
  const b = new Builder();
  b.box(4.8, 0.15, 4.8, 0x8a6a42);
  // Log cabin.
  for (let i = 0; i < 5; i++) {
    b.cyl(0.2, 0.2, 2.8, 6, i % 2 ? C.wood : C.woodDark, { y: 0.15 + i * 0.36 - 1.4 + 1.4, z: -1.0 - 0.9, rz: Math.PI / 2, x: 0 });
  }
  b.box(2.6, 1.8, 1.8, C.wood, { y: 0.15, z: -1.0 });
  b.roof(3.2, 1.1, 2.4, C.roofBrown, { y: 1.95, z: -1.0 });
  b.box(0.7, 1.2, 0.08, C.woodDark, { y: 0.15, z: -0.08 });
  // Log pile.
  for (let r = 0; r < 3; r++) for (let i = 0; i < 3 - r; i++) {
    b.cyl(0.26, 0.26, 1.8, 7, i % 2 ? C.woodLight : C.wood, { x: 1.5, y: 0.15 + r * 0.42, z: 0.6 + i * 0.52 + r * 0.26, rx: Math.PI / 2, ry: Math.PI / 2 });
  }
  // Chopping stump with axe.
  b.cyl(0.4, 0.45, 0.5, 8, C.woodLight, { x: -1.4, y: 0.15, z: 1.2 });
  b.box(0.08, 0.8, 0.08, C.woodDark, { x: -1.4, y: 0.6, z: 1.2, rz: 0.4 });
  b.box(0.3, 0.2, 0.06, C.iron, { x: -1.6, y: 1.25, z: 1.2 });
  if (level >= 1) {
    // Cart.
    b.box(1.4, 0.4, 0.9, C.wood, { x: -1.3, y: 0.5, z: -0.1 + 1.6 - 1.6, });
    b.cyl(0.35, 0.35, 0.1, 8, C.woodDark, { x: -1.3, y: 0.35, z: 0.5, rx: Math.PI / 2 });
  }
  if (level >= 2) b.cyl(0.6, 0.6, 0.2, 10, C.iron, { x: 1.8, y: 1.6, z: -1.6, rx: Math.PI / 2 });
  return b.build();
}

export function quarryGeo(level) {
  const b = new Builder();
  b.box(4.8, 0.12, 4.8, 0xb9b2a4);
  b.add(new THREE.DodecahedronGeometry(1.7, 0), C.rock, { x: -0.8, y: 0.9, z: -1.0, sy: 0.8 });
  b.add(new THREE.DodecahedronGeometry(1.1, 0), C.rockDark, { x: 1.2, y: 0.6, z: -1.4 });
  // Cut blocks.
  for (let i = 0; i < 4; i++) b.box(0.8, 0.6, 0.8, C.stone, { x: 0.6 + (i % 2) * 0.9, y: 0.12 + Math.floor(i / 2) * 0.6, z: 1.0 + (i % 2) * 0.1 });
  b.box(0.8, 0.6, 0.8, C.stone, { x: 1.05, y: 1.32, z: 1.0 });
  // Tent.
  b.roof(1.6, 1.2, 1.6, C.cloth, { x: -1.4, y: 0.12, z: 1.3, ry: Math.PI / 2 });
  // Crane.
  b.box(0.18, 3.0, 0.18, C.woodDark, { x: 2.0, z: -0.2 });
  b.box(1.8, 0.16, 0.16, C.woodDark, { x: 1.2, y: 2.9, z: -0.2 });
  b.box(0.04, 1.2, 0.04, C.black, { x: 0.4, y: 1.7, z: -0.2 });
  if (level >= 1) b.box(1.2, 0.5, 0.8, C.wood, { x: -0.2, y: 0.4, z: 2.0 });
  if (level >= 2) b.box(0.6, 0.6, 0.6, C.stone, { x: -0.2, y: 0.9, z: 2.0 });
  return b.build();
}

export function bridgeGeo() {
  const b = new Builder();
  const len = 8.4, w = 3.4;
  for (let i = 0; i < 14; i++) b.box(w, 0.18, len / 14 - 0.06, i % 2 ? C.plank : C.woodLight, { y: 0.35, z: -len / 2 + (i + 0.5) * (len / 14) });
  for (const x of [-w / 2, w / 2]) {
    b.box(0.14, 0.14, len, C.woodDark, { x, y: 1.1 });
    for (let i = 0; i < 5; i++) b.box(0.18, 1.1, 0.18, C.woodDark, { x, y: 0.0, z: -len / 2 + i * (len / 4) });
  }
  return b.build();
}

export function towerGeo(level) {
  const b = new Builder();
  if (level === 0) {
    // Wooden stilt platform, like the ads.
    for (const x of [-1, 1]) for (const z of [-1, 1]) b.box(0.3, 3.0, 0.3, C.wood, { x: x * 1.0, z: z * 1.0, rx: -z * 0.06, rz: x * 0.06 });
    b.box(2.4, 0.12, 0.12, C.woodDark, { y: 1.4, z: 1.0 });
    b.box(2.4, 0.12, 0.12, C.woodDark, { y: 1.4, z: -1.0 });
    b.box(0.12, 0.12, 2.4, C.woodDark, { x: 1.0, y: 1.4 });
    b.box(0.12, 0.12, 2.4, C.woodDark, { x: -1.0, y: 1.4 });
    b.box(2.8, 0.3, 2.8, C.plank, { y: 3.0 });
    b.box(2.8, 0.1, 0.1, C.woodDark, { y: 3.8, z: 1.35 });
    b.box(2.8, 0.1, 0.1, C.woodDark, { y: 3.8, z: -1.35 });
    for (const x of [-1.35, 1.35]) for (const z of [-1.35, 1.35]) b.box(0.12, 0.8, 0.12, C.woodDark, { x, y: 3.3, z });
  } else if (level === 1) {
    b.cyl(1.25, 1.45, 3.4, 8, C.stone);
    b.cyl(1.5, 1.5, 0.3, 8, C.stoneDark, { y: 3.4 });
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      b.box(0.5, 0.5, 0.35, C.stone, { x: Math.cos(a) * 1.35, y: 3.7, z: Math.sin(a) * 1.35, ry: -a });
    }
    b.box(0.6, 1.1, 0.1, C.woodDark, { y: 0, z: 1.38 });
    b.box(0.25, 0.5, 0.1, 0x3b4b63, { y: 2.0, z: 1.3 });
  } else {
    b.box(2.8, 3.6, 2.8, C.stone);
    b.box(3.1, 0.35, 3.1, C.stoneDark, { y: 3.6 });
    for (const x of [-1.3, 1.3]) for (const z of [-1.3, 1.3]) b.box(0.5, 0.6, 0.5, C.stone, { x, y: 3.95, z });
    b.box(3.0, 0.3, 0.3, C.gold, { y: 2.4, z: 1.42 });
    b.box(0.25, 0.6, 0.1, 0x3b4b63, { y: 1.6, z: 1.42 });
  }
  return b.build();
}

// The crossbow or ballista on a tower, aimed by the renderer.
export function towerGunGeo(level) {
  const b = new Builder();
  const s = level >= 2 ? 1.6 : 1;
  b.box(0.2 * s, 0.5, 0.2 * s, C.woodDark);
  b.box(0.22 * s, 0.22 * s, 1.5 * s, C.wood, { y: 0.5, z: 0.1 });
  b.add(new THREE.TorusGeometry(0.75 * s, 0.06 * s, 4, 10, Math.PI), C.woodLight, { y: 0.62, z: 0.55 * s, rx: -Math.PI / 2 });
  b.box(1.5 * s, 0.03, 0.03, C.white, { y: 0.62, z: 0.55 * s });
  b.box(0.08 * s, 0.08 * s, 1.1 * s, C.blue, { y: 0.72, z: 0.4 * s });
  b.cone(0.1 * s, 0.3 * s, 4, C.iron, { y: 0.72, z: 1.1 * s, rx: Math.PI / 2 });
  return b.build();
}

// Translucent building preview shown while placing.
export function siteGeo(size) {
  const b = new Builder();
  b.box(size, 0.05, size, C.white);
  return b.build();
}

// -------------------------------------------------------------------- rigs
// A rig is a list of parts. Each part has its own merged geometry and swings
// around `pivot` according to `anim`.
function part(build, o = {}) {
  const b = new Builder();
  build(b);
  return { geo: b.build(), pivot: o.pivot || [0, 0, 0], anim: o.anim || 'none', tint: !!o.tint, show: o.show || null, phase: o.phase || 0 };
}

function humanoid({ body, legs, head = C.skin, hat, extra, arm, tintBody = false, bulk = 1, height = 1 }) {
  const parts = [];
  const hy = 0.75 * height;
  parts.push(part((b) => {
    b.box(0.5 * bulk, 0.62 * height, 0.34 * bulk, body, { y: hy });
    b.box(0.54 * bulk, 0.12, 0.38 * bulk, C.woodDark, { y: hy + 0.02 });
  }, { tint: tintBody }));
  parts.push(part((b) => {
    b.ball(0.24 * Math.sqrt(bulk), head, { y: hy + 0.62 * height + 0.2 }, 1);
    if (hat) hat(b, hy + 0.62 * height + 0.2);
    if (extra) extra(b, hy);
  }));
  for (const side of [-1, 1]) {
    parts.push(part((b) => b.box(0.18 * bulk, hy, 0.2 * bulk, legs, { x: side * 0.13 * bulk }), {
      pivot: [0, hy, 0], anim: side < 0 ? 'legA' : 'legB',
    }));
  }
  if (arm) parts.push(part((b) => arm(b, hy + 0.55 * height), { pivot: [0.32 * bulk, hy + 0.55 * height, 0], anim: 'arm' }));
  return parts;
}

const sword = (len = 0.8, blade = C.iron) => (b, y) => {
  b.box(0.14, 0.42, 0.14, C.skin, { x: 0.32, y: y - 0.4 });
  b.box(0.05, len, 0.1, blade, { x: 0.32, y: y - 0.25, z: 0.2, rx: Math.PI / 2 - 0.3 });
  b.box(0.24, 0.05, 0.05, C.goldDark, { x: 0.32, y: y - 0.32, z: 0.06 });
};

const bow = (b, y) => {
  b.box(0.14, 0.42, 0.14, C.skin, { x: 0.32, y: y - 0.4 });
  b.add(new THREE.TorusGeometry(0.42, 0.035, 3, 8, Math.PI), C.woodDark, { x: 0.36, y: y - 0.2, z: 0.18, rz: Math.PI / 2, ry: Math.PI / 2 });
};

export const RIGS = {
  hero() {
    const parts = [];
    // Horse.
    parts.push(part((b) => {
      b.box(0.85, 0.8, 1.9, C.white, { y: 1.0 });
      b.box(0.9, 0.12, 0.9, C.blue, { y: 1.78, z: -0.05 });
      b.box(0.95, 0.5, 0.7, C.blueDark, { y: 1.35, z: -0.05 });
      b.box(0.42, 0.95, 0.5, C.white, { y: 1.45, z: 0.95, rx: -0.5 });
      b.box(0.38, 0.38, 0.75, C.white, { y: 2.15, z: 1.35 });
      b.box(0.3, 0.3, 0.2, 0xd9cfc0, { y: 2.12, z: 1.78 });
      b.box(0.12, 0.62, 0.5, C.hair, { y: 1.75, z: 0.9, rx: -0.5 });
      b.cone(0.07, 0.2, 4, C.white, { x: 0.12, y: 2.5, z: 1.25 });
      b.cone(0.07, 0.2, 4, C.white, { x: -0.12, y: 2.5, z: 1.25 });
      b.box(0.14, 0.7, 0.14, C.hair, { y: 1.0, z: -1.05, rx: 0.4 });
    }));
    const legs = [[-0.28, 0.72, 'legA'], [0.28, 0.72, 'legB'], [-0.28, -0.72, 'legB'], [0.28, -0.72, 'legA']];
    for (const [x, z, anim] of legs) {
      parts.push(part((b) => {
        b.box(0.2, 0.9, 0.22, C.white, { x, y: 0.15, z });
        b.box(0.22, 0.16, 0.24, 0x8a7a6a, { x, y: 0.0, z });
      }, { pivot: [x, 1.05, z], anim }));
    }
    // King.
    parts.push(part((b) => {
      b.box(0.62, 0.75, 0.45, C.blue, { y: 1.85 });
      b.box(0.66, 0.14, 0.5, C.gold, { y: 2.1 });
      b.box(0.3, 0.5, 0.2, C.white, { x: 0.38, y: 1.6, z: 0.15 });
      b.box(0.3, 0.5, 0.2, C.white, { x: -0.38, y: 1.6, z: 0.15 });
      b.box(0.75, 0.9, 0.1, C.red, { y: 1.75, z: -0.3, rx: 0.15 });
      b.ball(0.3, C.skin, { y: 2.85 }, 1);
      b.box(0.42, 0.3, 0.2, 0xd8d0c4, { y: 2.62, z: 0.18 });
      b.cyl(0.3, 0.27, 0.2, 8, C.gold, { y: 3.05 });
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        b.cone(0.07, 0.2, 4, C.gold, { x: Math.cos(a) * 0.25, y: 3.25, z: Math.sin(a) * 0.25 });
      }
      b.ball(0.06, C.blue, { y: 3.12, z: 0.29 });
    }));
    parts.push(part((b) => {
      b.box(0.16, 0.5, 0.16, C.blue, { x: 0.42, y: 2.0 });
      b.add(new THREE.TorusGeometry(0.55, 0.04, 3, 10, Math.PI), C.woodDark, { x: 0.5, y: 2.0, z: 0.35, rz: Math.PI / 2, ry: Math.PI / 2 });
      b.box(0.02, 1.1, 0.02, C.white, { x: 0.5, y: 1.45, z: 0.35 });
    }, { pivot: [0.42, 2.3, 0], anim: 'aim' }));
    return { parts, height: 3.6 };
  },
  knight() {
    return {
      parts: humanoid({
        body: C.blue, legs: C.ironDark,
        hat: (b, y) => { b.cyl(0.27, 0.27, 0.3, 8, C.iron, { y: y - 0.05 }); b.cone(0.28, 0.25, 8, C.iron, { y: y + 0.25 }); b.box(0.06, 0.28, 0.3, C.gold, { y: y + 0.28 }); },
        extra: (b, y) => { b.box(0.08, 0.6, 0.5, C.blueDark, { x: -0.32, y: y + 0.1, z: 0.1 }); b.box(0.09, 0.2, 0.2, C.gold, { x: -0.37, y: y + 0.3, z: 0.1 }); },
        arm: sword(0.85),
      }),
      height: 2.1,
    };
  },
  archer() {
    return {
      parts: humanoid({
        body: C.green, legs: C.woodDark,
        hat: (b, y) => { b.cone(0.3, 0.45, 6, 0x2f7a3a, { y: y + 0.02 }); },
        extra: (b, y) => { b.box(0.2, 0.55, 0.16, C.woodDark, { x: -0.1, y: y + 0.15, z: -0.24, rz: 0.3 }); },
        arm: bow,
      }),
      height: 2.1,
    };
  },
  raider() {
    return {
      parts: humanoid({
        body: C.white, legs: 0x3a3f52,
        hat: (b, y) => { b.ball(0.26, C.black, { y: y + 0.08, sy: 0.75 }); },
        extra: (b, y) => { b.box(0.14, 0.42, 0.14, C.skin, { x: -0.32, y: y + 0.15 }); },
        arm: (b, y) => {
          b.box(0.14, 0.42, 0.14, C.skin, { x: 0.32, y: y - 0.4 });
          b.box(0.06, 0.7, 0.06, C.woodDark, { x: 0.32, y: y - 0.25, z: 0.2, rx: Math.PI / 2 - 0.3 });
          b.box(0.06, 0.3, 0.28, C.iron, { x: 0.32, y: y - 0.12, z: 0.5, rx: Math.PI / 2 - 0.3 });
        },
      }),
      height: 2.1,
    };
  },
  villager() {
    const parts = humanoid({
      body: 0xffffff, legs: C.woodDark, tintBody: true,
      hat: (b, y) => { b.ball(0.25, C.hair, { y: y + 0.08, z: -0.03, sy: 0.7 }); },
      arm: (b, y) => {
        b.box(0.14, 0.45, 0.14, C.skin, { x: 0.32, y: y - 0.4 });
        b.box(0.05, 0.6, 0.05, C.woodDark, { x: 0.32, y: y - 0.25, z: 0.18, rx: Math.PI / 2 - 0.4 });
        b.box(0.05, 0.18, 0.22, C.iron, { x: 0.32, y: y - 0.15, z: 0.42, rx: Math.PI / 2 - 0.4 });
      },
    });
    parts.push(part((b) => b.cyl(0.18, 0.18, 1.3, 6, C.wood, { y: 1.55, z: -0.1, rz: Math.PI / 2 }), { show: 'wood' }));
    parts.push(part((b) => b.box(0.5, 0.4, 0.4, C.stone, { y: 1.45, z: -0.05 }), { show: 'stone' }));
    return { parts, height: 1.9 };
  },
  grunt() {
    return {
      parts: humanoid({
        body: C.red, legs: C.redDark,
        hat: (b, y) => {
          b.cyl(0.28, 0.28, 0.34, 8, C.red, { y: y - 0.08 });
          b.box(0.4, 0.06, 0.06, C.black, { y: y + 0.0, z: 0.26 });
          b.box(0.08, 0.35, 0.5, C.redDark, { y: y + 0.24, z: -0.1 });
        },
        arm: sword(0.75),
      }),
      height: 2.1,
    };
  },
  brute() {
    return {
      parts: humanoid({
        body: C.redDark, legs: 0x5a1a18, bulk: 1.45,
        hat: (b, y) => {
          b.cyl(0.36, 0.36, 0.36, 8, C.ironDark, { y: y - 0.1 });
          b.cone(0.08, 0.35, 4, C.cream, { x: 0.3, y: y + 0.1, rz: -0.6 });
          b.cone(0.08, 0.35, 4, C.cream, { x: -0.3, y: y + 0.1, rz: 0.6 });
        },
        extra: (b, y) => { b.box(0.8, 0.22, 0.5, C.ironDark, { y: y + 0.58 }); },
        arm: (b, y) => {
          b.box(0.2, 0.46, 0.2, C.skin, { x: 0.46, y: y - 0.4 });
          b.cyl(0.14, 0.2, 1.0, 6, C.woodDark, { x: 0.46, y: y - 0.3, z: 0.1, rx: Math.PI / 2 - 0.3 });
        },
      }),
      height: 2.3,
    };
  },
  bowman() {
    return {
      parts: humanoid({
        body: 0xb8322c, legs: C.redDark,
        hat: (b, y) => { b.cone(0.3, 0.5, 6, C.redDark, { y: y + 0.0 }); },
        arm: bow,
      }),
      height: 2.1,
    };
  },
  outrider() {
    return {
      parts: humanoid({
        body: 0xe0563a, legs: C.redDark,
        hat: (b, y) => { b.ball(0.26, C.redDark, { y: y + 0.06, sy: 0.7 }); b.box(0.5, 0.1, 0.06, C.black, { y, z: 0.24 }); },
        arm: (b, y) => {
          b.box(0.14, 0.42, 0.14, C.skin, { x: 0.32, y: y - 0.4 });
          b.box(0.05, 1.4, 0.05, C.woodDark, { x: 0.32, y: y - 0.4, z: 0.3, rx: Math.PI / 2 - 0.15 });
          b.cone(0.08, 0.25, 4, C.iron, { x: 0.32, y: y - 0.3, z: 1.0, rx: Math.PI / 2 - 0.15 });
        },
      }),
      height: 2.1,
    };
  },
  boss() {
    return {
      parts: humanoid({
        body: 0x5c1a24, legs: 0x2e2a30, bulk: 1.3,
        hat: (b, y) => {
          b.cyl(0.33, 0.33, 0.4, 8, C.black, { y: y - 0.12 });
          b.cone(0.07, 0.5, 4, C.cream, { x: 0.32, y: y + 0.1, rz: -0.8 });
          b.cone(0.07, 0.5, 4, C.cream, { x: -0.32, y: y + 0.1, rz: 0.8 });
          b.cyl(0.36, 0.36, 0.08, 8, C.gold, { y: y + 0.24 });
          b.box(0.4, 0.06, 0.06, 0xff4020, { y, z: 0.32 });
        },
        extra: (b, y) => {
          b.box(0.9, 0.25, 0.55, C.gold, { y: y + 0.55 });
          b.box(0.8, 0.9, 0.08, 0x2e1a28, { y: y - 0.05, z: -0.3, rx: 0.15 });
        },
        arm: (b, y) => {
          b.box(0.2, 0.46, 0.2, 0x5c1a24, { x: 0.42, y: y - 0.4 });
          b.box(0.07, 1.4, 0.07, C.woodDark, { x: 0.42, y: y - 0.3, z: 0.2, rx: Math.PI / 2 - 0.3 });
          b.box(0.06, 0.5, 0.6, C.iron, { x: 0.42, y: y - 0.05, z: 0.9, rx: Math.PI / 2 - 0.3 });
        },
      }),
      height: 2.3,
    };
  },
};

// ------------------------------------------------------------------- props
export function coinGeo() {
  const g = new THREE.CylinderGeometry(0.3, 0.3, 0.085, 12);
  return g;
}

export function arrowGeo() {
  const b = new Builder();
  b.box(0.05, 0.05, 0.9, C.woodLight, { y: -0.025 });
  b.cone(0.07, 0.2, 4, C.iron, { z: 0.5, y: -0.1 + 0.1, rx: Math.PI / 2, order: 'XYZ' });
  b.box(0.16, 0.02, 0.18, C.white, { z: -0.38, y: -0.01 });
  return b.build();
}

export function chevronGeo() {
  const s = new THREE.Shape();
  s.moveTo(0, 0.55);
  s.lineTo(0.42, -0.3);
  s.lineTo(-0.42, -0.3);
  s.closePath();
  const g = new THREE.ShapeGeometry(s);
  g.rotateX(-Math.PI / 2);
  return g;
}

// The rockfall blocking the mountain pass, shown until it is cleared.
export function rockfallGeo() {
  const b = new Builder();
  const pts = [[-1.6, 0.4, 1.3], [0.2, -0.6, 1.6], [1.7, 0.3, 1.1], [-0.6, 1.4, 1.0], [0.9, 1.6, 0.9], [-1.9, -1.2, 0.8], [1.8, -1.4, 0.9], [0, 0.4, 1.5]];
  pts.forEach(([x, z, s], i) => b.add(new THREE.DodecahedronGeometry(s, 0), i % 2 ? C.rock : C.rockDark, { x, y: s * 0.55, z, sy: 0.8, ry: i }));
  b.box(0.12, 1.4, 0.12, C.woodDark, { x: 2.6, z: 2.4 });
  b.box(1.0, 0.5, 0.08, C.woodLight, { x: 2.6, y: 1.0, z: 2.45 });
  return b.build();
}

// A cleared pass: gravel, a signpost and a timber arch.
export function passGeo() {
  const b = new Builder();
  b.box(4.2, 0.08, 4.2, 0xb9b2a4);
  for (const x of [-1.9, 1.9]) b.cyl(0.22, 0.26, 3.2, 6, C.wood, { x });
  b.box(4.4, 0.35, 0.4, C.woodDark, { y: 3.0 });
  b.box(1.8, 0.7, 0.12, C.woodLight, { y: 3.3, z: 0.22 });
  b.cone(0.28, 0.4, 4, C.stoneDark, { x: -0.4, y: 3.42, z: 0.3 });
  b.cone(0.36, 0.5, 4, C.stone, { x: 0.25, y: 3.42, z: 0.3 });
  b.add(new THREE.DodecahedronGeometry(0.7, 0), C.rock, { x: -2.6, y: 0.4, z: 1.4 });
  b.add(new THREE.DodecahedronGeometry(0.5, 0), C.rockDark, { x: 2.7, y: 0.3, z: -1.2 });
  return b.build();
}
