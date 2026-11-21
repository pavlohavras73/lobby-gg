/* Lobby.gg — Design System v2 runtime helpers (ui.js)
   Provides: LobbyUI.esc, LobbyUI.vibrate, LobbyUI.sound, LobbyUI.toast,
   LobbyUI.confetti, LobbyUI.showScreen, LobbyUI.copyText */
(function (w) {
  'use strict';

  const reducedMotion = () =>
    w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function esc(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function isVibrationSupported() {
    try {
      return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !!(w.matchMedia && w.matchMedia('(pointer: coarse)').matches);
    } catch (e) {
      return false;
    }
  }

  function isVibrationEnabled() {
    if (!isVibrationSupported()) return false;
    try {
      if (reducedMotion()) return false;
      const v = localStorage.getItem('jg_vibrate');
      if (v === '0' || v === 'false') return false;
      if (localStorage.getItem('jarvis_haptics_off') === 'true') return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function toggleVibration() {
    if (!isVibrationSupported()) return false;
    const nextOn = !isVibrationEnabled();
    try {
      localStorage.setItem('jg_vibrate', nextOn ? '1' : '0');
      localStorage.setItem('jarvis_haptics_off', nextOn ? 'false' : 'true');
    } catch (e) {}
    try {
      window.dispatchEvent(new CustomEvent('lobbyvibechange', { detail: { enabled: nextOn } }));
    } catch (e) {}
    return nextOn;
  }

  function vibrate(pattern) {
    try {
      if (!isVibrationEnabled()) return;
      if (navigator.userActivation && !navigator.userActivation.hasBeenActive) return;
      if (navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern == null ? 10 : pattern);
      }
    } catch (e) {}
  }

  function sound(name) {
    try {
      if (w.sfx && typeof w.sfx[name] === 'function') w.sfx[name]();
    } catch (e) {}
  }

  let toastWrap = null;
  function getToastWrap() {
    if (toastWrap && document.body.contains(toastWrap)) return toastWrap;
    toastWrap = document.createElement('div');
    toastWrap.className = 'ui-toast-wrap';
    toastWrap.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastWrap);
    return toastWrap;
  }

  function toast(msg, type = '', ms = 2200) {
    if (!msg) return;
    const wrap = getToastWrap();
    const el = document.createElement('div');
    el.className = 'ui-toast' + (type ? ' ' + type : '');
    el.textContent = String(msg);
    wrap.appendChild(el);
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 220);
    }, ms);
  }

  function burstConfetti(opts) {
    if (reducedMotion()) return;
    if (typeof w.confetti !== 'function') return;
    try {
      w.confetti(Object.assign({
        particleCount: 90,
        spread: 76,
        origin: { y: 0.62 },
        colors: ['#ff2238', '#ffcc00', '#22c55e', '#3b82f6', '#ffffff']
      }, opts || {}));
    } catch (e) {}
  }

  function showScreen(ids, activeId) {
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      if (id === activeId) {
        if (el.classList.contains('hide')) {
          el.classList.remove('hide', 'screen-enter');
          void el.offsetWidth;
          el.classList.add('screen-enter');
        }
      } else {
        el.classList.add('hide');
        el.classList.remove('screen-enter');
      }
    }
  }

  async function copyText(text, okMsg) {
    if (!text) return false;
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement('textarea');
        ta.value = text;
        ta.style.cssText = 'position:fixed;opacity:0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      vibrate(12);
      sound('click');
      if (okMsg) toast(okMsg, 'ok', 1800);
      return true;
    } catch (e) {
      return false;
    }
  }

  // Subtle haptic on interactive taps when enabled
  document.addEventListener('pointerdown', (e) => {
    const t = e.target && e.target.closest ? e.target.closest('button, .btn, .opt, .game, .feat, .uno-card, .code-chip') : null;
    if (t && !t.disabled && !t.dataset.noHaptic) {
      vibrate(6);
    }
  }, { passive: true });

  const AV_GRADS = [
    'linear-gradient(135deg,#ff2238,#b9071a)',
    'linear-gradient(135deg,#8b5cf6,#5b21b6)',
    'linear-gradient(135deg,#0ea5e9,#1d4ed8)',
    'linear-gradient(135deg,#22c55e,#15803d)',
    'linear-gradient(135deg,#f59e0b,#b45309)',
    'linear-gradient(135deg,#ec4899,#9d174d)',
    'linear-gradient(135deg,#14b8a6,#0f766e)'
  ];

  function avatarBg(name) {
    const s = String(name || '?');
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    return AV_GRADS[Math.abs(h) % AV_GRADS.length];
  }

  function avatarHtml(name, isBot) {
    const clean = String(name || '?').replace(/^🤖\s*/, '').trim();
    const ch = isBot ? 'AI' : (clean[0] || '?').toUpperCase();
    const bg = isBot ? 'linear-gradient(135deg,#475569,#1e293b)' : avatarBg(clean);
    return `<span class="player-av" style="background:${bg}">${esc(ch)}</span>`;
  }

  function renderCodeDigits(code) {
    const s = String(code || '----').padEnd(4, '-').slice(0, 4);
    return s.split('').map(c => `<span class="pin-digit">${esc(c)}</span>`).join('');
  }

  function initPinInput(inputId, boxesId, onEnter) {
    const src = document.getElementById(inputId);
    const wrap = document.getElementById(boxesId);
    if (!src || !wrap) return;
    src.classList.add('pin-hidden-src');
    wrap.innerHTML = [0, 1, 2, 3].map(i =>
      `<input type="text" class="pin-box" maxlength="1" autocomplete="off" autocapitalize="characters" inputmode="text" aria-label="Code ${i + 1}" data-pin="${i}">`
    ).join('');
    const boxes = [...wrap.querySelectorAll('.pin-box')];

    const desc = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    const setRaw = (v) => { if (desc && desc.set) desc.set.call(src, v); else src.value = v; };
    const getRaw = () => (desc && desc.get) ? desc.get.call(src) : src.value;

    const syncFromSrc = () => {
      const val = (getRaw() || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
      setRaw(val);
      boxes.forEach((b, i) => {
        b.value = val[i] || '';
        b.classList.toggle('filled', !!val[i]);
      });
    };

    const syncToSrc = () => {
      setRaw(boxes.map(b => (b.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')).join('').slice(0, 4));
      boxes.forEach(b => b.classList.toggle('filled', !!b.value));
    };

    boxes.forEach((box, idx) => {
      box.addEventListener('input', () => {
        const v = box.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (v.length > 1) {
          v.slice(0, 4).split('').forEach((ch, j) => { if (boxes[j]) boxes[j].value = ch; });
          syncToSrc();
          const next = boxes[Math.min(3, v.length)];
          if (next) next.focus();
          return;
        }
        box.value = v;
        syncToSrc();
        if (v && idx < 3) boxes[idx + 1].focus();
      });
      box.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace' && !box.value && idx > 0) {
          boxes[idx - 1].focus();
          boxes[idx - 1].value = '';
          syncToSrc();
        } else if (e.key === 'Enter' && typeof onEnter === 'function') {
          onEnter();
        }
      });
      box.addEventListener('paste', (e) => {
        e.preventDefault();
        const txt = (e.clipboardData || window.clipboardData).getData('text') || '';
        const clean = txt.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 4);
        if (!clean) return;
        boxes.forEach((b, i) => { b.value = clean[i] || ''; });
        syncToSrc();
        boxes[Math.min(3, clean.length - 1)].focus();
      });
    });

    src.addEventListener('input', syncFromSrc);
    if (desc && desc.set && desc.get) {
      Object.defineProperty(src, 'value', {
        get() { return desc.get.call(this); },
        set(v) { desc.set.call(this, v); syncFromSrc(); }
      });
    }
    syncFromSrc();
  }

  function enableParallax(el, maxDeg = 8) {
    if (!el || reducedMotion()) return;
    let gyroBound = false;
    const applyTilt = (rx, ry) => {
      el.style.transform = `perspective(900px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg)`;
    };
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      const r = el.getBoundingClientRect();
      const nx = ((e.clientX - r.left) / r.width - 0.5) * 2;
      const ny = ((e.clientY - r.top) / r.height - 0.5) * 2;
      applyTilt(-ny * maxDeg, nx * maxDeg);
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });

    const bindGyro = () => {
      if (gyroBound) return;
      gyroBound = true;
      w.addEventListener('deviceorientation', (e) => {
        if (e.beta == null || e.gamma == null) return;
        const rx = Math.max(-maxDeg, Math.min(maxDeg, (e.beta - 40) * 0.22));
        const ry = Math.max(-maxDeg, Math.min(maxDeg, e.gamma * 0.25));
        applyTilt(-rx, ry);
      }, { passive: true });
    };

    if (typeof DeviceOrientationEvent !== 'undefined') {
      if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        el.addEventListener('click', () => {
          DeviceOrientationEvent.requestPermission().then(res => {
            if (res === 'granted') bindGyro();
          }).catch(() => {});
        }, { once: true });
      } else {
        bindGyro();
      }
    }
  }

  const MODAL_SEL = '.rules-modal-overlay, .inv-modal-overlay, .afx-modal, .gw-modal, .bk-modal, .map-modal, .modal-bg, .modal-overlay, .modal, #inviteModal, #rulesModal';
  const DISMISS_SEL = '.rules-modal-overlay, .inv-modal-overlay, #inviteModal, #rulesModal, .map-modal, [data-dismiss="backdrop"]';

  function isModalOpen(el) {
    if (!el || !document.body.contains(el)) return false;
    if (el.closest('.ui-toast-wrap, #dock, .dock, #rc-panel')) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden') return false;
    return el.classList.contains('open') || el.classList.contains('on') || s.display === 'flex' || s.display === 'block';
  }

  function getOpenModals() {
    const list = document.querySelectorAll(MODAL_SEL);
    const open = [];
    for (let i = 0; i < list.length; i++) {
      if (isModalOpen(list[i])) open.push(list[i]);
    }
    return open;
  }

  function closeModalEl(m) {
    if (!m) return;
    if (typeof m.__onDismiss === 'function') {
      const fn = m.__onDismiss;
      m.__onDismiss = null;
      try { fn(); } catch (e) {}
    }
    if (typeof m.close === 'function') {
      try { m.close(); } catch (e) {}
    }
    m.classList.remove('open', 'on');
    if (m.style.display && m.style.display !== 'none') {
      m.style.display = 'none';
    }
    if (m.__prevFocus && typeof m.__prevFocus.focus === 'function' && m.__prevFocus !== document.body) {
      try { m.__prevFocus.focus(); } catch (e) {}
      m.__prevFocus = null;
    } else {
      const rb = document.getElementById('rulesBtn');
      if (rb && typeof rb.focus === 'function') {
        try { rb.focus(); } catch (e) {}
      }
    }
    document.body.classList.toggle('modal-open', getOpenModals().length > 0);
  }

  document.addEventListener('click', (e) => {
    const open = getOpenModals();
    for (const m of open) {
      if (e.target === m) {
        if (m.matches(DISMISS_SEL)) closeModalEl(m);
        break;
      }
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    const open = getOpenModals();
    if (!open.length) return;
    const top = open[open.length - 1];
    if (e.key === 'Escape') {
      if (top.matches(DISMISS_SEL)) { e.preventDefault(); closeModalEl(top); }
      return;
    }
    if (e.key === 'Tab') {
      const focusables = [...top.querySelectorAll('button:not(:disabled), [href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])')];
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  function initModalObserver() {
    if (!document.body || typeof window === 'undefined' || !window.MutationObserver) return;
    const update = () => {
      try {
        if (!document.body) return;
        const open = getOpenModals();
        document.body.classList.toggle('modal-open', open.length > 0);
        for (const m of open) {
          if (!m.__trapInit) {
            m.__trapInit = true;
            if (!m.getAttribute('role')) m.setAttribute('role', 'dialog');
            if (!m.getAttribute('aria-modal')) m.setAttribute('aria-modal', 'true');
            if (!m.getAttribute('aria-label') && !m.getAttribute('aria-labelledby')) {
              const h = m.querySelector('h1, h2, h3, .rules-modal-title, .modal-title, [data-i18n*="title"]');
              if (h) {
                if (!h.id) h.id = 'mh_' + Math.random().toString(36).slice(2, 7);
                m.setAttribute('aria-labelledby', h.id);
              } else {
                m.setAttribute('aria-label', 'Dialog');
              }
            }
            m.__prevFocus = (document.activeElement && document.activeElement !== document.body ? document.activeElement : (document.getElementById("rulesBtn") || document.activeElement));
            const target = m.querySelector('button:not(:disabled), [href], input:not(:disabled), [tabindex]:not([tabindex="-1"])');
            if (target) {
              try { target.focus(); } catch (e) {}
            }
          }
        }
        document.querySelectorAll(MODAL_SEL).forEach(m => {
          if (!isModalOpen(m)) {
            m.__trapInit = false;
          }
        });
      } catch (err) {}
    };
    window._obsTarget = document.body;
    window._modalObserver = new MutationObserver(update);
    window._modalObserver.observe(document.body, { attributes: true, subtree: true, childList: true });
    update();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initModalObserver);
  } else {
    initModalObserver();
  }

  const A11Y_I18N = {
    uk: { rules: 'Правила', back: 'Назад', close: 'Закрити', chat: 'Чат', invite: 'Покликати', sound: 'Звук', zoom_in: 'Збільшити', zoom_out: 'Зменшити' },
    ru: { rules: 'Правила', back: 'Назад', close: 'Закрыть', chat: 'Чат', invite: 'Позвать', sound: 'Звук', zoom_in: 'Приблизить', zoom_out: 'Отдалить' },
    en: { rules: 'Rules', back: 'Back', close: 'Close', chat: 'Chat', invite: 'Invite', sound: 'Sound', zoom_in: 'Zoom in', zoom_out: 'Zoom out' },
    de: { rules: 'Regeln', back: 'Zurück', close: 'Schließen', chat: 'Chat', invite: 'Einladen', sound: 'Ton', zoom_in: 'Vergrößern', zoom_out: 'Verkleinern' }
  };

  function syncA11yLabels() {
    const lang = (w.LobbyI18n && typeof w.LobbyI18n.lang === 'function' ? w.LobbyI18n.lang() : (localStorage.getItem('jg_lang') || 'ru'));
    const tr = A11Y_I18N[lang] || A11Y_I18N.ru;
    document.querySelectorAll('#rulesBtn, .top-icon-btn').forEach(b => {
      const cur = b.getAttribute('aria-label');
      if (!cur || cur === 'Info' || cur === 'Правила' || cur === 'Rules' || cur === 'Regeln') {
        b.setAttribute('aria-label', tr.rules);
      }
    });
    document.querySelectorAll('.top-back').forEach(b => {
      if (!b.getAttribute('aria-label')) b.setAttribute('aria-label', tr.back);
    });
    document.querySelectorAll('[data-i18n-title]').forEach(el => {
      if (el.title) el.setAttribute('aria-label', el.title);
    });
    document.querySelectorAll('button, a, [role="button"]').forEach(b => {
      if (!b.getAttribute('aria-label') && b.title) {
        b.setAttribute('aria-label', b.title);
      }
    });
  }

  document.addEventListener('DOMContentLoaded', syncA11yLabels);
  document.addEventListener('click', (e) => {
    if (e.target && e.target.closest && e.target.closest('#langbar, .langbar')) {
      setTimeout(syncA11yLabels, 30);
    }
  });

  try {
    const _p = (w.location.pathname || '').replace(/\/$/, '');
    const _m = _p.match(/\/games\/([a-z0-9_]+)$/i);
    if (_m && _m[1]) {
      const _slug = _m[1].toLowerCase();
      if (!['index', 'admin', 'login', 'leaderboard', 'learn', 'profile', 'static', 'api'].includes(_slug)) {
        let _rec = [];
        try { _rec = JSON.parse(localStorage.getItem('jg_recent') || '[]'); } catch (e) { _rec = []; }
        if (!Array.isArray(_rec)) _rec = [];
        _rec = _rec.filter(x => x && x !== _slug);
        _rec.unshift(_slug);
        if (_rec.length > 4) _rec = _rec.slice(0, 4);
        localStorage.setItem('jg_recent', JSON.stringify(_rec));
      }
    }
  } catch (e) {}

  const RULES_CACHE = {};
  const rulesLoadingPromises = {};

  function loadGameRules(k) {
    if (!k) return Promise.resolve(null);
    k = k.toLowerCase();
    if (RULES_CACHE[k]) return Promise.resolve(RULES_CACHE[k]);
    if (w.LOBBY_RULES && w.LOBBY_RULES[k]) return Promise.resolve(RULES_CACHE[k] = w.LOBBY_RULES[k]);
    if (rulesLoadingPromises[k]) return rulesLoadingPromises[k];
    return rulesLoadingPromises[k] = new Promise((resolve) => {
      const s = document.createElement("script");
      s.src = "/games/static/rules/" + encodeURIComponent(k) + ".js";
      s.async = true;
      s.onload = () => { s.remove(); resolve(RULES_CACHE[k] = (w.LOBBY_RULES && w.LOBBY_RULES[k]) || null); };
      s.onerror = () => { s.remove(); resolve(null); };
      document.head.appendChild(s);
    });
  }

  const RULES_UI_STRINGS = {
    uk: { back: '← Назад', next: 'Далі →', done: 'Зрозуміло 👍', more: '📖 Докладніше', close: 'Закрити', step_of: (c, t) => `${c} з ${t}` },
    ru: { back: '← Назад', next: 'Дальше →', done: 'Понятно 👍', more: '📖 Подробнее', close: 'Закрыть', step_of: (c, t) => `${c} из ${t}` },
    en: { back: '← Back', next: 'Next →', done: 'Got it 👍', more: '📖 Details', close: 'Close', step_of: (c, t) => `${c} of ${t}` },
    de: { back: '← Zurück', next: 'Weiter →', done: 'Verstanden 👍', more: '📖 Details', close: 'Schließen', step_of: (c, t) => `${c} von ${t}` }
  };

  function getCurGameKey() {
    try {
      const p = (w.location.pathname || '').replace(/\/$/, '');
      const m = p.match(/(?:\/games|\/static)?\/([a-z0-9_]+)(?:\.html)?$/i);
      return m ? m[1].toLowerCase() : '';
    } catch (e) {
      return '';
    }
  }

  function getActiveLang() {
    if (w.LobbyI18n && typeof w.LobbyI18n.lang === 'function') {
      try { return w.LobbyI18n.lang(); } catch (e) {}
    }
    try {
      return localStorage.getItem('jg_lang') || 'ru';
    } catch (e) {
      return 'ru';
    }
  }

  function ensureRulesModal(gameKey, opts, title, innerBodyHtml) {
    if (opts.isAuto && _userInteracted) return null;
    const lang = getActiveLang();
    const uiTr = RULES_UI_STRINGS[lang] || RULES_UI_STRINGS.ru;
    let modal = document.getElementById("rulesModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "rulesModal";
      document.body.appendChild(modal);
    }
    modal.className = "rules-modal-overlay modal";
    modal.setAttribute("data-dismiss", "backdrop");
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "rulesModalTitle");
    modal.innerHTML = `<div class="rules-modal-box" role="document">
      <header class="rules-head">
        <h3 id="rulesModalTitle" class="rules-title">${esc(title)}</h3>
        <button type="button" class="rules-close" aria-label="${esc(uiTr.close)}" data-dismiss="backdrop">✕</button>
      </header>
      ${innerBodyHtml}
    </div>`;

    const dismiss = () => {
      try { localStorage.setItem("jg_rules_seen_" + gameKey, "1"); } catch (e) {}
      closeModalEl(modal);
    };
    const cBtn = modal.querySelector(".rules-close");
    if (cBtn) cBtn.onclick = dismiss;
    modal.__onDismiss = () => {
      try { localStorage.setItem("jg_rules_seen_" + gameKey, "1"); } catch (e) {}
    };
    modal.__prevFocus = (document.activeElement && document.activeElement !== document.body ? document.activeElement : (document.getElementById("rulesBtn") || document.activeElement));
    modal.__isAuto = !!opts.isAuto;
    modal.classList.toggle("auto-mode", !!opts.isAuto);
    modal.classList.add("open");
    modal.style.display = "flex";
    document.body.classList.add("modal-open");
    return modal;
  }

  function renderFallbackRules(gameKey, opts = {}) {
    const lang = getActiveLang();
    const uiTr = RULES_UI_STRINGS[lang] || RULES_UI_STRINGS.ru;
    const dict = (w.UI && (w.UI[lang] || w.UI.ru || w.UI.en)) || {};
    const title = dict.rules_title || dict.title || document.querySelector('[data-i18n="rules_title"]')?.textContent || "Правила";
    const body = dict.rules_body || dict.rules || document.querySelector('[data-i18n="rules_body"]')?.innerHTML || "";
    const modal = ensureRulesModal(gameKey, opts, title, `
      <div style="font-size:14px;line-height:1.6;color:#d8d8de;margin:14px 0 20px">${body}</div>
      <button type="button" class="rules-btn-next" id="rulesFallbackOk" style="width:100%">${esc(uiTr.done)}</button>
    `);
    if (!modal) return null;
    const ok = modal.querySelector("#rulesFallbackOk");
    if (ok) ok.onclick = () => closeModalEl(modal);
    return modal;
  }

  function renderRulesModal(cfg, gameKey, opts = {}) {
    const lang = getActiveLang();
    const uiTr = RULES_UI_STRINGS[lang] || RULES_UI_STRINGS.ru;
    const title = (cfg.title && (typeof cfg.title === "object" ? (cfg.title[lang] || cfg.title.ru || cfg.title.en) : cfg.title)) || uiTr.title || "Правила игры";
    const rawSteps = (cfg.steps && typeof cfg.steps === "object" && !Array.isArray(cfg.steps)) ? (cfg.steps[lang] || cfg.steps.ru || cfg.steps.en || []) : (cfg.steps || []);
    const fullRules = (cfg.full && typeof cfg.full === "object") ? (cfg.full[lang] || cfg.full.ru || cfg.full.en) : (cfg.full || cfg.fullRules || "");
    const totalSteps = Math.max(1, rawSteps.length);

    let slidesHtml = "";
    let dotsHtml = "";
    for (let i = 0; i < totalSteps; i++) {
      const st = rawSteps[i] || { icon: "🎯", title: "", desc: "" };
      const visHtml = st.svg || `<span style="font-size:36px;display:flex;align-items:center;justify-content:center">${st.icon || "🎯"}</span>`;
      slidesHtml += `<div class="rules-slide" role="group" aria-roledescription="slide" aria-label="${uiTr.step_of(i + 1, totalSteps)}" data-index="${i}">
        <div class="rules-visual" aria-hidden="true">${visHtml}</div>
        <h4 class="rules-slide-h">${esc(st.title || "")}</h4>
        <p class="rules-slide-p">${esc(st.desc || "")}</p>
      </div>`;
      dotsHtml += `<button type="button" class="rules-dot" data-step="${i}" aria-label="${uiTr.step_of(i + 1, totalSteps)}" ${i === 0 ? "aria-current=\"true\"" : ""}></button>`;
    }

    const fullAccordionHtml = fullRules ? `<details class="rules-details">
      <summary class="rules-summary"><span>${uiTr.more}</span><span aria-hidden="true" style="font-size:11px;opacity:0.7">▼</span></summary>
      <div class="rules-full-body">${fullRules}</div>
    </details>` : "";

    const carouselHtml = `<div class="rules-carousel" role="region" aria-roledescription="carousel" aria-label="${esc(title)}">
      <div class="rules-track" tabindex="0" role="group" aria-label="${esc(title)}">${slidesHtml}</div>
      <nav class="rules-dots" aria-label="Слайды">${dotsHtml}</nav>
      <div class="rules-nav">
        <button type="button" class="rules-btn-prev btn-sec" style="opacity:0.35" disabled>${uiTr.back}</button>
        <button type="button" class="rules-btn-next btn-prim">${totalSteps === 1 ? uiTr.done : uiTr.next}</button>
      </div>
    </div>${fullAccordionHtml}`;

    const modal = ensureRulesModal(gameKey, opts, title, carouselHtml);
    if (!modal) return null;

    const track = modal.querySelector(".rules-track");
    const dots = modal.querySelectorAll(".rules-dot");
    const prevBtn = modal.querySelector(".rules-btn-prev");
    const nextBtn = modal.querySelector(".rules-btn-next");
    let curIdx = 0;

    function syncState(idx) {
      curIdx = Math.max(0, Math.min(totalSteps - 1, idx));
      dots.forEach((d, i) => i === curIdx ? d.setAttribute("aria-current", "true") : d.removeAttribute("aria-current"));
      prevBtn.disabled = curIdx === 0;
      prevBtn.style.opacity = curIdx === 0 ? "0.35" : "1";
      nextBtn.textContent = curIdx === totalSteps - 1 ? uiTr.done : uiTr.next;
    }

    let isScrollingTo = -1;
    function scrollToIdx(idx) {
      if (!track) return;
      isScrollingTo = idx;
      syncState(idx);
      track.scrollTo({ left: idx * (track.offsetWidth || 1), behavior: "smooth" });
    }

    prevBtn.onclick = (e) => { e.stopPropagation(); if (curIdx > 0) scrollToIdx(curIdx - 1); };
    nextBtn.onclick = (e) => {
      e.stopPropagation();
      if (curIdx < totalSteps - 1) scrollToIdx(curIdx + 1);
      else closeModalEl(modal);
    };
    dots.forEach(d => {
      d.onclick = (e) => { e.stopPropagation(); scrollToIdx(parseInt(d.getAttribute("data-step") || "0", 10)); };
    });

    let scrollTimer = null;
    track.addEventListener("scroll", () => {
      if (scrollTimer) cancelAnimationFrame(scrollTimer);
      scrollTimer = requestAnimationFrame(() => {
        const w = track.offsetWidth || 1;
        const s = Math.round(track.scrollLeft / w);
        if (isScrollingTo >= 0) {
          if (s === isScrollingTo) isScrollingTo = -1;
          return;
        }
        syncState(s);
      });
    }, { passive: true });

    track.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" && curIdx < totalSteps - 1) { e.preventDefault(); scrollToIdx(curIdx + 1); }
      else if (e.key === "ArrowLeft" && curIdx > 0) { e.preventDefault(); scrollToIdx(curIdx - 1); }
    });

    syncState(0);
    setTimeout(() => { try { nextBtn.focus(); } catch (e) {} }, 60);
    return modal;
  }

  function showRules(arg, opts = {}) {
    let gameKey = "";
    let directCfg = null;
    if (typeof arg === "string") gameKey = arg.toLowerCase();
    else if (Array.isArray(arg)) { gameKey = getCurGameKey() || "game"; directCfg = { steps: arg }; }
    else if (typeof arg === "object" && arg !== null) {
      if (arg.steps) { directCfg = arg; gameKey = (arg.game || getCurGameKey() || "game").toLowerCase(); }
      else gameKey = (arg.game || getCurGameKey() || "game").toLowerCase();
    } else gameKey = getCurGameKey() || "game";

    if (!opts.isAuto && gameKey) { try { localStorage.setItem("jg_rules_seen_" + gameKey, "1"); } catch (e) {} }
    if (directCfg) return renderRulesModal(directCfg, gameKey, opts);
    const cached = RULES_CACHE[gameKey] || (w.LOBBY_RULES && w.LOBBY_RULES[gameKey]);
    if (cached) return renderRulesModal(cached, gameKey, opts);

    loadGameRules(gameKey).then(data => {
      if (data) renderRulesModal(data, gameKey, opts);
      else renderFallbackRules(gameKey, opts);
    }).catch(() => renderFallbackRules(gameKey, opts));
    return null;
  }

  let _userInteracted = false;
  try {
    ["pointerdown", "mousedown", "touchstart", "keydown", "input", "focus"].forEach(ev => {
      document.addEventListener(ev, (e) => {
        const modal = document.getElementById("rulesModal");
        if (modal && modal.__isAuto && isModalOpen(modal)) {
          const box = modal.querySelector(".rules-modal-box");
          if (!box || !box.contains(e.target)) closeModalEl(modal);
        }
        _userInteracted = true;
      }, { capture: true, passive: true });
    });
  } catch (e) {}

  const KNOWN_RULES_GAMES = new Set([
    "bunker", "mafia", "spy", "alias", "variants", "guesswho", "poker", "geostake", "raskol", "space_invaders",
    "uno", "durak", "chess", "checkers", "battleship", "reversi", "dots", "bulls", "quoridor", "connect4_3d", "race", "geobunker"
  ]);

  function checkAutoRules(gameKey) {
    if (!gameKey) gameKey = getCurGameKey();
    if (!gameKey || !KNOWN_RULES_GAMES.has(gameKey)) return;
    const seenKey = "jg_rules_seen_" + gameKey;
    try {
      if (localStorage.getItem(seenKey)) return;
      if (w.location.search && /[?&](code|join)=/i.test(w.location.search)) return;
      setTimeout(() => {
        if (localStorage.getItem(seenKey) || _userInteracted) return;
        const curM = document.getElementById("rulesModal");
        if (curM && isModalOpen(curM)) return;
        if (document.activeElement && (document.activeElement.tagName === "INPUT" || document.activeElement.tagName === "TEXTAREA")) return;
        const lc = document.getElementById("lcode") || document.getElementById("roomcode") || document.getElementById("roomCode");
        if (lc && lc.textContent.trim().length >= 4) return;
        showRules(gameKey, { isAuto: true });
      }, 800);
    } catch (e) {}
  }

  function autoInitRules() {
    const game = getCurGameKey();
    if (!game) return;
    const btn = document.getElementById("rulesBtn");
    if (btn && (KNOWN_RULES_GAMES.has(game) || document.querySelector('[data-i18n="rules_body"]'))) {
      btn.onclick = (e) => {
        e.preventDefault();
        showRules(game);
      };
    }
    checkAutoRules(game);
  }

  const RESULTS_I18N = {
    ru: {
      victory: "Победа!",
      defeat: "Поражение",
      draw: "Ничья",
      game_over: "Игра окончена",
      rematch: "Реванш",
      again: "Ещё раз",
      to_lobby: "В лобби",
      you: "Вы",
      winner_badge: "Победитель"
    },
    uk: {
      victory: "Перемога!",
      defeat: "Поразка",
      draw: "Нічия",
      game_over: "Гру завершено",
      rematch: "Реванш",
      again: "Ще раз",
      to_lobby: "В лобі",
      you: "Ви",
      winner_badge: "Переможець"
    },
    en: {
      victory: "Victory!",
      defeat: "Defeat",
      draw: "Draw",
      game_over: "Game Over",
      rematch: "Rematch",
      again: "Again",
      to_lobby: "To Lobby",
      you: "You",
      winner_badge: "Winner"
    },
    de: {
      victory: "Sieg!",
      defeat: "Niederlage",
      draw: "Unentschieden",
      game_over: "Spiel vorbei",
      rematch: "Revanche",
      again: "Nochmal",
      to_lobby: "Zur Lobby",
      you: "Du",
      winner_badge: "Gewinner"
    }
  };

  const SHARE_I18N = {
    ru: { copied: "Скопировано в буфер!", share: "Поделиться" },
    uk: { copied: "Скопійовано в буфер!", share: "Поділитися" },
    en: { copied: "Copied to clipboard!", share: "Share" },
    de: { copied: "In die Zwischenablage kopiert!", share: "Teilen" }
  };

  async function shareResult(opts) {
    if (!opts) return false;
    const lang = getActiveLang();
    const tr = SHARE_I18N[lang] || SHARE_I18N.ru;
    const shareTitle = opts.title || document.title;
    const shareText = opts.text || "";
    const shareUrl = opts.url || (window.location.origin + window.location.pathname);
    const fullText = shareText ? (shareUrl ? `${shareText}\n${shareUrl}` : shareText) : shareUrl;

    if (navigator.share) {
      try {
        await navigator.share({
          title: shareTitle,
          text: shareText,
          url: shareUrl
        });
        vibrate(12);
        sound("click");
        return true;
      } catch (err) {
        if (err && (err.name === "AbortError" || String(err).includes("abort"))) {
          return false;
        }
      }
    }
    const okMsg = opts.copiedMsg || tr.copied;
    return await copyText(fullText, okMsg);
  }

  function showResults(opts) {
    if (!opts) return;
    const lang = getActiveLang();
    const tr = RESULTS_I18N[lang] || RESULTS_I18N.ru;

    let modal = document.getElementById("lobbyResultsModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lobbyResultsModal";
      modal.className = "lobby-results-overlay";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "lobbyResultsTitle");
      document.body.appendChild(modal);
    }

    const places = Array.isArray(opts.places) ? opts.places : [];
    const myId = opts.me != null ? String(opts.me) : null;

    const isFirstPlaceWinner = places.length > 0 && (
      places[0].isMe ||
      (myId && (String(places[0].id) === myId || String(places[0].name) === myId)) ||
      places[0].isWinner
    );
    const isMeWinner = opts.isWinner !== undefined
      ? Boolean(opts.isWinner)
      : (places.some(p => (p.isMe || (myId && (String(p.id) === myId || String(p.name) === myId))) && (p.isWinner || p.place === 1)) || isFirstPlaceWinner);

    const isDraw = Boolean(opts.isDraw || opts.draw);

    let defaultTitle = isDraw ? tr.draw : (isMeWinner ? tr.victory : tr.game_over);
    let titleText = opts.title || defaultTitle;
    let subtitleText = opts.subtitle || "";
    let iconChar = opts.icon || (isDraw ? "🤝" : (isMeWinner ? "🏆" : (places.length ? "🏁" : "🎮")));

    const medals = ["🥇", "🥈", "🥉"];

    let itemsHtml = places.map((p, idx) => {
      const placeNum = p.place || (idx + 1);
      const medal = p.medal || (placeNum <= 3 ? medals[placeNum - 1] : (placeNum + "."));
      const isMe = Boolean(p.isMe || (myId && (String(p.id) === myId || String(p.name) === myId)));
      const name = p.name || tr.you;
      const isBot = Boolean(p.bot || String(p.id || "").startsWith("bot_") || name.includes("Bot") || name.includes("Бот"));
      const avHtml = p.avatar ? p.avatar : avatarHtml(name, isBot);
      const scoreStr = p.score != null ? esc(String(p.score)) : (p.isWinner ? tr.winner_badge : "");
      const detailStr = p.detail ? `<span class="lobby-results-detail">${esc(String(p.detail))}</span>` : "";
      const meBadge = isMe ? `<span class="lobby-results-badge-me">${esc(tr.you)}</span>` : "";

      return `<div class="lobby-results-item place-${placeNum}${isMe ? " is-me" : ""}" role="listitem">
        <span class="lobby-results-medal" aria-hidden="true">${medal}</span>
        <span class="lobby-results-avatar">${avHtml}</span>
        <div class="lobby-results-info">
          <span class="lobby-results-name">${esc(name)}${meBadge}</span>
          ${detailStr}
        </div>
        ${scoreStr ? `<span class="lobby-results-score">${scoreStr}</span>` : ""}
      </div>`;
    }).join("");

    const rematchLabel = opts.rematchText || ((opts.again || opts.isAgain) ? tr.again : tr.rematch);
    const rematchBtnHtml = opts.onRematch
      ? `<button type="button" class="lobby-results-rematch" id="lobbyResultsRematchBtn">${esc(rematchLabel)}</button>`
      : "";
    const showLobby = opts.onLobby !== false;
    const lobbyBtnHtml = showLobby
      ? `<button type="button" class="lobby-results-lobby" id="lobbyResultsLobbyBtn">${esc(opts.lobbyText || tr.to_lobby)}</button>`
      : "";

    modal.innerHTML = `
      <div class="lobby-results-box">
        <div class="lobby-results-header">
          <div class="lobby-results-icon" aria-hidden="true">${iconChar}</div>
          <h2 id="lobbyResultsTitle" class="lobby-results-title">${esc(titleText)}</h2>
          ${subtitleText ? `<p id="lobbyResultsSubtitle" class="lobby-results-subtitle">${esc(subtitleText)}</p>` : ""}
        </div>
        <div class="lobby-results-list" role="list">
          ${itemsHtml}
        </div>
        <div class="lobby-results-actions">
          ${rematchBtnHtml}
          ${lobbyBtnHtml}
        </div>
      </div>
    `;

    modal.classList.add("open");
    document.body.classList.add("modal-open");

    if (isMeWinner && !isDraw) {
      burstConfetti({ particleCount: 110, spread: 85 });
      sound("win");
      vibrate([20, 40, 30]);
    } else {
      sound("lose");
    }

    if (opts.onRematch) {
      const rBtn = document.getElementById("lobbyResultsRematchBtn");
      if (rBtn) {
        rBtn.onclick = (e) => {
          e.preventDefault();
          sound("click");
          vibrate(10);
          closeResults();
          try { opts.onRematch(); } catch (err) {}
        };
        rBtn.focus();
      }
    }
    if (showLobby) {
      const lBtn = document.getElementById("lobbyResultsLobbyBtn");
      if (lBtn) {
        lBtn.onclick = (e) => {
          e.preventDefault();
          sound("click");
          vibrate(10);
          closeResults();
          if (typeof opts.onLobby === "function") {
            try { opts.onLobby(); } catch (err) {}
          } else {
            if (window.history.length > 1) window.history.back();
            else window.location.href = "/games/";
          }
        };
        if (!opts.onRematch) lBtn.focus();
      }
    }
  }

  function closeResults() {
    const modal = document.getElementById("lobbyResultsModal");
    if (modal) {
      modal.classList.remove("open");
    }
    document.body.classList.remove("modal-open");
  }

  const ROOM_ERROR_I18N = {
    ru: {
      room_not_found: {
        icon: "🔍",
        title: "Комната не найдена",
        desc: "Проверь 4-значный код комнаты или создай новую игру."
      },
      room_full: {
        icon: "🚪",
        title: "Комната заполнена",
        desc: "В этой комнате уже заняты все свободные места."
      },
      already_playing: {
        icon: "⏳",
        title: "Партия уже идёт",
        desc: "Игра началась без тебя. Дождись окончания или начни новую."
      },
      kicked: {
        icon: "🚫",
        title: "Исключён из комнаты",
        desc: "Ведущий исключил тебя из этой игровой комнаты."
      },
      server_unavailable: {
        icon: "📡",
        title: "Сервер недоступен",
        desc: "Не удалось подключиться к серверу. Попробуй позже."
      },
      timeout_disconnect: {
        icon: "🔌",
        title: "Связь потеряна",
        desc: "Соединение разорвано более чем на 30 секунд."
      },
      generic_error: {
        icon: "⚠️",
        title: "Ошибка входа",
        desc: "Не удалось войти в комнату. Попробуй ещё раз."
      },
      retry: "Попробовать снова",
      to_home: "На главную"
    },
    uk: {
      room_not_found: {
        icon: "🔍",
        title: "Кімнату не знайдено",
        desc: "Перевір 4-значний код кімнати або створи нову гру."
      },
      room_full: {
        icon: "🚪",
        title: "Кімната заповнена",
        desc: "У цій кімнаті вже зайняті всі вільні місця."
      },
      already_playing: {
        icon: "⏳",
        title: "Партія вже триває",
        desc: "Гра розпочалася без тебе. Дочекайся завершення або почни нову."
      },
      kicked: {
        icon: "🚫",
        title: "Виключено з кімнати",
        desc: "Ведучий виключив тебе з цієї ігрової кімнати."
      },
      server_unavailable: {
        icon: "📡",
        title: "Сервер недоступний",
        desc: "Не вдалося підключитися до сервера. Спробуй пізніше."
      },
      timeout_disconnect: {
        icon: "🔌",
        title: "Зв'язок втрачено",
        desc: "З'єднання розірвано більш ніж на 30 секунд."
      },
      generic_error: {
        icon: "⚠️",
        title: "Помилка входу",
        desc: "Не вдалося увійти до кімнати. Спробуй ще раз."
      },
      retry: "Спробувати знову",
      to_home: "На головну"
    },
    en: {
      room_not_found: {
        icon: "🔍",
        title: "Room Not Found",
        desc: "Check the 4-letter room code or create a new game."
      },
      room_full: {
        icon: "🚪",
        title: "Room Is Full",
        desc: "All player spots in this room are currently taken."
      },
      already_playing: {
        icon: "⏳",
        title: "Game in Progress",
        desc: "The game has already started without you."
      },
      kicked: {
        icon: "🚫",
        title: "Removed from Room",
        desc: "The host has removed you from this game room."
      },
      server_unavailable: {
        icon: "📡",
        title: "Server Unavailable",
        desc: "Could not connect to the server. Please try again later."
      },
      timeout_disconnect: {
        icon: "🔌",
        title: "Connection Lost",
        desc: "Disconnected from the game server for more than 30 seconds."
      },
      generic_error: {
        icon: "⚠️",
        title: "Join Error",
        desc: "Could not join the game room. Please try again."
      },
      retry: "Try Again",
      to_home: "Home"
    },
    de: {
      room_not_found: {
        icon: "🔍",
        title: "Raum nicht gefunden",
        desc: "Überprüfe den 4-stelligen Raumcode oder erstelle ein neues Spiel."
      },
      room_full: {
        icon: "🚪",
        title: "Raum ist voll",
        desc: "Alle Plätze in diesem Raum sind bereits belegt."
      },
      already_playing: {
        icon: "⏳",
        title: "Spiel läuft bereits",
        desc: "Die Runde hat bereits begonnen. Warte auf das Ende oder starte neu."
      },
      kicked: {
        icon: "🚫",
        title: "Aus dem Raum entfernt",
        desc: "Der Spielleiter hat dich aus diesem Raum entfernt."
      },
      server_unavailable: {
        icon: "📡",
        title: "Server nicht erreichbar",
        desc: "Verbindung zum Server fehlgeschlagen. Bitte später versuchen."
      },
      timeout_disconnect: {
        icon: "🔌",
        title: "Verbindung verloren",
        desc: "Verbindung zum Server seit mehr als 30 Sekunden getrennt."
      },
      generic_error: {
        icon: "⚠️",
        title: "Beitrittsfehler",
        desc: "Konnte dem Raum nicht beitreten. Bitte erneut versuchen."
      },
      retry: "Erneut versuchen",
      to_home: "Zur Startseite"
    }
  };

  function detectErrorKey(str) {
    if (!str) return "generic_error";
    if (typeof str === "object") {
      if (str.type) return detectErrorKey(str.type);
      if (str.msg) return detectErrorKey(str.msg);
    }
    const s = String(str).toLowerCase();
    if (s === "room_not_found" || s.includes("не найден") || s.includes("не знайдено") || s.includes("не знайдена") || s.includes("not found") || s.includes("nicht gefunden")) return "room_not_found";
    if (s === "room_full" || s.includes("заполнен") || s.includes("заповнен") || s.includes("full") || s.includes("voll")) return "room_full";
    if (s === "already_playing" || s.includes("идёт") || s.includes("триває") || s.includes("progress") || s.includes("started") || s.includes("läuft")) return "already_playing";
    if (s === "kicked" || s.includes("исключ") || s.includes("виключ") || s.includes("kicked") || s.includes("removed") || s.includes("entfernt")) return "kicked";
    if (s === "server_unavailable" || s.includes("недоступ") || s.includes("unavailable") || s.includes("nicht erreichbar")) return "server_unavailable";
    if (s === "timeout_disconnect" || s.includes("разрыв") || s.includes("втрачено") || s.includes("lost") || s.includes("disconnect") || s.includes("getrennt") || s.includes("30")) return "timeout_disconnect";
    return "generic_error";
  }

  function item_fallback_text(dict) {
    const g = dict.generic_error || {};
    return g.title || g.desc || "";
  }

  function showRoomError(typeOrMsg, opts = {}) {
    const lang = getActiveLang();
    const dict = ROOM_ERROR_I18N[lang] || ROOM_ERROR_I18N.ru;
    const key = detectErrorKey(typeOrMsg);
    // Окно — только для ошибок входа/связи. Обычные ответы сервера («Нужно минимум 3 игрока…»,
    // «Не твой ход») показываем коротким тостом с исходным текстом, без «На главную».
    if (key === "generic_error" && !opts.force) {
      const raw = typeof typeOrMsg === "string" ? typeOrMsg : (typeOrMsg && typeOrMsg.msg) || "";
      toast(raw || item_fallback_text(dict), "err", 3200);
      return null;
    }
    const item = dict[key] || dict.generic_error;

    const icon = opts.icon || item.icon;
    const title = opts.title || item.title;
    const desc = opts.desc || item.desc;
    const retryText = opts.retryText || dict.retry;
    const homeText = opts.homeText || dict.to_home;

    if (key === "room_not_found" && w.LobbyRejoin && typeof w.LobbyRejoin.clear === "function") {
      const curGame = (w.location.pathname.split("/").filter(Boolean).pop() || "").toLowerCase();
      if (curGame) w.LobbyRejoin.clear(curGame);
    }

    let modal = document.getElementById("lobbyRoomErrorModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "lobbyRoomErrorModal";
      modal.className = "lobby-room-error-overlay";
      modal.setAttribute("role", "dialog");
      modal.setAttribute("aria-modal", "true");
      modal.setAttribute("aria-labelledby", "lobbyRoomErrorTitle");
      document.body.appendChild(modal);
    }

    const homeHref = (w.location.pathname.startsWith("/games") ? "/games/" : "/");

    modal.innerHTML = `
      <div class="lobby-room-error-box">
        <div class="lobby-room-error-icon" aria-hidden="true">${icon}</div>
        <h2 id="lobbyRoomErrorTitle" class="lobby-room-error-title">${esc(title)}</h2>
        <p id="lobbyRoomErrorDesc" class="lobby-room-error-desc">${esc(desc)}</p>
        <div class="lobby-room-error-actions">
          <button type="button" class="lobby-room-error-retry" id="lobbyRoomErrorRetryBtn">${esc(retryText)}</button>
          <a class="lobby-room-error-home" id="lobbyRoomErrorHomeBtn" href="${homeHref}">${esc(homeText)}</a>
        </div>
      </div>
    `;

    modal.classList.add("open");
    document.body.classList.add("modal-open");
    sound("lose");
    vibrate(25);

    const retryBtn = document.getElementById("lobbyRoomErrorRetryBtn");
    if (retryBtn) {
      retryBtn.onclick = (e) => {
        e.preventDefault();
        sound("click");
        vibrate(10);
        closeRoomError();
        if (typeof opts.onRetry === "function") {
          opts.onRetry();
        } else {
          const params = new URLSearchParams(w.location.search);
          if (params.has("code") || params.has("join")) {
            params.delete("code");
            params.delete("join");
            const newSearch = params.toString() ? ("?" + params.toString()) : "";
            w.history.replaceState({}, "", w.location.pathname + newSearch);
          }
          const inp = document.getElementById("joincode") || document.querySelector("input:not([type=hidden])");
          if (inp) {
            inp.value = "";
            inp.focus();
          } else {
            w.location.reload();
          }
        }
      };
      retryBtn.focus();
    }
  }

  function closeRoomError() {
    const modal = document.getElementById("lobbyRoomErrorModal");
    if (modal) {
      modal.classList.remove("open");
    }
    document.body.classList.remove("modal-open");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInitRules);
  } else {
    autoInitRules();
  }

  w.LobbyUI = {
    esc,
    vibrate,
    isVibrationSupported,
    isVibrationEnabled,
    toggleVibration,
    sound,
    toast,
    confetti: burstConfetti,
    showScreen,
    copyText,
    avatarHtml,
    renderCodeDigits,
    initPinInput,
    enableParallax,
    closeModal: closeModalEl,
    syncA11yLabels,
    rules: showRules,
    showRules,
    results: showResults,
    closeResults,
    shareResult,
    share: shareResult,
    roomError: showRoomError,
    showRoomError,
    closeRoomError,
    checkAutoRules,
    RULES_CACHE,
    loadGameRules,
    registerRules: (k, v) => (RULES_CACHE[k.toLowerCase()] = v),
    get RULES_DATA() { return w.LOBBY_RULES || RULES_CACHE; }
  };
})(window);
