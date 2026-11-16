/* Lobby.gg — Pseudo-3D Arcade Racing Engine (Stage 8a) */
(function (w) {
  'use strict';

  const BIOMES = [
    {
      id: 'city',
      skyTop: '#040615',
      skyMid: '#120a2e',
      skyHor: '#3b0e4c',
      groundA: '#0b0e1c',
      groundB: '#080a14',
      roadA: '#171a26',
      roadB: '#1c2030',
      curbA: '#ff2238',
      curbB: '#e2e8f0',
      laneColor: 'rgba(56, 189, 248, 0.72)',
      edgeGlow: '#00f0ff',
      propType: 'lamp',
      horizonType: 'city'
    },
    {
      id: 'desert',
      skyTop: '#16071d',
      skyMid: '#5a162a',
      skyHor: '#e06d2e',
      groundA: '#3d1e12',
      groundB: '#32170e',
      roadA: '#231f24',
      roadB: '#2a242b',
      curbA: '#f59e0b',
      curbB: '#fef3c7',
      laneColor: 'rgba(253, 224, 71, 0.78)',
      edgeGlow: '#fb923c',
      propType: 'cactus',
      horizonType: 'canyon'
    },
    {
      id: 'coast',
      skyTop: '#031226',
      skyMid: '#0b3459',
      skyHor: '#1e7ca3',
      groundA: '#083344',
      groundB: '#0c4156',
      roadA: '#182330',
      roadB: '#1e2b3b',
      curbA: '#22d3ee',
      curbB: '#f8fafc',
      laneColor: 'rgba(248, 250, 252, 0.75)',
      edgeGlow: '#38bdf8',
      propType: 'palm',
      horizonType: 'coast'
    }
  ];

  const TRAFFIC_PALETTES = [
    { body: '#0ea5e9', dark: '#0369a1', trim: '#bae6fd' },
    { body: '#10b981', dark: '#047857', trim: '#a7f3d0' },
    { body: '#f59e0b', dark: '#b45309', trim: '#fde68a' },
    { body: '#a855f7', dark: '#6b21a8', trim: '#e9d5ff' }
  ];

  function makeOffscreen(wPx, hPx, drawFn) {
    const c = document.createElement('canvas');
    c.width = wPx;
    c.height = hPx;
    const cx = c.getContext('2d');
    drawFn(cx, wPx, hPx);
    return c;
  }

  function buildSprites() {
    // Player car rear perspective view (160x130 offscreen -> sharp when scaled down)
    const player = makeOffscreen(160, 130, (c) => {
      // Soft ground shadow
      c.fillStyle = 'rgba(0,0,0,0.52)';
      c.beginPath();
      c.ellipse(80, 114, 64, 13, 0, 0, Math.PI * 2);
      c.fill();

      // Rear tires
      c.fillStyle = '#090b10';
      c.beginPath();
      c.roundRect(16, 72, 24, 42, 7);
      c.roundRect(120, 72, 24, 42, 7);
      c.fill();

      // Side mirrors
      c.fillStyle = '#b91c1c';
      c.beginPath();
      c.roundRect(16, 46, 14, 9, 4);
      c.roundRect(130, 46, 14, 9, 4);
      c.fill();

      // Lower wide body & rear fenders
      const bodyGrad = c.createLinearGradient(80, 28, 80, 112);
      bodyGrad.addColorStop(0, '#ff4d63');
      bodyGrad.addColorStop(0.45, '#e11d48');
      bodyGrad.addColorStop(1, '#7f1d1d');
      c.fillStyle = bodyGrad;
      c.beginPath();
      c.moveTo(34, 44);
      c.lineTo(126, 44);
      c.lineTo(140, 78);
      c.lineTo(136, 108);
      c.lineTo(24, 108);
      c.lineTo(20, 78);
      c.closePath();
      c.fill();

      // Roof & cabin glass
      const cabinGrad = c.createLinearGradient(80, 18, 80, 62);
      cabinGrad.addColorStop(0, '#1e293b');
      cabinGrad.addColorStop(0.5, '#0f172a');
      cabinGrad.addColorStop(1, '#38bdf8');
      c.fillStyle = cabinGrad;
      c.beginPath();
      c.moveTo(48, 22);
      c.lineTo(112, 22);
      c.lineTo(124, 58);
      c.lineTo(36, 58);
      c.closePath();
      c.fill();

      // Roof specular rim
      c.strokeStyle = 'rgba(255,255,255,0.45)';
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(50, 24);
      c.lineTo(110, 24);
      c.stroke();

      // Center racing stripe
      c.fillStyle = 'rgba(255,255,255,0.88)';
      c.fillRect(75, 58, 10, 32);

      // Rear wing spoiler
      c.fillStyle = '#0f172a';
      c.fillRect(24, 56, 112, 8);
      c.fillStyle = '#334155';
      c.fillRect(42, 62, 7, 10);
      c.fillRect(111, 62, 7, 10);

      // Rear diffuser & bumper
      c.fillStyle = '#0b0f19';
      c.beginPath();
      c.roundRect(28, 88, 104, 22, 5);
      c.fill();

      // Twin exhaust pipes
      c.fillStyle = '#94a3b8';
      c.beginPath();
      c.arc(46, 102, 5.5, 0, Math.PI * 2);
      c.arc(114, 102, 5.5, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#020617';
      c.beginPath();
      c.arc(46, 102, 3.2, 0, Math.PI * 2);
      c.arc(114, 102, 3.2, 0, Math.PI * 2);
      c.fill();

      // Glowing LED taillights
      c.fillStyle = '#ff2a4b';
      c.beginPath();
      c.roundRect(27, 75, 32, 9, 4);
      c.roundRect(101, 75, 32, 9, 4);
      c.fill();
      c.fillStyle = '#fecdd3';
      c.fillRect(32, 78, 22, 3);
      c.fillRect(106, 78, 22, 3);
    });

    // Traffic cars (4 models)
    const traffic = TRAFFIC_PALETTES.map((pal, idx) => {
      const tall = idx === 2 ? 12 : 0;
      return makeOffscreen(140, 120, (c) => {
        c.fillStyle = 'rgba(0,0,0,0.48)';
        c.beginPath();
        c.ellipse(70, 106, 54, 11, 0, 0, Math.PI * 2);
        c.fill();

        // Wheels
        c.fillStyle = '#090b10';
        c.beginPath();
        c.roundRect(16, 70, 20, 34, 6);
        c.roundRect(104, 70, 20, 34, 6);
        c.fill();

        // Body
        const bg = c.createLinearGradient(70, 34 - tall, 70, 98);
        bg.addColorStop(0, pal.body);
        bg.addColorStop(1, pal.dark);
        c.fillStyle = bg;
        c.beginPath();
        c.roundRect(20, 42 - tall, 100, 56 + tall, 10);
        c.fill();

        // Windshield/rear glass
        c.fillStyle = '#0f172a';
        c.beginPath();
        c.moveTo(36, 22 - tall);
        c.lineTo(104, 22 - tall);
        c.lineTo(114, 50 - tall);
        c.lineTo(26, 50 - tall);
        c.closePath();
        c.fill();

        // Roof edge
        c.strokeStyle = pal.trim;
        c.lineWidth = 2;
        c.beginPath();
        c.moveTo(38, 23 - tall);
        c.lineTo(102, 23 - tall);
        c.stroke();

        // Bumper
        c.fillStyle = '#0f172a';
        c.fillRect(24, 82, 92, 16);

        // Red brake lights
        c.fillStyle = '#ff2238';
        c.beginPath();
        c.roundRect(25, 68, 22, 9, 3);
        c.roundRect(93, 68, 22, 9, 3);
        c.fill();
        c.fillStyle = '#fda4af';
        c.fillRect(28, 71, 16, 3);
        c.fillRect(96, 71, 16, 3);
      });
    });

    // Traffic cone
    const cone = makeOffscreen(80, 90, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.beginPath();
      c.ellipse(40, 78, 26, 7, 0, 0, Math.PI * 2);
      c.fill();
      c.fillStyle = '#ea580c';
      c.beginPath();
      c.roundRect(14, 68, 52, 12, 4);
      c.fill();
      c.fillStyle = '#f97316';
      c.beginPath();
      c.moveTo(35, 12);
      c.lineTo(45, 12);
      c.lineTo(58, 70);
      c.lineTo(22, 70);
      c.closePath();
      c.fill();
      c.fillStyle = '#f8fafc';
      c.beginPath();
      c.moveTo(31, 32);
      c.lineTo(49, 32);
      c.lineTo(52, 46);
      c.lineTo(28, 46);
      c.closePath();
      c.fill();
    });

    // Road barrier
    const barrier = makeOffscreen(140, 80, (c) => {
      c.fillStyle = 'rgba(0,0,0,0.45)';
      c.fillRect(14, 62, 112, 10);
      c.fillStyle = '#334155';
      c.fillRect(24, 24, 12, 44);
      c.fillRect(104, 24, 12, 44);
      c.save();
      c.beginPath();
      c.roundRect(10, 18, 120, 32, 6);
      c.clip();
      c.fillStyle = '#dc2626';
      c.fillRect(10, 18, 120, 32);
      c.fillStyle = '#f8fafc';
      for (let x = -20; x < 140; x += 28) {
        c.beginPath();
        c.moveTo(x, 50);
        c.lineTo(x + 14, 18);
        c.lineTo(x + 26, 18);
        c.lineTo(x + 12, 50);
        c.closePath();
        c.fill();
      }
      c.restore();
      c.fillStyle = '#fbbf24';
      c.beginPath();
      c.arc(24, 14, 6, 0, Math.PI * 2);
      c.arc(116, 14, 6, 0, Math.PI * 2);
      c.fill();
    });

    // Coin
    const coin = makeOffscreen(64, 64, (c) => {
      const g = c.createRadialGradient(24, 22, 4, 32, 32, 26);
      g.addColorStop(0, '#fef08a');
      g.addColorStop(0.55, '#f59e0b');
      g.addColorStop(1, '#b45309');
      c.fillStyle = g;
      c.beginPath();
      c.arc(32, 32, 25, 0, Math.PI * 2);
      c.fill();
      c.strokeStyle = '#fef9c3';
      c.lineWidth = 3;
      c.beginPath();
      c.arc(32, 32, 19, 0, Math.PI * 2);
      c.stroke();
      c.fillStyle = '#fef9c3';
      c.font = '900 24px Inter, sans-serif';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText('$', 32, 33);
    });

    return { player, traffic, cone, barrier, coin };
  }

  class RaceEngine {
    constructor(canvas, opts) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.opts = opts || {};
      this.sprites = buildSprites();

      this.numLanes = Math.max(2, Math.min(4, Number(this.opts.numLanes) || 3));
      this.godMode = false;
      this.forcedBiome = null;
      this.debugSpeed = null;

      this.dpr = 1;
      this.w = 340;
      this.h = 560;
      this.rafId = 0;
      this.running = false;
      this.lastTs = 0;

      // Track & Entities
      this.entities = [];
      this.stars = Array.from({ length: 42 }, (_, i) => ({
        x: ((i * 73) % 100) / 100,
        y: ((i * 41) % 34) / 100,
        r: (i % 3 === 0) ? 1.8 : 1.0,
        a: 0.35 + (i % 5) * 0.13
      }));
      this.speedLines = Array.from({ length: 14 }, (_, i) => ({
        side: i % 2 === 0 ? -1 : 1,
        y: (i / 14),
        len: 28 + (i % 4) * 18
      }));

      this.resetState();
      this.resize();
    }

    resize() {
      this.dpr = Math.min(w.devicePixelRatio || 1, 2);
      const rect = this.canvas.getBoundingClientRect();
      const cw = Math.max(240, Math.round(rect.width || 340));
      const ch = Math.max(300, Math.round(rect.height || 540));
      this.w = cw;
      this.h = ch;
      this.canvas.width = Math.round(cw * this.dpr);
      this.canvas.height = Math.round(ch * this.dpr);
      this.canvas._logicalDpr = this.dpr;
    }

    resetState() {
      this.distance = 0;
      this.coins = 0;
      this.speedKmh = 125;
      this.maxSpeedKmh = 125;
      this.nitro = 45;
      this.nitroTime = 0;
      this.roadPos = 0;
      this.targetLane = Math.floor(this.numLanes / 2);
      this.carLane = this.targetLane;
      this.carTilt = 0;
      this.spawnDist = 0;
      this.entities.length = 0;
      this.crashing = false;
      this.crashTimer = 0;
      this.gameOver = false;
      this.lastBiomeIdx = 0;
      this.time = 0;
    }

    setLanes(n) {
      this.numLanes = Math.max(2, Math.min(4, Number(n) || 3));
      this.targetLane = Math.min(this.numLanes - 1, Math.max(0, this.targetLane));
      this.carLane = this.targetLane;
    }

    steer(dir) {
      if (this.gameOver || this.crashing) return false;
      const next = this.targetLane + dir;
      if (next < 0 || next >= this.numLanes) return false;
      this.targetLane = next;
      if (w.ArcadeFX) w.ArcadeFX.vibrate(6);
      return true;
    }

    triggerNitro() {
      if (this.gameOver || this.crashing) return false;
      if (this.nitroTime > 0 || this.nitro < 35) return false;
      this.nitroTime = 2.6;
      this.nitro = Math.max(0, this.nitro - 45);
      if (w.ArcadeFX) {
        w.ArcadeFX.vibrate([12, 20, 12]);
        w.ArcadeFX.floatText(this.w * 0.5, this.h * 0.72, '⚡ NITRO!', {
          canvas: this.canvas, color: '#38bdf8', size: 18, life: 0.75
        });
      }
      return true;
    }

    start() {
      this.stop(false);
      this.resetState();
      this.resize();
      this.running = true;
      this.lastTs = performance.now();
      const loop = (ts) => {
        if (!this.running) return;
        const dt = Math.min(0.05, Math.max(0.001, (ts - this.lastTs) / 1000));
        this.lastTs = ts;
        this.update(dt);
        this.render();
        this.rafId = requestAnimationFrame(loop);
      };
      this.rafId = requestAnimationFrame(loop);
    }

    stop(clearCanvas) {
      this.running = false;
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = 0;
      }
      if (clearCanvas !== false) this.clearCanvas();
    }

    clearCanvas() {
      if (!this.ctx) return;
      this.ctx.setTransform(1, 0, 0, 1, 0, 0);
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    getBiomeIndex() {
      if (this.forcedBiome !== null && this.forcedBiome >= 0 && this.forcedBiome < BIOMES.length) {
        return this.forcedBiome;
      }
      return Math.floor(this.distance / 750) % BIOMES.length;
    }

    spawnWave() {
      // Choose 1 or at most numLanes - 1 obstacles so at least 1 lane is guaranteed open
      const count = (this.numLanes >= 3 && Math.random() < 0.42 && this.distance > 120) ? 2 : 1;
      const lanes = [];
      for (let i = 0; i < this.numLanes; i++) lanes.push(i);
      // Simple Fisher-Yates on tiny array
      for (let i = lanes.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = lanes[i]; lanes[i] = lanes[j]; lanes[j] = tmp;
      }
      const blocked = new Set();
      for (let k = 0; k < count; k++) {
        const lane = lanes[k];
        // Prevent blocking all lanes with nearby existing objects
        const nearRow = this.entities.filter(e => e.type !== 'coin' && e.z > 0.65);
        const occupied = new Set(nearRow.map(e => e.lane));
        occupied.add(lane);
        if (occupied.size >= this.numLanes) continue;
        blocked.add(lane);

        const r = Math.random();
        let kind = 'car';
        if (r < 0.18) kind = 'cone';
        else if (r < 0.30) kind = 'barrier';
        this.entities.push({
          type: 'obs',
          kind,
          lane,
          variant: Math.floor(Math.random() * 4),
          z: 1.0,
          relFactor: kind === 'car' ? (0.48 + Math.random() * 0.24) : 1.0
        });
      }

      // Coin in a free lane
      if (Math.random() < 0.72) {
        const free = [];
        for (let i = 0; i < this.numLanes; i++) if (!blocked.has(i)) free.push(i);
        if (free.length) {
          const cLane = free[Math.floor(Math.random() * free.length)];
          this.entities.push({
            type: 'coin',
            lane: cLane,
            z: 0.96,
            phase: Math.random() * Math.PI * 2
          });
        }
      }
    }

    update(dt) {
      this.time += dt;

      if (this.crashing) {
        this.crashTimer -= dt;
        this.speedKmh = Math.max(0, this.speedKmh * Math.pow(0.06, dt));
        this.roadPos += (this.speedKmh / 120) * dt * 2.2;
        if (this.crashTimer <= 0) {
          this.crashing = false;
          this.gameOver = true;
          this.running = false;
          if (typeof this.opts.onCrash === 'function') {
            this.opts.onCrash({
              distance: Math.floor(this.distance),
              coins: this.coins,
              maxSpeed: Math.round(this.maxSpeedKmh)
            });
          }
        }
        return;
      }

      // Speed progression & nitro
      const baseSpeed = this.debugSpeed != null ? this.debugSpeed : Math.min(265, 130 + this.distance * 0.045);
      if (this.nitroTime > 0) {
        this.nitroTime = Math.max(0, this.nitroTime - dt);
        this.speedKmh = baseSpeed * 1.58;
      } else {
        this.speedKmh += (baseSpeed - this.speedKmh) * Math.min(1, dt * 4);
        this.nitro = Math.min(100, this.nitro + dt * 5.2);
      }
      if (this.speedKmh > this.maxSpeedKmh) this.maxSpeedKmh = this.speedKmh;

      // Distance & Biome check
      const distStep = (this.speedKmh / 3.6) * dt;
      this.distance += distStep;
      this.roadPos += (this.speedKmh / 100) * dt * 3.1;

      const bIdx = this.getBiomeIndex();
      if (bIdx !== this.lastBiomeIdx) {
        this.lastBiomeIdx = bIdx;
        if (typeof this.opts.onBiomeChange === 'function') this.opts.onBiomeChange(bIdx, BIOMES[bIdx].id);
      }

      // Smooth steering & tilt
      const prevLane = this.carLane;
      this.carLane += (this.targetLane - this.carLane) * Math.min(1, dt * 16);
      const latVel = (this.carLane - prevLane) / dt;
      const targetTilt = Math.max(-0.24, Math.min(0.24, latVel * 0.025));
      this.carTilt += (targetTilt - this.carTilt) * Math.min(1, dt * 14);

      // Spawn waves by distance covered
      const spawnInterval = Math.max(38, 66 - this.distance * 0.01);
      this.spawnDist += distStep;
      if (this.spawnDist >= spawnInterval) {
        this.spawnDist = 0;
        this.spawnWave();
      }

      // Player depth band on road (z near 0.085)
      const playerZ = 0.085;
      const worldZSpeed = (this.speedKmh / 135) * 0.72;

      for (let i = this.entities.length - 1; i >= 0; i--) {
        const e = this.entities[i];
        const factor = e.type === 'obs' ? e.relFactor : 1.0;
        e.z -= worldZSpeed * factor * dt;
        if (e.type === 'coin') e.phase += dt * 7;

        // Clean up anything passed behind camera (never stuck offscreen)
        if (e.z < -0.1) {
          this.entities.splice(i, 1);
          continue;
        }

        // Collision check near playerZ
        if (Math.abs(e.z - playerZ) < 0.048 && Math.abs(e.lane - this.carLane) < 0.44) {
          if (e.type === 'coin') {
            this.coins++;
            this.distance += 15;
            this.nitro = Math.min(100, this.nitro + 18);
            const pt = this.projectEntityPos(e);
            if (w.ArcadeFX) {
              w.ArcadeFX.burst(pt.x, pt.y, {
                canvas: this.canvas, count: 14, speed: 170, size: 3.5,
                colors: ['#fef08a', '#f59e0b', '#ffffff'], shape: 'spark'
              });
              w.ArcadeFX.floatText(pt.x, pt.y - 12, '+1 🪙', {
                canvas: this.canvas, color: '#fde047', size: 15
              });
              w.ArcadeFX.vibrate(10);
            }
            if (typeof this.opts.onCoin === 'function') this.opts.onCoin();
            this.entities.splice(i, 1);
          } else if (!this.godMode) {
            this.triggerCrash();
            return;
          }
        }
      }

      if (typeof this.opts.onHud === 'function') {
        this.opts.onHud({
          distance: Math.floor(this.distance),
          speed: Math.round(this.speedKmh),
          coins: this.coins,
          nitro: this.nitro,
          nitroActive: this.nitroTime > 0,
          biome: bIdx
        });
      }
    }

    triggerCrash() {
      if (this.crashing || this.gameOver) return;
      this.crashing = true;
      this.crashTimer = 0.55;
      const carPos = this.projectEntityPos({ lane: this.carLane, z: 0.085 });
      if (w.ArcadeFX) {
        w.ArcadeFX.burst(carPos.x, carPos.y, {
          canvas: this.canvas, count: 36, speed: 290, size: 5, life: 0.72,
          colors: ['#ff2238', '#f97316', '#fde047', '#ffffff'], shape: 'spark'
        });
        w.ArcadeFX.shake(this.canvas, 10, 420);
        w.ArcadeFX.flash('#ff2238', 0.36, 260);
        w.ArcadeFX.vibrate([30, 25, 50]);
      }
      if (typeof this.opts.onCrashSound === 'function') this.opts.onCrashSound();
    }

    getHorizonY() {
      const hill = Math.sin(this.roadPos * 0.22) * (this.h * 0.025);
      return this.h * 0.30 + hill;
    }

    getCurveOffset(z) {
      // Smooth curvature that grows quadratically toward the horizon (z in [0..1])
      const curveStrength = Math.sin(this.roadPos * 0.14) * (this.w * 0.28);
      return curveStrength * z * z;
    }

    projectDepth(z) {
      // Map linear world distance z in [0..1] to screen Y and scale
      // z=1 -> horizon, z=0 -> bottom of canvas
      const horizonY = this.getHorizonY();
      const fov = 0.22 + (this.nitroTime > 0 ? 0.03 : 0);
      const p = fov / (z + fov); // p in [fov/(1+fov) .. 1]
      const pMin = fov / (1 + fov);
      const t = (p - pMin) / (1 - pMin); // t=0 at horizon, t=1 at camera bottom
      const y = horizonY + t * (this.h - horizonY);
      const halfW = this.w * (0.065 + t * 0.49);
      const centerX = this.w * 0.5 + this.getCurveOffset(z);
      return { y, halfW, centerX, t, scale: halfW / (this.w * 0.555) };
    }

    projectEntityPos(e) {
      const pr = this.projectDepth(Math.max(0, Math.min(1, e.z)));
      const laneNorm = ((e.lane + 0.5) / this.numLanes - 0.5) * 2; // [-1..1] inside edges
      const margin = 1 - (1 / this.numLanes) * 0.1;
      return {
        x: pr.centerX + laneNorm * pr.halfW * margin,
        y: pr.y,
        scale: pr.scale,
        t: pr.t
      };
    }

    render() {
      const ctx = this.ctx;
      const wPx = this.w;
      const hPx = this.h;
      const biome = BIOMES[this.getBiomeIndex()];
      const horizonY = this.getHorizonY();
      const horCurve = this.getCurveOffset(1.0);

      ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

      // 1. Sky Gradient
      const skyG = ctx.createLinearGradient(0, 0, 0, horizonY + 8);
      skyG.addColorStop(0, biome.skyTop);
      skyG.addColorStop(0.6, biome.skyMid);
      skyG.addColorStop(1, biome.skyHor);
      ctx.fillStyle = skyG;
      ctx.fillRect(0, 0, wPx, horizonY + 8);

      // Stars (city / coast) or Sun (desert)
      if (biome.horizonType === 'canyon') {
        const sunX = wPx * 0.5 + horCurve * 0.35;
        const sunY = horizonY - 14;
        const sunG = ctx.createRadialGradient(sunX, sunY, 4, sunX, sunY, 44);
        sunG.addColorStop(0, '#fef08a');
        sunG.addColorStop(0.55, 'rgba(251,146,60,0.65)');
        sunG.addColorStop(1, 'rgba(251,146,60,0)');
        ctx.fillStyle = sunG;
        ctx.beginPath();
        ctx.arc(sunX, sunY, 44, 0, Math.PI * 2);
        ctx.fill();
      } else {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < this.stars.length; i++) {
          const s = this.stars[i];
          ctx.globalAlpha = s.a * (0.75 + 0.25 * Math.sin(this.time * 2 + i));
          ctx.fillRect(s.x * wPx, s.y * hPx, s.r, s.r);
        }
        ctx.globalAlpha = 1;
      }

      // 2. Parallax Horizon Silhouette
      this.drawHorizon(ctx, biome, horizonY, horCurve * 0.45);

      // 3. Pseudo-3D Road Strips (horizon -> bottom)
      const STEPS = 56;
      const scroll = this.roadPos;
      for (let i = STEPS - 1; i >= 0; i--) {
        const z1 = (i + 1) / STEPS;
        const z0 = i / STEPS;
        const p1 = this.projectDepth(z1);
        const p0 = this.projectDepth(z0);
        const band = Math.floor((z1 * 18 + scroll * 3.5)) % 2 === 0;

        // Terrain / Ground band
        ctx.fillStyle = band ? biome.groundA : biome.groundB;
        ctx.fillRect(0, p1.y, wPx, (p0.y - p1.y) + 1);

        // Coastal sea reflection on right side
        if (biome.horizonType === 'coast') {
          ctx.fillStyle = band ? 'rgba(56,189,248,0.16)' : 'rgba(14,165,233,0.10)';
          ctx.fillRect(p1.centerX + p1.halfW + 10, p1.y, wPx, (p0.y - p1.y) + 1);
        }

        // Rumble curbs
        const cw1 = p1.halfW * 1.11;
        const cw0 = p0.halfW * 1.11;
        ctx.fillStyle = band ? biome.curbA : biome.curbB;
        ctx.beginPath();
        ctx.moveTo(p1.centerX - cw1, p1.y);
        ctx.lineTo(p1.centerX + cw1, p1.y);
        ctx.lineTo(p0.centerX + cw0, p0.y + 0.8);
        ctx.lineTo(p0.centerX - cw0, p0.y + 0.8);
        ctx.closePath();
        ctx.fill();

        // Asphalt surface
        ctx.fillStyle = band ? biome.roadA : biome.roadB;
        ctx.beginPath();
        ctx.moveTo(p1.centerX - p1.halfW, p1.y);
        ctx.lineTo(p1.centerX + p1.halfW, p1.y);
        ctx.lineTo(p0.centerX + p0.halfW, p0.y + 0.8);
        ctx.lineTo(p0.centerX - p0.halfW, p0.y + 0.8);
        ctx.closePath();
        ctx.fill();

        // Dashed lane dividers (every alternating stripe)
        if (band) {
          ctx.fillStyle = biome.laneColor;
          for (let l = 1; l < this.numLanes; l++) {
            const frac = (l / this.numLanes) * 2 - 1;
            const lx1 = p1.centerX + frac * p1.halfW;
            const lx0 = p0.centerX + frac * p0.halfW;
            const lw1 = Math.max(1, p1.scale * 2.5);
            const lw0 = Math.max(1.5, p0.scale * 4.5);
            ctx.beginPath();
            ctx.moveTo(lx1 - lw1 * 0.5, p1.y);
            ctx.lineTo(lx1 + lw1 * 0.5, p1.y);
            ctx.lineTo(lx0 + lw0 * 0.5, p0.y + 0.5);
            ctx.lineTo(lx0 - lw0 * 0.5, p0.y + 0.5);
            ctx.closePath();
            ctx.fill();
          }
        }
      }

      // 4. Roadside Props (lamps / cacti / palms) moving cleanly toward viewer
      this.drawRoadsideProps(ctx, biome);

      // 5. Sort entities far -> near and draw
      const sorted = this.entities.slice().sort((a, b) => b.z - a.z);
      for (let i = 0; i < sorted.length; i++) {
        this.drawEntity(ctx, sorted[i]);
      }

      // 6. Player Car (fixed z near bottom)
      this.drawPlayerCar(ctx);

      // 7. Nitro edge speed lines
      if (this.nitroTime > 0) {
        this.drawSpeedLines(ctx, wPx, hPx);
      }
    }

    drawHorizon(ctx, biome, horizonY, shiftX) {
      const wPx = this.w;
      ctx.save();
      if (biome.horizonType === 'city') {
        ctx.fillStyle = '#0c0824';
        const step = 28;
        const offset = ((shiftX % step) + step) % step;
        for (let x = -step; x < wPx + step; x += step) {
          const idx = Math.round((x - shiftX) / step);
          const bh = 22 + Math.abs((idx * 37) % 44);
          const bx = x + offset;
          ctx.fillStyle = '#0c0a20';
          ctx.fillRect(bx, horizonY - bh, step - 2, bh + 4);
          // Neon skyline windows
          ctx.fillStyle = (idx % 2 === 0) ? 'rgba(56,189,248,0.55)' : 'rgba(244,63,94,0.5)';
          for (let wy = horizonY - bh + 6; wy < horizonY - 6; wy += 9) {
            ctx.fillRect(bx + 5, wy, 5, 4);
            ctx.fillRect(bx + 15, wy, 5, 4);
          }
        }
      } else if (biome.horizonType === 'canyon') {
        ctx.fillStyle = '#43141a';
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 4);
        const step = 42;
        for (let x = -step; x <= wPx + step; x += step) {
          const idx = Math.round((x - shiftX) / step);
          const h = 16 + Math.abs((idx * 29) % 34);
          ctx.lineTo(x + shiftX * 0.25, horizonY - h);
          ctx.lineTo(x + shiftX * 0.25 + step * 0.65, horizonY - h * 0.82);
        }
        ctx.lineTo(wPx, horizonY + 4);
        ctx.closePath();
        ctx.fill();
      } else {
        // Coastal mountains
        ctx.fillStyle = '#0a2b4a';
        ctx.beginPath();
        ctx.moveTo(0, horizonY + 4);
        for (let x = 0; x <= wPx + 30; x += 36) {
          const h = 14 + Math.sin(x * 0.025 + shiftX * 0.01) * 14 + 10;
          ctx.lineTo(x, horizonY - h);
        }
        ctx.lineTo(wPx, horizonY + 4);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }

    drawRoadsideProps(ctx, biome) {
      const COUNT = 8;
      const fracBase = (this.roadPos * 0.55) % 1;
      for (let i = COUNT - 1; i >= 0; i--) {
        const z = (i + (1 - fracBase)) / COUNT;
        if (z <= 0.03 || z >= 0.98) continue;
        const pr = this.projectDepth(z);
        const s = pr.scale;
        const leftX = pr.centerX - pr.halfW * 1.28;
        const rightX = pr.centerX + pr.halfW * 1.28;

        for (const px of [leftX, rightX]) {
          const sign = px < pr.centerX ? 1 : -1;
          if (biome.propType === 'lamp') {
            const ph = 52 * s;
            ctx.fillStyle = '#334155';
            ctx.fillRect(px - 2 * s, pr.y - ph, 4 * s, ph);
            ctx.fillRect(px, pr.y - ph, sign * 14 * s, 3 * s);
            ctx.fillStyle = '#38bdf8';
            ctx.beginPath();
            ctx.arc(px + sign * 12 * s, pr.y - ph + 3 * s, Math.max(1.5, 4.5 * s), 0, Math.PI * 2);
            ctx.fill();
          } else if (biome.propType === 'cactus') {
            const ch = 40 * s;
            ctx.fillStyle = '#15803d';
            ctx.beginPath();
            ctx.roundRect(px - 4 * s, pr.y - ch, 8 * s, ch, 4 * s);
            ctx.roundRect(px - 12 * s, pr.y - ch * 0.68, 9 * s, 5 * s, 2 * s);
            ctx.roundRect(px + 3 * s, pr.y - ch * 0.55, 9 * s, 5 * s, 2 * s);
            ctx.fill();
          } else {
            // Palm tree
            const ph = 54 * s;
            ctx.strokeStyle = '#78350f';
            ctx.lineWidth = Math.max(1.5, 5 * s);
            ctx.beginPath();
            ctx.moveTo(px, pr.y);
            ctx.quadraticCurveTo(px - sign * 8 * s, pr.y - ph * 0.5, px - sign * 4 * s, pr.y - ph);
            ctx.stroke();
            ctx.fillStyle = '#16a34a';
            const tx = px - sign * 4 * s;
            const ty = pr.y - ph;
            for (let a = 0; a < 5; a++) {
              const ang = -Math.PI + (a / 4) * Math.PI;
              ctx.beginPath();
              ctx.ellipse(tx + Math.cos(ang) * 12 * s, ty + Math.sin(ang) * 6 * s, 13 * s, 4 * s, ang * 0.4, 0, Math.PI * 2);
              ctx.fill();
            }
          }
        }
      }
    }

    drawEntity(ctx, e) {
      if (e.z > 0.99 || e.z < -0.05) return;
      const pos = this.projectEntityPos(e);
      const s = pos.scale;
      if (s < 0.04) return;

      if (e.type === 'coin') {
        const spin = Math.max(0.22, Math.abs(Math.cos(e.phase)));
        const sz = 34 * s;
        ctx.save();
        ctx.translate(pos.x, pos.y - sz * 0.62);
        ctx.drawImage(this.sprites.coin, -(sz * spin) * 0.5, -sz * 0.5, sz * spin, sz);
        ctx.restore();
        return;
      }

      if (e.kind === 'cone') {
        const cw = 36 * s, ch = 40 * s;
        ctx.drawImage(this.sprites.cone, pos.x - cw * 0.5, pos.y - ch * 0.88, cw, ch);
      } else if (e.kind === 'barrier') {
        const bw = 72 * s, bh = 42 * s;
        ctx.drawImage(this.sprites.barrier, pos.x - bw * 0.5, pos.y - bh * 0.88, bw, bh);
      } else {
        const spr = this.sprites.traffic[e.variant % this.sprites.traffic.length];
        const cw = 72 * s, ch = 62 * s;
        ctx.drawImage(spr, pos.x - cw * 0.5, pos.y - ch * 0.88, cw, ch);
      }
    }

    drawPlayerCar(ctx) {
      const pos = this.projectEntityPos({ lane: this.carLane, z: 0.085 });
      const bob = Math.sin(this.time * 24) * 1.2;
      const cw = 84 * pos.scale;
      const ch = 68 * pos.scale;

      ctx.save();
      ctx.translate(pos.x, pos.y - ch * 0.48 + bob);
      ctx.rotate(this.carTilt);

      // Headlight beam ahead
      const beamG = ctx.createLinearGradient(0, -10, 0, -95);
      beamG.addColorStop(0, 'rgba(254, 249, 195, 0.24)');
      beamG.addColorStop(1, 'rgba(254, 249, 195, 0)');
      ctx.fillStyle = beamG;
      ctx.beginPath();
      ctx.moveTo(-cw * 0.28, -ch * 0.22);
      ctx.lineTo(cw * 0.28, -ch * 0.22);
      ctx.lineTo(cw * 0.62, -ch * 1.65);
      ctx.lineTo(-cw * 0.62, -ch * 1.65);
      ctx.closePath();
      ctx.fill();

      // Nitro exhaust flames
      if (this.nitroTime > 0 && !this.crashing) {
        const flH = (22 + Math.sin(this.time * 60) * 7) * pos.scale;
        ctx.fillStyle = '#38bdf8';
        for (const ox of [-cw * 0.21, cw * 0.21]) {
          ctx.beginPath();
          ctx.moveTo(ox - 5 * pos.scale, ch * 0.34);
          ctx.lineTo(ox + 5 * pos.scale, ch * 0.34);
          ctx.lineTo(ox, ch * 0.34 + flH);
          ctx.closePath();
          ctx.fill();
        }
      }

      ctx.drawImage(this.sprites.player, -cw * 0.5, -ch * 0.5, cw, ch);
      ctx.restore();
    }

    drawSpeedLines(ctx, wPx, hPx) {
      ctx.save();
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.42)';
      ctx.lineWidth = 2;
      for (let i = 0; i < this.speedLines.length; i++) {
        const sl = this.speedLines[i];
        const y = ((sl.y + this.time * 2.8) % 1) * hPx;
        const x = sl.side < 0 ? 8 + (i % 3) * 7 : wPx - 8 - (i % 3) * 7;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + sl.side * 4, y + sl.len);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  w.RaceEngine = RaceEngine;
})(window);
