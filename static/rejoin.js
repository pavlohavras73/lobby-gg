/**
 * Lobby.gg Rejoin System (LobbyRejoin)
 * Automatically restores player's room session on page reload.
 *
 * Requirements:
 * - Persist {game, code, name, ts} in sessionStorage upon room entry.
 * - TTL = 2 hours.
 * - Auto-trigger join upon reload with same code and name.
 * - Suppress flurry of entrance animations on reconnect.
 * - Remove stored session on exit, game over, or "room not found" error.
 */
(function(window) {
  'use strict';

  const TTL_MS = 2 * 60 * 60 * 1000; // 2 hours
  const PREFIX = 'lobby_rejoin_';
  const STATE_PREFIX = 'lobby_state_';
  let _rejoining = false;

  function norm(g) {
    return String(g || '').toLowerCase().trim();
  }

  function getKey(g) {
    return PREFIX + norm(g);
  }

  function getStateKey(g) {
    return STATE_PREFIX + norm(g);
  }

  function save(game, code, name) {
    if (!game || !code) return;
    try {
      const g = norm(game);
      const c = String(code).toUpperCase().trim();
      const n = String(name || '').trim();
      const data = { game: g, code: c, name: n, ts: Date.now() };
      sessionStorage.setItem(getKey(g), JSON.stringify(data));
      // Also keep legacy key synced for backwards compatibility
      sessionStorage.setItem('jg_' + g + '_code', c);
    } catch (_) {}
  }

  function get(game) {
    if (!game) return null;
    try {
      const g = norm(game);
      const raw = sessionStorage.getItem(getKey(g));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.code || !data.ts) {
        clear(game);
        return null;
      }
      if (Date.now() - data.ts > TTL_MS) {
        clear(game);
        return null;
      }
      return data;
    } catch (_) {
      clear(game);
      return null;
    }
  }

  function getCode(game) {
    const d = get(game);
    return d ? d.code : '';
  }

  function clear(game) {
    if (!game) return;
    try {
      const g = norm(game);
      sessionStorage.removeItem(getKey(g));
      sessionStorage.removeItem(getStateKey(g));
      sessionStorage.removeItem('jg_' + g + '_code');
    } catch (_) {}
  }

  function isRejoining() {
    return _rejoining;
  }

  function setRejoining(val) {
    _rejoining = !!val;
  }

  function isRoomNotFoundError(msg) {
    if (!msg) return false;
    const str = String(msg).toLowerCase();
    return str.includes('не найдена') ||
           str.includes('not found') ||
           str.includes('nicht gefunden') ||
           str.includes('не знайдена') ||
           str.includes('не знайдено') ||
           str.includes('room_not_found');
  }

  // Client-state games (like geobunker)
  function saveState(game, state) {
    if (!game || !state) return;
    try {
      const g = norm(game);
      const data = { game: g, state: state, ts: Date.now() };
      sessionStorage.setItem(getStateKey(g), JSON.stringify(data));
    } catch (_) {}
  }

  function getState(game) {
    if (!game) return null;
    try {
      const g = norm(game);
      const raw = sessionStorage.getItem(getStateKey(g));
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !data.state || !data.ts) {
        clear(game);
        return null;
      }
      if (Date.now() - data.ts > TTL_MS) {
        clear(game);
        return null;
      }
      return data.state;
    } catch (_) {
      clear(game);
      return null;
    }
  }

  /**
   * Helper to automatically rejoin room on page load
   * @param {string} game
   * @param {function} joinFn (code, name) => void
   * @returns {boolean} true if auto-join was dispatched
   */
  function autoJoin(game, joinFn) {
    const urlParams = new URLSearchParams(window.location.search);
    const urlCode = (urlParams.get('code') || '').trim();
    if (urlCode) {
      // URL has explicit code parameter; let standard flow handle it
      return false;
    }

    const saved = get(game);
    if (!saved || !saved.code) return false;

    // Fill inputs if present
    const codeInp = document.getElementById('joincode');
    if (codeInp && !codeInp.value) {
      codeInp.value = saved.code;
    }
    const nameInp = document.getElementById('name');
    if (nameInp && saved.name && !nameInp.value) {
      nameInp.value = saved.name;
    }

    if (typeof joinFn === 'function') {
      _rejoining = true;
      try {
        joinFn(saved.code, saved.name);
      } catch (err) {
        console.warn('[LobbyRejoin] autoJoin error:', err);
        _rejoining = false;
        return false;
      }
      // Keep rejoining flag true briefly to silence entrance fanfare
      setTimeout(function() {
        _rejoining = false;
      }, 1500);
      return true;
    }
    return false;
  }

  window.LobbyRejoin = {
    save: save,
    get: get,
    getCode: getCode,
    clear: clear,
    isRejoining: isRejoining,
    setRejoining: setRejoining,
    isRoomNotFoundError: isRoomNotFoundError,
    saveState: saveState,
    getState: getState,
    autoJoin: autoJoin
  };

})(typeof window !== 'undefined' ? window : this);
