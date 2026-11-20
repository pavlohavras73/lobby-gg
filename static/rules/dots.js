(window.LOBBY_RULES = window.LOBBY_RULES || {})["dots"] = {
  "title": {
    "uk": "✏️ Точки — правила",
    "ru": "✏️ Точки — правила",
    "en": "✏️ Dots — Rules",
    "de": "✏️ Käsekästchen — Regeln"
  },
  "steps": {
    "uk": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"3\" fill=\"#fff\"/><path d=\"M14 14h20\" stroke=\"#38bdf8\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
        "title": "З'єднання точок",
        "desc": "Гравці по черзі проводять одну горизонтальну або вертикальну лінію між двома сусідніми точками сітки."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"14\" y=\"14\" width=\"20\" height=\"20\" fill=\"rgba(34,197,94,0.25)\" stroke=\"#22c55e\" stroke-width=\"2.5\" rx=\"2\"/><circle cx=\"14\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#22c55e\" text-anchor=\"middle\">✓</text></svg>",
        "title": "Захоплення клітинки",
        "desc": "Той, хто проводить четверту сторону квадрата 1×1, захоплює його у свій колір."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10v28M10 24h28\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/><circle cx=\"24\" cy=\"24\" r=\"8\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"24\" y=\"28\" font-size=\"12\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">+1</text></svg>",
        "title": "Бонусний хід",
        "desc": "За кожну закриту клітинку гравець негайно отримує право на ще один додатковий хід поспіль!"
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-18h12l6 18H12z\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"4\" fill=\"#fbbf24\"/><text x=\"24\" y=\"32\" font-size=\"11\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">WIN</text></svg>",
        "title": "Більше квадратів — перемога",
        "desc": "Коли всі відрізки на полі з'єднані, перемагає той, хто захопив найбільшу площу клітинок."
      }
    ],
    "ru": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"3\" fill=\"#fff\"/><path d=\"M14 14h20\" stroke=\"#38bdf8\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
        "title": "Соединение точек",
        "desc": "Игроки по очереди проводят горизонтальные или вертикальные линии между соседними точками."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"14\" y=\"14\" width=\"20\" height=\"20\" fill=\"rgba(34,197,94,0.25)\" stroke=\"#22c55e\" stroke-width=\"2.5\" rx=\"2\"/><circle cx=\"14\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#22c55e\" text-anchor=\"middle\">✓</text></svg>",
        "title": "Замыкание квадрата",
        "desc": "Проводящий четвёртую стенку квадрата 1×1 забирает эту клетку себе и красит её в свой цвет."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10v28M10 24h28\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/><circle cx=\"24\" cy=\"24\" r=\"8\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"24\" y=\"28\" font-size=\"12\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">+1</text></svg>",
        "title": "Дополнительный ход",
        "desc": "Каждый закрытый квадрат даёт право сделать ещё один ход подряд. Можно забирать цепочки клеток!"
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-18h12l6 18H12z\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"4\" fill=\"#fbbf24\"/><text x=\"24\" y=\"32\" font-size=\"11\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">WIN</text></svg>",
        "title": "Победа по квадратам",
        "desc": "Игра заканчивается, когда свободных линий не осталось. Победил тот, у кого больше квадратов."
      }
    ],
    "en": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"3\" fill=\"#fff\"/><path d=\"M14 14h20\" stroke=\"#38bdf8\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
        "title": "Drawing Lines",
        "desc": "Players take turns connecting two adjacent unjoined dots with a single horizontal or vertical line."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"14\" y=\"14\" width=\"20\" height=\"20\" fill=\"rgba(34,197,94,0.25)\" stroke=\"#22c55e\" stroke-width=\"2.5\" rx=\"2\"/><circle cx=\"14\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#22c55e\" text-anchor=\"middle\">✓</text></svg>",
        "title": "Completing Boxes",
        "desc": "The player who completes the fourth side of a 1×1 box captures it and marks it in their color."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10v28M10 24h28\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/><circle cx=\"24\" cy=\"24\" r=\"8\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"24\" y=\"28\" font-size=\"12\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">+1</text></svg>",
        "title": "Bonus Turn",
        "desc": "Completing a box grants an immediate bonus turn. Chain long corridors of boxes together!"
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-18h12l6 18H12z\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"4\" fill=\"#fbbf24\"/><text x=\"24\" y=\"32\" font-size=\"11\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">WIN</text></svg>",
        "title": "Most Boxes Wins",
        "desc": "When no more lines can be drawn, the player who captured the greatest number of boxes wins."
      }
    ],
    "de": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"3\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"3\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"3\" fill=\"#fff\"/><path d=\"M14 14h20\" stroke=\"#38bdf8\" stroke-width=\"3\" stroke-linecap=\"round\"/></svg>",
        "title": "Linien ziehen",
        "desc": "Die Spieler ziehen abwechselnd eine waagerechte oder senkrechte Linie zwischen zwei Punkten."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"14\" y=\"14\" width=\"20\" height=\"20\" fill=\"rgba(34,197,94,0.25)\" stroke=\"#22c55e\" stroke-width=\"2.5\" rx=\"2\"/><circle cx=\"14\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"14\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"14\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><circle cx=\"34\" cy=\"34\" r=\"2.5\" fill=\"#fff\"/><text x=\"24\" y=\"28\" font-size=\"14\" font-weight=\"900\" fill=\"#22c55e\" text-anchor=\"middle\">✓</text></svg>",
        "title": "Kästchen schließen",
        "desc": "Wer die vierte Seite eines Kästchens schließt, erobert es und markiert es in seiner Farbe."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10v28M10 24h28\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/><circle cx=\"24\" cy=\"24\" r=\"8\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><text x=\"24\" y=\"28\" font-size=\"12\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">+1</text></svg>",
        "title": "Extrazug",
        "desc": "Jedes geschlossene Kästchen belohnt sofort mit einem weiteren Zug. Ganze Ketten lassen sich abräumen!"
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36l6-18h12l6 18H12z\" stroke=\"#e0102e\" stroke-width=\"2\" fill=\"rgba(224,16,46,0.15)\"/><circle cx=\"24\" cy=\"14\" r=\"4\" fill=\"#fbbf24\"/><text x=\"24\" y=\"32\" font-size=\"11\" font-weight=\"900\" fill=\"#fff\" text-anchor=\"middle\">WIN</text></svg>",
        "title": "Die meisten Kästchen siegen",
        "desc": "Sind alle Linien gezogen, gewinnt derjenige mit den meisten eroberten Kästchen auf dem Feld."
      }
    ]
  },
  "full": {
    "uk": "По черзі ставте перетинки між сусідніми точками. Замикаючи квадрат, ви отримуєте очко і додатковий хід. Хто захопить більше квадратів — перемагає.",
    "ru": "По очереди ставьте перемычки между соседними точками. Замыкая квадрат, вы получаете очко и дополнительный ход. Кто захватит больше квадратов — побеждает.",
    "en": "Take turns drawing lines between adjacent dots. Completing a square captures it and awards an extra turn. Player with the most squares wins.",
    "de": "Zieht abwechselnd Linien zwischen benachbarten Punkten. Ein geschlossenes Quadrat bringt einen Punkt und einen Extrazug. Wer die meisten hat, gewinnt."
  }
};
