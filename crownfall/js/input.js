// Touch joystick (appears wherever your thumb lands), quick taps to pick
// buildings, two fingers to pan and pinch the camera, a wheel to zoom, and
// WASD / arrow keys on a keyboard.

const RADIUS = 56;
const TAP_MS = 280;
const TAP_PX = 12;

export class Input {
  constructor(stage, joyEl, knobEl) {
    this.stage = stage;
    this.joyEl = joyEl;
    this.knobEl = knobEl;
    this.vec = { x: 0, z: 0 };
    this.stick = null;          // { id, ox, oy, sx, sy, t, moved }
    this.pointers = new Map();
    this.two = null;            // two-finger gesture: { cx, cy, d, zoom }
    this.pan = { x: 0, y: 0 };  // screen pixels dragged since last read
    this.zoom = 1;
    this.keys = new Set();
    this.enabled = true;
    this.onFirstTouch = null;
    this.onTap = null;
    // While placing a building, one finger drags the building instead of steering.
    this.dragMode = false;
    this.onDrag = null;
    this.dragId = null;
    this.mouseDrag = null;
    // In the closer camera views a drag that starts on the right of the
    // screen turns the camera instead of steering.
    this.turnMode = false;
    this.turner = null;
    this.turn = 0;

    stage.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e, true));
    stage.addEventListener('contextmenu', (e) => e.preventDefault());
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.6, Math.min(1.6, this.zoom * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  local(e) {
    const r = this.stage.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  down(e) {
    // Only touches on the 3D view count; buttons and sheets sit above it.
    if (e.target !== this.stage && e.target.id !== 'game') return;
    if (this.onFirstTouch) this.onFirstTouch();
    const p = this.local(e);
    // Desktop: right or middle mouse button drags the camera.
    if (e.pointerType === 'mouse' && e.button !== 0) {
      this.mouseDrag = { id: e.pointerId, x: p.x, y: p.y };
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 2) {
      // Second finger: pan and pinch the camera instead of steering.
      this.release();
      this.two = this.twoState();
      return;
    }
    if (this.pointers.size > 2 || this.stick) return;
    if (this.turnMode && !this.dragMode && p.x > this.stage.clientWidth * 0.6) {
      this.turner = { id: e.pointerId, x: p.x, sx: p.x, sy: p.y, t: performance.now(), moved: false };
      return;
    }
    if (this.dragMode) {
      this.dragId = e.pointerId;
      if (this.onDrag) this.onDrag(p.x, p.y);
      return;
    }
    this.stick = { id: e.pointerId, ox: p.x, oy: p.y, sx: p.x, sy: p.y, t: performance.now(), moved: false };
    if (!this.enabled) return;
    this.joyEl.style.left = `${p.x}px`;
    this.joyEl.style.top = `${p.y}px`;
    this.knobEl.style.transform = 'translate(0,0)';
  }

  twoState() {
    const [a, b] = [...this.pointers.values()];
    return { cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2, d: Math.max(20, Math.hypot(a.x - b.x, a.y - b.y)), zoom: this.zoom };
  }

  move(e) {
    if (this.mouseDrag && e.pointerId === this.mouseDrag.id) {
      const p = this.local(e);
      this.pan.x += p.x - this.mouseDrag.x;
      this.pan.y += p.y - this.mouseDrag.y;
      this.mouseDrag.x = p.x; this.mouseDrag.y = p.y;
      return;
    }
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.local(e);
    if (this.turner && e.pointerId === this.turner.id && !this.two) {
      e.preventDefault();
      if (Math.hypot(p.x - this.turner.sx, p.y - this.turner.sy) > TAP_PX) this.turner.moved = true;
      this.turn += p.x - this.turner.x;
      this.turner.x = p.x;
      this.pointers.set(e.pointerId, p);
      return;
    }
    this.pointers.set(e.pointerId, p);
    if (this.two && this.pointers.size === 2) {
      e.preventDefault();
      const now = this.twoState();
      this.pan.x += now.cx - this.two.cx;
      this.pan.y += now.cy - this.two.cy;
      this.zoom = Math.max(0.6, Math.min(1.6, this.two.zoom * (this.two.d / now.d)));
      this.two.cx = now.cx; this.two.cy = now.cy;
      return;
    }
    if (this.dragMode && e.pointerId === this.dragId && !this.two) {
      e.preventDefault();
      if (this.onDrag) this.onDrag(p.x, p.y);
      return;
    }
    const s = this.stick;
    if (!s || e.pointerId !== s.id) return;
    e.preventDefault();
    if (!s.moved && Math.hypot(p.x - s.sx, p.y - s.sy) > TAP_PX) {
      s.moved = true;
      if (this.enabled) this.joyEl.hidden = false;
    }
    if (!s.moved || !this.enabled) return;
    let dx = p.x - s.ox;
    let dy = p.y - s.oy;
    const d = Math.hypot(dx, dy);
    // Drag past the rim and the base follows your thumb.
    if (d > RADIUS) {
      const k = (d - RADIUS) / d;
      s.ox += dx * k; s.oy += dy * k;
      dx -= dx * k; dy -= dy * k;
      this.joyEl.style.left = `${s.ox}px`;
      this.joyEl.style.top = `${s.oy}px`;
    }
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, Math.hypot(dx, dy) / RADIUS);
    const a = Math.atan2(dy, dx);
    const mag = m < 0.12 ? 0 : m;
    this.vec.x = Math.cos(a) * mag;
    this.vec.z = Math.sin(a) * mag;
  }

  up(e, cancelled = false) {
    if (this.mouseDrag && e.pointerId === this.mouseDrag.id) { this.mouseDrag = null; return; }
    const s = this.stick;
    const wasTwo = !!this.two;
    this.pointers.delete(e.pointerId);
    if (e.pointerId === this.dragId) this.dragId = null;
    if (this.pointers.size < 2) this.two = null;
    if (this.turner && e.pointerId === this.turner.id) {
      const tr = this.turner;
      this.turner = null;
      if (!cancelled && !wasTwo && !tr.moved && performance.now() - tr.t < TAP_MS && this.onTap) this.onTap(tr.sx, tr.sy);
      return;
    }
    if (s && e.pointerId === s.id) {
      const quick = performance.now() - s.t < TAP_MS;
      this.release();
      if (!cancelled && !wasTwo && !s.moved && quick && this.onTap) this.onTap(s.sx, s.sy);
    }
  }

  release() {
    this.stick = null;
    this.turner = null;
    this.vec.x = this.vec.z = 0;
    this.joyEl.hidden = true;
  }

  // Screen pixels the camera was turned since the last call.
  takeTurn() { const t = this.turn; this.turn = 0; return t; }

  // Screen pixels the camera was dragged since the last call.
  takePan() {
    const p = { x: this.pan.x, y: this.pan.y };
    this.pan.x = this.pan.y = 0;
    return p;
  }

  // Combined stick + keyboard direction in world space (x right, z down-screen).
  read() {
    let x = this.vec.x, z = this.vec.z;
    const k = this.keys;
    if (k.has('a') || k.has('arrowleft')) x -= 1;
    if (k.has('d') || k.has('arrowright')) x += 1;
    if (k.has('w') || k.has('arrowup')) z -= 1;
    if (k.has('s') || k.has('arrowdown')) z += 1;
    const m = Math.hypot(x, z);
    if (m > 1) { x /= m; z /= m; }
    if (!this.enabled) return { x: 0, z: 0 };
    return { x, z };
  }
}
