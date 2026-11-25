const { shiki, send } = require('../shikimori');
const fs = require('fs');
const path = require('path');

// Load verified relations index to quickly attach known kinship ties
let verifiedMap = null;
function getVerifiedKinship() {
  if (!verifiedMap) {
    verifiedMap = new Map();
    const p1 = path.join(process.cwd(), 'kinship_catalog_data.json');
    const p2 = path.join(__dirname, '..', 'kinship_catalog_data.json');
    const filePath = fs.existsSync(p1) ? p1 : p2;
    if (fs.existsSync(filePath)) {
      try {
        const list = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        list.forEach(p => {
          const id1 = String(p.char1.id);
          const id2 = String(p.char2.id);

          if (!verifiedMap.has(id1)) verifiedMap.set(id1, []);
          verifiedMap.get(id1).push({
            relative: p.char2,
            relationLabel: p.relationLabel,
            tags: p.tags,
            anime: p.animeRu || p.anime,
            note: p.note
          });

          if (!verifiedMap.has(id2)) verifiedMap.set(id2, []);
          verifiedMap.get(id2).push({
            relative: p.char1,
            relationLabel: p.relationLabel,
            tags: p.tags,
            anime: p.animeRu || p.anime,
            note: p.note
          });
        });
      } catch (e) {
        console.error(e);
      }
    }
  }
  return verifiedMap;
}

// Extract relations from character description
function extractFromDescription(desc = '') {
  const d = desc.toLowerCase();
  const tags = new Set();
  const mentions = [];

  // Match [character=123]Name[/character]
  const regex = /\[character=(\d+)\](.*?)\[\/character\]/gi;
  let m;
  while ((m = regex.exec(desc)) !== null) {
    mentions.push({ id: m[1], name: m[2] });
  }

  if (d.includes('мать') || d.includes('мама') || d.includes('mother')) {
    tags.add('mother_son');
    tags.add('mother_daughter');
  }
  if (d.includes('отец') || d.includes('папа') || d.includes('father')) {
    tags.add('father_son');
    tags.add('father_daughter');
  }
  if (d.includes('брат') || d.includes('brother')) {
    tags.add('brothers');
    tags.add('brother_sister');
  }
  if (d.includes('сестра') || d.includes('sister')) {
    tags.add('sisters');
    tags.add('brother_sister');
  }
  if (d.includes('муж') || d.includes('жена') || d.includes('супруг') || d.includes('husband') || d.includes('wife')) {
    tags.add('spouses');
  }
  if (d.includes('дедушка') || d.includes('бабушка') || d.includes('внук') || d.includes('внучка') || d.includes('grandfather') || d.includes('grandmother')) {
    tags.add('grandparent');
  }
  if (d.includes('приёмн') || d.includes('удочер') || d.includes('усынов') || d.includes('adopt')) {
    tags.add('adoptive');
  }
  if (d.includes('клан') || d.includes('семь') || d.includes('династи') || d.includes('clan')) {
    tags.add('clans');
  }

  return { tags: Array.from(tags), mentions };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Используйте метод GET' });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(36, Math.max(6, parseInt(req.query.limit, 10) || 18));
  const tag = String(req.query.tag || 'all').trim();
  const search = String(req.query.search || req.query.q || '').trim();

  const kinshipIndex = getVerifiedKinship();

  const graphqlQuery = `
    query($search: String, $page: Int, $limit: Int) {
      characters(search: $search, page: $page, limit: $limit) {
        id
        name
        russian
        description
        poster {
          mainUrl
          originalUrl
        }
        url
      }
    }
  `;

  try {
    const gqlRes = await fetch('https://shikimori.one/api/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'ShikimoriTitleExplorer/3.0 (https://github.com/shikimori; contact@shikimori.me)'
      },
      body: JSON.stringify({
        query: graphqlQuery,
        variables: {
          search: search || undefined,
          page,
          limit
        }
      })
    });

    const gqlData = await gqlRes.json();
    const rawList = Array.isArray(gqlData?.data?.characters) ? gqlData.data.characters : [];

    const enriched = rawList.map(c => {
      const charId = String(c.id);
      const verifiedRels = kinshipIndex.get(charId) || [];
      const parsed = extractFromDescription(c.description || '');

      const allTags = new Set([...parsed.tags]);
      verifiedRels.forEach(r => (r.tags || []).forEach(t => allTags.add(t)));

      return {
        id: Number(c.id),
        name: c.name,
        russian: c.russian || c.name,
        poster: c.poster?.mainUrl || c.poster?.originalUrl || '',
        url: c.url,
        tags: Array.from(allTags),
        relations: verifiedRels,
        mentionsCount: parsed.mentions.length,
        hasRelatives: verifiedRels.length > 0 || allTags.size > 0
      };
    });

    // Tag filtering
    let filtered = enriched;
    if (tag && tag !== 'all') {
      filtered = enriched.filter(c => c.tags.includes(tag) || c.relations.some(r => r.tags.includes(tag)));
    }

    return send(res, 200, {
      page,
      limit,
      tag,
      search,
      count: filtered.length,
      characters: filtered
    });
  } catch (err) {
    console.error('Characters Catalog API error:', err);
    return send(res, 500, { error: err.message || 'Ошибка загрузки каталога персонажей' });
  }
};
