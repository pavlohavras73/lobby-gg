/* Shuttle Cruiser 2.0 — Data: galaxies, ships, 24 upgrade cards, 2 evolutions, 4 languages */
(function (global) {
  'use strict';

  const GALAXIES = [
    {
      id: 1,
      unlocked: true,
      palette: { bg1: '#050916', bg2: '#0d1b36', accent: '#38bdf8', neb: 'rgba(56,189,248,0.14)' },
      feature: 'asteroids',
      sectors: 10,
      name: { uk: 'Пояс Уламків', ru: 'Пояс Обломков', en: 'Debris Belt', de: 'Trümmergürtel' },
      desc: {
        uk: 'Руйнівні астероїди та патрулі рейдерів. Сектор 5 — міні-бос, 10 — Титан Пояса.',
        ru: 'Разрушаемые астероиды и патрули рейдеров. Сектор 5 — мини-босс, 10 — Титан Пояса.',
        en: 'Destructible asteroids and raider patrols. Sector 5 mini-boss, Sector 10 Belt Titan.',
        de: 'Zerstörbare Asteroiden und Plünderer. Sektor 5 Mini-Boss, Sektor 10 Gürtel-Titan.'
      }
    },
    {
      id: 2,
      unlocked: false,
      palette: { bg1: '#150612', bg2: '#2d0a1f', accent: '#fb7185', neb: 'rgba(251,113,133,0.16)' },
      feature: 'nebula',
      sectors: 10,
      name: { uk: 'Багряна туманність', ru: 'Алая туманность', en: 'Crimson Nebula', de: 'Purpurnebel' },
      desc: {
        uk: 'Хмари туманності ховають ворожі кулі.',
        ru: 'Облака туманности прячут вражеские пули.',
        en: 'Nebula clouds conceal incoming bullets.',
        de: 'Nebelwolken verbergen feindliche Geschosse.'
      }
    },
    {
      id: 3,
      unlocked: false,
      palette: { bg1: '#05131c', bg2: '#0b2b3d', accent: '#67e8f9', neb: 'rgba(103,232,249,0.15)' },
      feature: 'ice',
      sectors: 10,
      name: { uk: 'Крижані кільця', ru: 'Ледяные кольца', en: 'Ice Rings', de: 'Eisringe' },
      desc: {
        uk: 'Крижані поля сповільнюють корабель.',
        ru: 'Ледяные поля замедляют корабль.',
        en: 'Frozen fields slow down your ship.',
        de: 'Eisfelder verlangsamen dein Schiff.'
      }
    },
    {
      id: 4,
      unlocked: false,
      palette: { bg1: '#121306', bg2: '#25290a', accent: '#a3e635', neb: 'rgba(163,230,53,0.14)' },
      feature: 'hive',
      sectors: 10,
      name: { uk: 'Вулик', ru: 'Улей', en: 'The Hive', de: 'Der Schwarm' },
      desc: {
        uk: 'Гнізда випускають рій, доки їх не знищиш.',
        ru: 'Гнёзда спавнят рой, пока их не уничтожишь.',
        en: 'Nests spawn swarmers until destroyed.',
        de: 'Nester brüten Drohnen, bis du sie zerstörst.'
      }
    },
    {
      id: 5,
      unlocked: false,
      palette: { bg1: '#0c0518', bg2: '#1f0b3a', accent: '#c084fc', neb: 'rgba(192,132,252,0.16)' },
      feature: 'gravity',
      sectors: 10,
      name: { uk: 'Горизонт подій', ru: 'Горизонт событий', en: 'Event Horizon', de: 'Ereignishorizont' },
      desc: {
        uk: 'Гравітаційний колодязь тягне корабель і кулі.',
        ru: 'Гравитационный колодец тянет корабль и пули.',
        en: 'Gravity well pulls ship and bullets.',
        de: 'Gravitationsbrunnen zieht Schiff und Schüsse an.'
      }
    }
  ];

  const SHIPS = [
    {
      id: 'spark',
      playable: true,
      cost: 0,
      color: '#38bdf8',
      glow: '#0284c7',
      hp: 100,
      speed: 335,
      dmg: 14,
      fireRate: 5.5,
      crit: 0.08,
      abilityCd: 5.0,
      name: { uk: 'Іскра', ru: 'Искра', en: 'Spark', de: 'Funke' },
      abilityName: { uk: 'Імпульсний ривок', ru: 'Импульсный рывок', en: 'Impulse Dash', de: 'Impuls-Schub' },
      abilityDesc: {
        uk: 'Короткий ривок із невразливістю 0.45 с та ударною хвилею.',
        ru: 'Короткий рывок с неуязвимостью 0.45 с и ударной волной.',
        en: 'Short dash with 0.45s invulnerability and shockwave.',
        de: 'Kurzer Schub mit 0,45 s Unverwundbarkeit und Schockwelle.'
      }
    },
    {
      id: 'bastion',
      playable: true,
      cost: 180,
      unlockSector: 5,
      color: '#f59e0b',
      glow: '#d97706',
      hp: 165,
      speed: 260,
      dmg: 19,
      fireRate: 4.3,
      crit: 0.05,
      abilityCd: 11.0,
      name: { uk: 'Бастіон', ru: 'Бастион', en: 'Bastion', de: 'Bastion' },
      abilityName: { uk: 'Купол-щит', ru: 'Купол-щит', en: 'Dome Shield', de: 'Kuppelschild' },
      abilityDesc: {
        uk: 'Непробивний купол на 3 с, що знищує ворожі кулі.',
        ru: 'Непробиваемый купол на 3 с, уничтожающий вражеские пули.',
        en: '3s impenetrable dome that vaporizes enemy bullets.',
        de: '3 s undurchdringliche Kuppel, die Geschosse zerstört.'
      }
    },
    {
      id: 'sting', playable: false, cost: 400, color: '#f43f5e', glow: '#be123c', hp: 80, speed: 390, dmg: 15, fireRate: 6.4, crit: 0.22, abilityCd: 9,
      name: { uk: 'Жало', ru: 'Жало', en: 'Sting', de: 'Stachel' },
      abilityName: { uk: 'Перегрів', ru: 'Перегрев', en: 'Overdrive', de: 'Überhitzung' },
      abilityDesc: { uk: '×2 скорострільність.', ru: '×2 скорострельность.', en: '×2 fire rate.', de: '×2 Feuerrate.' }
    },
    {
      id: 'hive', playable: false, cost: 650, color: '#a3e635', glow: '#65a30d', hp: 120, speed: 295, dmg: 10, fireRate: 4.5, crit: 0.06, abilityCd: 12,
      name: { uk: 'Носій', ru: 'Улей-носитель', en: 'Carrier', de: 'Träger' },
      abilityName: { uk: 'Рій дронів', ru: 'Рой дронов', en: 'Drone Swarm', de: 'Drohnenschwarm' },
      abilityDesc: { uk: 'Виклик рою дронів.', ru: 'Вызов роя дронов.', en: 'Summons drone swarm.', de: 'Ruft Drohnenschwarm.' }
    },
    {
      id: 'phantom', playable: false, cost: 900, color: '#c084fc', glow: '#7e22ce', hp: 95, speed: 360, dmg: 17, fireRate: 5.2, crit: 0.14, abilityCd: 10,
      name: { uk: 'Фантом', ru: 'Фантом', en: 'Phantom', de: 'Phantom' },
      abilityName: { uk: 'Невидимість', ru: 'Невидимость', en: 'Cloak', de: 'Tarnung' },
      abilityDesc: { uk: 'Вороги втрачають ціль.', ru: 'Враги теряют цель.', en: 'Enemies lose lock.', de: 'Gegner verlieren Ziel.' }
    },
    {
      id: 'nova', playable: false, cost: 1300, color: '#fb7185', glow: '#e11d48', hp: 135, speed: 310, dmg: 22, fireRate: 4.8, crit: 0.12, abilityCd: 15,
      name: { uk: 'Наднова', ru: 'Сверхновая', en: 'Supernova', de: 'Supernova' },
      abilityName: { uk: 'Бомба-спалах', ru: 'Бомба по экрану', en: 'Nova Bomb', de: 'Nova-Bombe' },
      abilityDesc: { uk: 'Заряджаємий вибух екрана.', ru: 'Заряжаемая бомба по экрану.', en: 'Screen-clearing blast.', de: 'Bildschirm-Explosion.' }
    }
  ];

  // 24 Upgrade Cards
  const CARDS = [
    // Weapons (9)
    {
      id: 'twin', slot: 'weapon', rarity: 'common', icon: '⚡',
      name: { uk: 'Подвійний залп', ru: 'Двойной залп', en: 'Twin Volley', de: 'Doppelsalve' },
      desc: {
        uk: ['+1 паралельна куля', '+2 паралельні кулі', '+3 паралельні кулі'],
        ru: ['+1 параллельная пуля', '+2 параллельные пули', '+3 параллельные пули'],
        en: ['+1 parallel shot', '+2 parallel shots', '+3 parallel shots'],
        de: ['+1 Parallelschuss', '+2 Parallelschüsse', '+3 Parallelschüsse']
      }
    },
    {
      id: 'fan', slot: 'weapon', rarity: 'common', icon: '🔱', synergy: 'fire',
      name: { uk: 'Віяловий залп', ru: 'Веер', en: 'Spread Fan', de: 'Fächerschuss' },
      desc: {
        uk: ['+2 кулі під кутом', '+3 кулі під кутом', '+4 кулі під кутом'],
        ru: ['+2 пули под углом', '+3 пули под углом', '+4 пули под углом'],
        en: ['+2 angled shots', '+3 angled shots', '+4 angled shots'],
        de: ['+2 Winkelschüsse', '+3 Winkelschüsse', '+4 Winkelschüsse']
      }
    },
    {
      id: 'pierce', slot: 'weapon', rarity: 'rare', icon: '🗡',
      name: { uk: 'Пробивання', ru: 'Пробивание', en: 'Armor Pierce', de: 'Durchschlag' },
      desc: {
        uk: ['Кулі пробивають 1 ціль', 'Кулі пробивають 2 цілі', 'Кулі пробивають 3 цілі'],
        ru: ['Пули пробивают 1 цель', 'Пули пробивают 2 цели', 'Пули пробивают 3 цели'],
        en: ['Shots pierce 1 enemy', 'Shots pierce 2 enemies', 'Shots pierce 3 enemies'],
        de: ['Durchschlägt 1 Ziel', 'Durchschlägt 2 Ziele', 'Durchschlägt 3 Ziele']
      }
    },
    {
      id: 'ricochet', slot: 'weapon', rarity: 'rare', icon: '🎱',
      name: { uk: 'Рикошет', ru: 'Рикошет', en: 'Ricochet', de: 'Abpraller' },
      desc: {
        uk: ['1 відскок від стінок', '2 відскоки від стінок', '3 відскоки від стінок'],
        ru: ['1 отскок от стенок', '2 отскока от стенок', '3 отскока от стенок'],
        en: ['1 wall bounce', '2 wall bounces', '3 wall bounces'],
        de: ['1 Wand-Abpraller', '2 Wand-Abpraller', '3 Wand-Abpraller']
      }
    },
    {
      id: 'homing', slot: 'weapon', rarity: 'epic', icon: '🚀',
      name: { uk: 'Самонавідні ракети', ru: 'Ракеты', en: 'Homing Missiles', de: 'Lenkraketen' },
      desc: {
        uk: ['1 ракета раз на 3.5 с', '2 ракети раз на 2.8 с', '3 ракети раз на 2.2 с'],
        ru: ['1 ракета раз в 3.5 с', '2 ракеты раз в 2.8 с', '3 ракеты раз в 2.2 с'],
        en: ['1 missile every 3.5s', '2 missiles every 2.8s', '3 missiles every 2.2s'],
        de: ['1 Rakete alle 3,5 s', '2 Raketen alle 2,8 s', '3 Raketen alle 2,2 s']
      }
    },
    {
      id: 'rear', slot: 'weapon', rarity: 'common', icon: '🔙',
      name: { uk: 'Кормова гармата', ru: 'Задняя пушка', en: 'Rear Cannon', de: 'Heckkanone' },
      desc: {
        uk: ['Постріл назад (70% шкоди)', 'Постріл назад (95% шкоди)', 'Подвійний постріл назад (120%)'],
        ru: ['Выстрел назад (70% урона)', 'Выстрел назад (95% урона)', 'Двойной выстрел назад (120%)'],
        en: ['Fires backward (70% dmg)', 'Fires backward (95% dmg)', 'Twin rear shot (120%)'],
        de: ['Schuss nach hinten (70%)', 'Schuss nach hinten (95%)', 'Doppelschuss hinten (120%)']
      }
    },
    {
      id: 'laser', slot: 'weapon', rarity: 'epic', icon: '🔦',
      name: { uk: 'Імпульсний промінь', ru: 'Лазерный луч', en: 'Pulse Laser', de: 'Impulslaser' },
      desc: {
        uk: ['Промінь кожні 4.5 с', 'Ширший промінь кожні 3.5 с', 'Потужний промінь кожні 2.6 с'],
        ru: ['Луч каждые 4.5 с', 'Шире луч каждые 3.5 с', 'Мощный луч каждые 2.6 с'],
        en: ['Beam every 4.5s', 'Wide beam every 3.5s', 'Heavy beam every 2.6s'],
        de: ['Strahl alle 4,5 s', 'Breiter Strahl alle 3,5 s', 'Starker Strahl alle 2,6 s']
      }
    },
    {
      id: 'blades', slot: 'weapon', rarity: 'rare', icon: '💠',
      name: { uk: 'Орбітальні леза', ru: 'Орбитальные лезвия', en: 'Orbital Blades', de: 'Orbitalklingen' },
      desc: {
        uk: ['2 леза навколо корабля', '3 леза навколо корабля', '4 швидкі леза навколо корабля'],
        ru: ['2 лезвия вокруг корабля', '3 лезвия вокруг корабля', '4 быстрых лезвия вокруг'],
        en: ['2 orbiting blades', '3 orbiting blades', '4 fast orbiting blades'],
        de: ['2 rotierende Klingen', '3 rotierende Klingen', '4 schnelle Klingen']
      }
    },
    {
      id: 'drone', slot: 'weapon', rarity: 'legendary', icon: '🛰',
      name: { uk: 'Дрон-напарник', ru: 'Дрон-напарник', en: 'Wingman Drone', de: 'Begleitdrohne' },
      desc: {
        uk: ['1 автономний дрон', '2 автономні дрони', '3 бойові дрони'],
        ru: ['1 автономный дрон', '2 автономных дрона', '3 боевых дрона'],
        en: ['1 autonomous drone', '2 autonomous drones', '3 combat drones'],
        de: ['1 Kampfdrohne', '2 Kampfdrohnen', '3 Kampfdrohnen']
      }
    },
    // Elements (4)
    {
      id: 'fire', slot: 'passive', rarity: 'rare', icon: '🔥', synergy: 'fan',
      name: { uk: 'Плазмовий вогонь', ru: 'Огонь', en: 'Plasma Fire', de: 'Plasmafeuer' },
      desc: {
        uk: ['Підпал: 8 шкоди/с за 3 с', 'Підпал: 14 шкоди/с за 3 с', 'Підпал: 22 шкоди/с за 3 с'],
        ru: ['Поджог: 8 урона/с за 3 с', 'Поджог: 14 урона/с за 3 с', 'Поджог: 22 урона/с за 3 с'],
        en: ['Burn: 8 dmg/s for 3s', 'Burn: 14 dmg/s for 3s', 'Burn: 22 dmg/s for 3s'],
        de: ['Brand: 8 Sch/s für 3 s', 'Brand: 14 Sch/s für 3 s', 'Brand: 22 Sch/s für 3 s']
      }
    },
    {
      id: 'ice', slot: 'passive', rarity: 'rare', icon: '❄️', synergy: 'lightning',
      name: { uk: 'Кріо-заряди', ru: 'Лёд', en: 'Cryo Rounds', de: 'Kryo-Munition' },
      desc: {
        uk: ['Сповільнення ворогів на 25%', 'Сповільнення на 40%', 'Заморожує ворога на 1.2 с'],
        ru: ['Замедление врагов на 25%', 'Замедление на 40%', 'Заморозка врага на 1.2 с'],
        en: ['Slows enemies by 25%', 'Slows by 40%', 'Freezes enemy for 1.2s'],
        de: ['Verlangsamt Gegner um 25%', 'Verlangsamt um 40%', 'Friert Gegner 1,2 s ein']
      }
    },
    {
      id: 'lightning', slot: 'passive', rarity: 'epic', icon: '🌩', synergy: 'ice',
      name: { uk: 'Тесла-дуга', ru: 'Молния', en: 'Chain Lightning', de: 'Kettenblitz' },
      desc: {
        uk: ['Ланцюг блискавки на 2 цілі', 'Ланцюг на 3 цілі', 'Ланцюг на 4 цілі (+50% шкоди)'],
        ru: ['Цепь молнии на 2 цели', 'Цепь на 3 цели', 'Цепь на 4 цели (+50% урона)'],
        en: ['Arcs to 2 enemies', 'Arcs to 3 enemies', 'Arcs to 4 enemies (+50% dmg)'],
        de: ['Springt auf 2 Ziele', 'Springt auf 3 Ziele', 'Springt auf 4 Ziele (+50%)']
      }
    },
    {
      id: 'acid', slot: 'passive', rarity: 'common', icon: '🧪',
      name: { uk: 'Кислотні снаряди', ru: 'Кислота', en: 'Acid Rounds', de: 'Säuregeschosse' },
      desc: {
        uk: ['Ворог отримує +15% шкоди', 'Ворог отримує +25% шкоди', 'Ворог отримує +40% шкоди'],
        ru: ['Враг получает +15% урона', 'Враг получает +25% урона', 'Враг получает +40% урона'],
        en: ['Target takes +15% dmg', 'Target takes +25% dmg', 'Target takes +40% dmg'],
        de: ['Ziel erleidet +15% Schaden', 'Ziel erleidet +25% Schaden', 'Ziel erleidet +40% Schaden']
      }
    },
    // Defense (5)
    {
      id: 'shield', slot: 'passive', rarity: 'epic', icon: '🛡',
      name: { uk: 'Аварійний щит', ru: 'Щит на 2 с', en: 'Aegis Shield', de: 'Notfall-Schild' },
      desc: {
        uk: ['Щит на 2 с кожні 14 с', 'Щит на 2 с кожні 11 с', 'Щит на 2.5 с кожні 8 с'],
        ru: ['Щит на 2 с каждые 14 с', 'Щит на 2 с каждые 11 с', 'Щит на 2.5 с каждые 8 с'],
        en: ['2s shield every 14s', '2s shield every 11s', '2.5s shield every 8s'],
        de: ['2 s Schild alle 14 s', '2 s Schild alle 11 s', '2,5 s Schild alle 8 s']
      }
    },
    {
      id: 'hull', slot: 'passive', rarity: 'common', icon: '🔩',
      name: { uk: 'Титанова обшивка', ru: 'Броня корпуса', en: 'Titanium Hull', de: 'Titan-Hülle' },
      desc: {
        uk: ['+25 макс. HP і лікування', '+50 макс. HP і лікування', '+80 макс. HP і повний ремонт'],
        ru: ['+25 макс. HP и лечение', '+50 макс. HP и лечение', '+80 макс. HP и полный ремонт'],
        en: ['+25 max HP & heal', '+50 max HP & heal', '+80 max HP & full repair'],
        de: ['+25 Max-HP & Heilung', '+50 Max-HP & Heilung', '+80 Max-HP & Reparatur']
      }
    },
    {
      id: 'regen', slot: 'passive', rarity: 'rare', icon: '💚',
      name: { uk: 'Нано-ремонт', ru: 'Регенерация', en: 'Nano Repair', de: 'Nano-Reparatur' },
      desc: {
        uk: ['Відновлює 1.5 HP/с', 'Відновлює 3 HP/с', 'Відновлює 5 HP/с'],
        ru: ['Восстанавливает 1.5 HP/с', 'Восстанавливает 3 HP/с', 'Восстанавливает 5 HP/с'],
        en: ['Restores 1.5 HP/s', 'Restores 3 HP/s', 'Restores 5 HP/s'],
        de: ['Heilt 1,5 HP/s', 'Heilt 3 HP/s', 'Heilt 5 HP/s']
      }
    },
    {
      id: 'phase', slot: 'passive', rarity: 'rare', icon: '👻',
      name: { uk: 'Фазовий зсув', ru: 'Уклонение', en: 'Phase Dodge', de: 'Phasenausweich' },
      desc: {
        uk: ['10% шанс ухилитися від кулі', '18% шанс ухилитися', '25% шанс ухилитися'],
        ru: ['10% шанс уклонения', '18% шанс уклонения', '25% шанс уклонения'],
        en: ['10% dodge chance', '18% dodge chance', '25% dodge chance'],
        de: ['10% Ausweichchance', '18% Ausweichchance', '25% Ausweichchance']
      }
    },
    {
      id: 'dash_cd', slot: 'passive', rarity: 'common', icon: '🔋',
      name: { uk: 'Турбо-конденсатор', ru: 'Охлаждение модуля', en: 'Turbo Capacitor', de: 'Turbokondensator' },
      desc: {
        uk: ['Здатність на 18% швидше', 'Здатність на 30% швидше', 'Здатність на 42% швидше'],
        ru: ['Способность на 18% быстрее', 'Способность на 30% быстрее', 'Способность на 42% быстрее'],
        en: ['Ability 18% faster CD', 'Ability 30% faster CD', 'Ability 42% faster CD'],
        de: ['Fähigkeit 18% schneller', 'Fähigkeit 30% schneller', 'Fähigkeit 42% schneller']
      }
    },
    // Utilities (6)
    {
      id: 'magnet', slot: 'passive', rarity: 'common', icon: '🧲',
      name: { uk: 'Граві-магніт', ru: 'Магнит опыта', en: 'XP Magnet', de: 'EP-Magnet' },
      desc: {
        uk: ['+65% радіус збору кристалів', '+130% радіус збору', '+210% радіус (майже весь екран)'],
        ru: ['+65% радиус сбора кристаллов', '+130% радиус сбора', '+210% радиус (почти весь экран)'],
        en: ['+65% crystal pickup range', '+130% pickup range', '+210% pickup range'],
        de: ['+65% Sammelradius', '+130% Sammelradius', '+210% Sammelradius']
      }
    },
    {
      id: 'crit', slot: 'passive', rarity: 'rare', icon: '🎯',
      name: { uk: 'Квантовий приціл', ru: 'Крит-прицел', en: 'Quantum Scope', de: 'Quantenvisier' },
      desc: {
        uk: ['+12% шанс крита (×2)', '+22% шанс крита (×2)', '+32% шанс крита (×2.2)'],
        ru: ['+12% шанс крита (×2)', '+22% шанс крита (×2)', '+32% шанс крита (×2.2)'],
        en: ['+12% crit chance (×2)', '+22% crit chance (×2)', '+32% crit chance (×2.2)'],
        de: ['+12% Krit-Chance (×2)', '+22% Krit-Chance (×2)', '+32% Krit-Chance (×2,2)']
      }
    },
    {
      id: 'haste', slot: 'passive', rarity: 'common', icon: '⏩',
      name: { uk: 'Прискорювач вогню', ru: 'Скорострельность', en: 'Rapid Loader', de: 'Schnelllader' },
      desc: {
        uk: ['+18% швидкості стрільби', '+32% швидкості стрільби', '+48% швидкості стрільби'],
        ru: ['+18% скорострельности', '+32% скорострельности', '+48% скорострельности'],
        en: ['+18% fire rate', '+32% fire rate', '+48% fire rate'],
        de: ['+18% Feuerrate', '+32% Feuerrate', '+48% Feuerrate']
      }
    },
    {
      id: 'power', slot: 'passive', rarity: 'rare', icon: '💥',
      name: { uk: 'Перевантаження ядер', ru: 'Усиление ядер', en: 'Core Overcharge', de: 'Kernüberladung' },
      desc: {
        uk: ['+20% шкоди всіх атак', '+38% шкоди всіх атак', '+58% шкоди всіх атак'],
        ru: ['+20% урона всех атак', '+38% урона всех атак', '+58% урона всех атак'],
        en: ['+20% all damage', '+38% all damage', '+58% all damage'],
        de: ['+20% Gesamtschaden', '+38% Gesamtschaden', '+58% Gesamtschaden']
      }
    },
    {
      id: 'vamp', slot: 'passive', rarity: 'legendary', icon: '🩸',
      name: { uk: 'Вампіризм кристалів', ru: 'Вампиризм', en: 'Crystal Leech', de: 'Kristallraub' },
      desc: {
        uk: ['12% шанс +2 HP за кристал', '22% шанс +2 HP за кристал', '35% шанс +3 HP за кристал'],
        ru: ['12% шанс +2 HP за кристалл', '22% шанс +2 HP за кристалл', '35% шанс +3 HP за кристалл'],
        en: ['12% chance +2 HP per gem', '22% chance +2 HP per gem', '35% chance +3 HP per gem'],
        de: ['12% Chance +2 HP/Kristall', '22% Chance +2 HP/Kristall', '35% Chance +3 HP/Kristall']
      }
    },
    {
      id: 'greed', slot: 'passive', rarity: 'common', icon: '✨',
      name: { uk: 'Мисливець за пилом', ru: 'Охотник за пылью', en: 'Stardust Hunter', de: 'Sternenstaub-Jäger' },
      desc: {
        uk: ['+25% досвіду і пилу', '+50% досвіду і пилу', '+80% досвіду і пилу'],
        ru: ['+25% опыта и пыли', '+50% опыта и пыли', '+80% опыта и пыли'],
        en: ['+25% XP and stardust', '+50% XP and stardust', '+80% XP and stardust'],
        de: ['+25% EP und Sternenstaub', '+50% EP und Sternenstaub', '+80% EP und Sternenstaub']
      }
    }
  ];

  // 2 Evolutions in Stage 6a
  const EVOLUTIONS = [
    {
      id: 'firestorm',
      req: ['fan', 'fire'],
      icon: '🌋',
      rarity: 'legendary',
      name: { uk: 'Вогняний шторм', ru: 'Огненный шторм', en: 'Firestorm', de: 'Feuersturm' },
      desc: {
        uk: 'ЕВОЛЮЦІЯ: 7 палаючих куль віялом + потрійне горіння!',
        ru: 'ЭВОЛЮЦИЯ: 7 пылающих пуль веером + тройное горение!',
        en: 'EVOLUTION: 7 blazing fan shots + triple burn!',
        de: 'EVOLUTION: 7 lodernde Fächerschüsse + Dreifach-Brand!'
      }
    },
    {
      id: 'cryo_arc',
      req: ['ice', 'lightning'],
      icon: '💠⚡',
      rarity: 'legendary',
      name: { uk: 'Буря стазису', ru: 'Буря стазиса', en: 'Stasis Tempest', de: 'Stasis-Sturm' },
      desc: {
        uk: 'ЕВОЛЮЦІЯ: крижана блискавка на 6 цілей із заморозкою!',
        ru: 'ЭВОЛЮЦИЯ: ледяная молния на 6 целей с заморозкой!',
        en: 'EVOLUTION: cryo chain lightning to 6 foes with freeze!',
        de: 'EVOLUTION: Kryo-Kettenblitz auf 6 Gegner mit Einfrieren!'
      }
    }
  ];

  global.SHUTTLE_DATA = { GALAXIES, SHIPS, CARDS, EVOLUTIONS };
})(window);
