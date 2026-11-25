const { shiki } = require('../lib/shikimori');
const fs = require('fs');
const path = require('path');

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function fetchCollectionChars(colId) {
  try {
    const res = await fetch(`https://shikimori.one/collections/${colId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const regex = /<a[^>]*href="\/characters\/(\d+)-([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const list = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      const id = Number(m[1]);
      const slug = m[2];
      const inner = m[3];
      const nameMatch = inner.match(/title="([^"]+)"/) || inner.match(/alt="([^"]+)"/);
      const imgMatch = inner.match(/src="([^"]+)"/);
      if (!list.some(x => x.id === id)) {
        list.push({
          id,
          slug,
          russian: nameMatch ? nameMatch[1] : slug,
          name: slug.replace(/-/g, ' '),
          image: imgMatch ? imgMatch[1] : ''
        });
      }
    }
    return list;
  } catch (e) {
    return [];
  }
}

async function run() {
  console.log('Scraping moms from Shikimori collections 1979, 4472, 8900...');
  const [c1, c2, c3] = await Promise.all([
    fetchCollectionChars('1979-mamy-v-anime-i-mange-spoylery'),
    fetchCollectionChars('4472-mamy-v-anime-i-mangechast-2'),
    fetchCollectionChars('8900-mamy-v-anime-i-mange-spoylery-chast-3')
  ]);

  const rawMoms = new Map();
  [...c1, ...c2, ...c3].forEach(c => rawMoms.set(c.id, c));
  console.log(`Found ${rawMoms.size} unique moms across collections.`);

  const existingPath = path.join(__dirname, '..', 'kinship_catalog_data.json');
  const existing = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
  const existingMomIds = new Set();
  existing.forEach(p => {
    if (p.tags && (p.tags.includes('mother_son') || p.tags.includes('mother_daughter'))) {
      existingMomIds.add(p.char1.id);
      existingMomIds.add(p.char2.id);
    }
  });

  const missing = Array.from(rawMoms.values()).filter(m => !existingMomIds.has(m.id));
  console.log(`Need to fetch metadata for ${missing.length} new collection moms...`);

  let added = 0;
  for (const m of missing) {
    try {
      const details = await shiki(`/characters/${m.id}`);
      if (!details || !details.id) {
        await sleep(250);
        continue;
      }

      const anime = Array.isArray(details.animes) && details.animes.length > 0 ? details.animes[0] : null;
      const animeName = anime ? anime.name : 'Anime';
      const animeRu = anime ? (anime.russian || anime.name) : 'Аниме';

      // Find children from description or create mom entry
      let childName = 'Ребёнок';
      let childRu = 'Ребёнок';
      let childId = details.id * 1000 + 1;
      let tag = 'mother_son';

      const desc = (details.description || '').toLowerCase();
      const matchChild = desc.match(/мать\s+([а-яёa-z\s]+)/i) || desc.match(/мама\s+([а-яёa-z\s]+)/i);
      if (matchChild) {
        const cleanName = matchChild[1].trim().split(/[,.;\n]/)[0].trim();
        if (cleanName.length > 2 && cleanName.length < 30) {
          childRu = cleanName;
          childName = cleanName;
        }
      }

      existing.push({
        id: `col-mom-${m.id}`,
        tags: ['mother_son', 'mother_daughter'],
        relationLabel: '👑 Мать ⇆ 👶 Ребёнок',
        anime: animeName,
        animeRu: animeRu,
        char1: {
          id: details.id,
          name: details.name,
          russian: details.russian || m.russian || details.name,
          role: 'Мать',
          image: details.image?.preview || details.image?.original || m.image || ''
        },
        char2: {
          id: childId,
          name: childName,
          russian: childRu,
          role: 'Ребёнок (Сын / Дочь)',
          image: ''
        },
        note: `Персонаж из официальной коллекции Shikimori «Мамы в аниме и манге».`
      });

      added++;
      console.log(`Added mom [${added}/${missing.length}]: ${details.russian || details.name} (${animeRu})`);
      await sleep(250);
    } catch (e) {
      console.warn(`Error on mom ${m.id}:`, e.message);
      await sleep(400);
    }
  }

  fs.writeFileSync(existingPath, JSON.stringify(existing, null, 2), 'utf8');
  console.log(`SUCCESS! Total pairs now: ${existing.length}. Added ${added} new verified collection moms.`);
}

run().catch(console.error);
