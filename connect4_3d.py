PALETTE = ["#ff2a55", "#00f0ff", "#ffb800", "#a259ff", "#00ff88"]

def get_state(room):
    if "c4_3d" not in room:
        room["c4_3d"] = {
            "grid": [[[] for _ in range(5)] for _ in range(5)], # grid[x][y] = list of pids from bottom (z=0) to top (z=4)
            "turn": 0,
            "winner": None,
            "win_line": None,
            "last_move": None,
            "colors": {},  # pid -> hex color
            "started": False
        }
    return room["c4_3d"]

def check_win(grid, x, y, z, pid):
    # 13 unique 3D ray directions
    directions = [
        (1,0,0), (0,1,0), (0,0,1),
        (1,1,0), (1,-1,0),
        (1,0,1), (1,0,-1),
        (0,1,1), (0,1,-1),
        (1,1,1), (1,1,-1), (1,-1,1), (-1,1,1)
    ]

    def get_cell(cx, cy, cz):
        if 0 <= cx < 5 and 0 <= cy < 5:
            col = grid[cx][cy]
            if 0 <= cz < len(col):
                return col[cz]
        return None

    for dx, dy, dz in directions:
        line = [(x, y, z)]

        # Forward search
        cx, cy, cz = x + dx, y + dy, z + dz
        while get_cell(cx, cy, cz) == pid:
            line.append((cx, cy, cz))
            cx += dx
            cy += dy
            cz += dz

        # Backward search
        cx, cy, cz = x - dx, y - dy, z - dz
        while get_cell(cx, cy, cz) == pid:
            line.append((cx, cy, cz))
            cx -= dx
            cy -= dy
            cz -= dz

        if len(line) >= 4:
            return line
    return None

async def push_c4_3d(room):
    if "c4_3d" not in room:
        return
    st = room["c4_3d"]
    players = list(room["players"].keys())[:3]
    
    # Auto-assign colors if not set
    for i, p in enumerate(players):
        if p not in st["colors"]:
            used = set(st["colors"].values())
            for c in PALETTE:
                if c not in used:
                    st["colors"][p] = c
                    break

    turn_pid = players[st["turn"] % len(players)] if players else None

    payload = {
        "type": "c4_3d_state",
        "grid": st["grid"],
        "turn": st["turn"],
        "turn_pid": turn_pid,
        "winner": st["winner"],
        "win_line": st["win_line"],
        "last_move": st["last_move"],
        "players": players,
        "names": {p: room["players"][p]["name"] for p in players if p in room["players"]},
        "colors": st["colors"],
        "palette": PALETTE,
        "started": st["started"],
        "host": room.get("host"),
        "code": room.get("code")
    }

    # Broadcast to room
    for p in room["players"].values():
        ws = p.get("ws")
        if ws:
            try:
                await ws.send_json(payload)
            except Exception:
                pass

async def handle_c4_3d_action(room, pid, msg, websocket, broadcast):
    act = msg.get("action")
    st = get_state(room)
    players = list(room["players"].keys())[:3]

    if act == "c4_3d_color":
        color = msg.get("color")
        if color in PALETTE:
            # Check if another player has this color
            taken = any(c == color for p, c in st["colors"].items() if p != pid and p in room["players"])
            if not taken:
                st["colors"][pid] = color
                await push_c4_3d(room)

    elif act == "c4_3d_start":
        if room.get("host") != pid:
            return
        if len(players) < 2:
            await websocket.send_json({"type": "error", "msg": "Нужно минимум 2 игрока."})
            return

        st["grid"] = [[[] for _ in range(5)] for _ in range(5)]
        st["turn"] = 0
        st["winner"] = None
        st["win_line"] = None
        st["last_move"] = None
        st["started"] = True
        room["state"] = "playing"
        await push_c4_3d(room)

    elif act == "c4_3d_drop":
        if not st.get("started") or st.get("winner"):
            return
        if pid not in players:
            return

        turn_pid = players[st["turn"] % len(players)]
        if pid != turn_pid:
            return

        x = msg.get("x")
        y = msg.get("y")
        if x is None or y is None:
            return
        try:
            x, y = int(x), int(y)
        except (ValueError, TypeError):
            return

        if not (0 <= x < 5 and 0 <= y < 5):
            return

        col = st["grid"][x][y]
        if len(col) >= 5:
            return  # column is full

        col.append(pid)
        z = len(col) - 1
        st["last_move"] = [x, y, z]

        win_line = check_win(st["grid"], x, y, z, pid)
        if win_line:
            st["winner"] = pid
            st["win_line"] = win_line
            st["started"] = False
        else:
            # Check draw
            is_full = all(len(st["grid"][i][j]) == 5 for i in range(5) for j in range(5))
            if is_full:
                st["winner"] = "draw"
                st["started"] = False
            else:
                st["turn"] += 1

        await push_c4_3d(room)
