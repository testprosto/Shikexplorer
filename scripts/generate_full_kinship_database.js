const { shiki } = require('../lib/shikimori');
const fs = require('fs');
const path = require('path');

// Load existing curated pairs to preserve
const existingPath = path.join(__dirname, '..', 'kinship_catalog_data.json');
let curatedPairs = [];
if (fs.existsSync(existingPath)) {
  try {
    curatedPairs = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  } catch (e) {}
}

// Major anime titles to fetch full character rosters and family ties
const targetAnimeList = [
  { id: 21, name: 'One Piece', nameRu: 'Ван-Пис' },
  { id: 20, name: 'Naruto', nameRu: 'Наруто' },
  { id: 16498, name: 'Attack on Titan', nameRu: 'Атака титанов' },
  { id: 269, name: 'Bleach', nameRu: 'Блич' },
  { id: 11061, name: 'Hunter x Hunter', nameRu: 'Охотник х Охотник' },
  { id: 38000, name: 'Demon Slayer', nameRu: 'Клинок, рассекающий демонов' },
  { id: 40748, name: 'Jujutsu Kaisen', nameRu: 'Магическая битва' },
  { id: 813, name: 'Dragon Ball Z', nameRu: 'Драконий жемчуг Зет' },
  { id: 31964, name: 'My Hero Academia', nameRu: 'Моя геройская академия' },
  { id: 14719, name: "JoJo's Bizarre Adventure", nameRu: 'Невероятные приключения ДжоДжо' },
  { id: 5114, name: 'Fullmetal Alchemist: Brotherhood', nameRu: 'Стальной алхимик: Братство' },
  { id: 50265, name: 'Spy x Family', nameRu: 'Семья шпиона' },
  { id: 52034, name: 'Oshi no Ko', nameRu: 'Звёздное дитя' },
  { id: 1535, name: 'Death Note', nameRu: 'Тетрадь смерти' },
  { id: 1575, name: 'Code Geass', nameRu: 'Код Гиас' },
  { id: 22319, name: 'Tokyo Ghoul', nameRu: 'Токийский гуль' },
  { id: 30, name: 'Neon Genesis Evangelion', nameRu: 'Евангелион' },
  { id: 918, name: 'Gintama', nameRu: 'Гинтама' },
  { id: 9919, name: 'Blue Exorcist', nameRu: 'Синий экзорцист' },
  { id: 37521, name: 'Vinland Saga', nameRu: 'Сага о Винланде' },
  { id: 249, name: 'Inuyasha', nameRu: 'Инуяша' },
  { id: 6702, name: 'Fairy Tail', nameRu: 'Фейри Тейл' },
  { id: 323, name: 'Berserk', nameRu: 'Берсерк' },
  { id: 2167, name: 'Clannad', nameRu: 'Кланнад' },
  { id: 19, name: 'Monster', nameRu: 'Монстр' },
  { id: 42249, name: 'Tokyo Revengers', nameRu: 'Токийские мстители' },
  { id: 32182, name: 'Mob Psycho 100', nameRu: 'Моб Психо 100' },
  { id: 38691, name: 'Dr. Stone', nameRu: 'Доктор Стоун' },
  { id: 37779, name: 'The Promised Neverland', nameRu: 'Обещанный Неверленд' },
  { id: 120, name: 'Fruits Basket', nameRu: 'Корзинка фруктов' }
];

async function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// Helpers to classify relation based on names/roles
function classifyRelation(c1, c2, clanName) {
  const n1 = (c1.russian || c1.name).toLowerCase();
  const n2 = (c2.russian || c2.name).toLowerCase();

  const isParent1 = n1.includes('отец') || n1.includes('мать') || n1.includes('папа') || n1.includes('мама') || n1.includes('father') || n1.includes('mother');
  const isFather1 = n1.includes('отец') || n1.includes('father');
  const isMother1 = n1.includes('мать') || n1.includes('mother');

  const isParent2 = n2.includes('отец') || n2.includes('мать') || n2.includes('папа') || n2.includes('мама') || n2.includes('father') || n2.includes('mother');
  const isFather2 = n2.includes('отец') || n2.includes('father');
  const isMother2 = n2.includes('мать') || n2.includes('mother');

  const isGrandparent1 = n1.includes('дедушка') || n1.includes('бабушка') || n1.includes('grandfather') || n1.includes('grandmother');
  const isGrandparent2 = n2.includes('дедушка') || n2.includes('бабушка') || n2.includes('grandfather') || n2.includes('grandmother');

  if (isGrandparent1 || isGrandparent2) {
    return {
      tags: ['grandparent'],
      relationLabel: '📜 Дедушка / Бабушка ⇆ 👶 Внук / Внучка',
      note: `Родственные узы поколений в семье ${clanName}.`
    };
  }

  if (isFather1 && isMother2 || isFather2 && isMother1) {
    return {
      tags: ['spouses'],
      relationLabel: '💍 Муж ⇆ 💍 Жена',
      note: `Супружеская пара семьи ${clanName}.`
    };
  }

  if (isFather1 && !isParent2) {
    return {
      tags: ['father_son', 'father_daughter'],
      relationLabel: '⚡ Отец ⇆ 👶 Ребёнок',
      note: `Отец и ребёнок семьи ${clanName}.`
    };
  }

  if (isMother1 && !isParent2) {
    return {
      tags: ['mother_son', 'mother_daughter'],
      relationLabel: '👑 Мать ⇆ 👶 Ребёнок',
      note: `Мать и ребёнок семьи ${clanName}.`
    };
  }

  if (isFather2 && !isParent1) {
    return {
      tags: ['father_son', 'father_daughter'],
      relationLabel: '⚡ Отец ⇆ 👶 Ребёнок',
      note: `Отец и ребёнок семьи ${clanName}.`
    };
  }

  if (isMother2 && !isParent1) {
    return {
      tags: ['mother_son', 'mother_daughter'],
      relationLabel: '👑 Мать ⇆ 👶 Ребёнок',
      note: `Мать и ребёнок семьи ${clanName}.`
    };
  }

  // Default clan relation
  return {
    tags: ['clans', 'brothers', 'brother_sister'],
    relationLabel: `🏛️ Клан / Семья ${clanName}`,
    note: `Члены одной семьи и клана ${clanName}.`
  };
}

