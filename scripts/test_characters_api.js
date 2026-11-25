const { shiki } = require('../lib/shikimori');

async function test() {
  const endpoints = [
    '/characters/search?q=a',
    '/characters?search=a',
    '/characters?page=1',
    '/animes/21/roles', // One Piece
    '/characters/54495' // Linlin Charlotte
  ];

  for (const ep of endpoints) {
    try {
      const res = await shiki(ep);
      console.log(`Endpoint ${ep}:`, Array.isArray(res) ? `Array [${res.length}]` : typeof res);
      if (Array.isArray(res) && res[0]) console.log('  sample:', res[0].name || res[0].id);
    } catch (e) {
      console.log(`Endpoint ${ep} FAILED:`, e.message);
    }
  }
}

test().catch(console.error);
