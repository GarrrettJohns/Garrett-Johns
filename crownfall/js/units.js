// Soldiers, enemies and bosses, built to the army sheets in
// docs/crownfall/asset-workup/visuals/*_armies.png (selected 2026-10-05:
// "match the images"). One chunky humanoid builder with regional colour kits;
// rigs use the same part/anim contract as models.js (legs, weapon arm, cape).

import * as THREE from './vendor/three.js';
import { Builder, C } from './models.js';

function part(build, o = {}) {
  const b = new Builder();
  build(b);
  return {
    geo: b.build(), pivot: o.pivot || [0, 0, 0], anim: o.anim || 'none', tint: !!o.tint, show: o.show || null, hide: o.hide || null, phase: 0,
    tintKey: null, only: null, stow: false,
  };
}

// --------------------------------------------------------------- emblems
// Drawn flat in a plane through `m` (local XY, facing +z), size s.
export function emblem(b, kind, m, s, color) {
  const o = (dx, dy, extra = {}) => ({ x: dx * s, y: dy * s, z: 0.01, m, ...extra });
  if (kind === 'crown') {
    b.box(0.5 * s, 0.16 * s, 0.03, color, o(0, -0.1));
    for (const dx of [-0.2, 0, 0.2]) b.cone(0.07 * s, 0.24 * s, 4, color, o(dx, 0.0));
  } else if (kind === 'peak') {
    b.cone(0.28 * s, 0.46 * s, 3, color, o(0, -0.22, { sz: 0.15 }));
  } else if (kind === 'hammers') {
    for (const r of [0.7, -0.7]) { b.box(0.07 * s, 0.52 * s, 0.03, color, o(0, -0.24, { rz: r })); b.box(0.26 * s, 0.11 * s, 0.03, color, o(r > 0 ? -0.16 : 0.16, 0.12, { rz: r })); }
  } else if (kind === 'sun') {
    b.cyl(0.14 * s, 0.14 * s, 0.03, 8, color, o(0, 0, { rx: Math.PI / 2 }));
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.box(0.06 * s, 0.13 * s, 0.03, color, o(Math.cos(a) * 0.22, Math.sin(a) * 0.22 - 0.065, { rz: a - Math.PI / 2 })); }
  } else if (kind === 'snowflake') {
    for (let i = 0; i < 3; i++) b.box(0.06 * s, 0.56 * s, 0.03, color, o(0, -0.28, { rz: (i / 3) * Math.PI }));
  } else if (kind === 'thorn') {
    b.box(0.07 * s, 0.6 * s, 0.03, color, o(0, -0.3));
    for (const [dy, r] of [[-0.1, 0.8], [0.05, -0.8], [0.18, 0.7]]) b.box(0.05 * s, 0.24 * s, 0.03, color, o(0.07 * Math.sign(r), dy, { rz: r }));
  } else if (kind === 'diamond') {
    b.box(0.3 * s, 0.3 * s, 0.03, color, o(0, -0.15, { rz: Math.PI / 4 }));
  } else if (kind === 'brokencrown') {
    b.box(0.5 * s, 0.14 * s, 0.03, color, o(0, -0.12));
    for (const dx of [-0.2, 0.2]) b.cone(0.07 * s, 0.24 * s, 4, color, o(dx, 0.0));
    b.box(0.05 * s, 0.3 * s, 0.03, 0xd8342c, o(0.02, -0.18, { rz: 0.4 }));
  }
}

const at = (x, y, z, ry = 0, rx = 0) => new THREE.Matrix4().makeTranslation(x, y, z).multiply(new THREE.Matrix4().makeRotationY(ry)).multiply(new THREE.Matrix4().makeRotationX(rx));

// --------------------------------------------------------------- kits
// Allies: one kit per royal kingdom, chosen by the king being ridden.
// Shared alliance cue: a blue sash and rounded shields (spec 07).
export const ALLY_KITS = {
  greenwood: { cloth: 0xe9e2d0, tabard: 0x2f62c8, trim: 0xf2c33a, metal: 0xc4cad2, metalDark: 0x8a929c, leather: 0x6a4428, boot: 0x4a2f1e, hood: 0x3f8a3a, scarf: 0x2f62c8, fur: null, shield: 0x2f62c8, emblem: 'crown', crest: 0xf2c33a, sword: 'sword', raider: 'spear' },
  eastern_mountains: { cloth: 0xf2f4f6, tabard: 0x3a78c8, trim: 0xd8dee6, metal: 0xc8d0da, metalDark: 0x8e98a6, leather: 0x5a4a3e, boot: 0x3c3a40, hood: 0x3a78c8, scarf: 0x3a78c8, fur: 0xf8f8f6, shield: 0x3a78c8, emblem: 'peak', crest: 0x3a78c8, sword: 'sword', raider: 'hook' },
  iron_hills: { cloth: 0x3a3230, tabard: 0x9a2a24, trim: 0xc8902a, metal: 0x7a7470, metalDark: 0x4e4a48, leather: 0x4a3426, boot: 0x2a221e, hood: 0x8a3a24, scarf: 0x9a2a24, fur: 0x4a3e36, shield: 0x9a2a24, emblem: 'hammers', crest: 0xd8342c, sword: 'sword', raider: 'spear' },
  sunscorch: { cloth: 0xeee3c8, tabard: 0x3f8a3a, trim: 0xf2c33a, metal: 0xd8c690, metalDark: 0xa8945a, leather: 0x7a5434, boot: 0x6a4a2a, hood: 0x3f8a3a, scarf: 0x3f8a3a, fur: null, shield: 0x3f8a3a, emblem: 'sun', crest: 0x3f8a3a, sword: 'curved', raider: 'spear' },
  frostmarch: { cloth: 0xf2f2f4, tabard: 0x6a3fa0, trim: 0xc9ccd4, metal: 0xb8bcc6, metalDark: 0x7e828e, leather: 0x4a3e3a, boot: 0x2e2a32, hood: 0x6a3fa0, scarf: 0x6a3fa0, fur: 0xf8f8f6, shield: 0x6a3fa0, emblem: 'snowflake', crest: 0x6a3fa0, sword: 'sword', raider: 'spear' },
};
const SASH = 0x2f6fdc;   // alliance blue, on every friendly soldier

