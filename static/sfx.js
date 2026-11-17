/* Lobby.gg — Web Audio API SFX Engine (Zero external assets) */
(function() {
  'use strict';

  let audioCtx = null;
  let userInteracted = false;

  function isSoundMuted() {
    try {
      const jg = localStorage.getItem('jg_sound');
      if (jg === '0' || jg === 'false') return true;
      if (jg === '1' || jg === 'true') return false;
      return localStorage.getItem('jarvis_sfx_muted') === 'true';
    } catch (e) {
      return false;
    }
  }

  let muted = isSoundMuted();

  function unlockAudio() {
    userInteracted = true;
    if (!audioCtx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      } catch (e) {}
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(ev => {
      window.removeEventListener(ev, unlockAudio, true);
    });
  }
  ['pointerdown', 'touchstart', 'click', 'keydown'].forEach(ev => {
    window.addEventListener(ev, unlockAudio, { capture: true, passive: true });
  });

  function getAudioContext() {
    const hasGesture = userInteracted || (navigator.userActivation && navigator.userActivation.hasBeenActive);
    if (!hasGesture) return null;
    if (!audioCtx) {
      try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (AudioContext) audioCtx = new AudioContext();
      } catch (e) {
        return null;
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
    return audioCtx;
  }

  function syncButtons() {
    try {
      const isOff = muted;
      document.querySelectorAll('#sfx-toggle, .sfx-toggle, #nav-btn-sound, [data-sfx-toggle]').forEach(btn => {
        if (btn.hasAttribute('aria-checked')) btn.setAttribute('aria-checked', isOff ? 'false' : 'true');
        if (btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', isOff ? 'false' : 'true');
        btn.setAttribute('title', isOff ? 'Звук: выкл' : 'Звук: вкл');
        btn.setAttribute('aria-label', isOff ? 'Звук: выкл' : 'Звук: вкл');
        if (btn.id === 'nav-btn-sound') {
          btn.innerHTML = isOff ? '🔇' : '🔊';
        } else if (btn.id === 'sfx-toggle' || btn.classList.contains('sfx-toggle')) {
          btn.textContent = isOff ? '🔇' : '🔊';
        }
      });
      const sw1 = document.getElementById('set-sound-sw');
      if (sw1) sw1.setAttribute('aria-checked', isOff ? 'false' : 'true');
      const sw2 = document.getElementById('acc-sound-sw');
      if (sw2) sw2.setAttribute('aria-checked', isOff ? 'false' : 'true');
    } catch (e) {}
  }

  function setMuted(val) {
    muted = !!val;
    try {
      localStorage.setItem('jg_sound', muted ? '0' : '1');
      localStorage.setItem('jarvis_sfx_muted', muted ? 'true' : 'false');
    } catch (e) {}
    syncButtons();
    try {
      window.dispatchEvent(new CustomEvent('lobbysfxchange', { detail: { muted } }));
    } catch (e) {}
    return muted;
  }

  window.sfx = {
    isMuted: () => muted,
    setMuted: setMuted,
    toggleMute: () => setMuted(!muted),
    playTone: (freq, type = 'sine', duration = 0.08, vol = 0.04, freqEnd = null) => {
      if (muted) return;
      try {
        const ctx = getAudioContext();
        if (!ctx || ctx.state === 'suspended') return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type;
        const t0 = ctx.currentTime;
        osc.frequency.setValueAtTime(freq, t0);
        if (freqEnd && freqEnd > 0) {
          osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), t0 + duration);
        }
        // Smooth click-free attack and exponential decay
        gain.gain.setValueAtTime(0.0001, t0);
        const attack = Math.min(0.006, duration * 0.2);
        gain.gain.linearRampToValueAtTime(vol, t0 + attack);
        gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t0);
        osc.stop(t0 + duration);
      } catch (e) {}
    },
    click: function() { this.playTone(550, 'sine', 0.04, 0.04, 380); },
    move: function() { this.playTone(320, 'triangle', 0.06, 0.04, 450); },
    flip: function() { this.playTone(380, 'sine', 0.05, 0.04, 620); },
    deal: function() { this.playTone(500, 'sine', 0.04, 0.035, 750); },
    win: function() {
      if (muted) return;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.16, 0.05), idx * 80);
      });
    },
    lose: function() {
      if (muted) return;
      [320, 270, 220, 180].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.18, 0.04), idx * 90);
      });
    },
    tick: function() { this.playTone(720, 'sine', 0.025, 0.03); },
    error: function() { this.playTone(180, 'sawtooth', 0.10, 0.04, 130); },
    err: function() { this.error(); },
    sync: syncButtons
  };

  window.addEventListener('storage', (e) => {
    if (e.key === 'jg_sound' || e.key === 'jarvis_sfx_muted') {
      muted = isSoundMuted();
      syncButtons();
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', syncButtons);
  } else {
    syncButtons();
  }

  document.addEventListener('click', (e) => {
    const sfxBtn = e.target.closest('#sfx-toggle, .sfx-toggle, #nav-btn-sound, [data-sfx-toggle]');
    if (sfxBtn) {
      e.preventDefault();
      window.sfx.toggleMute();
      return;
    }
    const target = e.target.closest('button, a, .btn, .game, [data-sfx]');
    if (target && !target.dataset.noSfx) {
      if (target.dataset.sfx && window.sfx[target.dataset.sfx]) {
        window.sfx[target.dataset.sfx]();
      } else {
        window.sfx.click();
      }
    }
  });
})();
