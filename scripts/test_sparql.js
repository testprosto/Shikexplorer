const query = `
SELECT ?char ?charLabel ?prop ?relative ?relativeLabel ?work ?workLabel WHERE {
  ?char wdt:P31/wdt:P279* wd:Q15632617 .
  VALUES ?prop { wdt:P22 wdt:P25 wdt:P3373 wdt:P26 wdt:P40 } .
  ?char ?prop ?relative .
  OPTIONAL { ?char wdt:P1441 ?work } .
  SERVICE wikibase:label { bd:serviceParam wikibase:language "ru,en". }
}
LIMIT 25
`;

fetch('https://query.wikidata.org/sparql?format=json&query=' + encodeURIComponent(query), {
  headers: {
    'User-Agent': 'ShikimoriTitleExplorer/3.0 (https://github.com/shikimori; contact@shikimori.me)',
    'Accept': 'application/sparql-results+json'
  }
})
  .then(r => r.json())
  .then(d => {
    console.log('SPARQL count:', d.results.bindings.length);
    d.results.bindings.slice(0, 5).forEach(b => {
      console.log(b.charLabel?.value, '->', b.prop?.value?.split('/').pop(), '->', b.relativeLabel?.value, '[work:', b.workLabel?.value, ']');
    });
  })
  .catch(e => console.error(e));
