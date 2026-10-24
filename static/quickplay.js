/**
 * Lobby.gg — Быстрая игра (матчмейкинг для дуэлей: c4, reversi, dots, bulls, battleship, checkers, chess)
 * Подключается одной строкой: <script src="/games/static/quickplay.js"></script>
 */
(function () {
  "use strict";
  if (window.__LobbyQuickPlayLoaded) return;
  window.__LobbyQuickPlayLoaded = true;

  var DUEL_GAMES = {
    c4: true,
    reversi: true,
    dots: true,
    bulls: true,
    battleship: true,
    checkers: true,
    chess: true,
  };

  var QP_I18N = {
    uk: {
      btn: "⚡ Швидка гра",
      searching: "Шукаємо суперника…",
      cancel: "Скасувати",
      timeout: "Суперник поки не знайшовся",
      bot: "🤖 Грати з ботом",
      retry: "🔄 Шукати далі"
    },
    ru: {
      btn: "⚡ Быстрая игра",
      searching: "Ищем соперника…",
      cancel: "Отмена",
      timeout: "Соперник пока не нашёлся",
      bot: "🤖 Играть с ботом",
      retry: "🔄 Искать дальше"
    },
    en: {
      btn: "⚡ Quick play",
      searching: "Searching for opponent…",
      cancel: "Cancel",
      timeout: "No opponent found yet",
      bot: "🤖 Play with bot",
      retry: "🔄 Keep searching"
    }
  };

  function getLang() {
    return (window.LobbyI18n && typeof window.LobbyI18n.lang === "function")
      ? window.LobbyI18n.lang()
      : (localStorage.getItem("jg_lang") || "ru");
  }

  function qpT(key) {
    var l = getLang();
    return (QP_I18N[l] && QP_I18N[l][key]) || QP_I18N.ru[key] || key;
  }

  var activeSocket = null;
  var hookedSockets = typeof WeakSet !== "undefined" ? new WeakSet() : [];
  var qpState = "idle"; // "idle" | "searching" | "timeout"
  var pendingBotDiff = null;

  var qpBtn = null;
  var qpBox = null;
  var qpStatusText = null;
  var qpSearchRow = null;
  var qpTimeoutRow = null;

  function updateQpLabels() {
    if (qpBtn) qpBtn.textContent = qpT("btn");
    if (qpStatusText && qpState === "searching") qpStatusText.textContent = qpT("searching");
    var cancelBtn = document.getElementById("qp-cancel-btn");
    if (cancelBtn) cancelBtn.textContent = qpT("cancel");
    if (qpTimeoutRow) {
      var tTitle = qpTimeoutRow.querySelector(".qp-status-line");
      if (tTitle) tTitle.textContent = qpT("timeout");
    }
    var botBtn = document.getElementById("qp-bot-btn");
    if (botBtn) botBtn.textContent = qpT("bot");
    var retryBtn = document.getElementById("qp-retry-btn");
    if (retryBtn) retryBtn.textContent = qpT("retry");
  }

  function detectGame() {
    var parts = (location.pathname || "").split("/").filter(Boolean);
    var last = (parts.pop() || "").toLowerCase().replace(/\.html$/, "");
    if (DUEL_GAMES[last]) return last;
    if (typeof window.create === "function") {
      var m = String(window.create).match(/game\s*:\s*['"]([a-z0-9_]+)['"]/i);
      if (m && DUEL_GAMES[m[1].toLowerCase()]) return m[1].toLowerCase();
    }
    return last;
  }

  function getPlayerName() {
    var inp = document.getElementById("name");
    var val = inp && inp.value ? inp.value.trim() : "";
    if (val) {
      try {
        localStorage.setItem("jg_player_name", val);
      } catch (_) {}
      return val.slice(0, 20);
    }
    var l = getLang();
    return l === "uk" ? "Гравець" : (l === "en" ? "Player" : "Игрок");
  }

  function getSelectedBotDiff() {
    var opt = document.querySelector(".botdiff .opt.on");
    return (opt && opt.dataset && opt.dataset.d) || "medium";
  }

  function findOpenSocket() {
    if (activeSocket && activeSocket.readyState === 1) return activeSocket;
    try {
      if (typeof ws !== "undefined" && ws) {
        if (typeof ws.getSocket === "function") {
          var s = ws.getSocket();
          if (s && s.readyState === 1) return s;
        }
        if (ws.readyState === 1 && typeof ws.send === "function") {
          return ws;
        }
      }
    } catch (_) {}
    return null;
  }

  function sendPayload(obj) {
    var sock = findOpenSocket();
    if (sock) {
      sock.send(JSON.stringify(obj));
      return true;
    }
    if (typeof window.connect === "function") {
      window.connect(function () {
        if (typeof window.send === "function") {
          window.send(obj);
        } else {
          var s = findOpenSocket();
          if (s) s.send(JSON.stringify(obj));
        }
      });
      return true;
    }
    return false;
  }

  function injectStyles() {
    if (document.getElementById("qp-styles")) return;
    var st = document.createElement("style");
    st.id = "qp-styles";
    st.textContent = [
      ".qp-btn-row { display: flex; gap: 8px; margin: 6px 0; align-items: stretch; }",
      ".qp-btn-row > button { margin: 0 !important; flex: 1; display: inline-flex; align-items: center; justify-content: center; gap: 6px; }",
      ".qp-fast-btn {",
      "  background: linear-gradient(135deg, #ff5e3a 0%, var(--crimson, #ff2238) 55%, var(--crimson-deep, #c40f23) 100%) !important;",
      "  box-shadow: 0 6px 20px -6px rgba(255, 60, 56, 0.6), inset 0 1px 0 rgba(255, 255, 255, 0.25) !important;",
      "}",
      ".qp-box {",
      "  margin: 8px 0 6px;",
      "  padding: 12px 14px;",
      "  border-radius: 14px;",
      "  background: rgba(255, 255, 255, 0.035);",
      "  border: 1px solid rgba(255, 34, 56, 0.32);",
      "  box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 8px 24px -8px rgba(0, 0, 0, 0.6);",
      "  text-align: center;",
      "  animation: fadein 0.2s ease both;",
      "}",
      ".qp-status-line {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  gap: 9px;",
      "  font-size: 14px;",
      "  font-weight: 700;",
      "  color: var(--text, #f4f4f7);",
      "  margin-bottom: 10px;",
      "}",
      ".qp-spinner {",
      "  width: 14px;",
      "  height: 14px;",
      "  border-radius: 50%;",
      "  border: 2px solid rgba(255, 255, 255, 0.22);",
      "  border-top-color: var(--crimson, #ff2238);",
      "  animation: qpSpin 0.8s linear infinite;",
      "  flex-shrink: 0;",
      "}",
      "@keyframes qpSpin { to { transform: rotate(360deg); } }",
      ".qp-box button { padding: 10px 12px; font-size: 14px; margin: 0; }",
      ".qp-timeout-actions { display: flex; gap: 8px; }",
      ".qp-timeout-actions > button { flex: 1; margin: 0 !important; }",
    ].join("\n");
    document.head.appendChild(st);
  }

  function setUIState(state) {
    qpState = state;
    if (!qpBox) return;
    updateQpLabels();
    if (state === "idle") {
      qpBox.classList.add("hide");
      if (qpBtn) qpBtn.disabled = false;
    } else if (state === "searching") {
      qpBox.classList.remove("hide");
      qpSearchRow.classList.remove("hide");
      qpTimeoutRow.classList.add("hide");
      if (qpStatusText) qpStatusText.textContent = qpT("searching");
      if (qpBtn) qpBtn.disabled = true;
    } else if (state === "timeout") {
      qpBox.classList.remove("hide");
      qpSearchRow.classList.add("hide");
      qpTimeoutRow.classList.remove("hide");
      if (qpBtn) qpBtn.disabled = false;
    }
  }

  function startQuickPlay() {
    var game = detectGame();
    if (!DUEL_GAMES[game]) return;
    pendingBotDiff = null;
    setUIState("searching");
    sendPayload({
      action: "quick_play",
      game: game,
      name: getPlayerName(),
    });
  }

  function cancelQuickPlay() {
    pendingBotDiff = null;
    var sock = findOpenSocket();
    if (sock) {
      try {
        sock.send(JSON.stringify({ action: "quick_cancel" }));
      } catch (_) {}
    }
    setUIState("idle");
  }

  function playWithBotAfterTimeout() {
    var game = detectGame();
    if (!DUEL_GAMES[game]) return;
    pendingBotDiff = getSelectedBotDiff();
    setUIState("idle");
    sendPayload({
      action: "create",
      name: getPlayerName(),
      game: game,
    });
  }

  function ensureDOM() {
    var game = detectGame();
    if (!DUEL_GAMES[game]) return;
    var home = document.getElementById("home");
    if (!home || document.getElementById("qp-btn")) return;

    injectStyles();

    var createBtn =
      home.querySelector('button[onclick*="create"]') ||
      home.querySelector("button");
    if (!createBtn) return;

    var row = document.createElement("div");
    row.className = "row qp-btn-row";
    createBtn.parentNode.insertBefore(row, createBtn);
    row.appendChild(createBtn);

    qpBtn = document.createElement("button");
    qpBtn.type = "button";
    qpBtn.id = "qp-btn";
    qpBtn.className = "qp-fast-btn";
    qpBtn.textContent = qpT("btn");
    qpBtn.onclick = startQuickPlay;
    row.appendChild(qpBtn);

    qpBox = document.createElement("div");
    qpBox.id = "qp-box";
    qpBox.className = "qp-box hide";

    // Блок активного поиска («Ищем соперника…» + «Отмена»)
    qpSearchRow = document.createElement("div");
    qpSearchRow.id = "qp-search-view";

    var statusLine = document.createElement("div");
    statusLine.className = "qp-status-line";
    var spinner = document.createElement("span");
    spinner.className = "qp-spinner";
    qpStatusText = document.createElement("span");
    qpStatusText.id = "qp-status-text";
    qpStatusText.textContent = qpT("searching");
    statusLine.appendChild(spinner);
    statusLine.appendChild(qpStatusText);

    var cancelBtn = document.createElement("button");
    cancelBtn.type = "button";
    cancelBtn.id = "qp-cancel-btn";
    cancelBtn.className = "sec";
    cancelBtn.textContent = qpT("cancel");
    cancelBtn.onclick = cancelQuickPlay;

    qpSearchRow.appendChild(statusLine);
    qpSearchRow.appendChild(cancelBtn);

    // Блок по таймауту («Играть с ботом» / «Искать дальше»)
    qpTimeoutRow = document.createElement("div");
    qpTimeoutRow.id = "qp-timeout-view";
    qpTimeoutRow.className = "hide";

    var timeoutTitle = document.createElement("div");
    timeoutTitle.className = "qp-status-line";
    timeoutTitle.textContent = qpT("timeout");

    var timeoutActions = document.createElement("div");
    timeoutActions.className = "row qp-timeout-actions";

    var botBtn = document.createElement("button");
    botBtn.type = "button";
    botBtn.id = "qp-bot-btn";
    botBtn.textContent = qpT("bot");
    botBtn.onclick = playWithBotAfterTimeout;

    var retryBtn = document.createElement("button");
    retryBtn.type = "button";
    retryBtn.id = "qp-retry-btn";
    retryBtn.className = "sec";
    retryBtn.textContent = qpT("retry");
    retryBtn.onclick = startQuickPlay;

    timeoutActions.appendChild(botBtn);
    timeoutActions.appendChild(retryBtn);

    qpTimeoutRow.appendChild(timeoutTitle);
    qpTimeoutRow.appendChild(timeoutActions);

    qpBox.appendChild(qpSearchRow);
    qpBox.appendChild(qpTimeoutRow);

    row.insertAdjacentElement("afterend", qpBox);
  }

  function handleIncomingPayload(m) {
    if (!m || typeof m !== "object") return;
    if (m.type === "queue") {
      if (m.status === "waiting") {
        setUIState("searching");
      } else if (m.status === "cancelled") {
        setUIState("idle");
      } else if (m.status === "timeout") {
        setUIState("timeout");
      }
    } else if (m.type === "joined") {
      setUIState("idle");
      if (pendingBotDiff) {
        var diff = pendingBotDiff;
        pendingBotDiff = null;
        var sock = findOpenSocket();
        if (sock) {
          try {
            sock.send(JSON.stringify({ action: "add_bot", diff: diff }));
          } catch (_) {}
        }
      }
    } else if (
      m.type === "lobby" ||
      (typeof m.type === "string" && m.type.indexOf("_state") !== -1)
    ) {
      setUIState("idle");
    }
  }

  function hookSocketInstance(sock) {
    if (!sock || typeof sock.addEventListener !== "function") return;
    var url = String(sock.url || "");
    if (url.indexOf("/ws/chat") !== -1) return;

    if (
      hookedSockets.has
        ? hookedSockets.has(sock)
        : hookedSockets.indexOf(sock) !== -1
    ) {
      return;
    }
    if (hookedSockets.add) hookedSockets.add(sock);
    else hookedSockets.push(sock);

    activeSocket = sock;
    sock.addEventListener("message", function (ev) {
      if (!ev || typeof ev.data !== "string") return;
      try {
        handleIncomingPayload(JSON.parse(ev.data));
      } catch (_) {}
    });
    sock.addEventListener("close", function () {
      if (qpState === "searching") {
        setUIState("idle");
      }
    });
  }

  var OrigWS = window.WebSocket;
  if (OrigWS && OrigWS.prototype && typeof OrigWS.prototype.send === "function") {
    var origProtoSend = OrigWS.prototype.send;
    OrigWS.prototype.send = function () {
      hookSocketInstance(this);
      return origProtoSend.apply(this, arguments);
    };
  }

  if (OrigWS) {
    var WrappedWS = function (url, protocols) {
      var wsInst =
        protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
      hookSocketInstance(wsInst);
      return wsInst;
    };
    WrappedWS.prototype = OrigWS.prototype;
    WrappedWS.CONNECTING = OrigWS.CONNECTING;
    WrappedWS.OPEN = OrigWS.OPEN;
    WrappedWS.CLOSING = OrigWS.CLOSING;
    WrappedWS.CLOSED = OrigWS.CLOSED;
    window.WebSocket = WrappedWS;
  }

  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("#langbar, .langbar")) {
      updateQpLabels();
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureDOM);
  } else {
    ensureDOM();
  }

  window.quickPlay = startQuickPlay;
  window.quickCancel = cancelQuickPlay;
})();
