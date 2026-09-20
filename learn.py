"""
Jarvis Learn — Интерактивный тренажёр микрообучения (Duolingo/LeetCode style в стиле Jarvis).
Поддерживает курсы по Street English, CS50/Python и Немецкому языку.
Интегрирован с Groq Whisper для Voice Check.
"""

import os
import json
import sqlite3
import datetime
import difflib
import logging
import base64
import tempfile
import subprocess
from fastapi import APIRouter, Request, Response, HTTPException
from fastapi.responses import JSONResponse, FileResponse

logger = logging.getLogger("jarvis_learn")

GROQ_KEY = os.environ.get("GROQ_API_KEY", "")   # set in the environment, never commit keys

def get_db_path():
    # На сервере база в /data/users.db, локально в текущей папке
    if os.path.exists("/data/users.db") or os.path.exists("/data"):
        return "/data/users.db"
    return os.path.join(os.path.dirname(__file__), "learn.db")

def get_db_conn():
    db_path = get_db_path()
    con = sqlite3.connect(db_path, timeout=5)
    init_tables(con)
    return con

def init_tables(con):
    with con:
        con.execute("""
            CREATE TABLE IF NOT EXISTS learn_courses (
                id TEXT PRIMARY KEY,
                track TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                icon TEXT NOT NULL,
                level TEXT DEFAULT 'All Levels',
                order_num INTEGER DEFAULT 0
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS learn_lessons (
                id TEXT PRIMARY KEY,
                course_id TEXT NOT NULL,
                unit_title TEXT NOT NULL,
                title TEXT NOT NULL,
                order_num INTEGER DEFAULT 0,
                xp_reward INTEGER DEFAULT 30,
                payload_json TEXT NOT NULL,
                FOREIGN KEY (course_id) REFERENCES learn_courses(id)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS learn_user_progress (
                username TEXT NOT NULL,
                lesson_id TEXT NOT NULL,
                status TEXT DEFAULT 'completed',
                xp_earned INTEGER DEFAULT 0,
                mistakes_count INTEGER DEFAULT 0,
                completed_at TEXT NOT NULL,
                PRIMARY KEY (username, lesson_id)
            )
        """)
        con.execute("""
            CREATE TABLE IF NOT EXISTS learn_user_stats (
                username TEXT PRIMARY KEY,
                total_xp INTEGER DEFAULT 0,
                streak_days INTEGER DEFAULT 0,
                last_active_date TEXT
            )
        """)
    seed_courses_and_lessons(con)

# ══════════════════════════════════════════════════════════════
# ПИЛОТНЫЙ КОНТЕНТ (Street English, CS50 Core, Deutsch)
# ══════════════════════════════════════════════════════════════

SEED_COURSES = [
    {
        "id": "eng_slang",
        "track": "english",
        "title": "Street Slang & Fluency",
        "description": "Живой разговорный сленг, идиомы и реальные фразы без академической скуки.",
        "icon": "🔥",
        "level": "B1-C1",
        "order_num": 1
    },
    {
        "id": "cs50_core",
        "track": "cs",
        "title": "CS50: Архитектура & Python",
        "description": "Как устроена память, указатели, структуры данных и сложность алгоритмов.",
        "icon": "⚡",
        "level": "Junior → Middle",
        "order_num": 2
    },
    {
        "id": "de_street",
        "track": "german",
        "title": "Deutsch: Живая Речь A1-B2",
        "description": "Плотный трек без лишней грамматики: реальные диалоги, Берлинский сленг и база.",
        "icon": "🇩🇪",
        "level": "A1-B1",
        "order_num": 3
    }
]

