const $ = (s) => document.querySelector(s);
const state = { titles: [], characters: [], relatedCharacters: [], acdbRelations: [], selectedAnime: null, franchiseTitles: [], characterDetails: new Map() };
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
  const findInPool=(name)=>{const n=normName(name);return n?poolList.find(x=>normName(x.name)===n||normName(x.russian)===n):null;};
  for (const rel of state.acdbRelations || []) {
    const type = rel.side || rel.kind;
    const groupKey = ['parent','child','sibling','partner','other'].includes(type) ? type : null;
    if (!groupKey) continue;
    const isWikidata = rel.source === 'wikidata';
    const same = findInPool(rel.name);
    if (same && String(same.id) === String(selected.id)) continue;
    const key = `${rel.id}:${groupKey}`;
    const nameKey = `n:${normName(rel.name)}:${groupKey}`;
    if (unique.has(key) || unique.has(nameKey)) continue;
    unique.add(key); unique.add(nameKey);
    const node = same
      ? (isWikidata ? { ...same } : { ...same, acdbId: rel.id, external: true })
      : (isWikidata
          ? { id: null, external: true, name: rel.name, russian: rel.name, image: rel.image || '', wikidataUrl: rel.url }
          : { id: null, acdbId: rel.id, external: true, name: rel.name, russian: rel.name, image: rel.image || '', url: rel.url });
    node.relationLabel = isWikidata ? rel.label : acdbRelationLabel(rel.label, rel.side, rel.kind);
    node.evidence = `${isWikidata ? 'Wikidata' : 'ACDB'}: ${rel.label}`;
    groups[groupKey].push(node);
  }
  // If no explicit family references were found, show the linked character references separately rather than inventing a kinship.
  const mentioned=linkedIds.filter(id=>pool.has(String(id))).map(id=>pool.get(String(id))).filter(c=>String(c.id)!==String(selected.id));
  return {groups,mentioned,hasEvidence:Object.values(groups).some(a=>a.length>0)};
}
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
  const attrs = c.wikidataUrl ? `data-ext-url="${esc(c.wikidataUrl)}"` : c.acdbId ? `data-acdb-id="${esc(c.acdbId)}"` : `data-family-id="${esc(c.id)}"`;
  return `<button class="family-node" type="button" ${attrs}><img src="${esc(imageUrl(c.image,'preview')||fallback)}" onerror="this.src='${fallback}'" alt=""><span class="family-node-text"><strong>${esc(c.russian||c.name||'Персонаж')}</strong><small>${esc(relation)}</small></span></button>`;
}
function renderFamilyTree(selected, full){
  const tree=makeFamilyTree(selected,full);const g=tree.groups;
  const group=(title,items,relation,cls)=>`<section class="family-group ${cls}"><div class="family-group-title">${title}<span>${items.length}</span></div><div class="family-nodes">${items.map(c=>familyCard(c,c.relationLabel||relation)).join('')||'<div class="family-empty">Нет подтверждённых данных</div>'}</div></section>`;
  const mentions=tree.mentioned.filter(c=>!Object.values(g).flat().some(x=>String(x.id)===String(c.id)));
  return `<section class="family-tree-wrap"><div class="family-tree-heading"><div><div class="eyebrow">CHARACTER RELATIONSHIP MAP</div><h3>Семейное дерево персонажа</h3></div><span class="tree-source">Shikimori · вся франшиза + ACDB + Wikidata</span></div><div class="family-tree"><div class="tree-top">${group('РОДИТЕЛИ',g.parent,'Родитель','parents')}</div><div class="tree-middle"><div class="tree-side left">${group('БРАТЬЯ И СЁСТРЫ',g.sibling,'Брат / сестра','siblings')}</div><div class="tree-center"><div class="tree-line vertical"></div><div class="family-main"><img src="${esc(imageUrl(full.image||selected.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><strong>${esc(full.russian||selected.russian||full.name||selected.name)}</strong><small>ВЫБРАННЫЙ ПЕРСОНАЖ</small></div></div><div class="tree-side right">${group('СУПРУГИ / ПАРТНЁРЫ',g.partner,'Супруг / супруга','partners')}</div></div><div class="tree-bottom">${group('ДЕТИ',g.child,'Сын / дочь','children')}${group('ДРУГИЕ РОДСТВЕННИКИ',g.other,'Родственник','relatives')}${mentions.length?group('УПОМЯНУТЫ В ОПИСАНИИ',mentions,'Упоминание','mentions'):''}</div></div><p class="tree-disclaimer">Связи собираются из Shikimori и Anime Characters Database (ACDB). ACDB — пользовательская база, поэтому возможны ошибки, разные версии персонажа и неполные данные. Открывай источник, чтобы проверить каждую связь.</p></section>`;
}
async function loadRosterDescriptions(selectedId, selectedFull){
  const roster=[...state.characters,...state.relatedCharacters];
  const unique=[...new Map(roster.filter(x=>x?.id).map(x=>[String(x.id),x])).values()];
  if(selectedFull?.id)state.characterDetails.set(String(selectedFull.id),selectedFull);
  const missing=unique.filter(x=>String(x.id)!==String(selectedId)&&!state.characterDetails.has(String(x.id))).slice(0,80);
  let cursor=0;
  const workers=Array.from({length:4},async()=>{
    while(cursor<missing.length){const item=missing[cursor++];try{const data=await api(`/api/character?id=${encodeURIComponent(item.id)}`);if(data.character)state.characterDetails.set(String(item.id),{...item,...data.character});}catch(e){/* a missing profile must not block other family evidence */}}
  });
  await Promise.all(workers);
  return missing.length;
}
async function openCharacter(c){
  const modal=$('#modal');modal.classList.remove('hidden');document.body.style.overflow='hidden';
  $('#modalContent').innerHTML=`<div class="profile-loading"><div class="eyebrow">CHARACTER PROFILE</div><h2>${esc(c.russian||c.name||'Персонаж')}</h2><p>Загружаю описание и семейные связи из нескольких источников...</p></div>`;
  let full=c;
  state.acdbRelations=[];
  if(c.acdbId){
    try{
      const data=await api(`/api/acdb-relations?id=${encodeURIComponent(c.acdbId)}`);
      state.acdbRelations=data.relations||[];
      full={...c,...(data.character||{}),name:data.character?.name||c.name,russian:data.character?.name||c.russian,image:data.character?.image||c.image,acdbId:c.acdbId,external:true};
      renderExternalProfile(full,data);
    }catch(e){$('#modalContent').innerHTML=`<div class="profile-loading"><h2>${esc(c.name||'Персонаж')}</h2><p>Не удалось загрузить ветку ACDB: ${esc(e.message)}</p><a href="${esc(c.url||'#')}" target="_blank" rel="noreferrer">Открыть источник ↗</a></div>`;}
    return;
  }
  try{const data=await api(`/api/character?id=${c.id}`);full=data.character||c;}catch(e){/* roster data remains usable */}
  state.characterDetails.set(String(c.id),{...c,...full});
  // Load descriptions of other characters from every related season/movie/OVA/manga entry.
  // This is required for reverse lookup: when opening a child, the parent's biography can name the child.
  await loadRosterDescriptions(c.id,full);
  // Load directly linked Shikimori characters so they can appear in the graph too.
  const linkedIds=[...new Set([...String(full.description||'').matchAll(/\[character=(\d+)\]/gi)].map(m=>m[1]))]
    .filter(id=>!state.characters.some(x=>String(x.id)===id)&&!state.relatedCharacters.some(x=>String(x.id)===id)&&id!==String(c.id)).slice(0,12);
  if(linkedIds.length){const extra=await Promise.all(linkedIds.map(id=>api(`/api/character?id=${id}`).catch(()=>null)));for(const item of extra)if(item?.character)state.relatedCharacters.push(item.character);}
  // Enrich Shikimori descriptions with ACDB's explicit relation database.
  try{
    const name=full.name||c.name||full.russian||c.russian||'';
    const title=state.selectedAnime?.name||state.selectedAnime?.russian||'';
    const external=await api(`/api/acdb-relations?name=${encodeURIComponent(name)}&title=${encodeURIComponent(title)}`);
    if(external.matched){state.acdbRelations=external.relations||[];full.acdbSource=external.character;full.acdbDiagnostics=external.diagnostics||{relationRowsParsed:state.acdbRelations.length};}else{full.acdbDiagnostics={message:external.message||'Персонаж не найден в ACDB',relationRowsParsed:0};}
  }catch(e){full.acdbDiagnostics={error:e.message,relationRowsParsed:0};}
  // Wikidata: second structured source, independent from ACDB availability.
  try{
    const wname=full.name||c.name||'';
    const wtitle=state.selectedAnime?.name||state.selectedAnime?.russian||'';
    const wd=await api(`/api/wikidata-relations?name=${encodeURIComponent(wname)}&title=${encodeURIComponent(wtitle)}`);
    if(wd.matched){
      const rels=(wd.relations||[]).map(r=>({...r,source:'wikidata'}));
      state.acdbRelations=[...(state.acdbRelations||[]),...rels];
      full.wikidataSource=wd.character;
      full.wikidataDiagnostics={relationsReturned:rels.length};
    }else{full.wikidataDiagnostics={message:wd.message||'Персонаж не найден в Wikidata',relationsReturned:0};}
  }catch(e){full.wikidataDiagnostics={error:e.message,relationsReturned:0};}
  renderShikimoriProfile(c,full);
}
function renderShikimoriProfile(c,full){
  const desc=plainDescription(full.description||c.description||'Описание отсутствует.');
  const acdb=full.acdbSource;
  const sourceLinks=`<p><a class="source-link" href="https://shikimori.one${esc(full.url||c.url||`/characters/${c.id}`)}" target="_blank" rel="noreferrer">Страница персонажа на Shikimori ↗</a>${acdb?` · <a class="source-link" href="${esc(acdb.url)}" target="_blank" rel="noreferrer">Связи ACDB ↗</a>`:''}${full.wikidataSource?` · <a class="source-link" href="${esc(full.wikidataSource.url)}" target="_blank" rel="noreferrer">Wikidata ↗</a>`:''}</p>`;
  const diag=full.acdbDiagnostics;
  const acdbStatus=diag?`<p class="acdb-status">${diag.error?`ACDB сейчас недоступна — ${esc(diag.error)}. Семейные связи Shikimori продолжают отображаться независимо от ACDB.`:diag.message?`ACDB: ${esc(diag.message)}`:`ACDB: персонаж ${acdb?'найден':'не сопоставлен'}, связей получено: ${Number(diag.relationRowsParsed||0)}.`}</p>`:'';
  const wdiag=full.wikidataDiagnostics;
  const wdStatus=wdiag?`<p class="acdb-status">${wdiag.error?`Wikidata недоступна — ${esc(wdiag.error)}.`:wdiag.message?`Wikidata: ${esc(wdiag.message)}`:`Wikidata: связей получено: ${Number(wdiag.relationsReturned||0)}.`}</p>`:'';
  $('#modalContent').innerHTML=`<div class="profile"><img src="${esc(imageUrl(full.image||c.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">CHARACTER PROFILE</div><h2 id="modalName">${esc(full.russian||c.russian||full.name||c.name)}</h2><div class="native">${esc(full.name||c.name||'')}</div><p class="description">${esc(desc)}</p>${sourceLinks}${acdbStatus}${wdStatus}</div></div>${renderFamilyTree(c,full)}`;
  bindFamilyTreeClicks();
}
function renderExternalProfile(full,data){
  const title=full.name||'Персонаж';
  $('#modalContent').innerHTML=`<div class="profile"><img src="${esc(full.image||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">EXTERNAL CHARACTER PROFILE · ACDB</div><h2 id="modalName">${esc(title)}</h2><div class="native">${esc(data.character?.anime||'')}</div><p class="description">Профиль и родственные связи загружены из Anime Characters Database. Это отдельная пользовательская база персонажей.</p><p><a class="source-link" href="${esc(full.url||'#')}" target="_blank" rel="noreferrer">Открыть профиль ACDB ↗</a> · <a class="source-link" href="${esc(data.character?.graphUrl||'#')}" target="_blank" rel="noreferrer">Открыть полный граф ↗</a></p></div></div>${renderFamilyTree(full,full)}`;
  bindFamilyTreeClicks();
}
function bindFamilyTreeClicks(){
  $('#modalContent').querySelectorAll('[data-family-id]').forEach(btn=>btn.addEventListener('click',()=>{const next=state.characters.find(x=>String(x.id)===btn.dataset.familyId)||state.relatedCharacters.find(x=>String(x.id)===btn.dataset.familyId);if(next)openCharacter(next);else api(`/api/character?id=${btn.dataset.familyId}`).then(data=>openCharacter(data.character)).catch(()=>{});}));
  $('#modalContent').querySelectorAll('[data-ext-url]').forEach(btn=>btn.addEventListener('click',()=>window.open(btn.dataset.extUrl,'_blank','noopener')));
  $('#modalContent').querySelectorAll('[data-acdb-id]').forEach(btn=>btn.addEventListener('click',()=>{
    const acdbId=btn.dataset.acdbId;
    const node=[...state.acdbRelations].find(x=>String(x.id)===String(acdbId));
    const inShiki=state.characters.find(x=>normName(x.name||x.russian)===normName(node?.name||''));
    if(inShiki)openCharacter(inShiki);
    else openCharacter({id:null,acdbId,name:node?.name||'Персонаж',russian:node?.name||'Персонаж',image:node?.image||'',url:node?.url||''});
  }));
}
function closeModal(){ $('#modal').classList.add('hidden');document.body.style.overflow=''; }
$('#closeModal').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target.dataset.close)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
