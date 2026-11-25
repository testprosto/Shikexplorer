async function test() {
  const query = `
    query {
      animes(limit: 5, page: 1, order: popularity) {
        id
        name
        russian
        characters {
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
    body: JSON.stringify({ query })
  });

  const data = await res.json();
  console.log('GraphQL animes characters test:');
  console.log(JSON.stringify(data, null, 2).slice(0, 1000));
}

test().catch(console.error);
