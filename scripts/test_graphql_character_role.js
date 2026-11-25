async function test() {
  const query = `
    query {
      __type(name: "CharacterRole") {
        fields {
          name
          type {
            name
            kind
          }
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
  console.log('CharacterRole fields:', JSON.stringify(data, null, 2));
}

test().catch(console.error);
