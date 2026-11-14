/* Shuttle Cruiser 2.0 — DPR-aware Offscreen Ship/Asteroid Sprites & Composite Enemy/Boss Renderers */
(function (global) {
  'use strict';

  const shipCache = new Map();
  const astCache = new Map();

  const THRUSTER_OFFSETS = {
    spark:   [{ x: -6, y: 17, w: 4 }, { x: 6, y: 17, w: 4 }],
    bastion: [{ x: -11, y: 18, w: 4.5 }, { x: -4, y: 19, w: 4.5 }, { x: 4, y: 19, w: 4.5 }, { x: 11, y: 18, w: 4.5 }],
    sting:   [{ x: -4, y: 19, w: 3.5 }, { x: 4, y: 19, w: 3.5 }],
    hive:    [{ x: -12, y: 16, w: 4 }, { x: 0, y: 18, w: 5 }, { x: 12, y: 16, w: 4 }],
    phantom: [{ x: -7, y: 16, w: 4 }, { x: 7, y: 16, w: 4 }],
    nova:    [{ x: -9, y: 17, w: 4 }, { x: 0, y: 19, w: 5.5 }, { x: 9, y: 17, w: 4 }]
  };

  function getThrusterOffsets(shipId) {
    return THRUSTER_OFFSETS[shipId] || THRUSTER_OFFSETS.spark;
  }

  function makeCanvas(logicalSize, dpr) {
    const c = document.createElement('canvas');
    c.width = Math.round(logicalSize * dpr);
    c.height = Math.round(logicalSize * dpr);
    const ctx = c.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return c;
  }

  function drawCockpit(ctx, x, y, rx, ry, tint) {
    const g = ctx.createLinearGradient(x - rx, y - ry, x + rx, y + ry);
    g.addColorStop(0, '#e0f2fe');
    g.addColorStop(0.45, tint);
    g.addColorStop(1, '#0f172a');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.beginPath();
    ctx.ellipse(x - rx * 0.28, y - ry * 0.28, rx * 0.28, ry * 0.22, -0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawNozzles(ctx, offsets, glowColor) {
    for (const o of offsets) {
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(o.x - o.w * 0.65, o.y - 3, o.w * 1.3, 4.5);
      ctx.fillStyle = glowColor;
      ctx.fillRect(o.x - o.w * 0.45, o.y, o.w * 0.9, 2.5);
    }
  }

  function renderShipToCtx(ctx, shipId) {
    ctx.save();
    if (shipId === 'spark') {
      drawNozzles(ctx, THRUSTER_OFFSETS.spark, '#38bdf8');
      const hull = ctx.createLinearGradient(0, -22, 0, 18);
      hull.addColorStop(0, '#bae6fd');
      hull.addColorStop(0.4, '#0ea5e9');
      hull.addColorStop(1, '#0369a1');
      ctx.fillStyle = '#0284c7';
      ctx.beginPath();
      ctx.moveTo(0, -10);
      ctx.lineTo(-20, 11);
      ctx.lineTo(-14, 16);
      ctx.lineTo(-4, 9);
      ctx.lineTo(4, 9);
      ctx.lineTo(14, 16);
      ctx.lineTo(20, 11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#7dd3fc';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(-8, 6);
      ctx.lineTo(-6, 16);
      ctx.lineTo(0, 13);
      ctx.lineTo(6, 16);
      ctx.lineTo(8, 6);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(15,23,42,0.5)';
      ctx.beginPath();
      ctx.moveTo(-4, -2); ctx.lineTo(-15, 11);
      ctx.moveTo(4, -2); ctx.lineTo(15, 11);
      ctx.stroke();
      drawCockpit(ctx, 0, -4, 3.6, 6.8, '#38bdf8');
    } else if (shipId === 'bastion') {
      drawNozzles(ctx, THRUSTER_OFFSETS.bastion, '#fbbf24');
      const armor = ctx.createLinearGradient(-18, -16, 18, 18);
      armor.addColorStop(0, '#fde68a');
      armor.addColorStop(0.45, '#d97706');
      armor.addColorStop(1, '#78350f');
      ctx.fillStyle = '#92400e';
      ctx.beginPath();
      ctx.moveTo(-6, -15);
      ctx.lineTo(-21, -2);
      ctx.lineTo(-21, 14);
      ctx.lineTo(-12, 18);
      ctx.lineTo(12, 18);
      ctx.lineTo(21, 14);
      ctx.lineTo(21, -2);
      ctx.lineTo(6, -15);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fbbf24';
      ctx.lineWidth = 1.4;
      ctx.stroke();
      ctx.fillStyle = armor;
      ctx.beginPath();
      ctx.moveTo(0, -21);
      ctx.lineTo(-10, -8);
      ctx.lineTo(-10, 15);
      ctx.lineTo(10, 15);
      ctx.lineTo(10, -8);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = 'rgba(254,243,199,0.55)';
      ctx.lineWidth = 1;
      ctx.strokeRect(-7, 2, 14, 9);
      drawCockpit(ctx, 0, -6, 4.4, 5.5, '#f59e0b');
    } else if (shipId === 'sting') {
      drawNozzles(ctx, THRUSTER_OFFSETS.sting, '#f43f5e');
      const hull = ctx.createLinearGradient(0, -23, 0, 19);
      hull.addColorStop(0, '#fecdd3');
      hull.addColorStop(0.5, '#e11d48');
      hull.addColorStop(1, '#881337');
      ctx.fillStyle = '#be123c';
      ctx.beginPath();
      ctx.moveTo(0, -14); ctx.lineTo(-10, -4); ctx.lineTo(-3, -2);
      ctx.moveTo(0, -14); ctx.lineTo(10, -4); ctx.lineTo(3, -2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-4, 2); ctx.lineTo(-19, 16); ctx.lineTo(-8, 17); ctx.lineTo(-3, 12);
      ctx.lineTo(3, 12); ctx.lineTo(8, 17); ctx.lineTo(19, 16); ctx.lineTo(4, 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, -23);
      ctx.lineTo(-5, 8);
      ctx.lineTo(-4, 18);
      ctx.lineTo(4, 18);
      ctx.lineTo(5, 8);
      ctx.closePath();
      ctx.fill();
      drawCockpit(ctx, 0, -4, 2.8, 6.2, '#fb7185');
    } else if (shipId === 'hive') {
      drawNozzles(ctx, THRUSTER_OFFSETS.hive, '#a3e635');
      const hull = ctx.createLinearGradient(0, -18, 0, 18);
      hull.addColorStop(0, '#d9f99d');
      hull.addColorStop(0.5, '#65a30d');
      hull.addColorStop(1, '#365314');
      ctx.fillStyle = '#3f6212';
      ctx.strokeStyle = '#bef264';
      ctx.lineWidth = 1.1;
      for (const sx of [-13, 13]) {
        ctx.beginPath();
        ctx.roundRect(sx - 5, -10, 10, 25, 3);
        ctx.fill();
        ctx.stroke();
      }
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, -20);
      ctx.lineTo(-9, -4);
      ctx.lineTo(-14, 6);
      ctx.lineTo(-5, 16);
      ctx.lineTo(5, 16);
      ctx.lineTo(14, 6);
      ctx.lineTo(9, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ecfccb';
      ctx.stroke();
      drawCockpit(ctx, 0, -3, 4.2, 5.2, '#84cc16');
    } else if (shipId === 'phantom') {
      drawNozzles(ctx, THRUSTER_OFFSETS.phantom, '#c084fc');
      const hull = ctx.createLinearGradient(-18, -20, 18, 16);
      hull.addColorStop(0, '#f3e8ff');
      hull.addColorStop(0.45, '#9333ea');
      hull.addColorStop(1, '#3b0764');
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, -22);
      ctx.lineTo(-21, 10);
      ctx.lineTo(-12, 16);
      ctx.lineTo(-6, 10);
      ctx.lineTo(0, 15);
      ctx.lineTo(6, 10);
      ctx.lineTo(12, 16);
      ctx.lineTo(21, 10);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#d8b4fe';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.strokeStyle = 'rgba(15,23,42,0.55)';
      ctx.beginPath();
      ctx.moveTo(0, -22); ctx.lineTo(-6, 10);
      ctx.moveTo(0, -22); ctx.lineTo(6, 10);
      ctx.stroke();
      drawCockpit(ctx, 0, -5, 3.2, 6.5, '#a855f7');
    } else {
      drawNozzles(ctx, THRUSTER_OFFSETS.nova, '#f43f5e');
      const hull = ctx.createLinearGradient(0, -22, 0, 18);
      hull.addColorStop(0, '#fecdd3');
      hull.addColorStop(0.45, '#e11d48');
      hull.addColorStop(1, '#881337');
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.moveTo(-12, -12); ctx.lineTo(-21, 6); ctx.lineTo(-14, 16); ctx.lineTo(-7, 8);
      ctx.lineTo(7, 8); ctx.lineTo(14, 16); ctx.lineTo(21, 6); ctx.lineTo(12, -12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = hull;
      ctx.beginPath();
      ctx.moveTo(0, -23);
      ctx.lineTo(-9, -4);
      ctx.lineTo(-12, 16);
      ctx.lineTo(0, 12);
      ctx.lineTo(12, 16);
      ctx.lineTo(9, -4);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      drawCockpit(ctx, 0, -5, 3.8, 6.4, '#fb7185');
    }
    ctx.restore();
  }

  function getShipSprite(shipId, dpr) {
    const d = dpr || 1;
    const key = `${shipId}_${d}`;
    let c = shipCache.get(key);
    if (c) return c;
    const size = 64;
    c = makeCanvas(size, d);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);
    renderShipToCtx(ctx, shipId);
    shipCache.set(key, c);
    return c;
  }

  function getAsteroidSprite(variant, radius, dpr) {
    const d = dpr || 1;
    const bucketR = Math.max(16, Math.round(radius / 4) * 4);
    const v = variant % 4;
    const key = `${v}_${bucketR}_${d}`;
    let c = astCache.get(key);
    if (c) return c;
    const size = bucketR * 2 + 12;
    c = makeCanvas(size, d);
    const ctx = c.getContext('2d');
    ctx.translate(size / 2, size / 2);

    const pts = 9;
    const offsets = [
      [1.0, 0.82, 0.96, 0.78, 1.02, 0.86, 0.94, 0.80, 0.98],
      [0.92, 1.03, 0.81, 0.97, 0.85, 1.0, 0.79, 0.95, 0.88],
      [0.98, 0.86, 1.02, 0.80, 0.93, 0.84, 1.01, 0.89, 0.78],
      [0.85, 0.97, 0.91, 1.02, 0.79, 0.95, 0.88, 1.0, 0.83]
    ][v];

    ctx.beginPath();
    for (let i = 0; i < pts; i++) {
      const ang = (Math.PI * 2 * i) / pts;
      const rr = bucketR * offsets[i];
      if (i === 0) ctx.moveTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
      else ctx.lineTo(Math.cos(ang) * rr, Math.sin(ang) * rr);
    }
    ctx.closePath();

    const g = ctx.createRadialGradient(-bucketR * 0.35, -bucketR * 0.35, bucketR * 0.1, 0, 0, bucketR);
    g.addColorStop(0, '#94a3b8');
    g.addColorStop(0.55, '#475569');
    g.addColorStop(1, '#1e293b');
    ctx.fillStyle = g;
    ctx.fill();
    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 1.4;
    ctx.stroke();

    const craters = [
      { x: -0.28, y: -0.2, r: 0.24 },
      { x: 0.3, y: 0.15, r: 0.19 },
      { x: -0.08, y: 0.34, r: 0.15 }
    ];
    for (let i = 0; i < craters.length; i++) {
      const cr = craters[(i + v) % craters.length];
      const cx = cr.x * bucketR;
      const cy = cr.y * bucketR;
      const crR = cr.r * bucketR;
      ctx.fillStyle = 'rgba(15,23,42,0.52)';
      ctx.beginPath();
      ctx.arc(cx, cy, crR, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = 'rgba(203,213,225,0.28)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, crR, 0.2, Math.PI * 1.1);
      ctx.stroke();
    }
    astCache.set(key, c);
    return c;
  }

  // Volumetric shaded planet with terminator shadow & atmosphere rim
  function drawPlanet(ctx, px, py, r, cLit, cMid, hasRing) {
    ctx.save();
    const g = ctx.createRadialGradient(px - r * 0.36, py - r * 0.36, r * 0.08, px, py, r);
    g.addColorStop(0, cLit);
    g.addColorStop(0.58, cMid);
    g.addColorStop(1, 'rgba(2,6,23,0.92)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, Math.PI * 2);
    ctx.fill();

    // Subtle atmosphere crescent highlight
    ctx.strokeStyle = 'rgba(255,255,255,0.16)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px, py, r - 0.5, Math.PI * 0.85, Math.PI * 1.65);
    ctx.stroke();

    if (hasRing) {
      ctx.strokeStyle = 'rgba(226,232,240,0.22)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 1.65, r * 0.32, -0.26, 0, Math.PI * 2);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(226,232,240,0.1)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.ellipse(px, py, r * 1.9, r * 0.38, -0.26, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Irregular jagged background rock / crystal / hive silhouette with subtle rim
  function drawBgSilhouette(ctx, br, galaxyId) {
    ctx.save();
    ctx.translate(br.xPx, br.yPx);
    ctx.rotate(br.rot);
    const r = br.r;
    ctx.beginPath();
    if (galaxyId === 3) {
      // Ice shard crystal
      ctx.moveTo(0, -r * 1.25);
      ctx.lineTo(r * 0.52, -r * 0.25);
      ctx.lineTo(r * 0.32, r * 0.95);
      ctx.lineTo(-r * 0.25, r * 1.1);
      ctx.lineTo(-r * 0.55, -r * 0.1);
    } else if (galaxyId === 4) {
      // Bio-hive organic pod
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const rr = r * (i % 2 === 0 ? 1.0 : 0.72);
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    } else {
      // Jagged asteroid silhouette (8 irregular vertices)
      const pts = [1.0, 0.68, 0.94, 0.76, 1.05, 0.64, 0.92, 0.8];
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * 2 * i) / 8;
        const rr = r * pts[i];
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
    }
    ctx.closePath();
    ctx.fillStyle = galaxyId === 2 ? 'rgba(65,16,38,0.42)' : galaxyId === 3 ? 'rgba(14,62,88,0.4)' : galaxyId === 4 ? 'rgba(38,54,14,0.42)' : galaxyId === 5 ? 'rgba(42,18,74,0.45)' : 'rgba(24,35,56,0.52)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(226,232,240,0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  function drawEnemy(ctx, e, t) {
    const r = e.r;
    const pulse = 0.65 + 0.35 * Math.sin(t * 7 + e.x * 0.05);
    const hit = e.flash > 0;
    const frozen = e.freeze > 0;

    // Attack telegraphs (drawn in world coords before translate)
    if (e.aimTimer > 0) {
      ctx.save();
      ctx.strokeStyle = e.type === 'pendulum' ? 'rgba(34,211,238,0.85)' : 'rgba(244,63,94,0.85)';
      ctx.lineWidth = e.type === 'pendulum' ? 2.4 : 1.6;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.aimX, e.aimY);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = e.type === 'pendulum' ? 'rgba(34,211,238,0.4)' : 'rgba(244,63,94,0.35)';
      ctx.beginPath();
      ctx.arc(e.x, e.y + r * 0.4, 4 + pulse * 3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    // Teleporter blink reticle at destination
    if (e.tpTimer > 0) {
      ctx.save();
      ctx.strokeStyle = `rgba(192,132,252,${0.4 + pulse * 0.5})`;
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(e.tpX, e.tpY, r * 0.9, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
    }

    ctx.save();
    ctx.translate(e.x, e.y);

    if (e.elite) {
      ctx.strokeStyle = `rgba(250,204,21,${0.38 + pulse * 0.35})`;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(0, 0, r + 6 + pulse * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    const bodyCol = hit ? '#ffffff' : frozen ? '#67e8f9' : null;

    if (e.type === 'kamikaze') {
      // Detailed razor dart with forward blades, vents & unstable plasma core
      ctx.fillStyle = bodyCol || (e.elite ? '#d97706' : '#9a3412');
      ctx.beginPath();
      ctx.moveTo(0, r * 1.25);
      ctx.lineTo(-r * 0.98, -r * 0.55);
      ctx.lineTo(-r * 0.45, -r * 0.95);
      ctx.lineTo(0, -r * 0.55);
      ctx.lineTo(r * 0.45, -r * 0.95);
      ctx.lineTo(r * 0.98, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = bodyCol || (e.elite ? '#fbbf24' : '#f97316');
      ctx.beginPath();
      ctx.moveTo(0, r * 1.12);
      ctx.lineTo(-r * 0.48, -r * 0.45);
      ctx.lineTo(0, -r * 0.25);
      ctx.lineTo(r * 0.48, -r * 0.45);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fed7aa';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = `rgba(254,240,138,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, r * 0.1, r * 0.26, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'sniper') {
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#7c3aed');
      ctx.beginPath();
      ctx.moveTo(0, r * 1.2);
      ctx.lineTo(-r * 0.45, r * 0.25);
      ctx.lineTo(-r * 1.05, -r * 0.35);
      ctx.lineTo(-r * 0.35, -r * 0.9);
      ctx.lineTo(r * 0.35, -r * 0.9);
      ctx.lineTo(r * 1.05, -r * 0.35);
      ctx.lineTo(r * 0.45, r * 0.25);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#ddd6fe';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = `rgba(244,63,94,${0.55 + pulse * 0.45})`;
      ctx.beginPath();
      ctx.arc(0, r * 0.15, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'shielder') {
      ctx.fillStyle = bodyCol || (e.elite ? '#ca8a04' : '#0284c7');
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI * 2 * i) / 6 + Math.PI / 6;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#bae6fd';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = `rgba(56,189,248,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
      if (e.shieldHp > 0) {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 6, 0.15, Math.PI - 0.15);
        ctx.stroke();
      }
    } else if (e.type === 'splitter') {
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#16a34a');
      ctx.beginPath();
      ctx.ellipse(-r * 0.35, 0, r * 0.65, r * 0.78, -0.25, 0, Math.PI * 2);
      ctx.ellipse(r * 0.35, 0, r * 0.65, r * 0.78, 0.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#bbf7d0';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      ctx.fillStyle = `rgba(217,249,157,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'spiral') {
      ctx.rotate(t * 1.9);
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#be185d');
      ctx.beginPath();
      for (let i = 0; i < 8; i++) {
        const a = (Math.PI * i) / 4;
        const rr = i % 2 === 0 ? r * 1.12 : r * 0.52;
        if (i === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fbcfe8';
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.fillStyle = `rgba(244,114,182,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'miner') {
      // Armored amber minelayer with central bomb bay
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#b45309');
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.9);
      ctx.lineTo(r * 1.0, -r * 0.2);
      ctx.lineTo(r * 0.72, r * 0.88);
      ctx.lineTo(-r * 0.72, r * 0.88);
      ctx.lineTo(-r * 1.0, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fde68a';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = `rgba(251,191,36,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, r * 0.15, r * 0.36, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'carrier') {
      // Bio-hive carrier with twin launch pods
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#3f6212');
      ctx.strokeStyle = '#bef264';
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.roundRect(-r * 1.15, -r * 0.65, r * 2.3, r * 1.3, 6);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = `rgba(163,230,53,${pulse})`;
      ctx.beginPath();
      ctx.arc(-r * 0.55, 0, r * 0.28, 0, Math.PI * 2);
      ctx.arc(r * 0.55, 0, r * 0.28, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'pendulum') {
      // Cyan-indigo laser pendulum cruiser
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#0e7490');
      ctx.beginPath();
      ctx.moveTo(-r * 1.1, -r * 0.5);
      ctx.lineTo(r * 1.1, -r * 0.5);
      ctx.lineTo(r * 0.6, r * 0.95);
      ctx.lineTo(0, r * 0.55);
      ctx.lineTo(-r * 0.6, r * 0.95);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#67e8f9';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = `rgba(34,211,238,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === 'teleporter') {
      // Stealth violet diamond teleporter
      ctx.fillStyle = bodyCol || (e.elite ? '#eab308' : '#6b21a8');
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.1);
      ctx.lineTo(r * 0.95, 0);
      ctx.lineTo(0, r * 1.1);
      ctx.lineTo(-r * 0.95, 0);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#e9d5ff';
      ctx.lineWidth = 1.3;
      ctx.stroke();
      ctx.fillStyle = `rgba(216,180,254,${pulse})`;
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.34, 0, Math.PI * 2);
      ctx.fill();
    } else {
      // Detailed raider interceptor: swept wings, fuselage spine, glowing visor
      ctx.fillStyle = bodyCol || (e.elite ? '#ca8a04' : '#9f1239');
      ctx.beginPath();
      ctx.moveTo(0, r * 1.05);
      ctx.lineTo(-r * 1.14, -r * 0.42);
      ctx.lineTo(-r * 0.52, -r * 0.88);
      ctx.lineTo(0, -r * 0.5);
      ctx.lineTo(r * 0.52, -r * 0.88);
      ctx.lineTo(r * 1.14, -r * 0.42);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#fda4af';
      ctx.lineWidth = 1.1;
      ctx.stroke();
      // Central fuselage
      ctx.fillStyle = bodyCol || (e.elite ? '#facc15' : '#e11d48');
      ctx.beginPath();
      ctx.moveTo(0, r * 1.08);
      ctx.lineTo(-r * 0.4, -r * 0.55);
      ctx.lineTo(0, -r * 0.72);
      ctx.lineTo(r * 0.4, -r * 0.55);
      ctx.closePath();
      ctx.fill();
      // Glowing sensor visor
      ctx.fillStyle = `rgba(251,146,60,${pulse})`;
      ctx.beginPath();
      ctx.ellipse(0, r * 0.12, r * 0.24, r * 0.34, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  const BOSS_THEMES = {
    1: { hull: '#4c1d95', miniHull: '#7f1d1d', stroke: '#c084fc', miniStroke: '#f87171', core: '#c084fc' },
    2: { hull: '#881337', miniHull: '#9f1239', stroke: '#fb7185', miniStroke: '#fda4af', core: '#fb7185' },
    3: { hull: '#0e7490', miniHull: '#155e75', stroke: '#67e8f9', miniStroke: '#a5f3fc', core: '#38bdf8' },
    4: { hull: '#365314', miniHull: '#3f6212', stroke: '#a3e635', miniStroke: '#d9f99d', core: '#84cc16' },
    5: { hull: '#3b0764', miniHull: '#4c1d95', stroke: '#facc15', miniStroke: '#c084fc', core: '#facc15' }
  };

  function drawBoss(ctx, b, t) {
    const r = b.r;
    const hpRatio = Math.max(0, b.hp / b.maxHp);
    const pulse = 0.65 + 0.35 * Math.sin(t * (4 + b.phase * 2.5));
    const hit = b.flash > 0;
    const th = BOSS_THEMES[b.galaxyId] || BOSS_THEMES[1];
    const hullCol = b.isFinal ? th.hull : th.miniHull;
    const strokeCol = b.isFinal ? th.stroke : th.miniStroke;

    ctx.save();
    ctx.translate(b.x, b.y);

    ctx.strokeStyle = strokeCol;
    ctx.globalAlpha = 0.25 + pulse * 0.3;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.arc(0, 0, r + 10 + pulse * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = hit ? '#ffffff' : hullCol;
    ctx.strokeStyle = strokeCol;
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (b.isFinal) {
      ctx.moveTo(0, r * 1.05);
      ctx.lineTo(-r * 0.65, r * 0.6);
      ctx.lineTo(-r * 1.12, 0);
      ctx.lineTo(-r * 0.85, -r * 0.72);
      ctx.lineTo(r * 0.85, -r * 0.72);
      ctx.lineTo(r * 1.12, 0);
      ctx.lineTo(r * 0.65, r * 0.6);
    } else {
      ctx.moveTo(0, r * 1.05);
      ctx.lineTo(-r * 0.95, r * 0.25);
      ctx.lineTo(-r * 1.1, -r * 0.6);
      ctx.lineTo(-r * 0.35, -r * 0.82);
      ctx.lineTo(r * 0.35, -r * 0.82);
      ctx.lineTo(r * 1.1, -r * 0.6);
      ctx.lineTo(r * 0.95, r * 0.25);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    const plateThresholds = [0.75, 0.5, 0.25, 0.1];
    const platePositions = [
      { x: -r * 0.62, y: -r * 0.15, ang: -0.35 },
      { x: r * 0.62, y: -r * 0.15, ang: 0.35 },
      { x: -r * 0.42, y: r * 0.42, ang: -0.65 },
      { x: r * 0.42, y: r * 0.42, ang: 0.65 }
    ];
    for (let i = 0; i < 4; i++) {
      if (hpRatio > plateThresholds[i]) {
        const p = platePositions[i];
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ang);
        ctx.fillStyle = hit ? '#ffffff' : hullCol;
        ctx.strokeStyle = '#fde047';
        ctx.lineWidth = 1.4;
        ctx.fillRect(-10, -6, 20, 12);
        ctx.strokeRect(-10, -6, 20, 12);
        ctx.restore();
      }
    }

    const coreColor = b.phase >= 3 ? '#facc15' : (b.phase === 2 ? '#fb7185' : th.core);
    ctx.fillStyle = coreColor;
    ctx.globalAlpha = 0.7 + pulse * 0.3;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.32, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    const turretAngle = b.turretAngle || 0;
    for (const sx of [-r * 0.68, r * 0.68]) {
      ctx.save();
      ctx.translate(sx, r * 0.1);
      ctx.rotate(turretAngle);
      ctx.fillStyle = '#334155';
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = coreColor;
      ctx.fillRect(-2.2, 0, 4.4, 12);
      ctx.restore();
    }

    ctx.restore();
  }

  global.SHUTTLE_SPRITES = {
    getShipSprite,
    getAsteroidSprite,
    getThrusterOffsets,
    renderShipToCtx,
    drawPlanet,
    drawBgSilhouette,
    drawEnemy,
    drawBoss
  };
})(window);
