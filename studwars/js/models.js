// Every model in the game, built from bricks in code. Static models merge into
// one vertex-coloured geometry each. Figures are "rigs": a few merged parts
// that swing around pivots (legs, arms), drawn instanced.

import * as THREE from './vendor/three.js';

export const C = {
  grass: 0x5cae3e, grassB: 0x54a437, sand: 0xe6cf8f, sandB: 0xdcc382, water: 0x3a8ee0, waterB: 0x3485d6,
  stone: 0xa3a7ad, stoneL: 0xc4c7cc, stoneD: 0x6c7076, brown: 0x7a4a26, brownD: 0x5a3519, tan: 0xd8b97a, tanD: 0xb8975a,
  yellow: 0xf5cd2f, black: 0x2a2a2e, white: 0xf3f3f1, red: 0xc92a1e, redD: 0x8e1d15, blue: 0x1f5fb8, blueD: 0x153f80,
  gold: 0xe7ad1f, silver: 0xc9ccd2, leaf: 0x3e9b3b, leafD: 0x2c7a30, leafL: 0x5cbc45, orange: 0xe9792a, iron: 0x8a9099,
  ironD: 0x50555c, cloth: 0xefe3c5, plank: 0xa86c3a, plankD: 0x82502a, roofBlue: 0x2459b8, green: 0x2f8a3e, purple: 0x7a3fa0,
  hay: 0xf0c94a, skinTone: 0xf5cd2f,
};

const col = new THREE.Color();
const TAU = Math.PI * 2;

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
  // A square frustum (wider at the bottom), like a figure's torso.
  frustum(wt, wb, h, d, color, o = {}) {
    const g = new THREE.CylinderGeometry(wt * Math.SQRT1_2, wb * Math.SQRT1_2, h, 4);
    g.rotateY(Math.PI / 4);
    return this.add(g, color, { ...o, y: (o.y || 0) + h / 2, sz: (d / wb) * (o.sz || 1) });
  }
  // Studs on a top surface centred at (x, z), height y, covering w x d.
  studs(x, y, z, w, d, color, pitch = 0.5) {
    const nx = Math.max(1, Math.round(w / pitch)), nz = Math.max(1, Math.round(d / pitch));
    for (let i = 0; i < nx; i++) for (let k = 0; k < nz; k++) {
      this.cyl(0.14, 0.14, 0.09, 8, color, { x: x - w / 2 + (i + 0.5) * (w / nx), y, z: z - d / 2 + (k + 0.5) * (d / nz) });
    }
    return this;
  }
  // A brick: a box with studs on top.
  brick(w, h, d, color, o = {}) {
    this.box(w, h, d, color, o);
    if (o.studs !== false) this.studs(o.x || 0, (o.y || 0) + h, o.z || 0, w, d, color);
    return this;
  }

  build() { return mergeParts(this.parts); }
}

