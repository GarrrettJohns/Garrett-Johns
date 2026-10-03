// Everything the player sees in 3D. Reads the world each frame and mirrors it:
// terrain built once, figures drawn as instanced rigs, buildings as meshes,
// plus projectiles, flying bricks, studs and fog of war.

import * as THREE from './vendor/three.js';
import {
  C, RIGS, vcMat, treeGeo, oreGeo, stumpGeo, rockGeo, flowerGeo, buildingGeo, scaffoldGeo, studCoinGeo, debrisGeo,
  arrowGeo, ballGeo, studTexture, Builder,
} from './models.js';
import { UNITS, BUILDINGS } from './config.js';
import { T_WATER, T_SAND } from './map.js';

const TAU = Math.PI * 2;
const UNIT_S = 1.25;
const PITCH = 0.98;
const _m = new THREE.Matrix4();
const _m2 = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _e = new THREE.Euler();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const UP = new THREE.Vector3(0, 1, 0);
const ease = (t) => 1 - (1 - t) * (1 - t);

// ------------------------------------------------------------- fog shader
const fow = { map: { value: null }, size: { value: 64 } };
function fogPatch(mat) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.fowMap = fow.map;
    sh.uniforms.fowSize = fow.size;
    sh.vertexShader = 'varying vec2 vFow;\n' + sh.vertexShader.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 fowW = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        fowW = instanceMatrix * fowW;
      #endif
      fowW = modelMatrix * fowW;
      vFow = fowW.xz;`);
    sh.fragmentShader = 'uniform sampler2D fowMap;\nuniform float fowSize;\nvarying vec2 vFow;\n' + sh.fragmentShader.replace('#include <tonemapping_fragment>', `
      float fowV = texture2D(fowMap, vFow / fowSize).r;
      gl_FragColor.rgb *= mix(0.16, 1.0, fowV);
      #include <tonemapping_fragment>`);
  };
  mat.customProgramCacheKey = () => 'fow';
  return mat;
}
const mat = fogPatch(vcMat.clone());

// ------------------------------------------------------------- instanced rig
class RigMesh {
  constructor(scene, parts, cap) {
    this.parts = parts.map((p) => {
      const m = new THREE.InstancedMesh(p.geo, mat, cap);
      m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      scene.add(m);
      return { mesh: m, pivot: new THREE.Vector3(...p.pivot), anim: p.anim };
    });
    this.n = 0;
    this.cap = cap;
  }
  begin() { this.n = 0; }
  // pose: { walk, armR, armL, bob }
  push(baseIn, pose) {
    if (this.n >= this.cap) return;
    const base = this.base || (this.base = new THREE.Matrix4());
    base.copy(baseIn);
    for (const p of this.parts) {
      let rx = 0;
      switch (p.anim) {
        case 'legL': rx = pose.legs; break;
        case 'legR': rx = -pose.legs; break;
        case 'armL': rx = pose.armL; break;
        case 'armR': rx = pose.armR; break;
        case 'hlegA': rx = pose.legs * 0.8; break;
        case 'hlegB': rx = -pose.legs * 0.8; break;
      }
      _q.setFromEuler(_e.set(rx, 0, 0));
      _m2.compose(p.pivot, _q, _s.set(1, 1, 1));
      _m.multiplyMatrices(base, _m2);
      p.mesh.setMatrixAt(this.n, _m);
    }
    this.n++;
  }
  end() {
    for (const p of this.parts) { p.mesh.count = this.n; p.mesh.instanceMatrix.needsUpdate = true; }
  }
}

