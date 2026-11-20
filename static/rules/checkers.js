(window.LOBBY_RULES = window.LOBBY_RULES || {})["checkers"] = {
  "title": {
    "uk": "🏁 Шашки — правила",
    "ru": "🏁 Шашки — правила",
    "en": "🏁 Checkers — Rules",
    "de": "🏁 Dame — Regeln"
  },
  "steps": {
    "uk": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.06)\"/><circle cx=\"16\" cy=\"32\" r=\"5\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M16 27l8-8\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Хід по діагоналі",
        "desc": "Прості шашки переміщуються тільки вперед по темних клітинках на одну позицію за діагоналлю."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"34\" r=\"4\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><path d=\"M17 31l14-14\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M22 22l4 4M26 22l-4 4\" stroke=\"#fff\" stroke-width=\"1.5\"/></svg>",
        "title": "Обов'язковий бій",
        "desc": "Якщо поруч стоїть шашка суперника, а за нею вільне поле — бити обов'язково (можна бити й назад, і серією)."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"12\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M18 26l3-6 3 3 3-3 3 6H18z\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"15\" r=\"2\" fill=\"#fbbf24\"/></svg>",
        "title": "Дамка",
        "desc": "Дійшовши до протилежного краю дошки, шашка стає дамкою і може ходити та бити на будь-яку кількість клітинок."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 38h24M16 38v-4a8 8 0 0116 0v4\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M18 20l4 4 8-8\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Перемога в партії",
        "desc": "Перемагає той, хто поб'є всі шашки супротивника або позбавить його будь-яких можливих ходів."
      }
    ],
    "ru": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.06)\"/><circle cx=\"16\" cy=\"32\" r=\"5\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M16 27l8-8\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Ход по диагонали",
        "desc": "Простые шашки перемещаются только вперёд по тёмным полям на одну клетку по диагонали."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"34\" r=\"4\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><path d=\"M17 31l14-14\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M22 22l4 4M26 22l-4 4\" stroke=\"#fff\" stroke-width=\"1.5\"/></svg>",
        "title": "Обязательное взятие",
        "desc": "Если рядом стоит шашка противника, а за ней свободно — бить обязательно (в том числе назад и сериями)."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"12\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M18 26l3-6 3 3 3-3 3 6H18z\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"15\" r=\"2\" fill=\"#fbbf24\"/></svg>",
        "title": "Дамка",
        "desc": "Достигнув противоположного края доски, шашка становится дамкой и летает по диагоналям на любое расстояние."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 38h24M16 38v-4a8 8 0 0116 0v4\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M18 20l4 4 8-8\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Победа",
        "desc": "Побеждает тот, кто заберёт все шашки соперника или полностью заблокирует ему возможность сделать ход."
      }
    ],
    "en": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.06)\"/><circle cx=\"16\" cy=\"32\" r=\"5\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M16 27l8-8\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Diagonal Moves",
        "desc": "Standard pieces move forward diagonally one square at a time on dark squares."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"34\" r=\"4\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><path d=\"M17 31l14-14\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M22 22l4 4M26 22l-4 4\" stroke=\"#fff\" stroke-width=\"1.5\"/></svg>",
        "title": "Mandatory Jumps",
        "desc": "If an adjacent opponent piece has an empty landing square behind it, jumping and capturing is mandatory."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"12\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M18 26l3-6 3 3 3-3 3 6H18z\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"15\" r=\"2\" fill=\"#fbbf24\"/></svg>",
        "title": "Kings",
        "desc": "Reaching the far edge crowns your piece into a King, gaining long-range diagonal moves and captures."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 38h24M16 38v-4a8 8 0 0116 0v4\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M18 20l4 4 8-8\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Winning",
        "desc": "Capture all opponent pieces or leave them with no legal moves to claim victory."
      }
    ],
    "de": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#22d3ee\" stroke-width=\"2\" fill=\"rgba(34,211,238,0.06)\"/><circle cx=\"16\" cy=\"32\" r=\"5\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"2\"/><path d=\"M16 27l8-8\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Diagonale Züge",
        "desc": "Einfache Steine ziehen nur vorwärts diagonal auf den dunklen Feldern um ein Feld."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"14\" cy=\"34\" r=\"4\" fill=\"#fff\" stroke=\"#38bdf8\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"24\" r=\"4\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><path d=\"M17 31l14-14\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/><path d=\"M22 22l4 4M26 22l-4 4\" stroke=\"#fff\" stroke-width=\"1.5\"/></svg>",
        "title": "Schlagzwang",
        "desc": "Steht ein gegnerischer Stein benachbart mit freiem Feld dahinter, muss geschlagen werden (auch rückwärts)."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"24\" r=\"12\" fill=\"rgba(251,191,36,0.2)\" stroke=\"#fbbf24\" stroke-width=\"2\"/><path d=\"M18 26l3-6 3 3 3-3 3 6H18z\" fill=\"#fbbf24\"/><circle cx=\"24\" cy=\"15\" r=\"2\" fill=\"#fbbf24\"/></svg>",
        "title": "Dame",
        "desc": "Erreicht ein Stein die gegnerische Grundlinie, wird er zur Dame und kann über beliebige Weiten ziehen."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 38h24M16 38v-4a8 8 0 0116 0v4\" stroke=\"#22c55e\" stroke-width=\"2\" fill=\"rgba(34,197,94,0.15)\"/><path d=\"M18 20l4 4 8-8\" stroke=\"#22c55e\" stroke-width=\"2.5\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Sieg",
        "desc": "Wer alle Steine des Gegners schlägt oder ihn vollständig bewegungsunfähig macht, gewinnt das Spiel."
      }
    ]
  },
  "full": {
    "uk": "Ходи шашками по діагоналі вперед. Бити шашки суперника обов'язково (можна і назад). Дійшовши до кінця дошки, шашка стає дамкою. Перемога — збити всі шашки або заблокувати ходи.",
    "ru": "Ходи шашками по диагонали вперёд. Бить шашки соперника обязательно (можно и назад). Дойдя до конца доски, шашка становится дамкой. Победа — забрать все шашки или запереть ходы.",
    "en": "Move diagonally forward. Jumping opponent pieces is mandatory (including backwards). Reaching the opposing edge crowns a King. Win by eliminating or blocking all enemy pieces.",
    "de": "Zieht diagonal vorwärts. Das Schlagen gegnerischer Steine ist Pflicht. Auf der gegnerischen Grundlinie wird der Stein zur Dame. Gewonnen hat, wer alle gegnerischen Steine schlägt."
  }
};
