/* Lobby.gg — Smart WebSocket Auto-Reconnect & Connection Health Monitor */
window.JarvisWS = function(url, options = {}) {
  let ws = null;
  let attempts = 0;
  const maxAttempts = options.maxAttempts || 10;
  let isClosedIntentionally = false;
  let pingInterval = null;

  const I18N = {
    uk: {
      restored: 'З\'єднання відновлено! ⚡',
      reconnecting: 'Зв\'язок втрачено. Перепідключення ({cur}/{max})...',
      failed: 'Не вдалося підключитися до сервера. Оновіть сторінку.'
    },
    ru: {
      restored: 'Соединение восстановлено! ⚡',
      reconnecting: 'Связь потеряна. Переподключение ({cur}/{max})...',
      failed: 'Не удалось подключиться к серверу. Обновите страницу.'
    },
    en: {
      restored: 'Connection restored! ⚡',
      reconnecting: 'Connection lost. Reconnecting ({cur}/{max})...',
      failed: 'Could not connect to server. Please refresh the page.'
    },
    de: {
      restored: 'Verbindung wiederhergestellt! ⚡',
      reconnecting: 'Verbindung verloren. Erneuter Versuch ({cur}/{max})...',
      failed: 'Verbindung zum Server fehlgeschlagen. Bitte Seite aktualisieren.'
    }
  };

  function getLang() {
    return (window.LobbyI18n && typeof window.LobbyI18n.lang === 'function')
      ? window.LobbyI18n.lang()
      : (localStorage.getItem('jg_lang') || 'ru');
  }

  function msg(key, vars) {
    const l = getLang();
    let text = (I18N[l] && I18N[l][key]) || I18N.ru[key] || key;
    if (vars) {
      for (const k in vars) {
        text = text.replace('{' + k + '}', vars[k]);
      }
    }
    return text;
  }

  let banner = document.getElementById('jarvis-ws-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'jarvis-ws-banner';
    banner.style.cssText = `
      position: fixed; top: 12px; left: 50%; transform: translateX(-50%);
      z-index: 9999; padding: 6px 16px; border-radius: 20px; font-size: 12px;
      font-weight: 700; color: #fff; background: rgba(255, 34, 56, 0.85);
      backdrop-filter: blur(10px); display: none; transition: opacity 0.3s;
      box-shadow: 0 4px 15px rgba(255, 34, 56, 0.4);
    `;
    document.body.appendChild(banner);
  }

  function showBanner(text, isError = true) {
    banner.textContent = text;
    banner.style.background = isError ? 'rgba(255, 34, 56, 0.85)' : 'rgba(34, 197, 94, 0.85)';
    banner.style.display = 'block';
  }

  function hideBanner() {
    banner.style.display = 'none';
  }

  function connect() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const fullUrl = url.startsWith("ws") ? url : `${protocol}//${window.location.host}${url}`;
    ws = new WebSocket(fullUrl);

    ws.onopen = (e) => {
      attempts = 0;
      if (banner.style.display === 'block') {
        showBanner(msg('restored'), false);
        setTimeout(hideBanner, 2000);
      }
      if (options.onopen) options.onopen(e);

      clearInterval(pingInterval);
      pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          try { ws.send(JSON.stringify({ type: 'ping' })); } catch(e){}
        }
      }, 25000);
    };

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        if (data.type === 'pong') return;
      } catch(ex){}
      if (options.onmessage) options.onmessage(e);
    };

    ws.onerror = (e) => {
      if (options.onerror) options.onerror(e);
    };

    ws.onclose = (e) => {
      clearInterval(pingInterval);
      if (isClosedIntentionally) return;

      if (attempts < maxAttempts) {
        attempts++;
        const delay = Math.min(5000, 1000 * Math.pow(1.5, attempts));
        showBanner(msg('reconnecting', { cur: attempts, max: maxAttempts }));
        setTimeout(connect, delay);
      } else {
        showBanner(msg('failed'));
      }
      if (options.onclose) options.onclose(e);
    };
  }

  connect();

  return {
    send: (data) => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(typeof data === 'object' ? JSON.stringify(data) : data);
      }
    },
    close: () => {
      isClosedIntentionally = true;
      clearInterval(pingInterval);
      if (ws) ws.close();
    },
    getSocket: () => ws
  };
};
