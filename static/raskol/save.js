/* Раскол — сохранение: localStorage + облако (/api/arcade/save/raskol). */
(function (global) {
  'use strict';
  const LS_KEY = 'raskol_save_v1';
  const API = '/games/api/arcade/save/raskol';
  const DEBUG_RUN = /[?&]debug=1\b/.test(global.location ? global.location.search : '');

  function defaults() {
    // max_galaxy = глава, max_sector = лучшая комната (так их понимает таблица рекордов на сервере)
    return { v: 1, shards: 0, best_score: 0, max_galaxy: 1, max_sector: 1, runs: 0, wins: 0, kills: 0, best_time: 0, selected: 'guard', classes: ['guard'], ts: 0 };
  }

  function normClasses(arr) {
    const out = new Set(['guard']);
    if (Array.isArray(arr)) for (const id of arr) if (typeof id === 'string' && id) out.add(id);
    return Array.from(out);
  }

  function loadLocal() {
    let s = defaults();
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) { const p = JSON.parse(raw); if (p && typeof p === 'object') s = { ...s, ...p }; }
    } catch (_) {}
    s.classes = normClasses(s.classes);
    return s;
  }

  function saveLocal(s) {
    if (DEBUG_RUN) return;
    s.classes = normClasses(s.classes);
    s.ts = Date.now();
    try { localStorage.setItem(LS_KEY, JSON.stringify(s)); } catch (_) {}
  }

  // Прогресс только растёт (max); осколки тратятся — берём из более свежего сохранения.
  function merge(a, b) {
    if (!b || typeof b !== 'object') return a;
    const newer = (Number(b.ts) || 0) > (Number(a.ts) || 0) ? b : a;
    const out = { ...defaults(), ...a, ...b, ...newer };
    out.shards = Math.max(0, Number(newer.shards) || 0);
    out.classes = normClasses([...(a.classes || []), ...(b.classes || [])]);
    for (const k of ['best_score', 'runs', 'wins', 'kills']) out[k] = Math.max(Number(a[k]) || 0, Number(b[k]) || 0);
    const stage = s => (Number(s.max_galaxy) || 1) * 100 + (Number(s.max_sector) || 1);
    const far = stage(a) >= stage(b) ? a : b;
    out.max_galaxy = far.max_galaxy || 1; out.max_sector = far.max_sector || 1;
    const bt = [a.best_time, b.best_time].map(Number).filter(x => x > 0);
    out.best_time = bt.length ? Math.min(...bt) : 0;
    return out;
  }

  function isAuthUser() {
    try { return !!localStorage.getItem('jg_auth_user'); } catch (_) { return false; }
  }

  async function syncOnBoot() {
    let cur = loadLocal();
    if (!isAuthUser()) return cur;
    try {
      const res = await fetch(API, { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.data) { cur = merge(cur, j.data); saveLocal(cur); }
        await pushCloud(cur);
      } else if (res.status === 401) {
        try { localStorage.removeItem('jg_auth_user'); } catch (_) {}
      }
    } catch (_) {}
    return cur;
  }

  async function pushCloud(s) {
    if (DEBUG_RUN) return;
    saveLocal(s);
    if (!isAuthUser()) return;
    try {
      const res = await fetch(API, { method: 'PUT', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
      if (res && res.status === 401) {
        try { localStorage.removeItem('jg_auth_user'); } catch (_) {}
      }
    } catch (_) {}
  }

  // Итог забега → обновить сохранение
  function recordRun(s, r) {
    s.runs = (s.runs || 0) + 1;
    s.kills = (s.kills || 0) + r.kills;
    s.shards = (s.shards || 0) + r.shards;
    const isRecord = r.score > (s.best_score || 0);
    s.best_score = Math.max(s.best_score || 0, r.score);
    if (r.room > (s.max_sector || 1)) s.max_sector = r.room;
    if (r.win) { s.wins = (s.wins || 0) + 1; if (!s.best_time || r.time < s.best_time) s.best_time = Math.round(r.time); }
    return isRecord;
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/games/api/arcade/leaderboard/raskol', { credentials: 'include' });
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j.entries) ? j.entries : [];
    } catch (_) { return []; }
  }

  global.RASKOL_SAVE = { loadLocal, saveLocal, merge, syncOnBoot, pushCloud, recordRun, fetchLeaderboard, DEBUG_RUN };
})(window);
