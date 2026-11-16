/* Раскол — управление: два плавающих стика (тач), WASD + мышь (ПК). */
(function (global) {
  'use strict';
  const STICK_R = 56, DEAD = 14;

  class RaskolInput {
    constructor(layer) {
      this.layer = layer;
      this.left = { id: null, ox: 0, oy: 0, kx: 0, ky: 0 };
      this.right = { id: null, ox: 0, oy: 0, kx: 0, ky: 0, t0: 0, manual: false };
      this.keys = new Set();
      this.mouse = { x: 0, y: 0, down: false, used: false };
      this.tapAttack = false; this.superPressed = false; this.dashPressed = false;
      this.enabled = false;
      this._bind();
    }

    _bind() {
      const L = this.layer;
      L.addEventListener('pointerdown', e => this._down(e));
      global.addEventListener('pointermove', e => this._move(e), { passive: false });
      global.addEventListener('pointerup', e => this._up(e));
      global.addEventListener('pointercancel', e => this._up(e));
      L.addEventListener('contextmenu', e => e.preventDefault());
      global.addEventListener('keydown', e => {
        if (!this.enabled) return;
        const c = e.code;
        if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space', 'ShiftLeft', 'ShiftRight', 'KeyQ', 'KeyE', 'KeyJ'].includes(c)) e.preventDefault();
        if (e.repeat) return;
        this.keys.add(c);
        if (c === 'Space' || c === 'KeyE') this.superPressed = true;
        if (c === 'ShiftLeft' || c === 'ShiftRight' || c === 'KeyQ') this.dashPressed = true;
      });
      global.addEventListener('keyup', e => this.keys.delete(e.code));
      global.addEventListener('blur', () => this.reset());
    }

    _down(e) {
      if (!this.enabled) return;
      e.preventDefault();
      if (e.pointerType === 'mouse') {
        this.mouse.down = true; this.mouse.used = true; this.mouse.x = e.clientX; this.mouse.y = e.clientY;
        return;
      }
      const leftSide = e.clientX < global.innerWidth * 0.45;
      const s = leftSide ? this.left : this.right;
      if (s.id !== null) return;
      s.id = e.pointerId; s.ox = s.kx = e.clientX; s.oy = s.ky = e.clientY;
      if (!leftSide) { s.t0 = performance.now(); s.manual = false; }
      try { this.layer.setPointerCapture(e.pointerId); } catch (_) {}
    }
    _move(e) {
      if (e.pointerType === 'mouse') { this.mouse.x = e.clientX; this.mouse.y = e.clientY; return; }
      for (const s of [this.left, this.right]) {
        if (s.id !== e.pointerId) continue;
        e.preventDefault();
        let dx = e.clientX - s.ox, dy = e.clientY - s.oy;
        const d = Math.hypot(dx, dy);
        if (d > STICK_R) {
          // стик «тянется» за пальцем: база едет следом, чтобы не упираться в край
          const k = (d - STICK_R) / d;
          s.ox += dx * k; s.oy += dy * k; dx = e.clientX - s.ox; dy = e.clientY - s.oy;
        }
        s.kx = s.ox + dx; s.ky = s.oy + dy;
        if (s === this.right && d > DEAD + 6) s.manual = true;
      }
    }
    _up(e) {
      if (e.pointerType === 'mouse') { this.mouse.down = false; return; }
      if (this.left.id === e.pointerId) this.left.id = null;
      if (this.right.id === e.pointerId) {
        if (!this.right.manual && performance.now() - this.right.t0 < 260) this.tapAttack = true;
        this.right.id = null; this.right.manual = false;
      }
    }

    reset() {
      this.left.id = this.right.id = null; this.right.manual = false;
      this.keys.clear(); this.mouse.down = false;
      this.tapAttack = this.superPressed = this.dashPressed = false;
    }

    // Вектор движения: длина 0..1
    move() {
      let x = 0, y = 0;
      const k = this.keys;
      if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
      if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
      if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
      if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
      if (x || y) { const d = Math.hypot(x, y); return { x: x / d, y: y / d }; }
      const s = this.left;
      if (s.id === null) return { x: 0, y: 0 };
      const dx = s.kx - s.ox, dy = s.ky - s.oy, d = Math.hypot(dx, dy);
      if (d < DEAD) return { x: 0, y: 0 };
      const m = Math.min(1, (d - DEAD) / (STICK_R - DEAD) + 0.25);
      return { x: dx / d * m, y: dy / d * m };
    }

    // Атака: held — зажата; dir — ручное направление (угол) или null = автоприцел
    attack(heroScreen) {
      if (this.mouse.down) {
        return { held: true, dir: Math.atan2(this.mouse.y - heroScreen.y, this.mouse.x - heroScreen.x) };
      }
      if (this.keys.has('KeyJ')) return { held: true, dir: null };
      const s = this.right;
      if (s.id === null) return { held: false, dir: null };
      if (s.manual) return { held: true, dir: Math.atan2(s.ky - s.oy, s.kx - s.ox) };
      return { held: true, dir: null };
    }

    consume(flag) { const v = this[flag]; this[flag] = false; return v; }
  }

  RaskolInput.STICK_R = STICK_R;
  global.RaskolInput = RaskolInput;
})(window);
