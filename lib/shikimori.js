const API = 'https://shikimori.one/api';

// Safe rate-limiter: sequential queue with minimum 260ms spacing
// to strictly respect Shikimori's 5 RPS limit (~3.8 requests/sec).
// Immune to deadlocks: internal retry loop, no nested schedule calls.
const requestQueue = [];
let isProcessingQueue = false;
let lastRequestTime = 0;
let backoffUntil = 0;
const MIN_INTERVAL_MS = 260;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;

  while (requestQueue.length > 0) {
    const item = requestQueue.shift();

    // 1. If currently in a 429 backoff pause, wait until it clears
    const now = Date.now();
    if (now < backoffUntil) {
      await new Promise(res => setTimeout(res, backoffUntil - now));
    }

    // 2. Minimum interval spacing between calls
    const elapsed = Date.now() - lastRequestTime;
    if (elapsed < MIN_INTERVAL_MS) {
      await new Promise(res => setTimeout(res, MIN_INTERVAL_MS - elapsed));
    }

    lastRequestTime = Date.now();

    // 3. Execute task with timeout & retries inside
    try {
      const result = await item.fn();
      item.resolve(result);
    } catch (err) {
      item.reject(err);
    }
  }

  isProcessingQueue = false;
}

function scheduleRequest(fn, highPriority = false) {
  return new Promise((resolve, reject) => {
    if (highPriority) {
      requestQueue.unshift({ fn, resolve, reject });
    } else {
      requestQueue.push({ fn, resolve, reject });
    }
    processQueue();
  });
}

// Direct live request to Shikimori without any caching
async function shiki(path, opts = {}) {
  const isHighPriority = opts.priority ?? true;

  return scheduleRequest(async () => {
    for (let attempt = 0; attempt <= 2; attempt++) {
      try {
        const response = await fetch(`${API}${path}`, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'ShikimoriTitleExplorer/3.0 (Direct Realtime Mode)'
          },
          signal: AbortSignal.timeout(10000)
        });

        if (response.status === 429) {
          console.warn(`[Shikimori] 429 Rate limited на ${path}. Пауза 2.5с...`);
          backoffUntil = Date.now() + 2500;
          await new Promise(r => setTimeout(r, 2500));
          continue;
        }

        if (!response.ok) {
          const error = new Error(`Shikimori вернул ошибку ${response.status}`);
          error.status = response.status;
          throw error;
        }

        const data = await response.json();
        return data;
      } catch (err) {
        if (attempt < 2 && (err.name === 'TimeoutError' || err.status === 502)) {
          await new Promise(r => setTimeout(r, 800));
          continue;
        }
        throw err;
      }
    }
  }, isHighPriority);
}

function send(res, status, data) {
  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    // Instruct clients and proxies to NEVER cache API responses
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
  }
  if (typeof res.status === 'function' && typeof res.json === 'function') {
    return res.status(status).json(data);
  }
  res.statusCode = status;
  return res.end(typeof data === 'string' ? data : JSON.stringify(data));
}

// Dummy functions for backward compatibility with existing imports
function getDiskCache() { return null; }
function setDiskCache() {}
async function cachedFetch(key, fetcher) { return fetcher(); }

module.exports = { shiki, send, getDiskCache, setDiskCache, cachedFetch };
