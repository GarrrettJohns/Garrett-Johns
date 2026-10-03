// Touch joystick (appears wherever your thumb lands), pinch or wheel to zoom,
// and WASD / arrow keys on a keyboard.

const RADIUS = 56;

export class Input {
  constructor(stage, joyEl, knobEl) {
    this.stage = stage;
    this.joyEl = joyEl;
    this.knobEl = knobEl;
    this.vec = { x: 0, z: 0 };
    this.stick = null;          // { id, ox, oy }
    this.pointers = new Map();
    this.pinch = null;
    this.zoom = 1;
    this.keys = new Set();
    this.enabled = true;
    this.onFirstTouch = null;

    stage.addEventListener('pointerdown', (e) => this.down(e));
    window.addEventListener('pointermove', (e) => this.move(e), { passive: false });
    window.addEventListener('pointerup', (e) => this.up(e));
    window.addEventListener('pointercancel', (e) => this.up(e));
    stage.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.zoom = Math.max(0.65, Math.min(1.5, this.zoom * (1 + Math.sign(e.deltaY) * 0.08)));
    }, { passive: false });
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT') return;
      this.keys.add(e.key.toLowerCase());
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.key.toLowerCase()));
    window.addEventListener('blur', () => { this.keys.clear(); this.release(); });
  }

  down(e) {
    // Only touches on the 3D view steer; buttons and sheets sit above it.
    if (e.target !== this.stage && e.target.id !== 'game') return;
    if (this.onFirstTouch) { this.onFirstTouch(); }
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pointers.size === 2) {
      // Second finger: pinch to zoom instead of steering.
      this.release();
      const [a, b] = [...this.pointers.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), zoom: this.zoom };
      return;
    }
    if (!this.enabled || this.stick) return;
    const r = this.stage.getBoundingClientRect();
    this.stick = { id: e.pointerId, ox: e.clientX - r.left, oy: e.clientY - r.top };
    this.joyEl.style.left = `${this.stick.ox}px`;
    this.joyEl.style.top = `${this.stick.oy}px`;
    this.knobEl.style.transform = 'translate(0,0)';
    this.joyEl.hidden = false;
  }

  move(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (this.pinch && this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      this.zoom = Math.max(0.65, Math.min(1.5, this.pinch.zoom * (this.pinch.d / Math.max(20, d))));
      return;
    }
    if (!this.stick || e.pointerId !== this.stick.id) return;
    e.preventDefault();
    const r = this.stage.getBoundingClientRect();
    let dx = e.clientX - r.left - this.stick.ox;
    let dy = e.clientY - r.top - this.stick.oy;
    const d = Math.hypot(dx, dy);
    // Drag past the rim and the base follows your thumb.
    if (d > RADIUS) {
      const k = (d - RADIUS) / d;
      this.stick.ox += dx * k; this.stick.oy += dy * k;
      dx -= dx * k; dy -= dy * k;
      this.joyEl.style.left = `${this.stick.ox}px`;
      this.joyEl.style.top = `${this.stick.oy}px`;
    }
    this.knobEl.style.transform = `translate(${dx}px, ${dy}px)`;
    const m = Math.min(1, Math.hypot(dx, dy) / RADIUS);
    const a = Math.atan2(dy, dx);
    const mag = m < 0.12 ? 0 : m;
    this.vec.x = Math.cos(a) * mag;
    this.vec.z = Math.sin(a) * mag;
  }

  up(e) {
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinch = null;
    if (this.stick && e.pointerId === this.stick.id) this.release();
  }

  release() {
    this.stick = null;
    this.vec.x = this.vec.z = 0;
    this.joyEl.hidden = true;
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
