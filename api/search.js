const { shiki, send } = require('../lib/shikimori');
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const q = String(req.query.q || '').trim();
  if (q.length < 2) return send(res, 400, { error: 'Введи хотя бы 2 символа.' });
  if (q.length > 100) return send(res, 400, { error: 'Слишком длинный запрос.' });
  try {
    const [animeResult, mangaResult, ranobeResult] = await Promise.allSettled([
      shiki(`/animes?search=${encodeURIComponent(q)}&limit=12&order=ranked`),
      shiki(`/mangas?search=${encodeURIComponent(q)}&limit=12&order=ranked`),
      shiki(`/ranobe?search=${encodeURIComponent(q)}&limit=12&order=ranked`)
    ]);
    const anime = animeResult.status === 'fulfilled' && Array.isArray(animeResult.value)
      ? animeResult.value.map(x => ({ ...x, media_type: 'anime' })) : [];
    const manga = mangaResult.status === 'fulfilled' && Array.isArray(mangaResult.value)
      ? mangaResult.value.map(x => ({ ...x, media_type: 'manga' })) : [];
    const ranobe = ranobeResult.status === 'fulfilled' && Array.isArray(ranobeResult.value)
      ? ranobeResult.value.map(x => ({ ...x, media_type: 'ranobe' })) : [];
    const items = [...anime, ...manga, ...ranobe].sort((a,b) => Number(b.score||0)-Number(a.score||0)).slice(0,20);
    if (!items.length && animeResult.status === 'rejected' && mangaResult.status === 'rejected' && ranobeResult.status === 'rejected')
      throw animeResult.reason || mangaResult.reason;
    return send(res, 200, { items, sources: { anime: anime.length, manga: manga.length, ranobe: ranobe.length } });
  } catch (e) { return send(res, e.status || 502, { error: e.message || 'Не удалось выполнить поиск.' }); }
};
