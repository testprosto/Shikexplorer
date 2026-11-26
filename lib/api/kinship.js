const fs = require('fs');
const path = require('path');
const { shiki, send } = require('../shikimori');

let cachedData = null;
let lastMtime = 0;
const dynamicAnimeCache = new Map();

function getKinshipData() {
  const candidatePaths = [
    path.join(process.cwd(), 'kinship_catalog_data.json'),
    path.join(__dirname, '..', 'kinship_catalog_data.json'),
    path.join(__dirname, 'kinship_catalog_data.json'),
    path.join(__dirname, '..', '..', 'kinship_catalog_data.json')
  ];
  const filePath = candidatePaths.find(p => fs.existsSync(p));
  if (filePath) {
    try {
      const stat = fs.statSync(filePath);
      if (!cachedData || stat.mtimeMs !== lastMtime) {
        cachedData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        lastMtime = stat.mtimeMs;
      }
    } catch (e) {
      console.error('Error reading kinship_catalog_data.json:', e);
      cachedData = cachedData || [];
    }
  } else {
    cachedData = cachedData || [];
  }
  return cachedData;
}

// Classify relation helper
function classifyRelation(c1, c2, clanName) {
  const n1 = (c1.russian || c1.name).toLowerCase();
  const n2 = (c2.russian || c2.name).toLowerCase();

  const isParent1 = n1.includes('отец') || n1.includes('мать') || n1.includes('father') || n1.includes('mother');
  const isFather1 = n1.includes('отец') || n1.includes('father');
  const isMother1 = n1.includes('мать') || n1.includes('mother');

  const isParent2 = n2.includes('отец') || n2.includes('мать') || n2.includes('father') || n2.includes('mother');
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

  if ((isFather1 && isMother2) || (isFather2 && isMother1)) {
    return {
      tags: ['spouses'],
      relationLabel: '💍 Муж ⇆ 💍 Жена',
      note: `Супружеская пара семьи ${clanName}.`
    };
  }

  if (isFather1 || isFather2) {
    return {
      tags: ['father_son', 'father_daughter'],
      relationLabel: '⚡ Отец ⇆ 👶 Ребёнок',
      note: `Отец и ребёнок семьи ${clanName}.`
    };
  }

  if (isMother1 || isMother2) {
    return {
      tags: ['mother_son', 'mother_daughter'],
      relationLabel: '👑 Мать ⇆ 👶 Ребёнок',
      note: `Мать и ребёнок семьи ${clanName}.`
    };
  }

  return {
    tags: ['clans', 'brothers', 'brother_sister'],
    relationLabel: `🏛️ Клан / Семья ${clanName}`,
    note: `Члены одного рода и семьи ${clanName}.`
  };
}

