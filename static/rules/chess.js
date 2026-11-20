(window.LOBBY_RULES = window.LOBBY_RULES || {})["chess"] = {
  "title": {
    "uk": "♟ Шахи — правила",
    "ru": "♟ Шахматы — правила",
    "en": "♟ Chess — Rules",
    "de": "♟ Schach — Regeln"
  },
  "steps": {
    "uk": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"2\" fill=\"rgba(56,189,248,0.06)\"/><rect x=\"8\" y=\"8\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><rect x=\"24\" y=\"24\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><path d=\"M24 16v16M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Дошка та фігури",
        "desc": "Пішаки йдуть уперед, тури — прямо, коні — літерою «Г», слони — діагоналями, а ферзь — у будь-який бік."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l4-4 4 4v6M28 36v-6l4-4 4 4v6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M16 18c0-4 8-8 16 0\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Рокіровка та взяття на проході",
        "desc": "Спеціальні маневри: безпечна рокіровка короля з турою та взяття пішака суперника на проході."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10l4 8-8 0 4-8z\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"8\" r=\"3\" fill=\"#fbbf24\"/><path d=\"M16 24h16M18 24v12h12V24\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M10 10l28 28\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Шах і Мат",
        "desc": "Шах — пряма загроза королю. Якщо король не має жодного безпечного ходу й захисту — це мат і перемога!"
      }
    ],
    "ru": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"2\" fill=\"rgba(56,189,248,0.06)\"/><rect x=\"8\" y=\"8\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><rect x=\"24\" y=\"24\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><path d=\"M24 16v16M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Доска и фигуры",
        "desc": "Пешки идут вперёд, ладьи — по прямым, кони — буквой «Г», слоны — по диагоналям, ферзь — во все стороны."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l4-4 4 4v6M28 36v-6l4-4 4 4v6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M16 18c0-4 8-8 16 0\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Рокировка и взятие на проходе",
        "desc": "Особые ходы: быстрая рокировка короля с ладьёй и взятие вражеской пешки на проходе."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10l4 8-8 0 4-8z\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"8\" r=\"3\" fill=\"#fbbf24\"/><path d=\"M16 24h16M18 24v12h12V24\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M10 10l28 28\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Шах и Мат",
        "desc": "Шах — нападение на короля. Если королю некуда отступить и нечем закрыться — объявляется мат и конец игры!"
      }
    ],
    "en": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"2\" fill=\"rgba(56,189,248,0.06)\"/><rect x=\"8\" y=\"8\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><rect x=\"24\" y=\"24\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><path d=\"M24 16v16M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Board & Movement",
        "desc": "Pawns march forward, rooks move straight, knights leap in L-shapes, bishops glide diagonally, queen goes anywhere."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l4-4 4 4v6M28 36v-6l4-4 4 4v6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M16 18c0-4 8-8 16 0\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Castling & En Passant",
        "desc": "Special tactical moves include king castling with a rook and en passant pawn captures."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10l4 8-8 0 4-8z\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"8\" r=\"3\" fill=\"#fbbf24\"/><path d=\"M16 24h16M18 24v12h12V24\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M10 10l28 28\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Check & Checkmate",
        "desc": "Check attacks the king. When the king cannot move, block, or capture to escape, it is checkmate and game over!"
      }
    ],
    "de": [
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><rect x=\"8\" y=\"8\" width=\"32\" height=\"32\" stroke=\"#38bdf8\" stroke-width=\"2\" fill=\"rgba(56,189,248,0.06)\"/><rect x=\"8\" y=\"8\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><rect x=\"24\" y=\"24\" width=\"16\" height=\"16\" fill=\"rgba(255,255,255,0.12)\"/><path d=\"M24 16v16M16 24h16\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Brett & Figuren",
        "desc": "Bauern ziehen vorwärts, Türme geradeaus, Springer im L-Muster, Läufer diagonal und die Dame in alle Richtungen."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M12 36h24M16 36v-6l4-4 4 4v6M28 36v-6l4-4 4 4v6\" stroke=\"#22d3ee\" stroke-width=\"2\"/><path d=\"M16 18c0-4 8-8 16 0\" stroke=\"#fbbf24\" stroke-width=\"2\" stroke-dasharray=\"3 3\"/></svg>",
        "title": "Rochade & En Passant",
        "desc": "Taktische Sonderzüge umfassen die Rochade von König und Turm sowie das Schlagen en passant."
      },
      {
        "svg": "<svg viewBox=\"0 0 48 48\" fill=\"none\"><path d=\"M24 10l4 8-8 0 4-8z\" fill=\"#e0102e\"/><circle cx=\"24\" cy=\"8\" r=\"3\" fill=\"#fbbf24\"/><path d=\"M16 24h16M18 24v12h12V24\" stroke=\"#e0102e\" stroke-width=\"2\"/><path d=\"M10 10l28 28\" stroke=\"#e0102e\" stroke-width=\"2\" stroke-linecap=\"round\"/></svg>",
        "title": "Schach & Matt",
        "desc": "Schach bedroht den König. Hat der König keinen Ausweg und keinen Schutz mehr, ist es Schachmatt!"
      }
    ]
  },
  "full": {
    "uk": "Класичні шахи: рокіровка, взяття на проході, перетворення пішака. Мета — поставити мат королю суперника.",
    "ru": "Классические шахматы: рокировка, взятие на проходе, превращение пешки. Цель — поставить мат королю соперника.",
    "en": "Classic chess: castling, en passant, and pawn promotion. Deliver checkmate to the opponent's king to win.",
    "de": "Klassisches Schach: Rochade, En Passant und Bauernumwandlung. Setze den gegnerischen König schachmatt."
  }
};
