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

  function vibrate(pattern) {
    try {
      if (reducedMotion()) return;
      if (localStorage.getItem('jarvis_haptics_off') === 'true') return;
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
    if (typeof m.close === 'function') {
      try { m.close(); } catch (e) {}
    }
    m.classList.remove('open', 'on');
    if (m.style.display && m.style.display !== 'none') {
      m.style.display = 'none';
    }
    if (m.__prevFocus && typeof m.__prevFocus.focus === 'function') {
      try { m.__prevFocus.focus(); } catch (e) {}
      m.__prevFocus = null;
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
            m.__prevFocus = document.activeElement;
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

  w.LobbyUI = {
    esc,
    vibrate,
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
    syncA11yLabels
  };
})(window);
