const { shiki, send } = require('../lib/shikimori');

// GET /api/shiki-find?name=Minato%20Namikaze
// Finds characters in Shikimori by name. Used to attach images to relatives
// that come from Wikidata/ACDB and to open them as full Shikimori profiles.
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const name = String(req.query.name || '').trim();
  if (name.length < 2) return send(res, 400, { error: 'Нужно имя персонажа.' });
  if (name.length > 100) return send(res, 400, { error: 'Слишком длинное имя.' });
  try {
    const data = await shiki(`/characters/search?search=${encodeURIComponent(name)}&limit=8`);
    const items = (Array.isArray(data) ? data : []).map(x => ({
      id: x.id, name: x.name, russian: x.russian, image: x.image, url: x.url
    }));
    return send(res, 200, { items });
  } catch (e) {
    return send(res, e.status || 502, { error: e.message || 'Не удалось найти персонажа.' });
  }
};
