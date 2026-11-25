const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

const existingPath = path.join(__dirname, '..', 'kinship_catalog_data.json');
let curated = [];
if (fs.existsSync(existingPath)) {
  try {
    curated = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    // Filter out dummy or placeholder entries
    curated = curated.filter(p => p.char1 && p.char1.name !== 'Ребёнок' && (!p.char2 || p.char2.name !== 'Ребёнок'));
  } catch (e) {}
}

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
      note: `Поколения семьи ${clanName}.`
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
      note: `Сёстры семьи ${clanName}.`
    };
  }
  if (!f1 && !f2) {
    return {
      tags: ['brothers'],
      relationLabel: '⚔️ Братья',
      note: `Братья семьи ${clanName}.`
    };
  }

  return {
    tags: ['brother_sister'],
    relationLabel: '🤝 Брат ⇆ 🌸 Сестра',
    note: `Брат и сестра семьи ${clanName}.`
  };
}

async function run() {
  console.log('Harvesting kinship from Shikimori GraphQL...');
  const allPairs = [...curated];
  const pairKeys = new Set(allPairs.map(p => p.char2 ? `${Math.min(p.char1.id, p.char2.id)}-${Math.max(p.char1.id, p.char2.id)}` : `solo-${p.char1.id}`));

  const query = `
    query($page: Int, $limit: Int) {
      animes(limit: $limit, page: $page, order: popularity) {
        id
        name
        russian
        characterRoles {
          rolesRu
          rolesEn
          character {
            id
            name
            russian
            poster {
              mainUrl
            }
          }
        }
      }
    }
  `;

  for (let page = 1; page <= 12; page++) {
    try {
      console.log(`Fetching GraphQL page ${page} of animes...`);
      const res = await fetch('https://shikimori.one/api/graphql', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'ShikimoriTitleExplorer/3.0'
        },
        body: JSON.stringify({
          query,
          variables: { page, limit: 30 }
        })
      });

      const data = await res.json();
      const animes = data?.data?.animes || [];
      if (animes.length === 0) break;

      for (const a of animes) {
        const roles = a.characterRoles || [];
        const characters = roles.map(r => ({
          ...r.character,
          roleRu: r.rolesRu?.join(', ') || ''
        })).filter(c => c && c.id && c.name);

        // Group by surname
        const surnameMap = new Map();
        const invalid = new Set(['no', 'the', 'of', 'van', 'von', 'san', 'kun', 'sama', 'ii', 'iii', 'iv', 'jr.', 'sr.', 'dr.', 'd.', 'd']);

        // Check for mother/father explicit characters
        const moms = [];
        const dads = [];

        characters.forEach(c => {
          const n = (c.russian || c.name).toLowerCase();
          const r = c.roleRu.toLowerCase();
          if (n.includes('мать') || n.includes('мама') || r.includes('мать') || r.includes('мама')) {
            moms.push(c);
          }
          if (n.includes('отец') || n.includes('папа') || r.includes('отец') || r.includes('папа')) {
            dads.push(c);
          }

          const parts = c.name.trim().split(/\s+/);
          if (parts.length >= 2) {
            const surname = parts[parts.length - 1].toLowerCase();
            if (surname.length > 2 && !invalid.has(surname)) {
              if (!surnameMap.has(surname)) surnameMap.set(surname, []);
              surnameMap.get(surname).push(c);
            }
          }
        });

        // Add explicit mother relations
        for (const mom of moms) {
          const key = `solo-mom-${mom.id}`;
          if (!pairKeys.has(key)) {
            pairKeys.add(key);
            allPairs.push({
              id: `harvest-mom-${mom.id}`,
              tags: ['mother_son', 'mother_daughter'],
              relationLabel: '👑 Мать в аниме',
              anime: a.name,
              animeRu: a.russian || a.name,
              char1: {
                id: mom.id,
                name: mom.name,
                russian: mom.russian || mom.name,
                role: 'Мать',
                image: mom.poster?.mainUrl || ''
              },
              char2: null,
              note: `Мать в тайтле «${a.russian || a.name}».`
            });
          }
        }

        // Add explicit father relations
        for (const dad of dads) {
          const key = `solo-dad-${dad.id}`;
          if (!pairKeys.has(key)) {
            pairKeys.add(key);
            allPairs.push({
              id: `harvest-dad-${dad.id}`,
              tags: ['father_son', 'father_daughter'],
              relationLabel: '⚡ Отец в аниме',
              anime: a.name,
              animeRu: a.russian || a.name,
              char1: {
                id: dad.id,
                name: dad.name,
                russian: dad.russian || dad.name,
                role: 'Отец',
                image: dad.poster?.mainUrl || ''
              },
              char2: null,
              note: `Отец в тайтле «${a.russian || a.name}».`
            });
          }
        }

        // Add surname family pairs
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
                  id: `top-${a.id}-${key}`,
                  tags: rel.tags,
                  relationLabel: rel.relationLabel,
                  anime: a.name,
                  animeRu: a.russian || a.name,
                  char1: {
                    id: c1.id,
                    name: c1.name,
                    russian: c1.russian || c1.name,
                    role: `Член семьи ${clanTitle}`,
                    image: c1.poster?.mainUrl || ''
                  },
                  char2: {
                    id: c2.id,
                    name: c2.name,
                    russian: c2.russian || c2.name,
                    role: `Член семьи ${clanTitle}`,
                    image: c2.poster?.mainUrl || ''
                  },
                  note: rel.note
                });
              }
            }
          }
        }
      }

      console.log(`Page ${page} done. Total pairs now: ${allPairs.length}`);
      await sleep(350);
    } catch (err) {
      console.error(`Error on page ${page}:`, err.message);
      await sleep(500);
    }
  }

  fs.writeFileSync(existingPath, JSON.stringify(allPairs, null, 2), 'utf8');
  console.log(`COMPLETE! Saved ${allPairs.length} kinship entries to ${existingPath}`);
}

run().catch(console.error);
