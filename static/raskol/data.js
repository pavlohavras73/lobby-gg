/* Раскол — данные: классы, враги, боссы, карты-навыки, комнаты главы 1 (Склеп). Тексты на 4 языках. */
(function (global) {
  'use strict';
  const L = (uk, ru, en, de) => ({ uk, ru, en, de });

  // Размер арены (внутренняя часть, без стен) в мировых единицах.
  const ROOM_W = 1200, ROOM_H = 700, WALL = 80;

  const CLASSES = {
    guard: {
      id: 'guard', color: '#f59e0b', unlocked: true, cost: 0,
      hp: 130, speed: 180, dmg: 26, atkCd: 0.42, range: 86, arc: 2.0,
      name: L('Страж', 'Страж', 'Guardian', 'Wächter'),
      role: L('Ближній бій · щит', 'Ближний бой · щит', 'Melee · shield', 'Nahkampf · Schild'),
      atk: L('Удар мечем дугою. Меч відбиває ворожі снаряди.', 'Удар мечом дугой. Меч отбивает вражеские снаряды.',
        'Sword sweep in an arc. The blade knocks enemy shots away.', 'Schwerthieb im Bogen. Die Klinge wehrt Geschosse ab.'),
      sup: L('Таран щитом: ривок крізь ворогів, невразливий.', 'Таран щитом: рывок сквозь врагов, неуязвим.',
        'Shield ram: charge through enemies, invulnerable.', 'Schildramme: Sturm durch Gegner, unverwundbar.'),
      pas: L('Щит спереду гасить половину шкоди від снарядів.', 'Щит спереди гасит половину урона от снарядов.',
        'Shield in front halves projectile damage.', 'Schild vorn halbiert Geschossschaden.')
    },
    ranger: {
      id: 'ranger', color: '#22c55e', unlocked: false, cost: 150,
      hp: 100, speed: 192, dmg: 23, atkCd: 0.35, range: 520, arc: 0.35,
      name: L('Слідопит', 'Следопыт', 'Ranger', 'Waldläufer'),
      role: L('Дальній бій · рикошет', 'Дальний бой · рикошет', 'Ranged · ricochet', 'Fernkampf · Abpraller'),
      atk: L('Швидкі стріли на велику дистанцію. Тримає відстань.', 'Быстрые стрелы на большую дистанцию. Держит дистанцию.',
        'Fast long-range arrows. Keeps distance from foes.', 'Schnelle Pfeile auf hohe Distanz. Hält Abstand.'),
      sup: L('Залп: віяло з 9 пробивних стріл (~70°).', 'Залп: веер из 9 пронзающих стрел (~70°).',
        'Volley: fan of 9 piercing arrows (~70°).', 'Salve: Fächer aus 9 durchschlagenden Pfeilen (~70°).'),
      pas: L('Стріла один раз рикошетить від стіни або перешкоди.', 'Стрела один раз рикошетит от стены или преграды.',
        'Each arrow ricochets once off walls or obstacles.', 'Jeder Pfeil prallt einmal an Wänden ab.')
    },
    mage: {
      id: 'mage', color: '#a855f7', unlocked: false, cost: 300,
      hp: 95, speed: 175, dmg: 28, atkCd: 0.52, range: 460, arc: 0.45,
      name: L('Маг', 'Маг', 'Mage', 'Magier'),
      role: L('Магія по площі', 'Магия по площади', 'Area magic', 'Flächenmagie'),
      atk: L('Вогняна куля, що вибухає по площі.', 'Огненный шар — взрывается по площади.',
        'Fireball that explodes in an area on hit.', 'Feuerball, der beim Treffer im Gebiet explodiert.'),
      sup: L('Метеор: потужний удар у точку прицілу з підпалом.', 'Метеор: мощный удар в точку прицела с поджогом.',
        'Meteor: heavy sky blast at target with burn.', 'Meteor: mächtiger Einschlag mit Verbrennung.'),
      pas: L('Стихія копиться: кожне 5-те влучання — вибух навколо ворога.', 'Стихия копится: на 5-м попадании — взрыв стихии.',
        'Elemental buildup: every 5th hit triggers an arcane blast.', 'Elementarladung: Jeder 5. Treffer löst Explosion aus.')
    },
    shade: {
      id: 'shade', color: '#38bdf8', unlocked: false, cost: 500,
      hp: 85, speed: 210, dmg: 11, atkCd: 0.34, range: 300, arc: 0.4,
      name: L('Тінь', 'Тень', 'Shade', 'Schatten'),
      role: L('Крити · невидимість', 'Криты · невидимость', 'Crits · stealth', 'Krits · Tarnung'),
      atk: L('Два швидкі кинуті кинджали перед собою.', 'Два быстрых брошенных кинжала перед собой.',
        'Throws twin fast daggers ahead.', 'Wirft zwei schnelle Dolche nach vorn.'),
      sup: L('Невидимість на 2.5 с: вороги втрачають ціль, удар ×3 крит.', 'Невидимость на 2.5 с: враги теряют цель, первый удар ×3 крит.',
        'Invisibility (2.5 s): foes lose lock, ambush deals ×3 crit.', 'Unsichtbarkeit (2,5 s): Gegner blind, erster Schlag ×3 Krit.'),
      pas: L('Перший удар після ривка — гарантований критичний.', 'Первый удар после рывка — гарантированный крит.',
        'First strike after a dash is a guaranteed crit.', 'Erster Schlag nach dem Ausweichen ist sicherer Krit.')
    }
  };

  // ai: melee | ranged | swoop | slime | caster | turret
  const ENEMIES = {
    skel: { hp: 46, speed: 98, r: 17, dmg: 12, xp: 2, ai: 'melee', name: L('Скелет', 'Скелет', 'Skeleton', 'Skelett') },
    archer: { hp: 34, speed: 82, r: 16, dmg: 10, xp: 2, ai: 'ranged', name: L('Кістяний лучник', 'Костяной лучник', 'Bone archer', 'Knochenschütze') },
    bat: { hp: 20, speed: 200, r: 13, dmg: 8, xp: 1, ai: 'swoop', name: L('Кажан', 'Нетопырь', 'Bat', 'Fledermaus') },
    slime: { hp: 60, speed: 62, r: 23, dmg: 10, xp: 2, ai: 'slime', split: 'slimelet', name: L('Слиз', 'Слизень', 'Slime', 'Schleim') },
    slimelet: { hp: 18, speed: 95, r: 12, dmg: 6, xp: 1, ai: 'slime', name: L('Слизик', 'Слизнёныш', 'Slimelet', 'Schleimling') },
    warlock: { hp: 64, speed: 72, r: 18, dmg: 12, xp: 4, ai: 'caster', name: L('Чорнокнижник', 'Чернокнижник', 'Warlock', 'Hexer') },
    totem: { hp: 120, speed: 0, r: 25, dmg: 9, xp: 4, ai: 'turret', name: L('Тотем', 'Тотем', 'Totem', 'Totem') }
  };

  const BOSSES = {
    warden: { hp: 1300, speed: 110, r: 36, dmg: 24, xp: 14, shards: 15,
      name: L('Вартовий склепу', 'Страж склепа', 'Crypt Warden', 'Gruftwächter') },
    king: { hp: 3300, speed: 90, r: 42, dmg: 26, xp: 0, shards: 40,
      name: L('Кістяний король', 'Костяной король', 'Bone King', 'Knochenkönig') }
  };

  // Комнаты главы 1. waves — массив волн; каждая волна — список [тип, количество]. boss — id босса.
  const CHAPTER1 = {
    id: 1,
    name: L('Склеп', 'Склеп', 'The Crypt', 'Die Gruft'),
    rooms: [
      { layout: 0, waves: [[['skel', 4]]] },
      { layout: 1, waves: [[['skel', 3], ['bat', 2]]] },
      { layout: 2, waves: [[['archer', 2], ['skel', 3]]] },
      { layout: 3, waves: [[['slime', 2], ['bat', 2], ['archer', 1]]] },
      { layout: 4, boss: 'warden' },
      { layout: 5, waves: [[['totem', 1], ['skel', 3], ['archer', 2]]] },
      { layout: 2, waves: [[['warlock', 2], ['slime', 2], ['bat', 2]]] },
      { layout: 1, waves: [[['skel', 4], ['archer', 2]], [['totem', 1], ['warlock', 2]]] },
      { layout: 3, waves: [[['slime', 2], ['bat', 3], ['archer', 2]], [['warlock', 2], ['skel', 3], ['totem', 1]]] },
      { layout: 6, boss: 'king' }
    ]
  };

  // Препятствия (прямоугольники x,y,w,h в координатах арены). kind: pillar | tomb | wall
  const LAYOUTS = [
    [],
    [{ x: 260, y: 220, w: 70, h: 70, k: 'pillar' }, { x: 870, y: 220, w: 70, h: 70, k: 'pillar' },
     { x: 260, y: 430, w: 70, h: 70, k: 'pillar' }, { x: 870, y: 430, w: 70, h: 70, k: 'pillar' }],
    [{ x: 520, y: 300, w: 160, h: 90, k: 'tomb' }, { x: 160, y: 160, w: 60, h: 60, k: 'pillar' }, { x: 980, y: 160, w: 60, h: 60, k: 'pillar' }],
    [{ x: 300, y: 330, w: 220, h: 50, k: 'wall' }, { x: 680, y: 330, w: 220, h: 50, k: 'wall' },
     { x: 300, y: 140, w: 60, h: 60, k: 'pillar' }, { x: 840, y: 140, w: 60, h: 60, k: 'pillar' }],
    [{ x: 200, y: 200, w: 64, h: 64, k: 'pillar' }, { x: 936, y: 200, w: 64, h: 64, k: 'pillar' },
     { x: 200, y: 440, w: 64, h: 64, k: 'pillar' }, { x: 936, y: 440, w: 64, h: 64, k: 'pillar' }],
    [{ x: 380, y: 200, w: 110, h: 70, k: 'tomb' }, { x: 710, y: 200, w: 110, h: 70, k: 'tomb' },
     { x: 545, y: 430, w: 110, h: 70, k: 'tomb' }],
    [{ x: 150, y: 150, w: 70, h: 70, k: 'pillar' }, { x: 980, y: 150, w: 70, h: 70, k: 'pillar' },
     { x: 150, y: 480, w: 70, h: 70, k: 'pillar' }, { x: 980, y: 480, w: 70, h: 70, k: 'pillar' }]
  ];

  // Карты-навыки. cls: null = общие, иначе только для класса. max — сколько раз можно взять.
  const CARDS = [
    { id: 'dmg', icon: '⚔️', max: 5, name: L('Гостре лезо', 'Острое лезвие', 'Keen Edge', 'Scharfe Klinge'),
      desc: L('+20% шкоди', '+20% урона', '+20% damage', '+20% Schaden') },
    { id: 'rate', icon: '💨', max: 4, name: L('Швидкі руки', 'Быстрые руки', 'Quick Hands', 'Flinke Hände'),
      desc: L('Атаки на 15% частіше', 'Атаки на 15% чаще', 'Attacks 15% faster', 'Angriffe 15% schneller') },
    { id: 'hp', icon: '❤️', max: 5, name: L('Залізне серце', 'Железное сердце', 'Iron Heart', 'Eisenherz'),
      desc: L('+25% здоров’я і лікування', '+25% здоровья и лечение', '+25% max HP and heal', '+25% Leben und Heilung') },
    { id: 'speed', icon: '🥾', max: 3, name: L('Легкі чоботи', 'Лёгкие сапоги', 'Light Boots', 'Leichte Stiefel'),
      desc: L('+12% швидкості руху', '+12% скорости бега', '+12% move speed', '+12% Lauftempo') },
    { id: 'crit', icon: '🎯', max: 4, name: L('Слабке місце', 'Слабое место', 'Weak Spot', 'Schwachstelle'),
      desc: L('+12% шанс крита (×2 шкоди)', '+12% шанс крита (×2 урона)', '+12% crit chance (×2 damage)', '+12% Krit-Chance (×2 Schaden)') },
    { id: 'dashcd', icon: '🌀', max: 3, name: L('Тіньовий крок', 'Теневой шаг', 'Shadow Step', 'Schattenschritt'),
      desc: L('Ривок перезаряджається на 25% швидше', 'Рывок перезаряжается на 25% быстрее', 'Dash recharges 25% faster', 'Ausweichen lädt 25% schneller') },
    { id: 'orbit', icon: '🗡️', max: 3, name: L('Летючий клинок', 'Летающий клинок', 'Orbiting Blade', 'Kreisende Klinge'),
      desc: L('Клинок кружляє навколо тебе', 'Клинок кружит вокруг тебя', 'A blade circles around you', 'Eine Klinge kreist um dich') },
    { id: 'fire', icon: '🔥', max: 3, name: L('Вогняне лезо', 'Огненное лезвие', 'Flame Edge', 'Flammenklinge'),
      desc: L('Удари підпалюють ворогів', 'Удары поджигают врагов', 'Hits set enemies on fire', 'Treffer setzen Gegner in Brand') },
    { id: 'frost', icon: '❄️', max: 3, name: L('Крижане лезо', 'Ледяное лезвие', 'Frost Edge', 'Frostklinge'),
      desc: L('Удари сповільнюють ворогів', 'Удары замедляют врагов', 'Hits slow enemies', 'Treffer verlangsamen Gegner') },
    { id: 'leech', icon: '🩸', max: 3, name: L('Спрага', 'Жажда', 'Bloodthirst', 'Blutdurst'),
      desc: L('+3 здоров’я за кожне вбивство', '+3 здоровья за каждое убийство', '+3 HP per kill', '+3 Leben pro Kill') },
    { id: 'heal', icon: '✨', max: 99, name: L('Зілля', 'Зелье', 'Potion', 'Trank'),
      desc: L('Відновити 40% здоров’я', 'Восстановить 40% здоровья', 'Restore 40% HP', '40% Leben wiederherstellen') },
    { id: 'wave', icon: '🌙', max: 3, cls: 'guard', name: L('Хвиля клинка', 'Волна клинка', 'Blade Wave', 'Klingenwelle'),
      desc: L('Удар випускає хвилю, що летить крізь ворогів', 'Удар выпускает волну, летящую сквозь врагов', 'Swings launch a piercing wave', 'Hiebe entsenden eine durchdringende Welle') },
    { id: 'wide', icon: '🌗', max: 3, cls: 'guard', name: L('Широкий замах', 'Широкий замах', 'Wide Sweep', 'Weiter Schwung'),
      desc: L('Дуга удару ширша і довша', 'Дуга удара шире и длиннее', 'Wider and longer sweep', 'Breiterer, längerer Hieb') },
    { id: 'reflect', icon: '🛡️', max: 1, cls: 'guard', name: L('Дзеркальний щит', 'Зеркальный щит', 'Mirror Shield', 'Spiegelschild'),
      desc: L('Відбиті снаряди летять назад у ворогів', 'Отбитые снаряды летят обратно во врагов', 'Parried shots fly back at enemies', 'Abgewehrte Geschosse fliegen zurück') },
    { id: 'crush', icon: '💥', max: 2, cls: 'guard', name: L('Руйнування', 'Сокрушение', 'Crusher', 'Zermalmer'),
      desc: L('Супер заряджається швидше і б’є вибухом', 'Супер заряжается быстрее и бьёт взрывом', 'Super charges faster and ends in a blast', 'Super lädt schneller und endet mit Explosion') },
    { id: 'spin', icon: '🌪️', max: 1, cls: 'guard', name: L('Вихор', 'Вихрь', 'Whirlwind', 'Wirbelwind'),
      desc: L('Кожен третій удар — по колу', 'Каждый третий удар — по кругу', 'Every third swing hits all around', 'Jeder dritte Hieb trifft rundum') },
    { id: 'double_shot', icon: '🏹', max: 2, cls: 'ranger', name: L('Подвійний постріл', 'Двойной выстрел', 'Double Shot', 'Doppelschuss'),
      desc: L('+1 паралельна стріла під час атаки', '+1 параллельная стрела при атаке', '+1 parallel arrow per shot', '+1 paralleler Pfeil pro Schuss') },
    { id: 'pierce', icon: '🪡', max: 2, cls: 'ranger', name: L('Пробиття', 'Пронзание', 'Piercing', 'Durchschlag'),
      desc: L('Стріли проходять крізь +1 ціль', 'Стрелы пролетают сквозь +1 цель', 'Arrows pierce +1 extra target', 'Pfeile durchdringen +1 Ziel') },
    { id: 'r_poison', icon: '☠️', max: 3, cls: 'ranger', name: L('Отруйні стріли', 'Ядовитые стрелы', 'Venom Arrows', 'Giftpfeile'),
      desc: L('Стріли отруюють ворогів', 'Стрелы отравляют врагов', 'Arrows poison enemies', 'Pfeile vergiften Gegner') },
    { id: 'trap', icon: '🪤', max: 2, cls: 'ranger', name: L('Капкан', 'Капкан', 'Spike Trap', 'Stachelfalle'),
      desc: L('Ривок залишає шипи на 4 с', 'Рывок оставляет шипы на 4 с', 'Dash drops spikes for 4 s', 'Ausweichen legt 4 s Stacheln') },
    { id: 'eagle', icon: '🦅', max: 2, cls: 'ranger', name: L('Влучне око', 'Меткий глаз', 'Eagle Eye', 'Adlerauge'),
      desc: L('+крит і 100% крит далі 300', '+крит и гарант крит дальше 300', '+crit and guaranteed crit beyond 300', '+Krit und sicherer Krit über 300') },
    { id: 'chain', icon: '⚡', max: 2, cls: 'mage', name: L('Ланцюгова блискавка', 'Цепная молния', 'Chain Lightning', 'Kettenblitz'),
      desc: L('Влучання перескакує на 2 ворогів', 'Попадание перескакивает ещё на 2 врагов', 'Hits jump to 2 more enemies', 'Treffer springen auf 2 Gegner über') },
    { id: 'ice_nova', icon: '🧊', max: 2, cls: 'mage', name: L('Крижана нова', 'Ледяная нова', 'Frost Nova', 'Frostnova'),
      desc: L('Ривок заморожує ворогів навколо', 'Рывок замораживает врагов вокруг', 'Dash freezes nearby enemies', 'Ausweichen friert Gegner ein') },
    { id: 'big_ball', icon: '☄️', max: 3, cls: 'mage', name: L('Велика куля', 'Большой шар', 'Greater Orb', 'Große Kugel'),
      desc: L('+радіус вибуху вогняної кулі', '+радиус взрыва огненного шара', '+fireball explosion radius', '+Explosionsradius der Feuerkugel') },
    { id: 'mana_shield', icon: '🔮', max: 1, cls: 'mage', name: L('Мана-щит', 'Мана-щит', 'Mana Shield', 'Manaschild'),
      desc: L('Гасить один удар раз на 8 с', 'Гасит один удар раз в 8 с', 'Absorbs one hit every 8 s', 'Fängt alle 8 s einen Treffer ab') },
    { id: 'fire_trail', icon: '🌋', max: 2, cls: 'mage', name: L('Вогняний слід', 'Огненный след', 'Flame Trail', 'Feuerspur'),
      desc: L('За героєм горить підлога', 'За героем горит пол', 'Leave burning ground behind', 'Brennende Spur hinter dir') },
    { id: 'fan_knives', icon: '🔪', max: 2, cls: 'shade', name: L('Віяло кинджалів', 'Веер кинжалов', 'Fan of Knives', 'Messerfächer'),
      desc: L('+2 кинджали під час кидка', '+2 кинжала при броске', '+2 thrown daggers', '+2 Wurfdolche pro Angriff') },
    { id: 'bleed', icon: '🩸', max: 3, cls: 'shade', name: L('Кровотеча', 'Кровотечение', 'Bleeding', 'Blutung'),
      desc: L('Кинджали викликають кровотечу', 'Кинжалы вызывают кровотечение', 'Daggers inflict bleeding', 'Dolche verursachen Blutung') },
    { id: 'shadow_clone', icon: '👥', max: 2, cls: 'shade', name: L('Тіньовий двійник', 'Теневой двойник', 'Shadow Decoy', 'Schattenklon'),
      desc: L('Ривок залишає приманку на 2 с', 'Рывок оставляет приманку на 2 с', 'Dash leaves a decoy for 2 s', 'Ausweichen lässt 2 s ein Trugbild') },
    { id: 'exec_dash', icon: '💨', max: 1, cls: 'shade', name: L('Добивання', 'Добивание', 'Executioner', 'Hinrichtung'),
      desc: L('Убивство скидає перезарядку ривка', 'Убийство сбрасывает откат рывка', 'Kills reset dash cooldown', 'Kills setzen Ausweichen zurück') },
    { id: 's_poison', icon: '🧪', max: 3, cls: 'shade', name: L('Отруйні леза', 'Яд', 'Venom', 'Gift'),
      desc: L('Кинджали отруюють ворогів', 'Кинжалы отравляют врагов', 'Daggers poison enemies', 'Dolche vergiften Gegner') }
  ];

  // Короткие слова для холста.
  const WORDS = {
    room: L('КІМНАТА', 'КОМНАТА', 'ROOM', 'RAUM'),
    boss: L('БОС', 'БОСС', 'BOSS', 'BOSS'),
    block: L('БЛОК', 'БЛОК', 'BLOCK', 'BLOCK'),
    shield: L('ЩИТ', 'ЩИТ', 'SHIELD', 'SCHILD'),
    stealth: L('ТІНЬ', 'ТЕНЬ', 'STEALTH', 'TARNUNG'),
    crit: L('КРИТ', 'КРИТ', 'CRIT', 'KRIT'),
    lvl: L('НОВИЙ РІВЕНЬ', 'НОВЫЙ УРОВЕНЬ', 'LEVEL UP', 'LEVEL UP'),
    door: L('ПРОХІД ВІДКРИТО', 'ПРОХОД ОТКРЫТ', 'PATH OPEN', 'WEG OFFEN'),
    wave: L('ХВИЛЯ', 'ВОЛНА', 'WAVE', 'WELLE'),
    phase2: L('КОРОЛЬ ЛЮТУЄ', 'КОРОЛЬ В ЯРОСТИ', 'THE KING IS ENRAGED', 'DER KÖNIG TOBT'),
    heal: L('ЛІКУВАННЯ', 'ЛЕЧЕНИЕ', 'HEAL', 'HEILUNG')
  };

  global.RASKOL_DATA = { ROOM_W, ROOM_H, WALL, CLASSES, ENEMIES, BOSSES, CHAPTER1, LAYOUTS, CARDS, WORDS };
})(window);