// Enemies: one kit per land (level biome), plus the Warlord's elite.
export const ENEMY_KITS = {
  greenwood: { cloth: 0xc0302a, dark: 0x2e2a2c, metal: 0x4a4a52, trim: 0x8a6a3a, leather: 0x4e3424, fur: 0x6a4a32, hood: 0xb02a24, mask: 0x1e1a1c, hound: 0x6a4a34, houndDark: 0x4a3424, horse: 0x5a3a26, sword: 'sword', brute: 'club', emblem: 'thorn' },
  sunscorch: { cloth: 0xb02a24, dark: 0x2a2420, metal: 0x3a3430, trim: 0xc8902a, leather: 0x5a3a22, fur: 0x7a5a3a, hood: 0xa02a22, mask: 0x1e1a1c, hound: 0xd9a860, houndDark: 0xb08440, horse: 0xd8d0c0, sword: 'curved', brute: 'mace', emblem: 'diamond' },
  frostmarch: { cloth: 0xb02a2c, dark: 0x2a2a30, metal: 0x9aa0aa, trim: 0x6a6e78, leather: 0x4a3e3a, fur: 0xf2f2f4, hood: 0xb02a2c, mask: 0x1e1a1c, hound: 0xe8e8ec, houndDark: 0xb8bcc4, horse: 0xd8d8dc, sword: 'sword', brute: 'ice', emblem: 'diamond' },
  warlord: { cloth: 0xc0302a, dark: 0x1e1c20, metal: 0x2a2830, trim: 0xd8a83a, leather: 0x3a2a22, fur: 0x8a2a24, hood: 0xb02a24, mask: 0x1a1618, hound: 0x2e2c30, houndDark: 0x1e1c20, horse: 0x2a2628, sword: 'sword', brute: 'hammer', emblem: 'brokencrown' },
};
export const ENEMY_KIT_FOR_BIOME = { grass: 'greenwood', desert: 'sunscorch', snow: 'frostmarch' };

// --------------------------------------------------------------- weapons
// Held in the right hand at (hx, hy, hz), pointing forward-up.
function weapon(b, kind, hx, hy, hz, P) {
  const fwd = { x: hx, rx: Math.PI / 2 - 0.35 };
  if (kind === 'sword' || kind === 'curved') {
    b.box(0.08, 0.2, 0.08, P.leather || 0x4a3424, { ...fwd, y: hy - 0.06, z: hz - 0.08 });
    b.box(0.3, 0.06, 0.08, P.trim || C.goldDark, { x: hx, y: hy + 0.0, z: hz + 0.04 });
    if (kind === 'sword') b.box(0.06, 0.8, 0.14, P.blade || 0xdfe3e8, { ...fwd, y: hy - 0.02, z: hz + 0.08 });
    else b.add(new THREE.TorusGeometry(0.55, 0.06, 3, 10, Math.PI * 0.45), P.blade || 0xdfe3e8, { x: hx, y: hy + 0.0, z: hz - 0.3, rz: 0, ry: Math.PI / 2, rx: -0.2, sz: 2 });
  } else if (kind === 'spear' || kind === 'hook') {
    b.box(0.05, 1.7, 0.05, P.leather || 0x6a4428, { x: hx, y: hy - 0.8, z: hz + 0.05 });
    b.cone(0.07, 0.3, 4, 0xdfe3e8, { x: hx, y: hy + 0.9, z: hz + 0.05 });
    if (kind === 'hook') b.box(0.05, 0.05, 0.22, 0xdfe3e8, { x: hx, y: hy + 0.82, z: hz + 0.14 });
    b.box(0.03, 0.28, 0.14, P.scarf || 0x2f62c8, { x: hx, y: hy + 0.55, z: hz + 0.13 });
  } else if (kind === 'bow') {
    b.add(new THREE.TorusGeometry(0.46, 0.035, 3, 10, Math.PI), P.bow || 0x7a5232, { x: hx, y: hy + 0.05, z: hz + 0.12, rz: Math.PI / 2, ry: Math.PI / 2 });
    b.box(0.015, 0.92, 0.015, 0xf4f0e6, { x: hx, y: hy - 0.41, z: hz + 0.12 });
  } else if (kind === 'crossbow') {
    b.box(0.08, 0.08, 0.6, P.leather || 0x4a3424, { x: hx, y: hy, z: hz + 0.2 });
    b.box(0.6, 0.05, 0.06, P.metal || 0x4a4a52, { x: hx, y: hy + 0.02, z: hz + 0.42 });
  } else if (kind === 'club' || kind === 'mace' || kind === 'ice') {
    b.cyl(0.07, 0.09, 0.5, 6, P.leather || 0x4e3424, { ...fwd, y: hy - 0.1, z: hz - 0.05 });
    const head = kind === 'ice' ? 0x9ad0f0 : kind === 'mace' ? 0x4a4440 : 0x7a5434;
    b.add(new THREE.DodecahedronGeometry(kind === 'club' ? 0.24 : 0.28, 0), head, { x: hx, y: hy + 0.25, z: hz + 0.42, sy: kind === 'club' ? 1.6 : 1 });
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; b.cone(0.05, 0.16, 4, 0xc8ccd2, { x: hx + Math.cos(a) * 0.2, y: hy + 0.25, z: hz + 0.42 + Math.sin(a) * 0.2, rz: Math.cos(a) * -1.4, rx: Math.sin(a) * 1.4 }); }
  } else if (kind === 'axe') {
    b.box(0.07, 1.1, 0.07, P.leather || 0x4e3424, { x: hx, y: hy - 0.5, z: hz + 0.05 });
    b.box(0.05, 0.42, 0.34, 0x9aa0a8, { x: hx, y: hy + 0.3, z: hz + 0.24 });
    b.cone(0.1, 0.2, 4, 0x9aa0a8, { x: hx, y: hy + 0.55, z: hz + 0.36 });
    b.box(0.04, 0.2, 0.08, P.cloth || 0xc0302a, { x: hx, y: hy + 0.05, z: hz + 0.05 });
  } else if (kind === 'hammer') {
    b.box(0.08, 1.3, 0.08, P.leather || 0x3a2a22, { x: hx, y: hy - 0.6, z: hz + 0.05 });
    b.box(0.42, 0.36, 0.6, P.metal || 0x4a4a52, { x: hx, y: hy + 0.55, z: hz + 0.05 });
    b.box(0.44, 0.08, 0.62, P.trim || 0xd8a83a, { x: hx, y: hy + 0.62, z: hz + 0.05 });
  } else if (kind === 'glaive') {
    b.box(0.06, 1.8, 0.06, 0x3a2a22, { x: hx, y: hy - 0.8, z: hz + 0.05 });
    b.add(new THREE.TorusGeometry(0.32, 0.07, 3, 8, Math.PI * 0.7), 0xdfe3e8, { x: hx, y: hy + 1.15, z: hz + 0.12, ry: Math.PI / 2, rz: 1.2, sz: 1.8 });
    b.box(0.03, 0.4, 0.16, P.cloth || 0xb02a24, { x: hx, y: hy + 0.6, z: hz + 0.1 });
  } else if (kind === 'staff') {
    b.box(0.06, 1.8, 0.06, 0x4a4040, { x: hx, y: hy - 0.8, z: hz + 0.05 });
    b.add(new THREE.TorusGeometry(0.2, 0.04, 3, 8), 0x5a5a62, { x: hx, y: hy + 1.15, z: hz + 0.05, ry: Math.PI / 2 });
    for (let i = 0; i < 4; i++) { const a = (i / 4) * Math.PI * 2; b.cone(0.05, 0.22, 4, 0x9ae6ff, { x: hx, y: hy + 1.15 + Math.sin(a) * 0.22, z: hz + 0.05 + Math.cos(a) * 0.22, rx: a }); }
  } else if (kind === 'greatsword') {
    b.box(0.09, 0.3, 0.09, P.leather || 0x3a2a22, { ...fwd, y: hy - 0.1, z: hz - 0.08 });
    b.box(0.44, 0.08, 0.12, P.trim || 0xd8a83a, { x: hx, y: hy + 0.0, z: hz + 0.05 });
    b.box(0.08, 1.4, 0.24, 0xc8ccd2, { ...fwd, y: hy - 0.02, z: hz + 0.1 });
    b.box(0.09, 1.1, 0.06, 0xd8342c, { ...fwd, y: hy + 0.08, z: hz + 0.15 });
  }
}

