async function introspect() {
  const query = `
    query {
      __type(name: "Character") {
        fields {
          name
        }
      }
    }
  `;
  const res = await fetch('https://shikimori.one/api/graphql', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'ShikimoriTitleExplorer/3.0' },
    body: JSON.stringify({ query })
  });
  const d = await res.json();
  console.log('Character fields:', d.data?.__type?.fields?.map(f => f.name));
}
introspect();
