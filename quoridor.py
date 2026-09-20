"""
Игровой движок «Коридор» (Quoridor) для Jarvis Games.
Поддержка 2, 3 и 4 игроков.
Сетка 9x9, расчет ходов фишек (прыжки, диагонали), валидация стенок (BFS пути), AI-бот.
"""
from collections import deque
import random

BOARD_SIZE = 9
WALL_GRID_SIZE = 8

PLAYER_CONFIGS = {
    2: [
        {"start": (8, 4), "target": "row_0", "walls": 10, "color": "#ff4d6d", "label": "Юг"},
        {"start": (0, 4), "target": "row_8", "walls": 10, "color": "#00e5ff", "label": "Север"},
    ],
    3: [
        {"start": (8, 4), "target": "row_0", "walls": 6, "color": "#ff4d6d", "label": "Юг"},
        {"start": (4, 0), "target": "col_8", "walls": 6, "color": "#ffd166", "label": "Запад"},
        {"start": (0, 4), "target": "row_8", "walls": 6, "color": "#00e5ff", "label": "Север"},
    ],
    4: [
        {"start": (8, 4), "target": "row_0", "walls": 5, "color": "#ff4d6d", "label": "Юг"},
        {"start": (4, 0), "target": "col_8", "walls": 5, "color": "#ffd166", "label": "Запад"},
        {"start": (0, 4), "target": "row_8", "walls": 5, "color": "#00e5ff", "label": "Север"},
        {"start": (4, 8), "target": "col_0", "walls": 5, "color": "#06d6a0", "label": "Восток"},
    ]
}

def is_target_reached(pos, target_type):
    r, c = pos
    if target_type == "row_0":
        return r == 0
    elif target_type == "row_8":
        return r == 8
    elif target_type == "col_0":
        return c == 0
    elif target_type == "col_8":
        return c == 8
    return False

def is_passage_blocked(r1, c1, r2, c2, walls_set):
    """
    Проверяет, блокирует ли какая-либо стенка переход между соседними клетками (r1, c1) и (r2, c2).
    walls_set: set кортежей (r, c, dir), где dir in ('h', 'v')
    """
    if r1 == r2:
        # Горизонтальное перемещение: c1 <-> c2
        min_c = min(c1, c2)
        row = r1
        # Вертикальная стенка на (row, min_c) или (row - 1, min_c) блокирует проход
        if (row, min_c, 'v') in walls_set or (row - 1, min_c, 'v') in walls_set:
            return True
    elif c1 == c2:
        # Вертикальное перемещение: r1 <-> r2
        min_r = min(r1, r2)
        col = c1
        # Горизонтальная стенка на (min_r, col) или (min_r, col - 1) блокирует проход
        if (min_r, col, 'h') in walls_set or (min_r, col - 1, 'h') in walls_set:
            return True
    return False

def get_unblocked_neighbors(r, c, walls_set):
    """Возвращает ортогональных соседей клетки (r, c), куда не мешают пройти стенки."""
    res = []
    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = r + dr, c + dc
        if 0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE:
            if not is_passage_blocked(r, c, nr, nc, walls_set):
                res.append((nr, nc))
    return res

def has_path_bfs(start_pos, target_type, walls_set):
    """Проверяет BFS, есть ли хотя бы один путь от start_pos к финишу target_type."""
    if is_target_reached(start_pos, target_type):
        return True
    queue = deque([start_pos])
    visited = {start_pos}
    while queue:
        cur = queue.popleft()
        if is_target_reached(cur, target_type):
            return True
        for nxt in get_unblocked_neighbors(cur[0], cur[1], walls_set):
            if nxt not in visited:
                visited.add(nxt)
                queue.append(nxt)
    return False

def shortest_path_bfs(start_pos, target_type, walls_set):
    """Возвращает длину кратчайшего пути и следующий шаг (next_step, dist)."""
    if is_target_reached(start_pos, target_type):
        return None, 0
    queue = deque([(start_pos, [start_pos])])
    visited = {start_pos}
    while queue:
        cur, path = queue.popleft()
        if is_target_reached(cur, target_type):
            next_step = path[1] if len(path) > 1 else path[0]
            return next_step, len(path) - 1
        for nxt in get_unblocked_neighbors(cur[0], cur[1], walls_set):
            if nxt not in visited:
                visited.add(nxt)
                queue.append((nxt, path + [nxt]))
    return None, float('inf')

