const $ = (s) => document.querySelector(s);
const state = { titles: [], characters: [], selectedAnime: null };
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
  state.titles.forEach(a=>{const card=document.createElement('article');card.className='title-card';const img=imageUrl(a.image);card.innerHTML=`<img class="poster" src="${esc(img||fallback)}" onerror="this.src='${fallback}'" alt=""><div class="title-info"><span class="type">${esc(a.kind||'TITLE')} · ${esc(a.status||'')}</span><h3>${esc(a.russian||a.name||'Без названия')}</h3><p>${esc(a.name||'')}</p><p>${esc(a.aired_on?.slice(0,4)||'')} ${a.episodes?`· ${a.episodes} эп.`:''}</p></div>`;card.addEventListener('click',()=>selectAnime(a));box.append(card)});
  $('#resultsSection').classList.remove('hidden');
}
async function selectAnime(anime){state.selectedAnime=anime;state.characters=[];$('#resultsSection').classList.add('hidden');$('#titleSection').classList.remove('hidden');$('#titleHero').innerHTML=`<img class="title-poster" src="${esc(imageUrl(anime.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">SELECTED TITLE</div><h2 class="title-name">${esc(anime.russian||anime.name)}</h2><div class="title-meta"><span class="pill">${esc(anime.kind||'')}</span><span class="pill">${esc(anime.status||'')}</span><span class="pill">${esc(anime.aired_on?.slice(0,4)||'Год неизвестен')}</span><span class="pill">${anime.episodes||'?'} эпизодов</span><span class="pill">★ ${anime.score||'—'}</span></div><p class="title-description">${esc(anime.description||'Описание не указано в Shikimori.')}</p><p><a href="https://shikimori.one${esc(anime.url||`/animes/${anime.id}`)}" target="_blank" rel="noreferrer">Открыть тайтл на Shikimori ↗</a></p></div>`;
  $('#characters').innerHTML='';$('#emptyCharacters').classList.add('hidden');$('#characterCount').textContent='Загрузка...';status('Загружаю персонажей...');
  try{const data=await api(`/api/roles?id=${anime.id}`);const seen=new Set();state.characters=(data.items||[]).filter(item=>item.character&&!seen.has(item.character.id)&&seen.add(item.character.id)).map(item=>({...item.character,role:item.roles||[]}));renderCharacters();status(`Персонажей загружено: ${state.characters.length}`);}
  catch(err){status(err.message,true);$('#characterCount').textContent='';$('#emptyCharacters').classList.remove('hidden');$('#emptyCharacters').textContent='Не удалось загрузить персонажей. '+err.message}
  $('#titleSection').scrollIntoView({behavior:'smooth',block:'start'});
}
function roleLabel(roles){if(!Array.isArray(roles))return '';return roles.map(r=>typeof r==='string'?r:(r.russian||r.name||'')).filter(Boolean).join(', ')}
function renderCharacters(){const q=$('#characterFilter').value.trim().toLowerCase();const list=state.characters.filter(c=>`${c.russian||''} ${c.name||''}`.toLowerCase().includes(q));$('#characterCount').textContent=`${list.length} / ${state.characters.length}`;const box=$('#characters');box.innerHTML='';$('#emptyCharacters').classList.toggle('hidden',list.length>0);
  list.forEach(c=>{const card=document.createElement('article');card.className='character-card';const role=roleLabel(c.role);card.innerHTML=`<img src="${esc(imageUrl(c.image,'preview')||fallback)}" onerror="this.src='${fallback}'" alt=""><div class="char-info"><h3>${esc(c.russian||c.name||'Неизвестный персонаж')}</h3><p>${esc(c.name||'')}${role?` · ${esc(role)}`:''}</p></div>`;card.addEventListener('click',()=>openCharacter(c));box.append(card)});
}
$('#characterFilter').addEventListener('input',renderCharacters);
async function openCharacter(c){const modal=$('#modal');$('#modalContent').innerHTML=`<div class="profile"><img src="${esc(imageUrl(c.image,'original')||fallback)}" onerror="this.src='${fallback}'" alt=""><div><div class="eyebrow">CHARACTER PROFILE</div><h2 id="modalName">${esc(c.russian||c.name)}</h2><div class="native">${esc(c.name||'')}</div><p class="description">${esc(c.description||'Загружаю подробную информацию...')}</p><div class="source-note">Информация и связи отображаются только в том случае, если они доступны в данных Shikimori.</div><p><a href="https://shikimori.one${esc(c.url||`/characters/${c.id}`)}" target="_blank" rel="noreferrer">Страница персонажа на Shikimori ↗</a></p></div></div>`;modal.classList.remove('hidden');document.body.style.overflow='hidden';
  try{const data=await api(`/api/character?id=${c.id}`);const full=data.character||c;const desc=full.description||c.description||'Описание отсутствует.';const p=$('#modalContent .description');if(p)p.textContent=desc;const link=$('#modalContent a');if(link)link.href=`https://shikimori.one${full.url||`/characters/${c.id}`}`;}
  catch(e){const p=$('#modalContent .description');if(p)p.textContent=c.description||'Дополнительные данные не удалось загрузить.'}
}
function closeModal(){ $('#modal').classList.add('hidden');document.body.style.overflow=''; }
$('#closeModal').addEventListener('click',closeModal);$('#modal').addEventListener('click',e=>{if(e.target.dataset.close)closeModal()});document.addEventListener('keydown',e=>{if(e.key==='Escape')closeModal()});
