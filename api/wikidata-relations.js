const { send } = require('../lib/shikimori');

const API = 'https://www.wikidata.org/w/api.php';
const UA = 'ShikimoriTitleExplorer/3.0 (https://github.com/shikimori; contact@shikimori.me)';

const PROPS = {
  P22: { kind: 'parent', side: 'parent', label: 'Отец' },
  P25: { kind: 'parent', side: 'parent', label: 'Мать' },
  P1795: { kind: 'parent', side: 'parent', label: 'Приёмный родитель' },
  P3515: { kind: 'parent', side: 'parent', label: 'Приёмная мать' },
  P3516: { kind: 'parent', side: 'parent', label: 'Приёмный отец' },
  P3448: { kind: 'parent', side: 'parent', label: 'Приёмный родитель' },
  P8810: { kind: 'parent', side: 'parent', label: 'Приёмный родитель' },
  P40: { kind: 'child', side: 'child', label: 'Ребёнок' },
  P1796: { kind: 'child', side: 'child', label: 'Приёмный ребёнок' },
  P26: { kind: 'partner', side: null, label: 'Супруг(а)' },
  P451: { kind: 'partner', side: null, label: 'Партнёр' },
  P3373: { kind: 'sibling', side: null, label: 'Брат / сестра' },
  P1038: { kind: 'other', side: null, label: 'Родственник' }
};

const CHARACTER_CLASSES = new Set([
  'Q95074', // fictional character
  'Q15632617', // anime and manga character
  'Q15773317', // fictional human
  'Q3658341', // literary character
  'Q21070568', // comics character
  'Q80447738', // anime character
  'Q87576284', // manga character
  'Q1110794', // comic book character
  'Q22961858', // fictional human
  'Q7251786' // superhero
]);

function norm(s = '') {
  return String(s || '').normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/uu/g, 'u').replace(/oo/g, 'o').replace(/ou/g, 'o')
    .replace(/[ёэ]/g, 'е').replace(/[ьъ]/g, '')
    .replace(/[^a-z0-9а-я]+/gi, ' ').trim().replace(/\s+/g, ' ');
}

function nameKey(s = '') {
  return norm(s).split(' ').filter(Boolean).sort().join(' ');
}

async function wd(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 0; attempt <= 2; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) });
      if (r.status === 429) {
        await new Promise(res => setTimeout(res, 1500 * (attempt + 1)));
        continue;
      }
      if (!r.ok) throw new Error(`Wikidata вернула ${r.status}`);
      const data = await r.json();
      if (data.error) throw new Error(`Wikidata: ${data.error.info || data.error.code}`);
      return data;
    } catch (err) {
      if (attempt < 2 && (err.name === 'TimeoutError' || err.message?.includes('429'))) {
        await new Promise(res => setTimeout(res, 1000));
        continue;
      }
      throw err;
    }
  }
}

function ids(claims, prop) {
  return (claims?.[prop] || [])
    .map(c => c.mainsnak?.datavalue?.value?.id)
    .filter(Boolean);
}

function labelOf(entity) {
  return entity?.labels?.ru?.value || entity?.labels?.en?.value || Object.values(entity?.labels || {})[0]?.value || '';
}

function imageOf(entity) {
  const file = entity?.claims?.P18?.[0]?.mainsnak?.datavalue?.value;
  return file ? `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(file)}?width=300` : '';
}

async function entities(idList, props) {
  const out = {};
  for (let i = 0; i < idList.length; i += 50) {
    const chunk = idList.slice(i, i + 50);
    const data = await wd({ action: 'wbgetentities', ids: chunk.join('|'), props, languages: 'ru|en|ja' });
    Object.assign(out, data.entities || {});
    if (i + 50 < idList.length) {
      await new Promise(r => setTimeout(r, 60)); // Small pause to prevent 429 rate limit
    }
  }
  return out;
}