SEED_LESSONS = [
    # ── ENGLISH SLANG ──
    {
        "id": "eng_slang_01",
        "course_id": "eng_slang",
        "unit_title": "Unit 1: Уличные реакции",
        "title": "«For real» и «No cap»",
        "order_num": 1,
        "xp_reward": 40,
        "payload": {
            "id": "eng_slang_01",
            "track": "english",
            "title": "Уличные реакции и сленг",
            "steps": [
                {
                    "id": "s1",
                    "type": "theory",
                    "title": "Фразы: «For real» vs «No cap»",
                    "text": "Вместо сухого «I agree» или «Really?» нейтив-спикеры используют:\n\n• **For real?** — «Серьёзно? / Да ладно?»\n• **No cap** — «Без пиздежа / Чистая правда / Зуб даю».\n• **That's cap** — «Пиздёж / Не верю».",
                    "example": "— Bro, this new GPU runs everything at 200 FPS!\n— For real? No cap?"
                },
                {
                    "id": "s2",
                    "type": "choice",
                    "prompt": "Как ответить собеседнику, подчеркнув, что ты говоришь абсолютную правду без преувеличения?",
                    "options": ["No problem", "No cap", "No matter", "No doubt about way"],
                    "correct_idx": 1,
                    "explanation": "«No cap» в современном сленге означает «чистая правда, зуб даю, без обмана»."
                },
                {
                    "id": "s3",
                    "type": "scramble",
                    "prompt": "Собери фразу:",
                    "translation": "Он реально лучший разработчик в команде, без шуток.",
                    "tokens": ["He", "is", "for", "real", "the", "best", "dev", "no", "cap"],
                    "distractors": ["fake", "make", "true"],
                    "correct_order": ["He", "is", "for", "real", "the", "best", "dev", "no", "cap"]
                },
                {
                    "id": "s4",
                    "type": "matching",
                    "prompt": "Сопоставь уличный сленг с его реальным значением:",
                    "pairs": [
                        {"left": "No cap", "right": "Чистая правда"},
                        {"left": "That's cap", "right": "Это гон и неправда"},
                        {"left": "For real?", "right": "Серьёзно? / Правда?"},
                        {"left": "Lowkey", "right": "Втайне / Слегка"}
                    ]
                },
                {
                    "id": "s5",
                    "type": "fill_blank",
                    "prompt": "Вставь пропущенное сленговое слово:",
                    "sentence": "Don't believe him, bro, everything he said is ___!",
                    "options": ["cap", "hat", "lie", "limit"],
                    "correct": "cap",
                    "explanation": "«That's cap» или «is cap» означает ложь или преувеличение."
                },
                {
                    "id": "s6",
                    "type": "voice_check",
                    "prompt": "Произнеси слитной интонацией в микрофон:",
                    "target_phrase": "Are you for real right now?",
                    "hint": "Интонация удивления: «А ю фо рил райт нау?»"
                }
            ]
        }
    },
    {
        "id": "eng_slang_02",
        "course_id": "eng_slang",
        "unit_title": "Unit 1: Уличные реакции",
        "title": "«Flex», «Bet» и «Lowkey»",
        "order_num": 2,
        "xp_reward": 45,
        "payload": {
            "id": "eng_slang_02",
            "track": "english",
            "title": "Хайп, согласие и скрытые мысли",
            "steps": [
                {
                    "id": "s1",
                    "type": "theory",
                    "title": "«Bet» и «Lowkey»",
                    "text": "Два слова, которые американцы говорят по 50 раз в день:\n\n• **Bet!** — «Договорились! / Замётано! / По рукам!» (когда тебе что-то предлагают).\n• **Lowkey** — «Втайне / по-тихому / на самом деле» (когда не хочешь палиться).\n• **Highkey** — «В открытую / на максималках».",
                    "example": "— Wanna grab some burgers after the stream?\n— Bet, I'm lowkey starving."
                },
                {
                    "id": "s2",
                    "type": "choice",
                    "prompt": "Тебе пишут: «Let's play Quoridor tonight at 10 PM». Самый естественный сленговый ответ:",
                    "options": ["Agreeable", "Bet!", "Understood sir", "Sure thing brotha man"],
                    "correct_idx": 1,
                    "explanation": "«Bet!» — универсальное утверждение «Договорились! Без базара!»."
                },
                {
                    "id": "s3",
                    "type": "scramble",
                    "prompt": "Собери предложение:",
                    "translation": "Я на самом деле (втайне) очень устал сегодня.",
                    "tokens": ["I", "am", "lowkey", "super", "tired", "today"],
                    "distractors": ["silent", "secret", "hard"],
                    "correct_order": ["I", "am", "lowkey", "super", "tired", "today"]
                },
                {
                    "id": "s4",
                    "type": "voice_check",
                    "prompt": "Произнеси чётко и расслабленно:",
                    "target_phrase": "Bet, let's do it right now.",
                    "hint": "«Бет, лэтс ду ит райт нау.»"
                }
            ]
        }
    },

    # ── COMPUTER SCIENCE 50 & PYTHON ──
    {
        "id": "cs50_01",
        "course_id": "cs50_core",
        "unit_title": "Unit 1: Железо и Память",
        "title": "Как устроена RAM и адресация",
        "order_num": 1,
        "xp_reward": 50,
        "payload": {
            "id": "cs50_01",
            "track": "cs",
            "title": "Архитектура памяти: Стек и Байт",
            "steps": [
                {
                    "id": "s1",
                    "type": "theory",
                    "title": "Оперативная память — это огромный массив байт",
                    "text": "Каждый байт в ОЗУ имеет свой собственный **порядковый номер (адрес)**, начинающийся с 0x0.\n\n• Переменная — это просто метка, указывающая на адрес в памяти.\n• В Python переменная хранит не само значение, а **ссылку (указатель)** на объект в куче (Heap).\n• Когда ты пишешь `a = [1, 2]`, `a` содержит адрес списка, а не сам массив.",
                    "example": "a = [1, 2, 3]\nb = a\nb.append(4)\nprint(a)  # [1, 2, 3, 4] -> обе переменные смотрят в один адрес!"
                },
                {
                    "id": "s2",
                    "type": "code_output",
                    "prompt": "Что выведет данный Python скрипт?",
                    "code": "x = [10, 20]\ny = x\ny.append(30)\nprint(len(x))",
                    "options": ["2", "3", "Error", "None"],
                    "correct_idx": 1,
                    "explanation": "x и y ссылаются на один и тот же список в памяти. Изменение через y меняет объект, на который смотрит x."
                },
                {
                    "id": "s3",
                    "type": "choice",
                    "prompt": "Где в памяти компьютера размещаются локальные переменные быстрых функций?",
                    "options": ["Стек (Stack)", "Куча (Heap)", "Жёсткий диск", "BIOS ROM"],
                    "correct_idx": 0,
                    "explanation": "Стек функций (Call Stack) работает по принципу LIFO и выделяет память под локальные переменные мгновенно."
                },
                {
                    "id": "s4",
                    "type": "fill_blank",
                    "prompt": "Как создать независимую поверхностную копию списка `a` в Python?",
                    "sentence": "b = a.___()",
                    "options": ["copy", "clone", "duplicate", "fork"],
                    "correct": "copy",
                    "explanation": "`a.copy()` или `a[:]` создаёт новый объект списка с теми же элементами."
                },
                {
                    "id": "s5",
                    "type": "matching",
                    "prompt": "Сопоставь область памяти с её характеристикой:",
                    "pairs": [
                        {"left": "Stack", "right": "Быстрое LIFO хранилище фреймов функций"},
                        {"left": "Heap", "right": "Динамическая память для объектов переменного размера"},
                        {"left": "CPU Cache L1", "right": "Сверхбыстрая память прямо на кристалле процессора"},
                        {"left": "Pointer", "right": "Числовой адрес ячейки в оперативной памяти"}
                    ]
                }
            ]
        }
    },

    # ── DEUTSCH ──
    {
        "id": "de_01",
        "course_id": "de_street",
        "unit_title": "Unit 1: Берлинский вайб",
        "title": "Как здороваться и заказывать без акцента",
        "order_num": 1,
        "xp_reward": 40,
        "payload": {
            "id": "de_01",
            "track": "german",
            "title": "Street German: Приветствия и Кафе",
            "steps": [
                {
                    "id": "s1",
                    "type": "theory",
                    "title": "«Na?» — самое универсальное слово Германии",
                    "text": "Немцы редко говорят шаблонное «Guten Tag» друзьям. В обиходе:\n\n• **Na?** — заменяет «Как дела?», «Что нового?», «Ну как ты?». Ответить можно тем же: «Na!» или «Alles gut!».\n• **Servus! / Moin!** — привет/пока (юг / север Германии).\n• **Ich hätte gern...** — вежливый заказ («Я бы хотел...»).",
                    "example": "— Na, alles klar bei dir?\n— Ja, alles bestens!"
                },
                {
                    "id": "s2",
                    "type": "choice",
                    "prompt": "Ты заходишь в кофейню в Германии. Как сделать заказ максимально естественно и вежливо?",
                    "options": [
                        "Ich will Kaffee sofort",
                        "Ich hätte gern einen Cappuccino, bitte",
                        "Gib mir ein Kaffee",
                        "Kaffee her"
                    ],
                    "correct_idx": 1,
                    "explanation": "«Ich hätte gern...» (Конъюнктив II) — золотой стандарт вежливого заказа."
                },
                {
                    "id": "s3",
                    "type": "scramble",
                    "prompt": "Собери фразу:",
                    "translation": "У тебя всё хорошо?",
                    "tokens": ["Alles", "klar", "bei", "dir?"],
                    "distractors": ["mit", "gut", "wer"],
                    "correct_order": ["Alles", "klar", "bei", "dir?"]
                },
                {
                    "id": "s4",
                    "type": "voice_check",
                    "prompt": "Произнеси фразу на немецком:",
                    "target_phrase": "Alles klar, danke schön!",
                    "hint": "«Аллес клар, данке шён!»"
                }
            ]
        }
    }
]

