const { shiki } = require('../lib/shikimori');

async function benchmark() {
  const t0 = Date.now();
  console.log('Fetching 8 anime roles simultaneously...');
  const ids = [16498, 1535, 5114, 30276, 38000, 31964, 11757, 11061];
  const results = await Promise.all(ids.map(id => shiki(`/animes/${id}/roles`).catch(() => [])));
  const t1 = Date.now();
  console.log(`Fetched 8 anime rosters in ${t1 - t0}ms! Total roles:`, results.reduce((a, b) => a + b.length, 0));
}

benchmark().catch(console.error);
