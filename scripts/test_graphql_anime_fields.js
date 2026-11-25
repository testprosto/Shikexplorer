async function test() {
  const query = `
    query {
      __type(name: "Anime") {
        fields {
          name
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
  const fields = data?.data?.__type?.fields?.map(f => f.name) || [];
  console.log('Fields on Anime:', fields.join(', '));
}

test().catch(console.error);
