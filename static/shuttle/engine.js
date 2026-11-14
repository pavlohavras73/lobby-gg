/* Shuttle Cruiser 2.0 — 60 FPS Canvas Roguelite Engine (Stage 6b: 5 Galaxies, 6 Ships, 10 Enemies, Upgrades) */
(function (global) {
  'use strict';

  const DATA = global.SHUTTLE_DATA;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rand = (a, b) => a + _rng() * (b - a);

  let _rngState = Date.now() & 0x7fffffff;
  function _rng() {
    _rngState = (_rngState * 48271) % 0x7fffffff;
    return _rngState / 0x7fffffff;
  }

  const REDUCED_MOTION = global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const MAX_PARTICLES = 360;
  const MAX_FLOATS = 24;
  // Текст на холсте — на языке страницы (страница выставляет SHUTTLE_LANG в applyUI).
  const _lang = () => (['uk', 'ru', 'en', 'de'].includes(global.SHUTTLE_LANG) ? global.SHUTTLE_LANG : 'ru');
  const WORDS = {
    phase: { uk: 'ФАЗА', ru: 'ФАЗА', en: 'PHASE', de: 'PHASE' },
    dodge: { uk: 'УХИЛ', ru: 'УКЛОН', en: 'DODGE', de: 'AUSWEICHEN' }
  };
  const _word = k => WORDS[k][_lang()];

  function playSfx(kind) {
    try {
      if (!global.SFX) return;
      if (kind === 'shoot' && global.SFX.tap) global.SFX.tap();
      else if (kind === 'hit' && global.SFX.hit) global.SFX.hit();
      else if (kind === 'win' && global.SFX.win) global.SFX.win();
      else if (kind === 'die' && global.SFX.lose) global.SFX.lose();
      else if (global.SFX.click) global.SFX.click();
    } catch (_) {}
  }

  class ShuttleEngine {
    constructor(canvas, callbacks) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d', { alpha: false });
      this.cb = callbacks || {};
      this.dpr = Math.min(2, global.devicePixelRatio || 1);
      this.w = 390;
      this.h = 700;
      this.hudTopOffset = 98;
      this.bgGrad = null;
      this.hudFadeGrad = null;

      // Active entity arrays
      this.bullets = [];
      this.ebullets = [];
      this.enemies = [];
      this.asteroids = [];
      this.mines = [];
      this.hazards = [];   // nebula clouds (gal 2) / ice fields (gal 3)
      this.gravWell = null; // gravity well (gal 5)
      this.gems = [];
      this.drones = [];
      this.stars = [];
      this.planets = [];
      this.bgRocks = [];

      // Pre-allocated pools
      this.particles = new Array(MAX_PARTICLES);
      for (let i = 0; i < MAX_PARTICLES; i++) {
        this.particles[i] = {
          active: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0,
          life: 0, maxLife: 1, r: 2, rEnd: 10, color: '#fff', rot: 0, vrot: 0
        };
      }
      this._pCursor = 0;

      this.floats = new Array(MAX_FLOATS);
      for (let i = 0; i < MAX_FLOATS; i++) {
        this.floats[i] = {
          active: false, targetId: 0, dmgSum: 0, aggTimer: 0,
          x: 0, y: 0, life: 0, maxLife: 0.65, isCrit: false, text: ''
        };
      }
      this._fCursor = 0;
      this._nextUid = 1;

      this.running = false;
      this.paused = false;
      this.cardModalOpen = false;
      this.godMode = false;
      this.rafId = 0;
      this.lastTs = 0;

      // Run state
      this.galaxyId = 1;
      this.sector = 1;
      this.singleSectorMode = false;
      this.shipId = 'spark';
      this.shipStats = { hp: 100, speed: 335, dmg: 14, fireRate: 5.5, crit: 0.08 };
      this.cards = {};
      this.evolutions = new Set();
      this.rerolls = 1;
      this.score = 0;
      this.runDust = 0;
      this.xp = 0;
      this.xpNext = 30;
      this.level = 1;

      // Player state
      this.px = 195;
      this.py = 560;
      this.prevPx = 195;
      this.bank = 0;
      this.hp = 100;
      this.maxHp = 100;
      this.abilityCd = 0;
      this.abilityMaxCd = 5;
      this.invuln = 0;
      this.domeTime = 0;
      this.overdriveTime = 0;
      this.cloakTime = 0;
      this.inIceField = false;
      this.aegisTimer = 0;
      this.aegisActive = 0;
      this.fireCd = 0;
      this.rocketCd = 0;
      this.laserCd = 0;
      this.laserBeamTime = 0;
      this.bladeAngle = 0;
      this.shake = 0;
      this.slowMo = 1.0;
      this.thrusterTimer = 0;

      // Wave / Sector state
      this.wave = 1;
      this.maxWaves = 3;
      this.waveTotalEnemies = 1;
      this.sectorElapsed = 0;
      this.waveTimer = 0;
      this.waveMagnet = false;
      this.boss = null;
      this.warnTimer = 0;
      this.warnText = '';

      // Input state
      this.keys = {};
      this.pointerId = null;
      this.lastPointer = null;

      this._initBackdrop();
      this._bindInput();
      this.resize();
    }

    setHudTop(px) {
      if (px > 40 && Math.abs(px - this.hudTopOffset) > 1) {
        this.hudTopOffset = Math.ceil(px);
        this._rebuildGradients();
      }
    }

    _getGalaxy() {
      return DATA.GALAXIES.find(g => g.id === this.galaxyId) || DATA.GALAXIES[0];
    }

    _rebuildGradients() {
      if (!this.ctx) return;
      const pal = this._getGalaxy().palette;
      const g = this.ctx.createLinearGradient(0, 0, 0, this.h);
      g.addColorStop(0, pal.bg1);
      g.addColorStop(0.55, pal.bg2);
      g.addColorStop(1, pal.bg1);
      this.bgGrad = g;

      const fg = this.ctx.createLinearGradient(0, 0, 0, this.hudTopOffset + 18);
      fg.addColorStop(0, 'rgba(2,6,23,0.92)');
      fg.addColorStop(0.65, 'rgba(2,6,23,0.52)');
      fg.addColorStop(1, 'rgba(2,6,23,0)');
      this.hudFadeGrad = fg;
    }

    _initBackdrop() {
      this.stars.length = 0;
      const counts = [42, 30, 18];
      for (let layer = 0; layer < 3; layer++) {
        for (let i = 0; i < counts[layer]; i++) {
          this.stars.push({
            x: Math.random(),
            y: Math.random(),
            layer,
            z: layer === 0 ? 0.35 + Math.random() * 0.3 : layer === 1 ? 0.8 + Math.random() * 0.45 : 1.45 + Math.random() * 0.65,
            r: layer === 0 ? 0.7 + Math.random() * 0.6 : layer === 1 ? 1.1 + Math.random() * 0.8 : 1.5 + Math.random() * 1.1,
            twinkle: Math.random() * Math.PI * 2,
            tint: layer === 2 && Math.random() < 0.35 ? '#7dd3fc' : layer === 1 && Math.random() < 0.25 ? '#c4b5fd' : '#e2e8f0'
          });
        }
      }
      this.planets = [
        { x: 0.18, y: 0.24, r: 42, speed: 0.004, ring: true },
        { x: 0.82, y: 0.64, r: 28, speed: 0.006, ring: false }
      ];
      this.bgRocks.length = 0;
      for (let i = 0; i < 8; i++) {
        this.bgRocks.push({
          x: Math.random(),
          y: Math.random(),
          r: 16 + Math.random() * 24,
          speed: 0.012 + Math.random() * 0.014,
          rot: Math.random() * Math.PI * 2,
          vrot: (Math.random() - 0.5) * 0.25
        });
      }
    }

    resize() {
      this.dpr = Math.min(2, global.devicePixelRatio || 1);
      const rect = this.canvas.getBoundingClientRect();
      this.w = Math.max(300, Math.round(rect.width || global.innerWidth));
      this.h = Math.max(420, Math.round(rect.height || global.innerHeight));
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.px = clamp(this.px, 24, this.w - 24);
      this.py = clamp(this.py, Math.max(76, this.hudTopOffset + 12), this.h - 40);
      this._rebuildGradients();
    }

    _bindInput() {
      global.addEventListener('resize', () => this.resize());
      global.addEventListener('keydown', e => {
        this.keys[e.code] = true;
        if (e.code === 'Space' && this.running && !this.paused && !this.cardModalOpen) {
          e.preventDefault();
          this.triggerAbility();
        }
        if (e.code === 'Escape' && this.running && !this.cardModalOpen) {
          this.togglePause();
        }
      });
      global.addEventListener('keyup', e => { this.keys[e.code] = false; });

      this.canvas.addEventListener('pointerdown', e => {
        if (!this.running || this.paused || this.cardModalOpen) return;
        this.pointerId = e.pointerId;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        try { this.canvas.setPointerCapture(e.pointerId); } catch (_) {}
      });
      this.canvas.addEventListener('pointermove', e => {
        if (e.pointerId !== this.pointerId || !this.lastPointer || !this.running || this.paused || this.cardModalOpen) return;
        const dx = e.clientX - this.lastPointer.x;
        const dy = e.clientY - this.lastPointer.y;
        this.lastPointer = { x: e.clientX, y: e.clientY };
        const slowFactor = this.inIceField ? 0.7 : 1.0;
        this.px = clamp(this.px + dx * 1.15 * slowFactor, 22, this.w - 22);
        this.py = clamp(this.py + dy * 1.15 * slowFactor, Math.max(76, this.hudTopOffset + 12), this.h - 36);
      });
      const endPtr = e => {
        if (e.pointerId === this.pointerId) {
          this.pointerId = null;
          this.lastPointer = null;
        }
      };
      this.canvas.addEventListener('pointerup', endPtr);
      this.canvas.addEventListener('pointercancel', endPtr);

      document.addEventListener('visibilitychange', () => {
        if (document.hidden && this.running && !this.paused && !this.cardModalOpen) {
          this.togglePause(true);
        }
      });
    }

    startRun(opts) {
      this.shipId = opts.shipId || 'spark';
      this.galaxyId = opts.galaxyId || 1;
      this.sector = opts.startSector || 1;
      this.singleSectorMode = Boolean(opts.singleSector);
      this.cards = {};
      this.evolutions = new Set();
      this.rerolls = 1;
      this.score = 0;
      this.runDust = 0;
      this.xp = 0;
      this.xpNext = 28;
      this.level = 1;

      const ship = this.getShip();
      this.shipStats = DATA.getShipStats ? DATA.getShipStats(ship, opts.upgrades) : ship;
      this.maxHp = this.shipStats.hp;
      this.hp = this.shipStats.hp;
      this.abilityMaxCd = ship.abilityCd;
      this.abilityCd = 0;
      this.invuln = 1.0;
      this.domeTime = 0;
      this.overdriveTime = 0;
      this.cloakTime = 0;
      this.inIceField = false;
      this.aegisTimer = 0;
      this.aegisActive = 0;
      this.px = this.w * 0.5;
      this.prevPx = this.px;
      this.bank = 0;
      this.py = this.h * 0.78;
      this._clearPools();
      this._syncDrones();
      this._rebuildGradients();
      this._startSector(this.sector);
      this.running = true;
      this.paused = false;
      this.cardModalOpen = false;
      this.lastTs = performance.now();
      cancelAnimationFrame(this.rafId);
      const loop = ts => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
        this.lastTs = ts;
        if (!this.paused) {
          this.update(dt * this.slowMo);
        }
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    _clearPools() {
      for (let i = 0; i < MAX_PARTICLES; i++) this.particles[i].active = false;
      for (let i = 0; i < MAX_FLOATS; i++) this.floats[i].active = false;
    }

    stop() {
      this.running = false;
      cancelAnimationFrame(this.rafId);
    }

    togglePause(forceState) {
      this.paused = typeof forceState === 'boolean' ? forceState : !this.paused;
      if (this.cb.onPauseChange) this.cb.onPauseChange(this.paused);
    }

    getShip() {
      return DATA.SHIPS.find(s => s.id === this.shipId) || DATA.SHIPS[0];
    }

    cardLvl(id) {
      return this.cards[id] || 0;
    }

    _syncDrones() {
      const baseDrones = this.shipId === 'hive' ? 2 : 0;
      const n = baseDrones + this.cardLvl('drone');
      this.drones = [];
      for (let i = 0; i < n; i++) {
        this.drones.push({ angle: (Math.PI * 2 * i) / Math.max(1, n), cd: 0.25 * i });
      }
    }

    addCard(id) {
      const evo = DATA.EVOLUTIONS.find(e => e.id === id);
      if (evo) {
        this.evolutions.add(evo.id);
        this.cardModalOpen = false;
        this.slowMo = 1.0;
        this.cb.onHudUpdate?.();
        return;
      }
      const prev = this.cards[id] || 0;
      const next = Math.min(3, prev + 1);
      this.cards[id] = next;
      if (id === 'hull') {
        const gain = next === 1 ? 25 : next === 2 ? 25 : 30;
        this.maxHp += gain;
        this.hp = next === 3 ? this.maxHp : Math.min(this.maxHp, this.hp + gain + 15);
      }
      if (id === 'drone') this._syncDrones();
      this.cardModalOpen = false;
      this.slowMo = 1.0;
      this.cb.onHudUpdate?.();
    }

    getCardChoices() {
      const choices = [];
      for (const evo of DATA.EVOLUTIONS) {
        if (!this.evolutions.has(evo.id) && evo.req.every(r => this.cardLvl(r) >= 3)) {
          choices.push({ ...evo, isEvolution: true, nextLvl: 1 });
        }
      }
      const weaponsCount = Object.keys(this.cards).filter(id => DATA.CARDS.find(c => c.id === id)?.slot === 'weapon').length;
      const passivesCount = Object.keys(this.cards).filter(id => DATA.CARDS.find(c => c.id === id)?.slot === 'passive').length;

      const pool = DATA.CARDS.filter(c => {
        const cur = this.cardLvl(c.id);
        if (cur >= 3) return false;
        if (cur === 0) {
          if (c.slot === 'weapon' && weaponsCount >= 4) return false;
          if (c.slot === 'passive' && passivesCount >= 4) return false;
        }
        return true;
      });

      const rarityWeight = r => {
        const secBoost = 1 + (this.sector - 1 + (this.galaxyId - 1) * 3) * 0.14;
        if (r === 'common') return 55;
        if (r === 'rare') return 28 * secBoost;
        if (r === 'epic') return 13 * secBoost;
        return 5 * secBoost;
      };

      const avail = [...pool];
      while (choices.length < 3 && avail.length > 0) {
        const totalW = avail.reduce((s, c) => s + rarityWeight(c.rarity), 0);
        let pick = _rng() * totalW;
        let idx = 0;
        for (let i = 0; i < avail.length; i++) {
          pick -= rarityWeight(avail[i].rarity);
          if (pick <= 0) { idx = i; break; }
        }
        const chosen = avail.splice(idx, 1)[0];
        choices.push({ ...chosen, nextLvl: this.cardLvl(chosen.id) + 1 });
      }
      return choices;
    }

    _startSector(sec) {
      this.sector = sec;
      this.bullets.length = 0;
      this.ebullets.length = 0;
      this.enemies.length = 0;
      this.asteroids.length = 0;
      this.mines.length = 0;
      this.hazards.length = 0;
      this.gems.length = 0;
      this.boss = null;
      this.wave = 1;
      this.waveMagnet = false;
      this.sectorElapsed = 0;
      this.waveTimer = 0;
      this._bossSpawnedForSector = false;

      // Galaxy-specific environmental hazards
      if (this.galaxyId === 2) {
        for (let i = 0; i < 3; i++) {
          this.hazards.push({
            kind: 'nebula',
            x: rand(65, this.w - 65),
            y: rand(160, this.h * 0.62),
            vx: (i % 2 === 0 ? 1 : -1) * rand(12, 22),
            r: rand(56, 78)
          });
        }
      } else if (this.galaxyId === 3) {
        for (let i = 0; i < 2; i++) {
          this.hazards.push({
            kind: 'ice',
            x: rand(75, this.w - 75),
            y: rand(220, this.h * 0.72),
            vx: (i % 2 === 0 ? 1 : -1) * rand(10, 18),
            r: rand(62, 84)
          });
        }
      }
      this.gravWell = this.galaxyId === 5
        ? { x: this.w * 0.5, y: this.h * 0.36, r: 34, pull: 58 }
        : null;

      if (sec === 5 || sec === 10) {
        this.maxWaves = 2;
        this._spawnWave(1);
      } else {
        this.maxWaves = sec <= 3 ? 3 : 4;
        this._spawnWave(1);
      }
      this.cb.onHudUpdate?.();
    }

    _spawnWave(wIdx) {
      this.wave = wIdx;
      const galMult = 1 + (this.galaxyId - 1) * 0.65;
      const scale = (1 + (this.sector - 1) * 0.22) * galMult;
      const count = 5 + Math.min(8, this.sector) + wIdx * 2;
      this.waveTotalEnemies = count;

      // Galaxy enemy families
      let types;
      if (this.galaxyId === 1) {
        types = ['raider', 'kamikaze'];
        if (this.sector >= 2) types.push('sniper');
        if (this.sector >= 3) types.push('shielder');
        if (this.sector >= 4) types.push('splitter');
        if (this.sector >= 6) types.push('spiral');
      } else if (this.galaxyId === 2) {
        types = ['raider', 'sniper', 'teleporter', 'spiral', 'miner'];
      } else if (this.galaxyId === 3) {
        types = ['shielder', 'pendulum', 'sniper', 'kamikaze', 'miner'];
      } else if (this.galaxyId === 4) {
        types = ['splitter', 'carrier', 'kamikaze', 'miner', 'raider'];
      } else {
        types = ['teleporter', 'pendulum', 'spiral', 'shielder', 'carrier', 'sniper'];
      }

      let hasCarrier = false;
      for (let i = 0; i < count; i++) {
        let t = types[Math.floor(_rng() * types.length)];
        if (t === 'carrier') {
          if (hasCarrier) t = 'splitter';
          else hasCarrier = true;
        }
        const isElite = (wIdx === this.maxWaves && i === 0 && this.sector !== 5 && this.sector !== 10);
        this._spawnEnemy(t, scale, isElite, i, count);
      }

      if (this.galaxyId === 1) {
        const astCount = 2 + Math.min(4, Math.floor(this.sector / 2));
        for (let i = 0; i < astCount; i++) {
          this.asteroids.push({
            x: rand(36, this.w - 36),
            y: rand(-160, -30),
            vx: rand(-20, 20),
            vy: rand(48, 85),
            r: rand(18, 28),
            hp: Math.round(32 * scale),
            maxHp: Math.round(32 * scale),
            rot: rand(0, Math.PI * 2),
            vrot: rand(-1.5, 1.5),
            variant: i % 4
          });
        }
      }
    }

    _spawnEnemy(type, scale, elite, idx, total) {
      const baseHp = {
        raider: 26, kamikaze: 20, sniper: 28, shielder: 44, splitter: 34,
        spiral: 42, miner: 36, carrier: 62, pendulum: 40, teleporter: 32
      }[type] || 26;
      const hp = Math.round(baseHp * scale * (elite ? 2.6 : 1));
      const x = ((idx + 0.5) / Math.max(1, total)) * (this.w - 60) + 30 + rand(-14, 14);
      const r = elite ? 24 : (type === 'shielder' || type === 'spiral' || type === 'carrier' ? 19 : 15);
      this.enemies.push({
        _uid: this._nextUid++,
        type,
        elite,
        x: clamp(x, 26, this.w - 26),
        y: rand(-120, -25) - (idx % 3) * 24,
        vx: type === 'pendulum' ? (idx % 2 === 0 ? 115 : -115) : rand(-45, 45),
        vy: type === 'kamikaze' ? 95 : rand(44, 72),
        r,
        hp,
        maxHp: hp,
        shieldHp: type === 'shielder' ? Math.round(28 * scale) : 0,
        cd: rand(1.0, 2.5),
        aimTimer: 0,
        aimX: 0,
        aimY: 0,
        tpTimer: 0,
        tpX: 0,
        tpY: 0,
        age: 0,
        burn: 0,
        burnDmg: 0,
        slow: 0,
        freeze: 0,
        acid: 0,
        flash: 0
      });
    }

    _spawnBoss(isFinal) {
      const galMult = 1 + (this.galaxyId - 1) * 0.72;
      const hp = Math.round((isFinal ? 2400 : 880) * galMult);
      const r = isFinal ? 46 : 36;
      const safeTop = Math.max(135, this.hudTopOffset + 24);
      const gal = this._getGalaxy();
      const bName = isFinal
        ? (gal.bossFinal?.[_lang()] || gal.bossFinal?.en || 'BOSS')
        : (gal.bossMini?.[_lang()] || gal.bossMini?.en || 'MINI-BOSS');
      this.boss = {
        _uid: this._nextUid++,
        galaxyId: this.galaxyId,
        isFinal,
        x: this.w * 0.5,
        y: -70,
        targetY: safeTop + r,
        vx: 75 + this.galaxyId * 8,
        r,
        hp,
        maxHp: hp,
        phase: 1,
        cd: 1.4,
        patternIdx: 0,
        turretAngle: 0,
        flash: 0,
        burn: 0,
        burnDmg: 0,
        acid: 0
      };
      this.warnText = `⚠ ${bName.toUpperCase()}`;
      this.warnTimer = 2.4;
      playSfx('hit');
      this.cb.onHudUpdate?.();
    }

    triggerAbility() {
      if (this.abilityCd > 0) return;
      const cdMult = [1, 0.82, 0.70, 0.58][this.cardLvl('dash_cd')];
      this.abilityCd = this.abilityMaxCd * cdMult;
      if (this.shipId === 'spark') {
        this.invuln = Math.max(this.invuln, 0.45);
        this.py = clamp(this.py - 85, Math.max(76, this.hudTopOffset + 12), this.h - 36);
        this._spawnExplosion(this.px, this.py, '#38bdf8', 18, 85, false);
        for (let i = this.ebullets.length - 1; i >= 0; i--) {
          const b = this.ebullets[i];
          if (Math.hypot(b.x - this.px, b.y - this.py) < 120) this.ebullets.splice(i, 1);
        }
        for (const e of this.enemies) {
          if (Math.hypot(e.x - this.px, e.y - this.py) < 130) this._damageEnemy(e, 28, false);
        }
      } else if (this.shipId === 'bastion') {
        this.domeTime = 3.0;
        this._spawnExplosion(this.px, this.py, '#f59e0b', 20, 70, false);
      } else if (this.shipId === 'sting') {
        this.overdriveTime = 4.0;
        this._spawnExplosion(this.px, this.py, '#f43f5e', 18, 65, false);
      } else if (this.shipId === 'hive') {
        // Summon 4 homing swarm missiles
        for (let i = 0; i < 4; i++) {
          const off = (i - 1.5) * 16;
          this.bullets.push({
            x: this.px + off, y: this.py - 12,
            vx: off * 4, vy: -290,
            dmg: this._calcBaseDmg() * 1.85,
            homing: true, pierce: 0, ricochet: 0, color: '#a3e635', r: 4.8
          });
        }
        this._spawnExplosion(this.px, this.py, '#a3e635', 16, 60, false);
      } else if (this.shipId === 'phantom') {
        this.cloakTime = 3.2;
        for (const e of this.enemies) e.aimTimer = 0;
        this._spawnExplosion(this.px, this.py, '#c084fc', 18, 65, false);
      } else {
        // nova: Screen-clearing Nova Bomb
        this._spawnExplosion(this.px, this.py, '#fb7185', 40, 260, true);
        this._addShake(9);
        this.ebullets.length = 0;
        this.mines.length = 0;
        const novaDmg = this._calcBaseDmg() * 5.2;
        for (let i = this.enemies.length - 1; i >= 0; i--) {
          this._damageEnemy(this.enemies[i], novaDmg, true);
        }
        if (this.boss) this._damageBoss(novaDmg * 0.9, true);
      }
      playSfx('click');
      this.cb.onHudUpdate?.();
    }

    update(dt) {
      this.sectorElapsed += dt;
      if (this.warnTimer > 0) this.warnTimer -= dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 26);
      if (this.invuln > 0) this.invuln -= dt;
      if (this.domeTime > 0) this.domeTime -= dt;
      if (this.overdriveTime > 0) this.overdriveTime -= dt;
      if (this.cloakTime > 0) this.cloakTime -= dt;
      if (this.abilityCd > 0) this.abilityCd = Math.max(0, this.abilityCd - dt);
      if (this.laserBeamTime > 0) this.laserBeamTime -= dt;

      // Hazards update & check if player is in ice field
      this.inIceField = false;
      for (const hz of this.hazards) {
        hz.x += hz.vx * dt;
        if (hz.x < hz.r || hz.x > this.w - hz.r) hz.vx *= -1;
        if (hz.kind === 'ice' && Math.hypot(this.px - hz.x, this.py - hz.y) < hz.r) {
          this.inIceField = true;
        }
      }

      // Gravity well pull (Galaxy 5)
      if (this.gravWell) {
        const dx = this.gravWell.x - this.px;
        const dy = this.gravWell.y - this.py;
        const d = Math.hypot(dx, dy);
        if (d > 28) {
          const pull = this.gravWell.pull * clamp(1 - d / (this.h * 0.9), 0.2, 1);
          this.px = clamp(this.px + (dx / d) * pull * dt, 22, this.w - 22);
          this.py = clamp(this.py + (dy / d) * pull * dt, Math.max(76, this.hudTopOffset + 12), this.h - 36);
        }
      }

      // Shield card
      const shLvl = this.cardLvl('shield');
      if (shLvl > 0) {
        if (this.aegisActive > 0) this.aegisActive -= dt;
        else {
          this.aegisTimer += dt;
          const period = [99, 14, 11, 8][shLvl];
          if (this.aegisTimer >= period) {
            this.aegisTimer = 0;
            this.aegisActive = shLvl >= 3 ? 2.5 : 2.0;
          }
        }
      }

      // Regen card
      const regLvl = this.cardLvl('regen');
      if (regLvl > 0 && this.hp < this.maxHp) {
        const rate = [0, 1.5, 3.0, 5.0][regLvl];
        this.hp = Math.min(this.maxHp, this.hp + rate * dt);
      }

      // Keyboard movement
      const slowFactor = this.inIceField ? 0.7 : 1.0;
      let mx = 0, my = 0;
      if (this.keys['ArrowLeft'] || this.keys['KeyA']) mx -= 1;
      if (this.keys['ArrowRight'] || this.keys['KeyD']) mx += 1;
      if (this.keys['ArrowUp'] || this.keys['KeyW']) my -= 1;
      if (this.keys['ArrowDown'] || this.keys['KeyS']) my += 1;
      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        this.px = clamp(this.px + (mx / len) * this.shipStats.speed * slowFactor * dt, 22, this.w - 22);
        this.py = clamp(this.py + (my / len) * this.shipStats.speed * slowFactor * dt, Math.max(76, this.hudTopOffset + 12), this.h - 36);
      }

      // Ship banking
      const vxEst = (this.px - this.prevPx) / Math.max(0.001, dt);
      this.prevPx = this.px;
      const targetBank = clamp(vxEst / 420, -0.34, 0.34);
      this.bank += (targetBank - this.bank) * Math.min(1, dt * 14);

      // Engine trail
      const ship = this.getShip();
      this.thrusterTimer -= dt;
      if (this.thrusterTimer <= 0) {
        this.thrusterTimer = 0.032;
        const nozzles = global.SHUTTLE_SPRITES ? global.SHUTTLE_SPRITES.getThrusterOffsets(this.shipId) : [{ x: 0, y: 17, w: 4 }];
        const cosB = Math.cos(this.bank), sinB = Math.sin(this.bank);
        for (let i = 0; i < nozzles.length; i++) {
          const n = nozzles[i];
          const nx = this.px + n.x * cosB - n.y * sinB;
          const ny = this.py + n.x * sinB + n.y * cosB;
          this._allocParticle(3, nx + rand(-1.2, 1.2), ny, rand(-12, 12), rand(70, 120), 0.18, n.w * 0.65, 0, ship.glow);
        }
      }

      // Auto-fire
      const hasteMult = [1, 1.18, 1.32, 1.48][this.cardLvl('haste')] * (this.overdriveTime > 0 ? 2.0 : 1.0);
      this.fireCd -= dt * hasteMult;
      if (this.fireCd <= 0) {
        this.fireCd = 1 / this.shipStats.fireRate;
        this._firePlayer();
      }

      // Homing rockets
      const homLvl = this.cardLvl('homing');
      if (homLvl > 0) {
        this.rocketCd -= dt;
        if (this.rocketCd <= 0) {
          this.rocketCd = [9, 3.5, 2.8, 2.2][homLvl];
          for (let i = 0; i < homLvl; i++) {
            this.bullets.push({
              x: this.px + (i - (homLvl - 1) / 2) * 14,
              y: this.py - 14,
              vx: (i - (homLvl - 1) / 2) * 40,
              vy: -270,
              dmg: this._calcBaseDmg() * 1.9,
              homing: true,
              pierce: 0,
              ricochet: 0,
              color: '#fb923c',
              r: 5
            });
          }
        }
      }

      // Pulse laser
      const lasLvl = this.cardLvl('laser');
      if (lasLvl > 0) {
        this.laserCd -= dt;
        if (this.laserCd <= 0) {
          this.laserCd = [9, 4.5, 3.5, 2.6][lasLvl];
          this.laserBeamTime = 0.28;
          const beamHalf = 14 + lasLvl * 6;
          const dmg = this._calcBaseDmg() * (2.2 + lasLvl * 0.7);
          for (const e of this.enemies) {
            if (Math.abs(e.x - this.px) <= beamHalf + e.r && e.y < this.py) this._damageEnemy(e, dmg, false);
          }
          if (this.boss && Math.abs(this.boss.x - this.px) <= beamHalf + this.boss.r) {
            this._damageBoss(dmg, false);
          }
        }
      }

      // Orbital blades
      const blLvl = this.cardLvl('blades');
      if (blLvl > 0) {
        this.bladeAngle += dt * (3.2 + blLvl * 0.6);
        const cnt = blLvl + 1;
        for (let i = 0; i < cnt; i++) {
          const a = this.bladeAngle + (Math.PI * 2 * i) / cnt;
          const bx = this.px + Math.cos(a) * 46;
          const by = this.py + Math.sin(a) * 46;
          for (const e of this.enemies) {
            if (Math.hypot(e.x - bx, e.y - by) < e.r + 10 && e.flash <= 0) {
              this._damageEnemy(e, this._calcBaseDmg() * 0.85, false);
            }
          }
        }
      }

      // Wingman drones
      const droneFireCd = this.evolutions.has('drone_swarm') ? 0.27 : 0.55;
      for (const d of this.drones) {
        d.angle += dt * 1.8;
        d.cd -= dt;
        const dx = this.px + Math.cos(d.angle) * 38;
        const dy = this.py + Math.sin(d.angle) * 28;
        if (d.cd <= 0 && (this.enemies.length > 0 || this.boss)) {
          d.cd = droneFireCd;
          this.bullets.push({
            x: dx, y: dy, vx: 0, vy: -520,
            dmg: this._calcBaseDmg() * 0.7, pierce: 0, ricochet: 0, color: '#34d399', r: 3.5
          });
        }
      }

      this._updateBullets(dt);
      this._updateAsteroids(dt);
      this._updateMines(dt);
      this._updateEnemies(dt);
      if (this.boss) this._updateBoss(dt);
      this._updateEBullets(dt);
      this._updateGems(dt);
      this._updateParticles(dt);

      // Wave progression + end-of-wave gem magnet
      if (this.enemies.length === 0 && !this.boss) {
        if (this.gems.length > 0 && !this.waveMagnet) {
          this.waveMagnet = true;
        }
        if (this.wave < this.maxWaves) {
          this._spawnWave(this.wave + 1);
        } else if ((this.sector === 5 || this.sector === 10) && !this._bossSpawnedForSector) {
          this._bossSpawnedForSector = true;
          this._spawnBoss(this.sector === 10);
        } else if (this.gems.length === 0) {
          this._sectorCleared();
        }
      }
      this.cb.onHudUpdate?.();
    }

    _calcBaseDmg() {
      const pwr = [1, 1.2, 1.38, 1.58][this.cardLvl('power')];
      return this.shipStats.dmg * pwr;
    }

    _firePlayer() {
      const baseDmg = this._calcBaseDmg();
      const pierce = this.cardLvl('pierce');
      const ricochet = this.cardLvl('ricochet');
      const railMult = this.evolutions.has('rail_ricochet') && (pierce > 0 || ricochet > 0) ? 1.35 : 1.0;
      const twin = this.cardLvl('twin');
      const fan = this.cardLvl('fan');
      const hasFirestorm = this.evolutions.has('firestorm');

      const totalParallel = 1 + twin;
      for (let i = 0; i < totalParallel; i++) {
        const off = (i - (totalParallel - 1) / 2) * 10;
        this.bullets.push({
          x: this.px + off, y: this.py - 16, vx: 0, vy: -580,
          dmg: baseDmg * railMult, pierce, ricochet,
          color: hasFirestorm ? '#fb923c' : '#38bdf8', r: 4
        });
      }
      this._allocParticle(4, this.px, this.py - 20, 0, 0, 0.07, 7, 11, hasFirestorm ? '#fb923c' : '#7dd3fc');

      const fanCnt = hasFirestorm ? 6 : (fan > 0 ? fan + 1 : 0);
      for (let i = 0; i < fanCnt; i++) {
        const dir = (i % 2 === 0 ? 1 : -1) * (Math.floor(i / 2) + 1) * 0.19;
        this.bullets.push({
          x: this.px, y: this.py - 14,
          vx: Math.sin(dir) * 560, vy: -Math.cos(dir) * 560,
          dmg: baseDmg * (hasFirestorm ? 1.15 : 0.85) * railMult, pierce, ricochet,
          color: hasFirestorm ? '#f97316' : '#a78bfa', r: 4
        });
      }

      const rearLvl = this.cardLvl('rear');
      if (rearLvl > 0) {
        const mult = [0, 0.7, 0.95, 1.2][rearLvl];
        const cnt = rearLvl >= 3 ? 2 : 1;
        for (let i = 0; i < cnt; i++) {
          this.bullets.push({
            x: this.px + (cnt === 2 ? (i === 0 ? -8 : 8) : 0),
            y: this.py + 14, vx: 0, vy: 500,
            dmg: baseDmg * mult * railMult, pierce, ricochet, color: '#22d3ee', r: 3.5
          });
        }
      }
      playSfx('shoot');
    }

    _updateBullets(dt) {
      for (let i = this.bullets.length - 1; i >= 0; i--) {
        const b = this.bullets[i];
        if (b.homing && (this.enemies.length > 0 || this.boss)) {
          const target = this.boss || this.enemies[0];
          const ang = Math.atan2(target.y - b.y, target.x - b.x);
          b.vx += Math.cos(ang) * 900 * dt;
          b.vy += Math.sin(ang) * 900 * dt;
          const sp = Math.hypot(b.vx, b.vy);
          if (sp > 390) { b.vx = (b.vx / sp) * 390; b.vy = (b.vy / sp) * 390; }
        }
        if (this.gravWell) {
          const gx = this.gravWell.x - b.x, gy = this.gravWell.y - b.y;
          const gd = Math.hypot(gx, gy);
          if (gd > 20 && gd < 220) {
            b.vx += (gx / gd) * 140 * dt;
            b.vy += (gy / gd) * 140 * dt;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        if ((b.x < 6 || b.x > this.w - 6) && b.ricochet > 0) {
          b.vx *= -1; b.x = clamp(b.x, 7, this.w - 7); b.ricochet--;
        }
        if (b.y < -30 || b.y > this.h + 30 || b.x < -30 || b.x > this.w + 30) {
          this.bullets.splice(i, 1); continue;
        }

        let hit = false;
        for (let j = this.asteroids.length - 1; j >= 0; j--) {
          const a = this.asteroids[j];
          if (Math.hypot(b.x - a.x, b.y - a.y) < a.r + b.r) {
            a.hp -= b.dmg;
            hit = true;
            this._allocParticle(0, b.x, b.y, rand(-70, 70), rand(-70, 70), 0.16, 2.2, 0, '#cbd5e1');
            if (a.hp <= 0) {
              this._spawnExplosion(a.x, a.y, '#94a3b8', 14, a.r * 1.4, true);
              this._dropGem(a.x, a.y, 12);
              this.runDust += 2;
              this.asteroids.splice(j, 1);
            }
            break;
          }
        }
        if (!hit && this.boss && Math.hypot(b.x - this.boss.x, b.y - this.boss.y) < this.boss.r + b.r) {
          this._hitRollAndApply(this.boss, b.dmg, true);
          this._allocParticle(0, b.x, b.y, rand(-90, 90), rand(20, 120), 0.16, 2.5, 0, b.color);
          hit = true;
        }
        if (!hit) {
          for (let j = this.enemies.length - 1; j >= 0; j--) {
            const e = this.enemies[j];
            if (Math.hypot(b.x - e.x, b.y - e.y) < e.r + b.r) {
              this._hitRollAndApply(e, b.dmg, false);
              this._allocParticle(0, b.x, b.y, rand(-80, 80), rand(-80, 80), 0.15, 2.4, 0, b.color);
              hit = true;
              break;
            }
          }
        }
        if (hit) {
          if (b.pierce > 0) b.pierce--;
          else this.bullets.splice(i, 1);
        }
      }
    }

    _hitRollAndApply(target, rawDmg, isBoss) {
      const critLvl = this.cardLvl('crit');
      const critChance = this.shipStats.crit + [0, 0.12, 0.22, 0.32][critLvl] + (this.overdriveTime > 0 ? 0.25 : 0);
      const isCrit = _rng() < critChance;
      let dmg = rawDmg * (isCrit ? (critLvl >= 3 ? 2.2 : 2.0) : 1.0);
      if (target.acid > 0) dmg *= [1, 1.15, 1.25, 1.40][this.cardLvl('acid')];

      if (isBoss) this._damageBoss(dmg, isCrit);
      else this._damageEnemy(target, dmg, isCrit);

      const fireLvl = this.cardLvl('fire');
      if (fireLvl > 0 || this.evolutions.has('firestorm')) {
        target.burn = 3.0;
        target.burnDmg = this.evolutions.has('firestorm') ? 45 : [0, 8, 14, 22][fireLvl];
      }
      const iceLvl = this.cardLvl('ice');
      if (!isBoss && (iceLvl > 0 || this.evolutions.has('cryo_arc'))) {
        target.slow = 2.5;
        if (iceLvl >= 3 || this.evolutions.has('cryo_arc')) target.freeze = 1.2;
      }
      if (this.cardLvl('acid') > 0) target.acid = 4.0;

      const ltLvl = this.cardLvl('lightning');
      if (ltLvl > 0 || this.evolutions.has('cryo_arc')) {
        const jumps = this.evolutions.has('cryo_arc') ? 6 : ltLvl + 1;
        const arcDmg = rawDmg * (ltLvl >= 3 ? 0.65 : 0.45);
        let chained = 0;
        for (const other of this.enemies) {
          if (other !== target && chained < jumps && Math.hypot(other.x - target.x, other.y - target.y) < 160) {
            this._damageEnemy(other, arcDmg, false);
            if (this.evolutions.has('cryo_arc')) other.freeze = Math.max(other.freeze, 1.0);
            chained++;
          }
        }
      }
    }

    _damageEnemy(e, dmg, isCrit) {
      if (e.shieldHp > 0) {
        const absorb = Math.min(e.shieldHp, dmg);
        e.shieldHp -= absorb;
        dmg -= absorb;
      }
      if (dmg <= 0) return;
      e.hp -= dmg;
      e.flash = 0.09;
      this._spawnFloat(e._uid || 0, e.x, e.y - e.r * 0.6, dmg, isCrit);
      if (e.hp <= 0) {
        const idx = this.enemies.indexOf(e);
        if (idx !== -1) this.enemies.splice(idx, 1);
        this._spawnExplosion(e.x, e.y, e.elite ? '#facc15' : '#fb7185', e.elite ? 22 : 13, e.elite ? 48 : 30, false);
        if (e.elite) this._addShake(3.5);
        this._dropGem(e.x, e.y, e.elite ? 22 : 9);
        const greedMult = [1, 1.25, 1.5, 1.8][this.cardLvl('greed')];
        this.score += Math.round((e.elite ? 120 : 35) * greedMult);
        this.runDust += e.elite ? 6 : 1;
        if (e.type === 'splitter') {
          const ceil = this.hudTopOffset + 18;
          for (let k = -1; k <= 1; k += 2) {
            this.enemies.push({
              _uid: this._nextUid++,
              type: 'raider', elite: false,
              x: clamp(e.x + k * 14, 24, this.w - 24),
              y: Math.max(ceil, e.y),
              vx: k * 65, vy: 70, r: 10, hp: 14, maxHp: 14, shieldHp: 0,
              cd: 1.5, aimTimer: 0, aimX: 0, aimY: 0, tpTimer: 0, tpX: 0, tpY: 0, age: 1,
              burn: 0, burnDmg: 0, slow: 0, freeze: 0, acid: 0, flash: 0
            });
          }
        }
      }
    }

    _damageBoss(dmg, isCrit) {
      if (!this.boss) return;
      this.boss.hp -= dmg;
      this.boss.flash = 0.08;
      this._spawnFloat(this.boss._uid, this.boss.x + rand(-14, 14), this.boss.y - 10, dmg, isCrit);
      const ratio = this.boss.hp / this.boss.maxHp;
      const newPhase = this.boss.isFinal ? (ratio < 0.35 ? 3 : ratio < 0.7 ? 2 : 1) : (ratio < 0.5 ? 2 : 1);
      if (newPhase > this.boss.phase) {
        this.boss.phase = newPhase;
        this.warnText = `⚠ ${_word('phase')} ${newPhase}`;
        this.warnTimer = 1.8;
        this._spawnExplosion(this.boss.x, this.boss.y, '#facc15', 22, 68, true);
        this._addShake(6);
      }
      if (this.boss.hp <= 0) {
        this._spawnExplosion(this.boss.x, this.boss.y, '#facc15', 44, 110, true);
        this._addShake(10);
        this.score += this.boss.isFinal ? 2500 : 900;
        this.runDust += this.boss.isFinal ? 90 : 35;
        this.rerolls += 1;
        this.boss = null;
        this.mines.length = 0;
        this.waveMagnet = true;
      }
    }

    _updateAsteroids(dt) {
      for (let i = this.asteroids.length - 1; i >= 0; i--) {
        const a = this.asteroids[i];
        a.x += a.vx * dt;
        a.y += a.vy * dt;
        a.rot += a.vrot * dt;
        if (a.y > this.h + 40) { this.asteroids.splice(i, 1); continue; }
        if (Math.hypot(a.x - this.px, a.y - this.py) < a.r + 14) {
          this._hitPlayer(14);
          this._spawnExplosion(a.x, a.y, '#94a3b8', 14, a.r * 1.3, true);
          this.asteroids.splice(i, 1);
        }
      }
    }

    _updateMines(dt) {
      for (let i = this.mines.length - 1; i >= 0; i--) {
        const m = this.mines[i];
        m.y += m.vy * dt;
        m.life -= dt;
        if (m.arm > 0) m.arm -= dt;
        if (m.life <= 0 || m.y > this.h + 25) {
          this.mines.splice(i, 1);
          continue;
        }
        if (m.arm <= 0 && Math.hypot(m.x - this.px, m.y - this.py) < m.r + 16) {
          this._spawnExplosion(m.x, m.y, '#f59e0b', 16, 48, false);
          this.mines.splice(i, 1);
          this._hitPlayer(16);
        }
      }
    }

    _updateEnemies(dt) {
      for (let i = this.enemies.length - 1; i >= 0; i--) {
        const e = this.enemies[i];
        e.age += dt;
        if (e.flash > 0) e.flash -= dt;
        if (e.acid > 0) e.acid -= dt;
        if (e.burn > 0) {
          e.burn -= dt;
          e.hp -= e.burnDmg * dt;
          if (e.hp <= 0) { this._damageEnemy(e, 1, false); continue; }
        }
        if (e.freeze > 0) { e.freeze -= dt; continue; }
        const spdMult = e.slow > 0 ? ([1, 0.75, 0.60, 0.55][this.cardLvl('ice')]) : 1;
        if (e.slow > 0) e.slow -= dt;

        const ceil = this.hudTopOffset + e.r + 8;

        if (e.type === 'kamikaze' && e.y > ceil) {
          if (this.cloakTime > 0) {
            e.y += 110 * spdMult * dt;
          } else {
            const ang = Math.atan2(this.py - e.y, this.px - e.x);
            e.x = clamp(e.x + Math.cos(ang) * 145 * spdMult * dt, 20, this.w - 20);
            e.y = Math.max(ceil, e.y + Math.sin(ang) * 145 * spdMult * dt);
          }
          if (e.y > this.h + 40) { this.enemies.splice(i, 1); continue; }
        } else {
          e.x += e.vx * spdMult * dt;
          e.y += e.vy * spdMult * dt;
          if (e.x < 24) { e.x = 24; e.vx = Math.abs(e.vx); }
          if (e.x > this.w - 24) { e.x = this.w - 24; e.vx = -Math.abs(e.vx); }
          if (e.y > this.h * 0.48 && e.vy > 0) e.vy *= -0.5;
          // Invariant (781fdb6): no non-kamikaze enemy can ever drift above HUD ceiling or off bottom
          if (e.y < ceil && e.vy < 0) e.vy = Math.max(30, -e.vy);
          if (e.age > 3.5 && e.y < ceil) { e.y = ceil; e.vy = Math.max(35, Math.abs(e.vy)); }
          if (e.y > this.h * 0.75) { e.y = this.h * 0.75; e.vy = -Math.max(35, Math.abs(e.vy)); }
        }

        if (Math.hypot(e.x - this.px, e.y - this.py) < e.r + 14) {
          this._hitPlayer(16);
          this._damageEnemy(e, 999, false);
          continue;
        }

        // Teleporter blink telegraph
        if (e.tpTimer > 0) {
          e.tpTimer -= dt;
          if (e.tpTimer <= 0) {
            this._allocParticle(1, e.x, e.y, 0, 0, 0.28, 6, 30, '#c084fc');
            e.x = clamp(e.tpX, 28, this.w - 28);
            e.y = clamp(e.tpY, ceil + 8, this.h * 0.46);
            this._allocParticle(1, e.x, e.y, 0, 0, 0.28, 6, 30, '#e9d5ff');
            if (this.cloakTime <= 0) {
              const ang = Math.atan2(this.py - e.y, this.px - e.x);
              for (let k = -1; k <= 1; k++) {
                this.ebullets.push({
                  x: e.x, y: e.y, vx: Math.cos(ang + k * 0.22) * 185, vy: Math.sin(ang + k * 0.22) * 185,
                  r: 4.8, color: '#c084fc', shape: 'diamond'
                });
              }
            }
            e.cd = 3.2;
          }
          continue;
        }

        e.cd -= dt * spdMult;
        if ((e.type === 'sniper' || e.type === 'pendulum') && e.cd < 0.85 && e.aimTimer === 0 && e.y > this.hudTopOffset && this.cloakTime <= 0) {
          e.aimTimer = 0.85;
          e.aimX = e.type === 'pendulum' ? e.x : this.px;
          e.aimY = e.type === 'pendulum' ? this.h : this.py;
        }
        if (e.aimTimer > 0) {
          e.aimTimer -= dt;
          if (e.type === 'pendulum') { e.aimX = e.x; e.aimY = this.h; }
          if (e.aimTimer <= 0) {
            if (e.type === 'pendulum') {
              for (let k = -1; k <= 1; k++) {
                this.ebullets.push({ x: e.x + k * 6, y: e.y + 12, vx: k * 25, vy: 340, r: 5, color: '#22d3ee', shape: 'diamond' });
              }
              e.cd = 2.4;
            } else {
              const ang = Math.atan2(e.aimY - e.y, e.aimX - e.x);
              this.ebullets.push({
                x: e.x, y: e.y, vx: Math.cos(ang) * 310, vy: Math.sin(ang) * 310,
                r: 5.5, color: '#f43f5e', shape: 'diamond'
              });
              e.cd = 2.6;
            }
          }
        } else if (e.cd <= 0 && e.y > ceil - 4 && e.type !== 'kamikaze') {
          if (e.type === 'teleporter') {
            e.tpTimer = 0.7;
            e.tpX = rand(36, this.w - 36);
            e.tpY = rand(ceil + 10, this.h * 0.44);
          } else if (e.type === 'miner') {
            e.cd = 3.0;
            if (this.mines.length < 14) {
              this.mines.push({ x: e.x, y: e.y + 12, vy: 42, r: 10, arm: 0.75, life: 9.0 });
            }
          } else if (e.type === 'carrier') {
            e.cd = 4.6;
            if (this.enemies.length < 18) {
              for (let k = -1; k <= 1; k += 2) {
                this.enemies.push({
                  _uid: this._nextUid++,
                  type: 'raider', elite: false,
                  x: clamp(e.x + k * 20, 24, this.w - 24),
                  y: Math.max(ceil, e.y + 10),
                  vx: k * 55, vy: 58, r: 11, hp: Math.round(14 * (1 + this.galaxyId * 0.3)), maxHp: 20, shieldHp: 0,
                  cd: 1.6, aimTimer: 0, aimX: 0, aimY: 0, tpTimer: 0, tpX: 0, tpY: 0, age: 1,
                  burn: 0, burnDmg: 0, slow: 0, freeze: 0, acid: 0, flash: 0
                });
              }
            }
          } else if (this.cloakTime <= 0) {
            e.cd = e.type === 'spiral' ? 1.8 : 2.1;
            if (e.type === 'spiral') {
              for (let k = 0; k < 5; k++) {
                const a = (Math.PI * 2 * k) / 5 + this.sectorElapsed;
                this.ebullets.push({
                  x: e.x, y: e.y, vx: Math.cos(a) * 155, vy: Math.sin(a) * 155,
                  r: 5, color: '#e879f9', shape: 'ring'
                });
              }
            } else {
              const ang = Math.atan2(this.py - e.y, this.px - e.x);
              this.ebullets.push({
                x: e.x, y: e.y, vx: Math.cos(ang) * 195, vy: Math.sin(ang) * 195,
                r: 5, color: '#fb7185', shape: 'orb'
              });
            }
          }
        }
      }
    }

    _updateBoss(dt) {
      const b = this.boss;
      if (b.flash > 0) b.flash -= dt;
      if (b.burn > 0) { b.burn -= dt; b.hp -= b.burnDmg * dt; if (b.hp <= 0) { this._damageBoss(1, false); return; } }
      b.targetY = Math.max(135, this.hudTopOffset + 24) + b.r;
      if (b.y < b.targetY) b.y += 165 * dt;
      else {
        b.x += b.vx * (1 + (b.phase - 1) * 0.3) * dt;
        if (b.x < 56 || b.x > this.w - 56) b.vx *= -1;
      }
      b.turretAngle = Math.atan2(this.py - b.y, this.px - b.x) - Math.PI / 2;
      b.cd -= dt;
      if (b.cd <= 0 && this.cloakTime <= 0) {
        b.patternIdx = (b.patternIdx + 1) % 3;
        b.cd = Math.max(0.75, 1.8 - b.phase * 0.26 - (this.galaxyId - 1) * 0.06);
        const speedBoost = 1 + (this.galaxyId - 1) * 0.08;
        if (b.patternIdx === 0) {
          const n = 7 + b.phase * 2;
          for (let i = 0; i < n; i++) {
            const a = Math.PI * 0.15 + (Math.PI * 0.7 * i) / (n - 1);
            this.ebullets.push({ x: b.x, y: b.y + 18, vx: Math.cos(a) * 175 * speedBoost, vy: Math.sin(a) * 175 * speedBoost, r: 5.8, color: '#f43f5e', shape: 'orb' });
          }
        } else if (b.patternIdx === 1) {
          const ang = Math.atan2(this.py - b.y, this.px - b.x);
          for (let k = -1; k <= 1; k++) {
            this.ebullets.push({ x: b.x, y: b.y + 20, vx: Math.cos(ang + k * 0.18) * 235 * speedBoost, vy: Math.sin(ang + k * 0.18) * 235 * speedBoost, r: 6.2, color: '#fb923c', shape: 'diamond' });
          }
        } else {
          const n = 10 + (this.galaxyId >= 4 ? 2 : 0);
          for (let i = 0; i < n; i++) {
            const a = (Math.PI * 2 * i) / n + this.sectorElapsed * 0.8;
            this.ebullets.push({ x: b.x, y: b.y, vx: Math.cos(a) * 150 * speedBoost, vy: Math.sin(a) * 150 * speedBoost, r: 5.5, color: '#e879f9', shape: 'ring' });
          }
        }
      }
    }

    _updateEBullets(dt) {
      for (let i = this.ebullets.length - 1; i >= 0; i--) {
        const b = this.ebullets[i];
        if (this.gravWell) {
          const gx = this.gravWell.x - b.x, gy = this.gravWell.y - b.y;
          const gd = Math.hypot(gx, gy);
          if (gd > 24 && gd < 220) {
            b.vx += (gx / gd) * 90 * dt;
            b.vy += (gy / gd) * 90 * dt;
          }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.x < -20 || b.x > this.w + 20 || b.y < -20 || b.y > this.h + 20) {
          this.ebullets.splice(i, 1); continue;
        }
        const dist = Math.hypot(b.x - this.px, b.y - this.py);
        if (this.domeTime > 0 && dist < 44) {
          this._allocParticle(0, b.x, b.y, rand(-60, 60), rand(-60, 60), 0.18, 2.5, 0, '#f59e0b');
          this.ebullets.splice(i, 1);
          continue;
        }
        if (dist < b.r + 11) {
          this.ebullets.splice(i, 1);
          this._hitPlayer(12 + (this.galaxyId - 1) * 2);
        }
      }
    }

    _hitPlayer(dmg) {
      if (this.godMode || this.invuln > 0 || this.domeTime > 0 || this.cloakTime > 0 || this.aegisActive > 0) return;
      const dodgeChance = [0, 0.10, 0.18, 0.25][this.cardLvl('phase')];
      if (_rng() < dodgeChance) {
        this._spawnFloat(-1, this.px, this.py - 18, _word('dodge'), false);
        return;
      }
      this.hp = Math.max(0, this.hp - dmg);
      this.invuln = 0.65;
      this._addShake(8);
      this._spawnExplosion(this.px, this.py, '#ef4444', 14, 38, false);
      playSfx('hit');
      if (this.hp <= 0) {
        this.running = false;
        playSfx('die');
        this.cb.onGameOver?.({ score: this.score, dust: this.runDust, sector: this.sector, galaxy: this.galaxyId });
      }
    }

    _dropGem(x, y, val) {
      if (this.gems.length > 80) return;
      this.gems.push({ x, y, val });
    }

    _updateGems(dt) {
      const magMult = [1, 1.65, 2.30, 3.10][this.cardLvl('magnet')];
      const greedMult = [1, 1.25, 1.5, 1.8][this.cardLvl('greed')];
      const magRange = this.waveMagnet ? 2000 : 75 * magMult;
      for (let i = this.gems.length - 1; i >= 0; i--) {
        const g = this.gems[i];
        const dx = this.px - g.x, dy = this.py - g.y;
        const d = Math.hypot(dx, dy);
        if (d < magRange) {
          const sp = this.waveMagnet ? 580 : 360 * (1 + (magRange - d) / magRange);
          g.x += (dx / Math.max(1, d)) * sp * dt;
          g.y += (dy / Math.max(1, d)) * sp * dt;
        } else {
          g.y += 38 * dt;
        }
        if (d < 18) {
          this.gems.splice(i, 1);
          this.xp += g.val * greedMult;
          const vampLvl = this.cardLvl('vamp');
          if (vampLvl > 0 && _rng() < [0, 0.12, 0.22, 0.35][vampLvl]) {
            this.hp = Math.min(this.maxHp, this.hp + (vampLvl >= 3 ? 3 : 2));
          }
          if (this.xp >= this.xpNext) {
            this.xp -= this.xpNext;
            this.level++;
            this.xpNext = Math.round(this.xpNext * 1.32 + 12);
            this._triggerCardPick();
          }
        } else if (g.y > this.h + 25) {
          this.gems.splice(i, 1);
        }
      }
      if (this.gems.length === 0) this.waveMagnet = false;
    }

    _triggerCardPick() {
      const choices = this.getCardChoices();
      if (choices.length === 0) return;
      this.cardModalOpen = true;
      this.slowMo = 0.05;
      this.cb.onLevelUp?.(choices, this.rerolls);
    }

    rerollCards() {
      if (this.rerolls <= 0) return [];
      this.rerolls--;
      return this.getCardChoices();
    }

    _sectorCleared() {
      const hpRatio = this.hp / Math.max(1, this.maxHp);
      const stars = hpRatio >= 0.75 ? 3 : hpRatio >= 0.4 ? 2 : 1;
      const bonusDust = 15 + this.sector * 6 + (this.galaxyId - 1) * 10;
      this.runDust += bonusDust;
      this.running = false;
      this._bossSpawnedForSector = false;
      playSfx('win');
      this.cb.onSectorClear?.({
        galaxy: this.galaxyId,
        sector: this.sector,
        stars,
        score: this.score,
        dust: this.runDust,
        galaxyDone: this.sector >= 10 || this.singleSectorMode
      });
    }

    nextSector() {
      this._bossSpawnedForSector = false;
      this._startSector(this.sector + 1);
      this.running = true;
      this.paused = false;
      this.lastTs = performance.now();
      const loop = ts => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
        this.lastTs = ts;
        if (!this.paused) this.update(dt * this.slowMo);
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    _addShake(amt) {
      if (!REDUCED_MOTION) this.shake = Math.min(12, this.shake + amt);
    }

    _allocParticle(kind, x, y, vx, vy, life, r, rEnd, color) {
      const p = this.particles[this._pCursor];
      this._pCursor = (this._pCursor + 1) % MAX_PARTICLES;
      p.active = true;
      p.kind = kind;
      p.x = x; p.y = y; p.vx = vx; p.vy = vy;
      p.life = life; p.maxLife = life;
      p.r = r; p.rEnd = rEnd;
      p.color = color;
      p.rot = rand(0, Math.PI * 2);
      p.vrot = rand(-6, 6);
    }

    _spawnExplosion(x, y, color, count, ringR, withDebris) {
      this._allocParticle(4, x, y, 0, 0, 0.14, ringR * 0.45, ringR * 0.9, '#ffffff');
      this._allocParticle(1, x, y, 0, 0, 0.34, 6, ringR, color);
      for (let i = 0; i < count; i++) {
        const a = _rng() * Math.PI * 2;
        const sp = rand(55, 220);
        const isDebris = withDebris && i % 3 === 0;
        this._allocParticle(
          isDebris ? 2 : 0,
          x, y,
          Math.cos(a) * sp, Math.sin(a) * sp,
          rand(0.24, 0.55),
          isDebris ? rand(3.2, 5.5) : rand(1.6, 3.6),
          0,
          isDebris ? '#cbd5e1' : color
        );
      }
    }

    _spawnFloat(targetId, x, y, val, isCrit) {
      const isNum = typeof val === 'number';
      if (isNum && targetId > 0) {
        for (let i = 0; i < MAX_FLOATS; i++) {
          const f = this.floats[i];
          if (f.active && f.targetId === targetId && f.aggTimer > 0) {
            f.dmgSum += val;
            f.text = String(Math.round(f.dmgSum));
            f.isCrit = f.isCrit || isCrit;
            f.life = 0.62;
            f.x = x;
            f.y = y;
            return;
          }
        }
      }
      const f = this.floats[this._fCursor];
      this._fCursor = (this._fCursor + 1) % MAX_FLOATS;
      f.active = true;
      f.targetId = targetId;
      f.dmgSum = isNum ? val : 0;
      f.aggTimer = isNum ? 0.16 : 0;
      f.x = x;
      f.y = y;
      f.life = 0.62;
      f.maxLife = 0.62;
      f.isCrit = isCrit;
      f.text = isNum ? String(Math.round(val)) : String(val);
    }

    _updateParticles(dt) {
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = this.particles[i];
        if (!p.active) continue;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += p.vrot * dt;
        p.life -= dt;
        if (p.life <= 0) p.active = false;
      }
      for (let i = 0; i < MAX_FLOATS; i++) {
        const f = this.floats[i];
        if (!f.active) continue;
        if (f.aggTimer > 0) f.aggTimer -= dt;
        f.y -= 30 * dt;
        f.life -= dt;
        if (f.life <= 0) f.active = false;
      }
    }

    render() {
      const ctx = this.ctx;
      const t = this.sectorElapsed;
      const sprites = global.SHUTTLE_SPRITES;
      ctx.fillStyle = this.bgGrad || '#050816';
      ctx.fillRect(0, 0, this.w, this.h);

      ctx.save();
      if (this.shake > 0) ctx.translate(rand(-this.shake, this.shake), rand(-this.shake, this.shake));

      const moving = this.running && !this.paused ? 1 : 0.15;

      // Volumetric distant planets per galaxy palette
      const planetCols = [
        ['rgba(125,211,252,0.55)', 'rgba(14,116,144,0.45)'],
        ['rgba(253,164,175,0.55)', 'rgba(159,18,57,0.45)'],
        ['rgba(165,243,252,0.6)', 'rgba(14,116,144,0.48)'],
        ['rgba(217,249,157,0.5)', 'rgba(63,98,20,0.48)'],
        ['rgba(216,180,254,0.55)', 'rgba(88,28,135,0.5)']
      ][this.galaxyId - 1] || ['rgba(125,211,252,0.55)', 'rgba(14,116,144,0.45)'];

      for (let i = 0; i < this.planets.length; i++) {
        const pl = this.planets[i];
        pl.y += pl.speed * 0.016 * moving;
        if (pl.y > 1.15) pl.y = -0.15;
        if (sprites && sprites.drawPlanet) {
          sprites.drawPlanet(ctx, pl.x * this.w, pl.y * this.h, pl.r, planetCols[0], planetCols[1], pl.ring);
        }
      }

      // Background silhouettes (jagged asteroids / ice shards / hive pods)
      for (let i = 0; i < this.bgRocks.length; i++) {
        const br = this.bgRocks[i];
        br.y += br.speed * 0.016 * moving;
        br.rot += br.vrot * 0.016;
        if (br.y > 1.1) { br.y = -0.1; br.x = Math.random(); }
        br.xPx = br.x * this.w;
        br.yPx = br.y * this.h;
        if (sprites && sprites.drawBgSilhouette) {
          sprites.drawBgSilhouette(ctx, br, this.galaxyId);
        }
      }

      // 3-layer parallax stars
      for (let i = 0; i < this.stars.length; i++) {
        const s = this.stars[i];
        s.y += 0.016 * 0.035 * s.z * moving;
        if (s.y > 1) s.y -= 1;
        ctx.fillStyle = s.tint;
        ctx.globalAlpha = 0.25 + s.layer * 0.24 + 0.15 * Math.sin(t * 2.5 + s.twinkle);
        ctx.beginPath();
        ctx.arc(s.x * this.w, s.y * this.h, s.r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Ice fields (Galaxy 3) rendered under entities
      for (const hz of this.hazards) {
        if (hz.kind !== 'ice') continue;
        ctx.fillStyle = 'rgba(103,232,249,0.14)';
        ctx.strokeStyle = 'rgba(165,243,252,0.35)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }

      // Gravity well (Galaxy 5)
      if (this.gravWell) {
        const gw = this.gravWell;
        const pulse = 1 + 0.08 * Math.sin(t * 5);
        ctx.strokeStyle = 'rgba(192,132,252,0.35)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, gw.r * 1.45 * pulse, 0, Math.PI * 2);
        ctx.stroke();
        ctx.fillStyle = '#090314';
        ctx.beginPath();
        ctx.arc(gw.x, gw.y, gw.r * 0.72, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#e9d5ff';
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }

      // Laser beam
      if (this.laserBeamTime > 0) {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.fillStyle = 'rgba(56,189,248,0.45)';
        ctx.fillRect(this.px - 18, 0, 36, this.py);
        ctx.fillStyle = '#e0f2fe';
        ctx.fillRect(this.px - 5, 0, 10, this.py);
        ctx.restore();
      }

      // XP gems
      const gemPulse = 1 + 0.15 * Math.sin(t * 8);
      for (let i = 0; i < this.gems.length; i++) {
        const gm = this.gems[i];
        if (this.waveMagnet) {
          ctx.strokeStyle = 'rgba(52,211,153,0.45)';
          ctx.lineWidth = 2;
          ctx.beginPath();
          ctx.moveTo(gm.x, gm.y);
          ctx.lineTo(gm.x + (gm.x - this.px) * 0.08, gm.y + (gm.y - this.py) * 0.08);
          ctx.stroke();
        }
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        const gs = 6 * gemPulse;
        ctx.moveTo(gm.x, gm.y - gs);
        ctx.lineTo(gm.x + gs * 0.8, gm.y);
        ctx.lineTo(gm.x, gm.y + gs);
        ctx.lineTo(gm.x - gs * 0.8, gm.y);
        ctx.closePath();
        ctx.fill();
      }

      // Mines
      for (const m of this.mines) {
        const armed = m.arm <= 0;
        ctx.fillStyle = armed ? '#f59e0b' : '#64748b';
        ctx.strokeStyle = '#fef3c7';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        if (armed && Math.floor(t * 8) % 2 === 0) {
          ctx.fillStyle = '#ef4444';
          ctx.beginPath();
          ctx.arc(m.x, m.y, 4, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Asteroids
      for (let i = 0; i < this.asteroids.length; i++) {
        const a = this.asteroids[i];
        if (sprites) {
          const spr = sprites.getAsteroidSprite(a.variant || 0, a.r, this.dpr);
          const logical = spr.width / this.dpr;
          ctx.save();
          ctx.translate(a.x, a.y);
          ctx.rotate(a.rot);
          ctx.drawImage(spr, -logical / 2, -logical / 2, logical, logical);
          ctx.restore();
        }
      }

      // Enemies
      for (let i = 0; i < this.enemies.length; i++) {
        if (sprites) sprites.drawEnemy(ctx, this.enemies[i], t);
      }

      // Boss
      if (this.boss && sprites) {
        sprites.drawBoss(ctx, this.boss, t);
      }

      // Player ship
      if (this.invuln <= 0 || Math.floor(this.invuln * 18) % 2 === 0) {
        if (sprites) {
          const spr = sprites.getShipSprite(this.shipId, this.dpr);
          const logical = spr.width / this.dpr;
          ctx.save();
          if (this.cloakTime > 0) ctx.globalAlpha = 0.42;
          ctx.translate(this.px, this.py);
          ctx.rotate(this.bank);
          ctx.drawImage(spr, -logical / 2, -logical / 2, logical, logical);
          ctx.restore();
        }
      }
      if (this.domeTime > 0 || this.aegisActive > 0 || this.overdriveTime > 0 || this.inIceField) {
        ctx.strokeStyle = this.domeTime > 0 ? '#f59e0b' : this.overdriveTime > 0 ? '#f43f5e' : this.inIceField ? '#67e8f9' : '#38bdf8';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(this.px, this.py, 40, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Orbital blades
      const blLvl = this.cardLvl('blades');
      if (blLvl > 0) {
        const cnt = blLvl + 1;
        ctx.fillStyle = '#38bdf8';
        for (let i = 0; i < cnt; i++) {
          const a = this.bladeAngle + (Math.PI * 2 * i) / cnt;
          ctx.beginPath();
          ctx.arc(this.px + Math.cos(a) * 46, this.py + Math.sin(a) * 46, 5.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Drones
      ctx.fillStyle = '#34d399';
      for (let i = 0; i < this.drones.length; i++) {
        const d = this.drones[i];
        ctx.beginPath();
        ctx.arc(this.px + Math.cos(d.angle) * 38, this.py + Math.sin(d.angle) * 28, 5, 0, Math.PI * 2);
        ctx.fill();
      }

      // Player bullets
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < this.bullets.length; i++) {
        const b = this.bullets[i];
        const ang = Math.atan2(b.vy, b.vx);
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(ang);
        ctx.fillStyle = b.color;
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 2.4, b.r * 0.72, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(0, 0, b.r * 1.4, b.r * 0.35, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.restore();

      // Enemy bullets
      for (let i = 0; i < this.ebullets.length; i++) {
        const b = this.ebullets[i];
        ctx.fillStyle = b.color;
        ctx.globalAlpha = 0.35;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r * 1.65, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        if (b.shape === 'diamond') {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.moveTo(b.x, b.y - b.r * 1.3);
          ctx.lineTo(b.x + b.r, b.y);
          ctx.lineTo(b.x, b.y + b.r * 1.3);
          ctx.lineTo(b.x - b.r, b.y);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else if (b.shape === 'ring') {
          ctx.strokeStyle = b.color;
          ctx.lineWidth = 2.4;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 0.45, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // Nebula clouds (Galaxy 2) drawn OVER bullets to semi-conceal them
      for (const hz of this.hazards) {
        if (hz.kind !== 'nebula') continue;
        ctx.fillStyle = 'rgba(190,18,60,0.42)';
        ctx.beginPath();
        ctx.arc(hz.x, hz.y, hz.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = 'rgba(251,113,133,0.28)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      // Pooled particles
      for (let i = 0; i < MAX_PARTICLES; i++) {
        const p = this.particles[i];
        if (!p.active) continue;
        const prog = 1 - p.life / p.maxLife;
        ctx.globalAlpha = clamp(1 - prog, 0, 1);
        if (p.kind === 1) {
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2.5 * (1 - prog * 0.7);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + (p.rEnd - p.r) * prog, 0, Math.PI * 2);
          ctx.stroke();
        } else if (p.kind === 2) {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.r, -p.r * 0.65, p.r * 2, p.r * 1.3);
          ctx.restore();
        } else if (p.kind === 4) {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r + (p.rEnd - p.r) * prog, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (1 - prog * 0.5), 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;

      // Pooled damage numbers
      ctx.textAlign = 'center';
      for (let i = 0; i < MAX_FLOATS; i++) {
        const f = this.floats[i];
        if (!f.active) continue;
        ctx.globalAlpha = clamp(f.life / f.maxLife * 1.3, 0, 1);
        ctx.font = f.isCrit ? '900 16px sans-serif' : '800 13px sans-serif';
        ctx.fillStyle = '#0f172a';
        ctx.fillText(f.text, f.x + 1, f.y + 1);
        ctx.fillStyle = f.isCrit ? '#facc15' : '#f8fafc';
        ctx.fillText(f.text, f.x, f.y);
      }
      ctx.globalAlpha = 1;

      // Soft dark gradient under HUD so entering enemies fade smoothly beneath HUD pills
      if (this.hudFadeGrad) {
        ctx.fillStyle = this.hudFadeGrad;
        ctx.fillRect(0, 0, this.w, this.hudTopOffset + 18);
      }

      if (this.warnTimer > 0) {
        ctx.fillStyle = 'rgba(239,68,68,0.95)';
        ctx.font = '900 22px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(this.warnText, this.w / 2, this.h * 0.36);
      }
      ctx.restore();
    }
  }

  global.ShuttleEngine = ShuttleEngine;
})(window);
