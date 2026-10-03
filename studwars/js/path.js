// Grid A* over the map's walkable cells, then string-pulled into a short list
// of waypoints. When the goal can't be reached it returns a path to the
// closest reachable cell instead.

export class Pathfinder {
  constructor(N, blocked) {
    this.N = N;
    this.blocked = blocked;              // Uint8Array, non-zero = can't walk
    const n = N * N;
    this.g = new Float32Array(n);
    this.from = new Int32Array(n);
    this.stamp = new Uint32Array(n);
    this.closed = new Uint32Array(n);
    this.gen = 0;
    this.heap = new Int32Array(n * 4);
    this.heapF = new Float32Array(n * 4);
  }

  walkable(i, j) {
    return i >= 0 && j >= 0 && i < this.N && j < this.N && !this.blocked[j * this.N + i];
  }

  // Nearest walkable cell to (x, z).
  nearestFree(x, z, maxR = 8) {
    const ci = Math.floor(x), cj = Math.floor(z);
    if (this.walkable(ci, cj)) return [ci, cj];
    let best = null, bd = Infinity;
    for (let r = 1; r <= maxR && !best; r++) {
      for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue;
        const i = ci + di, j = cj + dj;
        if (!this.walkable(i, j)) continue;
        const d = Math.hypot(i + 0.5 - x, j + 0.5 - z);
        if (d < bd) { bd = d; best = [i, j]; }
      }
    }
    return best;
  }

  // goal(i, j) -> true when (i, j) is an acceptable end cell; (hx, hz) steers the search.
  find(sx, sz, goal, hx, hz, maxNodes = 6000) {
    const N = this.N;
    const start = this.nearestFree(sx, sz);
    if (!start) return null;
    const gen = ++this.gen;
    const { g, from, stamp, closed, heap, heapF } = this;
    let hn = 0;
    const push = (k, f) => {
      let c = hn++;
      heap[c] = k; heapF[c] = f;
      while (c > 0) {
        const p = (c - 1) >> 1;
        if (heapF[p] <= heapF[c]) break;
        const tk = heap[p], tf = heapF[p];
        heap[p] = heap[c]; heapF[p] = heapF[c]; heap[c] = tk; heapF[c] = tf;
        c = p;
      }
    };
    const pop = () => {
      const top = heap[0];
      hn--;
      if (hn > 0) {
        heap[0] = heap[hn]; heapF[0] = heapF[hn];
        let c = 0;
        for (;;) {
          const l = c * 2 + 1, r = l + 1;
          let m = c;
          if (l < hn && heapF[l] < heapF[m]) m = l;
          if (r < hn && heapF[r] < heapF[m]) m = r;
          if (m === c) break;
          const tk = heap[m], tf = heapF[m];
          heap[m] = heap[c]; heapF[m] = heapF[c]; heap[c] = tk; heapF[c] = tf;
          c = m;
        }
      }
      return top;
    };
    const h = (i, j) => {
      const dx = Math.abs(i + 0.5 - hx), dz = Math.abs(j + 0.5 - hz);
      return Math.max(dx, dz) + 0.414 * Math.min(dx, dz);
    };

    const sk = start[1] * N + start[0];
    g[sk] = 0; stamp[sk] = gen; from[sk] = -1;
    push(sk, h(start[0], start[1]));
    let best = sk, bestH = h(start[0], start[1]);
    let found = -1, expanded = 0;

    while (hn > 0 && expanded < maxNodes) {
      const k = pop();
      if (closed[k] === gen) continue;
      closed[k] = gen;
      expanded++;
      const i = k % N, j = (k / N) | 0;
      if (goal(i, j)) { found = k; break; }
      const hh = h(i, j);
      if (hh < bestH) { bestH = hh; best = k; }
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ni = i + di, nj = j + dj;
        if (!this.walkable(ni, nj)) continue;
        if (di && dj && (!this.walkable(i + di, j) || !this.walkable(i, j + dj))) continue;
        const nk = nj * N + ni;
        if (closed[nk] === gen) continue;
        const ng = g[k] + (di && dj ? 1.414 : 1);
        if (stamp[nk] !== gen || ng < g[nk]) {
          stamp[nk] = gen; g[nk] = ng; from[nk] = k;
          push(nk, ng + h(ni, nj));
        }
      }
    }

    const end = found >= 0 ? found : best;
    const cells = [];
    for (let k = end; k >= 0; k = from[k]) {
      cells.push(k);
      if (k === sk) break;
    }
    cells.reverse();
    return { points: this.smooth(sx, sz, cells), reached: found >= 0 };
  }

  // Can a unit walk straight from a to b?
  clear(ax, az, bx, bz) {
    const d = Math.hypot(bx - ax, bz - az);
    const n = Math.ceil(d / 0.25);
    const px = -(bz - az) / (d || 1) * 0.3, pz = (bx - ax) / (d || 1) * 0.3;
    for (let s = 1; s <= n; s++) {
      const t = s / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t;
      if (!this.walkable(Math.floor(x + px), Math.floor(z + pz))) return false;
      if (!this.walkable(Math.floor(x - px), Math.floor(z - pz))) return false;
    }
    return true;
  }

  smooth(sx, sz, cells) {
    const N = this.N;
    const pts = cells.map((k) => [(k % N) + 0.5, ((k / N) | 0) + 0.5]);
    if (!pts.length) return [];
    const out = [];
    let cx = sx, cz = sz, i = 0;
    while (i < pts.length) {
      let j = Math.min(pts.length - 1, i + 20);
      while (j > i && !this.clear(cx, cz, pts[j][0], pts[j][1])) j--;
      out.push(pts[j]);
      cx = pts[j][0]; cz = pts[j][1];
      i = j + 1;
    }
    return out;
  }
}
