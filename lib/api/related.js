const { shiki, send } = require('../shikimori');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const id = String(req.query.id || '');
  const media = String(req.query.type || 'anime').toLowerCase();
  const type = media === 'manga' ? 'mangas' : media === 'ranobe' ? 'ranobe' : 'animes';
  if (!/^\d+$/.test(id)) return send(res, 400, { error: 'Неверный ID тайтла.' });
  try {
    const data = await shiki(`/${type}/${id}/related`);
    const items = [];
    for (const row of Array.isArray(data) ? data : []) {
      for (const [key, mediaType] of [['anime','anime'],['manga','manga'],['ranobe','ranobe']]) {
        const item = row[key];
        if (item && item.id) items.push({ ...item, media_type: mediaType, relation: row.relation_russian || row.relation || '' });
      }
    }
    const unique = [...new Map(items.map(x => [`${x.media_type}:${x.id}`, x])).values()];
    return send(res, 200, { items: unique });
  } catch (e) { return send(res, e.status || 502, { error: e.message || 'Не удалось загрузить связанные тайтлы.' }); }
};
