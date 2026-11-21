/**
 * Lobby.gg — App Shell Engine (Slim Core & Lazy Drawer Loader)
 * Fast initial paint: Sound/Vibe, Recent games, Toast and Lazy Drawer loading.
 * Zero external dependencies.
 */
(function () {
  'use strict';

  // ═══════════ TRANSLATION HELPERS ═══════════
  const SHELL_CORE_I18N = {
    uk: {
      sh_sound: 'Звук',
      sh_vibe: 'Вібрація',
      set_vibe_sub: 'Тактильний відгук у лобі та іграх',
      set_vibe_na: 'недоступно на цьому пристрої'
    },
    ru: {
      sh_sound: 'Звук',
      sh_vibe: 'Вибрация',
      set_vibe_sub: 'Тактильный отклик в лобби и играх',
      set_vibe_na: 'недоступно на этом устройстве'
    },
    en: {
      sh_sound: 'Sound',
      sh_vibe: 'Vibration',
      set_vibe_sub: 'Haptic feedback in lobby and games',
      set_vibe_na: 'not available on this device'
    },
    de: {
      sh_sound: 'Ton',
      sh_vibe: 'Vibration',
      set_vibe_sub: 'Haptisches Feedback in Lobby und Spielen',
      set_vibe_na: 'auf diesem Gerät nicht verfügbar'
    }
  };

  function getLang() {
    let l = null;
    try { l = localStorage.getItem('jg_lang'); } catch (e) {}
    if (!SHELL_CORE_I18N[l]) {
      const nl = (navigator.language || 'en').slice(0, 2).toLowerCase();
      l = nl === 'uk' ? 'uk' : (nl === 'ru' ? 'ru' : (nl === 'de' ? 'de' : 'en'));
    }
    return l;
  }

  function tr(key) {
    const l = getLang();
    if (window.t && typeof window.t === 'function') {
      const v = window.t(key);
      if (v && v !== key) return v;
    }
    return (SHELL_CORE_I18N[l] && SHELL_CORE_I18N[l][key]) || (SHELL_CORE_I18N.en && SHELL_CORE_I18N.en[key]) || key;
  }

  // ═══════════ TOAST ═══════════
  let toastTimer = null;
  function showToast(text) {
    const el = document.getElementById('lgToast');
    if (!el) return;
    el.textContent = text;
    el.classList.add('on');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('on');
    }, 2200);
  }

  // ═══════════ SOUND & VIBRATION ═══════════
  function isSoundOn() {
    try {
      if (window.sfx && typeof window.sfx.isMuted === 'function') {
        return !window.sfx.isMuted();
      }
      const s = localStorage.getItem('jg_sound');
      if (s === '0' || s === 'false') return false;
      if (localStorage.getItem('jarvis_sfx_muted') === 'true') return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function syncSoundUI(soundOn) {
    if (soundOn === undefined) soundOn = isSoundOn();
    const s1 = document.getElementById('acc-sound-sw');
    if (s1) s1.setAttribute('aria-checked', soundOn ? 'true' : 'false');
    const s2 = document.getElementById('set-sound-sw');
    if (s2) s2.setAttribute('aria-checked', soundOn ? 'true' : 'false');
    const btn = document.getElementById('nav-btn-sound');
    if (btn) {
      btn.innerHTML = soundOn ? '<span>🔊</span>' : '<span>🔇</span>';
      const label = (tr('sh_sound') || 'Sound') + (soundOn ? ': ON' : ': OFF');
      btn.setAttribute('title', label);
      btn.setAttribute('aria-label', label);
    }
  }

  function toggleSound() {
    if (window.sfx && typeof window.sfx.toggleMute === 'function') {
      const muted = window.sfx.toggleMute();
      syncSoundUI(!muted);
    } else {
      const nextOn = !isSoundOn();
      try {
        localStorage.setItem('jg_sound', nextOn ? '1' : '0');
        localStorage.setItem('jarvis_sfx_muted', nextOn ? 'false' : 'true');
      } catch (e) {}
      syncSoundUI(nextOn);
    }
  }

  function isVibeSupported() {
    if (window.LobbyUI && typeof window.LobbyUI.isVibrationSupported === 'function') {
      return window.LobbyUI.isVibrationSupported();
    }
    try {
      return typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function' && !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
    } catch (e) {
      return false;
    }
  }

  function isVibeOn() {
    if (!isVibeSupported()) return false;
    try {
      if (window.LobbyUI && typeof window.LobbyUI.isVibrationEnabled === 'function') {
        return window.LobbyUI.isVibrationEnabled();
      }
      const v = localStorage.getItem('jg_vibrate');
      if (v === '0' || v === 'false') return false;
      if (localStorage.getItem('jarvis_haptics_off') === 'true') return false;
      return true;
    } catch (e) {
      return true;
    }
  }

  function syncVibeUI(vibeOn) {
    const supported = isVibeSupported();
    const btn = document.getElementById('nav-btn-vibe');
    if (btn) {
      if (!supported) {
        btn.style.display = 'none';
      } else {
        btn.style.display = '';
        if (vibeOn === undefined) vibeOn = isVibeOn();
        btn.innerHTML = vibeOn ? '<span>📳</span>' : '<span>📴</span>';
        const label = (tr('sh_vibe') || 'Vibration') + (vibeOn ? ': ON' : ': OFF');
        btn.setAttribute('title', label);
        btn.setAttribute('aria-label', label);
      }
    }
    const sw = document.getElementById('set-vibe-sw');
    const subEls = document.querySelectorAll('#shell [data-i18n="set_vibe_sub"], .set-row [data-i18n="set_vibe_sub"], #shell [data-i18n="set_vibe_na"], .set-row [data-i18n="set_vibe_na"]');
    if (sw) {
      if (!supported) {
        sw.disabled = true;
        sw.setAttribute('aria-disabled', 'true');
        sw.setAttribute('aria-checked', 'false');
        sw.classList.add('disabled');
        subEls.forEach(el => {
          el.setAttribute('data-i18n', 'set_vibe_na');
          el.textContent = tr('set_vibe_na') || 'not available on this device';
        });
      } else {
        sw.disabled = false;
        sw.removeAttribute('aria-disabled');
        sw.classList.remove('disabled');
        if (vibeOn === undefined) vibeOn = isVibeOn();
        sw.setAttribute('aria-checked', vibeOn ? 'true' : 'false');
        subEls.forEach(el => {
          el.setAttribute('data-i18n', 'set_vibe_sub');
          el.textContent = tr('set_vibe_sub') || 'Haptic feedback in lobby and games';
        });
      }
    }
  }

  function toggleVibe() {
    if (!isVibeSupported()) return false;
    if (window.LobbyUI && typeof window.LobbyUI.toggleVibration === 'function') {
      const on = window.LobbyUI.toggleVibration();
      syncVibeUI(on);
      return on;
    }
    const nextOn = !isVibeOn();
    try {
      localStorage.setItem('jg_vibrate', nextOn ? '1' : '0');
      localStorage.setItem('jarvis_haptics_off', nextOn ? 'false' : 'true');
    } catch (e) {}
    syncVibeUI(nextOn);
    try {
      window.dispatchEvent(new CustomEvent('lobbyvibechange', { detail: { enabled: nextOn } }));
    } catch (e) {}
    return nextOn;
  }

  // ═══════════ LAZY DRAWER LOADER ═══════════
  let drawerPromise = null;
  function ensureDrawerLoaded() {
    if (window.__LobbyShellDrawer) return Promise.resolve(window.__LobbyShellDrawer);
    if (!drawerPromise) {
      drawerPromise = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = '/games/static/shell_drawer.js';
        s.onload = function () {
          if (window.__LobbyShellDrawer) {
            resolve(window.__LobbyShellDrawer);
          } else {
            reject(new Error('Drawer module missing'));
          }
        };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return drawerPromise;
  }

  function openDrawer(tab) {
    return ensureDrawerLoaded().then(function (d) {
      return d.open(tab);
    });
  }

  function closeDrawer() {
    if (window.__LobbyShellDrawer) {
      window.__LobbyShellDrawer.close();
    }
  }

  function switchTab(tab) {
    return ensureDrawerLoaded().then(function (d) {
      return d.switchTab(tab);
    });
  }

  function refreshProfile() {
    if (window.__LobbyShellDrawer) {
      window.__LobbyShellDrawer.refreshProfile();
    }
  }

  function refreshFriends() {
    if (window.__LobbyShellDrawer) {
      window.__LobbyShellDrawer.refreshFriends();
    }
  }

  // ═══════════ RECENT GAMES TRACKING (Stage 12a) ═══════════
  function normalizeGameSlug(raw) {
    if (!raw) return '';
    let s = String(raw).trim().toLowerCase();
    s = s.replace(/^\/games\//, '').replace(/^\//, '').replace(/\.html$/, '').replace(/[?#].*$/, '').replace(/\/$/, '');
    if (!s || ['index', 'admin', 'login', 'leaderboard', 'learn', 'profile', 'static', 'api'].includes(s)) return '';
    return s;
  }

  function recordRecentGame(rawSlug) {
    const slug = normalizeGameSlug(rawSlug);
    if (!slug) return;
    try {
      let rec = [];
      try { rec = JSON.parse(localStorage.getItem('jg_recent') || '[]'); } catch (e) { rec = []; }
      if (!Array.isArray(rec)) rec = [];
      rec = rec.filter(x => x && x !== slug);
      rec.unshift(slug);
      if (rec.length > 4) rec = rec.slice(0, 4);
      localStorage.setItem('jg_recent', JSON.stringify(rec));
    } catch (e) {}
  }

  function getRecentGames() {
    try {
      const rec = JSON.parse(localStorage.getItem('jg_recent') || '[]');
      return Array.isArray(rec) ? rec.slice(0, 4) : [];
    } catch (e) {
      return [];
    }
  }

  function autoRecordCurrentGame() {
    try {
      const p = window.location.pathname || '';
      const m = p.match(/\/games\/([a-z0-9_]+)/i);
      if (m && m[1]) {
        recordRecentGame(m[1]);
      }
    } catch (e) {}
  }

  // ═══════════ NAVIGATION EVENTS WIRING ═══════════
  function setupEvents() {
    document.addEventListener('click', function (e) {
      const sfxBtn = e.target.closest('#nav-btn-sound');
      if (sfxBtn) {
        e.preventDefault();
        toggleSound();
        return;
      }

      const vibeBtn = e.target.closest('#nav-btn-vibe');
      if (vibeBtn) {
        e.preventDefault();
        toggleVibe();
        return;
      }

      const navBtn = e.target.closest('#navIc button, #dock button');
      if (navBtn && navBtn.dataset.tab) {
        e.preventDefault();
        openDrawer(navBtn.dataset.tab);
        return;
      }

      const pc = e.target.closest('.profile-card');
      if (pc) {
        e.preventDefault();
        openDrawer('account');
        return;
      }

      const heroLink = e.target.closest('a[href="/games/profile"]');
      if (heroLink) {
        e.preventDefault();
        openDrawer('friends');
      }
    });

    document.querySelectorAll('#navIc button[data-tab], #dock button[data-tab]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        openDrawer(btn.dataset.tab);
      });
    });
  }

  // ═══════════ REDUCED MOTION (Eager for A11y) ═══════════
  function initReducedMotion() {
    let rm = false;
    try {
      const stored = localStorage.getItem('jg_rm');
      if (stored !== null) {
        rm = stored === '1';
      } else {
        rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      }
    } catch (e) {}

    document.documentElement.classList.toggle('rm', rm);
    const sw = document.getElementById('set-rm-sw');
    if (sw) sw.setAttribute('aria-checked', rm ? 'true' : 'false');
  }

  // ═══════════ PWA INSTALL EARLY INTERCEPTION ═══════════
  window.addEventListener('beforeinstallprompt', function (e) {
    try { e.preventDefault(); } catch (_) {}
    window.__jgInstallEvt = e;
  });
  window.addEventListener('appinstalled', function () {
    window.__jgInstallEvt = null;
  });

  // ═══════════ IDLE DRAWER PRELOAD ═══════════
  function scheduleIdleDrawerLoad() {
    if (typeof window.requestIdleCallback === 'function') {
      window.requestIdleCallback(function () {
        ensureDrawerLoaded();
      }, { timeout: 1500 });
    } else {
      setTimeout(function () {
        ensureDrawerLoaded();
      }, 200);
    }
  }

  if (document.readyState === 'complete') {
    scheduleIdleDrawerLoad();
  } else {
    window.addEventListener('load', scheduleIdleDrawerLoad);
  }

  // ═══════════ INITIALIZATION ═══════════
  function init() {
    initReducedMotion();
    syncSoundUI();
    syncVibeUI();
    autoRecordCurrentGame();
    setupEvents();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose API for external callers / console
  window.LobbyShell = {
    open: openDrawer,
    close: closeDrawer,
    switchTab: switchTab,
    toast: showToast,
    refreshProfile: refreshProfile,
    refreshFriends: refreshFriends,
    recordRecent: recordRecentGame,
    getRecent: getRecentGames,
    toggleSound: toggleSound,
    toggleVibe: toggleVibe,
    isSoundOn: isSoundOn,
    isVibeOn: isVibeOn,
    isVibeSupported: isVibeSupported
  };
})();
