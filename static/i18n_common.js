/**
 * Lobby.gg — общий модуль локализации (i18n)
 * Поддерживаемые языки: uk, ru, en, de (с возможностью расширения).
 */
(function () {
  "use strict";

  var LANGS = ["uk", "ru", "en", "de"];

  function lang() {
    try {
      var l = localStorage.getItem("jg_lang");
      return (l && LANGS.indexOf(l) !== -1) ? l : "ru";
    } catch (_) {
      return "ru";
    }
  }

  var LOBBY_GT = {
    "Не удалось выполнить действие.": {
      uk: "Не вдалося виконати дію.",
      en: "Failed to perform action.",
      de: "Aktion fehlgeschlagen."
    },
    "Комната не найдена.": {
      uk: "Кімната не знайдена.",
      en: "Room not found.",
      de: "Raum nicht gefunden."
    },
    "Слишком много комнат, попробуйте позже.": {
      uk: "Забагато кімнат, спробуйте пізніше.",
      en: "Too many rooms, please try again later.",
      de: "Zu viele Räume, bitte später versuchen."
    },
    "Быстрая игра доступна только для дуэлей.": {
      uk: "Швидка гра доступна лише для дуелей.",
      en: "Quick play is only available for duels.",
      de: "Schnellspiel ist nur für Duelle verfügbar."
    },
    "Не чаще 1 сообщения в секунду.": {
      uk: "Не частіше 1 повідомлення на секунду.",
      en: "No more than 1 message per second.",
      de: "Maximal 1 Nachricht pro Sekunde."
    },
    "Код?": {
      uk: "Код?",
      en: "Code?",
      de: "Code?"
    },
    "Нужно минимум 2 игрока.": {
      uk: "Потрібно мінімум 2 гравці.",
      en: "Need at least 2 players.",
      de: "Mindestens 2 Spieler erforderlich."
    },
    "Нужно 2 игрока.": {
      uk: "Потрібно 2 гравці.",
      en: "Need 2 players.",
      de: "2 Spieler erforderlich."
    },
    "Нужно ровно 2 игрока.": {
      uk: "Потрібно рівно 2 гравці.",
      en: "Exactly 2 players needed.",
      de: "Genau 2 Spieler erforderlich."
    },
    "Нужно минимум 3 игрока (можно добрать ботами).": {
      uk: "Потрібно мінімум 3 гравці (можна додати ботів).",
      en: "Need at least 3 players (bots can be added).",
      de: "Mindestens 3 Spieler erforderlich (Bots möglich)."
    },
    "Нужно минимум 2 игрока (жми «Добавить бота» для теста).": {
      uk: "Потрібно мінімум 2 гравці (тисни «Додати бота» для тесту).",
      en: "Need at least 2 players (click 'Add bot' to test).",
      de: "Mindestens 2 Spieler erforderlich (klicke auf „Bot hinzufügen“ zum Testen)."
    },
    "Для игры нужно 2, 3 или 4 игрока.": {
      uk: "Для гри потрібно 2, 3 або 4 гравці.",
      en: "The game requires 2, 3, or 4 players.",
      de: "Für das Spiel werden 2, 3 oder 4 Spieler benötigt."
    },
    "Слишком много попыток, подождите": {
      uk: "Забагато спроб, зачекайте",
      en: "Too many attempts, please wait",
      de: "Zu viele Versuche, bitte warten"
    },
    "Это имя уже занято": {
      uk: "Це ім'я вже зайняте",
      en: "This name is already taken",
      de: "Dieser Name ist bereits vergeben"
    },
    "Пароль минимум 6 символов": {
      uk: "Пароль мінімум 6 символів",
      en: "Password must be at least 6 characters",
      de: "Passwort mindestens 6 Zeichen"
    },
    "Неверный логин или пароль": {
      uk: "Невірний логін або пароль",
      en: "Invalid username or password",
      de: "Ungültiger Benutzername oder Passwort"
    },
    "Не удалось раздать роли.": {
      uk: "Не вдалося роздати ролі.",
      en: "Failed to deal roles.",
      de: "Rollen konnten nicht verteilt werden."
    },
    "Мафия: нужно минимум 3 игрока (можно добрать ботами).": {
      uk: "Мафія: потрібно мінімум 3 гравці (можна додати ботів).",
      en: "Mafia: need at least 3 players (bots can be added).",
      de: "Mafia: mindestens 3 Spieler erforderlich (Bots möglich)."
    },
    "Нужно 2+ игрока с фишками.": {
      uk: "Потрібно 2+ гравці з фішками.",
      en: "Need 2+ players with chips.",
      de: "2+ Spieler mit Chips erforderlich."
    },
    "Не хватает игроков с фишками для новой раздачи.": {
      uk: "Не вистачає гравців з фішками для нової роздачі.",
      en: "Not enough players with chips for a new hand.",
      de: "Nicht genug Spieler mit Chips für eine neue Runde."
    },
    "Не вышло сгенерить пак, попробуй другую тему.": {
      uk: "Не вдалося згенерувати пак, спробуй іншу тему.",
      en: "Failed to generate pack, try another theme.",
      de: "Paket konnte nicht erstellt werden, versuche ein anderes Thema."
    },
    "Так нельзя. При активном штрафе (No Mercy) крой только картой добора не слабее.": {
      uk: "Так не можна. При активному штрафі (No Mercy) крий лише картою добору не слабше.",
      en: "Invalid move. Under penalty (No Mercy), counter only with a draw card of equal or greater power.",
      de: "Ungültiger Zug. Bei aktiver Strafe (No Mercy) nur mit einer gleichwertigen oder stärkeren Ziehkarte kontern."
    }
  };

  function T(s) {
    if (s == null) return s;
    var l = lang();
    if (l === "ru") return s;
    var dict = window.LOBBY_GT || LOBBY_GT;
    var entry = dict[s];
    return (entry && entry[l]) ? entry[l] : s;
  }

  window.LOBBY_GT = LOBBY_GT;
  window.LobbyI18n = {
    LANGS: LANGS,
    lang: lang,
    T: T
  };
})();
