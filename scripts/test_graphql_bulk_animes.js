async function test() {
  const query = `
    query {
      animes(limit: 3, page: 1, order: popularity) {
        id
        name
        russian
        characterRoles {
          rolesRu
          rolesEn
          character {
            id
            name
            russian
            poster {
              mainUrl
            }
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
  const animes = data?.data?.animes || [];
  console.log('Fetched animes:', animes.length);
  animes.forEach(a => {
    console.log(`- ${a.russian} (${a.name}): ${a.characterRoles.length} characters`);
    const moms = a.characterRoles.filter(r => (r.character.russian || r.character.name).toLowerCase().includes('мать') || r.rolesRu.some(x=>x.toLowerCase().includes('мать')));
    console.log(`  Moms in ${a.russian}:`, moms.length);
  });
}

test().catch(console.error);
