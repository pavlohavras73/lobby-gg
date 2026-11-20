(window.LOBBY_RULES = window.LOBBY_RULES || {})["battleship"] = {
  "title": {
    "uk": "🚢 Морський бій — правила",
    "ru": "🚢 Морской бой — правила",
    "en": "🚢 Battleship — Rules",
    "de": "🚢 Schiffe versenken — Regeln"
  },
  "steps": {
    "uk": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"1.5\" fill=\"rgba(56,189,248,0.08)\"/><rect x=\"12\" y=\"12\" width=\"24\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><rect x=\"12\" y=\"22\" width=\"16\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"15\" cy=\"35\" r=\"3\" fill=\"#38bdf8\"/></svg>",
        "title": "Розстановка флоту",
        "desc": "Розмісти свій флот (1×4, 2×3, 3×2, 4×1 клітинки). Кораблі не можуть торкатися один одного навіть кутами."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"16\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M24 12v24M12 24h24\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\"/></svg>",
        "title": "Постріли по черзі",
        "desc": "Обирай клітинку на полі супротивника. Якщо влучив — робиш додатковий постріл. Промах — черга переходить супернику."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"12\" y=\"18\" width=\"24\" height=\"12\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.2)\"/><path d=\"M16 21l16 6M32 21l-16 6\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"14\" r=\"2\" fill=\"#38bdf8\"/><circle cx=\"34\" cy=\"34\" r=\"2\" fill=\"#38bdf8\"/></svg>",
        "title": "Потоплений корабель",
        "desc": "Коли вражені всі палуби корабля, він іде на дно, а всі сусідні клітинки автоматично відмічаються водою."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-16h12l6 16H12z\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M24 10v10M20 14l4-4 4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Морська перемога",
        "desc": "Гравець, який першим потопить усі 10 ворожих кораблів супротивника, перемагає у битві!"
      }
    ],
    "ru": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"1.5\" fill=\"rgba(56,189,248,0.08)\"/><rect x=\"12\" y=\"12\" width=\"24\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><rect x=\"12\" y=\"22\" width=\"16\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"15\" cy=\"35\" r=\"3\" fill=\"#38bdf8\"/></svg>",
        "title": "Расстановка флота",
        "desc": "Расставь 10 кораблей (1×4, 2×3, 3×2, 4×1 клетки). Корабли не должны соприкасаться даже углами."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"16\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M24 12v24M12 24h24\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\"/></svg>",
        "title": "Огонь по очереди",
        "desc": "Стреляй по координатам вражеского поля. Попадание даёт повторный выстрел, промах передаёт ход."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"12\" y=\"18\" width=\"24\" height=\"12\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.2)\"/><path d=\"M16 21l16 6M32 21l-16 6\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"14\" r=\"2\" fill=\"#38bdf8\"/><circle cx=\"34\" cy=\"34\" r=\"2\" fill=\"#38bdf8\"/></svg>",
        "title": "Потоплен",
        "desc": "Когда уничтожены все палубы, корабль тонет, а клетки вокруг него автоматически отмечаются точками."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-16h12l6 16H12z\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M24 10v10M20 14l4-4 4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Полный триумф",
        "desc": "Адмирал, первым уничтоживший все корабли оппонента, становится победителем сражения!"
      }
    ],
    "en": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"1.5\" fill=\"rgba(56,189,248,0.08)\"/><rect x=\"12\" y=\"12\" width=\"24\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><rect x=\"12\" y=\"22\" width=\"16\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"15\" cy=\"35\" r=\"3\" fill=\"#38bdf8\"/></svg>",
        "title": "Fleet Placement",
        "desc": "Position 10 ships (sizes 4, 3, 2, 1). Ships cannot touch each other, even diagonally."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"16\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M24 12v24M12 24h24\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\"/></svg>",
        "title": "Taking Turns Firing",
        "desc": "Pick target coordinates on opponent's grid. A hit gives you a bonus shot; a miss passes the turn."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"12\" y=\"18\" width=\"24\" height=\"12\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.2)\"/><path d=\"M16 21l16 6M32 21l-16 6\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"14\" r=\"2\" fill=\"#38bdf8\"/><circle cx=\"34\" cy=\"34\" r=\"2\" fill=\"#38bdf8\"/></svg>",
        "title": "Sunk Ships",
        "desc": "When all segments of a ship are struck, it sinks and its perimeter is marked as cleared water."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-16h12l6 16H12z\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M24 10v10M20 14l4-4 4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Naval Victory",
        "desc": "Sink the entire enemy fleet before they sink yours to win the naval campaign!"
      }
    ],
    "de": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"1.5\" fill=\"rgba(56,189,248,0.08)\"/><rect x=\"12\" y=\"12\" width=\"24\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><rect x=\"12\" y=\"22\" width=\"16\" height=\"6\" rx=\"2\" fill=\"#38bdf8\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"15\" cy=\"35\" r=\"3\" fill=\"#38bdf8\"/></svg>",
        "title": "Flottenaufstellung",
        "desc": "Platziere 10 Schiffe (Längen 4, 3, 2, 1). Schiffe dürfen sich nicht berühren, auch nicht über Eck."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"16\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M24 12v24M12 24h24\" stroke=\"#e0102e\" stroke-width=\"2\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\"/></svg>",
        "title": "Feuern im Wechsel",
        "desc": "Wähle Zielkoordinaten auf dem gegnerischen Feld. Ein Treffer schenkt einen weiteren Schuss."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"12\" y=\"18\" width=\"24\" height=\"12\" rx=\"2\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.2)\"/><path d=\"M16 21l16 6M32 21l-16 6\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/><circle cx=\"14\" cy=\"14\" r=\"2\" fill=\"#38bdf8\"/><circle cx=\"34\" cy=\"34\" r=\"2\" fill=\"#38bdf8\"/></svg>",
        "title": "Versenkt",
        "desc": "Sind alle Felder eines Schiffes getroffen, sinkt es und die umliegenden Felder werden markiert."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-16h12l6 16H12z\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M24 10v10M20 14l4-4 4 4\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Flottensieg",
        "desc": "Wer als Erster die gesamte Flotte des Gegners versenkt, gewinnt die Seeschlacht!"
      }
    ]
  },
  "full": {
    "uk": "Розстав кораблі на своєму полі. По черзі стріляй по полю суперника. Попав — стріляєш ще раз. Хто першим потопить увесь флот ворога — переміг.",
    "ru": "Расставь корабли на своём поле. По очереди стреляй по полю соперника. Попал — стреляешь ещё раз. Кто первым потопит весь флот врага — победил.",
    "en": "Place ships on your grid. Take turns shooting at the opponent's grid. Hits grant extra shots. First to sink all enemy ships wins.",
    "de": "Platziere deine Schiffe. Feuere abwechselnd auf das gegnerische Raster. Treffer erlauben erneutes Feuern. Wer zuerst alle Schiffe versenkt, gewinnt."
  }
};
