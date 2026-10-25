/**
 * Lobby.gg — Внутрикомнатный чат (room_chat.js)
 * Подключается одной строкой <script src="/games/static/room_chat.js"></script>
 * Автоматически перехватывает игровой WebSocket (/games/ws или /ws),
 * отображает сворачиваемую панель чата в стиле theme.css и хранит до 50 сообщений.
 */
(function () {
  "use strict";
  if (window.__LobbyRoomChatLoaded) return;
  window.__LobbyRoomChatLoaded = true;

  var MAX_LEN = 300;
  var MAX_HISTORY = 50;
  var COOLDOWN_MS = 1000;

  var activeSocket = null;
  var myPid = null;
  var roomCode = "";
  var inRoom = false;
  var isOpen = false;
  var unreadCount = 0;
  var lastSendTs = 0;
  var messages = []; // [{id, pid, user, name, text, ts}]
  var seenIds = Object.create(null);
  var hookedSockets = typeof WeakSet !== "undefined" ? new WeakSet() : [];

  var I18N = {
    ru: {
      btn: "Чат",
      title: "Чат комнаты",
      empty: "Сообщений пока нет. Напишите первым!",
      placeholder: "Сообщение (до 300 симв.)…",
      send: "➤",
      you: "Вы",
      rate_err: "Подождите секунду перед следующим сообщением",
      close: "Свернуть",
    },
    uk: {
      btn: "Чат",
      title: "Чат кімнати",
      empty: "Повідомлень ще немає. Напишіть першим!",
      placeholder: "Повідомлення (до 300 симв.)…",
      send: "➤",
      you: "Ви",
      rate_err: "Зачекайте секунду перед наступним повідомленням",
      close: "Згорнути",
    },
    en: {
      btn: "Chat",
      title: "Room Chat",
      empty: "No messages yet. Say hello!",
      placeholder: "Message (max 300 chars)…",
      send: "➤",
      you: "You",
      rate_err: "Wait 1 second between messages",
      close: "Minimize",
    },
    de: {
      btn: "Chat",
      title: "Raum-Chat",
      empty: "Noch keine Nachrichten. Schreib als Erster!",
      placeholder: "Nachricht (max. 300 Zeichen)…",
      send: "➤",
      you: "Du",
      rate_err: "Warte 1 Sekunde vor der nächsten Nachricht",
      close: "Minimieren",
    },
  };

  function getLang() {
    var l = (localStorage.getItem("jg_lang") || document.documentElement.lang || "ru").toLowerCase();
    return I18N[l] ? l : "ru";
  }

  function t(key) {
    var d = I18N[getLang()] || I18N.ru;
    return d[key] || I18N.ru[key] || key;
  }

  // Декодирование HTML-сущностей (сервер экранирует через html.escape),
  // после чего в DOM вставляем исключительно через textContent.
  var decoderEl = null;
  function decodeEntities(str) {
    if (!str) return "";
    if (!decoderEl) decoderEl = document.createElement("textarea");
    decoderEl.innerHTML = String(str);
    return decoderEl.value;
  }

  function formatTime(ts) {
    var d = ts ? new Date(ts * 1000) : new Date();
    var hh = String(d.getHours()).padStart(2, "0");
    var mm = String(d.getMinutes()).padStart(2, "0");
    return hh + ":" + mm;
  }

  // ── Инъекция стилей в духе theme.css ──
  function injectStyles() {
    if (document.getElementById("rc-styles")) return;
    var st = document.createElement("style");
    st.id = "rc-styles";
    st.textContent = [
      "#rc-root {",
      "  position: fixed;",
      "  left: 14px;",
      "  bottom: calc(14px + env(safe-area-inset-bottom, 0px));",
      "  z-index: 9998;",
      "  font-family: var(--font, 'Plus Jakarta Sans', system-ui, -apple-system, sans-serif);",
      "  color: var(--text, #f3f3f7);",
      "  user-select: none;",
      "  -webkit-user-select: none;",
      "}",
      "#rc-root.rc-hidden { display: none !important; }",
      "#rc-toggle {",
      "  width: auto;",
      "  margin: 0;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  gap: 7px;",
      "  padding: 10px 15px;",
      "  border-radius: 999px;",
      "  background: rgba(14, 14, 22, 0.88);",
      "  color: var(--text, #f3f3f7);",
      "  border: 1px solid rgba(255, 34, 56, 0.4);",
      "  box-shadow: 0 6px 24px rgba(0, 0, 0, 0.6), 0 0 18px rgba(255, 34, 56, 0.22);",
      "  backdrop-filter: blur(14px);",
      "  -webkit-backdrop-filter: blur(14px);",
      "  font-size: 13px;",
      "  font-weight: 800;",
      "  letter-spacing: -0.01em;",
      "  cursor: pointer;",
      "  transition: transform 0.14s ease, border-color 0.2s ease, box-shadow 0.2s ease;",
      "}",
      "#rc-toggle:hover {",
      "  border-color: var(--crimson, #ff2238);",
      "  box-shadow: 0 8px 26px rgba(0, 0, 0, 0.7), 0 0 22px rgba(255, 34, 56, 0.4);",
      "}",
      "#rc-toggle:active { transform: scale(0.96); }",
      "#rc-badge {",
      "  display: none;",
      "  min-width: 19px;",
      "  height: 19px;",
      "  padding: 0 6px;",
      "  border-radius: 999px;",
      "  background: linear-gradient(135deg, var(--crimson, #ff2238), var(--crimson-2, #b8071f));",
      "  color: #fff;",
      "  font-size: 11px;",
      "  font-weight: 800;",
      "  line-height: 19px;",
      "  text-align: center;",
      "  box-shadow: 0 0 10px rgba(255, 34, 56, 0.6);",
      "}",
      "#rc-badge.rc-show { display: inline-block; }",
      "#rc-preview {",
      "  position: absolute;",
      "  left: 0;",
      "  bottom: calc(100% + 8px);",
      "  max-width: min(280px, calc(100vw - 32px));",
      "  background: rgba(16, 16, 26, 0.94);",
      "  border: 1px solid rgba(255, 34, 56, 0.38);",
      "  border-radius: 12px;",
      "  padding: 7px 11px;",
      "  font-size: 12px;",
      "  line-height: 1.35;",
      "  color: var(--text, #f3f3f7);",
      "  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.65);",
      "  backdrop-filter: blur(12px);",
      "  -webkit-backdrop-filter: blur(12px);",
      "  cursor: pointer;",
      "  white-space: nowrap;",
      "  overflow: hidden;",
      "  text-overflow: ellipsis;",
      "  display: none;",
      "  animation: rcFadeIn 0.18s ease-out;",
      "}",
      "#rc-preview b { color: var(--crimson, #ff2238); margin-right: 4px; }",
      "#rc-panel {",
      "  position: absolute;",
      "  left: 0;",
      "  bottom: calc(100% + 10px);",
      "  width: min(340px, calc(100vw - 28px));",
      "  height: min(390px, calc(100dvh - 120px));",
      "  background: linear-gradient(180deg, rgba(20, 20, 30, 0.96), rgba(10, 10, 16, 0.97));",
      "  border: 1px solid var(--border, rgba(255, 255, 255, 0.11));",
      "  border-radius: 18px;",
      "  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.8), 0 0 28px rgba(255, 34, 56, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.08);",
      "  backdrop-filter: blur(20px);",
      "  -webkit-backdrop-filter: blur(20px);",
      "  display: none;",
      "  flex-direction: column;",
      "  overflow: hidden;",
      "  animation: rcFadeIn 0.16s ease-out;",
      "}",
      "#rc-panel.rc-open { display: flex; }",
      "@keyframes rcFadeIn {",
      "  from { opacity: 0; transform: translateY(8px) scale(0.98); }",
      "  to   { opacity: 1; transform: translateY(0) scale(1); }",
      "}",
      ".rc-head {",
      "  display: flex;",
      "  align-items: center;",
      "  justify-content: space-between;",
      "  padding: 10px 14px;",
      "  background: rgba(255, 255, 255, 0.03);",
      "  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.08));",
      "}",
      ".rc-title-wrap {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 8px;",
      "  font-size: 13px;",
      "  font-weight: 800;",
      "  letter-spacing: 0.01em;",
      "}",
      ".rc-code-pill {",
      "  font-family: var(--mono, monospace);",
      "  font-size: 11px;",
      "  font-weight: 800;",
      "  color: var(--crimson, #ff2238);",
      "  background: rgba(255, 34, 56, 0.12);",
      "  border: 1px solid rgba(255, 34, 56, 0.3);",
      "  border-radius: 6px;",
      "  padding: 2px 6px;",
      "  letter-spacing: 1px;",
      "}",
      ".rc-close-btn {",
      "  width: 28px !important;",
      "  height: 28px !important;",
      "  margin: 0 !important;",
      "  padding: 0 !important;",
      "  border-radius: 8px !important;",
      "  background: rgba(255, 255, 255, 0.06) !important;",
      "  color: var(--muted, #7c7c8a) !important;",
      "  border: 1px solid rgba(255, 255, 255, 0.08) !important;",
      "  box-shadow: none !important;",
      "  font-size: 14px !important;",
      "  font-weight: 800 !important;",
      "  line-height: 1 !important;",
      "  cursor: pointer;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "}",
      ".rc-close-btn:hover { color: #fff !important; background: rgba(255, 34, 56, 0.22) !important; }",
      "#rc-list {",
      "  flex: 1;",
      "  overflow-y: auto;",
      "  padding: 10px 12px;",
      "  display: flex;",
      "  flex-direction: column;",
      "  gap: 7px;",
      "  user-select: text;",
      "  -webkit-user-select: text;",
      "  overscroll-behavior: contain;",
      "}",
      ".rc-empty {",
      "  margin: auto;",
      "  text-align: center;",
      "  font-size: 12px;",
      "  color: var(--muted, #7c7c8a);",
      "  padding: 20px 12px;",
      "}",
      ".rc-msg {",
      "  max-width: 88%;",
      "  padding: 7px 10px;",
      "  border-radius: 12px;",
      "  background: rgba(255, 255, 255, 0.05);",
      "  border: 1px solid rgba(255, 255, 255, 0.07);",
      "  align-self: flex-start;",
      "  text-align: left;",
      "  word-break: break-word;",
      "}",
      ".rc-msg.rc-mine {",
      "  align-self: flex-end;",
      "  background: rgba(255, 34, 56, 0.16);",
      "  border-color: rgba(255, 34, 56, 0.34);",
      "}",
      ".rc-meta {",
      "  display: flex;",
      "  align-items: baseline;",
      "  justify-content: space-between;",
      "  gap: 8px;",
      "  margin-bottom: 2px;",
      "  font-size: 11px;",
      "}",
      ".rc-author {",
      "  font-weight: 800;",
      "  color: #ffd166;",
      "}",
      ".rc-msg.rc-mine .rc-author { color: #ff6b7a; }",
      ".rc-time {",
      "  font-size: 10px;",
      "  color: var(--muted, #7c7c8a);",
      "  flex-shrink: 0;",
      "}",
      ".rc-text {",
      "  font-size: 13px;",
      "  line-height: 1.38;",
      "  color: var(--text, #f3f3f7);",
      "  white-space: pre-wrap;",
      "}",
      "#rc-err {",
      "  display: none;",
      "  padding: 4px 12px;",
      "  font-size: 11px;",
      "  font-weight: 700;",
      "  color: #ff6b7a;",
      "  background: rgba(255, 34, 56, 0.12);",
      "  text-align: center;",
      "}",
      ".rc-foot {",
      "  display: flex;",
      "  align-items: center;",
      "  gap: 6px;",
      "  padding: 8px 10px;",
      "  background: rgba(0, 0, 0, 0.35);",
      "  border-top: 1px solid var(--border, rgba(255, 255, 255, 0.08));",
      "}",
      "#rc-input {",
      "  flex: 1;",
      "  width: auto !important;",
      "  margin: 0 !important;",
      "  padding: 9px 12px !important;",
      "  border-radius: 11px !important;",
      "  background: rgba(255, 255, 255, 0.05) !important;",
      "  border: 1px solid rgba(255, 255, 255, 0.1) !important;",
      "  color: var(--text, #f3f3f7) !important;",
      "  font-size: 13px !important;",
      "  font-weight: 500 !important;",
      "  outline: none !important;",
      "}",
      "#rc-input:focus {",
      "  border-color: var(--crimson, #ff2238) !important;",
      "  box-shadow: 0 0 0 2px rgba(255, 34, 56, 0.2) !important;",
      "}",
      "#rc-send {",
      "  width: 38px !important;",
      "  height: 36px !important;",
      "  margin: 0 !important;",
      "  padding: 0 !important;",
      "  border-radius: 11px !important;",
      "  background: linear-gradient(135deg, var(--crimson, #ff2238), var(--crimson-2, #b8071f)) !important;",
      "  color: #fff !important;",
      "  border: none !important;",
      "  font-size: 14px !important;",
      "  font-weight: 800 !important;",
      "  cursor: pointer;",
      "  display: inline-flex;",
      "  align-items: center;",
      "  justify-content: center;",
      "  flex-shrink: 0;",
      "  box-shadow: 0 4px 14px rgba(255, 34, 56, 0.35) !important;",
      "}",
      "#rc-send:disabled { opacity: 0.45; cursor: not-allowed; }",
      "@media (max-width: 480px) {",
      "  #rc-root { left: 10px; bottom: calc(10px + env(safe-area-inset-bottom, 0px)); }",
      "  #rc-toggle { padding: 8px 12px; font-size: 12px; }",
      "  #rc-panel { width: calc(100vw - 20px); height: min(340px, 54dvh); }",
      "}",
    ].join("\n");
    document.head.appendChild(st);
  }

  // ── Построение DOM ──
  var rootEl, toggleBtn, toggleLabelEl, badgeEl, previewEl, panelEl, titleEl, codeEl, closeBtn, listEl, errEl, inputEl, sendBtn;
  var previewTimer = null;

  function ensureDOM() {
    if (rootEl) return;
    injectStyles();

    rootEl = document.createElement("div");
    rootEl.id = "rc-root";
    rootEl.className = inRoom ? "" : "rc-hidden";

    previewEl = document.createElement("div");
    previewEl.id = "rc-preview";
    previewEl.onclick = function () {
      setOpen(true);
    };

    panelEl = document.createElement("div");
    panelEl.id = "rc-panel";

    var head = document.createElement("div");
    head.className = "rc-head";

    var titleWrap = document.createElement("div");
    titleWrap.className = "rc-title-wrap";
    titleEl = document.createElement("span");
    titleEl.textContent = "💬 " + t("title");
    codeEl = document.createElement("span");
    codeEl.className = "rc-code-pill";
    codeEl.style.display = "none";
    titleWrap.appendChild(titleEl);
    titleWrap.appendChild(codeEl);

    closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "rc-close-btn";
    closeBtn.title = t("close");
    closeBtn.textContent = "✕";
    closeBtn.onclick = function () {
      setOpen(false);
    };

    head.appendChild(titleWrap);
    head.appendChild(closeBtn);

    listEl = document.createElement("div");
    listEl.id = "rc-list";

    errEl = document.createElement("div");
    errEl.id = "rc-err";

    var foot = document.createElement("form");
    foot.className = "rc-foot";
    foot.onsubmit = function (e) {
      e.preventDefault();
      sendMessage();
    };

    inputEl = document.createElement("input");
    inputEl.id = "rc-input";
    inputEl.type = "text";
    inputEl.maxLength = MAX_LEN;
    inputEl.autocomplete = "off";
    inputEl.placeholder = t("placeholder");
    inputEl.addEventListener("keydown", function (e) {
      e.stopPropagation();
      if (e.key === "Escape") {
        setOpen(false);
      }
    });

    sendBtn = document.createElement("button");
    sendBtn.id = "rc-send";
    sendBtn.type = "submit";
    sendBtn.textContent = t("send");

    foot.appendChild(inputEl);
    foot.appendChild(sendBtn);

    panelEl.appendChild(head);
    panelEl.appendChild(listEl);
    panelEl.appendChild(errEl);
    panelEl.appendChild(foot);

    toggleBtn = document.createElement("button");
    toggleBtn.id = "rc-toggle";
    toggleBtn.type = "button";
    toggleBtn.onclick = function () {
      setOpen(!isOpen);
    };

    var iconSpan = document.createElement("span");
    iconSpan.textContent = "💬";
    toggleLabelEl = document.createElement("span");
    toggleLabelEl.textContent = t("btn");
    badgeEl = document.createElement("span");
    badgeEl.id = "rc-badge";

    toggleBtn.appendChild(iconSpan);
    toggleBtn.appendChild(toggleLabelEl);
    toggleBtn.appendChild(badgeEl);

    rootEl.appendChild(previewEl);
    rootEl.appendChild(panelEl);
    rootEl.appendChild(toggleBtn);

    document.body.appendChild(rootEl);
    renderMessages();
  }

  function updateLabels() {
    if (!rootEl) return;
    titleEl.textContent = "💬 " + t("title");
    toggleLabelEl.textContent = t("btn");
    closeBtn.title = t("close");
    inputEl.placeholder = t("placeholder");
    if (!messages.length) renderMessages();
  }

  function setRoomActive(code) {
    inRoom = true;
    if (code && code !== roomCode) {
      roomCode = code;
    }
    ensureDOM();
    rootEl.classList.remove("rc-hidden");
    if (roomCode && codeEl) {
      codeEl.textContent = roomCode;
      codeEl.style.display = "inline-block";
    }
  }

  function setOpen(flag) {
    ensureDOM();
    isOpen = !!flag;
    panelEl.classList.toggle("rc-open", isOpen);
    if (isOpen) {
      unreadCount = 0;
      updateBadge();
      hidePreview();
      scrollToBottom();
      setTimeout(function () {
        if (inputEl) inputEl.focus();
      }, 40);
    }
  }

  function updateBadge() {
    if (!badgeEl) return;
    if (unreadCount > 0) {
      badgeEl.textContent = unreadCount > 99 ? "99+" : String(unreadCount);
      badgeEl.classList.add("rc-show");
    } else {
      badgeEl.textContent = "";
      badgeEl.classList.remove("rc-show");
    }
  }

  function showPreview(msg) {
    if (!previewEl || isOpen) return;
    previewEl.innerHTML = "";
    var b = document.createElement("b");
    b.textContent = decodeEntities(msg.name || "Игрок") + ":";
    var span = document.createElement("span");
    span.textContent = " " + decodeEntities(msg.text || "");
    previewEl.appendChild(b);
    previewEl.appendChild(span);
    previewEl.style.display = "block";
    if (previewTimer) clearTimeout(previewTimer);
    previewTimer = setTimeout(hidePreview, 4000);
  }

  function hidePreview() {
    if (previewEl) previewEl.style.display = "none";
    if (previewTimer) {
      clearTimeout(previewTimer);
      previewTimer = null;
    }
  }

  function showError(text) {
    if (!errEl) return;
    errEl.textContent = text;
    errEl.style.display = "block";
    setTimeout(function () {
      if (errEl && errEl.textContent === text) {
        errEl.style.display = "none";
      }
    }, 2500);
  }

  function createMsgNode(m) {
    var row = document.createElement("div");
    var isMine = myPid && m.pid === myPid;
    row.className = "rc-msg" + (isMine ? " rc-mine" : "");

    var meta = document.createElement("div");
    meta.className = "rc-meta";

    var author = document.createElement("span");
    author.className = "rc-author";
    var decodedName = decodeEntities(m.name || "Игрок");
    author.textContent = isMine ? decodedName + " (" + t("you") + ")" : decodedName;

    var tm = document.createElement("span");
    tm.className = "rc-time";
    tm.textContent = formatTime(m.ts);

    meta.appendChild(author);
    meta.appendChild(tm);

    var body = document.createElement("div");
    body.className = "rc-text";
    body.textContent = decodeEntities(m.text || "");

    row.appendChild(meta);
    row.appendChild(body);
    return row;
  }

  function renderMessages() {
    if (!listEl) return;
    listEl.innerHTML = "";
    if (!messages.length) {
      var emp = document.createElement("div");
      emp.className = "rc-empty";
      emp.textContent = t("empty");
      listEl.appendChild(emp);
      return;
    }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < messages.length; i++) {
      frag.appendChild(createMsgNode(messages[i]));
    }
    listEl.appendChild(frag);
    scrollToBottom();
  }

  function scrollToBottom() {
    if (!listEl) return;
    listEl.scrollTop = listEl.scrollHeight;
  }

  function pushMessage(entry, isHistory) {
    if (!entry || typeof entry.text !== "string") return;
    var key = entry.id ? String(entry.id) : (entry.pid || "") + ":" + (entry.ts || "") + ":" + entry.text;
    if (seenIds[key]) return;
    seenIds[key] = true;

    messages.push(entry);
    if (messages.length > MAX_HISTORY) {
      messages = messages.slice(-MAX_HISTORY);
    }

    ensureDOM();
    if (messages.length === 1 || isHistory) {
      renderMessages();
    } else if (listEl) {
      var emptyNode = listEl.querySelector(".rc-empty");
      if (emptyNode) emptyNode.remove();
      listEl.appendChild(createMsgNode(entry));
      if (messages.length >= MAX_HISTORY && listEl.children.length > MAX_HISTORY) {
        listEl.removeChild(listEl.firstChild);
      }
      scrollToBottom();
    }

    if (!isHistory && !isOpen) {
      if (!myPid || entry.pid !== myPid) {
        unreadCount++;
        updateBadge();
        showPreview(entry);
      }
    }
  }

  function findOpenSocket() {
    if (activeSocket && activeSocket.readyState === 1) return activeSocket;
    if (window.ws) {
      if (typeof window.ws.getSocket === "function") {
        var s = window.ws.getSocket();
        if (s && s.readyState === 1) return s;
      }
      if (window.ws.readyState === 1 && typeof window.ws.send === "function") {
        return window.ws;
      }
    }
    if (window.wsInstance && typeof window.wsInstance.getSocket === "function") {
      var s2 = window.wsInstance.getSocket();
      if (s2 && s2.readyState === 1) return s2;
    }
    return null;
  }

  function sendMessage() {
    if (!inputEl) return;
    var text = inputEl.value.replace(/\s+/g, " ").trim();
    if (!text) return;
    if (text.length > MAX_LEN) text = text.slice(0, MAX_LEN);

    var now = Date.now();
    if (now - lastSendTs < COOLDOWN_MS) {
      showError(t("rate_err"));
      return;
    }

    var sock = findOpenSocket();
    if (!sock) return;

    lastSendTs = now;
    inputEl.value = "";
    try {
      sock.send(JSON.stringify({ action: "room_chat", act: "room_chat", text: text }));
    } catch (_) {}
  }

  // ── Обработка входящих сообщений игрового WebSocket ──
  function handleIncomingPayload(data) {
    if (!data || typeof data !== "object") return;

    if (data.type === "joined") {
      if (data.pid) myPid = data.pid;
      if (data.code && data.code !== roomCode) {
        messages = [];
        seenIds = Object.create(null);
      }
      setRoomActive(data.code || roomCode);
      renderMessages();
    } else if (data.type === "lobby" || data.type === "lobby_state") {
      setRoomActive(data.code || roomCode);
    } else if (data.type === "room_chat_history") {
      if (data.code && data.code !== roomCode) {
        roomCode = data.code;
      }
      messages = [];
      seenIds = Object.create(null);
      var arr = Array.isArray(data.messages) ? data.messages.slice(-MAX_HISTORY) : [];
      for (var i = 0; i < arr.length; i++) {
        var item = arr[i];
        if (item && typeof item.text === "string") {
          var k = item.id ? String(item.id) : (item.pid || "") + ":" + (item.ts || "") + ":" + item.text;
          seenIds[k] = true;
          messages.push(item);
        }
      }
      setRoomActive(data.code || roomCode);
      renderMessages();
    } else if (data.type === "room_chat") {
      var msgObj = data.message || {
        id: data.id,
        pid: data.pid,
        user: data.user,
        name: data.name,
        text: data.text,
        ts: data.ts,
      };
      setRoomActive(roomCode);
      pushMessage(msgObj, false);
    } else if (data.type === "room_chat_error") {
      showError(data.msg || t("rate_err"));
    } else if (typeof data.type === "string" && data.type.indexOf("_state") !== -1) {
      setRoomActive(roomCode);
    }
  }

  function hookSocketInstance(sock) {
    if (!sock || typeof sock.addEventListener !== "function") return;
    var url = String(sock.url || "");
    if (url.indexOf("/ws/chat") !== -1) return; // Не перехватываем глобальный чат лобби

    if (hookedSockets.has ? hookedSockets.has(sock) : hookedSockets.indexOf(sock) !== -1) {
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
  }

  // 1) Перехват через WebSocket.prototype.send (работает даже если сокет создан до/после обёртки)
  var OrigWS = window.WebSocket;
  if (OrigWS && OrigWS.prototype && typeof OrigWS.prototype.send === "function") {
    var origProtoSend = OrigWS.prototype.send;
    OrigWS.prototype.send = function (payload) {
      hookSocketInstance(this);
      return origProtoSend.apply(this, arguments);
    };
  }

  // 2) Обёртка конструктора window.WebSocket
  if (OrigWS) {
    var WrappedWS = function (url, protocols) {
      var wsInst = protocols !== undefined ? new OrigWS(url, protocols) : new OrigWS(url);
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

  // Отслеживание смены языка
  document.addEventListener("click", function (e) {
    if (e.target && e.target.closest && e.target.closest("#langbar")) {
      setTimeout(updateLabels, 20);
    }
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", ensureDOM);
  } else {
    ensureDOM();
  }

  // Публичный API
  window.RoomChat = {
    open: function () { setOpen(true); },
    close: function () { setOpen(false); },
    toggle: function () { setOpen(!isOpen); },
    send: function (text) {
      if (!inputEl) ensureDOM();
      inputEl.value = text || "";
      sendMessage();
    },
  };
})();
