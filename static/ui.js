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

  function isVibrationEnabled() {
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
          el.classList.remove('hide');
          el.classList.remove('screen-enter');
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
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
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

    // Also sync if tests or sessionStorage populate #joincode directly
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

  // ── Universal Accessible Modal & Dialog Manager ──
  const MODAL_SEL = '.rules-modal-overlay, .inv-modal-overlay, .afx-modal, .gw-modal, .bk-modal, .map-modal, .modal-bg, .modal-overlay, .modal, #inviteModal, #rulesModal';
  // Закрывать по фону/Esc можно только справочные окна. Выбор карты, итоги, пауза, лобби — часть игры:
  // их скрытие в обход игры оставляет движок в режиме «окно открыто» (Shuttle/Раскол намертво встают).
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
      try { m.__onDismiss(); } catch (e) {}
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

  // Light dismiss on backdrop click
  document.addEventListener('click', (e) => {
    const open = getOpenModals();
    for (const m of open) {
      if (e.target === m) {
        if (m.matches(DISMISS_SEL)) closeModalEl(m);
        break;
      }
    }
  }, true);

  // Close on Escape & trap focus
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

  // Track modal open/close via MutationObserver to preserve/restore focus and lock scroll
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

  // ── Accessible Names Synchronizer (uk, ru, en, de) ──
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

  // ── Recent Games Recorder (Stage 12a) ──
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


  // ── Universal Picture Rules Component (Stage 12b) ──
  const RULES_DATA = {
  "bunker": {
    "title": {
      "uk": "☢ Бункер — правила",
      "ru": "☢ Бункер — правила",
      "en": "☢ Bunker — Rules",
      "de": "☢ Bunker — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"22\" fill=\"rgba(245,158,11,0.12)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"5\" fill=\"#f59e0b\"/><path d=\"M24 19V7M19.7 26.5L9.3 32.5M28.3 26.5L38.7 32.5\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"11\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"13\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"35\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "Катастрофа",
          "desc": "На Землі апокаліпсис. Порятунок лише в бункері, але місця вистачить не всім."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"19\" r=\"6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M14 34c0-4.4 4.5-7 10-7s10 2.6 10 7\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><rect x=\"18\" y=\"2\" width=\"12\" height=\"6\" rx=\"2\" fill=\"#22d3ee\"/></svg>",
          "title": "Картки гравця",
          "desc": "Розкривай професію, здоров'я, багаж та біологію, доводячи свою користь."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c0-3.3 3.1-6 7-6h18c3.9 0 7 2.7 7 6v14c0 3.3-3.1 6-7 6h-6l-7 6v-6H15c-3.9 0-7-2.7-7-6V12z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"30\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Дебати",
          "desc": "Переконуй інших і вирішуйте разом, хто потрібен для відродження життя."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"16\" width=\"32\" height=\"24\" rx=\"4\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M16 16V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M20 22h8\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 12l5 5 9-9\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
          "title": "Голосування",
          "desc": "Щораунду одного виганяють. Увійдуть лише ті, хто набрав більшість голосів!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"22\" fill=\"rgba(245,158,11,0.12)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"5\" fill=\"#f59e0b\"/><path d=\"M24 19V7M19.7 26.5L9.3 32.5M28.3 26.5L38.7 32.5\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"11\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"13\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"35\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "Катастрофа",
          "desc": "На Земле апокалипсис. Спасение только в бункере, но места хватит не всем."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"19\" r=\"6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M14 34c0-4.4 4.5-7 10-7s10 2.6 10 7\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><rect x=\"18\" y=\"2\" width=\"12\" height=\"6\" rx=\"2\" fill=\"#22d3ee\"/></svg>",
          "title": "Карты игрока",
          "desc": "Раскрывай профессию, здоровье, багаж и биологию, доказывая свою пользу."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c0-3.3 3.1-6 7-6h18c3.9 0 7 2.7 7 6v14c0 3.3-3.1 6-7 6h-6l-7 6v-6H15c-3.9 0-7-2.7-7-6V12z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"30\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Дебаты",
          "desc": "Убеждай других и решайте вместе, кто нужен для возрождения жизни."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"16\" width=\"32\" height=\"24\" rx=\"4\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M16 16V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M20 22h8\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 12l5 5 9-9\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
          "title": "Голосование",
          "desc": "Каждый раунд одного изгоняют. Войдут лишь те, кто набрал большинство голосов!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"22\" fill=\"rgba(245,158,11,0.12)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"5\" fill=\"#f59e0b\"/><path d=\"M24 19V7M19.7 26.5L9.3 32.5M28.3 26.5L38.7 32.5\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"11\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"13\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"35\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "Cataclysm",
          "desc": "Earth faces an apocalypse. Survival lies in the bunker, but seats are limited."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"19\" r=\"6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M14 34c0-4.4 4.5-7 10-7s10 2.6 10 7\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><rect x=\"18\" y=\"2\" width=\"12\" height=\"6\" rx=\"2\" fill=\"#22d3ee\"/></svg>",
          "title": "Trait Cards",
          "desc": "Reveal profession, health, baggage, and traits to prove your survival value."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c0-3.3 3.1-6 7-6h18c3.9 0 7 2.7 7 6v14c0 3.3-3.1 6-7 6h-6l-7 6v-6H15c-3.9 0-7-2.7-7-6V12z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"30\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Debates",
          "desc": "Argue your case and debate who is essential to rebuild humanity."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"16\" width=\"32\" height=\"24\" rx=\"4\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M16 16V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M20 22h8\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 12l5 5 9-9\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
          "title": "Voting",
          "desc": "Each round one person is cast out. Only the chosen survivors enter the shelter!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"22\" fill=\"rgba(245,158,11,0.12)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"5\" fill=\"#f59e0b\"/><path d=\"M24 19V7M19.7 26.5L9.3 32.5M28.3 26.5L38.7 32.5\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"11\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"13\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/><circle cx=\"35\" cy=\"30\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "Katastrophe",
          "desc": "Die Erde steht vor dem Untergang. Rettung gibt es nur im Bunker mit wenigen Plätzen."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"19\" r=\"6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M14 34c0-4.4 4.5-7 10-7s10 2.6 10 7\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><rect x=\"18\" y=\"2\" width=\"12\" height=\"6\" rx=\"2\" fill=\"#22d3ee\"/></svg>",
          "title": "Karten aufdecken",
          "desc": "Zeige Beruf, Gesundheit, Gepäck und Fähigkeiten, um deinen Nutzen zu beweisen."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c0-3.3 3.1-6 7-6h18c3.9 0 7 2.7 7 6v14c0 3.3-3.1 6-7 6h-6l-7 6v-6H15c-3.9 0-7-2.7-7-6V12z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"30\" cy=\"19\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Debatten",
          "desc": "Überzeuge die Gruppe und entscheidet, wer für den Neuanfang unersetzlich ist."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"16\" width=\"32\" height=\"24\" rx=\"4\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M16 16V8a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v8\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M20 22h8\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M19 12l5 5 9-9\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
          "title": "Abstimmung",
          "desc": "Jede Runde wird jemand verstoßen. Nur die Überlebenden betreten den Bunker!"
        }
      ]
    },
    "full": {
      "uk": "Апокаліпсис, у бункері мало місць. У кожного свої карти (професія, здоров'я, багаж…). Розкривайте їх, сперечайтеся й голосуйте, кого НЕ пускати в бункер.",
      "ru": "Апокалипсис, в бункере мало мест. У каждого свои карты (профессия, здоровье, багаж…). Раскрывайте их, спорьте и голосуйте, кого НЕ пускать в бункер.",
      "en": "Apocalypse, and the bunker has few seats. Everyone has their own cards (profession, health, baggage…). Reveal them, argue, and vote on who does NOT get in.",
      "de": "Apokalypse, und der Bunker hat nur wenige Plätze. Jeder hat eigene Karten (Beruf, Gesundheit, Gepäck…). Deckt sie auf, diskutiert und stimmt ab, wer NICHT hineindarf."
    }
  },
  "mafia": {
    "title": {
      "uk": "🔪 Мафія — правила",
      "ru": "🔪 Мафия — правила",
      "en": "🔪 Mafia — Rules",
      "de": "🔪 Mafia — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 18c0-4 6-8 18-8s18 4 18 8c0 10-6 18-18 18S6 28 6 18z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"16\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"32\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><path d=\"M20 28c2 2 6 2 8 0\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Таємні ролі",
          "desc": "Місто засинає. Кожен таємно отримує роль: мирний, мафія, лікар чи шериф."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M30 6a16 16 0 1 0 12 26 18 18 0 0 1-12-26z\" fill=\"rgba(167,139,250,0.15)\" stroke=\"#a78bfa\" stroke-width=\"2\"/><path d=\"M20 18l8 12M28 18l-8 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Нічна фаза",
          "desc": "Мафія вбиває жертву, шериф перевіряє статус, лікар рятує від кулі."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"18\" y=\"8\" width=\"22\" height=\"10\" rx=\"3\" transform=\"rotate(30 18 8)\" fill=\"rgba(245,158,11,0.15)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M19 22L7 34\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M12 40h24\" stroke=\"#888\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Денне віче",
          "desc": "Всі обговорюють події ночі, підозрюють брехунів та висувають на суд."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6v34M16 40h16M10 14h28\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 14l-4 10h8L10 14zM38 14l-4 10h8L38 14z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"6\" r=\"3\" fill=\"#22d3ee\"/></svg>",
          "title": "Страта й перемога",
          "desc": "Голосуйте за вигнання. Місто перемагає, усунувши всю мафію; мафія — при рівності сил!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 18c0-4 6-8 18-8s18 4 18 8c0 10-6 18-18 18S6 28 6 18z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"16\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"32\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><path d=\"M20 28c2 2 6 2 8 0\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Тайные роли",
          "desc": "Город засыпает. Каждый тайно получает роль: мирный, мафия, доктор или шериф."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M30 6a16 16 0 1 0 12 26 18 18 0 0 1-12-26z\" fill=\"rgba(167,139,250,0.15)\" stroke=\"#a78bfa\" stroke-width=\"2\"/><path d=\"M20 18l8 12M28 18l-8 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Ночная фаза",
          "desc": "Мафия убивает жертву, шериф проверяет статус, доктор спасает от пули."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"18\" y=\"8\" width=\"22\" height=\"10\" rx=\"3\" transform=\"rotate(30 18 8)\" fill=\"rgba(245,158,11,0.15)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M19 22L7 34\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M12 40h24\" stroke=\"#888\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Дневной совет",
          "desc": "Все обсуждают события ночи, ловят ложь и выдвигают подозреваемых."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6v34M16 40h16M10 14h28\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 14l-4 10h8L10 14zM38 14l-4 10h8L38 14z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"6\" r=\"3\" fill=\"#22d3ee\"/></svg>",
          "title": "Казнь и победа",
          "desc": "Голосуйте за казнь. Город побеждает, убрав всю мафию; мафия — при равенстве сил!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 18c0-4 6-8 18-8s18 4 18 8c0 10-6 18-18 18S6 28 6 18z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"16\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"32\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><path d=\"M20 28c2 2 6 2 8 0\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Secret Roles",
          "desc": "Night falls. Each player receives a secret role: citizen, mafia, doctor, or sheriff."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M30 6a16 16 0 1 0 12 26 18 18 0 0 1-12-26z\" fill=\"rgba(167,139,250,0.15)\" stroke=\"#a78bfa\" stroke-width=\"2\"/><path d=\"M20 18l8 12M28 18l-8 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Night Phase",
          "desc": "Mafia shoots a victim, sheriff investigates alibis, and doctor saves lives."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"18\" y=\"8\" width=\"22\" height=\"10\" rx=\"3\" transform=\"rotate(30 18 8)\" fill=\"rgba(245,158,11,0.15)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M19 22L7 34\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M12 40h24\" stroke=\"#888\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Day Trial",
          "desc": "Town discusses the night's casualties, weeds out lies, and accuses suspects."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6v34M16 40h16M10 14h28\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 14l-4 10h8L10 14zM38 14l-4 10h8L38 14z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"6\" r=\"3\" fill=\"#22d3ee\"/></svg>",
          "title": "Execution & Win",
          "desc": "Vote to eliminate. Citizens win by finding all mafia; mafia wins by taking parity!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 18c0-4 6-8 18-8s18 4 18 8c0 10-6 18-18 18S6 28 6 18z\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"16\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"32\" cy=\"20\" r=\"4\" fill=\"#14141c\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><path d=\"M20 28c2 2 6 2 8 0\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Geheime Rollen",
          "desc": "Die Stadt schläft ein. Jeder erhält eine geheime Rolle: Bürger, Mafia, Arzt oder Sheriff."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M30 6a16 16 0 1 0 12 26 18 18 0 0 1-12-26z\" fill=\"rgba(167,139,250,0.15)\" stroke=\"#a78bfa\" stroke-width=\"2\"/><path d=\"M20 18l8 12M28 18l-8 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Nachtphase",
          "desc": "Die Mafia tötet ein Opfer, der Sheriff ermittelt und der Arzt heilt."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"18\" y=\"8\" width=\"22\" height=\"10\" rx=\"3\" transform=\"rotate(30 18 8)\" fill=\"rgba(245,158,11,0.15)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M19 22L7 34\" stroke=\"#f59e0b\" stroke-width=\"3\" stroke-linecap=\"round\"/><path d=\"M12 40h24\" stroke=\"#888\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Tagesrat",
          "desc": "Die Bürger besprechen die Ereignisse, entlarven Lügen und klagen Verdächtige an."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6v34M16 40h16M10 14h28\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M10 14l-4 10h8L10 14zM38 14l-4 10h8L38 14z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"6\" r=\"3\" fill=\"#22d3ee\"/></svg>",
          "title": "Urteil & Sieg",
          "desc": "Stimmt für die Hinrichtung ab. Die Bürger gewinnen ohne Mafia; die Mafia bei Gleichstand!"
        }
      ]
    },
    "full": {
      "uk": "Вночі мафія вбиває, лікар лікує, шериф перевіряє, патрульний охороняє. Удень місто обговорює та голосує, кого стратити. Місто перемагає, прибравши всю мафію; мафія — коли їх стане врівень із містом.",
      "ru": "Ночью мафия убивает, доктор лечит, шериф проверяет, патрульный охраняет. Днём город обсуждает и голосует, кого казнить. Город побеждает, убрав всю мафию; мафия — когда их станет вровень с городом.",
      "en": "At night the mafia kills, the doctor heals, the sheriff checks, the patrol guards. By day the town discusses and votes on who to execute. Town wins by eliminating all mafia; mafia wins once they equal the town.",
      "de": "Nachts tötet die Mafia, der Doktor heilt, der Sheriff überprüft, der Wachmann schützt. Tagsüber diskutiert die Stadt und stimmt ab, wer hingerichtet wird. Die Bürger gewinnen, wenn alle Mafiosi eliminiert sind; die Mafia gewinnt bei Gleichstand."
    }
  },
  "spy": {
    "title": {
      "uk": "🕵️ Шпигун — правила",
      "ru": "🕵️ Шпион — правила",
      "en": "🕵️ Spy — Rules",
      "de": "🕵️ Spion — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 10l12-4 12 4 12-4v28l-12 4-12-4-12 4V10z\" fill=\"rgba(34,197,94,0.12)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M18 6v28M30 10v28\" stroke=\"#22c55e\" stroke-width=\"1.5\" stroke-dasharray=\"3 2\"/><circle cx=\"30\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M30 24v5\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Секретна локація",
          "desc": "Усі знають спільне таємне місце, крім одного. Цей гравець — шпигун!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"20\" rx=\"18\" ry=\"4\" fill=\"rgba(245,158,11,0.2)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M14 20c0-6 3-12 10-12s10 6 10 12\" fill=\"rgba(245,158,11,0.1)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"28\" cy=\"30\" r=\"7\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M33 35l6 6\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Запитання",
          "desc": "Ставте одне одному тонкі запитання про деталі локації, щоб не розкрити її шпигуну."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.1)\"/><circle cx=\"24\" cy=\"24\" r=\"10\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"3\" fill=\"#e0102e\"/><path d=\"M24 2v8M24 38v8M2 24h8M38 24h8\" stroke=\"#e0102e\" stroke-width=\"2\"/></svg>",
          "title": "Підозри",
          "desc": "Мирні шукають того, хто відповідає невпевнено або розмито."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"26\" r=\"16\" stroke=\"#fbbf24\" stroke-width=\"2\" fill=\"rgba(251,191,36,0.12)\"/><path d=\"M24 16v10l6 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M21 4h6M24 4v6M35 12l3-3\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Розв'язка",
          "desc": "Голосуйте за шпигуна, або шпигун може назвати локацію й виграти партію!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 10l12-4 12 4 12-4v28l-12 4-12-4-12 4V10z\" fill=\"rgba(34,197,94,0.12)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M18 6v28M30 10v28\" stroke=\"#22c55e\" stroke-width=\"1.5\" stroke-dasharray=\"3 2\"/><circle cx=\"30\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M30 24v5\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Секретная локация",
          "desc": "Все знают общее тайное место, кроме одного. Этот игрок — шпион!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"20\" rx=\"18\" ry=\"4\" fill=\"rgba(245,158,11,0.2)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M14 20c0-6 3-12 10-12s10 6 10 12\" fill=\"rgba(245,158,11,0.1)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"28\" cy=\"30\" r=\"7\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M33 35l6 6\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Вопросы",
          "desc": "Задавайте друг другу аккуратные вопросы, чтобы не выдать место шпиону."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.1)\"/><circle cx=\"24\" cy=\"24\" r=\"10\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"3\" fill=\"#e0102e\"/><path d=\"M24 2v8M24 38v8M2 24h8M38 24h8\" stroke=\"#e0102e\" stroke-width=\"2\"/></svg>",
          "title": "Подозрения",
          "desc": "Мирные ищут того, кто отвечает неуверенно или слишком расплывчато."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"26\" r=\"16\" stroke=\"#fbbf24\" stroke-width=\"2\" fill=\"rgba(251,191,36,0.12)\"/><path d=\"M24 16v10l6 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M21 4h6M24 4v6M35 12l3-3\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Развязка",
          "desc": "Голосуйте за шпиона, либо шпион может назвать локацию и выиграть партию!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 10l12-4 12 4 12-4v28l-12 4-12-4-12 4V10z\" fill=\"rgba(34,197,94,0.12)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M18 6v28M30 10v28\" stroke=\"#22c55e\" stroke-width=\"1.5\" stroke-dasharray=\"3 2\"/><circle cx=\"30\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M30 24v5\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Secret Location",
          "desc": "All players know the secret place except one. That player is the spy!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"20\" rx=\"18\" ry=\"4\" fill=\"rgba(245,158,11,0.2)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M14 20c0-6 3-12 10-12s10 6 10 12\" fill=\"rgba(245,158,11,0.1)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"28\" cy=\"30\" r=\"7\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M33 35l6 6\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Clever Questions",
          "desc": "Ask subtle questions about the venue without giving the location away to the spy."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.1)\"/><circle cx=\"24\" cy=\"24\" r=\"10\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"3\" fill=\"#e0102e\"/><path d=\"M24 2v8M24 38v8M2 24h8M38 24h8\" stroke=\"#e0102e\" stroke-width=\"2\"/></svg>",
          "title": "Deduction",
          "desc": "Non-spies listen carefully to spot vague or hesitating answers."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"26\" r=\"16\" stroke=\"#fbbf24\" stroke-width=\"2\" fill=\"rgba(251,191,36,0.12)\"/><path d=\"M24 16v10l6 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M21 4h6M24 4v6M35 12l3-3\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Showdown",
          "desc": "Vote to unmask the spy, or the spy can guess the location at any time to win!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M6 10l12-4 12 4 12-4v28l-12 4-12-4-12 4V10z\" fill=\"rgba(34,197,94,0.12)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M18 6v28M30 10v28\" stroke=\"#22c55e\" stroke-width=\"1.5\" stroke-dasharray=\"3 2\"/><circle cx=\"30\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M30 24v5\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Geheimer Ort",
          "desc": "Alle kennen den geheimen Schauplatz außer einem: dem Spion!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"20\" rx=\"18\" ry=\"4\" fill=\"rgba(245,158,11,0.2)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><path d=\"M14 20c0-6 3-12 10-12s10 6 10 12\" fill=\"rgba(245,158,11,0.1)\" stroke=\"#f59e0b\" stroke-width=\"2\"/><circle cx=\"28\" cy=\"30\" r=\"7\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M33 35l6 6\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Gezielte Fragen",
          "desc": "Stellt geschickte Fragen zum Ort, ohne den Schauplatz an den Spion zu verraten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.1)\"/><circle cx=\"24\" cy=\"24\" r=\"10\" stroke=\"#e0102e\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"3\" fill=\"#e0102e\"/><path d=\"M24 2v8M24 38v8M2 24h8M38 24h8\" stroke=\"#e0102e\" stroke-width=\"2\"/></svg>",
          "title": "Ermittlung",
          "desc": "Die Bürger achten auf vage, zögerliche oder unpassende Antworten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"26\" r=\"16\" stroke=\"#fbbf24\" stroke-width=\"2\" fill=\"rgba(251,191,36,0.12)\"/><path d=\"M24 16v10l6 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M21 4h6M24 4v6M35 12l3-3\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Das Finale",
          "desc": "Stimmt über den Spion ab, oder der Spion errät den Ort und siegt sofort!"
        }
      ]
    },
    "full": {
      "uk": "Усі знають секретну локацію, крім шпигуна. Ставте запитання по черзі. Мета мирних — знайти шпигуна, мета шпигуна — зрозуміти, де всі знаходяться.",
      "ru": "Все знают секретную локацию, кроме шпиона. Задавайте вопросы по очереди. Цель мирных — найти шпиона, цель шпиона — понять, где все находятся.",
      "en": "Everyone knows the secret location except the spy. Take turns asking questions. Town's goal: uncover the spy. Spy's goal: figure out the location.",
      "de": "Alle kennen den geheimen Ort außer dem Spion. Stellt abwechselnd Fragen. Ziel der Bürger: den Spion enttarnen. Ziel des Spions: den Ort herausfinden."
    }
  },
  "alias": {
    "title": {
      "uk": "⚡ Аліас — правила",
      "ru": "⚡ Алиас — правила",
      "en": "⚡ Alias — Rules",
      "de": "⚡ Alias — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c6 0 10-4 10-4s4 4 10 4v10c0 8-10 14-10 14s-10-6-10-14V12z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M22 18c4 0 8-3 8-3s3 3 8 3v8c0 6-8 11-8 11s-8-5-8-11v-8z\" fill=\"rgba(217,70,239,0.15)\" stroke=\"#d946ef\" stroke-width=\"2\"/></svg>",
          "title": "Команди",
          "desc": "Розбийтеся на команди, оберіть тему слів та визначте черговість пояснення."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 6h24M12 42h24M14 6c0 10 8 14 10 18-2 4-10 8-10 18M34 6c0 10-8 14-10 18 2 4 10 8 10 18\" stroke=\"#f59e0b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"33\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "60 секунд",
          "desc": "Пояснюй якомога більше слів партнерам за хвилину синонімами та натяками."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2.5\" fill=\"rgba(224,16,46,0.12)\"/><path d=\"M11 11l26 26\" stroke=\"#e0102e\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">А-Я</text></svg>",
          "title": "Без спільнокореневих",
          "desc": "Заборонено називати саме слово, його переклад чи спільнокореневі основи."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 6v36M10 8h24l-4 7 4 7H10\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"10\" cy=\"6\" r=\"2\" fill=\"#22c55e\"/></svg>",
          "title": "До фінішу",
          "desc": "Кожне відгадане слово дає очко. Команда, що першою дійде до мети, перемагає!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c6 0 10-4 10-4s4 4 10 4v10c0 8-10 14-10 14s-10-6-10-14V12z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M22 18c4 0 8-3 8-3s3 3 8 3v8c0 6-8 11-8 11s-8-5-8-11v-8z\" fill=\"rgba(217,70,239,0.15)\" stroke=\"#d946ef\" stroke-width=\"2\"/></svg>",
          "title": "Команды",
          "desc": "Разбейтесь на команды, выберите колоду слов и определите очерёдность хода."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 6h24M12 42h24M14 6c0 10 8 14 10 18-2 4-10 8-10 18M34 6c0 10-8 14-10 18 2 4 10 8 10 18\" stroke=\"#f59e0b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"33\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "60 секунд",
          "desc": "Объясняй как можно больше слов сокомандникам за минуту синонимами и ассоциациями."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2.5\" fill=\"rgba(224,16,46,0.12)\"/><path d=\"M11 11l26 26\" stroke=\"#e0102e\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">А-Я</text></svg>",
          "title": "Без однокоренных",
          "desc": "Запрещено называть само слово, перевод или слова с тем же корнем."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 6v36M10 8h24l-4 7 4 7H10\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"10\" cy=\"6\" r=\"2\" fill=\"#22c55e\"/></svg>",
          "title": "К финишу",
          "desc": "Каждое угаданное слово приносит балл. Команда, первой набравшая цель, побеждает!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c6 0 10-4 10-4s4 4 10 4v10c0 8-10 14-10 14s-10-6-10-14V12z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M22 18c4 0 8-3 8-3s3 3 8 3v8c0 6-8 11-8 11s-8-5-8-11v-8z\" fill=\"rgba(217,70,239,0.15)\" stroke=\"#d946ef\" stroke-width=\"2\"/></svg>",
          "title": "Teams",
          "desc": "Split into teams, choose your word deck, and take turns explaining."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 6h24M12 42h24M14 6c0 10 8 14 10 18-2 4-10 8-10 18M34 6c0 10-8 14-10 18 2 4 10 8 10 18\" stroke=\"#f59e0b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"33\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "60 Seconds",
          "desc": "Explain as many words as possible to your teammates using synonyms and clues."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2.5\" fill=\"rgba(224,16,46,0.12)\"/><path d=\"M11 11l26 26\" stroke=\"#e0102e\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">А-Я</text></svg>",
          "title": "No Root Words",
          "desc": "Never say the word itself, direct translations, or words with the same root."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 6v36M10 8h24l-4 7 4 7H10\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"10\" cy=\"6\" r=\"2\" fill=\"#22c55e\"/></svg>",
          "title": "Race to Victory",
          "desc": "Each correct guess gives a point. The first team to reach the target score wins!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12c6 0 10-4 10-4s4 4 10 4v10c0 8-10 14-10 14s-10-6-10-14V12z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M22 18c4 0 8-3 8-3s3 3 8 3v8c0 6-8 11-8 11s-8-5-8-11v-8z\" fill=\"rgba(217,70,239,0.15)\" stroke=\"#d946ef\" stroke-width=\"2\"/></svg>",
          "title": "Teams",
          "desc": "Teilt euch in Teams auf, wählt ein Kartendeck und wechselt euch ab."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 6h24M12 42h24M14 6c0 10 8 14 10 18-2 4-10 8-10 18M34 6c0 10-8 14-10 18 2 4 10 8 10 18\" stroke=\"#f59e0b\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"33\" r=\"3\" fill=\"#f59e0b\"/></svg>",
          "title": "60 Sekunden",
          "desc": "Erkläre deinem Team so viele Begriffe wie möglich mit Synonymen und Hinweisen."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#e0102e\" stroke-width=\"2.5\" fill=\"rgba(224,16,46,0.12)\"/><path d=\"M11 11l26 26\" stroke=\"#e0102e\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">А-Я</text></svg>",
          "title": "Keine Wortstämme",
          "desc": "Das gesuchte Wort, Übersetzungen oder derselbe Wortstamm sind verboten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 6v36M10 8h24l-4 7 4 7H10\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"10\" cy=\"6\" r=\"2\" fill=\"#22c55e\"/></svg>",
          "title": "Zielsprint",
          "desc": "Jeder Treffer bringt einen Punkt. Das erste Team mit der Zielpunktzahl gewinnt!"
        }
      ]
    },
    "full": {
      "uk": "Пояснюйте слова команді за 60 секунд без спільнокореневих слів і жестів. Більше вгаданих слів — ближче перемога.",
      "ru": "Объясняйте слова команде за 60 секунд без однокоренных слов и жестов. Больше угаданных слов — ближе победа.",
      "en": "Explain words to your team within 60 seconds without using root words or gestures. More guessed words leads to victory.",
      "de": "Erkläre deinem Team in 60 Sekunden Begriffe ohne Wortstämme oder Gesten. Mehr erratene Wörter bringen den Sieg."
    }
  },
  "variants": {
    "title": {
      "uk": "🎭 Аукціон брехні — правила",
      "ru": "🎭 Аукцион лжи — правила",
      "en": "🎭 Bluff Auction — Rules",
      "de": "🎭 Lügen-Auktion — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"20\" stroke=\"#d946ef\" stroke-width=\"2\" fill=\"rgba(217,70,239,0.12)\"/><text x=\"24\" y=\"32\" font-size=\"26\" font-weight=\"900\" fill=\"#d946ef\" text-anchor=\"middle\">?</text></svg>",
          "title": "Рідкісне питання",
          "desc": "Усі отримують дивовижне або кумедне питання про маловідомий факт."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 8h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z\" fill=\"rgba(251,191,36,0.12)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 16h16M14 22h14M14 28h8\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M32 30l8-8 3 3-8 8H32v-3z\" fill=\"#e0102e\"/></svg>",
          "title": "Вигадай брехню",
          "desc": "Напиши переконливу хибну відповідь, щоб ввести в оману інших гравців."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"6\" fill=\"#22d3ee\"/></svg>",
          "title": "Знайди правду",
          "desc": "Усі відповіді змішуються зі справжньою. Знайди істину серед вигадок!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20l8 12-18 20L6 20l8-12z\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M6 20h36M14 8l10 32M34 8L24 40\" stroke=\"#22c55e\" stroke-width=\"1.5\"/></svg>",
          "title": "Очки за блеф",
          "desc": "Отримуй бали за правильний вибір і за кожного суперника, який повірив у твою брехню!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"20\" stroke=\"#d946ef\" stroke-width=\"2\" fill=\"rgba(217,70,239,0.12)\"/><text x=\"24\" y=\"32\" font-size=\"26\" font-weight=\"900\" fill=\"#d946ef\" text-anchor=\"middle\">?</text></svg>",
          "title": "Редкий вопрос",
          "desc": "Все получают удивительный или забавный вопрос о малоизвестном факте."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 8h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z\" fill=\"rgba(251,191,36,0.12)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 16h16M14 22h14M14 28h8\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M32 30l8-8 3 3-8 8H32v-3z\" fill=\"#e0102e\"/></svg>",
          "title": "Придумай ложь",
          "desc": "Напиши правдоподобный ложный ответ, чтобы запутать других игроков."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"6\" fill=\"#22d3ee\"/></svg>",
          "title": "Найди правду",
          "desc": "Все ответы перемешиваются с истинным. Отыщи правду среди выдумок!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20l8 12-18 20L6 20l8-12z\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M6 20h36M14 8l10 32M34 8L24 40\" stroke=\"#22c55e\" stroke-width=\"1.5\"/></svg>",
          "title": "Очки за блеф",
          "desc": "Получай очки за верный выбор и за каждого соперника, поверившего в твою выдумку!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"20\" stroke=\"#d946ef\" stroke-width=\"2\" fill=\"rgba(217,70,239,0.12)\"/><text x=\"24\" y=\"32\" font-size=\"26\" font-weight=\"900\" fill=\"#d946ef\" text-anchor=\"middle\">?</text></svg>",
          "title": "Trivia Riddle",
          "desc": "Everyone receives a bizarre or fascinating trivia question with an obscure fact."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 8h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z\" fill=\"rgba(251,191,36,0.12)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 16h16M14 22h14M14 28h8\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M32 30l8-8 3 3-8 8H32v-3z\" fill=\"#e0102e\"/></svg>",
          "title": "Craft a Bluff",
          "desc": "Write a believable fake answer to trick other players into picking yours."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"6\" fill=\"#22d3ee\"/></svg>",
          "title": "Spot the Truth",
          "desc": "All submissions mix with the real answer. Find the genuine truth among bluffs!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20l8 12-18 20L6 20l8-12z\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M6 20h36M14 8l10 32M34 8L24 40\" stroke=\"#22c55e\" stroke-width=\"1.5\"/></svg>",
          "title": "Score Points",
          "desc": "Earn points for guessing the truth and bonus points for everyone fooled by your lie!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"20\" stroke=\"#d946ef\" stroke-width=\"2\" fill=\"rgba(217,70,239,0.12)\"/><text x=\"24\" y=\"32\" font-size=\"26\" font-weight=\"900\" fill=\"#d946ef\" text-anchor=\"middle\">?</text></svg>",
          "title": "Kuriose Frage",
          "desc": "Alle erhalten eine ungewöhnliche Quizfrage über eine unbekannte Tatsache."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M10 8h24a4 4 0 0 1 4 4v24a4 4 0 0 1-4 4H10a4 4 0 0 1-4-4V12a4 4 0 0 1 4-4z\" fill=\"rgba(251,191,36,0.12)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 16h16M14 22h14M14 28h8\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M32 30l8-8 3 3-8 8H32v-3z\" fill=\"#e0102e\"/></svg>",
          "title": "Erfinde einen Bluff",
          "desc": "Schreibe eine glaubhafte falsche Antwort, um andere Mitspieler zu täuschen."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M4 24s8-12 20-12 20 12 20 12-8 12-20 12S4 24 4 24z\" fill=\"rgba(34,211,238,0.12)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"6\" fill=\"#22d3ee\"/></svg>",
          "title": "Wahrheit finden",
          "desc": "Alle Antworten werden gemischt. Finde die echte Antwort unter den Erfindungen!"
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20l8 12-18 20L6 20l8-12z\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M6 20h36M14 8l10 32M34 8L24 40\" stroke=\"#22c55e\" stroke-width=\"1.5\"/></svg>",
          "title": "Punkte abräumen",
          "desc": "Punkte für die richtige Antwort und für jeden Spieler, der auf deinen Bluff reingefallen ist!"
        }
      ]
    },
    "full": {
      "uk": "Отримуйте рідкісне питання, пишіть правдоподібну брехню та вгадуйте правильну відповідь серед вигадок суперників. Очки нараховуються за правду та за кожного обдуреного гравця.",
      "ru": "Получайте редкий вопрос, придумывайте правдоподобную ложь и ищите верный ответ среди выдумок соперников. Очки начисляются за правду и за каждого обманутого игрока.",
      "en": "Get an unusual trivia question, invent a convincing lie, and find the real answer among your rivals' bluffs. Earn points for the truth and for everyone you trick.",
      "de": "Erhalte eine ungewöhnliche Quizfrage, erfinde eine glaubhafte Lüge und finde die wahre Antwort unter den Bluffs deiner Rivalen. Punkte gibt es für die Wahrheit und getäuschte Gegner."
    }
  },
  "guesswho": {
    "title": {
      "uk": "🎭 Хто є хто — правила",
      "ru": "🎭 Кто есть кто — правила",
      "en": "🎭 Guess Who — Rules",
      "de": "🎭 Wer bin ich — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"18\" r=\"6\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 34c0-4 5-6 12-6s12 2 12 6\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Таємний персонаж",
          "desc": "Кожен отримує секретного героя з обраного всесвіту (фільми, аніме, ігри)."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"16\" cy=\"24\" r=\"10\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M12 24l3 3 6-6\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"32\" cy=\"24\" r=\"10\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M28 20l8 8M36 20l-8 8\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Питання Так/Ні",
          "desc": "По черзі ставте запитання: про стать, колір волосся, магію чи аксесуари."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"6\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"6\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><path d=\"M8 8l12 12M28 28l12 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Відсіювання",
          "desc": "Тапай по картках, щоб викреслити тих, хто не підходить під опис."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 34l-2-18 10 8 8-12 8 12 10-8-2 18H8z\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"6\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"12\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"42\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><rect x=\"8\" y=\"34\" width=\"32\" height=\"5\" rx=\"1.5\" fill=\"#fbbf24\"/></svg>",
          "title": "Здогад",
          "desc": "Тисни «Вгадати», коли впевнений. Правильний здогад приносить перемогу!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"18\" r=\"6\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 34c0-4 5-6 12-6s12 2 12 6\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Тайный персонаж",
          "desc": "Каждый получает секретного героя из выбранной вселенной (кино, аниме, игры)."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"16\" cy=\"24\" r=\"10\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M12 24l3 3 6-6\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"32\" cy=\"24\" r=\"10\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M28 20l8 8M36 20l-8 8\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Вопросы Да/Нет",
          "desc": "По очереди задавайте вопросы: про пол, внешность, одежду или суперсилы."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"6\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"6\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><path d=\"M8 8l12 12M28 28l12 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Отсеивание",
          "desc": "Тапай по карточкам, чтобы вычеркнуть неподходящих персонажей."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 34l-2-18 10 8 8-12 8 12 10-8-2 18H8z\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"6\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"12\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"42\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><rect x=\"8\" y=\"34\" width=\"32\" height=\"5\" rx=\"1.5\" fill=\"#fbbf24\"/></svg>",
          "title": "Догадка",
          "desc": "Жми «Угадать», когда уверен. Точный выбор приносит победу в партии!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"18\" r=\"6\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 34c0-4 5-6 12-6s12 2 12 6\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Secret Character",
          "desc": "Each player receives a hidden character from the chosen universe."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"16\" cy=\"24\" r=\"10\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M12 24l3 3 6-6\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"32\" cy=\"24\" r=\"10\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M28 20l8 8M36 20l-8 8\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Yes/No Questions",
          "desc": "Take turns asking questions about appearance, gender, accessories, or powers."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"6\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"6\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><path d=\"M8 8l12 12M28 28l12 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Elimination",
          "desc": "Tap cards on your board to cross out suspects who do not match the answers."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 34l-2-18 10 8 8-12 8 12 10-8-2 18H8z\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"6\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"12\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"42\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><rect x=\"8\" y=\"34\" width=\"32\" height=\"5\" rx=\"1.5\" fill=\"#fbbf24\"/></svg>",
          "title": "Final Guess",
          "desc": "Hit 'Guess' when you are certain. Guessing right secures immediate victory!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"6\" width=\"32\" height=\"36\" rx=\"6\" fill=\"rgba(217,70,239,0.12)\" stroke=\"#d946ef\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"18\" r=\"6\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 34c0-4 5-6 12-6s12 2 12 6\" stroke=\"#d946ef\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Geheime Figur",
          "desc": "Jeder Spieler erhält eine verdeckte Figur aus dem gewählten Universum."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"16\" cy=\"24\" r=\"10\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><path d=\"M12 24l3 3 6-6\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"32\" cy=\"24\" r=\"10\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M28 20l8 8M36 20l-8 8\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Ja/Nein-Fragen",
          "desc": "Fragt abwechselnd nach Merkmalen wie Aussehen, Kleidung oder Kräften."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"6\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"6\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"6\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><rect x=\"26\" y=\"26\" width=\"16\" height=\"16\" rx=\"3\" stroke=\"#888\" stroke-width=\"1.5\"/><path d=\"M8 8l12 12M28 28l12 12\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Ausschluss",
          "desc": "Tippe auf Karten, um unpassende Verdächtige auf deinem Feld auszublenden."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 34l-2-18 10 8 8-12 8 12 10-8-2 18H8z\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linejoin=\"round\"/><circle cx=\"6\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"12\" r=\"2\" fill=\"#fbbf24\"/><circle cx=\"42\" cy=\"16\" r=\"2\" fill=\"#fbbf24\"/><rect x=\"8\" y=\"34\" width=\"32\" height=\"5\" rx=\"1.5\" fill=\"#fbbf24\"/></svg>",
          "title": "Der Tipp",
          "desc": "Drücke auf 'Raten', wenn du sicher bist. Ein richtiger Tipp gewinnt das Spiel!"
        }
      ]
    },
    "full": {
      "uk": "У кожного свій персонаж. По черзі ставте запитання «так/ні», відсіюйте та вирахуйте, хто дістався супернику, першим.",
      "ru": "У каждого свой персонаж. По очереди задавайте вопросы «да/нет», отсеивайте и вычислите, кто достался сопернику, первым.",
      "en": "Each player has a character. Ask \"yes/no\" questions in turn, eliminate suspects and guess your opponent's character first.",
      "de": "Jeder Spieler hat eine geheime Figur. Stellt abwechselnd Ja/Nein-Fragen, schließt Verdächtige aus und erratet als Erster die Figur des Gegners."
    }
  },
  "poker": {
    "title": {
      "uk": "🂡 Покер — правила",
      "ru": "🂡 Покер — правила",
      "en": "🂡 Poker — Rules",
      "de": "🂡 Poker — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"10\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(-8 8 10)\"/><rect x=\"20\" y=\"8\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(8 20 8)\"/><text x=\"14\" y=\"24\" fill=\"#111\" font-size=\"12\" font-weight=\"900\">A♠</text><text x=\"28\" y=\"24\" fill=\"#e0102e\" font-size=\"12\" font-weight=\"900\">K♥</text></svg>",
          "title": "Кишенькові карти",
          "desc": "Кожен отримує 2 приховані карти. Оціни свій стартовий потенціал."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"16\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"24\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"32\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M10 16v16M38 16v16\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Торгівля",
          "desc": "Роби ставки (Check, Bet, Raise, Fold), блефуй і збільшуй банк за столом."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"4\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"18\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"32\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><circle cx=\"9.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"23.5\" cy=\"21\" r=\"2\" fill=\"#111\"/><circle cx=\"37.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Спільні карти",
          "desc": "На стіл послідовно виходять флоп, терн і рівер. Збирай комбінацію з 5 карт."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20v14a10 10 0 0 1-20 0V8z\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 12H6a4 4 0 0 0 4 6h4M34 12h8a4 4 0 0 1-4 6h-4M24 32v6M16 38h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Шоудаун",
          "desc": "Гравці розкривають карти. Банк забирає найсильніша рука або останній, хто не скинув!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"10\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(-8 8 10)\"/><rect x=\"20\" y=\"8\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(8 20 8)\"/><text x=\"14\" y=\"24\" fill=\"#111\" font-size=\"12\" font-weight=\"900\">A♠</text><text x=\"28\" y=\"24\" fill=\"#e0102e\" font-size=\"12\" font-weight=\"900\">K♥</text></svg>",
          "title": "Карманные карты",
          "desc": "Каждый получает 2 скрытые карты. Оцени силу своей стартовой руки."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"16\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"24\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"32\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M10 16v16M38 16v16\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Торговля",
          "desc": "Делай ставки (Check, Bet, Raise, Fold), блефуй и наращивай общий банк."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"4\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"18\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"32\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><circle cx=\"9.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"23.5\" cy=\"21\" r=\"2\" fill=\"#111\"/><circle cx=\"37.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Общие карты",
          "desc": "На стол выкладываются флоп, терн и ривер. Собери комбинацию из 5 карт."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20v14a10 10 0 0 1-20 0V8z\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 12H6a4 4 0 0 0 4 6h4M34 12h8a4 4 0 0 1-4 6h-4M24 32v6M16 38h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Шоудаун",
          "desc": "Игроки вскрываются. Банк забирает лучшая рука или последний не спасовавший!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"10\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(-8 8 10)\"/><rect x=\"20\" y=\"8\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(8 20 8)\"/><text x=\"14\" y=\"24\" fill=\"#111\" font-size=\"12\" font-weight=\"900\">A♠</text><text x=\"28\" y=\"24\" fill=\"#e0102e\" font-size=\"12\" font-weight=\"900\">K♥</text></svg>",
          "title": "Hole Cards",
          "desc": "Each player receives 2 private cards. Gauge your pre-flop chances."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"16\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"24\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"32\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M10 16v16M38 16v16\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Betting Rounds",
          "desc": "Check, bet, raise or fold. Bluff rivals and build up the pot."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"4\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"18\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"32\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><circle cx=\"9.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"23.5\" cy=\"21\" r=\"2\" fill=\"#111\"/><circle cx=\"37.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Community Cards",
          "desc": "Five shared cards (flop, turn, river) are dealt. Form the best 5-card hand."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20v14a10 10 0 0 1-20 0V8z\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 12H6a4 4 0 0 0 4 6h4M34 12h8a4 4 0 0 1-4 6h-4M24 32v6M16 38h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Showdown",
          "desc": "Remaining players reveal hands. Strongest combo or the last standing takes the pot!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"10\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(-8 8 10)\"/><rect x=\"20\" y=\"8\" width=\"18\" height=\"26\" rx=\"3\" fill=\"#fff\" stroke=\"#bbb\" stroke-width=\"1.5\" transform=\"rotate(8 20 8)\"/><text x=\"14\" y=\"24\" fill=\"#111\" font-size=\"12\" font-weight=\"900\">A♠</text><text x=\"28\" y=\"24\" fill=\"#e0102e\" font-size=\"12\" font-weight=\"900\">K♥</text></svg>",
          "title": "Handkarten",
          "desc": "Jeder Spieler erhält 2 verdeckte Karten. Prüfe dein Anfangsblatt."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><ellipse cx=\"24\" cy=\"16\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"24\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><ellipse cx=\"24\" cy=\"32\" rx=\"14\" ry=\"6\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M10 16v16M38 16v16\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Setzrunden",
          "desc": "Checken, setzen, erhöhen oder passen. Bluffe und baue den Pot auf."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"4\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"18\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><rect x=\"32\" y=\"12\" width=\"11\" height=\"18\" rx=\"2\" fill=\"#fff\" stroke=\"#ccc\"/><circle cx=\"9.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/><circle cx=\"23.5\" cy=\"21\" r=\"2\" fill=\"#111\"/><circle cx=\"37.5\" cy=\"21\" r=\"2\" fill=\"#e0102e\"/></svg>",
          "title": "Gemeinschaftskarten",
          "desc": "Flop, Turn und River werden aufgedeckt. Bilde das beste 5-Karten-Blatt."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M14 8h20v14a10 10 0 0 1-20 0V8z\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M14 12H6a4 4 0 0 0 4 6h4M34 12h8a4 4 0 0 1-4 6h-4M24 32v6M16 38h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Showdown",
          "desc": "Die Spieler decken auf. Die stärkste Hand oder der letzte Verbliebene gewinnt den Pot!"
        }
      ]
    },
    "full": {
      "uk": "Техаський холдем: 2 карти на руках, 5 загальних на столі. 4 раунди торгівлі (префлоп, флоп, терн, рівер). Збирай найсильнішу комбінацію або змушуй суперників скинути карти блефом.",
      "ru": "Техасский холдем: 2 карты на руках, 5 общих на столе. 4 круга торговли (префлоп, флоп, терн, ривер). Собирай сильнейшую комбинацию или выбивай соперников блефом.",
      "en": "Texas Hold'em: 2 hole cards, 5 community cards. 4 betting rounds (pre-flop, flop, turn, river). Make the strongest hand or bluff your opponents out of the pot.",
      "de": "Texas Hold'em: 2 Handkarten, 5 Gemeinschaftskarten. 4 Setzrunden (Pre-Flop, Flop, Turn, River). Bilde die stärkste Hand oder bringe Gegner mit Bluffs zum Passen."
    }
  },
  "geostake": {
    "title": {
      "uk": "🌍 Geo$take — правила",
      "ru": "🌍 Geo$take — правила",
      "en": "🌍 Geo$take — Rules",
      "de": "🌍 Geo$take — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"20\" cy=\"24\" r=\"14\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"20\" y=\"29\" font-size=\"14\" font-weight=\"900\" fill=\"#fbbf24\" text-anchor=\"middle\">$</text><circle cx=\"32\" cy=\"18\" r=\"9\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/></svg>",
          "title": "Ставка на раунд",
          "desc": "Перед кожним із 5 раундів обери розмір ставки віртуальними монетами."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.12)\"/><ellipse cx=\"24\" cy=\"24\" rx=\"9\" ry=\"18\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><path d=\"M6 24h36M24 6v36\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/></svg>",
          "title": "360° панорама",
          "desc": "Оглядай вулицю: звертай увагу на сонце, мову знаків, архітектуру та природу."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6a10 10 0 0 0-10 10c0 7 10 18 10 18s10-11 10-18a10 10 0 0 0-10-10z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"4\" fill=\"#e0102e\"/></svg>",
          "title": "Мітка на карті",
          "desc": "Відкрий світову карту й постав шпильку в очікуване місце за 3 хвилини."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s12 6 12 20l-6 6-6-6-6 6-6-6C12 10 24 4 24 4z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"3\" fill=\"#22d3ee\"/><path d=\"M21 34l3 8 3-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Множник виграшу",
          "desc": "Що ближче мітка до цілі — то вищий множник виплати (до ×5.0)! Примножуй банк!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"20\" cy=\"24\" r=\"14\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"20\" y=\"29\" font-size=\"14\" font-weight=\"900\" fill=\"#fbbf24\" text-anchor=\"middle\">$</text><circle cx=\"32\" cy=\"18\" r=\"9\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/></svg>",
          "title": "Ставка на раунд",
          "desc": "Перед каждым из 5 раундов выбери размер ставки виртуальными монетами."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.12)\"/><ellipse cx=\"24\" cy=\"24\" rx=\"9\" ry=\"18\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><path d=\"M6 24h36M24 6v36\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/></svg>",
          "title": "360° панорама",
          "desc": "Осмотри улицу: ищи дорожные знаки, язык вывесок, природу и солнце."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6a10 10 0 0 0-10 10c0 7 10 18 10 18s10-11 10-18a10 10 0 0 0-10-10z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"4\" fill=\"#e0102e\"/></svg>",
          "title": "Метка на карте",
          "desc": "Открой карту мира и поставь метку в предполагаемую точку за 3 минуты."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s12 6 12 20l-6 6-6-6-6 6-6-6C12 10 24 4 24 4z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"3\" fill=\"#22d3ee\"/><path d=\"M21 34l3 8 3-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Множитель выигрыша",
          "desc": "Чем ближе догадка к цели — тем выше множитель выигрыша (до ×5.0)! Бей рекорды!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"20\" cy=\"24\" r=\"14\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"20\" y=\"29\" font-size=\"14\" font-weight=\"900\" fill=\"#fbbf24\" text-anchor=\"middle\">$</text><circle cx=\"32\" cy=\"18\" r=\"9\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/></svg>",
          "title": "Round Wager",
          "desc": "Choose how many virtual coins to stake before each of the 5 rounds."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.12)\"/><ellipse cx=\"24\" cy=\"24\" rx=\"9\" ry=\"18\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><path d=\"M6 24h36M24 6v36\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/></svg>",
          "title": "360° Street View",
          "desc": "Look around the panorama: study road signs, languages, vegetation, and the sun."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6a10 10 0 0 0-10 10c0 7 10 18 10 18s10-11 10-18a10 10 0 0 0-10-10z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"4\" fill=\"#e0102e\"/></svg>",
          "title": "Drop Pin",
          "desc": "Open the world map and place your pin on your target guess within 3 minutes."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s12 6 12 20l-6 6-6-6-6 6-6-6C12 10 24 4 24 4z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"3\" fill=\"#22d3ee\"/><path d=\"M21 34l3 8 3-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Multiplier Payout",
          "desc": "The closer your guess, the higher your payout multiplier (up to ×5.0)! Grow your bankroll!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"20\" cy=\"24\" r=\"14\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"20\" y=\"29\" font-size=\"14\" font-weight=\"900\" fill=\"#fbbf24\" text-anchor=\"middle\">$</text><circle cx=\"32\" cy=\"18\" r=\"9\" fill=\"rgba(251,191,36,0.15)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/></svg>",
          "title": "Rundeneinsatz",
          "desc": "Wähle vor jeder der 5 Runden deinen Einsatz in virtuellen Münzen."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"18\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.12)\"/><ellipse cx=\"24\" cy=\"24\" rx=\"9\" ry=\"18\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/><path d=\"M6 24h36M24 6v36\" stroke=\"#22d3ee\" stroke-width=\"1.5\"/></svg>",
          "title": "360°-Panorama",
          "desc": "Erkunde die Straße: Achte auf Schilder, Sprache, Vegetation und den Sonnenstand."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 6a10 10 0 0 0-10 10c0 7 10 18 10 18s10-11 10-18a10 10 0 0 0-10-10z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"4\" fill=\"#e0102e\"/></svg>",
          "title": "Stecknadel setzen",
          "desc": "Öffne die Weltkarte und setze deine Stecknadel innerhalb von 3 Minuten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s12 6 12 20l-6 6-6-6-6 6-6-6C12 10 24 4 24 4z\" fill=\"rgba(224,16,46,0.2)\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"16\" r=\"3\" fill=\"#22d3ee\"/><path d=\"M21 34l3 8 3-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Multiplikator-Gewinn",
          "desc": "Je näher dein Tipp liegt, desto höher der Gewinnmultiplikator (bis ×5.0)!"
        }
      ]
    },
    "full": {
      "uk": "Перед кожним із 5 раундів став віртуальні монети. Оглянь 360°-панораму, відкрий карту й постав мітку. На раунд є 3 хвилини. Що ближче до точки — то вищий множник (до ×5.0)! Якщо монет менше 1000 — щодня нараховується +100 бонусних монет.",
      "ru": "Перед каждым из 5 раундов ставь виртуальные монеты. Осмотри 360°-панораму, открой карту и поставь метку. На раунд даётся 3 минуты. Чем ближе к точке — тем больше множитель (до ×5.0)! Если монет меньше 1000 — каждый день начисляется +100 бонусных монет.",
      "en": "Bet virtual coins before each of the 5 rounds. Look around the 360° panorama, open the map, and drop your pin within 3 minutes. Closer guesses pay higher multipliers (up to ×5.0). Below 1000 coins you get +100 daily bonus coins.",
      "de": "Setze vor jeder der 5 Runden virtuelle Münzen. Schau dich im 360°-Panorama um, öffne die Karte und setze deinen Pin innerhalb von 3 Minuten. Je näher du dran bist, desto höher dein Multiplikator (bis ×5.0). Unter 1000 Münzen gibt es täglich +100 Bonusmünzen."
    }
  },
  "raskol": {
    "title": {
      "uk": "⚔️ Раскол — правила",
      "ru": "⚔️ Раскол — правила",
      "en": "⚔️ Raskol — Rules",
      "de": "⚔️ Raskol — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 40l20-20M12 40l-4-4M34 14l6-6M28 8l12 12M32 20l-4-4\" stroke=\"#d946ef\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M40 40L20 20M36 40l4-4M14 14l-6-6M20 8L8 20M16 20l4-4\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Клас героя",
          "desc": "Обери бійця: незламний Вартовий, влучний Слідопит, Маг чи потаємна Тінь."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s14 4 14 14c0 14-14 22-14 22S10 32 10 18C10 8 24 4 24 4z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M24 12v16M16 20h16\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Маневри й бій",
          "desc": "Ухиляйся від ворожих снарядів та контратакуй супротивників у слушний момент."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l12 14-12 22L12 18 24 4z\" fill=\"rgba(217,70,239,0.2)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 18h24M24 4v36\" stroke=\"#d946ef\" stroke-width=\"1.5\"/></svg>",
          "title": "Астральні осколки",
          "desc": "Збирай осколки з переможених ворогів для розблокування нових класів і навичок."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"20\" r=\"14\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><rect x=\"18\" y=\"32\" width=\"12\" height=\"8\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"19\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><circle cx=\"29\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><path d=\"M21 32v8M27 32v8\" stroke=\"#e0102e\" stroke-width=\"1.5\"/></svg>",
          "title": "Битва з Босом",
          "desc": "Пройди всі хвилі підземелля та здолай володаря глибин, щоб поставити рекорд!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 40l20-20M12 40l-4-4M34 14l6-6M28 8l12 12M32 20l-4-4\" stroke=\"#d946ef\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M40 40L20 20M36 40l4-4M14 14l-6-6M20 8L8 20M16 20l4-4\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Класс героя",
          "desc": "Выбери бойца: несокрушимый Страж, меткий Следопыт, Маг или скрытная Тень."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s14 4 14 14c0 14-14 22-14 22S10 32 10 18C10 8 24 4 24 4z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M24 12v16M16 20h16\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Манёвры и бой",
          "desc": "Уворачивайся от снарядов монстров и контратакуй в уязвимые моменты."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l12 14-12 22L12 18 24 4z\" fill=\"rgba(217,70,239,0.2)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 18h24M24 4v36\" stroke=\"#d946ef\" stroke-width=\"1.5\"/></svg>",
          "title": "Астральные осколки",
          "desc": "Собирай кристаллы с поверженных врагов для открытия новых классов и прокачки."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"20\" r=\"14\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><rect x=\"18\" y=\"32\" width=\"12\" height=\"8\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"19\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><circle cx=\"29\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><path d=\"M21 32v8M27 32v8\" stroke=\"#e0102e\" stroke-width=\"1.5\"/></svg>",
          "title": "Битва с Боссом",
          "desc": "Пройди волны подземелья и сокруши владыку глубин, чтобы поставить рекорд!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 40l20-20M12 40l-4-4M34 14l6-6M28 8l12 12M32 20l-4-4\" stroke=\"#d946ef\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M40 40L20 20M36 40l4-4M14 14l-6-6M20 8L8 20M16 20l4-4\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Hero Class",
          "desc": "Choose your hero: steadfast Guardian, sharp Ranger, arcane Mage, or stealthy Shade."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s14 4 14 14c0 14-14 22-14 22S10 32 10 18C10 8 24 4 24 4z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M24 12v16M16 20h16\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Dodges & Combat",
          "desc": "Dodge hostile projectiles and strike back when enemy defenses open up."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l12 14-12 22L12 18 24 4z\" fill=\"rgba(217,70,239,0.2)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 18h24M24 4v36\" stroke=\"#d946ef\" stroke-width=\"1.5\"/></svg>",
          "title": "Astral Shards",
          "desc": "Gather shards dropped by foes to unlock powerful new classes and talents."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"20\" r=\"14\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><rect x=\"18\" y=\"32\" width=\"12\" height=\"8\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"19\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><circle cx=\"29\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><path d=\"M21 32v8M27 32v8\" stroke=\"#e0102e\" stroke-width=\"1.5\"/></svg>",
          "title": "Boss Showdown",
          "desc": "Survive the waves and vanquish the dungeon boss to claim high scores!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 40l20-20M12 40l-4-4M34 14l6-6M28 8l12 12M32 20l-4-4\" stroke=\"#d946ef\" stroke-width=\"2.5\" stroke-linecap=\"round\"/><path d=\"M40 40L20 20M36 40l4-4M14 14l-6-6M20 8L8 20M16 20l4-4\" stroke=\"#22d3ee\" stroke-width=\"2.5\" stroke-linecap=\"round\"/></svg>",
          "title": "Heldenklasse",
          "desc": "Wähle deine Klasse: standhafter Wächter, Waldläufer, Magier oder Schatten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4s14 4 14 14c0 14-14 22-14 22S10 32 10 18C10 8 24 4 24 4z\" fill=\"rgba(34,211,238,0.15)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M24 12v16M16 20h16\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Ausweichen & Kampf",
          "desc": "Weiche Geschossen aus und greife im richtigen Moment entscheidend an."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l12 14-12 22L12 18 24 4z\" fill=\"rgba(217,70,239,0.2)\" stroke=\"#d946ef\" stroke-width=\"2\"/><path d=\"M12 18h24M24 4v36\" stroke=\"#d946ef\" stroke-width=\"1.5\"/></svg>",
          "title": "Astralsplitter",
          "desc": "Sammle Splitter besiegter Feinde, um neue Heldenklassen freizuschalten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"20\" r=\"14\" fill=\"rgba(224,16,46,0.15)\" stroke=\"#e0102e\" stroke-width=\"2\"/><rect x=\"18\" y=\"32\" width=\"12\" height=\"8\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"19\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><circle cx=\"29\" cy=\"20\" r=\"3\" fill=\"#e0102e\"/><path d=\"M21 32v8M27 32v8\" stroke=\"#e0102e\" stroke-width=\"1.5\"/></svg>",
          "title": "Bosskampf",
          "desc": "Überlebe die Monsterwellen und besiege den Endboss der Tiefe für neue Rekorde!"
        }
      ]
    },
    "full": {
      "uk": "Покроковий roguelike-екшен: вибери клас героя, рухайся ареною та відбивай атаки ворогів. Збирай астральні осколки, відкривай нові класи та перемагай могутнього Боса глибин.",
      "ru": "Пошаговый roguelike-экшен: выбери класс героя, маневрируй по арене и отбивай атаки монстров. Собирай астральные осколки, открывай новые классы и одолей могучего Босса глубин.",
      "en": "Turn-based roguelike action: choose your hero class, maneuver across the arena and defeat waves of monsters. Collect astral shards, unlock new classes and conquer the deep Boss.",
      "de": "Rundenbasiertes Roguelike-Actionspiel: Wähle deine Heldenklasse, manövriere über die Arena und wehre Monsterwellen ab. Sammle Astralsplitter, schalte neue Klassen frei und besiege den Tiefenboss."
    }
  },
  "space_invaders": {
    "title": {
      "uk": "🚀 Shuttle Cruiser — правила",
      "ru": "🚀 Shuttle Cruiser — правила",
      "en": "🚀 Shuttle Cruiser — Rules",
      "de": "🚀 Shuttle Cruiser — Regeln"
    },
    "steps": {
      "uk": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l8 18-4 4-4-2-4 2-4-4 8-18z\" fill=\"rgba(34,211,238,0.2)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M12 26l-6 8 8-2M36 26l6 8-8-2\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M22 28l2 8 2-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Твій шаттл",
          "desc": "Керуй винищувачем дотиком пальця або стрілками клавіатури (A/D)."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"14\" width=\"28\" height=\"18\" rx=\"4\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><circle cx=\"30\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><path d=\"M14 8l4 6M34 8l-4 6M16 32l-2 8M32 32l2 8\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Хвилі прибульців",
          "desc": "Знищуй ескадрильї ворогів, ухиляйся від лазерних залпів та астероїдів."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l3 12 12 3-12 3-3 12-3-12-12-3 12-3 3-12z\" fill=\"rgba(251,191,36,0.25)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/><circle cx=\"10\" cy=\"10\" r=\"2\" fill=\"#22d3ee\"/><circle cx=\"38\" cy=\"36\" r=\"2\" fill=\"#d946ef\"/></svg>",
          "title": "Зоряний пил",
          "desc": "Збирай сяючий пил для відкриття нових корпусів кораблів в ангарі."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M16 42V18l8-10 8 10v24\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><path d=\"M24 8v16M20 14h8\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M10 24l-4 4M38 24l4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Апгрейди зброї",
          "desc": "Підбирай підсилення в польоті: потрійний лазер, щити та мега-гармати!"
        }
      ],
      "ru": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l8 18-4 4-4-2-4 2-4-4 8-18z\" fill=\"rgba(34,211,238,0.2)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M12 26l-6 8 8-2M36 26l6 8-8-2\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M22 28l2 8 2-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Твой шаттл",
          "desc": "Управляй истребителем касанием пальца или стрелками клавиатуры (A/D)."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"14\" width=\"28\" height=\"18\" rx=\"4\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><circle cx=\"30\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><path d=\"M14 8l4 6M34 8l-4 6M16 32l-2 8M32 32l2 8\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Волны пришельцев",
          "desc": "Уничтожай армады вражеских кораблей, уворачивайся от лазеров и астероидов."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l3 12 12 3-12 3-3 12-3-12-12-3 12-3 3-12z\" fill=\"rgba(251,191,36,0.25)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/><circle cx=\"10\" cy=\"10\" r=\"2\" fill=\"#22d3ee\"/><circle cx=\"38\" cy=\"36\" r=\"2\" fill=\"#d946ef\"/></svg>",
          "title": "Звёздная пыль",
          "desc": "Собирай сияющую пыль для покупки новых корпусов и улучшений в ангаре."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M16 42V18l8-10 8 10v24\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><path d=\"M24 8v16M20 14h8\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M10 24l-4 4M38 24l4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Апгрейды оружия",
          "desc": "Подбирай бонусы в бою: тройные лазеры, щиты и плазменные залпы!"
        }
      ],
      "en": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l8 18-4 4-4-2-4 2-4-4 8-18z\" fill=\"rgba(34,211,238,0.2)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M12 26l-6 8 8-2M36 26l6 8-8-2\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M22 28l2 8 2-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Your Starship",
          "desc": "Pilot your cruiser with touch drag or keyboard arrow keys / A and D."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"14\" width=\"28\" height=\"18\" rx=\"4\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><circle cx=\"30\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><path d=\"M14 8l4 6M34 8l-4 6M16 32l-2 8M32 32l2 8\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Invader Waves",
          "desc": "Blast incoming alien formations while dodging enemy plasma fire and meteors."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l3 12 12 3-12 3-3 12-3-12-12-3 12-3 3-12z\" fill=\"rgba(251,191,36,0.25)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/><circle cx=\"10\" cy=\"10\" r=\"2\" fill=\"#22d3ee\"/><circle cx=\"38\" cy=\"36\" r=\"2\" fill=\"#d946ef\"/></svg>",
          "title": "Cosmic Dust",
          "desc": "Collect glowing dust particles to unlock new starship hulls in the hangar."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M16 42V18l8-10 8 10v24\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><path d=\"M24 8v16M20 14h8\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M10 24l-4 4M38 24l4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Weapon Powerups",
          "desc": "Catch live drops: spread lasers, defensive shields, and heavy blaster cannons!"
        }
      ],
      "de": [
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l8 18-4 4-4-2-4 2-4-4 8-18z\" fill=\"rgba(34,211,238,0.2)\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M12 26l-6 8 8-2M36 26l6 8-8-2\" stroke=\"#22d3ee\" stroke-width=\"2\" stroke-linejoin=\"round\"/><path d=\"M22 28l2 8 2-8\" stroke=\"#fbbf24\" stroke-width=\"2\"/></svg>",
          "title": "Dein Sternenschiff",
          "desc": "Steuere dein Shuttle per Touch oder Tastatur (Pfeiltasten / A und D)."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"14\" width=\"28\" height=\"18\" rx=\"4\" fill=\"rgba(34,197,94,0.15)\" stroke=\"#22c55e\" stroke-width=\"2\"/><circle cx=\"18\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><circle cx=\"30\" cy=\"22\" r=\"3\" fill=\"#22c55e\"/><path d=\"M14 8l4 6M34 8l-4 6M16 32l-2 8M32 32l2 8\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Invasorenwellen",
          "desc": "Zerstöre Alien-Formationen und weiche Lasersalven und Asteroiden aus."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 4l3 12 12 3-12 3-3 12-3-12-12-3 12-3 3-12z\" fill=\"rgba(251,191,36,0.25)\" stroke=\"#fbbf24\" stroke-width=\"1.5\"/><circle cx=\"10\" cy=\"10\" r=\"2\" fill=\"#22d3ee\"/><circle cx=\"38\" cy=\"36\" r=\"2\" fill=\"#d946ef\"/></svg>",
          "title": "Sternenstaub",
          "desc": "Sammle leuchtenden Staub, um neue Schiffshüllen im Hangar freizuschalten."
        },
        {
          "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M16 42V18l8-10 8 10v24\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><path d=\"M24 8v16M20 14h8\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M10 24l-4 4M38 24l4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
          "title": "Waffen-Powerups",
          "desc": "Sammle Power-ups im Flug: Dreifachlaser, Schutzschilde und Plasmageschosse!"
        }
      ]
    },
    "full": {
      "uk": "Аркадний космічний шутер: керуй винищувачем Shuttle Cruiser, збивай хвилі прибульців і збирай зоряний пил для прокачування гармат і корпусів в ангарі.",
      "ru": "Аркадный космический шутер: управляй крейсером Shuttle Cruiser, сбивай волны пришельцев и собирай космическую пыль для прокачки пушек и кораблей в ангаре.",
      "en": "Arcade space shooter: pilot your Shuttle Cruiser, blast through waves of alien invaders, and gather cosmic dust to upgrade weapons and starships in the hangar.",
      "de": "Arcade-Weltraum-Shooter: Steuere deinen Shuttle Cruiser, vernichte Wellen von Alien-Invasoren und sammle Sternenstaub für Waffen- und Schiffs-Upgrades im Hangar."
    }
  }
};

  const RULES_UI_STRINGS = {
    uk: {
      back: '← Назад',
      next: 'Далі →',
      done: 'Зрозуміло 👍',
      more: '📖 Докладніше',
      close: 'Закрити',
      step_of: (cur, tot) => `${cur} з ${tot}`
    },
    ru: {
      back: '← Назад',
      next: 'Дальше →',
      done: 'Понятно 👍',
      more: '📖 Подробнее',
      close: 'Закрыть',
      step_of: (cur, tot) => `${cur} из ${tot}`
    },
    en: {
      back: '← Back',
      next: 'Next →',
      done: 'Got it 👍',
      more: '📖 Details',
      close: 'Close',
      step_of: (cur, tot) => `${cur} of ${tot}`
    },
    de: {
      back: '← Zurück',
      next: 'Weiter →',
      done: 'Verstanden 👍',
      more: '📖 Details',
      close: 'Schließen',
      step_of: (cur, tot) => `${cur} von ${tot}`
    }
  };

  function getCurGameKey() {
    try {
      const p = (w.location.pathname || '').replace(/\/$/, '');
      const m = p.match(/\/games\/([a-z0-9_]+)$/i);
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

  function showRules(arg) {
    let cfg = {};
    let gameKey = '';

    if (typeof arg === 'string') {
      gameKey = arg.toLowerCase();
      cfg = RULES_DATA[gameKey] || {};
    } else if (Array.isArray(arg)) {
      gameKey = getCurGameKey() || 'game';
      cfg = { steps: arg };
    } else if (typeof arg === 'object' && arg !== null) {
      cfg = arg;
      gameKey = (cfg.game || getCurGameKey() || 'game').toLowerCase();
    } else {
      gameKey = getCurGameKey() || 'game';
      cfg = RULES_DATA[gameKey] || {};
    }

    const lang = getActiveLang();
    const uiTr = RULES_UI_STRINGS[lang] || RULES_UI_STRINGS.ru;

    let title = '';
    if (cfg.title) {
      title = (typeof cfg.title === 'object' ? (cfg.title[lang] || cfg.title.ru || cfg.title.en) : cfg.title);
    } else if (RULES_DATA[gameKey] && RULES_DATA[gameKey].title) {
      const t = RULES_DATA[gameKey].title;
      title = (typeof t === 'object' ? (t[lang] || t.ru || t.en) : t);
    } else {
      title = 'Правила игры';
    }

    let rawSteps = [];
    if (cfg.steps) {
      rawSteps = (typeof cfg.steps === 'object' && !Array.isArray(cfg.steps)) ? (cfg.steps[lang] || cfg.steps.ru || cfg.steps.en || []) : cfg.steps;
    } else if (RULES_DATA[gameKey] && RULES_DATA[gameKey].steps) {
      rawSteps = RULES_DATA[gameKey].steps[lang] || RULES_DATA[gameKey].steps.ru || RULES_DATA[gameKey].steps.en || [];
    }

    let fullRules = '';
    if (cfg.full) {
      fullRules = (typeof cfg.full === 'object' ? (cfg.full[lang] || cfg.full.ru || cfg.full.en) : cfg.full);
    } else if (cfg.fullRules) {
      fullRules = (typeof cfg.fullRules === 'object' ? (cfg.fullRules[lang] || cfg.fullRules.ru || cfg.fullRules.en) : cfg.fullRules);
    } else if (RULES_DATA[gameKey] && RULES_DATA[gameKey].full) {
      fullRules = RULES_DATA[gameKey].full[lang] || RULES_DATA[gameKey].full.ru || RULES_DATA[gameKey].full.en || '';
    }

    let modal = document.getElementById('rulesModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'rulesModal';
      document.body.appendChild(modal);
    }

    modal.className = 'rules-modal-overlay modal';
    modal.setAttribute('data-dismiss', 'backdrop');
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.setAttribute('aria-labelledby', 'rulesModalTitle');

    const totalSteps = Math.max(1, rawSteps.length);

    let slidesHtml = '';
    let dotsHtml = '';
    for (let i = 0; i < totalSteps; i++) {
      const st = rawSteps[i] || { icon: '🎯', title: '', desc: '' };
      const visHtml = st.svg || `<span style="font-size:36px;display:flex;align-items:center;justify-content:center">${st.icon || '🎯'}</span>`;
      slidesHtml += `
        <div class="rules-slide" role="group" aria-roledescription="slide" aria-label="${uiTr.step_of(i + 1, totalSteps)}" data-index="${i}">
          <div class="rules-visual" aria-hidden="true">${visHtml}</div>
          <h4 class="rules-slide-h">${esc(st.title || '')}</h4>
          <p class="rules-slide-p">${esc(st.desc || '')}</p>
        </div>
      `;
      dotsHtml += `
        <button type="button" class="rules-dot" data-step="${i}" aria-label="${uiTr.step_of(i + 1, totalSteps)}" ${i === 0 ? 'aria-current="true"' : ''}></button>
      `;
    }

    let fullAccordionHtml = '';
    if (fullRules) {
      fullAccordionHtml = `
        <details class="rules-details">
          <summary class="rules-summary">
            <span>${uiTr.more}</span>
            <span aria-hidden="true" style="font-size:11px;opacity:0.7">▼</span>
          </summary>
          <div class="rules-full-body">${fullRules}</div>
        </details>
      `;
    }

    modal.innerHTML = `
      <div class="rules-modal-box" role="document">
        <header class="rules-head">
          <h3 id="rulesModalTitle" class="rules-title">${esc(title)}</h3>
          <button type="button" class="rules-close" aria-label="${uiTr.close}" data-dismiss="backdrop">✕</button>
        </header>
        <div class="rules-carousel" role="region" aria-roledescription="carousel" aria-label="${esc(title)}">
          <div class="rules-track" tabindex="0" role="group" aria-label="${esc(title)}">
            ${slidesHtml}
          </div>
          <nav class="rules-dots" aria-label="Слайды">
            ${dotsHtml}
          </nav>
          <div class="rules-nav">
            <button type="button" class="rules-btn-prev btn-sec" style="opacity:0.35" disabled>${uiTr.back}</button>
            <button type="button" class="rules-btn-next btn-prim">${totalSteps === 1 ? uiTr.done : uiTr.next}</button>
          </div>
        </div>
        ${fullAccordionHtml}
      </div>
    `;

    const track = modal.querySelector('.rules-track');
    const dots = modal.querySelectorAll('.rules-dot');
    const prevBtn = modal.querySelector('.rules-btn-prev');
    const nextBtn = modal.querySelector('.rules-btn-next');
    let curIdx = 0;

    function syncState(idx) {
      curIdx = Math.max(0, Math.min(totalSteps - 1, idx));
      dots.forEach((d, i) => {
        if (i === curIdx) d.setAttribute('aria-current', 'true');
        else d.removeAttribute('aria-current');
      });
      if (curIdx === 0) {
        prevBtn.disabled = true;
        prevBtn.style.opacity = '0.35';
      } else {
        prevBtn.disabled = false;
        prevBtn.style.opacity = '1';
      }
      if (curIdx === totalSteps - 1) {
        nextBtn.textContent = uiTr.done;
      } else {
        nextBtn.textContent = uiTr.next;
      }
    }

    function scrollToIdx(idx) {
      if (!track) return;
      const w = track.offsetWidth || 1;
      track.scrollTo({ left: idx * w, behavior: 'smooth' });
      syncState(idx);
    }

    prevBtn.onclick = (e) => {
      e.stopPropagation();
      if (curIdx > 0) scrollToIdx(curIdx - 1);
    };

    nextBtn.onclick = (e) => {
      e.stopPropagation();
      if (curIdx < totalSteps - 1) {
        scrollToIdx(curIdx + 1);
      } else {
        try { localStorage.setItem('jg_rules_seen_' + gameKey, '1'); } catch (err) {}
        closeModalEl(modal);
      }
    };

    dots.forEach((d) => {
      d.onclick = (e) => {
        e.stopPropagation();
        const s = parseInt(d.getAttribute('data-step') || '0', 10);
        scrollToIdx(s);
      };
    });

    let scrollTimer = null;
    track.addEventListener('scroll', () => {
      if (scrollTimer) cancelAnimationFrame(scrollTimer);
      scrollTimer = requestAnimationFrame(() => {
        const w = track.offsetWidth || 1;
        const s = Math.round(track.scrollLeft / w);
        if (s !== curIdx) syncState(s);
      });
    }, { passive: true });

    track.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        if (curIdx < totalSteps - 1) scrollToIdx(curIdx + 1);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        if (curIdx > 0) scrollToIdx(curIdx - 1);
      }
    });

    const closeBtn = modal.querySelector('.rules-close');
    if (closeBtn) {
      closeBtn.onclick = (e) => {
        e.stopPropagation();
        try { localStorage.setItem('jg_rules_seen_' + gameKey, '1'); } catch (err) {}
        closeModalEl(modal);
      };
    }

    modal.__onDismiss = () => {
      try { localStorage.setItem('jg_rules_seen_' + gameKey, '1'); } catch (err) {}
    };

    modal.__prevFocus = (document.activeElement && document.activeElement !== document.body ? document.activeElement : (document.getElementById("rulesBtn") || document.activeElement));
    modal.__isAuto = false;
    modal.classList.remove('auto-mode');
    modal.classList.add('open');
    modal.style.display = 'flex';
    document.body.classList.add('modal-open');
    syncState(0);

    setTimeout(() => {
      if (nextBtn) {
        try { nextBtn.focus(); } catch (e) {}
      }
    }, 60);

    return modal;
  }

  let _userInteracted = false;
  try {
    ['pointerdown', 'mousedown', 'touchstart', 'keydown', 'input', 'focus'].forEach(ev => {
      document.addEventListener(ev, (e) => {
        const modal = document.getElementById('rulesModal');
        if (modal && modal.__isAuto && isModalOpen(modal)) {
          const box = modal.querySelector('.rules-modal-box');
          if (!box || !box.contains(e.target)) {
            closeModalEl(modal);
          }
        }
        _userInteracted = true;
      }, { capture: true, passive: true });
    });
  } catch (e) {}

  function checkAutoRules(gameKey) {
    if (!gameKey) {
      gameKey = getCurGameKey();
    }
    if (!gameKey || !RULES_DATA[gameKey]) return;
    const seenKey = 'jg_rules_seen_' + gameKey;
    try {
      if (localStorage.getItem(seenKey)) return;
      if (w.location.search && /[?&](code|join)=/i.test(w.location.search)) return;
      setTimeout(() => {
        if (localStorage.getItem(seenKey)) return;
        if (_userInteracted) return;
        if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) return;
        const lc = document.getElementById('lcode') || document.getElementById('roomcode') || document.getElementById('roomCode');
        if (lc && lc.textContent.trim().length >= 4) return;
        const m = showRules(gameKey);
        if (m) {
          m.__isAuto = true;
          m.classList.add('auto-mode');
        }
      }, 800);
    } catch (e) {}
  }

  function autoInitRules() {
    const game = getCurGameKey();
    if (!game) return;
    const btn = document.getElementById('rulesBtn');
    if (btn && RULES_DATA[game]) {
      btn.onclick = (e) => {
        e.preventDefault();
        showRules(game);
      };
    }
    checkAutoRules(game);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', autoInitRules);
  } else {
    autoInitRules();
  }


  w.LobbyUI = {
    esc,
    vibrate,
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
    checkAutoRules,
    RULES_DATA
  };
})(window);
