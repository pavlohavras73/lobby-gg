/**
 * Lobby.gg — App Shell Engine (Drawer / Bottom sheet / Side panel / Tabs)
 * Zero external dependencies. Strictly safe DOM manipulation (no innerHTML with user data).
 */
(function () {
  'use strict';

  // ═══════════ TRANSLATION HELPERS ═══════════
  const SHELL_I18N = {
    uk: {
      sh_account: 'Акаунт',
      sh_friends: 'Друзі',
      sh_chat: 'Чат',
      sh_settings: 'Налаштування',
      acc_stat_played: 'зіграно',
      acc_stat_fav: 'улюблена',
      acc_stat_friends: 'друзів',
      acc_edit_profile: 'Редагувати профіль',
      acc_name_lbl: "Відображуване ім'я",
      acc_avatar_lbl: 'Аватар',
      acc_color_lbl: 'Колір акценту',
      acc_save: 'Зберегти профіль',
      acc_saving: 'Збереження...',
      acc_change_pw: 'Секретність і пароль',
      acc_old_pw: 'Старий пароль',
      acc_new_pw: 'Новий пароль (мін. 6 символів)',
      acc_update_pw: 'Оновити пароль',
      acc_logout: 'Вийти з акаунта',
      saved: 'Збережено ✓',
      pw_updated: 'Пароль оновлено ✓',
      pw_fields_req: 'Заповни обидва поля',
      pw_min6: 'Пароль мінімум 6 символів',
      err_generic: 'Сталася помилка',
      not_logged_in: 'Не авторизовано',
      role_admin: '👑 адмін',
      role_player: 'ігровий акаунт',
      fr_incoming: 'Вхідні заявки',
      fr_wants: 'хоче в друзі',
      fr_accept: 'Прийняти',
      fr_decline: 'Відхилити',
      fr_my: 'Мої друзі',
      fr_online: 'онлайн',
      fr_offline: 'офлайн',
      fr_in_game: 'у грі',
      fr_call: 'Позвати',
      fr_choose_game: 'Обери гру для запрошення:',
      fr_remove: 'Видалити',
      fr_empty: 'Поки що немає друзів — знайди за ніком нижче 👇',
      fr_find_player: 'Знайти гравця',
      fr_search_ph: 'нікнейм друга',
      fr_add: '+ Додати',
      fr_not_found: 'Нікого не знайдено',
      fr_req_sent: 'Заявку надіслано',
      fr_now_friends: 'Тепер друзі! 🎉',
      fr_accepted: 'Додано в друзі ✓',
      fr_declined: 'Заявку відхилено',
      fr_removed: 'Видалено з друзів',
      ch_title: 'Лобі-чат',
      ch_online: 'Наживо',
      ch_ph: 'Напиши повідомлення...',
      ch_hint: 'Enter — надіслати',
      ch_send: 'Надіслати',
      ch_new: 'Нові повідомлення ↓',
      ch_empty: 'У чаті поки тихо. Напиши першим!',
      ch_del: 'Видалити',
      ch_del_ok: 'Повідомлення видалено',
      set_lang: 'Мова інтерфейсу',
      set_sound: 'Звукові ефекти',
      set_sound_sub: 'Звук у лобі та іграх',
      set_rm: 'Зменшити рух',
      set_rm_sub: 'Мінімізувати анімації',
      set_about: 'Про Lobby.gg',
      set_about_desc: 'Мультиплеєр паті-ігри в реальному часі прямо в браузері. Без встановлення — лише посилання.',
      close: 'Закрити'
    },
    ru: {
      sh_account: 'Аккаунт',
      sh_friends: 'Друзья',
      sh_chat: 'Чат',
      sh_settings: 'Настройки',
      acc_stat_played: 'сыграно',
      acc_stat_fav: 'любимая',
      acc_stat_friends: 'друзей',
      acc_edit_profile: 'Редактировать профиль',
      acc_name_lbl: 'Отображаемое имя',
      acc_avatar_lbl: 'Аватар',
      acc_color_lbl: 'Цвет акцента',
      acc_save: 'Сохранить профиль',
      acc_saving: 'Сохранение...',
      acc_change_pw: 'Смена пароля',
      acc_old_pw: 'Старый пароль',
      acc_new_pw: 'Новый пароль (мин. 6 символов)',
      acc_update_pw: 'Обновить пароль',
      acc_logout: 'Выйти из аккаунта',
      saved: 'Сохранено ✓',
      pw_updated: 'Пароль обновлён ✓',
      pw_fields_req: 'Заполни оба поля',
      pw_min6: 'Пароль минимум 6 символов',
      err_generic: 'Произошла ошибка',
      not_logged_in: 'Не авторизован',
      role_admin: '👑 админ',
      role_player: 'игрок',
      fr_incoming: 'Входящие заявки',
      fr_wants: 'хочет в друзья',
      fr_accept: 'Принять',
      fr_decline: 'Отклонить',
      fr_my: 'Мои друзья',
      fr_online: 'онлайн',
      fr_offline: 'офлайн',
      fr_in_game: 'в игре',
      fr_call: 'Позвать',
      fr_choose_game: 'Выбери игру для приглашения:',
      fr_remove: 'Удалить',
      fr_empty: 'Пока нет друзей — найди по нику ниже 👇',
      fr_find_player: 'Найти игрока',
      fr_search_ph: 'ник друга',
      fr_add: '+ Добавить',
      fr_not_found: 'Никого не нашлось',
      fr_req_sent: 'Заявка отправлена',
      fr_now_friends: 'Теперь друзья! 🎉',
      fr_accepted: 'Добавлен в друзья ✓',
      fr_declined: 'Заявка отклонена',
      fr_removed: 'Удален из друзей',
      ch_title: 'Лобби-чат',
      ch_online: 'Прямой эфир',
      ch_ph: 'Напиши сообщение...',
      ch_hint: 'Enter — отправить',
      ch_send: 'Отправить',
      ch_new: 'Новые сообщения ↓',
      ch_empty: 'В чате пока тихо. Напиши первым!',
      ch_del: 'Удалить',
      ch_del_ok: 'Сообщение удалено',
      set_lang: 'Язык интерфейса',
      set_sound: 'Звуковые эффекты',
      set_sound_sub: 'Звуки в лобби и играх',
      set_rm: 'Уменьшить движение',
      set_rm_sub: 'Минимизировать анимации',
      set_about: 'О проекте',
      set_about_desc: 'Мультиплеер пати-игры в реальном времени прямо в браузере. Без установки — просто ссылка.',
      close: 'Закрыть'
    },
    en: {
      sh_account: 'Account',
      sh_friends: 'Friends',
      sh_chat: 'Chat',
      sh_settings: 'Settings',
      acc_stat_played: 'played',
      acc_stat_fav: 'favorite',
      acc_stat_friends: 'friends',
      acc_edit_profile: 'Edit profile',
      acc_name_lbl: 'Display name',
      acc_avatar_lbl: 'Avatar emoji',
      acc_color_lbl: 'Accent color',
      acc_save: 'Save profile',
      acc_saving: 'Saving...',
      acc_change_pw: 'Change password',
      acc_old_pw: 'Current password',
      acc_new_pw: 'New password (min 6 chars)',
      acc_update_pw: 'Update password',
      acc_logout: 'Sign out',
      saved: 'Saved ✓',
      pw_updated: 'Password updated ✓',
      pw_fields_req: 'Both fields required',
      pw_min6: 'Password must be at least 6 characters',
      err_generic: 'An error occurred',
      not_logged_in: 'Not signed in',
      role_admin: '👑 admin',
      role_player: 'player',
      fr_incoming: 'Friend requests',
      fr_wants: 'wants to be friends',
      fr_accept: 'Accept',
      fr_decline: 'Decline',
      fr_my: 'Friends',
      fr_online: 'online',
      fr_offline: 'offline',
      fr_in_game: 'in game',
      fr_call: 'Invite',
      fr_choose_game: 'Choose a game to invite:',
      fr_remove: 'Remove',
      fr_empty: 'No friends yet — search by username below 👇',
      fr_find_player: 'Find player',
      fr_search_ph: "friend's username",
      fr_add: '+ Add',
      fr_not_found: 'Nobody found',
      fr_req_sent: 'Friend request sent',
      fr_now_friends: 'Now friends! 🎉',
      fr_accepted: 'Friend added ✓',
      fr_declined: 'Declined',
      fr_removed: 'Removed from friends',
      ch_title: 'Lobby Chat',
      ch_online: 'Live',
      ch_ph: 'Type a message...',
      ch_hint: 'Enter to send',
      ch_send: 'Send',
      ch_new: 'New messages ↓',
      ch_empty: 'Lobby chat is quiet. Say hello!',
      ch_del: 'Delete',
      ch_del_ok: 'Message deleted',
      set_lang: 'Interface language',
      set_sound: 'Sound effects',
      set_sound_sub: 'In-game and UI audio',
      set_rm: 'Reduce motion',
      set_rm_sub: 'Minimize animations',
      set_about: 'About Lobby.gg',
      set_about_desc: 'Real-time multiplayer party games in your browser. No installs — just a link.',
      close: 'Close'
    }
  };

  // Merge into global I18N if present
  if (window.I18N) {
    ['uk', 'ru', 'en'].forEach(lang => {
      window.I18N[lang] = Object.assign({}, SHELL_I18N[lang], window.I18N[lang]);
    });
  }

  function getLang() {
    let l = null;
    try { l = localStorage.getItem('jg_lang'); } catch (e) {}
    if (!SHELL_I18N[l]) {
      const nl = (navigator.language || 'en').slice(0, 2).toLowerCase();
      l = nl === 'uk' ? 'uk' : (nl === 'ru' ? 'ru' : 'en');
    }
    return l;
  }

  function tr(key) {
    const l = getLang();
    if (window.t && typeof window.t === 'function') {
      const v = window.t(key);
      if (v && v !== key) return v;
    }
    return (SHELL_I18N[l] && SHELL_I18N[l][key]) || (SHELL_I18N.en && SHELL_I18N.en[key]) || key;
  }

  // ═══════════ CONSTANTS & CONFIG ═══════════
  const EMOJIS = ['🙂','😎','🐺','🦊','🐱','🐶','🦁','🐯','🐸','🐵','🦉','🦅','🐢','🐉','👾','🤖','👑','💀','🔥','⚡','🌟','🍀','🎮','🎯','🃏','🚀','🐧','🦈','🌚','🎭'];
  const COLORS = ['#ff2238','#ff4757','#ff7a45','#f59e0b','#2fd86f','#10b981','#06b6d4','#3b82f6','#8b5cf6','#ec4899'];
  const CALL_GAMES = [
    { id: 'spy', name: 'Spy', ico: '🕵️' },
    { id: 'bunker', name: 'Bunker', ico: '🏠' },
    { id: 'alias', name: 'Alias', ico: '💬' },
    { id: 'mafia', name: 'Mafia', ico: '🔪' },
    { id: 'durak', name: 'Durak', ico: '🃏' },
    { id: 'uno', name: 'UNO', ico: '🎴' },
    { id: 'c4', name: 'Connect 4', ico: '🔴' }
  ];
  const GAME_NAMES = {
    spy: 'Spy', bunker: 'Bunker', alias: 'Alias', durak: 'Durak', uno: 'UNO', mafia: 'Mafia',
    wordle: '5 Letters', arrows: 'Arrows', g2048: '2048', snake: 'Snake', fifteen: '15 Puzzle',
    mines: 'Minesweeper', tetris: 'Tetris', race: 'Race', c4: 'Connect 4', chess: 'Chess',
    checkers: 'Checkers', battleship: 'Battleship', poker: 'Poker', reversi: 'Reversi',
    dots: 'Dots', bulls: 'Bulls & Cows', guesswho: 'Guess Who', quoridor: 'Quoridor',
    geobunker: 'GeoBunker', variants: 'Variants', space_invaders: 'Shuttle Cruiser'
  };

  function gName(g) {
    return GAME_NAMES[g] || g;
  }

  // ═══════════ API UTILITIES ═══════════
  async function apiGet(path) {
    try {
      const res = await fetch('/games' + path, { credentials: 'include' });
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    }
  }

  async function apiPost(path, body) {
    try {
      const res = await fetch('/games' + path, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      return await res.json();
    } catch (e) {
      return { ok: false, error: 'Network error' };
    }
  }

  // ═══════════ STATE ═══════════
  const state = {
    user: {
      username: '',
      display_name: '',
      avatar: '🙂',
      color: '#e0102e',
      sound: 1,
      role: 'member',
      stats: { played: 0, top_games: [] }
    },
    draftAvatar: '🙂',
    draftColor: '#e0102e',
    draftSound: 1,
    friends: [],
    incoming: [],
    outgoing: [],
    activeTab: 'account',
    isOpen: false,
    chatMessages: [],
    lastChatId: 0,
    chatPollTimer: null,
    chatAutoScroll: true,
    lastActiveElement: null
  };

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

  // ═══════════ SHELL DOM INJECTION ═══════════
  function ensureShellDOM() {
    if (document.getElementById('shell')) return;

    // 1. Toast
    if (!document.getElementById('lgToast')) {
      const toast = document.createElement('div');
      toast.id = 'lgToast';
      toast.setAttribute('role', 'status');
      toast.setAttribute('aria-live', 'polite');
      document.body.appendChild(toast);
    }

    // 2. Desktop Nav Icon Toolbar
    const navR = document.querySelector('.nav-r');
    if (navR && !document.getElementById('navIc')) {
      const navIc = document.createElement('div');
      navIc.id = 'navIc';
      navIc.setAttribute('role', 'toolbar');
      navIc.setAttribute('aria-label', 'Quick navigation');

      navIc.innerHTML = `
        <button type="button" data-tab="account" aria-label="Account" title="Account" id="nav-btn-account" class="nav-btn-av">
          <span id="nav-av">🙂</span>
        </button>
        <button type="button" data-tab="friends" aria-label="Friends" title="Friends">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span class="nbadge" id="nav-badge-friends">0</span>
        </button>
        <button type="button" data-tab="chat" aria-label="Chat" title="Chat">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="nbadge" id="nav-badge-chat">0</span>
        </button>
        <button type="button" data-tab="settings" aria-label="Settings" title="Settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
        </button>
      `;
      const profCard = navR.querySelector('.profile-card');
      if (profCard) {
        navR.insertBefore(navIc, profCard);
      } else {
        navR.appendChild(navIc);
      }
    }

    // 3. Mobile Dock
    if (!document.getElementById('dock')) {
      const dock = document.createElement('nav');
      dock.id = 'dock';
      dock.setAttribute('aria-label', 'Bottom navigation');
      dock.innerHTML = `
        <button type="button" data-tab="account">
          <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          <span data-i18n="sh_account">Account</span>
        </button>
        <button type="button" data-tab="friends">
          <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span class="nbadge" id="dock-badge-friends">0</span>
          <span data-i18n="sh_friends">Friends</span>
        </button>
        <button type="button" data-tab="chat">
          <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
          <span class="nbadge" id="dock-badge-chat">0</span>
          <span data-i18n="sh_chat">Chat</span>
        </button>
        <button type="button" data-tab="settings">
          <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span data-i18n="sh_settings">Settings</span>
        </button>
      `;
      document.body.appendChild(dock);
    }

    // 4. Shell Drawer / Side Panel
    const shell = document.createElement('div');
    shell.id = 'shell';
    shell.setAttribute('aria-hidden', 'true');
    shell.innerHTML = `
      <div class="sh-bd" aria-hidden="true"></div>
      <div class="sh-p" role="dialog" aria-modal="true" aria-label="Lobby.gg menu">
        <div class="sh-grab" aria-label="Drag handle"><span></span></div>
        <div class="sh-head">
          <div class="sh-me">
            <div class="sh-av" id="sh-av">🙂</div>
            <div style="min-width:0;flex:1">
              <b id="sh-name">—</b>
              <small id="sh-role">@username</small>
            </div>
          </div>
          <button type="button" class="sh-x" id="sh-close" aria-label="${tr('close')}">
            <svg viewBox="0 0 24 24"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="sh-tabs" role="tablist" aria-label="Navigation tabs">
          <div class="sh-ind" id="sh-ind"></div>
          <button type="button" class="sh-tab" role="tab" id="tab-btn-account" aria-selected="true" aria-controls="pane-account" data-tab="account">
            <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span data-i18n="sh_account">Account</span>
          </button>
          <button type="button" class="sh-tab" role="tab" id="tab-btn-friends" aria-selected="false" aria-controls="pane-friends" data-tab="friends">
            <svg viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span data-i18n="sh_friends">Friends</span>
            <span class="nbadge" id="badge-friends">0</span>
          </button>
          <button type="button" class="sh-tab" role="tab" id="tab-btn-chat" aria-selected="false" aria-controls="pane-chat" data-tab="chat">
            <svg viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <span data-i18n="sh_chat">Chat</span>
            <span class="nbadge" id="badge-chat">0</span>
          </button>
          <button type="button" class="sh-tab" role="tab" id="tab-btn-settings" aria-selected="false" aria-controls="pane-settings" data-tab="settings">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            <span data-i18n="sh_settings">Settings</span>
          </button>
        </div>

        <div class="sh-vp">
          <div class="sh-track" id="sh-track">
            <!-- PANE 1: ACCOUNT -->
            <div class="sh-pane enter" role="tabpanel" id="pane-account" aria-labelledby="tab-btn-account" tabindex="0">
              <div class="acc-hero">
                <div class="acc-av" id="acc-hero-av">🙂</div>
                <b id="acc-hero-name">—</b>
                <small id="acc-hero-role">@username</small>
              </div>

              <div class="stat3">
                <div><b id="acc-stat-played">0</b><span data-i18n="acc_stat_played">played</span></div>
                <div><b id="acc-stat-fav">—</b><span data-i18n="acc_stat_fav">favorite</span></div>
                <div><b id="acc-stat-friends">0</b><span data-i18n="acc_stat_friends">friends</span></div>
              </div>

              <div class="sec-t"><span data-i18n="acc_edit_profile">Edit profile</span></div>
              <div class="gcard">
                <label class="lbl2" for="acc-name-inp" data-i18n="acc_name_lbl">Display name</label>
                <div class="fld">
                  <svg viewBox="0 0 24 24"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                  <input type="text" id="acc-name-inp" maxlength="24" placeholder="Your name">
                </div>

                <label class="lbl2" style="margin-top:14px" data-i18n="acc_avatar_lbl">Avatar</label>
                <div class="emo-g" id="acc-emo-grid" role="group" aria-label="Avatar emojis"></div>

                <label class="lbl2" style="margin-top:14px" data-i18n="acc_color_lbl">Accent color</label>
                <div class="col-g" id="acc-col-grid" role="group" aria-label="Color presets"></div>

                <div class="set-row" style="margin-top:14px;padding-bottom:0">
                  <div class="set-ic">
                    <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  </div>
                  <div class="r-mid">
                    <b data-i18n="set_sound">Sound effects</b>
                    <small data-i18n="set_sound_sub">In-game and UI audio</small>
                  </div>
                  <button type="button" class="sw" id="acc-sound-sw" role="switch" aria-checked="true" aria-label="Sound"></button>
                </div>

                <button type="button" class="b-p w100" id="acc-save-btn" style="margin-top:16px">
                  <span data-i18n="acc_save">Save profile</span>
                </button>
              </div>

              <div class="sec-t"><span data-i18n="acc_change_pw">Change password</span></div>
              <div class="gcard">
                <details class="pw">
                  <summary>
                    <span data-i18n="acc_change_pw">Change password</span>
                    <svg class="r-chev" viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"></polyline></svg>
                  </summary>
                  <div class="pw-b">
                    <label class="lbl2" for="acc-old-pw" data-i18n="acc_old_pw">Current password</label>
                    <input type="password" id="acc-old-pw" autocomplete="current-password">
                    <label class="lbl2" for="acc-new-pw" data-i18n="acc_new_pw">New password (min 6 chars)</label>
                    <input type="password" id="acc-new-pw" autocomplete="new-password">
                    <button type="button" class="b-g w100" id="acc-pw-btn" style="margin-top:6px">
                      <span data-i18n="acc_update_pw">Update password</span>
                    </button>
                  </div>
                </details>
              </div>

              <div style="margin:20px 0 12px">
                <button type="button" class="b-d w100" id="acc-logout-btn">
                  <svg viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                  <span data-i18n="acc_logout">Sign out</span>
                </button>
              </div>
            </div>

            <!-- PANE 2: FRIENDS -->
            <div class="sh-pane" role="tabpanel" id="pane-friends" aria-labelledby="tab-btn-friends" tabindex="0" inert>
              <div id="fr-incoming-sec" style="display:none">
                <div class="sec-t">
                  <span data-i18n="fr_incoming">Incoming requests</span>
                  <span class="cnt" id="fr-incoming-cnt">0</span>
                </div>
                <div class="gcard" id="fr-incoming-list" style="padding:4px"></div>
              </div>

              <div class="sec-t">
                <span data-i18n="fr_my">Friends</span>
                <span class="cnt" id="fr-friends-cnt">0</span>
              </div>
              <div class="gcard" style="padding:4px">
                <div id="fr-friends-list"></div>
              </div>

              <div class="sec-t"><span data-i18n="fr_find_player">Find players</span></div>
              <div class="gcard">
                <div class="fld">
                  <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                  <input type="text" id="fr-search-inp" data-i18n-ph="fr_search_ph" placeholder="friend's username" autocomplete="off">
                </div>
                <div id="fr-search-res" style="margin-top:10px"></div>
              </div>
            </div>

            <!-- PANE 3: CHAT -->
            <div class="sh-pane chat" role="tabpanel" id="pane-chat" aria-labelledby="tab-btn-chat" tabindex="0" inert>
              <div class="ch-top">
                <b data-i18n="ch_title">Lobby Chat</b>
                <small><span class="live"></span><span data-i18n="ch_online">Live</span></small>
              </div>
              <div class="ch-list" id="ch-list" role="log" aria-live="polite"></div>
              <button type="button" class="ch-new" id="ch-new-btn">
                <svg viewBox="0 0 24 24"><polyline points="6 9 12 15 18 9"></polyline></svg>
                <span data-i18n="ch_new">New messages ↓</span>
              </button>
              <div class="ch-comp">
                <div class="ch-row">
                  <textarea id="ch-text-inp" rows="1" maxlength="300" placeholder="Type a message..." data-i18n-ph="ch_ph"></textarea>
                  <button type="button" class="ch-send" id="ch-send-btn" aria-label="Send message">
                    <svg viewBox="0 0 24 24"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                  </button>
                </div>
                <div class="ch-meta">
                  <span data-i18n="ch_hint">Enter to send</span>
                  <span id="ch-char-cnt">0/300</span>
                </div>
              </div>
            </div>

            <!-- PANE 4: SETTINGS -->
            <div class="sh-pane" role="tabpanel" id="pane-settings" aria-labelledby="tab-btn-settings" tabindex="0" inert>
              <div class="sec-t"><span data-i18n="set_lang">Interface language</span></div>
              <div class="opts" id="sh-lang-seg" role="group" aria-label="Language">
                <button type="button" class="opt" data-lang="uk">UA</button>
                <button type="button" class="opt" data-lang="ru">RU</button>
                <button type="button" class="opt" data-lang="en">EN</button>
              </div>

              <div class="sec-t"><span>Preferences</span></div>
              <div class="gcard" style="padding:6px 14px">
                <div class="set-row">
                  <div class="set-ic">
                    <svg viewBox="0 0 24 24"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>
                  </div>
                  <div class="r-mid">
                    <b data-i18n="set_sound">Sound effects</b>
                    <small data-i18n="set_sound_sub">In-game and UI audio</small>
                  </div>
                  <button type="button" class="sw" id="set-sound-sw" role="switch" aria-checked="true" aria-label="Sound toggle"></button>
                </div>

                <div class="set-row">
                  <div class="set-ic">
                    <svg viewBox="0 0 24 24"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"></path></svg>
                  </div>
                  <div class="r-mid">
                    <b data-i18n="set_rm">Reduce motion</b>
                    <small data-i18n="set_rm_sub">Minimize animations and motion</small>
                  </div>
                  <button type="button" class="sw" id="set-rm-sw" role="switch" aria-checked="false" aria-label="Reduce motion toggle"></button>
                </div>
              </div>

              <div class="sec-t"><span data-i18n="set_about">About Lobby.gg</span></div>
              <div class="gcard">
                <div class="about">
                  <svg class="lgg-mark" viewBox="0 0 64 64">
                    <use href="#lggMark"></use>
                  </svg>
                  <h4>Lobby.gg</h4>
                  <p data-i18n="set_about_desc">Real-time multiplayer party games in your browser. No installs — just a link.</p>
                  <div class="by">
                    <span data-i18n="built_by">Built by</span> <b>Pavlo Havras</b> · 2026
                  </div>
                  <div class="tech">
                    <span>FastAPI</span>
                    <span>WebSockets</span>
                    <span>Vanilla JS</span>
                    <span>Docker</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(shell);
  }

  // ═══════════ REDUCED MOTION ═══════════
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

  function toggleReducedMotion() {
    const isRm = !document.documentElement.classList.contains('rm');
    document.documentElement.classList.toggle('rm', isRm);
    try { localStorage.setItem('jg_rm', isRm ? '1' : '0'); } catch (e) {}
    const sw = document.getElementById('set-rm-sw');
    if (sw) sw.setAttribute('aria-checked', isRm ? 'true' : 'false');
  }

  // ═══════════ SOUND TOGGLE ═══════════
  function syncSoundUI(soundOn) {
    state.draftSound = soundOn ? 1 : 0;
    const s1 = document.getElementById('acc-sound-sw');
    if (s1) s1.setAttribute('aria-checked', soundOn ? 'true' : 'false');
    const s2 = document.getElementById('set-sound-sw');
    if (s2) s2.setAttribute('aria-checked', soundOn ? 'true' : 'false');
  }

  function toggleSound() {
    let nextSound = 1;
    if (window.sfx && typeof window.sfx.toggleMute === 'function') {
      const muted = window.sfx.toggleMute();
      nextSound = muted ? 0 : 1;
    } else {
      nextSound = state.draftSound ? 0 : 1;
    }
    syncSoundUI(nextSound === 1);
  }

  // ═══════════ TABS SYSTEM ═══════════
  const TAB_ORDER = ['account', 'friends', 'chat', 'settings'];

  function updateIndicator(targetBtn) {
    const ind = document.getElementById('sh-ind');
    if (!ind || !targetBtn) return;
    ind.style.width = targetBtn.offsetWidth + 'px';
    ind.style.transform = `translateX(${targetBtn.offsetLeft}px)`;
  }

  function switchTab(tabId, animate = true) {
    const idx = TAB_ORDER.indexOf(tabId);
    if (idx === -1) return;

    const prevTab = state.activeTab;
    state.activeTab = tabId;

    // 1. Update tab buttons
    TAB_ORDER.forEach(tName => {
      const btn = document.getElementById('tab-btn-' + tName);
      if (btn) btn.setAttribute('aria-selected', tName === tabId ? 'true' : 'false');
    });

    // 2. Sliding indicator
    const curBtn = document.getElementById('tab-btn-' + tabId);
    if (curBtn) {
      if (!animate) {
        const ind = document.getElementById('sh-ind');
        if (ind) {
          ind.style.transition = 'none';
          updateIndicator(curBtn);
          void ind.offsetWidth;
          ind.style.transition = '';
        }
      } else {
        updateIndicator(curBtn);
      }
    }

    // 3. Move track
    const track = document.getElementById('sh-track');
    if (track) {
      track.style.transform = `translate3d(${-idx * 100}%, 0, 0)`;
    }

    // 4. Update panes (inert & animation)
    TAB_ORDER.forEach((tName, i) => {
      const pane = document.getElementById('pane-' + tName);
      if (!pane) return;
      if (i === idx) {
        pane.removeAttribute('inert');
        if (animate && prevTab !== tabId) {
          pane.classList.remove('enter');
          void pane.offsetWidth;
          pane.classList.add('enter');
        }
      } else {
        pane.setAttribute('inert', '');
      }
    });

    // 5. Chat lifecycle
    if (tabId === 'chat') {
      startChatPolling();
      loadChatMessages(true);
    } else if (prevTab === 'chat') {
      stopChatPolling();
    }

    // 6. Sync active state on dock
    document.querySelectorAll('#dock button').forEach(b => {
      b.classList.toggle('active', b.dataset.tab === tabId);
    });
  }

  // ═══════════ OPEN / CLOSE DRAWER ═══════════
  function openDrawer(tabId = null) {
    state.lastActiveElement = document.activeElement;
    ensureShellDOM();
    const shell = document.getElementById('shell');
    if (!shell) return;

    const target = tabId || state.activeTab || 'account';

    if (state.isOpen) {
      if (target !== state.activeTab) {
        switchTab(target, true);
      }
      return;
    }

    state.isOpen = true;
    shell.classList.add('vis');
    // Double RAF / layout measurement for smooth transition from 102% / side
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        shell.classList.add('open');
        document.documentElement.classList.add('sh-lock');
        shell.setAttribute('aria-hidden', 'false');
        const curBtn = document.getElementById('tab-btn-' + target);
        if (curBtn) updateIndicator(curBtn);
      });
    });

    switchTab(target, false);
    setTimeout(() => {
      const curBtn = document.getElementById('tab-btn-' + target);
      if (curBtn) updateIndicator(curBtn);
    }, 60);

    // Refresh data
    loadProfile();
    loadFriends();

    // Focus close button for accessibility
    setTimeout(() => {
      const closeBtn = document.getElementById('sh-close');
      if (closeBtn) closeBtn.focus();
    }, 300);
  }

  function closeDrawer() {
    const shell = document.getElementById('shell');
    if (!shell || !state.isOpen) return;

    state.isOpen = false;
    shell.classList.remove('open');
    document.documentElement.classList.remove('sh-lock');
    shell.setAttribute('aria-hidden', 'true');
    stopChatPolling();

    // Reset inline drag transform if any
    const panel = shell.querySelector('.sh-p');
    if (panel) {
      panel.style.transform = '';
      panel.style.transition = '';
    }

    setTimeout(() => {
      if (!state.isOpen) {
        shell.classList.remove('vis');
      }
    }, 500);

    // Restore focus
    if (state.lastActiveElement && typeof state.lastActiveElement.focus === 'function') {
      state.lastActiveElement.focus();
    }
  }

  // ═══════════ FOCUS TRAP ═══════════
  function handleFocusTrap(e) {
    if (!state.isOpen || e.key !== 'Tab') return;
    const panel = document.querySelector('.sh-p');
    if (!panel) return;

    const focusables = panel.querySelectorAll(
      'button:not([disabled]):not([inert]), input:not([disabled]):not([inert]), textarea:not([disabled]):not([inert]), a[href]:not([inert]), [tabindex]:not([tabindex="-1"]):not([inert])'
    );
    if (!focusables.length) return;

    const first = focusables[0];
    const last = focusables[focusables.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }

  // ═══════════ GESTURES (BOTTOM SHEET PULL & VELOCITY) ═══════════
  function initGestures() {
    const panel = document.querySelector('.sh-p');
    const grab = document.querySelector('.sh-grab');
    const head = document.querySelector('.sh-head');
    const dock = document.getElementById('dock');
    if (!panel) return;

    let isDragging = false;
    let startY = 0;
    let lastY = 0;
    let startTime = 0;
    let lastTime = 0;

    function onPointerDown(e) {
      // Don't drag if clicking buttons / interactive elements
      if (e.target.closest('button, input, textarea, a, .sw')) return;
      // Only drag on phone / bottom sheet mode (screen width <= 760px)
      if (window.innerWidth > 760) return;

      isDragging = true;
      startY = e.clientY;
      lastY = e.clientY;
      startTime = performance.now();
      lastTime = startTime;
      panel.style.transition = 'none';

      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch (err) {}
    }

    function onPointerMove(e) {
      if (!isDragging) return;
      const dy = e.clientY - startY;
      lastY = e.clientY;
      lastTime = performance.now();

      if (dy > 0) {
        // Dragging down: direct 1:1 motion
        panel.style.transform = `translate3d(0, ${dy}px, 0)`;
      } else {
        // Dragging up: rubber-band resistance
        const resistance = dy * 0.18;
        panel.style.transform = `translate3d(0, ${resistance}px, 0)`;
      }
    }

    function onPointerUp(e) {
      if (!isDragging) return;
      isDragging = false;
      panel.style.transition = '';

      const now = performance.now();
      const dy = e.clientY - startY;
      const dt = Math.max(1, now - startTime);
      const velocity = dy / dt; // px/ms

      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch (err) {}

      // Close if dragged down far enough OR with downward flick velocity
      if (dy > 120 || (velocity > 0.45 && dy > 40)) {
        closeDrawer();
      } else {
        // Snap back to top
        panel.style.transform = '';
      }
    }

    if (grab) {
      grab.addEventListener('pointerdown', onPointerDown);
      grab.addEventListener('pointermove', onPointerMove);
      grab.addEventListener('pointerup', onPointerUp);
      grab.addEventListener('pointercancel', onPointerUp);
    }
    if (head) {
      head.addEventListener('pointerdown', onPointerDown);
      head.addEventListener('pointermove', onPointerMove);
      head.addEventListener('pointerup', onPointerUp);
      head.addEventListener('pointercancel', onPointerUp);
    }

    // ── Mobile Dock: Swipe up to open drawer ──
    if (dock) {
      let dockStartY = 0;
      let dockStartTime = 0;
      let dockSwiping = false;

      dock.addEventListener('pointerdown', e => {
        if (e.target.closest('button')) return; // buttons handle their own clicks
        dockStartY = e.clientY;
        dockStartTime = performance.now();
        dockSwiping = true;
      }, { passive: true });

      dock.addEventListener('pointermove', e => {
        if (!dockSwiping) return;
        const dy = e.clientY - dockStartY;
        if (dy < -20) {
          dockSwiping = false;
          openDrawer(state.activeTab || 'account');
        }
      }, { passive: true });

      dock.addEventListener('pointerup', e => {
        if (!dockSwiping) return;
        dockSwiping = false;
        const dy = e.clientY - dockStartY;
        const dt = Math.max(1, performance.now() - dockStartTime);
        const velocity = dy / dt;
        if (dy < -30 || velocity < -0.3) {
          openDrawer(state.activeTab || 'account');
        }
      }, { passive: true });
    }
  }

  // ═══════════ PROFILE & ACCOUNT ═══════════
  function buildPickers() {
    const emoGrid = document.getElementById('acc-emo-grid');
    const colGrid = document.getElementById('acc-col-grid');
    if (!emoGrid || !colGrid) return;

    emoGrid.replaceChildren();
    EMOJIS.forEach(e => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.textContent = e;
      const isMatch = e === state.draftAvatar;
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      btn.classList.toggle('on', isMatch);
      btn.addEventListener('click', () => {
        state.draftAvatar = e;
        syncPickers();
        const av = document.getElementById('acc-hero-av');
        if (av) {
          av.classList.add('bump');
          setTimeout(() => av.classList.remove('bump'), 400);
        }
      });
      emoGrid.appendChild(btn);
    });

    colGrid.replaceChildren();
    COLORS.forEach(c => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.color = c;
      btn.style.background = c;
      btn.setAttribute('aria-label', c);
      btn.title = c;
      const isMatch = (c.toLowerCase() === (state.draftColor || '').toLowerCase());
      btn.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
      btn.classList.toggle('on', isMatch);
      btn.addEventListener('click', () => {
        state.draftColor = c;
        syncPickers();
      });
      colGrid.appendChild(btn);
    });
  }

  function syncPickers() {
    document.querySelectorAll('#acc-emo-grid button').forEach(b => {
      const match = b.textContent === state.draftAvatar;
      b.setAttribute('aria-pressed', match ? 'true' : 'false');
      b.classList.toggle('on', match);
    });
    document.querySelectorAll('#acc-col-grid button').forEach(b => {
      const colorVal = b.dataset.color || '';
      const match = colorVal.toLowerCase() === (state.draftColor || '').toLowerCase();
      b.setAttribute('aria-pressed', match ? 'true' : 'false');
      b.classList.toggle('on', match);
    });

    const heroAv = document.getElementById('acc-hero-av');
    if (heroAv) {
      heroAv.textContent = state.draftAvatar;
      heroAv.style.background = state.draftColor;
      heroAv.style.setProperty('--avc', state.draftColor);
    }
    const shAv = document.getElementById('sh-av');
    if (shAv) {
      shAv.textContent = state.draftAvatar;
      shAv.style.background = state.draftColor;
      shAv.style.setProperty('--avc', state.draftColor);
    }
    const navAv = document.getElementById('nav-av');
    if (navAv) {
      navAv.textContent = state.draftAvatar;
    }
    const navBtnAv = document.getElementById('nav-btn-account');
    if (navBtnAv && state.draftColor) {
      navBtnAv.style.background = state.draftColor;
    }
    const hpAv = document.getElementById('hp-av');
    if (hpAv) {
      hpAv.textContent = state.draftAvatar;
    }
    const pcAv = document.querySelector('.pc-av');
    if (pcAv && state.draftColor) {
      pcAv.style.background = state.draftColor;
    }
  }

  async function loadProfile() {
    const d = await apiGet('/me');
    if (!d || !d.profile) return;

    state.user = Object.assign({}, state.user, d.profile);
    state.draftAvatar = state.user.avatar || '🙂';
    state.draftColor = state.user.color || '#e0102e';
    state.draftSound = state.user.sound !== undefined ? state.user.sound : 1;

    // Header & Hero info
    const shName = document.getElementById('sh-name');
    if (shName) shName.textContent = state.user.display_name || state.user.username;
    const shRole = document.getElementById('sh-role');
    if (shRole) shRole.textContent = `@${state.user.username} · ${state.user.role === 'root' ? tr('role_admin') : tr('role_player')}`;

    const heroName = document.getElementById('acc-hero-name');
    if (heroName) heroName.textContent = state.user.display_name || state.user.username;
    const heroRole = document.getElementById('acc-hero-role');
    if (heroRole) heroRole.textContent = `@${state.user.username} · ${state.user.role === 'root' ? tr('role_admin') : tr('role_player')}`;

    const nameInp = document.getElementById('acc-name-inp');
    if (nameInp) nameInp.value = state.user.display_name || state.user.username;

    // Stats
    const st = state.user.stats || {};
    const playedEl = document.getElementById('acc-stat-played');
    if (playedEl) playedEl.textContent = st.played || 0;
    const favEl = document.getElementById('acc-stat-fav');
    if (favEl) {
      const top = st.top_games && st.top_games[0];
      favEl.textContent = top ? gName(top[0]) : '—';
    }

    // Sound switches
    syncSoundUI(!!state.draftSound);

    // Pickers
    buildPickers();
    syncPickers();

    // Sync landing page profile card
    const hpAv = document.getElementById('hp-av');
    if (hpAv) hpAv.textContent = state.user.avatar || '🙂';
    const pcAv = document.querySelector('.pc-av');
    if (pcAv && state.user.color) pcAv.style.background = state.user.color;
    const hpName = document.getElementById('hp-name');
    if (hpName) {
      hpName.textContent = state.user.display_name || state.user.username;
      hpName.dataset.dyn = '1';
    }
    window._pcPlayed = (state.user.stats && state.user.stats.played) || 0;
    if (typeof window.renderPcStats === 'function') window.renderPcStats();
  }

  async function saveProfile() {
    const btn = document.getElementById('acc-save-btn');
    const nameInp = document.getElementById('acc-name-inp');
    const dispName = (nameInp ? nameInp.value.trim() : '') || state.user.username;

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span class="sh-spin" aria-hidden="true"></span> <span>${tr('acc_saving')}</span>`;
    }

    try {
      const res = await apiPost('/me', {
        display_name: dispName,
        avatar: state.draftAvatar,
        color: state.draftColor,
        sound: !!state.draftSound
      });

      if (res && res.ok) {
        showToast(tr('saved'));
        state.user.display_name = dispName;
        state.user.avatar = state.draftAvatar;
        state.user.color = state.draftColor;
        state.user.sound = state.draftSound ? 1 : 0;
        await loadProfile();
      } else {
        showToast((res && res.error) || tr('err_generic'));
      }
    } catch (e) {
      showToast(tr('err_generic'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span data-i18n="acc_save">${tr('acc_save')}</span>`;
      }
    }
  }

  async function changePassword() {
    const oldInp = document.getElementById('acc-old-pw');
    const newInp = document.getElementById('acc-new-pw');
    const oldPw = oldInp ? oldInp.value : '';
    const newPw = newInp ? newInp.value : '';

    if (!oldPw || !newPw) {
      return showToast(tr('pw_fields_req'));
    }
    if (newPw.length < 6) {
      return showToast(tr('pw_min6'));
    }

    const res = await apiPost('/me/password', { old: oldPw, new: newPw });
    if (res.ok) {
      showToast(tr('pw_updated'));
      if (oldInp) oldInp.value = '';
      if (newInp) newInp.value = '';
      const det = document.querySelector('details.pw');
      if (det) det.open = false;
    } else {
      showToast(res.error || tr('err_generic'));
    }
  }

  async function logout() {
    await apiPost('/auth/logout', {});
    location.href = '/games/login';
  }

  // ═══════════ FRIENDS TAB ═══════════
  function updateBadgeCounts(incomingCount) {
    const badgeMap = [
      'badge-friends',
      'dock-badge-friends',
      'nav-badge-friends',
      'hp-badge'
    ];
    badgeMap.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (incomingCount > 0) {
        el.textContent = id === 'hp-badge' ? `${incomingCount} ${tr('req') || 'req'}` : String(incomingCount);
        el.classList.add('on');
        if (id === 'hp-badge') el.style.display = 'inline-block';
      } else {
        el.textContent = '0';
        el.classList.remove('on');
        if (id === 'hp-badge') el.style.display = 'none';
      }
    });
  }

  async function loadFriends() {
    const d = await apiGet('/friends');
    if (!d) return;

    state.friends = d.friends || [];
    state.incoming = d.incoming || [];
    state.outgoing = d.outgoing || [];

    // Update friends count stat
    const statFriends = document.getElementById('acc-stat-friends');
    if (statFriends) statFriends.textContent = state.friends.length;
    const cntFriends = document.getElementById('fr-friends-cnt');
    if (cntFriends) cntFriends.textContent = state.friends.length;
    window._pcFriends = state.friends.length;
    if (typeof window.renderPcStats === 'function') window.renderPcStats();

    // Badges
    updateBadgeCounts(state.incoming.length);

    // 1. Incoming requests
    const incSec = document.getElementById('fr-incoming-sec');
    const incList = document.getElementById('fr-incoming-list');
    const incCnt = document.getElementById('fr-incoming-cnt');
    if (incSec && incList) {
      if (state.incoming.length > 0) {
        incSec.style.display = 'block';
        if (incCnt) incCnt.textContent = state.incoming.length;
        incList.replaceChildren();

        state.incoming.forEach(u => {
          const row = document.createElement('div');
          row.className = 'row2';

          const av = document.createElement('div');
          av.className = 'r-av';
          av.style.background = u.color || '#e0102e';
          av.textContent = u.avatar || '🙂';

          const mid = document.createElement('div');
          mid.className = 'r-mid';
          const b = document.createElement('b');
          b.textContent = u.display_name || u.username;
          const sm = document.createElement('small');
          sm.textContent = tr('fr_wants');
          mid.appendChild(b);
          mid.appendChild(sm);

          const act = document.createElement('div');
          act.className = 'r-act';

          const acceptBtn = document.createElement('button');
          acceptBtn.type = 'button';
          acceptBtn.className = 'b-p b-s';
          acceptBtn.textContent = '✓';
          acceptBtn.title = tr('fr_accept');
          acceptBtn.addEventListener('click', () => respondFriend(u.username, true));

          const declineBtn = document.createElement('button');
          declineBtn.type = 'button';
          declineBtn.className = 'b-g b-s';
          declineBtn.textContent = '✕';
          declineBtn.title = tr('fr_decline');
          declineBtn.addEventListener('click', () => respondFriend(u.username, false));

          act.appendChild(acceptBtn);
          act.appendChild(declineBtn);

          row.appendChild(av);
          row.appendChild(mid);
          row.appendChild(act);
          incList.appendChild(row);
        });
      } else {
        incSec.style.display = 'none';
      }
    }

    // 2. Friends list (online first)
    const frList = document.getElementById('fr-friends-list');
    if (frList) {
      frList.replaceChildren();

      if (!state.friends.length) {
        const empty = document.createElement('div');
        empty.className = 'empty2';
        const emo = document.createElement('span');
        emo.className = 'e';
        emo.textContent = '👥';
        const txt = document.createElement('span');
        txt.textContent = tr('fr_empty');
        empty.appendChild(emo);
        empty.appendChild(txt);
        frList.appendChild(empty);
      } else {
        const sorted = [...state.friends].sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0));

        sorted.forEach(u => {
          const itemWrap = document.createElement('div');

          const row = document.createElement('div');
          row.className = 'row2';

          const av = document.createElement('div');
          av.className = 'r-av';
          av.style.background = u.color || '#e0102e';
          av.textContent = u.avatar || '🙂';

          const dot = document.createElement('span');
          dot.className = 'dot' + (u.online ? ' on' : '');
          av.appendChild(dot);

          const mid = document.createElement('div');
          mid.className = 'r-mid';
          const b = document.createElement('b');
          b.textContent = u.display_name || u.username;
          const sm = document.createElement('small');
          if (u.online) {
            sm.className = 'on';
            sm.textContent = u.game ? `${tr('fr_in_game')} · ${gName(u.game)}` : tr('fr_online');
          } else {
            sm.textContent = tr('fr_offline');
          }
          mid.appendChild(b);
          mid.appendChild(sm);

          const act = document.createElement('div');
          act.className = 'r-act';

          // Invite game expander toggle
          const inviteBtn = document.createElement('button');
          inviteBtn.type = 'button';
          inviteBtn.className = 'b-p b-s';
          inviteBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg><span>' + tr('fr_call') + '</span>';

          const removeBtn = document.createElement('button');
          removeBtn.type = 'button';
          removeBtn.className = 'b-g b-s';
          removeBtn.setAttribute('aria-label', tr('fr_remove'));
          removeBtn.title = tr('fr_remove');
          removeBtn.innerHTML = '<svg viewBox="0 0 24 24" style="width:14px;height:14px"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
          removeBtn.addEventListener('click', () => removeFriend(u.username));

          act.appendChild(inviteBtn);
          act.appendChild(removeBtn);

          row.appendChild(av);
          row.appendChild(mid);
          row.appendChild(act);

          // Expander for games
          const xp = document.createElement('div');
          xp.className = 'xp';
          const xpIn = document.createElement('div');
          const p = document.createElement('p');
          p.textContent = tr('fr_choose_game');
          const chips = document.createElement('div');
          chips.className = 'chips';

          CALL_GAMES.forEach(g => {
            const ch = document.createElement('a');
            ch.className = 'chip2';
            ch.href = `/games/${g.id}?invite=${encodeURIComponent(u.username)}`;
            ch.textContent = `${g.ico} ${g.name}`;
            chips.appendChild(ch);
          });

          xpIn.appendChild(p);
          xpIn.appendChild(chips);
          xp.appendChild(xpIn);

          inviteBtn.addEventListener('click', () => {
            xp.classList.toggle('open');
          });

          itemWrap.appendChild(row);
          itemWrap.appendChild(xp);
          frList.appendChild(itemWrap);
        });
      }
    }
  }

  async function respondFriend(username, accept) {
    const res = await apiPost('/friends/respond', { from: username, accept });
    if (res.ok) {
      showToast(accept ? tr('fr_accepted') : tr('fr_declined'));
      loadFriends();
    }
  }

  async function removeFriend(username) {
    const res = await apiPost('/friends/remove', { user: username });
    if (res.ok) {
      showToast(tr('fr_removed'));
      loadFriends();
    }
  }

  let searchTimer = null;
  function handleFriendSearch(e) {
    clearTimeout(searchTimer);
    const q = (e.target.value || '').trim();
    const resBox = document.getElementById('fr-search-res');
    if (!resBox) return;

    if (!q) {
      resBox.replaceChildren();
      return;
    }

    searchTimer = setTimeout(async () => {
      const d = await apiGet('/users/search?q=' + encodeURIComponent(q));
      resBox.replaceChildren();

      const users = (d && d.users) || [];
      if (!users.length) {
        const empty = document.createElement('div');
        empty.className = 'empty2';
        empty.style.padding = '12px';
        empty.textContent = tr('fr_not_found');
        resBox.appendChild(empty);
        return;
      }

      users.forEach(u => {
        const row = document.createElement('div');
        row.className = 'row2';

        const av = document.createElement('div');
        av.className = 'r-av';
        av.style.background = u.color || '#e0102e';
        av.textContent = u.avatar || '🙂';

        const mid = document.createElement('div');
        mid.className = 'r-mid';
        const b = document.createElement('b');
        b.textContent = u.display_name || u.username;
        const sm = document.createElement('small');
        sm.textContent = '@' + u.username;
        mid.appendChild(b);
        mid.appendChild(sm);

        const act = document.createElement('div');
        act.className = 'r-act';
        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'b-p b-s';
        addBtn.textContent = tr('fr_add');
        addBtn.addEventListener('click', async () => {
          const r = await apiPost('/friends/request', { to: u.username });
          if (r.ok) {
            showToast(r.accepted ? tr('fr_now_friends') : tr('fr_req_sent'));
            loadFriends();
          } else {
            showToast(r.error || tr('err_generic'));
          }
        });

        act.appendChild(addBtn);
        row.appendChild(av);
        row.appendChild(mid);
        row.appendChild(act);
        resBox.appendChild(row);
      });
    }, 280);
  }

  // ═══════════ CHAT TAB (GLOBAL LOBBY CHAT) ═══════════
  function formatChatTime(ts) {
    try {
      const d = new Date(ts * 1000);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return `${hh}:${mm}`;
    } catch (e) {
      return '';
    }
  }

  function renderMessageItem(msg, prevMsg, myUsername, myRole) {
    const isMine = msg.u === myUsername;
    const isCont = prevMsg && prevMsg.u === msg.u && (msg.ts - prevMsg.ts < 180);

    const msgEl = document.createElement('div');
    msgEl.className = 'msg' + (isMine ? ' mine' : '') + (isCont ? ' cont' : '');
    msgEl.dataset.id = msg.id;

    // Avatar for non-mine messages
    if (!isMine) {
      const av = document.createElement('div');
      av.className = 'r-av';
      av.style.background = msg.c || '#e0102e';
      av.textContent = msg.a || '🙂';
      msgEl.appendChild(av);
    }

    // Message bubble
    const bub = document.createElement('div');
    bub.className = 'bub';

    // Sender name & time if not continued
    if (!isMine && !isCont) {
      const who = document.createElement('div');
      who.className = 'who';
      who.textContent = msg.n || msg.u;

      const timeEl = document.createElement('time');
      timeEl.textContent = formatChatTime(msg.ts);
      who.appendChild(timeEl);

      bub.appendChild(who);
    }

    // Message text (STRICT textContent)
    const tx = document.createElement('div');
    tx.className = 'tx';
    tx.textContent = msg.t;
    bub.appendChild(tx);

    // Timestamp for mine
    if (isMine) {
      const tm = document.createElement('span');
      tm.className = 'tm';
      tm.textContent = formatChatTime(msg.ts);
      bub.appendChild(tm);
    }

    msgEl.appendChild(bub);

    // Delete button (for author or root)
    if (isMine || myRole === 'root') {
      msgEl.classList.add('can');
      const delBtn = document.createElement('button');
      delBtn.type = 'button';
      delBtn.className = 'del';
      delBtn.setAttribute('aria-label', tr('ch_del'));
      delBtn.title = tr('ch_del');
      delBtn.innerHTML = '<svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>';
      delBtn.addEventListener('click', e => {
        e.stopPropagation();
        deleteChatMessage(msg.id);
      });
      msgEl.appendChild(delBtn);
    }

    return msgEl;
  }

  async function loadChatMessages(initial = false) {
    const query = state.lastChatId ? `?after=${state.lastChatId}` : '';
    const d = await apiGet('/chat' + query);
    if (!d || !d.ok) return;

    const myUsername = d.me || state.user.username;
    const myRole = state.user.role || 'member';
    const newMsgs = d.messages || [];
    const list = document.getElementById('ch-list');
    if (!list) return;

    if (initial && !state.lastChatId) {
      list.replaceChildren();
      state.chatMessages = [];
    }

    if (!newMsgs.length) {
      if (!list.children.length) {
        const empty = document.createElement('div');
        empty.className = 'ch-empty';
        const ico = document.createElement('div');
        ico.className = 'ch-empty-ico';
        ico.textContent = '💬';
        const t = document.createElement('b');
        t.textContent = tr('ch_title');
        const p = document.createElement('p');
        p.textContent = tr('ch_empty');
        empty.appendChild(ico);
        empty.appendChild(t);
        empty.appendChild(p);
        list.appendChild(empty);
      }
      return;
    }

    // Remove empty placeholder if present
    const placeholder = list.querySelector('.ch-empty, .empty2');
    if (placeholder) placeholder.remove();

    // Check if user is scrolled near bottom
    const isNearBottom = list.scrollHeight - list.scrollTop - list.clientHeight < 75;

    newMsgs.forEach(msg => {
      const prevMsg = state.chatMessages[state.chatMessages.length - 1];
      state.chatMessages.push(msg);
      if (msg.id > state.lastChatId) state.lastChatId = msg.id;

      const msgEl = renderMessageItem(msg, prevMsg, myUsername, myRole);
      list.appendChild(msgEl);
    });

    if (initial || isNearBottom) {
      list.scrollTop = list.scrollHeight;
      const newBtn = document.getElementById('ch-new-btn');
      if (newBtn) newBtn.classList.remove('on');
    } else {
      // User scrolled up — notify with floating pill
      const newBtn = document.getElementById('ch-new-btn');
      if (newBtn) newBtn.classList.add('on');
    }
  }

  async function sendChatMessage() {
    const inp = document.getElementById('ch-text-inp');
    const sendBtn = document.getElementById('ch-send-btn');
    if (!inp) return;

    const text = (inp.value || '').trim();
    if (!text) return;

    if (sendBtn) sendBtn.disabled = true;

    const res = await apiPost('/chat', { text });
    if (sendBtn) sendBtn.disabled = false;

    if (res && res.ok) {
      inp.value = '';
      inp.style.height = '46px';
      updateCharCounter('');
      await loadChatMessages();
      const list = document.getElementById('ch-list');
      if (list) list.scrollTop = list.scrollHeight;
      const newBtn = document.getElementById('ch-new-btn');
      if (newBtn) newBtn.classList.remove('on');
    } else {
      showToast((res && res.error) || tr('err_generic'));
    }
  }

  async function deleteChatMessage(id) {
    const res = await apiPost('/chat/delete', { id });
    if (res.ok) {
      showToast(tr('ch_del_ok'));
      const msgEl = document.querySelector(`.msg[data-id="${id}"]`);
      if (msgEl) msgEl.remove();
    } else {
      showToast(res.error || tr('err_generic'));
    }
  }

  function startChatPolling() {
    stopChatPolling();
    state.chatPollTimer = setInterval(() => {
      if (state.isOpen && state.activeTab === 'chat') {
        loadChatMessages();
      }
    }, 3000);
  }

  function stopChatPolling() {
    if (state.chatPollTimer) {
      clearInterval(state.chatPollTimer);
      state.chatPollTimer = null;
    }
  }

  function updateCharCounter(text) {
    const cnt = document.getElementById('ch-char-cnt');
    if (!cnt) return;
    const len = (text || '').length;
    cnt.textContent = `${len}/300`;
    cnt.classList.toggle('over', len >= 280);
  }

  // ═══════════ SETTINGS TAB ═══════════
  function initSettings() {
    // Language buttons
    const langSeg = document.getElementById('sh-lang-seg');
    if (langSeg) {
      const curLang = getLang();
      langSeg.querySelectorAll('button').forEach(b => {
        const match = b.dataset.lang === curLang;
        b.classList.toggle('on', match);
        b.setAttribute('aria-pressed', match ? 'true' : 'false');
      });

      langSeg.addEventListener('click', e => {
        const b = e.target.closest('button');
        if (!b) return;
        const newLang = b.dataset.lang;
        if (!newLang) return;
        try { localStorage.setItem('jg_lang', newLang); } catch (err) {}
        window.LANG = newLang;
        if (window.applyI18n && typeof window.applyI18n === 'function') {
          window.applyI18n();
        } else {
          document.querySelectorAll('#langbar button').forEach(x => {
            x.classList.toggle('active', x.dataset.lang === newLang);
          });
          document.querySelectorAll('#sh-lang-seg button').forEach(x => {
            const match = x.dataset.lang === newLang;
            x.classList.toggle('on', match);
            x.setAttribute('aria-pressed', match ? 'true' : 'false');
          });
        }
        langSeg.querySelectorAll('button').forEach(x => {
          const match = x.dataset.lang === newLang;
          x.classList.toggle('on', match);
          x.setAttribute('aria-pressed', match ? 'true' : 'false');
        });
        document.querySelectorAll('#shell [data-i18n]').forEach(el => {
          const v = tr(el.dataset.i18n);
          if (v) el.textContent = v;
        });
        document.querySelectorAll('#shell [data-i18n-ph]').forEach(el => {
          const v = tr(el.dataset.i18nPh);
          if (v) el.placeholder = v;
        });
        // Rerender active strings
        loadProfile();
        loadFriends();
      });
    }

    // Sound toggle
    const soundSw = document.getElementById('set-sound-sw');
    if (soundSw) {
      soundSw.addEventListener('click', toggleSound);
    }
    const accSoundSw = document.getElementById('acc-sound-sw');
    if (accSoundSw) {
      accSoundSw.addEventListener('click', toggleSound);
    }

    // Reduced motion toggle
    const rmSw = document.getElementById('set-rm-sw');
    if (rmSw) {
      rmSw.addEventListener('click', toggleReducedMotion);
    }
  }

  // ═══════════ EVENT LISTENERS & WIRING ═══════════
  function setupEvents() {
    // 1. Close button & backdrop
    const closeBtn = document.getElementById('sh-close');
    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);

    const bd = document.querySelector('.sh-bd');
    if (bd) bd.addEventListener('click', closeDrawer);

    // 2. Escape key
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape' && state.isOpen) {
        closeDrawer();
      }
      handleFocusTrap(e);
    });

    // 3. Tab buttons
    document.querySelectorAll('.sh-tabs button[data-tab]').forEach(btn => {
      btn.addEventListener('click', () => {
        switchTab(btn.dataset.tab, true);
      });
    });

    // 4. Desktop Nav & Mobile Dock buttons
    document.addEventListener('click', e => {
      const navBtn = e.target.closest('#navIc button, #dock button');
      if (navBtn && navBtn.dataset.tab) {
        e.preventDefault();
        openDrawer(navBtn.dataset.tab);
        return;
      }

      // Profile Card in top navbar
      const pc = e.target.closest('.profile-card');
      if (pc) {
        e.preventDefault();
        openDrawer('account');
        return;
      }

      // Hero "Friends & profile" link
      const heroLink = e.target.closest('a[href="/games/profile"]');
      if (heroLink) {
        e.preventDefault();
        openDrawer('friends');
      }
    });

    // Direct click listeners for extra robustness
    document.querySelectorAll('#navIc button[data-tab], #dock button[data-tab]').forEach(btn => {
      btn.addEventListener('click', e => {
        e.preventDefault();
        openDrawer(btn.dataset.tab);
      });
    });
    const pcDirect = document.querySelector('.profile-card');
    if (pcDirect) {
      pcDirect.addEventListener('click', e => {
        e.preventDefault();
        openDrawer('account');
      });
    }

    // 5. Account actions
    const saveBtn = document.getElementById('acc-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveProfile);

    const pwBtn = document.getElementById('acc-pw-btn');
    if (pwBtn) pwBtn.addEventListener('click', changePassword);

    const logoutBtn = document.getElementById('acc-logout-btn');
    if (logoutBtn) logoutBtn.addEventListener('click', logout);

    // 6. Friends search input
    const searchInp = document.getElementById('fr-search-inp');
    if (searchInp) searchInp.addEventListener('input', handleFriendSearch);

    // 7. Chat actions
    const chatInp = document.getElementById('ch-text-inp');
    if (chatInp) {
      chatInp.addEventListener('input', () => {
        chatInp.style.height = 'auto';
        chatInp.style.height = Math.min(120, Math.max(46, chatInp.scrollHeight)) + 'px';
        updateCharCounter(chatInp.value);
      });

      chatInp.addEventListener('keydown', e => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendChatMessage();
        }
      });
    }

    const sendBtn = document.getElementById('ch-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', sendChatMessage);

    const newBtn = document.getElementById('ch-new-btn');
    const chList = document.getElementById('ch-list');
    if (newBtn && chList) {
      newBtn.addEventListener('click', () => {
        chList.scrollTop = chList.scrollHeight;
        newBtn.classList.remove('on');
      });

      chList.addEventListener('scroll', () => {
        const isNearBottom = chList.scrollHeight - chList.scrollTop - chList.clientHeight < 40;
        if (isNearBottom) newBtn.classList.remove('on');
      }, { passive: true });
    }

    // 8. Window resize updates indicator
    window.addEventListener('resize', () => {
      const curBtn = document.getElementById('tab-btn-' + state.activeTab);
      if (curBtn) updateIndicator(curBtn);
    });
  }

  // ═══════════ INITIALIZATION ═══════════
  function init() {
    ensureShellDOM();
    buildPickers();
    syncPickers();
    initReducedMotion();
    initSettings();
    initGestures();
    setupEvents();
    loadProfile();
    loadFriends();
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
    refreshProfile: loadProfile,
    refreshFriends: loadFriends
  };
})();
