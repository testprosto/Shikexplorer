const API = 'https://shikimori.one/api';

async function shiki(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      'Accept': 'application/json',
      'User-Agent': 'ShikimoriTitleExplorer/1.0 (Vercel app)'
    },
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) {
    const error = new Error(`Shikimori вернул ошибку ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

function send(res, status, data) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');
  return res.status(status).json(data);
}

module.exports = { shiki, send };
