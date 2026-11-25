const { shiki, send, getDiskCache } = require('../shikimori');

// GET /api/characters-batch?ids=123,456,789&cached_only=1
// Fast batch endpoint: returns details for multiple characters in one request.
// If cached_only=1, returns only characters already cached on disk without hitting Shikimori API.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });

  const idsStr = String(req.query.ids || '').trim();
  if (!idsStr) return send(res, 200, { characters: [] });

  const cachedOnly = req.query.cached_only === '1' || req.query.cached_only === 'true';
  const raw = decodeURIComponent(idsStr);
  const ids = [...new Set(raw.split(/[,\s]+/).map(s => s.trim()).filter(s => /^\d+$/.test(s)))].slice(0, 60);

  if (!ids.length) return send(res, 200, { characters: [] });

  const results = [];
  const missing = [];

  // 1. First pass: retrieve all cached records immediately from disk in 0ms
  for (const id of ids) {
    const key = `/characters/${id}`;
    const cached = getDiskCache(key);
    if (cached && cached.id) {
      results.push(cached);
    } else if (!cachedOnly) {
      missing.push(id);
    }
  }

  // 2. Second pass (if not cached_only): fetch missing characters (limit to 5 per batch to prevent 429)
  if (!cachedOnly && missing.length > 0) {
    const toFetch = missing.slice(0, 5);
    for (const id of toFetch) {
      try {
        const charData = await shiki(`/characters/${id}`);
        if (charData && charData.id) {
          results.push(charData);
        }
      } catch (_) {}
    }
  }

  return send(res, 200, {
    characters: results,
    cachedCount: results.length - missing.length,
    fetchedCount: missing.length,
    total: results.length
  });
};
