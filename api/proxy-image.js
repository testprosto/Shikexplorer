const { URL } = require('url');

function isAllowedHost(hostname) {
  if (!hostname) return false;
  const h = hostname.toLowerCase();
  return (
    h === 'shikimori.one' || h.endsWith('.shikimori.one') ||
    h === 'shikimori.io' || h.endsWith('.shikimori.io') ||
    h === 'wikimedia.org' || h.endsWith('.wikimedia.org') ||
    h === 'animecharactersdatabase.com' || h.endsWith('.animecharactersdatabase.com')
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  try {
    const parsed = new URL(req.url, `http://${req.headers.host || 'localhost:3000'}`);
    let target = parsed.searchParams.get('url');
    if (!target) {
      res.statusCode = 400;
      res.end('Missing url');
      return;
    }

    if (target.startsWith('/')) {
      target = `https://shikimori.one${target}`;
    }

    const targetUrl = new URL(target);
    if (!isAllowedHost(targetUrl.hostname)) {
      res.statusCode = 403;
      res.end('Host not allowed');
      return;
    }

    const resp = await fetch(targetUrl.href, {
      redirect: 'follow',
      headers: {
        'User-Agent': 'ShikimoriTitleExplorer/3.0 (https://github.com/shikimori; contact@shikimori.me)',
        'Referer': targetUrl.hostname.includes('shikimori') ? 'https://shikimori.one/' : ''
      }
    });

    if (!resp.ok) {
      res.statusCode = resp.status;
      res.end('Remote error');
      return;
    }

    const contentType = resp.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=2592000');
    res.setHeader('Content-Length', String(buffer.byteLength));
    res.end(buffer);
  } catch (err) {
    console.error('Proxy image error:', err.message);
    res.statusCode = 500;
    res.end('Server error');
  }
};
