"""Сквозные WebSocket-тесты Lobby.gg: играют как настоящие клиенты против запущенного сервера.

Запуск всего набора с временным сервером: bash tests/run_smoke.sh
Против другого адреса: LOBBY_BASE=http://host:port LOBBY_WS=ws://host:port/ws python tests/ws_smoke.py
"""
import asyncio, json, os, sys, urllib.request, random

import websockets

BASE = os.environ.get("LOBBY_BASE", "http://127.0.0.1:18090")
WS = os.environ.get("LOBBY_WS", "ws://127.0.0.1:18090/ws")
results = []


def register(name):
    req = urllib.request.Request(BASE + "/auth/register", data=json.dumps({"username": name, "password": "test123456"}).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as r:
        cookie = r.headers.get("set-cookie", "")
    return cookie.split(";")[0]  # jsession=...


def check(name, ok, info=""):
    results.append((name, bool(ok)))
    print(("✅" if ok else "❌"), name, info)


async def recv_until(ws, pred, timeout=8):
    end = asyncio.get_event_loop().time() + timeout
    last = None
    while True:
        left = end - asyncio.get_event_loop().time()
        if left <= 0:
            return None, last
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), left))
        except asyncio.TimeoutError:
            return None, last
        last = m
        if pred(m):
            return m, last


async def test_c4_3d(cookie):
    async with websockets.connect(WS, additional_headers={"Cookie": cookie}) as ws:
        await ws.send(json.dumps({"action": "create", "name": "A", "game": "c4_3d"}))
        j, _ = await recv_until(ws, lambda m: m.get("type") == "joined")
        me = j["pid"]
        await ws.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await ws.send(json.dumps({"action": "c4_3d_start"}))
        st, last = await recv_until(ws, lambda m: m.get("type") == "c4_3d_state" and m.get("started"))
        check("3D «4 в ряд»: старт с ботом", st is not None, f"(последнее: {last and last.get('type')})")
        if not st:
            return
        await ws.send(json.dumps({"action": "c4_3d_drop", "x": 2, "y": 2}))
        # после моего хода бот должен сходить и ход вернуться ко мне: в сетке 2 фишки, turn_pid == me
        st2, last = await recv_until(ws, lambda m: m.get("type") == "c4_3d_state"
                                     and sum(len(c) for row in m["grid"] for c in row) >= 2 and m.get("turn_pid") == me)
        check("3D «4 в ряд»: мой ход + ответ бота, соединение живо", st2 is not None,
              f"(последнее: {last and (last.get('type'), last.get('turn_pid'))})")


async def test_uno_two_bots(cookie):
    async with websockets.connect(WS, additional_headers={"Cookie": cookie}) as ws:
        await ws.send(json.dumps({"action": "create", "name": "A", "game": "uno"}))
        j, _ = await recv_until(ws, lambda m: m.get("type") == "joined")
        me = j["pid"]
        await ws.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await ws.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await recv_until(ws, lambda m: m.get("type") == "lobby" and len(m.get("players", [])) == 3)
        await ws.send(json.dumps({"action": "start"}))
        first, _ = await recv_until(ws, lambda m: m.get("type") == "uno_state")
        if not first:
            check("UNO с 2 ботами: игра стартовала", False); return
        order = first["order"]
        bots = [p for p in order if p != me]
        # пропускаем свои ходы, пока ОБА бота не сходят хотя бы раз (берём/кладём карту)
        seen_turns = []; m = first; last_acted = None
        loop = asyncio.get_event_loop(); end = loop.time() + 40
        while m and loop.time() < end:
            if not seen_turns or seen_turns[-1] != m["turn_pid"]:
                seen_turns.append(m["turn_pid"])
            if m.get("winner") or {p for p in seen_turns if p in bots} == set(bots) and seen_turns.count(me) >= 2:
                break
            if m["turn_pid"] == me:
                if not globals().get("_garbage_sent"):
                    globals()["_garbage_sent"] = True
                    await ws.send(json.dumps({"action": "uno_play", "cards": "мусор"}))  # бросает исключение в обработчике
                    await ws.send(json.dumps({"type": "ping"}))
                    pong, _ = await recv_until(ws, lambda x: x.get("type") == "pong", timeout=5)
                    check("Исключение в обработчике хода не рвёт соединение", pong is not None)
                # мой ход: тянем карту; если ход остался за мной — пас
                await ws.send(json.dumps({"action": "uno_draw" if last_acted != "draw" else "uno_pass"}))
                last_acted = "draw" if last_acted != "draw" else "pass"
            else:
                last_acted = None
            m, _ = await recv_until(ws, lambda x: x.get("type") == "uno_state", timeout=8)
        moved = {p for p in seen_turns if p in bots}
        check("UNO с 2 ботами: очередь доходит до обоих ботов и игра не висит",
              len(moved) == 2 or (seen_turns and seen_turns.count(me) >= 2),
              f"(очередь: {[('я' if t == me else 'бот' + str(bots.index(t) + 1)) for t in seen_turns][:10]})")


