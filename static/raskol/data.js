/* Раскол — данные: классы, враги, боссы, карты-навыки, комнаты главы 1 (Склеп). Тексты на 4 языках. */
(function (global) {
  'use strict';
  const L = (uk, ru, en, de) => ({ uk, ru, en, de });

  // Размер арены (внутренняя часть, без стен) в мировых единицах.
  const ROOM_W = 1200, ROOM_H = 700, WALL = 80;

  const CLASSES = {
    guard: {
      id: 'guard', color: '#f59e0b', unlocked: true,
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
      id: 'ranger', color: '#22c55e', unlocked: false,
      name: L('Слідопит', 'Следопыт', 'Ranger', 'Waldläufer'),
      role: L('Дальній бій · рикошет', 'Дальний бой · рикошет', 'Ranged · ricochet', 'Fernkampf · Abpraller')
    },
    mage: {
      id: 'mage', color: '#a855f7', unlocked: false,
      name: L('Маг', 'Маг', 'Mage', 'Magier'),
      role: L('Магія по площі', 'Магия по площади', 'Area magic', 'Flächenmagie')
    },
    shade: {
      id: 'shade', color: '#38bdf8', unlocked: false,
      name: L('Тінь', 'Тень', 'Shade', 'Schatten'),
      role: L('Крити · невидимість', 'Криты · невидимость', 'Crits · stealth', 'Krits · Tarnung')
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
      desc: L('Кожен третій удар — по колу', 'Каждый третий удар — по кругу', 'Every third swing hits all around', 'Jeder dritte Hieb trifft rundum') }
  ];

  // Короткие слова для холста.
  const WORDS = {
    room: L('КІМНАТА', 'КОМНАТА', 'ROOM', 'RAUM'),
    boss: L('БОС', 'БОСС', 'BOSS', 'BOSS'),
    block: L('БЛОК', 'БЛОК', 'BLOCK', 'BLOCK'),
    crit: L('КРИТ', 'КРИТ', 'CRIT', 'KRIT'),
    lvl: L('НОВИЙ РІВЕНЬ', 'НОВЫЙ УРОВЕНЬ', 'LEVEL UP', 'LEVEL UP'),
    door: L('ПРОХІД ВІДКРИТО', 'ПРОХОД ОТКРЫТ', 'PATH OPEN', 'WEG OFFEN'),
    wave: L('ХВИЛЯ', 'ВОЛНА', 'WAVE', 'WELLE'),
    phase2: L('КОРОЛЬ ЛЮТУЄ', 'КОРОЛЬ В ЯРОСТИ', 'THE KING IS ENRAGED', 'DER KÖNIG TOBT'),
    heal: L('ЛІКУВАННЯ', 'ЛЕЧЕНИЕ', 'HEAL', 'HEILUNG')
  };

  global.RASKOL_DATA = { ROOM_W, ROOM_H, WALL, CLASSES, ENEMIES, BOSSES, CHAPTER1, LAYOUTS, CARDS, WORDS };
})(window);
