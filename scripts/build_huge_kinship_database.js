const { shiki } = require('../lib/shikimori');
const fs = require('fs');
const path = require('path');

const existingPath = path.join(__dirname, '..', 'kinship_catalog_data.json');
let curatedPairs = [];
if (fs.existsSync(existingPath)) {
  try {
    const list = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    // Keep manually verified core relations
    curatedPairs = list.filter(p => !p.id.startsWith('gen-') && !p.id.startsWith('dyn-'));
  } catch (e) {}
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

function isFemale(name = '', role = '') {
  const n = (name + ' ' + role).toLowerCase();
  return (
    n.includes('мать') || n.includes('мама') || n.includes('сестра') || n.includes('дочь') ||
    n.includes('жена') || n.includes('бабушка') || n.includes('тётя') || n.includes('внучка') ||
    n.includes('девушка') || n.includes('mother') || n.includes('sister') || n.includes('daughter') ||
    n.includes('wife') || n.includes('female') ||
    /(а|я|ко|ми|ри|ка|на|са|э)$/i.test(name.trim().split(/\s+/).pop())
  );
}

function isMale(name = '', role = '') {
  const n = (name + ' ' + role).toLowerCase();
  return (
    n.includes('отец') || n.includes('папа') || n.includes('брат') || n.includes('сын') ||
    n.includes('муж') || n.includes('дедушка') || n.includes('дядя') || n.includes('внук') ||
    n.includes('парень') || n.includes('father') || n.includes('brother') || n.includes('son') ||
    n.includes('husband') || n.includes('male')
  );
}

function classifyRelation(c1, c2, clanName) {
  const n1 = (c1.russian || c1.name).toLowerCase();
  const n2 = (c2.russian || c2.name).toLowerCase();
  const r1 = (c1.role || '').toLowerCase();
  const r2 = (c2.role || '').toLowerCase();

  const isFather1 = n1.includes('отец') || n1.includes('father') || r1.includes('отец');
  const isFather2 = n2.includes('отец') || n2.includes('father') || r2.includes('отец');
  const isMother1 = n1.includes('мать') || n1.includes('mother') || n1.includes('мама') || r1.includes('мать');
  const isMother2 = n2.includes('мать') || n2.includes('mother') || n2.includes('мама') || r2.includes('мать');

  const isGrandparent1 = n1.includes('дедушка') || n1.includes('бабушка') || r1.includes('дедушка') || r1.includes('бабушка');
  const isGrandparent2 = n2.includes('дедушка') || n2.includes('бабушка') || r2.includes('дедушка') || r2.includes('бабушка');

  if (isGrandparent1 || isGrandparent2) {
    return {
      tags: ['grandparent'],
      relationLabel: '📜 Дедушка / Бабушка ⇆ 👶 Внук / Внучка',
      note: `Поколения рода ${clanName}.`
    };
  }

  if ((isFather1 && isMother2) || (isFather2 && isMother1)) {
    return {
      tags: ['spouses'],
      relationLabel: '💍 Муж ⇆ 💍 Жена',
      note: `Супруги семьи ${clanName}.`
    };
  }

  if (isFather1 || isFather2) {
    const child = isFather1 ? c2 : c1;
    const female = isFemale(child.russian || child.name, child.role);
    return {
      tags: female ? ['father_daughter'] : ['father_son'],
      relationLabel: female ? '🎀 Отец ⇆ 👧 Дочь' : '⚡ Отец ⇆ 👦 Сын',
      note: `Отец и ${female ? 'дочь' : 'сын'} семьи ${clanName}.`
    };
  }

  if (isMother1 || isMother2) {
    const child = isMother1 ? c2 : c1;
    const female = isFemale(child.russian || child.name, child.role);
    return {
      tags: female ? ['mother_daughter'] : ['mother_son'],
      relationLabel: female ? '🌷 Мать ⇆ 👧 Дочь' : '👑 Мать ⇆ 👦 Сын',
      note: `Мать и ${female ? 'дочь' : 'сын'} семьи ${clanName}.`
    };
  }

  const f1 = isFemale(c1.russian || c1.name, c1.role);
  const f2 = isFemale(c2.russian || c2.name, c2.role);

  if (f1 && f2) {
    return {
      tags: ['sisters'],
      relationLabel: '🌸 Сёстры',
      note: `Родные или двоюродные сёстры клана ${clanName}.`
    };
  }
  if (!f1 && !f2) {
    return {
      tags: ['brothers'],
      relationLabel: '⚔️ Братья',
      note: `Родные или двоюродные братья клана ${clanName}.`
    };
  }

  return {
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 🌸 Сестра',
    note: `Брат и сестра семьи ${clanName}.`
  };
}

async function run() {
  console.log('Fetching top popular anime from Shikimori...');
  const topAnimes = [];

  for (let page = 1; page <= 4; page++) {
    const list = await shiki(`/animes?page=${page}&limit=50&order=popularity`);
    if (Array.isArray(list)) {
      list.forEach(a => {
        if (!topAnimes.some(x => x.id === a.id)) {
          topAnimes.push({
            id: a.id,
            name: a.name,
            nameRu: a.russian || a.name
          });
        }
      });
    }
    await sleep(250);
  }

  console.log(`Discovered ${topAnimes.length} top anime titles.`);
  const allPairs = [...curatedPairs];
  const pairKeys = new Set(allPairs.map(p => `${Math.min(p.char1.id, p.char2.id)}-${Math.max(p.char1.id, p.char2.id)}`));

  let count = 0;
  for (const anime of topAnimes) {
    count++;
    try {
      const roles = await shiki(`/animes/${anime.id}/roles`);
      if (!Array.isArray(roles)) {
        await sleep(220);
        continue;
      }

      const characters = roles.map(r => r.character).filter(Boolean);
      const surnameMap = new Map();
      const invalid = new Set(['no', 'the', 'of', 'van', 'von', 'san', 'kun', 'sama', 'ii', 'iii', 'iv', 'jr.', 'sr.', 'dr.', 'd.', 'd']);

      characters.forEach(c => {
        if (!c.id || !c.name) return;
        const parts = c.name.trim().split(/\s+/);
        if (parts.length >= 2) {
          const surname = parts[parts.length - 1].toLowerCase();
          if (surname.length > 2 && !invalid.has(surname)) {
            if (!surnameMap.has(surname)) surnameMap.set(surname, []);
            surnameMap.get(surname).push(c);
          }
        }
      });

      for (const [sname, group] of surnameMap.entries()) {
        if (group.length >= 2 && group.length <= 15) {
          const clanTitle = group[0].name.trim().split(/\s+/).pop();
          for (let i = 0; i < group.length; i++) {
            for (let j = i + 1; j < group.length; j++) {
              const c1 = group[i];
              const c2 = group[j];
              const key = `${Math.min(c1.id, c2.id)}-${Math.max(c1.id, c2.id)}`;
              if (pairKeys.has(key)) continue;
              pairKeys.add(key);

              const rel = classifyRelation(c1, c2, clanTitle);
              allPairs.push({
                id: `top-${anime.id}-${key}`,
                tags: rel.tags,
                relationLabel: rel.relationLabel,
                anime: anime.name,
                animeRu: anime.nameRu,
                char1: {
                  id: c1.id,
                  name: c1.name,
                  russian: c1.russian || c1.name,
                  role: `Член рода ${clanTitle}`,
                  image: c1.image?.preview || c1.image?.original || ''
                },
                char2: {
                  id: c2.id,
                  name: c2.name,
                  russian: c2.russian || c2.name,
                  role: `Член рода ${clanTitle}`,
                  image: c2.image?.preview || c2.image?.original || ''
                },
                note: rel.note
              });
            }
          }
        }
      }
      console.log(`[${count}/${topAnimes.length}] ${anime.nameRu}: total pairs now ${allPairs.length}`);
      await sleep(220);
    } catch (err) {
      console.error(`Error on anime ${anime.id}:`, err.message);
      await sleep(300);
    }
  }

  fs.writeFileSync(existingPath, JSON.stringify(allPairs, null, 2), 'utf8');
  console.log(`SUCCESS! Saved ${allPairs.length} kinship pairs across ${topAnimes.length} titles to ${existingPath}`);
}

run().catch(console.error);
