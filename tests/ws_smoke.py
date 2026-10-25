"""Сквозные WebSocket-тесты Lobby.gg: играют как настоящие клиенты против запущенного сервера.

Запуск всего набора с временным сервером: bash tests/run_smoke.sh
Против другого адреса: LOBBY_BASE=http://host:port LOBBY_WS=ws://host:port/ws python tests/ws_smoke.py
"""
import asyncio, json, os, sys, urllib.request, urllib.error, random

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


def test_password_change_revokes_sessions():
    """Смена пароля выкидывает все старые сессии аккаунта, а это устройство остаётся в аккаунте."""
    name = f"p{random.randint(10000, 99999)}"
    def call(path, body=None, cookie=None):
        req = urllib.request.Request(BASE + path, data=json.dumps(body).encode() if body is not None else None,
                                     headers={"Content-Type": "application/json", **({"Cookie": cookie} if cookie else {})})
        try:
            with urllib.request.urlopen(req) as r:
                return r.status, r.headers.get("set-cookie", "").split(";")[0], json.loads(r.read() or b"{}")
        except urllib.error.HTTPError as e:
            return e.code, "", {}
    _, dev1, _ = call("/auth/register", {"username": name, "password": "old-pass-1"})
    _, dev2, _ = call("/auth/login", {"username": name, "password": "old-pass-1"})
    before = call("/auth/check", cookie=dev2)[0]
    st, dev1_new, res = call("/me/password", {"old": "old-pass-1", "new": "new-pass-2"}, cookie=dev1)
    after_dev2 = call("/auth/check", cookie=dev2)[0]
    after_dev1_old = call("/auth/check", cookie=dev1)[0]
    after_dev1_new = call("/auth/check", cookie=dev1_new)[0] if dev1_new else None
    relogin = call("/auth/login", {"username": name, "password": "new-pass-2"})[0]
    check("Пароль: до смены второе устройство в аккаунте", before == 200, f"({before})")
    check("Пароль: смена прошла и выдала новую cookie этому устройству", st == 200 and res.get("ok") and dev1_new, f"({st}, {res})")
    check("Пароль: второе устройство выкинуто (старая cookie недействительна)", after_dev2 == 401, f"({after_dev2})")
    check("Пароль: старая cookie этого же устройства тоже недействительна", after_dev1_old == 401, f"({after_dev1_old})")
    check("Пароль: новая cookie работает, вход с новым паролем работает", after_dev1_new == 200 and relogin == 200,
          f"({after_dev1_new}, {relogin})")


