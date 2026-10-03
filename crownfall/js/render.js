// Everything the player sees in the 3D view. Reads the world each frame and
// mirrors it: static terrain built once, buildings rebuilt when their level
// changes, units drawn as instanced rigs, plus coins, arrows and effects.

import * as THREE from './vendor/three.js';
import {
  C, Builder, vcMat, RIGS, pineGeo, rockGeo, cliffGeo, palisadeGeo, stoneWallGeo, gateGeo, gateDoorGeo,
  castleGeo, houseGeo, farmGeo, barracksGeo, stableGeo, rangeGeo, goldmineGeo, lumberGeo, quarryGeo,
  bridgeGeo, towerGeo, towerGunGeo, coinGeo, arrowGeo, chevronGeo,
} from './models.js';
import {
  LANES, lanePoint, BRIDGE, RIVER_Z, RIVER_HALF, FOREST_Z, PATH_HALF, CASTLE_R, scenery, distToLanes,
} from './map.js';
import { BUILDINGS } from './config.js';

const TAU = Math.PI * 2;
const SKY = 0x9ad6f5;
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
// Units are drawn a bit larger than life so they read on a phone.
const UNIT_S = 1.3;
const HERO_S = 1.4;

const VILLAGER_TINTS = [0xe8d7b0, 0x7fa7d9, 0xd98c6a, 0x9cc77a, 0xcfa0d6, 0xf0c060, 0xa0a0a0].map((h) => new THREE.Color(h));
const easeOutBack = (t) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; };

// ----------------------------------------------------------- instanced rig
class RigMesh {
  constructor(scene, rig, cap) {
    this.height = rig.height;
    this.parts = rig.parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geo, vcMat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.setColorAt(0, _c.set(0xffffff));
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      const T = new THREE.Matrix4().makeTranslation(p.pivot[0], p.pivot[1], p.pivot[2]);
      const Ti = new THREE.Matrix4().makeTranslation(-p.pivot[0], -p.pivot[1], -p.pivot[2]);
      return { p, m, n: 0, T, Ti, cap };
    });
    this.rot = new THREE.Matrix4();
  }
  begin() { for (const pt of this.parts) pt.n = 0; }
  add(x, y, z, yaw, scale, st) {
    _q.setFromAxisAngle(UP, yaw);
    _m.compose(_v.set(x, y, z), _q, _s.set(scale, scale, scale));
    const walk = st.walk || 0;
    const s = Math.sin(st.anim || 0);
    for (const pt of this.parts) {
      if (pt.n >= pt.cap) continue;
      const p = pt.p;
      if (p.show && p.show !== st.load) continue;
      let a = 0;
      if (p.anim === 'legA') a = s * 0.65 * walk;
      else if (p.anim === 'legB') a = -s * 0.65 * walk;
      else if (p.anim === 'arm') a = -(st.swing || 0) * 1.5 + s * 0.35 * walk;
      else if (p.anim === 'aim') a = -(st.swing || 0) * 0.5;
      if (a) {
        this.rot.makeRotationX(a);
        _m2.copy(_m).multiply(pt.T).multiply(this.rot).multiply(pt.Ti);
        pt.m.setMatrixAt(pt.n, _m2);
      } else pt.m.setMatrixAt(pt.n, _m);
      if (p.tint && st.tint) _c.copy(st.tint); else _c.setRGB(1, 1, 1);
      if (st.flash) _c.multiplyScalar(1 + st.flash * 1.6);
      pt.m.setColorAt(pt.n, _c);
      pt.n++;
    }
  }
  end() {
    for (const pt of this.parts) {
      pt.m.count = pt.n;
      pt.m.instanceMatrix.needsUpdate = true;
      if (pt.m.instanceColor) pt.m.instanceColor.needsUpdate = true;
    }
  }
}

// Simple instanced pool for things that only need a matrix and a colour.
class Pool {
  constructor(scene, geo, mat, cap, { shadow = false, order = 0 } = {}) {
    this.m = new THREE.InstancedMesh(geo, mat, cap);
    this.m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.m.setColorAt(0, _c.set(0xffffff));
    this.m.castShadow = shadow;
    this.m.frustumCulled = false;
    this.m.renderOrder = order;
    this.m.count = 0;
    this.cap = cap;
    this.n = 0;
    scene.add(this.m);
  }
  begin() { this.n = 0; }
  push(matrix, color) {
    if (this.n >= this.cap) return;
    this.m.setMatrixAt(this.n, matrix);
    this.m.setColorAt(this.n, color || _c.setRGB(1, 1, 1));
    this.n++;
  }
  end() {
    this.m.count = this.n;
    this.m.instanceMatrix.needsUpdate = true;
    if (this.m.instanceColor) this.m.instanceColor.needsUpdate = true;
  }
}