def seed_courses_and_lessons(con):
    with con:
        # Seed Courses
        for c in SEED_COURSES:
            con.execute("""
                INSERT INTO learn_courses (id, track, title, description, icon, level, order_num)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    title=excluded.title,
                    description=excluded.description,
                    icon=excluded.icon,
                    level=excluded.level,
                    order_num=excluded.order_num
            """, (c["id"], c["track"], c["title"], c["description"], c["icon"], c["level"], c["order_num"]))
        
        # Seed Lessons
        for l in SEED_LESSONS:
            con.execute("""
                INSERT INTO learn_lessons (id, course_id, unit_title, title, order_num, xp_reward, payload_json)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    unit_title=excluded.unit_title,
                    title=excluded.title,
                    order_num=excluded.order_num,
                    xp_reward=excluded.xp_reward,
                    payload_json=excluded.payload_json
            """, (l["id"], l["course_id"], l["unit_title"], l["title"], l["order_num"], l["xp_reward"], json.dumps(l["payload"], ensure_ascii=False)))

# ══════════════════════════════════════════════════════════════
# VOICE CHECK ЧЕРЕЗ GROQ WHISPER
# ══════════════════════════════════════════════════════════════

def clean_text(text: str) -> str:
    import re
    return re.sub(r'[^\w\s]', '', text.lower()).strip()

