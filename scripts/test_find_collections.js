async function run() {
  const terms = ['мамы', 'матери', 'отцы', 'братья', 'сестры', 'семья', 'родители'];
  for (const term of terms) {
    try {
      const res = await fetch(`https://shikimori.one/api/topics?forum=collections&search=${encodeURIComponent(term)}&limit=10`, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });
      const data = await res.json();
      console.log(`\n=== Term: "${term}" (${data.length} collections found) ===`);
      data.forEach(t => console.log(`  - [${t.id}] ${t.topic_title}`));
    } catch (e) {
      console.error(e.message);
    }
  }
}

run().catch(console.error);
