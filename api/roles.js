const { shiki, send } = require('../lib/shikimori');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const id = String(req.query.id || '');
  const media = String(req.query.type || 'anime').toLowerCase();
  const type = media === 'manga' ? 'mangas' : media === 'ranobe' ? 'ranobe' : 'animes';
  if (!/^\d+$/.test(id)) return send(res, 400, { error: 'Неверный ID тайтла.' });
  try {
    const data = await shiki(`/${type}/${id}/roles`);
    return send(res, 200, { items: Array.isArray(data) ? data : [] });
  } catch (e) { return send(res, e.status || 502, { error: e.message || 'Не удалось загрузить персонажей.' }); }
};
