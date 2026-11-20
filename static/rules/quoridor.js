(window.LOBBY_RULES = window.LOBBY_RULES || {})["quoridor"] = {
  "title": {
    "uk": "🧱 Коридор — правила",
    "ru": "🧱 Коридор — правила",
    "en": "🧱 Quoridor — Rules",
    "de": "🧱 Quoridor — Regeln"
  },
  "steps": {
    "uk": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#fbbf24\" stroke-width=\"1.5\" fill=\"rgba(251,191,36,0.06)\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-10M20 24l4-4 4 4\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Хід фішкою або стінка",
        "desc": "У свій хід ти обираєш одне з двох: перемістити фішку на 1 клітинку або поставити перегородку."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"22\" width=\"28\" height=\"6\" rx=\"2\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-4\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M20 28l8 0\" stroke=\"#fff\" stroke-width=\"2\"/></svg>",
        "title": "Будівництво стін",
        "desc": "Стінка перекриває дві клітинки й змушує суперника шукати обхід. Заборонено повністю перекривати шлях до фінішу!"
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"28\" r=\"4\" fill=\"#38bdf8\"/><circle cx=\"24\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M24 34c8-3 8-18 0-22\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"2 2\"/></svg>",
        "title": "Стрибок через суперника",
        "desc": "Якщо фішки опинилися впритул одна навпроти одної, ти можеш перестрибнути фішку супротивника вперед."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12h32\" stroke=\"#22c55e\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"12\" r=\"5\" fill=\"#22c55e\"/><path d=\"M18 36l6-16 6 16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Дістанься протилежного краю",
        "desc": "Хто першим ступить на будь-яку клітинку протилежного краю поля — той миттєво перемагає!"
      }
    ],
    "ru": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#fbbf24\" stroke-width=\"1.5\" fill=\"rgba(251,191,36,0.06)\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-10M20 24l4-4 4 4\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Ход фишкой или стенка",
        "desc": "В свой ход ты делаешь одно действие: шагаешь фишкой на 1 клетку или ставишь стенку-преграду."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"22\" width=\"28\" height=\"6\" rx=\"2\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-4\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M20 28l8 0\" stroke=\"#fff\" stroke-width=\"2\"/></svg>",
        "title": "Установка стен",
        "desc": "Стенка перекрывает два паза. Ставь их, строя лабиринт, но закон запрещает наглухо блокировать путь к цели."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"28\" r=\"4\" fill=\"#38bdf8\"/><circle cx=\"24\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M24 34c8-3 8-18 0-22\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"2 2\"/></svg>",
        "title": "Прыжок через соперника",
        "desc": "Оказавшись лицом к лицу с фишкой противника, ты имеешь право перепрыгнуть через неё вперед."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12h32\" stroke=\"#22c55e\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"12\" r=\"5\" fill=\"#22c55e\"/><path d=\"M18 36l6-16 6 16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Гонка до края поля",
        "desc": "Побеждает игрок, чья фишка первой доберётся до противоположной базовой линии поля."
      }
    ],
    "en": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#fbbf24\" stroke-width=\"1.5\" fill=\"rgba(251,191,36,0.06)\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-10M20 24l4-4 4 4\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Move Pawn or Wall",
        "desc": "On your turn, choose either to move your pawn one square or erect a wooden fence wall."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"22\" width=\"28\" height=\"6\" rx=\"2\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-4\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M20 28l8 0\" stroke=\"#fff\" stroke-width=\"2\"/></svg>",
        "title": "Placing Walls",
        "desc": "Walls block two adjacent grid edges. You can force detours, but you must leave at least one open path."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"28\" r=\"4\" fill=\"#38bdf8\"/><circle cx=\"24\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M24 34c8-3 8-18 0-22\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"2 2\"/></svg>",
        "title": "Jumping Pawns",
        "desc": "When directly facing an opponent pawn without a wall between, you can leap over them forward."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12h32\" stroke=\"#22c55e\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"12\" r=\"5\" fill=\"#22c55e\"/><path d=\"M18 36l6-16 6 16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "First to the Goal",
        "desc": "The first player whose pawn touches any square along the opponent's starting baseline wins!"
      }
    ],
    "de": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#fbbf24\" stroke-width=\"1.5\" fill=\"rgba(251,191,36,0.06)\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-10M20 24l4-4 4 4\" stroke=\"#38bdf8\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Figur ziehen oder Wand",
        "desc": "In deinem Zug ziehst du deine Spielfigur um ein Feld oder platzierst eine Sperrwand."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"10\" y=\"22\" width=\"28\" height=\"6\" rx=\"2\" fill=\"#e0102e\" stroke=\"#ff2238\" stroke-width=\"1.5\"/><circle cx=\"24\" cy=\"34\" r=\"4\" fill=\"#38bdf8\"/><path d=\"M24 30v-4\" stroke=\"#fff\" stroke-width=\"2\" stroke-linecap=\"round\"/><path d=\"M20 28l8 0\" stroke=\"#fff\" stroke-width=\"2\"/></svg>",
        "title": "Wände setzen",
        "desc": "Wände sperren zwei Kanten. Baue Labyrinthe, aber schneide dem Gegner niemals alle Wege zum Ziel ab."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><circle cx=\"24\" cy=\"28\" r=\"4\" fill=\"#38bdf8\"/><circle cx=\"24\" cy=\"20\" r=\"4\" fill=\"#e0102e\"/><path d=\"M24 34c8-3 8-18 0-22\" stroke=\"#22c55e\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-dasharray=\"2 2\"/></svg>",
        "title": "Figurensprung",
        "desc": "Stehen sich zwei Figuren frontal gegenüber, darfst du geradeaus über den Gegner springen."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M8 12h32\" stroke=\"#22c55e\" stroke-width=\"3\" stroke-linecap=\"round\"/><circle cx=\"24\" cy=\"12\" r=\"5\" fill=\"#22c55e\"/><path d=\"M18 36l6-16 6 16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"/></svg>",
        "title": "Ziellinie erreichen",
        "desc": "Wer als Erster mit seiner Figur die gegenüberliegende Grundlinie erreicht, gewinnt das Duell!"
      }
    ]
  },
  "full": {
    "uk": "У свій хід або ходи фішкою на сусідню клітинку, або став стінку для уповільнення суперника. Повністю блокувати шлях до фінішу заборонено. Хто першим дійде до протилежного краю — перемагає.",
    "ru": "В свой ход либо шагай фишкой на соседнюю клетку, либо ставь стенку для замедления соперника. Полностью блокировать путь к цели запрещено. Кто первым дойдёт до противоположного края поля — побеждает.",
    "en": "On your turn, either advance your pawn or erect a wall to hinder your opponent. You must never completely seal off the path to the goal. First to reach the opposite edge wins.",
    "de": "Ziehe deine Figur oder setze eine Wand, um den Gegner aufzuhalten. Der Weg zum Ziel darf niemals komplett blockiert werden. Wer zuerst die andere Seite erreicht, gewinnt."
  }
};