def _http_get(path, cookie=None):
    headers = {"Cookie": cookie} if cookie else {}
    req = urllib.request.Request(BASE + path, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            raw = r.read().decode("utf-8", errors="replace")
            ctype = r.headers.get("content-type", "")
            data = json.loads(raw) if "application/json" in ctype else raw
            return r.status, data
    except urllib.error.HTTPError as e:
        return e.code, None


async def test_elo_and_leaderboard(c1, c2):
    """ELO для дуэлей, защита от двойного подсчёта, игнор ботов/само-игры, /leaderboard и /me/ratings."""
    # 1. GET /me/ratings без входа -> 401; со входом -> старт 1000 по всем 8 дуэлям; страница /leaderboard отдаёт HTML
    st_unauth, _ = _http_get("/me/ratings")
    st_me0, me0 = _http_get("/me/ratings", cookie=c1)
    st_me0_2, me0_2 = _http_get("/me/ratings", cookie=c2)
    u1_name = (me0 or {}).get("username", "")
    u2_name = (me0_2 or {}).get("username", "")
    st_page, html_page = _http_get("/leaderboard")
    check("Рейтинги: GET /me/ratings требует вход (401 без cookie, 200 со стартовыми 1000)",
          st_unauth == 401 and st_me0 == 200 and st_me0_2 == 200 and isinstance(me0, dict)
          and bool(u1_name) and bool(u2_name) and u1_name != u2_name
          and me0.get("ratings", {}).get("c4", {}).get("elo") == 1000.0
          and len(me0.get("ratings", {})) == 8,
          f"(unauth={st_unauth}, auth={st_me0}, users={u1_name}/{u2_name})")
    check("Страница /leaderboard отдаёт HTML с языками УКР/РУС/ENG/DEU",
          st_page == 200 and isinstance(html_page, str) and 'id="langbar"' in html_page and 'data-lang="de">DEU<' in html_page)

    # До первой партии новые игроки не отображаются в /leaderboard?game=c4 (только games >= 1)
    _, lb0 = _http_get("/leaderboard?game=c4")
    lb0_users = {x["username"] for x in (lb0 or {}).get("leaderboard", [])}
    check("Лидерборд: игроки с 0 партий не попадают в /leaderboard?game=c4",
          u1_name not in lb0_users and u2_name not in lb0_users)

    # 2. Короткая партия в «4 в ряд» (c4) между двумя аккаунтами до победы первого
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as a, \
               websockets.connect(WS, additional_headers={"Cookie": c2}) as b:
        await a.send(json.dumps({"action": "create", "name": "Победитель", "game": "c4"}))
        ja, _ = await recv_until(a, lambda m: m.get("type") == "joined")
        code = ja["code"]
        pid1 = ja["pid"]
        await b.send(json.dumps({"action": "join", "name": "Проигравший", "code": code}))
        jb, _ = await recv_until(b, lambda m: m.get("type") == "joined")
        pid2 = jb["pid"]
        sa, _ = await recv_until(a, lambda m: m.get("type") == "c4_state")
        await recv_until(b, lambda m: m.get("type") == "c4_state")

        # 4 вертикальные фишки pid1 в колонке 0, pid2 кладёт 3 фишки в колонку 1
        for step in range(4):
            await a.send(json.dumps({"action": "c4_drop", "col": 0}))
            sa, _ = await recv_until(a, lambda m: m.get("type") == "c4_state" and (m.get("winner") or m.get("turn_pid") == pid2))
            await recv_until(b, lambda m: m.get("type") == "c4_state" and (m.get("winner") or m.get("turn_pid") == pid2))
            if step < 3:
                await b.send(json.dumps({"action": "c4_drop", "col": 1}))
                sa, _ = await recv_until(a, lambda m: m.get("type") == "c4_state" and m.get("turn_pid") == pid1)
                await recv_until(b, lambda m: m.get("type") == "c4_state" and m.get("turn_pid") == pid1)

        check("ELO (c4): партия завершена победой первого игрока",
              sa is not None and sa.get("winner") == pid1, f"(winner={sa and sa.get('winner')})")

        _, lb1 = _http_get("/leaderboard?game=c4")
        rows1 = {x["username"]: x for x in (lb1 or {}).get("leaderboard", [])}
        w_row = rows1.get(u1_name)
        l_row = rows1.get(u2_name)
        check("ELO (c4): /leaderboard?game=c4 показывает победителя >1000 и проигравшего <1000",
              bool(w_row and l_row and w_row["elo"] > 1000 and l_row["elo"] < 1000
                   and w_row["rank"] < l_row["rank"]
                   and w_row["wins"] == 1 and l_row["losses"] == 1),
              f"(winner={w_row and w_row['elo']}, loser={l_row and l_row['elo']})")

        # 3. Повторные сообщения в конце партии, переподключение (resync) и «Ещё раз» (restart) не считают партию дважды
        await a.send(json.dumps({"action": "c4_drop", "col": 0}))
        await b.send(json.dumps({"action": "c4_drop", "col": 1}))
        # Реконнект второго игрока при открытом экране конца партии (вызывает resync_game -> push_c4)
        async with websockets.connect(WS, additional_headers={"Cookie": c2}) as b_resync:
            await b_resync.send(json.dumps({"action": "join", "name": "Проигравший", "code": code}))
            await recv_until(b_resync, lambda m: m.get("type") == "joined", timeout=3)
        # Оба жмут «Ещё раз» подряд
        await a.send(json.dumps({"action": "restart"}))
        await b.send(json.dumps({"action": "restart"}))
        sa_re, _ = await recv_until(a, lambda m: m.get("type") == "c4_state" and m.get("winner") is None)
        _, lb_after_re = _http_get("/leaderboard?game=c4")
        rows_re = {x["username"]: x for x in (lb_after_re or {}).get("leaderboard", [])}
        w_re = rows_re.get(u1_name)
        l_re = rows_re.get(u2_name)
        check("ELO (c4): повторные ходы, resync и «Ещё раз» не считают партию дважды",
              bool(sa_re and w_re and l_re
                   and w_re["elo"] == w_row["elo"] and w_re["games"] == 1
                   and l_re["elo"] == l_row["elo"] and l_re["games"] == 1),
              f"(после restart: games={w_re and w_re['games']}, elo={w_re and w_re['elo']})")

    # 4. Партия против бота (до конца партии!) НЕ меняет рейтинг
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as ws_bot:
        await ws_bot.send(json.dumps({"action": "create", "name": "Соло", "game": "c4"}))
        jb_room, _ = await recv_until(ws_bot, lambda m: m.get("type") == "joined")
        me_pid = jb_room["pid"]
        await ws_bot.send(json.dumps({"action": "add_bot", "diff": "easy"}))
        st_b, _ = await recv_until(ws_bot, lambda m: m.get("type") == "c4_state")
        # Играем до конца партии с easy-ботом: выбираем колонку, где сверху нет фишки бота
        loop = asyncio.get_event_loop()
        deadline = loop.time() + 15
        while st_b and not st_b.get("winner") and not st_b.get("draw") and loop.time() < deadline:
            if st_b.get("turn_pid") == me_pid:
                brd = st_b["board"]
                # ищем колонку, где все уже лежащие фишки — наши (1), иначе любую свободную
                best_col = next(
                    (col for col in range(7) if brd[0][col] == 0 and all(brd[r][col] in (0, 1) for r in range(6))),
                    next((col for col in range(7) if brd[0][col] == 0), 0),
                )
                await ws_bot.send(json.dumps({"action": "c4_drop", "col": best_col}))
            st_b, _ = await recv_until(ws_bot, lambda m: m.get("type") == "c4_state", timeout=4)
        bot_finished = bool(st_b and (st_b.get("winner") or st_b.get("draw")))
        _, me_after_bot = _http_get("/me/ratings", cookie=c1)
        c4_after_bot = (me_after_bot or {}).get("ratings", {}).get("c4", {})
        check("ELO (c4): завершённая партия против бота НЕ меняет рейтинг",
              bot_finished and c4_after_bot.get("elo") == w_row["elo"] and c4_after_bot.get("games") == 1,
              f"(finished={bot_finished}, elo={c4_after_bot.get('elo')}, games={c4_after_bot.get('games')})")

    # 5. Игра одного и того же аккаунта с двух вкладок против себя НЕ меняет рейтинг
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as s1, \
               websockets.connect(WS, additional_headers={"Cookie": c1}) as s2:
        await s1.send(json.dumps({"action": "create", "name": "Я1", "game": "bulls"}))
        js1, _ = await recv_until(s1, lambda m: m.get("type") == "joined")
        await s2.send(json.dumps({"action": "join", "name": "Я2", "code": js1["code"]}))
        await recv_until(s2, lambda m: m.get("type") == "joined")
        await recv_until(s1, lambda m: m.get("type") == "bc_state")
        await s1.send(json.dumps({"action": "bc_set", "code": "1234"}))
        await s2.send(json.dumps({"action": "bc_set", "code": "5678"}))
        await recv_until(s1, lambda m: m.get("type") == "bc_state" and m.get("phase") == "play")
        await s1.send(json.dumps({"action": "bc_guess", "guess": "5678"}))
        st_self, _ = await recv_until(s1, lambda m: m.get("type") == "bc_state" and m.get("winner") == js1["pid"])
        _, me_after_self = _http_get("/me/ratings", cookie=c1)
        bulls_r = (me_after_self or {}).get("ratings", {}).get("bulls", {})
        check("ELO: партия одного аккаунта сам с собой НЕ меняет рейтинг",
              st_self is not None and bulls_r.get("games") == 0 and bulls_r.get("elo") == 1000.0,
              f"(bulls={bulls_r})")

    # 6. Quoridor 1×1 (2 человека) также обновляет ELO
    async with websockets.connect(WS, additional_headers={"Cookie": c1}) as qa, \
               websockets.connect(WS, additional_headers={"Cookie": c2}) as qb:
        await qa.send(json.dumps({"action": "create", "name": "Юг", "game": "quoridor"}))
        jqa, _ = await recv_until(qa, lambda m: m.get("type") == "joined")
        await qb.send(json.dumps({"action": "join", "name": "Север", "code": jqa["code"]}))
        jqb, _ = await recv_until(qb, lambda m: m.get("type") == "joined")
        await qa.send(json.dumps({"action": "start"}))
        sq, _ = await recv_until(qa, lambda m: m.get("type") == "quoridor_state")
        await recv_until(qb, lambda m: m.get("type") == "quoridor_state")
        # P1 идёт с (8,4) на row 0, P2 уходит вбок на (0,3) и шагает туда-сюда (0,3)<->(0,2)
        p2_cols = [3, 2, 3, 2, 3, 2, 3, 2]
        for step, r_target in enumerate(range(7, -1, -1)):
            await qa.send(json.dumps({"action": "quoridor_move", "r": r_target, "c": 4}))
            sq, _ = await recv_until(qa, lambda m: m.get("type") == "quoridor_state" and (m.get("winner") or m.get("turn_pid") == jqb["pid"]))
            await recv_until(qb, lambda m: m.get("type") == "quoridor_state" and (m.get("winner") or m.get("turn_pid") == jqb["pid"]))
            if r_target > 0:
                await qb.send(json.dumps({"action": "quoridor_move", "r": 0, "c": p2_cols[step]}))
                sq, _ = await recv_until(qa, lambda m: m.get("type") == "quoridor_state" and m.get("turn_pid") == jqa["pid"])
                await recv_until(qb, lambda m: m.get("type") == "quoridor_state" and m.get("turn_pid") == jqa["pid"])
        _, lb_q = _http_get("/leaderboard?game=quoridor")
        q_rows = {x["username"]: x for x in (lb_q or {}).get("leaderboard", [])}
        check("ELO (quoridor 2 игрока): победа учитывается в /leaderboard?game=quoridor",
              bool(sq and sq.get("winner") == jqa["pid"]
                   and q_rows.get(u1_name, {}).get("elo", 0) > 1000
                   and q_rows.get(u2_name, {}).get("elo", 2000) < 1000),
              f"(q_winner={q_rows.get(u1_name, {}).get('elo')}, q_loser={q_rows.get(u2_name, {}).get('elo')})")


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
    test_password_change_revokes_sessions()
    await test_concurrency_durak_and_uno(u[0], u[1])
    await test_quickplay(u[0], u[1])
    await test_elo_and_leaderboard(u[0], u[1])
    check_server_log()
    print(f"\nИтого: {sum(ok for _, ok in results)}/{len(results)}")
    sys.exit(0 if all(ok for _, ok in results) else 1)

asyncio.run(main())