// --------------------------------------------------------------- humanoid
// o: { bulk, height, cloth, tabard, trim, metal, leather, boot, skin,
//      helm: 'great'|'open'|'hood'|'horned'|'wrap'|'kiln'|'wedge'|'pointhood'|'spiked',
//      crest, beard, fur, scarf, sash, shield: { kind, color, emblem, rim },
//      weapon, quiver, cape, capeColor, apron, eyes }
export function soldier(o) {
  const k = o.bulk || 1, H = o.height || 1;
  const skin = o.skin || C.skin;
  const hip = 0.72 * H, top = hip + 0.62 * H, headY = top + 0.3 * H, hr = 0.28 * Math.sqrt(k) * (o.headScale || 1);
  const parts = [];
  // Legs.
  for (const s of [-1, 1]) {
    const x = s * 0.15 * k;
    parts.push(part((b) => {
      b.box(0.21 * k, hip * 0.6, 0.23 * k, o.legs || o.cloth, { x, y: hip * 0.38 });
      b.box(0.24 * k, hip * 0.42, 0.29 * k, o.boot || 0x4a2f1e, { x, z: 0.02 });
      if (o.kneeTrim) b.box(0.25 * k, 0.06, 0.3 * k, o.kneeTrim, { x, y: hip * 0.42, z: 0.02 });
    }, { pivot: [x, hip, 0], anim: s < 0 ? 'legA' : 'legB' }));
  }
  // Body, head, off arm, shield and kit.
  parts.push(part((b) => {
    const w = 0.62 * k, d = 0.42 * k;
    b.box(w, top - hip, d, o.metal || o.cloth, { y: hip });
    b.box(w * 0.72, (top - hip) * 0.86, 0.04, o.tabard || o.cloth, { y: hip - 0.18 * H, z: d / 2 });
    b.box(w * 0.74, 0.05, 0.05, o.trim || o.tabard, { y: hip - 0.18 * H, z: d / 2 + 0.01 });
    b.box(w * 0.72, (top - hip) * 0.7, 0.04, o.tabard || o.cloth, { y: hip - 0.12 * H, z: -d / 2 });
    b.box(w + 0.04, 0.1 * H, d + 0.04, o.leather || 0x6a4428, { y: hip + 0.04 });
    b.box(0.14, 0.11 * H, 0.05, o.trim || 0xd8a83a, { y: hip + 0.03, z: d / 2 + 0.02 });
    if (o.apron) b.box(w * 0.66, 0.7 * H, 0.05, o.apron, { y: hip - 0.32 * H, z: d / 2 + 0.03 });
    if (o.sash) b.box(0.12, (top - hip) * 1.25, 0.03, o.sash, { y: hip + 0.02, z: d / 2 + 0.035, rz: 0.62 });
    // Pauldrons.
    for (const s of [-1, 1]) {
      b.ball(0.19 * k, o.pauldron || o.metal || o.cloth, { x: s * 0.36 * k, y: top - 0.04, sy: 0.72 });
      if (o.trim) b.cyl(0.2 * k, 0.2 * k, 0.04, 8, o.trim, { x: s * 0.36 * k, y: top - 0.12 });
      if (o.spikes) for (const dz of [-0.08, 0.08]) b.cone(0.05, 0.18, 4, 0xc8ccd2, { x: s * 0.42 * k, y: top + 0.05, z: dz });
    }
    // Off arm reaching forward to the shield or bow hand.
    b.box(0.16 * k, 0.4 * H, 0.17 * k, o.sleeve || o.metal || o.cloth, { x: -0.41 * k, y: top - 0.46 * H, z: 0.06 });
    b.box(0.17 * k, 0.15 * H, 0.18 * k, o.glove || o.leather || 0x5a3a24, { x: -0.41 * k, y: top - 0.56 * H, z: 0.16 });
    // Fur collar or scarf.
    if (o.fur) for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; b.ball(0.13 * k, o.fur, { x: Math.cos(a) * 0.27 * k, y: top + 0.01, z: Math.sin(a) * 0.2 * k }); }
    else if (o.scarf) { b.box(w * 0.86, 0.13, d * 0.95, o.scarf, { y: top - 0.04 }); b.box(0.16, 0.36, 0.05, o.scarf, { x: 0.12, y: top - 0.38, z: d / 2 + 0.03 }); }
    // Cape (static for troops; bosses get a moving one below).
    if (o.cape && !o.capeMoves) { b.box(w * 0.9, (top - hip) * 1.4, 0.06, o.cape, { y: hip - 0.25 * H, z: -d / 2 - 0.04 }); }
    // Quiver.
    if (o.quiver) {
      b.cyl(0.1, 0.1, 0.5, 6, o.leather || 0x5a3a24, { x: 0.08, y: top - 0.35, z: -d / 2 - 0.08, rz: -0.35 });
      for (const dx of [-0.04, 0.04, 0.0]) b.box(0.03, 0.12, 0.08, 0xf4f0e6, { x: 0.2 + dx, y: top + 0.1, z: -d / 2 - 0.08 + dx, rz: -0.35 });
    }
    // Head and helm.
    b.ball(hr, skin, { y: headY }, 1);
    if (o.beard) { b.box(hr * 1.4, hr * 0.85, hr * 0.7, o.beard, { y: headY - hr * 0.95, z: hr * 0.45 }); }
    const hm = o.helmColor || o.metal || 0x9aa0a8;
    const eye = o.eyes || 0x1e1a1c;
    if (o.helm === 'great') {
      b.box(hr * 2.1, hr * 2.0, hr * 2.05, hm, { y: headY - hr * 0.95 });
      b.box(hr * 1.5, hr * 0.14, 0.04, 0x1e1a1c, { y: headY + hr * 0.05, z: hr * 1.03 });
      b.box(hr * 0.12, hr * 0.7, 0.04, 0x1e1a1c, { y: headY - hr * 0.6, z: hr * 1.03 });
      b.box(hr * 2.14, hr * 0.14, hr * 2.1, o.trim || hm, { y: headY + hr * 0.62 });
      if (o.crest) b.box(hr * 0.32, hr * 0.7, hr * 2.0, o.crest, { y: headY + hr * 1.0 });
    } else if (o.helm === 'open') {
      b.ball(hr * 1.16, hm, { y: headY + hr * 0.3, z: -hr * 0.2, sy: 0.84 }, 1);
      b.cyl(hr * 1.12, hr * 1.12, hr * 0.14, 10, o.trim || hm, { y: headY + hr * 0.05 });
      b.box(hr * 0.14, hr * 0.6, 0.06, hm, { y: headY - hr * 0.5, z: hr * 1.0 });
      if (o.crest) b.box(hr * 0.26, hr * 0.5, hr * 1.6, o.crest, { y: headY + hr * 0.9 });
      for (const s of [-1, 1]) b.box(0.05, 0.05, 0.03, eye, { x: s * hr * 0.35, y: headY - hr * 0.05, z: hr * 0.98 });
    } else if (o.helm === 'hood' || o.helm === 'pointhood') {
      const hc = o.hood || 0x3f8a3a;
      b.ball(hr * 1.2, hc, { y: headY + hr * 0.14, z: -hr * 0.3 }, 1);
      b.cone(hr * (o.helm === 'pointhood' ? 0.9 : 0.6), hr * (o.helm === 'pointhood' ? 2.2 : 1.0), 6, hc, { y: headY + hr * 0.5, z: -hr * 0.35, rx: -0.4 });
      b.box(hr * 1.9, hr * 0.5, hr * 0.6, hc, { y: headY - hr * 1.15, z: 0.0 });
      if (o.mask) b.box(hr * 1.3, hr * 0.5, 0.08, o.mask, { y: headY - hr * 0.55, z: hr * 0.9 });
      if (o.facePlate) b.box(hr * 1.1, hr * 1.1, 0.08, o.facePlate, { y: headY - hr * 0.5, z: hr * 0.92 });
      for (const s of [-1, 1]) b.box(0.05, 0.05, 0.03, eye, { x: s * hr * 0.35, y: headY + hr * 0.05, z: hr * 0.98 });
    } else if (o.helm === 'horned' || o.helm === 'spiked') {
      b.box(hr * 2.1, hr * 1.9, hr * 2.1, hm, { y: headY - hr * 0.85 });
      b.box(hr * 1.4, hr * 0.14, 0.04, o.visor || 0x1e1a1c, { y: headY + hr * 0.05, z: hr * 1.06 });
      if (o.crown) b.cyl(hr * 1.2, hr * 1.2, hr * 0.26, 10, o.crown, { y: headY + hr * 0.75 });
      if (o.helm === 'horned') for (const s of [-1, 1]) {
        b.cone(hr * 0.26, hr * 1.4, 5, o.horn || C.cream, { x: s * hr * 1.25, y: headY + hr * 0.7, rz: -s * 0.9 });
        b.cone(hr * 0.2, hr * 0.9, 5, o.horn || C.cream, { x: s * hr * 1.75, y: headY + hr * 1.7, rz: s * 0.1 });
      } else for (let i = 0; i < 5; i++) b.cone(hr * 0.16, hr * 0.6, 4, 0xc8ccd2, { x: -hr * 0.8 + i * hr * 0.4, y: headY + hr * 1.0, z: -hr * 0.1 });
      if (o.redEyes) for (const s of [-1, 1]) b.box(0.07, 0.05, 0.03, 0xff3a2a, { x: s * hr * 0.4, y: headY + hr * 0.05, z: hr * 1.08 });
    } else if (o.helm === 'wrap') {
      b.ball(hr * 1.18, o.hood || 0x7a2a2a, { y: headY + hr * 0.15, z: -hr * 0.28 }, 1);
      b.box(hr * 1.6, hr * 0.8, 0.1, o.hood || 0x7a2a2a, { y: headY - hr * 0.85, z: hr * 0.85 });
      b.cone(hr * 0.5, hr * 0.8, 5, o.trim || 0xc8902a, { y: headY + hr * 0.9 });
      b.box(hr * 1.2, hr * 0.12, 0.04, eye, { y: headY + hr * 0.05, z: hr * 1.04 });
    } else if (o.helm === 'kiln') {
      b.box(hr * 2.3, hr * 2.4, hr * 2.2, hm, { y: headY - hr * 1.1 });
      b.box(hr * 1.5, hr * 0.3, 0.06, o.visor || 0xff8a2a, { y: headY - hr * 0.1, z: hr * 1.11 });
      b.cyl(hr * 0.4, hr * 0.5, hr * 0.6, 6, hm, { y: headY + hr * 1.3 });
    } else if (o.helm === 'wedge') {
      b.cone(hr * 1.8, hr * 2.9, 4, hm, { y: headY - hr * 1.05, ry: Math.PI / 4 });
      b.box(hr * 0.12, hr * 1.2, 0.04, 0x1e1a1c, { y: headY - hr * 0.3, z: hr * 0.92 });
      if (o.crest) b.box(hr * 0.3, hr * 1.2, hr * 2.6, o.crest, { y: headY + hr * 1.2 });
    } else {
      b.ball(hr * 1.08, o.hair || C.hair, { y: headY + hr * 0.25, z: -hr * 0.22, sy: 0.85 }, 1);
      for (const s of [-1, 1]) b.box(0.05, 0.05, 0.03, eye, { x: s * hr * 0.35, y: headY + hr * 0.05, z: hr * 0.98 });
    }
    // Shield on the off arm, facing forward and a little out.
    if (o.shield) {
      const S = o.shield, sx = -0.5 * k, sy = top - 0.62 * H, sz = 0.3 * k;
      const m = at(sx, sy, sz, -0.45);
      const sr = (S.size || 0.42) * k;
      if (S.kind === 'round') {
        b.cyl(sr, sr, 0.08, 12, S.rim || 0xd8a83a, { rx: Math.PI / 2, m });
        b.cyl(sr * 0.86, sr * 0.86, 0.1, 12, S.color, { rx: Math.PI / 2, m });
        if (S.emblem) emblem(b, S.emblem, at(sx, sy, sz, -0.45).multiply(new THREE.Matrix4().makeTranslation(0, 0, 0.05)), sr * 1.25, S.mark || 0xf2c33a);
      } else {
        // Angular kite or tower shield.
        const tall = S.kind === 'tower' ? 1.5 : 1.15;
        b.box(sr * 1.6, sr * 1.7 * tall, 0.08, S.rim || 0x2a2628, { y: -sr * 0.6 * tall, m });
        b.box(sr * 1.36, sr * 1.5 * tall, 0.1, S.color, { y: -sr * 0.5 * tall, m });
        b.cone(sr * 0.8, sr * 0.7, 4, S.color, { y: -sr * 1.2 * tall, rx: Math.PI, ry: Math.PI / 4, sz: 0.12, m });
        if (S.emblem) emblem(b, S.emblem, at(sx, sy, sz, -0.45).multiply(new THREE.Matrix4().makeTranslation(0, sr * 0.2, 0.06)), sr * 1.2, S.mark || 0x1e1a1c);
        if (S.spikes) for (const dy of [-0.4, 0.3]) b.cone(0.05, 0.18, 4, 0xc8ccd2, { x: sr * 0.8, y: dy * sr, rz: -Math.PI / 2, m });
      }
    }
    if (o.extra) o.extra(b, { hip, top, headY, hr, k, H });
  }, { tint: !!o.tint }));
  // Weapon arm.
  const sh = [0.41 * k, top - 0.04, 0];
  parts.push(part((b) => {
    b.box(0.16 * k, 0.42 * H, 0.17 * k, o.sleeve || o.metal || o.cloth, { x: sh[0], y: top - 0.46 * H });
    b.box(0.17 * k, 0.15 * H, 0.18 * k, o.glove || o.leather || 0x5a3a24, { x: sh[0], y: top - 0.56 * H, z: 0.04 });
    if (o.weapon) weapon(b, o.weapon, sh[0], top - 0.52 * H, 0.08, o);
  }, { pivot: sh, anim: 'arm' }));
  // A moving cape for bosses.
  if (o.cape && o.capeMoves) {
    const d = 0.42 * k;
    parts.push(part((b) => {
      b.box(0.7 * k, (top - hip) * 1.7, 0.07, o.cape, { y: hip - 0.45 * H, z: -d / 2 - 0.05 });
      if (o.capeEmblem) emblem(b, o.capeEmblem, at(0, hip + 0.05, -d / 2 - 0.1, Math.PI), 0.55 * k, o.trim || 0xd8a83a);
    }, { pivot: [0, top, -d / 2], anim: 'cape' }));
  }
  return { parts, height: headY + hr * 1.6 };
}

