"""Шахматы — полный движок. 8x8, board[r][c] = 'wP'/'bK'/None (r=0 верх, чёрные сверху).
Полные правила: рокировка, взятие на проходе, превращение, шах/мат/пат, троекратное
повторение и правило 50 ходов не считаем (не критично для казуальной игры с друзьями)."""
import copy

FILES = "abcdefgh"


def start_board():
    back = ["R", "N", "B", "Q", "K", "B", "N", "R"]
    b = [[None] * 8 for _ in range(8)]
    for c in range(8):
        b[0][c] = "b" + back[c]
        b[1][c] = "bP"
        b[6][c] = "wP"
        b[7][c] = "w" + back[c]
    return b


def new_state(pids):
    """pids = [white_pid, black_pid]"""
    return {
        "board": start_board(),
        "turn": 0,  # 0 = white, 1 = black
        "order": list(pids),
        "castle": {"wK": True, "wQ": True, "bK": True, "bQ": True},
        "ep": None,  # en-passant target square (r, c) — куда можно взять
        "halfmove": 0,
        "winner": None,
        "done": False,
        "result": None,  # "checkmate" | "stalemate"
        "last_move": None,
        "history": [],  # ["e4", "e5", ...] для отображения
    }


def owner(piece):
    return 0 if piece and piece[0] == "w" else (1 if piece else None)


def in_bounds(r, c):
    return 0 <= r < 8 and 0 <= c < 8


def _slide(board, r, c, deltas, color):
    out = []
    for dr, dc in deltas:
        nr, nc = r + dr, c + dc
        while in_bounds(nr, nc):
            p = board[nr][nc]
            if p is None:
                out.append((nr, nc))
            else:
                if owner(p) != color:
                    out.append((nr, nc))
                break
            nr += dr
            nc += dc
    return out


def _step(board, r, c, deltas, color):
    out = []
    for dr, dc in deltas:
        nr, nc = r + dr, c + dc
        if in_bounds(nr, nc):
            p = board[nr][nc]
            if p is None or owner(p) != color:
                out.append((nr, nc))
    return out


ROOK_D = [(1, 0), (-1, 0), (0, 1), (0, -1)]
BISHOP_D = [(1, 1), (1, -1), (-1, 1), (-1, -1)]
KNIGHT_D = [(2, 1), (2, -1), (-2, 1), (-2, -1), (1, 2), (1, -2), (-1, 2), (-1, -2)]
KING_D = ROOK_D + BISHOP_D


def pseudo_moves(state, r, c, check_castle=True):
    """Псевдо-легальные ходы фигуры на (r,c) — без проверки что свой король не под шахом."""
    board = state["board"]
    p = board[r][c]
    if not p:
        return []
    color = owner(p)
    kind = p[1]
    moves = []

    if kind == "P":
        d = -1 if color == 0 else 1
        start_row = 6 if color == 0 else 1
        # ход вперёд
        if in_bounds(r + d, c) and board[r + d][c] is None:
            moves.append((r + d, c))
            if r == start_row and board[r + 2 * d][c] is None:
                moves.append((r + 2 * d, c))
        # взятия по диагонали
        for dc in (-1, 1):
            nr, nc = r + d, c + dc
            if in_bounds(nr, nc):
                target = board[nr][nc]
                if target and owner(target) != color:
                    moves.append((nr, nc))
                elif state["ep"] == (nr, nc):
                    moves.append((nr, nc))  # взятие на проходе
    elif kind == "N":
        moves = _step(board, r, c, KNIGHT_D, color)
    elif kind == "B":
        moves = _slide(board, r, c, BISHOP_D, color)
    elif kind == "R":
        moves = _slide(board, r, c, ROOK_D, color)
    elif kind == "Q":
        moves = _slide(board, r, c, ROOK_D + BISHOP_D, color)
    elif kind == "K":
        moves = _step(board, r, c, KING_D, color)
        if check_castle:
            moves += _castle_moves(state, r, c, color)
    return moves


def square_attacked(board, r, c, by_color):
    """Атакована ли клетка (r,c) фигурами цвета by_color."""
    # пешки
    d = 1 if by_color == 0 else -1  # пешка by_color атакует В СТОРОНУ своего движения
    for dc in (-1, 1):
        rr, cc = r + d, c + dc
        if in_bounds(rr, cc):
            p = board[rr][cc]
            if p and owner(p) == by_color and p[1] == "P":
                return True
    for dr, dc in KNIGHT_D:
        rr, cc = r + dr, c + dc
        if in_bounds(rr, cc):
            p = board[rr][cc]
            if p and owner(p) == by_color and p[1] == "N":
                return True
    for dr, dc in KING_D:
        rr, cc = r + dr, c + dc
        if in_bounds(rr, cc):
            p = board[rr][cc]
            if p and owner(p) == by_color and p[1] == "K":
                return True
    for dr, dc in ROOK_D:
        rr, cc = r + dr, c + dc
        while in_bounds(rr, cc):
            p = board[rr][cc]
            if p:
                if owner(p) == by_color and p[1] in ("R", "Q"):
                    return True
                break
            rr += dr
            cc += dc
    for dr, dc in BISHOP_D:
        rr, cc = r + dr, c + dc
        while in_bounds(rr, cc):
            p = board[rr][cc]
            if p:
                if owner(p) == by_color and p[1] in ("B", "Q"):
                    return True
                break
            rr += dr
            cc += dc
    return False


def find_king(board, color):
    for r in range(8):
        for c in range(8):
            p = board[r][c]
            if p and owner(p) == color and p[1] == "K":
                return (r, c)
    return None


