// Универсальный компонент приглашений в игру.
// 1) Кнопка «👋 Позвать» — появляется, когда есть код комнаты (#lcode ≠ ----).
// 2) Модалка со списком друзей → отправляет приглашение с текущим кодом.
// 3) Deep-link: открыт с ?code=XXXX (из приглашения) → авто-подставляет код и джойнит.
(function () {
  var game = (location.pathname.split('/').filter(Boolean).pop() || '').toLowerCase();

  var INV_I18N = {
    uk: {
      btn: '👋 Покликати друга',
      modal_title: '👋 Покликати в гру',
      modal_sub: 'Друг отримає запрошення і зайде в один тап.',
      loading: 'Завантажую друзів…',
      close: 'Закрити',
      no_friends: 'Поки немає друзів. Додай їх у профілі.',
      load_err: 'Не вдалося завантажити друзів',
      invite: 'Покликати',
      invited: '✓ Покликав',
      invited_at: '✓ Покликав @',
      invite_failed: 'Не вдалося покликати',
      need_room: 'Спочатку створи кімнату',
      error: 'Помилка'
    },
    ru: {
      btn: '👋 Позвать друга',
      modal_title: '👋 Позвать в игру',
      modal_sub: 'Друг получит приглашение и зайдёт в один тап.',
      loading: 'Загружаю друзей…',
      close: 'Закрыть',
      no_friends: 'Пока нет друзей. Добавь их в профиле.',
      load_err: 'Не вышло загрузить друзей',
      invite: 'Позвать',
      invited: '✓ Позвал',
      invited_at: '✓ Позвал @',
      invite_failed: 'Не вышло позвать',
      need_room: 'Сначала создай комнату',
      error: 'Ошибка'
    },
    en: {
      btn: '👋 Invite friend',
      modal_title: '👋 Invite to game',
      modal_sub: 'Your friend will get an invite and join in one tap.',
      loading: 'Loading friends…',
      close: 'Close',
      no_friends: 'No friends yet. Add them in your profile.',
      load_err: 'Failed to load friends',
      invite: 'Invite',
      invited: '✓ Invited',
      invited_at: '✓ Invited @',
      invite_failed: 'Failed to invite',
      need_room: 'Create a room first',
      error: 'Error'
    },
    de: {
      btn: '👋 Freund einladen',
      modal_title: '👋 Zum Spiel einladen',
      modal_sub: 'Dein Freund erhält eine Einladung und kann mit einem Klick beitreten.',
      loading: 'Freunde werden geladen…',
      close: 'Schließen',
      no_friends: 'Noch keine Freunde. Füge welche in deinem Profil hinzu.',
      load_err: 'Freunde konnten nicht geladen werden',
      invite: 'Einladen',
      invited: '✓ Eingeladen',
      invited_at: '✓ Eingeladen @',
      invite_failed: 'Einladung fehlgeschlagen',
      need_room: 'Erstelle zuerst einen Raum',
      error: 'Fehler'
    }
  };

  function getLang() {
    return (window.LobbyI18n && typeof window.LobbyI18n.lang === 'function')
      ? window.LobbyI18n.lang()
      : (localStorage.getItem('jg_lang') || 'ru');
  }

  function invT(key) {
    var l = getLang();
    return (INV_I18N[l] && INV_I18N[l][key]) || INV_I18N.ru[key] || key;
  }

  // ─── авто-join по ссылке-приглашению ───
  var params = new URLSearchParams(location.search);
  var invCode = (params.get('code') || params.get('join') || '').toUpperCase().trim();
  if (invCode) {
    window.addEventListener('load', function () {
      setTimeout(function () {
        var inp = document.getElementById('joincode');
        if (inp) inp.value = invCode;
        try {
          if (typeof join === 'function') join();
          else if (typeof joinGame === 'function') joinGame();
        } catch (e) {
          console.error('[Invite] auto-join failed:', e);
        }
      }, 500);
    });
  }

  // ─── авто-приглашение конкретного друга (из профиля: ?invite=user) ───
  var inviteTarget = (params.get('invite') || '').trim();
  var autoInvited = false;
  function miniToast(t) {
    var x = document.createElement('div');
    x.textContent = t;
    x.style.cssText = 'position:fixed;bottom:70px;left:50%;transform:translateX(-50%);z-index:100001;' +
      'background:#15151b;color:#fff;border:1px solid rgba(255,255,255,.2);padding:11px 18px;border-radius:24px;' +
      'font-size:14px;font-weight:700;box-shadow:0 6px 20px rgba(0,0,0,.4)';
    document.body.appendChild(x);
    setTimeout(function () { x.style.transition = 'opacity .4s'; x.style.opacity = '0'; setTimeout(function () { x.remove(); }, 400); }, 2600);
  }

  // ─── кнопка «Позвать» + модалка ───
  function el(html) { var d = document.createElement('div'); d.innerHTML = html; return d.firstElementChild; }

  var btn = el('<button id="inviteBtn" type="button" aria-label="' + invT('btn') + '" style="position:fixed;bottom:calc(14px + env(safe-area-inset-bottom,0px));right:14px;z-index:99998;display:none;width:auto;margin:0;' +
    'padding:11px 16px;border-radius:22px;border:none;font-weight:800;font-size:14px;cursor:pointer;' +
    'background:linear-gradient(135deg,#e0102e,#a00d22);color:#fff;box-shadow:0 4px 16px rgba(224,16,46,.5)">' + invT('btn') + '</button>');
  var modal = el('<div id="inviteModal" role="dialog" aria-modal="true" aria-labelledby="inviteModalTitle" style="display:none;position:fixed;inset:0;z-index:100000;' +
    'background:rgba(0,0,0,.75);align-items:center;justify-content:center;padding:20px;backdrop-filter:blur(4px);overscroll-behavior:contain">' +
    '<div style="max-width:380px;width:100%;background:#15151b;border:1px solid rgba(255,255,255,.15);' +
    'border-radius:16px;padding:20px;max-height:70vh;overflow-y:auto">' +
    '<div id="inviteModalTitle" style="font-size:18px;font-weight:800;margin-bottom:4px">' + invT('modal_title') + '</div>' +
    '<div id="inviteModalSub" style="font-size:13px;color:#9a9aa4;margin-bottom:12px">' + invT('modal_sub') + '</div>' +
    '<div id="inviteFriends">' + invT('loading') + '</div>' +
    '<button id="inviteModalClose" type="button" aria-label="' + invT('close') + '" onclick="document.getElementById(\'inviteModal\').style.display=\'none\'" ' +
    'style="margin-top:14px;width:100%;padding:11px;border-radius:10px;border:1px solid rgba(255,255,255,.2);' +
    'background:transparent;color:#fff;font-weight:700;cursor:pointer">' + invT('close') + '</button></div></div>');

  // ─── автоподъём кнопки «Позвать», чтобы не перекрывать кнопки страницы ───
  var invLift = 0, invLiftRaf = 0;
  function overlapsClickableInv(r) {
    var top = Infinity;
    var els = document.querySelectorAll("button, a[href], input, select, textarea, [onclick], [role=button], .card, .pin-box, .cell, .chip, .opt, .choice, .action-btn, .tapbtn, [data-action], .spy-sus-btn, .selectable, .pl");
    var vh = window.innerHeight;
    var vw = window.innerWidth;
    for (var i = 0; i < els.length; i++) {
      var el = els[i];
      if (el === btn || btn.contains(el) || modal.contains(el)) continue;
      var mParent = el.closest("#rulesModal, #inviteModal");
      if (mParent && getComputedStyle(mParent).display === "none") continue;
      var b = el.getBoundingClientRect();
      if (!b.width || !b.height || (b.height > vh * 0.55 && b.width > vw * 0.8)) continue;
      if (b.bottom <= 0 || b.top >= vh || b.right <= 0 || b.left >= vw) continue;
      var ix = Math.min(r.right, b.right) - Math.max(r.left, b.left);
      var iy = Math.min(r.bottom, b.bottom) - Math.max(r.top, b.top);
      if (ix <= 4 || iy <= 4) continue;
      var cs = getComputedStyle(el);
      if (cs.visibility === "hidden" || cs.pointerEvents === "none" || +cs.opacity === 0 || cs.display === "none") continue;
      if (b.top < top) top = b.top;
    }
    return top;
  }
  function avoidOverlapInv() {
    invLiftRaf = 0;
    if (!btn || btn.style.display === "none") return;
    var r0 = btn.getBoundingClientRect();
    if (!r0.width || !r0.height) return;
    var currentY = 0;
    try {
      var tr = getComputedStyle(btn).transform;
      if (tr && tr !== "none") {
        var m = new DOMMatrixReadOnly(tr);
        currentY = m.m42 || 0;
      }
    } catch (e) {
      currentY = -invLift;
    }
    var base = { left: r0.left, right: r0.right, top: r0.top - currentY, bottom: r0.bottom - currentY };
    var want = 0;
    var maxLift = Math.max(0, window.innerHeight - 80);
    for (var k = 0; k < 8; k++) {
      var r = { left: base.left, right: base.right, top: base.top - want, bottom: base.bottom - want };
      var top = overlapsClickableInv(r);
      if (top === Infinity) break;
      want = Math.round(base.bottom - top + 10);
      if (want > maxLift) { want = maxLift; break; }
    }
    if (want !== invLift) {
      invLift = want;
      btn.style.transform = invLift ? "translateY(" + -invLift + "px)" : "";
    }
  }
  function scheduleOverlapInv() {
    avoidOverlapInv();
    if (!invLiftRaf) invLiftRaf = requestAnimationFrame(avoidOverlapInv);
  }

  function updateInviteLabels() {
    if (btn) {
      btn.textContent = invT('btn');
      btn.setAttribute('aria-label', invT('btn'));
    }
    var t = document.getElementById('inviteModalTitle');
    if (t) t.textContent = invT('modal_title');
    var s = document.getElementById('inviteModalSub');
    if (s) s.textContent = invT('modal_sub');
    var c = document.getElementById('inviteModalClose');
    if (c) {
      c.textContent = invT('close');
      c.setAttribute('aria-label', invT('close'));
    }
  }

  document.addEventListener('click', function (e) {
    if (e.target && e.target.closest && e.target.closest('#langbar, .langbar')) {
      updateInviteLabels();
    }
    setTimeout(scheduleOverlapInv, 30);
    setTimeout(scheduleOverlapInv, 180);
  }, true);

  window.addEventListener('load', function () {
    btn.style.transition = "transform .04s ease";
    document.body.appendChild(btn);
    document.body.appendChild(modal);
    updateInviteLabels();
    window.addEventListener('scroll', scheduleOverlapInv, { passive: true, capture: true });
    window.addEventListener('resize', scheduleOverlapInv);
    if (window.MutationObserver) {
      new MutationObserver(function () { scheduleOverlapInv(); }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["class", "style", "hidden"] });
    }
    setInterval(scheduleOverlapInv, 600);
  });

  function curCode() {
    var e = document.getElementById('lcode');
    // в игре блок лобби с кодом скрыт — тогда и кнопку прячем, чтобы не закрывала кнопки игры
    if (!e || !e.getClientRects().length) return '';
    var c = (e.textContent || '').trim().toUpperCase();
    return (c && c !== '----' && c.length >= 3) ? c : '';
  }
  // показывать кнопку только когда есть код комнаты
  setInterval(function () {
    if (!document.getElementById('inviteBtn')) return;
    var code = curCode();
    var prevDisp = btn.style.display;
    btn.style.display = code ? 'block' : 'none';
    if (code && prevDisp !== 'block') scheduleOverlapInv();
    // пришли из профиля «позвать @друг» → как только комната создана, зовём автоматически
    if (inviteTarget && !autoInvited && code) {
      autoInvited = true;
      fetch('/games/invite', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: inviteTarget, game: game, code: code })
      }).then(function (r) { return r.json(); }).then(function (d) {
        miniToast(d.ok ? (invT('invited_at') + inviteTarget) : (d.error || invT('invite_failed')));
      }).catch(function () { miniToast(invT('invite_failed')); });
    }
  }, 800);

  btn.onclick = async function () {
    updateInviteLabels();
    modal.style.display = 'flex';
    var box = document.getElementById('inviteFriends');
    box.innerHTML = invT('loading');
    try {
      var r = await fetch('/games/friends', { credentials: 'include' });
      var d = await r.json();
      var friends = (d && d.friends) || [];
      if (!friends.length) { box.innerHTML = '<div style="color:#9a9aa4;font-size:13px">' + invT('no_friends') + '</div>'; return; }
      box.innerHTML = friends.map(function (f) {
        return '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.08)">' +
          '<div style="width:34px;height:34px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:18px;background:' + (f.color || '#333') + '">' + (f.avatar || '🙂') + '</div>' +
          '<span style="flex:1;font-weight:700">' + esc(f.display_name) + '</span>' +
          '<button onclick="__invite(\'' + esc(f.username) + '\',this)" style="padding:6px 12px;border-radius:9px;border:none;' +
          'background:var(--crimson,#e0102e);color:#fff;font-weight:700;cursor:pointer;font-size:13px">' + invT('invite') + '</button></div>';
      }).join('');
    } catch (e) { box.innerHTML = invT('load_err'); }
  };

  window.__invite = async function (to, btnEl) {
    var code = curCode();
    if (!code) { alert(invT('need_room')); return; }
    btnEl.disabled = true; btnEl.textContent = '…';
    try {
      var r = await fetch('/games/invite', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: to, game: game, code: code })
      });
      var d = await r.json();
      btnEl.textContent = d.ok ? invT('invited') : (d.error || invT('error'));
      if (d.ok) btnEl.style.background = '#2fbf5f';
    } catch (e) { btnEl.textContent = invT('error'); btnEl.disabled = false; }
  };

  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
})();