def can_place_wall_geometric(r, c, wdir, walls_set):
    """Проверяет геометрическую корректность размещения стенки (без пересечений и наложений)."""
    if not (0 <= r < WALL_GRID_SIZE and 0 <= c < WALL_GRID_SIZE):
        return False
    if wdir not in ('h', 'v'):
        return False

    # 1. Точное совпадение
    if (r, c, wdir) in walls_set:
        return False

    # 2. Пересечение крестом (в одном и том же узле)
    other_dir = 'v' if wdir == 'h' else 'h'
    if (r, c, other_dir) in walls_set:
        return False

    # 3. Наложение вдоль одного направления
    if wdir == 'h':
        if (r, c - 1, 'h') in walls_set or (r, c + 1, 'h') in walls_set:
            return False
    else:  # 'v'
        if (r - 1, c, 'v') in walls_set or (r + 1, c, 'v') in walls_set:
            return False

    return True

def get_valid_pawn_moves(state, pid):
    """
    Возвращает список доступных клеток (r, c) для перемещения фишки игрока pid.
    Учитывает стены, прыжки через соперников по прямой и диагонали.
    """
    players = state["players"]
    if pid not in players:
        return []
    me = players[pid]
    pr, pc = me["pos"]
    walls_set = {(w["r"], w["c"], w["dir"]) for w in state["walls"]}

    # Множество занятых клеток другими игроками
    occupied = {p["pos"]: p_id for p_id, p in players.items() if p_id != pid}

    moves = []

    for dr, dc in ((-1, 0), (1, 0), (0, -1), (0, 1)):
        nr, nc = pr + dr, pc + dc
        if not (0 <= nr < BOARD_SIZE and 0 <= nc < BOARD_SIZE):
            continue
        if is_passage_blocked(pr, pc, nr, nc, walls_set):
            continue

        if (nr, nc) not in occupied:
            # Клетка свободна — стандартный ход
            moves.append((nr, nc))
        else:
            # На клетке соперник — проверяем возможность прыжка
            jr, jc = nr + dr, nc + dc  # Прямой прыжок
            straight_jump_possible = (
                0 <= jr < BOARD_SIZE and 0 <= jc < BOARD_SIZE
                and not is_passage_blocked(nr, nc, jr, jc, walls_set)
                and (jr, jc) not in occupied
            )

            if straight_jump_possible:
                moves.append((jr, jc))
            else:
                # Прямой прыжок заблокирован (стеной, краем поля или другим игроком)
                # Разрешен диагональный прыжок влево или вправо относительно вектора (dr, dc)
                for pdr, pdc in ((-dc, dr), (dc, -dr)):
                    diag_r, diag_c = nr + pdr, nc + pdc
                    if 0 <= diag_r < BOARD_SIZE and 0 <= diag_c < BOARD_SIZE:
                        if not is_passage_blocked(nr, nc, diag_r, diag_c, walls_set) and (diag_r, diag_c) not in occupied:
                            moves.append((diag_r, diag_c))

    return list(set(moves))

def can_place_wall(state, pid, r, c, wdir):
    """
    Полная проверка возможности поставить стенку:
    - У игрока есть стенки в запасе.
    - Геометрически нет наложений и пересечений.
    - Ни один из игроков не оказывается заперт (у всех есть путь к цели).
    """
    me = state["players"].get(pid)
    if not me or me.get("walls", 0) <= 0:
        return False, "У вас не осталось стенок."

    current_walls = {(w["r"], w["c"], w["dir"]) for w in state["walls"]}
    if not can_place_wall_geometric(r, c, wdir, current_walls):
        return False, "Стенка здесь не помещается или пересекается с другой."

    # Тестируем гипотетическую расстановку
    test_walls = current_walls | {(r, c, wdir)}
    for p_id, p in state["players"].items():
        if not has_path_bfs(p["pos"], p["target"], test_walls):
            return False, "Стенка полностью перекрывает путь игроку!"

    return True, "OK"

def new_quoridor_state(player_ids, custom_walls=None):
    """Создает начальное состояние игры для 2, 3 или 4 игроков."""
    n = len(player_ids)
    if n not in PLAYER_CONFIGS:
        raise ValueError(f"Неподдерживаемое число игроков: {n}")

    configs = PLAYER_CONFIGS[n]
    players = {}
    for i, pid in enumerate(player_ids):
        cfg = configs[i]
        walls_count = custom_walls if custom_walls is not None else cfg["walls"]
        players[pid] = {
            "pos": cfg["start"],
            "target": cfg["target"],
            "walls": walls_count,
            "color": cfg["color"],
            "label": cfg["label"],
            "seat": i
        }

    return {
        "board_size": BOARD_SIZE,
        "player_count": n,
        "player_order": list(player_ids),
        "players": players,
        "walls": [],  # list of {"r": int, "c": int, "dir": 'h'|'v', "owner": pid}
        "turn": 0,
        "winner": None,
        "last_action": None,
        "history": []
    }

