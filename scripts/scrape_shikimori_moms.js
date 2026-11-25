async function fetchCollectionChars(colId) {
  try {
    const res = await fetch(`https://shikimori.one/collections/${colId}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const html = await res.text();
    const regex = /<a[^>]*href="\/characters\/(\d+)-([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi;
    const list = [];
    let m;
    while ((m = regex.exec(html)) !== null) {
      const id = Number(m[1]);
      const slug = m[2];
      const inner = m[3];
      const nameMatch = inner.match(/title="([^"]+)"/) || inner.match(/alt="([^"]+)"/);
      const imgMatch = inner.match(/src="([^"]+)"/);
      if (!list.some(x => x.id === id)) {
        list.push({
          id,
          slug,
          russian: nameMatch ? nameMatch[1] : slug,
          name: slug.replace(/-/g, ' '),
          image: imgMatch ? imgMatch[1] : ''
        });
      }
    }
    return list;
  } catch (e) {
    console.error(`Error on collection ${colId}:`, e.message);
    return [];
  }
}

async function run() {
  const [c1, c2, c3] = await Promise.all([
    fetchCollectionChars('1979-mamy-v-anime-i-mange-spoylery'),
    fetchCollectionChars('4472-mamy-v-anime-i-mangechast-2'),
    fetchCollectionChars('8900-mamy-v-anime-i-mange-spoylery-chast-3')
  ]);

  console.log('Part 1 moms:', c1.length);
  console.log('Part 2 moms:', c2.length);
  console.log('Part 3 moms:', c3.length);

  const allMoms = new Map();
  [...c1, ...c2, ...c3].forEach(c => allMoms.set(c.id, c));
  console.log('Total unique moms from Shikimori collections:', allMoms.size);
}

run().catch(console.error);
