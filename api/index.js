const { URL } = require('url');

const handlers = {
  'acdb-relations': require('../lib/api/acdb-relations'),
  'anime': require('../lib/api/anime'),
  'character': require('../lib/api/character'),
  'characters-batch': require('../lib/api/characters-batch'),
  'characters-catalog': require('../lib/api/characters-catalog'),
  'kinship': require('../lib/api/kinship'),
  'manga': require('../lib/api/manga'),
  'proxy-image': require('../lib/api/proxy-image'),
  'related': require('../lib/api/related'),
  'roles': require('../lib/api/roles'),
  'search': require('../lib/api/search'),
  'shiki-find': require('../lib/api/shiki-find'),
  'titles': require('../lib/api/titles'),
  'wikidata-relations': require('../lib/api/wikidata-relations')
};

module.exports = async (req, res) => {
  const fullUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  
  // Extract endpoint from rewrite parameter or URL path
  let endpoint = fullUrl.searchParams.get('__endpoint');
  if (!endpoint) {
    const cleanPath = fullUrl.pathname.replace(/^\/api\/?/, '');
    endpoint = cleanPath.split('/')[0];
  }

  endpoint = (endpoint || '').replace(/\.js$/, '').toLowerCase();

  // Ensure req.query is fully populated
  if (!req.query) {
    req.query = Object.fromEntries(fullUrl.searchParams.entries());
  } else {
    for (const [k, v] of fullUrl.searchParams.entries()) {
      if (!(k in req.query)) req.query[k] = v;
    }
  }

  const handler = handlers[endpoint];
  if (typeof handler === 'function') {
    return handler(req, res);
  }

  res.statusCode = 404;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ error: `API endpoint '${endpoint}' not found` }));
};