def apply_pawn_move(state, pid, r, c):
    """Применяет ход фишкой."""
    valid_moves = get_valid_pawn_moves(state, pid)
    if (r, c) not in valid_moves:
        return False, "Недопустимый ход фишкой."

    prev_pos = state["players"][pid]["pos"]
    state["players"][pid]["pos"] = (r, c)
    state["last_action"] = {
        "type": "move",
        "pid": pid,
        "from": prev_pos,
        "to": (r, c)
    }
    state["history"].append(state["last_action"])

    # Проверка победы
    if is_target_reached((r, c), state["players"][pid]["target"]):
        state["winner"] = pid
    else:
        state["turn"] = (state["turn"] + 1) % len(state["player_order"])

    return True, "OK"

def apply_wall_placement(state, pid, r, c, wdir):
    """Применяет установку стенки."""
    ok, err = can_place_wall(state, pid, r, c, wdir)
    if not ok:
        return False, err

    state["players"][pid]["walls"] -= 1
    new_wall = {"r": r, "c": c, "dir": wdir, "owner": pid}
    state["walls"].append(new_wall)

    state["last_action"] = {
        "type": "wall",
        "pid": pid,
        "wall": new_wall
    }
    state["history"].append(state["last_action"])

    state["turn"] = (state["turn"] + 1) % len(state["player_order"])
    return True, "OK"

def bot_choose_action(state, bot_pid, difficulty="medium"):
    """
    Выбирает действие для бота:
    - Поиск кратчайшего пути BFS.
    - В 25-35% случаев пытается поставить стенку на пути лидирующего соперника.
    """
    bot = state["players"].get(bot_pid)
    if not bot:
        return None

    walls_set = {(w["r"], w["c"], w["dir"]) for w in state["walls"]}
    my_next_step, my_dist = shortest_path_bfs(bot["pos"], bot["target"], walls_set)

    # Найдем ближайшего к финишу соперника
    opponents = [p_id for p_id in state["player_order"] if p_id != bot_pid]
    opp_dists = {}
    for opp_id in opponents:
        opp = state["players"][opp_id]
        _, dist = shortest_path_bfs(opp["pos"], opp["target"], walls_set)
        opp_dists[opp_id] = dist

    leader_opp = min(opp_dists, key=opp_dists.get) if opp_dists else None
    leader_dist = opp_dists[leader_opp] if leader_opp else 999

    # Решаем: поставить стенку или двигаться
    should_try_wall = (
        bot["walls"] > 0
        and leader_opp is not None
        and (leader_dist <= my_dist or leader_dist <= 3)
        and (random.random() < (0.6 if difficulty == "hard" else 0.35))
    )

    if should_try_wall:
        # Пробуем несколько случайных валидных стенок около лидера
        opp_pos = state["players"][leader_opp]["pos"]
        r0, c0 = opp_pos
        candidate_slots = []
        for dr in (-1, 0, 1):
            for dc in (-1, 0, 1):
                wr, wc = r0 + dr, c0 + dc
                if 0 <= wr < WALL_GRID_SIZE and 0 <= wc < WALL_GRID_SIZE:
                    for wdir in ('h', 'v'):
                        candidate_slots.append((wr, wc, wdir))
        random.shuffle(candidate_slots)

        best_wall = None
        best_gain = 0
        for wr, wc, wdir in candidate_slots[:12]:
            ok, _ = can_place_wall(state, bot_pid, wr, wc, wdir)
            if ok:
                test_walls = walls_set | {(wr, wc, wdir)}
                _, new_opp_dist = shortest_path_bfs(opp_pos, state["players"][leader_opp]["target"], test_walls)
                _, new_my_dist = shortest_path_bfs(bot["pos"], bot["target"], test_walls)
                gain = (new_opp_dist - leader_dist) - (new_my_dist - my_dist)
                if gain > best_gain:
                    best_gain = gain
                    best_wall = (wr, wc, wdir)

        if best_wall and best_gain > 0:
            return {"action": "wall", "r": best_wall[0], "c": best_wall[1], "dir": best_wall[2]}

    # Иначе делаем ход фишкой
    valid_moves = get_valid_pawn_moves(state, bot_pid)
    if not valid_moves:
        return None

    if my_next_step in valid_moves:
        return {"action": "move", "r": my_next_step[0], "c": my_next_step[1]}

    # Если кратчайший шаг заблокирован прыжком/соперником, выберем ход с наименьшей BFS дистанцией
    best_move = None
    min_d = float('inf')
    for mr, mc in valid_moves:
        _, d = shortest_path_bfs((mr, mc), bot["target"], walls_set)
        if d < min_d:
            min_d = d
            best_move = (mr, mc)

    if best_move:
        return {"action": "move", "r": best_move[0], "c": best_move[1]}

    fallback = random.choice(valid_moves)
    return {"action": "move", "r": fallback[0], "c": fallback[1]}
