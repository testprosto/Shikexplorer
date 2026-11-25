async function run() {
  const res = await fetch('https://shikimori.one/collections/4472-mamy-v-anime-i-mangechast-2', {
    headers: { 'User-Agent': 'Mozilla/5.0' }
  });
  const t = await res.text();
  const desc = t.match(/<div class="b-text_with_paragraphs">([\s\S]*?)<\/div>/);
  console.log('DESC:', desc ? desc[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() : 'none');

  const regex = /<article[^>]*class="b-catalog_entry[^"]*"[^>]*>([\s\S]*?)<\/article>/gi;
  let m;
  let count = 0;
  while ((m = regex.exec(t)) !== null && count < 6) {
    count++;
    console.log(`\n--- Card ${count} ---`);
    console.log(m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }
}
run().catch(console.error);
