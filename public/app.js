const $ = (s) => document.querySelector(s);
const state = { history: [], current: null, openToken: 0, loadPct: 0, cache: { acdb: new Map(), wd: new Map(), find: new Map() }, titles: [], characters: [], relatedCharacters: [], acdbRelations: [], selectedAnime: null, franchiseTitles: [], characterDetails: new Map() };
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const imageUrl = (image, size='preview') => {
  if (!image) return '';
  if (typeof image === 'string') return image.startsWith('http') ? image : `https://shikimori.one${image}`;
  const path = image[size] || image.original || image.preview || image.x96 || '';
  return path ? (path.startsWith('http') ? path : `https://shikimori.one${path}`) : '';
};
const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='240'%3E%3Crect width='100%25' height='100%25' fill='%23292735'/%3E%3Ctext x='50%25' y='52%25' fill='%239997aa' text-anchor='middle' font-size='13'%3ENo image%3C/text%3E%3C/svg%3E";
function status(message='', error=false){const el=$('#status');el.textContent=message;el.classList.toggle('error',error)}
async function api(path){const r=await fetch(path);const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data.error||`Ошибка ${r.status}`);return data}

$('#searchForm').addEventListener('submit', async e=>{
  e.preventDefault(); const q=$('#query').value.trim(); if(q.length<2)return;
  $('#titleSection').classList.add('hidden'); $('#resultsSection').classList.add('hidden');
  $('#searchButton').disabled=true; status('Ищу тайтлы на Shikimori...');
  try{const data=await api(`/api/search?q=${encodeURIComponent(q)}`);state.titles=data.items||[];renderResults();status(state.titles.length?`Найдено тайтлов: ${state.titles.length}`:'Ничего не найдено. Попробуй другое название.');}
  catch(err){status(err.message,true)}finally{$('#searchButton').disabled=false}
});
function renderResults(){const box=$('#results');box.innerHTML='';$('#resultCount').textContent=`${state.titles.length} результатов`;
  state.titles.forEach(a=>{const card=document.createElement('article');card.className='title-card';const img=imageUrl(a.image);card.innerHTML=`<img class="poster" src="${esc(img||fallback)}" onerror="this.src='${fallback}'" alt=""><div class="title-info"><span class="type">${a.media_type==='manga'?'MANGA':a.media_type==='ranobe'?'RANOBE':'ANIME'} · ${esc(a.kind||'TITLE')} · ${esc(a.status||'')}</span><h3>${esc(a.russian||a.name||'Без названия')}</h3><p>${esc(a.name||'')}</p><p>${esc(a.aired_on?.slice(0,4)||'')} ${a.episodes?`· ${a.episodes} эп.`:''}</p></div>`;card.addEventListener('click',()=>selectAnime(a));box.append(card)});
  $('#resultsSection').classList.remove('hidden');
}
async function collectFranchiseTitles(start, fallbackType){
  const key=t=>`${t.media_type||fallbackType}:${t.id}`;
  const found=new Map([[key(start),{...start,media_type:start.media_type||fallbackType}]]);
  const queue=[{title:start,depth:0}];let cursor=0;
  const workers=Array.from({length:3},async()=>{
    while(cursor<queue.length&&found.size<35){
      const current=queue[cursor++];if(current.depth>=3)continue;
      try{
        const data=await api(`/api/related?id=${current.title.id}&type=${current.title.media_type||fallbackType}`);
        for(const item of data.items||[]){
          const normalized={...item,media_type:item.media_type||fallbackType};const k=key(normalized);
          if(found.has(k)||found.size>=35)continue;
          found.set(k,normalized);queue.push({title:normalized,depth:current.depth+1});
        }
      }catch(e){console.warn('Related titles unavailable for',current.title.id,e.message);}
    }
  });
  await Promise.all(workers);
  return [...found.values()];
}
async function selectAnime(anime){state.selectedAnime=anime;state.characters=[];state.relatedCharacters=[];state.franchiseTitles=[];state.characterDetails=new Map();$('#resultsSection').classList.add('hidden');$('#titleSection').classList.remove('hidden');$('#titleHero').innerHTML=`<img class="title-poster" src="${esc(imageUrl(anime.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">SELECTED TITLE</div><h2 class="title-name">${esc(anime.russian||anime.name)}</h2><div class="title-meta"><span class="pill">${anime.media_type==='manga'?'MANGA':anime.media_type==='ranobe'?'RANOBE':'ANIME'} · ${esc(anime.kind||'')}</span><span class="pill">${esc(anime.status||'')}</span><span class="pill">${esc(anime.aired_on?.slice(0,4)||'Год неизвестен')}</span><span class="pill">${anime.episodes||'?'} эпизодов</span><span class="pill">★ ${anime.score||'—'}</span></div><p class="title-description">${esc(anime.description||'Описание не указано в Shikimori.')}</p><p><a href="https://shikimori.one${esc(anime.url||(anime.media_type==='manga'?`/mangas/${anime.id}`:`/animes/${anime.id}`))}" target="_blank" rel="noreferrer">Открыть тайтл на Shikimori ↗</a></p></div>`;
  $('#characters').innerHTML='';$('#emptyCharacters').classList.add('hidden');$('#characterCount').textContent='Загрузка...';status('Загружаю персонажей...');
  try{
    status('Ищу все связанные сезоны, фильмы, OVA, специальные выпуски и мангу...');
    const mediaType=['manga','ranobe'].includes(anime.media_type)?anime.media_type:'anime';
    const allTitles=await collectFranchiseTitles(anime,mediaType);
    state.franchiseTitles=allTitles;
    renderFranchiseTitles();
    status(`Загружаю персонажей из ${allTitles.length} связанных тайтлов...`);
    const roleResults=await Promise.allSettled(allTitles.map(t=>api(`/api/roles?id=${t.id}&type=${t.media_type||mediaType}`)));
    const seen=new Map();
    roleResults.forEach((result,index)=>{
      if(result.status!=='fulfilled')return;
      for(const item of result.value.items||[]){
        if(!item.character)continue;
        const id=String(item.character.id);const existing=seen.get(id);
        if(existing){existing.sourceTitles=[...(existing.sourceTitles||[]),allTitles[index].russian||allTitles[index].name].filter(Boolean);continue;}
        seen.set(id,{...item.character,role:item.roles||[],sourceTitles:[allTitles[index].russian||allTitles[index].name].filter(Boolean)});
      }
    });
    state.characters=[...seen.values()];
    renderCharacters();
    status(`Персонажей из франшизы загружено: ${state.characters.length} · связанных тайтлов: ${allTitles.length}`);
  }
  catch(err){status(err.message,true);$('#characterCount').textContent='';$('#emptyCharacters').classList.remove('hidden');$('#emptyCharacters').textContent='Не удалось загрузить персонажей. '+err.message}
  $('#titleSection').scrollIntoView({behavior:'smooth',block:'start'});
}
function renderFranchiseTitles(){
  const box=$('#franchiseTitles');if(!box)return;
  box.innerHTML=state.franchiseTitles.map((t,i)=>`<button type="button" class="franchise-chip ${String(t.id)===String(state.selectedAnime?.id)&&t.media_type===state.selectedAnime?.media_type?'active':''}" data-franchise-index="${i}"><span>${t.media_type==='manga'?'MANGA':t.media_type==='ranobe'?'RANOBE':'ANIME'}</span><strong>${esc(t.russian||t.name||'Без названия')}</strong><small>${esc(t.kind||'')} ${t.aired_on?`· ${esc(t.aired_on.slice(0,4))}`:''} ${t.relation?`· ${esc(t.relation)}`:''}</small></button>`).join('')||'<p class="empty">Связанные части франшизы не найдены.</p>';
  box.querySelectorAll('[data-franchise-index]').forEach(btn=>btn.addEventListener('click',()=>{const t=state.franchiseTitles[Number(btn.dataset.franchiseIndex)];if(t)selectAnime(t);}));
}
function roleLabel(roles){if(!Array.isArray(roles))return '';return roles.map(r=>typeof r==='string'?r:(r.russian||r.name||'')).filter(Boolean).join(', ')}
function renderCharacters(){const q=$('#characterFilter').value.trim().toLowerCase();const list=state.characters.filter(c=>`${c.russian||''} ${c.name||''}`.toLowerCase().includes(q));$('#characterCount').textContent=`${list.length} / ${state.characters.length}`;const box=$('#characters');box.innerHTML='';$('#emptyCharacters').classList.toggle('hidden',list.length>0);
  list.forEach(c=>{const card=document.createElement('article');card.className='character-card';const role=roleLabel(c.role);card.innerHTML=`<img src="${esc(imageUrl(c.image,'preview')||fallback)}" onerror="this.src='${fallback}'" alt=""><div class="char-info"><h3>${esc(c.russian||c.name||'Неизвестный персонаж')}</h3><p>${esc(c.name||'')}${role?` · ${esc(role)}`:''}</p>${c.sourceTitles?.length?`<small class="char-source-titles">${esc([...new Set(c.sourceTitles)].slice(0,3).join(' · '))}</small>`:''}</div>`;card.addEventListener('click',()=>openCharacter(c));box.append(card)});
}
$('#characterFilter').addEventListener('input',renderCharacters);
function plainDescription(value=''){
  return String(value)
    .replace(/<br\s*\/?\s*>/gi,' ')
    .replace(/<[^>]+>/g,' ')
    .replace(/\[character=(\d+)\]([\s\S]*?)\[\/character\]/gi,' $2 ')
    .replace(/\[(?:b|i|u|url)[^\]]*\]/gi,' ')
    .replace(/\[\/(?:b|i|u|url)\]/gi,' ')
    .replace(/&nbsp;/g,' ')
    .replace(/&quot;/g,'"').replace(/&#39;/g,"'").replace(/&amp;/g,'&')
    .replace(/\s+/g,' ').trim();
}
function relationshipMentions(description, owner, selected, candidates=[]){
  const raw=String(description||'');
  const plain=plainDescription(raw);
  const out=[];
  const add=(id, context, relation, source)=>{
    if(id && String(id)!==String(selected.id))
      out.push({id:String(id),type:relation.type,label:relation.label,context:context.trim(),source});
  };
  // Only accept a kinship word that is syntactically attached to the matched name.
  // A word such as "information" must never become "mother" just because it
  // contains the letters "mat" (the old ACDB parser had the same substring bug).
  const relationNearName=(before, after)=>{
    const b=String(before||'').toLowerCase();
    const a=String(after||'').toLowerCase();
    const parentBefore=/(?:^|[\s,;:—–-])(?:мать|мама|отец|папа|родитель|mother|father|parent)\s*[,—–:：-]*$/iu.test(b);
    const childBefore=/(?:^|[\s,;:—–-])(?:сын|дочь|дочери|сыновья|реб[её]нок|дети|son|daughter|child|children)\s+(?:of\s*)?[,—–:：-]*$/iu.test(b);
    const parentAfter=/^\s*[,—–:：-]?\s*(?:мать|мама|отец|папа|родитель|mother|father|parent)\b/iu.test(a);
    const childAfter=/^\s*[,—–:：-]?\s*(?:сын|дочь|дочери|сыновья|реб[её]нок|дети|son|daughter|child|children)\b/iu.test(a);
    const possessiveParent=/(?:'s|’s)\s*(?:mother|father|parent)\b/iu.test(a);
    const parentOfBefore=/(?:мать|мама|отец|папа|mother|father|parent)\s+(?:of\s*)?$/iu.test(b);
    const childOfBefore=/(?:сын|дочь|дочери|сыновья|реб[её]нок|дети|son|daughter|child|children)\s+(?:of\s*)?$/iu.test(b);
    if(parentBefore || childAfter || parentOfBefore) return {type:'child',label:'Сын / дочь'};
    if(childBefore || parentAfter || possessiveParent || childOfBefore) return {type:'parent',label:'Родитель'};
    return null;
  };

  const addMatched=(candidateId, context, relation, source)=>{
    if(!relation) return;
    if(String(owner.id)===String(selected.id)){
      add(candidateId,context,relation,source);
    } else if(String(candidateId)===String(selected.id)){
      const inverse=relation.type==='parent'
        ? {type:'child',label:'Сын / дочь'}
        : {type:'parent',label:'Родитель'};
      add(owner.id,context,inverse,`reverse-${source}`);
    }
  };

  // Shikimori's explicit character links.
  const linked=/\[character=(\d+)\]([\s\S]*?)\[\/character\]/gi;
  let m;
  while((m=linked.exec(raw))){
    const before=plainDescription(raw.slice(Math.max(0,m.index-90),m.index)).slice(-90);
    const after=plainDescription(raw.slice(linked.lastIndex,Math.min(raw.length,linked.lastIndex+90))).slice(0,90);
    const context=plainDescription(raw.slice(Math.max(0,m.index-90),Math.min(raw.length,linked.lastIndex+90)));
    addMatched(m[1],context,relationNearName(before,after),'description-link');
  }

  // Also support plain-name references, but only full names or unique single-token
  // names that are immediately attached to an explicit kinship phrase.
  const aliases=new Map();
  for(const candidate of candidates||[]){
    if(!candidate?.id || String(candidate.id)===String(owner.id)) continue;
    const names=[candidate.russian,candidate.name].filter(Boolean);
    for(const name of names){
      const normalized=plainDescription(name);
      if(normalized.length<4) continue;
      const key=normalized.toLocaleLowerCase();
      if(!aliases.has(key)) aliases.set(key,{candidate,name:normalized,ids:new Set()});
      aliases.get(key).ids.add(String(candidate.id));
    }
  }
  const seen=new Set();
  for(const entry of aliases.values()){
    if(entry.ids.size!==1) continue;
    const escaped=entry.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    const re=new RegExp('(^|[^\\p{L}\\p{N}])('+escaped+')(?=$|[^\\p{L}\\p{N}])','giu');
    let hit;
    while((hit=re.exec(plain))){
      const begin=hit.index+hit[1].length, finish=begin+hit[2].length;
      const before=plain.slice(Math.max(0,begin-85),begin);
      const after=plain.slice(finish,Math.min(plain.length,finish+85));
      const relation=relationNearName(before,after);
      if(!relation) continue;
      const id=String(entry.candidate.id), key=`${id}:${relation.type}`;
      if(seen.has(key)) continue;
      seen.add(key);
      const context=plain.slice(Math.max(0,begin-90),Math.min(plain.length,finish+90));
      addMatched(id,context,relation,'description-name-match');
    }
  }
  // Deduplicate links and name matches into one relationship.
  const unique=new Map();
  for(const item of out){
    const key=`${item.id}:${item.type}`;
    if(!unique.has(key)) unique.set(key,item);
  }
  return [...unique.values()];
}
function classifyRelationEvidence(evidence, ownerId, selectedId){
  const ctx=(evidence.context||'').toLowerCase();
  const parentWord=/(отец|папа|father|dad|мать|мама|mother|mom|родител|parent)/i.test(ctx);
  const childWord=/(сын|дочь|дочери|сыновья|ребёнок|ребенок|дети|son|daughter|child|children)/i.test(ctx);
  if(evidence.type==='parent') return 'parent';
  if(evidence.type==='sibling') return 'sibling';
  if(evidence.type==='partner') return 'partner';
  if(evidence.type==='other') return 'other';
  if(evidence.type==='child') return 'child';
  return parentWord||childWord?'parent':'other';
}
function makeFamilyTree(selected, full){
  const pool=new Map(state.characters.map(c=>[String(c.id),{...c,...(state.characterDetails.get(String(c.id))||{})}]));for(const c of state.relatedCharacters)pool.set(String(c.id),{...c,...(state.characterDetails.get(String(c.id))||{})});for(const [id,c] of state.characterDetails)if(!pool.has(String(id)))pool.set(String(id),c);pool.set(String(selected.id),{...selected,...full});
  const descriptions=[];
  for(const c of pool.values()) if(c.description) descriptions.push({owner:c,description:c.description});
  const evidence=[];
  for(const item of descriptions){
    const found=relationshipMentions(item.description,item.owner,selected,[...pool.values()]);
    for(const e of found){const candidate=pool.get(e.id);if(candidate)evidence.push({...e,candidate,ownerId:String(item.owner.id)});}
  }
  // A character's own description can directly link to relatives that are not in the selected title roster.
  const selectedDesc=full.description||selected.description||'';
  const linkedIds=[...new Set([...String(selectedDesc).matchAll(/\[character=(\d+)\]/gi)].map(m=>String(m[1])))];
  const unique=new Set();
  const groups={parent:[],sibling:[],partner:[],child:[],other:[]};
  for(const e of evidence){
    const id=String(e.candidate.id);if(id===String(selected.id))continue;
    const type=classifyRelationEvidence(e,e.ownerId,selected.id);
    const key=`${id}:${type}`;if(unique.has(key))continue;unique.add(key);
    const node={...e.candidate,relationLabel:e.label,evidence:e.context};
    if(type==='parent')groups.parent.push(node);else if(type==='sibling')groups.sibling.push(node);else if(type==='partner')groups.partner.push(node);else if(type==='child')groups.child.push(node);else groups.other.push(node);
  }
  // Add explicit family links from external sources: ACDB and Wikidata.
  const poolList=[...pool.values()];
  const findInPool=(name)=>{const n=nameKey(name);return n?poolList.find(x=>nameKey(x.name)===n||nameKey(x.russian)===n):null;};
  for (const rel of state.acdbRelations || []) {
    const type = rel.side || rel.kind;
    const groupKey = ['parent','child','sibling','partner','other'].includes(type) ? type : null;
    if (!groupKey) continue;
    const isWikidata = rel.source === 'wikidata';
    const poolHit = findInPool(rel.name);
    const same = poolHit || rel.shikiChar || null;
    if (same && poolHit && String(same.id) === String(selected.id)) continue;
    const key = `${rel.id}:${groupKey}`;
    const nameKey2 = `n:${nameKey(rel.name)}:${groupKey}`;
    if (unique.has(key) || unique.has(nameKey2)) continue;
    unique.add(key); unique.add(nameKey2);
    let node;
    if (same) {
      // Found in Shikimori (roster or by name search): open it as a full Shikimori profile.
      node = (isWikidata || !poolHit) ? { ...same } : { ...same, acdbId: rel.id, external: true };
    } else if (isWikidata) {
      node = { id: null, external: true, name: rel.name, russian: rel.name, image: rel.image || '', wikidataId: rel.id, wikidataUrl: rel.url };
    } else {
      node = { id: null, acdbId: rel.id, external: true, name: rel.name, russian: rel.name, image: rel.image || '', url: rel.url };
    }
    if (!node.image && rel.image) node.image = rel.image;
    node.relationLabel = isWikidata ? rel.label : acdbRelationLabel(rel.label, rel.side, rel.kind);
    node.evidence = `${isWikidata ? 'Wikidata' : 'ACDB'}: ${rel.label}`;
    groups[groupKey].push(node);
  }
  // If no explicit family references were found, show the linked character references separately rather than inventing a kinship.
  const mentioned=linkedIds.filter(id=>pool.has(String(id))).map(id=>pool.get(String(id))).filter(c=>String(c.id)!==String(selected.id));
  return {groups,mentioned,hasEvidence:Object.values(groups).some(a=>a.length>0)};
}
function nameKey(v=''){return normName(v).split(' ').filter(Boolean).sort().join(' ')}
function normName(v=''){return String(v).normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9а-яё]+/gi,' ').trim().replace(/\s+/g,' ')}
function acdbRelationLabel(label='', side='', kind=''){
  const s=String(label).toLowerCase();
  if(side==='parent') return /son of|daughter of|child of|сын|дочь/i.test(s) ? 'Отец / мать' : 'Родитель';
  if(side==='child') return 'Сын / дочь';
  if(kind==='sibling') return 'Брат / сестра';
  if(kind==='partner') return 'Супруг / супруга';
  if(/uncle|aunt|дяд|тет/i.test(s)) return 'Племянник / племянница';
  if(/niece|nephew|племян/i.test(s)) return 'Дядя / тётя';
  if(/grandfather|grandmother|grandparent|дед|баб/i.test(s)) return 'Внук / внучка';
  if(/grandson|granddaughter|grandchild|внук|внуч/i.test(s)) return 'Дедушка / бабушка';
  if(/cousin|двоюрод/i.test(s)) return 'Двоюродный родственник';
  if(/step|adopt|прием|приём|сводн/i.test(s)) return 'Приёмный / сводный родственник';
  return 'Родственник';
}
function familyCard(c, relation){
  const base = `data-name="${esc(c.russian||c.name||'')}" data-image="${esc(imageUrl(c.image,'preview'))}"`;
  const attrs = c.wikidataId ? `data-wikidata-id="${esc(c.wikidataId)}" ${base}` : c.acdbId ? `data-acdb-id="${esc(c.acdbId)}" ${base}` : `data-family-id="${esc(c.id)}" ${base}`;
  const ev = String(c.evidence||'');
  const badge = ev.startsWith('Wikidata') ? 'WD' : ev.startsWith('ACDB') ? 'ACDB' : 'SH';
  return `<button class="family-node" type="button" ${attrs} title="${esc(ev)}"><img src="${esc(imageUrl(c.image,'preview')||fallback)}" onerror="this.src='${fallback}'" alt="" loading="lazy"><span class="family-node-text"><strong>${esc(c.russian||c.name||'Персонаж')}</strong><small>${esc(relation)} <i class="src-badge">${badge}</i></small></span></button>`;
}
function renderFamilyTree(selected, full){
  const tree=makeFamilyTree(selected,full);const g=tree.groups;
  const group=(title,items,relation,cls)=>`<section class="family-group ${cls}"><div class="family-group-title">${title}<span>${items.length}</span></div><div class="family-nodes">${items.map(c=>familyCard(c,c.relationLabel||relation)).join('')||'<div class="family-empty">Нет подтверждённых данных</div>'}</div></section>`;
  const mentions=tree.mentioned.filter(c=>!Object.values(g).flat().some(x=>String(x.id)===String(c.id)));
  return `<section class="family-tree-wrap"><div class="family-tree-heading"><div><div class="eyebrow">CHARACTER RELATIONSHIP MAP</div><h3>Семейное дерево персонажа</h3></div><span class="tree-source">Shikimori · вся франшиза + ACDB + Wikidata</span></div><div class="family-tree"><div class="tree-top">${group('РОДИТЕЛИ',g.parent,'Родитель','parents')}</div><div class="tree-middle"><div class="tree-side left">${group('БРАТЬЯ И СЁСТРЫ',g.sibling,'Брат / сестра','siblings')}</div><div class="tree-center"><div class="tree-line vertical"></div><div class="family-main"><img src="${esc(imageUrl(full.image||selected.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><strong>${esc(full.russian||selected.russian||full.name||selected.name)}</strong><small>ВЫБРАННЫЙ ПЕРСОНАЖ</small></div></div><div class="tree-side right">${group('СУПРУГИ / ПАРТНЁРЫ',g.partner,'Супруг / супруга','partners')}</div></div><div class="tree-bottom">${group('ДЕТИ',g.child,'Сын / дочь','children')}${group('ДРУГИЕ РОДСТВЕННИКИ',g.other,'Родственник','relatives')}${mentions.length?group('УПОМЯНУТЫ В ОПИСАНИИ',mentions,'Упоминание','mentions'):''}</div></div><p class="tree-disclaimer">Связи собираются из Shikimori, Anime Characters Database (ACDB) и Wikidata. ACDB — пользовательская база, поэтому возможны ошибки, разные версии персонажа и неполные данные. Открывай источник, чтобы проверить каждую связь.</p></section>`;
}
async function loadRosterDescriptions(selectedId, selectedFull, onProgress, isLive){
  const roster=[...state.characters,...state.relatedCharacters];
  const unique=[...new Map(roster.filter(x=>x?.id).map(x=>[String(x.id),x])).values()];
  if(selectedFull?.id)state.characterDetails.set(String(selectedFull.id),selectedFull);
  const missing=unique.filter(x=>String(x.id)!==String(selectedId)&&!state.characterDetails.has(String(x.id))).slice(0,80);
  let cursor=0,done=0;
  const workers=Array.from({length:4},async()=>{
    while(cursor<missing.length&&(!isLive||isLive())){const item=missing[cursor++];try{const data=await api(`/api/character?id=${encodeURIComponent(item.id)}`);if(data.character)state.characterDetails.set(String(item.id),{...item,...data.character});}catch(e){/* a missing profile must not block other family evidence */}done++;if(onProgress)onProgress(done,missing.length);}
  });
  await Promise.all(workers);
  return missing.length;
}
function backBtn(){return state.history.length?'<button type="button" class="back-btn" data-back="1">← Назад</button>':'';}
function bindBack(){const b=$('#modalContent').querySelector('[data-back]');if(b)b.addEventListener('click',()=>{const prev=state.history.pop();if(prev)openCharacter(prev,{back:true});});}
function setProgress(pct,text){
  const v=Math.max(state.loadPct||0,Math.min(100,Math.round(pct)));state.loadPct=v;
  const f=$('#loadFill'),t=$('#loadText'),p=$('#loadPct');
  if(f)f.style.width=v+'%';if(p)p.textContent=v+'%';if(t&&text)t.textContent=text;
}
function showProgress(c){
  state.loadPct=0;const img=imageUrl(c.image,'preview');
  $('#modalContent').innerHTML=`${backBtn()}<div class="load-wrap"><div class="eyebrow">CHARACTER PROFILE</div>${img?`<img class="load-avatar" src="${esc(img)}" onerror="this.style.display='none'" alt="">`:''}<h2>${esc(c.russian||c.name||'Персонаж')}</h2><div class="load-bar"><div class="load-fill" id="loadFill"></div></div><div class="load-meta"><span id="loadText">Начинаю загрузку…</span><b id="loadPct">0%</b></div></div>`;
  bindBack();
}
async function cachedApi(kind,key,path){const m=state.cache[kind];if(m.has(key))return m.get(key);const v=await api(path);m.set(key,v);return v;}
async function fetchAcdb(q){
  const key=q.id?`id:${q.id}`:`n:${normName(q.name)}|${normName(q.title||'')}`;
  const qs=q.id?`id=${encodeURIComponent(q.id)}`:`name=${encodeURIComponent(q.name)}&title=${encodeURIComponent(q.title||'')}`;
  return cachedApi('acdb',key,`/api/acdb-relations?${qs}`);
}
async function fetchWikidata(q){
  const key=q.id?`id:${q.id}`:`n:${normName(q.name)}|${normName(q.title||'')}`;
  const qs=q.id?`id=${encodeURIComponent(q.id)}`:`name=${encodeURIComponent(q.name)}&title=${encodeURIComponent(q.title||'')}`;
  try{
    const res=await cachedApi('wd',key,`/api/wikidata-relations?${qs}`);
    if(res.unavailable)state.cache.wd.delete(key);
    return res;
  }catch(e){return {matched:false,unavailable:true,message:e.message};}
}
async function findShiki(name){
  const key=nameKey(name);if(!key)return null;
  if(state.cache.find.has(key))return state.cache.find.get(key);
  let hit=null;
  try{
    const data=await api(`/api/shiki-find?name=${encodeURIComponent(name)}`);
    hit=(data.items||[]).find(x=>nameKey(x.name)===key||nameKey(x.russian)===key)||null;
  }catch(e){return null;}
  state.cache.find.set(key,hit);return hit;
}
// For relatives that exist only in ACDB/Wikidata: look them up in Shikimori to get a picture
// and to be able to open them as full profiles.
async function resolveExternalNodes(rels,step,from,to,live){
  const known=new Set([...state.characters,...state.relatedCharacters,...state.characterDetails.values()].flatMap(x=>[nameKey(x.name),nameKey(x.russian)]).filter(Boolean));
  const todo=[...new Map(rels.filter(r=>r.name&&!known.has(nameKey(r.name))).map(r=>[nameKey(r.name),r])).values()].slice(0,30);
  if(!todo.length){step(to,'Связи собраны');return;}
  let done=0,cursor=0;
  await Promise.all(Array.from({length:4},async()=>{
    while(cursor<todo.length&&live()){
      const r=todo[cursor++];
      const hit=await findShiki(r.name);
      if(hit)for(const x of rels)if(nameKey(x.name)===nameKey(r.name)){x.shikiChar=hit;if(!x.image)x.image=imageUrl(hit.image,'preview');}
      done++;step(from+(to-from)*done/todo.length,`Ищу картинки и профили родственников… ${done}/${todo.length}`);
    }
  }));
}
async function openCharacter(c,opts={}){
  const modal=$('#modal');
  const wasOpen=!modal.classList.contains('hidden');
  if(!wasOpen)state.history=[];else if(state.current&&!opts.back)state.history.push(state.current);
  state.current=c;
  const token=++state.openToken;
  const live=()=>token===state.openToken;
  const step=(p,t)=>{if(live())setProgress(p,t);};
  const tag=(rels,source)=>(rels||[]).map(r=>({...r,source}));
  const fail=(title,msg,url)=>{if(!live())return;$('#modalContent').innerHTML=`${backBtn()}<div class="profile-loading"><h2>${esc(title)}</h2><p>${esc(msg)}</p>${url?`<a href="${esc(url)}" target="_blank" rel="noreferrer">Открыть источник ↗</a>`:''}</div>`;bindBack();};
  const finish=async()=>{step(100,'Готово');await new Promise(r=>setTimeout(r,220));};
  modal.classList.remove('hidden');document.body.style.overflow='hidden';
  showProgress(c);
  state.acdbRelations=[];

  // 1) Relative that exists only in Wikidata.
  if(c.wikidataId){
    step(8,'Загружаю профиль из Wikidata…');
    const wd=await fetchWikidata({id:c.wikidataId});
    if(!live())return;
    if(!wd.matched)return fail(c.name||'Персонаж',wd.message||'Не удалось загрузить профиль Wikidata.',c.url);
    const ch=wd.character||{};const name=ch.name||c.name;
    let acdbRels=[],acdbSource=null;
    step(30,'Ищу связи в ACDB…');
    try{const a=await fetchAcdb({name,title:ch.anime||''});if(a.matched){acdbRels=tag(a.relations,'acdb');acdbSource=a.character;}}catch(e){/* ACDB is optional */}
    if(!live())return;
    state.acdbRelations=[...tag(wd.relations,'wikidata'),...acdbRels];
    await resolveExternalNodes(state.acdbRelations,step,45,96,live);
    if(!live())return;
    const full={...c,name,russian:name,image:ch.image||c.image||'',acdbSource};
    await finish();if(!live())return;
    renderWikidataProfile(full,wd);
    return;
  }

  // 2) Relative that exists only in ACDB.
  if(c.acdbId){
    step(10,'Загружаю профиль ACDB…');
    let data;
    try{data=await fetchAcdb({id:c.acdbId});}catch(e){return fail(c.name||'Персонаж',`Не удалось загрузить ветку ACDB: ${e.message}`,c.url);}
    if(!live())return;
    const name=data.character?.name||c.name;
    step(30,'Дополняю связи из Wikidata…');
    const wd=await fetchWikidata({name,title:data.character?.anime||''});
    if(!live())return;
    state.acdbRelations=[...tag(data.relations,'acdb'),...(wd.matched?tag(wd.relations,'wikidata'):[])];
    await resolveExternalNodes(state.acdbRelations,step,45,96,live);
    if(!live())return;
    const full={...c,...(data.character||{}),name,russian:name,image:data.character?.image||c.image,acdbId:c.acdbId,external:true,wikidataSource:wd.matched?wd.character:null};
    await finish();if(!live())return;
    renderExternalProfile(full,data);
    return;
  }

  // 3) Regular Shikimori character.
  step(6,'Загружаю профиль персонажа…');
  let full=c;
  try{const data=await api(`/api/character?id=${c.id}`);full=data.character||c;}catch(e){/* roster data remains usable */}
  if(!live())return;
  state.characterDetails.set(String(c.id),{...c,...full});
  step(12,'Читаю описания персонажей франшизы…');
  await loadRosterDescriptions(c.id,full,(d,n)=>step(12+40*d/n,`Описания франшизы: ${d}/${n}`),live);
  if(!live())return;
  step(54,'Ищу связанных персонажей…');
  const linkedIds=[...new Set([...String(full.description||'').matchAll(/\[character=(\d+)\]/gi)].map(m=>m[1]))]
    .filter(id=>!state.characters.some(x=>String(x.id)===id)&&!state.relatedCharacters.some(x=>String(x.id)===id)&&id!==String(c.id)).slice(0,12);
  if(linkedIds.length){const extra=await Promise.all(linkedIds.map(id=>api(`/api/character?id=${id}`).catch(()=>null)));for(const item of extra)if(item?.character)state.relatedCharacters.push(item.character);}
  if(!live())return;
  step(62,'Запрашиваю ACDB и Wikidata…');
  const name=full.name||c.name||full.russian||c.russian||'';
  const title=state.selectedAnime?.name||state.selectedAnime?.russian||'';
  const [acdbRes,wdRes]=await Promise.allSettled([fetchAcdb({name,title}),fetchWikidata({name,title})]);
  if(!live())return;
  let acdbRels=[],wdRels=[];
  if(acdbRes.status==='fulfilled'){
    const ex=acdbRes.value;
    if(ex.matched){acdbRels=tag(ex.relations,'acdb');full.acdbSource=ex.character;full.acdbDiagnostics=ex.diagnostics||{relationRowsParsed:acdbRels.length};}
    else full.acdbDiagnostics={message:ex.message||'Персонаж не найден в ACDB',relationRowsParsed:0};
  }else full.acdbDiagnostics={error:acdbRes.reason?.message||'ошибка запроса',relationRowsParsed:0};
  const wd=wdRes.status==='fulfilled'?wdRes.value:{matched:false,unavailable:true,message:'ошибка запроса'};
  if(wd.matched){wdRels=tag(wd.relations,'wikidata');full.wikidataSource=wd.character;full.wikidataDiagnostics={relationsReturned:wdRels.length};}
  else if(wd.unavailable)full.wikidataDiagnostics={error:wd.message||'ошибка запроса',relationsReturned:0};
  else full.wikidataDiagnostics={message:wd.message||'Персонаж не найден в Wikidata',relationsReturned:0};
  state.acdbRelations=[...acdbRels,...wdRels];
  await resolveExternalNodes(state.acdbRelations,step,70,96,live);
  if(!live())return;
  await finish();if(!live())return;
  renderShikimoriProfile(c,full);
}
function renderWikidataProfile(full,data){
  const ch=data.character||{};
  const links=`<a class="source-link" href="${esc(ch.url||full.url||'#')}" target="_blank" rel="noreferrer">Открыть в Wikidata ↗</a>${full.acdbSource?` · <a class="source-link" href="${esc(full.acdbSource.url)}" target="_blank" rel="noreferrer">Связи ACDB ↗</a>`:''}`;
  $('#modalContent').innerHTML=`${backBtn()}<div class="profile"><img src="${esc(imageUrl(full.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">EXTERNAL CHARACTER PROFILE · WIKIDATA</div><h2 id="modalName">${esc(full.name)}</h2><div class="native">${esc(ch.anime||'')}</div><p class="description">${esc(ch.description||'Описание в Wikidata отсутствует.')}</p><p>${links}</p></div></div>${renderFamilyTree(full,full)}`;
  bindFamilyTreeClicks();
}
function renderShikimoriProfile(c,full){
  const desc=plainDescription(full.description||c.description||'Описание отсутствует.');
  const acdb=full.acdbSource;
  const sourceLinks=`<p><a class="source-link" href="https://shikimori.one${esc(full.url||c.url||`/characters/${c.id}`)}" target="_blank" rel="noreferrer">Страница персонажа на Shikimori ↗</a>${acdb?` · <a class="source-link" href="${esc(acdb.url)}" target="_blank" rel="noreferrer">Связи ACDB ↗</a>`:''}${full.wikidataSource?` · <a class="source-link" href="${esc(full.wikidataSource.url)}" target="_blank" rel="noreferrer">Wikidata ↗</a>`:''}</p>`;
  const diag=full.acdbDiagnostics;
  const acdbStatus=diag?`<p class="acdb-status">${diag.error?`ACDB сейчас недоступна — ${esc(diag.error)}. Семейные связи Shikimori продолжают отображаться независимо от ACDB.`:diag.message?`ACDB: ${esc(diag.message)}`:`ACDB: персонаж ${acdb?'найден':'не сопоставлен'}, связей получено: ${Number(diag.relationRowsParsed||0)}.`}</p>`:'';
  const wdiag=full.wikidataDiagnostics;
  const wdStatus=wdiag?`<p class="acdb-status">${wdiag.error?`Wikidata недоступна — ${esc(wdiag.error)}.`:wdiag.message?`Wikidata: ${esc(wdiag.message)}`:`Wikidata: связей получено: ${Number(wdiag.relationsReturned||0)}.`}</p>`:'';
  $('#modalContent').innerHTML=`${backBtn()}<div class="profile"><img src="${esc(imageUrl(full.image||c.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">CHARACTER PROFILE</div><h2 id="modalName">${esc(full.russian||c.russian||full.name||c.name)}</h2><div class="native">${esc(full.name||c.name||'')}</div><p class="description">${esc(desc)}</p>${sourceLinks}${acdbStatus}${wdStatus}</div></div>${renderFamilyTree(c,full)}`;
  bindFamilyTreeClicks();
}
function renderExternalProfile(full,data){
  const title=full.name||'Персонаж';
  $('#modalContent').innerHTML=`${backBtn()}<div class="profile"><img src="${esc(imageUrl(full.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">EXTERNAL CHARACTER PROFILE · ACDB</div><h2 id="modalName">${esc(title)}</h2><div class="native">${esc(data.character?.anime||'')}</div><p class="description">Профиль и родственные связи загружены из Anime Characters Database. Это отдельная пользовательская база персонажей.</p><p><a class="source-link" href="${esc(full.url||'#')}" target="_blank" rel="noreferrer">Открыть профиль ACDB ↗</a> · <a class="source-link" href="${esc(data.character?.graphUrl||'#')}" target="_blank" rel="noreferrer">Открыть полный граф ↗</a>${full.wikidataSource?` · <a class="source-link" href="${esc(full.wikidataSource.url)}" target="_blank" rel="noreferrer">Wikidata ↗</a>`:''}</p></div></div>${renderFamilyTree(full,full)}`;
  bindFamilyTreeClicks();
}
function bindFamilyTreeClicks(){
  bindBack();
  const root=$('#modalContent');
  root.querySelectorAll('[data-family-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.familyId;
    const next=state.characters.find(x=>String(x.id)===id)||state.relatedCharacters.find(x=>String(x.id)===id)
      ||{id,name:btn.dataset.name||'',russian:btn.dataset.name||'',image:btn.dataset.image||''};
    openCharacter(next);
  }));
  root.querySelectorAll('[data-wikidata-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const id=btn.dataset.wikidataId;
    const node=state.acdbRelations.find(x=>String(x.id)===String(id));
    openCharacter({id:null,wikidataId:id,name:node?.name||btn.dataset.name||'Персонаж',russian:node?.name||btn.dataset.name||'Персонаж',image:node?.image||btn.dataset.image||'',url:node?.url||''});
  }));
  root.querySelectorAll('[data-acdb-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const acdbId=btn.dataset.acdbId;
    const node=state.acdbRelations.find(x=>String(x.id)===String(acdbId)&&x.source!=='wikidata');
    const inShiki=state.characters.find(x=>nameKey(x.name||x.russian)===nameKey(node?.name||''));
    if(inShiki)openCharacter(inShiki);
    else openCharacter({id:null,acdbId,name:node?.name||btn.dataset.name||'Персонаж',russian:node?.name||btn.dataset.name||'Персонаж',image:node?.image||btn.dataset.image||'',url:node?.url||''});
  }));
}
function closeModal(){ state.openToken++;state.history=[];state.current=null;$('#modal').classList.add('hidden');document.body.style.overflow=''; }
$('#closeModal').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target.dataset.close)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
