(window.LOBBY_RULES = window.LOBBY_RULES || {})["reversi"] = {
  "title": {
    "uk": "⚪ Реверсі — правила",
    "ru": "⚪ Реверси — правила",
    "en": "⚪ Reversi — Rules",
    "de": "⚪ Reversi — Regeln"
  },
  "steps": {
    "uk": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"1.5\" fill=\"rgba(34,211,238,0.08)\"/><circle cx=\"20\" cy=\"20\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"28\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"20\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"20\" cy=\"28\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/></svg>",
        "title": "Початкова розстановка",
        "desc": "У центрі поля 8×8 розташовані 4 фішки навхрест: дві білі та дві чорні."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"12\" cy=\"24\" r=\"4\" fill=\"#fff\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"36\" cy=\"24\" r=\"4\" fill=\"#fff\"/><path d=\"M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Захоплення фішок",
        "desc": "Став фішку так, щоб затиснути одну або кілька фішок суперника між своїми по горизонталі, вертикалі чи діагоналі."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"10\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M18 16c3-3 9-3 12 0M30 32c-3 3-9 3-12 0\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Перевертання кольору",
        "desc": "Всі затиснуті фішки суперника перевертаються і стають твого кольору! Якщо ходів немає — черга пропускається."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l8-8 8 8v6\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"5\" fill=\"#fbbf24\"/></svg>",
        "title": "Більшість перемагає",
        "desc": "Коли вся дошка заповнена або в обох гравців немає ходів, перемагає володар більшої кількості фішок."
      }
    ],
    "ru": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"1.5\" fill=\"rgba(34,211,238,0.08)\"/><circle cx=\"20\" cy=\"20\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"28\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"20\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"20\" cy=\"28\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/></svg>",
        "title": "Стартовая позиция",
        "desc": "В центре доски 8×8 выставлены 4 фишки: две белые и две тёмные по диагоналям."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"12\" cy=\"24\" r=\"4\" fill=\"#fff\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"36\" cy=\"24\" r=\"4\" fill=\"#fff\"/><path d=\"M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Зажатие линии",
        "desc": "Ставь свою фишку так, чтобы замкнуть непрерывную линию вражеских фишек между своими."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"10\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M18 16c3-3 9-3 12 0M30 32c-3 3-9 3-12 0\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Переворот фишек",
        "desc": "Все зажатые фишки противника меняют цвет на твой! Если доступных ходов нет, ход пропускается."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l8-8 8 8v6\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"5\" fill=\"#fbbf24\"/></svg>",
        "title": "Финальный подсчёт",
        "desc": "Партия завершается при заполнении поля. Побеждает игрок с наибольшим числом фишек своего цвета."
      }
    ],
    "en": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"1.5\" fill=\"rgba(34,211,238,0.08)\"/><circle cx=\"20\" cy=\"20\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"28\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"20\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"20\" cy=\"28\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/></svg>",
        "title": "Starting Setup",
        "desc": "The game begins on an 8×8 board with four central discs arranged diagonally."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"12\" cy=\"24\" r=\"4\" fill=\"#fff\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"36\" cy=\"24\" r=\"4\" fill=\"#fff\"/><path d=\"M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Flanking Discs",
        "desc": "Place a disc to trap one or more opponent discs between your new disc and an existing one."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"10\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M18 16c3-3 9-3 12 0M30 32c-3 3-9 3-12 0\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Flipping Discs",
        "desc": "All sandwiched discs flip to your color. If you have no legal flanking moves, your turn passes."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l8-8 8 8v6\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"5\" fill=\"#fbbf24\"/></svg>",
        "title": "Majority Wins",
        "desc": "When the board is filled or no moves remain, the player with the most discs wins the game."
      }
    ],
    "de": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"1.5\" fill=\"rgba(34,211,238,0.08)\"/><circle cx=\"20\" cy=\"20\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"28\" r=\"3.5\" fill=\"#fff\"/><circle cx=\"28\" cy=\"20\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"20\" cy=\"28\" r=\"3.5\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/></svg>",
        "title": "Startaufstellung",
        "desc": "Zu Beginn liegen auf dem 8×8-Feld in der Mitte vier Steine über Kreuz."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"12\" cy=\"24\" r=\"4\" fill=\"#fff\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#1e293b\" stroke=\"#fff\" stroke-width=\"1\"/><circle cx=\"36\" cy=\"24\" r=\"4\" fill=\"#fff\"/><path d=\"M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Einschließen",
        "desc": "Setze einen Stein so, dass gegnerische Steine zwischen deinen Steinen eingeklemmt werden."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"10\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M18 16c3-3 9-3 12 0M30 32c-3 3-9 3-12 0\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Umdrehen",
        "desc": "Alle eingeschlossenen Steine drehen sich um und werden zu deiner Farbe! Gibt es keinen Zug, setzt man aus."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l8-8 8 8v6\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"5\" fill=\"#fbbf24\"/></svg>",
        "title": "Mehrheit siegt",
        "desc": "Ist das Brett voll, gewinnt der Spieler, der die meisten Steine seiner Farbe besitzt."
      }
    ]
  },
  "full": {
    "uk": "Став фішку так, щоб затиснути лінію суперника між своїми. Усі затиснуті фішки перевертаються у твій колір. Перемагає той, у кого наприкінці гри більше фішок.",
    "ru": "Ставь фишку так, чтобы зажать ряд фишек соперника между своими. Все зажатые фишки переворачиваются в твой цвет. Побеждает тот, у кого в конце больше фишек.",
    "en": "Place discs to flank opponent discs between yours horizontally, vertically, or diagonally. All flanked discs flip to your color. Player with most discs wins.",
    "de": "Platziere Steine, um gegnerische Reihen einzuschließen. Alle eingeschlossenen Steine wechseln die Farbe. Wer am Ende die meisten Steine besitzt, gewinnt."
  }
};
