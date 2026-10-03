// Touch and mouse gestures on the battlefield, turned into a few callbacks:
// tap, double tap, pan, pinch zoom and box select (long-press then drag, or
// shift-drag / right-drag with a mouse).

export class Input {
  constructor(el, cb) {
    this.el = el;
    this.cb = cb;
    this.pts = new Map();
    this.mode = null;          // null | 'tap' | 'pan' | 'pinch' | 'box'
    this.lastTap = { t: 0, x: 0, y: 0 };
    this.boxMode = false;      // the on-screen box-select toggle

    el.addEventListener('pointerdown', (e) => this.down(e));
    el.addEventListener('pointermove', (e) => this.move(e));
    el.addEventListener('pointerup', (e) => this.up(e));
    el.addEventListener('pointercancel', (e) => this.up(e, true));
    el.addEventListener('contextmenu', (e) => e.preventDefault());
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      cb.zoom(Math.exp(e.deltaY * 0.0015), e.clientX - r.left, e.clientY - r.top);
    }, { passive: false });
  }

  pos(e) {
    const r = this.el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  down(e) {
    this.el.setPointerCapture?.(e.pointerId);
    const p = this.pos(e);
    this.pts.set(e.pointerId, { ...p, sx: p.x, sy: p.y, t: performance.now() });
    this.cb.touch?.();
    if (this.pts.size === 1) {
      this.mode = 'tap';
      this.start = { ...p, t: performance.now() };
      const boxy = this.boxMode || e.shiftKey || e.button === 2;
      if (boxy) { this.mode = 'box'; this.cb.boxStart(p.x, p.y); }
      clearTimeout(this.lpTimer);
      if (!boxy && e.pointerType !== 'mouse') {
        this.lpTimer = setTimeout(() => {
          if (this.mode === 'tap') { this.mode = 'box'; this.cb.boxStart(this.start.x, this.start.y); navigator.vibrate?.(15); }
        }, 420);
      }
    } else if (this.pts.size === 2) {
      clearTimeout(this.lpTimer);
      if (this.mode === 'box') this.cb.boxCancel();
      this.mode = 'pinch';
      const [a, b] = [...this.pts.values()];
      this.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    }
  }

  move(e) {
    const p0 = this.pts.get(e.pointerId);
    if (!p0) {
      if (e.pointerType === 'mouse') { const p = this.pos(e); this.cb.hover?.(p.x, p.y); }
      return;
    }
    const p = this.pos(e);
    const dx = p.x - p0.x, dy = p.y - p0.y;
    p0.x = p.x; p0.y = p.y;
    if (this.mode === 'tap' && Math.hypot(p.x - this.start.x, p.y - this.start.y) > 10) {
      clearTimeout(this.lpTimer);
      this.mode = 'pan';
      this.cb.pan(p.x - this.start.x, p.y - this.start.y);
      return;
    }
    if (this.mode === 'pan') this.cb.pan(dx, dy);
    else if (this.mode === 'box') this.cb.boxMove(p.x, p.y);
    else if (this.mode === 'pinch' && this.pts.size >= 2) {
      const [a, b] = [...this.pts.values()];
      const d = Math.hypot(a.x - b.x, a.y - b.y), cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2;
      this.cb.pan(cx - this.pinch.cx, cy - this.pinch.cy);
      if (d > 10 && this.pinch.d > 10) this.cb.zoom(this.pinch.d / d, cx, cy);
      this.pinch = { d, cx, cy };
    }
  }

  up(e, cancel) {
    const p0 = this.pts.get(e.pointerId);
    if (!p0) return;
    this.pts.delete(e.pointerId);
    clearTimeout(this.lpTimer);
    if (this.mode === 'box') {
      if (cancel) this.cb.boxCancel(); else this.cb.boxEnd(p0.x, p0.y);
      this.mode = null;
      return;
    }
    if (this.mode === 'tap' && !cancel && this.pts.size === 0) {
      const now = performance.now();
      const dbl = now - this.lastTap.t < 320 && Math.hypot(p0.x - this.lastTap.x, p0.y - this.lastTap.y) < 30;
      this.lastTap = { t: dbl ? 0 : now, x: p0.x, y: p0.y };
      if (dbl) this.cb.doubleTap(p0.x, p0.y);
      else this.cb.tap(p0.x, p0.y, e.button === 2);
    }
    if (this.pts.size === 0) this.mode = null;
    else if (this.mode === 'pinch') this.mode = 'pan';
  }
}