function generateSearchQueries(name, nameRu, nameJa) {
  const queries = new Set();
  const add = (q, lang) => {
    const s = String(q || '').trim();
    if (s.length >= 2) queries.add(JSON.stringify({ q: s, lang }));
  };

  for (const n of [name, nameRu].filter(Boolean)) {
    const clean = n.trim();
    const lang = /[а-яё]/i.test(clean) ? 'ru' : 'en';
    add(clean, lang);

    // Invert word order (Japanese vs Western name ordering, e.g. "Linlin Charlotte" -> "Charlotte Linlin")
    const words = clean.split(/\s+/).filter(Boolean);
    if (words.length === 2) {
      add(`${words[1]} ${words[0]}`, lang);
    } else if (words.length >= 3) {
      add(`${words[words.length - 1]} ${words.slice(0, -1).join(' ')}`, lang);
      add(`${words.slice(1).join(' ')} ${words[0]}`, lang);
    }
  }

  // Japanese name (very reliable in Wikidata for anime/manga entities)
  if (nameJa) {
    add(nameJa.trim(), 'ja');
  }

  return [...queries].map(x => JSON.parse(x));
}

async function getWikidataRelations(wdId, name, title, nameRu = '', nameJa = '', titleRu = '') {
  let chosen, workLabels = [], candidates = 0;
  if (wdId) {
    const ents = await entities([wdId], 'labels|descriptions|claims|aliases');
    chosen = ents[wdId];
    if (!chosen || chosen.missing !== undefined) {
      return { source: 'Wikidata', matched: false, relations: [], message: 'Элемент не найден в Wikidata.' };
    }
    const wIds = ['P1441', 'P1080', 'P1445'].flatMap(p => ids(chosen.claims, p));
    const works = wIds.length ? await entities([...new Set(wIds)], 'labels') : {};
    workLabels = wIds.map(id => labelOf(works[id])).filter(Boolean);
  } else {
    const queries = generateSearchQueries(name, nameRu, nameJa);
    const found = new Map();
    for (const { q, lang } of queries) {
      try {
        const data = await wd({ action: 'wbsearchentities', search: q, language: lang, uselang: lang, type: 'item', limit: '10' });
        for (const x of data.search || []) {
          if (!found.has(x.id)) found.set(x.id, x);
        }
      } catch (_) {}
    }

    if (!found.size) {
      return { source: 'Wikidata', matched: false, relations: [], message: 'Персонаж не найден в Wikidata.' };
    }

    const cands = await entities([...found.keys()], 'labels|descriptions|claims|aliases');
    const workIds = new Set();
    for (const e of Object.values(cands)) {
      for (const p of ['P1441', 'P1080', 'P1445']) ids(e.claims, p).forEach(id => workIds.add(id));
    }
    const works = workIds.size ? await entities([...workIds], 'labels') : {};

    const targetKeys = [nameKey(name), nameKey(nameRu)].filter(Boolean);
    const titles = [norm(title), norm(titleRu)].filter(Boolean);

    const ranked = Object.values(cands).map(e => {
      const isChar = ids(e.claims, 'P31').some(id => CHARACTER_CLASSES.has(id)) ||
                     Boolean(e.claims?.P1080 || e.claims?.P1441 || e.claims?.P1445 || e.claims?.P22 || e.claims?.P25 || e.claims?.P26 || e.claims?.P3373);

      const labels = Object.values(e.labels || {}).map(l => norm(l.value));
      const aliases = Object.values(e.aliases || {}).flat().map(a => norm(a.value));
      const allLabels = [...labels, ...aliases];
      const allKeys = allLabels.map(l => nameKey(l));

      let score = 0;
      if (allKeys.some(k => targetKeys.includes(k))) {
        score += 15; // Exact name key match (including reversed word order)
      } else if (allLabels.some(l => targetKeys.some(tk => l.includes(tk) || tk.includes(l)))) {
        score += 8;
      }

      const workLabels = ['P1441', 'P1080', 'P1445'].flatMap(p => ids(e.claims, p))
        .flatMap(id => Object.values(works[id]?.labels || {}).map(l => norm(l.value)));

      if (titles.some(t => workLabels.some(l => l === t))) {
        score += 12;
      } else if (titles.some(t => workLabels.some(l => l && (l.includes(t) || t.includes(l))))) {
        score += 6;
      }

      const workNames = ['P1441', 'P1080', 'P1445'].flatMap(p => ids(e.claims, p)).map(id => labelOf(works[id])).filter(Boolean);
      return { e, score: isChar ? score : 0, workLabels, workNames };
    }).filter(x => x.score >= 5).sort((a, b) => b.score - a.score);

    chosen = ranked[0]?.e;
    candidates = found.size;
    workLabels = ranked[0] ? ranked[0].workNames : [];
    if (!chosen) {
      return { source: 'Wikidata', matched: false, relations: [], message: 'Персонаж не найден в Wikidata по этому названию.' };
    }
  }

  const raw = [];
  for (const [prop, meta] of Object.entries(PROPS)) {
    for (const id of ids(chosen.claims, prop)) raw.push({ id, ...meta, prop });
  }
  const targets = await entities([...new Set(raw.map(r => r.id))], 'labels|claims');
  const seen = new Set();
  const relations = raw.map(r => {
    const t = targets[r.id];
    const nm = labelOf(t);
    const nameEn = t?.labels?.en?.value || '';
    const nameRu = t?.labels?.ru?.value || '';
    const p21 = ids(t?.claims, 'P21');
    const gender = p21.includes('Q6581072') ? 'female' : p21.includes('Q6581097') ? 'male' : 'unknown';
    let label = r.label;
    if (r.kind === 'child') {
      label = gender === 'female' ? 'Дочь' : gender === 'male' ? 'Сын' : 'Ребёнок';
    } else if (r.kind === 'partner') {
      label = gender === 'female' ? 'Жена' : gender === 'male' ? 'Муж' : 'Супруг(а)';
    } else if (r.kind === 'sibling') {
      label = gender === 'female' ? 'Сестра' : gender === 'male' ? 'Брат' : 'Брат / сестра';
    }
    return {
      id: r.id, name: nm, name_en: nameEn, name_ru: nameRu, label, kind: r.kind, side: r.side,
      gender,
      image: imageOf(t), url: `https://www.wikidata.org/wiki/${r.id}`
    };
  }).filter(r => r.name && !seen.has(`${r.id}:${r.kind}`) && seen.add(`${r.id}:${r.kind}`));

  const chosenP21 = ids(chosen?.claims, 'P21');
  const chosenGender = chosenP21.includes('Q6581072') ? 'female' : chosenP21.includes('Q6581097') ? 'male' : 'unknown';

  return {
    source: 'Wikidata', matched: true,
    character: {
      id: chosen.id,
      name: labelOf(chosen),
      name_en: chosen?.labels?.en?.value || '',
      name_ru: chosen?.labels?.ru?.value || '',
      gender: chosenGender,
      anime: workLabels[0] || '',
      image: imageOf(chosen),
      url: `https://www.wikidata.org/wiki/${chosen.id}`,
      description: chosen.descriptions?.ru?.value || chosen.descriptions?.en?.value || ''
    },
    relations,
    diagnostics: { candidates, relationsReturned: relations.length },
    note: 'Связи взяты из Wikidata в реальном времени.'
  };
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const name = String(req.query.name || '').trim();
  const nameRu = String(req.query.name_ru || '').trim();
  const nameJa = String(req.query.name_ja || '').trim();
  const title = String(req.query.title || '').trim();
  const titleRu = String(req.query.title_ru || '').trim();
  const wdId = String(req.query.id || '').trim().toUpperCase();

  if (wdId && !/^Q\d+$/.test(wdId)) return send(res, 400, { error: 'Неверный ID Wikidata.' });
  if (!wdId && name.length < 2 && nameRu.length < 2 && nameJa.length < 2) return send(res, 400, { error: 'Нужно имя персонажа.' });

  try {
    const result = await getWikidataRelations(wdId, name, title, nameRu, nameJa, titleRu);
    return send(res, 200, result);
  } catch (e) {
    return send(res, 200, { source: 'Wikidata', matched: false, unavailable: true, relations: [], message: `Wikidata недоступна: ${e.message}` });
  }
};
module.exports.getWikidataRelations = getWikidataRelations;