const BUILD_GEO = {
  castle: castleGeo, house: houseGeo, farm: farmGeo, barracks: barracksGeo, stable: stableGeo, range: rangeGeo,
  goldmine: goldmineGeo, lumber: lumberGeo, quarry: quarryGeo, bridge: bridgeGeo, tower: towerGeo,
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY);
    this.scene.fog = new THREE.Fog(SKY, 75, 150);

    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 400);
    this.camTarget = new THREE.Vector3(0, 0, 6);
    this.zoom = 1;
    this.shake = 0;

    const hemi = new THREE.HemisphereLight(0xeaf6ff, 0x5c7a3a, 1.55);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -34; sc.right = 34; sc.top = 34; sc.bottom = -34; sc.near = 1; sc.far = 110;
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    this.geoCache = new Map();
    this.buildings = new Map();
    this.wallSig = '';
    this.wallGroup = new THREE.Group();
    this.scene.add(this.wallGroup);
    this.gateMeshes = {};

    this.buildTerrain();
    this.buildDynamic();

    this.particles = [];
    this.flyers = [];
    this.rings = [];
    this.time = 0;
    this.stackLean = { x: 0, z: 0 };
    this.stackTop = new THREE.Vector3();
  }

  resize(w, h) {
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.w = w; this.h = h;
  }

  geo(key, fn) {
    if (!this.geoCache.has(key)) this.geoCache.set(key, fn());
    return this.geoCache.get(key);
  }

  // --------------------------------------------------------------- terrain
  buildTerrain() {
    const scene = this.scene;
    // Ground with painted colour variation.
    const size = 300, seg = 150;
    const g = new THREE.PlaneGeometry(size, size, seg, seg);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    const colors = new Float32Array(pos.count * 3);
    const grass = new THREE.Color(C.grass), grassDark = new THREE.Color(C.grassDark), forest = new THREE.Color(C.forest);
    const sand = new THREE.Color(C.sandDark), light = new THREE.Color(0x7fcb5c), bank = new THREE.Color(0x4f8f45);
    const tmp = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const n = Math.sin(x * 0.13 + Math.cos(z * 0.09) * 2) * 0.5 + Math.sin(z * 0.17 - x * 0.05) * 0.5;
      tmp.copy(grass).lerp(n > 0 ? light : grassDark, Math.abs(n) * 0.55);
      if (z < FOREST_Z + 2) tmp.lerp(forest, Math.min(1, (FOREST_Z + 2 - z) / 5) * 0.85);
      const rd = Math.abs(z - RIVER_Z);
      if (rd < RIVER_HALF + 1.6) tmp.lerp(rd < RIVER_HALF + 0.3 ? bank : sand, rd < RIVER_HALF + 0.3 ? 1 : 0.6);
      const r = Math.hypot(x, z);
      if (r < CASTLE_R + 1.5) tmp.lerp(sand, 0.35);
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    const ground = new THREE.Mesh(g, new THREE.MeshLambertMaterial({ vertexColors: true }));
    ground.receiveShadow = true;
    scene.add(ground);

    // Dirt roads: a darker edge under a lighter road.
    const roadMat = new THREE.MeshLambertMaterial({ color: C.sand });
    const edgeMat = new THREE.MeshLambertMaterial({ color: 0xc7a573 });
    for (const lane of LANES) {
      const edge = new THREE.Mesh(ribbon(lane.pts, PATH_HALF + 0.35, 0.02), edgeMat);
      const road = new THREE.Mesh(ribbon(lane.pts, PATH_HALF, 0.035), roadMat);
      edge.receiveShadow = road.receiveShadow = true;
      scene.add(edge, road);
    }
    // Castle courtyard.
    const yard = new THREE.Mesh(new THREE.CircleGeometry(CASTLE_R + 1.6, 28), roadMat);
    yard.rotation.x = -Math.PI / 2; yard.position.y = 0.03;
    yard.receiveShadow = true;
    scene.add(yard);

    // River.
    const water = new THREE.Mesh(new THREE.PlaneGeometry(size, RIVER_HALF * 2), new THREE.MeshLambertMaterial({ color: C.water, transparent: true, opacity: 0.92 }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(0, 0.06, RIVER_Z);
    water.receiveShadow = true;
    scene.add(water);
    this.water = water;
    // Foam strips along the banks.
    const foamMat = new THREE.MeshBasicMaterial({ color: 0xd8f1ff, transparent: true, opacity: 0.55 });
    for (const s of [-1, 1]) {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(size, 0.35), foamMat);
      foam.rotation.x = -Math.PI / 2;
      foam.position.set(0, 0.07, RIVER_Z + s * (RIVER_HALF - 0.2));
      scene.add(foam);
    }

    // Trees, rocks, mountains.
    const sc = scenery();
    const tree = new THREE.InstancedMesh(pineGeo(), vcMat, sc.trees.length);
    sc.trees.forEach((t, i) => {
      _q.setFromAxisAngle(UP, t.r);
      _m.compose(_v.set(t.x, 0, t.z), _q, _s.set(t.s, t.s * (0.9 + (i % 5) * 0.06), t.s));
      tree.setMatrixAt(i, _m);
    });
    tree.castShadow = true;
    tree.receiveShadow = true;
    scene.add(tree);

    const rock = new THREE.InstancedMesh(rockGeo(), vcMat, sc.rocks.length);
    sc.rocks.forEach((t, i) => {
      _q.setFromAxisAngle(UP, t.r);
      _m.compose(_v.set(t.x, 0, t.z), _q, _s.set(t.s, t.s, t.s));
      rock.setMatrixAt(i, _m);
    });
    rock.castShadow = true;
    scene.add(rock);

    const cliff = new THREE.InstancedMesh(cliffGeo(), vcMat, sc.cliffs.length);
    sc.cliffs.forEach((t, i) => {
      _q.setFromAxisAngle(UP, t.r);
      _m.compose(_v.set(t.x, 0, t.z), _q, _s.set(t.w, t.h, t.d));
      cliff.setMatrixAt(i, _m);
    });
    cliff.castShadow = true;
    cliff.receiveShadow = true;
    scene.add(cliff);
  }

  // -------------------------------------------------------- dynamic layers
  buildDynamic() {
    const scene = this.scene;
    this.rigs = {};
    const caps = { hero: 1, knight: 40, archer: 80, raider: 40, villager: 120, grunt: 160, brute: 50, bowman: 70, outrider: 70, boss: 3 };
    for (const [k, cap] of Object.entries(caps)) this.rigs[k] = new RigMesh(scene, RIGS[k](), cap);

    const goldMat = new THREE.MeshLambertMaterial({ color: C.gold, emissive: 0x5a3a00 });
    this.coinPool = new Pool(scene, coinGeo(), goldMat, 500, { shadow: true });
    this.stackPool = new Pool(scene, coinGeo(), goldMat, 1400, { shadow: true });
    this.arrowPool = new Pool(scene, arrowGeo(), vcMat, 500);
    this.particlePool = new Pool(scene, new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), 900);
    this.chevronPool = new Pool(scene, chevronGeo(), new THREE.MeshBasicMaterial({ color: 0x35c8ff, transparent: true, opacity: 0.9, depthWrite: false }), 16, { order: 2 });

    const barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, depthTest: false, depthWrite: false, transparent: true });
    const barGeo = new THREE.PlaneGeometry(1, 1);
    this.barBg = new Pool(scene, barGeo, barMat, 300, { order: 10 });
    this.barFg = new Pool(scene, barGeo, barMat.clone(), 300, { order: 11 });

    // Selection ring under the king, like the reference.
    this.heroRing = new THREE.Mesh(new THREE.RingGeometry(1.45, 1.62, 48), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, depthWrite: false }));
    this.heroRing.rotation.x = -Math.PI / 2;
    this.heroRing.renderOrder = 1;
    scene.add(this.heroRing);

    this.rangeRing = new THREE.Mesh(new THREE.RingGeometry(0.97, 1, 64), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, depthWrite: false }));
    this.rangeRing.rotation.x = -Math.PI / 2;
    this.rangeRing.visible = false;
    scene.add(this.rangeRing);

    // Placement ghost.
    this.ghost = new THREE.Group();
    this.ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false });
    this.ghostMesh = new THREE.Mesh(undefined, this.ghostMat);
    this.ghostFoot = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x4cff7a, transparent: true, opacity: 0.55, depthWrite: false }));
    this.ghostFoot.rotation.x = -Math.PI / 2;
    this.ghostFoot.position.y = 0.08;
    this.ghost.add(this.ghostMesh, this.ghostFoot);
    this.ghost.visible = false;
    scene.add(this.ghost);

    // Shockwave rings for slams and splashes.
    this.ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false });
    this.ringGeo = new THREE.RingGeometry(0.85, 1, 40);
  }

  // Wipe per-game objects when a new game or a reload starts.
  reset() {
    for (const e of this.buildings.values()) this.scene.remove(e.group);
    this.buildings.clear();
    this.wallSig = '';
    this.particles.length = 0;
    this.flyers.length = 0;
    for (const r of this.rings) this.scene.remove(r.mesh);
    this.rings.length = 0;
  }

  // ------------------------------------------------------------- buildings
  syncBuildings(world) {
    const seen = new Set();
    for (const b of Object.values(world.b)) {
      const visible = world.padVisible(b);
      if (!visible) continue;
      seen.add(b.id);
      let e = this.buildings.get(b.id);
      const key = b.state === 'built' ? `${b.type}:${b.level}` : 'site';
      if (!e || e.key !== key) {
        const old = e;
        if (old) this.scene.remove(old.group);
        e = this.makeBuilding(b, key);
        // Pop in when something is built or upgraded in front of you.
        e.pop = old && key !== 'site' && this.ready ? 0 : 1;
        this.buildings.set(b.id, e);
        this.scene.add(e.group);
      }
      if (e.key === 'site') this.updatePad(e, world, b);
      if (e.pop < 1) {
        e.pop = Math.min(1, e.pop + this.dt * 2.4);
        const s = Math.max(0.01, easeOutBack(e.pop));
        e.body.scale.set(s, s, s);
      }
      if (e.gun) e.gun.rotation.y += angleDiff(e.gun.rotation.y, b.aim ?? e.gun.rotation.y) * Math.min(1, this.dt * 10);
    }
    for (const [id, e] of this.buildings) {
      if (!seen.has(id)) { this.scene.remove(e.group); this.buildings.delete(id); }
    }
  }

  makeBuilding(b, key) {
    const group = new THREE.Group();
    group.position.set(b.x, 0, b.z);
    const e = { key, group, pop: 1, body: null, sig: '' };
    if (key === 'site') {
      const size = Math.max(3.8, b.size);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 256;
      const tex = new THREE.CanvasTexture(canvas);
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 4;
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
      mesh.rotation.x = -Math.PI / 2;
      mesh.position.y = 0.09;
      mesh.renderOrder = 1;
      group.add(mesh);
      e.canvas = canvas; e.tex = tex; e.body = mesh;
      if (b.type === 'bridge') group.rotation.y = 0;
      return e;
    }
    const geo = this.geo(key, () => BUILD_GEO[b.type](b.level));
    const body = new THREE.Mesh(geo, vcMat);
    body.castShadow = true;
    body.receiveShadow = true;
    group.add(body);
    e.body = body;
    if (b.type === 'bridge') {
      const p = lanePoint(LANES.find((l) => l.id === 'N'), BRIDGE.s);
      group.rotation.y = Math.atan2(p.dx, p.dz);
    }
    if (b.type === 'tower') {
      const gun = new THREE.Mesh(this.geo(`gun:${b.level >= 2 ? 2 : 0}`, () => towerGunGeo(b.level)), vcMat);
      gun.position.y = [3.15, 3.55, 3.95][b.level];
      gun.castShadow = true;
      body.add(gun);
      e.gun = gun;
    }
    return e;
  }

  updatePad(e, world, b) {
    const it = world.item(`build:${b.id}`);
    const paid = world.funds[`build:${b.id}`] || 0;
    const gold = it.cost.gold || 0;
    const lackW = (it.cost.wood || 0) > world.res.wood, lackS = (it.cost.stone || 0) > world.res.stone;
    const sig = `${paid}|${it.locked}|${lackW}|${lackS}`;
    if (sig === e.sig) return;
    e.sig = sig;
    const ctx = e.canvas.getContext('2d');
    const S = 256;
    ctx.clearRect(0, 0, S, S);
    const r = 34, inset = 12;
    roundRect(ctx, inset, inset, S - inset * 2, S - inset * 2, r);
    ctx.fillStyle = it.locked ? 'rgba(40,40,50,0.35)' : 'rgba(255,255,255,0.18)';
    ctx.fill();
    // Progress fill.
    const f = gold ? Math.min(1, paid / gold) : 0;
    if (f > 0) {
      ctx.save();
      roundRect(ctx, inset, inset, S - inset * 2, S - inset * 2, r);
      ctx.clip();
      ctx.fillStyle = 'rgba(70, 225, 95, 0.75)';
      ctx.fillRect(inset, inset, (S - inset * 2) * f, S - inset * 2);
      ctx.restore();
    }
    ctx.setLineDash([26, 16]);
    ctx.lineWidth = 9;
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    roundRect(ctx, inset, inset, S - inset * 2, S - inset * 2, r);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '78px system-ui, "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(it.locked ? '🔒' : it.icon, S / 2, 84);
    ctx.lineJoin = 'round';
    const text = (str, y, size, fill) => {
      ctx.font = `800 ${size}px system-ui, -apple-system, sans-serif`;
      ctx.lineWidth = 10;
      ctx.strokeStyle = 'rgba(30,30,40,0.85)';
      ctx.strokeText(str, S / 2, y);
      ctx.fillStyle = fill;
      ctx.fillText(str, S / 2, y);
    };
    if (it.locked) {
      text(it.locked, 160, 36, '#ffffff');
    } else {
      // Coin + gold still owed.
      const label = `${gold - paid}`;
      ctx.font = '800 54px system-ui, -apple-system, sans-serif';
      const tw = ctx.measureText(label).width;
      const cx = S / 2 - tw / 2 - 8;
      ctx.beginPath(); ctx.arc(cx - 14, 156, 20, 0, TAU);
      ctx.fillStyle = '#ffcf3a'; ctx.fill();
      ctx.lineWidth = 5; ctx.strokeStyle = '#b97a0a'; ctx.stroke();
      ctx.save(); ctx.translate(18, 0); text(label, 158, 54, '#ffffff'); ctx.restore();
      const mats = [];
      if (it.cost.wood) mats.push(`${it.cost.wood} wood`);
      if (it.cost.stone) mats.push(`${it.cost.stone} stone`);
      if (mats.length) text(mats.join(' + '), 206, mats.length > 1 ? 26 : 32, lackW || lackS ? '#ff9a8a' : '#ffffff');
    }
    e.tex.needsUpdate = true;
  }

  // ------------------------------------------------------------ walls/gates
  syncWalls(world) {
    const ids = Object.values(world.b).filter((b) => world.padVisible(b) && b.type !== 'castle').map((b) => b.id).join(',');
    const sig = `${world.walls.level}|${world.walls.gate}|${ids}`;
    if (sig !== this.wallSig) {
      this.wallSig = sig;
      this.scene.remove(this.wallGroup);
      this.wallGroup = new THREE.Group();
      this.scene.add(this.wallGroup);
      const stone = world.walls.gate >= 1;
      const R = world.wallRadius;
      const segLen = 2.4;
      const n = Math.ceil((TAU * R) / segLen);
      const len = (TAU * R) / n + 0.05;
      const geo = stone ? stoneWallGeo(len) : palisadeGeo(len);
      const keep = [];
      const blockers = Object.values(world.b).filter((b) => b.type !== 'castle' && world.padVisible(b));
      for (let i = 0; i < n; i++) {
        const a = ((i + 0.5) / n) * TAU;
        const x = Math.cos(a) * R, z = Math.sin(a) * R;
        if (distToLanes(x, z) < PATH_HALF + 2.4) continue;
        if (blockers.some((b) => Math.abs(b.x - x) < b.size / 2 + 1.2 && Math.abs(b.z - z) < b.size / 2 + 1.2)) continue;
        keep.push([x, z, -a - Math.PI / 2]);
      }
      const mesh = new THREE.InstancedMesh(geo, vcMat, Math.max(1, keep.length));
      keep.forEach(([x, z, ry], i) => {
        _q.setFromAxisAngle(UP, ry);
        _m.compose(_v.set(x, 0, z), _q, _s.set(1, 1, 1));
        mesh.setMatrixAt(i, _m);
      });
      mesh.count = keep.length;
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.wallGroup.add(mesh);

      this.gateMeshes = {};
      for (const g of Object.values(world.gates)) {
        const grp = new THREE.Group();
        grp.position.set(g.x, 0, g.z);
        grp.rotation.y = Math.atan2(g.dx, g.dz);
        const frame = new THREE.Mesh(this.geo(`gate:${stone}`, () => gateGeo(stone)), vcMat);
        const door = new THREE.Mesh(this.geo(`door:${stone}`, () => gateDoorGeo(stone)), vcMat);
        frame.castShadow = door.castShadow = true;
        grp.add(frame, door);
        this.wallGroup.add(grp);
        this.gateMeshes[g.lane] = { grp, door };
      }
    }
    for (const g of Object.values(world.gates)) {
      const gm = this.gateMeshes[g.lane];
      if (!gm) continue;
      // Gates swing open in peacetime so villagers can pass, close for a wave.
      const shut = world.phase === 'wave' && g.hp > 0;
      gm.door.visible = g.hp > 0;
      const target = shut ? 1 : 0.0001;
      gm.door.scale.x += (target - gm.door.scale.x) * Math.min(1, this.dt * 6);
    }
  }

  // ------------------------------------------------------------------ frame
  frame(dt, world, view) {
    this.dt = dt;
    this.time += dt;
    const t = this.time;
    const hero = world.hero;

    this.syncBuildings(world);
    this.syncWalls(world);
    this.ready = true;

    // ---- units
    for (const r of Object.values(this.rigs)) r.begin();
    if (hero.alive) {
      const v = Math.hypot(hero.vx, hero.vz);
      const gallop = Math.min(1, v / 4);
      const bob = Math.abs(Math.sin(hero.anim * 1.2)) * 0.12 * gallop;
      this.rigs.hero.add(hero.x, bob, hero.z, hero.yaw, HERO_S, { walk: gallop, anim: hero.anim * 2.2, swing: hero.shootT * 5, flash: hero.flash });
    }
    const UNIT_RIG = { knight: 'knight', archer: 'archer', raider: 'raider' };
    for (const a of world.allies) {
      this.rigs[UNIT_RIG[a.kind]].add(a.x, a.moving ? Math.abs(Math.sin(a.anim)) * 0.07 : 0, a.z, a.yaw, UNIT_S, {
        walk: a.moving ? 1 : 0, anim: a.anim, swing: a.attackT * 4, flash: a.flash,
      });
    }
    for (const b of Object.values(world.b)) {
      if (b.type !== 'tower' || b.state !== 'built' || !b.garrison) continue;
      const y = [3.15, 3.55, 3.95][b.level];
      for (let k = 0; k < b.garrison; k++) {
        const ox = [-0.75, 0.75, 0][k], oz = [-0.6, -0.6, 0.75][k];
        this.rigs.archer.add(b.x + ox, y, b.z + oz, b.aim ?? 0, 1.05, { swing: Math.max(0, Math.sin(t * 3 + k)) * 0.2 });
      }
    }
    for (const v of world.villagers) {
      const working = v.state === 'work' && !v.path.length && v.job && world.b[v.job] && world.b[v.job].type !== 'farm';
      this.rigs.villager.add(v.x, v.moving ? Math.abs(Math.sin(v.anim)) * 0.06 : 0, v.z, v.yaw, UNIT_S * 0.88, {
        walk: v.moving ? 1 : 0, anim: v.anim, swing: working ? (Math.sin(t * 7 + v.id) + 1) * 0.5 : 0,
        tint: VILLAGER_TINTS[v.id % VILLAGER_TINTS.length], load: v.carry ? v.carry.res : null,
      });
    }
    const ENEMY_RIG = { grunt: 'grunt', brute: 'brute', archer: 'bowman', raider: 'outrider', boss: 'boss' };
    for (const e of world.enemies) {
      this.rigs[ENEMY_RIG[e.kind]].add(e.x, e.moving ? Math.abs(Math.sin(e.anim)) * 0.08 : 0, e.z, e.yaw, e.scale * UNIT_S, {
        walk: e.moving ? 1 : 0, anim: e.anim, swing: e.attackT * 3.3, flash: e.flash + (e.burn > 0 ? 0.25 + Math.sin(t * 20) * 0.15 : 0),
      });
    }
    for (const r of Object.values(this.rigs)) r.end();

    // ---- coins on the ground
    const cp = this.coinPool;
    cp.begin();
    for (const c of world.coins) {
      const bob = c.vy === 0 && c.y <= 0.16 ? Math.sin(t * 3 + c.id) * 0.08 : 0;
      _e.set(Math.PI / 2, c.spin, 0, 'YXZ');
      _q.setFromEuler(_e);
      const s = (c.value > 1 ? Math.min(1.8, 1 + c.value * 0.04) : 1) * 1.35;
      _m.compose(_v.set(c.x, c.y + 0.28 * s + bob, c.z), _q, _s.set(s, s, s));
      cp.push(_m);
    }
    cp.end();

    // ---- the coin stack on the king's horse, and the mine piles
    const sp = this.stackPool;
    sp.begin();
    if (hero.alive && hero.coins > 0) {
      const shown = hero.coins <= 90 ? hero.coins : Math.min(260, 90 + Math.floor((hero.coins - 90) * 0.35));
      const tx = -hero.vx * 0.14, tz = -hero.vz * 0.14;
      this.stackLean.x += (tx - this.stackLean.x) * Math.min(1, dt * 5);
      this.stackLean.z += (tz - this.stackLean.z) * Math.min(1, dt * 5);
      const fx = Math.sin(hero.yaw), fz = Math.cos(hero.yaw);
      const bx = hero.x - fx * 0.7 * HERO_S, bz = hero.z - fz * 0.7 * HERO_S;
      const base = 1.95 * HERO_S + Math.abs(Math.sin(hero.anim * 1.2)) * 0.12 * Math.min(1, Math.hypot(hero.vx, hero.vz) / 4);
      _q.identity();
      for (let i = 0; i < shown; i++) {
        const h = i * 0.085;
        const k = h * h * 0.018;
        _m.compose(_v.set(bx + this.stackLean.x * k, base + h, bz + this.stackLean.z * k), _q, _s.set(1, 1, 1));
        sp.push(_m);
      }
      const h = shown * 0.085;
      this.stackTop.set(bx + this.stackLean.x * h * h * 0.018, base + h, bz + this.stackLean.z * h * h * 0.018);
    } else this.stackTop.set(hero.x, 2, hero.z);
    for (const m of world.list('goldmine')) {
      if (m.state !== 'built' || !m.pile) continue;
      _q.identity();
      for (let i = 0; i < m.pile; i++) {
        const col = Math.floor(i / 20), k = i % 20;
        const ox = 2.0 + (col % 3) * 0.66, oz = 2.2 + Math.floor(col / 3) * 0.66;
        _m.compose(_v.set(m.x + ox, 0.05 + k * 0.085, m.z + oz), _q, _s.set(1, 1, 1));
        sp.push(_m);
      }
    }
    // Flying coins (spending and scooping).
    for (let i = this.flyers.length - 1; i >= 0; i--) {
      const f = this.flyers[i];
      f.t += dt / f.dur;
      if (f.t >= 1) { this.flyers.splice(i, 1); continue; }
      const k = f.t;
      const to = f.toHero ? this.stackTop : f.to;
      _v.set(f.from.x + (to.x - f.from.x) * k, f.from.y + (to.y - f.from.y) * k + Math.sin(k * Math.PI) * 2.2, f.from.z + (to.z - f.from.z) * k);
      _q.setFromEuler(_e.set(k * 6, 0, k * 3));
      _m.compose(_v, _q, _s.set(1, 1, 1));
      sp.push(_m);
    }
    sp.end();

    // ---- arrows
    const ap = this.arrowPool;
    ap.begin();
    for (const p of world.projectiles) {
      const dy = p._py === undefined ? 0 : p.y - p._py;
      p._py = p.y;
      const pitch = -Math.atan2(dy, p.speed * dt);
      _e.set(pitch, p.yaw, 0, 'YXZ');
      _q.setFromEuler(_e);
      const s = p.kind === 'ballista' ? 2.2 : p.kind === 'bolt' ? 1.25 : 1;
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(s, s, s));
      if (p.kind === 'fire') _c.setRGB(2.2, 0.9, 0.2);
      else if (p.from === 'enemy') _c.setRGB(0.55, 0.25, 0.22);
      else _c.setRGB(1, 1, 1);
      ap.push(_m, _c);
      if (p.kind === 'fire' && Math.random() < 0.5) this.spark(p.x, p.y, p.z, 0xff9a2a, 1, 0.2);
    }
    ap.end();

    // ---- particles
    const pp = this.particlePool;
    pp.begin();
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const q = this.particles[i];
      q.life -= dt;
      if (q.life <= 0) { this.particles.splice(i, 1); continue; }
      q.vy -= q.g * dt;
      q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt;
      if (q.y < 0.05) { q.y = 0.05; q.vy *= -0.3; q.vx *= 0.7; q.vz *= 0.7; }
      const s = q.size * Math.min(1, q.life / q.max * 1.6);
      _q.setFromEuler(_e.set(q.life * 5, q.life * 3, 0));
      _m.compose(_v.set(q.x, q.y, q.z), _q, _s.set(s, s, s));
      pp.push(_m, q.color);
    }
    pp.end();

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.t += dt / r.dur;
      if (r.t >= 1) { this.scene.remove(r.mesh); r.mesh.material.dispose(); this.rings.splice(i, 1); continue; }
      const s = r.r * (0.3 + 0.7 * r.t);
      r.mesh.scale.set(s, s, s);
      r.mesh.material.opacity = 0.75 * (1 - r.t);
    }

    // ---- health bars
    this.drawBars(world);

    // ---- objective trail
    const cpv = this.chevronPool;
    cpv.begin();
    const target = view.trail;
    if (target && hero.alive) {
      const dx = target.x - hero.x, dz = target.z - hero.z;
      const d = Math.hypot(dx, dz);
      if (d > 3.5) {
        const ux = dx / d, uz = dz / d;
        const ry = Math.atan2(-ux, -uz);
        const off = (t * 2.2) % 1.6;
        _q.setFromAxisAngle(UP, ry);
        for (let s = 2 + off, i = 0; s < d - 2 && i < 16; s += 1.6, i++) {
          const fade = Math.min(1, (s - 2) / 1.2, (d - 2 - s) / 1.2);
          _m.compose(_v.set(hero.x + ux * s, 0.12, hero.z + uz * s), _q, _s.set(fade, 1, fade));
          cpv.push(_m);
        }
      }
    }
    cpv.end();

    // ---- rings & ghost
    this.heroRing.visible = hero.alive;
    this.heroRing.position.set(hero.x, 0.08, hero.z);
    const sel = view.rangeOf;
    this.rangeRing.visible = !!sel;
    if (sel) { this.rangeRing.position.set(sel.x, 0.1, sel.z); this.rangeRing.scale.setScalar(sel.r); }

    const pl = view.placing;
    this.ghost.visible = !!pl;
    if (pl) {
      const def = BUILDINGS[pl.type];
      this.ghostMesh.geometry = this.geo(`${pl.type}:0`, () => BUILD_GEO[pl.type](0));
      this.ghost.position.set(pl.x, 0, pl.z);
      this.ghostFoot.scale.set(def.size, def.size, 1);
      this.ghostFoot.material.color.set(pl.ok ? 0x4cff7a : 0xff4a4a);
      this.ghostMat.color.set(pl.ok ? 0xffffff : 0xff7a6a);
      this.ghostMat.opacity = 0.45 + Math.sin(t * 5) * 0.12;
    }

    // ---- camera
    this.updateCamera(dt, world, view);
    this.renderer.render(this.scene, this.camera);
  }

  drawBars(world) {
    const bg = this.barBg, fg = this.barFg;
    bg.begin(); fg.begin();
    const camQ = this.camera.quaternion;
    const bar = (x, y, z, f, w, color) => {
      _m.compose(_v.set(x, y, z), camQ, _s.set(w + 0.08, 0.2, 1));
      bg.push(_m, _c.setRGB(0.08, 0.08, 0.1));
      // Shift the fill left inside the bar.
      _m.compose(_v.set(-(1 - f) * w * 0.5, 0, 0.001), _q.identity(), _s.set(w * f, 0.13, 1));
      _m2.compose(_v.set(x, y, z), camQ, _s.set(1, 1, 1)).multiply(_m);
      fg.push(_m2, color);
    };
    const red = new THREE.Color(0xff4a3d), green = new THREE.Color(0x5ee06a), yellow = new THREE.Color(0xffcf3a);
    for (const e of world.enemies) {
      if (e.hp >= e.max || e.name) continue;
      bar(e.x, 2.35 * e.scale * UNIT_S + 0.2, e.z, e.hp / e.max, e.kind === 'brute' ? 1.3 : 0.95, red);
    }
    for (const a of world.allies) if (a.hp < a.max) bar(a.x, 2.4 * UNIT_S, a.z, a.hp / a.max, 0.9, green);
    const h = world.hero;
    if (h.alive && h.hp < world.heroMaxHp) bar(h.x, 3.6 * HERO_S + 0.5, h.z, h.hp / world.heroMaxHp, 1.4, green);
    if (world.gates) for (const g of Object.values(world.gates)) if (g.hp < g.max && g.hp > 0) bar(g.x, 4.6, g.z, g.hp / g.max, 2.4, yellow);
    bg.end(); fg.end();
  }

  updateCamera(dt, world, view) {
    const h = world.hero;
    const fx = h.alive ? h.x : 0, fz = h.alive ? h.z : CASTLE_R + 2;
    const portrait = this.camera.aspect < 1;
    const k = Math.min(1, dt * 5);
    // Look a little ahead of the king so you can see where you are going.
    this.camTarget.x += (fx + h.vx * 0.25 - this.camTarget.x) * k;
    this.camTarget.z += (fz + h.vz * 0.2 - (portrait ? 2.5 : 1) - this.camTarget.z) * k;
    // Fit about 23 m across in portrait, 30 m tall in landscape.
    const tanH = Math.tan((this.camera.fov * Math.PI) / 360);
    const fit = portrait ? 11.5 / (tanH * this.camera.aspect) : 15 / tanH;
    const dist = fit * this.zoom * (view.sheetOpen && portrait ? 1.06 : 1);
    const pitch = 0.98;
    const sx = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    const sz = this.shake > 0 ? (Math.random() - 0.5) * this.shake : 0;
    this.shake = Math.max(0, this.shake - dt * 3);
    // With the bottom sheet open, aim lower so the king stays above it.
    // In landscape the sheet sits on the right, so slide the view the other way.
    const sheetShift = view.sheetOpen && portrait ? dist * 0.13 : 0;
    const sideShift = view.sheetOpen && !portrait ? dist * 0.22 : 0;
    this.camOff = this.camOff || { x: 0, z: 0 };
    this.camOff.x += (sideShift - this.camOff.x) * k;
    this.camOff.z += (sheetShift - this.camOff.z) * k;
    const cx = this.camTarget.x + this.camOff.x + sx, cz = this.camTarget.z + this.camOff.z + sz;
    this.camera.position.set(cx, Math.sin(pitch) * dist, cz + Math.cos(pitch) * dist);
    this.camera.lookAt(cx, 0, cz);
    // Sun follows the view so shadows are crisp where you are looking.
    const tx = Math.round(cx), tz = Math.round(cz);
    this.sun.position.set(tx - 16, 36, tz - 10);
    this.sun.target.position.set(tx, 0, tz);
  }

  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return { x: (_v.x * 0.5 + 0.5) * this.w, y: (-_v.y * 0.5 + 0.5) * this.h, behind: _v.z > 1 };
  }

  // ---------------------------------------------------------------- effects
  spark(x, y, z, color, n = 6, size = 0.18, speed = 3, life = 0.5, g = 12) {
    if (this.particles.length > 850) return;
    const c = new THREE.Color(color);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU;
      const sp = speed * (0.4 + Math.random() * 0.6);
      this.particles.push({
        x, y, z, vx: Math.cos(a) * sp, vz: Math.sin(a) * sp, vy: speed * (0.5 + Math.random()),
        life: life * (0.6 + Math.random() * 0.4), max: life, size: size * (0.6 + Math.random() * 0.6), color: c, g,
      });
    }
  }

  ring(x, z, r, color = 0xffffff, dur = 0.5) {
    const mat = this.ringMat.clone();
    mat.color.set(color);
    const mesh = new THREE.Mesh(this.ringGeo, mat);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(x, 0.15, z);
    this.scene.add(mesh);
    this.rings.push({ mesh, t: 0, dur, r });
  }

  onEvent(ev, world) {
    switch (ev.type) {
      case 'hit':
        this.spark(ev.x, 1.2, ev.z, ev.src === 'melee' ? 0xffffff : 0xffe2a0, 3, 0.14, 2.5, 0.3);
        break;
      case 'kill': {
        const s = ev.scale || 1;
        this.spark(ev.x, 1, ev.z, 0xd8342c, 8 * s, 0.22 * s, 4, 0.6);
        this.spark(ev.x, 0.6, ev.z, 0xe9e2d4, 6 * s, 0.35 * s, 2, 0.6, 2);
        if (ev.boss) { this.ring(ev.x, ev.z, 7, 0xffd84a, 0.8); this.shake = 1.2; }
        break;
      }
      case 'built':
      case 'upgraded':
      case 'placed': {
        const b = world.b[ev.id];
        const r = b ? b.size * 0.8 : 3;
        this.spark(ev.x, 0.4, ev.z, 0xe6d3b0, 18, 0.45, 4, 0.8, 6);
        if (ev.type !== 'placed') { this.spark(ev.x, 2, ev.z, 0xffd84a, 14, 0.18, 6, 0.9); this.ring(ev.x, ev.z, r, 0xffffff, 0.6); }
        break;
      }
      case 'splash': this.ring(ev.x, ev.z, ev.r, 0xff8a2a, 0.35); this.spark(ev.x, 0.8, ev.z, 0xff7a1a, 8, 0.2, 3, 0.5); break;
      case 'slam': this.ring(ev.x, ev.z, ev.r, 0xffffff, 0.45); this.spark(ev.x, 0.3, ev.z, 0xc9b38a, 16, 0.4, 5, 0.7, 8); this.shake = Math.max(this.shake, 0.6); break;
      case 'heroDown': this.spark(ev.x, 1, ev.z, 0xffffff, 24, 0.4, 5, 0.9); this.shake = 1; break;
      case 'gateHit': if (Math.random() < 0.3) this.spark(ev.x, 1.5, ev.z, 0x9a6a41, 3, 0.2, 3, 0.5); break;
      case 'gateBroken': this.spark(ev.x, 1.5, ev.z, 0x9a6a41, 30, 0.35, 6, 1); this.shake = 1; break;
      case 'castleHit': this.shake = Math.max(this.shake, 0.25); break;
      case 'dig': if (Math.random() < 0.4) this.spark(ev.x, 1, ev.z + 1, 0xffd84a, 2, 0.12, 2, 0.4); break;
      case 'villager':
      case 'trained':
      case 'posted': this.spark(ev.x, 1.5, ev.z, 0x9ff0ff, 10, 0.15, 3, 0.7, 4); break;
      case 'spend': {
        const n = Math.min(4, ev.n);
        for (let i = 0; i < n; i++) this.flyers.push({ from: this.stackTop.clone(), to: new THREE.Vector3(ev.x, 0.3, ev.z), t: -i * 0.06, dur: 0.38 });
        break;
      }
      case 'pickup':
        if (ev.from) {
          const m = world.b[ev.from];
          for (let i = 0; i < Math.min(3, ev.n); i++) this.flyers.push({ from: new THREE.Vector3(m.x + 2.3, 1, m.z + 2.5), toHero: true, t: -i * 0.05, dur: 0.3 });
        }
        break;
      case 'waveClear': this.ring(0, CASTLE_R + 2.5, 8, 0xffd84a, 0.9); break;
      default: break;
    }
  }
}

// ------------------------------------------------------------------ helpers
function ribbon(pts, half, y) {
  const pos = [];
  const idx = [];
  for (let i = 0; i < pts.length; i++) {
    const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
    let dx = b[0] - a[0], dz = b[1] - a[1];
    const l = Math.hypot(dx, dz) || 1;
    dx /= l; dz /= l;
    const [x, z] = pts[i];
    pos.push(x - dz * half, y, z + dx * half, x + dz * half, y, z - dx * half);
    if (i > 0) {
      const k = i * 2;
      idx.push(k - 2, k, k - 1, k - 1, k, k + 1);
    }
  }
  // Round caps so the road ends cleanly at the castle.
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  // Make sure normals face up whichever way the strip winds.
  const n = g.attributes.normal;
  for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0);
  return g;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}
