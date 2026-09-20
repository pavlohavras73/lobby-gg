import json
import urllib.request
import os
import random
import re
import traceback

def generate_prompt(categories):
    key = os.environ.get('GEMINI_API_KEY', '')
    if not key:
        return _get_fallback_prompt(categories)
    
    cats_str = ", ".join(categories) if categories else "Случайные факты, Абсурд, История"
    
    prompt = f"""
Сгенерируй ОДИН малоизвестный, удивительный или абсурдный факт для игры "Аукцион лжи" (Fibbage) на тему: {cats_str}.
Факт должен содержать одно или два ключевых слова, которые нужно угадать. Замени это слово/фразу на "_____".

Формат ответа СТРОГО валидный JSON:
{{
  "text": "В 1923 году мэр Нью-Йорка запретил _____ чтобы снизить уровень преступности.",
  "correct": "мороженое",
  "bluff": "алкоголь",
  "explanation": "Мэр считал, что сахар делает людей агрессивными."
}}
В поле 'bluff' напиши один очень правдоподобный ложный ответ, чтобы запутать игроков. Не пиши ничего кроме JSON!
"""
    try:
        body = json.dumps({
            "contents": [{"parts": [{"text": prompt}]}],
            "generationConfig": {"temperature": 0.8}
        }).encode()
        req = urllib.request.Request(
            f'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={key}',
            data=body, headers={'Content-Type': 'application/json'}
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            d = json.loads(r.read())
        
        txt = ''.join(p.get('text', '') for p in d['candidates'][0]['content']['parts'])
        # Extract JSON
        mt = re.search(r'\{.*\}', txt, re.S)
        if mt:
            return json.loads(mt.group(0))
    except Exception as e:
        print(f"Gemini prompt generation error: {e}")
        traceback.print_exc()
        
    return _get_fallback_prompt(categories)

def _get_fallback_prompt(categories):
    fallbacks = [
        {
            "text": "Во время Холодной войны ЦРУ потратило миллионы долларов на создание _____, чтобы шпионить за СССР.",
            "correct": "акустической кошки",
            "bluff": "роботизированного голубя",
            "explanation": "Проект 'Acoustic Kitty' предполагал использование кошек с вживлёнными микрофонами."
        },
        {
            "text": "В 16 веке в Европе было модно носить украшения из _____, потому что считалось, что они отпугивают болезни.",
            "correct": "зубов акулы",
            "bluff": "черепов крыс",
            "explanation": "Акульи зубы носили как амулеты от яда."
        },
        {
            "text": "В игре Dota 2 изначально Pudge мог хукать _____.",
            "correct": "руны",
            "bluff": "башни",
            "explanation": "В ранних версиях Pudge мог притягивать руны хуком."
        },
        {
            "text": "В Японии есть мороженое со вкусом _____.",
            "correct": "угря",
            "bluff": "васаби",
            "explanation": "Мороженое со вкусом угря продаётся в некоторых префектурах Японии."
        },
        {
            "text": "Чарли Чаплин однажды участвовал в конкурсе двойников Чарли Чаплина и занял там _____ место.",
            "correct": "третье",
            "bluff": "последнее",
            "explanation": "Судьи не узнали его без фирменных усов и походки."
        },
        {
            "text": "Самая короткая война в истории человечества длилась _____.",
            "correct": "38 минут",
            "bluff": "3 дня",
            "explanation": "Англо-занзибарская война длилась всего 38 минут в 1896 году."
        },
        {
            "text": "Фобия длинных слов называется гиппопотомонстросескиппедало_____.",
            "correct": "фобия",
            "bluff": "мания",
            "explanation": "Это одно из самых длинных слов, созданное специально для описания этой фобии."
        },
        {
            "text": "Первоначально материал для 'пузырчатой пленки' предназначался для использования в качестве _____.",
            "correct": "обоев",
            "bluff": "изоляции окон",
            "explanation": "В 1957 году создатели пытались продать её как текстурные обои, но идея провалилась."
        },
        {
            "text": "В штате Огайо незаконно спаивать _____.",
            "correct": "рыб",
            "bluff": "собак",
            "explanation": "Старый и абсурдный закон штата запрещает давать алкоголь рыбам."
        },
        {
            "text": "Майкл Джексон пытался купить Marvel Comics в 1990-х, потому что хотел сыграть _____.",
            "correct": "Человека-паука",
            "bluff": "Профессора Икс",
            "explanation": "Он был большим фанатом комиксов и хотел главную роль в фильме про Человека-паука."
        },
        {
            "text": "Жирафы могут чистить свои уши с помощью _____.",
            "correct": "своего языка",
            "bluff": "хвоста",
            "explanation": "Язык жирафа может достигать 50 сантиметров в длину."
        },
        {
            "text": "На Юпитере и Сатурне могут идти дожди из _____.",
            "correct": "алмазов",
            "bluff": "кислоты",
            "explanation": "Высокое давление в атмосфере планет может превращать углерод в алмазы."
        },
        {
            "text": "Свиньи не могут смотреть вверх в небо из-за _____.",
            "correct": "строения шеи",
            "bluff": "боязни высоты",
            "explanation": "Анатомия шеи свиньи не позволяет ей поднять голову высоко вверх."
        },
        {
            "text": "Ежегодно больше людей гибнет от нападения _____, чем от акул.",
            "correct": "коров",
            "bluff": "пчел",
            "explanation": "Коровы ежегодно убивают около 20 человек в США, в то время как акулы — около 1-2."
        },
        {
            "text": "Оригинальное название поисковика Google было _____.",
            "correct": "BackRub",
            "bluff": "SearchIt",
            "explanation": "Ларри Пейдж и Сергей Брин изначально назвали свой проект BackRub из-за анализа обратных ссылок."
        }
    ]
    return random.choice(fallbacks)


def variants_public(room):
    """
    State payload to send to clients
    """
    gs = room.setdefault("state_data", {})
    
    # Hide bluffs if we are not in 'voting' or 'results' phase
    phase = gs.get("phase", "lobby")
    
    public_players = []
    for pid in room["players"]:
        pdata = room["players_data"].get(pid, {})
        public_players.append({
            "id": pid,
            "name": room["names"].get(pid, pid),
            "score": pdata.get("score", 0),
            "has_submitted": pdata.get("bluff") is not None,
            "has_voted": pdata.get("vote") is not None
        })
        
    out = {
        "type": "variants_state",
        "phase": phase,
        "host": room["host"],
        "round": gs.get("round", 1),
        "total_rounds": gs.get("total_rounds", 5),
        "players": public_players,
        "categories": gs.get("categories", []),
    }
    
    if phase != "lobby":
        out["prompt"] = gs.get("current_prompt", {}).get("text", "")
    
    if phase in ["voting", "results"]:
        # Send shuffled answers (we don't want clients to easily identify correct vs bluff)
        answers = gs.get("shuffled_answers", [])
        if phase == "voting":
            # Strip authorship information in voting phase
            safe_answers = []
            for ans in answers:
                safe_answers.append({
                    "id": ans["id"],
                    "text": ans["text"]
                })
            out["answers"] = safe_answers
        else:
            # In results, send everything
            out["answers"] = answers
            out["correct_id"] = gs.get("correct_id")
            out["explanation"] = gs.get("current_prompt", {}).get("explanation", "")
            
            # Send vote history for dramatic reveal
            votes = {}
            for pid, pdata in room["players_data"].items():
                if pdata.get("vote"):
                    votes[pid] = pdata["vote"]
            out["votes"] = votes
            out["round_scores"] = gs.get("round_scores", {})
            
    return out

import uuid

def start_round(room):
    gs = room.setdefault("state_data", {})
    gs["phase"] = "input"
    
    prompt_data = generate_prompt(gs.get("categories", []))
    gs["current_prompt"] = prompt_data
    gs["shuffled_answers"] = []
    
    # Clear player data for the new round
    for pid in room["players"]:
        room["players_data"].setdefault(pid, {})
        room["players_data"][pid]["bluff"] = None
        room["players_data"][pid]["vote"] = None
    
    return variants_public(room)

def check_input_phase_complete(room):
    gs = room.setdefault("state_data", {})
    if gs.get("phase") != "input":
        return False
        
    for pid in room["players"]:
        if not room["players_data"].get(pid, {}).get("bluff"):
            return False
            
    # Everyone submitted. Transition to voting phase.
    gs["phase"] = "voting"
    
    # Prepare answers
    answers = []
    # 1. Correct answer
    correct_id = str(uuid.uuid4())
    gs["correct_id"] = correct_id
    answers.append({
        "id": correct_id,
        "text": gs["current_prompt"]["correct"],
        "author": "system"
    })
    
    # 2. Player bluffs
    for pid in room["players"]:
        bluff_id = str(uuid.uuid4())
        bluff_text = room["players_data"][pid]["bluff"]
        room["players_data"][pid]["bluff_id"] = bluff_id
        answers.append({
            "id": bluff_id,
            "text": bluff_text,
            "author": pid
        })
        
    # 3. System bluff (helps especially when there are only 2 players)
    sys_bluff_text = gs["current_prompt"].get("bluff")
    if sys_bluff_text:
        sys_bluff_id = str(uuid.uuid4())
        gs["sys_bluff_id"] = sys_bluff_id
        answers.append({
            "id": sys_bluff_id,
            "text": sys_bluff_text,
            "author": "system_bluff"
        })
        
    random.shuffle(answers)
    gs["shuffled_answers"] = answers
    return True

def check_voting_phase_complete(room):
    gs = room.setdefault("state_data", {})
    if gs.get("phase") != "voting":
        return False
        
    for pid in room["players"]:
        if not room["players_data"].get(pid, {}).get("vote"):
            return False
            
    # Everyone voted. Transition to results.
    gs["phase"] = "results"
    
    round_scores = {}
    for pid in room["players"]:
        round_scores[pid] = {"total": 0, "details": []}
        
    # Calculate scores
    correct_id = gs["correct_id"]
    for pid in room["players"]:
        vote_id = room["players_data"][pid]["vote"]
        
        if vote_id == correct_id:
            round_scores[pid]["total"] += 2
            round_scores[pid]["details"].append("Угадал правду (+2)")
        elif vote_id == gs.get("sys_bluff_id"):
            round_scores[pid]["details"].append("Повелся на обманку ИИ (0)")
        else:
            # Find whose bluff this was
            for author_pid in room["players"]:
                if author_pid == pid: continue
                if room["players_data"][author_pid].get("bluff_id") == vote_id:
                    # author_pid tricked pid
                    round_scores[author_pid]["total"] += 1
                    round_scores[author_pid]["details"].append(f"Обманул {room['names'].get(pid, pid)} (+1)")
                    round_scores[pid]["details"].append("Повелся на чужую ложь (0)")
                    break
                    
    # Apply to global scores
    for pid in room["players"]:
        room["players_data"][pid]["score"] = room["players_data"].get(pid, {}).get("score", 0) + round_scores[pid]["total"]
        
    gs["round_scores"] = round_scores
    return True