// --------------------------------------------------------------- allies
export function allyRigs(kitId = 'greenwood') {
  const P = ALLY_KITS[kitId] || ALLY_KITS.greenwood;
  const fur = P.fur || null;
  return {
    knight: soldier({
      cloth: P.cloth, tabard: P.tabard, trim: P.trim, metal: P.metal, legs: P.metalDark, leather: P.leather, boot: P.boot,
      sleeve: P.metal, pauldron: P.metal, helm: 'great', crest: P.crest, sash: SASH, fur, kneeTrim: P.trim,
      shield: { kind: 'round', color: P.shield, rim: P.trim, emblem: P.emblem, mark: P.trim }, weapon: P.sword, blade: 0xe8ecf0,
    }),
    archer: soldier({
      cloth: P.leather, tabard: P.hood, trim: P.trim, metal: P.leather, legs: 0x4a3626, leather: 0x5a3a24, boot: P.boot,
      sleeve: P.cloth, pauldron: P.hood, helm: 'hood', hood: P.hood, beard: 0x6b4426, sash: SASH, fur, quiver: true,
      weapon: 'bow', bow: 0x8a5a32,
    }),
    raider: soldier({
      cloth: P.cloth, tabard: P.scarf, trim: P.trim, metal: P.cloth, legs: 0x4a3e38, leather: P.leather, boot: P.boot,
      sleeve: P.cloth, pauldron: P.metal, helm: 'open', helmColor: P.metal, crest: kitId === 'greenwood' ? null : P.crest, beard: 0x6b4426,
      sash: SASH, fur, scarf: fur ? null : P.scarf, cape: P.scarf, weapon: P.raider,
    }),
  };
}

