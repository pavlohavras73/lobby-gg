/* Shuttle Cruiser 2.0 — Cloud & LocalStorage save synchronization */
(function (global) {
  'use strict';

  const LS_KEY = 'shuttle_save_v2';
  const OLD_COINS_KEY = 'si_coins';

  function defaultSave() {
    return {
      v: 2,
      dust: 0,
      best_score: 0,
      max_galaxy: 1,
      max_sector: 1,
      selected_ship: 'spark',
      ships: ['spark'],
      stars: {},          // "1-1": 1..3
      ship_upgrades: {},  // shipId: { hp: 0, dmg: 0, rate: 0 }
      migrated_coins: false
    };
  }

  function loadLocal() {
    let s = defaultSave();
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const p = JSON.parse(raw);
        if (p && typeof p === 'object') s = { ...s, ...p };
      }
      if (!s.migrated_coins) {
        const oldCoins = parseInt(localStorage.getItem(OLD_COINS_KEY) || '0', 10);
        if (oldCoins > 0) s.dust += Math.min(2000, oldCoins);
        s.migrated_coins = true;
        localStorage.setItem(LS_KEY, JSON.stringify(s));
      }
    } catch (_) {}
    if (!Array.isArray(s.ships) || !s.ships.includes('spark')) s.ships = ['spark'];
    if (!s.stars || typeof s.stars !== 'object') s.stars = {};
    return s;
  }

  function saveLocal(s) {
    s.ts = Date.now();   // время изменения: валюта и выбор корабля берутся из более свежего сохранения
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(s));
    } catch (_) {}
  }

  // Прогресс (рекорд, сектора, звёзды, корабли, уровни улучшений) только растёт — берём максимум/объединение.
  // Пыль ТРАТИТСЯ — её (и выбранный корабль) берём из более свежего сохранения, иначе max() возвращает
  // потраченное на другом устройстве.
  function mergeSaves(a, b) {
    if (!b || typeof b !== 'object') return a;
    const newer = (Number(b.ts) || 0) > (Number(a.ts) || 0) ? b : a;
    const older = newer === a ? b : a;
    const out = { ...defaultSave(), ...older, ...newer };
    out.dust = Math.max(0, Number(newer.dust) || 0);
    out.best_score = Math.max(a.best_score || 0, b.best_score || 0);
    const stage = s => (Number(s.max_galaxy) || 1) * 100 + (Number(s.max_sector) || 1);
    const far = stage(a) >= stage(b) ? a : b;    // галактику и сектор сравниваем парой, не по отдельности
    out.max_galaxy = far.max_galaxy || 1;
    out.max_sector = far.max_sector || 1;
    const ups = {};
    for (const src of [a.ship_upgrades || {}, b.ship_upgrades || {}]) {
      for (const [ship, st] of Object.entries(src)) {
        if (!st || typeof st !== 'object') continue;
        const cur = ups[ship] || (ups[ship] = {});
        for (const [k, v] of Object.entries(st)) cur[k] = Math.max(cur[k] || 0, Number(v) || 0);
      }
    }
    out.ship_upgrades = ups;
    out.ships = Array.from(new Set(['spark', ...(a.ships || []), ...(b.ships || [])]));
    const stars = {};
    for (const src of [a.stars || {}, b.stars || {}]) {
      for (const [k, v] of Object.entries(src)) stars[k] = Math.max(stars[k] || 0, Number(v) || 0);
    }
    out.stars = stars;
    out.migrated_coins = Boolean(out.migrated_coins || b.migrated_coins);
    return out;
  }

  async function syncOnBoot() {
    let cur = loadLocal();
    try {
      const res = await fetch('/games/api/arcade/save/shuttle', { credentials: 'include' });
      if (res.ok) {
        const j = await res.json();
        if (j && j.data) {
          cur = mergeSaves(cur, j.data);
          saveLocal(cur);
        }
        // Push merged back if local had newer progress
        await pushCloud(cur);
      }
    } catch (_) {}
    return cur;
  }

  // ?debug=1 включает бессмертие и прыжки к боссу (для тестов) — такой прогресс не сохраняем ни локально,
  // ни на сервер, иначе по ссылке попадают в рекорды.
  const DEBUG_RUN = /[?&]debug=1\b/.test(global.location ? global.location.search : '');

  async function pushCloud(s) {
    if (DEBUG_RUN) return;
    saveLocal(s);
    try {
      await fetch('/games/api/arcade/save/shuttle', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(s)
      });
    } catch (_) {}
  }

  async function fetchLeaderboard() {
    try {
      const res = await fetch('/games/api/arcade/leaderboard/shuttle', { credentials: 'include' });
      if (!res.ok) return [];
      const j = await res.json();
      return Array.isArray(j.entries) ? j.entries : [];
    } catch (_) {
      return [];
    }
  }

  global.SHUTTLE_SAVE = { loadLocal, saveLocal, mergeSaves, syncOnBoot, pushCloud, fetchLeaderboard };
})(window);
