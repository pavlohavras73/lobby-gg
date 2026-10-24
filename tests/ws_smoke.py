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


async def _drain_latest(ws, msg_type, duration=0.35):
    """Читает все пришедшие сообщения за duration сек, возвращая последнее нужного типа и счётчик."""
    end = asyncio.get_event_loop().time() + duration
    latest = None
    cnt = 0
    while True:
        left = end - asyncio.get_event_loop().time()
        if left <= 0:
            break
        try:
            m = json.loads(await asyncio.wait_for(ws.recv(), left))
            if m.get("type") == msg_type:
                latest = m
                cnt += 1
        except asyncio.TimeoutError:
            break
    return latest, cnt


async def test_concurrency_durak_and_uno(c1, c2):
    # 1. Дурак: 2 человека + 2 бота одновременно и повторно шлют ходы (атака/защита/бито/беру)
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as a, \
               websockets.connect(WS, additional_headers={"Cookie": c2}) as b:
        await a.send(json.dumps({"action": "create", "name": "Игрок1", "game": "durak"}))
        ja, _ = await recv_until(a, lambda m: m.get("type") == "joined")
        code = ja["code"]
        await b.send(json.dumps({"action": "join", "name": "Игрок2", "code": code}))
        await recv_until(b, lambda m: m.get("type") == "joined")
        await a.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await a.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await a.send(json.dumps({"action": "start"}))
        sa, _ = await recv_until(a, lambda m: m.get("type") == "durak_state")
        sb, _ = await recv_until(b, lambda m: m.get("type") == "durak_state")
        states_seen = 2 if (sa and sb) else 0

        async def spam_durak(ws, st):
            if not st:
                return
            hand = st.get("hand") or []
            card = hand[0] if hand else {"r": 6, "s": 0}
            # Шлём пачку дублирующихся и конкурирующих действий подряд без ожидания
            await ws.send(json.dumps({"action": "dk_attack", "card": card}))
            await ws.send(json.dumps({"action": "dk_attack", "card": card}))
            await ws.send(json.dumps({"action": "dk_defend", "idx": 0, "card": card}))
            await ws.send(json.dumps({"action": "dk_done"}))
            if st.get("defender") == st.get("you") and st.get("table"):
                await ws.send(json.dumps({"action": "dk_take"}))
                await ws.send(json.dumps({"action": "dk_take"}))

        for _ in range(5):
            await asyncio.gather(spam_durak(a, sa), spam_durak(b, sb))
            (la, ca), (lb, cb) = await asyncio.gather(
                _drain_latest(a, "durak_state", 0.45),
                _drain_latest(b, "durak_state", 0.45),
            )
            if la:
                sa = la
            if lb:
                sb = lb
            states_seen += ca + cb

        # Проверяем целостность колоды/рук (в 36-карточной колоде сумма карт на руках/столе/в колоде <= 36) и живость сокетов
        table_cards = sum((1 + (1 if pr.get("d") else 0)) for pr in (sa or {}).get("table", []))
        total_cards = (sa or {}).get("deck", 0) + sum((sa or {}).get("counts", {}).values()) + table_cards
        await a.send(json.dumps({"type": "ping"}))
        await b.send(json.dumps({"type": "ping"}))
        pa, _ = await recv_until(a, lambda m: m.get("type") == "pong", timeout=5)
        pb, _ = await recv_until(b, lambda m: m.get("type") == "pong", timeout=5)
        check("Конкуренция в Дураке (2 игрока + 2 бота): игра идёт, состояние целостно",
              pa is not None and pb is not None and states_seen >= 4 and 12 <= total_cards <= 36,
              f"(состояний: {states_seen}, карт в игре: {total_cards})")

    # 2. UNO: 2 человека + 2 бота одновременно шлют повторные uno_play / uno_draw / uno_pass
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as a, \
               websockets.connect(WS, additional_headers={"Cookie": c2}) as b:
        await a.send(json.dumps({"action": "create", "name": "Игрок1", "game": "uno"}))
        ja, _ = await recv_until(a, lambda m: m.get("type") == "joined")
        code = ja["code"]
        await b.send(json.dumps({"action": "join", "name": "Игрок2", "code": code}))
        await recv_until(b, lambda m: m.get("type") == "joined")
        await a.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await a.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        await a.send(json.dumps({"action": "start"}))
        sa, _ = await recv_until(a, lambda m: m.get("type") == "uno_state")
        sb, _ = await recv_until(b, lambda m: m.get("type") == "uno_state")
        turns_seen = [sa.get("turn_pid")] if sa else []

        async def spam_uno(ws, st):
            if not st:
                return
            hand = st.get("hand") or []
            if hand:
                c0 = hand[0]
                await ws.send(json.dumps({"action": "uno_play", "cards": [c0], "color": 0}))
                await ws.send(json.dumps({"action": "uno_play", "cards": [c0], "color": 0}))
            await ws.send(json.dumps({"action": "uno_draw"}))
            await ws.send(json.dumps({"action": "uno_draw"}))
            await ws.send(json.dumps({"action": "uno_pass"}))
            await ws.send(json.dumps({"action": "uno_pass"}))

        for _ in range(5):
            await asyncio.gather(spam_uno(a, sa), spam_uno(b, sb))
            (la, _), (lb, _) = await asyncio.gather(
                _drain_latest(a, "uno_state", 0.55),
                _drain_latest(b, "uno_state", 0.55),
            )
            if la:
                sa = la
                if not turns_seen or turns_seen[-1] != sa.get("turn_pid"):
                    turns_seen.append(sa.get("turn_pid"))
            if lb:
                sb = lb

        await a.send(json.dumps({"type": "ping"}))
        await b.send(json.dumps({"type": "ping"}))
        pa, _ = await recv_until(a, lambda m: m.get("type") == "pong", timeout=5)
        pb, _ = await recv_until(b, lambda m: m.get("type") == "pong", timeout=5)
        check("Конкуренция в UNO (2 игрока + 2 бота): одновременные ходы не ломают очередь",
              pa is not None and pb is not None and len(turns_seen) >= 2,
              f"(смен хода: {len(turns_seen)})")