def in_check(state, color):
    board = state["board"]
    kr, kc = find_king(board, color)
    return square_attacked(board, kr, kc, 1 - color)


def _castle_moves(state, r, c, color):
    """Рокировка: король/ладья не двигались, между ними пусто, король не под шахом
    и не проходит через атакованную клетку."""
    out = []
    board = state["board"]
    row = 7 if color == 0 else 0
    if r != row or c != 4:
        return out
    if in_check(state, color):
        return out
    ks = "wK" if color == 0 else "bK"
    qs = "wQ" if color == 0 else "bQ"
    # королевская сторона
    if state["castle"].get(ks) and board[row][5] is None and board[row][6] is None:
        rook = board[row][7]
        if rook and rook[1] == "R" and owner(rook) == color:
            if not square_attacked(board, row, 5, 1 - color) and not square_attacked(board, row, 6, 1 - color):
                out.append((row, 6))
    # ферзевая сторона
    if state["castle"].get(qs) and board[row][1] is None and board[row][2] is None and board[row][3] is None:
        rook = board[row][0]
        if rook and rook[1] == "R" and owner(rook) == color:
            if not square_attacked(board, row, 3, 1 - color) and not square_attacked(board, row, 2, 1 - color):
                out.append((row, 2))
    return out


def _apply_raw(board_in, castle_in, ep_in, fr, fc, tr, tc, promo=None):
    """Применяет ход БЕЗ проверки легальности. Возвращает (board, castle, new_ep)."""
    board = copy.deepcopy(board_in)
    castle = dict(castle_in)
    piece = board[fr][fc]
    color = owner(piece)
    kind = piece[1]
    new_ep = None

    # взятие на проходе — жертва не на целевой клетке
    if kind == "P" and (tr, tc) == ep_in and board[tr][tc] is None:
        board[fr][tc] = None  # съедаемая пешка стоит на той же вертикали что и цель, но на исходном ряду атакующего

    board[tr][tc] = piece
    board[fr][fc] = None

    # превращение
    if kind == "P" and tr in (0, 7):
        board[tr][tc] = (piece[0]) + (promo or "Q")

    # двойной ход пешки → новая цель en passant
    if kind == "P" and abs(tr - fr) == 2:
        new_ep = ((fr + tr) // 2, fc)

    # рокировка — переставить ладью
    if kind == "K" and abs(tc - fc) == 2:
        row = fr
        if tc == 6:
            board[row][5] = board[row][7]
            board[row][7] = None
        elif tc == 2:
            board[row][3] = board[row][0]
            board[row][0] = None

    # обновить права рокировки
    if kind == "K":
        castle["wK" if color == 0 else "bK"] = False
        castle["wQ" if color == 0 else "bQ"] = False
    if kind == "R":
        row = 7 if color == 0 else 0
        if fr == row and fc == 0:
            castle["wQ" if color == 0 else "bQ"] = False
        elif fr == row and fc == 7:
            castle["wK" if color == 0 else "bK"] = False
    # если ладью съели на её стартовой клетке
    for cr, cc, key in ((7, 0, "wQ"), (7, 7, "wK"), (0, 0, "bQ"), (0, 7, "bK")):
        if (tr, tc) == (cr, cc):
            castle[key] = False

    return board, castle, new_ep


def legal_moves(state, r, c):
    """Легальные ходы фигуры на (r,c) — свой король не должен оставаться под шахом."""
    board = state["board"]
    p = board[r][c]
    if not p or owner(p) != state["turn"]:
        return []
    color = state["turn"]
    out = []
    for (tr, tc) in pseudo_moves(state, r, c):
        nb, ncastle, nep = _apply_raw(board, state["castle"], state["ep"], r, c, tr, tc, "Q")
        tmp = dict(state)
        tmp["board"] = nb
        if not in_check(tmp, color):
            out.append((tr, tc))
    return out


def all_legal_moves(state, color=None):
    """Все легальные ходы текущего игрока (или указанного цвета). [(fr,fc,tr,tc), ...]"""
    color = state["turn"] if color is None else color
    board = state["board"]
    out = []
    for r in range(8):
        for c in range(8):
            p = board[r][c]
            if p and owner(p) == color:
                st = state if color == state["turn"] else {**state, "turn": color}
                for (tr, tc) in legal_moves(st, r, c):
                    out.append((r, c, tr, tc))
    return out


def _sq(r, c):
    return f"{FILES[c]}{8 - r}"


def apply_move(state, fr, fc, tr, tc, promo=None):
    """Применяет ход (уже проверенный на легальность вызывающим), обновляет статус игры."""
    board = state["board"]
    piece = board[fr][fc]
    captured = board[tr][tc] is not None or (piece[1] == "P" and (tr, tc) == state["ep"])
    nb, ncastle, nep = _apply_raw(board, state["castle"], state["ep"], fr, fc, tr, tc, promo)
    state["board"] = nb
    state["castle"] = ncastle
    state["ep"] = nep
    state["halfmove"] = 0 if captured or piece[1] == "P" else state["halfmove"] + 1
    state["last_move"] = (fr, fc, tr, tc)
    state["history"].append(f"{_sq(fr, fc)}{_sq(tr, tc)}")
    state["turn"] = 1 - state["turn"]

    nxt = state["turn"]
    moves_left = all_legal_moves(state, nxt)
    if not moves_left:
        state["done"] = True
        if in_check(state, nxt):
            state["result"] = "checkmate"
            state["winner"] = state["order"][1 - nxt]
        else:
            state["result"] = "stalemate"
            state["winner"] = None
    return state