def evaluate_pronunciation(target: str, recognized: str):
    t_clean = clean_text(target)
    r_clean = clean_text(recognized)
    
    if not r_clean:
        return {
            "score": 0,
            "pass": False,
            "feedback": "Звук не распознан. Попробуй сказать громче и ближе к микрофону."
        }
    
    ratio = difflib.SequenceMatcher(None, t_clean, r_clean).ratio()
    score = int(round(ratio * 100))
    
    t_words = t_clean.split()
    r_words = r_clean.split()
    
    missed = [w for w in t_words if w not in r_words]
    
    if score >= 80:
        feedback = "Отличное произношение! Звучит как у нейтива."
        is_pass = True
    elif score >= 60:
        feedback = f"Хорошо, смысл понятен. Обрати внимание на слова: {', '.join(missed) if missed else 'интонацию'}."
        is_pass = True
    else:
        feedback = f"Не совсем совпало (точность {score}%). Ты сказал: «{recognized}». Попробуй ещё раз!"
        is_pass = False
        
    return {
        "score": score,
        "pass": is_pass,
        "recognized": recognized,
        "target": target,
        "feedback": feedback
    }

def transcribe_audio_groq(file_path: str) -> str:
    try:
        cmd = [
            "curl", "-s", "https://api.groq.com/openai/v1/audio/transcriptions",
            "-H", f"Authorization: bearer {GROQ_KEY}",
            "-F", f"file=@{file_path}",
            "-F", "model=whisper-large-v3"
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, timeout=25)
        data = json.loads(res.stdout)
        return data.get("text", "")
    except Exception as e:
        logger.error(f"Groq transcription failed: {e}")
        return ""

