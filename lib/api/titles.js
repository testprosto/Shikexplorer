const { shiki, send } = require('../shikimori');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    return send(res, 405, { error: 'Используйте метод GET' });
  }

  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.min(50, Math.max(6, parseInt(req.query.limit, 10) || 24));
  const validOrders = ['popularity', 'ranked', 'aired_on', 'name', 'id'];
  const order = validOrders.includes(req.query.order) ? req.query.order : 'popularity';
  const kind = String(req.query.kind || '').trim();
  const search = String(req.query.search || req.query.q || '').trim();

  const queryParts = [
    `page=${page}`,
    `limit=${limit}`,
    `order=${order}`
  ];

  if (kind && kind !== 'all') {
    queryParts.push(`kind=${encodeURIComponent(kind)}`);
  }

  if (search) {
    queryParts.push(`search=${encodeURIComponent(search)}`);
  }

  const endpoint = `/animes?${queryParts.join('&')}`;

  try {
    const data = await shiki(endpoint);
    const items = Array.isArray(data) ? data : [];

    const titles = items.map(t => ({
      id: t.id,
      name: t.name,
      russian: t.russian || t.name,
      image: t.image ? {
        original: t.image.original || '',
        preview: t.image.preview || '',
        x96: t.image.x96 || ''
      } : null,
      url: t.url,
      kind: t.kind,
      score: t.score,
      status: t.status,
      episodes: t.episodes,
      episodes_aired: t.episodes_aired,
      aired_on: t.aired_on,
      released_on: t.released_on
    }));

    return send(res, 200, {
      page,
      limit,
      order,
      kind: kind || 'all',
      search,
      count: titles.length,
      titles
    });
  } catch (err) {
    console.error('Titles API error:', err);
    return send(res, err.status || 500, {
      error: err.message || 'Не удалось загрузить каталог аниме.'
    });
  }
};
