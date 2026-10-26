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
    },
    "Неверное имя или пароль": {
      uk: "Невірне ім'я або пароль",
      en: "Wrong username or password",
      de: "Falscher Benutzername oder Passwort"
    },
    "Имя: 3-20 симв., латиница/цифры/_": {
      uk: "Ім'я: 3-20 симв., латиниця/цифри/_",
      en: "Username: 3-20 chars, latin/digits/_",
      de: "Name: 3–20 Zeichen, Latein/Ziffern/_"
    },
    "Пароль минимум 4 символа": {
      uk: "Пароль мінімум 4 символи",
      en: "Password must be at least 4 characters",
      de: "Passwort mindestens 4 Zeichen"
    },
    "Старый пароль неверный": {
      uk: "Старий пароль невірний",
      en: "Wrong current password",
      de: "Altes Passwort ist falsch"
    },
    "Неизвестная дуэльная игра": {
      uk: "Невідома дуельна гра",
      en: "Unknown duel game",
      de: "Unbekanntes Duellspiel"
    },
    "Некорректный пользователь": {
      uk: "Некоректний користувач",
      en: "Invalid user",
      de: "Ungültiger Benutzer"
    },
    "Пользователь не найден": {
      uk: "Користувача не знайдено",
      en: "User not found",
      de: "Benutzer nicht gefunden"
    },
    "Уже в друзьях": {
      uk: "Вже у друзях",
      en: "Already friends",
      de: "Bereits befreundet"
    },
    "Заявка уже отправлена": {
      uk: "Заявку вже надіслано",
      en: "Request already sent",
      de: "Anfrage bereits gesendet"
    },
    "нужны to, game, code": {
      uk: "потрібні to, game, code",
      en: "to, game, code required",
      de: "to, game, code erforderlich"
    },
    "некорректная игра или код": {
      uk: "некоректна гра або код",
      en: "invalid game or code",
      de: "Ungültiges Spiel oder Code"
    },
    "Это не твой друг": {
      uk: "Це не твій друг",
      en: "Not on your friends list",
      de: "Nicht in deiner Freundesliste"
    },
    "Игрок": {
      uk: "Гравець",
      en: "Player",
      de: "Spieler"
    },
    "Гость": {
      uk: "Гість",
      en: "Guest",
      de: "Gast"
    },
    "🤖 Бот": {
      uk: "🤖 Бот",
      en: "🤖 Bot",
      de: "🤖 Bot"
    },
    "🤖 Бот (easy)": {
      uk: "🤖 Бот (легкий)",
      en: "🤖 Bot (easy)",
      de: "🤖 Bot (leicht)"
    },
    "🤖 Бот (medium)": {
      uk: "🤖 Бот (середній)",
      en: "🤖 Bot (medium)",
      de: "🤖 Bot (mittel)"
    },
    "🤖 Бот (hard)": {
      uk: "🤖 Бот (складний)",
      en: "🤖 Bot (hard)",
      de: "🤖 Bot (schwer)"
    },
    "Никто не проголосовал.": {
      uk: "Ніхто не проголосував.",
      en: "Nobody voted.",
      de: "Niemand hat abgestimmt."
    },
    "Игрок уже не в игре.": {
      uk: "Гравець вже не в грі.",
      en: "Player is no longer in the game.",
      de: "Spieler ist nicht mehr im Spiel."
    },
    "МАФИЯ": {
      uk: "МАФІЯ",
      en: "MAFIA",
      de: "MAFIA"
    },
    "Ночью с подельниками выбираешь жертву. Днём прикидывайся мирным.": {
      uk: "Вночі зі спільниками обираєш жертву. Вдень прикидайся мирним.",
      en: "At night you pick a victim with your partners. By day pretend to be town.",
      de: "Nachts wählst du mit deinen Komplizen ein Opfer. Tagsüber tu so, als wärst du Bürger."
    },
    "ДОКТОР": {
      uk: "ЛІКАР",
      en: "DOCTOR",
      de: "ARZT"
    },
    "Ночью лечишь одного игрока — спасаешь от убийства. Себя нельзя два раза подряд.": {
      uk: "Вночі лікуєш одного гравця — рятуєш від вбивства. Себе не можна двічі поспіль.",
      en: "At night heal one player to save them from murder. Can't heal yourself twice in a row.",
      de: "Nachts heilst du einen Spieler und rettest ihn vor Mord. Dich selbst nicht zweimal hintereinander."
    },
    "ШЕРИФ": {
      uk: "ШЕРИФ",
      en: "SHERIFF",
      de: "KOMMISSAR"
    },
    "Ночью проверяешь одного — узнаёшь, мафия он или нет.": {
      uk: "Вночі перевіряєш одного — дізнаєшся, мафія він чи ні.",
      en: "At night inspect one player to learn if they are Mafia or not.",
      de: "Nachts überprüfst du einen Spieler und erfährst, ob er zur Mafia gehört."
    },
    "ПАТРУЛЬНЫЙ": {
      uk: "ПАТРУЛЬНИЙ",
      en: "PATROL",
      de: "STREIFE"
    },
    "Помощник комиссара. Ночью охраняешь игрока: если на него нападут — спасаешь его и узнаёшь, что была атака.": {
      uk: "Помічник комісара. Вночі охороняєш гравця: якщо на нього нападуть — рятуєш його і дізнаєшся про атаку.",
      en: "Sheriff's deputy. Guard a player at night: if attacked, you save them and learn of the attack.",
      de: "Hilfspolizist. Nachts beschützt du einen Spieler: bei einem Angriff rettest du ihn und erfährst davon."
    },
    "МИРНЫЙ": {
      uk: "МИРНИЙ",
      en: "CITIZEN",
      de: "BÜRGER"
    },
    "Ты мирный житель. Днём вычисляй мафию и голосуй.": {
      uk: "Ти мирний житель. Вдень вираховуй мафію та голосуй.",
      en: "You are a town citizen. Find the Mafia during the day and vote.",
      de: "Du bist ein friedlicher Bürger. Entlarve tagsüber die Mafia und stimme ab."
    },
    "Сейчас не ночь.": {
      uk: "Зараз не ніч.",
      en: "It is not night right now.",
      de: "Es ist gerade nicht Nacht."
    },
    "Мёртвые не ходят.": {
      uk: "Мертві не ходять.",
      en: "Dead players cannot act.",
      de: "Tote können nicht handeln."
    },
    "У тебя нет ночного действия.": {
      uk: "У тебе немає нічної дії.",
      en: "You have no night action.",
      de: "Du hast keine Nachtaktion."
    },
    "Цель уже мертва.": {
      uk: "Ціль вже мертва.",
      en: "Target is already dead.",
      de: "Das Ziel ist bereits tot."
    },
    "Себя нельзя лечить две ночи подряд.": {
      uk: "Себе не можна лікувати дві ночі поспіль.",
      en: "You cannot heal yourself two nights in a row.",
      de: "Du kannst dich nicht zwei Nächte hintereinander selbst heilen."
    },
    "Себя охранять нельзя — выбери другого.": {
      uk: "Себе охороняти не можна — обери іншого.",
      en: "You cannot guard yourself — pick someone else.",
      de: "Du kannst dich nicht selbst schützen — wähle jemand anderen."
    },
    "Сейчас не день.": {
      uk: "Зараз не день.",
      en: "It is not day right now.",
      de: "Es ist gerade nicht Tag."
    },
    "Мёртвые не голосуют.": {
      uk: "Мертві не голосують.",
      en: "Dead players cannot vote.",
      de: "Tote stimmen nicht ab."
    },
    "Нельзя голосовать за мёртвого.": {
      uk: "Не можна голосувати за мертвого.",
      en: "Cannot vote for a dead player.",
      de: "Man kann nicht für Tote stimmen."
    },
    "🌙 Город засыпает. Ночь 1 — мафия выходит на охоту.": {
      uk: "🌙 Місто засинає. Ніч 1 — мафія виходить на полювання.",
      en: "🌙 The town falls asleep. Night 1 — the Mafia goes hunting.",
      de: "🌙 Die Stadt schläft ein. Nacht 1 — die Mafia geht auf die Jagd."
    },
    "💉 Ночью было покушение, но доктор спас жертву!": {
      uk: "💉 Вночі був замах, але лікар врятував жертву!",
      en: "💉 Someone was attacked at night, but the Doctor saved the victim!",
      de: "💉 Nachts gab es einen Anschlag, aber der Arzt hat das Opfer gerettet!"
    },
    "🌫️ Ночь прошла тихо — никто не погиб.": {
      uk: "🌫️ Ніч минула тихо — ніхто не загинув.",
      en: "🌫️ The night was quiet — nobody died.",
      de: "🌫️ Die Nacht blieb ruhig — niemand ist gestorben."
    },
    "🤝 Голоса разделились — никого не казнили.": {
      uk: "🤝 Голоси розділилися — нікого не стратили.",
      en: "🤝 Votes were tied — nobody was executed.",
      de: "🤝 Stimmengleichheit — niemand wurde hingerichtet."
    },
    "🎉 ПОБЕДА ГОРОДА! Вся мафия вычищена.": {
      uk: "🎉 ПЕРЕМОГА МІСТА! Всю мафію знищено.",
      en: "🎉 TOWN WINS! All Mafia eliminated.",
      de: "🎉 SIEG DER STADT! Die gesamte Mafia wurde ausgeschaltet."
    },
    "🔪 ПОБЕДА МАФИИ! Город пал.": {
      uk: "🔪 ПЕРЕМОГА МАФІЇ! Місто впало.",
      en: "🔪 MAFIA WINS! The town has fallen.",
      de: "🔪 SIEG DER MAFIA! Die Stadt ist gefallen."
    },
    "Юг": {
      uk: "Південь",
      en: "South",
      de: "Süd"
    },
    "Север": {
      uk: "Північ",
      en: "North",
      de: "Nord"
    },
    "Запад": {
      uk: "Захід",
      en: "West",
      de: "West"
    },
    "Восток": {
      uk: "Схід",
      en: "East",
      de: "Ost"
    },
    "У вас не осталось стенок.": {
      uk: "У тебе не залишилося стінок.",
      en: "You have no walls left.",
      de: "Du hast keine Wände mehr übrig."
    },
    "Стенка здесь не помещается или пересекается с другой.": {
      uk: "Стінка тут не поміщається або перетинається з іншою.",
      en: "Wall doesn't fit here or overlaps another wall.",
      de: "Die Wand passt hier nicht oder kreuzt eine andere."
    },
    "Стенка полностью перекрывает путь игроку!": {
      uk: "Стінка повністю перекриває шлях гравцю!",
      en: "Wall completely blocks a player's path!",
      de: "Die Wand blockiert den Weg eines Spielers komplett!"
    },
    "Недопустимый ход фишкой.": {
      uk: "Неприпустимий хід фішкою.",
      en: "Invalid pawn move.",
      de: "Ungültiger Figurenzug."
    },
    "Угадал правду (+2)": {
      uk: "Вгадав правду (+2)",
      en: "Guessed the truth (+2)",
      de: "Wahrheit erkannt (+2)"
    },
    "Повелся на обманку ИИ (0)": {
      uk: "Повівся на обманку ШІ (0)",
      en: "Fell for the house decoy (0)",
      de: "Auf den Haus-Bluff reingefallen (0)"
    },
    "Повелся на чужую ложь (0)": {
      uk: "Повівся на чужу брехню (0)",
      en: "Fell for another player's lie (0)",
      de: "Auf eine fremde Lüge reingefallen (0)"
    },
    "Игра началась": {
      uk: "Гра почалася",
      en: "Game started",
      de: "Spiel gestartet"
    },
    "Бито!": {
      uk: "Бито!",
      en: "Beaten!",
      de: "Abgewehrt!"
    },
    "🃏 Игра окончена!": {
      uk: "🃏 Гру закінчено!",
      en: "🃏 Game over!",
      de: "🃏 Spiel vorbei!"
    },
    "🕵️ ТЫ ШПИОН": {
      uk: "🕵️ ТИ ШПИГУН",
      en: "🕵️ YOU ARE THE SPY",
      de: "🕵️ DU BIST DER SPION"
    },
    "Найди шпиона вопросами. Не называй локацию напрямую.": {
      uk: "Знайди шпигуна питаннями. Не називай локацію напряму.",
      en: "Find the spy by asking questions. Don't name the location directly.",
      de: "Finde den Spion durch Fragen. Nenne den Ort nicht direkt."
    },
    "Знаменитости": {
      uk: "Знаменитості",
      en: "Celebrities",
      de: "Promis"
    }
  };

  var LOBBY_GT_PATTERNS = [
    {
      re: /^Лимит вскрытий за раунд: (\d+)\. Ждите новый раунд\.$/,
      uk: "Ліміт розкриттів за раунд: $1. Чекайте новий раунд.",
      en: "Reveal limit per round: $1. Wait for the next round.",
      de: "Aufdecklimit pro Runde: $1. Warte auf die nächste Runde."
    },
    {
      re: /^Ничья \((.+)\) — никого не изгнали\.$/,
      uk: "Нічия ($1) — нікого не вигнали.",
      en: "Tie ($1) — nobody was exiled.",
      de: "Unentschieden ($1) — niemand wurde verbannt."
    },
    {
      re: /^🚫 Изгнан: (.+) \((\d+) голосов\)$/,
      uk: "🚫 Вигнано: $1 ($2 голосів)",
      en: "🚫 Exiled: $1 ($2 votes)",
      de: "🚫 Verbannt: $1 ($2 Stimmen)"
    },
    {
      re: /^☠️ Ночью убит: (.+)\.$/,
      uk: "☠️ Вночі вбито: $1.",
      en: "☠️ Killed at night: $1.",
      de: "☠️ Nachts getötet: $1."
    },
    {
      re: /^☀️ Город просыпается\. День (\d+) — обсуждайте и голосуйте\.$/,
      uk: "☀️ Місто прокидається. День $1 — обговорюйте та голосуйте.",
      en: "☀️ The town wakes up. Day $1 — discuss and vote.",
      de: "☀️ Die Stadt erwacht. Tag $1 — diskutiert und stimmt ab."
    },
    {
      re: /^⚖️ Город казнил: (.+) — это был (.+)\.$/,
      fn: function (m, l) {
        var who = T(m[1]);
        var role = T(m[2]);
        if (l === "uk") return "⚖️ Місто стратило: " + who + " — це був " + role + ".";
        if (l === "en") return "⚖️ The town executed: " + who + " — role: " + role + ".";
        if (l === "de") return "⚖️ Die Stadt hat " + who + " hingerichtet — Rolle: " + role + ".";
        return m[0];
      }
    },
    {
      re: /^🌙 Наступает ночь (\d+)\. Город засыпает\.$/,
      uk: "🌙 Настає ніч $1. Місто засинає.",
      en: "🌙 Night $1 falls. The town goes to sleep.",
      de: "🌙 Nacht $1 bricht an. Die Stadt schläft ein."
    },
    {
      re: /^Обманул (.+) \(\+1\)$/,
      fn: function (m, l) {
        var who = T(m[1]);
        if (l === "uk") return "Обдурив " + who + " (+1)";
        if (l === "en") return "Fooled " + who + " (+1)";
        if (l === "de") return who + " reingelegt (+1)";
        return m[0];
      }
    },
    {
      re: /^Неподдерживаемое число игроков: (\d+)$/,
      uk: "Непідтримувана кількість гравців: $1",
      en: "Unsupported player count: $1",
      de: "Nicht unterstützte Spieleranzahl: $1"
    },
    {
      re: /^🤖 Бот \((.+)\)$/,
      fn: function (m, l) {
        var d = m[1];
        var dm = {
          easy: { uk: "легкий", en: "easy", de: "leicht" },
          medium: { uk: "середній", en: "medium", de: "mittel" },
          hard: { uk: "складний", en: "hard", de: "schwer" }
        };
        var dl = (dm[d] && dm[d][l]) || d;
        return l === "uk" ? "🤖 Бот (" + dl + ")" : "🤖 Bot (" + dl + ")";
      }
    }
  ];

  function T(s) {
    if (s == null) return s;
    var l = lang();
    if (l === "ru") return s;
    var dict = window.LOBBY_GT || LOBBY_GT;
    var entry = dict[s];
    if (entry && entry[l]) return entry[l];
    if (typeof s === "string") {
      for (var i = 0; i < LOBBY_GT_PATTERNS.length; i++) {
        var p = LOBBY_GT_PATTERNS[i];
        var m = p.re.exec(s);
        if (m) {
          if (p.fn) return p.fn(m, l);
          var tpl = p[l];
          if (tpl) return s.replace(p.re, tpl);
        }
      }
    }
    return s;
  }

  window.LOBBY_GT = LOBBY_GT;
  window.LobbyI18n = {
    LANGS: LANGS,
    lang: lang,
    T: T
  };
})();
