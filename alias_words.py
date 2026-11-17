"""Элиас: расширение колоды. Каждое слово — (ru, ua, en, de), чтобы колоды на всех языках были одинаковыми."""

DE_BASE = {
    "easy": ["Katze", "Sonne", "Haus", "Auto", "Apfel", "Wasser", "Buch", "Tisch", "Telefon", "Baum",
             "Hund", "Meer", "Stadt", "Musik", "Geld", "Freund", "Winter", "Essen", "Schule", "Schlaf",
             "Ball", "Schlüssel", "Blume", "Regen", "Brot"],
    "medium": ["Freiheit", "Eifersucht", "Algorithmus", "Inflation", "Horizont", "Gewissen", "Tradition", "Parkour",
               "Neuron", "Tauschhandel", "Hypothek", "Fata Morgana", "Sarkasmus", "Evolution", "Rangliste", "Parodie",
               "Instinkt", "Kompromiss", "Nostalgie", "Bürokrat", "Impfstoff", "Start-up", "Deadline", "Charisma", "Routine"],
    "hard": ["Entropie", "Metapher", "kognitive Dissonanz", "Existenzialismus", "Synergie", "Katharsis", "Paradigma",
             "Ambivalenz", "Determinismus", "Unterordnung", "Placebo", "Diversifizierung", "Empathie", "Solipsismus",
             "Hypothese", "Abstraktion", "Prokrastination", "Konformismus", "Heuristik", "Nihilismus", "Kohärenz",
             "Reduktion", "Apathie", "Sublimierung", "Dichotomie"],
}