// --------------------------------------------------------------- enemies
export function enemyRigs(kitId = 'greenwood') {
  const P = ENEMY_KITS[kitId] || ENEMY_KITS.greenwood;
  const iceBrute = P.brute === 'ice';
  return {
    grunt: soldier({
      cloth: P.cloth, tabard: P.cloth, trim: P.trim, metal: P.metal, legs: P.dark, leather: P.leather, boot: P.dark,
      helm: 'great', helmColor: P.dark, crest: P.cloth, fur: kitId === 'frostmarch' ? P.fur : null, scarf: kitId === 'frostmarch' ? null : P.cloth,
      shield: { kind: 'kite', color: P.cloth, rim: P.dark, emblem: P.emblem, mark: P.dark }, weapon: P.sword, blade: 0xc8ccd2,
    }),
    bowman: soldier({
      cloth: P.leather, tabard: P.hood, trim: P.trim, metal: P.dark, legs: P.dark, leather: P.leather, boot: P.dark,
      helm: 'hood', hood: P.hood, mask: P.mask, quiver: true, fur: kitId === 'frostmarch' ? P.fur : null,
      weapon: kitId === 'frostmarch' ? 'crossbow' : 'bow', bow: 0x4a3424,
    }),
    brute: soldier({
      bulk: 1.45, height: 1.05, cloth: iceBrute ? 0x8ec6ee : P.dark, tabard: P.cloth, trim: P.trim, metal: iceBrute ? 0x9ad0f0 : P.metal, legs: P.dark,
      leather: P.leather, boot: P.dark, pauldron: iceBrute ? 0xc8e6f8 : P.metal, spikes: true, fur: P.fur,
      helm: 'horned', helmColor: P.dark, horn: kitId === 'greenwood' ? 0xe8dcc0 : 0xd8d0c0, redEyes: iceBrute, weapon: P.brute,
      skin: iceBrute ? 0x8ec6ee : C.skin,
    }),
    outrider: outriderRig(P),
    hound: houndRig(P),
  };
}

