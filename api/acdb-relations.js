const { send } = require('../lib/shikimori');
const BASE = 'https://www.animecharactersdatabase.com';
const UA = 'Mozilla/5.0 (compatible; CharacterResearchWorkspace/1.0; +https://vercel.com)';

function norm(s='') {
  return String(s).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'')
    .replace(/[^a-z0-9а-яё]+/gi,' ').trim().replace(/\s+/g,' ');
}
function clean(s='') {
  return String(s).replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/gi,' ')
    .replace(/&amp;/gi,'&').replace(/&quot;/gi,'"').replace(/&#39;|&apos;/gi,"'")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/&([a-z]+);/gi,' ')
    .replace(/\s+/g,' ').trim();
}
async function get(url, json=false) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': json ? 'application/json' : 'text/html,application/xhtml+xml' }, signal: AbortSignal.timeout(18000) });
  if (!r.ok) throw new Error(`ACDB вернул ${r.status}`);
  return json ? r.json() : r.text();
}
function familyKind(label='') {
  const s = norm(label);
  // Match whole relation words/phrases only. Substring checks such as "mat"
  // incorrectly classify "information" as "mother".
  if (/(^|\b)(father|mother|parent|dad|mom|mama|papa|otec|roditel)(\b|$)|мать|мама|отец|папа|родител/.test(s)) return 'parent';
  if (/(^|\b)(son|daughter|child|children)(\b|$)|сын|дочь|дочер|сынов|ребен|дети/.test(s)) return 'child';
  if (/(^|\b)(brother|sister|sibling)(\b|$)|брат|сестр/.test(s)) return 'sibling';
  if (/(^|\b)(husband|wife|spouse|married|boyfriend|girlfriend|partner)(\b|$)|муж|жен|супруг/.test(s)) return 'partner';
  if (/(^|\b)(uncle|aunt|nephew|niece|cousin|grandfather|grandmother|grandson|granddaughter|grandparent|grandchild|step|adopt|relative)(\b|$)|дяд|тет|племян|двоюрод|дед|баб|внук|внуч|прием|приём|сводн/.test(s)) return 'other';
  return null;
}
function relationSide(label='') {
  const s = norm(label);
  if (/^son of|^daughter of|^child of|^сын|^дочь|^ребенок|^ребёнок/.test(s)) return 'parent';
  if (/^father of|^mother of|^parent of|^отец|^мать|^папа|^мама/.test(s)) return 'child';
  return null;
}
function extractRelations(html) {
  const start = Math.max(html.indexOf('Relations</a>'), html.indexOf('Relations</h'));
  const endCandidates = [html.indexOf('Appears as', start), html.indexOf('Quotes', start)].filter(x => x > start);
  const section = html.slice(start >= 0 ? start : 0, endCandidates.length ? Math.min(...endCandidates) : Math.min(html.length, (start >= 0 ? start : 0) + 70000));
  const out = [];
  const lis = section.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
  for (const li of lis) {
    const links = [...li.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
    if (links.length < 2) continue;
    const target = links.findLast ? links.findLast(m => /characters\.php\?/i.test(m[1]) && /(?:\?|&)id=\d+/i.test(m[1])) : [...links].reverse().find(m => /characters\.php\?/i.test(m[1]) && /(?:\?|&)id=\d+/i.test(m[1]));
    if (!target) continue;
    const targetId = (target[1].match(/[?&]id=(\d+)/i) || [])[1];
    const relationLink = links.find(m => m !== target);
    const label = clean(relationLink ? relationLink[2] : li);
    const kind = familyKind(label);
    if (!targetId || !kind) continue;
    const name = clean(target[2]);
    if (!name) continue;
    out.push({ id: targetId, name, label, kind, side: relationSide(label), url: `${BASE}/characters.php?id=${targetId}` });
  }
  // Robust fallback: ACDB relation rows are not guaranteed to be <li> elements.
  // Pair a relation-type anchor with the next character-profile anchor.
  if (!out.length) {
    const anchorRe = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
    const anchors = [...section.matchAll(anchorRe)].map(m => ({
      text: clean(m[2]),
      href: ((m[1].match(/href=["']([^"']+)["']/i) || [])[1] || '')
    }));
    for (let i = 0; i < anchors.length; i++) {
      const rel = anchors[i], kind = familyKind(rel.text);
      if (!kind) continue;
      for (let j = i + 1; j < Math.min(anchors.length, i + 4); j++) {
        const target = anchors[j];
        if (!/characters\.php\?/i.test(target.href)) continue;
        const id = (target.href.match(/[?&]id=(\d+)/i) || [])[1];
        if (!id || !target.text) continue;
        out.push({ id, name: target.text, label: rel.text, kind, side: relationSide(rel.text), url: `${BASE}/characters.php?id=${id}` });
        break;
      }
    }
  }
  // Do not guess relations from unrelated profile links outside the Relations section.
  const seen = new Set();
  return out.filter(x => { const k = `${x.id}:${x.side||''}:${x.kind||''}`; if (seen.has(k)) return false; seen.add(k); return true; }).slice(0, 35);
}
function extractImage(html) {
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i
  ];
  for (const re of patterns) { const m = html.match(re); if (m) return m[1].replace(/&amp;/g,'&'); }
  const m = html.match(/https?:\/\/ami\.animecharactersdatabase\.com\/(?:uploads|images)\/[^"'<> ]+\.(?:jpg|jpeg|png|webp)/i);
  return m ? m[0] : '';
}
async function charImage(id) {
  try {
    const data = await get(`${BASE}/api_series_characters.php?character_id=${encodeURIComponent(id)}`, true);
    const find = (o, keys) => { if (!o || typeof o !== 'object') return ''; for (const k of keys) if (typeof o[k] === 'string' && /^https?:/.test(o[k])) return o[k]; for (const v of Object.values(o)) { const x = find(v, keys); if (x) return x; } return ''; };
    const image = find(data, ['character_image','image','image_url','thumb','thumbnail']);
    if (image) return image;
  } catch (_) {}
  try { return extractImage(await get(`${BASE}/characters.php?id=${encodeURIComponent(id)}`)); } catch (_) { return ''; }
}
module.exports = async (req, res) => {
  if (req.method !== 'GET') return send(res, 405, { error: 'Используй GET.' });
  const name = String(req.query.name || '').trim();
  const title = String(req.query.title || '').trim();
  const requestedId = String(req.query.id || '').trim();
  if (!requestedId && name.length < 2) return send(res, 400, { error: 'Нужно имя персонажа.' });
  if (requestedId && !/^\d+$/.test(requestedId)) return send(res, 400, { error: 'Неверный ID ACDB.' });
  try {
    let chosen;
    if (requestedId) {
      const html = await get(`${BASE}/characters.php?id=${encodeURIComponent(requestedId)}`);
      const nameMatch = html.match(/<h1[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
      chosen = { id: requestedId, name: clean(nameMatch ? nameMatch[1] : name || `ACDB #${requestedId}`), anime_name: '', character_image: extractImage(html), _html: html };
    } else {
      const search = await get(`${BASE}/api_series_characters.php?character_q=${encodeURIComponent(name)}`, true);
      const results = Array.isArray(search.search_results) ? search.search_results : [];
      const nn = norm(name), nt = norm(title);
      const ranked = results.map(x => {
        const cn = norm(x.name), at = norm(x.anime_name || '');
        let score = cn === nn ? 10 : cn.includes(nn) || nn.includes(cn) ? 5 : 0;
        if (nt && at === nt) score += 12;
        else if (nt && (at.includes(nt) || nt.includes(at))) score += 6;
        return { ...x, _score: score };
      }).filter(x => x._score >= 5).sort((a,b)=>b._score-a._score);
      chosen = ranked[0];
    }
    if (!chosen) return send(res, 200, { source: 'Anime Characters Database', matched: false, relations: [], message: 'Персонаж не найден в ACDB по этому названию.' });
    const html = chosen._html || await get(`${BASE}/characters.php?id=${encodeURIComponent(chosen.id)}`);
    const relations = extractRelations(html);
    const nodes = await Promise.all(relations.map(async rel => ({ ...rel, image: await charImage(rel.id) })));
    return send(res, 200, {
      source: 'Anime Characters Database', matched: true,
      character: { id: String(chosen.id), name: chosen.name, anime: chosen.anime_name || '', image: chosen.character_image || extractImage(html), url: `${BASE}/characters.php?id=${chosen.id}`, graphUrl: `${BASE}/relationsgraph.php?id=${chosen.id}&nested=` },
      relations: nodes,
      diagnostics: { profileFetched: true, relationRowsParsed: nodes.length, parser: 'li+anchor-fallback' },
      note: 'Связи взяты из пользовательской базы ACDB; проверяй контекст и версию персонажа.'
    });
  } catch (e) {
    return send(res, 502, { error: `Не удалось получить данные ACDB: ${e.message}` });
  }
};
module.exports.config = { maxDuration: 30 };