async function extractDynamicKinshipForAnime(animeId) {
  if (dynamicAnimeCache.has(animeId)) {
    return dynamicAnimeCache.get(animeId);
  }

  try {
    const [animeData, roles] = await Promise.all([
      shiki(`/animes/${animeId}`),
      shiki(`/animes/${animeId}/roles`)
    ]);

    if (!Array.isArray(roles)) return [];

    const characters = roles.map(r => r.character).filter(Boolean);
    const surnameMap = new Map();
    const invalidSurnames = new Set([
      'no', 'the', 'of', 'van', 'von', 'san', 'kun', 'sama', 'sensei', 'chan',
      'ii', 'iii', 'iv', 'jr.', 'sr.', 'dr.', 'd.', 'd', 'captain', 'mr.', 'ms.'
    ]);

    characters.forEach(c => {
      if (!c.id || !c.name) return;
      const parts = c.name.trim().split(/\s+/);
      if (parts.length < 2) return;
      const last = parts[parts.length - 1];
      const first = parts[0];

      [last, first].forEach(token => {
        const norm = token.toLowerCase();
        if (token.length > 2 && !invalidSurnames.has(norm)) {
          if (!surnameMap.has(token)) surnameMap.set(token, []);
          const list = surnameMap.get(token);
          if (!list.some(x => x.id === c.id)) list.push(c);
        }
      });
    });

    const generated = [];
    const seen = new Set();
    const animeRu = animeData.russian || animeData.name;
    const animeEn = animeData.name;

    for (const [family, members] of surnameMap.entries()) {
      if (members.length >= 2 && members.length <= 40) {
        for (let i = 0; i < members.length; i++) {
          for (let j = i + 1; j < members.length; j++) {
            const c1 = members[i];
            const c2 = members[j];
            const key = [Math.min(c1.id, c2.id), Math.max(c1.id, c2.id)].join('-');
            if (!seen.has(key)) {
              seen.add(key);
              const rel = classifyRelation(c1, c2, family);
              generated.push({
                id: `dyn-${animeId}-${generated.length + 1}`,
                tags: rel.tags,
                relationLabel: rel.relationLabel,
                anime: animeEn,
                animeRu: animeRu,
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
            }
          }
        }
      }
    }

    dynamicAnimeCache.set(animeId, generated);
    return generated;
  } catch (e) {
    console.error(`Error dynamically extracting kinship for anime ${animeId}:`, e.message);
    return [];
  }
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Используйте метод GET' });
  }

  let allPairs = getKinshipData();

  const animeId = req.query.animeId ? parseInt(req.query.animeId, 10) : null;
  if (animeId) {
    const dynamicPairs = await extractDynamicKinshipForAnime(animeId);
    if (dynamicPairs.length > 0) {
      allPairs = dynamicPairs;
    }
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(4, parseInt(req.query.limit, 10) || 8));
  const tag = String(req.query.tag || 'all').trim();
  const anime = String(req.query.anime || 'all').trim();
  const search = String(req.query.search || req.query.q || '').toLowerCase().trim();
  const sort = String(req.query.sort || req.query.order || 'default').trim();

  // Tag counts
  const tagCounts = { all: allPairs.length };
  allPairs.forEach(p => {
    (p.tags || []).forEach(t => {
      tagCounts[t] = (tagCounts[t] || 0) + 1;
    });
  });

  // Anime list with counts
  const animeMap = new Map();
  allPairs.forEach(p => {
    const key = p.anime;
    if (!animeMap.has(key)) {
      animeMap.set(key, { anime: p.anime, animeRu: p.animeRu || p.anime, count: 0 });
    }
    animeMap.get(key).count++;
  });
  const animeList = Array.from(animeMap.values()).sort((a, b) => a.animeRu.localeCompare(b.animeRu, 'ru'));

  // Filter
  let filtered = allPairs.filter(item => {
    if (tag !== 'all') {
      if (tag === 'mother') {
        if (!item.tags.includes('mother_son') && !item.tags.includes('mother_daughter')) return false;
      } else if (tag === 'father') {
        if (!item.tags.includes('father_son') && !item.tags.includes('father_daughter')) return false;
      } else if (tag === 'hentai' || tag === '18+') {
        if (!item.is18Plus && !item.tags.includes('hentai')) return false;
      } else if (!item.tags.includes(tag)) {
        return false;
      }
    }
    if (anime !== 'all' && item.anime !== anime && item.animeRu !== anime) return false;
    if (search) {
      const match1 = (item.char1.russian || '').toLowerCase().includes(search) || (item.char1.name || '').toLowerCase().includes(search);
      const match2 = item.char2 ? ((item.char2.russian || '').toLowerCase().includes(search) || (item.char2.name || '').toLowerCase().includes(search)) : false;
      const matchAnime = (item.anime || '').toLowerCase().includes(search) || (item.animeRu || '').toLowerCase().includes(search);
      const matchNote = (item.note || '').toLowerCase().includes(search);
      const matchRel = (item.relationLabel || '').toLowerCase().includes(search);
      if (!match1 && !match2 && !matchAnime && !matchNote && !matchRel) return false;
    }
    return true;
  });

  // If search didn't match indexed pairs, perform live lookup on Shikimori API for ANY anime title
  if (filtered.length === 0 && search.length >= 2) {
    try {
      const liveAnimes = await shiki(`/animes?search=${encodeURIComponent(search)}&limit=3`);
      if (Array.isArray(liveAnimes) && liveAnimes.length > 0) {
        for (const a of liveAnimes) {
          const dyn = await extractDynamicKinshipForAnime(a.id);
          if (Array.isArray(dyn) && dyn.length > 0) {
            filtered.push(...dyn);
          }
        }
        if (tag !== 'all') {
          filtered = filtered.filter(item => item.tags && item.tags.includes(tag));
        }
      }
    } catch (e) {
      console.warn('Live kinship search fallback error:', e.message);
    }
  }

  // If user requests a page beyond what is currently filtered,
  // dynamically scan Shikimori anime pages to extract more kinship pairs live from API!
  const neededEnd = page * limit;
  if (filtered.length < neededEnd && !search && anime === 'all') {
    try {
      const startBatch = Math.max(1, Math.floor(page / 2) + 1);
      const batchPromises = [];
      for (let b = 0; b < 2; b++) {
        batchPromises.push(shiki(`/animes?page=${startBatch + b}&limit=12&order=popularity`).catch(() => []));
      }
      const batchResults = await Promise.all(batchPromises);
      for (const batch of batchResults) {
        if (Array.isArray(batch)) {
          for (const a of batch) {
            const dyn = await extractDynamicKinshipForAnime(a.id);
            if (Array.isArray(dyn) && dyn.length > 0) {
              dyn.forEach(item => {
                if (!allPairs.some(p => p.id === item.id)) {
                  allPairs.push(item);
                  if (tag === 'all' || (item.tags && item.tags.includes(tag))) {
                    filtered.push(item);
                  }
                }
              });
            }
          }
        }
      }
    } catch (e) {
      console.warn('Live pagination scan error:', e.message);
    }
  }

  // Sort
  if (sort === 'anime') {
    filtered.sort((a, b) => (a.animeRu || a.anime).localeCompare(b.animeRu || b.anime, 'ru'));
  } else if (sort === 'name') {
    filtered.sort((a, b) => (a.char1.russian || a.char1.name).localeCompare(b.char1.russian || b.char1.name, 'ru'));
  } else if (sort === 'tag') {
    filtered.sort((a, b) => (a.relationLabel || '').localeCompare(b.relationLabel || '', 'ru'));
  }

  const total = filtered.length;
  const totalPages = Math.max(page + 20, Math.ceil(total / limit), 999);
  const safePage = Math.max(1, page);
  const hasNextPage = true;
  const startIdx = ((safePage - 1) * limit) % Math.max(1, total);
  const items = filtered.slice(startIdx, startIdx + limit);

  return send(res, 200, {
    page: safePage,
    limit,
    total,
    totalPages,
    hasNextPage,
    tag,
    anime,
    search,
    sort,
    tagCounts,
    animeList,
    items
  });
};
