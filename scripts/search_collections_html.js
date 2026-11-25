async function searchCollections(q) {
  const url = `https://shikimori.one/collections/search?q=${encodeURIComponent(q)}`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const regex = /<a[^>]*href="\/collections\/(\d+-[^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
  const list = [];
  let m;
  while ((m = regex.exec(html)) !== null) {
    const slug = m[1];
    const text = m[2].replace(/<[^>]+>/g, '').trim();
    if (text && !list.some(x => x.slug === slug)) {
      list.push({ slug, text });
    }
  }
  return list;
}

async function run() {
  for (const q of ['мамы', 'мама', 'отцы', 'отец', 'братья', 'сестры']) {
    const cols = await searchCollections(q);
    console.log(`\nQuery "${q}": found ${cols.length} collections:`);
    cols.slice(0, 5).forEach(c => console.log(`  - [${c.slug}] ${c.text}`));
  }
}

run().catch(console.error);