# ══════════════════════════════════════════════════════════════
# FASTAPI РОУТЫ
# ══════════════════════════════════════════════════════════════

router = APIRouter()

def get_current_user(request: Request):
    token = request.cookies.get("jsession")
    if not token:
        return {"username": "guest", "role": "guest"}
    try:
        parts = token.split("|")
        if len(parts) == 4:
            return {"username": parts[0], "role": parts[1]}
    except Exception:
        pass
    return {"username": "guest", "role": "guest"}

@router.get("/learn")
async def learn_page():
    paths = [
        "/app/static/learn.html",
        os.path.join(os.path.dirname(os.path.abspath(__file__)), "static", "learn.html"),
        os.path.join(os.path.dirname(__file__), "static", "learn.html"),
        os.path.join(os.path.dirname(__file__), "learn.html")
    ]
    for p in paths:
        if os.path.exists(p):
            return FileResponse(p)
    return JSONResponse({"error": "learn.html not found"}, status_code=404)

@router.get("/learn/api/courses")
async def list_courses(request: Request):
    user = get_current_user(request)
    username = user["username"]
    
    con = get_db_conn()
    try:
        courses_rows = con.execute("""
            SELECT id, track, title, description, icon, level, order_num 
            FROM learn_courses 
            ORDER BY order_num ASC
        """).fetchall()
        
        # Получаем прогресс пользователя по урокам
        completed_lessons = set(
            row[0] for row in con.execute(
                "SELECT lesson_id FROM learn_user_progress WHERE username=? AND status='completed'",
                (username,)
            ).fetchall()
        )
        
        # Получаем статистику пользователя
        user_stats = con.execute(
            "SELECT total_xp, streak_days, last_active_date FROM learn_user_stats WHERE username=?",
            (username,)
        ).fetchone()
        
        total_xp = user_stats[0] if user_stats else 0
        streak = user_stats[1] if user_stats else 0
        
        courses_res = []
        for c in courses_rows:
            cid = c[0]
            lessons_rows = con.execute("""
                SELECT id, unit_title, title, order_num, xp_reward 
                FROM learn_lessons 
                WHERE course_id=? 
                ORDER BY order_num ASC
            """, (cid,)).fetchall()
            
            lessons_list = []
            for l in lessons_rows:
                lid = l[0]
                is_done = lid in completed_lessons
                lessons_list.append({
                    "id": lid,
                    "unit_title": l[1],
                    "title": l[2],
                    "order_num": l[3],
                    "xp_reward": l[4],
                    "completed": is_done
                })
            
            total_l = len(lessons_list)
            done_l = sum(1 for l in lessons_list if l["completed"])
            pct = int(round((done_l / total_l * 100))) if total_l > 0 else 0
            
            courses_res.append({
                "id": c[0],
                "track": c[1],
                "title": c[2],
                "description": c[3],
                "icon": c[4],
                "level": c[5],
                "total_lessons": total_l,
                "completed_lessons": done_l,
                "progress_pct": pct,
                "lessons": lessons_list
            })
            
        return JSONResponse({
            "ok": True,
            "username": username,
            "stats": {
                "total_xp": total_xp,
                "streak": streak
            },
            "courses": courses_res
        })
    finally:
        con.close()

@router.get("/learn/api/lesson/{lesson_id}")
async def get_lesson(lesson_id: str):
    con = get_db_conn()
    try:
        r = con.execute("SELECT payload_json, xp_reward FROM learn_lessons WHERE id=?", (lesson_id,)).fetchone()
        if not r:
            raise HTTPException(404, detail="Lesson not found")
        data = json.loads(r[0])
        data["xp_reward"] = r[1]
        return JSONResponse({"ok": True, "lesson": data})
    finally:
        con.close()

