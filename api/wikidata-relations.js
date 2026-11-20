const { send } = require('../lib/shikimori');

const API = 'https://www.wikidata.org/w/api.php';
const UA = 'ShikimoriTitleExplorer/1.0 (Vercel app; character family tree)';

// Wikidata property -> relation kind / side (same shape as acdb-relations.js).
// side: 'parent' = the linked character is a parent of the selected one,
//       'child'  = the linked character is a child of the selected one.
const PROPS = {
  P22: { kind: 'parent', side: 'parent', label: 'Отец' },
  P25: { kind: 'parent', side: 'parent', label: 'Мать' },
  P40: { kind: 'child', side: 'child', label: 'Ребёнок' },
  P26: { kind: 'partner', side: null, label: 'Супруг(а)' },
  P451: { kind: 'partner', side: null, label: 'Партнёр' },
  P3373: { kind: 'sibling', side: null, label: 'Брат / сестра' },
  P1038: { kind: 'other', side: null, label: 'Родственник' }
};
// Items that mark an entity as a fictional character.
const CHARACTER_CLASSES = new Set(['Q95074', 'Q15632617', 'Q15773317', 'Q3658341', 'Q21070568']);

function norm(s = '') {
  return String(s).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9а-яё]+/gi, ' ').trim().replace(/\s+/g, ' ');
}

async function wd(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': 'application/json' }, signal: AbortSignal.timeout(15000) });
  if (!r.ok) throw new Error(`Wikidata вернула ${r.status}`);
  const data = await r.json();
  if (data.error) throw new Error(`Wikidata: ${data.error.info || data.error.code}`);
  return data;
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
    const data = await wd({ action: 'wbgetentities', ids: chunk.join('|'), props, languages: 'ru|en' });
    Object.assign(out, data.entities || {});
  }
  return out;
}

module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const name = String(req.query.name || '').trim();
  const title = String(req.query.title || '').trim();
  if (name.length < 2) return send(res, 400, { error: 'Нужно имя персонажа.' });

  try {
    // 1. Search candidates by name (English and Russian).
    const found = new Map();
    for (const language of ['en', 'ru']) {
      try {
        const data = await wd({ action: 'wbsearchentities', search: name, language, uselang: language, type: 'item', limit: '10' });
        for (const x of data.search || []) found.set(x.id, x);
      } catch (_) { /* try the other language */ }
    }
    if (!found.size) return send(res, 200, { source: 'Wikidata', matched: false, relations: [], message: 'Персонаж не найден в Wikidata.' });

    // 2. Keep only fictional characters; rank by name and by the work's title.
    const cands = await entities([...found.keys()], 'labels|claims');
    const workIds = new Set();
    for (const e of Object.values(cands)) {
      for (const p of ['P1441', 'P1080', 'P1445']) ids(e.claims, p).forEach(id => workIds.add(id));
    }
    const works = workIds.size ? await entities([...workIds], 'labels') : {};
    const nn = norm(name), nt = norm(title);
    const ranked = Object.values(cands).map(e => {
      const isChar = ids(e.claims, 'P31').some(id => CHARACTER_CLASSES.has(id));
      const allLabels = Object.values(e.labels || {}).map(l => norm(l.value));
      let score = allLabels.includes(nn) ? 10 : allLabels.some(l => l.includes(nn) || nn.includes(l)) ? 4 : 0;
      const workLabels = ['P1441', 'P1080', 'P1445'].flatMap(p => ids(e.claims, p))
        .flatMap(id => Object.values(works[id]?.labels || {}).map(l => norm(l.value)));
      if (nt && workLabels.some(l => l === nt)) score += 12;
      else if (nt && workLabels.some(l => l && (l.includes(nt) || nt.includes(l)))) score += 6;
      return { e, score: isChar ? score : 0, workLabels };
    }).filter(x => x.score >= 5).sort((a, b) => b.score - a.score);

    const chosen = ranked[0]?.e;
    if (!chosen) return send(res, 200, { source: 'Wikidata', matched: false, relations: [], message: 'Персонаж не найден в Wikidata по этому названию.' });

    // 3. Collect family relations from the chosen item.
    const raw = [];
    for (const [prop, meta] of Object.entries(PROPS)) {
      for (const id of ids(chosen.claims, prop)) raw.push({ id, ...meta, prop });
    }
    const targets = await entities([...new Set(raw.map(r => r.id))], 'labels|claims');
    const seen = new Set();
    const relations = raw.map(r => {
      const t = targets[r.id];
      const nm = labelOf(t);
      return {
        id: r.id, name: nm, label: r.label, kind: r.kind, side: r.side,
        image: imageOf(t), url: `https://www.wikidata.org/wiki/${r.id}`
      };
    }).filter(r => r.name && !seen.has(`${r.id}:${r.kind}`) && seen.add(`${r.id}:${r.kind}`));

    return send(res, 200, {
      source: 'Wikidata', matched: true,
      character: {
        id: chosen.id, name: labelOf(chosen), anime: ranked[0].workLabels[0] || '',
        image: imageOf(chosen), url: `https://www.wikidata.org/wiki/${chosen.id}`
      },
      relations,
      diagnostics: { candidates: found.size, relationsReturned: relations.length },
      note: 'Связи взяты из Wikidata: покрытие вымышленных персонажей неполное, отсутствие связи не означает, что её нет.'
    });
  } catch (e) {
    // Do not break the UI: report the source as unavailable.
    return send(res, 200, { source: 'Wikidata', matched: false, unavailable: true, relations: [], message: `Wikidata недоступна: ${e.message}` });
  }
};
module.exports.config = { maxDuration: 30 };
