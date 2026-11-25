async function test() {
  const query = `
    query($page: Int, $limit: Int) {
      characters(page: $page, limit: $limit) {
        id
        name
        russian
        description
        poster { mainUrl originalUrl }
        animes {
          id
          name
          russian
        }
      }
    }
  `;

  const res = await fetch('https://shikimori.one/api/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'ShikimoriTitleExplorer/3.0'
    },
    body: JSON.stringify({
      query,
      variables: { page: 1, limit: 10 }
    })
  });
  const data = await res.json();
  const list = data?.data?.characters || [];
  console.log(`Page 1 count: ${list.length}`);
  list.forEach(c => {
    console.log(`- ID: ${c.id} | ${c.russian} (${c.name}) | Desc len: ${(c.description||'').length}`);
  });
}

test().catch(console.error);
