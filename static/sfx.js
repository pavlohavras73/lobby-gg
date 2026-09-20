/* Jarvis Games — Web Audio API SFX Engine (Zero external assets) */
(function() {
  let audioCtx = null;
  let muted = localStorage.getItem('jarvis_sfx_muted') === 'true';

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        audioCtx = new AudioContext();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    return audioCtx;
  }

  window.sfx = {
    isMuted: () => muted,
    toggleMute: () => {
      muted = !muted;
      localStorage.setItem('jarvis_sfx_muted', muted);
      const btn = document.getElementById('sfx-toggle');
      if (btn) btn.textContent = muted ? '🔇' : '🔊';
      return muted;
    },
    playTone: (freq, type, duration, vol = 0.08, freqEnd = null) => {
      if (muted) return;
      try {
        const ctx = getAudioContext();
        if (!ctx) return;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = type || 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        if (freqEnd) {
          osc.frequency.exponentialRampToValueAtTime(freqEnd, ctx.currentTime + duration);
        }
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration);
      } catch (e) {}
    },
    click: function() { this.playTone(600, 'sine', 0.05, 0.05, 400); },
    move: function() { this.playTone(350, 'triangle', 0.08, 0.06, 500); },
    flip: function() { this.playTone(400, 'sine', 0.06, 0.06, 700); },
    win: function() {
      if (muted) return;
      [440, 554.37, 659.25, 880].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'triangle', 0.2, 0.08), idx * 100);
      });
    },
    lose: function() {
      if (muted) return;
      [300, 260, 220, 180].forEach((freq, idx) => {
        setTimeout(() => this.playTone(freq, 'sawtooth', 0.25, 0.06), idx * 120);
      });
    },
    tick: function() { this.playTone(800, 'sine', 0.03, 0.04); },
    error: function() { this.playTone(180, 'sawtooth', 0.15, 0.08, 140); }
  };

  document.addEventListener('click', (e) => {
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