@router.post("/learn/api/voice-check")
async def voice_check(request: Request):
    content_type = request.headers.get("content-type", "")
    target_phrase = ""
    audio_bytes = b""
    ext = "webm"
    
    if "application/json" in content_type:
        body = await request.json()
        target_phrase = body.get("target_phrase", "")
        b64 = body.get("audio_base64", "")
        if b64:
            audio_bytes = base64.b64decode(b64)
        ext = body.get("format", "webm")
    else:
        try:
            form = await request.form()
            target_phrase = form.get("target_phrase", "")
            audio = form.get("audio")
            if hasattr(audio, "read"):
                audio_bytes = await audio.read()
                filename = getattr(audio, "filename", "")
                if "." in filename:
                    ext = filename.split(".")[-1]
        except Exception as e:
            logger.error(f"Form parsing error: {e}")
            raise HTTPException(400, detail="Could not parse audio payload")
            
    if not audio_bytes:
        raise HTTPException(400, detail="No audio data received")
        
    with tempfile.NamedTemporaryFile(suffix=f".{ext}", delete=False) as tmp:
        tmp_path = tmp.name
        tmp.write(audio_bytes)
        
    try:
        recognized_text = transcribe_audio_groq(tmp_path)
        eval_result = evaluate_pronunciation(target_phrase, recognized_text)
        return JSONResponse({"ok": True, "result": eval_result})
    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

@router.post("/learn/api/complete")
async def complete_lesson(request: Request):
    user = get_current_user(request)
    username = user["username"]
    
    try:
        body = await request.json()
        lesson_id = body.get("lesson_id")
        xp_earned = int(body.get("xp", 30))
        mistakes = int(body.get("mistakes", 0))
    except Exception:
        raise HTTPException(400, detail="Invalid request body")
        
    if not lesson_id:
        raise HTTPException(400, detail="Missing lesson_id")
        
    today = datetime.date.today().isoformat()
    now_iso = datetime.datetime.now().isoformat()
    
    con = get_db_conn()
    try:
        with con:
            # Записываем прохождение урока
            con.execute("""
                INSERT INTO learn_user_progress (username, lesson_id, status, xp_earned, mistakes_count, completed_at)
                VALUES (?, ?, 'completed', ?, ?, ?)
                ON CONFLICT(username, lesson_id) DO UPDATE SET
                    xp_earned = MAX(excluded.xp_earned, learn_user_progress.xp_earned),
                    mistakes_count = MIN(excluded.mistakes_count, learn_user_progress.mistakes_count),
                    completed_at = excluded.completed_at
            """, (username, lesson_id, xp_earned, mistakes, now_iso))
            
            # Обновляем статистику пользователя и стрик
            stats = con.execute("SELECT total_xp, streak_days, last_active_date FROM learn_user_stats WHERE username=?", (username,)).fetchone()
            if not stats:
                new_total_xp = xp_earned
                new_streak = 1
                con.execute("""
                    INSERT INTO learn_user_stats (username, total_xp, streak_days, last_active_date)
                    VALUES (?, ?, ?, ?)
                """, (username, new_total_xp, new_streak, today))
            else:
                curr_xp, curr_streak, last_date = stats
                new_total_xp = curr_xp + xp_earned
                if last_date == today:
                    new_streak = curr_streak  # уже занимался сегодня
                else:
                    yesterday = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
                    if last_date == yesterday:
                        new_streak = curr_streak + 1
                    else:
                        new_streak = 1  # стрик прерван
                con.execute("""
                    UPDATE learn_user_stats SET total_xp=?, streak_days=?, last_active_date=? WHERE username=?
                """, (new_total_xp, new_streak, today, username))
                
        return JSONResponse({
            "ok": True,
            "lesson_id": lesson_id,
            "xp_earned": xp_earned,
            "total_xp": new_total_xp,
            "streak": new_streak
        })
    finally:
        con.close()