// A pool of simple instanced things with a per-instance colour.
class Pool {
  constructor(scene, geo, material, cap, shadow = false) {
    this.mesh = new THREE.InstancedMesh(geo, material, cap);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = shadow;
    this.mesh.frustumCulled = false;
    this.mesh.setColorAt(0, _c.set(0xffffff));
    this.mesh.count = 0;
    this.cap = cap;
    scene.add(this.mesh);
  }
  begin() { this.n = 0; }
  push(m, color) {
    if (this.n >= this.cap) return;
    this.mesh.setMatrixAt(this.n, m);
    if (color !== undefined) this.mesh.setColorAt(this.n, _c.set(color));
    this.n++;
  }
  end() {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

const TEAM_BITS = {
  knights: [C.blue, C.silver, C.yellow, C.white],
  pirates: [C.red, C.black, C.white, C.brown],
};

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.r = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.r.shadowMap.enabled = true;
    this.r.shadowMap.type = THREE.PCFShadowMap;
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8fd3f5);
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.5, 300);
    this.cam = { x: 14, z: 46, zoom: 17 };
    this.time = 0;

    const hemi = new THREE.HemisphereLight(0xffffff, 0x8a9a70, 1.9);
    this.scene.add(hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1536, 1536);
    this.sun.shadow.bias = -0.0008;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);

    // Fog-of-war texture.
    this.fogCv = document.createElement('canvas');
    this.fogCtx = this.fogCv.getContext('2d');
    this.fogTex = new THREE.CanvasTexture(this.fogCv);
    this.fogTex.flipY = false;
    fow.map.value = this.fogTex;

    this.fx = [];        // debris and puffs
    this.rings = [];
    this.shake = 0;
    this.resize();
  }

  // ------------------------------------------------------------- setup
  setWorld(w) {
    if (this.root) { this.scene.remove(this.root); this.disposeTree(this.root); }
    this.w = w;
    const root = this.root = new THREE.Group();
    this.scene.add(root);
    const N = w.N;
    fow.size.value = N;
    this.fogCv.width = this.fogCv.height = N;
    this.fogImg = this.fogCtx.createImageData(N, N);
    this.fogCur = new Float32Array(N * N);
    for (let k = 0; k < N * N; k++) this.fogCur[k] = w.vis[k] ? 1 : w.explored[k] ? 0.55 : 0;
    this.drawFog(1);

    root.add(this.buildGround(w));

    // Figures: one rig per unit type that can appear.
    this.rigs = {};
    for (const t of Object.keys(UNITS)) this.rigs[t] = new RigMesh(root, RIGS[t](), 60);

    // Static scenery.
    const trees = w.resources.filter((r) => r.type === 'tree');
    const ores = w.resources.filter((r) => r.type === 'ore');
    this.treeMeshes = [0, 1].map((v) => {
      const m = new THREE.InstancedMesh(treeGeo(v), mat, trees.length + 1);
      m.castShadow = true; m.receiveShadow = true;
      m.count = 0;
      root.add(m);
      return m;
    });
    this.resInst = new Map();
    for (const r of trees) {
      const m = this.treeMeshes[r.v];
      const s = 0.9 + ((r.id * 37) % 10) / 30;
      const rot = ((r.id * 53) % 4) * (Math.PI / 2);
      _m.compose(_v.set(r.x, 0, r.z), _q.setFromAxisAngle(UP, rot), _s.set(s, s, s));
      m.setMatrixAt(m.count, _m);
      this.resInst.set(r.id, { mesh: m, i: m.count, x: r.x, z: r.z, s, rot, shake: 0 });
      m.count++;
    }
    this.oreMesh = new THREE.InstancedMesh(oreGeo(), mat, ores.length + 1);
    this.oreMesh.castShadow = true;
    this.oreMesh.count = 0;
    root.add(this.oreMesh);
    for (const r of ores) {
      const rot = ((r.id * 53) % 6);
      _m.compose(_v.set(r.x, 0, r.z), _q.setFromAxisAngle(UP, rot), _s.set(1.3, 1.3, 1.3));
      this.oreMesh.setMatrixAt(this.oreMesh.count, _m);
      this.resInst.set(r.id, { mesh: this.oreMesh, i: this.oreMesh.count, x: r.x, z: r.z, s: 1.3, rot, shake: 0, ore: true });
      this.oreMesh.count++;
    }
    this.stumps = new THREE.InstancedMesh(stumpGeo(), mat, trees.length + 1);
    this.stumps.count = 0;
    root.add(this.stumps);

    const flowers = w.map.decor.filter((d) => d.kind === 'flower');
    const rocks = w.map.decor.filter((d) => d.kind === 'rock');
    for (const [list, geo, sc] of [[flowers, flowerGeo(), 1.2], [rocks, rockGeo(), 0.6]]) {
      const m = new THREE.InstancedMesh(geo, mat, Math.max(1, list.length));
      list.forEach((d, i) => { _m.compose(_v.set(d.x, 0, d.z), _q.setFromAxisAngle(UP, d.r), _s.set(sc, sc, sc)); m.setMatrixAt(i, _m); });
      m.count = list.length;
      root.add(m);
    }

    // Pools.
    const basic = (o = {}) => new THREE.MeshBasicMaterial({ ...o });
    const lam = fogPatch(new THREE.MeshLambertMaterial({ color: 0xffffff }));
    this.studPool = new Pool(root, studCoinGeo(), lam, 500, true);
    this.debrisPool = new Pool(root, debrisGeo(), lam, 400, true);
    const puffGeo = new THREE.IcosahedronGeometry(0.5, 0);
    this.puffPool = new Pool(root, puffGeo, new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }), 160);
    this.arrowPool = new Pool(root, arrowGeo(), mat, 120);
    this.ballPool = new Pool(root, ballGeo(0.16), mat, 60, true);
    this.shotPool = new Pool(root, ballGeo(0.06), basic({ color: 0x333333 }), 60);
    this.carryPool = new Pool(root, (() => { const b = new Builder(); b.brick(0.36, 0.2, 0.2, 0xffffff); return b.build(); })(), fogPatch(new THREE.MeshLambertMaterial({ vertexColors: true })), 80);

    const ringGeo = new THREE.RingGeometry(0.82, 1, 32);
    ringGeo.rotateX(-Math.PI / 2);
    this.selPool = new Pool(root, ringGeo, basic({ transparent: true, opacity: 0.9, depthWrite: false }), 120);
    const sq = new THREE.RingGeometry(0.9, 1, 4, 1);
    sq.rotateZ(Math.PI / 4);
    sq.rotateX(-Math.PI / 2);
    this.selSqPool = new Pool(root, sq, basic({ transparent: true, opacity: 0.9, depthWrite: false }), 30);
    const bar = new THREE.PlaneGeometry(1, 1);
    this.barBg = new Pool(root, bar, basic({ depthTest: false, transparent: true }), 160);
    this.barFg = new Pool(root, bar, basic({ depthTest: false, transparent: true }), 160);
    this.barBg.mesh.renderOrder = 10;
    this.barFg.mesh.renderOrder = 11;

    // Buildings come and go.
    this.bmesh = new Map();
    this.scaffolds = {};

    // Placement ghost.
    this.ghostMat = new THREE.MeshLambertMaterial({ vertexColors: true, transparent: true, opacity: 0.6 });
    this.ghost = new THREE.Mesh(new THREE.BufferGeometry(), this.ghostMat);
    this.ghost.visible = false;
    root.add(this.ghost);
    this.ghostPad = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x66ff66, transparent: true, opacity: 0.35, depthWrite: false }));
    this.ghostPad.visible = false;
    root.add(this.ghostPad);
    this.ghostType = null;

    // Rally flag.
    const fb = new Builder();
    fb.cyl(0.04, 0.04, 1.3, 6, C.brownD);
    fb.box(0.04, 0.35, 0.5, C.green, { y: 0.9, z: 0.25 });
    this.rallyFlag = new THREE.Mesh(fb.build(), vcMat);
    this.rallyFlag.visible = false;
    root.add(this.rallyFlag);

    // Order marker / special rings.
    for (let i = 0; i < 8; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false }));
      m.visible = false;
      root.add(m);
      this.rings.push({ m, t: 1, dur: 1, r0: 0.3, r1: 1 });
    }

    this.fx = [];
    this.cam.x = w.map.bases[0].x + 2;
    this.cam.z = w.map.bases[0].z - 3;
  }

  disposeTree(o) {
    o.traverse((c) => {
      if (c.isMesh && c.geometry && !this.keepGeo?.has(c.geometry)) c.geometry.dispose?.();
    });
  }

  buildGround(w) {
    const N = w.N;
    const terr = w.map.terrain;
    const pos = [], clr = [], uv = [];
    const cols = { 0: [C.grass, C.grassB], 1: [C.water, C.waterB], 2: [C.sand, C.sandB] };
    const WY = -0.35;
    const quad = (x0, z0, x1, z1, y, color, flat) => {
      const v = [[x0, z0], [x0, z1], [x1, z1], [x0, z0], [x1, z1], [x1, z0]];
      col3(color);
      for (const [x, z] of v) {
        pos.push(x, y, z);
        clr.push(_c.r, _c.g, _c.b);
        if (flat) uv.push(0.06, 0.94);
        else uv.push(x * 2, z * 2);
      }
    };
    const col3 = (h) => _c.set(h);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const t = terr[j * N + i];
      const pick = cols[t][(i + j) % 2 === 0 ? 0 : 1];
      if (t === T_WATER) quad(i, j, i + 1, j + 1, WY, pick, true);
      else quad(i, j, i + 1, j + 1, 0, pick, false);
    }
    // Skirts where land meets water, so the land reads as a raised baseplate.
    const isW = (i, j) => i < 0 || j < 0 || i >= N || j >= N || terr[j * N + i] === T_WATER;
    const side = (ax, az, bx, bz, color) => {
      col3(color);
      const v = [[ax, 0, az], [bx, WY, bz], [bx, 0, bz], [ax, 0, az], [ax, WY, az], [bx, WY, bz]];
      for (const [x, y, z] of v) { pos.push(x, y, z); clr.push(_c.r, _c.g, _c.b); uv.push(0.06, 0.94); }
    };
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      if (isW(i, j)) continue;
      const sc = terr[j * N + i] === T_SAND ? C.tanD : 0x3f8a2c;
      if (isW(i, j + 1)) side(i, j + 1, i + 1, j + 1, sc);
      if (isW(i, j - 1)) side(i + 1, j, i, j, sc);
      if (isW(i + 1, j)) side(i + 1, j + 1, i + 1, j, sc);
      if (isW(i - 1, j)) side(i, j, i, j + 1, sc);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(clr, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    const tex = studTexture();
    tex.anisotropy = Math.min(8, this.r.capabilities.getMaxAnisotropy());
    const gm = fogPatch(new THREE.MeshLambertMaterial({ vertexColors: true, map: tex }));
    const ground = new THREE.Mesh(g, gm);
    ground.receiveShadow = true;
    const grp = new THREE.Group();
    grp.add(ground);
    // Open sea beyond the map.
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(N * 5, N * 5).rotateX(-Math.PI / 2), fogPatch(new THREE.MeshLambertMaterial({ color: C.waterB })));
    sea.position.set(N / 2, WY - 0.01, N / 2);
    grp.add(sea);
    return grp;
  }

  // ------------------------------------------------------------- camera
  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.W = Math.max(1, r.width); this.H = Math.max(1, r.height);
    this.r.setSize(this.W, this.H, false);
    this.camera.aspect = this.W / this.H;
    // Wider field of view on tall phones so the battlefield doesn't feel cramped.
    this.camera.fov = this.camera.aspect < 0.8 ? 50 : 42;
    this.camera.updateProjectionMatrix();
  }

  clampCam() {
    if (!this.w) return;
    const N = this.w.N;
    this.cam.zoom = Math.max(9, Math.min(40, this.cam.zoom));
    this.cam.x = Math.max(2, Math.min(N - 2, this.cam.x));
    this.cam.z = Math.max(2, Math.min(N + 2, this.cam.z));
  }

  pan(dx, dy) {
    // Pixels to world units at the focus point.
    const k = (2 * Math.tan((this.camera.fov * Math.PI) / 360) * this.cam.zoom) / this.H;
    this.cam.x -= dx * k;
    this.cam.z -= (dy * k) / Math.sin(PITCH);
    this.clampCam();
  }

  zoomAt(f, px, py) {
    const a = this.screenToGround(px, py);
    this.cam.zoom *= f;
    this.clampCam();
    this.placeCamera();
    const b = this.screenToGround(px, py);
    if (a && b) { this.cam.x += a.x - b.x; this.cam.z += a.z - b.z; }
    this.clampCam();
  }

  placeCamera() {
    const { x, z, zoom } = this.cam;
    let sx = 0, sz = 0;
    if (this.shake > 0) { sx = (Math.random() - 0.5) * this.shake; sz = (Math.random() - 0.5) * this.shake; }
    this.camera.position.set(x + sx, Math.sin(PITCH) * zoom, z + Math.cos(PITCH) * zoom + sz);
    this.camera.lookAt(x + sx, 0, z + sz);
    this.camera.updateMatrixWorld();
  }

  screenToGround(px, py) {
    const ndc = _v.set((px / this.W) * 2 - 1, -(py / this.H) * 2 + 1, 0.5).unproject(this.camera);
    const o = this.camera.position;
    const dx = ndc.x - o.x, dy = ndc.y - o.y, dz = ndc.z - o.z;
    if (dy >= 0) return null;
    const t = -o.y / dy;
    return { x: o.x + dx * t, z: o.z + dz * t };
  }

  project(x, y, z) {
    _v.set(x, y, z).project(this.camera);
    return { x: (_v.x + 1) * 0.5 * this.W, y: (1 - _v.y) * 0.5 * this.H, behind: _v.z > 1 };
  }

  // Ground corners of the view, for the minimap.
  viewQuad() {
    return [[0, 0], [this.W, 0], [this.W, this.H], [0, this.H]].map(([x, y]) => this.screenToGround(x, y) || { x: this.cam.x, z: this.cam.z - 40 });
  }

  // ------------------------------------------------------------- fog
  drawFog(k) {
    const w = this.w, N = w.N, d = this.fogImg.data;
    for (let i = 0; i < N * N; i++) {
      const target = w.vis[i] ? 1 : w.explored[i] ? 0.55 : 0;
      this.fogCur[i] += (target - this.fogCur[i]) * k;
      const v = this.fogCur[i] * 255;
      d[i * 4] = d[i * 4 + 1] = d[i * 4 + 2] = v;
      d[i * 4 + 3] = 255;
    }
    this.fogCtx.putImageData(this.fogImg, 0, 0);
    this.fogTex.needsUpdate = true;
  }

  // ------------------------------------------------------------- events
  handle(ev) {
    const w = this.w;
    switch (ev.type) {
      case 'die': {
        if (!w.isVisible(ev.x, ev.z) && ev.team !== 0) break;
        const bits = TEAM_BITS[w.teams[ev.team].faction];
        for (let i = 0; i < (ev.hero ? 18 : 10); i++) this.debris(ev.x, 0.6, ev.z, [...bits, C.yellow][i % 5], 4);
        this.puff(ev.x, 0.4, ev.z, 0xffffff, 3);
        break;
      }
      case 'collapse': {
        const bits = ev.team === 0 ? [C.stone, C.blue, C.stoneD, C.brown] : [C.plank, C.red, C.black, C.plankD];
        for (let i = 0; i < 50; i++) this.debris(ev.x + (Math.random() - 0.5) * ev.size, 0.5 + Math.random() * 2, ev.z + (Math.random() - 0.5) * ev.size, bits[i % 4], 6);
        this.puff(ev.x, 0.5, ev.z, 0xd8d0c0, 12, ev.size);
        if (w.isVisible(ev.x, ev.z)) this.shake = 0.5;
        break;
      }
      case 'chop': {
        const inst = this.resInst.get(w.cellEnt[w.idx(Math.floor(ev.x), Math.floor(ev.z))]);
        if (inst) inst.shake = 0.3;
        if (w.isVisible(ev.x, ev.z)) this.debris(ev.x, 0.8, ev.z, ev.kind === 'tree' ? C.leaf : [C.gold, C.red, C.blue][Math.floor(Math.random() * 3)], 2.5, 0.6);
        break;
      }
      case 'resGone': {
        const inst = this.resInst.get(ev.id);
        if (inst) {
          _m.compose(_v.set(0, -50, 0), _q.identity(), _s.set(0.001, 0.001, 0.001));
          inst.mesh.setMatrixAt(inst.i, _m);
          inst.mesh.instanceMatrix.needsUpdate = true;
          this.resInst.delete(ev.id);
          if (!inst.ore) {
            _m.compose(_v.set(inst.x, 0, inst.z), _q.identity(), _s.set(1, 1, 1));
            this.stumps.setMatrixAt(this.stumps.count++, _m);
            this.stumps.instanceMatrix.needsUpdate = true;
          }
          for (let i = 0; i < 6; i++) this.debris(ev.x, 0.8, ev.z, ev.kind === 'tree' ? [C.leaf, C.leafD, C.brown][i % 3] : C.stone, 3);
        }
        break;
      }
      case 'hammer':
        if (w.isVisible(ev.x, ev.z)) this.debris(ev.x + (Math.random() - 0.5), 1 + Math.random(), ev.z + (Math.random() - 0.5), [C.red, C.yellow, C.blue, C.white][Math.floor(Math.random() * 4)], 2, 0.5);
        break;
      case 'built':
        this.puff(ev.x, 0.3, ev.z, 0xffffff, 8, 1.5);
        break;
      case 'place':
        this.puff(ev.x, 0.2, ev.z, 0xe8dcc0, 5, 1);
        break;
      case 'boom':
        if (w.isVisible(ev.x, ev.z) || true) {
          this.puff(ev.x, 0.3, ev.z, 0x6a6a6a, ev.big ? 6 : 3, ev.big ? 1.2 : 0.6);
          this.puff(ev.x, 0.3, ev.z, 0xffb347, 2, 0.4);
          if (ev.big && w.isVisible(ev.x, ev.z)) this.shake = Math.max(this.shake, 0.25);
        }
        break;
      case 'shoot':
        if (ev.kind === 'shot' && w.isVisible(ev.x, ev.z)) this.puff(ev.x, 0.9, ev.z, 0xeeeeee, 1, 0.3);
        break;
      case 'hit':
        if (ev.melee && w.isVisible(ev.x, ev.z)) this.debris(ev.x, 0.8, ev.z, 0xffffff, 2, 0.4);
        break;
      case 'order':
        if (ev.team === 0) this.ring(ev.x, ev.z, ev.kind === 'attack' ? 0xff4a3a : ev.kind === 'gather' || ev.kind === 'build' ? 0xffd23a : 0x7dff6a, 0.2, 1.1, 0.5);
        break;
      case 'rally':
        this.ring(ev.x, ev.z, 0xffd23a, 0.5, 7, 0.9);
        this.ring(ev.x, ev.z, 0xffffff, 0.3, 5, 0.7);
        break;
      case 'broadside':
        this.ring(ev.x, ev.z, 0xff4a3a, 4, 0.5, 1.4);
        break;
      case 'stud':
        this.puff(ev.x, 0.3, ev.z, 0xffffff, 1, 0.3);
        break;
    }
  }

  debris(x, y, z, color, sp = 3, life = 1.2) {
    if (this.fx.length > 380) return;
    const a = Math.random() * TAU;
    const s = sp * (0.4 + Math.random() * 0.6);
    this.fx.push({ kind: 'd', x, y, z, vx: Math.cos(a) * s, vz: Math.sin(a) * s, vy: 3 + Math.random() * sp, rx: Math.random() * TAU, ry: Math.random() * TAU, spin: (Math.random() - 0.5) * 14, t: 0, life: life + Math.random() * 0.8, color });
  }

  puff(x, y, z, color, n = 3, spread = 0.6) {
    for (let i = 0; i < n; i++) {
      if (this.fx.length > 380) return;
      this.fx.push({ kind: 'p', x: x + (Math.random() - 0.5) * spread, y, z: z + (Math.random() - 0.5) * spread, vx: (Math.random() - 0.5), vz: (Math.random() - 0.5), vy: 1 + Math.random(), t: 0, life: 0.7 + Math.random() * 0.5, color, s: 0.4 + Math.random() * 0.5 * spread });
    }
  }

  ring(x, z, color, r0, r1, dur) {
    const r = this.rings.find((q) => q.t >= q.dur) || this.rings[0];
    Object.assign(r, { x, z, r0, r1, dur, t: 0 });
    r.m.material.color.set(color);
    r.m.visible = true;
  }

  // ------------------------------------------------------------- ghost
  setGhost(type, faction, x, z, ok) {
    if (!type) { this.ghost.visible = false; this.ghostPad.visible = false; this.ghostType = null; return; }
    if (this.ghostType !== faction + type) {
      this.ghost.geometry = buildingGeo(faction, type);
      this.ghostType = faction + type;
    }
    const size = BUILDINGS[type].size;
    this.ghost.visible = true;
    this.ghost.position.set(x, 0.02, z);
    this.ghostMat.color.set(ok ? 0xbbffbb : 0xff9a9a);
    this.ghostPad.visible = true;
    this.ghostPad.position.set(x, 0.03, z);
    this.ghostPad.scale.set(size + 0.2, 1, size + 0.2);
    this.ghostPad.material.color.set(ok ? 0x66ff66 : 0xff4444);
  }

  // ------------------------------------------------------------- frame
  frame(dt, view) {
    const w = this.w;
    this.time += dt;
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.2);
    this.placeCamera();

    // Light follows the view so shadows stay crisp where you look.
    const span = this.cam.zoom * 1.4;
    this.sun.position.set(this.cam.x - 10, 22, this.cam.z - 4 + 8);
    this.sun.target.position.set(this.cam.x, 0, this.cam.z - 3);
    const sc = this.sun.shadow.camera;
    if (sc.right !== span) { sc.left = -span; sc.right = span; sc.top = span; sc.bottom = -span; sc.near = 1; sc.far = 70; sc.updateProjectionMatrix(); }

    if ((this.fogT = (this.fogT || 0) - dt) <= 0) { this.fogT = 1 / 30; this.drawFog(Math.min(1, dt * 30 * 0.18)); }

    for (const ev of view.events) this.handle(ev);

    this.drawUnits(w, view);
    this.drawBuildings(w, view);
    this.drawResources(dt);
    this.drawProjectiles(w);
    this.drawStuds(w);
    this.drawFx(dt);
    this.drawRings(dt);

    // Rally flag of the selected building.
    const b = view.selBuilding;
    if (b && b.rally && b.team === 0) { this.rallyFlag.visible = true; this.rallyFlag.position.set(b.rally.x, 0, b.rally.z); }
    else this.rallyFlag.visible = false;

    this.r.render(this.scene, this.camera);
  }

  drawUnits(w, view) {
    for (const k in this.rigs) this.rigs[k].begin();
    this.selPool.begin(); this.selSqPool.begin(); this.barBg.begin(); this.barFg.begin(); this.carryPool.begin();
    const camQ = this.camera.quaternion;
    const right = _v.set(1, 0, 0).applyQuaternion(camQ).clone();
    const t = this.time;
    for (const u of w.units) {
      if (u.dead) continue;
      if (u.team !== 0 && !w.isVisible(u.x, u.z)) continue;
      const rig = this.rigs[u.type];
      const pose = { legs: 0, armL: 0, armR: 0 };
      const ranged = !!u.def.proj;
      if (u.moving) {
        const s = Math.sin(u.walkPh);
        pose.legs = s * 0.7; pose.armL = s * 0.6; pose.armR = -s * 0.6;
      }
      if (u.working) {
        const k = (t % 0.55) / 0.55;
        pose.armR = -2.3 * (1 - ease(k)) - 0.2;
      } else if (u.animT < 0.4 && !ranged) {
        pose.armR = -2.6 * (1 - ease(u.animT / 0.4)) - 0.1;
      } else if (ranged && (u.animT < 1.2 || (u.engage && !u.moving))) {
        pose.armR = -1.5; pose.armL = u.type === 'kArcher' ? -1.5 : -1.3;
        if (u.animT < 0.15) pose.armR = -1.3;
      }
      if (u.carry && !u.working) pose.armL = pose.armR = -2.9;
      const bob = u.moving ? Math.abs(Math.sin(u.walkPh)) * 0.05 : 0;
      const s = UNIT_S * (u.def.role === 'hero' ? 1.15 : 1);
      _q.setFromAxisAngle(UP, u.face);
      _m.compose(_v.set(u.x, bob, u.z), _q, _s.set(s, s, s));
      rig.push(_m, pose);
      if (u.carry && !u.working) {
        _m2.compose(_v.set(u.x, 1.62 * s + bob, u.z), _q, _s.set(1.2, 1.2, 1.2));
        this.carryPool.push(_m2, u.carryKind === 'ore' ? C.gold : C.red);
      }
      const sel = view.sel.has(u.id);
      if (sel || view.hover === u.id) {
        const rr = u.def.r * 1.5 + 0.1;
        _m2.compose(_v.set(u.x, 0.05, u.z), _q.identity(), _s.set(rr, 1, rr));
        this.selPool.push(_m2, u.team === 0 ? 0x7dff6a : 0xff4a3a);
      }
      if (sel || u.hp < u.maxHp || u.def.role === 'hero') this.bar(u.x, (u.def.r > 0.45 ? 2.1 : 1.85) * s / UNIT_S, u.z, u.def.role === 'hero' ? 1.0 : 0.7, u.hp / u.maxHp, u.team, right, u.buffT > 0);
    }
    for (const k in this.rigs) this.rigs[k].end();
    this.carryPool.end();
  }

  bar(x, y, z, wdt, f, team, right, buff) {
    const h = 0.11;
    _q.copy(this.camera.quaternion);
    _m.compose(_v.set(x, y, z), _q, _s.set(wdt + 0.06, h + 0.06, 1));
    this.barBg.push(_m, 0x1a1a1a);
    f = Math.max(0, Math.min(1, f));
    const off = -(1 - f) * wdt * 0.5;
    _m.compose(_v.set(x + right.x * off, y + right.y * off, z + right.z * off), _q, _s.set(Math.max(0.001, wdt * f), h, 1));
    const color = team === 0 ? (buff ? 0xffd23a : f > 0.35 ? 0x5cdc4a : 0xf0b030) : f > 0.35 ? 0xe8463a : 0xff8a3a;
    this.barFg.push(_m, color);
  }

  drawBuildings(w, view) {
    const seen = new Set();
    const right = _v.set(1, 0, 0).applyQuaternion(this.camera.quaternion).clone();
    for (const b of w.buildings) {
      if (b.dead) continue;
      if (b.team !== 0 && !b.seen) continue;
      seen.add(b.id);
      let g = this.bmesh.get(b.id);
      if (!g) {
        g = new THREE.Group();
        const m = new THREE.Mesh(buildingGeo(b.faction, b.type), mat);
        m.castShadow = true; m.receiveShadow = true;
        g.add(m);
        if (!this.scaffolds[b.size]) this.scaffolds[b.size] = scaffoldGeo(b.size);
        const sc = new THREE.Mesh(this.scaffolds[b.size], mat);
        sc.castShadow = true;
        g.add(sc);
        g.userData = { m, sc, hitT: 0, smokeT: 0 };
        g.position.set(b.x, 0, b.z);
        this.root.add(g);
        this.bmesh.set(b.id, g);
      }
      const { m, sc } = g.userData;
      const k = b.done ? 1 : 0.08 + 0.92 * ease(b.built);
      m.scale.set(1, k, 1);
      sc.visible = !b.done;
      // Wobble when hit.
      const since = w.time - b.lastHit;
      const wob = since < 0.25 ? Math.sin(since * 60) * 0.04 * (1 - since / 0.25) : 0;
      m.position.x = wob;
      // Smoke when badly hurt.
      if (b.done && b.hp < b.maxHp * 0.5 && (g.userData.smokeT -= 1 / 60) <= 0) {
        g.userData.smokeT = 0.25 + (b.hp / b.maxHp) * 0.6;
        this.puff(b.x + (Math.random() - 0.5) * b.size * 0.6, 1.5 + Math.random(), b.z + (Math.random() - 0.5) * b.size * 0.6, 0x555555, 1, 0.3);
      }
      const sel = view.selBuilding === b;
      if (sel) {
        _m.compose(_v.set(b.x, 0.06, b.z), _q.identity(), _s.set(b.size * 0.75, 1, b.size * 0.75));
        this.selSqPool.push(_m, b.team === 0 ? 0x7dff6a : 0xff4a3a);
      }
      const top = { keep: 5.2, tower: 4.3, barracks: 3.3, farm: 2.0, depot: 2.0 }[b.type] * (b.done ? 1 : k);
      if (!b.done) this.barProgress(b.x, top + 0.5, b.z, b.size * 0.5, b.built, right);
      else if (sel || b.hp < b.maxHp) this.bar(b.x, top + 0.4, b.z, b.size * 0.45, b.hp / b.maxHp, b.team, right);
      if (b.done && b.queue.length && b.team === 0) this.barProgress(b.x, top + 0.75, b.z, b.size * 0.35, b.prodT / UNITS[b.queue[0]].time, right, 0x5ab4ff);
    }
    for (const [id, g] of this.bmesh) {
      if (!seen.has(id)) { this.root.remove(g); this.bmesh.delete(id); }
    }
    this.selPool.end(); this.selSqPool.end(); this.barBg.end(); this.barFg.end();
  }

  barProgress(x, y, z, wdt, f, right, color = 0xffd23a) {
    _q.copy(this.camera.quaternion);
    _m.compose(_v.set(x, y, z), _q, _s.set(wdt + 0.06, 0.15, 1));
    this.barBg.push(_m, 0x1a1a1a);
    f = Math.max(0, Math.min(1, f));
    const off = -(1 - f) * wdt * 0.5;
    _m.compose(_v.set(x + right.x * off, y + right.y * off, z + right.z * off), _q, _s.set(Math.max(0.001, wdt * f), 0.09, 1));
    this.barFg.push(_m, color);
  }

  drawResources(dt) {
    for (const [id, inst] of this.resInst) {
      const r = this.w.ents.get(id);
      if (inst.ore && r) {
        const f = 0.55 + 0.45 * (r.amount / r.max);
        if (inst.lastF !== f) {
          inst.lastF = f;
          _m.compose(_v.set(inst.x, 0, inst.z), _q.setFromAxisAngle(UP, inst.rot), _s.set(inst.s * f, inst.s * f, inst.s * f));
          inst.mesh.setMatrixAt(inst.i, _m);
          inst.mesh.instanceMatrix.needsUpdate = true;
        }
      }
      if (inst.shake > 0) {
        inst.shake -= dt;
        const a = inst.shake > 0 ? Math.sin(inst.shake * 50) * 0.08 * inst.shake / 0.3 : 0;
        _q.setFromEuler(_e.set(a, inst.rot, a * 0.5));
        _m.compose(_v.set(inst.x, 0, inst.z), _q, _s.set(inst.s, inst.s, inst.s));
        if (!inst.ore) { inst.mesh.setMatrixAt(inst.i, _m); inst.mesh.instanceMatrix.needsUpdate = true; }
      }
    }
  }

  drawProjectiles(w) {
    this.arrowPool.begin(); this.ballPool.begin(); this.shotPool.begin();
    for (const p of w.proj) {
      if (p.t < 0 || p.px === undefined) continue;
      if (!w.isVisible(p.x, p.z) && p.team !== 0) continue;
      const dx = p.x - p.px, dy = p.y - p.py, dz = p.z - p.pz;
      _q.setFromEuler(_e.set(-Math.atan2(dy, Math.hypot(dx, dz)), Math.atan2(dx, dz), 0, 'YXZ'));
      _m.compose(_v.set(p.x, p.y, p.z), _q, _s.set(1, 1, 1));
      if (p.kind === 'arrow') this.arrowPool.push(_m);
      else if (p.kind === 'ball') this.ballPool.push(_m);
      else this.shotPool.push(_m);
    }
    this.arrowPool.end(); this.ballPool.end(); this.shotPool.end();
  }

  drawStuds(w) {
    this.studPool.begin();
    const t = this.time;
    for (const s of w.studs) {
      if (!w.isExplored(s.x, s.z)) continue;
      const y = s.y + 0.25 + (s.y === 0 ? Math.sin(t * 3 + s.id) * 0.06 : 0);
      _q.setFromEuler(_e.set(Math.PI / 2 - 0.3, t * 2.5 + s.id, 0, 'YXZ'));
      const sc = s.kind === 'blue' ? 1.7 : s.kind === 'gold' ? 1.3 : 1;
      _m.compose(_v.set(s.x, y, s.z), _q, _s.set(sc, sc, sc));
      if (s.dropped && s.age > 38 && Math.floor(t * 8) % 2) continue;
      this.studPool.push(_m, s.kind === 'blue' ? 0x3a8cff : s.kind === 'gold' ? 0xf2c230 : 0xd8dce2);
    }
    this.studPool.end();
  }

  drawFx(dt) {
    this.debrisPool.begin(); this.puffPool.begin();
    for (const f of this.fx) {
      f.t += dt;
      if (f.kind === 'd') {
        f.vy -= 16 * dt;
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        if (f.y < 0.07) { f.y = 0.07; f.vy *= -0.3; f.vx *= 0.6; f.vz *= 0.6; f.spin *= 0.5; }
        f.rx += f.spin * dt; f.ry += f.spin * 0.7 * dt;
        const s = f.t > f.life - 0.3 ? Math.max(0.01, (f.life - f.t) / 0.3) : 1;
        _q.setFromEuler(_e.set(f.rx, f.ry, 0));
        _m.compose(_v.set(f.x, f.y, f.z), _q, _s.set(s, s, s));
        this.debrisPool.push(_m, f.color);
      } else {
        f.x += f.vx * dt; f.y += f.vy * dt; f.z += f.vz * dt;
        const k = f.t / f.life;
        const s = f.s * (0.6 + k * 1.2) * (1 - k * k);
        _m.compose(_v.set(f.x, f.y, f.z), _q.identity(), _s.set(s, s, s));
        this.puffPool.push(_m, f.color);
      }
    }
    this.fx = this.fx.filter((f) => f.t < f.life);
    this.debrisPool.end(); this.puffPool.end();
  }

  drawRings(dt) {
    for (const r of this.rings) {
      if (r.t >= r.dur) { r.m.visible = false; continue; }
      r.t += dt;
      const k = Math.min(1, r.t / r.dur);
      const s = r.r0 + (r.r1 - r.r0) * ease(k);
      r.m.position.set(r.x, 0.08, r.z);
      r.m.scale.set(s, 1, s);
      r.m.material.opacity = 0.9 * (1 - k);
    }
  }

  // Unit and building pictures for the UI, rendered once from the real models.
  static portraits() {
    const out = {};
    const S = 112;
    let r;
    try {
      const cv = document.createElement('canvas');
      cv.width = cv.height = S;
      r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.outputColorSpace = THREE.SRGBColorSpace;
      r.setSize(S, S, false);
      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x8a9a70, 2.2));
      const sun = new THREE.DirectionalLight(0xffffff, 2.2);
      sun.position.set(3, 5, 4);
      scene.add(sun);
      const cam = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
      const shoot = (obj, h, dist) => {
        scene.add(obj);
        cam.position.set(dist * 0.55, h * 0.75 + dist * 0.35, dist);
        cam.lookAt(0, h * 0.48, 0);
        r.setClearColor(0x000000, 0);
        r.render(scene, cam);
        scene.remove(obj);
        return cv.toDataURL();
      };
      for (const type of Object.keys(UNITS)) {
        const g = new THREE.Group();
        for (const p of RIGS[type]()) {
          const m = new THREE.Mesh(p.geo, vcMat);
          m.position.set(...p.pivot);
          if (p.anim === 'armR' && UNITS[type].role !== 'builder') m.rotation.x = -0.5;
          g.add(m);
        }
        g.rotation.y = 0.25;
        const big = UNITS[type].r > 0.45;
        out[type] = shoot(g, big ? 1.7 : 1.4, big ? 5.2 : 4.0);
      }
      for (const f of ['knights', 'pirates']) for (const type of Object.keys(BUILDINGS)) {
        const m = new THREE.Mesh(buildingGeo(f, type), vcMat);
        m.rotation.y = -0.35;
        const s = BUILDINGS[type].size;
        const h = { keep: 5.2, tower: 4.3, barracks: 3.2, farm: 1.9, depot: 1.9 }[type];
        out[f + ':' + type] = shoot(m, h, Math.max(s, h) * 2.4 + 1);
      }
    } catch (e) { /* no pictures, emoji fallbacks are used */ }
    if (r) { r.dispose(); r.forceContextLoss?.(); }
    return out;
  }
}
