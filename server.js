const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { URL } = require('url');

const PORT = process.env.PORT || 3000;
const PUBLIC_DIR = path.resolve(__dirname, 'public');
const API_DIR = path.resolve(__dirname, 'lib', 'api');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const COMPRESSIBLE_EXTS = new Set(['.html', '.css', '.js', '.json', '.svg']);

function getApiHandler(name) {
  const filePath = path.join(API_DIR, `${name}.js`);
  if (fs.existsSync(filePath)) {
    try {
      // Invalidate require cache to always load fresh handlers in development / direct realtime mode
      const resolved = require.resolve(filePath);
      delete require.cache[resolved];
      return require(filePath);
    } catch (err) {
      console.error(`Ошибка загрузки обработчика API ${name}:`, err);
      return null;
    }
  }
  return null;
}

// Compress buffer with gzip or deflate based on client Accept-Encoding
function compressBuffer(buffer, acceptEncoding) {
  if (!acceptEncoding) return { data: buffer, encoding: null };
  if (acceptEncoding.includes('gzip')) {
    return { data: zlib.gzipSync(buffer, { level: 6 }), encoding: 'gzip' };
  }
  if (acceptEncoding.includes('deflate')) {
    return { data: zlib.deflateSync(buffer, { level: 6 }), encoding: 'deflate' };
  }
  return { data: buffer, encoding: null };
}

function serveStatic(req, res, filePath) {
  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Fallback to index.html for SPA routes
      const indexPath = path.join(PUBLIC_DIR, 'index.html');
      fs.stat(indexPath, (indexErr, indexStats) => {
        if (indexErr || !indexStats.isFile()) {
          res.statusCode = 404;
          res.end('Not Found');
          return;
        }
        serveFile(req, res, indexPath, indexStats);
      });
      return;
    }

    serveFile(req, res, filePath, stats);
  });
}

function serveFile(req, res, targetPath, stats) {
  const ext = path.extname(targetPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  res.statusCode = 200;
  res.setHeader('Content-Type', contentType);
  // NEVER cache static or scripts: any edit or refresh updates instantly!
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  const acceptEncoding = req.headers['accept-encoding'] || '';
  const shouldCompress = COMPRESSIBLE_EXTS.has(ext) && stats.size > 512;

  if (shouldCompress && acceptEncoding.includes('gzip')) {
    res.setHeader('Content-Encoding', 'gzip');
    res.setHeader('Vary', 'Accept-Encoding');
    const gzip = zlib.createGzip({ level: 6 });
    fs.createReadStream(targetPath).pipe(gzip).pipe(res);
  } else if (shouldCompress && acceptEncoding.includes('deflate')) {
    res.setHeader('Content-Encoding', 'deflate');
    res.setHeader('Vary', 'Accept-Encoding');
    const deflate = zlib.createDeflate({ level: 6 });
    fs.createReadStream(targetPath).pipe(deflate).pipe(res);
  } else {
    fs.createReadStream(targetPath).pipe(res);
  }
}

const server = http.createServer(async (req, res) => {
  if (req.socket && typeof req.socket.setNoDelay === 'function') {
    req.socket.setNoDelay(true);
  }

  // Helper methods for res
  res.status = function (code) {
    this.statusCode = code;
    return this;
  };

  res.json = function (data) {
    if (!this.getHeader('Content-Type')) {
      this.setHeader('Content-Type', 'application/json; charset=utf-8');
    }
    // Prevent client-side caching of API responses
    this.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
    this.setHeader('Pragma', 'no-cache');

    const raw = Buffer.from(JSON.stringify(data), 'utf8');
    const acceptEncoding = req.headers['accept-encoding'] || '';

    if (raw.length > 512 && (acceptEncoding.includes('gzip') || acceptEncoding.includes('deflate'))) {
      const { data: compressed, encoding } = compressBuffer(raw, acceptEncoding);
      if (encoding) {
        this.setHeader('Content-Encoding', encoding);
        this.setHeader('Vary', 'Accept-Encoding');
        this.setHeader('Content-Length', compressed.length);
        this.end(compressed);
        return this;
      }
    }

    this.setHeader('Content-Length', raw.length);
    this.end(raw);
    return this;
  };

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Handle API routes
  if (pathname.startsWith('/api/')) {
    const routeName = pathname.replace(/^\/api\//, '').replace(/\.js$/, '');
    const handler = getApiHandler(routeName);

    if (handler) {
      req.query = Object.fromEntries(parsedUrl.searchParams.entries());
      try {
        await handler(req, res);
      } catch (err) {
        console.error(`Ошибка в API /api/${routeName}:`, err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Внутренняя ошибка сервера', details: err.message });
        }
      }
      return;
    } else {
      res.status(404).json({ error: `Маршрут /api/${routeName} не найден` });
      return;
    }
  }

  // Handle Static files with secure path traversal protection
  let safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') safePath = '/index.html';
  const filePath = path.resolve(PUBLIC_DIR, '.' + safePath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.statusCode = 403;
    res.end('Forbidden');
    return;
  }

  serveStatic(req, res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Shikimori Explorer успешно запущен на вашем ПК!`);
  console.log(`📡 Локальный адрес: http://localhost:${PORT}`);
  console.log(`⚡ Режим: 100% Прямые live-запросы в реальном времени!`);
  console.log(`⚙️  Node.js ${process.version} (локальный сервер)`);
  console.log(`======================================================\n`);
});
