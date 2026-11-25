const { shiki, send, cachedFetch } = require('../shikimori');

const FIND_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// GET /api/shiki-find?name=Minato%20Namikaze&name_en=Minato%20Namikaze
// Finds characters in Shikimori by name (tries English and Russian transliterations)
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const name = String(req.query.name || '').trim();
  const nameEn = String(req.query.name_en || '').trim();

  const searchTerms = [];
  for (const s of [nameEn, name].filter(Boolean)) {
    const clean = s.trim();
    if (clean.length >= 2) {
      searchTerms.push(clean);
      const words = clean.split(/\s+/).filter(Boolean);
      if (words.length === 2) {
        searchTerms.push(`${words[1]} ${words[0]}`);
      } else if (words.length >= 3) {
        searchTerms.push(`${words[words.length - 1]} ${words.slice(0, -1).join(' ')}`);
        searchTerms.push(`${words.slice(1).join(' ')} ${words[0]}`);
      }
    }
  }

  if (!searchTerms.length) return send(res, 400, { error: 'Нужно имя персонажа.' });

  // Add transliterated variant if Russian has 'е' (e.g. Намиказе -> Намиказэ)
  if (name && /[а-яё]/i.test(name)) {
    if (name.includes('е') || name.includes('Е')) {
      searchTerms.push(name.replace(/е/gi, 'э'));
    }
    if (name.includes('э') || name.includes('Э')) {
      searchTerms.push(name.replace(/э/gi, 'е'));
    }
  }

  const cacheKey = `find:${nameEn.toLowerCase()}|${name.toLowerCase()}`;

  try {
    const items = await cachedFetch(cacheKey, async () => {
      const results = [];
      const seenIds = new Set();

      for (const term of searchTerms) {
        if (results.length >= 5) break;
        try {
          const data = await shiki(`/characters/search?search=${encodeURIComponent(term)}&limit=10`);
          if (Array.isArray(data)) {
            for (const x of data) {
              if (!seenIds.has(String(x.id))) {
                seenIds.add(String(x.id));
                results.push({
                  id: x.id,
                  name: x.name,
                  russian: x.russian,
                  image: x.image,
                  url: x.url
                });
              }
            }
          }
        } catch (_) {}
      }
      return results;
    }, FIND_CACHE_TTL);

    return send(res, 200, { items });
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Не удалось найти персонажа.' });
  }
};
