const fs = require('fs');
const path = require('path');

const res = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'resolved_characters_verified.json'), 'utf-8'));

function getC(name, role) {
  const c = res[name];
  if (!c) {
    console.warn('MISSING IN VERIFIED MAP:', name);
    return { id: 0, name, russian: name, role, image: '' };
  }
  return {
    id: c.id,
    name: c.name,
    russian: c.russian || c.name,
    role,
    image: c.image
  };
}

const pairs = [
  // ==========================================
  // MOTHER AND SON (👑 Мать и сын)
  // ==========================================
  {
    id: 'ms-1',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Linlin Charlotte', 'Мать (Биг Мам)'),
    char2: getC('Katakuri Charlotte', 'Сын (2-й сын семьи)'),
    note: 'Шарлотта Линлин — биологическая мать Шарлотты Катакури и верховная правительница Тотлэнда.'
  },
  {
    id: 'ms-2',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Linlin Charlotte', 'Мать (Биг Мам)'),
    char2: getC('Perospero Charlotte', 'Сын (Старший сын)'),
    note: 'Старший сын семьи Шарлотта и министр сладостей Тотлэнда.'
  },
  {
    id: 'ms-3',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Linlin Charlotte', 'Мать (Биг Мам)'),
    char2: getC('Cracker Charlotte', 'Сын (10-й сын)'),
    note: 'Конфетный генерал и министр печенья Тотлэнда.'
  },
  {
    id: 'ms-4',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Kushina Uzumaki', 'Мать'),
    char2: getC('Naruto Uzumaki', 'Сын'),
    note: 'Кушина пожертвовала жизнью, запечатав девятихвостого лиса Кураму в своего новорождённого сына Наруто.'
  },
  {
    id: 'ms-5',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Masaki Kurosaki', 'Мать'),
    char2: getC('Ichigo Kurosaki', 'Сын'),
    note: 'Чистокровная квинси Масаки защитила Ичиго от Великого Удильщика ценой собственной жизни.'
  },
  {
    id: 'ms-6',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Chi-Chi', 'Мать'),
    char2: getC('Son Gohan', 'Сын'),
    note: 'Строгая и любящая мать, воспитавшая Гохана учёным и сильнейшим защитником Земли.'
  },
  {
    id: 'ms-7',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Attack on Titan',
    animeRu: 'Атака титанов',
    char1: getC('Carla Yeager', 'Мать'),
    char2: getC('Eren Yeager', 'Сын'),
    note: 'Гибель Карлы при падении стены Мария стала ключевым мотивом Эрена истребить всех титанов.'
  },
  {
    id: 'ms-8',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'My Hero Academia',
    animeRu: 'Моя геройская академия',
    char1: getC('Inko Midoriya', 'Мать'),
    char2: getC('Izuku Midoriya', 'Сын (Деку)'),
    note: 'Заботливая мать Идзуку, искренне переживающая за каждый бой и тренировку сына.'
  },
  {
    id: 'ms-9',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Fullmetal Alchemist',
    animeRu: 'Стальной алхимик',
    char1: getC('Trisha Elric', 'Мать'),
    char2: getC('Edward Elric', 'Сын'),
    note: 'Попытка воскресить умершую мать Тришу с помощью запретной алхимии изменила судьбу братьев Элрик.'
  },
  {
    id: 'ms-10',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Vinland Saga',
    animeRu: 'Сага о Винланде',
    char1: getC('Helga', 'Мать'),
    char2: getC('Thorfinn', 'Сын'),
    note: 'Хельга — мать Торфинна и дочь вождя йомсвикингов Сигвальди.'
  },
  {
    id: 'ms-11',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Neon Genesis Evangelion',
    animeRu: 'Евангелион',
    char1: getC('Yui Ikari', 'Мать'),
    char2: getC('Shinji Ikari', 'Сын'),
    note: 'Душа Юи Икари навеки запечатана внутри Евы-01, защищая Синдзи.'
  },
  {
    id: 'ms-12',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Gintama',
    animeRu: 'Гинтама',
    char1: getC('Kouka', 'Мать'),
    char2: getC('Kamui', 'Сын'),
    note: 'Кока — мать Камуи и Кагуры, бессмертная мутация Альтана с планеты Коан.'
  },
  {
    id: 'ms-13',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'Oshi no Ko',
    animeRu: 'Звёздное дитя',
    char1: getC('Ai Hoshino', 'Мать (Легендарный айдол)'),
    char2: getC('Aquamarine Hoshino', 'Сын'),
    note: 'Ай скрывала рождение близнецов от прессы, подарив сыну Аквамарину всю свою материнскую любовь.'
  },
  {
    id: 'ms-14',
    tags: ['mother_son'],
    relationLabel: '👑 Мать ⇆ 👶 Сын',
    anime: 'My Hero Academia',
    animeRu: 'Моя геройская академия',
    char1: getC('Rei Todoroki', 'Мать'),
    char2: getC('Shoto Todoroki', 'Сын'),
    note: 'Рэй Тодороки пережила тяжёлые годы семейной тирании, но восстановила душевную связь с сыном Сёто.'
  },

  // ==========================================
  // FATHER AND SON (⚡ Отец и сын)
  // ==========================================
  {
    id: 'fs-1',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Minato Namikaze', 'Отец (Четвёртый Хокаге)'),
    char2: getC('Naruto Uzumaki', 'Сын (Седьмой Хокаге)'),
    note: '«Жёлтая молния Конохи» Минато верил, что его сын овладеет силой девятихвостого и спасёт мир шиноби.'
  },
  {
    id: 'fs-2',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Isshin Kurosaki', 'Отец (Бывший капитан Сиба)'),
    char2: getC('Ichigo Kurosaki', 'Сын'),
    note: 'Иссин скрывал своё прошлое капитана 10-го отряда Готей 13, обучив Ичиго финальной Гэцуге Тэнсё.'
  },
  {
    id: 'fs-3',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Son Goku', 'Отец'),
    char2: getC('Son Gohan', 'Сын'),
    note: 'Гоку тренировал Гохана в Гиперболической комнате времени, пробудив в сыне Супер Сайяна 2 против Селла.'
  },
  {
    id: 'fs-4',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Son Goku', 'Отец'),
    char2: getC('Son Goten', 'Младший сын'),
    note: 'Готэн родился похожим на отца Гоку как две капли воды и освоил супер сайяна с раннего детства.'
  },
  {
    id: 'fs-5',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Dragon Monkey D.', 'Отец (Лидер Революционеров)'),
    char2: getC('Luffy Monkey D.', 'Сын'),
    note: 'Самый опасный преступник в мире Драгон спас Луффи от Смокера в Логтауне.'
  },
  {
    id: 'fs-6',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Fugaku Uchiha', 'Отец (Глава клана Учиха)'),
    char2: getC('Sasuke Uchiha', 'Младший сын'),
    note: 'Глава клана Учиха и полиции Конохи, отец Саске и Итачи.'
  },
  {
    id: 'fs-7',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Fugaku Uchiha', 'Отец (Глава клана Учиха)'),
    char2: getC('Itachi Uchiha', 'Старший сын'),
    note: 'Перед трагической ночью Фугаку сказал сыну Итачи, что гордится им.'
  },
  {
    id: 'fs-8',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Fullmetal Alchemist',
    animeRu: 'Стальной алхимик',
    char1: getC('Van Hohenheim', 'Отец'),
    char2: getC('Edward Elric', 'Старший сын'),
    note: 'Живой философский камень Ксеркса и отец братьев Элрик.'
  },
  {
    id: 'fs-9',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Hunter x Hunter',
    animeRu: 'Охотник х Охотник',
    char1: getC('Ging Freecss', 'Отец (Двойной Охотник)'),
    char2: getC('Gon Freecss', 'Сын'),
    note: 'Поиски легендарного отца Джина стали главным стимулом для Гона стать Охотником.'
  },
  {
    id: 'fs-10',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Hunter x Hunter',
    animeRu: 'Охотник х Охотник',
    char1: getC('Silva Zoldyck', 'Отец (Глава дома Золдик)'),
    char2: getC('Killua Zoldyck', 'Сын'),
    note: 'Сильва отпустил Киллуа путешествовать с Гоном, веря в силу крови Золдиков.'
  },
  {
    id: 'fs-11',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Death Note',
    animeRu: 'Тетрадь смерти',
    char1: getC('Soichiro Yagami', 'Отец (Шеф полиции)'),
    char2: getC('Light Yagami', 'Сын (Кира)'),
    note: 'Трагическое противостояние неподкупного шефа полиции и его гениального сына.'
  },
  {
    id: 'fs-12',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Vinland Saga',
    animeRu: 'Сага о Винланде',
    char1: getC('Thors', 'Отец (Йомский Тролль)'),
    char2: getC('Thorfinn', 'Сын'),
    note: 'Торс научил Торфинна главному правилу: «У тебя нет врагов. Ни у кого нет врагов».'
  },
  {
    id: 'fs-13',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'JoJo\'s Bizarre Adventure',
    animeRu: 'Невероятные приключения ДжоДжо',
    char1: getC('George Joestar I', 'Отец (Лорд Джостар)'),
    char2: getC('Jonathan Joestar', 'Сын (Первый ДжоДжо)'),
    note: 'Аристократическое поместье Джостаров в Англии конца XIX века.'
  },
  {
    id: 'fs-14',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Neon Genesis Evangelion',
    animeRu: 'Евангелион',
    char1: getC('Gendo Ikari', 'Отец (Командующий NERV)'),
    char2: getC('Shinji Ikari', 'Сын (Третье Дитя)'),
    note: '«Полезай в робота, Синдзи». Холодные и отстранённые отношения командующего NERV и его сына.'
  },
  {
    id: 'fs-15',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Blue Exorcist',
    animeRu: 'Синий экзорцист',
    char1: getC('Satan', 'Биологический отец (Владыка Геенны)'),
    char2: getC('Rin Okumura', 'Сын (Носитель синего пламени)'),
    note: 'Рин унаследовал смертоносное синее пламя Владыки Геенны, но поклялся победить его.'
  },
  {
    id: 'fs-16',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Jujutsu Kaisen',
    animeRu: 'Магическая битва',
    char1: getC('Toji Fushiguro', 'Отец (Убийца магов)'),
    char2: getC('Megumi Fushiguro', 'Сын'),
    note: 'Тодзи доверил заботу о сыне Мэгуми Сатору Годзё, пожертвовав собой перед смертью.'
  },
  {
    id: 'fs-17',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Attack on Titan',
    animeRu: 'Атака титанов',
    char1: getC('Grisha Yeager', 'Отец'),
    char2: getC('Eren Yeager', 'Младший сын'),
    note: 'Гриша передал Эрену силу Атакующего и Прародителя Титанов в подвале дома Сигансины.'
  },
  {
    id: 'fs-18',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Attack on Titan',
    animeRu: 'Атака титанов',
    char1: getC('Grisha Yeager', 'Отец'),
    char2: getC('Zeke Yeager', 'Старший сын'),
    note: 'Гриша возложил на Зика судьбу возрождения Элдии, что привело к предательству сына в Марли.'
  },
  {
    id: 'fs-19',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'Gintama',
    animeRu: 'Гинтама',
    char1: getC('Umibouzu', 'Отец (Сильнейший чистильщик Вселенной)'),
    char2: getC('Kamui', 'Сын (Командир 7-й дивизии Харусаме)'),
    note: 'Кровавая дуэль отца и сына клана Ято стала легендой криминального синдиката.'
  },
  {
    id: 'fs-20',
    tags: ['father_son'],
    relationLabel: '⚡ Отец ⇆ 👶 Сын',
    anime: 'My Hero Academia',
    animeRu: 'Моя геройская академия',
    char1: getC('Enji Todoroki', 'Отец (Старатель)'),
    char2: getC('Shoto Todoroki', 'Сын'),
    note: 'Герой №1 Старатель годами добивался от Сёто преодоления предела огня и льда.'
  },

  // ==========================================
  // BROTHER AND SISTER (🤝 Брат и сестра)
  // ==========================================
  {
    id: 'bs-1',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Demon Slayer',
    animeRu: 'Клинок, рассекающий демонов',
    char1: getC('Tanjiro Kamado', 'Старший брат'),
    char2: getC('Nezuko Kamado', 'Младшая сестра'),
    note: 'Тандзиро вступил в ряды истребителей демонов, чтобы найти лекарство и спасти сестру Нэдзуко.'
  },
  {
    id: 'bs-2',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Code Geass',
    animeRu: 'Код Гиас',
    char1: getC('Lelouch Lamperouge', 'Старший брат'),
    char2: getC('Nunnally Lamperouge', 'Младшая сестра'),
    note: 'Лелуш начал глобальное восстание против Священной Британской Империи ради счастливого будущего Нанналли.'
  },
  {
    id: 'bs-3',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Ichigo Kurosaki', 'Старший брат'),
    char2: getC('Karin Kurosaki', 'Младшая сестра'),
    note: 'Ичиго всегда готов защитить семью Куросаки от любых пустых.'
  },
  {
    id: 'bs-4',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Ichigo Kurosaki', 'Старший брат'),
    char2: getC('Yuzu Kurosaki', 'Младшая сестра'),
    note: 'Юдзу заботится о домашнем уюте клиники Куросаки, обожая своего старшего брата.'
  },
  {
    id: 'bs-5',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Oshi no Ko',
    animeRu: 'Звёздное дитя',
    char1: getC('Aquamarine Hoshino', 'Брат-близнец'),
    char2: getC('Ruby Hoshino', 'Сестра-близнец'),
    note: 'Близнецы Ай Хосино, переродившиеся с воспоминаниями о прошлой жизни.'
  },
  {
    id: 'bs-6',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Katakuri Charlotte', 'Старший брат'),
    char2: getC('Brulee Charlotte', 'Младшая сестра'),
    note: 'Катакури надел свой знаменитый шарф, поклявшись стать несокрушимым щитом для Брюле.'
  },
  {
    id: 'bs-7',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Katakuri Charlotte', 'Старший брат'),
    char2: getC('Pudding Charlotte', 'Младшая сестра'),
    note: 'Старший брат в семье Шарлотта всегда оберегал сестёр от насмешек над внешностью.'
  },
  {
    id: 'bs-8',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Death Note',
    animeRu: 'Тетрадь смерти',
    char1: getC('Light Yagami', 'Старший брат'),
    char2: getC('Sayu Yagami', 'Младшая сестра'),
    note: 'Похищение Саю мафией Мелло поставило Лайта перед тяжелейшей дилеммой Киры.'
  },
  {
    id: 'bs-9',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Tokyo Ghoul',
    animeRu: 'Токийский гуль',
    char1: getC('Ayato Kirishima', 'Младший брат'),
    char2: getC('Touka Kirishima', 'Старшая сестра'),
    note: 'Аято вступил в «Древо Аогири», чтобы тайно защитить Току от опасностей 20-го района.'
  },
  {
    id: 'bs-10',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Gintama',
    animeRu: 'Гинтама',
    char1: getC('Kamui', 'Старший брат'),
    char2: getC('Kagura', 'Младшая сестра'),
    note: 'Эпическая битва на планете Ракуё положила конец многолетней вражде брата и сестры Ято.'
  },
  {
    id: 'bs-11',
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 👧 Сестра',
    anime: 'Vinland Saga',
    animeRu: 'Сага о Винланде',
    char1: getC('Thorfinn', 'Младший брат'),
    char2: getC('Ylva', 'Старшая сестра'),
    note: 'Ильва и Торфинн — дети Торса и Хельги, выросшие на ветреных берегах Исландии.'
  },

  // ==========================================
  // BROTHERS (⚔️ Братья)
  // ==========================================
  {
    id: 'bb-1',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Fullmetal Alchemist',
    animeRu: 'Стальной алхимик',
    char1: getC('Edward Elric', 'Старший брат (Стальной алхимик)'),
    char2: getC('Alphonse Elric', 'Младший брат (Душа в доспехах)'),
    note: 'Братья Элрик преодолели континент Аместрис, стремясь вернуть потерянные тела.'
  },
  {
    id: 'bb-2',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Itachi Uchiha', 'Старший брат'),
    char2: getC('Sasuke Uchiha', 'Младший брат'),
    note: '«Я всегда буду любить тебя». Итачи пожертвовал честью ради защиты жизни Саске.'
  },
  {
    id: 'bb-3',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Ace Portgas D.', 'Названый брат'),
    char2: getC('Luffy Monkey D.', 'Названый брат'),
    note: 'Братская клятва на чашах сакэ в Сером Терминале скрепила неразрывные узы Луффи и Эйса.'
  },
  {
    id: 'bb-4',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Sabo', 'Названый брат'),
    char2: getC('Luffy Monkey D.', 'Названый брат'),
    note: 'Сабо унаследовал пламя Эйса и фрукт Мэра Мэра но Ми в Колизее Дресс Розы.'
  },
  {
    id: 'bb-5',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Hashirama Senju', 'Старший брат (Первый Хокаге)'),
    char2: getC('Tobirama Senju', 'Младший брат (Второй Хокаге)'),
    note: 'Основатели Деревни Скрытого Листа и создатели базовых систем мира ниндзя.'
  },
  {
    id: 'bb-6',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Madara Uchiha', 'Старший брат'),
    char2: getC('Izuna Uchiha', 'Младший брат'),
    note: 'Смерть Идзуны на Войне Кланов пробудила в Мадаре вечный Мангэкё Шаринган.'
  },
  {
    id: 'bb-7',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Son Gohan', 'Старший брат'),
    char2: getC('Son Goten', 'Младший брат'),
    note: 'Гохан терпеливо обучал младшего брата Готэна полёту с помощью Ки.'
  },
  {
    id: 'bb-8',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Katakuri Charlotte', 'Брат-триплет (2-й сын)'),
    char2: getC('Perospero Charlotte', 'Старший брат (1-й сын)'),
    note: 'Старшие сыновья семьи Шарлотта — опора боевой мощи пиратов Биг Мам.'
  },
  {
    id: 'bb-9',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Katakuri Charlotte', 'Брат-триплет (2-й сын)'),
    char2: getC('Oven Charlotte', 'Брат-триплет (4-й сын)'),
    note: 'Овен, Катакури и Дайфуку родились триплетами 48 лет назад.'
  },
  {
    id: 'bb-10',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Hunter x Hunter',
    animeRu: 'Охотник х Охотник',
    char1: getC('Illumi Zoldyck', 'Старший брат'),
    char2: getC('Killua Zoldyck', 'Младший брат'),
    note: 'Иллуми контролировал Киллуа с помощью иглы Нэн, чтобы уберечь наследника семьи.'
  },
  {
    id: 'bb-11',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Blue Exorcist',
    animeRu: 'Синий экзорцист',
    char1: getC('Rin Okumura', 'Старший брат-близнец'),
    char2: getC('Yukio Okumura', 'Младший брат-близнец'),
    note: 'Близнецы Окумура — сыновья Сатаны; Юкио стал экзорцистом-паладином, чтобы оберегать Рина.'
  },
  {
    id: 'bb-12',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Inuyasha',
    animeRu: 'Инуяша',
    char1: getC('Sesshoumaru', 'Старший единокровный брат (Чистокровный демон)'),
    char2: getC('Inuyasha', 'Младший единокровный брат (Полудемон)'),
    note: 'Соперничество братьев-демонов за наследные мечи Тэссайга и Тенсейга отца Ину но Тайсё.'
  },
  {
    id: 'bb-13',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Jujutsu Kaisen',
    animeRu: 'Магическая битва',
    char1: getC('Choso', 'Старший брат (Картина смерти)'),
    char2: getC('Yuji Itadori', 'Младший брат'),
    note: 'Тёсо почувствовал зов братской крови в Сибуе и поклялся защищать Юдзи ценой собственной жизни.'
  },
  {
    id: 'bb-14',
    tags: ['brothers'],
    relationLabel: '⚔️ Брат ⇆ ⚔️ Брат',
    anime: 'Attack on Titan',
    animeRu: 'Атака титанов',
    char1: getC('Zeke Yeager', 'Старший единокровный брат (Звероподобный)'),
    char2: getC('Eren Yeager', 'Младший единокровный брат (Атакующий)'),
    note: 'Встреча братьев Йегер в Координате определила судьбу Гула Земли.'
  },

  // ==========================================
  // SISTERS (🌸 Сёстры)
  // ==========================================
  {
    id: 'ss-1',
    tags: ['sisters'],
    relationLabel: '🌸 Сестра ⇆ 🌸 Сестра',
    anime: 'Re:Zero',
    animeRu: 'Жизнь в альтернативном мире с нуля',
    char1: getC('Ram', 'Старшая сестра'),
    char2: getC('Rem', 'Младшая сестра'),
    note: 'Близнецы-горничные поместья Розваля из клана они.'
  },
  {
    id: 'ss-2',
    tags: ['sisters'],
    relationLabel: '🌸 Сестра ⇆ 🌸 Сестра',
    anime: 'Demon Slayer',
    animeRu: 'Клинок, рассекающий демонов',
    char1: getC('Kanae Kocho', 'Старшая сестра (Столп Цветка)'),
    char2: getC('Shinobu Kocho', 'Младшая сестра (Столп Насекомого)'),
    note: 'Шинобу посвятила жизнь борьбе с демонами в память о погибшей сестре Канаэ.'
  },
  {
    id: 'ss-3',
    tags: ['sisters'],
    relationLabel: '🌸 Сестра ⇆ 🌸 Сестра',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Hinata Hyuuga', 'Старшая сестра'),
    char2: getC('Hanabi Hyuuga', 'Младшая сестра'),
    note: 'Наследницы главной ветви клана Хюга и обладательницы Бьякугана.'
  },
  {
    id: 'ss-4',
    tags: ['sisters'],
    relationLabel: '🌸 Сестра ⇆ 🌸 Сестра',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Smoothie Charlotte', 'Старшая сестра (14-я дочь)'),
    char2: getC('Pudding Charlotte', 'Младшая сестра (35-я дочь)'),
    note: 'Дочери семьи Шарлотта с уникальными способностями соков и воспоминаний.'
  },
  {
    id: 'ss-5',
    tags: ['sisters'],
    relationLabel: '🌸 Сестра ⇆ 🌸 Сестра',
    anime: 'Jujutsu Kaisen',
    animeRu: 'Магическая битва',
    char1: getC('Maki Zenin', 'Старшая сестра-близнец'),
    char2: getC('Mai Zenin', 'Младшая сестра-близнец'),
    note: 'Сестры Дзэнин родились близнецами в традиционном клане, отвергнутые за нехватку проклятой энергии.'
  },

  // ==========================================
  // SPOUSES (💍 Муж и жена)
  // ==========================================
  {
    id: 'sp-1',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Minato Namikaze', 'Муж (Хокаге)'),
    char2: getC('Kushina Uzumaki', 'Жена (Джинчурики)'),
    note: 'Красивейшая история любви Конохи: Минато нашёл Кушину по ярко-красным прядям волос.'
  },
  {
    id: 'sp-2',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Naruto Uzumaki', 'Муж'),
    char2: getC('Hinata Hyuuga', 'Жена'),
    note: 'Хината с детства верила в Наруто, вдохновляя его на пути к званию Хокаге.'
  },
  {
    id: 'sp-3',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Ichigo Kurosaki', 'Муж'),
    char2: getC('Orihime Inoue', 'Жена'),
    note: 'Орихиме всегда поддерживала Ичиго, создав тёплую семью после завершения Тысячелетней войны.'
  },
  {
    id: 'sp-4',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Son Goku', 'Муж'),
    char2: getC('Chi-Chi', 'Жена'),
    note: 'Гоку и Чи-Чи поженились после Турнира боевых искусств Тэнкаити Будокай.'
  },
  {
    id: 'sp-5',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Vegeta', 'Муж (Принц Сайянов)'),
    char2: getC('Bulma', 'Жена (Гениальный инженер)'),
    note: 'Союз гордого сайянского принца и наследницы Capsule Corporation Бульмы.'
  },
  {
    id: 'sp-6',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Spy x Family',
    animeRu: 'Семья шпиона',
    char1: getC('Loid Forger', 'Муж (Агент Сумрак)'),
    char2: getC('Yor Forger', 'Жена (Тернистая Принцесса)'),
    note: 'Фиктивный брак величайшего шпиона Весталиса и наёмной убийцы ради операции «Неясыть».'
  },
  {
    id: 'sp-7',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Fugaku Uchiha', 'Муж'),
    char2: getC('Mikoto Uchiha', 'Жена'),
    note: 'Родители Саске и Итачи, хранившие верность друг другу до самого конца.'
  },
  {
    id: 'sp-8',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Renji Abarai', 'Муж'),
    char2: getC('Rukia Kuchiki', 'Жена'),
    note: 'Друзья детства из Руконгая, прошедшие сквозь огонь и битвы и ставшие семьёй.'
  },
  {
    id: 'sp-9',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Berserk',
    animeRu: 'Берсерк',
    char1: getC('Guts', 'Возлюбленный (Чёрный Мечник)'),
    char2: getC('Casca', 'Возлюбленная'),
    note: 'Пронзительная любовь командиров Отряда Сокола сквозь мрак и Затмение.'
  },
  {
    id: 'sp-10',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Tokyo Ghoul',
    animeRu: 'Токийский гуль',
    char1: getC('Ken Kaneki', 'Муж (Одноглазый Король)'),
    char2: getC('Touka Kirishima', 'Жена'),
    note: 'Канеки и Тока связали судьбы узами брака ради мира между людьми и гулями.'
  },
  {
    id: 'sp-11',
    tags: ['spouses'],
    relationLabel: '💍 Муж ⇆ 💍 Жена',
    anime: 'Vinland Saga',
    animeRu: 'Сага о Винланде',
    char1: getC('Thors', 'Муж'),
    char2: getC('Helga', 'Жена'),
    note: 'Торс оставил войну и йомсвикингов ради мирной жизни с Хельгой в Исландии.'
  },

  // ==========================================
  // FATHER AND DAUGHTER (🎀 Отец и дочь)
  // ==========================================
  {
    id: 'fd-1',
    tags: ['father_daughter'],
    relationLabel: '🎀 Отец ⇆ 🎀 Дочь',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Sasuke Uchiha', 'Отец'),
    char2: getC('Sarada Uchiha', 'Дочь'),
    note: 'Саске передал Сараде ценности защитника Конохи и силу огненного стиля Учиха.'
  },
  {
    id: 'fd-2',
    tags: ['father_daughter'],
    relationLabel: '🎀 Отец ⇆ 🎀 Дочь',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Naruto Uzumaki', 'Отец (Седьмой Хокаге)'),
    char2: getC('Himawari Uzumaki', 'Дочь'),
    note: 'Химавари пробудила Бьякуган в раннем возрасте, поразив даже своего отца.'
  },
  {
    id: 'fd-3',
    tags: ['father_daughter'],
    relationLabel: '🎀 Отец ⇆ 🎀 Дочь',
    anime: 'Spy x Family',
    animeRu: 'Семья шпиона',
    char1: getC('Loid Forger', 'Приёмный отец'),
    char2: getC('Anya Forger', 'Приёмная дочь (Телепат)'),
    note: 'Лойд заботится об Ане, не подозревая, что девочка читает все его шпионские мысли.'
  },
  {
    id: 'fd-4',
    tags: ['father_daughter'],
    relationLabel: '🎀 Отец ⇆ 🎀 Дочь',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Hiashi Hyuuga', 'Отец (Глава клана Хюга)'),
    char2: getC('Hinata Hyuuga', 'Старшая дочь'),
    note: 'Хиаши признал волю Хинаты, став любящим отцом и дедушкой.'
  },
  {
    id: 'fd-5',
    tags: ['father_daughter'],
    relationLabel: '🎀 Отец ⇆ 🎀 Дочь',
    anime: 'JoJo\'s Bizarre Adventure',
    animeRu: 'Невероятные приключения ДжоДжо',
    char1: getC('Jotaro Kujo', 'Отец (Star Platinum)'),
    char2: getC('Jolyne Cujoh', 'Дочь (Stone Ocean)'),
    note: 'Джотаро прибыл в тюрьму Green Dolphin Street, чтобы спасти Джолин ценой памяти и стенда.'
  },
  {
    id: 'fd-6',
    tags: ['father_daughter'],
    relationLabel: '🎀 Отец ⇆ 🎀 Дочь',
    anime: 'Death Note',
    animeRu: 'Тетрадь смерти',
    char1: getC('Soichiro Yagami', 'Отец'),
    char2: getC('Sayu Yagami', 'Дочь'),
    note: 'Соитиро спас дочь Сау из рук террористов в пустыне.'
  },

  // ==========================================
  // MOTHER AND DAUGHTER (🌷 Мать и дочь)
  // ==========================================
  {
    id: 'md-1',
    tags: ['mother_daughter'],
    relationLabel: '🌷 Мать ⇆ 🌷 Дочь',
    anime: 'Oshi no Ko',
    animeRu: 'Звёздное дитя',
    char1: getC('Ai Hoshino', 'Мать'),
    char2: getC('Ruby Hoshino', 'Дочь'),
    note: 'Руби продолжила путь матери Ай, воссоздав легендарную айдол-группу B-Komachi.'
  },
  {
    id: 'md-2',
    tags: ['mother_daughter'],
    relationLabel: '🌷 Мать ⇆ 🌷 Дочь',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Hinata Hyuuga', 'Мать'),
    char2: getC('Himawari Uzumaki', 'Дочь'),
    note: 'Хината передала Химавари доброту, мудрость и грацию стиля Мягкого Кулака.'
  },
  {
    id: 'md-3',
    tags: ['mother_daughter'],
    relationLabel: '🌷 Мать ⇆ 🌷 Дочь',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Linlin Charlotte', 'Мать (Биг Мам)'),
    char2: getC('Pudding Charlotte', 'Дочь (35-я дочь)'),
    note: 'Пудинг с трёхглазым оком страдала от ожиданий властной матери Линлин.'
  },
  {
    id: 'md-4',
    tags: ['mother_daughter'],
    relationLabel: '🌷 Мать ⇆ 🌷 Дочь',
    anime: 'Gintama',
    animeRu: 'Гинтама',
    char1: getC('Kouka', 'Мать'),
    char2: getC('Kagura', 'Дочь'),
    note: 'Кагура бережно хранит воспоминания о матери Коке и её вечной улыбке.'
  },

  // ==========================================
  // GRANDPARENT AND GRANDCHILD (📜 Дедушка и внук)
  // ==========================================
  {
    id: 'gp-1',
    tags: ['grandparent'],
    relationLabel: '📜 Дедушка ⇆ 👶 Внук',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Garp Monkey D.', 'Дедушка (Герой Дозора)'),
    char2: getC('Luffy Monkey D.', 'Внук (Мугивара)'),
    note: 'Гарп сбрасывал Луффи в ущелья и привязывал к шарам, закаляя стальной дух внука.'
  },
  {
    id: 'gp-2',
    tags: ['grandparent'],
    relationLabel: '📜 Дедушка ⇆ 👶 Внук',
    anime: 'Bleach',
    animeRu: 'Блич',
    char1: getC('Souken Ishida', 'Дедушка (Мастер Квинси)'),
    char2: getC('Uryuu Ishida', 'Внук'),
    note: 'Сокэн научил Урю гордости квинси и передал священные перчатки Санрэй.'
  },
  {
    id: 'gp-3',
    tags: ['grandparent'],
    relationLabel: '📜 Дедушка ⇆ 👶 Внук',
    anime: 'Hunter x Hunter',
    animeRu: 'Охотник х Охотник',
    char1: getC('Zeno Zoldyck', 'Дедушка (Легендарный убийца)'),
    char2: getC('Killua Zoldyck', 'Внук'),
    note: 'Зено признавал феноменальный талант Киллуа как главного наследника династии Золдиков.'
  },
  {
    id: 'gp-4',
    tags: ['grandparent'],
    relationLabel: '📜 Дедушка ⇆ 👶 Внук',
    anime: 'Dragon Ball Z',
    animeRu: 'Драконий жемчуг Зет',
    char1: getC('Son Goku', 'Дедушка'),
    char2: getC('Son Gohan', 'Сын / Отец Пан'),
    note: 'Семья Сон веками передаёт боевое мастерство через поколения защитников Вселенной.'
  },

  // ==========================================
  // ADOPTIVE (🧬 Приёмная семья)
  // ==========================================
  {
    id: 'ad-1',
    tags: ['adoptive'],
    relationLabel: '🧬 Приёмный отец ⇆ 🏴‍☠️ Названый сын',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Edward Newgate', 'Отец (Белоус)'),
    char2: getC('Ace Portgas D.', 'Сын (Командир 2-й дивизии)'),
    note: 'Белоус принял Эйса, сына своего соперника Роджера, назвав своим родным сыном.'
  },
  {
    id: 'ad-2',
    tags: ['adoptive'],
    relationLabel: '🧬 Приёмная мать ⇆ 👶 Приёмная дочь',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Bell-mere', 'Приёмная мать (Бывший дозорный)'),
    char2: getC('Nami', 'Приёмная дочь'),
    note: 'Бельмере отдала жизнь пирату Арлонгу, не отрекшись от своих приёмных дочерей Нами и Ноджико.'
  },
  {
    id: 'ad-3',
    tags: ['adoptive'],
    relationLabel: '🧬 Приёмная мать ⇆ 👶 Воспитанница',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Carmel', 'Матушка Кармель'),
    char2: getC('Linlin Charlotte', 'Воспитанница (Биг Мам)'),
    note: 'Кармель открыла Дом Овец на Эльбафе и воспитала брошенную родителями маленькую Линлин.'
  },
  {
    id: 'ad-4',
    tags: ['adoptive', 'father_daughter'],
    relationLabel: '🧬 Приёмный отец ⇆ 🎀 Дочь',
    anime: 'Spy x Family',
    animeRu: 'Семья шпиона',
    char1: getC('Loid Forger', 'Приёмный отец'),
    char2: getC('Anya Forger', 'Приёмная дочь'),
    note: 'Шпион Сумрак удочерил Аню из приюта, подарив девочке настоящую семью и заботу.'
  },
  {
    id: 'ad-5',
    tags: ['adoptive', 'father_son'],
    relationLabel: '🧬 Приёмный отец ⇆ 👶 Сын',
    anime: 'Blue Exorcist',
    animeRu: 'Синий экзорцист',
    char1: getC('Shiro Fujimoto', 'Приёмный отец (Отец Фудзимото)'),
    char2: getC('Rin Okumura', 'Приёмный сын'),
    note: 'Сиро Фудзимото вырастил Рина и Юкио как родных сыновей и отдал жизнь, защищая их от Сатаны.'
  },

  // ==========================================
  // CLANS & DYNASTIES (🏛️ Кланы и династии)
  // ==========================================
  {
    id: 'cl-1',
    tags: ['clans'],
    relationLabel: '🏛️ Клан Учиха',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Madara Uchiha', 'Легендарный лидер клана'),
    char2: getC('Sasuke Uchiha', 'Последний чистокровный Учиха'),
    note: 'Реинкарнации Индры Ооцуцуки и величайшие обладатели Вечного Мангэкё Шарингана.'
  },
  {
    id: 'cl-2',
    tags: ['clans'],
    relationLabel: '🏛️ Клан Сенджу',
    anime: 'Naruto',
    animeRu: 'Наруто',
    char1: getC('Hashirama Senju', 'Первый Хокаге'),
    char2: getC('Tobirama Senju', 'Второй Хокаге'),
    note: 'Потомки Асуры Ооцуцуки, одарённые невероятной жизненной силой и Волей Огня.'
  },
  {
    id: 'cl-3',
    tags: ['clans'],
    relationLabel: '🏛️ Семья Шарлотта',
    anime: 'One Piece',
    animeRu: 'Ван-Пис',
    char1: getC('Linlin Charlotte', 'Матриарх (Биг Мам)'),
    char2: getC('Katakuri Charlotte', 'Сильнейший сын семьи'),
    note: 'Огромная семья из 85 детей, контролирующая 34 острова архипелага Тотлэнд.'
  },
  {
    id: 'cl-4',
    tags: ['clans'],
    relationLabel: '🏛️ Династия Джостаров',
    anime: 'JoJo\'s Bizarre Adventure',
    animeRu: 'Невероятные приключения ДжоДжо',
    char1: getC('Jonathan Joestar', 'Основатель рода'),
    char2: getC('Jotaro Kujo', '3-й ДжоДжо (Star Platinum)'),
    note: 'Род Джостаров с родимым пятном в виде звезды веками сражается с проклятием Дио Брандо.'
  },
  {
    id: 'cl-5',
    tags: ['clans'],
    relationLabel: '🏛️ Клан Золдик',
    anime: 'Hunter x Hunter',
    animeRu: 'Охотник х Охотник',
    char1: getC('Silva Zoldyck', 'Глава клана'),
    char2: getC('Killua Zoldyck', 'Наследник клана'),
    note: 'Семья легендарных наёмных убийц горы Кукулу с безупречными техниками убийства.'
  }
];

fs.writeFileSync(path.join(__dirname, '..', 'kinship_catalog_data.json'), JSON.stringify(pairs, null, 2), 'utf-8');
console.log(`Successfully generated kinship_catalog_data.json with ${pairs.length} pairs!`);
