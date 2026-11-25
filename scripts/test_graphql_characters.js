async function test() {
  const q = `
    query($search: String, $page: Int, $limit: Int) {
      characters(search: $search, page: $page, limit: $limit) {
        id
        name
        russian
        poster {
          mainUrl
          originalUrl
        }
        url
      }
    }
  `;

  const res = await fetch('https://shikimori.one/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ShikimoriTitleExplorer/3.0 (https://github.com/shikimori; contact@shikimori.me)'
    },
    body: JSON.stringify({
      query: q,
      variables: { search: '', page: 1, limit: 12 }
    })
  });

  const data = await res.json();
  console.log('Total characters retrieved:', data.data?.characters?.length);
  data.data?.characters?.slice(0, 5).forEach(c => {
    console.log(`[#${c.id}] ${c.russian || c.name} (${c.name}) -> ${c.poster?.mainUrl}`);
  });
}

test().catch(console.error);
