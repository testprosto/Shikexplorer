const { shiki, send } = require('../lib/shikimori');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return send(res, 400, { error: 'Введи хотя бы 2 символа.' });
  if (q.length > 100) return send(res, 400, { error: 'Слишком длинный запрос.' });
  try {
    const items = await shiki(`/animes?search=${encodeURIComponent(q)}&limit=12&order=ranked`);
    return send(res, 200, { items: Array.isArray(items) ? items : [] });
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Не удалось выполнить поиск.' });
  }
};
