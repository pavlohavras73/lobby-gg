/* Lobby.gg — Shared Arcade Visual Effects & Unified Game Over Module */
(function (w) {
  'use strict';

  const MAX_PARTICLES = 140;
  const MAX_FLOATS = 24;

  const I18N = {
    uk: {
      title: 'Гру закінчено',
      score: 'Рахунок',
      best: 'Рекорд',
      new_record: '🔥 Новий рекорд!',
      again: '↻ Ще раз',
      share: 'Поділитися',
      all_games: '‹ Усі ігри'
    },
    ru: {
      title: 'Конец игры',
      score: 'Счёт',
      best: 'Рекорд',
      new_record: '🔥 Новый рекорд!',
      again: '↻ Ещё раз',
      share: 'Поделиться',
      all_games: '‹ Все игры'
    },
    en: {
      title: 'Game Over',
      score: 'Score',
      best: 'Best',
      new_record: '🔥 New Record!',
      again: '↻ Play again',
      share: 'Share',
      all_games: '‹ All games'
    },
    de: {
      title: 'Spiel vorbei',
      score: 'Punkte',
      best: 'Rekord',
      new_record: '🔥 Neuer Rekord!',
      again: '↻ Nochmal',
      share: 'Teilen',
      all_games: '‹ Alle Spiele'
    }
  };

  function getLang(explicit) {
    const l = explicit || localStorage.getItem('jg_lang') || document.documentElement.lang || 'ru';
    return I18N[l] ? l : 'ru';
  }

  function reducedMotion() {
    return !!(w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }

  function vibrate(pattern) {
    try {
      if (w.LobbyUI && typeof w.LobbyUI.vibrate === 'function') {
        w.LobbyUI.vibrate(pattern);
      }
    } catch (e) {}
  }

  // Pre-allocated object pools (zero per-frame GC churn)
  const pPool = new Array(MAX_PARTICLES);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    pPool[i] = { active: false, x: 0, y: 0, vx: 0, vy: 0, g: 0, size: 3, life: 0, maxLife: 1, color: '#fff', shape: 'circle', rot: 0, vrot: 0 };
  }
  const fPool = new Array(MAX_FLOATS);
  for (let i = 0; i < MAX_FLOATS; i++) {
    fPool[i] = { active: false, x: 0, y: 0, vy: -40, text: '', color: '#fff', size: 15, life: 0, maxLife: 0.8 };
  }

  let overlay = null;
  let octx = null;
  let ow = 0, oh = 0, odpr = 1;
  let rafId = 0;
  let lastTs = 0;
  let flashState = { alpha: 0, decay: 0, color: '#ffffff' };

  function resizeOverlay() {
    if (!overlay) return;
    odpr = Math.min(w.devicePixelRatio || 1, 2);
    ow = w.innerWidth || 390;
    oh = w.innerHeight || 844;
    overlay.width = Math.round(ow * odpr);
    overlay.height = Math.round(oh * odpr);
  }

  function ensureOverlay() {
    if (overlay && document.body.contains(overlay)) return overlay;
    overlay = document.createElement('canvas');
    overlay.id = 'arcadeFxOverlay';
    overlay.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9998;';
    document.body.appendChild(overlay);
    octx = overlay.getContext('2d');
    resizeOverlay();
    w.addEventListener('resize', resizeOverlay, { passive: true });
    return overlay;
  }

  function toViewport(x, y, canvasEl) {
    if (!canvasEl || !canvasEl.getBoundingClientRect) return { x, y };
    const r = canvasEl.getBoundingClientRect();
    const cw = canvasEl.width || r.width || 1;
    const ch = canvasEl.height || r.height || 1;
    const dpr = canvasEl._logicalDpr || 1;
    const lw = cw / dpr;
    const lh = ch / dpr;
    return {
      x: r.left + (x / lw) * r.width,
      y: r.top + (y / lh) * r.height
    };
  }

  function startLoop() {
    if (rafId) return;
    lastTs = performance.now();
    rafId = requestAnimationFrame(tickOverlay);
  }

  function tickOverlay(ts) {
    const dt = Math.min(0.05, Math.max(0.001, (ts - lastTs) / 1000));
    lastTs = ts;
    if (!octx) { rafId = 0; return; }

    octx.setTransform(odpr, 0, 0, odpr, 0, 0);
    octx.clearRect(0, 0, ow, oh);

    let anyActive = false;

    if (flashState.alpha > 0.005) {
      anyActive = true;
      octx.save();
      octx.globalAlpha = flashState.alpha;
      octx.fillStyle = flashState.color;
      octx.fillRect(0, 0, ow, oh);
      octx.restore();
      flashState.alpha = Math.max(0, flashState.alpha - flashState.decay * dt);
    } else {
      flashState.alpha = 0;
    }

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = pPool[i];
      if (!p.active) continue;
      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }
      anyActive = true;
      p.vy += p.g * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.rot += p.vrot * dt;

      const a = Math.max(0, p.life / p.maxLife);
      octx.save();
      octx.globalAlpha = a;
      octx.fillStyle = p.color;
      if (p.shape === 'rect') {
        octx.translate(p.x, p.y);
        octx.rotate(p.rot);
        octx.fillRect(-p.size, -p.size * 0.55, p.size * 2, p.size * 1.1);
      } else if (p.shape === 'spark') {
        octx.strokeStyle = p.color;
        octx.lineWidth = Math.max(1.5, p.size * 0.65);
        octx.lineCap = 'round';
        octx.beginPath();
        octx.moveTo(p.x, p.y);
        octx.lineTo(p.x - p.vx * 0.035, p.y - p.vy * 0.035);
        octx.stroke();
      } else {
        octx.beginPath();
        octx.arc(p.x, p.y, p.size * (0.4 + 0.6 * a), 0, Math.PI * 2);
        octx.fill();
      }
      octx.restore();
    }

    const modalOpen = !!(modalEl && modalEl.classList.contains('open'));
    for (let i = 0; i < MAX_FLOATS; i++) {
      const f = fPool[i];
      if (!f.active) continue;
      if (modalOpen) { f.active = false; continue; }
      f.life -= dt;
      if (f.life <= 0) { f.active = false; continue; }
      anyActive = true;
      f.y += f.vy * dt;
      const a = Math.min(1, (f.life / f.maxLife) * 1.4);
      octx.save();
      octx.globalAlpha = a;
      octx.font = `900 ${f.size}px Inter, system-ui, sans-serif`;
      octx.textAlign = 'center';
      octx.textBaseline = 'middle';
      octx.lineJoin = 'round';
      octx.miterLimit = 2;
      octx.lineWidth = Math.max(4, Math.round(f.size * 0.24));
      octx.strokeStyle = 'rgba(2, 6, 23, 0.92)';
      octx.strokeText(f.text, f.x, f.y);
      octx.fillStyle = f.color;
      octx.fillText(f.text, f.x, f.y);
      octx.restore();
    }

    if (anyActive) {
      rafId = requestAnimationFrame(tickOverlay);
    } else {
      octx.clearRect(0, 0, ow, oh);
      rafId = 0;
    }
  }

  function burst(x, y, opts) {
    const o = opts || {};
    ensureOverlay();
    const pos = toViewport(x, y, o.canvas);
    const colors = o.colors || ['#ff2238', '#fbbf24', '#38bdf8', '#ffffff'];
    let count = o.count == null ? 18 : o.count;
    if (reducedMotion()) count = Math.max(2, Math.round(count * 0.25));
    const baseSpeed = o.speed == null ? 210 : o.speed;
    const gravity = o.gravity == null ? 260 : o.gravity;
    const baseSize = o.size == null ? 4 : o.size;
    const baseLife = o.life == null ? 0.55 : o.life;
    const shape = o.shape || 'circle';

    let spawned = 0;
    for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
      const p = pPool[i];
      if (p.active) continue;
      const ang = Math.random() * Math.PI * 2;
      const spd = baseSpeed * (0.35 + Math.random() * 0.85);
      p.active = true;
      p.x = pos.x;
      p.y = pos.y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - (o.upwardBias || 30);
      p.g = gravity;
      p.size = baseSize * (0.65 + Math.random() * 0.7);
      p.maxLife = baseLife * (0.7 + Math.random() * 0.55);
      p.life = p.maxLife;
      p.color = colors[spawned % colors.length];
      p.shape = shape;
      p.rot = Math.random() * Math.PI * 2;
      p.vrot = (Math.random() - 0.5) * 10;
      spawned++;
    }
    startLoop();
  }

  function floatText(x, y, text, opts) {
    if (!text) return;
    if (modalEl && modalEl.classList.contains('open')) return;
    const o = opts || {};
    ensureOverlay();
    const pos = toViewport(x, y, o.canvas);
    for (let i = 0; i < MAX_FLOATS; i++) {
      const f = fPool[i];
      if (f.active) continue;
      f.active = true;
      f.x = pos.x;
      f.y = pos.y;
      f.vy = o.vy == null ? -48 : o.vy;
      f.text = String(text);
      f.color = o.color || '#fde047';
      f.size = o.size || 16;
      f.maxLife = o.life || 0.75;
      f.life = f.maxLife;
      break;
    }
    startLoop();
  }

  function flash(color, alpha, durationMs) {
    if (reducedMotion()) return;
    ensureOverlay();
    const a = alpha == null ? 0.32 : Math.min(0.85, Math.max(0.05, alpha));
    const sec = Math.max(0.06, (durationMs || 240) / 1000);
    flashState.color = color || '#ffffff';
    flashState.alpha = a;
    flashState.decay = a / sec;
    startLoop();
  }

  let shakeTimer = 0;
  function shake(targetEl, intensity, durationMs) {
    if (reducedMotion()) return;
    const el = targetEl || document.body;
    if (!el || !el.style) return;
    if (shakeTimer) cancelAnimationFrame(shakeTimer);
    const amp = intensity == null ? 8 : intensity;
    const dur = durationMs == null ? 320 : durationMs;
    const start = performance.now();
    function step(now) {
      const t = (now - start) / dur;
      if (t >= 1) {
        el.style.transform = '';
        shakeTimer = 0;
        return;
      }
      const k = (1 - t) * (1 - t);
      const dx = (Math.random() * 2 - 1) * amp * k;
      const dy = (Math.random() * 2 - 1) * amp * k;
      el.style.transform = `translate3d(${dx.toFixed(1)}px, ${dy.toFixed(1)}px, 0)`;
      shakeTimer = requestAnimationFrame(step);
    }
    shakeTimer = requestAnimationFrame(step);
  }

  function confetti(opts) {
    if (reducedMotion()) return;
    if (w.LobbyUI && typeof w.LobbyUI.confetti === 'function') {
      w.LobbyUI.confetti(opts);
    } else {
      burst((w.innerWidth || 390) * 0.5, (w.innerHeight || 844) * 0.42, {
        count: 55,
        speed: 320,
        gravity: 340,
        size: 5,
        life: 1.15,
        shape: 'rect',
        colors: ['#ff2238', '#fbbf24', '#22c55e', '#38bdf8', '#f472b6']
      });
    }
  }

  // Unified Game Over Modal
  let modalEl = null;
  let lastModalOpts = null;

  function ensureModalStyles() {
    if (document.getElementById('arcadeFxStyles')) return;
    const st = document.createElement('style');
    st.id = 'arcadeFxStyles';
    st.textContent = `
      .afx-modal {
        position: fixed; inset: 0; z-index: 9990;
        display: none; align-items: center; justify-content: center;
        padding: 16px; background: rgba(4, 6, 14, 0.78);
        backdrop-filter: blur(8px); -webkit-backdrop-filter: blur(8px);
      }
      .afx-modal.open { display: flex; }
      .afx-card {
        width: min(360px, calc(100vw - 28px)); box-sizing: border-box;
        background: linear-gradient(175deg, rgba(22, 26, 40, 0.96), rgba(11, 13, 22, 0.98));
        border: 1px solid rgba(255, 255, 255, 0.14); border-radius: 22px;
        padding: 20px 18px 18px; text-align: center; color: #f8fafc;
        box-shadow: 0 24px 60px rgba(0, 0, 0, 0.7), 0 0 36px rgba(255, 34, 56, 0.22);
        animation: afxPop .26s cubic-bezier(.22, 1.25, .36, 1) both;
      }
      @media (prefers-reduced-motion: reduce) { .afx-card { animation: none; } }
      @keyframes afxPop { from { opacity: 0; transform: scale(.9) translateY(12px); } to { opacity: 1; transform: scale(1) translateY(0); } }
      .afx-title { margin: 0 0 8px; font-size: 24px; font-weight: 900; letter-spacing: -.3px; }
      .afx-sub { font-size: 13px; color: #94a3b8; margin-bottom: 10px; font-weight: 600; }
      .afx-badge {
        display: inline-block; margin: 2px auto 12px; padding: 5px 12px;
        border-radius: 999px; font-size: 12.5px; font-weight: 900; color: #111827;
        background: linear-gradient(90deg, #fde047, #f59e0b);
        box-shadow: 0 0 20px rgba(251, 191, 36, 0.45);
      }
      .afx-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 10px 0 14px; }
      .afx-stat {
        background: rgba(255, 255, 255, 0.05); border: 1px solid rgba(255, 255, 255, 0.09);
        border-radius: 14px; padding: 10px 8px;
      }
      .afx-stat .l { font-size: 11px; color: #94a3b8; font-weight: 700; text-transform: uppercase; letter-spacing: .4px; }
      .afx-stat .v { font-size: 20px; font-weight: 900; margin-top: 2px; color: #ffffff; }
      .afx-extra { display: flex; justify-content: center; gap: 8px; flex-wrap: wrap; margin-bottom: 14px; }
      .afx-pill {
        background: rgba(56, 189, 248, 0.12); border: 1px solid rgba(56, 189, 248, 0.28);
        border-radius: 999px; padding: 4px 10px; font-size: 12px; font-weight: 700; color: #bae6fd;
      }
      .afx-actions { display: flex; flex-direction: column; gap: 8px; }
      .afx-btn-main {
        width: 100%; border: 0; border-radius: 14px; padding: 13px 16px;
        background: linear-gradient(135deg, #ff2238, #c40f23); color: #fff;
        font: inherit; font-size: 15px; font-weight: 900; cursor: pointer;
        box-shadow: 0 8px 22px rgba(255, 34, 56, 0.35);
      }
      .afx-btn-main:active { transform: scale(.97); }
      .afx-btn-ghost {
        display: block; width: 100%; box-sizing: border-box; text-decoration: none;
        border-radius: 12px; padding: 11px 14px; background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12); color: #e2e8f0;
        font: inherit; font-size: 13.5px; font-weight: 700; cursor: pointer;
      }
    `;
    document.head.appendChild(st);
  }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m]));
  }

  function renderModalContents() {
    if (!modalEl || !lastModalOpts) return;
    const o = lastModalOpts;
    const d = I18N[getLang(o.lang)];
    const title = o.title || d.title;
    const scoreLbl = o.scoreLabel || d.score;
    const bestLbl = o.bestLabel || d.best;
    const againLbl = o.againLabel || d.again;
    const shareLbl = o.shareLabel || d.share || 'Share';
    const allLbl = o.allGamesLabel || d.all_games;
    const newRecLbl = o.newRecordLabel || d.new_record;
    const href = o.allGamesHref || '/games/';

    const statsHtml = Array.isArray(o.stats) && o.stats.length
      ? '<div class="afx-extra">' + o.stats.map(s => `<span class="afx-pill">${esc(s.label)}: <b>${esc(s.value)}</b></span>`).join('') + '</div>'
      : '';

    const showShare = o.share !== false;
    const shareBtnHtml = showShare
      ? `<button type="button" class="afx-btn-ghost afx-btn-share" id="afxShareBtn" style="display:flex;align-items:center;justify-content:center;gap:6px"><span>🔗</span> ${esc(shareLbl)}</button>`
      : '';

    modalEl.innerHTML = `
      <div class="afx-card" role="dialog" aria-modal="true">
        <h2 class="afx-title">${esc(title)}</h2>
        ${o.subtitle ? `<div class="afx-sub">${esc(o.subtitle)}</div>` : ''}
        ${o.isNewRecord ? `<div class="afx-badge" id="afxRecordBadge">${esc(newRecLbl)}</div>` : ''}
        <div class="afx-grid">
          <div class="afx-stat"><div class="l">${esc(scoreLbl)}</div><div class="v" id="afxScoreVal">${esc(o.score ?? 0)}</div></div>
          <div class="afx-stat"><div class="l">${esc(bestLbl)}</div><div class="v" id="afxBestVal">${esc(o.best ?? 0)}</div></div>
        </div>
        ${statsHtml}
        <div class="afx-actions">
          <button type="button" class="afx-btn-main" id="afxRestartBtn">${esc(againLbl)}</button>
          ${shareBtnHtml}
          <a class="afx-btn-ghost" href="${esc(href)}">${esc(allLbl)}</a>
        </div>
      </div>
    `;
    const btn = modalEl.querySelector('#afxRestartBtn');
    if (btn) {
      btn.onclick = () => {
        hideGameOver();
        if (typeof o.onRestart === 'function') o.onRestart();
      };
    }
    const shareBtn = modalEl.querySelector('#afxShareBtn');
    if (shareBtn) {
      shareBtn.onclick = () => {
        if (typeof o.onShare === 'function') {
          o.onShare();
        } else if (w.LobbyUI && w.LobbyUI.shareResult) {
          const s = typeof o.share === 'function' ? o.share() : (typeof o.share === 'object' && o.share !== null ? o.share : {});
          const statText = Array.isArray(o.stats) && o.stats.length ? (' · ' + o.stats.map(st => `${st.label}: ${st.value}`).join(' · ')) : '';
          const recLine = o.isNewRecord ? ('\n' + newRecLbl) : '';
          const defaultText = `${title}\n${scoreLbl}: ${o.score ?? 0}${statText}${recLine}`;
          w.LobbyUI.shareResult({
            title: s.title || document.title || 'Lobby.gg',
            text: s.text || defaultText,
            url: s.url || (w.location.origin + w.location.pathname)
          });
        }
      };
    }
  }

  function showGameOver(opts) {
    for (let i = 0; i < MAX_FLOATS; i++) fPool[i].active = false;
    ensureModalStyles();
    lastModalOpts = Object.assign({}, opts || {});
    if (!modalEl || !document.body.contains(modalEl)) {
      modalEl = document.createElement('div');
      modalEl.id = 'arcadeGameOverModal';
      modalEl.className = 'afx-modal';
      document.body.appendChild(modalEl);
    }
    renderModalContents();
    modalEl.classList.add('open');
    if (lastModalOpts.isNewRecord && !lastModalOpts.suppressConfetti) {
      confetti();
    }
  }

  function hideGameOver() {
    if (modalEl) modalEl.classList.remove('open');
  }

  function refreshI18n(lang) {
    if (lastModalOpts) {
      lastModalOpts.lang = lang || getLang();
      if (modalEl && modalEl.classList.contains('open')) {
        renderModalContents();
      }
    }
  }

  w.ArcadeFX = {
    I18N,
    reducedMotion,
    vibrate,
    burst,
    floatText,
    flash,
    shake,
    confetti,
    showGameOver,
    hideGameOver,
    refreshI18n
  };
})(window);
