/* Раскол — спрайты, нарисованные кодом один раз в offscreen-canvas. Вид сверху, «вперёд» = +x. */
(function (global) {
  'use strict';
  const D = global.RASKOL_DATA;
  const SS = 2;            // пикселей спрайта на мировую единицу
  const RS = 1.5;          // пикселей фона комнаты на мировую единицу
  const cache = {};

  function mk(half, draw) {
    const c = document.createElement('canvas');
    c.width = c.height = Math.ceil(half * 2 * SS);
    const g = c.getContext('2d');
    g.scale(SS, SS); g.translate(half, half);
    g.lineJoin = 'round'; g.lineCap = 'round';
    draw(g);
    return { c, half, white: whiteOf(c) };
  }
  function whiteOf(src) {
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const g = c.getContext('2d');
    g.drawImage(src, 0, 0);
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    return c;
  }
  function radial(g, x, y, r, stops) {
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    return gr;
  }
  function lin(g, x0, y0, x1, y1, stops) {
    const gr = g.createLinearGradient(x0, y0, x1, y1);
    stops.forEach(([o, col]) => gr.addColorStop(o, col));
    return gr;
  }
  function ell(g, x, y, rx, ry, fill, stroke, lw) {
    g.beginPath(); g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    if (fill) { g.fillStyle = fill; g.fill(); }
    if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 1.5; g.stroke(); }
  }

  // ── Герой: Страж ─────────────────────────────────────────────
  function heroGuard(g) {
    // плащ
    g.fillStyle = lin(g, -30, 0, -4, 0, [[0, '#4c0519'], [1, '#be123c']]);
    g.beginPath(); g.moveTo(-6, -16); g.quadraticCurveTo(-30, -22, -32, 0); g.quadraticCurveTo(-30, 22, -6, 16); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 1; g.stroke();
    // наплечники
    ell(g, -2, 0, 13, 21, lin(g, 0, -21, 0, 21, [[0, '#d1d5db'], [0.5, '#6b7280'], [1, '#374151']]), '#fbbf24', 1.6);
    ell(g, -1, -14, 7, 6, '#9ca3af', '#fbbf24', 1.2);
    ell(g, -1, 14, 7, 6, '#9ca3af', '#fbbf24', 1.2);
    // щит (левая рука = -y)
    g.save(); g.translate(8, -19); g.rotate(-0.25);
    g.fillStyle = lin(g, -6, -9, 6, 9, [[0, '#f59e0b'], [1, '#92400e']]);
    g.beginPath(); g.moveTo(-5, -10); g.lineTo(6, -9); g.quadraticCurveTo(9, 0, 6, 9); g.lineTo(-5, 10); g.quadraticCurveTo(-8, 0, -5, -10); g.fill();
    g.strokeStyle = '#fde68a'; g.lineWidth = 1.6; g.stroke();
    g.fillStyle = '#7f1d1d'; g.fillRect(-1, -6, 3, 12); g.fillRect(-4, -1.5, 9, 3);
    g.restore();
    // шлем
    ell(g, 3, 0, 11, 11, radial(g, 0, -4, 13, [[0, '#f3f4f6'], [0.6, '#9ca3af'], [1, '#4b5563']]), '#1f2937', 1.2);
    // гребень-плюмаж
    ell(g, -2, 0, 11, 2.8, '#dc2626', '#7f1d1d', 0.8);
    // визор
    g.strokeStyle = '#0f172a'; g.lineWidth = 2.2; g.beginPath(); g.moveTo(11, -5); g.quadraticCurveTo(14, 0, 11, 5); g.stroke();
    g.strokeStyle = 'rgba(251,191,36,.9)'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(11.6, -3); g.quadraticCurveTo(13.6, 0, 11.6, 3); g.stroke();
  }
  function sword(g) {
    // клинок от рукояти (x=0) вперёд
    g.fillStyle = lin(g, 0, -3, 0, 3, [[0, '#f8fafc'], [0.5, '#cbd5e1'], [1, '#64748b']]);
    g.beginPath(); g.moveTo(10, -3); g.lineTo(54, -2.4); g.lineTo(62, 0); g.lineTo(54, 2.4); g.lineTo(10, 3); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(255,255,255,.9)'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(12, -1.6); g.lineTo(54, -1.2); g.stroke();
    g.fillStyle = '#fbbf24'; g.fillRect(7, -8, 4, 16);
    g.fillStyle = '#78350f'; g.fillRect(-2, -2, 10, 4);
    ell(g, -3, 0, 2.6, 2.6, '#fbbf24');
  }

  // ── Герой: Следопыт ──────────────────────────────────────────
  function heroRanger(g) {
    // лесной плащ с зубчатым краем
    g.fillStyle = lin(g, -30, 0, -4, 0, [[0, '#052e16'], [0.7, '#166534'], [1, '#22c55e']]);
    g.beginPath(); g.moveTo(-6, -15); g.quadraticCurveTo(-28, -20, -31, -6);
    g.lineTo(-27, 0); g.lineTo(-31, 6); g.quadraticCurveTo(-28, 20, -6, 15); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(134,239,172,.45)'; g.lineWidth = 1; g.stroke();
    // колчан за спиной
    g.save(); g.translate(-11, -10); g.rotate(-0.55);
    g.fillStyle = '#78350f'; g.fillRect(-4, -9, 8, 18);
    g.strokeStyle = '#d97706'; g.lineWidth = 1; g.strokeRect(-4, -9, 8, 18);
    for (const ax of [-2, 0, 2]) {
      g.fillStyle = '#f8fafc'; g.beginPath(); g.arc(ax, -10, 1.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#4ade80'; g.fillRect(ax - 0.8, -11, 1.6, 3);
    }
    g.restore();
    // кожаные наплечники
    ell(g, -1, 0, 11, 19, lin(g, 0, -19, 0, 19, [[0, '#713f12'], [0.5, '#92400e'], [1, '#451a03']]), '#22c55e', 1.4);
    ell(g, 0, -13, 6, 5, '#15803d', '#4ade80', 1);
    ell(g, 0, 13, 6, 5, '#15803d', '#4ade80', 1);
    // заострённый капюшон следопыта + узкий светящийся взгляд
    g.fillStyle = radial(g, 2, -2, 14, [[0, '#4ade80'], [0.55, '#15803d'], [1, '#052e16']]);
    g.beginPath(); g.moveTo(-9, 0); g.quadraticCurveTo(-6, -12, 6, -11); g.lineTo(15, 0); g.lineTo(6, 11); g.quadraticCurveTo(-6, 12, -9, 0); g.fill();
    g.strokeStyle = '#052e16'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = '#86efac'; g.lineWidth = 1; g.beginPath(); g.moveTo(2, -9); g.lineTo(14, 0); g.lineTo(2, 9); g.stroke();
    g.strokeStyle = '#0f172a'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(10, -5); g.quadraticCurveTo(13, 0, 10, 5); g.stroke();
    g.strokeStyle = '#4ade80'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10.5, -3.6); g.lineTo(11.6, -1.3); g.moveTo(10.5, 3.6); g.lineTo(11.6, 1.3); g.stroke();
  }
  function bow(g) {
    // рекурсивный лук + тетива + стрела
    g.strokeStyle = '#a16207'; g.lineWidth = 3.6;
    g.beginPath(); g.arc(-2, 0, 20, -1.18, 1.18); g.stroke();
    g.strokeStyle = '#22c55e'; g.lineWidth = 1.4;
    g.beginPath(); g.arc(-1, 0, 19.5, -0.95, 0.95); g.stroke();
    const yEnd = Math.sin(1.18) * 20, xEnd = -2 + Math.cos(1.18) * 20;
    g.strokeStyle = 'rgba(226,232,240,.85)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(xEnd, -yEnd); g.lineTo(-4, 0); g.lineTo(xEnd, yEnd); g.stroke();
    // заряженная стрела
    g.strokeStyle = '#fef3c7'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-4, 0); g.lineTo(24, 0); g.stroke();
    g.fillStyle = '#4ade80';
    g.beginPath(); g.moveTo(29, 0); g.lineTo(21, -3.8); g.lineTo(23, 0); g.lineTo(21, 3.8); g.closePath(); g.fill();
  }

  // ── Герой: Маг ───────────────────────────────────────────────
  function heroMage(g) {
    // мантия с руническим шлейфом
    g.fillStyle = lin(g, -30, 0, -4, 0, [[0, '#2e1065'], [0.7, '#6b21a8'], [1, '#a855f7']]);
    g.beginPath(); g.moveTo(-6, -16); g.quadraticCurveTo(-30, -24, -31, 0); g.quadraticCurveTo(-30, 24, -6, 16); g.closePath(); g.fill();
    g.strokeStyle = '#e879f9'; g.lineWidth = 1.2; g.stroke();
    // плечи + кристаллы маны
    ell(g, -1, 0, 11.5, 20, lin(g, 0, -20, 0, 20, [[0, '#581c87'], [0.5, '#3b0764'], [1, '#1e1b4b']]), '#c084fc', 1.5);
    for (const s of [-1, 1]) {
      g.fillStyle = '#e879f9'; g.beginPath(); g.moveTo(1, s * 15 - 4); g.lineTo(5, s * 15); g.lineTo(1, s * 15 + 4); g.lineTo(-3, s * 15); g.closePath(); g.fill();
    }
    // золотая диадема и рунический капюшон с сияющим визором
    g.fillStyle = radial(g, 2, -2, 13, [[0, '#c084fc'], [0.6, '#581c87'], [1, '#1e1b4b']]);
    g.beginPath(); g.moveTo(-8, 0); g.quadraticCurveTo(-4, -12, 7, -10.5); g.lineTo(14.5, 0); g.lineTo(7, 10.5); g.quadraticCurveTo(-4, 12, -8, 0); g.fill();
    g.strokeStyle = '#fde047'; g.lineWidth = 1.3; g.stroke();
    g.strokeStyle = '#090314'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(10, -4.5); g.quadraticCurveTo(13, 0, 10, 4.5); g.stroke();
    g.strokeStyle = '#f0abfc'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(10.6, -3.5); g.quadraticCurveTo(12.2, 0, 10.6, 3.5); g.stroke();
    ell(g, 4, 0, 2.4, 2.4, '#fde047');
  }
  function staff(g) {
    // рунический посох с парящим кристаллом
    g.fillStyle = '#581c87'; g.fillRect(-10, -2, 34, 4);
    g.strokeStyle = '#fbbf24'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(14, -4); g.lineTo(24, -4); g.moveTo(14, 4); g.lineTo(24, 4); g.stroke();
    g.strokeStyle = '#c084fc'; g.lineWidth = 2.2;
    g.beginPath(); g.moveTo(22, -7); g.quadraticCurveTo(33, 0, 22, 7); g.stroke();
    ell(g, 33, 0, 6.5, 6.5, radial(g, 32, -2, 7, [[0, '#fdf4ff'], [0.5, '#e879f9'], [1, '#7e22ce']]), '#f0abfc', 1.1);
  }

  // ── Герой: Тень ──────────────────────────────────────────────
  function heroShade(g) {
    // раздвоенный плащ убийцы
    g.fillStyle = lin(g, -30, 0, -4, 0, [[0, '#020617'], [0.6, '#0f172a'], [1, '#0284c7']]);
    g.beginPath(); g.moveTo(-6, -14); g.lineTo(-32, -16); g.lineTo(-22, -2); g.lineTo(-32, 16); g.lineTo(-6, 14); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(56,189,248,.6)'; g.lineWidth = 1; g.stroke();
    // лёгкая броня + перевязь
    ell(g, -1, 0, 10, 18, lin(g, 0, -18, 0, 18, [[0, '#1e293b'], [0.5, '#0f172a'], [1, '#020617']]), '#38bdf8', 1.4);
    g.strokeStyle = '#38bdf8'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-6, -12); g.lineTo(6, 12); g.stroke();
    // остроугольная маска с неоново-голубым визором
    g.fillStyle = radial(g, 1, -2, 12, [[0, '#334155'], [0.6, '#0f172a'], [1, '#020617']]);
    g.beginPath(); g.moveTo(-7, 0); g.lineTo(4, -10.5); g.lineTo(14, 0); g.lineTo(4, 10.5); g.closePath(); g.fill();
    g.strokeStyle = '#38bdf8'; g.lineWidth = 1.2; g.stroke();
    g.strokeStyle = '#7dd3fc'; g.lineWidth = 1.4;
    g.beginPath(); g.moveTo(8, -4.5); g.lineTo(11, -1.2); g.moveTo(8, 4.5); g.lineTo(11, 1.2); g.stroke();
  }
  function dagger(g) {
    // изогнутый клинок убийцы
    g.fillStyle = lin(g, 0, -3, 0, 3, [[0, '#e0f2fe'], [0.5, '#38bdf8'], [1, '#0369a1']]);
    g.beginPath(); g.moveTo(2, -2.8); g.lineTo(14, -2.2); g.lineTo(22, 0); g.lineTo(14, 2.6); g.lineTo(2, 2.2); g.closePath(); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 0.7; g.beginPath(); g.moveTo(4, -1.2); g.lineTo(19, 0); g.stroke();
    g.fillStyle = '#38bdf8'; g.fillRect(0, -5, 2.8, 10);
    g.fillStyle = '#0f172a'; g.fillRect(-5, -1.6, 5, 3.2);
  }

  // ── Враги ────────────────────────────────────────────────────
  function boneBody(g, sc, eye) {
    ell(g, -3 * sc, 0, 9 * sc, 15 * sc, '#d6d3d1', '#57534e', 1.2);
    g.strokeStyle = '#78716c'; g.lineWidth = 1.2;
    for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(-9 * sc, i * 4.5 * sc); g.quadraticCurveTo(-3 * sc, i * 5 * sc, 2 * sc, i * 4.5 * sc); g.stroke(); }
    ell(g, 4 * sc, 0, 8.5 * sc, 8 * sc, radial(g, 2 * sc, -2 * sc, 10 * sc, [[0, '#fafaf9'], [1, '#a8a29e']]), '#44403c', 1.2);
    ell(g, 8 * sc, -3.2 * sc, 2.2 * sc, 2.2 * sc, '#1c1917'); ell(g, 8 * sc, 3.2 * sc, 2.2 * sc, 2.2 * sc, '#1c1917');
    ell(g, 8.4 * sc, -3.2 * sc, 1.1 * sc, 1.1 * sc, eye); ell(g, 8.4 * sc, 3.2 * sc, 1.1 * sc, 1.1 * sc, eye);
  }
  function skel(g) {
    boneBody(g, 1, '#ef4444');
    g.save(); g.translate(4, 14); g.rotate(0.35);
    g.fillStyle = '#a16207'; g.fillRect(0, -2, 22, 4); g.fillStyle = '#57534e'; g.fillRect(-3, -4, 4, 8);
    g.restore();
  }
  function archer(g) {
    // капюшон
    ell(g, -4, 0, 10, 15, '#3f6212', '#1a2e05', 1.2);
    boneBody(g, 0.9, '#a3e635');
    g.strokeStyle = '#92400e'; g.lineWidth = 2.4;
    g.beginPath(); g.arc(4, 0, 17, -1.1, 1.1); g.stroke();
    g.strokeStyle = '#e7e5e4'; g.lineWidth = 0.8; g.beginPath(); g.moveTo(4 + 17 * Math.cos(-1.1), 17 * Math.sin(-1.1)); g.lineTo(4 + 17 * Math.cos(1.1), 17 * Math.sin(1.1)); g.stroke();
  }
  function bat(up) {
    return g => {
      const wy = up ? 1 : 0.45;
      g.fillStyle = '#3b0764';
      for (const s of [-1, 1]) {
        g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-4, s * 14 * wy, -10, s * 20 * wy); g.lineTo(-4, s * 12 * wy); g.lineTo(-8, s * 8 * wy); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(2, 0); g.quadraticCurveTo(-2, s * 16 * wy, 4, s * 22 * wy); g.lineTo(2, s * 10 * wy); g.closePath(); g.fill();
      }
      ell(g, 0, 0, 8, 6, radial(g, 2, -2, 9, [[0, '#7e22ce'], [1, '#2e1065']]));
      ell(g, 5, -2.2, 1.5, 1.5, '#fde047'); ell(g, 5, 2.2, 1.5, 1.5, '#fde047');
    };
  }
  function slime(g) {
    g.fillStyle = radial(g, -4, -6, 26, [[0, 'rgba(190,242,100,.95)'], [0.6, 'rgba(101,163,13,.92)'], [1, 'rgba(54,83,20,.95)']]);
    g.beginPath(); g.moveTo(-22, 6);
    g.bezierCurveTo(-24, -14, -8, -22, 2, -21); g.bezierCurveTo(16, -20, 24, -8, 22, 6);
    g.bezierCurveTo(21, 18, 8, 21, 0, 20); g.bezierCurveTo(-10, 21, -21, 17, -22, 6); g.fill();
    g.strokeStyle = 'rgba(26,46,5,.7)'; g.lineWidth = 1.4; g.stroke();
    ell(g, -8, -11, 6, 3.5, 'rgba(255,255,255,.55)');
    ell(g, -5, 0, 3.6, 4.4, '#fff'); ell(g, 7, 0, 3.6, 4.4, '#fff');
    ell(g, -4, 1, 1.8, 2.4, '#1a2e05'); ell(g, 8, 1, 1.8, 2.4, '#1a2e05');
  }
  function warlock(g) {
    ell(g, -3, 0, 13, 17, radial(g, -2, -4, 18, [[0, '#7c3aed'], [1, '#2e1065']]), '#a78bfa', 1);
    ell(g, 3, 0, 9, 9, '#1e1b4b', '#4c1d95', 1.2);
    ell(g, 6, -3, 1.8, 1.4, '#f0abfc'); ell(g, 6, 3, 1.8, 1.4, '#f0abfc');
    g.strokeStyle = '#78350f'; g.lineWidth = 2.6; g.beginPath(); g.moveTo(-6, 15); g.lineTo(18, 13); g.stroke();
    ell(g, 20, 13, 4.2, 4.2, radial(g, 20, 13, 6, [[0, '#fdf4ff'], [0.5, '#e879f9'], [1, '#86198f']]));
  }
  function totem(g) {
    g.fillStyle = '#292524';
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; g.lineTo(Math.cos(a) * 25, Math.sin(a) * 25); }
    g.closePath(); g.fill();
    g.fillStyle = lin(g, 0, -22, 0, 22, [[0, '#78716c'], [1, '#44403c']]);
    g.beginPath();
    for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + Math.PI / 8; g.lineTo(Math.cos(a) * 21, Math.sin(a) * 21); }
    g.closePath(); g.fill();
    g.strokeStyle = '#f43f5e'; g.lineWidth = 2; g.shadowColor = '#f43f5e'; g.shadowBlur = 6;
    g.beginPath(); g.moveTo(0, -12); g.lineTo(8, 0); g.lineTo(0, 12); g.lineTo(-8, 0); g.closePath(); g.stroke();
    g.beginPath(); g.moveTo(0, -12); g.lineTo(0, 12); g.stroke();
    g.shadowBlur = 0;
  }
  function warden(g) {
    // мантия
    g.fillStyle = lin(g, -40, 0, -8, 0, [[0, '#111827'], [1, '#374151']]);
    g.beginPath(); g.moveTo(-8, -28); g.quadraticCurveTo(-46, -30, -44, 0); g.quadraticCurveTo(-46, 30, -8, 28); g.closePath(); g.fill();
    ell(g, -4, 0, 18, 32, lin(g, 0, -32, 0, 32, [[0, '#4b5563'], [0.5, '#1f2937'], [1, '#111827']]), '#22d3ee', 1.4);
    // шипы на плечах
    g.fillStyle = '#9ca3af';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(-6, s * 22); g.lineTo(-16, s * 38); g.lineTo(2, s * 26); g.closePath(); g.fill(); }
    // шлем с рогами
    ell(g, 6, 0, 15, 15, radial(g, 2, -5, 17, [[0, '#6b7280'], [1, '#111827']]), '#000', 1.2);
    g.fillStyle = '#e5e7eb';
    for (const s of [-1, 1]) { g.beginPath(); g.moveTo(4, s * 11); g.quadraticCurveTo(14, s * 26, 26, s * 22); g.quadraticCurveTo(14, s * 18, 10, s * 8); g.closePath(); g.fill(); }
    g.strokeStyle = '#22d3ee'; g.lineWidth = 2.6; g.shadowColor = '#22d3ee'; g.shadowBlur = 8;
    g.beginPath(); g.moveTo(16, -6); g.lineTo(19, 0); g.lineTo(16, 6); g.stroke(); g.shadowBlur = 0;
  }
  function greatsword(g) {
    g.fillStyle = lin(g, 0, -5, 0, 5, [[0, '#e0f2fe'], [0.5, '#64748b'], [1, '#1e293b']]);
    g.beginPath(); g.moveTo(14, -5); g.lineTo(84, -4); g.lineTo(96, 0); g.lineTo(84, 4); g.lineTo(14, 5); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(34,211,238,.9)'; g.lineWidth = 1.2; g.beginPath(); g.moveTo(18, 0); g.lineTo(84, 0); g.stroke();
    g.fillStyle = '#334155'; g.fillRect(9, -12, 6, 24); g.fillStyle = '#0f172a'; g.fillRect(-4, -2.5, 14, 5);
  }
  function king(g) {
    // костяной плащ
    g.fillStyle = lin(g, -50, 0, -6, 0, [[0, '#1e0b2e'], [1, '#581c87']]);
    g.beginPath(); g.moveTo(-6, -32); g.quadraticCurveTo(-56, -40, -54, 0); g.quadraticCurveTo(-56, 40, -6, 32); g.closePath(); g.fill();
    g.strokeStyle = '#e9d5ff'; g.lineWidth = 1.2;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(-10, i * 9); g.lineTo(-48, i * 11); g.stroke(); }
    // рёбра
    ell(g, -4, 0, 16, 28, '#e7e5e4', '#44403c', 1.4);
    g.strokeStyle = '#78716c'; g.lineWidth = 1.6;
    for (let i = -3; i <= 3; i++) { g.beginPath(); g.moveTo(-16, i * 7); g.quadraticCurveTo(-4, i * 8, 8, i * 7); g.stroke(); }
    // череп
    ell(g, 10, 0, 16, 15, radial(g, 6, -5, 18, [[0, '#fafaf9'], [1, '#a8a29e']]), '#292524', 1.4);
    for (const s of [-1, 1]) {
      ell(g, 17, s * 6, 4, 3.6, '#0c0a09');
      g.shadowColor = '#d946ef'; g.shadowBlur = 8; ell(g, 18, s * 6, 2, 2, '#f0abfc'); g.shadowBlur = 0;
    }
    // корона
    g.fillStyle = lin(g, 0, -16, 0, 16, [[0, '#fde047'], [1, '#b45309']]);
    g.beginPath(); g.moveTo(-2, -15);
    for (let i = 0; i <= 6; i++) { const y = -15 + i * 5; g.lineTo(i % 2 ? -12 : -4, y); }
    g.lineTo(-2, 15); g.lineTo(4, 15); g.lineTo(4, -15); g.closePath(); g.fill();
    ell(g, -1, 0, 2.4, 2.4, '#dc2626');
  }

  // ── Свечения и мелочи ────────────────────────────────────────
  function glow(color, r) {
    const key = 'glow' + color + r;
    if (cache[key]) return cache[key];
    const c = document.createElement('canvas'); c.width = c.height = r * 2;
    const g = c.getContext('2d');
    g.fillStyle = radial(g, r, r, r, [[0, color], [0.35, color.replace(/[\d.]+\)$/, '0.35)')], [1, color.replace(/[\d.]+\)$/, '0)')]]);
    g.fillRect(0, 0, r * 2, r * 2);
    return (cache[key] = c);
  }

  // ── Фон комнаты ──────────────────────────────────────────────
  function seeded(seed) { let s = seed % 2147483647; if (s <= 0) s += 2147483646; return () => (s = s * 16807 % 2147483647) / 2147483647; }

  function crack(g, r, x0, y0, x1, y1, w) {
    const pts = [[x0, y0]];
    const n = 14;
    for (let i = 1; i < n; i++) {
      const t = i / n;
      pts.push([x0 + (x1 - x0) * t + (r() - 0.5) * 70, y0 + (y1 - y0) * t + (r() - 0.5) * 70]);
    }
    pts.push([x1, y1]);
    const path = () => { g.beginPath(); g.moveTo(pts[0][0], pts[0][1]); for (const p of pts) g.lineTo(p[0], p[1]); };
    g.save();
    g.strokeStyle = 'rgba(217,70,239,.22)'; g.lineWidth = w * 6; g.shadowColor = '#d946ef'; g.shadowBlur = 30; path(); g.stroke();
    g.strokeStyle = 'rgba(34,211,238,.55)'; g.lineWidth = w * 2.2; g.shadowColor = '#22d3ee'; g.shadowBlur = 14; path(); g.stroke();
    g.shadowBlur = 0; g.strokeStyle = 'rgba(240,253,255,.9)'; g.lineWidth = w * 0.7; path(); g.stroke();
    // ответвления
    for (let i = 2; i < pts.length - 2; i += 3) {
      const [px, py] = pts[i]; const a = r() * Math.PI * 2, len = 30 + r() * 60;
      g.strokeStyle = 'rgba(34,211,238,.45)'; g.lineWidth = w * 0.8;
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + Math.cos(a) * len * 0.5 + (r() - 0.5) * 20, py + Math.sin(a) * len * 0.5); g.lineTo(px + Math.cos(a) * len, py + Math.sin(a) * len); g.stroke();
    }
    g.restore();
  }

  function obstacle(g, o, r) {
    const { x, y, w, h, k } = o;
    // тень
    g.fillStyle = 'rgba(0,0,0,.45)'; g.beginPath(); g.ellipse(x + w / 2 + 10, y + h + 6, w * 0.62, 16, 0, 0, Math.PI * 2); g.fill();
    if (k === 'pillar') {
      const face = Math.min(26, h * 0.35);
      g.fillStyle = lin(g, 0, y + h - face, 0, y + h, [[0, '#3f3a4a'], [1, '#1c1922']]); g.fillRect(x, y + h - face, w, face);
      g.fillStyle = lin(g, x, y, x + w, y + h, [[0, '#6b6578'], [1, '#433d50']]); g.fillRect(x, y, w, h - face);
      g.strokeStyle = 'rgba(255,255,255,.15)'; g.lineWidth = 2; g.strokeRect(x + 4, y + 4, w - 8, h - face - 8);
      g.strokeStyle = 'rgba(0,0,0,.4)'; g.beginPath(); g.moveTo(x + w * 0.3, y + 6); g.lineTo(x + w * 0.45, y + (h - face) * 0.6); g.stroke();
    } else if (k === 'tomb') {
      const face = 20;
      g.fillStyle = '#25212d'; g.fillRect(x, y + h - face, w, face);
      g.fillStyle = lin(g, x, y, x, y + h, [[0, '#57506a'], [1, '#3a3447']]); g.fillRect(x, y, w, h - face);
      g.strokeStyle = '#7c7491'; g.lineWidth = 2; g.strokeRect(x + 6, y + 6, w - 12, h - face - 12);
      g.strokeStyle = 'rgba(217,70,239,.6)'; g.lineWidth = 3;
      const cx = x + w / 2, cy = y + (h - face) / 2;
      g.beginPath(); g.moveTo(cx, cy - 16); g.lineTo(cx, cy + 16); g.moveTo(cx - 10, cy - 6); g.lineTo(cx + 10, cy - 6); g.stroke();
    } else {
      const face = 22;
      g.fillStyle = '#211d29'; g.fillRect(x, y + h - face, w, face);
      g.fillStyle = '#4a4458'; g.fillRect(x, y, w, h - face);
      g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.5;
      for (let bx = x; bx < x + w; bx += 28) { g.beginPath(); g.moveTo(bx, y + h - face); g.lineTo(bx, y + h); g.stroke(); }
      g.beginPath(); g.moveTo(x, y + h - face / 2); g.lineTo(x + w, y + h - face / 2); g.stroke();
    }
  }

  function renderRoom(layoutIdx, seed) {
    const W = D.ROOM_W + D.WALL * 2, H = D.ROOM_H + D.WALL * 2, WL = D.WALL;
    const c = document.createElement('canvas');
    c.width = Math.ceil(W * RS); c.height = Math.ceil(H * RS);
    const g = c.getContext('2d'); g.scale(RS, RS);
    const r = seeded(seed * 9973 + 17);
    // пол: плиты
    g.fillStyle = '#0d0b12'; g.fillRect(0, 0, W, H);
    const T = 70;
    for (let ty = 0; ty * T < D.ROOM_H; ty++) {
      const off = (ty % 2) * T / 2;
      for (let tx = -1; tx * T < D.ROOM_W + T; tx++) {
        const x = WL + tx * T + off, y = WL + ty * T;
        const l = 10 + r() * 6, hue = 255 + r() * 25;
        g.fillStyle = `hsl(${hue},12%,${l}%)`; g.fillRect(x + 1.5, y + 1.5, T - 3, T - 3);
        g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(x + 1.5, y + 1.5, T - 3, 3);
        g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + 1.5, y + T - 4.5, T - 3, 3);
        if (r() < 0.18) { // трещинка
          g.strokeStyle = 'rgba(0,0,0,.45)'; g.lineWidth = 1.2; g.beginPath();
          let px = x + r() * T, py = y + r() * T; g.moveTo(px, py);
          for (let i = 0; i < 3; i++) { px += (r() - 0.5) * 30; py += (r() - 0.5) * 30; g.lineTo(px, py); }
          g.stroke();
        }
        if (r() < 0.07) { g.fillStyle = 'rgba(77,124,15,.25)'; g.beginPath(); g.ellipse(x + r() * T, y + r() * T, 6 + r() * 10, 4 + r() * 6, r() * 3, 0, 7); g.fill(); }
      }
    }
    // кости и черепки
    for (let i = 0; i < 9; i++) {
      const x = WL + 40 + r() * (D.ROOM_W - 80), y = WL + 40 + r() * (D.ROOM_H - 80), a = r() * Math.PI;
      g.save(); g.translate(x, y); g.rotate(a);
      g.strokeStyle = 'rgba(214,211,209,.35)'; g.lineWidth = 3; g.beginPath(); g.moveTo(-8, 0); g.lineTo(8, 0); g.stroke();
      ell(g, -9, -2, 2, 2, 'rgba(214,211,209,.35)'); ell(g, -9, 2, 2, 2, 'rgba(214,211,209,.35)');
      ell(g, 9, -2, 2, 2, 'rgba(214,211,209,.35)'); ell(g, 9, 2, 2, 2, 'rgba(214,211,209,.35)');
      g.restore();
    }
    // Раскол — светящаяся трещина через пол
    const side = r() < 0.5;
    crack(g, r, WL + 60 + r() * 200, side ? WL + 40 : WL + D.ROOM_H - 40, WL + D.ROOM_W - 60 - r() * 200, side ? WL + D.ROOM_H - 40 : WL + 40, 2);
    // затемнение по краям пола
    g.fillStyle = radial(g, W / 2, H / 2, W * 0.62, [[0.55, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,.55)']]); g.fillRect(WL, WL, D.ROOM_W, D.ROOM_H);
    // стены
    const brick = (x, y, w, h, base) => {
      g.fillStyle = base; g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(0,0,0,.5)'; g.lineWidth = 1.5;
      for (let yy = y, row = 0; yy < y + h; yy += 18, row++) {
        g.beginPath(); g.moveTo(x, yy); g.lineTo(x + w, yy); g.stroke();
        for (let xx = x + (row % 2) * 20; xx < x + w; xx += 40) { g.beginPath(); g.moveTo(xx, yy); g.lineTo(xx, Math.min(y + h, yy + 18)); g.stroke(); }
      }
    };
    brick(0, 0, W, WL, '#1f1b27');                       // верх: фасад
    g.fillStyle = lin(g, 0, WL - 34, 0, WL, [[0, 'rgba(120,110,140,.0)'], [1, 'rgba(120,110,140,.25)']]); g.fillRect(0, WL - 34, W, 34);
    g.fillStyle = '#100d16'; g.fillRect(0, 0, W, 14);
    brick(0, H - WL, W, WL, '#17141e');
    brick(0, WL, WL, H - WL * 2, '#17141e'); brick(W - WL, WL, WL, H - WL * 2, '#17141e');
    g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(WL, WL, D.ROOM_W, 10); // тень от верхней стены
    g.strokeStyle = 'rgba(167,139,250,.25)'; g.lineWidth = 2; g.strokeRect(WL, WL, D.ROOM_W, D.ROOM_H);
    // препятствия
    for (const o of D.LAYOUTS[layoutIdx] || []) obstacle(g, { ...o, x: o.x + WL, y: o.y + WL }, r);
    return { c, scale: RS };
  }

  let built = false;
  function build() {
    if (built) return;
    built = true;
    cache.hero_guard = mk(34, heroGuard);
    cache.sword = mk(64, sword);
    cache.hero_ranger = mk(34, heroRanger);
    cache.bow = mk(32, bow);
    cache.hero_mage = mk(34, heroMage);
    cache.staff = mk(50, staff);
    cache.hero_shade = mk(34, heroShade);
    cache.dagger = mk(26, dagger);
    cache.skel = mk(30, skel);
    cache.archer = mk(26, archer);
    cache.bat0 = mk(26, bat(true));
    cache.bat1 = mk(26, bat(false));
    cache.slime = mk(26, slime);
    cache.warlock = mk(28, warlock);
    cache.totem = mk(28, totem);
    cache.warden = mk(48, warden);
    cache.greatsword = mk(98, greatsword);
    cache.king = mk(58, king);
  }

  global.RASKOL_SPRITES = { build, get: k => cache[k], glow, renderRoom, SS };
})(window);
