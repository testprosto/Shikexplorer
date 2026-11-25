const { shiki, send } = require('../shikimori');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const id = String(req.query.id || '');
  if (!/^\d+$/.test(id)) return send(res, 400, { error: 'Неверный ID манги.' });
  try {
    const data = await shiki(`/mangas/${id}`);
    return send(res, 200, { manga: data });
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Не удалось загрузить мангу.' });
  }
};
