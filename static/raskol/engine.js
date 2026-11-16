/* Раскол — движок забега: комнаты-арены, враги, боссы, удары, карты-навыки, камера и свет. */
(function (global) {
  'use strict';
  const D = global.RASKOL_DATA, SP = global.RASKOL_SPRITES;
  const TAU = Math.PI * 2;
  const VIEW_H = 440;                // сколько мировых единиц по высоте видно на экране
  const RW = D.ROOM_W, RH = D.ROOM_H, WALL = D.WALL;
  const DOOR_W = 130;
  const MAX_PART = 420, MAX_FLOAT = 40;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + Math.random() * (b - a);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const ease = t => 1 - Math.pow(1 - t, 3);
  const REDUCED = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const lang = () => (['uk', 'ru', 'en', 'de'].includes(global.RASKOL_LANG) ? global.RASKOL_LANG : 'ru');
  const word = k => D.WORDS[k][lang()];
  const tr = o => (o && (o[lang()] || o.en)) || '';

  // ── звук (синтез, без файлов) ──
  const SND = {
    swing: ['triangle', 260, 0.07, 0.05, 120], hit: ['square', 170, 0.05, 0.035, 90],
    kill: ['sawtooth', 420, 0.09, 0.045, 110], hurt: ['sawtooth', 140, 0.16, 0.07, 60],
    dash: ['sine', 500, 0.09, 0.05, 950], super: ['sawtooth', 180, 0.3, 0.07, 620],
    level: ['sine', 660, 0.2, 0.06, 1320], door: ['sine', 330, 0.4, 0.06, 660],
    shoot: ['triangle', 620, 0.05, 0.02, 400], boss: ['sawtooth', 80, 0.7, 0.09, 45],
    block: ['square', 900, 0.04, 0.03, 700], orb: ['sine', 880, 0.04, 0.015, 1250]
  };
  const _sndLast = {};
  function snd(k) {
    const f = global.sfx;
    if (!f || !f.playTone) return;
    const now = performance.now();
    if (_sndLast[k] && now - _sndLast[k] < 55) return;
    _sndLast[k] = now;
    const s = SND[k];
    try { f.playTone(s[1], s[0], s[2], s[3], s[4]); } catch (_) {}
  }
  function vib(p) { try { if (global.LobbyUI) global.LobbyUI.vibrate(p); } catch (_) {} }

  const PART_COL = {
    skel: ['#f5f5f4', '#d6d3d1', '#a8a29e'], archer: ['#f5f5f4', '#a3e635', '#d6d3d1'],
    bat: ['#7e22ce', '#c084fc', '#2e1065'], slime: ['#a3e635', '#65a30d', '#d9f99d'], slimelet: ['#a3e635', '#65a30d'],
    warlock: ['#e879f9', '#7c3aed', '#f0abfc'], totem: ['#78716c', '#f43f5e', '#44403c'],
    warden: ['#22d3ee', '#9ca3af', '#e5e7eb'], king: ['#f0abfc', '#fde047', '#f5f5f4']
  };

  class RaskolEngine {
    constructor(canvas, input, cb) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.input = input;
      this.cb = cb || {};
      this.dpr = Math.min(2, global.devicePixelRatio || 1);
      this.running = false; this.frozen = false; this.raf = 0;
      this.parts = []; for (let i = 0; i < MAX_PART; i++) this.parts.push({ life: 0 });
      this.partI = 0;
      this.floats = []; for (let i = 0; i < MAX_FLOAT; i++) this.floats.push({ life: 0 });
      this.floatI = 0;
      this.god = false;
      this.debug = false;
      this.isTouch = ('ontouchstart' in global) || (navigator.maxTouchPoints > 0);
      this._drawList = [];
      this._vig = this._makeVignette();
      this.resize();
      global.addEventListener('resize', () => this.resize());
    }

    _makeVignette() {
      const c = document.createElement('canvas'); c.width = c.height = 512;
      const g = c.getContext('2d');
      const gr = g.createRadialGradient(256, 256, 0, 256, 256, 256);
      gr.addColorStop(0, 'rgba(4,2,10,0)'); gr.addColorStop(0.32, 'rgba(4,2,10,0)');
      gr.addColorStop(0.75, 'rgba(4,2,10,.55)'); gr.addColorStop(1, 'rgba(4,2,10,.82)');
      g.fillStyle = gr; g.fillRect(0, 0, 512, 512);
      return c;
    }

    resize() {
      this.vw = global.innerWidth; this.vh = global.innerHeight;
      this.canvas.width = Math.round(this.vw * this.dpr);
      this.canvas.height = Math.round(this.vh * this.dpr);
      this.scale = Math.min(this.vh / VIEW_H, this.vw / 560);
      if (this.frozen && this.hero) this.render();
    }

    // ── забег ─────────────────────────────────────────────────
    startRun(clsId) {
      SP.build();
      const c = D.CLASSES[clsId] || D.CLASSES.guard;
      const kit = (global.RASKOL_CLASSES && (global.RASKOL_CLASSES[c.id] || global.RASKOL_CLASSES.guard)) || null;
      this.chapter = D.CHAPTER1;
      this.seed = Math.floor(Math.random() * 100000);
      this.hero = {
        cls: c.id, c, kit, x: RW / 2, y: RH - 80, r: 20, hp: c.hp, maxHp: c.hp, face: -Math.PI / 2,
        lastSeenX: RW / 2, lastSeenY: RH - 80, invisT: 0, dashCrit: false, shieldCd: 0,
        atkT: 0, swing: null, swings: 0, dashT: 0, dashCd: 0, dashDir: 0, inv: 0, hurtT: 0,
        superC: 0, ram: null, lockMove: false, noTurn: false, lvl: 1, xp: 0, cards: {}, walkT: 0, moving: false, orbitA: 0, trail: [],
        mods: {
          dmg: 1, rate: 1, speed: 1, crit: 0.05, leech: 0, fire: 0, frost: 0, wave: 0, wide: 0, reflect: 0, crush: 0, spin: 0, orbit: 0, dashMul: 1,
          doubleShot: 0, pierce: 0, rPoison: 0, trap: 0, eagle: 0,
          chain: 0, iceNova: 0, bigBall: 0, manaShield: 0, fireTrail: 0,
          fanKnives: 0, bleed: 0, shadowClone: 0, execDash: 0, sPoison: 0
        }
      };
      this.zones = []; this.bolts = [];
      if (kit && kit.init) kit.init(this, this.hero);
      this.run = { kills: 0, shards: 0, score: 0, time: 0 };
      this.state = 'play';
      this.timeScale = 1; this.hitstop = 0; this.shakeA = 0; this.endT = 0;
      this.pendingPicks = 0; this.picking = false;
      for (const p of this.parts) p.life = 0;
      for (const f of this.floats) f.life = 0;
      this.loadRoom(0);
      this.input.reset(); this.input.enabled = true;
      this.frozen = false;
      this._startLoop();
    }

    _startLoop() {
      if (this.running) return;
      this.running = true;
      this.lastTs = performance.now();
      const loop = ts => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
        this.lastTs = ts;
        if (!this.frozen) { this.update(dt); this.render(); }
        this.raf = requestAnimationFrame(loop);
      };
      this.raf = requestAnimationFrame(loop);
    }

    stop() {
      this.running = false;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.input.enabled = false; this.input.reset();
      const g = this.ctx;
      g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = '#05030a'; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    pause() { if (this.state !== 'play') return; this.frozen = true; this.input.reset(); }
    resume() { if (this.picking) return; this.frozen = false; this.lastTs = performance.now(); }

    // ── комната ───────────────────────────────────────────────
    loadRoom(i) {
      const def = this.chapter.rooms[i];
      this.roomIdx = i; this.roomDef = def;
      this.obst = (D.LAYOUTS[def.layout] || []).map(o => ({ ...o }));
      this.bg = SP.renderRoom(def.layout, this.seed + i * 31);
      const h = this.hero;
      h.x = RW / 2; h.y = RH - 70; h.face = -Math.PI / 2; h.dashT = 0; h.lockMove = false; h.noTurn = false; h.trail.length = 0;
      h.lastSeenX = h.x; h.lastSeenY = h.y; h.invisT = 0;
      if (h.kit && h.kit.onRoomReset) h.kit.onRoomReset(this, h);
      this.enemies = []; this.ebul = []; this.hshots = []; this.tele = []; this.orbs = []; this.zones = []; this.bolts = [];
      this.waves = def.waves ? def.waves.slice() : [];
      this.roomState = 'intro'; this.introT = 0.9; this.waveDelay = 0;
      this.door = { open: false, t: 0 };
      this.boss = null;
      this.fade = 1; this.exitT = 0;
      this._banner(def.boss ? tr(D.BOSSES[def.boss].name) : word('room') + ' ' + (i + 1), def.boss ? '#f43f5e' : '#e9d5ff');
      const v = this._view();
      this.cam = { x: clamp(h.x - v.w / 2, -WALL, Math.max(-WALL, RW + WALL - v.w)), y: clamp(h.y - v.h / 2, -WALL, Math.max(-WALL, RH + WALL - v.h)) };
      if (this.cb.onRoom) this.cb.onRoom(i + 1, this.chapter.rooms.length, !!def.boss);
      if (def.boss) snd('boss');
    }

    _banner(text, color) { this.banner = { text, color, t: 0, dur: 1.7 }; }

    _view() { return { w: this.vw / this.scale, h: this.vh / this.scale }; }

    _freeSpot(minHero) {
      const h = this.hero;
      for (let k = 0; k < 80; k++) {
        const x = rand(70, RW - 70), y = rand(70, RH - 120);
        if (Math.hypot(x - h.x, y - h.y) < minHero) continue;
        if (this.obst.some(o => x > o.x - 40 && x < o.x + o.w + 40 && y > o.y - 40 && y < o.y + o.h + 40)) continue;
        if (this.enemies.some(e => Math.hypot(e.x - x, e.y - y) < 60)) continue;
        return { x, y };
      }
      return { x: RW / 2 + rand(-200, 200), y: 140 };
    }

    _makeEnemy(type, x, y) {
      const d = D.ENEMIES[type];
      const hpS = 1 + this.roomIdx * 0.12, dmgS = (1 + this.roomIdx * 0.08) * 1.35;
      return {
        type, x, y, r: d.r, hp: Math.round(d.hp * hpS), maxHp: Math.round(d.hp * hpS), speed: d.speed, dmg: Math.round(d.dmg * dmgS),
        ai: d.ai, xp: d.xp, face: Math.atan2(this.hero.y - y, this.hero.x - x), vx: 0, vy: 0, hvx: 0, hvy: 0,
        t: rand(0.6, 1.6), st: 'move', stT: 0, flash: 0, burnT: 0, burnD: 0, slowT: 0, poisonT: 0, poisonD: 0, bleedT: 0, bleedD: 0, elemCharges: 0,
        spawnT: 0.7, stuckT: 0, detT: 0, detA: 0, wob: rand(0, TAU), strafe: Math.random() < 0.5 ? 1 : -1, blink: 4, rot: 0, orbCd: 0, dead: false
      };
    }

    _spawnWave(list) {
      for (const [type, n] of list) {
        for (let k = 0; k < n; k++) {
          const p = this._freeSpot(300);
          this.enemies.push(this._makeEnemy(type, p.x, p.y));
        }
      }
    }

    _spawnBoss(kind) {
      const b = D.BOSSES[kind];
      const hpS = 1;
      const e = {
        type: kind, boss: true, x: RW / 2, y: 190, r: b.r, hp: b.hp * hpS, maxHp: b.hp * hpS, speed: b.speed, dmg: b.dmg,
        xp: b.xp, ai: kind, face: Math.PI / 2, vx: 0, vy: 0, hvx: 0, hvy: 0, t: 0, st: 'chase', stT: 0, flash: 0,
        burnT: 0, burnD: 0, slowT: 0, poisonT: 0, poisonD: 0, bleedT: 0, bleedD: 0, elemCharges: 0,
        spawnT: 1.0, stuckT: 0, detT: 0, detA: 0, wob: 0, atkT: 2.2, phase: 1, swordA: 0,
        summonCd: 4, chains: 0, hitHero: false, orbCd: 0, dead: false, bursts: 0, spiralA: 0
      };
      this.enemies.push(e);
      this.boss = e;
    }

    // ── главный цикл ──────────────────────────────────────────
    update(rawDt) {
      if (this.hitstop > 0) { this.hitstop -= rawDt; this._updateFx(rawDt * 0.3); return; }
      const dt = rawDt * this.timeScale;
      this.run.time += dt;
      if (this.banner) { this.banner.t += rawDt; if (this.banner.t > this.banner.dur) this.banner = null; }
      if (this.fade > 0 && this.roomState !== 'exit') this.fade = Math.max(0, this.fade - rawDt * 3);

      if (this.state === 'dying' || this.state === 'winning') {
        this.endT -= rawDt;
        this._updateEnemies(dt); this._updateBullets(dt); this._updateFx(rawDt);
        if (this.endT <= 0) this._finish(this.state === 'winning');
        this._updateCamera(rawDt);
        return;
      }
      if (this.state !== 'play') return;

      this._updateHero(dt);
      this._updateEnemies(dt);
      this._updateBullets(dt);
      this._updateHeroShots(dt);
      this._updateTele(dt);
      this._updateZones(dt);
      this._updateBolts(dt);
      this._updateOrbs(dt);
      this._updateFx(dt);
      this._updateRoom(dt);
      this._updateCamera(rawDt);
      if (this.pendingPicks > 0 && !this.picking && this.roomState !== 'exit' && this.state === 'play') this._openPick();
      if (this.cb.onHud) this.cb.onHud(this.hero, this.run, this.boss);
    }

    _updateRoom(dt) {
      if (this.roomState === 'intro') {
        this.introT -= dt;
        if (this.introT <= 0) {
          this.roomState = 'fight';
          if (this.roomDef.boss) this._spawnBoss(this.roomDef.boss);
          else this._spawnWave(this.waves.shift());
        }
      } else if (this.roomState === 'fight') {
        if (this.enemies.length === 0) {
          if (this.waves.length) {
            this.waveDelay += dt;
            if (this.waveDelay > 0.7) {
              this.waveDelay = 0;
              const n = this.roomDef.waves.length - this.waves.length + 1;
              this._banner(word('wave') + ' ' + n + '/' + this.roomDef.waves.length, '#fca5a5');
              this._spawnWave(this.waves.shift());
            }
          } else {
            this.roomState = 'clear';
            this.ebul.length = 0; this.tele.length = 0;
            this.run.score += 100 * (this.roomIdx + 1);
            this.run.shards += 2;
            if (this.roomDef.boss === 'warden') {
              const h = this.hero; const heal = Math.round(h.maxHp * 0.3);
              h.hp = Math.min(h.maxHp, h.hp + heal);
              this._float(h.x, h.y - 40, '+' + heal + ' ' + word('heal'), '#4ade80', 18);
              this.pendingPicks++;
            }
          }
        }
      } else if (this.roomState === 'clear') {
        if (this.orbs.length === 0 && this.pendingPicks === 0 && !this.picking) {
          if (this.roomIdx >= this.chapter.rooms.length - 1) return; // победа обрабатывается смертью короля
          this.roomState = 'open'; this.door.open = true;
          this._banner(word('door'), '#67e8f9');
          snd('door');
        }
      } else if (this.roomState === 'open') {
        this.door.t += dt;
        if (this.hero.y < -14) { this.roomState = 'exit'; this.exitT = 0; this.input.reset(); }
      } else if (this.roomState === 'exit') {
        this.exitT += dt;
        this.fade = Math.min(1, this.exitT / 0.35);
        this.hero.y -= 120 * dt;
        if (this.exitT >= 0.4) {
          if (this.cb.onRoomCleared) this.cb.onRoomCleared(this.roomIdx + 1);
          this.loadRoom(this.roomIdx + 1);
        }
      }
    }

    // ── герой ─────────────────────────────────────────────────
    snd(k) { snd(k); }
    vib(p) { vib(p); }
    word(k) { return word(k); }

    _heroDmg() { return this.hero.c.dmg * this.hero.mods.dmg; }
    _heroRange() { return this.hero.c.range * (1 + 0.15 * this.hero.mods.wide); }
    _heroArc() { return this.hero.c.arc * (1 + 0.22 * this.hero.mods.wide); }
    _dashCdMax() { return 2.4 * this.hero.mods.dashMul; }

    _heroScreen() { return { x: (this.hero.x - this.cam.x) * this.scale, y: (this.hero.y - this.cam.y) * this.scale }; }

    _updateHero(dt) {
      const h = this.hero, inp = this.input, kit = h.kit;
      h.atkT -= dt; h.dashCd -= dt; h.inv -= dt; h.hurtT -= dt;
      if (h.shieldCd > 0) h.shieldCd -= dt;
      if (h.invisT > 0) h.invisT = Math.max(0, h.invisT - dt);
      else { h.lastSeenX = h.x; h.lastSeenY = h.y; }
      for (let i = h.trail.length - 1; i >= 0; i--) { h.trail[i].life -= dt; if (h.trail[i].life <= 0) h.trail.splice(i, 1); }
      if (this.roomState === 'exit') return;
      const mv = inp.move();
      const moving = Math.hypot(mv.x, mv.y) > 0.1;

      if (inp.consume('dashPressed') && h.dashCd <= 0 && !h.lockMove) {
        h.dashDir = moving ? Math.atan2(mv.y, mv.x) : h.face;
        h.dashT = 0.17; h.inv = Math.max(h.inv, 0.3); h.dashCd = this._dashCdMax();
        snd('dash'); vib(8);
        this._burst(h.x, h.y, 10, (kit && kit.trailCols) || ['#e9d5ff', '#a78bfa'], 160, 3);
        if (kit && kit.onDash) kit.onDash(this);
      }
      if (inp.consume('superPressed') && h.superC >= 100 && !h.lockMove) {
        const at = inp.attack(this._heroScreen());
        const dir = at.dir != null ? at.dir : (this._autoAim(700) ?? (moving ? Math.atan2(mv.y, mv.x) : h.face));
        if (kit && kit.super) kit.super(this, dir);
      }

      if (kit && kit.update) kit.update(this, dt);

      if (!h.lockMove) {
        if (h.dashT > 0) {
          h.dashT -= dt;
          h.x += Math.cos(h.dashDir) * 1150 * dt; h.y += Math.sin(h.dashDir) * 1150 * dt;
          h.trail.push({ x: h.x, y: h.y, a: h.face, life: 0.18 });
        } else {
          const mul = h.invisT > 0 ? 1.35 : 1;
          const sp = h.c.speed * h.mods.speed * mul;
          h.x += mv.x * sp * dt; h.y += mv.y * sp * dt;
        }
        this._collideWorld(h, true);
      }
      h.moving = moving;
      if (moving) h.walkT += dt;
      if (kit && kit.onMove && (moving || h.dashT > 0)) kit.onMove(this, dt);

      // атака
      const at = inp.attack(this._heroScreen());
      const tap = inp.consume('tapAttack');
      if ((at.held || tap) && h.atkT <= 0 && !h.lockMove && h.dashT <= 0) {
        let dir = at.dir;
        if (dir == null) dir = this._autoAim(this._heroRange() + 260);
        if (dir == null) dir = moving ? Math.atan2(mv.y, mv.x) : h.face;
        if (kit && kit.attack) kit.attack(this, dir);
      }
      if (!h.noTurn) {
        let want = null;
        if (at.dir != null) want = at.dir; else if (moving) want = Math.atan2(mv.y, mv.x);
        if (want != null) h.face += angDiff(want, h.face) * Math.min(1, dt * 14);
      }

      // летающие клинки
      if (h.mods.orbit) {
        h.orbitA += dt * 3.4;
        for (let k = 0; k < h.mods.orbit; k++) {
          const a = h.orbitA + k * TAU / h.mods.orbit, bx = h.x + Math.cos(a) * 78, by = h.y + Math.sin(a) * 78;
          for (const e of this.enemies) {
            if (e.dead || e.spawnT > 0 || e.orbCd > 0) continue;
            if (Math.hypot(e.x - bx, e.y - by) < e.r + 16) { e.orbCd = 0.35; this._damage(e, this._heroDmg() * 0.45, { kbA: a + Math.PI / 2, kb: 120, heroAtk: true }); }
          }
        }
      }
    }

    _autoAim(maxD) {
      const h = this.hero; let best = null, bd = maxD;
      for (const e of this.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const d = Math.hypot(e.x - h.x, e.y - h.y) - e.r;
        if (d < bd) { bd = d; best = e; }
      }
      return best ? Math.atan2(best.y - h.y, best.x - h.x) : null;
    }

    _hurtHero(amount, srcA, projectile) {
      const h = this.hero;
      if (this.god || h.inv > 0 || h.lockMove || h.dashT > 0 || this.state !== 'play') return false;
      if (h.kit && h.kit.onHurt) {
        amount = h.kit.onHurt(this, amount, srcA, projectile);
        if (amount <= 0) return true;
      }
      amount = Math.max(1, Math.round(amount));
      h.hp -= amount; h.inv = 0.55; h.hurtT = 0.35;
      this.shakeA = Math.max(this.shakeA, 6);
      this._float(h.x, h.y - 30, '-' + amount, '#f87171', 16);
      this._burst(h.x, h.y, 8, ['#f87171', '#fecaca'], 160, 3);
      snd('hurt'); vib(25);
      if (h.hp <= 0) { h.hp = 0; this._die(); }
      return true;
    }

    _die() {
      this.state = 'dying'; this.timeScale = 0.3; this.endT = 1.3;
      const h = this.hero;
      this._burst(h.x, h.y, 40, ['#f87171', '#fbbf24', '#e5e7eb'], 300, 5);
      this.shakeA = 12; snd('kill'); vib([40, 30, 60]);
      this.input.reset();
    }

    _finish(win) {
      this.state = win ? 'won' : 'dead';
      this.frozen = true; this.input.enabled = false; this.input.reset();
      this.render();
      if (this.cb.onEnd) this.cb.onEnd({ win, room: this.roomIdx + 1, kills: this.run.kills, shards: this.run.shards, score: this.run.score, time: this.run.time, lvl: this.hero.lvl });
    }

    // ── урон врагам ───────────────────────────────────────────
    _damage(e, amount, o) {
      if (e.dead || e.spawnT > 0) return;
      if (e.inv && e.inv > 0) return;
      const h = this.hero, m = h.mods;
      o = o || {};
      const crit = !!o.forceCrit || (Math.random() < m.crit);
      if (crit) amount *= (o.critMul || 2);
      amount = Math.max(1, Math.round(amount));
      e.hp -= amount; e.flash = 0.1;
      if (o.kbA != null && e.ai !== 'turret') {
        const kb = (o.kb || 200) * (e.boss ? 0.1 : 1);
        e.vx += Math.cos(o.kbA) * kb; e.vy += Math.sin(o.kbA) * kb;
      }
      if (o.heroAtk || o.melee || o.wave) {
        if (m.fire) { e.burnT = 3; e.burnD = this._heroDmg() * 0.22 * m.fire; }
        if (m.frost) e.slowT = 2;
      }
      if (o.poison && o.poison > 0) { e.poisonT = 4; e.poisonD = this._heroDmg() * 0.26 * o.poison; }
      if (o.bleed && o.bleed > 0) { e.bleedT = 3.5; e.bleedD = this._heroDmg() * 0.32 * o.bleed; }
      this._float(e.x + rand(-8, 8), e.y - e.r - 6, crit ? amount + '!' : String(amount), o.col || (crit ? '#fde047' : '#ffffff'), crit ? 20 : 14);
      this._burst(e.x, e.y, crit ? 9 : 5, PART_COL[e.type] || ['#fff'], crit ? 220 : 150, crit ? 3.5 : 2.6);
      if (!o.noCharge && !h.lockMove) h.superC = Math.min(100, h.superC + amount * 0.34 * (1 + 0.45 * m.crush));
      if (crit) { this.hitstop = Math.max(this.hitstop, 0.045); this.shakeA = Math.max(this.shakeA, 3); }
      else if (o.melee) this.hitstop = Math.max(this.hitstop, 0.018);
      snd('hit');
      if (o.heroAtk && h.kit && h.kit.onHitEnemy) h.kit.onHitEnemy(this, e, o);
      if (e.hp <= 0) this._kill(e);
    }

    _kill(e) {
      if (e.dead) return;
      e.dead = true;
      const h = this.hero;
      this._burst(e.x, e.y, e.boss ? 60 : 16, PART_COL[e.type] || ['#fff'], e.boss ? 380 : 230, e.boss ? 6 : 3.5);
      for (let k = 0; k < e.xp; k++) this.orbs.push({ x: e.x + rand(-6, 6), y: e.y + rand(-6, 6), vx: rand(-160, 160), vy: rand(-160, 160), t: 0 });
      this.run.kills++;
      this.run.score += e.boss ? 1500 : 10 * e.xp;
      this.run.shards += e.boss ? D.BOSSES[e.type].shards : 1;
      if (h.mods.leech && h.hp > 0) { const v = 3 * h.mods.leech; h.hp = Math.min(h.maxHp, h.hp + v); }
      if (h.mods.execDash) { h.dashCd = 0; this._spark(h.x, h.y, '#38bdf8'); }
      const split = D.ENEMIES[e.type] && D.ENEMIES[e.type].split;
      if (split) {
        for (const s of [-1, 1]) {
          const c = this._makeEnemy(split, e.x + s * 14, e.y);
          c.spawnT = 0; c.hvx = s * 220; c.t = 0.5;
          this.enemies.push(c);
        }
      }
      snd('kill');
      if (e.boss) {
        this.boss = null;
        this.shakeA = 14; this.hitstop = 0.12;
        this.ebul.length = 0; this.tele.length = 0;
        for (const o of this.enemies) if (!o.boss && !o.dead) { o.dead = true; this._burst(o.x, o.y, 12, PART_COL[o.type], 200, 3); }
        if (e.type === 'king') { this.state = 'winning'; this.timeScale = 0.35; this.endT = 1.8; this.run.score += 3000; }
      }
    }

    // ── враги ─────────────────────────────────────────────────
    _moveToward(e, ang, sp, dt) {
      if (e.detT > 0) { e.detT -= dt; ang = e.detA; }
      const ox = e.x, oy = e.y;
      e.x += Math.cos(ang) * sp * dt; e.y += Math.sin(ang) * sp * dt;
      this._collideWorld(e, false);
      const moved = Math.hypot(e.x - ox, e.y - oy);
      if (sp > 0 && moved < sp * dt * 0.3) {
        e.stuckT += dt;
        if (e.stuckT > 0.3) { e.stuckT = 0; e.detT = 0.6; e.detA = ang + (Math.random() < 0.5 ? 1 : -1) * Math.PI / 2; }
      } else e.stuckT = 0;
    }

    _updateEnemies(dt) {
      const h = this.hero;
      const decoy = this.zones.find(z => z.kind === 'decoy' && z.life > 0);
      const stealth = h.invisT > 0 && !decoy;
      const aimX = decoy ? decoy.x : (stealth ? h.lastSeenX : h.x);
      const aimY = decoy ? decoy.y : (stealth ? h.lastSeenY : h.y);
      const hurtTarget = (amt, a) => { this._hurtHero(amt, a, false); };

      for (const e of this.enemies) {
        if (e.dead) continue;
        if (e.spawnT > 0) { e.spawnT -= dt; continue; }
        e.flash -= dt; e.orbCd -= dt; if (e.inv) e.inv -= dt;
        if (e.burnT > 0) {
          e.burnT -= dt; e.hp -= e.burnD * dt;
          if (Math.random() < dt * 12) this._part(e.x + rand(-e.r, e.r) * 0.6, e.y + rand(-e.r, e.r) * 0.6, rand(-20, 20), rand(-70, -30), 0.4, 2.6, '#fb923c');
          if (e.hp <= 0) { this._kill(e); continue; }
        }
        if (e.poisonT > 0) {
          e.poisonT -= dt; e.hp -= e.poisonD * dt;
          if (Math.random() < dt * 10) this._part(e.x + rand(-e.r, e.r) * 0.6, e.y + rand(-e.r, e.r) * 0.6, rand(-15, 15), rand(-55, -25), 0.45, 2.8, '#4ade80');
          if (e.hp <= 0) { this._kill(e); continue; }
        }
        if (e.bleedT > 0) {
          e.bleedT -= dt; e.hp -= e.bleedD * dt;
          if (Math.random() < dt * 10) this._part(e.x + rand(-e.r, e.r) * 0.5, e.y + rand(-e.r, e.r) * 0.5, rand(-25, 25), rand(20, 60), 0.35, 2.4, '#f43f5e');
          if (e.hp <= 0) { this._kill(e); continue; }
        }
        if (e.slowT > 0) e.slowT -= dt;
        const sf = e.slowT > 0 ? Math.max(0.4, 1 - 0.22 * (h.mods.frost || 1)) : 1;
        // отброс и прыжки
        if (e.vx || e.vy) {
          e.x += e.vx * dt; e.y += e.vy * dt;
          const k = Math.pow(0.0008, dt); e.vx *= k; e.vy *= k;
          if (Math.abs(e.vx) < 2 && Math.abs(e.vy) < 2) e.vx = e.vy = 0;
        }
        if (e.hvx || e.hvy) {
          e.x += e.hvx * dt; e.y += e.hvy * dt;
          const k = Math.pow(0.02, dt); e.hvx *= k; e.hvy *= k;
          if (Math.abs(e.hvx) < 3 && Math.abs(e.hvy) < 3) e.hvx = e.hvy = 0;
        }
        if (this.state !== 'play') { this._collideWorld(e, false); continue; }
        const dx = aimX - e.x, dy = aimY - e.y, dist = Math.hypot(dx, dy), ang = Math.atan2(dy, dx);
        const hdx = h.x - e.x, hdy = h.y - e.y, hdist = Math.hypot(hdx, hdy), hang = Math.atan2(hdy, hdx);
        if (e.boss) { this._bossAI(e, dt, dist, ang, sf, stealth, aimX, aimY); this._collideWorld(e, false); continue; }
        e.t -= dt; e.wob += dt;
        switch (e.ai) {
          case 'melee': {
            if (e.st === 'wind') {
              e.stT -= dt;
              if (e.stT <= 0) {
                e.st = 'rec'; e.stT = 0.5; e.slashT = 0.16;
                if (hdist < e.r + h.r + 32 && Math.abs(angDiff(hang, e.face)) < 1.3) hurtTarget(e.dmg, hang + Math.PI);
              }
            } else if (e.st === 'rec') { e.stT -= dt; if (e.stT <= 0) e.st = 'move'; }
            else {
              const walkA = (stealth && dist < 48) ? e.face + Math.sin(e.wob * 1.4) * 1.1 * dt : ang;
              e.face += angDiff(walkA, e.face) * Math.min(1, dt * 8);
              if (!stealth || dist > 38) this._moveToward(e, walkA, e.speed * (stealth ? 0.65 : 1) * sf, dt);
              if (!stealth && dist < e.r + h.r + 24 && e.t <= 0) { e.st = 'wind'; e.stT = 0.4; e.t = 1.3; }
            }
            if (e.slashT > 0) e.slashT -= dt;
            break;
          }
          case 'ranged': {
            if (e.st === 'aim') {
              if (stealth) { e.st = 'move'; e.t = 0.6; break; }
              e.stT -= dt;
              if (e.stT > 0.25) e.aimA += angDiff(ang, e.aimA) * Math.min(1, dt * 5);
              e.face = e.aimA;
              if (e.stT <= 0) {
                e.st = 'move'; e.t = rand(1.8, 2.6);
                this._shoot(e.x + Math.cos(e.aimA) * 18, e.y + Math.sin(e.aimA) * 18, e.aimA, 440, 6, e.dmg, 'arrow');
              }
            } else if (stealth) {
              const wa = e.face + e.strafe * 0.8 * dt;
              this._moveToward(e, wa, e.speed * 0.5 * sf, dt);
              e.face = wa;
            } else {
              let a = ang, sp = e.speed * sf;
              if (dist < 230) a = ang + Math.PI;
              else if (dist < 420) { a = ang + e.strafe * Math.PI / 2; sp *= 0.5; if (Math.random() < dt * 0.4) e.strafe *= -1; }
              this._moveToward(e, a, sp, dt);
              e.face += angDiff(ang, e.face) * Math.min(1, dt * 8);
              if (e.t <= 0 && dist < 650) { e.st = 'aim'; e.stT = 0.7; e.aimA = ang; }
            }
            break;
          }
          case 'swoop': {
            if (e.st === 'dash') {
              e.stT -= dt;
              this._moveToward(e, e.dashA, 450, dt); e.face = e.dashA;
              if (e.stT <= 0) { e.st = 'move'; e.t = rand(1.6, 2.6); }
            } else if (e.st === 'tele') {
              e.stT -= dt; e.face = ang;
              if (e.stT <= 0) { e.st = 'dash'; e.stT = 0.45; e.dashA = ang; }
            } else {
              const tx = aimX + Math.cos(e.wob * 1.6) * 130, ty = aimY + Math.sin(e.wob * 1.6) * 130;
              const a = Math.atan2(ty - e.y, tx - e.x);
              this._moveToward(e, a, e.speed * 0.8 * sf, dt); e.face = a;
              if (!stealth && e.t <= 0 && dist < 380) { e.st = 'tele'; e.stT = 0.38; }
            }
            if (hdist < e.r + h.r - 2) hurtTarget(e.dmg, hang + Math.PI);
            break;
          }
          case 'slime': {
            if (e.t <= 0) {
              const mul = e.type === 'slime' ? 6 : 5;
              const ja = stealth ? e.face + rand(-0.7, 0.7) : ang;
              e.hvx += Math.cos(ja) * e.speed * mul * sf; e.hvy += Math.sin(ja) * e.speed * mul * sf;
              e.t = rand(0.9, 1.3); e.hopT = 0.35;
            }
            if (e.hopT > 0) e.hopT -= dt;
            this._collideWorld(e, false);
            if (hdist < e.r + h.r - 2) hurtTarget(e.dmg, hang + Math.PI);
            break;
          }
          case 'caster': {
            e.blink -= dt;
            if (e.st === 'cast') {
              if (stealth) { e.st = 'move'; e.t = 0.7; break; }
              e.stT -= dt; e.face = ang;
              if (e.stT <= 0) {
                e.st = 'move'; e.t = rand(2.6, 3.4);
                for (const s of [-0.32, 0, 0.32]) this._shoot(e.x + Math.cos(ang) * 22, e.y + Math.sin(ang) * 22, ang + s, 190, 9, e.dmg, 'orb', 1.3);
              }
            } else if (stealth) {
              const wa = e.face - e.strafe * 0.7 * dt;
              this._moveToward(e, wa, e.speed * 0.45 * sf, dt);
              e.face = wa;
            } else {
              let a = ang, sp = e.speed * sf;
              if (dist < 260) a = ang + Math.PI; else if (dist < 400) { a = ang + e.strafe * Math.PI / 2; sp *= 0.4; }
              this._moveToward(e, a, sp, dt); e.face = ang;
              if (e.t <= 0 && dist < 620) { e.st = 'cast'; e.stT = 0.6; }
              if (e.blink <= 0 && dist < 200) {
                e.blink = 5;
                this._burst(e.x, e.y, 16, PART_COL.warlock, 200, 3);
                const p = this._freeSpot(280); e.x = p.x; e.y = p.y;
                this._burst(e.x, e.y, 16, PART_COL.warlock, 200, 3);
              }
            }
            break;
          }
          case 'turret': {
            e.rot += dt * 0.7;
            if (e.st === 'charge') {
              e.stT -= dt;
              if (e.stT <= 0) {
                e.st = 'move'; e.t = 2.5;
                for (let k = 0; k < 10; k++) { const a = e.rot + k * TAU / 10; this._shoot(e.x + Math.cos(a) * 24, e.y + Math.sin(a) * 24, a, 165, 8, e.dmg, 'ring'); }
              }
            } else if (e.t <= 0) { e.st = 'charge'; e.stT = 0.55; }
            break;
          }
        }
        this._collideWorld(e, false);
      }
      // раздвигаем врагов
      const es = this.enemies;
      for (let i = 0; i < es.length; i++) {
        const a = es[i]; if (a.dead || a.spawnT > 0) continue;
        for (let j = i + 1; j < es.length; j++) {
          const b = es[j]; if (b.dead || b.spawnT > 0) continue;
          const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy), min = a.r + b.r;
          if (d > 0 && d < min) {
            const push = (min - d) / 2, nx = dx / d, ny = dy / d;
            const wa = a.ai === 'turret' || a.boss ? 0 : 1, wb = b.ai === 'turret' || b.boss ? 0 : 1;
            const tot = wa + wb || 1;
            a.x -= nx * push * 2 * wa / tot; a.y -= ny * push * 2 * wa / tot;
            b.x += nx * push * 2 * wb / tot; b.y += ny * push * 2 * wb / tot;
          }
        }
      }
      if (es.some(e => e.dead)) this.enemies = es.filter(e => !e.dead);
    }

    // ── боссы ─────────────────────────────────────────────────
    _bossAI(e, dt, dist, ang, sf, stealth, aimX, aimY) {
      const h = this.hero;
      if (e.spawnT > 0) return;
      if (e.phase === 1 && e.hp < e.maxHp * 0.5) {
        e.phase = 2; e.inv = 1.0; e.st = 'roar'; e.stT = 1.0;
        this._banner(e.type === 'king' ? word('phase2') : tr(D.BOSSES[e.type].name) + ' !', '#f43f5e');
        this.shakeA = 10; snd('boss'); this.tele.length = 0;
        for (let k = 0; k < 24; k++) { const a = k * TAU / 24; this._shoot(e.x, e.y, a, 210, 8, e.dmg * 0.7, e.type === 'king' ? 'bone' : 'ring'); }
      }
      const fast = e.phase === 2 ? 1.4 : 1;
      e.swordA += angDiff(e.face + 0.9, e.swordA) * Math.min(1, dt * 6);
      if (e.type === 'warden') return this._warden(e, dt, dist, ang, sf, fast, stealth);
      return this._king(e, dt, dist, ang, sf, fast, stealth, aimX, aimY);
    }

    _warden(e, dt, dist, ang, sf, fast, stealth) {
      const h = this.hero;
      switch (e.st) {
        case 'roar': e.stT -= dt; if (e.stT <= 0) e.st = 'chase'; return;
        case 'chase':
          if (!stealth) e.face += angDiff(ang, e.face) * Math.min(1, dt * 5);
          if (dist > e.r + h.r + 10) this._moveToward(e, ang, e.speed * (stealth ? 0.65 : 1) * sf, dt);
          e.atkT -= dt * fast;
          if (e.atkT <= 0) {
            if (stealth) { e.st = 'slamW'; e.stT = 0.8; this.tele.push({ kind: 'circle', x: e.x, y: e.y, r: 155, t: 0, dur: 0.8 }); }
            else if (dist < 170) { e.st = 'sweepW'; e.stT = 0.5; e.coneA = ang; this.tele.push({ kind: 'cone', x: e.x, y: e.y, a: ang, arc: 2.4, r: 175, t: 0, dur: 0.5, follow: e }); }
            else if (Math.random() < 0.55) { e.st = 'chargeW'; e.stT = 0.75; e.chA = ang; e.chains = e.phase === 2 ? 1 : 0; this.tele.push({ kind: 'line', x: e.x, y: e.y, a: ang, len: 640, w: e.r * 2, t: 0, dur: 0.75 }); }
            else { e.st = 'slamW'; e.stT = 0.8; this.tele.push({ kind: 'circle', x: e.x, y: e.y, r: 155, t: 0, dur: 0.8 }); }
          }
          return;
        case 'sweepW':
          e.stT -= dt; e.face = e.coneA; e.swordA = e.coneA - 1.4;
          if (e.stT <= 0) {
            e.st = 'rec'; e.stT = 0.5; e.sweepT = 0.22;
            const a = Math.atan2(h.y - e.y, h.x - e.x);
            if (Math.hypot(h.x - e.x, h.y - e.y) < 175 + h.r && Math.abs(angDiff(a, e.coneA)) < 1.25) this._hurtHero(e.dmg * 1.2, a + Math.PI, false);
            this.shakeA = Math.max(this.shakeA, 5);
          }
          return;
        case 'chargeW':
          e.stT -= dt; e.face = e.chA;
          if (e.stT <= 0) { e.st = 'charge'; e.stT = 0.95; e.hitHero = false; }
          return;
        case 'charge': {
          e.stT -= dt;
          const ox = e.x, oy = e.y;
          e.x += Math.cos(e.chA) * 700 * dt; e.y += Math.sin(e.chA) * 700 * dt;
          this._collideWorld(e, false);
          if (Math.random() < 0.6) this._part(e.x, e.y, rand(-40, 40), rand(-40, 40), 0.35, 4, 'rgba(34,211,238,.8)');
          if (!e.hitHero && Math.hypot(h.x - e.x, h.y - e.y) < e.r + h.r) { e.hitHero = this._hurtHero(e.dmg * 1.3, e.chA + Math.PI, false); }
          const blocked = Math.hypot(e.x - ox, e.y - oy) < 700 * dt * 0.4;
          if (blocked) {
            e.st = 'stun'; e.stT = 0.8; this.shakeA = Math.max(this.shakeA, 9);
            this._burst(e.x, e.y, 22, ['#a8a29e', '#57534e', '#22d3ee'], 260, 4);
            if (e.phase === 2) for (let k = 0; k < 10; k++) { const a = k * TAU / 10; this._shoot(e.x, e.y, a, 190, 8, e.dmg * 0.7, 'ring'); }
          } else if (e.stT <= 0) {
            if (e.chains > 0) { e.chains--; e.st = 'chargeW'; e.stT = 0.45; e.chA = ang; this.tele.push({ kind: 'line', x: e.x, y: e.y, a: ang, len: 640, w: e.r * 2, t: 0, dur: 0.45 }); }
            else { e.st = 'rec'; e.stT = 0.45; }
          }
          return;
        }
        case 'slamW':
          e.stT -= dt;
          if (e.stT <= 0) {
            e.st = 'rec'; e.stT = 0.6;
            if (Math.hypot(h.x - e.x, h.y - e.y) < 155 + h.r) this._hurtHero(e.dmg * 1.2, ang + Math.PI, false);
            const n = e.phase === 2 ? 20 : 14;
            for (let k = 0; k < n; k++) { const a = k * TAU / n; this._shoot(e.x + Math.cos(a) * 40, e.y + Math.sin(a) * 40, a, 200, 8, e.dmg * 0.7, 'ring'); }
            this._ring(e.x, e.y, 155, '#22d3ee'); this.shakeA = Math.max(this.shakeA, 10);
            this._burst(e.x, e.y, 30, ['#a8a29e', '#22d3ee'], 280, 4);
          }
          return;
        case 'stun': case 'rec':
          e.stT -= dt; if (e.sweepT > 0) e.sweepT -= dt;
          if (e.stT <= 0) { e.st = 'chase'; e.atkT = rand(1.3, 2.1); }
          return;
      }
    }

    _king(e, dt, dist, ang, sf, fast, stealth, aimX, aimY) {
      const h = this.hero;
      e.wob += dt;
      e.summonCd -= dt;
      const hover = () => {
        // держится на дистанции ~260 и кружит
        const want = dist < 230 ? ang + Math.PI : dist > 320 ? ang : ang + Math.PI / 2;
        this._moveToward(e, want, e.speed * sf * (dist > 320 || dist < 230 ? 1 : 0.6), dt);
        e.face += angDiff(ang, e.face) * Math.min(1, dt * 4);
      };
      switch (e.st) {
        case 'roar': e.stT -= dt; if (e.stT <= 0) { e.st = 'chase'; e.atkT = 1; } return;
        case 'chase': {
          hover();
          e.atkT -= dt * fast;
          if (e.atkT <= 0) {
            const opts = stealth ? ['spray', 'spiral'] : ['spray', 'spears'];
            const minions = this.enemies.filter(o => !o.boss && !o.dead).length;
            if (e.summonCd <= 0 && minions < 3) opts.push('summon', 'summon');
            if (e.phase === 2 && !stealth) opts.push('spikes', 'spiral');
            else if (e.phase === 2) opts.push('spiral');
            const pick = opts[Math.floor(Math.random() * opts.length)];
            if (pick === 'spray') { e.st = 'sprayW'; e.stT = 0.45; e.bursts = 3; }
            else if (pick === 'spears') {
              e.st = 'spearsW'; e.stT = 0.9; e.spears = [];
              for (let k = 0; k < 3; k++) {
                const side = Math.floor(Math.random() * 3);
                const sx = side === 0 ? rand(40, RW - 40) : side === 1 ? 10 : RW - 10;
                const sy = side === 0 ? 10 : rand(40, RH - 40);
                const a = Math.atan2(h.y - sy + rand(-50, 50), h.x - sx + rand(-50, 50));
                e.spears.push({ x: sx, y: sy, a });
                this.tele.push({ kind: 'line', x: sx, y: sy, a, len: 1500, w: 20, t: 0, dur: 0.9 });
              }
            } else if (pick === 'summon') {
              e.st = 'rec'; e.stT = 0.8; e.summonCd = 9;
              const n = e.phase === 2 ? 3 : 2;
              for (let k = 0; k < n; k++) {
                const p = this._freeSpot(220); const m = this._makeEnemy('skel', p.x, p.y); m.spawnT = 0.9; this.enemies.push(m);
              }
            } else if (pick === 'spikes') { e.st = 'spikes'; e.stT = 0; e.bursts = 4; }
            else { e.st = 'spiral'; e.stT = 2.4; e.spiralA = ang; e.fireT = 0; }
          }
          return;
        }
        case 'sprayW':
          e.stT -= dt;
          if (e.stT <= 0) {
            const n = e.phase === 2 ? 22 : 16, off = (3 - e.bursts) * 0.2;
            for (let k = 0; k < n; k++) { const a = off + k * TAU / n; this._shoot(e.x + Math.cos(a) * 36, e.y + Math.sin(a) * 36, a, e.phase === 2 ? 215 : 190, 8, e.dmg * 0.7, 'bone'); }
            snd('shoot');
            e.bursts--; e.stT = 0.38;
            if (e.bursts <= 0) { e.st = 'rec'; e.stT = 0.6; }
          }
          return;
        case 'spearsW':
          e.stT -= dt; hover();
          if (e.stT <= 0) {
            for (const s of e.spears) this._shoot(s.x, s.y, s.a, 780, 10, e.dmg * 0.9, 'spear', 0, true);
            e.st = 'rec'; e.stT = 0.5; snd('shoot');
          }
          return;
        case 'spikes':
          e.stT -= dt; hover();
          if (e.stT <= 0 && e.bursts > 0) {
            e.bursts--; e.stT = 0.38;
            const x = h.x, y = h.y, dmg = e.dmg;
            this.tele.push({ kind: 'circle', x, y, r: 70, t: 0, dur: 0.7, fire: () => {
              if (Math.hypot(this.hero.x - x, this.hero.y - y) < 70 + this.hero.r * 0.6) this._hurtHero(dmg, null, false);
              this._burst(x, y, 14, ['#f5f5f4', '#d946ef'], 220, 3);
            } });
            if (e.bursts <= 0) { e.st = 'rec'; e.stT = 0.9; }
          }
          return;
        case 'spiral':
          e.stT -= dt; e.fireT -= dt;
          if (e.fireT <= 0) {
            e.fireT = 0.085; e.spiralA += 0.31;
            for (const o of [0, Math.PI]) this._shoot(e.x, e.y, e.spiralA + o, 175, 8, e.dmg * 0.6, 'bone');
          }
          if (e.stT <= 0) { e.st = 'rec'; e.stT = 0.7; }
          return;
        case 'rec':
          e.stT -= dt; hover();
          if (e.stT <= 0) { e.st = 'chase'; e.atkT = rand(1.1, 1.8); }
          return;
      }
    }

    // ── снаряды ───────────────────────────────────────────────
    _shoot(x, y, a, sp, r, dmg, kind, homing, ghost) {
      if (this.ebul.length > 260) return;
      this.ebul.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r, dmg, kind, life: ghost ? 3 : 5, hom: homing || 0, ghost: !!ghost, spin: rand(0, TAU) });
    }

    _blocked(x, y, r) {
      if (x < -r || y < -r || x > RW + r || y > RH + r) return true;
      for (const o of this.obst) if (x > o.x - r && x < o.x + o.w + r && y > o.y - r && y < o.y + o.h + r) return true;
      return false;
    }

    _updateBullets(dt) {
      const h = this.hero;
      const decoy = this.zones.find(z => z.kind === 'decoy' && z.life > 0);
      for (let i = this.ebul.length - 1; i >= 0; i--) {
        const b = this.ebul[i];
        b.life -= dt; b.spin += dt * 10;
        if (b.hom > 0) {
          b.hom -= dt;
          const tx = decoy ? decoy.x : (h.invisT > 0 ? h.lastSeenX : h.x);
          const ty = decoy ? decoy.y : (h.invisT > 0 ? h.lastSeenY : h.y);
          const sp = Math.hypot(b.vx, b.vy), a = Math.atan2(b.vy, b.vx), want = Math.atan2(ty - b.y, tx - b.x);
          const na = a + clamp(angDiff(want, a), -1.5 * dt, 1.5 * dt);
          b.vx = Math.cos(na) * sp; b.vy = Math.sin(na) * sp;
        }
        b.x += b.vx * dt; b.y += b.vy * dt;
        let gone = b.life <= 0;
        if (!gone && (b.ghost ? (b.x < -60 || b.y < -60 || b.x > RW + 60 || b.y > RH + 60) : this._blocked(b.x, b.y, 0))) {
          gone = true; if (!b.ghost) this._spark(b.x, b.y, b.kind === 'orb' ? '#e879f9' : '#d6d3d1');
        }
        if (!gone && decoy && Math.hypot(b.x - decoy.x, b.y - decoy.y) < b.r + 22) {
          gone = true; this._spark(b.x, b.y, '#38bdf8');
        }
        if (!gone && this.state === 'play' && Math.hypot(b.x - h.x, b.y - h.y) < b.r + h.r * 0.8) {
          if (this._hurtHero(b.dmg, Math.atan2(b.y - h.y, b.x - h.x), true)) gone = true;
        }
        if (gone) this.ebul.splice(i, 1);
      }
    }

    _updateHeroShots(dt) {
      for (let i = this.hshots.length - 1; i >= 0; i--) {
        const s = this.hshots[i];
        s.life -= dt;
        if (s.spin != null) s.spin += dt * 18;
        const nx = s.x + s.vx * dt, ny = s.y + s.vy * dt;
        s.dist = (s.dist || 0) + Math.hypot(nx - s.x, ny - s.y);
        let hitWall = false;
        if (s.bounce > 0) {
          let bx = this._blocked(nx, s.y, 0), by = this._blocked(s.x, ny, 0);
          if (bx || by) {
            if (bx) s.vx = -s.vx;
            if (by) s.vy = -s.vy;
            if (!bx && !by) { s.vx = -s.vx; s.vy = -s.vy; }
            s.x = clamp(s.x, 4, RW - 4); s.y = clamp(s.y, 4, RH - 4);
            s.a = Math.atan2(s.vy, s.vx);
            s.bounce--;
            if (s.hit) s.hit.clear();
            this._spark(s.x, s.y, '#86efac');
          } else {
            s.x = nx; s.y = ny;
          }
        } else {
          s.x = nx; s.y = ny;
          hitWall = this._blocked(s.x, s.y, 0);
        }
        let gone = s.life <= 0 || hitWall || (s.maxDist && s.dist >= s.maxDist);
        if (!gone) {
          for (const e of this.enemies) {
            if (e.dead || e.spawnT > 0) continue;
            if (s.hit && s.hit.has(e)) continue;
            if (Math.hypot(e.x - s.x, e.y - s.y) < e.r + s.r) {
              if (s.onHit) s.onHit(this, e, s);
              else this._damage(e, s.dmg, { kbA: s.a, kb: s.kb != null ? s.kb : 160, wave: s.kind === 'wave', heroAtk: true, forceCrit: s.forceCrit, critMul: s.critMul, poison: s.poison, bleed: s.bleed });
              if (s.pierce > 0) { s.pierce--; s.hit = s.hit || new Set(); s.hit.add(e); }
              else if (s.hit && s.pierce === undefined) s.hit.add(e);
              else { gone = true; break; }
            }
          }
        } else if (hitWall && s.onImpact) {
          s.onImpact(this, s);
        }
        if (gone) this.hshots.splice(i, 1);
      }
    }

    _updateZones(dt) {
      const h = this.hero;
      for (let i = this.zones.length - 1; i >= 0; i--) {
        const z = this.zones[i];
        z.life -= dt;
        if (z.life <= 0) { this.zones.splice(i, 1); continue; }
        if (z.kind === 'trap') {
          z.hitMap = z.hitMap || new Map();
          for (const e of this.enemies) {
            if (e.dead || e.spawnT > 0) continue;
            const prev = z.hitMap.get(e) || 0;
            if (prev > 0) { z.hitMap.set(e, prev - dt); continue; }
            if (Math.hypot(e.x - z.x, e.y - z.y) < e.r + z.r) {
              z.hitMap.set(e, 0.75);
              e.slowT = Math.max(e.slowT, 1.5);
              this._damage(e, this._heroDmg() * (1.25 + 0.4 * Math.max(0, (h.mods.trap || 1) - 1)), { kb: 40, heroAtk: true, col: '#4ade80' });
            }
          }
        } else if (z.kind === 'fire') {
          z.tick = (z.tick || 0) - dt;
          if (z.tick <= 0) {
            z.tick = 0.25;
            for (const e of this.enemies) {
              if (e.dead || e.spawnT > 0) continue;
              if (Math.hypot(e.x - z.x, e.y - z.y) < e.r + z.r) {
                e.burnT = Math.max(e.burnT, 2);
                e.burnD = Math.max(e.burnD, this._heroDmg() * 0.22 * (h.mods.fireTrail || 1));
                this._damage(e, this._heroDmg() * 0.28 * (h.mods.fireTrail || 1), { kb: 0, noCharge: true });
              }
            }
          }
        }
      }
    }

    _updateBolts(dt) {
      for (let i = this.bolts.length - 1; i >= 0; i--) {
        this.bolts[i].life -= dt;
        if (this.bolts[i].life <= 0) this.bolts.splice(i, 1);
      }
    }

    _updateTele(dt) {
      for (let i = this.tele.length - 1; i >= 0; i--) {
        const t = this.tele[i];
        t.t += dt;
        if (t.follow) { t.x = t.follow.x; t.y = t.follow.y; if (t.follow.dead) t.t = t.dur; }
        if (t.t >= t.dur) { if (t.fire) t.fire(); this.tele.splice(i, 1); }
      }
    }

    _updateOrbs(dt) {
      const h = this.hero, all = this.roomState !== 'fight';
      for (let i = this.orbs.length - 1; i >= 0; i--) {
        const o = this.orbs[i];
        o.t += dt;
        const dx = h.x - o.x, dy = h.y - o.y, d = Math.hypot(dx, dy);
        if (o.t > 0.35 && (all || d < 140)) {
          const sp = 380 + o.t * 500;
          o.vx += (dx / d * sp - o.vx) * Math.min(1, dt * 8); o.vy += (dy / d * sp - o.vy) * Math.min(1, dt * 8);
        } else { const k = Math.pow(0.03, dt); o.vx *= k; o.vy *= k; }
        o.x += o.vx * dt; o.y += o.vy * dt;
        o.x = clamp(o.x, 5, RW - 5); o.y = clamp(o.y, 5, RH - 5);
        if (d < h.r + 8 && this.state === 'play') {
          this.orbs.splice(i, 1); snd('orb');
          h.xp++;
          if (h.xp >= this._xpNeed()) { h.xp = 0; h.lvl++; this.pendingPicks++; this._lvlFx(); }
        }
      }
    }
    _xpNeed() { return 4 + this.hero.lvl * 3; }
    _lvlFx() {
      const h = this.hero;
      this._float(h.x, h.y - 46, word('lvl'), '#67e8f9', 18);
      this._ring(h.x, h.y, 70, '#67e8f9'); snd('level');
    }

    // ── выбор карт ────────────────────────────────────────────
    _openPick() {
      this.picking = true; this.frozen = true; this.input.reset();
      this.render();
      const choices = this.rollCards();
      if (this.cb.onCards) this.cb.onCards(choices);
    }

    rollCards() {
      const h = this.hero;
      const pool = D.CARDS.filter(c => c.id !== 'heal' && (!c.cls || c.cls === h.cls) && (h.cards[c.id] || 0) < c.max);
      for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
      const out = pool.slice(0, 3);
      const heal = D.CARDS.find(c => c.id === 'heal');
      if (h.hp < h.maxHp * 0.6 && Math.random() < 0.6 && out.length) out[out.length - 1] = heal;
      while (out.length < 3) out.push(heal);
      return out.map(c => ({ id: c.id, icon: c.icon, cls: c.cls || null, name: tr(c.name), desc: tr(c.desc), lvl: (h.cards[c.id] || 0) + 1, max: c.max }));
    }

    pickCard(id) {
      if (!this.picking) return;
      this.applyCard(id);
      this.pendingPicks = Math.max(0, this.pendingPicks - 1);
      this.picking = false; this.frozen = false; this.lastTs = performance.now();
    }

    applyCard(id) {
      const h = this.hero, m = h.mods;
      h.cards[id] = (h.cards[id] || 0) + 1;
      switch (id) {
        case 'dmg': m.dmg += 0.2; break;
        case 'rate': m.rate += 0.15; break;
        case 'hp': { const inc = Math.round(h.maxHp * 0.25); h.maxHp += inc; h.hp = Math.min(h.maxHp, h.hp + inc + Math.round(h.maxHp * 0.1)); break; }
        case 'speed': m.speed += 0.12; break;
        case 'crit': m.crit += 0.12; break;
        case 'dashcd': m.dashMul *= 0.75; break;
        case 'orbit': m.orbit++; break;
        case 'fire': m.fire++; break;
        case 'frost': m.frost++; break;
        case 'leech': m.leech++; break;
        case 'heal': h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * 0.4)); break;
        case 'wave': m.wave++; break;
        case 'wide': m.wide++; break;
        case 'reflect': m.reflect = 1; break;
        case 'crush': m.crush++; break;
        case 'spin': m.spin = 1; break;
        case 'double_shot': m.doubleShot++; break;
        case 'pierce': m.pierce++; break;
        case 'r_poison': m.rPoison++; break;
        case 'trap': m.trap++; break;
        case 'eagle': m.eagle++; m.crit += 0.15; break;
        case 'chain': m.chain++; break;
        case 'ice_nova': m.iceNova++; break;
        case 'big_ball': m.bigBall++; break;
        case 'mana_shield': m.manaShield = 1; break;
        case 'fire_trail': m.fireTrail++; break;
        case 'fan_knives': m.fanKnives++; break;
        case 'bleed': m.bleed++; break;
        case 'shadow_clone': m.shadowClone++; break;
        case 'exec_dash': m.execDash = 1; break;
        case 's_poison': m.sPoison++; break;
      }
    }

    // ── мир и столкновения ────────────────────────────────────
    _collideWorld(e, isHero) {
      for (const o of this.obst) {
        const cx = clamp(e.x, o.x, o.x + o.w), cy = clamp(e.y, o.y, o.y + o.h);
        const dx = e.x - cx, dy = e.y - cy, d2 = dx * dx + dy * dy;
        if (d2 < e.r * e.r) {
          if (d2 > 0.0001) { const d = Math.sqrt(d2), p = e.r - d; e.x += dx / d * p; e.y += dy / d * p; }
          else { // центр внутри прямоугольника — выталкиваем к ближайшей стороне
            const l = e.x - o.x, r = o.x + o.w - e.x, t = e.y - o.y, b = o.y + o.h - e.y, m = Math.min(l, r, t, b);
            if (m === l) e.x = o.x - e.r; else if (m === r) e.x = o.x + o.w + e.r; else if (m === t) e.y = o.y - e.r; else e.y = o.y + o.h + e.r;
          }
        }
      }
      const doorOpen = isHero && this.door && this.door.open && Math.abs(e.x - RW / 2) < DOOR_W / 2 - e.r * 0.5;
      e.x = clamp(e.x, e.r, RW - e.r);
      e.y = clamp(e.y, doorOpen ? -60 : e.r, RH - e.r);
    }

    _updateCamera(dt) {
      const h = this.hero, v = this._view();
      const tx = v.w >= RW + WALL * 2 ? (RW - v.w) / 2 : clamp(h.x - v.w / 2, -WALL, RW + WALL - v.w);
      const ty = v.h >= RH + WALL * 2 ? (RH - v.h) / 2 : clamp(h.y - v.h / 2, -WALL, RH + WALL - v.h);
      const k = Math.min(1, dt * 7);
      this.cam.x += (tx - this.cam.x) * k; this.cam.y += (ty - this.cam.y) * k;
      this.shakeA = Math.max(0, this.shakeA - dt * 30);
    }

    // ── эффекты ───────────────────────────────────────────────
    _part(x, y, vx, vy, life, size, color, ring) {
      const p = this.parts[this.partI]; this.partI = (this.partI + 1) % MAX_PART;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy; p.life = p.max = life; p.size = size; p.color = color; p.ring = ring || 0;
    }
    _burst(x, y, n, cols, sp, size) {
      if (REDUCED) n = Math.ceil(n / 2);
      for (let i = 0; i < n; i++) {
        const a = Math.random() * TAU, s = sp * (0.3 + Math.random() * 0.7);
        this._part(x, y, Math.cos(a) * s, Math.sin(a) * s, rand(0.25, 0.6), size * rand(0.6, 1.2), cols[i % cols.length]);
      }
    }
    _spark(x, y, c) { this._burst(x, y, 6, [c, '#ffffff'], 180, 2.4); }
    _ring(x, y, r, c) { this._part(x, y, 0, 0, 0.4, r, c, 1); }
    _float(x, y, text, color, size) {
      const f = this.floats[this.floatI]; this.floatI = (this.floatI + 1) % MAX_FLOAT;
      f.x = x; f.y = y; f.text = text; f.color = color; f.size = size; f.life = f.max = 0.8;
    }
    _updateFx(dt) {
      for (const p of this.parts) {
        if (p.life <= 0) continue;
        p.life -= dt;
        if (!p.ring) { p.x += p.vx * dt; p.y += p.vy * dt; const k = Math.pow(0.04, dt); p.vx *= k; p.vy *= k; }
      }
      for (const f of this.floats) { if (f.life > 0) { f.life -= dt; f.y -= 38 * dt; } }
    }

    // ── отрисовка ─────────────────────────────────────────────
    render() {
      const g = this.ctx, h = this.hero;
      if (!h) return;
      const s = this.scale * this.dpr;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.fillStyle = '#05030a'; g.fillRect(0, 0, this.canvas.width, this.canvas.height);
      const sh = REDUCED ? 0 : this.shakeA;
      const sx = sh ? rand(-sh, sh) : 0, sy = sh ? rand(-sh, sh) : 0;
      const cx = this.cam.x + sx / this.scale, cy = this.cam.y + sy / this.scale;
      g.setTransform(s, 0, 0, s, -cx * s, -cy * s);
      const t = performance.now() / 1000;

      g.drawImage(this.bg.c, -WALL, -WALL, RW + WALL * 2, RH + WALL * 2);
      this._drawDoor(g, t);
      this._drawTorches(g, t);
      this._drawZones(g, t);
      this._drawTele(g);

      // сферы опыта
      g.globalCompositeOperation = 'lighter';
      const og = SP.glow('rgba(103,232,249,1)', 32);
      for (const o of this.orbs) { g.drawImage(og, o.x - 12, o.y - 12, 24, 24); }
      g.globalCompositeOperation = 'source-over';
      g.fillStyle = '#ecfeff';
      for (const o of this.orbs) { g.beginPath(); g.arc(o.x, o.y, 3, 0, TAU); g.fill(); }

      // тени
      g.fillStyle = 'rgba(0,0,0,.4)';
      for (const e of this.enemies) { if (e.spawnT > 0.35) continue; g.beginPath(); g.ellipse(e.x + 3, e.y + e.r * 0.75, e.r * 0.95, e.r * 0.42, 0, 0, TAU); g.fill(); }
      if (this.state !== 'dead') { g.beginPath(); g.ellipse(h.x + 3, h.y + 16, 20, 9, 0, 0, TAU); g.fill(); }

      // сущности по глубине
      const list = this._drawList; list.length = 0;
      for (const e of this.enemies) list.push(e);
      if (this.state !== 'dead') list.push(h);
      list.sort((a, b) => a.y - b.y);
      for (const o of list) { if (o === h) this._drawHero(g, t); else this._drawEnemy(g, o, t); }

      this._drawBullets(g, t);
      this._drawHeroShots(g);
      this._drawBolts(g);
      this._drawParts(g);
      this._drawFloats(g);

      // свет: виньетка вокруг героя
      g.setTransform(1, 0, 0, 1, 0, 0);
      const hs = this._heroScreen();
      const hx = hs.x * this.dpr, hy = hs.y * this.dpr, R = Math.max(this.canvas.width, this.canvas.height) * 0.95;
      g.drawImage(this._vig, hx - R, hy - R, R * 2, R * 2);
      g.fillStyle = 'rgba(4,2,10,.82)';
      const W = this.canvas.width, H = this.canvas.height;
      if (hx - R > 0) g.fillRect(0, 0, hx - R, H);
      if (hx + R < W) g.fillRect(hx + R, 0, W - hx - R, H);
      if (hy - R > 0) g.fillRect(0, 0, W, hy - R);
      if (hy + R < H) g.fillRect(0, hy + R, W, H - hy - R);
      // боль и мало здоровья
      const low = h.hp < h.maxHp * 0.3 ? 0.18 + 0.12 * Math.sin(t * 6) : 0;
      const hurt = Math.max(0, h.hurtT) * 1.2;
      if (low + hurt > 0) {
        const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.3, W / 2, H / 2, Math.max(W, H) * 0.7);
        gr.addColorStop(0, 'rgba(220,38,38,0)'); gr.addColorStop(1, `rgba(220,38,38,${Math.min(0.6, low + hurt)})`);
        g.fillStyle = gr; g.fillRect(0, 0, W, H);
      }
      g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this._drawSticks(g);
      this._drawBanner(g);
      if (this.fade > 0) { g.fillStyle = `rgba(5,3,10,${this.fade})`; g.fillRect(0, 0, this.vw, this.vh); }
    }

    _drawDoor(g, t) {
      const x = RW / 2, y0 = -WALL, w = DOOR_W;
      g.fillStyle = '#0a0710'; g.fillRect(x - w / 2, y0 + 10, w, WALL - 10);
      // арка
      g.strokeStyle = '#6b6578'; g.lineWidth = 10;
      g.beginPath(); g.moveTo(x - w / 2 - 4, 0); g.lineTo(x - w / 2 - 4, y0 + 34); g.arc(x, y0 + 34, w / 2 + 4, Math.PI, 0); g.lineTo(x + w / 2 + 4, 0); g.stroke();
      if (this.door.open) {
        const p = Math.min(1, this.door.t * 2);
        const gr = g.createLinearGradient(x - w / 2, 0, x + w / 2, 0);
        gr.addColorStop(0, 'rgba(217,70,239,.85)'); gr.addColorStop(0.5, 'rgba(240,253,255,.95)'); gr.addColorStop(1, 'rgba(34,211,238,.85)');
        g.globalAlpha = p; g.fillStyle = gr;
        g.beginPath(); g.moveTo(x - w / 2, 0); g.lineTo(x - w / 2, y0 + 34); g.arc(x, y0 + 34, w / 2, Math.PI, 0); g.lineTo(x + w / 2, 0); g.closePath(); g.fill();
        g.strokeStyle = 'rgba(255,255,255,.7)'; g.lineWidth = 2;
        for (let k = 0; k < 4; k++) {
          const yy = ((t * 60 + k * 20) % 80);
          g.beginPath(); g.moveTo(x - w / 2 + 10, -yy); g.lineTo(x + w / 2 - 10, -yy); g.stroke();
        }
        g.globalCompositeOperation = 'lighter';
        g.drawImage(SP.glow('rgba(103,232,249,1)', 128), x - 150, -110, 300, 260);
        g.globalCompositeOperation = 'source-over';
        g.globalAlpha = 1;
        // стрелка-подсказка
        const a = 0.5 + 0.5 * Math.sin(t * 5);
        g.fillStyle = `rgba(103,232,249,${0.4 + a * 0.5})`;
        g.beginPath(); g.moveTo(x, 34 - a * 8); g.lineTo(x - 16, 56 - a * 8); g.lineTo(x + 16, 56 - a * 8); g.closePath(); g.fill();
      } else {
        g.strokeStyle = '#3f3a4a'; g.lineWidth = 6;
        for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(x + k * 22, y0 + 20); g.lineTo(x + k * 22, 0); g.stroke(); }
        g.strokeStyle = '#2a2633'; g.beginPath(); g.moveTo(x - w / 2, -24); g.lineTo(x + w / 2, -24); g.stroke();
      }
    }

    _drawTorches(g, t) {
      const xs = [RW * 0.14, RW * 0.32, RW * 0.68, RW * 0.86];
      for (let i = 0; i < xs.length; i++) {
        const x = xs[i], y = -WALL + 38;
        const fl = 0.85 + 0.15 * Math.sin(t * 11 + i * 2.1) + 0.08 * Math.sin(t * 23 + i);
        g.fillStyle = '#3f3a4a'; g.fillRect(x - 3, y, 6, 18);
        g.globalCompositeOperation = 'lighter';
        const R = 170 * fl;
        g.globalAlpha = 0.55;
        g.drawImage(SP.glow('rgba(251,146,60,1)', 128), x - R, y - R * 0.6, R * 2, R * 2);
        g.globalAlpha = 1;
        g.fillStyle = '#fbbf24';
        g.beginPath(); g.ellipse(x, y - 4, 5 * fl, 10 * fl, 0, 0, TAU); g.fill();
        g.fillStyle = '#fff7ed';
        g.beginPath(); g.ellipse(x, y - 1, 2.4, 5, 0, 0, TAU); g.fill();
        g.globalCompositeOperation = 'source-over';
      }
    }

    _drawTele(g) {
      for (const tl of this.tele) {
        const p = clamp(tl.t / tl.dur, 0, 1);
        g.save(); g.translate(tl.x, tl.y);
        if (tl.kind === 'line') {
          g.rotate(tl.a);
          g.fillStyle = 'rgba(239,68,68,.14)'; g.fillRect(0, -tl.w / 2, tl.len, tl.w);
          g.fillStyle = 'rgba(239,68,68,.32)'; g.fillRect(0, -tl.w / 2, tl.len * p, tl.w);
          g.strokeStyle = 'rgba(248,113,113,.7)'; g.lineWidth = 2; g.strokeRect(0, -tl.w / 2, tl.len, tl.w);
        } else if (tl.kind === 'circle') {
          g.fillStyle = tl.fill0 || 'rgba(239,68,68,.12)'; g.beginPath(); g.arc(0, 0, tl.r, 0, TAU); g.fill();
          g.fillStyle = tl.fill1 || 'rgba(239,68,68,.3)'; g.beginPath(); g.arc(0, 0, tl.r * p, 0, TAU); g.fill();
          g.strokeStyle = tl.stroke || 'rgba(248,113,113,.8)'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, tl.r, 0, TAU); g.stroke();
        } else if (tl.kind === 'cone') {
          g.fillStyle = 'rgba(239,68,68,.14)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, tl.r, tl.a - tl.arc / 2, tl.a + tl.arc / 2); g.closePath(); g.fill();
          g.fillStyle = 'rgba(239,68,68,.32)'; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, tl.r * p, tl.a - tl.arc / 2, tl.a + tl.arc / 2); g.closePath(); g.fill();
        }
        g.restore();
      }
    }

    _drawSprite(g, key, x, y, a, sc, flash) {
      const sp = SP.get(key); if (!sp) return;
      const half = sp.half * sc;
      g.save(); g.translate(x, y); if (a) g.rotate(a);
      g.drawImage(sp.c, -half, -half, half * 2, half * 2);
      if (flash > 0) { g.globalAlpha = Math.min(1, flash * 9); g.drawImage(sp.white, -half, -half, half * 2, half * 2); }
      g.restore();
    }

    _drawHero(g, t) {
      const h = this.hero, spKey = 'hero_' + h.cls;
      // шлейф рывка/тарана
      for (const tr0 of h.trail) {
        g.globalAlpha = tr0.life * 2.2;
        this._drawSprite(g, spKey, tr0.x, tr0.y, tr0.a, 1, 1);
      }
      g.globalAlpha = 1;
      if (h.inv > 0 && h.hurtT > -0.2 && Math.floor(t * 20) % 2 === 0 && !h.lockMove && h.dashT <= 0) g.globalAlpha = 0.45;
      // летающие клинки
      if (h.mods.orbit) {
        for (let k = 0; k < h.mods.orbit; k++) {
          const a = h.orbitA + k * TAU / h.mods.orbit;
          const sp = SP.get('sword');
          g.save(); g.translate(h.x + Math.cos(a) * 78, h.y + Math.sin(a) * 78); g.rotate(a + Math.PI / 2 + t * 8);
          g.drawImage(sp.c, -sp.half * 0.55, -sp.half * 0.55, sp.half * 1.1, sp.half * 1.1); g.restore();
        }
      }
      const bob = h.moving ? 1 + Math.sin(h.walkT * 14) * 0.035 : 1;
      const hurtFlash = h.hurtT > 0.2 ? h.hurtT - 0.2 : 0;
      if (h.kit && h.kit.draw) h.kit.draw(this, g, t, bob, hurtFlash);
      else this._drawSprite(g, spKey, h.x, h.y, h.face, bob, hurtFlash);
      g.globalAlpha = 1;
    }

    _drawEnemy(g, e, t) {
      if (e.spawnT > 0) {
        const p = 1 - e.spawnT / (e.boss ? 1.0 : 0.7);
        g.save(); g.translate(e.x, e.y); g.rotate(t * 3);
        g.strokeStyle = `rgba(217,70,239,${0.3 + 0.5 * p})`; g.lineWidth = 3;
        g.beginPath(); g.arc(0, 0, e.r * 1.6, 0, TAU); g.stroke();
        for (let k = 0; k < 5; k++) { const a = k * TAU / 5; g.beginPath(); g.moveTo(Math.cos(a) * e.r * 1.6, Math.sin(a) * e.r * 1.6); g.lineTo(Math.cos(a + 2.5) * e.r * 1.6, Math.sin(a + 2.5) * e.r * 1.6); g.stroke(); }
        g.restore();
        if (p < 0.5) return;
        g.globalAlpha = (p - 0.5) * 2;
      }
      const fl = e.flash;
      // телеграфы, привязанные к врагу
      if (e.st === 'aim') {
        const p = 1 - e.stT / 0.7;
        g.strokeStyle = `rgba(248,113,113,${0.25 + 0.55 * p})`; g.lineWidth = 1.5 + p * 2;
        g.setLineDash([10, 8]); g.beginPath(); g.moveTo(e.x, e.y); g.lineTo(e.x + Math.cos(e.aimA) * 600, e.y + Math.sin(e.aimA) * 600); g.stroke(); g.setLineDash([]);
      }
      if (e.st === 'wind' || e.st === 'tele' || e.st === 'charge' && e.ai === 'turret' || e.st === 'cast') {
        g.globalCompositeOperation = 'lighter';
        const col = e.st === 'cast' ? 'rgba(232,121,249,1)' : 'rgba(239,68,68,1)';
        const R = e.r * 2.4;
        g.drawImage(SP.glow(col, 48), e.x - R, e.y - R, R * 2, R * 2);
        g.globalCompositeOperation = 'source-over';
      }
      if (e.slowT > 0) { g.strokeStyle = 'rgba(125,211,252,.7)'; g.lineWidth = 2; g.beginPath(); g.ellipse(e.x, e.y + e.r * 0.6, e.r, e.r * 0.4, 0, 0, TAU); g.stroke(); }
      switch (e.type) {
        case 'skel': case 'archer': case 'warlock': {
          let a = e.face;
          if (e.type === 'skel' && e.slashT > 0) a += Math.sin((0.16 - e.slashT) / 0.16 * Math.PI) * 0.8;
          const shake = e.st === 'wind' ? rand(-1.5, 1.5) : 0;
          this._drawSprite(g, e.type, e.x + shake, e.y, a, 1, fl);
          break;
        }
        case 'bat': this._drawSprite(g, Math.sin(t * 22 + e.wob) > 0 ? 'bat0' : 'bat1', e.x + (e.st === 'tele' ? rand(-2, 2) : 0), e.y, e.face, 1, fl); break;
        case 'slime': case 'slimelet': {
          const sc = e.r / 23, sq = e.hopT > 0 ? 1 + Math.sin(e.hopT / 0.35 * Math.PI) * 0.18 : 1 + Math.sin(t * 4 + e.wob) * 0.04;
          const sp = SP.get('slime'), half = sp.half * sc;
          g.save(); g.translate(e.x, e.y); g.scale(1 / sq, sq);
          g.drawImage(sp.c, -half, -half, half * 2, half * 2);
          if (fl > 0) { g.globalAlpha = Math.min(1, fl * 9); g.drawImage(sp.white, -half, -half, half * 2, half * 2); }
          g.restore();
          break;
        }
        case 'totem': {
          this._drawSprite(g, 'totem', e.x, e.y, 0, 1, fl);
          g.globalCompositeOperation = 'lighter';
          const k = e.st === 'charge' ? 1 - e.stT / 0.55 : 0.2 + 0.1 * Math.sin(t * 3);
          g.globalAlpha = k; g.drawImage(SP.glow('rgba(244,63,94,1)', 48), e.x - 40, e.y - 40, 80, 80); g.globalAlpha = 1;
          g.globalCompositeOperation = 'source-over';
          break;
        }
        case 'warden': {
          const gs = SP.get('greatsword');
          let sa = e.swordA;
          if (e.sweepT > 0) sa = e.coneA - 1.4 + (1 - e.sweepT / 0.22) * 2.8;
          if (e.st === 'charge' || e.st === 'chargeW') sa = e.chA;
          g.save(); g.translate(e.x, e.y); g.rotate(sa); g.translate(14, 0);
          g.drawImage(gs.c, -gs.half * 0.8, -gs.half * 0.8, gs.half * 1.6, gs.half * 1.6); g.restore();
          this._drawSprite(g, 'warden', e.x, e.y, e.face, 1, fl);
          if (e.st === 'stun') { g.fillStyle = '#fde047'; for (let k = 0; k < 3; k++) { const a = t * 5 + k * TAU / 3; g.beginPath(); g.arc(e.x + Math.cos(a) * 26, e.y - 46 + Math.sin(a) * 8, 3.5, 0, TAU); g.fill(); } }
          break;
        }
        case 'king': {
          g.globalCompositeOperation = 'lighter';
          g.globalAlpha = 0.5 + 0.2 * Math.sin(t * 3);
          g.drawImage(SP.glow(e.phase === 2 ? 'rgba(244,63,94,1)' : 'rgba(217,70,239,1)', 96), e.x - 110, e.y - 110, 220, 220);
          g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
          this._drawSprite(g, 'king', e.x, e.y + Math.sin(t * 2) * 3, e.face, 1, fl);
          if (e.inv > 0) { g.strokeStyle = 'rgba(244,63,94,.7)'; g.lineWidth = 3; g.beginPath(); g.arc(e.x, e.y, e.r + 14, 0, TAU); g.stroke(); }
          break;
        }
      }
      if (e.burnT > 0 && Math.random() < 0.3) this._part(e.x + rand(-e.r, e.r) * 0.5, e.y, 0, -50, 0.3, 2.5, '#fb923c');
      if (e.elemCharges > 0) {
        g.fillStyle = '#e879f9';
        for (let k = 0; k < e.elemCharges; k++) {
          const a = t * 4 + k * TAU / 5;
          g.beginPath(); g.arc(e.x + Math.cos(a) * (e.r + 7), e.y + Math.sin(a) * (e.r + 7), 2.5, 0, TAU); g.fill();
        }
      }
      // полоска здоровья
      if (!e.boss && e.hp < e.maxHp) {
        const w = Math.max(26, e.r * 2), y = e.y - e.r - 12;
        g.fillStyle = 'rgba(0,0,0,.6)'; g.fillRect(e.x - w / 2 - 1, y - 1, w + 2, 6);
        g.fillStyle = '#ef4444'; g.fillRect(e.x - w / 2, y, w * Math.max(0, e.hp / e.maxHp), 4);
      }
      g.globalAlpha = 1;
    }

    _drawBullets(g, t) {
      g.globalCompositeOperation = 'lighter';
      for (const b of this.ebul) {
        const col = b.kind === 'orb' ? 'rgba(232,121,249,1)' : b.kind === 'ring' ? 'rgba(244,63,94,1)' : b.kind === 'spear' ? 'rgba(34,211,238,1)' : b.kind === 'bone' ? 'rgba(216,180,254,1)' : 'rgba(163,230,53,1)';
        const R = b.r * 3.2;
        g.drawImage(SP.glow(col, 32), b.x - R, b.y - R, R * 2, R * 2);
      }
      g.globalCompositeOperation = 'source-over';
      for (const b of this.ebul) {
        const a = Math.atan2(b.vy, b.vx);
        g.save(); g.translate(b.x, b.y);
        if (b.kind === 'arrow') {
          g.rotate(a); g.strokeStyle = '#e7e5e4'; g.lineWidth = 2.4; g.beginPath(); g.moveTo(-16, 0); g.lineTo(6, 0); g.stroke();
          g.fillStyle = '#a3e635'; g.beginPath(); g.moveTo(10, 0); g.lineTo(3, -4); g.lineTo(3, 4); g.closePath(); g.fill();
        } else if (b.kind === 'bone') {
          g.rotate(b.spin); g.strokeStyle = '#f5f5f4'; g.lineWidth = 3.6; g.beginPath(); g.moveTo(-7, 0); g.lineTo(7, 0); g.stroke();
          g.fillStyle = '#f5f5f4'; for (const x of [-8, 8]) for (const y of [-2.5, 2.5]) { g.beginPath(); g.arc(x, y, 2.4, 0, TAU); g.fill(); }
        } else if (b.kind === 'spear') {
          g.rotate(a); g.fillStyle = '#e0f2fe'; g.fillRect(-34, -2.5, 40, 5);
          g.beginPath(); g.moveTo(16, 0); g.lineTo(4, -6); g.lineTo(4, 6); g.closePath(); g.fill();
        } else {
          g.fillStyle = b.kind === 'orb' ? '#fdf4ff' : '#fecdd3';
          g.beginPath(); g.arc(0, 0, b.r * 0.62, 0, TAU); g.fill();
        }
        g.restore();
      }
    }

    _drawZones(g, t) {
      for (const z of this.zones) {
        const a = Math.min(1, z.life * 2);
        g.save(); g.translate(z.x, z.y); g.globalAlpha = a;
        if (z.kind === 'trap') {
          g.fillStyle = 'rgba(22,163,74,.22)'; g.beginPath(); g.arc(0, 0, z.r, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(74,222,128,.65)'; g.lineWidth = 1.6; g.stroke();
          g.fillStyle = '#cbd5e1';
          for (let k = 0; k < 6; k++) {
            const ang = k * TAU / 6, px = Math.cos(ang) * z.r * 0.52, py = Math.sin(ang) * z.r * 0.52;
            g.beginPath(); g.moveTo(px, py - 5); g.lineTo(px - 3, py + 3); g.lineTo(px + 3, py + 3); g.closePath(); g.fill();
          }
        } else if (z.kind === 'fire') {
          const pul = 0.9 + 0.1 * Math.sin(t * 14 + z.x);
          g.fillStyle = 'rgba(249,115,22,.28)'; g.beginPath(); g.arc(0, 0, z.r * pul, 0, TAU); g.fill();
          g.fillStyle = 'rgba(251,191,36,.35)'; g.beginPath(); g.arc(0, 0, z.r * 0.55 * pul, 0, TAU); g.fill();
        } else if (z.kind === 'decoy') {
          g.globalAlpha = 0.48 + 0.16 * Math.sin(t * 10);
          g.strokeStyle = '#38bdf8'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, 26, 0, TAU); g.stroke();
          this._drawSprite(g, 'hero_shade', 0, 0, z.a || 0, 1, 0);
        }
        g.restore();
      }
      g.globalAlpha = 1;
    }

    _drawBolts(g) {
      for (const b of this.bolts) {
        g.save();
        g.globalAlpha = clamp(b.life / 0.16, 0, 1);
        g.strokeStyle = b.color || '#c084fc';
        g.lineWidth = 3.2;
        g.beginPath();
        g.moveTo(b.x1, b.y1);
        const mx = (b.x1 + b.x2) / 2 + (b.ox || 0), my = (b.y1 + b.y2) / 2 + (b.oy || 0);
        g.lineTo(mx, my); g.lineTo(b.x2, b.y2);
        g.stroke();
        g.strokeStyle = '#fff'; g.lineWidth = 1.2; g.stroke();
        g.restore();
      }
    }

    _drawHeroShots(g) {
      for (const s of this.hshots) {
        g.save(); g.translate(s.x, s.y);
        if (s.kind === 'wave') {
          g.rotate(s.a);
          const al = Math.min(1, s.life * 3);
          g.strokeStyle = `rgba(254,243,199,${0.9 * al})`; g.lineWidth = 5;
          g.beginPath(); g.arc(-s.r * 0.6, 0, s.r, -1.1, 1.1); g.stroke();
          g.strokeStyle = `rgba(251,191,36,${0.45 * al})`; g.lineWidth = 12;
          g.beginPath(); g.arc(-s.r * 0.6 - 6, 0, s.r, -1.0, 1.0); g.stroke();
        } else if (s.kind === 'arrow' || s.kind === 'volley') {
          g.rotate(s.a);
          const col = s.kind === 'volley' ? '#86efac' : '#4ade80';
          g.strokeStyle = '#fef3c7'; g.lineWidth = 2.4;
          g.beginPath(); g.moveTo(-14, 0); g.lineTo(6, 0); g.stroke();
          g.fillStyle = col;
          g.beginPath(); g.moveTo(14, 0); g.lineTo(4, -4.5); g.lineTo(6.5, 0); g.lineTo(4, 4.5); g.closePath(); g.fill();
          g.strokeStyle = col; g.lineWidth = 1.6;
          g.beginPath(); g.moveTo(-12, 0); g.lineTo(-17, -3.5); g.moveTo(-12, 0); g.lineTo(-17, 3.5); g.stroke();
        } else if (s.kind === 'fireball') {
          g.rotate(s.a);
          g.fillStyle = 'rgba(249,115,22,.45)'; g.beginPath(); g.ellipse(-6, 0, s.r * 1.4, s.r * 0.85, 0, 0, TAU); g.fill();
          g.fillStyle = '#a855f7'; g.beginPath(); g.arc(0, 0, s.r * 0.9, 0, TAU); g.fill();
          g.fillStyle = '#fde68a'; g.beginPath(); g.arc(2, 0, s.r * 0.48, 0, TAU); g.fill();
        } else if (s.kind === 'dagger') {
          g.rotate(s.spin != null ? s.spin : s.a);
          const dag = SP.get('dagger');
          if (dag) g.drawImage(dag.c, -dag.half * 0.9, -dag.half * 0.9, dag.half * 1.8, dag.half * 1.8);
          else { g.fillStyle = '#38bdf8'; g.fillRect(-10, -2, 20, 4); }
        } else {
          g.rotate(s.a);
          g.fillStyle = '#fde68a'; g.beginPath(); g.arc(0, 0, s.r * 0.7, 0, TAU); g.fill();
          g.strokeStyle = 'rgba(251,191,36,.6)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-18, 0); g.lineTo(0, 0); g.stroke();
        }
        g.restore();
      }
    }

    _drawParts(g) {
      for (const p of this.parts) {
        if (p.life <= 0) continue;
        const k = p.life / p.max;
        if (p.ring) {
          g.strokeStyle = p.color; g.globalAlpha = k; g.lineWidth = 4 * k + 1;
          g.beginPath(); g.arc(p.x, p.y, p.size * (1.15 - k * 0.5), 0, TAU); g.stroke();
        } else {
          g.globalAlpha = Math.min(1, k * 1.5); g.fillStyle = p.color;
          const s = p.size * (0.5 + k * 0.5);
          g.fillRect(p.x - s / 2, p.y - s / 2, s, s);
        }
      }
      g.globalAlpha = 1;
    }

    _drawFloats(g) {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const f of this.floats) {
        if (f.life <= 0) continue;
        const k = f.life / f.max, pop = k > 0.85 ? 1 + (k - 0.85) * 3 : 1;
        g.globalAlpha = Math.min(1, k * 2);
        g.font = `900 ${Math.round(f.size * pop)}px system-ui, -apple-system, sans-serif`;
        g.lineWidth = 3.5; g.strokeStyle = 'rgba(0,0,0,.8)'; g.strokeText(f.text, f.x, f.y);
        g.fillStyle = f.color; g.fillText(f.text, f.x, f.y);
      }
      g.globalAlpha = 1;
    }

    _drawSticks(g) {
      if (!this.isTouch || this.state !== 'play') return;
      const R = global.RaskolInput.STICK_R;
      const draw = (s, def) => {
        const active = s.id !== null;
        const ox = active ? s.ox : def.x, oy = active ? s.oy : def.y, kx = active ? s.kx : def.x, ky = active ? s.ky : def.y;
        g.globalAlpha = active ? 1 : 0.35;
        g.fillStyle = 'rgba(255,255,255,.07)'; g.strokeStyle = 'rgba(255,255,255,.28)'; g.lineWidth = 2;
        g.beginPath(); g.arc(ox, oy, R, 0, TAU); g.fill(); g.stroke();
        g.fillStyle = def.c; g.beginPath(); g.arc(kx, ky, 24, 0, TAU); g.fill();
        g.globalAlpha = 1;
      };
      const pad = 34;
      draw(this.input.left, { x: pad + R + 10, y: this.vh - pad - R, c: 'rgba(226,232,240,.55)' });
      draw(this.input.right, { x: this.vw - pad - R - 130, y: this.vh - pad - R, c: 'rgba(251,191,36,.6)' });
    }

    _drawBanner(g) {
      const b = this.banner; if (!b) return;
      const p = b.t / b.dur, a = p < 0.15 ? p / 0.15 : p > 0.75 ? (1 - p) / 0.25 : 1;
      const sc = p < 0.15 ? 1.3 - p * 2 : 1;
      g.save(); g.globalAlpha = Math.max(0, a);
      g.translate(this.vw / 2, this.vh * 0.3); g.scale(sc, sc);
      g.textAlign = 'center'; g.textBaseline = 'middle';
      const fs = Math.round(Math.min(44, this.vw * 0.06));
      g.font = `900 ${fs}px system-ui, -apple-system, sans-serif`;
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(b.text, 0, 0);
      g.fillStyle = b.color; g.fillText(b.text, 0, 0);
      g.restore();
    }

    // ── отладка (?debug=1) ────────────────────────────────────
    debugApi() {
      return {
        god: v => { this.god = v !== false; },
        jump: n => { this.enemies = []; this.ebul = []; this.orbs = []; this.waves = []; this.loadRoom(clamp((n | 0) - 1, 0, this.chapter.rooms.length - 1)); },
        card: id => this.applyCard(id),
        clear: () => { for (const e of this.enemies) this._kill(e); this.waves = []; },
        hurtBoss: f => { if (this.boss) this.boss.hp = Math.max(1, this.boss.maxHp * f); },
        state: () => ({ room: this.roomIdx + 1, roomState: this.roomState, state: this.state, hp: this.hero.hp, lvl: this.hero.lvl, enemies: this.enemies.length, ebul: this.ebul.length, picking: this.picking, pending: this.pendingPicks, kills: this.run.kills, door: this.door.open, boss: this.boss ? Math.round(this.boss.hp) : null, cards: { ...this.hero.cards } })
      };
    }
  }

  global.RaskolEngine = RaskolEngine;
})(window);