function prismGeo(w, h, d) {
  const x = w / 2, z = d / 2;
  const v = [
    -x, 0, z, x, 0, z, x, h, 0, -x, 0, z, x, h, 0, -x, h, 0,
    x, 0, -z, -x, 0, -z, -x, h, 0, x, 0, -z, -x, h, 0, x, h, 0,
    x, 0, z, x, 0, -z, x, h, 0,
    -x, 0, -z, -x, 0, z, -x, h, 0,
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
    pos.set(g.attributes.position.array, o * 3);
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

// ----------------------------------------------------------------- figures
// A rig part: geometry built in world space, then moved so its pivot sits at
// the origin. anim: body | legL | legR | armL | armR | hlegA | hlegB
function part(fn, pivot = [0, 0, 0], anim = 'body') {
  const b = new Builder();
  fn(b);
  const geo = b.build();
  geo.translate(-pivot[0], -pivot[1], -pivot[2]);
  return { geo, pivot, anim };
}

const HIP = 0.46, SHOULDER = 0.86;

// A brick figure. y lifts the whole figure (for riders); seated bends the legs forward.
function figure(o) {
  const y0 = o.y || 0;
  const skin = o.skin || C.yellow;
  const parts = [];
  const shirt = o.shirt, pants = o.pants || C.black;

  parts.push(part((b) => {
    if (!o.seated) b.box(0.42, 0.08, 0.22, pants, { y: y0 + HIP - 0.04 });
    b.frustum(0.34, 0.42, 0.42, 0.22, shirt, { y: y0 + 0.5 });
    if (o.torso) o.torso(b, y0);
    b.cyl(0.07, 0.07, 0.04, 8, skin, { y: y0 + 0.92 });
    b.cyl(0.135, 0.135, 0.24, 12, skin, { y: y0 + 0.96 });
    b.cyl(0.07, 0.07, 0.05, 8, skin, { y: y0 + 1.2 });
    b.box(0.035, 0.055, 0.02, C.black, { x: -0.05, y: y0 + 1.08, z: 0.128 });
    b.box(0.035, 0.055, 0.02, C.black, { x: 0.05, y: y0 + 1.08, z: 0.128 });
    b.box(0.1, 0.02, 0.02, C.black, { y: y0 + 1.02, z: 0.128 });
    if (o.hat) o.hat(b, y0 + 1.2);
    if (o.seated) {
      b.box(0.42, 0.1, 0.22, pants, { y: y0 + HIP - 0.06 });
      for (const x of [-0.1, 0.1]) b.box(0.18, 0.12, 0.36, pants, { x, y: y0 + HIP - 0.08, z: 0.16 });
      for (const x of [-0.13, 0.13]) b.box(0.16, 0.34, 0.14, pants, { x: x * 1.9, y: y0 + 0.08, z: 0.28 });
    }
  }));

  if (!o.seated) {
    for (const [s, anim] of [[-1, 'legL'], [1, 'legR']]) {
      parts.push(part((b) => {
        b.box(0.19, 0.38, 0.22, pants, { x: s * 0.1, y: y0 + 0.07 });
        b.box(0.19, 0.08, 0.27, pants, { x: s * 0.1, y: y0, z: 0.025 });
      }, [s * 0.1, y0 + HIP, 0], anim));
    }
  }

  for (const [s, anim] of [[-1, 'armL'], [1, 'armR']]) {
    parts.push(part((b) => {
      const x = s * 0.23;
      b.cyl(0.06, 0.065, 0.32, 8, o.sleeve || shirt, { x: x + s * 0.02, y: y0 + SHOULDER - 0.3, rz: s * 0.08 });
      b.cyl(0.05, 0.05, 0.08, 8, o.hand || skin, { x: x + s * 0.04, y: y0 + SHOULDER - 0.38 });
      const hx = x + s * 0.04, hy = y0 + SHOULDER - 0.34;
      if (s > 0 && o.right) o.right(b, hx, hy);
      if (s < 0 && o.left) o.left(b, hx, hy);
    }, [s * 0.23, y0 + SHOULDER, 0], anim));
  }
  return parts;
}

// Weapons, held in a hand at (x, y) on an arm hanging down; forward is +z.
const sword = (len = 0.55, blade = C.silver, hilt = C.black) => (b, x, y) => {
  b.box(0.05, 0.05, 0.14, hilt, { x, y: y - 0.02, z: 0.02 });
  b.box(0.18, 0.04, 0.04, hilt, { x, y: y - 0.02, z: 0.1 });
  b.box(0.035, 0.07, len, blade, { x, y: y - 0.035, z: 0.12 + len / 2 });
};
const cutlass = (b, x, y) => {
  b.box(0.05, 0.05, 0.12, C.gold, { x, y: y - 0.02, z: 0.02 });
  b.box(0.035, 0.1, 0.5, C.silver, { x, y: y - 0.04, z: 0.34, rx: -0.15 });
};
const hammer = (b, x, y) => {
  b.box(0.05, 0.05, 0.42, C.brown, { x, y: y - 0.02, z: 0.16 });
  b.box(0.1, 0.12, 0.2, C.ironD, { x, y: y - 0.06, z: 0.38 });
};
const bow = (b, x, y) => {
  b.add(new THREE.TorusGeometry(0.34, 0.025, 4, 10, Math.PI), C.brown, { x, y: y + 0.02, z: 0.08, rx: Math.PI / 2, rz: Math.PI / 2 });
  b.box(0.01, 0.01, 0.68, C.white, { x, y: y + 0.02, z: 0.08 });
};
const musket = (b, x, y) => {
  b.box(0.06, 0.07, 0.3, C.brown, { x, y: y - 0.04, z: 0.06 });
  b.box(0.04, 0.04, 0.6, C.ironD, { x, y: y - 0.02, z: 0.45 });
};
const pistol = (b, x, y) => {
  b.box(0.05, 0.12, 0.08, C.brown, { x, y: y - 0.08, z: 0.02 });
  b.box(0.04, 0.04, 0.3, C.ironD, { x, y: y - 0.03, z: 0.18 });
};
const shield = (color, mark) => (b, x, y) => {
  b.box(0.05, 0.36, 0.3, color, { x: x - 0.05, y: y - 0.2, z: 0.05 });
  b.box(0.06, 0.18, 0.06, mark, { x: x - 0.06, y: y - 0.12, z: 0.05 });
  b.box(0.06, 0.06, 0.18, mark, { x: x - 0.06, y: y - 0.06, z: 0.05 });
};

function helmet(b, y, plume) {
  b.cyl(0.16, 0.16, 0.2, 12, C.silver, { y: y - 0.2 });
  b.ball(0.16, C.silver, { y: y - 0.02, sy: 0.7 }, 1);
  b.box(0.2, 0.06, 0.04, C.ironD, { y: y - 0.12, z: 0.15 });
  if (plume) b.box(0.05, 0.18, 0.26, plume, { y: y + 0.06, z: -0.02 });
}
function tricorn(b, y, color = C.black, trim = C.gold) {
  b.cyl(0.24, 0.24, 0.05, 3, color, { y: y - 0.06, ry: Math.PI });
  b.cyl(0.15, 0.17, 0.14, 10, color, { y: y - 0.04 });
  b.cyl(0.245, 0.245, 0.02, 3, trim, { y: y - 0.07, ry: Math.PI });
}
function bandana(b, y, color) {
  b.cyl(0.145, 0.145, 0.1, 12, color, { y: y - 0.1 });
  b.ball(0.14, color, { y: y - 0.03, sy: 0.55 }, 1);
  b.box(0.08, 0.06, 0.14, color, { y: y - 0.1, z: -0.16, rx: 0.4 });
}
function hardhat(b, y, color) {
  b.ball(0.15, color, { y: y - 0.04, sy: 0.75 }, 1);
  b.cyl(0.19, 0.19, 0.03, 12, color, { y: y - 0.08 });
}

export const RIGS = {
  kBuilder: () => figure({
    shirt: 0x4a7fd0, pants: C.blueD, hat: (b, y) => hardhat(b, y, C.yellow), right: hammer,
    torso: (b, y) => { b.box(0.36, 0.05, 0.23, C.brown, { y: y + 0.52 }); b.box(0.12, 0.12, 0.02, C.orange, { y: y + 0.66, z: 0.115 }); },
  }),
  kSoldier: () => figure({
    shirt: C.silver, pants: C.ironD, sleeve: C.silver, hat: (b, y) => helmet(b, y, C.blue),
    torso: (b, y) => { b.box(0.22, 0.24, 0.02, C.blue, { y: y + 0.6, z: 0.115 }); b.box(0.06, 0.14, 0.022, C.yellow, { y: y + 0.65, z: 0.117 }); },
    right: sword(0.55), left: shield(C.blue, C.yellow),
  }),
  kArcher: () => figure({
    shirt: C.green, pants: C.brown, hat: (b, y) => { b.cone(0.2, 0.22, 3, C.green, { y: y - 0.06, sz: 1.4 }); b.box(0.02, 0.16, 0.08, C.red, { x: 0.08, y: y + 0.0, z: -0.06 }); },
    torso: (b, y) => { b.box(0.08, 0.32, 0.12, C.brown, { x: -0.06, y: y + 0.55, z: -0.16, rz: 0.3 }); b.box(0.36, 0.04, 0.23, C.brown, { y: y + 0.52 }); },
    left: bow,
  }),
  kRider: () => [
    ...horse(C.white, C.blue, C.yellow),
    ...figure({ y: 0.62, seated: true, shirt: C.silver, pants: C.ironD, sleeve: C.silver, hat: (b, y) => helmet(b, y, C.yellow),
      torso: (b, y) => { b.box(0.22, 0.24, 0.02, C.blue, { y: y + 0.6, z: 0.115 }); },
      right: (b, x, y) => { b.box(0.05, 0.05, 1.1, C.brown, { x, y: y - 0.02, z: 0.45 }); b.cone(0.05, 0.16, 4, C.silver, { x, y: y - 0.02, z: 1.05, rx: Math.PI / 2 }); },
      left: shield(C.blue, C.yellow) }),
  ],
  kKing: () => figure({
    shirt: C.blue, pants: C.blueD, sleeve: C.blue,
    hat: (b, y) => {
      b.cyl(0.15, 0.15, 0.12, 10, C.gold, { y: y - 0.1 });
      for (let i = 0; i < 6; i++) { const a = (i / 6) * TAU; b.box(0.05, 0.08, 0.05, C.gold, { x: Math.sin(a) * 0.13, y: y + 0.02, z: Math.cos(a) * 0.13 }); }
      b.box(0.04, 0.04, 0.02, C.red, { y: y - 0.05, z: 0.15 });
    },
    torso: (b, y) => {
      b.box(0.5, 0.62, 0.04, C.red, { y: y + 0.3, z: -0.14, rx: 0.12 });
      b.box(0.08, 0.42, 0.022, C.gold, { y: y + 0.5, z: 0.116 });
      b.box(0.24, 0.05, 0.24, C.white, { y: y + 0.88 });
      b.box(0.16, 0.12, 0.03, 0x9a6a3a, { y: y + 0.98, z: 0.13 });
    },
    right: sword(0.7, C.gold, C.blueD), left: shield(C.red, C.gold),
  }),

  pBuilder: () => figure({
    shirt: C.white, pants: C.blueD, hat: (b, y) => bandana(b, y, C.red), right: hammer,
    torso: (b, y) => { for (let i = 0; i < 3; i++) b.box(0.4 - i * 0.03, 0.04, 0.235, C.red, { y: y + 0.55 + i * 0.12 }); },
  }),
  pSwabbie: () => figure({
    shirt: C.white, pants: C.black, hat: (b, y) => bandana(b, y, C.black),
    torso: (b, y) => { for (let i = 0; i < 3; i++) b.box(0.4 - i * 0.03, 0.04, 0.235, C.blue, { y: y + 0.55 + i * 0.12 }); b.box(0.42, 0.06, 0.24, C.red, { y: y + 0.5 }); },
    right: cutlass,
  }),
  pGunner: () => figure({
    shirt: C.redD, pants: C.tan, sleeve: C.redD, hat: (b, y) => tricorn(b, y, C.brownD, C.tan),
    torso: (b, y) => { b.box(0.06, 0.42, 0.24, C.black, { y: y + 0.5, rz: 0.6 }); },
    right: musket,
  }),
  pCannon: () => [
    ...figure({ shirt: C.black, pants: C.brownD, sleeve: C.black, hat: (b, y) => bandana(b, y, C.blue),
      torso: (b, y) => { b.box(0.42, 0.06, 0.24, C.gold, { y: y + 0.5 }); } }),
    part((b) => {
      b.box(0.5, 0.14, 0.7, C.brown, { y: 0.18, z: 0.75 });
      for (const x of [-0.3, 0.3]) for (const z of [0.5, 1.0]) b.cyl(0.17, 0.17, 0.06, 10, C.brownD, { x, y: 0.17, z, rz: Math.PI / 2 });
      b.cyl(0.11, 0.14, 0.8, 10, C.black, { y: 0.36, z: 0.7, rx: Math.PI / 2 - 0.15 });
      b.ball(0.15, C.black, { y: 0.36, z: 0.32 });
    }),
  ],
  pCaptain: () => figure({
    shirt: C.red, pants: C.black, sleeve: C.red, hand: C.yellow,
    hat: (b, y) => { tricorn(b, y); b.box(0.06, 0.06, 0.02, C.white, { y: y + 0.02, z: 0.16 }); },
    torso: (b, y) => {
      b.box(0.08, 0.42, 0.022, C.gold, { x: -0.06, y: y + 0.5, z: 0.116 });
      b.box(0.08, 0.42, 0.022, C.gold, { x: 0.06, y: y + 0.5, z: 0.116 });
      b.box(0.22, 0.12, 0.1, C.black, { y: y + 0.94, z: 0.11 });
      b.box(0.05, 0.05, 0.02, C.black, { x: 0.06, y: y + 1.1, z: 0.14 });
      b.box(0.3, 0.02, 0.02, C.black, { y: y + 1.13, z: 0.14, rz: -0.35 });
    },
    right: pistol, left: cutlass,
  }),
};

function horse(coat, cloth, trim) {
  const parts = [];
  parts.push(part((b) => {
    b.box(0.42, 0.36, 1.05, coat, { y: 0.48 });
    b.box(0.46, 0.14, 0.62, cloth, { y: 0.8 });
    b.box(0.48, 0.3, 0.6, cloth, { y: 0.52 });
    b.box(0.5, 0.04, 0.62, trim, { y: 0.5 });
    b.box(0.24, 0.42, 0.28, coat, { y: 0.72, z: 0.5, rx: -0.4 });
    b.box(0.22, 0.2, 0.42, coat, { y: 1.02, z: 0.72 });
    b.box(0.08, 0.28, 0.3, C.brownD, { y: 0.86, z: 0.46, rx: -0.4 });
    b.box(0.05, 0.08, 0.05, coat, { x: 0.07, y: 1.2, z: 0.6 });
    b.box(0.05, 0.08, 0.05, coat, { x: -0.07, y: 1.2, z: 0.6 });
    b.box(0.08, 0.36, 0.08, C.brownD, { y: 0.42, z: -0.56, rx: 0.4 });
  }));
  for (const [anim, legs] of [['hlegA', [[-0.15, 0.4], [0.15, -0.4]]], ['hlegB', [[0.15, 0.4], [-0.15, -0.4]]]]) {
    parts.push(part((b) => {
      for (const [x, z] of legs) { b.box(0.12, 0.44, 0.14, coat, { x, y: 0.06, z }); b.box(0.13, 0.08, 0.15, C.black, { x, y: 0, z }); }
    }, [0, 0.5, 0], anim));
  }
  return parts;
}

// ----------------------------------------------------------------- scenery
export function treeGeo(kind) {
  const b = new Builder();
  if (kind === 0) {
    b.box(0.3, 0.7, 0.3, C.brown);
    b.brick(1.3, 0.35, 1.3, C.leafD, { y: 0.6 });
    b.brick(1.0, 0.35, 1.0, C.leaf, { y: 0.95 });
    b.brick(0.6, 0.35, 0.6, C.leafL, { y: 1.3 });
  } else {
    b.box(0.26, 0.9, 0.26, C.brown);
    b.cyl(0.62, 0.62, 0.6, 12, C.leaf, { y: 0.75 });
    b.cyl(0.5, 0.62, 0.25, 12, C.leafL, { y: 1.35 });
    b.studs(0, 1.6, 0, 0.9, 0.9, C.leafL);
  }
  return b.build();
}

// A pile of loose bricks set into rock. Builders mine it for lots of bricks.
export function oreGeo() {
  const b = new Builder();
  b.add(new THREE.DodecahedronGeometry(0.62, 0), C.stone, { y: 0.32, sy: 0.65 });
  b.add(new THREE.DodecahedronGeometry(0.38, 0), C.stoneD, { x: 0.42, y: 0.2, z: 0.25, sy: 0.7 });
  b.brick(0.5, 0.2, 0.25, C.gold, { x: -0.15, y: 0.42, z: 0.1, ry: 0.4 });
  b.brick(0.25, 0.2, 0.5, C.red, { x: 0.2, y: 0.55, z: -0.1 });
  b.brick(0.25, 0.2, 0.25, C.blue, { x: -0.3, y: 0.2, z: 0.45 });
  b.brick(0.5, 0.2, 0.25, C.yellow, { x: 0.35, y: 0.3, z: 0.45, ry: -0.3 });
  return b.build();
}

export function stumpGeo() {
  const b = new Builder();
  b.brick(0.3, 0.2, 0.3, C.brown);
  return b.build();
}

export function rockGeo() {
  const b = new Builder();
  b.add(new THREE.DodecahedronGeometry(0.5, 0), C.stone, { y: 0.25, sy: 0.6 });
  return b.build();
}

export function flowerGeo() {
  const b = new Builder();
  b.box(0.04, 0.2, 0.04, C.leafD);
  b.cyl(0.08, 0.08, 0.05, 6, C.red, { y: 0.2 });
  b.box(0.04, 0.14, 0.04, C.leafD, { x: 0.15, z: 0.1 });
  b.cyl(0.07, 0.07, 0.05, 6, C.yellow, { x: 0.15, y: 0.14, z: 0.1 });
  return b.build();
}

// ----------------------------------------------------------------- buildings
// Centered on the origin, footprint size x size, base at y = 0.

function crenels(b, w, d, y, color, step = 0.5) {
  for (let x = -w / 2 + step / 2; x < w / 2; x += step * 2) {
    b.brick(step, 0.3, 0.3, color, { x, y, z: d / 2 - 0.15 });
    b.brick(step, 0.3, 0.3, color, { x, y, z: -d / 2 + 0.15 });
  }
  for (let z = -d / 2 + step * 1.5; z < d / 2 - step; z += step * 2) {
    b.brick(0.3, 0.3, step, color, { x: w / 2 - 0.15, y, z });
    b.brick(0.3, 0.3, step, color, { x: -w / 2 + 0.15, y, z });
  }
}
function flag(b, x, y, z, pole, cloth, mark) {
  b.cyl(0.04, 0.04, 1.0, 6, pole, { x, y, z });
  b.box(0.04, 0.4, 0.6, cloth, { x, y: y + 0.55, z: z + 0.3 });
  if (mark) b.box(0.05, 0.14, 0.14, mark, { x, y: y + 0.68, z: z + 0.3 });
}
function skull(b, x, y, z) {
  b.box(0.05, 0.14, 0.14, C.white, { x, y, z });
  b.box(0.05, 0.05, 0.03, C.black, { x: x + 0.005, y: y + 0.06, z: z - 0.04 });
  b.box(0.05, 0.05, 0.03, C.black, { x: x + 0.005, y: y + 0.06, z: z + 0.04 });
}

const KNIGHT_BLD = {
  keep() {
    const b = new Builder();
    b.brick(3.6, 0.3, 3.6, C.stoneD, { studs: false });
    b.box(2.6, 2.4, 2.6, C.stone, { y: 0.3 });
    for (let y = 0.6; y < 2.6; y += 0.6) b.box(2.62, 0.06, 2.62, C.stoneL, { y });
    crenels(b, 2.6, 2.6, 2.7, C.stone);
    b.brick(2.2, 0.2, 2.2, C.stoneD, { y: 2.6 });
    b.box(1.4, 1.4, 1.4, C.stoneL, { y: 2.8 });
    b.cone(1.15, 1.2, 4, C.roofBlue, { y: 4.2, ry: Math.PI / 4 });
    flag(b, 0, 5.2, 0, C.brownD, C.blue, C.yellow);
    for (const [x, z] of [[-1.4, -1.4], [1.4, -1.4], [-1.4, 1.4], [1.4, 1.4]]) {
      b.cyl(0.55, 0.6, 3.2, 10, C.stone, { x, y: 0.3, z });
      b.cyl(0.6, 0.6, 0.1, 10, C.stoneL, { x, y: 1.8, z });
      b.cone(0.75, 1.0, 10, C.roofBlue, { x, y: 3.5, z });
      b.studs(x, 3.5, z, 0.5, 0.5, C.stone);
    }
    b.box(0.9, 1.3, 0.1, C.brownD, { y: 0.3, z: 1.31 });
    b.box(1.1, 0.14, 0.12, C.stoneD, { y: 1.6, z: 1.32 });
    b.box(0.5, 0.5, 0.06, C.blue, { y: 1.9, z: 1.32 });
    b.box(0.14, 0.3, 0.07, C.yellow, { y: 1.98, z: 1.33 });
    for (const x of [-0.8, 0.8]) b.box(0.16, 0.4, 0.06, C.black, { x, y: 1.8, z: 1.32 });
    return b.build();
  },
  farm() {
    const b = new Builder();
    b.brick(1.9, 0.12, 1.9, C.brown, { studs: false });
    for (let i = 0; i < 3; i++) b.brick(0.25, 0.25, 0.8, C.hay, { x: 0.35 + i * 0.28, y: 0.12, z: 0.45 });
    b.box(1.0, 0.7, 0.8, C.white, { x: -0.35, y: 0.12, z: -0.35 });
    b.box(1.02, 0.08, 0.82, C.brown, { x: -0.35, y: 0.4, z: -0.35 });
    b.roof(1.2, 0.6, 1.0, C.red, { x: -0.35, y: 0.82, z: -0.35 });
    b.box(0.25, 0.42, 0.04, C.brownD, { x: -0.35, y: 0.12, z: 0.06 });
    b.box(0.2, 0.2, 0.04, C.blue, { x: 0.0, y: 0.45, z: 0.06 });
    for (let x = -0.9; x <= 0.9; x += 0.45) b.box(0.08, 0.32, 0.08, C.tan, { x, y: 0.12, z: 0.92 });
    b.box(1.9, 0.06, 0.06, C.tan, { y: 0.32, z: 0.92 });
    b.cyl(0.18, 0.18, 0.25, 8, C.hay, { x: 0.65, y: 0.12, z: -0.55, rz: Math.PI / 2 });
    return b.build();
  },
  barracks() {
    const b = new Builder();
    b.brick(2.9, 0.2, 2.9, C.stoneD, { studs: false });
    b.box(2.4, 1.1, 2.0, C.stone, { y: 0.2 });
    b.box(2.4, 0.8, 2.0, C.cloth, { y: 1.3 });
    for (const x of [-1.15, -0.4, 0.4, 1.15]) b.box(0.12, 0.8, 2.04, C.brown, { x, y: 1.3 });
    b.box(2.44, 0.1, 2.04, C.brown, { y: 1.3 });
    b.roof(2.7, 1.0, 2.3, C.roofBlue, { y: 2.1 });
    b.box(0.7, 0.9, 0.08, C.brownD, { y: 0.2, z: 1.0 });
    flag(b, 1.2, 2.1, 1.0, C.brownD, C.blue, C.yellow);
    b.box(0.1, 0.6, 0.6, C.brown, { x: -1.3, y: 0.2, z: 0.9 });
    for (let i = 0; i < 3; i++) b.box(0.03, 0.55, 0.05, C.silver, { x: -1.24, y: 0.4, z: 0.7 + i * 0.2 });
    b.brick(0.5, 0.5, 0.5, C.blue, { x: 1.0, y: 0.2, z: 1.1 });
    return b.build();
  },
  tower() {
    const b = new Builder();
    b.brick(1.9, 0.2, 1.9, C.stoneD, { studs: false });
    b.box(1.3, 3.2, 1.3, C.stone, { y: 0.2 });
    for (let y = 0.8; y < 3.4; y += 0.8) b.box(1.32, 0.06, 1.32, C.stoneL, { y });
    b.box(1.7, 0.2, 1.7, C.stoneD, { y: 3.4 });
    crenels(b, 1.7, 1.7, 3.6, C.stone, 0.4);
    b.box(0.2, 0.4, 0.06, C.black, { y: 2.2, z: 0.66 });
    b.box(0.5, 0.7, 0.06, C.brownD, { y: 0.2, z: 0.66 });
    flag(b, 0.6, 3.6, -0.6, C.brownD, C.blue, C.yellow);
    return b.build();
  },
  depot() {
    const b = new Builder();
    b.brick(1.9, 0.12, 1.9, C.tanD, { studs: false });
    for (const [x, z] of [[-0.75, -0.75], [0.75, -0.75], [-0.75, 0.2], [0.75, 0.2]]) b.box(0.12, 1.2, 0.12, C.brown, { x, y: 0.12, z });
    b.roof(1.9, 0.5, 1.3, C.roofBlue, { y: 1.3, z: -0.27 });
    b.box(1.6, 0.06, 1.0, C.brown, { y: 1.28, z: -0.27 });
    b.brick(0.5, 0.2, 0.25, C.red, { x: -0.4, y: 0.12, z: -0.4 });
    b.brick(0.5, 0.2, 0.25, C.yellow, { x: -0.3, y: 0.32, z: -0.4 });
    b.brick(0.25, 0.2, 0.5, C.blue, { x: 0.3, y: 0.12, z: -0.3 });
    b.brick(0.5, 0.2, 0.25, C.green, { x: 0.2, y: 0.32, z: -0.5 });
    b.box(0.7, 0.3, 0.5, C.brown, { x: 0.3, y: 0.25, z: 0.65 });
    for (const x of [0.0, 0.6]) b.cyl(0.14, 0.14, 0.06, 8, C.black, { x, y: 0.12, z: 0.65, rz: Math.PI / 2 });
    b.brick(0.5, 0.2, 0.25, C.gold, { x: 0.3, y: 0.55, z: 0.65 });
    return b.build();
  },
};

const PIRATE_BLD = {
  keep() {
    const b = new Builder();
    b.brick(3.6, 0.2, 3.6, C.sandB, { studs: false });
    // palisade
    for (let i = 0; i < 9; i++) {
      const t = -1.6 + i * 0.4;
      for (const [x, z] of [[t, -1.6], [t, 1.6], [-1.6, t], [1.6, t]]) {
        if (z === 1.6 && Math.abs(x) < 0.5) continue;
        b.cyl(0.18, 0.18, 1.3 + (i % 2) * 0.15, 6, C.plank, { x, y: 0.2, z });
        b.cone(0.18, 0.2, 6, C.plankD, { x, y: 1.5 + (i % 2) * 0.15, z });
      }
    }
    b.box(2.0, 1.6, 1.8, C.plank, { y: 0.2, z: -0.3 });
    for (let y = 0.4; y < 1.8; y += 0.3) b.box(2.02, 0.05, 1.82, C.plankD, { y, z: -0.3 });
    b.box(2.2, 0.12, 2.0, C.brownD, { y: 1.8, z: -0.3 });
    b.box(1.2, 1.1, 1.1, C.plank, { y: 1.92, z: -0.4 });
    b.roof(1.4, 0.6, 1.3, C.redD, { y: 3.02, z: -0.4 });
    b.cyl(0.06, 0.06, 2.8, 6, C.brownD, { x: 0.8, y: 1.9, z: 0.4 });
    b.box(0.04, 0.6, 0.9, C.black, { x: 0.8, y: 4.0, z: 0.85 });
    skull(b, 0.82, 4.25, 0.85);
    b.box(0.7, 0.9, 0.08, C.brownD, { y: 0.2, z: 0.62 });
    for (const x of [-1.0, 1.0]) {
      b.cyl(0.1, 0.13, 0.7, 10, C.black, { x, y: 0.55, z: 1.75, rx: Math.PI / 2 });
      b.box(0.35, 0.25, 0.4, C.brown, { x, y: 0.2, z: 1.4 });
    }
    b.cyl(0.2, 0.2, 0.4, 10, C.brown, { x: -1.0, y: 0.2, z: 0.6 });
    b.cyl(0.2, 0.2, 0.4, 10, C.brown, { x: -0.6, y: 0.2, z: 0.9 });
    return b.build();
  },
  farm() {
    const b = new Builder();
    b.brick(1.9, 0.12, 1.9, C.sandB, { studs: false });
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.4], [0.6, 0.4]]) b.cyl(0.07, 0.07, 0.5, 6, C.brownD, { x, y: 0.12, z });
    b.box(1.4, 0.08, 1.2, C.plank, { y: 0.6, z: -0.1 });
    b.box(1.2, 0.6, 0.9, C.plank, { y: 0.68, z: -0.15 });
    b.roof(1.5, 0.55, 1.2, C.hay, { y: 1.28, z: -0.15 });
    b.box(0.3, 0.42, 0.04, C.brownD, { y: 0.68, z: 0.31 });
    b.box(0.04, 0.04, 0.9, C.brownD, { x: 0.75, y: 0.2, z: 0.6, rx: -0.4 });
    for (let i = 0; i < 3; i++) b.box(0.3, 0.1, 0.08, 0x8fb0c8, { x: 0.65, y: 0.5 + i * 0.12, z: 0.85 });
    b.cyl(0.18, 0.18, 0.35, 8, C.brown, { x: -0.6, y: 0.12, z: 0.75 });
    return b.build();
  },
  barracks() {
    const b = new Builder();
    b.brick(2.9, 0.2, 2.9, C.sandB, { studs: false });
    b.box(2.4, 1.0, 2.0, C.plank, { y: 0.2 });
    b.box(2.5, 0.12, 2.1, C.plankD, { y: 1.2 });
    b.box(2.2, 0.8, 1.8, C.plankD, { y: 1.32 });
    for (let y = 0.45; y < 2.1; y += 0.35) b.box(2.42, 0.04, 2.02, C.brownD, { y });
    b.roof(2.6, 0.9, 2.2, C.black, { y: 2.12 });
    b.box(0.7, 0.9, 0.08, C.brownD, { y: 0.2, z: 1.0 });
    for (let i = 0; i < 6; i++) b.box(0.4, 0.06, 0.6, i % 2 ? C.white : C.red, { x: -0.9 + i * 0.36, y: 1.12, z: 1.25, rx: 0.3 });
    b.box(0.7, 0.35, 0.05, C.brownD, { y: 1.45, z: 0.92 });
    b.box(0.24, 0.24, 0.06, C.gold, { y: 1.5, z: 0.94 });
    for (const [x, z] of [[-1.2, 1.15], [-0.85, 1.25], [1.15, 1.15]]) b.cyl(0.2, 0.2, 0.42, 10, C.brown, { x, y: 0.2, z });
    b.cyl(0.05, 0.05, 1.2, 6, C.brownD, { x: 1.2, y: 2.0, z: 0.5 });
    b.box(0.04, 0.4, 0.6, C.black, { x: 1.2, y: 2.75, z: 0.8 });
    skull(b, 1.22, 2.92, 0.8);
    return b.build();
  },
  tower() {
    const b = new Builder();
    b.brick(1.9, 0.12, 1.9, C.sandB, { studs: false });
    for (const [x, z] of [[-0.6, -0.6], [0.6, -0.6], [-0.6, 0.6], [0.6, 0.6]]) b.box(0.18, 3.0, 0.18, C.plank, { x, y: 0.12, z });
    for (const y of [1.0, 2.0]) {
      b.box(1.3, 0.08, 0.08, C.plankD, { y, z: 0.6 }); b.box(1.3, 0.08, 0.08, C.plankD, { y, z: -0.6 });
      b.box(0.08, 0.08, 1.3, C.plankD, { x: 0.6, y }); b.box(0.08, 0.08, 1.3, C.plankD, { x: -0.6, y });
    }
    b.box(1.7, 0.15, 1.7, C.plankD, { y: 3.0 });
    for (const [x, z, w, d] of [[0, 0.8, 1.7, 0.1], [0, -0.8, 1.7, 0.1], [0.8, 0, 0.1, 1.7], [-0.8, 0, 0.1, 1.7]]) b.box(w, 0.4, d, C.plank, { x, y: 3.15, z });
    b.cyl(0.13, 0.16, 0.9, 10, C.black, { y: 3.55, z: 0.5, rx: Math.PI / 2 - 0.2 });
    b.cyl(0.05, 0.05, 1.3, 6, C.brownD, { x: -0.6, y: 3.15, z: -0.6 });
    b.box(0.04, 0.4, 0.6, C.black, { x: -0.6, y: 4.0, z: -0.3 });
    skull(b, -0.58, 4.17, -0.3);
    return b.build();
  },
  depot() {
    const b = new Builder();
    b.brick(1.9, 0.12, 1.9, C.sandB, { studs: false });
    b.box(1.6, 0.9, 1.0, C.stone, { y: 0.12, z: -0.4 });
    b.ball(0.7, C.stoneD, { x: -0.5, y: 0.5, z: -0.4, sy: 0.8 });
    b.ball(0.6, C.stone, { x: 0.5, y: 0.6, z: -0.5, sy: 0.9 });
    b.box(0.6, 0.35, 0.4, C.brown, { x: -0.3, y: 0.12, z: 0.45 });
    b.box(0.62, 0.15, 0.42, C.brownD, { x: -0.3, y: 0.47, z: 0.45 });
    b.box(0.06, 0.12, 0.04, C.gold, { x: -0.3, y: 0.38, z: 0.67 });
    for (let i = 0; i < 5; i++) b.cyl(0.1, 0.1, 0.04, 8, C.gold, { x: 0.35 + (i % 2) * 0.12, y: 0.12 + i * 0.045, z: 0.45 - (i % 3) * 0.05 });
    b.brick(0.5, 0.2, 0.25, C.gold, { x: 0.45, y: 0.12, z: 0.0 });
    b.brick(0.25, 0.2, 0.5, C.red, { x: 0.65, y: 0.32, z: 0.05 });
    return b.build();
  },
};