(async () => {
  console.log(`Starting extraction across ${targetAnimeList.length} anime franchises...`);
  const allGeneratedPairs = [];
  const pairSet = new Set();

  // Add existing curated pairs first so they come with highest priority
  curatedPairs.forEach(p => {
    const key = [Math.min(p.char1.id, p.char2.id), Math.max(p.char1.id, p.char2.id)].join('-');
    pairSet.add(key);
    allGeneratedPairs.push(p);
  });

  console.log(`Loaded ${curatedPairs.length} initial curated pairs.`);

  const invalidSurnames = new Set([
    'no', 'the', 'of', 'van', 'von', 'san', 'kun', 'sama', 'sensei', 'chan',
    'ii', 'iii', 'iv', 'jr.', 'sr.', 'dr.', 'd.', 'd', 'captain', 'mr.', 'ms.'
  ]);

  for (let idx = 0; idx < targetAnimeList.length; idx++) {
    const a = targetAnimeList[idx];
    try {
      console.log(`[${idx+1}/${targetAnimeList.length}] Fetching roles for ${a.nameRu} (id: ${a.id})...`);
      const roles = await shiki(`/animes/${a.id}/roles`);
      if (!Array.isArray(roles)) continue;

      const characters = roles.map(r => r.character).filter(Boolean);
      // Group by distinct surname
      const surnameMap = new Map();
      characters.forEach(c => {
        if (!c.id || !c.name) return;
        const nameParts = c.name.trim().split(/\s+/);
        if (nameParts.length < 2) return;

        // Try both last token and first token (Japanese order)
        const last = nameParts[nameParts.length - 1];
        const first = nameParts[0];

        [last, first].forEach(token => {
          const normToken = token.toLowerCase();
          if (token.length > 2 && !invalidSurnames.has(normToken)) {
            if (!surnameMap.has(token)) surnameMap.set(token, []);
            const list = surnameMap.get(token);
            if (!list.some(x => x.id === c.id)) {
              list.push(c);
            }
          }
        });
      });

      let addedForThisAnime = 0;
      for (const [family, members] of surnameMap.entries()) {
        if (members.length >= 2 && members.length <= 40) { // Keep families reasonable
          for (let i = 0; i < members.length; i++) {
            for (let j = i + 1; j < members.length; j++) {
              const c1 = members[i];
              const c2 = members[j];
              const pairKey = [Math.min(c1.id, c2.id), Math.max(c1.id, c2.id)].join('-');

              if (!pairSet.has(pairKey)) {
                pairSet.add(pairKey);
                const rel = classifyRelation(c1, c2, family);

                allGeneratedPairs.push({
                  id: `gen-${allGeneratedPairs.length + 1}`,
                  tags: rel.tags,
                  relationLabel: rel.relationLabel,
                  anime: a.name,
                  animeRu: a.nameRu,
                  char1: {
                    id: c1.id,
                    name: c1.name,
                    russian: c1.russian || c1.name,
                    role: `Член семьи ${family}`,
                    image: c1.image?.preview || c1.image?.original || ''
                  },
                  char2: {
                    id: c2.id,
                    name: c2.name,
                    russian: c2.russian || c2.name,
                    role: `Член семьи ${family}`,
                    image: c2.image?.preview || c2.image?.original || ''
                  },
                  note: rel.note
                });
                addedForThisAnime++;
              }
            }
          }
        }
      }
      console.log(`-> Added ${addedForThisAnime} pairs for ${a.nameRu}. Total so far: ${allGeneratedPairs.length}`);
    } catch (err) {
      console.error(`Error for ${a.nameRu}:`, err.message);
    }
    await sleep(400); // Polite rate limit for Shikimori API
  }

  fs.writeFileSync(existingPath, JSON.stringify(allGeneratedPairs, null, 2), 'utf8');
  console.log(`\n🎉 SUCCESS! Generated full kinship database with ${allGeneratedPairs.length} pairs across all anime!`);
})();
