// Builds a skirmish island. The map is mirrored through its centre so both
// sides get the same land, trees and brick piles.

import { MAP_N } from './config.js';

export const T_GRASS = 0, T_WATER = 1, T_SAND = 2;

export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s >>>= 0; s ^= s >>> 17; s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

// Smooth value noise for coastlines and forests.
function noise2(rand, n) {
  const g = new Float32Array((n + 1) * (n + 1)).map(() => rand());
  return (x, y) => {
    const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
    const a = g[i * (n + 1) + j], b = g[(i + 1) * (n + 1) + j], c = g[i * (n + 1) + j + 1], d = g[(i + 1) * (n + 1) + j + 1];
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    return (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
  };
}

export function generateMap(seed) {
  const N = MAP_N;
  const rand = rng(seed);
  const nz = noise2(rand, 12);
  const nf = noise2(rand, 12);
  const terrain = new Uint8Array(N * N);
  const idx = (i, j) => j * N + i;
  const mirror = (i, j) => [N - 1 - i, N - 1 - j];

  // Player base bottom-left, enemy top-right.
  const bases = [{ x: 13, z: N - 13 }, { x: N - 13, z: 13 }];
  const nearBase = (i, j, r) => bases.some((b) => Math.hypot(i + 0.5 - b.x, j + 0.5 - b.z) < r);
  // A clear road between the bases along the diagonal, with a gentle wiggle.
  const onRoad = (i, j) => {
    const t = ((i - 13) - (N - 13 - j)) / Math.SQRT2; // distance across the diagonal
    const along = ((i - 13) + (N - 13 - j)) / Math.SQRT2;
    const wig = Math.sin(along * 0.12) * 3;
    return Math.abs(t - wig) < 2.6;
  };

  // Island shape: a rounded square with a noisy coast. Generated for the lower
  // half and mirrored.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const [mi, mj] = mirror(i, j);
    if (j < N / 2 || (j === N / 2 && i < N / 2)) continue;
    const dx = Math.abs(i + 0.5 - N / 2) / (N / 2), dz = Math.abs(j + 0.5 - N / 2) / (N / 2);
    const d = Math.pow(Math.pow(dx, 4) + Math.pow(dz, 4), 0.25);
    const coast = 0.86 + (nz(i / N * 12, j / N * 12) - 0.5) * 0.14;
    let t = d > coast ? T_WATER : d > coast - 0.05 ? T_SAND : T_GRASS;
    // Two small ponds on each side of the road.
    for (const [px, pz, r] of [[22, 36, 2.8], [44, 50, 2.6]]) {
      const pd = Math.hypot(i + 0.5 - px, j + 0.5 - pz);
      if (pd < r) t = T_WATER; else if (pd < r + 1 && t === T_GRASS) t = T_SAND;
    }
    if (nearBase(i, j, 7) && t === T_WATER) t = T_GRASS;
    terrain[idx(i, j)] = t;
    terrain[idx(mi, mj)] = t;
  }

  const resources = [];
  const studs = [];
  const taken = new Uint8Array(N * N);
  const free = (i, j) => i > 1 && j > 1 && i < N - 2 && j < N - 2 && terrain[idx(i, j)] === T_GRASS && !taken[idx(i, j)];
  const addPair = (kind, i, j, extra = {}, search = 0) => {
    // Look a little way around for open ground when asked to.
    for (let r = 0; r <= search; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
      if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
      const [a, b] = mirror(i + di, j + dj);
      if (free(i + di, j + dj) && free(a, b)) { i += di; j += dj; r = search + 1; dj = di = 99; }
    }
    const [mi, mj] = mirror(i, j);
    if (!free(i, j) || !free(mi, mj) || (i === mi && j === mj)) return false;
    resources.push({ kind, i, j, ...extra });
    resources.push({ kind, i: mi, j: mj, ...extra });
    taken[idx(i, j)] = taken[idx(mi, mj)] = 1;
    return true;
  };

  // Brick piles: two near each base, then two contested ones in the middle.
  for (const [i, j] of [[5, N - 18], [19, N - 8], [26, 44], [25, 31]]) addPair('ore', i, j, {}, 4);
  // Keep the land around bases and along the road clear before planting trees.
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) if (nearBase(i, j, 6.5) || onRoad(i, j)) taken[idx(i, j)] = 2;
  // Ore needs room around it for builders.
  for (const r of resources) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
    const k = idx(r.i + di, r.j + dj);
    if (!taken[k]) taken[k] = 2;
  }

  // Forests from noise, in the lower half, mirrored.
  for (let j = Math.floor(N / 2); j < N; j++) for (let i = 0; i < N; i++) {
    const f = nf(i / N * 12, j / N * 12);
    const near = Math.hypot(i - bases[0].x, j - bases[0].z);
    const want = f > 0.62 || (near > 7.5 && near < 12 && f > 0.48 && rand() < 0.55);
    if (want && rand() < 0.85) addPair('tree', i, j, { v: rand() < 0.6 ? 0 : 1 });
  }
  // A guaranteed grove next to each base.
  for (let n = 0; n < 40; n++) {
    const a = rand() * Math.PI * 0.6 + Math.PI * 0.95, r = 8 + rand() * 4;
    addPair('tree', Math.floor(bases[0].x + Math.cos(a) * r), Math.floor(bases[0].z + Math.sin(a) * r), { v: rand() < 0.6 ? 0 : 1 });
  }

  // Studs: silver scattered, a few gold, one blue in the very middle.
  for (let n = 0; n < 60; n++) {
    const i = 3 + Math.floor(rand() * (N - 6)), j = Math.floor(N / 2) + Math.floor(rand() * (N / 2 - 3));
    const [mi, mj] = mirror(i, j);
    if (terrain[idx(i, j)] !== T_GRASS || terrain[idx(mi, mj)] !== T_GRASS || taken[idx(i, j)] === 1 || nearBase(i, j, 5)) continue;
    const kind = rand() < 0.15 ? 'gold' : 'silver';
    studs.push({ kind, x: i + 0.5, z: j + 0.5 }, { kind, x: mi + 0.5, z: mj + 0.5 });
  }
  studs.push({ kind: 'blue', x: N / 2, z: N / 2 });

  // Decorations (flowers, small rocks) on open grass.
  const decor = [];
  for (let n = 0; n < 140; n++) {
    const i = Math.floor(rand() * N), j = Math.floor(rand() * N);
    if (terrain[idx(i, j)] !== T_GRASS || taken[idx(i, j)] === 1 || nearBase(i, j, 5) || onRoad(i, j)) continue;
    decor.push({ kind: rand() < 0.7 ? 'flower' : 'rock', x: i + 0.2 + rand() * 0.6, z: j + 0.2 + rand() * 0.6, r: rand() * 6.3 });
  }

  return { N, terrain, resources, studs, bases, decor, onRoad };
}
