/* Раскол — наборы умений классов (kit): Страж, Следопыт, Маг, Тень. */
(function (global) {
  'use strict';
  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const angDiff = (a, b) => Math.atan2(Math.sin(a - b), Math.cos(a - b));
  const ease = t => 1 - Math.pow(1 - t, 3);

  function endRam(eng) {
    const h = eng.hero;
    if (h.mods.crush) {
      const R = 130 + 20 * h.mods.crush;
      for (const e of eng.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        if (Math.hypot(e.x - h.x, e.y - h.y) < R + e.r) {
          eng._damage(e, eng._heroDmg() * (1.4 + 0.6 * h.mods.crush), { kbA: Math.atan2(e.y - h.y, e.x - h.x), kb: 380, noCharge: true });
        }
      }
      eng._ring(h.x, h.y, R, '#fbbf24');
      eng._burst(h.x, h.y, 26, ['#fde68a', '#f59e0b', '#fff'], 320, 4);
      eng.shakeA = Math.max(eng.shakeA, 9);
    }
    h.ram = null;
    h.lockMove = false;
  }

  function drawAimLine(eng, g, range, color) {
    const at = eng.input.right.id !== null && eng.input.right.manual;
    if (!at || eng.state !== 'play') return;
    const h = eng.hero;
    const a = Math.atan2(eng.input.right.ky - eng.input.right.oy, eng.input.right.kx - eng.input.right.ox);
    g.save();
    g.strokeStyle = color; g.lineWidth = 2; g.setLineDash([8, 6]);
    g.beginPath(); g.moveTo(h.x + Math.cos(a) * 24, h.y + Math.sin(a) * 24);
    g.lineTo(h.x + Math.cos(a) * Math.min(range, 360), h.y + Math.sin(a) * Math.min(range, 360));
    g.stroke();
    g.restore();
  }

  // ── 1. Страж ─────────────────────────────────────────────────
  const guard = {
    superIcon: '🛡️',
    trailCols: ['#e9d5ff', '#a78bfa'],
    init(eng, h) {
      h.swing = null; h.swings = 0; h.ram = null;
    },
    onRoomReset(eng, h) {
      h.ram = null; h.swing = null; h.lockMove = false;
    },
    attack(eng, dir) {
      const h = eng.hero, m = h.mods;
      h.swings++;
      const spin = m.spin && h.swings % 3 === 0;
      const arc = spin ? TAU : eng._heroArc(), range = eng._heroRange() * (spin ? 1.05 : 1);
      h.swing = { t: 0, dur: spin ? 0.28 : 0.16, dir, arc, range, spin };
      h.atkT = h.c.atkCd / m.rate;
      h.face = dir;
      eng.snd('swing');
      const dmg = eng._heroDmg() * (spin ? 1.3 : 1);
      for (const e of eng.enemies) {
        if (e.dead || e.spawnT > 0) continue;
        const dx = e.x - h.x, dy = e.y - h.y, d = Math.hypot(dx, dy);
        if (d - e.r > range) continue;
        const a = Math.atan2(dy, dx);
        const slack = Math.asin(Math.min(1, e.r / Math.max(d, 1)));
        if (spin || Math.abs(angDiff(a, dir)) <= arc / 2 + slack) {
          eng._damage(e, dmg, { kbA: a, kb: 250, melee: true, heroAtk: true });
        }
      }
      for (let i = eng.ebul.length - 1; i >= 0; i--) {
        const b = eng.ebul[i];
        const dx = b.x - h.x, dy = b.y - h.y, d = Math.hypot(dx, dy);
        if (d > range + b.r + 8) continue;
        if (!spin && Math.abs(angDiff(Math.atan2(dy, dx), dir)) > arc / 2 + 0.25) continue;
        eng.ebul.splice(i, 1);
        if (m.reflect) {
          const sp = Math.max(380, Math.hypot(b.vx, b.vy) * 1.25), a = Math.atan2(dy, dx);
          eng.hshots.push({ x: b.x, y: b.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, r: b.r + 2, dmg: dmg * 0.8, life: 1.4, kind: 'refl', hit: null, a });
        }
        eng._spark(b.x, b.y, '#fde68a'); eng.snd('block');
      }
      if (m.wave) {
        const sp = 580;
        eng.hshots.push({
          x: h.x + Math.cos(dir) * 26, y: h.y + Math.sin(dir) * 26,
          vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp,
          r: 20 + 6 * m.wave, dmg: dmg * (0.45 + 0.15 * m.wave), life: 0.62, kind: 'wave', hit: new Set(), a: dir
        });
      }
    },
    super(eng, dir) {
      const h = eng.hero;
      h.ram = { dir, t: 0.36, hit: new Set() };
      h.lockMove = true;
      h.superC = 0; h.face = dir; h.inv = Math.max(h.inv, 0.5);
      eng.snd('super'); eng.vib([15, 20, 15]); eng.shakeA = Math.max(eng.shakeA, 6);
    },
    update(eng, dt) {
      const h = eng.hero;
      if (h.swing) {
        h.swing.t += dt;
        if (h.swing.t >= h.swing.dur) h.swing = null;
      }
      if (h.ram) {
        const px = h.x, py = h.y, sp = 760;
        h.x += Math.cos(h.ram.dir) * sp * dt;
        h.y += Math.sin(h.ram.dir) * sp * dt;
        h.ram.t -= dt;
        h.trail.push({ x: h.x, y: h.y, a: h.face, life: 0.22 });
        for (const e of eng.enemies) {
          if (e.dead || e.spawnT > 0 || h.ram.hit.has(e)) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) < e.r + h.r + 14) {
            h.ram.hit.add(e);
            const side = angDiff(Math.atan2(e.y - h.y, e.x - h.x), h.ram.dir) > 0 ? 1 : -1;
            eng._damage(e, eng._heroDmg() * 2.2, { kbA: h.ram.dir + side * 1.1, kb: 520, noCharge: true });
          }
        }
        for (let i = eng.ebul.length - 1; i >= 0; i--) {
          const b = eng.ebul[i];
          if (Math.hypot(b.x - h.x, b.y - h.y) < b.r + h.r + 16) { eng._spark(b.x, b.y, '#fde68a'); eng.ebul.splice(i, 1); }
        }
        eng._collideWorld(h, true);
        const moved = Math.hypot(h.x - px, h.y - py);
        if (h.ram.t <= 0 || moved < sp * dt * 0.35) endRam(eng);
      }
      h.lockMove = !!h.ram;
      h.noTurn = !!(h.swing || h.ram);
    },
    onHurt(eng, amount, srcA, projectile) {
      const h = eng.hero;
      if (projectile && srcA != null && Math.abs(angDiff(srcA, h.face)) < 0.95) {
        amount *= 0.5;
        eng._float(h.x + Math.cos(h.face) * 24, h.y + Math.sin(h.face) * 24 - 10, eng.word('block'), '#fbbf24', 13);
        eng._spark(h.x + Math.cos(h.face) * 22, h.y + Math.sin(h.face) * 22, '#fde68a');
        eng.snd('block');
      }
      return amount;
    },
    onDash() {},
    draw(eng, g, t, bob, hurtFlash) {
      const h = eng.hero, SP = global.RASKOL_SPRITES;
      const at = eng.input.right.id !== null && eng.input.right.manual;
      if (at && eng.state === 'play') {
        const a = Math.atan2(eng.input.right.ky - eng.input.right.oy, eng.input.right.kx - eng.input.right.ox);
        const R = eng._heroRange(), arc = eng._heroArc();
        g.fillStyle = 'rgba(255,255,255,.1)'; g.strokeStyle = 'rgba(255,255,255,.35)'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(h.x, h.y); g.arc(h.x, h.y, R, a - arc / 2, a + arc / 2); g.closePath(); g.fill(); g.stroke();
      }
      if (h.ram) {
        g.globalCompositeOperation = 'lighter';
        g.drawImage(SP.glow('rgba(251,191,36,1)', 64), h.x - 46, h.y - 46, 92, 92);
        g.globalCompositeOperation = 'source-over';
      }
      const sw = h.swing, sp = SP.get('sword');
      let swordA = h.face + 1.0;
      if (sw) {
        const p = ease(sw.t / sw.dur);
        swordA = sw.spin ? sw.dir + p * TAU : sw.dir - sw.arc / 2 + sw.arc * p;
        const a0 = sw.spin ? sw.dir : sw.dir - sw.arc / 2, a1 = swordA;
        const R = sw.range * 0.86;
        g.lineCap = 'butt';
        g.strokeStyle = `rgba(254,243,199,${0.35 * (1 - p * 0.6)})`; g.lineWidth = 26;
        g.beginPath(); g.arc(h.x, h.y, R - 14, a0, a1); g.stroke();
        g.strokeStyle = `rgba(255,255,255,${0.85 * (1 - p * 0.5)})`; g.lineWidth = 4;
        g.beginPath(); g.arc(h.x, h.y, R, Math.max(a0, a1 - 1.2), a1); g.stroke();
        g.lineCap = 'round';
      }
      const swordUnder = !sw && Math.sin(swordA) < 0;
      const drawSword = () => {
        g.save(); g.translate(h.x, h.y); g.rotate(swordA); g.translate(8, 0);
        const L = sw ? (sw.range * 0.86) / 62 : 0.8;
        g.drawImage(sp.c, -sp.half * L, -sp.half * L * 0.9, sp.half * 2 * L, sp.half * 2 * L * 0.9);
        g.restore();
      };
      if (swordUnder) drawSword();
      eng._drawSprite(g, 'hero_guard', h.x, h.y, h.face, bob, hurtFlash);
      if (!swordUnder) drawSword();
    }
  };

  // ── 2. Следопыт ──────────────────────────────────────────────
  function spawnArrow(eng, x, y, dir, dmg, maxDist, opts) {
    const sp = opts.sp || 780;
    const h = eng.hero, m = h.mods;
    eng.hshots.push({
      x, y, vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, a: dir,
      r: 8, dmg, life: 1.4, maxDist, dist: 0,
      kind: opts.kind || 'arrow',
      bounce: opts.bounce != null ? opts.bounce : 1,
      pierce: opts.pierce != null ? opts.pierce : (1 + (m.pierce || 0)),
      hit: new Set(), sx: x, sy: y,
      onHit(gEng, e, s) {
        const farCrit = m.eagle > 0 && Math.hypot(e.x - s.sx, e.y - s.sy) > 300;
        gEng._damage(e, s.dmg, {
          kbA: s.a, kb: 120, heroAtk: true,
          forceCrit: farCrit, poison: m.rPoison || 0, noCharge: !!opts.noCharge
        });
      }
    });
  }

  const ranger = {
    superIcon: '🏹',
    trailCols: ['#bbf7d0', '#22c55e'],
    init(eng, h) { h.recoilT = 0; },
    onRoomReset(eng, h) { h.recoilT = 0; h.lockMove = false; h.noTurn = false; },
    attack(eng, dir) {
      const h = eng.hero, m = h.mods;
      h.atkT = h.c.atkCd / m.rate;
      h.face = dir; h.recoilT = 0.12;
      eng.snd('shoot');
      const count = 1 + (m.doubleShot || 0);
      const maxD = eng._heroRange();
      const dmg = eng._heroDmg() * (count > 1 ? 0.85 : 1);
      const px = -Math.sin(dir), py = Math.cos(dir);
      for (let i = 0; i < count; i++) {
        const off = (i - (count - 1) / 2) * 14;
        spawnArrow(eng, h.x + Math.cos(dir) * 20 + px * off, h.y + Math.sin(dir) * 20 + py * off, dir, dmg, maxD, {});
      }
    },
    super(eng, dir) {
      const h = eng.hero, m = h.mods;
      h.superC = 0; h.face = dir; h.recoilT = 0.2;
      const spread = 1.22, n = 9, dmg = eng._heroDmg() * 1.15;
      for (let i = 0; i < n; i++) {
        const a = dir + (i - (n - 1) / 2) * (spread / (n - 1));
        spawnArrow(eng, h.x + Math.cos(a) * 22, h.y + Math.sin(a) * 22, a, dmg, 620, {
          kind: 'volley', sp: 840, pierce: 3 + (m.pierce || 0), bounce: 1, noCharge: true
        });
      }
      eng._burst(h.x + Math.cos(dir) * 18, h.y + Math.sin(dir) * 18, 18, ['#86efac', '#22c55e', '#fef08a'], 240, 3);
      eng.snd('super'); eng.vib([15, 20, 15]); eng.shakeA = Math.max(eng.shakeA, 5);
    },
    update(eng, dt) {
      const h = eng.hero;
      if (h.recoilT > 0) h.recoilT -= dt;
      h.lockMove = false; h.noTurn = false;
    },
    onHurt(eng, amount) { return amount; },
    onDash(eng) {
      const h = eng.hero;
      if (h.mods.trap > 0) {
        eng.zones.push({ kind: 'trap', x: h.x, y: h.y, r: 28, life: 4.0 });
        if (eng.zones.length > 24) eng.zones.shift();
      }
    },
    draw(eng, g, t, bob, hurtFlash) {
      const h = eng.hero, SP = global.RASKOL_SPRITES;
      drawAimLine(eng, g, eng._heroRange(), 'rgba(74,222,128,.5)');
      eng._drawSprite(g, 'hero_ranger', h.x, h.y, h.face, bob, hurtFlash);
      const bow = SP.get('bow');
      if (bow) {
        const pull = h.recoilT > 0 ? 0.88 : 1;
        g.save(); g.translate(h.x, h.y); g.rotate(h.face); g.translate(14 * pull, 0);
        g.drawImage(bow.c, -bow.half * 0.72, -bow.half * 0.72, bow.half * 1.44, bow.half * 1.44);
        g.restore();
      }
    }
  };

  // ── 3. Маг ───────────────────────────────────────────────────
  function explodeFireball(eng, x, y, directTarget, s) {
    const h = eng.hero, m = h.mods;
    const R = (s.aoe || 60) * (1 + 0.25 * (m.bigBall || 0));
    eng._ring(x, y, R, '#e879f9');
    eng._burst(x, y, 16, ['#fde68a', '#f97316', '#c084fc'], 230, 3.2);
    eng.shakeA = Math.max(eng.shakeA, 3);
    let chained = false;
    for (const e of eng.enemies) {
      if (e.dead || e.spawnT > 0) continue;
      if (Math.hypot(e.x - x, e.y - y) <= R + e.r) {
        const isMain = e === directTarget || !chained;
        const dmg = e === directTarget ? s.dmg : s.dmg * 0.85;
        eng._damage(e, dmg, {
          kbA: Math.atan2(e.y - y, e.x - x), kb: 150, heroAtk: true,
          chainAllowed: isMain && m.chain > 0, col: '#f0abfc', noCharge: !!s.noCharge
        });
        if (isMain) chained = true;
      }
    }
  }

  const mage = {
    superIcon: '☄️',
    trailCols: ['#f0abfc', '#a855f7'],
    init(eng, h) { h.castT = 0; h.fireStepT = 0; h.shieldCd = 0; },
    onRoomReset(eng, h) { h.castT = 0; h.fireStepT = 0; h.lockMove = false; h.noTurn = false; },
    attack(eng, dir) {
      const h = eng.hero, m = h.mods;
      h.atkT = h.c.atkCd / m.rate;
      h.face = dir; h.castT = 0.16;
      eng.snd('shoot');
      const sp = 440, dmg = eng._heroDmg();
      eng.hshots.push({
        x: h.x + Math.cos(dir) * 24, y: h.y + Math.sin(dir) * 24,
        vx: Math.cos(dir) * sp, vy: Math.sin(dir) * sp, a: dir,
        r: 11, dmg, life: 1.3, maxDist: eng._heroRange(), dist: 0,
        kind: 'fireball', aoe: 60,
        onHit(gEng, e, s) { explodeFireball(gEng, s.x, s.y, e, s); },
        onImpact(gEng, s) { explodeFireball(gEng, s.x, s.y, null, s); }
      });
    },
    super(eng, dir) {
      const h = eng.hero, m = h.mods;
      h.superC = 0; h.face = dir; h.castT = 0.22;
      let tx = h.x + Math.cos(dir) * 230, ty = h.y + Math.sin(dir) * 230;
      const at = eng.input.right.id !== null && eng.input.right.manual;
      if (!at) {
        let best = null, bd = 600;
        for (const e of eng.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          const d = Math.hypot(e.x - h.x, e.y - h.y);
          if (d < bd) { bd = d; best = e; }
        }
        if (best) { tx = best.x; ty = best.y; }
      }
      const RW = global.RASKOL_DATA.ROOM_W, RH = global.RASKOL_DATA.ROOM_H;
      tx = clamp(tx, 60, RW - 60); ty = clamp(ty, 60, RH - 60);
      const R = 160;
      eng.tele.push({
        kind: 'circle', x: tx, y: ty, r: R, t: 0, dur: 0.6,
        fill0: 'rgba(168,85,247,.14)', fill1: 'rgba(249,115,22,.32)', stroke: 'rgba(192,132,252,.85)',
        fire: () => {
          eng._ring(tx, ty, R, '#a855f7');
          eng._ring(tx, ty, R * 0.65, '#f97316');
          eng._burst(tx, ty, 34, ['#fde68a', '#f97316', '#e879f9', '#fff'], 340, 4.5);
          eng.shakeA = Math.max(eng.shakeA, 11);
          eng.snd('boss');
          const dmg = eng._heroDmg() * 2.75;
          for (const e of eng.enemies) {
            if (e.dead || e.spawnT > 0) continue;
            if (Math.hypot(e.x - tx, e.y - ty) <= R + e.r) {
              e.burnT = Math.max(e.burnT, 4); e.burnD = Math.max(e.burnD, eng._heroDmg() * 0.42);
              eng._damage(e, dmg, { kbA: Math.atan2(e.y - ty, e.x - tx), kb: 320, noCharge: true, col: '#fde047' });
            }
          }
        }
      });
      eng.snd('super'); eng.vib([15, 20, 15]);
    },
    onHitEnemy(eng, e, o) {
      const h = eng.hero, m = h.mods;
      if (o.fromElem || o.fromChain || o.noCharge) return;
      e.elemCharges = (e.elemCharges || 0) + 1;
      if (e.elemCharges >= 5) {
        e.elemCharges = 0;
        const R = 95;
        eng._ring(e.x, e.y, R, '#e879f9');
        eng._burst(e.x, e.y, 18, ['#fdf4ff', '#e879f9', '#67e8f9'], 240, 3.2);
        const bd = eng._heroDmg() * 1.45;
        for (const t of eng.enemies) {
          if (t.dead || t.spawnT > 0) continue;
          if (Math.hypot(t.x - e.x, t.y - e.y) <= R + t.r) {
            eng._damage(t, bd, { kbA: Math.atan2(t.y - e.y, t.x - e.x), kb: 180, noCharge: true, fromElem: true, col: '#f0abfc' });
          }
        }
      }
      if (m.chain > 0 && o.chainAllowed) {
        const cands = eng.enemies.filter(t => t !== e && !t.dead && t.spawnT <= 0 && Math.hypot(t.x - e.x, t.y - e.y) < 270)
          .sort((a, b) => Math.hypot(a.x - e.x, a.y - e.y) - Math.hypot(b.x - e.x, b.y - e.y))
          .slice(0, 2);
        const cdmg = eng._heroDmg() * (0.5 + 0.2 * (m.chain - 1));
        for (const t of cands) {
          eng.bolts.push({ x1: e.x, y1: e.y, x2: t.x, y2: t.y, ox: (Math.random() - 0.5) * 26, oy: (Math.random() - 0.5) * 26, life: 0.16, color: '#a855f7' });
          eng._damage(t, cdmg, { kb: 60, heroAtk: true, fromChain: true, col: '#c084fc' });
        }
      }
    },
    update(eng, dt) {
      const h = eng.hero;
      if (h.castT > 0) h.castT -= dt;
      h.lockMove = false; h.noTurn = false;
    },
    onMove(eng, dt) {
      const h = eng.hero;
      if (h.mods.fireTrail > 0) {
        h.fireStepT -= dt;
        if (h.fireStepT <= 0) {
          h.fireStepT = 0.12;
          eng.zones.push({ kind: 'fire', x: h.x, y: h.y, r: 26, life: 2.3 });
          if (eng.zones.length > 26) eng.zones.shift();
        }
      }
    },
    onDash(eng) {
      const h = eng.hero;
      if (h.mods.iceNova > 0) {
        const R = 135 + 30 * (h.mods.iceNova - 1);
        eng._ring(h.x, h.y, R, '#67e8f9');
        eng._burst(h.x, h.y, 18, ['#cffafe', '#67e8f9', '#38bdf8'], 240, 3);
        for (const e of eng.enemies) {
          if (e.dead || e.spawnT > 0) continue;
          if (Math.hypot(e.x - h.x, e.y - h.y) <= R + e.r) {
            e.slowT = Math.max(e.slowT, 3.2);
            eng._damage(e, eng._heroDmg() * (0.65 + 0.35 * (h.mods.iceNova - 1)), { kbA: Math.atan2(e.y - h.y, e.x - h.x), kb: 160, heroAtk: true, col: '#67e8f9' });
          }
        }
      }
    },
    onHurt(eng, amount) {
      const h = eng.hero;
      if (h.mods.manaShield > 0 && h.shieldCd <= 0) {
        h.shieldCd = 8.0;
        h.inv = Math.max(h.inv, 0.35);
        eng._ring(h.x, h.y, 44, '#67e8f9');
        eng._burst(h.x, h.y, 12, ['#cffafe', '#c084fc'], 200, 3);
        eng._float(h.x, h.y - 34, eng.word('shield'), '#67e8f9', 14);
        eng.snd('block');
        return 0;
      }
      return amount;
    },
    draw(eng, g, t, bob, hurtFlash) {
      const h = eng.hero, SP = global.RASKOL_SPRITES;
      drawAimLine(eng, g, eng._heroRange(), 'rgba(192,132,252,.5)');
      const st = SP.get('staff');
      const staffA = h.face + (h.castT > 0 ? 0.15 : 0.65);
      const drawStaff = () => {
        if (!st) return;
        g.save(); g.translate(h.x, h.y); g.rotate(staffA); g.translate(10, 0);
        g.drawImage(st.c, -st.half * 0.72, -st.half * 0.72, st.half * 1.44, st.half * 1.44);
        g.restore();
      };
      if (Math.sin(staffA) < 0) drawStaff();
      eng._drawSprite(g, 'hero_mage', h.x, h.y, h.face, bob, hurtFlash);
      if (Math.sin(staffA) >= 0) drawStaff();
      if (h.mods.manaShield > 0 && h.shieldCd <= 0) {
        g.save();
        g.strokeStyle = 'rgba(103,232,249,.8)'; g.lineWidth = 2.2;
        g.fillStyle = 'rgba(168,85,247,.12)';
        g.beginPath(); g.arc(h.x, h.y, h.r + 10 + Math.sin(t * 6) * 1.5, 0, TAU); g.fill(); g.stroke();
        g.restore();
      }
    }
  };

  // ── 4. Тень ──────────────────────────────────────────────────
  const shade = {
    superIcon: '👤',
    trailCols: ['#7dd3fc', '#0284c7'],
    init(eng, h) { h.invisT = 0; h.dashCrit = false; h.throwT = 0; },
    onRoomReset(eng, h) { h.invisT = 0; h.dashCrit = false; h.throwT = 0; h.lockMove = false; h.noTurn = false; },
    attack(eng, dir) {
      const h = eng.hero, m = h.mods;
      h.atkT = h.c.atkCd / m.rate;
      h.face = dir; h.throwT = 0.12;
      eng.snd('swing');
      const count = 2 + 2 * (m.fanKnives || 0);
      const spread = 0.14 + 0.08 * (m.fanKnives || 0);
      const fromStealth = h.invisT > 0;
      const fromDash = h.dashCrit;
      if (fromStealth) { h.invisT = 0; h.dashCrit = false; }
      else if (fromDash) { h.dashCrit = false; }
      const ambush = fromStealth ? { used: false } : null;
      const maxD = eng._heroRange(), sp = 740, baseDmg = eng._heroDmg();
      for (let i = 0; i < count; i++) {
        const a = dir + (i - (count - 1) / 2) * (spread / Math.max(1, count - 1));
        eng.hshots.push({
          x: h.x + Math.cos(a) * 18, y: h.y + Math.sin(a) * 18,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, a, spin: a,
          r: 8, dmg: baseDmg, life: 0.7, maxDist: maxD, dist: 0,
          kind: 'dagger',
          onHit(gEng, e, s) {
            let fCrit = fromDash, cMul = 2, col = null;
            if (ambush && !ambush.used) {
              ambush.used = true; fCrit = true; cMul = 3; col = '#7dd3fc';
            }
            gEng._damage(e, s.dmg, {
              kbA: s.a, kb: 100, heroAtk: true,
              forceCrit: fCrit, critMul: cMul, col,
              bleed: m.bleed || 0, poison: m.sPoison || 0
            });
          }
        });
      }
    },
    super(eng) {
      const h = eng.hero;
      h.invisT = 2.5; h.superC = 0;
      h.lastSeenX = h.x; h.lastSeenY = h.y;
      eng._ring(h.x, h.y, 70, '#38bdf8');
      eng._burst(h.x, h.y, 18, ['#7dd3fc', '#38bdf8', '#0284c7'], 200, 3);
      eng._float(h.x, h.y - 34, eng.word('stealth'), '#7dd3fc', 15);
      eng.snd('super'); eng.vib([15, 20, 15]);
    },
    update(eng, dt) {
      const h = eng.hero;
      if (h.throwT > 0) h.throwT -= dt;
      h.lockMove = false; h.noTurn = false;
    },
    onHurt(eng, amount) { return amount; },
    onDash(eng) {
      const h = eng.hero;
      h.dashCrit = true;
      if (h.mods.shadowClone > 0) {
        eng.zones.push({ kind: 'decoy', x: h.x, y: h.y, r: 24, a: h.face, life: 2.0 + 0.8 * (h.mods.shadowClone - 1) });
        if (eng.zones.length > 24) eng.zones.shift();
      }
    },
    draw(eng, g, t, bob, hurtFlash) {
      const h = eng.hero, SP = global.RASKOL_SPRITES;
      drawAimLine(eng, g, eng._heroRange(), 'rgba(56,189,248,.5)');
      const prevAlpha = g.globalAlpha;
      if (h.invisT > 0) {
        g.globalAlpha = prevAlpha * 0.42;
        g.strokeStyle = 'rgba(56,189,248,.65)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(h.x, h.y, h.r + 7, 0, TAU); g.stroke();
      }
      const dag = SP.get('dagger');
      if (dag && h.throwT <= 0) {
        for (const s of [-1, 1]) {
          g.save(); g.translate(h.x, h.y); g.rotate(h.face); g.translate(10, s * 16); g.rotate(s * 0.35);
          g.drawImage(dag.c, -dag.half * 0.72, -dag.half * 0.72, dag.half * 1.44, dag.half * 1.44);
          g.restore();
        }
      }
      eng._drawSprite(g, 'hero_shade', h.x, h.y, h.face, bob, hurtFlash);
      if (h.dashCrit && h.invisT <= 0) {
        g.strokeStyle = 'rgba(125,211,252,.7)'; g.lineWidth = 1.6;
        g.beginPath(); g.arc(h.x, h.y, h.r + 5, 0, TAU); g.stroke();
      }
      g.globalAlpha = prevAlpha;
    }
  };

  global.RASKOL_CLASSES = { guard, ranger, mage, shade };
})(window);