async def test_error_isolation(cookie):
    async with websockets.connect(WS, additional_headers={"Cookie": cookie}) as ws:
        await ws.send(json.dumps({"action": "create", "name": "A", "game": "c4_3d"}))
        await recv_until(ws, lambda m: m.get("type") == "joined")
        await ws.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await ws.send(json.dumps({"action": "c4_3d_start"}))
        await recv_until(ws, lambda m: m.get("type") == "c4_3d_state" and m.get("started"))
        # мусорный ход, который раньше ронял цикл: координаты-строки неожиданного вида
        await ws.send(json.dumps({"action": "c4_3d_drop", "x": {"a": 1}, "y": [1]}))
        await ws.send(json.dumps({"action": "uno_play", "cards": "мусор"}))
        await ws.send(json.dumps({"action": "kick", "pid": {"x": 1}}))
        await ws.send(json.dumps({"type": "ping"}))
        pong, _ = await recv_until(ws, lambda m: m.get("type") == "pong", timeout=5)
        check("Ошибка в ходе не рвёт соединение (ping→pong после мусора)", pong is not None)


async def test_reconnect_vs_bot(cookie):
    ws = await websockets.connect(WS, additional_headers={"Cookie": cookie})
    await ws.send(json.dumps({"action": "create", "name": "A", "game": "chess"}))
    j, _ = await recv_until(ws, lambda m: m.get("type") == "joined")
    code = j["code"]
    await ws.send(json.dumps({"action": "add_bot", "diff": "easy"}))
    await asyncio.sleep(1.5)
    await ws.close()          # «обновил страницу»
    await asyncio.sleep(2)
    async with websockets.connect(WS, additional_headers={"Cookie": cookie}) as ws2:
        await ws2.send(json.dumps({"action": "join", "name": "A", "code": code}))
        m, last = await recv_until(ws2, lambda m: m.get("type") in ("joined", "error"))
        check("Игра против бота: вернулся после обрыва — комната на месте",
              m is not None and m.get("type") == "joined", f"(ответ: {m})")


async def test_variants(cookie):
    async with websockets.connect(WS, additional_headers={"Cookie": cookie}) as ws:
        await ws.send(json.dumps({"action": "create", "name": "A", "game": "variants"}))
        await recv_until(ws, lambda m: m.get("type") == "joined")
        await ws.send(json.dumps({"action": "add_bot", "diff": "easy"}))       # бот не должен вешать раунд
        await ws.send(json.dumps({"action": "variants_set_cats", "categories": ["Классика"], "total_rounds": 2}))
        await ws.send(json.dumps({"action": "variants_next"}))                 # кнопка «Начать» в лобби
        st, last = await recv_until(ws, lambda m: m.get("type") == "variants_state" and m.get("phase") == "input", timeout=20)
        check("Варианты: старт из лобби → раунд 1, фаза ввода", st is not None and st.get("round", 1) == 1,
              f"(последнее: {last and {k: last.get(k) for k in ('type', 'phase', 'round', 'msg')}})")
        if not st: return
        await ws.send(json.dumps({"action": "variants_submit", "bluff": "ложный ответ"}))
        st, last = await recv_until(ws, lambda m: m.get("type") == "variants_state" and m.get("phase") == "voting", timeout=8)
        check("Варианты: после моего ответа — голосование (бот не держит раунд)", st is not None,
              f"(последнее: {last and last.get('phase')})")
        if not st: return
        ans = next(a for a in st.get("answers", st.get("shuffled_answers", [])) if a.get("author") not in ("me",))
        await ws.send(json.dumps({"action": "variants_vote", "vote_id": ans["id"]}))
        st, last = await recv_until(ws, lambda m: m.get("type") == "variants_state" and m.get("phase") == "results", timeout=8)
        check("Варианты: голос → результаты раунда", st is not None, f"(последнее: {last and last.get('phase')})")