async def test_quickplay(c1, c2):
    # 1. Один аккаунт дважды (в одном сокете и с двух вкладок) — не играет сам с собой и не дублируется в очереди
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as a1, \
               websockets.connect(WS, additional_headers={"Cookie": c1}) as a2:
        await a1.send(json.dumps({"action": "quick_play", "game": "chess", "name": "Клон1"}))
        q1, _ = await recv_until(a1, lambda m: m.get("type") in ("queue", "joined"), timeout=5)
        await a1.send(json.dumps({"action": "quick_play", "game": "chess", "name": "Клон1"}))
        q1_dup, _ = await recv_until(a1, lambda m: m.get("type") in ("queue", "joined"), timeout=5)
        await a2.send(json.dumps({"action": "quick_play", "game": "chess", "name": "Клон2"}))
        q2, _ = await recv_until(a2, lambda m: m.get("type") in ("queue", "joined"), timeout=5)
        ok_self = (
            q1 is not None and q1.get("type") == "queue" and q1.get("status") == "waiting" and q1.get("position") == 1
            and q1_dup is not None and q1_dup.get("type") == "queue" and q1_dup.get("status") == "waiting" and q1_dup.get("position") == 1
            and q2 is not None and q2.get("type") == "queue" and q2.get("status") == "waiting" and q2.get("position") == 1
        )
        check("Быстрая игра: один аккаунт дважды не играет сам с собой и не стоит в очереди дважды",
              ok_self, f"(ответы: {q1}, {q1_dup}, {q2})")

        # 2. Отмена очереди (quick_cancel)
        await a2.send(json.dumps({"action": "quick_cancel"}))
        canc, _ = await recv_until(a2, lambda m: m.get("type") == "queue" and m.get("status") == "cancelled", timeout=5)
        check("Быстрая игра: отмена очереди (quick_cancel → cancelled)", canc is not None, f"(ответ: {canc})")

    # 2б. Обрыв сокета убирает из очереди (второй аккаунт не матчится с оборванным)
    ws_drop = await websockets.connect(WS, additional_headers={"Cookie": c1})
    await ws_drop.send(json.dumps({"action": "quick_play", "game": "c4", "name": "Ушедший"}))
    await recv_until(ws_drop, lambda m: m.get("type") == "queue" and m.get("status") == "waiting", timeout=5)
    await ws_drop.close()
    await asyncio.sleep(0.15)
    async with websockets.connect(WS, additional_headers={"Cookie": c2}) as b_after:
        await b_after.send(json.dumps({"action": "quick_play", "game": "c4", "name": "Живой"}))
        wb, _ = await recv_until(b_after, lambda m: m.get("type") in ("queue", "joined"), timeout=5)
        check("Быстрая игра: обрыв сокета убирает игрока из очереди",
              wb is not None and wb.get("type") == "queue" and wb.get("status") == "waiting" and wb.get("position") == 1,
              f"(ответ: {wb})")
        await b_after.send(json.dumps({"action": "quick_cancel"}))

    # 3. Два разных аккаунта жмут «Быструю игру» в шахматы → оба получают joined в одну комнату и chess_state
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as a, \
               websockets.connect(WS, additional_headers={"Cookie": c2}) as b:
        await a.send(json.dumps({"action": "quick_play", "game": "chess", "name": "Магнус"}))
        wa, _ = await recv_until(a, lambda m: m.get("type") == "queue" and m.get("status") == "waiting", timeout=5)
        await b.send(json.dumps({"action": "quick_play", "game": "chess", "name": "Хикару"}))
        ja, _ = await recv_until(a, lambda m: m.get("type") == "joined", timeout=5)
        jb, _ = await recv_until(b, lambda m: m.get("type") == "joined", timeout=5)
        sa, _ = await recv_until(a, lambda m: m.get("type") == "chess_state", timeout=5)
        sb, _ = await recv_until(b, lambda m: m.get("type") == "chess_state", timeout=5)
        same_room = bool(
            wa and ja and jb and sa and sb
            and ja.get("code") == jb.get("code")
            and ja.get("pid") != jb.get("pid")
            and set(sa.get("order", [])) == {ja["pid"], jb["pid"]}
        )
        check("Быстрая игра (шахматы): 2 аккаунта → joined в одну комнату и стартовое состояние партии",
              same_room, f"(код: {ja and ja.get('code')}, игроки: {sa and sa.get('names')})")
        if same_room:
            # Проверим, что первый игрок (ждавший в очереди) реально привязан к комнате и может сделать ход e2-e4
            await a.send(json.dumps({"action": "chess_move", "fr": 6, "fc": 4, "tr": 4, "tc": 4, "promo": "Q"}))
            sb2, _ = await recv_until(b, lambda m: m.get("type") == "chess_state" and m.get("turn_pid") == jb["pid"], timeout=5)
            check("Быстрая игра (шахматы): ход первого игрока в созданной комнате доходит до второго",
                  sb2 is not None, f"(ход перешёл к: {sb2 and sb2.get('turn_pid')})")

    # 4. Тайм-аут очереди (QUICKPLAY_TIMEOUT)
    qp_wait = float(os.environ.get("QUICKPLAY_TIMEOUT", "30")) + 4.0
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as a:
        await a.send(json.dumps({"action": "quick_play", "game": "reversi", "name": "Ждун"}))
        w, _ = await recv_until(a, lambda m: m.get("type") == "queue" and m.get("status") == "waiting", timeout=5)
        tm, last = await recv_until(a, lambda m: m.get("type") == "queue" and m.get("status") == "timeout", timeout=qp_wait)
        check("Быстрая игра: тайм-аут при отсутствии соперника (status=timeout)",
              w is not None and tm is not None, f"(ответ: {tm or last})")