// A mounted outrider: rider with a spear on a horse in red barding.
function outriderRig(P) {
  const rider = soldier({
    cloth: P.leather, tabard: P.cloth, trim: P.trim, metal: P.dark, legs: P.dark, leather: P.leather, boot: P.dark,
    helm: 'hood', hood: P.hood, mask: P.mask, weapon: 'spear', scarf: P.cloth, height: 0.9,
  });
  // Lift the rider into the saddle; his legs straddle the horse.
  const lift = new THREE.Matrix4().makeTranslation(0, 0.95, -0.1);
  const parts = [];
  for (const p of rider.parts) {
    if (p.anim === 'legA' || p.anim === 'legB') continue;
    p.geo.applyMatrix4(lift);
    p.pivot = [p.pivot[0], p.pivot[1] + 0.95, p.pivot[2] - 0.1];
    parts.push(p);
  }
  parts.push(part((b) => {
    const hc = P.horse, dk = 0x2a221e;
    b.box(0.62, 0.6, 1.4, hc, { y: 0.75 });
    b.box(0.68, 0.46, 0.8, P.cloth, { y: 0.82, z: -0.05 });
    b.box(0.7, 0.06, 0.82, P.trim, { y: 0.8, z: -0.05 });
    b.box(0.32, 0.72, 0.38, hc, { y: 1.05, z: 0.68, rx: -0.5 });
    b.box(0.3, 0.32, 0.56, hc, { y: 1.55, z: 0.98 });
    b.box(0.24, 0.24, 0.18, 0x3a2a22, { y: 1.53, z: 1.3 });
    b.box(0.32, 0.06, 0.46, P.cloth, { y: 1.86, z: 0.98 });
    b.box(0.1, 0.5, 0.4, dk, { y: 1.3, z: 0.62, rx: -0.5 });
    b.box(0.12, 0.55, 0.12, dk, { y: 0.7, z: -0.78, rx: 0.4 });
    for (const s of [-1, 1]) b.box(0.14, 0.42, 0.2, P.dark, { x: s * 0.36, y: 0.95, z: 0.05 });
  }));
  for (const [x, z, anim] of [[-0.2, 0.52, 'legA'], [0.2, 0.52, 'legB'], [-0.2, -0.52, 'legB'], [0.2, -0.52, 'legA']]) {
    parts.push(part((b) => { b.box(0.15, 0.72, 0.17, P.horse, { x, y: 0.1, z }); b.box(0.17, 0.12, 0.19, 0x2a2420, { x, z }); }, { pivot: [x, 0.8, z], anim }));
  }
  return { parts, height: 2.6 };
}