def test_learn_forged_cookie(cookie):
    def me_as(c):
        req = urllib.request.Request(BASE + "/learn/api/courses", headers={"Cookie": c})
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    real = me_as(cookie).get("username")
    forged = me_as("jsession=victim_user|root|9999999999|fakesignature").get("username")
    check("Обучение: поддельная cookie не даёт войти чужим именем", forged == "guest" and real not in (None, "guest"),
          f"(настоящая → {real}, поддельная → {forged})")


async def test_room_chat(c1, c2):
    a = await websockets.connect(WS, additional_headers={"Cookie": c1})
    await a.send(json.dumps({"action": "create", "name": "Аня", "game": "durak"}))
    j, _ = await recv_until(a, lambda m: m.get("type") == "joined")
    code = j["code"]
    async with websockets.connect(WS, additional_headers={"Cookie": c2}) as b:
        await b.send(json.dumps({"action": "join", "name": "Боря", "code": code}))
        await recv_until(b, lambda m: m.get("type") == "joined")
        await a.send(json.dumps({"action": "room_chat", "text": "привет <script>alert(1)</script> <3"}))
        m, last = await recv_until(b, lambda m: m.get("type") == "room_chat", timeout=5)
        check("Чат комнаты: сообщение дошло до второго игрока", m is not None, f"(последнее: {last and last.get('type')})")
        if m:
            t = m.get("text") or m.get("message", {}).get("text", "")
            check("Чат комнаты: HTML экранирован (<script> не пройдёт как разметка)", "<script>" not in t and "&lt;script&gt;" in t, f"(текст: {t[:60]})")
        await a.send(json.dumps({"action": "room_chat", "text": "флуд"}))   # сразу второе — в пределах 1 с
        r, _ = await recv_until(a, lambda m: m.get("type") == "room_chat_error", timeout=3)
        check("Чат комнаты: лимит 1 сообщение/сек", r is not None)
        async with websockets.connect(WS, additional_headers={"Cookie": c2}) as b2:   # Боря открыл вторую вкладку
            await b2.send(json.dumps({"action": "join", "name": "Боря2", "code": code}))
            h, last = await recv_until(b2, lambda m: m.get("type") == "room_chat_history", timeout=5)
            check("Чат комнаты: история приходит новому участнику", h is not None and len(h.get("messages", [])) >= 1,
                  f"(последнее: {last and last.get('type')})")
    await a.close()



async def test_global_chat(c1, c2):
    url = WS.replace("/ws", "/ws/chat")
    async with websockets.connect(url, additional_headers={"Cookie": c1}) as a, \
               websockets.connect(url, additional_headers={"Cookie": c2}) as b:
        init, _ = await recv_until(b, lambda m: m.get("type") == "chat_init", timeout=5)
        check("Общий чат по WebSocket: история при подключении", init is not None)
        txt = f"тест общего чата {random.randint(1000, 9999)}"
        await a.send(json.dumps({"action": "send", "text": txt}))
        m, last = await recv_until(b, lambda m: m.get("type") == "chat_msg", timeout=5)
        got = m and ((m.get("message") or {}).get("t") or (m.get("message") or {}).get("text"))
        check("Общий чат по WebSocket: мгновенная доставка другому", got == txt, f"(получено: {got})")
    req = urllib.request.Request(BASE + "/chat", headers={"Cookie": c1})
    with urllib.request.urlopen(req) as r:
        msgs = json.loads(r.read()).get("messages", [])
    check("Общий чат: сообщение сохранено (виден через старый GET /chat)", any((x.get("t") or x.get("text")) == txt for x in msgs))


async def main():
    u = [register(f"t{random.randint(10000, 99999)}{i}") for i in range(2)]
    c = [u[0]] * 5
    await test_c4_3d(c[0])
    await test_uno_two_bots(c[1])
    await test_error_isolation(c[2])
    await test_reconnect_vs_bot(c[3])
    await test_variants(c[4])
    test_learn_forged_cookie(c[4])
    await test_room_chat(u[0], u[1])
    await test_global_chat(u[0], u[1])
    print(f"\nИтого: {sum(ok for _, ok in results)}/{len(results)}")
    sys.exit(0 if all(ok for _, ok in results) else 1)

asyncio.run(main())
