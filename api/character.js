const { shiki, send } = require('../lib/shikimori');

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const id = String(req.query.id || '');
  const isFresh = req.query.fresh === '1';
  if (!/^\d+$/.test(id)) return send(res, 400, { error: 'Неверный ID персонажа.' });
  try {
    const data = await shiki(`/characters/${id}`, undefined, isFresh);
    return send(res, 200, { character: data });
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Не удалось загрузить персонажа.' });
  }
};