// A war hound: lean wolf, spiked red collar, yellow eyes.
function houndRig(P) {
  const fur = P.hound, dark = P.houndDark;
  const parts = [part((b) => {
    b.box(0.44, 0.44, 1.05, fur, { y: 0.68 });
    b.box(0.5, 0.5, 0.42, fur, { y: 0.74, z: 0.42 });
    b.box(0.36, 0.34, 0.4, fur, { y: 0.98, z: 0.78 });
    b.box(0.22, 0.18, 0.32, dark, { y: 0.9, z: 1.08 });
    b.box(0.2, 0.05, 0.1, 0xf4f0e6, { y: 0.88, z: 1.2 });
    b.box(0.46, 0.1, 0.14, 0xc0302a, { y: 0.9, z: 0.6 });
    for (const s of [-1, 1]) b.cone(0.04, 0.12, 4, 0xc8ccd2, { x: s * 0.24, y: 0.95, z: 0.6, rz: -s * 1.4 });
    b.cone(0.08, 0.22, 4, dark, { x: 0.12, y: 1.28, z: 0.72 });
    b.cone(0.08, 0.22, 4, dark, { x: -0.12, y: 1.28, z: 0.72 });
    b.box(0.07, 0.05, 0.05, 0xffd84a, { x: 0.1, y: 1.06, z: 0.98 });
    b.box(0.07, 0.05, 0.05, 0xffd84a, { x: -0.1, y: 1.06, z: 0.98 });
    b.box(0.12, 0.12, 0.55, fur, { y: 0.86, z: -0.72, rx: -0.7 });
    b.box(0.34, 0.12, 0.6, dark, { y: 1.1, z: 0.1 });
  })];
  for (const [x, z, anim] of [[-0.15, 0.38, 'legA'], [0.15, 0.38, 'legB'], [-0.15, -0.36, 'legB'], [0.15, -0.36, 'legA']]) {
    parts.push(part((b) => b.box(0.13, 0.55, 0.15, dark, { x, y: 0.22, z }), { pivot: [x, 0.6, z], anim }));
  }
  return { parts, height: 1.3 };
}

// --------------------------------------------------------------- bosses
// Regional commanders (option A of each army sheet) and the Warlord.
export const BOSS_LOOKS = {
  bramble: () => soldier({
    bulk: 1.3, cloth: 0x4a3426, tabard: 0xb02a24, trim: 0x8a6a3a, metal: 0x4e4a48, legs: 0x3a2a20, leather: 0x5a3a24, boot: 0x3a2a20,
    pauldron: 0x5a5658, spikes: true, helm: 'spiked', helmColor: 0x4a3e36, beard: 0x5a3a22, scarf: 0xc8332c,
    shield: { kind: 'round', color: 0xc8332c, rim: 0x5a5658, emblem: 'thorn', mark: 0x2a1a1a, size: 0.55 }, weapon: 'axe', cloth2: 0xc8332c,
  }),
  cliff: () => soldier({
    bulk: 1.25, height: 1.1, cloth: 0x6a7078, tabard: 0xb8b4aa, trim: 0x9aa0a8, metal: 0x6a7078, legs: 0x4a5058, leather: 0x4a3e36, boot: 0x3a3a40,
    helm: 'great', helmColor: 0x5a6068, crest: 0xc8332c, shield: { kind: 'tower', color: 0x8a9098, rim: 0x4a5058, emblem: 'peak', mark: 0xc8332c, size: 0.5 }, weapon: 'hammer',
  }),
  forge: () => soldier({
    bulk: 1.6, height: 1.1, cloth: 0x2e2a28, tabard: 0x2e2a28, trim: 0xc8902a, metal: 0x3a3634, legs: 0x2a2624, leather: 0x3a2a22, boot: 0x1e1c1a,
    pauldron: 0x4a4644, helm: 'kiln', helmColor: 0x3a3634, visor: 0xff8a2a, apron: 0xb02a24, weapon: 'hammer',
  }),
  dune: () => soldier({
    bulk: 1.2, height: 1.05, cloth: 0x2a2420, tabard: 0xb02a24, trim: 0xc8902a, metal: 0x3a3430, legs: 0x2a2420, leather: 0x5a3a22, boot: 0x2a2420,
    helm: 'wrap', hood: 0x7a2a2a, cape: 0xb02a24, capeMoves: true, capeEmblem: 'sun',
    shield: { kind: 'kite', color: 0x2a2420, rim: 0xc8902a, emblem: 'sun', mark: 0xc8902a, size: 0.42 }, weapon: 'glaive',
  }),
  rime: () => soldier({
    bulk: 1.05, height: 1.1, cloth: 0x2a2830, tabard: 0x1e1c22, trim: 0xc9ccd4, metal: 0x2a2830, legs: 0x1e1c22, leather: 0x3a3238, boot: 0x1e1c22,
    helm: 'pointhood', hood: 0x1e1c22, facePlate: 0xe8e8ec, eyes: 0xff3a2a, fur: 0xf2f2f4, cape: 0xa02a3a, capeMoves: true, capeEmblem: 'diamond',
    shield: { kind: 'kite', color: 0x3a3840, rim: 0x9aa0aa, size: 0.36 }, weapon: 'staff',
  }),
  warlord: () => soldier({
    bulk: 1.45, height: 1.08, cloth: 0x1e1c20, tabard: 0xc0302a, trim: 0xd8a83a, metal: 0x24222a, legs: 0x1e1c20, leather: 0x3a2a22, boot: 0x1a181c,
    pauldron: 0x2a2830, helm: 'horned', helmColor: 0x1a181c, crown: 0xd8a83a, horn: 0xd8c8a0, redEyes: true, fur: 0x8a2a24,
    cape: 0xc0302a, capeMoves: true, capeEmblem: 'crown', weapon: 'greatsword', kneeTrim: 0xd8a83a,
  }),
};