const BLD_CACHE = new Map();
export function buildingGeo(faction, type) {
  const key = faction + type;
  if (!BLD_CACHE.has(key)) BLD_CACHE.set(key, (faction === 'pirates' ? PIRATE_BLD : KNIGHT_BLD)[type]());
  return BLD_CACHE.get(key);
}

// Scaffolding shown while a building is going up.
export function scaffoldGeo(size) {
  const b = new Builder();
  const h = 0.9 + size * 0.3, s = size / 2 - 0.15;
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) b.box(0.08, h, 0.08, C.tan, { x, z });
  for (const y of [h * 0.5, h]) {
    b.box(size - 0.3, 0.06, 0.06, C.tan, { y, z: s }); b.box(size - 0.3, 0.06, 0.06, C.tan, { y, z: -s });
    b.box(0.06, 0.06, size - 0.3, C.tan, { x: s, y }); b.box(0.06, 0.06, size - 0.3, C.tan, { x: -s, y });
  }
  return b.build();
}

// Bits that fly about.
export function studCoinGeo() {
  const b = new Builder();
  b.cyl(0.2, 0.2, 0.08, 14, 0xffffff);
  b.cyl(0.11, 0.11, 0.08, 12, 0xdddddd, { y: 0.08 });
  return b.build();
}
export function debrisGeo() {
  const b = new Builder();
  b.box(0.3, 0.14, 0.15, 0xffffff, { y: -0.07 });
  b.cyl(0.055, 0.055, 0.05, 6, 0xffffff, { x: -0.075 });
  b.cyl(0.055, 0.055, 0.05, 6, 0xffffff, { x: 0.075 });
  return b.build();
}
export function arrowGeo() {
  const b = new Builder();
  b.box(0.03, 0.03, 0.6, C.brown, { y: -0.015 });
  b.cone(0.05, 0.12, 4, C.iron, { y: -0.06, z: 0.33, rx: Math.PI / 2 });
  b.box(0.01, 0.08, 0.12, C.white, { y: -0.04, z: -0.26 });
  return b.build();
}
export function ballGeo(r) {
  const b = new Builder();
  b.ball(r, C.black, {}, 1);
  return b.build();
}