EXTRA = {
    "easy": [
        ("самолёт", "літак", "airplane", "Flugzeug"), ("велосипед", "велосипед", "bicycle", "Fahrrad"),
        ("поезд", "потяг", "train", "Zug"), ("лодка", "човен", "boat", "Boot"), ("гора", "гора", "mountain", "Berg"),
        ("река", "річка", "river", "Fluss"), ("луна", "місяць", "moon", "Mond"), ("звезда", "зірка", "star", "Stern"),
        ("снег", "сніг", "snow", "Schnee"), ("облако", "хмара", "cloud", "Wolke"), ("огонь", "вогонь", "fire", "Feuer"),
        ("лес", "ліс", "forest", "Wald"), ("пляж", "пляж", "beach", "Strand"), ("остров", "острів", "island", "Insel"),
        ("рыба", "риба", "fish", "Fisch"), ("птица", "птах", "bird", "Vogel"), ("лошадь", "кінь", "horse", "Pferd"),
        ("корова", "корова", "cow", "Kuh"), ("медведь", "ведмідь", "bear", "Bär"), ("слон", "слон", "elephant", "Elefant"),
        ("обезьяна", "мавпа", "monkey", "Affe"), ("змея", "змія", "snake", "Schlange"), ("пицца", "піца", "pizza", "Pizza"),
        ("торт", "торт", "cake", "Kuchen"), ("мороженое", "морозиво", "ice cream", "Eis"), ("сыр", "сир", "cheese", "Käse"),
        ("молоко", "молоко", "milk", "Milch"), ("банан", "банан", "banana", "Banane"), ("кофе", "кава", "coffee", "Kaffee"),
        ("чай", "чай", "tea", "Tee"), ("окно", "вікно", "window", "Fenster"), ("дверь", "двері", "door", "Tür"),
        ("кровать", "ліжко", "bed", "Bett"), ("лампа", "лампа", "lamp", "Lampe"), ("зеркало", "дзеркало", "mirror", "Spiegel"),
        ("часы", "годинник", "clock", "Uhr"), ("очки", "окуляри", "glasses", "Brille"), ("шапка", "шапка", "hat", "Mütze"),
        ("обувь", "взуття", "shoes", "Schuhe"), ("зонт", "парасолька", "umbrella", "Regenschirm"),
        ("рюкзак", "рюкзак", "backpack", "Rucksack"), ("подарок", "подарунок", "gift", "Geschenk"),
        ("праздник", "свято", "holiday", "Feiertag"), ("день рождения", "день народження", "birthday", "Geburtstag"),
        ("ёлка", "ялинка", "Christmas tree", "Weihnachtsbaum"), ("врач", "лікар", "doctor", "Arzt"),
        ("учитель", "вчитель", "teacher", "Lehrer"), ("повар", "кухар", "cook", "Koch"), ("полиция", "поліція", "police", "Polizei"),
        ("больница", "лікарня", "hospital", "Krankenhaus"), ("магазин", "магазин", "shop", "Laden"), ("кино", "кіно", "cinema", "Kino"),
        ("футбол", "футбол", "football", "Fußball"), ("бассейн", "басейн", "swimming pool", "Schwimmbad"),
        ("гитара", "гітара", "guitar", "Gitarre"), ("компьютер", "комп'ютер", "computer", "Computer"),
        ("фотография", "фотографія", "photo", "Foto"), ("мост", "міст", "bridge", "Brücke"), ("радуга", "веселка", "rainbow", "Regenbogen"),
        ("зубная щётка", "зубна щітка", "toothbrush", "Zahnbürste"),
    ],
    "medium": [
        ("отпуск", "відпустка", "vacation", "Urlaub"), ("соревнование", "змагання", "competition", "Wettbewerb"),
        ("секрет", "таємниця", "secret", "Geheimnis"), ("привычка", "звичка", "habit", "Gewohnheit"),
        ("мечта", "мрія", "dream", "Traum"), ("обещание", "обіцянка", "promise", "Versprechen"),
        ("сюрприз", "сюрприз", "surprise", "Überraschung"), ("очередь", "черга", "queue", "Warteschlange"),
        ("пробка на дороге", "затор", "traffic jam", "Stau"), ("экзамен", "іспит", "exam", "Prüfung"),
        ("собеседование", "співбесіда", "job interview", "Vorstellungsgespräch"), ("зарплата", "зарплата", "salary", "Gehalt"),
        ("налог", "податок", "tax", "Steuer"), ("реклама", "реклама", "advertising", "Werbung"), ("новости", "новини", "news", "Nachrichten"),
        ("выборы", "вибори", "election", "Wahl"), ("суд", "суд", "court", "Gericht"), ("свадьба", "весілля", "wedding", "Hochzeit"),
        ("развод", "розлучення", "divorce", "Scheidung"), ("соседи", "сусіди", "neighbours", "Nachbarn"),
        ("пароль", "пароль", "password", "Passwort"), ("вирус", "вірус", "virus", "Virus"), ("робот", "робот", "robot", "Roboter"),
        ("спутник", "супутник", "satellite", "Satellit"), ("вулкан", "вулкан", "volcano", "Vulkan"),
        ("землетрясение", "землетрус", "earthquake", "Erdbeben"), ("пустыня", "пустеля", "desert", "Wüste"),
        ("джунгли", "джунглі", "jungle", "Dschungel"), ("пират", "пірат", "pirate", "Pirat"), ("привидение", "привид", "ghost", "Gespenst"),
        ("дракон", "дракон", "dragon", "Drache"), ("волшебник", "чарівник", "wizard", "Zauberer"),
        ("супергерой", "супергерой", "superhero", "Superheld"), ("детектив", "детектив", "detective", "Detektiv"),
        ("шпион", "шпигун", "spy", "Spion"), ("блогер", "блогер", "blogger", "Blogger"), ("мем", "мем", "meme", "Meme"),
        ("селфи", "селфі", "selfie", "Selfie"), ("подписка", "підписка", "subscription", "Abo"), ("скидка", "знижка", "discount", "Rabatt"),
        ("чаевые", "чайові", "tip", "Trinkgeld"), ("будильник", "будильник", "alarm clock", "Wecker"), ("лифт", "ліфт", "elevator", "Aufzug"),
        ("эскалатор", "ескалатор", "escalator", "Rolltreppe"), ("аэропорт", "аеропорт", "airport", "Flughafen"),
        ("паспорт", "паспорт", "passport", "Reisepass"), ("чемодан", "валіза", "suitcase", "Koffer"), ("турист", "турист", "tourist", "Tourist"),
        ("музей", "музей", "museum", "Museum"), ("цирк", "цирк", "circus", "Zirkus"), ("концерт", "концерт", "concert", "Konzert"),
        ("театр", "театр", "theatre", "Theater"), ("оркестр", "оркестр", "orchestra", "Orchester"), ("марафон", "марафон", "marathon", "Marathon"),
        ("олимпиада", "олімпіада", "Olympics", "Olympiade"), ("медаль", "медаль", "medal", "Medaille"),
        ("чемпион", "чемпіон", "champion", "Meister"), ("тренировка", "тренування", "training", "Training"),
    ],
    "hard": [
        ("демократия", "демократія", "democracy", "Demokratie"), ("монополия", "монополія", "monopoly", "Monopol"),
        ("глобализация", "глобалізація", "globalization", "Globalisierung"), ("иммунитет", "імунітет", "immunity", "Immunität"),
        ("гравитация", "гравітація", "gravity", "Schwerkraft"), ("фотосинтез", "фотосинтез", "photosynthesis", "Photosynthese"),
        ("атмосфера", "атмосфера", "atmosphere", "Atmosphäre"), ("интуиция", "інтуїція", "intuition", "Intuition"),
        ("вдохновение", "натхнення", "inspiration", "Inspiration"), ("репутация", "репутація", "reputation", "Ruf"),
        ("дипломатия", "дипломатія", "diplomacy", "Diplomatie"), ("пропаганда", "пропаганда", "propaganda", "Propaganda"),
        ("цензура", "цензура", "censorship", "Zensur"), ("коррупция", "корупція", "corruption", "Korruption"),
        ("бойкот", "бойкот", "boycott", "Boykott"), ("санкции", "санкції", "sanctions", "Sanktionen"),
        ("криптовалюта", "криптовалюта", "cryptocurrency", "Kryptowährung"),
        ("искусственный интеллект", "штучний інтелект", "artificial intelligence", "künstliche Intelligenz"),
        ("виртуальная реальность", "віртуальна реальність", "virtual reality", "virtuelle Realität"),
        ("бессонница", "безсоння", "insomnia", "Schlaflosigkeit"), ("дежавю", "дежавю", "déjà vu", "Déjà-vu"),
        ("иллюзия", "ілюзія", "illusion", "Illusion"), ("ирония", "іронія", "irony", "Ironie"), ("утопия", "утопія", "utopia", "Utopie"),
        ("анархия", "анархія", "anarchy", "Anarchie"), ("бессмертие", "безсмертя", "immortality", "Unsterblichkeit"),
        ("перфекционизм", "перфекціонізм", "perfectionism", "Perfektionismus"), ("лицемерие", "лицемірство", "hypocrisy", "Heuchelei"),
        ("вежливость", "ввічливість", "politeness", "Höflichkeit"), ("терпение", "терпіння", "patience", "Geduld"),
        ("любопытство", "цікавість", "curiosity", "Neugier"), ("одиночество", "самотність", "loneliness", "Einsamkeit"),
        ("благодарность", "вдячність", "gratitude", "Dankbarkeit"), ("зависть", "заздрість", "envy", "Neid"),
        ("стыд", "сором", "shame", "Scham"), ("гордость", "гордість", "pride", "Stolz"), ("мотивация", "мотивація", "motivation", "Motivation"),
        ("стереотип", "стереотип", "stereotype", "Klischee"), ("менталитет", "менталітет", "mentality", "Mentalität"),
        ("этикет", "етикет", "etiquette", "Etikette"), ("сарафанное радио", "сарафанне радіо", "word of mouth", "Mundpropaganda"),
        ("кризис среднего возраста", "криза середнього віку", "midlife crisis", "Midlife-Crisis"),
        ("синдром самозванца", "синдром самозванця", "impostor syndrome", "Hochstapler-Syndrom"),
        ("выгорание", "вигорання", "burnout", "Burnout"), ("зона комфорта", "зона комфорту", "comfort zone", "Komfortzone"),
        ("эффект бабочки", "ефект метелика", "butterfly effect", "Schmetterlingseffekt"),
        ("теория заговора", "теорія змови", "conspiracy theory", "Verschwörungstheorie"),
        ("чёрная дыра", "чорна діра", "black hole", "Schwarzes Loch"),
        ("квантовый компьютер", "квантовий комп'ютер", "quantum computer", "Quantencomputer"),
    ],
}

_IDX = {"ru": 0, "ua": 1, "en": 2, "de": 3}


def merge_into(words):
    """Добавить EXTRA и немецкую колоду в WORDS из alias.py (без дублей, порядок не важен — колода тасуется)."""
    words.setdefault("de", {k: list(v) for k, v in DE_BASE.items()})
    for diff, rows in EXTRA.items():
        for lang, i in _IDX.items():
            pool = words[lang].setdefault(diff, [])
            seen = {w.lower() for w in pool}
            for row in rows:
                if row[i].lower() not in seen:
                    pool.append(row[i])
                    seen.add(row[i].lower())
    return words