// Which look each boss name gets.
export function bossLook(name = '') {
  if (/bramble/i.test(name)) return 'bramble';
  if (/cliff/i.test(name)) return 'cliff';
  if (/forge/i.test(name)) return 'forge';
  if (/dune/i.test(name)) return 'dune';
  if (/rime/i.test(name)) return 'rime';
  return 'warlord';
}

// --------------------------------------------------------------- Elder Treant
// Trunk body with a glowing heart, branch arms with claw fingers, root legs
// and a crown of leaf clumps (elder_treant.png). Wave 5's boss.
export function treantRig() {
  const bark = 0x7a5232, barkDark = 0x5a3a22, barkLight = 0x9a6a42, leaf = 0x5aa83e, leafDark = 0x3f8a32, leafLight = 0x7cc24e;
  const parts = [];
  for (const s of [-1, 1]) {
    parts.push(part((b) => {
      b.cyl(0.2, 0.3, 0.9, 6, bark, { x: s * 0.24, y: 0.0 });
      for (let i = 0; i < 3; i++) { const a = (i / 3) * Math.PI * 2 + s; b.cyl(0.05, 0.13, 0.5, 5, barkDark, { x: s * 0.24 + Math.cos(a) * 0.28, y: -0.05, z: Math.sin(a) * 0.28, rz: Math.cos(a) * 1.0, rx: -Math.sin(a) * 1.0 }); }
    }, { pivot: [s * 0.24, 0.9, 0], anim: s < 0 ? 'legA' : 'legB' }));
  }
  parts.push(part((b) => {
    b.cyl(0.36, 0.42, 0.9, 7, bark, { y: 0.85 });
    b.cyl(0.42, 0.36, 0.5, 7, barkLight, { y: 1.7 });
    // The glowing heart in a hollow.
    b.cyl(0.18, 0.18, 0.08, 6, 0x3a2414, { y: 1.35, z: 0.36, rx: Math.PI / 2 });
    b.add(new THREE.DodecahedronGeometry(0.12, 0), 0xffc23a, { y: 1.35, z: 0.4 });
    // Head and eyes.
    b.cyl(0.3, 0.36, 0.45, 6, bark, { y: 2.15 });
    for (const sx of [-1, 1]) b.box(0.08, 0.05, 0.04, 0xb8ff6a, { x: sx * 0.12, y: 2.38, z: 0.3 });
    b.box(0.3, 0.06, 0.06, barkDark, { y: 2.46, z: 0.3 });
    // Branches and a leafy crown.
    for (const [x, z, r] of [[0.25, 0, -0.6], [-0.25, 0.05, 0.6], [0, -0.2, 0.1]]) b.cyl(0.05, 0.08, 0.7, 5, barkDark, { x, y: 2.5, z, rz: r });
    [[0, 3.05, 0, 0.5], [0.5, 2.85, 0.1, 0.42], [-0.5, 2.9, -0.05, 0.44], [0.2, 3.2, -0.3, 0.36], [-0.25, 3.25, 0.25, 0.34], [0.85, 2.6, 0, 0.3], [-0.85, 2.6, 0, 0.3]]
      .forEach(([x, y, z, r], i) => b.add(new THREE.IcosahedronGeometry(r, 0), [leaf, leafDark, leafLight][i % 3], { x, y, z }));
    // Moss and ivy on the shoulders and body.
    for (const [x, y, z] of [[0.38, 1.95, 0.1], [-0.38, 1.95, 0.1], [0.2, 1.1, 0.35], [-0.3, 0.9, 0.3]]) b.add(new THREE.IcosahedronGeometry(0.15, 0), leafDark, { x, y, z });
  }));
  // Long branch arms with claw fingers (both swing).
  for (const s of [-1, 1]) {
    parts.push(part((b) => {
      b.cyl(0.13, 0.17, 1.0, 6, bark, { x: s * 0.6, y: 1.0, rz: s * 0.15 });
      b.add(new THREE.IcosahedronGeometry(0.16, 0), leaf, { x: s * 0.6, y: 1.8, z: 0.05 });
      for (let i = 0; i < 4; i++) b.cone(0.05, 0.4, 4, barkDark, { x: s * (0.5 + i * 0.07), y: 0.6, z: 0.08 - i * 0.05, rx: Math.PI, rz: s * (i - 1.5) * 0.25 });
    }, { pivot: [s * 0.6, 2.0, 0], anim: 'arm' }));
  }
  return { parts, height: 3.4 };
}