// Ground studs: a tileable texture, one stud per tile, tinted by vertex colour.
export function studTexture() {
  const S = 64;
  const cv = document.createElement('canvas');
  cv.width = cv.height = S;
  const g = cv.getContext('2d');
  g.fillStyle = '#e6e6e6';
  g.fillRect(0, 0, S, S);
  g.fillStyle = 'rgba(0,0,0,0.1)';
  g.fillRect(0, S - 2, S, 2);
  g.fillRect(S - 2, 0, 2, S);
  g.fillStyle = 'rgba(0,0,0,0.22)';
  g.beginPath(); g.arc(S / 2 + 3, S / 2 + 4, S * 0.3, 0, TAU); g.fill();
  const grd = g.createRadialGradient(S / 2 - 6, S / 2 - 6, 2, S / 2, S / 2, S * 0.3);
  grd.addColorStop(0, '#ffffff');
  grd.addColorStop(1, '#d9d9d9');
  g.fillStyle = grd;
  g.beginPath(); g.arc(S / 2, S / 2, S * 0.29, 0, TAU); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.0)';
  // flat corner pixels (the tile's top-left 6x6 area) are left stud-free for water UVs
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = tex.wrapT = 1000; // RepeatWrapping
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export const vcMat = new THREE.MeshLambertMaterial({ vertexColors: true });