def check_server_log():
    log_path = os.environ.get("LOBBY_SERVER_LOG")
    if not log_path or not os.path.exists(log_path):
        return
    with open(log_path, encoding="utf-8", errors="replace") as f:
        lines = f.readlines()
    action_errs = [l.strip() for l in lines if "ws action" in l and "failed" in l]
    unexpected = [l for l in action_errs if "ws action 'uno_play' failed" not in l]
    crashes = [l.strip() for l in lines if "ws loop crashed" in l or "bot loop failed" in l]
    check("Лог сервера: нет неожиданных исключений ws action ... failed",
          len(unexpected) == 0 and len(action_errs) <= 1 and len(crashes) == 0,
          f"(uno_play ожидаемых: {len(action_errs)}, неожиданных: {len(unexpected)}, крашей: {len(crashes)})")


async def test_lobby_grace(c1, c2):
    """Обрыв связи в лобби: место держится, вернулся — на прежнее место; хозяин остаётся хозяином."""
    grace = float(os.environ.get("LOBBY_RECONNECT_GRACE", "60"))
    a = await websockets.connect(WS, additional_headers={"Cookie": c1})
    await a.send(json.dumps({"action": "create", "name": "Хозяин", "game": "durak"}))
    ja, _ = await recv_until(a, lambda m: m.get("type") == "joined")
    code = ja["code"]
    b = await websockets.connect(WS, additional_headers={"Cookie": c2})
    await b.send(json.dumps({"action": "join", "name": "Гость", "code": code}))
    jb, _ = await recv_until(b, lambda m: m.get("type") == "joined")
    await b.close()                                          # у гостя моргнул интернет
    lob, _ = await recv_until(a, lambda m: m.get("type") == "lobby" and any(p["id"] == jb["pid"] and not p.get("online") for p in m["players"]), timeout=5)
    check("Лобби: гость отвалился — остаётся в списке «не в сети»", lob is not None)
    b2 = await websockets.connect(WS, additional_headers={"Cookie": c2})
    await b2.send(json.dumps({"action": "join", "name": "Гость", "code": code}))
    jb2, last = await recv_until(b2, lambda m: m.get("type") in ("joined", "error"))
    check("Лобби: гость вернулся на прежнее место", jb2 and jb2.get("type") == "joined" and jb2["pid"] == jb["pid"],
          f"(было {jb['pid']}, стало {jb2 and jb2.get('pid')})")
    await a.close()                                          # теперь моргнул хозяин
    await asyncio.sleep(0.5)
    a2 = await websockets.connect(WS, additional_headers={"Cookie": c1})
    await a2.send(json.dumps({"action": "join", "name": "Хозяин", "code": code}))
    ja2, _ = await recv_until(a2, lambda m: m.get("type") == "joined")
    lob2, _ = await recv_until(a2, lambda m: m.get("type") == "lobby", timeout=5)
    check("Лобби: хозяин вернулся — по-прежнему хозяин", ja2 and ja2["pid"] == ja["pid"] and lob2 and lob2.get("host") == ja["pid"],
          f"(host={lob2 and lob2.get('host')}, хозяин={ja['pid']})")
    if grace <= 10:                                          # быстрый режим тестов: проверяем освобождение места
        await b2.close()
        gone, _ = await recv_until(a2, lambda m: m.get("type") == "lobby" and all(p["id"] != jb["pid"] for p in m["players"]), timeout=grace + 5)
        check(f"Лобби: не вернулся за {grace:.0f} с — место освобождено", gone is not None)
    else:
        await b2.close()
    await a2.close()


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
    await test_lobby_grace(u[0], u[1])
    await test_concurrency_durak_and_uno(u[0], u[1])
    await test_quickplay(u[0], u[1])
    check_server_log()
    print(f"\nИтого: {sum(ok for _, ok in results)}/{len(results)}")
    sys.exit(0 if all(ok for _, ok in results) else 1)

asyncio.run(main())
