const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

// Application State
const state = {
  history: [],
  current: null,
  openToken: 0,
  loadPct: 0,
  cache: { acdb: new Map(), wd: new Map(), find: new Map() },
  titles: [],
  characters: [],
  relatedCharacters: [],
  acdbRelations: [],
  characterRelationsMap: new Map(),
  selectedAnime: null,
  franchiseTitles: [],
  characterDetails: new Map(),
  activeRoleFilter: 'all', // 'all' | 'main' | 'supporting'
  activeClanFilter: null,
  favorites: JSON.parse(localStorage.getItem('se_favs') || '[]'),
  spoilersHidden: localStorage.getItem('se_spoilers') !== 'false'
};

function debounce(fn, ms = 75) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const imageUrl = (image, size = 'preview') => {
  if (!image) return '';
  if (typeof image === 'string') return image.startsWith('http') ? image : `https://shikimori.one${image}`;
  const path = image[size] || image.original || image.preview || image.x96 || '';
  return path ? (path.startsWith('http') ? path : `https://shikimori.one${path}`) : '';
};

const fallback = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='180' height='240' viewBox='0 0 180 240'%3E%3Crect width='100%25' height='100%25' fill='%23191826'/%3E%3Ccircle cx='90' cy='95' r='36' fill='%2328273d'/%3E%3Cpath d='M40 185 c0 -35 25 -55 50 -55 s50 20 50 55' fill='%2328273d'/%3E%3Ctext x='50%25' y='210' fill='%23716e88' text-anchor='middle' font-size='11' font-family='sans-serif'%3ENo Image%3C/text%3E%3C/svg%3E";

function showStatus(message = '', error = false) {
  const wrap = $('#statusWrap');
  const el = $('#status');
  if (!message) {
    wrap.classList.add('hidden');
    el.textContent = '';
    return;
  }
  wrap.classList.remove('hidden');
  el.textContent = message;
  el.className = `status ${error ? 'error' : ''}`;
}

async function api(path) {
  const r = await fetch(path);
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(data.error || `Ошибка ${r.status}`);
  return data;
}

// Search Form
const searchInput = $('#query');
const clearSearchBtn = $('#clearSearch');

searchInput.addEventListener('input', () => {
  clearSearchBtn.classList.toggle('hidden', !searchInput.value.trim());
});

clearSearchBtn.addEventListener('click', () => {
  searchInput.value = '';
  clearSearchBtn.classList.add('hidden');
  searchInput.focus();
});

// Quick Tags handler
$$('.quick-tag').forEach(tag => {
  tag.addEventListener('click', () => {
    const q = tag.dataset.q;
    if (q) {
      searchInput.value = q;
      clearSearchBtn.classList.remove('hidden');
      performSearch(q);
    }
  });
});

$('#searchForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const q = searchInput.value.trim();
  if (q.length < 2) return;
  performSearch(q);
});

async function performSearch(query) {
  $('#titleSection').classList.add('hidden');
  $('#resultsSection').classList.add('hidden');
  $('#kinshipCatalogSection')?.classList.add('hidden');
  $('#titlesCatalogSection')?.classList.add('hidden');
  $('#searchButton').disabled = true;
  showStatus('Ищу тайтлы на Shikimori...');

  try {
    const data = await api(`/api/search?q=${encodeURIComponent(query)}`);
    state.titles = data.items || [];
    renderResults();
    showStatus(state.titles.length ? `Найдено тайтлов: ${state.titles.length}` : 'Ничего не найдено. Попробуйте другое название.');
  } catch (err) {
    showStatus(err.message, true);
  } finally {
    $('#searchButton').disabled = false;
  }
}

function renderResults() {
  const box = $('#results');
  $('#resultCount').textContent = `${state.titles.length} результатов`;

  if (!state.titles.length) {
    box.innerHTML = '<p class="empty">Ничего не найдено.</p>';
    $('#resultsSection').classList.remove('hidden');
    return;
  }

  box.innerHTML = state.titles.map((a, i) => {
    const img = imageUrl(a.image);
    const mediaType = a.media_type || 'anime';
    const score = a.score ? Number(a.score).toFixed(1) : null;
    return `
      <article class="title-card" data-title-index="${i}">
        <div class="poster-wrap">
          <img class="poster" src="${esc(img || fallback)}" onerror="this.src='${fallback}'" alt="" loading="lazy" decoding="async">
          ${score && score !== '0.0' ? `<div class="score-badge">★ ${score}</div>` : ''}
        </div>
        <div class="title-info">
          <span class="media-tag ${mediaType}">${mediaType.toUpperCase()} · ${esc(a.kind || 'TITLE')}</span>
          <h3>${esc(a.russian || a.name || 'Без названия')}</h3>
          <p class="title-orig">${esc(a.name || '')}</p>
          <div class="title-meta-line">
            ${esc(a.aired_on?.slice(0, 4) || '—')} ${a.episodes ? `· ${a.episodes} эп.` : ''} · ${esc(a.status || '')}
          </div>
        </div>
      </article>
    `;
  }).join('');

  $('#resultsSection').classList.remove('hidden');
  $('#resultsSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Delegated click handler for search results
$('#results').addEventListener('click', (e) => {
  const card = e.target.closest('[data-title-index]');
  if (!card) return;
  const index = Number(card.dataset.titleIndex);
  const a = state.titles[index];
  if (a) selectAnime(a);
});

// Franchise Progress Bar helpers
function setFranchiseProgress(pct, titleText, detailText) {
  const card = $('#franchiseLoading');
  const fill = $('#franchiseLoadFill');
  const pctEl = $('#franchiseLoadPct');
  const titleEl = $('#franchiseLoadTitle');
  const textEl = $('#franchiseLoadText');
  if (!card) return;
  card.classList.remove('hidden');
  const v = Math.max(0, Math.min(100, Math.round(pct)));
  if (fill) fill.style.width = v + '%';
  if (pctEl) pctEl.textContent = v + '%';
  if (titleEl && titleText) titleEl.textContent = titleText;
  if (textEl && detailText) textEl.textContent = detailText;
}

function hideFranchiseProgress() {
  const card = $('#franchiseLoading');
  if (card) card.classList.add('hidden');
}

async function collectFranchiseTitles(start, fallbackType, onProgress) {
  const key = t => `${t.media_type || fallbackType}:${t.id}`;
  const found = new Map([[key(start), { ...start, media_type: start.media_type || fallbackType }]]);
  const queue = [{ title: start, depth: 0 }];
  let cursor = 0;

  // 4 concurrent workers for fast franchise graph discovery
  const workers = Array.from({ length: 4 }, async () => {
    while (cursor < queue.length && found.size < 16) {
      const current = queue[cursor++];
      if (!current || current.depth >= 2) continue;
      if (['clip', 'music', 'pv'].includes(current.title.kind)) continue;
      try {
        const data = await api(`/api/related?id=${current.title.id}&type=${current.title.media_type || fallbackType}`);
        for (const item of data.items || []) {
          const kind = item.kind || '';
          if (['clip', 'music', 'pv'].includes(kind)) continue;
          const normalized = { ...item, media_type: item.media_type || fallbackType };
          const k = key(normalized);
          if (found.has(k) || found.size >= 16) continue;
          found.set(k, normalized);
          queue.push({ title: normalized, depth: current.depth + 1 });
          if (onProgress) onProgress(found.size);
        }
      } catch (e) {
        console.warn('Связанные тайтлы недоступны для', current.title.id, e.message);
      }
    }
  });

  await Promise.all(workers);
  return [...found.values()];
}

async function selectAnime(anime) {
  state.selectedAnime = anime;
  state.characters = [];
  state.relatedCharacters = [];
  state.franchiseTitles = [];
  state.characterDetails = new Map();

  // Set URL hash for deep linking
  try {
    history.replaceState(null, '', `#title=${anime.id}&type=${anime.media_type || 'anime'}`);
  } catch (_) {}

  $('#resultsSection').classList.add('hidden');
  $('#titleSection').classList.remove('hidden');
  $('#kinshipCatalogSection')?.classList.add('hidden');
  $('#titlesCatalogSection')?.classList.add('hidden');
  document.querySelectorAll('.main-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === 'tree'));

  const mediaType = ['manga', 'ranobe'].includes(anime.media_type) ? anime.media_type : 'anime';
  const score = anime.score ? Number(anime.score).toFixed(1) : null;

  $('#titleHero').innerHTML = `
    <div class="hero-poster-wrap">
      <img class="title-poster" src="${esc(imageUrl(anime.image, 'original') || fallback)}" onerror="this.src='${fallback}'" alt="">
    </div>
    <div class="title-details">
      <div class="eyebrow"><span class="pulse"></span> ВЫБРАННЫЙ ТАЙТЛ</div>
      <h2 class="title-name">${esc(anime.russian || anime.name)}</h2>
      <div class="title-meta-pills">
        <span class="pill">${mediaType.toUpperCase()} · ${esc(anime.kind || '')}</span>
        <span class="pill">${esc(anime.status || '')}</span>
        <span class="pill">${esc(anime.aired_on?.slice(0, 4) || 'Год неизвестен')}</span>
        ${anime.episodes ? `<span class="pill">${anime.episodes} эпизодов</span>` : ''}
        ${score && score !== '0.0' ? `<span class="pill gold">★ ${score}</span>` : ''}
      </div>
      <div class="title-description">${esc(anime.description || 'Описание не указано в Shikimori.')}</div>
      <p>
        <a class="title-link" href="https://shikimori.one${esc(anime.url || (mediaType === 'manga' ? `/mangas/${anime.id}` : `/animes/${anime.id}`))}" target="_blank" rel="noreferrer">
          Открыть тайтл на Shikimori ↗
        </a>
      </p>
    </div>
  `;

  $('#characters').innerHTML = '';
  $('#emptyCharacters').classList.add('hidden');
  $('#characterCount').textContent = 'Загрузка...';

  // 1. Initial progress
  setFranchiseProgress(8, 'Синхронизация франшизы…', 'Поиск связанных сезонов, фильмов, OVA, спецвыпусков и манги…');
  showStatus('Ищу все связанные части франшизы на Shikimori...');

  try {
    // 2. Discover franchise parts
    const allTitles = await collectFranchiseTitles(anime, mediaType, (count) => {
      setFranchiseProgress(8 + Math.min(17, count), 'Поиск связанных частей франшизы…', `Найдено частей франшизы: ${count}`);
    });

    state.franchiseTitles = allTitles;
    renderFranchiseTitles();

    setFranchiseProgress(25, `Загрузка персонажей из ${allTitles.length} частей франшизы…`, `Подготовка запросов ролей…`);
    showStatus(`Загружаю персонажей из ${allTitles.length} связанных частей...`);

    // 3. Load characters from all titles with real-time progress (4 concurrent workers)
    let done = 0;
    const seen = new Map();
    const total = allTitles.length;
    let cursor = 0;

    const roleWorkers = Array.from({ length: 4 }, async () => {
      while (cursor < allTitles.length) {
        const index = cursor++;
        const t = allTitles[index];
        if (['clip', 'music', 'pv'].includes(t.kind)) {
          done++;
          continue;
        }
        try {
          const result = await api(`/api/roles?id=${t.id}&type=${t.media_type || mediaType}`);
          for (const item of result.items || []) {
            if (!item.character) continue;
            const id = String(item.character.id);
            const existing = seen.get(id);
            const titleName = t.russian || t.name;

            if (existing) {
              existing.sourceTitles = [...(existing.sourceTitles || []), titleName].filter(Boolean);
              if (Array.isArray(item.roles)) {
                existing.role = [...new Set([...(existing.role || []), ...item.roles])];
              }
            } else {
              seen.set(id, {
                ...item.character,
                role: item.roles || [],
                sourceTitles: [titleName].filter(Boolean)
              });
            }
          }
        } catch (_) {}

        done++;
        const pct = Math.round(25 + (70 * done / total));
        const titleName = t.russian || t.name;
        setFranchiseProgress(pct, `Загрузка персонажей: ${done} из ${total} частей (${pct}%)`, `Обработка: «${titleName}» · Уникальных персонажей: ${seen.size}`);
        $('#characterCount').textContent = `${seen.size}`;
      }
    });

    await Promise.all(roleWorkers);

    state.characters = [...seen.values()];
    state.activeClanFilter = null;
    renderCharacters();
    updateClanFilters();
    populateRosterDatalist();
    startFranchisePreload(state.characters);

    setFranchiseProgress(100, 'Синхронизация завершена!', `Успешно загружено: ${state.characters.length} персонажей из ${allTitles.length} частей`);
    showStatus(`Персонажей франшизы загружено: ${state.characters.length} (из ${allTitles.length} частей)`);

    await new Promise(r => setTimeout(r, 650));
    hideFranchiseProgress();
  } catch (err) {
    showStatus(err.message, true);
    hideFranchiseProgress();
    $('#characterCount').textContent = '0';
    $('#emptyCharacters').classList.remove('hidden');
    $('#emptyCharacters').querySelector('p').textContent = `Не удалось загрузить список персонажей: ${err.message}`;
  }

  $('#titleSection').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function renderFranchiseTitles() {
  const box = $('#franchiseTitles');
  if (!box) return;

  box.innerHTML = state.franchiseTitles.map((t, i) => `
    <button type="button" class="franchise-chip ${String(t.id) === String(state.selectedAnime?.id) && t.media_type === state.selectedAnime?.media_type ? 'active' : ''}" data-franchise-index="${i}">
      <span>${t.media_type === 'manga' ? 'MANGA' : t.media_type === 'ranobe' ? 'RANOBE' : 'ANIME'}</span>
      <strong>${esc(t.russian || t.name || 'Без названия')}</strong>
      <small>${esc(t.kind || '')} ${t.aired_on ? `· ${esc(t.aired_on.slice(0, 4))}` : ''} ${t.relation ? `· ${esc(t.relation)}` : ''}</small>
    </button>
  `).join('') || '<p class="empty">Связанные части франшизы не найдены.</p>';

  box.querySelectorAll('[data-franchise-index]').forEach(btn => {
    btn.addEventListener('click', () => {
      const t = state.franchiseTitles[Number(btn.dataset.franchiseIndex)];
      if (t) selectAnime(t);
    });
  });
}

function roleLabel(roles) {
  if (!Array.isArray(roles)) return '';
  return roles.map(r => (typeof r === 'string' ? r : (r.russian || r.name || ''))).filter(Boolean).join(', ');
}

function isMainCharacter(roles) {
  if (!Array.isArray(roles)) return false;
  return roles.some(r => {
    const s = String(typeof r === 'string' ? r : (r.name || r.russian || '')).toLowerCase();
    return s.includes('main') || s.includes('главн');
  });
}

// Role Filters (Все / Главные / Второстепенные)
$$('.role-filter').forEach(btn => {
  btn.addEventListener('click', () => {
    $$('.role-filter').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.activeRoleFilter = btn.dataset.role;
    renderCharacters();
  });
});

$('#characterFilter').addEventListener('input', debounce(renderCharacters, 75));

function updateClanFilters() {
  const wrap = $('#clanFiltersWrap');
  const container = $('#clanFilters');
  if (!wrap || !container) return;

  const clanCounts = new Map();
  state.characters.forEach(c => {
    const names = [c.russian, c.name].filter(Boolean);
    for (const name of names) {
      const parts = name.trim().split(/\s+/);
      if (parts.length >= 2) {
        for (const p of parts) {
          const clean = p.replace(/[^a-zA-Zа-яА-ЯёЁ]/g, '');
          if (clean.length >= 3 && /^[А-ЯA-Z]/.test(clean)) {
            clanCounts.set(clean, (clanCounts.get(clean) || 0) + 1);
          }
        }
      }
    }
  });

  const popularClans = [...clanCounts.entries()]
    .filter(([_, count]) => count >= 2 && count < state.characters.length * 0.75)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12);

  if (popularClans.length === 0) {
    wrap.classList.add('hidden');
    container.innerHTML = '';
    return;
  }

  wrap.classList.remove('hidden');
  container.innerHTML = `
    <button type="button" class="clan-chip ${!state.activeClanFilter ? 'active' : ''}" data-clan="">Все кланы</button>
    ${popularClans.map(([clan, count]) => `
      <button type="button" class="clan-chip ${state.activeClanFilter === clan ? 'active' : ''}" data-clan="${esc(clan)}">${esc(clan)} (${count})</button>
    `).join('')}
  `;

  container.querySelectorAll('.clan-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.clan-chip').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.activeClanFilter = btn.dataset.clan || null;
      renderCharacters();
    });
  });
}

function renderCharacters() {
  const q = $('#characterFilter').value.trim().toLowerCase();
  let list = state.characters.filter(c => `${c.russian || ''} ${c.name || ''}`.toLowerCase().includes(q));

  if (state.activeRoleFilter === 'main') {
    list = list.filter(c => isMainCharacter(c.role));
  } else if (state.activeRoleFilter === 'supporting') {
    list = list.filter(c => !isMainCharacter(c.role));
  }

  if (state.activeClanFilter) {
    const clanLower = state.activeClanFilter.toLowerCase();
    list = list.filter(c => `${c.russian || ''} ${c.name || ''}`.toLowerCase().includes(clanLower));
  }

  $('#characterCount').textContent = `${list.length} / ${state.characters.length}`;
  const box = $('#characters');
  $('#emptyCharacters').classList.toggle('hidden', list.length > 0);

  if (!list.length) {
    box.innerHTML = '';
    return;
  }

  box.innerHTML = list.map(c => {
    const roleStr = roleLabel(c.role);
    const isMain = isMainCharacter(c.role);
    return `
      <article class="character-card" data-char-id="${c.id}">
        <div class="char-img-wrap">
          <img src="${esc(imageUrl(c.image, 'preview') || fallback)}" onerror="this.src='${fallback}'" alt="" loading="lazy" decoding="async">
          <span class="char-role-badge ${isMain ? 'main' : ''}">${isMain ? 'Главный' : 'Роль: ' + (roleStr || 'Персонаж')}</span>
        </div>
        <div class="char-info">
          <h3>${esc(c.russian || c.name || 'Неизвестный персонаж')}</h3>
          <p>${esc(c.name || '')}</p>
          ${c.sourceTitles?.length ? `<small class="char-source-titles" title="${esc(c.sourceTitles.join(' · '))}">${esc([...new Set(c.sourceTitles)].slice(0, 2).join(' · '))}</small>` : ''}
        </div>
      </article>
    `;
  }).join('');
}

// Delegated click handler for characters grid (replaces hundreds of individual event listeners)
$('#characters').addEventListener('click', (e) => {
  const card = e.target.closest('[data-char-id]');
  if (!card) return;
  const id = card.dataset.charId;
  const c = state.characters.find(x => String(x.id) === String(id)) ||
            state.relatedCharacters.find(x => String(x.id) === String(id));
  if (c) openCharacter(c);
});

// Kinship extraction & Family Tree Logic
function plainDescription(value = '') {
  return String(value)
    .replace(/\[spoiler(?:=[^\]]*)?\]([\s\S]*?)\[\/spoiler\]/gi, ' $1 ')
    .replace(/<br\s*\/?\s*>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\[character=(\d+)\]([\s\S]*?)\[\/character\]/gi, ' $2 ')
    .replace(/\[(?:b|i|u|url)[^\]]*\]/gi, ' ')
    .replace(/\[\/(?:b|i|u|url)\]/gi, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ').trim();
}

function detectGender(text = '', name = '') {
  const full = ((text || '') + ' ' + (name || '')).toLowerCase();
  const firstSentence = full.split(/[.!?\n]/)[0] || '';

  const maleDef = /(?:^|[^\p{L}\p{N}])(?:ученик|одноклассник|школьник|парень|юноша|мальчик|мужчина|шиноби|ниндзя|воин|герой|капитан|лейтенант|рыцарь)(?=$|[^\p{L}\p{N}])/iu;
  const femaleDef = /(?:^|[^\p{L}\p{N}])(?:ученица|одноклассница|школьница|девушка|девочка|женщина|куноити|куноичи|героиня|рыцарша)(?=$|[^\p{L}\p{N}])/iu;

  if (femaleDef.test(firstSentence) && !maleDef.test(firstSentence)) return 'female';
  if (maleDef.test(firstSentence) && !femaleDef.test(firstSentence)) return 'male';

  const femaleSubject = /(?:^|[^\p{L}\p{N}])(?:она|девушка|девочка|женщина|ученица|одноклассница|куноити|куноичи|племянница|сестра|дочь|мать|мама|мачеха|усыновила|удочерила|бывшая|была|стала|решила|сумела|родилась|погибла|вышла\s+замуж|выйдет\s+замуж|способна|уверена)(?=$|[^\p{L}\p{N}])/giu;
  const maleSubject = /(?:^|[^\p{L}\p{N}])(?:он|парень|юноша|мальчик|мужчина|ученик|одноклассник|шиноби|племянник|брат|сын|отец|папа|отчим|усыновил|удочерил|бывший|был|стал|решил|сумел|родился|погиб|женился|женат|способен|уверен)(?=$|[^\p{L}\p{N}])/giu;

  const fCount = (full.match(femaleSubject) || []).length;
  const mCount = (full.match(maleSubject) || []).length;

  if (fCount > mCount) return 'female';
  if (mCount > fCount) return 'male';

  // Smart name-based heuristics when biography description is empty or neutral
  const nm = String(name || '').trim();
  if (nm) {
    const femaleNameRe = /(?:хината|сакура|кушина|химавари|темари|цунаде|ино|тентен|каруи|микото|кагуя|сарада|мито|рин|нохара|конан|мэй|куренай|анко|шизуне|карин|таюя|рукия|орихиме|йоруичи|рангику|унохана|нему|масаки|кукаку|юдзу|нами|робин|хэнкок|виви|ребекка|сирахоси|ташиги|коала|пудинг|кэррот|микаса|хистория|саша|ханджи|энни|пик|елена|эмма|аска|рей|мисато|мари|люси|эрза|венди|джувия|леви|мираджейн|чика|аня|йор|фрирен|ферн|hinata|sakura|kushina|himawari|temari|tsunade|ino|tenten|karui|mikoto|kaguya|sarada|mito|rin|konan|mei|kurenai|anko|shizune|karin|tayuya|rukia|orihime|yoruichi|rangiku|unohana|nemu|masaki|kuukaku|yuzu|nami|robin|hancock|vivi|rebecca|carrot|mikasa|historia|sasha|hange|annie|pieck|elena|emma|asuka|rei|misato|mari|lucy|erza|wendy|juvia|yor|anya|frieren|fern)$/iu;
    if (femaleNameRe.test(nm)) return 'female';
    for (const p of nm.split(/\s+/)) {
      if (femaleNameRe.test(p)) return 'female';
    }
  }

  return 'unknown';
}

function relationshipMentions(description, owner, selected, candidates = []) {
  const raw = String(description || '');
  const plain = plainDescription(raw);
  const out = [];

  const add = (id, context, relation, source) => {
    if (id && String(id) !== String(selected.id)) {
      out.push({ id: String(id), type: relation.type, label: relation.label, context: context.trim(), source });
    }
  };

  const relationNearName = (before, after) => {
    const b = String(before || '').toLowerCase();
    const a = String(after || '').toLowerCase();

    // Isolate immediate sentence / clause so unrelated preceding or following sentences do not bleed in
    const bRaw = b.split(/[.!?\n]/).pop() || '';
    const bClause = bRaw.trim();
    const aRaw = a.split(/[.!?\n]/)[0] || '';
    const aClause = aRaw.trim();
    const boundary = '(?=$|[^\\p{L}\\p{N}])';

    // Original case clauses for detecting proper nouns / character names
    const bRawCase = String(before || '').split(/[.!?\n]/).pop()?.trim() || '';
    const aRawCase = String(after || '').split(/[.!?\n]/)[0]?.trim() || '';

    // 0. Check if this kinship term in 'after' links to ANOTHER person / character name:
    // e.g. "Луффи — сын Драгона", "Чочо — дочь Чоджи", "Сарада — дочь Саске"
    // In such cases, the kinship belongs to the pair mentioned in the text, NOT to the owner of this biography!
    const kinshipWords = '(?:сын\\p{L}*|доч\\p{L}*|первенец|реб[её]н\\p{L}*|дет\\p{L}*|отец\\p{L}*|от[ец]\\p{L}*|мать|матер\\p{L}*|мама|папа|родител\\p{L}*|брат\\p{L}*|сестр\\p{L}*|муж\\p{L}*|жен\\p{L}*|супруг\\p{L}*|дедуш\\p{L}*|дед|бабуш\\p{L}*|бабк\\p{L}*|внук\\p{L}*|внуч\\p{L}*|дяд\\p{L}*|т[её]т\\p{L}*|племян\\p{L}*|son|daughter|father|mother|parent|brother|sister|husband|wife|cousin|uncle|aunt|nephew|niece|grandfather|grandmother|grandson|granddaughter)';
    const linksToAnotherPersonAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:—|–|-|,|является|был(?:а)?|считается)?\\s*' + kinshipWords + '\\s+(?:[^\n.;!?]{0,35}?\\s+)?([А-ЯЁA-Z][\\p{L}\\p{N}]+|\\[character=\\d+\\])', 'u').test(aRawCase);
    if (linksToAnotherPersonAfter) {
      return null;
    }

    // 2. Check if this is an appositive or phrase describing another character, e.g. "знакомится с Карин, сестрой Ичиго", "Когда Хиаши, спасая дочь Хинату"
    const kinshipWordsRu = '(?:сын[а-яё]*|доч[а-яё]*|первенец|реб[её]н[а-яё]*|дет[а-яё]*|отец[а-яё]*|от[ец][а-яё]*|мать|матер[а-яё]*|мама[а-яё]*|папа[а-яё]*|родител[а-яё]*|брат[а-яё]*|сестр[а-яё]*|муж[а-яё]*|жен[а-яё]*|супруг[а-яё]*|дедуш[а-яё]*|дед[а-яё]*|бабуш[а-яё]*|бабк[а-яё]*|внук[а-яё]*|внуч[а-яё]*|дяд[а-яё]*|т[её]т[а-яё]*|племян[а-яё]*)';
    const appositiveOrTagBefore = new RegExp('(?:,\\s*|,\\s*[^.;!?\\n]{0,25}?\\s+|\\[character=\\d+\\][^\\]]+\\[\\/character\\][^.;!?\\n]{0,25}?\\s+)' + kinshipWordsRu + '\\s*$', 'iu');
    const isConjunctionBefore = new RegExp('(?:^|[\\s,])(?:и|а\\s+также|также)\\s+(?:(?:старший|старшая|младший|младшая|родной|родная|сводный|сводная|при[её]мный|при[её]мная)?\\s+)*' + kinshipWordsRu + '\\s*$', 'iu');
    if (appositiveOrTagBefore.test(bRawCase) && !isConjunctionBefore.test(bRawCase)) {
      return null;
    }

    const appositiveAnother = /([А-ЯЁA-Z][\p{L}\p{N}]+|\])\s*,\s*(?:(?:младш|старш|родн|сводн|единоутробн|единокровн)\p{L}*\s+)*(?:сестр\p{L}*|брат\p{L}*|сын\p{L}*|доч\p{L}*|отец\p{L}*|отц\p{L}*|мать|матер\p{L}*|жен\p{L}*|муж\p{L}*|дедуш\p{L}*|бабуш\p{L}*)\s*$/u.test(bRawCase) ||
      /,\s*(?:(?:младш|старш|родн|сводн)\p{L}*\s+)*(?:сестр\p{L}*|брат\p{L}*|сыном|дочер\p{L}*|отцом|матер\p{L}*|матерью|жен\p{L}*|мужем)\s*$/iu.test(bClause);
    if (appositiveAnother) {
      return null;
    }

    // 2b. Check if the subject before the kinship is another named person (e.g. "Луффи — сын [Драгона]", "Боруто — сын [Наруто]")
    // In such clauses, the subject (e.g. Луффи) is the child/relative of candidate, NOT the biography owner!
    const subjectCopulaBefore = /(?:[А-ЯЁA-Z][\p{L}\p{N}]+|\])\s*(?:—|–|-|,|является|был(?:а)?|считается|приходится|is|was)\s*(?:сын\p{L}*|доч\p{L}*|первенец|реб[её]н\p{L}*|дет\p{L}*|отец\p{L}*|от[ец]\p{L}*|мать|матер\p{L}*|брат\p{L}*|сестр\p{L}*|муж\p{L}*|жен\p{L}*|дедуш\p{L}*|бабуш\p{L}*|son|daughter|child|father|mother|brother|sister|husband|wife)\s*$/iu.test(bRawCase);
    if (subjectCopulaBefore) {
      return null;
    }

    // 2c. Non-kinship attribution clauses (authors, books, quotes, inspirations, e.g. "романа Джирайи", "книги Какаши")
    const authorOrNamedAfter = /(?:романа|книги|автора|повести|рассказа|статьи|слов|словам|мнению|честь)\s*$/iu.test(bClause);
    if (authorOrNamedAfter) {
      return null;
    }

    // 3. Partner / Spouse
    // Target is Wife (Жена)
    const wifeBefore = /(?:^|[\s,;:—–-])(?:жена|супруга|бывшая\s+жена|невеста|возлюбленная|партн[её]рша|wife(?:\s+of)?|fianc[eé]e(?:\s+of)?)\s*[,—–:：-]*$/iu.test(bClause);
    const marriedWithBefore = /(?:женат(?:ся)?\s+на|женился\s+на|женится\s+на)\s*[,—–:：-]*$/iu.test(bClause);
    const wifeAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:е[её]|его)?\\s*(?:жена|супруга|невеста|wife)' + boundary, 'iu').test(aClause);
    const possessiveWife = new RegExp('(?:^|\\s)(?:\'s|’s)\\s*(?:wife|fianc[eé]e)' + boundary, 'iu').test(aClause);
    const withWifeBefore = /(?:вместе\s+с\s+женой|вместе\s+с\s+супругой|его\s+жена)\s*[,—–:：-]*$/iu.test(bClause);

    if (wifeBefore || marriedWithBefore || wifeAfter || possessiveWife || withWifeBefore) {
      return { type: 'partner', label: 'Жена' };
    }

    // Target is Husband (Муж)
    const husbandBefore = /(?:^|[\s,;:—–-])(?:муж|супруг|бывший\s+муж|жених|возлюбленный|партн[её]р|husband(?:\s+of)?|fianc[eé](?:\s+of)?)\s*[,—–:：-]*$/iu.test(bClause);
    const marriedToBefore = /(?:замужем\s+за|вышла\s+замуж\s+за|выйдет\s+замуж\s+за)\s*[,—–:：-]*$/iu.test(bClause);
    const husbandAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:е[её]|его)?\\s*(?:муж|супруг|жених|husband)' + boundary, 'iu').test(aClause);
    const possessiveHusband = new RegExp('(?:^|\\s)(?:\'s|’s)\\s*(?:husband|fianc[eé])' + boundary, 'iu').test(aClause);
    const withHusbandBefore = /(?:вместе\s+с\s+мужем|вместе\s+с\s+супругом|е[её]\s+муж)\s*[,—–:：-]*$/iu.test(bClause);

    if (husbandBefore || marriedToBefore || husbandAfter || possessiveHusband || withHusbandBefore) {
      return { type: 'partner', label: 'Муж' };
    }

    // General partner
    const partnerGeneralBefore = /(?:^|[\s,;:—–-])(?:в\s+браке\s+с|брак\s+с|состоит\s+в\s+браке\s+с|обруч[её]н(?:а)?\s+с|помолвлен(?:а)?\s+с|married\s+to|spouse(?:\s+of)?|partner(?:\s+of)?)\s*[,—–:：-]*$/iu.test(bClause);
    const partnerHeaderBefore = /(?:^|[\s,;:—–-])(?:супруги|пара)\s*[:—–-]\s*$/iu.test(bClause);
    const partnerGeneralAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:партн[её]р(?:ша)?|возлюбленн(?:ый|ая)|spouse|partner)' + boundary, 'iu').test(aClause);
    const possessivePartner = new RegExp('(?:^|\\s)(?:\'s|’s)\\s*(?:spouse|partner)' + boundary, 'iu').test(aClause);

    if (partnerGeneralBefore || partnerHeaderBefore || partnerGeneralAfter || possessivePartner) {
      return { type: 'partner', label: 'Супруг(а)' };
    }

    // 4. Cousins (MUST be checked before direct siblings!)
    const cousinBefore = /(?:^|[\s,;:—–-])(?:двоюродн\p{L}*(?:\s+(?:брат\p{L}*|сестр\p{L}*))?|троюродн\p{L}*(?:\s+(?:брат\p{L}*|сестр\p{L}*))?|кузен\p{L}*|кузин\p{L}*|cousin)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    const cousinListBefore = /(?:^|[\s,;:—–-])(?:двоюродн\p{L}+(?:\s+(?:брат\p{L}*|сестр\p{L}*))?|троюродн\p{L}+|кузен\p{L}*|кузин\p{L}*)\s+[^.;!?\n]+?(?:,\s*|\s+и\s*|\s+and\s*)$/iu.test(bClause);
    const cousinAfter = new RegExp(/^[—–,:;()[\]\s]*(?:двоюродн\p{L}+(?:\s+(?:брат\p{L}*|сестр\p{L}*))?|троюродн\p{L}+|кузен\p{L}*|кузин\p{L}*|cousin)/u.source + boundary, 'iu').test(aClause);
    if (cousinBefore || cousinListBefore || cousinAfter) {
      const isFem = /(?:сестр|кузин)/iu.test(bClause + ' ' + aClause);
      return { type: 'cousin', label: isFem ? 'Двоюродная сестра' : 'Двоюродный брат' };
    }

    // 5. Direct Siblings (ONLY родные / сводные, NOT двоюродные)
    const siblingBefore = /(?:^|[\s,;:—–-])(?:(?:старш\p{L}*|младш\p{L}*|родн\p{L}*|сводн\p{L}*|при[её]мн\p{L}*|двумя|тремя|двух|трех|трёх)?\s+)*(?:братья|братьев|братьями|братом|брата|брат|брат-близнец|с[её]стры|сест[её]р|с[её]страми|сестрой|сестре|сестры|сестра|сестра-близнец|близнец\p{L}*|двойняшк\p{L}*|brother\p{L}*|sister\p{L}*|sibling\p{L}*)\s*[:—–-]*$/iu.test(bClause);
    const siblingHeaderBefore = /(?:^|[\s,;:—–-])(?:братья|с[её]стры|братья\s+и\s+с[её]стры)\s*[:—–-]\s*$/iu.test(bClause);
    const siblingListBefore = /(?:^|[\s,;:—–-])(?:брат|сестра|brother|sister|sibling)\s+[^.;!?\n]+?(?:,\s*|\s+и\s*|\s+and\s*)$/iu.test(bClause);
    const siblingEnBefore = /(?:^|[\s,;:—–-])(?:(?:older|younger|elder|little|twin|half|step|foster|adoptive)?\s+)*(?:brother|sister|sibling|siblings)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    const siblingAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:е[её]|его)?\\s*(?:(?:старш\\p{L}*|младш\\p{L}*|родн\\p{L}*|сводн\\p{L}*|при[её]мн\\p{L}*)?\\s+)*(?:брат|сестра|близнец|двойняшка)' + boundary, 'iu').test(aClause);
    const siblingEnAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:(?:older|younger|elder|little|twin|half|step|foster|adoptive)?\\s+)*(?:brother|sister|sibling)' + boundary, 'iu').test(aClause);
    const possessiveSibling = new RegExp('(?:^|\\s)(?:\'s|’s)\\s*(?:(?:older|younger|elder|little|twin|half|step|foster|adoptive)?\\s+)*(?:brother|sister|sibling)' + boundary, 'iu').test(aClause);

    if (siblingBefore || siblingHeaderBefore || siblingListBefore || siblingEnBefore || siblingAfter || siblingEnAfter || possessiveSibling) {
      const combined = bClause + ' ' + aClause;
      const isAdopt = /(?:при[её]мн|foster|adoptive)/iu.test(combined);
      let lbl = isAdopt ? 'Приёмный брат / сестра' : 'Брат / сестра';
      if (/(?:сестра|сестры|сестрой|сестрами|сёстрами|sister)/iu.test(combined)) lbl = isAdopt ? 'Приёмная сестра' : 'Сестра';
      else if (/(?:брат|брата|братом|братьями|brother)/iu.test(combined)) lbl = isAdopt ? 'Приёмный брат' : 'Брат';
      return { type: 'sibling', label: lbl, adoptive: isAdopt };
    }

    // 6. Target is PARENT of owner:
    // e.g. "Дочь Чоджи Акимичи", "Первенец Наруто Узумаки", "Сын Минато", "вместе со своим отцом Иссином", "Его мать Масаки", "Отец: Минато"
    const ownChildBefore = /(?:^|[\s,;:—–-])(?:к\s+|для\s+|у\s+|со\s+|с\s+)?(?:своего|своей|своих)\s+(?:(?:старш\p{L}*|младш\p{L}*|родн\p{L}*|при[её]мн\p{L}*)\s+)*(?:сына|сыновей|дочери|дочерей|детей|реб[её]нка)\s*$/iu.test(bClause);
    const childBefore = /(?:^|[\s,;:—–-])(?:(?:при[её]мн\p{L}*|foster|adoptive)\s+)?(?:сын|сыновья|дочь|дочери|первенец|реб[её]нок|дети)(?:\s+(?:ниндзя|шиноби|of))?\s*$/iu.test(bClause);
    const wasAdoptedBefore = /(?:был(?:а)?|были)?\s*(?:усыновл[её]н\p{L}*|удочер[её]н\p{L}*|взят\p{L}*\s+на\s+воспитание|adopted\s+by)\s*$/iu.test(bClause);
    const childEnBefore = /(?:^|[\s,;:—–-])(?:(?:foster|adoptive)\s+)?(?:son|daughter|firstborn|child|children)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    const multipleParentBefore = /(?:^|[\s,;:—–-])(?:сын|сыновья|дочь|дочери|первенец|реб[её]нок|дети|son|daughter|child)\s+[^.;!?\n]+?(?:,\s*|\s+и\s*|\s+and\s*)$/iu.test(bClause);
    const parentOfOwnerBefore = /(?:похож(?:а)?\s+на|в\s+честь)?\s*(?:своего\s+отца|свой\s+отец|свой\s+папа|своей\s+матери|своих\s+родителей)\s*$/iu.test(bClause);
    const parentsHeaderBefore = /(?:^|[\s,;:—–-])(?:родители|родителей|отец|мать|папа|мама|отчим|мачеха|parents|father|mother)\s*[:—–-]\s*$/iu.test(bClause);
    const parentBeforeExplicit = /(?:^|[\s,;:—–-])(?:(?:со\s+|с\s+)?(?:своим|своей|своих|его|е[её]|их)?\s*(?:отцом|матерью|родителями)|(?:своего|своей|своих|его|е[её]|их)\s+(?:отца|матери|родителей)|(?:его|е[её]|их|свой|своя)\s+(?:отец|мать|папа|мама|родители))\s*[,—–:：-]*$/iu.test(bClause);
    const parentAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:—\\s*)?(?:(?:при[её]мн\\p{L}*|foster|adoptive)\\s+)?(?:мать|мама|отец|папа|родитель|mother|father|parent|мачеха|отчим)' + boundary, 'iu').test(aClause);
    const possessiveChild = new RegExp('(?:^|\\s)(?:\'s|’s)\\s*(?:son|daughter|child)' + boundary, 'iu').test(aClause);

    if (!ownChildBefore && (parentsHeaderBefore || parentBeforeExplicit || childBefore || wasAdoptedBefore || childEnBefore || multipleParentBefore || parentOfOwnerBefore || parentAfter || possessiveChild)) {
      const combined = bClause + ' ' + aClause;
      const isAdopt = /(?:при[её]мн|усынов|удочер|мачех|отчим|foster|adoptive|adopted)/iu.test(combined);
      let lbl = isAdopt ? 'Приёмный родитель' : 'Родитель';
      if (/(?:мать|мама|матери|матерью|mother|мачех)/iu.test(combined)) lbl = isAdopt ? 'Приёмная мать' : 'Мать';
      else if (/(?:отец|папа|отца|отцом|father|отчим)/iu.test(combined)) lbl = isAdopt ? 'Приёмный отец' : 'Отец';
      return { type: 'parent', label: lbl, adoptive: isAdopt };
    }

    // 7. Target is CHILD of owner:
    // e.g. "Мать Сакуры", "Кушина была матерью Наруто", "родилась дочь — Чочо", "дети: Боруто", "приёмная мать Нами", "усыновил Широ", "Лидер клана, а также отец Чоджи", "к своей дочери Хинате"
    const parentBeforeAtStart = /^(?:[^\n.;!?]*?\.\s*)?(?:(?:при[её]мн\p{L}*|foster|adoptive)\s+)?(?:мать|мама|отец|папа|родитель|mother|father)\s*(?:of\s+)?$/iu.test(bClause);
    const birthOrHasChild = new RegExp('(?:родил(?:ся|ась|ись|а|и)?|родит(?:ся)?|рожд[её]н(?:ная|ный|ные)?|име(?:ет|ют)?|воспитыва(?:ет|ют)?|усыновил(?:а|и)?|удочерил(?:а|и)?|взял(?:а|и)?\\s+на\\s+воспитание|есть)\\s+[^.;!?\\n]*?(?:дочь|сын|дети|реб[её]нок|сирот\\p{L}*)' + boundary, 'iu').test(bClause);
    const adoptedVerbBefore = /(?:усыновил(?:а|и)?|удочерил(?:а|и)?|взял(?:а|и)?\s+на\s+воспитание|adopted)\s*$/iu.test(bClause);
    const childWithPunctuation = /(?:^|[\s,;:—–-])(?:(?:при[её]мн\p{L}*\s+)?(?:сын|сыновья|дочь|дочери|реб[её]нок|дети))\s*[:—–-]\s*$/iu.test(bClause);
    const childrenHeaderBefore = /(?:^|[\s,;:—–-])(?:дети|реб[её]нок)\s*[:—–-]\s*$/iu.test(bClause);
    const childBeforeExplicit = /(?:^|[\s,;:—–-])(?:его\s+сын|е[её]\s+сын|их\s+сын|его\s+дочь|е[её]\s+дочь|их\s+дочь|его\s+дети|е[её]\s+дети|их\s+дети)\s*[,—–:：-]*$/iu.test(bClause);
    const multipleChildBefore = /(?:^|[\s,;:—–-])(?:дети|children)\s+[^.;!?\n]+?(?:,\s*|\s+и\s*|\s+and\s*)$/iu.test(bClause);
    const childAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:(?:при[её]мн\\p{L}*|foster|adoptive)\\s+)?(?:сын|дочь|дочери|сыновья|реб[её]нок|дети|son|daughter|child|children)' + boundary, 'iu').test(aClause);
    const possessiveParent = new RegExp('(?:^|\\s)(?:\'s|’s)\\s*(?:mother|father|parent)' + boundary, 'iu').test(aClause);

    if (ownChildBefore || childWithPunctuation || childrenHeaderBefore || childBeforeExplicit || parentBeforeAtStart || birthOrHasChild || adoptedVerbBefore || multipleChildBefore || childAfter || possessiveParent) {
      const combined = bClause + ' ' + aClause;
      const isAdopt = /(?:при[её]мн|усынов|удочер|foster|adoptive|adopted)/iu.test(combined);
      let lbl = isAdopt ? 'Приёмный ребёнок' : 'Сын / дочь';
      if (/(?:дочь|дочери|daughter|удочер)/iu.test(combined)) lbl = isAdopt ? 'Приёмная дочь' : 'Дочь';
      else if (/(?:сын|сыновья|son|первенец|усынов)/iu.test(combined)) lbl = isAdopt ? 'Приёмный сын' : 'Сын';
      return { type: 'child', label: lbl, adoptive: isAdopt };
    }

    // 8. Extended: Uncle / Aunt / Nephew / Niece / Grandparent / Grandchild
    const nephewBefore = /(?:^|[\s,;:—–-])(?:племянник|племянница)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    if (nephewBefore) {
      return { type: 'nephew_niece', label: /племянниц/iu.test(bClause) ? 'Племянница' : 'Племянник' };
    }
    const uncleBefore = /(?:^|[\s,;:—–-])(?:дядя|т[её]тя)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    if (uncleBefore) {
      return { type: 'uncle_aunt', label: /т[её]т/iu.test(bClause) ? 'Тётя' : 'Дядя' };
    }

    const grandParentBefore = /(?:^|[\s,;:—–-])(?:дедушка|дед|бабушка|бабка|grandfather|grandmother)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    const grandChildAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:внук|внучка|внуки|grandson|granddaughter|grandchild)' + boundary, 'iu').test(aClause);
    if (grandParentBefore || grandChildAfter) {
      return { type: 'grandchild', label: /внучк/iu.test(aClause) ? 'Внучка' : 'Внук' };
    }

    const grandChildBefore = /(?:^|[\s,;:—–-])(?:внук|внучка|grandson|granddaughter)\s*(?:of\s*)?[,—–:：-]*$/iu.test(bClause);
    const grandParentAfter = new RegExp('^[—–,:;()\\[\\]\\s]*(?:дедушка|дед|бабушка|бабка|grandfather|grandmother|grandparent)' + boundary, 'iu').test(aClause);
    if (grandChildBefore || grandParentAfter) {
      return { type: 'grandparent', label: /бабушк|бабк|grandmother/iu.test(aClause) ? 'Бабушка' : 'Дедушка' };
    }

    return null;
  };

  const isOwnerSelected = String(owner.id) === String(selected.id);
  const selId = String(selected.id);
  if (!isOwnerSelected) {
    const selTokens = [selected.russian, selected.name].filter(Boolean)
      .flatMap(n => plainDescription(n).toLowerCase().split(/\s+/)).filter(t => t.length >= 4);
    const rawLower = raw.toLowerCase();
    const hasTag = raw.includes('[character=' + selId + ']') || raw.includes('[character=');
    const hasToken = selTokens.some(t => rawLower.includes(t));
    if (!hasTag && !hasToken) return [];
  }

  const addMatched = (candidateId, context, relation, source) => {
    if (!relation) return;
    if (String(owner.id) === String(selected.id)) {
      add(candidateId, context, relation, source);
    } else if (String(candidateId) === String(selected.id)) {
      let inverseType = relation.type;
      let inverseLabel = relation.label;
      const ownerGender = detectGender(owner.description, owner.russian);
      const isAdopt = relation.adoptive || /при[её]мн|усынов|удочер|adopt|foster/iu.test(relation.label);
      if (relation.type === 'parent') {
        inverseType = 'child';
        if (isAdopt) {
          if (/(?:дочь|дочери|удочер|daughter)/iu.test(context)) {
            inverseLabel = 'Приёмная дочь';
          } else if (/(?:сын|сыновья|усынов|son)/iu.test(context)) {
            inverseLabel = 'Приёмный сын';
          } else {
            inverseLabel = ownerGender === 'female' ? 'Приёмная дочь' : ownerGender === 'male' ? 'Приёмный сын' : 'Приёмный ребёнок';
          }
        } else {
          if (/(?:дочь|дочери|daughter)/iu.test(context)) {
            inverseLabel = 'Дочь';
          } else if (/(?:сын|сыновья|son)/iu.test(context)) {
            inverseLabel = 'Сын';
          } else {
            inverseLabel = ownerGender === 'female' ? 'Дочь' : ownerGender === 'male' ? 'Сын' : 'Сын / дочь';
          }
        }
      } else if (relation.type === 'child') {
        inverseType = 'parent';
        if (isAdopt) {
          if (/(?:мать|мама|мачех|mother)/iu.test(context)) {
            inverseLabel = 'Приёмная мать';
          } else if (/(?:отец|папа|отчим|father)/iu.test(context)) {
            inverseLabel = 'Приёмный отец';
          } else {
            inverseLabel = ownerGender === 'female' ? 'Приёмная мать' : ownerGender === 'male' ? 'Приёмный отец' : 'Приёмный родитель';
          }
        } else {
          if (/(?:мать|мама|mother)/iu.test(context)) {
            inverseLabel = 'Мать';
          } else if (/(?:отец|папа|father)/iu.test(context)) {
            inverseLabel = 'Отец';
          } else {
            inverseLabel = ownerGender === 'female' ? 'Мать' : ownerGender === 'male' ? 'Отец' : 'Родитель';
          }
        }
      } else if (relation.type === 'partner') {
        inverseType = 'partner';
        inverseLabel = ownerGender === 'female' ? 'Жена' : ownerGender === 'male' ? 'Муж' : 'Супруг(а)';
      } else if (relation.type === 'sibling') {
        inverseType = 'sibling';
        if (isAdopt) {
          inverseLabel = ownerGender === 'female' ? 'Приёмная сестра' : ownerGender === 'male' ? 'Приёмный брат' : 'Приёмный брат / сестра';
        } else {
          inverseLabel = ownerGender === 'female' ? 'Сестра' : ownerGender === 'male' ? 'Брат' : 'Брат / сестра';
        }
      } else if (relation.type === 'uncle_aunt') {
        inverseType = 'nephew_niece';
        inverseLabel = ownerGender === 'female' ? 'Племянница' : 'Племянник';
      } else if (relation.type === 'nephew_niece') {
        inverseType = 'uncle_aunt';
        inverseLabel = ownerGender === 'female' ? 'Тётя' : 'Дядя';
      } else if (relation.type === 'grandparent') {
        inverseType = 'grandchild';
        inverseLabel = ownerGender === 'female' ? 'Внучка' : 'Внук';
      } else if (relation.type === 'grandchild') {
        inverseType = 'grandparent';
        inverseLabel = ownerGender === 'female' ? 'Бабушка' : 'Дедушка';
      } else if (relation.type === 'cousin') {
        inverseType = 'cousin';
        inverseLabel = ownerGender === 'female' ? 'Двоюродная сестра' : 'Двоюродный брат';
      } else if (relation.type === 'other') {
        if (/двоюродн\p{L}*\s+сестр|кузин/iu.test(relation.label)) {
          inverseType = 'cousin';
          inverseLabel = ownerGender === 'female' ? 'Двоюродная сестра' : 'Двоюродный брат';
        } else if (/двоюродн\p{L}*\s+брат|кузен/iu.test(relation.label)) {
          inverseType = 'cousin';
          inverseLabel = ownerGender === 'female' ? 'Двоюродная сестра' : 'Двоюродный брат';
        } else if (/племянниц/iu.test(relation.label)) {
          inverseType = 'uncle_aunt';
          inverseLabel = ownerGender === 'female' ? 'Тётя' : 'Дядя';
        } else if (/племянник/iu.test(relation.label)) {
          inverseType = 'uncle_aunt';
          inverseLabel = ownerGender === 'female' ? 'Тётя' : 'Дядя';
        } else if (/дедуш|дед|бабуш|баб/iu.test(relation.label)) {
          inverseType = 'grandchild';
          inverseLabel = ownerGender === 'female' ? 'Внучка' : 'Внук';
        } else if (/внук|внуч/iu.test(relation.label)) {
          inverseType = 'grandparent';
          inverseLabel = ownerGender === 'female' ? 'Бабушка' : 'Дедушка';
        } else {
          inverseLabel = relation.label || 'Родственник';
        }
      }
      add(owner.id, context, { type: inverseType, label: inverseLabel }, `reverse-${source}`);
    }
  };

  const linked = /\[character=(\d+)\]([\s\S]*?)\[\/character\]/gi;
  let m;
  const matchedLinks = [];
  let lastRel = null;
  let lastIndex = -1;
  while ((m = linked.exec(raw))) {
    if (!isOwnerSelected && String(m[1]) !== selId) continue;
    const before = plainDescription(raw.slice(Math.max(0, m.index - 90), m.index)).slice(-90);
    const after = plainDescription(raw.slice(linked.lastIndex, Math.min(raw.length, linked.lastIndex + 90))).slice(0, 90);
    const context = plainDescription(raw.slice(Math.max(0, m.index - 90), Math.min(raw.length, linked.lastIndex + 90)));
    let rel = relationNearName(before, after);

    // List propagation: if consecutive linked characters within the same clause are joined by conjunctions
    // (e.g. "сёстрами: Карин и Юдзу", "двоюродным братом Кукаку, Гандзю и Кайэна", "родителями Минато и Кушиной")
    if (!rel && lastRel && lastIndex !== -1) {
      const textBetween = raw.slice(lastIndex, m.index);
      if (!/[.!?\n]/.test(textBetween) && /^[\s,;:—–\-иa&а\s+также]+$/iu.test(textBetween.trim())) {
        rel = { ...lastRel };
      }
    }

    if (rel) {
      lastRel = rel;
      lastIndex = linked.lastIndex;
      matchedLinks.push({ id: String(m[1]), context, rel });
      addMatched(m[1], context, rel, 'description-link');
    } else {
      lastRel = null;
      lastIndex = -1;
    }
  }

  // Third-party pair extraction:
  // Detects statements connecting two characters in any description, e.g.:
  // "[character=40]Луффи[/character] — сын [character=4884]Драгона[/character]"
  // Requires explicit copula (—, –, -, является, был, считается, приходится) to avoid false matches like "По словам [X], мать [Y]"
  const pairRegex = /\[character=(\d+)\]([^\[]+?)\[\/character\]\s*(?:—|–|-|является|был(?:а)?|считается|приходится)\s*(?:(?:старший|старшая|младший|младшая|родной|родная|сводный|сводная|при[её]мный|при[её]мная|названый|названный|названая|названная|foster|adoptive)\s+)?(сын|сыновья|дочь|дочери|первенец|реб[её]нок|дети|отец|мать|мама|папа|родитель|брат|сестра|муж|жена|супруг|супруга|дедушка|бабушка|внук|внучка|дядя|т[её]тя|племянник|племянница)\s+(?:\[character=(\d+)\]([^\[]+?)\[\/character\])/giu;
  let pm;
  while ((pm = pairRegex.exec(raw))) {
    const id1 = String(pm[1]);
    const relWord = pm[3].toLowerCase();
    const id2 = String(pm[4]);

    if (id1 !== String(selected.id) && id2 !== String(selected.id)) {
      continue;
    }

    let pType = null;
    let pLabel = null;
    let targetId = null;
    const isAdopt = /(?:при[её]мн|foster|adoptive)/iu.test(pm[0]);

    if (/^(?:сын|сыновья|дочь|дочери|первенец|реб[её]нок|дети)$/iu.test(relWord)) {
      if (id1 === String(selected.id)) {
        targetId = id2;
        pType = 'parent';
        const cand = (candidates || []).find(c => String(c.id) === String(targetId)) || {};
        const g = detectGender(cand.description || '', cand.russian || '');
        if (isAdopt) {
          pLabel = g === 'female' ? 'Приёмная мать' : g === 'male' ? 'Приёмный отец' : 'Приёмный родитель';
        } else {
          pLabel = g === 'female' ? 'Мать' : g === 'male' ? 'Отец' : 'Родитель';
        }
      } else {
        targetId = id1;
        pType = 'child';
        if (isAdopt) {
          pLabel = /^(?:дочь|дочери)$/iu.test(relWord) ? 'Приёмная дочь' : 'Приёмный сын';
        } else {
          pLabel = /^(?:дочь|дочери)$/iu.test(relWord) ? 'Дочь' : 'Сын';
        }
      }
    } else if (/^(?:отец|папа|мать|мама|родитель)$/iu.test(relWord)) {
      if (id1 === String(selected.id)) {
        targetId = id2;
        pType = 'child';
        const cand = (candidates || []).find(c => String(c.id) === String(targetId)) || {};
        const g = detectGender(cand.description || '', cand.russian || '');
        if (isAdopt) {
          pLabel = g === 'female' ? 'Приёмная дочь' : g === 'male' ? 'Приёмный сын' : 'Приёмный ребёнок';
        } else {
          pLabel = g === 'female' ? 'Дочь' : g === 'male' ? 'Сын' : 'Сын / дочь';
        }
      } else {
        targetId = id1;
        pType = 'parent';
        if (isAdopt) {
          pLabel = /^(?:мать|мама)$/iu.test(relWord) ? 'Приёмная мать' : 'Приёмный отец';
        } else {
          pLabel = /^(?:мать|мама)$/iu.test(relWord) ? 'Мать' : 'Отец';
        }
      }
    } else if (/^(?:муж|жена|супруг|супруга)$/iu.test(relWord)) {
      targetId = id1 === String(selected.id) ? id2 : id1;
      pType = 'partner';
      if (targetId === id1) {
        pLabel = /^(?:жена|супруга)$/iu.test(relWord) ? 'Жена' : 'Муж';
      } else {
        const cand = (candidates || []).find(c => String(c.id) === String(targetId)) || {};
        const g = detectGender(cand.description || '', cand.russian || '');
        pLabel = g === 'female' ? 'Жена' : g === 'male' ? 'Муж' : 'Супруг(а)';
      }
    } else if (/^(?:брат|сестра)$/iu.test(relWord)) {
      targetId = id1 === String(selected.id) ? id2 : id1;
      pType = 'sibling';
      if (targetId === id1) {
        if (isAdopt) {
          pLabel = relWord === 'сестра' ? 'Приёмная сестра' : 'Приёмный брат';
        } else {
          pLabel = relWord === 'сестра' ? 'Сестра' : 'Брат';
        }
      } else {
        const cand = (candidates || []).find(c => String(c.id) === String(targetId)) || {};
        const g = detectGender(cand.description || '', cand.russian || '');
        if (isAdopt) {
          pLabel = g === 'female' ? 'Приёмная сестра' : g === 'male' ? 'Приёмный брат' : 'Приёмный брат / сестра';
        } else {
          pLabel = g === 'female' ? 'Сестра' : g === 'male' ? 'Брат' : 'Брат / сестра';
        }
      }
    } else if (/^(?:дедушка|бабушка)$/iu.test(relWord)) {
      if (id1 === String(selected.id)) {
        targetId = id2;
        pType = 'grandchild';
        pLabel = 'Внук / внучка';
      } else {
        targetId = id1;
        pType = 'grandparent';
        pLabel = relWord === 'бабушка' ? 'Бабушка' : 'Дедушка';
      }
    } else if (/^(?:внук|внучка)$/iu.test(relWord)) {
      if (id1 === String(selected.id)) {
        targetId = id2;
        pType = 'grandparent';
        pLabel = 'Дедушка / бабушка';
      } else {
        targetId = id1;
        pType = 'grandchild';
        pLabel = relWord === 'внучка' ? 'Внучка' : 'Внук';
      }
    } else if (/^(?:дядя|т[её]тя)$/iu.test(relWord)) {
      if (id1 === String(selected.id)) {
        targetId = id2;
        pType = 'nephew_niece';
        pLabel = 'Племянник / племянница';
      } else {
        targetId = id1;
        pType = 'uncle_aunt';
        pLabel = /т[её]тя/iu.test(relWord) ? 'Тётя' : 'Дядя';
      }
    } else if (/^(?:племянник|племянница)$/iu.test(relWord)) {
      if (id1 === String(selected.id)) {
        targetId = id2;
        pType = 'uncle_aunt';
        pLabel = 'Дядя / тётя';
      } else {
        targetId = id1;
        pType = 'nephew_niece';
        pLabel = relWord === 'племянница' ? 'Племянница' : 'Племянник';
      }
    }

    if (targetId && pType) {
      add(targetId, pm[0], { type: pType, label: pLabel }, 'description-pair');
    }
  }

  // Co-parent detection:
  // If a child's description lists multiple parents (e.g. "Дочь [Chouji] и [Karui]"):
  // If one of the parents is the selected character, the other parent is the spouse/partner of selected!
  const parentLinks = matchedLinks.filter(x => x.rel && x.rel.type === 'parent');
  if (parentLinks.length >= 2) {
    const isSelectedOneOfParents = parentLinks.some(x => String(x.id) === String(selected.id));
    if (isSelectedOneOfParents) {
      for (const otherParent of parentLinks) {
        if (String(otherParent.id) !== String(selected.id)) {
          const oChar = (candidates || []).find(p => String(p.id) === String(otherParent.id)) || {};
          const oGender = detectGender(oChar.description || otherParent.context, oChar.russian || '');
          const pLabel = oGender === 'female' ? 'Жена' : oGender === 'male' ? 'Муж' : 'Супруг(а)';
          add(otherParent.id, otherParent.context, { type: 'partner', label: pLabel }, 'co-parent');
        }
      }
    }
  }

  const candidatePool = isOwnerSelected ? (candidates || []) : [selected];
  const plainLower = plain.toLowerCase();
  const aliases = new Map();
  for (const candidate of candidatePool) {
    if (!candidate?.id || String(candidate.id) === String(owner.id)) continue;
    const names = [candidate.russian, candidate.name].filter(Boolean);
    for (const name of names) {
      const normalized = plainDescription(name);
      if (normalized.length < 4) continue;
      const key = normalized.toLocaleLowerCase();
      if (!aliases.has(key)) aliases.set(key, { candidate, name: normalized, ids: new Set() });
      aliases.get(key).ids.add(String(candidate.id));

      // Also index single unique tokens (e.g. "Кизаши", "Сакура", "Хината", "Минато")
      const tokens = normalized.split(/\s+/).filter(t => t.length >= 4);
      for (const token of tokens) {
        const tKey = token.toLocaleLowerCase();
        if (!aliases.has(tKey)) aliases.set(tKey, { candidate, name: token, ids: new Set() });
        aliases.get(tKey).ids.add(String(candidate.id));
      }
    }
  }

  const seen = new Set();
  for (const entry of aliases.values()) {
    if (entry.ids.size !== 1) continue;
    const stem = entry.name.toLowerCase().slice(0, Math.min(entry.name.length, 4));
    if (!plainLower.includes(stem)) continue;

    let escaped = entry.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (/[ая]$/iu.test(entry.name)) {
      escaped = escaped.slice(0, -1) + '[аяыеиуеёой]?';
    }
    const re = new RegExp('(^|[^\\p{L}\\p{N}])(' + escaped + ')(?=$|[^\\p{L}\\p{N}])', 'giu');
    let hit;
    while ((hit = re.exec(plain))) {
      const begin = hit.index + hit[1].length;
      const finish = begin + hit[2].length;
      const before = plain.slice(Math.max(0, begin - 85), begin);
      const after = plain.slice(finish, Math.min(plain.length, finish + 85));
      const relation = relationNearName(before, after);
      if (!relation) continue;
      const id = String(entry.candidate.id);
      const key = `${id}:${relation.type}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const context = plain.slice(Math.max(0, begin - 90), Math.min(plain.length, finish + 90));
      addMatched(id, context, relation, 'description-name-match');
    }
  }

  const unique = new Map();
  for (const item of out) {
    const key = `${item.id}:${item.type}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

function classifyRelationEvidence(evidence) {
  const ctx = (evidence.context || '').toLowerCase();
  const lbl = (evidence.label || '').toLowerCase();
  if (evidence.type === 'grandparent' || /(дедушк|дед|бабушк|бабк|grandmother|grandfather)/i.test(lbl)) return 'grandparent';
  if (evidence.type === 'grandchild' || /(внук|внучк|grandson|granddaughter)/i.test(lbl)) return 'grandchild';
  if (evidence.type === 'uncle_aunt' || /(дяд|т[её]т|uncle|aunt)/i.test(lbl)) return 'uncle_aunt';
  if (evidence.type === 'nephew_niece' || /(племянник|племянниц|nephew|niece)/i.test(lbl)) return 'nephew_niece';
  if (evidence.type === 'cousin' || /(двоюродн|кузен|кузин|cousin)/i.test(lbl)) return 'cousin';
  if (evidence.type === 'parent_in_law' || /(тесть|т[её]ща|св[её]кор|свекров)/i.test(lbl)) return 'parent_in_law';
  if (evidence.type === 'sibling_in_law' || /(шурин|своячениц|девер|золовк)/i.test(lbl)) return 'sibling_in_law';
  if (evidence.type === 'child_in_law' || /(зять|невестк|сноха)/i.test(lbl)) return 'child_in_law';
  if (evidence.type === 'parent') return 'parent';
  if (evidence.type === 'sibling') return 'sibling';
  if (evidence.type === 'partner') return 'partner';
  if (evidence.type === 'child') return 'child';
  if (evidence.type === 'other') return 'other';

  const parentWord = /(отец|папа|father|dad|мать|мама|mother|mom|родител|parent)/i.test(ctx);
  const childWord = /(сын|дочь|дочери|сыновья|ребёнок|ребенок|дети|son|daughter|child|children)/i.test(ctx);
  return parentWord || childWord ? 'parent' : 'other';
}

function normName(v = '') {
  return String(v || '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/uu/g, 'u').replace(/oo/g, 'o').replace(/ou/g, 'o')
    .replace(/[ёэ]/g, 'е').replace(/[ьъ]/g, '')
    .replace(/дзе/g, 'зе')
    .replace(/си/g, 'ши').replace(/ти/g, 'чи').replace(/дзи/g, 'джи')
    .replace(/[^a-z0-9а-я]+/gi, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}
function nameKey(v = '') {
  return normName(v).split(' ').filter(Boolean).sort().join(' ');
}

const COMMON_CLANS_SET = new Set([
  'charlotte', 'шарлотта', 'uchiha', 'учиха', 'uzumaki', 'удзумаки', 'узумаки',
  'kurosaki', 'куросаки', 'shiba', 'сиба', 'шиба', 'monkey', 'манки',
  'kamado', 'камадо', 'todoroki', 'тодороки', 'ackerman', 'аккерман',
  'joestar', 'джостар', 'son', 'сон', 'brief', 'бриф', 'dragneel', 'драгнил',
  'yeager', 'йегер', 'kuchiki', 'кучики', 'ishida', 'исида', 'hyuuga', 'хьюга',
  'hyuga', 'nara', 'нара', 'senju', 'сенджу'
]);

function isStrictMatch(candidate, qName, qNameEn) {
  if (!candidate) return false;
  const cRu = nameKey(candidate.russian);
  const cEn = nameKey(candidate.name);
  const qRu = nameKey(qName);
  const qEn = nameKey(qNameEn || qName);

  // Exact full key match (sorted tokens)
  if (qRu && (qRu === cRu || qRu === cEn)) return true;
  if (qEn && (qEn === cEn || qEn === cRu)) return true;

  // Russian token match (word order independent)
  if (qRu && cRu) {
    const qTokens = qRu.split(' ').filter(Boolean);
    const cTokens = cRu.split(' ').filter(Boolean);
    if (qTokens.length >= 2 && cTokens.length >= 2) {
      if (qTokens.length === cTokens.length && qTokens.every(w => cTokens.includes(w))) return true;
    } else if (qTokens.length === 1 && cTokens.length === 1 && qTokens[0] === cTokens[0]) {
      return true;
    } else if (qTokens.length === 1 && cTokens.length >= 2 && !COMMON_CLANS_SET.has(qTokens[0])) {
      if (cTokens.includes(qTokens[0])) return true;
    } else if (cTokens.length === 1 && qTokens.length >= 2 && !COMMON_CLANS_SET.has(cTokens[0])) {
      if (qTokens.includes(cTokens[0])) return true;
    }
  }

  // English token match (word order independent)
  if (qEn && cEn) {
    const qTokens = qEn.split(' ').filter(Boolean);
    const cTokens = cEn.split(' ').filter(Boolean);
    if (qTokens.length >= 2 && cTokens.length >= 2) {
      if (qTokens.length === cTokens.length && qTokens.every(w => cTokens.includes(w))) return true;
    } else if (qTokens.length === 1 && cTokens.length === 1 && qTokens[0] === cTokens[0]) {
      return true;
    } else if (qTokens.length === 1 && cTokens.length >= 2 && !COMMON_CLANS_SET.has(qTokens[0])) {
      if (cTokens.includes(qTokens[0])) return true;
    } else if (cTokens.length === 1 && qTokens.length >= 2 && !COMMON_CLANS_SET.has(cTokens[0])) {
      if (qTokens.includes(cTokens[0])) return true;
    }
  }

  return false;
}

function acdbRelationLabel(label = '', side = '', kind = '') {
  const s = String(label).toLowerCase();
  const isAdopt = /step|adopt|прием|приём|сводн/i.test(s);
  if (side === 'parent') {
    if (isAdopt) return /mother|мать|мама|мачех/i.test(s) ? 'Приёмная мать' : /father|отец|папа|отчим/i.test(s) ? 'Приёмный отец' : 'Приёмный родитель';
    return /son of|daughter of|child of|сын|дочь/i.test(s) ? 'Отец / мать' : 'Родитель';
  }
  if (side === 'child') {
    if (isAdopt) return /daughter|дочь|удочер/i.test(s) ? 'Приёмная дочь' : /son|сын|усынов/i.test(s) ? 'Приёмный сын' : 'Приёмный ребёнок';
    return 'Сын / дочь';
  }
  if (kind === 'sibling') {
    if (isAdopt) return /sister|сестр/i.test(s) ? 'Приёмная сестра' : /brother|брат/i.test(s) ? 'Приёмный брат' : 'Приёмный брат / сестра';
    return 'Брат / сестра';
  }
  if (kind === 'partner') return 'Супруг / супруга';
  if (/uncle|aunt|дяд|тет/i.test(s)) return 'Дядя / тётя';
  if (/niece|nephew|племян/i.test(s)) return 'Племянник / племянница';
  if (/grandfather|grandmother|grandparent|дед|баб/i.test(s)) return 'Дедушка / бабушка';
  if (/grandson|granddaughter|grandchild|внук|внуч/i.test(s)) return 'Внук / внучка';
  if (/cousin|двоюрод/i.test(s)) return 'Двоюродный родственник';
  if (isAdopt) return 'Приёмный родственник';
  return 'Родственник';
}

function makeFamilyTree(selected, full) {
  const cleanNode = (x) => ({ ...x, relationLabel: undefined, sources: undefined, evidence: undefined });
  const pool = new Map(state.characters.map(c => [String(c.id), cleanNode({ ...c, ...(state.characterDetails.get(String(c.id)) || {}) })]));
  for (const c of state.relatedCharacters) pool.set(String(c.id), cleanNode({ ...c, ...(state.characterDetails.get(String(c.id)) || {}) }));
  for (const [id, c] of state.characterDetails) if (!pool.has(String(id))) pool.set(String(id), cleanNode(c));
  pool.set(String(selected.id), cleanNode({ ...selected, ...full }));

  const descriptions = [];
  for (const c of pool.values()) if (c.description) descriptions.push({ owner: c, description: c.description });

  const evidence = [];
  for (const item of descriptions) {
    const found = relationshipMentions(item.description, item.owner, selected, [...pool.values()]);
    for (const e of found) {
      let candidate = pool.get(e.id);
      if (!candidate) {
        // If candidate is not yet in pool, extract name from description tag [character=ID]Name[/character]
        const tagMatch = new RegExp(`\\[character=${e.id}\\]([^\\[]+?)\\[\\/character\\]`, 'i').exec(item.description);
        const nameGuess = tagMatch ? tagMatch[1].trim() : (e.context || 'Персонаж');
        candidate = {
          id: e.id,
          name: nameGuess,
          russian: nameGuess,
          image: '',
          description: ''
        };
        pool.set(String(e.id), candidate);
      }
      evidence.push({ ...e, candidate, ownerId: String(item.owner.id) });
    }
  }

  const selectedDesc = full.description || selected.description || '';
  const linkedIds = [...new Set([...String(selectedDesc).matchAll(/\[character=(\d+)\]/gi)].map(m => String(m[1])))];
  const groups = {
    grandparent: [],
    parent: [],
    uncle_aunt: [],
    parent_in_law: [],
    sibling: [],
    partner: [],
    cousin: [],
    sibling_in_law: [],
    child: [],
    nephew_niece: [],
    child_in_law: [],
    grandchild: [],
    other: []
  };

  const addOrMerge = (groupKey, nodeData, sourceBadge, relationLabel, evidenceText, isDeduced = false) => {
    if (!groups[groupKey]) groupKey = 'other';
    const nId = nodeData.id ? String(nodeData.id) : null;
    const nKey = nameKey(nodeData.russian || nodeData.name);
    const nEnKey = nameKey(nodeData.name);

    // Look for existing node across all groups to prevent duplicates (e.g. Minato in SH and WD)
    let existing = null;
    let existingGroupKey = null;

    for (const [gk, arr] of Object.entries(groups)) {
      const found = arr.find(item => {
        if (nId && item.id && String(item.id) === nId) return true;
        const itemKey = nameKey(item.russian || item.name);
        const itemEnKey = nameKey(item.name);
        if (nKey && itemKey && (nKey === itemKey || (nKey.length > 5 && itemKey.length > 5 && (nKey.includes(itemKey) || itemKey.includes(nKey))))) return true;
        if (nEnKey && itemEnKey && (nEnKey === itemEnKey || (nEnKey.length > 5 && itemEnKey.length > 5 && (nEnKey.includes(itemEnKey) || itemEnKey.includes(nEnKey))))) return true;
        return false;
      });
      if (found) {
        existing = found;
        existingGroupKey = gk;
        break;
      }
    }

    const descToDetect = nodeData.description || (nodeData.id ? state.characterDetails.get(String(nodeData.id))?.description : '') || '';
    const tGender = (nodeData.gender && nodeData.gender !== 'unknown')
      ? nodeData.gender
      : detectGender(descToDetect, nodeData.russian || nodeData.name);
    const selDesc = full.description || selected.description || '';
    const selGender = (full.gender && full.gender !== 'unknown')
      ? full.gender
      : detectGender(selDesc, selected.russian || selected.name);
    const isAdoptive = /при[её]мн|усынов|удочер|adopt|foster|мачех|отчим/iu.test(relationLabel || evidenceText || '');

    let finalLabel = relationLabel || 'Родственник';
    if (groupKey === 'parent') {
      if (isAdoptive) {
        if (/мать|мама|мачех|mother/iu.test(relationLabel)) finalLabel = 'Приёмная мать';
        else if (/отец|папа|отчим|father/iu.test(relationLabel)) finalLabel = 'Приёмный отец';
        else finalLabel = tGender === 'female' ? 'Приёмная мать' : tGender === 'male' ? 'Приёмный отец' : 'Приёмный родитель';
      } else {
        if (tGender === 'female') finalLabel = 'Мать';
        else if (tGender === 'male') finalLabel = 'Отец';
        else if (/мать|мама|mother/iu.test(relationLabel)) finalLabel = 'Мать';
        else if (/отец|папа|father/iu.test(relationLabel)) finalLabel = 'Отец';
        else finalLabel = 'Родитель';
      }
    } else if (groupKey === 'child') {
      if (isAdoptive) {
        if (/дочь|daughter|удочер/iu.test(relationLabel)) finalLabel = 'Приёмная дочь';
        else if (/сын|son|усынов/iu.test(relationLabel)) finalLabel = 'Приёмный сын';
        else finalLabel = tGender === 'female' ? 'Приёмная дочь' : tGender === 'male' ? 'Приёмный сын' : 'Приёмный ребёнок';
      } else {
        if (tGender === 'female') finalLabel = 'Дочь';
        else if (tGender === 'male') finalLabel = 'Сын';
        else if (/дочь|дочка|daughter/iu.test(relationLabel)) finalLabel = 'Дочь';
        else if (/сын|son/iu.test(relationLabel)) finalLabel = 'Сын';
        else finalLabel = 'Сын / дочь';
      }
    } else if (groupKey === 'partner') {
      if (tGender === 'female') finalLabel = 'Жена';
      else if (tGender === 'male') finalLabel = 'Муж';
      else if (selGender === 'male') finalLabel = 'Жена';
      else if (selGender === 'female') finalLabel = 'Муж';
      else if (/жена|супруга|wife/iu.test(relationLabel)) finalLabel = 'Жена';
      else if (/муж|супруг|husband/iu.test(relationLabel)) finalLabel = 'Муж';
      else finalLabel = 'Супруг(а)';
    } else if (groupKey === 'sibling') {
      if (isAdoptive) {
        if (/сестра|sister/iu.test(relationLabel)) finalLabel = 'Приёмная сестра';
        else if (/брат|brother/iu.test(relationLabel)) finalLabel = 'Приёмный брат';
        else finalLabel = tGender === 'female' ? 'Приёмная сестра' : tGender === 'male' ? 'Приёмный брат' : 'Приёмный брат / сестра';
      } else {
        if (tGender === 'female') finalLabel = 'Сестра';
        else if (tGender === 'male') finalLabel = 'Брат';
        else if (/сестра|sister/iu.test(relationLabel)) finalLabel = 'Сестра';
        else if (/брат|brother/iu.test(relationLabel)) finalLabel = 'Брат';
        else finalLabel = 'Брат / сестра';
      }
    } else if (groupKey === 'grandparent') {
      if (isAdoptive) {
        finalLabel = tGender === 'female' ? 'Приёмная бабушка' : 'Приёмный дедушка';
      } else {
        if (tGender === 'female') finalLabel = 'Бабушка';
        else if (tGender === 'male') finalLabel = 'Дедушка';
        else if (/бабуш|баб/iu.test(relationLabel)) finalLabel = 'Бабушка';
        else if (/дедуш|дед/iu.test(relationLabel)) finalLabel = 'Дедушка';
        else finalLabel = 'Дедушка / бабушка';
      }
    } else if (groupKey === 'grandchild') {
      if (isAdoptive) {
        finalLabel = tGender === 'female' ? 'Приёмная внучка' : 'Приёмный внук';
      } else {
        if (tGender === 'female') finalLabel = 'Внучка';
        else if (tGender === 'male') finalLabel = 'Внук';
        else if (/внучк/iu.test(relationLabel)) finalLabel = 'Внучка';
        else if (/внук/iu.test(relationLabel)) finalLabel = 'Внук';
        else finalLabel = 'Внук / внучка';
      }
    } else if (groupKey === 'uncle_aunt') {
      if (tGender === 'female') finalLabel = 'Тётя';
      else if (tGender === 'male') finalLabel = 'Дядя';
      else if (/т[её]т/iu.test(relationLabel)) finalLabel = 'Тётя';
      else if (/дяд/iu.test(relationLabel)) finalLabel = 'Дядя';
      else finalLabel = 'Дядя / тётя';
    } else if (groupKey === 'nephew_niece') {
      if (tGender === 'female') finalLabel = 'Племянница';
      else if (tGender === 'male') finalLabel = 'Племянник';
      else if (/племянниц/iu.test(relationLabel)) finalLabel = 'Племянница';
      else if (/племянник/iu.test(relationLabel)) finalLabel = 'Племянник';
      else finalLabel = 'Племянник / племянница';
    } else if (groupKey === 'cousin') {
      if (tGender === 'female') finalLabel = 'Двоюродная сестра';
      else if (tGender === 'male') finalLabel = 'Двоюродный брат';
      else if (/сестр|кузин/iu.test(relationLabel)) finalLabel = 'Двоюродная сестра';
      else if (/брат|кузен/iu.test(relationLabel)) finalLabel = 'Двоюродный брат';
      else finalLabel = 'Двоюродный брат / сестра';
    } else if (groupKey === 'parent_in_law') {
      if (selGender === 'male') {
        finalLabel = tGender === 'female' ? 'Тёща' : tGender === 'male' ? 'Тесть' : 'Родитель супруги';
      } else if (selGender === 'female') {
        finalLabel = tGender === 'female' ? 'Свекровь' : tGender === 'male' ? 'Свёкор' : 'Родитель мужа';
      } else {
        finalLabel = tGender === 'female' ? 'Свекровь / Тёща' : tGender === 'male' ? 'Свёкор / Тесть' : 'Родитель супруга(и)';
      }
    } else if (groupKey === 'sibling_in_law') {
      if (selGender === 'male') {
        finalLabel = tGender === 'female' ? 'Свояченица' : tGender === 'male' ? 'Шурин' : 'Родня супруги';
      } else if (selGender === 'female') {
        finalLabel = tGender === 'female' ? 'Золовка' : tGender === 'male' ? 'Деверь' : 'Родня мужа';
      } else {
        finalLabel = tGender === 'female' ? 'Сестра супруга(и)' : tGender === 'male' ? 'Брат супруга(и)' : 'Родня супруга(и)';
      }
    } else if (groupKey === 'child_in_law') {
      finalLabel = tGender === 'female' ? 'Невестка' : tGender === 'male' ? 'Зять' : (relationLabel || 'Зять / невестка');
    } else if (groupKey === 'other') {
      if (!finalLabel || finalLabel === 'Родственник') {
        finalLabel = tGender === 'female' ? 'Родственница' : 'Родственник';
      }
    }

    if (existing) {
      // MERGE duplicate into one single card
      if (!existing.id && nodeData.id) existing.id = nodeData.id;

      // Prefer official Shikimori image over Wikimedia Commons photo (which often has cosplayers/statues)
      const isWiki = (img) => !img || String(img).includes('wikimedia.org') || String(img).includes('fallback');
      if (nodeData.image && (!isWiki(nodeData.image) || isWiki(existing.image))) {
        existing.image = nodeData.image;
      }

      if (nodeData.russian && (!existing.russian || existing.russian === existing.name)) existing.russian = nodeData.russian;

      // Merge source badge (e.g. SH · WD)
      if (sourceBadge && !existing.sources?.includes(sourceBadge)) {
        existing.sources = existing.sources ? `${existing.sources} · ${sourceBadge}` : sourceBadge;
      }
      if (evidenceText && !existing.evidence?.includes(evidenceText)) {
        existing.evidence = existing.evidence ? `${existing.evidence} | ${evidenceText}` : evidenceText;
      }

      // Authoritative database relation (WD) or group correction:
      if (!isDeduced && existingGroupKey !== groupKey) {
        if (sourceBadge === 'WD' || existing.sources === 'SH') {
          groups[existingGroupKey] = groups[existingGroupKey].filter(x => x !== existing);
          groups[groupKey].push(existing);
          existing.relationLabel = finalLabel;
        }
      } else if (!isDeduced) {
        const specificLabels = [
          'Отец', 'Мать', 'Приёмный отец', 'Приёмная мать', 'Приёмный родитель',
          'Муж', 'Жена',
          'Сын', 'Дочь', 'Приёмный сын', 'Приёмная дочь', 'Приёмный ребёнок',
          'Брат', 'Сестра', 'Приёмный брат', 'Приёмная сестра',
          'Двоюродный брат', 'Двоюродная сестра', 'Дядя', 'Тётя', 'Племянник', 'Племянница', 'Дедушка', 'Бабушка', 'Внук', 'Внучка',
          'Тесть', 'Тёща', 'Свёкор', 'Свекровь', 'Шурин', 'Свояченица', 'Деверь', 'Золовка', 'Зять', 'Невестка'
        ];
        if (specificLabels.includes(finalLabel) || existing.relationLabel === 'Родитель' || existing.relationLabel === 'Родственник' || existing.relationLabel === 'Родственница' || existing.relationLabel === 'Супруг(а)') {
          existing.relationLabel = finalLabel;
        }
      }
      return;
    }

    const newNode = {
      ...nodeData,
      sources: sourceBadge,
      relationLabel: finalLabel,
      evidence: evidenceText || ''
    };
    groups[groupKey].push(newNode);
  };

  // 1. Process evidence from Shikimori franchise descriptions
  for (const e of evidence) {
    const id = String(e.candidate.id);
    if (id === String(selected.id)) continue;
    const type = classifyRelationEvidence(e);
    addOrMerge(type, e.candidate, 'SH', e.label, e.context);
  }

  // 2. Process external relations from Wikidata and ACDB strictly for this character
  const poolList = [...pool.values()];
  const findInPool = (name, nameEn = '') => {
    return poolList.find(x => isStrictMatch(x, name, nameEn)) || null;
  };

  const currentExtRels = full.externalRelations ||
    (selected.id ? state.characterRelationsMap.get(String(selected.id)) : null) ||
    state.acdbRelations || [];

  for (const rel of currentExtRels) {
    const type = rel.side || rel.kind;
    const groupKey = ['parent', 'child', 'sibling', 'partner', 'grandparent', 'grandchild', 'uncle_aunt', 'nephew_niece', 'cousin', 'other'].includes(type) ? type : null;
    if (!groupKey) continue;
    const isWikidata = rel.source === 'wikidata';
    const poolHit = findInPool(rel.name, rel.name_en);
    const same = poolHit || rel.shikiChar || null;
    if (same && poolHit && String(same.id) === String(selected.id)) continue;
    if (rel.id && selected.id && String(rel.id) === String(selected.id)) continue;
    if (rel.name && (isStrictMatch(selected, rel.name, rel.name_en) || isStrictMatch(full, rel.name, rel.name_en))) continue;

    let nodeData;
    if (same) {
      nodeData = {
        ...same,
        id: same.id,
        wikidataId: null,
        acdbId: null,
        external: false,
        gender: rel.gender || same.gender || undefined,
        name: same.russian || same.name || rel.name,
        russian: same.russian || rel.name,
        image: same.image ? (typeof same.image === 'string' ? same.image : imageUrl(same.image, 'preview')) : (rel.image || '')
      };
    } else if (isWikidata) {
      nodeData = { id: null, external: true, name: rel.name, russian: rel.name, gender: rel.gender, image: rel.image || '', wikidataId: rel.id, wikidataUrl: rel.url, name_en: rel.name_en };
    } else {
      nodeData = { id: null, acdbId: rel.id, external: true, name: rel.name, russian: rel.name, gender: rel.gender, image: rel.image || '', url: rel.url };
    }
    if (!nodeData.image && rel.image) nodeData.image = rel.image;

    let label = isWikidata ? rel.label : acdbRelationLabel(rel.label, rel.side, rel.kind);
    if (groupKey === 'partner') {
      label = rel.label || 'Супруг(а)';
    }

    const ev = `${isWikidata ? 'Wikidata' : 'ACDB'}: ${rel.label}`;
    const badge = isWikidata ? 'WD' : 'ACDB';

    addOrMerge(groupKey, nodeData, badge, label, ev);
  }

  // 3. Multi-generation 2-hop graph deduction across loaded franchise characters
  const relCache = new Map();
  const getDirectRels = (node) => {
    const nid = String(node.id || node.name);
    if (relCache.has(nid)) return relCache.get(nid);
    const foundRels = [];
    for (const item of descriptions) {
      const mentions = relationshipMentions(item.description, item.owner, node, poolList);
      for (const m of mentions) {
        let cand = pool.get(String(m.id));
        if (!cand) {
          const tagMatch = new RegExp(`\\[character=${m.id}\\]([^\\[]+?)\\[\\/character\\]`, 'i').exec(item.description);
          const nameGuess = tagMatch ? tagMatch[1].trim() : (m.context || 'Персонаж');
          cand = { id: m.id, name: nameGuess, russian: nameGuess, image: '', description: '' };
          pool.set(String(m.id), cand);
        }
        foundRels.push({ ...m, candidate: cand, ownerId: String(item.owner.id) });
      }
    }
    relCache.set(nid, foundRels);
    return foundRels;
  };

  const isSelf = (target) => {
    if (!target) return true;
    if (target.id && selected.id && String(target.id) === String(selected.id)) return true;
    return isStrictMatch(target, selected.russian, selected.name);
  };

  // 3a. Parents' connections -> Grandparents (parents of parents), Uncles/Aunts (siblings of parents)
  for (const p of [...groups.parent]) {
    const pRels = getDirectRels(p);
    for (const r of pRels) {
      if (isSelf(r.candidate)) continue;
      const rType = classifyRelationEvidence(r);
      const ev = `Через ${p.russian || p.name} (${p.relationLabel || 'родитель'}): ${r.label || rType}`;
      if (rType === 'parent') {
        addOrMerge('grandparent', r.candidate, 'SH', r.label, ev, true);
      } else if (rType === 'sibling') {
        addOrMerge('uncle_aunt', r.candidate, 'SH', r.label, ev, true);
      } else if (rType === 'child') {
        addOrMerge('sibling', r.candidate, 'SH', r.label, ev, true);
      }
    }
  }

  // 3b. Partners' connections -> Parents-in-law (parents of spouse), Siblings-in-law (siblings of spouse)
  for (const m of [...groups.partner]) {
    const mRels = getDirectRels(m);
    for (const r of mRels) {
      if (isSelf(r.candidate)) continue;
      const rType = classifyRelationEvidence(r);
      const ev = `Через ${m.russian || m.name} (${m.relationLabel || 'супруг(а)'}): ${r.label || rType}`;
      if (rType === 'parent') {
        addOrMerge('parent_in_law', r.candidate, 'SH', r.label, ev, true);
      } else if (rType === 'sibling') {
        addOrMerge('sibling_in_law', r.candidate, 'SH', r.label, ev, true);
      }
    }
  }

  // 3c. Siblings' connections -> Nephews & Nieces (children of siblings), Siblings-in-law (partners of siblings)
  for (const s of [...groups.sibling]) {
    const sRels = getDirectRels(s);
    for (const r of sRels) {
      if (isSelf(r.candidate)) continue;
      const rType = classifyRelationEvidence(r);
      const ev = `Через ${s.russian || s.name} (${s.relationLabel || 'брат/сестра'}): ${r.label || rType}`;
      if (rType === 'child') {
        addOrMerge('nephew_niece', r.candidate, 'SH', r.label, ev, true);
      } else if (rType === 'partner') {
        addOrMerge('sibling_in_law', r.candidate, 'SH', r.label, ev, true);
      }
    }
  }

  // 3d. Children's connections -> Grandchildren (children of children), Children-in-law (spouses of children)
  for (const c of [...groups.child]) {
    const cRels = getDirectRels(c);
    for (const r of cRels) {
      if (isSelf(r.candidate)) continue;
      const rType = classifyRelationEvidence(r);
      const ev = `Через ${c.russian || c.name} (${c.relationLabel || 'ребёнок'}): ${r.label || rType}`;
      if (rType === 'child') {
        addOrMerge('grandchild', r.candidate, 'SH', r.label, ev, true);
      } else if (rType === 'partner') {
        addOrMerge('child_in_law', r.candidate, 'SH', r.label, ev, true);
      }
    }
  }

  // 3e. Uncles/Aunts' connections -> Cousins (children of uncles/aunts)
  for (const u of [...groups.uncle_aunt]) {
    const uRels = getDirectRels(u);
    for (const r of uRels) {
      if (isSelf(r.candidate)) continue;
      const rType = classifyRelationEvidence(r);
      const ev = `Через ${u.russian || u.name} (${u.relationLabel || 'дядя/тётя'}): ${r.label || rType}`;
      if (rType === 'child') {
        addOrMerge('cousin', r.candidate, 'SH', r.label, ev, true);
      }
    }
  }

  // Remove any character from mentioned if they are already in the family tree
  const allFamilyIds = new Set(Object.values(groups).flat().map(x => String(x.id)).filter(Boolean));
  const allFamilyNames = new Set(Object.values(groups).flat().flatMap(x => [nameKey(x.name), nameKey(x.russian)]).filter(Boolean));

  const mentioned = linkedIds
    .filter(id => pool.has(String(id)) && String(id) !== String(selected.id) && !allFamilyIds.has(String(id)))
    .map(id => pool.get(String(id)))
    .filter(c => !allFamilyNames.has(nameKey(c.name)) && !allFamilyNames.has(nameKey(c.russian)));

  return { groups, mentioned, hasEvidence: Object.values(groups).some(a => a.length > 0) };
}

function getRelationTheme(label = '', groupKey = '') {
  const s = String(label).toLowerCase();
  if (/отец|папа|father|dad/i.test(s) || (groupKey === 'parent' && /отец/i.test(label))) {
    return { cls: 'rel-father', icon: '👑', label: label || 'Отец' };
  }
  if (/мать|мама|mother|mom/i.test(s) || (groupKey === 'parent' && /мать/i.test(label))) {
    return { cls: 'rel-mother', icon: '👑', label: label || 'Мать' };
  }
  if (groupKey === 'parent') {
    return { cls: 'rel-parent', icon: '👑', label: label || 'Родитель' };
  }
  if (/жена|супруга|wife/i.test(s) || (groupKey === 'partner' && /жена/i.test(label))) {
    return { cls: 'rel-wife', icon: '💍', label: label || 'Жена' };
  }
  if (/муж|супруг|husband/i.test(s) || (groupKey === 'partner' && /муж/i.test(label))) {
    return { cls: 'rel-husband', icon: '💍', label: label || 'Муж' };
  }
  if (groupKey === 'partner') {
    return { cls: 'rel-partner', icon: '💍', label: label || 'Супруг(а)' };
  }
  if (/брат|brother/i.test(s) || (groupKey === 'sibling' && /брат/i.test(label))) {
    return { cls: 'rel-brother', icon: '🤝', label: label || 'Брат' };
  }
  if (/сестра|sister/i.test(s) || (groupKey === 'sibling' && /сестра/i.test(label))) {
    return { cls: 'rel-sister', icon: '🤝', label: label || 'Сестра' };
  }
  if (groupKey === 'sibling') {
    return { cls: 'rel-sibling', icon: '🤝', label: label || 'Брат / сестра' };
  }
  if (/сын|son/i.test(s) || (groupKey === 'child' && /сын/i.test(label))) {
    return { cls: 'rel-son', icon: '👶', label: label || 'Сын' };
  }
  if (/дочь|дочка|daughter/i.test(s) || (groupKey === 'child' && /дочь/i.test(label))) {
    return { cls: 'rel-daughter', icon: '👶', label: label || 'Дочь' };
  }
  if (groupKey === 'child') {
    return { cls: 'rel-child', icon: '👶', label: label || 'Ребёнок' };
  }
  if (/дедуш|дед|grandfather/i.test(s) || (groupKey === 'grandparent' && /дедуш/i.test(label))) {
    return { cls: 'rel-grandpa', icon: '👴', label: label || 'Дедушка' };
  }
  if (/бабуш|баб|grandmother/i.test(s) || (groupKey === 'grandparent' && /бабуш/i.test(label))) {
    return { cls: 'rel-grandma', icon: '👵', label: label || 'Бабушка' };
  }
  if (groupKey === 'grandparent') {
    return { cls: 'rel-grandparent', icon: '👴', label: label || 'Дедушка / бабушка' };
  }
  if (groupKey === 'grandchild') {
    return { cls: 'rel-grandchild', icon: '🐣', label: label || 'Внук / внучка' };
  }
  if (groupKey === 'uncle_aunt') {
    return { cls: 'rel-uncle', icon: '🧑', label: label || 'Дядя / тётя' };
  }
  if (groupKey === 'nephew_niece') {
    return { cls: 'rel-nephew', icon: '👦', label: label || 'Племянник(ца)' };
  }
  if (groupKey === 'cousin') {
    return { cls: 'rel-cousin', icon: '👥', label: label || 'Кузен(ка)' };
  }
  if (groupKey === 'parent_in_law' || groupKey === 'sibling_in_law' || groupKey === 'child_in_law') {
    return { cls: 'rel-inlaw', icon: '🏡', label: label || 'Родня супруга(и)' };
  }
  return { cls: 'rel-other', icon: '🧬', label: label || 'Родственник' };
}

function familyCard(c, relation, groupKey = '') {
  const base = `data-name="${esc(c.russian || c.name || '')}" data-image="${esc(imageUrl(c.image, 'preview'))}"`;
  const attrs = c.id
    ? `data-family-id="${esc(c.id)}" ${base}`
    : c.wikidataId
    ? `data-wikidata-id="${esc(c.wikidataId)}" ${base}`
    : c.acdbId
    ? `data-acdb-id="${esc(c.acdbId)}" ${base}`
    : `data-family-id="${esc(c.name)}" ${base}`;
  const ev = String(c.evidence || '');
  const badge = c.sources || (ev.startsWith('Wikidata') ? 'WD' : ev.startsWith('ACDB') ? 'ACDB' : 'SH');
  const badgeCls = badge.toLowerCase().replace(/[^a-z0-9]/g, '');

  const theme = getRelationTheme(c.relationLabel || relation, groupKey);

  return `
    <button class="family-card-pro ${theme.cls}" type="button" ${attrs} title="${esc(ev || theme.label)}">
      <div class="card-badge-row">
        <span class="rel-tag ${theme.cls}"><span class="rel-icon">${theme.icon}</span> ${esc(theme.label)}</span>
        <span class="source-pill ${badgeCls}">${badge}</span>
      </div>
      <div class="card-body-row">
        <div class="card-avatar-wrap">
          <img src="${esc(imageUrl(c.image, 'preview') || fallback)}" onerror="this.src='${fallback}'" alt="" loading="lazy">
        </div>
        <div class="card-info">
          <strong class="card-name">${esc(c.russian || c.name || 'Персонаж')}</strong>
          ${c.name && c.russian && c.name !== c.russian ? `<small class="card-orig">${esc(c.name)}</small>` : ''}
          <span class="card-nav-hint">Перейти к ветке →</span>
        </div>
      </div>
    </button>
  `;
}

function renderFamilyTree(selected, full) {
  const tree = makeFamilyTree(selected, full);
  const g = tree.groups;

  const totalRelativesCount = Object.values(g).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0);
  const mentions = (tree.mentioned || []).filter(c => !Object.values(g).flat().some(x => String(x.id) === String(c.id)));

  // Helper that renders a group ONLY if it has relatives
  const groupBlock = (title, icon, items, defaultRelation, groupKey, colorCls = '') => {
    if (!items || !items.length) return '';
    return `
      <div class="tree-tier-block ${colorCls}">
        <div class="tree-tier-header">
          <span class="tier-icon">${icon}</span>
          <span class="tier-title">${title}</span>
          <span class="tier-count">${items.length}</span>
        </div>
        <div class="tree-cards-grid">
          ${items.map(c => familyCard(c, c.relationLabel || defaultRelation, groupKey)).join('')}
        </div>
      </div>
    `;
  };

  // If no relatives exist anywhere:
  if (totalRelativesCount === 0 && mentions.length === 0) {
    return `
      <section class="family-tree-wrap" id="familyTreeSection">
        <div class="family-tree-heading">
          <div>
            <div class="eyebrow"><span class="pulse"></span> СЕМЕЙНОЕ ДЕРЕВО ПЕРСОНАЖА</div>
            <h3>Генеалогическая карта связей</h3>
          </div>
          <span class="tree-source-note">Shikimori · Wikidata · ACDB</span>
        </div>
        <div class="family-empty-box">
          <div class="empty-icon-large">🧬</div>
          <h4>Родословные связи не обнаружены</h4>
          <p>В официальных источниках (Shikimori, Wikidata, ACDB) для <strong>«${esc(full.russian || selected.russian || full.name || selected.name)}»</strong> пока нет подтверждённых родственных записей.</p>
          <div class="empty-tip">
            💡 Воспользуйтесь кнопкой <strong>«🔗 Родство»</strong> в верхней панели, чтобы проверить связь между двумя персонажами напрямую.
          </div>
        </div>
      </section>
    `;
  }

  // Selected Character Hero Node
  const heroNodeHtml = `
    <div class="tree-hero-node">
      <div class="hero-node-badge">ВЫБРАННЫЙ ПЕРСОНАЖ</div>
      <div class="hero-node-content">
        <div class="hero-avatar-wrap">
          <img src="${esc(imageUrl(full.image || selected.image, 'original') || fallback)}" onerror="this.src='${fallback}'" alt="">
        </div>
        <div class="hero-node-info">
          <h4>${esc(full.russian || selected.russian || full.name || selected.name)}</h4>
          ${full.name && full.name !== (full.russian || selected.russian) ? `<small>${esc(full.name)}</small>` : ''}
          <span class="hero-node-stat">Подтверждённых родственников: <strong>${totalRelativesCount}</strong></span>
        </div>
      </div>
    </div>
  `;

  return `
    <section class="family-tree-wrap" id="familyTreeSection">
      <div class="family-tree-heading">
        <div>
          <div class="eyebrow"><span class="pulse"></span> СЕМЕЙНОЕ ДЕРЕВО ПЕРСОНАЖА</div>
          <h3>Генеалогическая карта связей <span>(${totalRelativesCount})</span></h3>
        </div>
        <span class="tree-source-note">Shikimori · Вся франшиза · Wikidata · ACDB</span>
      </div>

      <div class="compact-family-tree">
        <!-- 1. ПРЕДКИ И СТАРШЕЕ ПОКОЛЕНИЕ (Сверху) -->
        ${(g.grandparent?.length || g.parent?.length || g.uncle_aunt?.length || g.parent_in_law?.length) ? `
          <div class="tree-generation ancestors-gen">
            <div class="gen-label">ПРЕДКИ И СТАРШЕЕ ПОКОЛЕНИЕ</div>
            ${groupBlock('Дедушки и бабушки', '👴', g.grandparent, 'Дедушка / бабушка', 'grandparent', 'theme-purple')}
            ${groupBlock('Родители', '👑', g.parent, 'Родитель', 'parent', 'theme-gold')}
            ${groupBlock('Дяди и тёти', '🧑', g.uncle_aunt, 'Дядя / тётя', 'uncle_aunt', 'theme-indigo')}
            ${groupBlock('Родители супруга(и)', '🏡', g.parent_in_law, 'Родитель супруга', 'parent_in_law', 'theme-amber')}
          </div>
        ` : ''}

        <!-- 2. ТЕКУЩЕЕ ПОКОЛЕНИЕ (Центр: Персонаж, Супруги, Братья и сёстры) -->
        <div class="tree-generation current-gen">
          ${heroNodeHtml}
          ${groupBlock('Супруги и партнёры', '💍', g.partner, 'Супруг(а)', 'partner', 'theme-rose')}
          ${groupBlock('Братья и сёстры', '🤝', g.sibling, 'Брат / сестра', 'sibling', 'theme-cyan')}
          ${groupBlock('Двоюродные (Кузены)', '👥', g.cousin, 'Кузен', 'cousin', 'theme-sky')}
          ${groupBlock('Свояки и родня супругов', '🏡', g.sibling_in_law, 'Родня супруга', 'sibling_in_law', 'theme-amber')}
        </div>

        <!-- 3. ДЕТИ И МЛАДШЕЕ ПОКОЛЕНИЕ (Снизу) -->
        ${(g.child?.length || g.child_in_law?.length || g.nephew_niece?.length || g.grandchild?.length) ? `
          <div class="tree-generation descendants-gen">
            <div class="gen-label">ДЕТИ И МЛАДШЕЕ ПОКОЛЕНИЕ</div>
            ${groupBlock('Дети', '👶', g.child, 'Сын / дочь', 'child', 'theme-emerald')}
            ${groupBlock('Племянники и племянницы', '👦', g.nephew_niece, 'Племянник(ца)', 'nephew_niece', 'theme-blue')}
            ${groupBlock('Зятья и невестки', '🏡', g.child_in_law, 'Зять / невестка', 'child_in_law', 'theme-amber')}
            ${groupBlock('Внуки и правнуки', '🐣', g.grandchild, 'Внук / внучка', 'grandchild', 'theme-teal')}
          </div>
        ` : ''}

        <!-- 4. ДРУГИЕ РОДСТВЕННИКИ -->
        ${g.other?.length ? `
          <div class="tree-generation other-gen">
            ${groupBlock('Другие подтверждённые родственники', '🧬', g.other, 'Родственник', 'other', 'theme-violet')}
          </div>
        ` : ''}

        <!-- 5. УПОМИНАНИЯ В БИОГРАФИЯХ -->
        ${mentions?.length ? `
          <div class="tree-generation mentions-gen">
            ${groupBlock('Упомянуты в биографии персонажа', '💬', mentions, 'Упоминание', 'other', 'theme-dim')}
          </div>
        ` : ''}
      </div>

      <div class="tree-footer-info">
        <span>💡 Кликайте на любого родственника в дереве для мгновенного перехода к его персональной ветке.</span>
      </div>
    </section>
  `;
}

let preloadToken = 0;
async function startFranchisePreload(roster) {
  // Direct live mode: keep API queue clean and fast for interactive clicks
  return;
}

async function loadRosterDescriptions(selectedId, selectedFull, onProgress, isLive) {
  const roster = [...state.characters, ...state.relatedCharacters];
  const unique = [...new Map(roster.filter(x => x?.id).map(x => [String(x.id), x])).values()];
  if (selectedFull?.id) state.characterDetails.set(String(selectedFull.id), selectedFull);

  // 1. Fast sync all disk-cached characters in one or two calls
  const missingAll = unique.filter(x => String(x.id) !== String(selectedId) && !state.characterDetails.has(String(x.id)));
  if (missingAll.length > 0) {
    if (onProgress) onProgress(0, missingAll.length, `Сверка локального кэша (${missingAll.length} записей)...`, 'Сверка локального кэша БД');
    for (let i = 0; i < missingAll.length; i += 50) {
      const chunk = missingAll.slice(i, i + 50).map(x => x.id);
      try {
        const res = await api(`/api/characters-batch?ids=${chunk.join(',')}&cached_only=1`);
        let cachedLoaded = 0;
        for (const ch of res.characters || []) {
          state.characterDetails.set(String(ch.id), ch);
          cachedLoaded++;
        }
        if (cachedLoaded > 0 && onProgress) {
          onProgress(0, missingAll.length, `Из кэша загружено ${state.characterDetails.size} описаний`, `Быстрая загрузка из кэша: +${cachedLoaded}`);
        }
      } catch (_) {}
    }
  }

  // 2. Extract name tokens and explicit links from the selected character
  const fullNames = [selectedFull?.name, selectedFull?.russian].filter(Boolean).join(' ');
  const nameTokens = normName(fullNames).split(' ').filter(w => w.length > 2);

  // Extract explicit [character=ID] links from description
  const explicitLinkedIds = new Set(
    [...String(selectedFull?.description || '').matchAll(/\[character=(\d+)\]/gi)].map(m => String(m[1]))
  );

  // Extract plain text word stems from description (e.g. names like "Кизаши", "Сакура", "Каруи")
  const descPlain = normName(plainDescription(selectedFull?.description || ''));
  const descTokens = descPlain.split(' ').filter(w => w.length >= 4);

  const missing = unique.filter(x => String(x.id) !== String(selectedId) && !state.characterDetails.has(String(x.id)));

  // Check early termination: only if NO high-priority candidates (explicitly tagged or shared clan) remain unloaded!
  const hasUnloadedHighScored = missing.some(c => {
    const cid = String(c.id);
    if (explicitLinkedIds.has(cid)) return true;
    const cNames = normName([c.name, c.russian].filter(Boolean).join(' '));
    return nameTokens.some(t => cNames.includes(t));
  });

  const earlyTree = makeFamilyTree(selectedFull || { id: selectedId }, selectedFull);
  if (!hasUnloadedHighScored && (earlyTree.groups.parent.length >= 2 || (earlyTree.hasEvidence && missing.length === 0))) {
    if (onProgress) onProgress(1, 1, 'Родственные связи обнаружены в кэше!', 'Раннее завершение: связи найдены в кэше');
    return 0;
  }

  // Smart scoring: rank characters by likelihood of family relations
  const scored = missing.map(c => {
    let score = 0;
    const cid = String(c.id);
    if (explicitLinkedIds.has(cid)) score += 100; // Directly mentioned in description tag

    // Check if candidate's name is mentioned in plain text description
    const cTokens = normName([c.name, c.russian].filter(Boolean).join(' ')).split(' ').filter(w => w.length >= 4);
    if (cTokens.some(tok => descPlain.includes(tok) || descTokens.some(dt => dt.includes(tok) || tok.includes(dt)))) {
      score += 75;
    }

    // Check shared family/clan words in names
    const cNames = normName([c.name, c.russian].filter(Boolean).join(' '));
    for (const token of nameTokens) {
      if (cNames.includes(token)) {
        score += 60;
        break;
      }
    }

    // Short or single names are very common for parents
    const words = (c.russian || c.name || '').trim().split(/\s+/);
    if (words.length === 1 && (c.russian || c.name || '').length >= 3) {
      score += 25;
    }

    // Main and Supporting characters are far more prominent than background extras
    if (isMainCharacter(c.role)) score += 30;
    else if (c.role && /supporting|main/i.test(c.role)) score += 25;
    else score += 10;

    return { char: c, score };
  });

  // Sort by relevance
  scored.sort((a, b) => b.score - a.score);
  const strongScored = scored.filter(x => x.score >= 50);
  const targetList = (strongScored.length ? strongScored.slice(0, 50) : scored.filter(x => x.score > 0).slice(0, 15)).map(x => x.char);

  if (!targetList.length) {
    if (onProgress) onProgress(1, 1, 'Кандидаты проверены', 'Все кандидаты проанализированы');
    return 0;
  }

  // Fetch in batches of 15 using characters-batch
  let done = 0;
  const batchSize = 15;
  for (let i = 0; i < targetList.length; i += batchSize) {
    if (isLive && !isLive()) break;
    const batch = targetList.slice(i, i + batchSize);
    const batchNames = batch.map(x => x.russian || x.name).slice(0, 3).join(', ') + (batch.length > 3 ? '...' : '');
    if (onProgress) {
      onProgress(done, targetList.length, `Загрузка: ${batchNames}`, `Запрос данных: [${batchNames}]`);
    }
    const batchIds = batch.map(x => x.id).join(',');
    try {
      const res = await api(`/api/characters-batch?ids=${encodeURIComponent(batchIds)}`);
      for (const ch of res.characters || []) {
        state.characterDetails.set(String(ch.id), ch);
      }
    } catch (_) {}
    done += batch.length;
    if (onProgress) onProgress(done, targetList.length, `Проанализировано ${done} из ${targetList.length} кандидатов`, `Готово ${done}/${targetList.length}`);
    await new Promise(r => setTimeout(r, 10)); // Yield to prevent browser freeze

    // Early termination: if we found parents or confirmed family evidence AND no more high-score candidates remain, stop!
    const curTree = makeFamilyTree(selectedFull || { id: selectedId }, selectedFull);
    const remainingHighScored = targetList.slice(i + batchSize).some(x => {
      const cid = String(x.id);
      if (explicitLinkedIds.has(cid)) return true;
      const cNames = normName([x.name, x.russian].filter(Boolean).join(' '));
      return nameTokens.some(t => cNames.includes(t));
    });
    if (!remainingHighScored && (curTree.groups.parent.length >= 2 || (curTree.hasEvidence && done >= Math.min(targetList.length, 6)))) {
      if (onProgress) onProgress(targetList.length, targetList.length, 'Подтверждены связи в дереве', 'Завершено: найдены родственники');
      break;
    }
  }

  return done;
}

const LOAD_STEPS = [
  { key: 'profile', name: 'Профиль' },
  { key: 'roster', name: 'Биографии' },
  { key: 'analysis', name: 'Связи' },
  { key: 'external', name: 'Wikidata/ACDB' },
  { key: 'tree', name: 'Дерево' }
];

function appendLoadLog(msg, type = 'active') {
  const body = $('#loadConsoleBody');
  if (!body) return;
  const now = new Date();
  const timeStr = [now.getHours(), now.getMinutes(), now.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
  
  const div = document.createElement('div');
  div.className = `console-line ${type}`;
  div.innerHTML = `<span class="time">${timeStr}</span><span>${esc(msg)}</span>`;
  body.appendChild(div);
  body.scrollTop = body.scrollHeight;
}

function updateModalNav() {
  const nav = $('#modalNav');
  if (!nav) return;
  if (state.history.length > 0) {
    nav.innerHTML = `<button type="button" class="back-btn" id="modalBackBtn">← Назад (${state.history.length})</button>`;
    const btn = $('#modalBackBtn');
    if (btn) {
      btn.addEventListener('click', () => {
        const prev = state.history.pop();
        if (prev) openCharacter(prev, { back: true });
      });
    }
  } else {
    nav.innerHTML = '';
  }
}

function setProgress(pct, text, subDetail, stepKey, logMsg) {
  const v = Math.max(state.loadPct || 0, Math.min(100, Math.round(pct)));
  state.loadPct = v;
  const f = $('#loadFill'), t = $('#loadText'), p = $('#loadPct'), s = $('#loadSubDetail');
  if (f) f.style.width = v + '%';
  if (p) p.textContent = v + '%';
  if (t && text) t.textContent = text;
  if (s && subDetail !== undefined) s.textContent = subDetail;

  if (stepKey) {
    const stepIdx = LOAD_STEPS.findIndex(x => x.key === stepKey);
    if (stepIdx !== -1) {
      LOAD_STEPS.forEach((step, idx) => {
        const el = $(`#step-${step.key}`);
        const st = $(`#step-status-${step.key}`);
        if (!el) return;
        el.className = 'load-step-item';
        if (idx < stepIdx) {
          el.classList.add('done');
          if (st) st.textContent = 'Готово';
        } else if (idx === stepIdx) {
          el.classList.add('active');
          if (st) st.textContent = 'В процессе';
        } else {
          el.classList.add('pending');
          if (st) st.textContent = 'Ожидание';
        }
      });
    }
  }

  if (logMsg) {
    appendLoadLog(logMsg);
  }
}

function showProgress(c) {
  state.loadPct = 0;
  const img = imageUrl(c.image, 'preview');
  updateModalNav();

  const stepsHtml = LOAD_STEPS.map((s, idx) => `
    <div class="load-step-item ${idx === 0 ? 'active' : 'pending'}" id="step-${s.key}">
      <div class="step-indicator"></div>
      <div class="step-name">${esc(s.name)}</div>
      <div class="step-status" id="step-status-${s.key}">${idx === 0 ? 'В процессе' : 'Ожидание'}</div>
    </div>
  `).join('');

  $('#modalContent').innerHTML = `
    <div class="load-wrap">
      <div class="eyebrow"><span class="pulse"></span> СБОР ИНФОРМАЦИИ И СВЯЗЕЙ</div>
      ${img ? `<img class="load-avatar" src="${esc(img)}" onerror="this.style.display='none'" alt="">` : ''}
      <h2>${esc(c.russian || c.name || 'Персонаж')}</h2>
      <div class="load-bar"><div class="load-fill" id="loadFill"></div></div>
      <div class="load-meta"><span id="loadText">Подготовка к загрузке…</span><b id="loadPct">0%</b></div>
      <div class="load-subdetail" id="loadSubDetail">Инициализация процесса…</div>
      <div class="load-steps-container" id="loadSteps">${stepsHtml}</div>
      <div class="load-console" id="loadConsole">
        <div class="load-console-header">
          <span>Журнал операций</span>
          <span class="console-live-tag"><span class="pulse-dot"></span> LIVE</span>
        </div>
        <div class="load-console-body" id="loadConsoleBody">
          <div class="console-line"><span class="time">${new Date().toTimeString().slice(0, 8)}</span><span>Старт анализа персонажа «${esc(c.russian || c.name || '')}»...</span></div>
        </div>
      </div>
    </div>
  `;
}

async function cachedApi(kind, key, path, forceFresh = false) {
  const m = state.cache[kind];
  if (!forceFresh && m.has(key)) return m.get(key);

  const sessionKey = `se_${kind}_${key}`;
  if (!forceFresh) {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.matched !== false && !parsed.unavailable) {
          m.set(key, parsed);
          return parsed;
        } else {
          sessionStorage.removeItem(sessionKey);
        }
      }
    } catch (_) {}
  }

  const v = await api(path);
  if (v && v.matched !== false && !v.unavailable) {
    m.set(key, v);
    try {
      sessionStorage.setItem(sessionKey, JSON.stringify(v));
    } catch (_) {}
  }
  return v;
}

async function fetchAcdb(q) {
  const key = q.id ? `id:${q.id}` : `n:${normName(q.name)}|${normName(q.title || '')}`;
  const qs = q.id ? `id=${encodeURIComponent(q.id)}` : `name=${encodeURIComponent(q.name)}&title=${encodeURIComponent(q.title || '')}`;
  const freshQuery = q.fresh ? '&fresh=1' : '';
  try {
    return await cachedApi('acdb', key, `/api/acdb-relations?${qs}${freshQuery}`, q.fresh);
  } catch (e) {
    return { matched: false, unavailable: true, relations: [], message: e.message };
  }
}

async function fetchWikidata(q) {
  const key = q.id ? `id:${q.id}` : `n:${normName(q.name)}|${normName(q.name_ru || '')}|${normName(q.title || '')}`;
  const qsParams = new URLSearchParams();
  if (q.id) qsParams.set('id', q.id);
  if (q.name) qsParams.set('name', q.name);
  if (q.name_ru) qsParams.set('name_ru', q.name_ru);
  if (q.name_ja) qsParams.set('name_ja', q.name_ja);
  if (q.title) qsParams.set('title', q.title);
  if (q.title_ru) qsParams.set('title_ru', q.title_ru);
  if (q.fresh) qsParams.set('fresh', '1');
  const qs = qsParams.toString();
  try {
    const res = await cachedApi('wd', key, `/api/wikidata-relations?${qs}`, q.fresh);
    if (res.unavailable) state.cache.wd.delete(key);
    return res;
  } catch (e) {
    return { matched: false, unavailable: true, relations: [], message: e.message };
  }
}

async function findShiki(name, nameEn = '') {
  const qName = nameEn || name;
  const key = nameKey(qName);
  if (!key) return null;
  if (state.cache.find.has(key)) return state.cache.find.get(key);
  let hit = null;
  try {
    const qs = new URLSearchParams({ name: name || '', name_en: nameEn || '' });
    const data = await api(`/api/shiki-find?${qs.toString()}`);
    const items = data.items || [];
    hit = items.find(x => isStrictMatch(x, name, nameEn)) ||
          items.find(x => {
            const nA = normName(x.name), nR = normName(x.russian), q = normName(name), qE = normName(nameEn);
            if (!q && !qE) return false;
            const qWords = [...(q ? q.split(' ') : []), ...(qE ? qE.split(' ') : [])].filter(w => w.length >= 3 && !COMMON_CLANS_SET.has(w));
            if (!qWords.length) return false;
            return qWords.some(w => (nA && nA.includes(w)) || (nR && nR.includes(w)));
          }) || null;
  } catch (_) {
    return null;
  }
  state.cache.find.set(key, hit);
  return hit;
}

async function resolveExternalNodes(rels, step, from, to, live) {
  if (!rels || !rels.length) return;

  // Step 1: Immediate synchronous match against all known loaded characters in state
  const allKnownList = [
    ...state.characters,
    ...state.relatedCharacters,
    ...state.characterDetails.values()
  ];
  for (const x of rels) {
    if (!x.shikiChar) {
      const match = allKnownList.find(k => isStrictMatch(k, x.name, x.name_en) || (x.id && String(k.id) === String(x.id)));
      if (match) {
        x.shikiChar = match;
        const img = imageUrl(match.image, 'preview') || imageUrl(match.image, 'original');
        if (img) x.image = img;
        if (match.russian) x.russian = match.russian;
        if (match.id) x.id = match.id;
      }
    }
  }

  // Step 2: Queue unresolved nodes for Shikimori search (up to 80 relatives)
  const todo = [];
  const seenNames = new Set();
  for (const r of rels) {
    if (!r.name) continue;
    if (r.shikiChar && r.image && !r.image.includes('wikimedia.org')) continue;
    const key = nameKey(r.name);
    if (!seenNames.has(key)) {
      seenNames.add(key);
      todo.push(r);
    }
  }

  const todoSlice = todo.slice(0, 80);
  if (!todoSlice.length) {
    step(to, 'Связи собраны', 'Внешние связи сопоставлены', 'external', 'Внешние персонажи обработаны');
    return;
  }

  let done = 0, cursor = 0;
  // 6 concurrent workers for fast parallel resolution
  await Promise.all(Array.from({ length: 6 }, async () => {
    while (cursor < todoSlice.length && live()) {
      const r = todoSlice[cursor++];
      const hit = await findShiki(r.name, r.name_en);
      if (hit) {
        const shikiImg = imageUrl(hit.image, 'preview') || imageUrl(hit.image, 'original');
        for (const x of rels) {
          if (nameKey(x.name) === nameKey(r.name) || (r.name_en && nameKey(x.name_en) === nameKey(r.name_en))) {
            x.shikiChar = hit;
            if (shikiImg) x.image = shikiImg;
            if (hit.russian) x.russian = hit.russian;
            if (hit.id) x.id = hit.id;
          }
        }
        if (hit.id && !state.characterDetails.has(String(hit.id))) {
          state.characterDetails.set(String(hit.id), hit);
        }
        appendLoadLog(`Найден официальный арт: ${hit.russian || hit.name}`, 'hit');
      }
      done++;
      step(from + (to - from) * done / todoSlice.length, `Сверка аватаров родственников: ${done}/${todoSlice.length}`, r.name || '', 'external', `Проверка каталога: ${r.name}`);
    }
  }));
}

let swrToastTimer;
function showSwrToast(message) {
  const toast = $('#swrToast');
  const txt = $('#swrToastText');
  if (!toast || !txt) return;
  txt.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(swrToastTimer);
  swrToastTimer = setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}

async function backgroundRevalidate(c, cachedFull, token) {
  if (!c.id) return;
  const isCurrent = () => state.openToken === token && state.current?.id === c.id;

  try {
    const [freshCharRes, freshAcdbRes, freshWdRes] = await Promise.allSettled([
      api(`/api/character?id=${c.id}&fresh=1`),
      fetchAcdb({ name: cachedFull.name || c.name, title: state.selectedAnime?.name || '', fresh: true }),
      fetchWikidata({
        name: cachedFull.name || c.name || '',
        name_ru: cachedFull.russian || c.russian || '',
        name_ja: cachedFull.japanese || c.japanese || '',
        title: state.selectedAnime?.name || '',
        title_ru: state.selectedAnime?.russian || '',
        fresh: true
      })
    ]);

    if (!isCurrent()) return;

    let hasUpdates = false;
    const newFull = { ...cachedFull };

    if (freshCharRes.status === 'fulfilled' && freshCharRes.value.character) {
      const freshChar = freshCharRes.value.character;
      if (freshChar.description && freshChar.description !== cachedFull.description) {
        newFull.description = freshChar.description;
        hasUpdates = true;
      }
    }

    let newAcdbRels = [], newWdRels = [];
    if (freshAcdbRes.status === 'fulfilled' && freshAcdbRes.value.matched) {
      newAcdbRels = (freshAcdbRes.value.relations || []).map(r => ({ ...r, source: 'acdb' }));
    }
    if (freshWdRes.status === 'fulfilled' && freshWdRes.value.matched) {
      newWdRels = (freshWdRes.value.relations || []).map(r => ({ ...r, source: 'wikidata' }));
    }

    const currentRelKeys = new Set((state.acdbRelations || []).map(r => `${r.id}:${r.kind}:${r.name}`));
    const freshCombined = [...newAcdbRels, ...newWdRels];
    const brandNewNodes = freshCombined.filter(r => !currentRelKeys.has(`${r.id}:${r.kind}:${r.name}`));

    if (brandNewNodes.length > 0) {
      hasUpdates = true;
      newFull.externalRelations = freshCombined;
      state.characterRelationsMap.set(String(c.id), freshCombined);
      if (isCurrent()) state.acdbRelations = freshCombined;
    }

    if (hasUpdates && isCurrent()) {
      newFull._renderedOnce = true;
      state.characterDetails.set(String(c.id), newFull);
      renderShikimoriProfile(c, newFull);
      showSwrToast(`⚡ Данные обновлены из сети: найдено ${brandNewNodes.length ? brandNewNodes.length + ' новых связей' : 'обновление'}!`);
    }
  } catch (_) {}
}

async function openCharacter(c, opts = {}) {
  const modal = $('#modal');
  const wasOpen = !modal.classList.contains('hidden');
  if (!wasOpen) state.history = [];
  else if (state.current && !opts.back) state.history.push(state.current);

  state.current = c;
  const token = ++state.openToken;
  const live = () => token === state.openToken;
  const step = (p, t, sub, key, log) => { if (live()) setProgress(p, t, sub, key, log); };
  const tag = (rels, source) => (rels || []).map(r => ({ ...r, source }));

  // SWR: Instant render if character data is already known
  const cachedFull = c.id ? state.characterDetails.get(String(c.id)) : null;
  const isCompleteCached = cachedFull && cachedFull.description && cachedFull._renderedOnce;

  if (isCompleteCached && !opts.forceFresh) {
    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
    updateModalNav();
    applySpoilerState();
    updateModalFavButton();
    state.acdbRelations = cachedFull.externalRelations || state.characterRelationsMap.get(String(c.id)) || [];
    renderShikimoriProfile(c, cachedFull);

    // Silent background SWR revalidation
    backgroundRevalidate(c, cachedFull, token);
    return;
  }

  const fail = (title, msg, url) => {
    if (!live()) return;
    updateModalNav();
    $('#modalContent').innerHTML = `
      <div class="profile-loading" style="padding: 30px; text-align: center;">
        <h2>${esc(title)}</h2>
        <p style="color: var(--text-muted); margin: 12px 0;">${esc(msg)}</p>
        ${url ? `<a class="source-link" href="${esc(url)}" target="_blank" rel="noreferrer">Открыть источник ↗</a>` : ''}
      </div>
    `;
  };

  const finish = async () => {
    step(100, 'Готово', 'Все связи найдены и проверены', 'tree', 'Генеалогическое древо готово к отображению');
    await new Promise(r => setTimeout(r, 180));
  };

  modal.classList.remove('hidden');
  document.body.style.overflow = 'hidden';
  showProgress(c);
  state.acdbRelations = [];

  // 1) Relative that exists only in Wikidata
  if (c.wikidataId) {
    step(12, 'Загружаю профиль из Wikidata…', `ID: ${c.wikidataId}`, 'profile', `Запрос к Wikidata API: ${c.wikidataId}`);
    const wd = await fetchWikidata({ id: c.wikidataId });
    if (!live()) return;
    if (!wd.matched) return fail(c.name || 'Персонаж', wd.message || 'Не удалось загрузить профиль Wikidata.', c.url);

    const ch = wd.character || {};
    const name = ch.name || c.name;
    const nameEn = ch.name_en || c.name_en || '';

    // Check if character already exists in current franchise roster
    const inPool = state.characters.find(x => isStrictMatch(x, name, nameEn)) ||
                   state.relatedCharacters.find(x => isStrictMatch(x, name, nameEn));
    if (inPool && inPool.id) {
      openCharacter(inPool, opts);
      return;
    }

    // Check if character exists in Shikimori: if found, open full Shikimori profile!
    step(22, 'Ищу персонажа в Shikimori…', `Имя: ${name}`, 'analysis', `Сверка с каталогом Shikimori: ${name}`);
    const shikiHit = await findShiki(name, nameEn);
    if (shikiHit && shikiHit.id) {
      openCharacter(shikiHit, opts);
      return;
    }

    let acdbRels = [], acdbSource = null;
    step(35, 'Ищу совпадения в ACDB…', 'Сверка базы аниме-персонажей', 'external', 'Поиск персонажа в ACDB...');
    try {
      const a = await fetchAcdb({ name, title: ch.anime || '' });
      if (a.matched) {
        acdbRels = tag(a.relations, 'acdb');
        acdbSource = a.character;
        appendLoadLog(`Найдено в ACDB: ${acdbRels.length} связей`, 'hit');
      }
    } catch (_) {}

    if (!live()) return;
    const extWd = [...tag(wd.relations, 'wikidata'), ...acdbRels];
    state.acdbRelations = extWd;
    if (c.wikidataId) state.characterRelationsMap.set(String(c.wikidataId), extWd);
    await resolveExternalNodes(state.acdbRelations, step, 50, 96, live);
    if (!live()) return;

    const full = { ...c, name, russian: name, image: (shikiHit ? imageUrl(shikiHit.image, 'original') : '') || ch.image || c.image || '', acdbSource };
    step(98, 'Построение генеалогического дерева…', 'Вычисление родственных связей', 'tree', 'Компоновка дерева связей');
    await finish();
    if (!live()) return;
    renderWikidataProfile(full, wd);
    return;
  }

  // 2) Relative that exists only in ACDB
  if (c.acdbId) {
    step(12, 'Загружаю профиль ACDB…', `ID: ${c.acdbId}`, 'profile', `Запрос профиля ACDB: ${c.acdbId}`);
    let data;
    try {
      data = await fetchAcdb({ id: c.acdbId });
    } catch (e) {
      return fail(c.name || 'Персонаж', `Не удалось загрузить ветку ACDB: ${e.message}`, c.url);
    }
    if (!live()) return;

    const name = data.character?.name || c.name;

    // Check if character already exists in current franchise roster
    const inPool = state.characters.find(x => isStrictMatch(x, name)) ||
                   state.relatedCharacters.find(x => isStrictMatch(x, name));
    if (inPool && inPool.id) {
      openCharacter(inPool, opts);
      return;
    }

    // Check if character exists in Shikimori
    step(22, 'Ищу персонажа в Shikimori…', `Имя: ${name}`, 'analysis', `Сверка с Shikimori: ${name}`);
    const shikiHit = await findShiki(name);
    if (shikiHit && shikiHit.id) {
      openCharacter(shikiHit, opts);
      return;
    }

    step(35, 'Дополняю связи из Wikidata…', 'Поиск сущностей Wikidata', 'external', 'Запрос связей Wikidata...');
    const wd = await fetchWikidata({ name, title: data.character?.anime || '' });
    if (!live()) return;

    const extAcdb = [...tag(data.relations, 'acdb'), ...(wd.matched ? tag(wd.relations, 'wikidata') : [])];
    state.acdbRelations = extAcdb;
    if (c.acdbId) state.characterRelationsMap.set(String(c.acdbId), extAcdb);
    await resolveExternalNodes(state.acdbRelations, step, 50, 96, live);
    if (!live()) return;

    const full = {
      ...c,
      ...(data.character || {}),
      name,
      russian: name,
      image: (shikiHit ? imageUrl(shikiHit.image, 'original') : '') || data.character?.image || c.image,
      acdbId: c.acdbId,
      external: true,
      wikidataSource: wd.matched ? wd.character : null
    };
    step(98, 'Построение генеалогического дерева…', 'Вычисление родственных связей', 'tree', 'Компоновка дерева связей');
    await finish();
    if (!live()) return;
    renderExternalProfile(full, data);
    return;
  }

  // 3) Standard Shikimori Character
  step(10, 'Загружаю данные и внешние базы…', `ID: ${c.id} · ${c.russian || c.name || ''}`, 'profile', `Запрос к Shikimori, Wikidata и ACDB...`);
  
  const charName = c.name || '';
  const charNameRu = c.russian || '';
  const charNameJa = c.japanese || '';
  const animeTitle = state.selectedAnime?.name || '';
  const animeTitleRu = state.selectedAnime?.russian || '';

  // Parallel requests to Shikimori, ACDB, and Wikidata!
  const [shikiRes, acdbRes, wdRes] = await Promise.allSettled([
    api(`/api/character?id=${c.id}`),
    fetchAcdb({ name: charName || charNameRu, title: animeTitle }),
    fetchWikidata({
      name: charName,
      name_ru: charNameRu,
      name_ja: charNameJa,
      title: animeTitle,
      title_ru: animeTitleRu
    })
  ]);
  if (!live()) return;

  let full = c;
  if (shikiRes.status === 'fulfilled' && shikiRes.value?.character) {
    full = { ...c, ...shikiRes.value.character };
    appendLoadLog(`Анкета Shikimori загружена: ${full.russian || full.name}`, 'hit');
  }
  state.characterDetails.set(String(c.id), full);

  // Process ACDB & Wikidata relations immediately
  let acdbRels = [], wdRels = [];
  if (acdbRes.status === 'fulfilled') {
    const ex = acdbRes.value;
    if (ex.matched) {
      acdbRels = tag(ex.relations, 'acdb');
      full.acdbSource = ex.character;
      full.acdbDiagnostics = ex.diagnostics || { relationRowsParsed: acdbRels.length };
      appendLoadLog(`ACDB: обнаружено ${acdbRels.length} связей`, 'hit');
    } else {
      full.acdbDiagnostics = { message: ex.message || 'Персонаж не найден в ACDB', relationRowsParsed: 0 };
    }
  }

  if (wdRes.status === 'fulfilled') {
    const wd = wdRes.value;
    if (wd.matched) {
      wdRels = tag(wd.relations, 'wikidata');
      full.wikidataSource = wd.character;
      full.wikidataDiagnostics = { relationsReturned: wdRels.length };
      appendLoadLog(`Wikidata: обнаружено ${wdRels.length} связей`, 'hit');
    } else {
      full.wikidataDiagnostics = { message: wd.message || 'Персонаж не найден в Wikidata', relationsReturned: 0 };
    }
  }

  // Fallback: if initial Wikidata search didn't match, retry with full character info (e.g. Japanese name or enriched names)
  if (wdRels.length === 0 && full && (full.japanese || full.name !== charName || full.russian !== charNameRu)) {
    try {
      const fbWd = await fetchWikidata({
        name: full.name || charName,
        name_ru: full.russian || charNameRu,
        name_ja: full.japanese || '',
        title: animeTitle,
        title_ru: animeTitleRu
      });
      if (fbWd && fbWd.matched) {
        wdRels = tag(fbWd.relations, 'wikidata');
        full.wikidataSource = fbWd.character;
        full.wikidataDiagnostics = { relationsReturned: wdRels.length };
        appendLoadLog(`Wikidata (по японскому/полному имени): обнаружено ${wdRels.length} связей`, 'hit');
      }
    } catch (_) {}
  }

  const combinedExtRels = [...wdRels, ...acdbRels];
  state.acdbRelations = combinedExtRels;
  full.externalRelations = combinedExtRels;
  if (c.id) state.characterRelationsMap.set(String(c.id), combinedExtRels);

  step(35, 'Анализирую биографии персонажей франшизы…', 'Сверка упоминаний родственников', 'roster', 'Запуск анализа биографий...');
  await loadRosterDescriptions(c.id, full, (d, n, sub, log) => {
    const pct = Math.round(35 + 30 * (n > 0 ? d / n : 1));
    step(pct, `Чтение описаний: ${d}/${n}`, sub || `Обработано ${d} из ${n}`, 'roster', log);
  }, live);
  if (!live()) return;

  step(70, 'Сопоставление внешних узлов…', 'Привязка родственников к карточкам', 'external', 'Сопоставление внешних связей...');
  await resolveExternalNodes(state.acdbRelations, step, 70, 94, live);
  if (!live()) return;

  step(98, 'Построение генеалогического дерева…', 'Вычисление поколений и структуры связей', 'tree', 'Финальная компоновка родословного древа');
  await finish();
  if (!live()) return;
  renderShikimoriProfile(c, full);
}

function renderWikidataProfile(full, data) {
  updateModalNav();
  full._renderedOnce = true;
  applySpoilerState();
  updateModalFavButton();
  const ch = data.character || {};
  const links = `
    <a class="source-link" href="${esc(ch.url || full.url || '#')}" target="_blank" rel="noreferrer">Открыть в Wikidata ↗</a>
    ${full.acdbSource ? ` · <a class="source-link" href="${esc(full.acdbSource.url)}" target="_blank" rel="noreferrer">Связи ACDB ↗</a>` : ''}
  `;

  $('#modalContent').innerHTML = `
    <div class="profile">
      <div class="profile-poster-wrap">
        <img src="${esc(imageUrl(full.image, 'original') || fallback)}" onerror="this.src='${fallback}'" alt="">
      </div>
      <div>
        <div class="eyebrow"><span class="pulse"></span> ПРОФИЛЬ ПЕРСОНАЖА · WIKIDATA</div>
        <h2 id="modalName">${esc(full.name)}</h2>
        <div class="native">${esc(ch.anime || '')}</div>
        <div class="description">${esc(ch.description || 'Описание в Wikidata отсутствует.')}</div>
        <div class="profile-links">${links}</div>
      </div>
    </div>
    ${renderFamilyTree(full, full)}
  `;
  bindFamilyTreeClicks();
}

function renderExternalProfile(full, data) {
  updateModalNav();
  full._renderedOnce = true;
  applySpoilerState();
  updateModalFavButton();
  const title = full.name || 'Персонаж';

  $('#modalContent').innerHTML = `
    <div class="profile">
      <div class="profile-poster-wrap">
        <img src="${esc(imageUrl(full.image, 'original') || fallback)}" onerror="this.src='${fallback}'" alt="">
      </div>
      <div>
        <div class="eyebrow"><span class="pulse"></span> ПРОФИЛЬ ПЕРСОНАЖА · ACDB</div>
        <h2 id="modalName">${esc(title)}</h2>
        <div class="native">${esc(data.character?.anime || '')}</div>
        <div class="description">Профиль и родственные связи получены из Anime Characters Database (пользовательская база персонажей).</div>
        <div class="profile-links">
          <a class="source-link" href="${esc(full.url || '#')}" target="_blank" rel="noreferrer">Открыть профиль ACDB ↗</a>
          <a class="source-link" href="${esc(data.character?.graphUrl || '#')}" target="_blank" rel="noreferrer">Граф ACDB ↗</a>
          ${full.wikidataSource ? `<a class="source-link" href="${esc(full.wikidataSource.url)}" target="_blank" rel="noreferrer">Wikidata ↗</a>` : ''}
        </div>
      </div>
    </div>
    ${renderFamilyTree(full, full)}
  `;
  bindFamilyTreeClicks();
}

function renderShikimoriProfile(c, full) {
  updateModalNav();
  full._renderedOnce = true;
  applySpoilerState();
  updateModalFavButton();
  const desc = plainDescription(full.description || c.description || 'Описание отсутствует в Shikimori.');
  const acdb = full.acdbSource;
  const sourceLinks = `
    <div class="profile-links">
      <a class="source-link" href="https://shikimori.one${esc(full.url || c.url || `/characters/${c.id}`)}" target="_blank" rel="noreferrer">Страница на Shikimori ↗</a>
      ${acdb ? `<a class="source-link" href="${esc(acdb.url)}" target="_blank" rel="noreferrer">Связи ACDB ↗</a>` : ''}
      ${full.wikidataSource ? `<a class="source-link" href="${esc(full.wikidataSource.url)}" target="_blank" rel="noreferrer">Wikidata ↗</a>` : ''}
    </div>
  `;

  const diag = full.acdbDiagnostics;
  const acdbStatus = diag ? `
    <div>${diag.error ? `ACDB: ${esc(diag.error)}` : diag.message ? `ACDB: ${esc(diag.message)}` : `ACDB: связей получено: ${Number(diag.relationRowsParsed || 0)}`}</div>
  ` : '';

  const wdiag = full.wikidataDiagnostics;
  const wdStatus = wdiag ? `
    <div>${wdiag.error ? `Wikidata: ${esc(wdiag.error)}` : wdiag.message ? `Wikidata: ${esc(wdiag.message)}` : `Wikidata: связей получено: ${Number(wdiag.relationsReturned || 0)}`}</div>
  ` : '';

  const diagBlock = acdbStatus || wdStatus ? `<div class="source-diagnostics">${acdbStatus}${wdStatus}</div>` : '';

  $('#modalContent').innerHTML = `
    <div class="profile">
      <div class="profile-poster-wrap">
        <img src="${esc(imageUrl(full.image || c.image, 'original') || fallback)}" onerror="this.src='${fallback}'" alt="">
      </div>
      <div>
        <div class="eyebrow"><span class="pulse"></span> ПРОФИЛЬ ПЕРСОНАЖА</div>
        <h2 id="modalName">${esc(full.russian || c.russian || full.name || c.name)}</h2>
        <div class="native">${esc(full.name || c.name || '')}</div>
        <div class="description">${esc(desc)}</div>
        ${sourceLinks}
        ${diagBlock}
      </div>
    </div>
    ${renderFamilyTree(c, full)}
  `;
  bindFamilyTreeClicks();
}

function bindFamilyTreeClicks() {
  const root = $('#modalContent');
  if (!root) return;

  root.querySelectorAll('[data-family-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.familyId;
      const next = state.characters.find(x => String(x.id) === id) ||
        state.relatedCharacters.find(x => String(x.id) === id) ||
        { id, name: btn.dataset.name || '', russian: btn.dataset.name || '', image: btn.dataset.image || '' };
      openCharacter(next);
    });
  });

  root.querySelectorAll('[data-wikidata-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.wikidataId;
      const node = state.acdbRelations.find(x => String(x.id) === String(id));
      openCharacter({
        id: null,
        wikidataId: id,
        name: node?.name || btn.dataset.name || 'Персонаж',
        russian: node?.name || btn.dataset.name || 'Персонаж',
        image: node?.image || btn.dataset.image || '',
        url: node?.url || ''
      });
    });
  });

  root.querySelectorAll('[data-acdb-id]').forEach(btn => {
    btn.addEventListener('click', () => {
      const acdbId = btn.dataset.acdbId;
      const node = state.acdbRelations.find(x => String(x.id) === String(acdbId) && x.source !== 'wikidata');
      const inShiki = state.characters.find(x => nameKey(x.name || x.russian) === nameKey(node?.name || ''));
      if (inShiki) openCharacter(inShiki);
      else {
        openCharacter({
          id: null,
          acdbId,
          name: node?.name || btn.dataset.name || 'Персонаж',
          russian: node?.name || btn.dataset.name || 'Персонаж',
          image: node?.image || btn.dataset.image || '',
          url: node?.url || ''
        });
      }
    });
  });
}

/* ========================================================
   FAVORITES FUNCTIONALITY
   ======================================================== */
function updateFavBadge() {
  const badge = $('#favCountBadge');
  if (badge) badge.textContent = String(state.favorites.length);
  const tabBadge = document.getElementById('tabFavCount');
  if (tabBadge) tabBadge.textContent = String(state.favorites.length);
}

function updateModalFavButton() {
  const btn = $('#btnFavModal');
  if (!btn || !state.current) return;
  const isFav = state.favorites.some(f => String(f.id) === String(state.current.id));
  btn.classList.toggle('fav-active', isFav);
  btn.textContent = isFav ? '⭐ В избранном' : '☆ В избранное';
}

function toggleFavorite(c) {
  if (!c || !c.id) return;
  const idx = state.favorites.findIndex(f => String(f.id) === String(c.id));
  if (idx !== -1) {
    state.favorites.splice(idx, 1);
  } else {
    state.favorites.push({
      id: c.id,
      name: c.name,
      russian: c.russian,
      image: c.image,
      role: c.role,
      animeName: state.selectedAnime?.russian || state.selectedAnime?.name || ''
    });
  }
  localStorage.setItem('se_favs', JSON.stringify(state.favorites));
  updateFavBadge();
  updateModalFavButton();
}

function openFavoritesModal() {
  const modal = $('#favoritesModal');
  const list = $('#favoritesList');
  const empty = $('#emptyFavorites');
  if (!modal || !list || !empty) return;

  modal.classList.remove('hidden');
  updateFavBadge();

  if (!state.favorites.length) {
    empty.classList.remove('hidden');
    list.innerHTML = '';
    return;
  }

  empty.classList.add('hidden');
  list.innerHTML = state.favorites.map((f, i) => `
    <div class="fav-item" data-fav-id="${esc(f.id)}">
      <img src="${esc(imageUrl(f.image, 'preview') || fallback)}" onerror="this.src='${fallback}'" alt="">
      <div class="fav-item-info">
        <h4>${esc(f.russian || f.name)}</h4>
        <p>${esc(f.animeName || '')}</p>
      </div>
      <button type="button" class="fav-item-remove" data-remove-fav="${i}" title="Удалить из избранного">✕</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-fav-id]').forEach(item => {
    item.addEventListener('click', (e) => {
      if (e.target.closest('[data-remove-fav]')) return;
      const id = item.dataset.favId;
      modal.classList.add('hidden');
      const found = state.characters.find(x => String(x.id) === String(id)) || { id };
      openCharacter(found);
    });
  });

  list.querySelectorAll('[data-remove-fav]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = Number(btn.dataset.removeFav);
      state.favorites.splice(idx, 1);
      localStorage.setItem('se_favs', JSON.stringify(state.favorites));
      openFavoritesModal();
    });
  });
}

/* ========================================================
   SPOILER SHIELD TOGGLE
   ======================================================== */
function applySpoilerState() {
  const modal = $('#modal');
  if (modal) modal.classList.toggle('spoiler-shield', state.spoilersHidden);
  const icon = $('#spoilerIcon');
  const txt = $('#spoilerText');
  const btn = $('#btnSpoilerToggle');
  if (icon) icon.textContent = state.spoilersHidden ? '🙈' : '👁️';
  if (txt) txt.textContent = state.spoilersHidden ? 'Спойлеры: Скрыты' : 'Спойлеры: Показаны';
  if (btn) btn.classList.toggle('active', state.spoilersHidden);
}

function toggleSpoilerShield() {
  state.spoilersHidden = !state.spoilersHidden;
  localStorage.setItem('se_spoilers', String(state.spoilersHidden));
  applySpoilerState();
}

/* ========================================================
   KINSHIP PATHFINDING (BFS GRAPH SEARCH)
   ======================================================== */
function populateRosterDatalist() {
  const dl = $('#rosterList');
  if (!dl) return;
  const uniqueNames = [...new Set(state.characters.flatMap(c => [c.russian, c.name]).filter(Boolean))];
  dl.innerHTML = uniqueNames.map(n => `<option value="${esc(n)}"></option>`).join('');
}

function openKinshipModal() {
  const modal = $('#kinshipModal');
  if (modal) {
    populateRosterDatalist();
    modal.classList.remove('hidden');
    $('#kinshipResult').classList.add('hidden');
  }
}

async function findKinshipPath() {
  const nameA = $('#kinshipA').value.trim();
  const nameB = $('#kinshipB').value.trim();
  const resWrap = $('#kinshipResult');
  const btn = $('#btnFindKinship');
  if (!nameA || !nameB || !resWrap) return;

  resWrap.classList.remove('hidden');
  resWrap.innerHTML = `
    <div style="text-align: center; padding: 20px;">
      <span class="status-dot"></span>
      <p style="color: var(--cyan); font-weight: 700; margin-top: 10px;">
        Анализирую базы Shikimori, Wikidata и ACDB для «${esc(nameA)}» и «${esc(nameB)}»…
      </p>
    </div>
  `;
  if (btn) btn.disabled = true;

  try {
    let allChars = [...state.characters, ...state.relatedCharacters, ...state.characterDetails.values()];
    
    // Find or fetch Character A
    let charA = allChars.find(x => isStrictMatch(x, nameA)) || 
                allChars.find(x => `${x.russian || ''} ${x.name || ''}`.toLowerCase().includes(nameA.toLowerCase()));
    if (!charA) {
      const hitA = await findShiki(nameA);
      if (hitA) {
        charA = hitA;
        allChars.push(charA);
      }
    }

    // Find or fetch Character B
    let charB = allChars.find(x => isStrictMatch(x, nameB)) || 
                allChars.find(x => `${x.russian || ''} ${x.name || ''}`.toLowerCase().includes(nameB.toLowerCase()));
    if (!charB) {
      const hitB = await findShiki(nameB);
      if (hitB) {
        charB = hitB;
        allChars.push(charB);
      }
    }

    if (!charA || !charB) {
      resWrap.innerHTML = `
        <div style="text-align: center; padding: 10px;">
          <h4 style="color: var(--rose);">Персонаж не найден</h4>
          <p style="color: var(--text-muted); font-size: 13px;">
            Не удалось найти ${!charA ? `«${esc(nameA)}»` : `«${esc(nameB)}»`} в Shikimori. Проверьте правильность написания имени.
          </p>
        </div>
      `;
      return;
    }

    if (String(charA.id) === String(charB.id)) {
      resWrap.innerHTML = `<p class="empty">Вы выбрали одного и того же персонажа.</p>`;
      return;
    }

    // Fetch full profiles & relations for both characters if not already loaded
    async function ensureDetails(c) {
      let full = state.characterDetails.get(String(c.id));
      if (!full || !full.description) {
        try {
          const res = await api(`/api/character?id=${c.id}`);
          full = { ...c, ...(res.character || {}) };
          state.characterDetails.set(String(c.id), full);
        } catch (_) {
          full = c;
        }
      }

      // Fetch ACDB & Wikidata relations
      const [acdb, wd] = await Promise.allSettled([
        fetchAcdb({ name: full.name || c.name, title: state.selectedAnime?.name || '' }),
        fetchWikidata({ name: full.name || c.name, title: state.selectedAnime?.name || '' })
      ]);

      const extRels = [];
      if (acdb.status === 'fulfilled' && acdb.value.matched) {
        extRels.push(...(acdb.value.relations || []).map(r => ({ ...r, source: 'acdb' })));
        full.acdbSource = acdb.value.character;
      }
      if (wd.status === 'fulfilled' && wd.value.matched) {
        extRels.push(...(wd.value.relations || []).map(r => ({ ...r, source: 'wikidata' })));
        full.wikidataSource = wd.value.character;
      }
      return { full, extRels };
    }

    const [dataA, dataB] = await Promise.all([ensureDetails(charA), ensureDetails(charB)]);
    const fullA = dataA.full, extA = dataA.extRels;
    const fullB = dataB.full, extB = dataB.extRels;

    // Evaluate separate trees
    state.acdbRelations = extA;
    const treeA = makeFamilyTree(charA, fullA);
    state.acdbRelations = extB;
    const treeB = makeFamilyTree(charB, fullB);

    // 1. Direct match check: Is B directly in A's family tree?
    let directRelationText = null;
    for (const [kind, list] of Object.entries(treeA.groups)) {
      const match = list.find(r => (r.id && charB.id && String(r.id) === String(charB.id)) || isStrictMatch(r, charB.name, charB.russian) || isStrictMatch(charB, r.name, r.russian));
      if (match) {
        const lbl = match.relationLabel || (kind === 'partner' ? 'Супруг(а)' : kind === 'parent' ? 'Родитель' : kind === 'child' ? 'Ребёнок' : kind === 'sibling' ? 'Брат / Сестра' : 'Родственник');
        directRelationText = `${esc(charB.russian || charB.name)} — ${lbl.toLowerCase()} для ${esc(charA.russian || charA.name)}`;
        break;
      }
    }

    // Is A directly in B's family tree?
    if (!directRelationText) {
      for (const [kind, list] of Object.entries(treeB.groups)) {
        const match = list.find(r => (r.id && charA.id && String(r.id) === String(charA.id)) || isStrictMatch(r, charA.name, charA.russian) || isStrictMatch(charA, r.name, r.russian));
        if (match) {
          const lbl = match.relationLabel || (kind === 'partner' ? 'Супруг(а)' : kind === 'parent' ? 'Родитель' : kind === 'child' ? 'Ребёнок' : kind === 'sibling' ? 'Брат / Сестра' : 'Родственник');
          directRelationText = `${esc(charA.russian || charA.name)} — ${lbl.toLowerCase()} для ${esc(charB.russian || charB.name)}`;
          break;
        }
      }
    }

    // Direct check in raw external relations (Wikidata / ACDB)
    if (!directRelationText) {
      const hitA = extA.find(r => isStrictMatch(charB, r.name, r.name_en) || isStrictMatch(r, charB.name, charB.russian));
      if (hitA) {
        const lbl = hitA.label || hitA.kind || 'Родственник';
        directRelationText = `${esc(charB.russian || charB.name)} — ${lbl.toLowerCase()} для ${esc(charA.russian || charA.name)}`;
      }
    }
    if (!directRelationText) {
      const hitB = extB.find(r => isStrictMatch(charA, r.name, r.name_en) || isStrictMatch(r, charA.name, charA.russian));
      if (hitB) {
        const lbl = hitB.label || hitB.kind || 'Родственник';
        directRelationText = `${esc(charA.russian || charA.name)} — ${lbl.toLowerCase()} для ${esc(charB.russian || charB.name)}`;
      }
    }

    // Direct relation found! (e.g. Naruto & Hinata -> Хината — жена для Наруто)
    if (directRelationText) {
      resWrap.innerHTML = `
        <div style="margin-bottom: 16px;">
          <span class="eyebrow"><span class="status-dot"></span> ПРЯМАЯ РОДСТВЕННАЯ СВЯЗЬ НАЙДЕНА</span>
        </div>
        <div class="kinship-chain">
          <div class="kinship-node" data-char-id="${charA.id || ''}">
            <img class="kinship-node-img" src="${esc(imageUrl(charA.image, 'preview') || fallback)}" onerror="this.src='${fallback}'" alt="">
            <strong>${esc(charA.russian || charA.name)}</strong>
          </div>
          <div class="kinship-edge">
            <span class="kinship-edge-label">${directRelationText}</span>
            <div class="kinship-edge-line"></div>
          </div>
          <div class="kinship-node" data-char-id="${charB.id || ''}">
            <img class="kinship-node-img" src="${esc(imageUrl(charB.image, 'preview') || fallback)}" onerror="this.src='${fallback}'" alt="">
            <strong>${esc(charB.russian || charB.name)}</strong>
          </div>
        </div>
      `;
      bindKinshipNodeClicks(resWrap);
      return;
    }

    // 2. Graph BFS Pathfinding (via common relatives)
    const adj = new Map();
    const addEdge = (u, v, label) => {
      const su = String(u), sv = String(v);
      if (!su || !sv || su === sv) return;
      if (!adj.has(su)) adj.set(su, []);
      if (!adj.has(sv)) adj.set(sv, []);
      adj.get(su).push({ to: sv, label });
      adj.get(sv).push({ to: su, label });
    };

    const nodePool = new Map();
    const registerNode = (node) => {
      for (const [gid, existing] of nodePool.entries()) {
        if ((node.id && existing.id && String(node.id) === String(existing.id)) ||
            (node.wikidataId && existing.wikidataId && node.wikidataId === existing.wikidataId) ||
            (node.acdbId && existing.acdbId && String(node.acdbId) === String(existing.acdbId)) ||
            isStrictMatch(existing, node.name, node.russian) ||
            isStrictMatch(node, existing.name, existing.russian)) {
          return gid;
        }
      }
      const gid = String(node.id || node.wikidataId || node.acdbId || nameKey(node.russian || node.name));
      nodePool.set(gid, node);
      return gid;
    };

    const gidA = registerNode(charA);
    const gidB = registerNode(charB);

    // Add edges from Tree A
    for (const [kind, list] of Object.entries(treeA.groups)) {
      for (const r of list) {
        const gidR = registerNode(r);
        addEdge(gidA, gidR, r.relationLabel || kind);
      }
    }
    // Add edges from Tree B
    for (const [kind, list] of Object.entries(treeB.groups)) {
      for (const r of list) {
        const gidR = registerNode(r);
        addEdge(gidB, gidR, r.relationLabel || kind);
      }
    }

    // BFS search
    const queue = [[gidA]];
    const visited = new Set([gidA]);
    const edgeUsed = new Map();
    let foundPath = null;

    while (queue.length > 0) {
      const path = queue.shift();
      const curr = path[path.length - 1];
      if (curr === gidB) {
        foundPath = path;
        break;
      }
      for (const edge of (adj.get(curr) || [])) {
        if (!visited.has(edge.to)) {
          visited.add(edge.to);
          edgeUsed.set(`${curr}->${edge.to}`, edge.label);
          edgeUsed.set(`${edge.to}->${curr}`, edge.label);
          queue.push([...path, edge.to]);
        }
      }
    }

    if (!foundPath) {
      resWrap.innerHTML = `
        <div style="text-align: center; padding: 12px;">
          <h4 style="color: var(--gold); margin-bottom: 8px;">Прямая связь не обнаружена</h4>
          <p style="color: var(--text-muted); font-size: 13px;">
            Персонажи <strong>«${esc(charA.russian || charA.name)}»</strong> и <strong>«${esc(charB.russian || charB.name)}»</strong> не имеют подтверждённых общих родственников в базах Shikimori/Wikidata/ACDB.
          </p>
        </div>
      `;
      return;
    }

    // Render multi-hop kinship chain
    const nodesHtml = foundPath.map((gid, idx) => {
      const ch = nodePool.get(gid) || { id: gid, name: `ID #${gid}` };
      const nodeEl = `
        <div class="kinship-node" data-char-id="${esc(ch.id || '')}">
          <img class="kinship-node-img" src="${esc(imageUrl(ch.image, 'preview') || fallback)}" onerror="this.src='${fallback}'" alt="">
          <strong>${esc(ch.russian || ch.name)}</strong>
        </div>
      `;

      if (idx < foundPath.length - 1) {
        const nextGid = foundPath[idx + 1];
        const relLabel = edgeUsed.get(`${gid}->${nextGid}`) || 'Родство';
        return `
          ${nodeEl}
          <div class="kinship-edge">
            <span class="kinship-edge-label">${esc(relLabel)}</span>
            <div class="kinship-edge-line"></div>
          </div>
        `;
      }
      return nodeEl;
    }).join('');

    resWrap.innerHTML = `
      <div style="margin-bottom: 16px;">
        <span class="eyebrow"><span class="status-dot"></span> ЦЕПОЧКА РОДСТВА НАЙДЕНА (${foundPath.length - 1} шагов)</span>
      </div>
      <div class="kinship-chain">${nodesHtml}</div>
    `;
    bindKinshipNodeClicks(resWrap);

  } catch (err) {
    resWrap.innerHTML = `<p class="empty" style="color: var(--rose);">Ошибка при поиске связи: ${esc(err.message)}</p>`;
  } finally {
    if (btn) btn.disabled = false;
  }
}

function bindKinshipNodeClicks(wrap) {
  wrap.querySelectorAll('.kinship-node').forEach(node => {
    node.addEventListener('click', () => {
      const id = node.dataset.charId;
      if (!id) return;
      $('#kinshipModal').classList.add('hidden');
      openCharacter({ id });
    });
  });
}

/* ========================================================
   EXPORT FAMILY TREE TO PNG (CANVAS)
   ======================================================== */
function drawRoundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  }
}

function drawImageCover(ctx, img, x, y, w, h) {
  if (!img) return;
  const nw = img.naturalWidth || img.width;
  const nh = img.naturalHeight || img.height;
  if (!nw || !nh) {
    ctx.drawImage(img, x, y, w, h);
    return;
  }
  const scale = Math.max(w / nw, h / nh);
  const sw = w / scale;
  const sh = h / scale;
  const sx = (nw - sw) / 2;
  const sy = (nh - sh) / 2;
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
}

function getProxyImageUrl(rawUrl) {
  if (!rawUrl) return '';
  if (rawUrl.startsWith('data:')) return rawUrl;
  const full = rawUrl.startsWith('http') ? rawUrl : `https://shikimori.one${rawUrl}`;
  return `/api/proxy-image?url=${encodeURIComponent(full)}`;
}

function preloadImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.crossOrigin = 'anonymous';
    let settled = false;
    const done = (res) => {
      if (!settled) {
        settled = true;
        resolve(res);
      }
    };
    img.onload = () => done(img);
    img.onerror = () => done(null);
    setTimeout(() => done(null), 4000);
    img.src = getProxyImageUrl(src);
  });
}

async function exportTreeToPng() {
  const current = state.current;
  if (!current) return;

  const btn = $('#btnExportPng');
  const originalBtnText = btn ? btn.innerHTML : '';
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span>⏳ Экспорт PNG…</span>';
  }

  try {
    const full = state.characterDetails.get(String(current.id)) || current;
    const tree = makeFamilyTree(current, full);
    const g = tree.groups;
    const mentions = (tree.mentioned || []).filter(c => !Object.values(g).flat().some(x => String(x.id) === String(c.id)));

    const tiers = [
      { key: 'grandparent', title: 'ДЕДУШКИ И БАБУШКИ', icon: '📜', color: '#c084fc', items: g.grandparent || [] },
      { key: 'parent', title: 'РОДИТЕЛИ И ПРЕДКИ', icon: '👑', color: '#fbbf24', items: g.parent || [] },
      { key: 'parent_in_law', title: 'РОДИТЕЛИ СУПРУГА(И)', icon: '🏛️', color: '#f59e0b', items: g.parent_in_law || [] },
      { key: 'partner', title: 'СУПРУГИ И ПАРТНЁРЫ', icon: '💍', color: '#fb7185', items: g.partner || [] },
      { key: 'sibling', title: 'БРАТЬЯ И СЁСТРЫ', icon: '🤝', color: '#38bdf8', items: g.sibling || [] },
      { key: 'sibling_in_law', title: 'РОДНЯ СУПРУГА(И)', icon: '👥', color: '#818cf8', items: g.sibling_in_law || [] },
      { key: 'cousin', title: 'ДВОЮРОДНЫЕ (КУЗЕНЫ)', icon: '👥', color: '#60a5fa', items: g.cousin || [] },
      { key: 'uncle_aunt', title: 'ДЯДИ И ТЁТИ', icon: '👥', color: '#f59e0b', items: g.uncle_aunt || [] },
      { key: 'child', title: 'ДЕТИ И ПОТОМКИ', icon: '👶', color: '#34d399', items: g.child || [] },
      { key: 'nephew_niece', title: 'ПЛЕМЯННИКИ', icon: '🌿', color: '#6ee7b7', items: g.nephew_niece || [] },
      { key: 'child_in_law', title: 'ЗЯТЬЯ И НЕВЕСТКИ', icon: '🌱', color: '#2dd4bf', items: g.child_in_law || [] },
      { key: 'grandchild', title: 'ВНУКИ И ВНУЧКИ', icon: '🌟', color: '#10b981', items: g.grandchild || [] },
      { key: 'other', title: 'ДРУГИЕ РОДСТВЕННИКИ', icon: '🧬', color: '#94a3b8', items: g.other || [] },
      { key: 'mentioned', title: 'УПОМЯНУТЫ В БИОГРАФИИ', icon: '💬', color: '#c084fc', items: mentions || [] }
    ].filter(t => t.items.length > 0);

    const totalRelatives = Object.values(g).reduce((sum, arr) => sum + (arr ? arr.length : 0), 0);

    // Preload hero image and relative avatars
    const heroImgUrl = imageUrl(full.image || current.image, 'original') || imageUrl(full.image || current.image, 'preview');
    const heroImgPromise = preloadImage(heroImgUrl);

    const relImgMap = new Map();
    const relImgPromises = [];
    for (const t of tiers) {
      for (const rel of t.items) {
        const u = imageUrl(rel.image, 'preview') || (typeof rel.image === 'string' ? rel.image : '');
        if (u && !relImgMap.has(u)) {
          relImgMap.set(u, null);
          relImgPromises.push(preloadImage(u).then(img => { relImgMap.set(u, img); }));
        }
      }
    }

    const [heroImg] = await Promise.all([heroImgPromise, Promise.all(relImgPromises)]);

    // Canvas sizing
    const W = 1440;
    const MARGIN = 44;
    const CONTENT_W = W - 2 * MARGIN; // 1352px
    const COLS = 4;
    const GAP_X = 16;
    const CARD_W = Math.floor((CONTENT_W - (COLS - 1) * GAP_X) / COLS); // ~326px
    const CARD_H = 74;
    const GAP_Y = 12;
    const HERO_H = 175;
    const TIER_HEAD_H = 48;
    const TIER_MB = 28;

    let computedY = MARGIN + HERO_H + 34;
    const tierLayouts = [];
    for (const t of tiers) {
      const rows = Math.ceil(t.items.length / COLS);
      const tierH = TIER_HEAD_H + rows * CARD_H + (rows - 1) * GAP_Y;
      tierLayouts.push({ tier: t, y: computedY, rows, height: tierH });
      computedY += tierH + TIER_MB;
    }
    const FOOTER_H = 50;
    const TOTAL_H = Math.max(800, computedY + FOOTER_H);

    // High-DPI scale (2x) for retina sharpness
    const dpr = 2;
    const canvas = document.createElement('canvas');
    canvas.width = W * dpr;
    canvas.height = TOTAL_H * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    // Background gradient
    const bgGrad = ctx.createLinearGradient(0, 0, W, TOTAL_H);
    bgGrad.addColorStop(0, '#090814');
    bgGrad.addColorStop(0.5, '#0f0e20');
    bgGrad.addColorStop(1, '#080712');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, W, TOTAL_H);

    // Decorative radial glow behind hero
    const radGlow = ctx.createRadialGradient(200, 100, 10, 200, 100, 450);
    radGlow.addColorStop(0, 'rgba(124, 58, 237, 0.22)');
    radGlow.addColorStop(1, 'rgba(124, 58, 237, 0)');
    ctx.fillStyle = radGlow;
    ctx.fillRect(0, 0, W, 450);

    // Outer border
    ctx.strokeStyle = 'rgba(124, 58, 237, 0.35)';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, 16, 16, W - 32, TOTAL_H - 32, 16);
    ctx.stroke();

    // HERO CARD
    const heroX = MARGIN;
    const heroY = MARGIN;
    ctx.fillStyle = 'rgba(23, 21, 39, 0.85)';
    ctx.strokeStyle = 'rgba(139, 92, 246, 0.35)';
    ctx.lineWidth = 1;
    drawRoundRect(ctx, heroX, heroY, CONTENT_W, HERO_H, 14);
    ctx.fill();
    ctx.stroke();

    // Hero Avatar
    const avX = heroX + 22;
    const avY = heroY + 22;
    const avW = 96;
    const avH = 130;
    ctx.save();
    drawRoundRect(ctx, avX, avY, avW, avH, 10);
    ctx.clip();
    if (heroImg) {
      drawImageCover(ctx, heroImg, avX, avY, avW, avH);
    } else {
      ctx.fillStyle = '#1e1c32';
      ctx.fillRect(avX, avY, avW, avH);
      ctx.fillStyle = '#a78bfa';
      ctx.font = 'bold 36px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText((current.russian || current.name || 'P')[0], avX + avW / 2, avY + avH / 2);
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.5)';
    ctx.lineWidth = 1.5;
    drawRoundRect(ctx, avX, avY, avW, avH, 10);
    ctx.stroke();

    // Hero Info
    const infoX = avX + avW + 26;
    ctx.fillStyle = '#a78bfa';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText('ГЕНЕАЛОГИЧЕСКАЯ КАРТА СВЯЗЕЙ', infoX, heroY + 24);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 28px sans-serif';
    const mainTitle = current.russian || current.name || 'Персонаж';
    ctx.fillText(mainTitle, infoX, heroY + 44);

    if (current.name && current.russian && current.name !== current.russian) {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '15px sans-serif';
      ctx.fillText(current.name, infoX, heroY + 80);
    }

    // Hero Pills
    const pillY = heroY + 112;
    let pillX = infoX;

    // Franchise Pill
    const franchiseName = state.selectedAnime?.russian || state.selectedAnime?.name || 'Франшиза';
    ctx.font = 'bold 12px sans-serif';
    const fWidth = ctx.measureText(franchiseName).width + 24;
    ctx.fillStyle = 'rgba(124, 58, 237, 0.2)';
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
    drawRoundRect(ctx, pillX, pillY, fWidth, 26, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#c4b5fd';
    ctx.fillText(`🎬 ${franchiseName}`, pillX + 12, pillY + 7);
    pillX += fWidth + 12;

    // Relatives Pill
    const relText = `Подтверждённых родственников: ${totalRelatives}`;
    const rWidth = ctx.measureText(relText).width + 24;
    ctx.fillStyle = 'rgba(16, 185, 129, 0.18)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
    drawRoundRect(ctx, pillX, pillY, rWidth, 26, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#6ee7b7';
    ctx.fillText(`✓ ${relText}`, pillX + 12, pillY + 7);
    pillX += rWidth + 12;

    // Source pill
    const srcText = 'Shikimori · Wikidata · ACDB';
    const sWidth = ctx.measureText(srcText).width + 24;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    drawRoundRect(ctx, pillX, pillY, sWidth, 26, 13);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#cbd5e1';
    ctx.fillText(srcText, pillX + 12, pillY + 7);

    // DRAW EACH GENERATION TIER
    for (const tl of tierLayouts) {
      const { tier, y } = tl;

      // Tier Header
      ctx.fillStyle = tier.color;
      ctx.font = 'bold 16px sans-serif';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(`${tier.icon}  ${tier.title}`, MARGIN, y);

      // Count badge
      const countStr = String(tier.items.length);
      ctx.font = 'bold 12px sans-serif';
      const cW = ctx.measureText(countStr).width + 16;
      const cX = MARGIN + ctx.measureText(`${tier.icon}  ${tier.title}`).width + 14;
      ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
      drawRoundRect(ctx, cX, y - 1, cW, 20, 10);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(countStr, cX + 8, y + 2);

      // Horizontal separator line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(cX + cW + 16, y + 10);
      ctx.lineTo(MARGIN + CONTENT_W, y + 10);
      ctx.stroke();

      // Cards Grid
      const gridY = y + 30;
      tier.items.forEach((rel, idx) => {
        const col = idx % COLS;
        const row = Math.floor(idx / COLS);
        const cardX = MARGIN + col * (CARD_W + GAP_X);
        const cardY = gridY + row * (CARD_H + GAP_Y);

        // Card Box
        ctx.fillStyle = 'rgba(22, 20, 36, 0.95)';
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.09)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, cardX, cardY, CARD_W, CARD_H, 10);
        ctx.fill();
        ctx.stroke();

        // Left accent bar
        ctx.fillStyle = tier.color;
        ctx.beginPath();
        drawRoundRect(ctx, cardX, cardY, 4, CARD_H, 2);
        ctx.fill();

        // Avatar
        const cAvX = cardX + 12;
        const cAvY = cardY + 11;
        const cAvSize = 52;
        ctx.save();
        drawRoundRect(ctx, cAvX, cAvY, cAvSize, cAvSize, 8);
        ctx.clip();
        const rImgUrl = imageUrl(rel.image, 'preview') || (typeof rel.image === 'string' ? rel.image : '');
        const rImg = rImgUrl ? relImgMap.get(rImgUrl) : null;
        if (rImg) {
          drawImageCover(ctx, rImg, cAvX, cAvY, cAvSize, cAvSize);
        } else {
          ctx.fillStyle = '#1c1a2d';
          ctx.fillRect(cAvX, cAvY, cAvSize, cAvSize);
          ctx.fillStyle = tier.color;
          ctx.font = 'bold 20px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText((rel.russian || rel.name || '?')[0], cAvX + cAvSize / 2, cAvY + cAvSize / 2);
        }
        ctx.restore();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        drawRoundRect(ctx, cAvX, cAvY, cAvSize, cAvSize, 8);
        ctx.stroke();

        // Names & Labels
        const textX = cAvX + cAvSize + 12;
        const maxTextW = CARD_W - (cAvSize + 36);

        // Name
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 13.5px sans-serif';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        let rName = rel.russian || rel.name || 'Персонаж';
        if (ctx.measureText(rName).width > maxTextW) {
          while (rName.length > 3 && ctx.measureText(rName + '…').width > maxTextW) {
            rName = rName.slice(0, -1);
          }
          rName += '…';
        }
        ctx.fillText(rName, textX, cardY + 14);

        // Relationship badge & Source pill
        const badgeY = cardY + 38;
        const relLabel = rel.relationLabel || 'Родственник';
        ctx.font = 'bold 11px sans-serif';
        const lblW = ctx.measureText(relLabel).width + 14;

        ctx.fillStyle = tier.color;
        ctx.globalAlpha = 0.18;
        drawRoundRect(ctx, textX, badgeY, lblW, 20, 6);
        ctx.fill();
        ctx.globalAlpha = 1.0;

        ctx.fillStyle = tier.color;
        ctx.fillText(relLabel, textX + 7, badgeY + 4);

        // Source badge
        const ev = String(rel.evidence || '');
        const srcBadge = rel.sources || (ev.startsWith('Wikidata') ? 'WD' : ev.startsWith('ACDB') ? 'ACDB' : 'SH');
        const srcW = ctx.measureText(srcBadge).width + 10;
        const srcX = textX + lblW + 8;
        if (srcX + srcW <= cardX + CARD_W - 8) {
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
          drawRoundRect(ctx, srcX, badgeY, srcW, 20, 6);
          ctx.fill();
          ctx.fillStyle = '#94a3b8';
          ctx.fillText(srcBadge, srcX + 5, badgeY + 4);
        }
      });
    }

    // FOOTER
    const footerY = computedY + 10;
    ctx.fillStyle = '#64748b';
    ctx.font = '12px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const dateStr = new Date().toLocaleDateString('ru-RU');
    ctx.fillText(`Сгенерировано в Shikimori Explorer (Shikimori API + Wikidata + ACDB) · ${dateStr}`, MARGIN, footerY);

    ctx.textAlign = 'right';
    ctx.fillText('shikimori.one · wikidata.org', MARGIN + CONTENT_W, footerY);

    // Save PNG
    canvas.toBlob((blob) => {
      if (!blob) {
        if (btn) btn.innerHTML = originalBtnText;
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (current.russian || current.name || 'character').toLowerCase().replace(/[^a-zа-я0-9]/gi, '-');
      a.download = `${safeName}-family-tree.png`;
      a.href = url;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 10000);

      if (btn) {
        btn.innerHTML = '<span>✓ Скачано!</span>';
        setTimeout(() => {
          btn.disabled = false;
          btn.innerHTML = originalBtnText;
        }, 2500);
      }
    }, 'image/png');

  } catch (err) {
    console.error('PNG export error:', err);
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalBtnText;
    }
  }
}

function closeModal() {
  state.openToken++;
  state.history = [];
  state.current = null;
  $('#modal').classList.add('hidden');
  document.body.style.overflow = '';
}

$('#closeModal').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => {
  if (e.target.dataset.close) closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!$('#kinshipModal').classList.contains('hidden')) {
      $('#kinshipModal').classList.add('hidden');
    } else if (!$('#favoritesModal').classList.contains('hidden')) {
      $('#favoritesModal').classList.add('hidden');
    } else if (!$('#modal').classList.contains('hidden')) {
      closeModal();
    }
  }
});

// Kinship modal events
$('#btnKinship').addEventListener('click', openKinshipModal);
$('#btnNavKinship')?.addEventListener('click', () => {
  $('#titleSection')?.classList.add('hidden');
  $('#resultsSection')?.classList.add('hidden');
  $('#kinshipCatalogSection')?.classList.remove('hidden');
  $('#titlesCatalogSection')?.classList.remove('hidden');
  document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#btnNavTitles')?.addEventListener('click', () => {
  $('#titleSection')?.classList.add('hidden');
  $('#resultsSection')?.classList.add('hidden');
  $('#kinshipCatalogSection')?.classList.remove('hidden');
  $('#titlesCatalogSection')?.classList.remove('hidden');
  document.getElementById('titlesCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
});
$('#closeKinshipModal').addEventListener('click', () => $('#kinshipModal').classList.add('hidden'));
$('#kinshipModal').addEventListener('click', (e) => {
  if (e.target.dataset.close === 'kinship') $('#kinshipModal').classList.add('hidden');
});
$('#btnFindKinship').addEventListener('click', findKinshipPath);

// Presets click listeners
$$('.preset-tag').forEach(btn => {
  btn.addEventListener('click', () => {
    $('#kinshipA').value = btn.dataset.a || '';
    $('#kinshipB').value = btn.dataset.b || '';
    findKinshipPath();
  });
});
$('#kinshipA').addEventListener('keydown', (e) => { if (e.key === 'Enter') findKinshipPath(); });
$('#kinshipB').addEventListener('keydown', (e) => { if (e.key === 'Enter') findKinshipPath(); });

// Favorites modal events
$('#btnFavorites').addEventListener('click', openFavoritesModal);
$('#closeFavoritesModal').addEventListener('click', () => $('#favoritesModal').classList.add('hidden'));
$('#favoritesModal').addEventListener('click', (e) => {
  if (e.target.dataset.close === 'favorites') $('#favoritesModal').classList.add('hidden');
});
$('#btnClearFavorites').addEventListener('click', () => {
  state.favorites = [];
  localStorage.setItem('se_favs', '[]');
  openFavoritesModal();
  updateFavBadge();
  updateModalFavButton();
});

// Modal Actions
$('#btnFavModal').addEventListener('click', () => toggleFavorite(state.current));
$('#btnExportPng').addEventListener('click', exportTreeToPng);
$('#btnSpoilerToggle').addEventListener('click', toggleSpoilerShield);

// Brand logo click resets to home
$('#brandHome').addEventListener('click', (e) => {
  e.preventDefault();
  history.replaceState(null, '', ' ');
  $('#titleSection').classList.add('hidden');
  $('#resultsSection').classList.add('hidden');
  $('#kinshipCatalogSection')?.classList.remove('hidden');
  $('#titlesCatalogSection')?.classList.remove('hidden');
  $('#query').value = '';
  clearSearchBtn.classList.add('hidden');
  showStatus('');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// Scroll to top button
const scrollTopBtn = $('#scrollTopBtn');
window.addEventListener('scroll', () => {
  if (window.scrollY > 400) {
    scrollTopBtn.classList.remove('hidden');
  } else {
    scrollTopBtn.classList.add('hidden');
  }
});
scrollTopBtn.addEventListener('click', () => {
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

/* ========================================================
   ACROSS-ANIME KINSHIP CATALOG & PAGINATION
   ======================================================== */
const KINSHIP_CATALOG_DATA = [
  {
    "id": "ms-1",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 54495,
      "name": "Linlin Charlotte",
      "russian": "Линлин Шарлотта",
      "role": "Мать (Биг Мам)",
      "image": "/system/characters/preview/54495.jpg?1717793344"
    },
    "char2": {
      "id": 150775,
      "name": "Katakuri Charlotte",
      "russian": "Катакури Шарлотта",
      "role": "Сын (2-й сын семьи)",
      "image": "/system/characters/preview/150775.jpg?1718486382"
    },
    "note": "Шарлотта Линлин — биологическая мать Шарлотты Катакури и верховная правительница Тотлэнда."
  },
  {
    "id": "ms-2",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 54495,
      "name": "Linlin Charlotte",
      "russian": "Линлин Шарлотта",
      "role": "Мать (Биг Мам)",
      "image": "/system/characters/preview/54495.jpg?1717793344"
    },
    "char2": {
      "id": 153794,
      "name": "Perospero Charlotte",
      "russian": "Перосперо Шарлотта",
      "role": "Сын (Старший сын)",
      "image": "/system/characters/preview/153794.jpg?1718661890"
    },
    "note": "Старший сын семьи Шарлотта и министр сладостей Тотлэнда."
  },
  {
    "id": "ms-3",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 54495,
      "name": "Linlin Charlotte",
      "russian": "Линлин Шарлотта",
      "role": "Мать (Биг Мам)",
      "image": "/system/characters/preview/54495.jpg?1717793344"
    },
    "char2": {
      "id": 153725,
      "name": "Cracker Charlotte",
      "russian": "Крекер Шарлотта",
      "role": "Сын (10-й сын)",
      "image": "/system/characters/preview/153725.jpg?1718573334"
    },
    "note": "Конфетный генерал и министр печенья Тотлэнда."
  },
  {
    "id": "ms-4",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 7302,
      "name": "Kushina Uzumaki",
      "russian": "Кушина Узумаки",
      "role": "Мать",
      "image": "/system/characters/preview/7302.jpg?1716844502"
    },
    "char2": {
      "id": 17,
      "name": "Naruto Uzumaki",
      "russian": "Наруто Узумаки",
      "role": "Сын",
      "image": "/system/characters/preview/17.jpg?1716844024"
    },
    "note": "Кушина пожертвовала жизнью, запечатав девятихвостого лиса Кураму в своего новорождённого сына Наруто."
  },
  {
    "id": "ms-5",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 22849,
      "name": "Masaki Kurosaki",
      "russian": "Масаки Куросаки",
      "role": "Мать",
      "image": "/system/characters/preview/22849.jpg?1712025545"
    },
    "char2": {
      "id": 5,
      "name": "Ichigo Kurosaki",
      "russian": "Ичиго Куросаки",
      "role": "Сын",
      "image": "/system/characters/preview/5.jpg?1715637297"
    },
    "note": "Чистокровная квинси Масаки защитила Ичиго от Великого Удильщика ценой собственной жизни."
  },
  {
    "id": "ms-6",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 2102,
      "name": "Chi-Chi",
      "russian": "Чи-Чи",
      "role": "Мать",
      "image": "/system/characters/preview/2102.jpg?1718659043"
    },
    "char2": {
      "id": 2093,
      "name": "Gohan Son",
      "russian": "Гохан Сон",
      "role": "Сын",
      "image": "/system/characters/preview/2093.jpg?1718053938"
    },
    "note": "Строгая и любящая мать, воспитавшая Гохана учёным и сильнейшим защитником Земли."
  },
  {
    "id": "ms-7",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Attack on Titan",
    "animeRu": "Атака титанов",
    "char1": {
      "id": 62475,
      "name": "Carla Yeager",
      "russian": "Карла Йегер",
      "role": "Мать",
      "image": "/system/characters/preview/62475.jpg?1708826210"
    },
    "char2": {
      "id": 40882,
      "name": "Eren Yeager",
      "russian": "Эрен Йегер",
      "role": "Сын",
      "image": "/system/characters/preview/40882.jpg?1708821764"
    },
    "note": "Гибель Карлы при падении стены Мария стала ключевым мотивом Эрена истребить всех титанов."
  },
  {
    "id": "ms-8",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "My Hero Academia",
    "animeRu": "Моя геройская академия",
    "char1": {
      "id": 139572,
      "name": "Inko Midoriya",
      "russian": "Инко Мидория",
      "role": "Мать",
      "image": "/system/characters/preview/139572.jpg?1718573229"
    },
    "char2": {
      "id": 117909,
      "name": "Izuku Midoriya",
      "russian": "Идзуку Мидория",
      "role": "Сын (Деку)",
      "image": "/system/characters/preview/117909.jpg?1717880356"
    },
    "note": "Заботливая мать Идзуку, искренне переживающая за каждый бой и тренировку сына."
  },
  {
    "id": "ms-9",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Fullmetal Alchemist",
    "animeRu": "Стальной алхимик",
    "char1": {
      "id": 10085,
      "name": "Trisha Elric",
      "russian": "Триша Элрик",
      "role": "Мать",
      "image": "/system/characters/preview/10085.jpg?1712020538"
    },
    "char2": {
      "id": 11,
      "name": "Edward Elric",
      "russian": "Эдвард Элрик",
      "role": "Сын",
      "image": "/system/characters/preview/11.jpg?1712015306"
    },
    "note": "Попытка воскресить умершую мать Тришу с помощью запретной алхимии изменила судьбу братьев Элрик."
  },
  {
    "id": "ms-10",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Vinland Saga",
    "animeRu": "Сага о Винланде",
    "char1": {
      "id": 171366,
      "name": "Helga",
      "russian": "Хельга",
      "role": "Мать",
      "image": "/system/characters/preview/171366.jpg?1708990865"
    },
    "char2": {
      "id": 10138,
      "name": "Thorfinn",
      "russian": "Торфинн",
      "role": "Сын",
      "image": "/system/characters/preview/10138.jpg?1717449174"
    },
    "note": "Хельга — мать Торфинна и дочь вождя йомсвикингов Сигвальди."
  },
  {
    "id": "ms-11",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Neon Genesis Evangelion",
    "animeRu": "Евангелион",
    "char1": {
      "id": 1258,
      "name": "Yui Ikari",
      "russian": "Юи Икари",
      "role": "Мать",
      "image": "/system/characters/preview/1258.jpg?1712016075"
    },
    "char2": {
      "id": 89,
      "name": "Shinji Ikari",
      "russian": "Синдзи Икари",
      "role": "Сын",
      "image": "/system/characters/preview/89.jpg?1712015355"
    },
    "note": "Душа Юи Икари навеки запечатана внутри Евы-01, защищая Синдзи."
  },
  {
    "id": "ms-12",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Gintama",
    "animeRu": "Гинтама",
    "char1": {
      "id": 155934,
      "name": "Kouka",
      "russian": "Кока",
      "role": "Мать",
      "image": "/system/characters/preview/155934.jpg?1712063185"
    },
    "char2": {
      "id": 2317,
      "name": "Kamui",
      "russian": "Камуи",
      "role": "Сын",
      "image": "/system/characters/preview/2317.jpg?1712016760"
    },
    "note": "Кока — мать Камуи и Кагуры, бессмертная мутация Альтана с планеты Коан."
  },
  {
    "id": "ms-13",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "Oshi no Ko",
    "animeRu": "Звёздное дитя",
    "char1": {
      "id": 188037,
      "name": "Ai Hoshino",
      "russian": "Ай Хосино",
      "role": "Мать (Легендарный айдол)",
      "image": "/system/characters/preview/188037.jpg?1718058320"
    },
    "char2": {
      "id": 185313,
      "name": "Aquamarine Hoshino",
      "russian": "Аквамарин Хосино",
      "role": "Сын",
      "image": "/system/characters/preview/185313.jpg?1718058165"
    },
    "note": "Ай скрывала рождение близнецов от прессы, подарив сыну Аквамарину всю свою материнскую любовь."
  },
  {
    "id": "ms-14",
    "tags": [
      "mother_son"
    ],
    "relationLabel": "👑 Мать ⇆ 👶 Сын",
    "anime": "My Hero Academia",
    "animeRu": "Моя геройская академия",
    "char1": {
      "id": 151276,
      "name": "Rei Todoroki",
      "russian": "Рэй Тодороки",
      "role": "Мать",
      "image": "/system/characters/preview/151276.jpg?1718573323"
    },
    "char2": {
      "id": 117917,
      "name": "Shouto Todoroki",
      "russian": "Сёто Тодороки",
      "role": "Сын",
      "image": "/system/characters/preview/117917.jpg?1717880362"
    },
    "note": "Рэй Тодороки пережила тяжёлые годы семейной тирании, но восстановила душевную связь с сыном Сёто."
  },
  {
    "id": "fs-1",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 2535,
      "name": "Minato Namikaze",
      "russian": "Минато Намиказэ",
      "role": "Отец (Четвёртый Хокаге)",
      "image": "/system/characters/preview/2535.jpg?1716844307"
    },
    "char2": {
      "id": 17,
      "name": "Naruto Uzumaki",
      "russian": "Наруто Узумаки",
      "role": "Сын (Седьмой Хокаге)",
      "image": "/system/characters/preview/17.jpg?1716844024"
    },
    "note": "«Жёлтая молния Конохи» Минато верил, что его сын овладеет силой девятихвостого и спасёт мир шиноби."
  },
  {
    "id": "fs-2",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 2553,
      "name": "Isshin Kurosaki",
      "russian": "Иссин Куросаки",
      "role": "Отец (Бывший капитан Сиба)",
      "image": "/system/characters/preview/2553.jpg?1712016869"
    },
    "char2": {
      "id": 5,
      "name": "Ichigo Kurosaki",
      "russian": "Ичиго Куросаки",
      "role": "Сын",
      "image": "/system/characters/preview/5.jpg?1715637297"
    },
    "note": "Иссин скрывал своё прошлое капитана 10-го отряда Готей 13, обучив Ичиго финальной Гэцуге Тэнсё."
  },
  {
    "id": "fs-3",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 246,
      "name": "Gokuu Son",
      "russian": "Гоку Сон",
      "role": "Отец",
      "image": "/system/characters/preview/246.jpg?1718571788"
    },
    "char2": {
      "id": 2093,
      "name": "Gohan Son",
      "russian": "Гохан Сон",
      "role": "Сын",
      "image": "/system/characters/preview/2093.jpg?1718053938"
    },
    "note": "Гоку тренировал Гохана в Гиперболической комнате времени, пробудив в сыне Супер Сайяна 2 против Селла."
  },
  {
    "id": "fs-4",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 246,
      "name": "Gokuu Son",
      "russian": "Гоку Сон",
      "role": "Отец",
      "image": "/system/characters/preview/246.jpg?1718571788"
    },
    "char2": {
      "id": 2551,
      "name": "Goten Son",
      "russian": "Готэн Сон",
      "role": "Младший сын",
      "image": "/system/characters/preview/2551.jpg?1718398246"
    },
    "note": "Готэн родился похожим на отца Гоку как две капли воды и освоил супер сайяна с раннего детства."
  },
  {
    "id": "fs-5",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 4884,
      "name": "Dragon Monkey D.",
      "russian": "Драгон Монки Д.",
      "role": "Отец (Лидер Революционеров)",
      "image": "/system/characters/preview/4884.jpg?1718398302"
    },
    "char2": {
      "id": 40,
      "name": "Luffy Monkey D.",
      "russian": "Луффи Монки Д.",
      "role": "Сын",
      "image": "/system/characters/preview/40.jpg?1718830202"
    },
    "note": "Самый опасный преступник в мире Драгон спас Луффи от Смокера в Логтауне."
  },
  {
    "id": "fs-6",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 16973,
      "name": "Fugaku Uchiha",
      "russian": "Фугаку Учиха",
      "role": "Отец (Глава клана Учиха)",
      "image": "/system/characters/preview/16973.jpg?1716844683"
    },
    "char2": {
      "id": 13,
      "name": "Sasuke Uchiha",
      "russian": "Саскэ Учиха",
      "role": "Младший сын",
      "image": "/system/characters/preview/13.jpg?1716844018"
    },
    "note": "Глава клана Учиха и полиции Конохи, отец Саске и Итачи."
  },
  {
    "id": "fs-7",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 16973,
      "name": "Fugaku Uchiha",
      "russian": "Фугаку Учиха",
      "role": "Отец (Глава клана Учиха)",
      "image": "/system/characters/preview/16973.jpg?1716844683"
    },
    "char2": {
      "id": 14,
      "name": "Itachi Uchiha",
      "russian": "Итачи Учиха",
      "role": "Старший сын",
      "image": "/system/characters/preview/14.jpg?1716844024"
    },
    "note": "Перед трагической ночью Фугаку сказал сыну Итачи, что гордится им."
  },
  {
    "id": "fs-8",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Fullmetal Alchemist",
    "animeRu": "Стальной алхимик",
    "char1": {
      "id": 9792,
      "name": "Van Hohenheim",
      "russian": "Ван Хоэнхайм",
      "role": "Отец",
      "image": "/system/characters/preview/9792.jpg?1712792399"
    },
    "char2": {
      "id": 11,
      "name": "Edward Elric",
      "russian": "Эдвард Элрик",
      "role": "Старший сын",
      "image": "/system/characters/preview/11.jpg?1712015306"
    },
    "note": "Живой философский камень Ксеркса и отец братьев Элрик."
  },
  {
    "id": "fs-9",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Hunter x Hunter",
    "animeRu": "Охотник х Охотник",
    "char1": {
      "id": 26,
      "name": "Ging Freecss",
      "russian": "Джин Фрикс",
      "role": "Отец (Двойной Охотник)",
      "image": "/system/characters/preview/26.jpg?1712015298"
    },
    "char2": {
      "id": 30,
      "name": "Gon Freecss",
      "russian": "Гон Фрикс",
      "role": "Сын",
      "image": "/system/characters/preview/30.jpg?1712015298"
    },
    "note": "Поиски легендарного отца Джина стали главным стимулом для Гона стать Охотником."
  },
  {
    "id": "fs-10",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Hunter x Hunter",
    "animeRu": "Охотник х Охотник",
    "char1": {
      "id": 60,
      "name": "Silva Zoldyck",
      "russian": "Сильва Золдик",
      "role": "Отец (Глава дома Золдик)",
      "image": "/system/characters/preview/60.jpg?1712015336"
    },
    "char2": {
      "id": 27,
      "name": "Killua Zoldyck",
      "russian": "Киллуа Золдик",
      "role": "Сын",
      "image": "/system/characters/preview/27.jpg?1712015316"
    },
    "note": "Сильва отпустил Киллуа путешествовать с Гоном, веря в силу крови Золдиков."
  },
  {
    "id": "fs-11",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Death Note",
    "animeRu": "Тетрадь смерти",
    "char1": {
      "id": 1927,
      "name": "Souichirou Yagami",
      "russian": "Соитиро Ягами",
      "role": "Отец (Шеф полиции)",
      "image": "/system/characters/preview/1927.jpg?1712016496"
    },
    "char2": {
      "id": 80,
      "name": "Light Yagami",
      "russian": "Лайт Ягами",
      "role": "Сын (Кира)",
      "image": "/system/characters/preview/80.jpg?1712015382"
    },
    "note": "Трагическое противостояние неподкупного шефа полиции и его гениального сына."
  },
  {
    "id": "fs-12",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Vinland Saga",
    "animeRu": "Сага о Винланде",
    "char1": {
      "id": 13021,
      "name": "Thors",
      "russian": "Торс",
      "role": "Отец (Йомский Тролль)",
      "image": "/system/characters/preview/13021.jpg?1706565307"
    },
    "char2": {
      "id": 10138,
      "name": "Thorfinn",
      "russian": "Торфинн",
      "role": "Сын",
      "image": "/system/characters/preview/10138.jpg?1717449174"
    },
    "note": "Торс научил Торфинна главному правилу: «У тебя нет врагов. Ни у кого нет врагов»."
  },
  {
    "id": "fs-13",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "JoJo's Bizarre Adventure",
    "animeRu": "Невероятные приключения ДжоДжо",
    "char1": {
      "id": 21956,
      "name": "George I Joestar",
      "russian": "Джордж Джостар",
      "role": "Отец (Лорд Джостар)",
      "image": "/system/characters/preview/21956.jpg?1712025247"
    },
    "char2": {
      "id": 8087,
      "name": "Jonathan Joestar",
      "russian": "Джонатан Джостар",
      "role": "Сын (Первый ДжоДжо)",
      "image": "/system/characters/preview/8087.jpg?1712019661"
    },
    "note": "Аристократическое поместье Джостаров в Англии конца XIX века."
  },
  {
    "id": "fs-14",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Neon Genesis Evangelion",
    "animeRu": "Евангелион",
    "char1": {
      "id": 1257,
      "name": "Gendou Ikari",
      "russian": "Гэндо Икари",
      "role": "Отец (Командующий NERV)",
      "image": "/system/characters/preview/1257.jpg?1712016088"
    },
    "char2": {
      "id": 89,
      "name": "Shinji Ikari",
      "russian": "Синдзи Икари",
      "role": "Сын (Третье Дитя)",
      "image": "/system/characters/preview/89.jpg?1712015355"
    },
    "note": "«Полезай в робота, Синдзи». Холодные и отстранённые отношения командующего NERV и его сына."
  },
  {
    "id": "fs-15",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Blue Exorcist",
    "animeRu": "Синий экзорцист",
    "char1": {
      "id": 21233,
      "name": "Satan",
      "russian": "Сатана",
      "role": "Биологический отец (Владыка Геенны)",
      "image": "/system/characters/preview/21233.jpg?1712024971"
    },
    "char2": {
      "id": 24482,
      "name": "Rin Okumura",
      "russian": "Рин Окумура",
      "role": "Сын (Носитель синего пламени)",
      "image": "/system/characters/preview/24482.jpg?1711054548"
    },
    "note": "Рин унаследовал смертоносное синее пламя Владыки Геенны, но поклялся победить его."
  },
  {
    "id": "fs-16",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Jujutsu Kaisen",
    "animeRu": "Магическая битва",
    "char1": {
      "id": 175543,
      "name": "Touji Fushiguro",
      "russian": "Тодзи Фусигуро",
      "role": "Отец (Убийца магов)",
      "image": "/system/characters/preview/175543.jpg?1713218760"
    },
    "char2": {
      "id": 164470,
      "name": "Megumi Fushiguro",
      "russian": "Мэгуми Фусигуро",
      "role": "Сын",
      "image": "/system/characters/preview/164470.jpg?1713218252"
    },
    "note": "Тодзи доверил заботу о сыне Мэгуми Сатору Годзё, пожертвовав собой перед смертью."
  },
  {
    "id": "fs-17",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Attack on Titan",
    "animeRu": "Атака титанов",
    "char1": {
      "id": 62477,
      "name": "Grisha Yeager",
      "russian": "Гриша Йегер",
      "role": "Отец",
      "image": "/system/characters/preview/62477.jpg?1716845483"
    },
    "char2": {
      "id": 40882,
      "name": "Eren Yeager",
      "russian": "Эрен Йегер",
      "role": "Младший сын",
      "image": "/system/characters/preview/40882.jpg?1708821764"
    },
    "note": "Гриша передал Эрену силу Атакующего и Прародителя Титанов в подвале дома Сигансины."
  },
  {
    "id": "fs-18",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Attack on Titan",
    "animeRu": "Атака титанов",
    "char1": {
      "id": 62477,
      "name": "Grisha Yeager",
      "russian": "Гриша Йегер",
      "role": "Отец",
      "image": "/system/characters/preview/62477.jpg?1716845483"
    },
    "char2": {
      "id": 142314,
      "name": "Zeke",
      "russian": "Зик",
      "role": "Старший сын",
      "image": "/system/characters/preview/142314.jpg?1715639282"
    },
    "note": "Гриша возложил на Зика судьбу возрождения Элдии, что привело к предательству сына в Марли."
  },
  {
    "id": "fs-19",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "Gintama",
    "animeRu": "Гинтама",
    "char1": {
      "id": 3424,
      "name": "Umibouzu",
      "russian": "Умибодзу",
      "role": "Отец (Сильнейший чистильщик Вселенной)",
      "image": "/system/characters/preview/3424.jpg?1712017406"
    },
    "char2": {
      "id": 2317,
      "name": "Kamui",
      "russian": "Камуи",
      "role": "Сын (Командир 7-й дивизии Харусаме)",
      "image": "/system/characters/preview/2317.jpg?1712016760"
    },
    "note": "Кровавая дуэль отца и сына клана Ято стала легендой криминального синдиката."
  },
  {
    "id": "fs-20",
    "tags": [
      "father_son"
    ],
    "relationLabel": "⚡ Отец ⇆ 👶 Сын",
    "anime": "My Hero Academia",
    "animeRu": "Моя геройская академия",
    "char1": {
      "id": 141624,
      "name": "Enji Todoroki",
      "russian": "Эндзи Тодороки",
      "role": "Отец (Старатель)",
      "image": "/system/characters/preview/141624.jpg?1718745351"
    },
    "char2": {
      "id": 117917,
      "name": "Shouto Todoroki",
      "russian": "Сёто Тодороки",
      "role": "Сын",
      "image": "/system/characters/preview/117917.jpg?1717880362"
    },
    "note": "Герой №1 Старатель годами добивался от Сёто преодоления предела огня и льда."
  },
  {
    "id": "bs-1",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Demon Slayer",
    "animeRu": "Клинок, рассекающий демонов",
    "char1": {
      "id": 146156,
      "name": "Tanjirou Kamado",
      "russian": "Тандзиро Камадо",
      "role": "Старший брат",
      "image": "/system/characters/preview/146156.jpg?1718056699"
    },
    "char2": {
      "id": 146157,
      "name": "Nezuko Kamado",
      "russian": "Нэдзуко Камадо",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/146157.jpg?1718056687"
    },
    "note": "Тандзиро вступил в ряды истребителей демонов, чтобы найти лекарство и спасти сестру Нэдзуко."
  },
  {
    "id": "bs-2",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Code Geass",
    "animeRu": "Код Гиас",
    "char1": {
      "id": 417,
      "name": "Lelouch Lamperouge",
      "russian": "Лелуш Ламперуж",
      "role": "Старший брат",
      "image": "/system/characters/preview/417.jpg?1712015548"
    },
    "char2": {
      "id": 1110,
      "name": "Nunnally Lamperouge",
      "russian": "Нанналли Ламперуж",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/1110.jpg?1712015984"
    },
    "note": "Лелуш начал глобальное восстание против Священной Британской Империи ради счастливого будущего Нанналли."
  },
  {
    "id": "bs-3",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 5,
      "name": "Ichigo Kurosaki",
      "russian": "Ичиго Куросаки",
      "role": "Старший брат",
      "image": "/system/characters/preview/5.jpg?1715637297"
    },
    "char2": {
      "id": 4018,
      "name": "Karin Kurosaki",
      "russian": "Карин Куросаки",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/4018.jpg?1712017720"
    },
    "note": "Ичиго всегда готов защитить семью Куросаки от любых пустых."
  },
  {
    "id": "bs-4",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 5,
      "name": "Ichigo Kurosaki",
      "russian": "Ичиго Куросаки",
      "role": "Старший брат",
      "image": "/system/characters/preview/5.jpg?1715637297"
    },
    "char2": {
      "id": 1096,
      "name": "Yuzu Kurosaki",
      "russian": "Юдзу Куросаки",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/1096.jpg?1712093484"
    },
    "note": "Юдзу заботится о домашнем уюте клиники Куросаки, обожая своего старшего брата."
  },
  {
    "id": "bs-5",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Oshi no Ko",
    "animeRu": "Звёздное дитя",
    "char1": {
      "id": 185313,
      "name": "Aquamarine Hoshino",
      "russian": "Аквамарин Хосино",
      "role": "Брат-близнец",
      "image": "/system/characters/preview/185313.jpg?1718058165"
    },
    "char2": {
      "id": 186921,
      "name": "Ruby Hoshino",
      "russian": "Руби Хосино",
      "role": "Сестра-близнец",
      "image": "/system/characters/preview/186921.jpg?1718058197"
    },
    "note": "Близнецы Ай Хосино, переродившиеся с воспоминаниями о прошлой жизни."
  },
  {
    "id": "bs-6",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 150775,
      "name": "Katakuri Charlotte",
      "russian": "Катакури Шарлотта",
      "role": "Старший брат",
      "image": "/system/characters/preview/150775.jpg?1718486382"
    },
    "char2": {
      "id": 152902,
      "name": "Brûlée Charlotte",
      "russian": "Брюле Шарлотта",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/152902.jpg?1718226786"
    },
    "note": "Катакури надел свой знаменитый шарф, поклявшись стать несокрушимым щитом для Брюле."
  },
  {
    "id": "bs-7",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 150775,
      "name": "Katakuri Charlotte",
      "russian": "Катакури Шарлотта",
      "role": "Старший брат",
      "image": "/system/characters/preview/150775.jpg?1718486382"
    },
    "char2": {
      "id": 149813,
      "name": "Pudding Charlotte",
      "russian": "Пудинг Шарлотта",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/149813.jpg?1718745411"
    },
    "note": "Старший брат в семье Шарлотта всегда оберегал сестёр от насмешек над внешностью."
  },
  {
    "id": "bs-8",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Death Note",
    "animeRu": "Тетрадь смерти",
    "char1": {
      "id": 80,
      "name": "Light Yagami",
      "russian": "Лайт Ягами",
      "role": "Старший брат",
      "image": "/system/characters/preview/80.jpg?1712015382"
    },
    "char2": {
      "id": 8135,
      "name": "Sayu Yagami",
      "russian": "Саю Ягами",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/8135.jpg?1712019680"
    },
    "note": "Похищение Саю мафией Мелло поставило Лайта перед тяжелейшей дилеммой Киры."
  },
  {
    "id": "bs-9",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Tokyo Ghoul",
    "animeRu": "Токийский гуль",
    "char1": {
      "id": 105231,
      "name": "Ayato Kirishima",
      "russian": "Аято Киришима",
      "role": "Младший брат",
      "image": "/system/characters/preview/105231.jpg?1712047360"
    },
    "char2": {
      "id": 87277,
      "name": "Touka Kirishima",
      "russian": "Тока Киришима",
      "role": "Старшая сестра",
      "image": "/system/characters/preview/87277.jpg?1712042821"
    },
    "note": "Аято вступил в «Древо Аогири», чтобы тайно защитить Току от опасностей 20-го района."
  },
  {
    "id": "bs-10",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Gintama",
    "animeRu": "Гинтама",
    "char1": {
      "id": 2317,
      "name": "Kamui",
      "russian": "Камуи",
      "role": "Старший брат",
      "image": "/system/characters/preview/2317.jpg?1712016760"
    },
    "char2": {
      "id": 1369,
      "name": "Kagura",
      "russian": "Кагура",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/1369.jpg?1712016159"
    },
    "note": "Эпическая битва на планете Ракуё положила конец многолетней вражде брата и сестры Ято."
  },
  {
    "id": "bs-11",
    "tags": [
      "brother_sister"
    ],
    "relationLabel": "🤝 Брат ⇆ 👧 Сестра",
    "anime": "Vinland Saga",
    "animeRu": "Сага о Винланде",
    "char1": {
      "id": 10138,
      "name": "Thorfinn",
      "russian": "Торфинн",
      "role": "Младший брат",
      "image": "/system/characters/preview/10138.jpg?1717449174"
    },
    "char2": {
      "id": 27876,
      "name": "Ylva",
      "russian": "Ильва",
      "role": "Старшая сестра",
      "image": "/system/characters/preview/27876.jpg?1708985013"
    },
    "note": "Ильва и Торфинн — дети Торса и Хельги, выросшие на ветреных берегах Исландии."
  },
  {
    "id": "bb-1",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Fullmetal Alchemist",
    "animeRu": "Стальной алхимик",
    "char1": {
      "id": 11,
      "name": "Edward Elric",
      "russian": "Эдвард Элрик",
      "role": "Старший брат (Стальной алхимик)",
      "image": "/system/characters/preview/11.jpg?1712015306"
    },
    "char2": {
      "id": 12,
      "name": "Alphonse Elric",
      "russian": "Альфонс Элрик",
      "role": "Младший брат (Душа в доспехах)",
      "image": "/system/characters/preview/12.jpg?1712015323"
    },
    "note": "Братья Элрик преодолели континент Аместрис, стремясь вернуть потерянные тела."
  },
  {
    "id": "bb-2",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 14,
      "name": "Itachi Uchiha",
      "russian": "Итачи Учиха",
      "role": "Старший брат",
      "image": "/system/characters/preview/14.jpg?1716844024"
    },
    "char2": {
      "id": 13,
      "name": "Sasuke Uchiha",
      "russian": "Саскэ Учиха",
      "role": "Младший брат",
      "image": "/system/characters/preview/13.jpg?1716844018"
    },
    "note": "«Я всегда буду любить тебя». Итачи пожертвовал честью ради защиты жизни Саске."
  },
  {
    "id": "bb-3",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 2072,
      "name": "Ace Portgas D.",
      "russian": "Эйс Портгас Д.",
      "role": "Названый брат",
      "image": "/system/characters/preview/2072.jpg?1718398222"
    },
    "char2": {
      "id": 40,
      "name": "Luffy Monkey D.",
      "russian": "Луффи Монки Д.",
      "role": "Названый брат",
      "image": "/system/characters/preview/40.jpg?1718830202"
    },
    "note": "Братская клятва на чашах сакэ в Сером Терминале скрепила неразрывные узы Луффи и Эйса."
  },
  {
    "id": "bb-4",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 32893,
      "name": "Sabo",
      "russian": "Сабо",
      "role": "Названый брат",
      "image": "/system/characters/preview/32893.jpg?1715637834"
    },
    "char2": {
      "id": 40,
      "name": "Luffy Monkey D.",
      "russian": "Луффи Монки Д.",
      "role": "Названый брат",
      "image": "/system/characters/preview/40.jpg?1718830202"
    },
    "note": "Сабо унаследовал пламя Эйса и фрукт Мэра Мэра но Ми в Колизее Дресс Розы."
  },
  {
    "id": "bb-5",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 12464,
      "name": "Hashirama Senju",
      "russian": "Хаширама Сэнджу",
      "role": "Старший брат (Первый Хокаге)",
      "image": "/system/characters/preview/12464.jpg?1712021348"
    },
    "char2": {
      "id": 12465,
      "name": "Tobirama Senju",
      "russian": "Тобирама Сэнджу",
      "role": "Младший брат (Второй Хокаге)",
      "image": "/system/characters/preview/12465.jpg?1712021375"
    },
    "note": "Основатели Деревни Скрытого Листа и создатели базовых систем мира ниндзя."
  },
  {
    "id": "bb-6",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 53901,
      "name": "Madara Uchiha",
      "russian": "Мадара Учиха",
      "role": "Старший брат",
      "image": "/system/characters/preview/53901.jpg?1716845324"
    },
    "char2": {
      "id": 16406,
      "name": "Izuna Uchiha",
      "russian": "Изуна Учиха",
      "role": "Младший брат",
      "image": "/system/characters/preview/16406.jpg?1712023075"
    },
    "note": "Смерть Идзуны на Войне Кланов пробудила в Мадаре вечный Мангэкё Шаринган."
  },
  {
    "id": "bb-7",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 2093,
      "name": "Gohan Son",
      "russian": "Гохан Сон",
      "role": "Старший брат",
      "image": "/system/characters/preview/2093.jpg?1718053938"
    },
    "char2": {
      "id": 2551,
      "name": "Goten Son",
      "russian": "Готэн Сон",
      "role": "Младший брат",
      "image": "/system/characters/preview/2551.jpg?1718398246"
    },
    "note": "Гохан терпеливо обучал младшего брата Готэна полёту с помощью Ки."
  },
  {
    "id": "bb-8",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 150775,
      "name": "Katakuri Charlotte",
      "russian": "Катакури Шарлотта",
      "role": "Брат-триплет (2-й сын)",
      "image": "/system/characters/preview/150775.jpg?1718486382"
    },
    "char2": {
      "id": 153794,
      "name": "Perospero Charlotte",
      "russian": "Перосперо Шарлотта",
      "role": "Старший брат (1-й сын)",
      "image": "/system/characters/preview/153794.jpg?1718661890"
    },
    "note": "Старшие сыновья семьи Шарлотта — опора боевой мощи пиратов Биг Мам."
  },
  {
    "id": "bb-9",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 150775,
      "name": "Katakuri Charlotte",
      "russian": "Катакури Шарлотта",
      "role": "Брат-триплет (2-й сын)",
      "image": "/system/characters/preview/150775.jpg?1718486382"
    },
    "char2": {
      "id": 156133,
      "name": "Oven Charlotte",
      "russian": "Овен Шарлотта",
      "role": "Брат-триплет (4-й сын)",
      "image": "/system/characters/preview/156133.jpg?1718486476"
    },
    "note": "Овен, Катакури и Дайфуку родились триплетами 48 лет назад."
  },
  {
    "id": "bb-10",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Hunter x Hunter",
    "animeRu": "Охотник х Охотник",
    "char1": {
      "id": 57,
      "name": "Illumi Zoldyck",
      "russian": "Иллуми Золдик",
      "role": "Старший брат",
      "image": "/system/characters/preview/57.jpg?1712015331"
    },
    "char2": {
      "id": 27,
      "name": "Killua Zoldyck",
      "russian": "Киллуа Золдик",
      "role": "Младший брат",
      "image": "/system/characters/preview/27.jpg?1712015316"
    },
    "note": "Иллуми контролировал Киллуа с помощью иглы Нэн, чтобы уберечь наследника семьи."
  },
  {
    "id": "bb-11",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Blue Exorcist",
    "animeRu": "Синий экзорцист",
    "char1": {
      "id": 24482,
      "name": "Rin Okumura",
      "russian": "Рин Окумура",
      "role": "Старший брат-близнец",
      "image": "/system/characters/preview/24482.jpg?1711054548"
    },
    "char2": {
      "id": 24734,
      "name": "Yukio Okumura",
      "russian": "Юкио Окумура",
      "role": "Младший брат-близнец",
      "image": "/system/characters/preview/24734.jpg?1710968506"
    },
    "note": "Близнецы Окумура — сыновья Сатаны; Юкио стал экзорцистом-паладином, чтобы оберегать Рина."
  },
  {
    "id": "bb-12",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Inuyasha",
    "animeRu": "Инуяша",
    "char1": {
      "id": 1358,
      "name": "Sesshoumaru",
      "russian": "Сэссёмару",
      "role": "Старший единокровный брат (Чистокровный демон)",
      "image": "/system/characters/preview/1358.jpg?1712016132"
    },
    "char2": {
      "id": 1353,
      "name": "Inuyasha",
      "russian": "Инуяся",
      "role": "Младший единокровный брат (Полудемон)",
      "image": "/system/characters/preview/1353.jpg?1708720551"
    },
    "note": "Соперничество братьев-демонов за наследные мечи Тэссайга и Тенсейга отца Ину но Тайсё."
  },
  {
    "id": "bb-13",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Jujutsu Kaisen",
    "animeRu": "Магическая битва",
    "char1": {
      "id": 180764,
      "name": "Chousou",
      "russian": "Тёсо",
      "role": "Старший брат (Картина смерти)",
      "image": "/system/characters/preview/180764.jpg?1713219287"
    },
    "char2": {
      "id": 163847,
      "name": "Yuuji Itadori",
      "russian": "Юдзи Итадори",
      "role": "Младший брат",
      "image": "/system/characters/preview/163847.jpg?1713218257"
    },
    "note": "Тёсо почувствовал зов братской крови в Сибуе и поклялся защищать Юдзи ценой собственной жизни."
  },
  {
    "id": "bb-14",
    "tags": [
      "brothers"
    ],
    "relationLabel": "⚔️ Брат ⇆ ⚔️ Брат",
    "anime": "Attack on Titan",
    "animeRu": "Атака титанов",
    "char1": {
      "id": 142314,
      "name": "Zeke",
      "russian": "Зик",
      "role": "Старший единокровный брат (Звероподобный)",
      "image": "/system/characters/preview/142314.jpg?1715639282"
    },
    "char2": {
      "id": 40882,
      "name": "Eren Yeager",
      "russian": "Эрен Йегер",
      "role": "Младший единокровный брат (Атакующий)",
      "image": "/system/characters/preview/40882.jpg?1708821764"
    },
    "note": "Встреча братьев Йегер в Координате определила судьбу Гула Земли."
  },
  {
    "id": "ss-1",
    "tags": [
      "sisters"
    ],
    "relationLabel": "🌸 Сестра ⇆ 🌸 Сестра",
    "anime": "Re:Zero",
    "animeRu": "Жизнь в альтернативном мире с нуля",
    "char1": {
      "id": 61787,
      "name": "Ram",
      "russian": "Рам",
      "role": "Старшая сестра",
      "image": "/system/characters/preview/61787.jpg?1712799694"
    },
    "char2": {
      "id": 1905,
      "name": "Rem",
      "russian": "Рэм",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/1905.jpg?1712016497"
    },
    "note": "Близнецы-горничные поместья Розваля из клана они."
  },
  {
    "id": "ss-2",
    "tags": [
      "sisters"
    ],
    "relationLabel": "🌸 Сестра ⇆ 🌸 Сестра",
    "anime": "Demon Slayer",
    "animeRu": "Клинок, рассекающий демонов",
    "char1": {
      "id": 173733,
      "name": "Kanae Kochou",
      "russian": "Канаэ Котё",
      "role": "Старшая сестра (Столп Цветка)",
      "image": "/system/characters/preview/173733.jpg?1712068769"
    },
    "char2": {
      "id": 146736,
      "name": "Shinobu Kochou",
      "russian": "Синобу Котё",
      "role": "Младшая сестра (Столп Насекомого)",
      "image": "/system/characters/preview/146736.jpg?1718056691"
    },
    "note": "Шинобу посвятила жизнь борьбе с демонами в память о погибшей сестре Канаэ."
  },
  {
    "id": "ss-3",
    "tags": [
      "sisters"
    ],
    "relationLabel": "🌸 Сестра ⇆ 🌸 Сестра",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 1555,
      "name": "Hinata Hyuuga",
      "russian": "Хината Хюга",
      "role": "Старшая сестра",
      "image": "/system/characters/preview/1555.jpg?1716844172"
    },
    "char2": {
      "id": 12563,
      "name": "Hanabi Hyuuga",
      "russian": "Ханаби Хюга",
      "role": "Младшая сестра",
      "image": "/system/characters/preview/12563.jpg?1712021386"
    },
    "note": "Наследницы главной ветви клана Хюга и обладательницы Бьякугана."
  },
  {
    "id": "ss-4",
    "tags": [
      "sisters"
    ],
    "relationLabel": "🌸 Сестра ⇆ 🌸 Сестра",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 154258,
      "name": "Smoothie Charlotte",
      "russian": "Смузи Шарлотта",
      "role": "Старшая сестра (14-я дочь)",
      "image": "/system/characters/preview/154258.jpg?1718831374"
    },
    "char2": {
      "id": 149813,
      "name": "Pudding Charlotte",
      "russian": "Пудинг Шарлотта",
      "role": "Младшая сестра (35-я дочь)",
      "image": "/system/characters/preview/149813.jpg?1718745411"
    },
    "note": "Дочери семьи Шарлотта с уникальными способностями соков и воспоминаний."
  },
  {
    "id": "ss-5",
    "tags": [
      "sisters"
    ],
    "relationLabel": "🌸 Сестра ⇆ 🌸 Сестра",
    "anime": "Jujutsu Kaisen",
    "animeRu": "Магическая битва",
    "char1": {
      "id": 164482,
      "name": "Maki Zenin",
      "russian": "Маки Дзэнин",
      "role": "Старшая сестра-близнец",
      "image": "/system/characters/preview/164482.jpg?1713824860"
    },
    "char2": {
      "id": 164483,
      "name": "Mai Zenin",
      "russian": "Маи Дзэнин",
      "role": "Младшая сестра-близнец",
      "image": "/system/characters/preview/164483.jpg?1713824855"
    },
    "note": "Сестры Дзэнин родились близнецами в традиционном клане, отвергнутые за нехватку проклятой энергии."
  },
  {
    "id": "sp-1",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 2535,
      "name": "Minato Namikaze",
      "russian": "Минато Намиказэ",
      "role": "Муж (Хокаге)",
      "image": "/system/characters/preview/2535.jpg?1716844307"
    },
    "char2": {
      "id": 7302,
      "name": "Kushina Uzumaki",
      "russian": "Кушина Узумаки",
      "role": "Жена (Джинчурики)",
      "image": "/system/characters/preview/7302.jpg?1716844502"
    },
    "note": "Красивейшая история любви Конохи: Минато нашёл Кушину по ярко-красным прядям волос."
  },
  {
    "id": "sp-2",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 17,
      "name": "Naruto Uzumaki",
      "russian": "Наруто Узумаки",
      "role": "Муж",
      "image": "/system/characters/preview/17.jpg?1716844024"
    },
    "char2": {
      "id": 1555,
      "name": "Hinata Hyuuga",
      "russian": "Хината Хюга",
      "role": "Жена",
      "image": "/system/characters/preview/1555.jpg?1716844172"
    },
    "note": "Хината с детства верила в Наруто, вдохновляя его на пути к званию Хокаге."
  },
  {
    "id": "sp-3",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 5,
      "name": "Ichigo Kurosaki",
      "russian": "Ичиго Куросаки",
      "role": "Муж",
      "image": "/system/characters/preview/5.jpg?1715637297"
    },
    "char2": {
      "id": 7,
      "name": "Orihime Inoue",
      "russian": "Орихимэ Иноуэ",
      "role": "Жена",
      "image": "/system/characters/preview/7.jpg?1716242855"
    },
    "note": "Орихиме всегда поддерживала Ичиго, создав тёплую семью после завершения Тысячелетней войны."
  },
  {
    "id": "sp-4",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 246,
      "name": "Gokuu Son",
      "russian": "Гоку Сон",
      "role": "Муж",
      "image": "/system/characters/preview/246.jpg?1718571788"
    },
    "char2": {
      "id": 2102,
      "name": "Chi-Chi",
      "russian": "Чи-Чи",
      "role": "Жена",
      "image": "/system/characters/preview/2102.jpg?1718659043"
    },
    "note": "Гоку и Чи-Чи поженились после Турнира боевых искусств Тэнкаити Будокай."
  },
  {
    "id": "sp-5",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 913,
      "name": "Vegeta",
      "russian": "Веджета",
      "role": "Муж (Принц Сайянов)",
      "image": "/system/characters/preview/913.jpg?1718053841"
    },
    "char2": {
      "id": 678,
      "name": "Bulma",
      "russian": "Бульма",
      "role": "Жена (Гениальный инженер)",
      "image": "/system/characters/preview/678.jpg?1718659028"
    },
    "note": "Союз гордого сайянского принца и наследницы Capsule Corporation Бульмы."
  },
  {
    "id": "sp-6",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Spy x Family",
    "animeRu": "Семья шпиона",
    "char1": {
      "id": 170258,
      "name": "Loid Forger",
      "russian": "Лойд Форджер",
      "role": "Муж (Агент Сумрак)",
      "image": "/system/characters/preview/170258.jpg?1712438081"
    },
    "char2": {
      "id": 170329,
      "name": "Yor Forger",
      "russian": "Йор Форджер",
      "role": "Жена (Тернистая Принцесса)",
      "image": "/system/characters/preview/170329.jpg?1712438112"
    },
    "note": "Фиктивный брак величайшего шпиона Весталиса и наёмной убийцы ради операции «Неясыть»."
  },
  {
    "id": "sp-7",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 16973,
      "name": "Fugaku Uchiha",
      "russian": "Фугаку Учиха",
      "role": "Муж",
      "image": "/system/characters/preview/16973.jpg?1716844683"
    },
    "char2": {
      "id": 21122,
      "name": "Mikoto Uchiha",
      "russian": "Микото Учиха",
      "role": "Жена",
      "image": "/system/characters/preview/21122.jpg?1716844751"
    },
    "note": "Родители Саске и Итачи, хранившие верность друг другу до самого конца."
  },
  {
    "id": "sp-8",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 906,
      "name": "Renji Abarai",
      "russian": "Рэндзи Абараи",
      "role": "Муж",
      "image": "/system/characters/preview/906.jpg?1715637310"
    },
    "char2": {
      "id": 6,
      "name": "Rukia Kuchiki",
      "russian": "Рукия Кучики",
      "role": "Жена",
      "image": "/system/characters/preview/6.jpg?1715637289"
    },
    "note": "Друзья детства из Руконгая, прошедшие сквозь огонь и битвы и ставшие семьёй."
  },
  {
    "id": "sp-9",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Berserk",
    "animeRu": "Берсерк",
    "char1": {
      "id": 422,
      "name": "Guts",
      "russian": "Гатс",
      "role": "Возлюбленный (Чёрный Мечник)",
      "image": "/system/characters/preview/422.jpg?1716844049"
    },
    "char2": {
      "id": 423,
      "name": "Casca",
      "russian": "Каска",
      "role": "Возлюбленная",
      "image": "/system/characters/preview/423.jpg?1716844046"
    },
    "note": "Пронзительная любовь командиров Отряда Сокола сквозь мрак и Затмение."
  },
  {
    "id": "sp-10",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Tokyo Ghoul",
    "animeRu": "Токийский гуль",
    "char1": {
      "id": 87275,
      "name": "Ken Kaneki",
      "russian": "Кэн Канэки",
      "role": "Муж (Одноглазый Король)",
      "image": "/system/characters/preview/87275.jpg?1712042776"
    },
    "char2": {
      "id": 87277,
      "name": "Touka Kirishima",
      "russian": "Тока Киришима",
      "role": "Жена",
      "image": "/system/characters/preview/87277.jpg?1712042821"
    },
    "note": "Канеки и Тока связали судьбы узами брака ради мира между людьми и гулями."
  },
  {
    "id": "sp-11",
    "tags": [
      "spouses"
    ],
    "relationLabel": "💍 Муж ⇆ 💍 Жена",
    "anime": "Vinland Saga",
    "animeRu": "Сага о Винланде",
    "char1": {
      "id": 13021,
      "name": "Thors",
      "russian": "Торс",
      "role": "Муж",
      "image": "/system/characters/preview/13021.jpg?1706565307"
    },
    "char2": {
      "id": 171366,
      "name": "Helga",
      "russian": "Хельга",
      "role": "Жена",
      "image": "/system/characters/preview/171366.jpg?1708990865"
    },
    "note": "Торс оставил войну и йомсвикингов ради мирной жизни с Хельгой в Исландии."
  },
  {
    "id": "fd-1",
    "tags": [
      "father_daughter"
    ],
    "relationLabel": "🎀 Отец ⇆ 🎀 Дочь",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 13,
      "name": "Sasuke Uchiha",
      "russian": "Саскэ Учиха",
      "role": "Отец",
      "image": "/system/characters/preview/13.jpg?1716844018"
    },
    "char2": {
      "id": 117791,
      "name": "Sarada Uchiha",
      "russian": "Сарада Учиха",
      "role": "Дочь",
      "image": "/system/characters/preview/117791.jpg?1716846277"
    },
    "note": "Саске передал Сараде ценности защитника Конохи и силу огненного стиля Учиха."
  },
  {
    "id": "fd-2",
    "tags": [
      "father_daughter"
    ],
    "relationLabel": "🎀 Отец ⇆ 🎀 Дочь",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 17,
      "name": "Naruto Uzumaki",
      "russian": "Наруто Узумаки",
      "role": "Отец (Седьмой Хокаге)",
      "image": "/system/characters/preview/17.jpg?1716844024"
    },
    "char2": {
      "id": 117789,
      "name": "Himawari Uzumaki",
      "russian": "Химавари Узумаки",
      "role": "Дочь",
      "image": "/system/characters/preview/117789.jpg?1716846267"
    },
    "note": "Химавари пробудила Бьякуган в раннем возрасте, поразив даже своего отца."
  },
  {
    "id": "fd-3",
    "tags": [
      "father_daughter"
    ],
    "relationLabel": "🎀 Отец ⇆ 🎀 Дочь",
    "anime": "Spy x Family",
    "animeRu": "Семья шпиона",
    "char1": {
      "id": 170258,
      "name": "Loid Forger",
      "russian": "Лойд Форджер",
      "role": "Приёмный отец",
      "image": "/system/characters/preview/170258.jpg?1712438081"
    },
    "char2": {
      "id": 170256,
      "name": "Anya Forger",
      "russian": "Аня Форджер",
      "role": "Приёмная дочь (Телепат)",
      "image": "/system/characters/preview/170256.jpg?1712524505"
    },
    "note": "Лойд заботится об Ане, не подозревая, что девочка читает все его шпионские мысли."
  },
  {
    "id": "fd-4",
    "tags": [
      "father_daughter"
    ],
    "relationLabel": "🎀 Отец ⇆ 🎀 Дочь",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 15039,
      "name": "Hiashi Hyuuga",
      "russian": "Хиаши Хюга",
      "role": "Отец (Глава клана Хюга)",
      "image": "/system/characters/preview/15039.jpg?1712022403"
    },
    "char2": {
      "id": 1555,
      "name": "Hinata Hyuuga",
      "russian": "Хината Хюга",
      "role": "Старшая дочь",
      "image": "/system/characters/preview/1555.jpg?1716844172"
    },
    "note": "Хиаши признал волю Хинаты, став любящим отцом и дедушкой."
  },
  {
    "id": "fd-5",
    "tags": [
      "father_daughter"
    ],
    "relationLabel": "🎀 Отец ⇆ 🎀 Дочь",
    "anime": "JoJo's Bizarre Adventure",
    "animeRu": "Невероятные приключения ДжоДжо",
    "char1": {
      "id": 4003,
      "name": "Joutarou Kuujou",
      "russian": "Джотаро Куджо",
      "role": "Отец (Star Platinum)",
      "image": "/system/characters/preview/4003.jpg?1716844320"
    },
    "char2": {
      "id": 11222,
      "name": "Jolyne Kuujou",
      "russian": "Джолин Куджо",
      "role": "Дочь (Stone Ocean)",
      "image": "/system/characters/preview/11222.jpg?1716844557"
    },
    "note": "Джотаро прибыл в тюрьму Green Dolphin Street, чтобы спасти Джолин ценой памяти и стенда."
  },
  {
    "id": "fd-6",
    "tags": [
      "father_daughter"
    ],
    "relationLabel": "🎀 Отец ⇆ 🎀 Дочь",
    "anime": "Death Note",
    "animeRu": "Тетрадь смерти",
    "char1": {
      "id": 1927,
      "name": "Souichirou Yagami",
      "russian": "Соитиро Ягами",
      "role": "Отец",
      "image": "/system/characters/preview/1927.jpg?1712016496"
    },
    "char2": {
      "id": 8135,
      "name": "Sayu Yagami",
      "russian": "Саю Ягами",
      "role": "Дочь",
      "image": "/system/characters/preview/8135.jpg?1712019680"
    },
    "note": "Соитиро спас дочь Сау из рук террористов в пустыне."
  },
  {
    "id": "md-1",
    "tags": [
      "mother_daughter"
    ],
    "relationLabel": "🌷 Мать ⇆ 🌷 Дочь",
    "anime": "Oshi no Ko",
    "animeRu": "Звёздное дитя",
    "char1": {
      "id": 188037,
      "name": "Ai Hoshino",
      "russian": "Ай Хосино",
      "role": "Мать",
      "image": "/system/characters/preview/188037.jpg?1718058320"
    },
    "char2": {
      "id": 186921,
      "name": "Ruby Hoshino",
      "russian": "Руби Хосино",
      "role": "Дочь",
      "image": "/system/characters/preview/186921.jpg?1718058197"
    },
    "note": "Руби продолжила путь матери Ай, воссоздав легендарную айдол-группу B-Komachi."
  },
  {
    "id": "md-2",
    "tags": [
      "mother_daughter"
    ],
    "relationLabel": "🌷 Мать ⇆ 🌷 Дочь",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 1555,
      "name": "Hinata Hyuuga",
      "russian": "Хината Хюга",
      "role": "Мать",
      "image": "/system/characters/preview/1555.jpg?1716844172"
    },
    "char2": {
      "id": 117789,
      "name": "Himawari Uzumaki",
      "russian": "Химавари Узумаки",
      "role": "Дочь",
      "image": "/system/characters/preview/117789.jpg?1716846267"
    },
    "note": "Хината передала Химавари доброту, мудрость и грацию стиля Мягкого Кулака."
  },
  {
    "id": "md-3",
    "tags": [
      "mother_daughter"
    ],
    "relationLabel": "🌷 Мать ⇆ 🌷 Дочь",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 54495,
      "name": "Linlin Charlotte",
      "russian": "Линлин Шарлотта",
      "role": "Мать (Биг Мам)",
      "image": "/system/characters/preview/54495.jpg?1717793344"
    },
    "char2": {
      "id": 149813,
      "name": "Pudding Charlotte",
      "russian": "Пудинг Шарлотта",
      "role": "Дочь (35-я дочь)",
      "image": "/system/characters/preview/149813.jpg?1718745411"
    },
    "note": "Пудинг с трёхглазым оком страдала от ожиданий властной матери Линлин."
  },
  {
    "id": "md-4",
    "tags": [
      "mother_daughter"
    ],
    "relationLabel": "🌷 Мать ⇆ 🌷 Дочь",
    "anime": "Gintama",
    "animeRu": "Гинтама",
    "char1": {
      "id": 155934,
      "name": "Kouka",
      "russian": "Кока",
      "role": "Мать",
      "image": "/system/characters/preview/155934.jpg?1712063185"
    },
    "char2": {
      "id": 1369,
      "name": "Kagura",
      "russian": "Кагура",
      "role": "Дочь",
      "image": "/system/characters/preview/1369.jpg?1712016159"
    },
    "note": "Кагура бережно хранит воспоминания о матери Коке и её вечной улыбке."
  },
  {
    "id": "gp-1",
    "tags": [
      "grandparent"
    ],
    "relationLabel": "📜 Дедушка ⇆ 👶 Внук",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 8064,
      "name": "Garp Monkey D.",
      "russian": "Гарп Монки Д.",
      "role": "Дедушка (Герой Дозора)",
      "image": "/system/characters/preview/8064.jpg?1718659286"
    },
    "char2": {
      "id": 40,
      "name": "Luffy Monkey D.",
      "russian": "Луффи Монки Д.",
      "role": "Внук (Мугивара)",
      "image": "/system/characters/preview/40.jpg?1718830202"
    },
    "note": "Гарп сбрасывал Луффи в ущелья и привязывал к шарам, закаляя стальной дух внука."
  },
  {
    "id": "gp-2",
    "tags": [
      "grandparent"
    ],
    "relationLabel": "📜 Дедушка ⇆ 👶 Внук",
    "anime": "Bleach",
    "animeRu": "Блич",
    "char1": {
      "id": 22844,
      "name": "Souken Ishida",
      "russian": "Сокэн Исида",
      "role": "Дедушка (Мастер Квинси)",
      "image": "/system/characters/preview/22844.jpg?1712025538"
    },
    "char2": {
      "id": 564,
      "name": "Uryuu Ishida",
      "russian": "Урю Исида",
      "role": "Внук",
      "image": "/system/characters/preview/564.jpg?1715720357"
    },
    "note": "Сокэн научил Урю гордости квинси и передал священные перчатки Санрэй."
  },
  {
    "id": "gp-3",
    "tags": [
      "grandparent"
    ],
    "relationLabel": "📜 Дедушка ⇆ 👶 Внук",
    "anime": "Hunter x Hunter",
    "animeRu": "Охотник х Охотник",
    "char1": {
      "id": 59,
      "name": "Zeno Zoldyck",
      "russian": "Зено Золдик",
      "role": "Дедушка (Легендарный убийца)",
      "image": "/system/characters/preview/59.jpg?1712015329"
    },
    "char2": {
      "id": 27,
      "name": "Killua Zoldyck",
      "russian": "Киллуа Золдик",
      "role": "Внук",
      "image": "/system/characters/preview/27.jpg?1712015316"
    },
    "note": "Зено признавал феноменальный талант Киллуа как главного наследника династии Золдиков."
  },
  {
    "id": "gp-4",
    "tags": [
      "grandparent"
    ],
    "relationLabel": "📜 Дедушка ⇆ 👶 Внук",
    "anime": "Dragon Ball Z",
    "animeRu": "Драконий жемчуг Зет",
    "char1": {
      "id": 246,
      "name": "Gokuu Son",
      "russian": "Гоку Сон",
      "role": "Дедушка",
      "image": "/system/characters/preview/246.jpg?1718571788"
    },
    "char2": {
      "id": 2093,
      "name": "Gohan Son",
      "russian": "Гохан Сон",
      "role": "Сын / Отец Пан",
      "image": "/system/characters/preview/2093.jpg?1718053938"
    },
    "note": "Семья Сон веками передаёт боевое мастерство через поколения защитников Вселенной."
  },
  {
    "id": "ad-1",
    "tags": [
      "adoptive"
    ],
    "relationLabel": "🧬 Приёмный отец ⇆ 🏴‍☠️ Названый сын",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 2751,
      "name": "Newgate Edward",
      "russian": "Ньюгейт Эдвард",
      "role": "Отец (Белоус)",
      "image": "/system/characters/preview/2751.jpg?1718398256"
    },
    "char2": {
      "id": 2072,
      "name": "Ace Portgas D.",
      "russian": "Эйс Портгас Д.",
      "role": "Сын (Командир 2-й дивизии)",
      "image": "/system/characters/preview/2072.jpg?1718398222"
    },
    "note": "Белоус принял Эйса, сына своего соперника Роджера, назвав своим родным сыном."
  },
  {
    "id": "ad-2",
    "tags": [
      "adoptive"
    ],
    "relationLabel": "🧬 Приёмная мать ⇆ 👶 Приёмная дочь",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 4890,
      "name": "Bellemere",
      "russian": "Бельмере",
      "role": "Приёмная мать (Бывший дозорный)",
      "image": "/system/characters/preview/4890.jpg?1718484750"
    },
    "char2": {
      "id": 723,
      "name": "Nami",
      "russian": "Нами",
      "role": "Приёмная дочь",
      "image": "/system/characters/preview/723.jpg?1717706843"
    },
    "note": "Бельмере отдала жизнь пирату Арлонгу, не отрекшись от своих приёмных дочерей Нами и Ноджико."
  },
  {
    "id": "ad-3",
    "tags": [
      "adoptive"
    ],
    "relationLabel": "🧬 Приёмная мать ⇆ 👶 Воспитанница",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 161701,
      "name": "Carmel",
      "russian": "Кармель",
      "role": "Матушка Кармель",
      "image": "/system/characters/preview/161701.jpg?1718486481"
    },
    "char2": {
      "id": 54495,
      "name": "Linlin Charlotte",
      "russian": "Линлин Шарлотта",
      "role": "Воспитанница (Биг Мам)",
      "image": "/system/characters/preview/54495.jpg?1717793344"
    },
    "note": "Кармель открыла Дом Овец на Эльбафе и воспитала брошенную родителями маленькую Линлин."
  },
  {
    "id": "ad-4",
    "tags": [
      "adoptive",
      "father_daughter"
    ],
    "relationLabel": "🧬 Приёмный отец ⇆ 🎀 Дочь",
    "anime": "Spy x Family",
    "animeRu": "Семья шпиона",
    "char1": {
      "id": 170258,
      "name": "Loid Forger",
      "russian": "Лойд Форджер",
      "role": "Приёмный отец",
      "image": "/system/characters/preview/170258.jpg?1712438081"
    },
    "char2": {
      "id": 170256,
      "name": "Anya Forger",
      "russian": "Аня Форджер",
      "role": "Приёмная дочь",
      "image": "/system/characters/preview/170256.jpg?1712524505"
    },
    "note": "Шпион Сумрак удочерил Аню из приюта, подарив девочке настоящую семью и заботу."
  },
  {
    "id": "ad-5",
    "tags": [
      "adoptive",
      "father_son"
    ],
    "relationLabel": "🧬 Приёмный отец ⇆ 👶 Сын",
    "anime": "Blue Exorcist",
    "animeRu": "Синий экзорцист",
    "char1": {
      "id": 30431,
      "name": "Shirou Fujimoto",
      "russian": "Сиро Фудзимото",
      "role": "Приёмный отец (Отец Фудзимото)",
      "image": "/system/characters/preview/30431.jpg?1711054649"
    },
    "char2": {
      "id": 24482,
      "name": "Rin Okumura",
      "russian": "Рин Окумура",
      "role": "Приёмный сын",
      "image": "/system/characters/preview/24482.jpg?1711054548"
    },
    "note": "Сиро Фудзимото вырастил Рина и Юкио как родных сыновей и отдал жизнь, защищая их от Сатаны."
  },
  {
    "id": "cl-1",
    "tags": [
      "clans"
    ],
    "relationLabel": "🏛️ Клан Учиха",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 53901,
      "name": "Madara Uchiha",
      "russian": "Мадара Учиха",
      "role": "Легендарный лидер клана",
      "image": "/system/characters/preview/53901.jpg?1716845324"
    },
    "char2": {
      "id": 13,
      "name": "Sasuke Uchiha",
      "russian": "Саскэ Учиха",
      "role": "Последний чистокровный Учиха",
      "image": "/system/characters/preview/13.jpg?1716844018"
    },
    "note": "Реинкарнации Индры Ооцуцуки и величайшие обладатели Вечного Мангэкё Шарингана."
  },
  {
    "id": "cl-2",
    "tags": [
      "clans"
    ],
    "relationLabel": "🏛️ Клан Сенджу",
    "anime": "Naruto",
    "animeRu": "Наруто",
    "char1": {
      "id": 12464,
      "name": "Hashirama Senju",
      "russian": "Хаширама Сэнджу",
      "role": "Первый Хокаге",
      "image": "/system/characters/preview/12464.jpg?1712021348"
    },
    "char2": {
      "id": 12465,
      "name": "Tobirama Senju",
      "russian": "Тобирама Сэнджу",
      "role": "Второй Хокаге",
      "image": "/system/characters/preview/12465.jpg?1712021375"
    },
    "note": "Потомки Асуры Ооцуцуки, одарённые невероятной жизненной силой и Волей Огня."
  },
  {
    "id": "cl-3",
    "tags": [
      "clans"
    ],
    "relationLabel": "🏛️ Семья Шарлотта",
    "anime": "One Piece",
    "animeRu": "Ван-Пис",
    "char1": {
      "id": 54495,
      "name": "Linlin Charlotte",
      "russian": "Линлин Шарлотта",
      "role": "Матриарх (Биг Мам)",
      "image": "/system/characters/preview/54495.jpg?1717793344"
    },
    "char2": {
      "id": 150775,
      "name": "Katakuri Charlotte",
      "russian": "Катакури Шарлотта",
      "role": "Сильнейший сын семьи",
      "image": "/system/characters/preview/150775.jpg?1718486382"
    },
    "note": "Огромная семья из 85 детей, контролирующая 34 острова архипелага Тотлэнд."
  },
  {
    "id": "cl-4",
    "tags": [
      "clans"
    ],
    "relationLabel": "🏛️ Династия Джостаров",
    "anime": "JoJo's Bizarre Adventure",
    "animeRu": "Невероятные приключения ДжоДжо",
    "char1": {
      "id": 8087,
      "name": "Jonathan Joestar",
      "russian": "Джонатан Джостар",
      "role": "Основатель рода",
      "image": "/system/characters/preview/8087.jpg?1712019661"
    },
    "char2": {
      "id": 4003,
      "name": "Joutarou Kuujou",
      "russian": "Джотаро Куджо",
      "role": "3-й ДжоДжо (Star Platinum)",
      "image": "/system/characters/preview/4003.jpg?1716844320"
    },
    "note": "Род Джостаров с родимым пятном в виде звезды веками сражается с проклятием Дио Брандо."
  },
  {
    "id": "cl-5",
    "tags": [
      "clans"
    ],
    "relationLabel": "🏛️ Клан Золдик",
    "anime": "Hunter x Hunter",
    "animeRu": "Охотник х Охотник",
    "char1": {
      "id": 60,
      "name": "Silva Zoldyck",
      "russian": "Сильва Золдик",
      "role": "Глава клана",
      "image": "/system/characters/preview/60.jpg?1712015336"
    },
    "char2": {
      "id": 27,
      "name": "Killua Zoldyck",
      "russian": "Киллуа Золдик",
      "role": "Наследник клана",
      "image": "/system/characters/preview/27.jpg?1712015316"
    },
    "note": "Семья легендарных наёмных убийц горы Кукулу с безупречными техниками убийства."
  }
];

// ==========================================
// KINSHIP CATALOG (Live API Browser with Pagination)
// ==========================================
const kinshipState = {
  page: 1,
  limit: 8,
  activeTag: 'all',
  animeFilter: 'all',
  animeId: null,
  order: 'default',
  query: '',
  loading: false
};

function loadKinshipForAnime(animeId, animeTitle) {
  kinshipState.animeId = animeId;
  kinshipState.animeFilter = animeTitle;
  kinshipState.activeTag = 'all';
  kinshipState.query = '';
  kinshipState.page = 1;

  const select = document.getElementById('kinshipAnimeFilter');
  if (select) {
    let opt = select.querySelector(`option[value="${animeTitle}"]`);
    if (!opt) {
      opt = document.createElement('option');
      opt.value = animeTitle;
      opt.textContent = `🎬 ${animeTitle} (Выбранный тайтл)`;
      select.prepend(opt);
    }
    select.value = animeTitle;
  }

  document.getElementById('titleSection')?.classList.add('hidden');
  document.getElementById('resultsSection')?.classList.add('hidden');
  document.getElementById('kinshipCatalogSection')?.classList.remove('hidden');
  document.getElementById('titlesCatalogSection')?.classList.remove('hidden');

  document.querySelectorAll('.kinship-tag-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.tag === 'all');
  });

  loadKinshipCatalog(1);
  document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function populateKinshipAnimeDropdown(animeList = []) {
  const select = document.getElementById('kinshipAnimeFilter');
  if (!select) return;

  const currentVal = kinshipState.animeFilter;
  const totalCount = animeList.reduce((acc, a) => acc + (a.count || 0), 0);
  let html = `<option value="all">🎬 Все тайтлы (${totalCount} связей)</option>`;

  animeList.forEach(item => {
    const sel = item.anime === currentVal ? 'selected' : '';
    html += `<option value="${esc(item.anime)}" ${sel}>${esc(item.animeRu)} (${item.count})</option>`;
  });

  select.innerHTML = html;
}

const kinshipPageCache = new Map();

function renderSmartPagination({ curPage, totalPages, totalItems, labelPlural, prefix, container, onPageChange }) {
  if (!container) return;

  const pages = [];
  const addPage = (p) => {
    if (p >= 1 && p <= totalPages && !pages.includes(p)) pages.push(p);
  };

  addPage(1);
  for (let i = Math.max(1, curPage - 2); i <= Math.min(totalPages, curPage + 2); i++) {
    addPage(i);
  }

  const milestones = [10, 25, 50, 100, 200, 500, 999];
  for (const m of milestones) {
    if (m > curPage + 3 && m <= totalPages) {
      addPage(m);
      if (pages.filter(p => p > curPage).length >= 5) break;
    }
  }

  pages.sort((a, b) => a - b);

  let buttonsHtml = '';
  let lastP = 0;
  for (const p of pages) {
    if (lastP && p - lastP > 1) {
      buttonsHtml += `<span class="kinship-page-dots">…</span>`;
    }
    const isLandmark = p >= 100 ? ' landmark-pill' : '';
    buttonsHtml += `
      <button type="button" class="kinship-page-btn ${p === curPage ? 'active' : ''}${isLandmark}" data-${prefix}-page="${p}">
        ${p >= 999 ? '999+' : p}
      </button>
    `;
    lastP = p;
  }

  const displayTotalPages = totalPages >= 999 ? '999+' : totalPages;
  const countDesc = totalItems > 0 ? `Всего <strong>${totalItems.toLocaleString()}</strong> ${labelPlural}` : 'Вселенная связей';

  container.innerHTML = `
    <div class="kinship-page-info">
      Страница <strong class="page-current-highlight">${curPage}</strong> из <strong>${displayTotalPages}</strong> · ${countDesc}
    </div>
    <div class="kinship-page-nav-row">
      <div class="kinship-page-btns">
        <button type="button" class="kinship-page-btn" id="${prefix}PrevBtn" ${curPage <= 1 ? 'disabled' : ''}>← Назад</button>
        ${buttonsHtml}
        <button type="button" class="kinship-page-btn" id="${prefix}NextBtn" ${curPage >= totalPages ? 'disabled' : ''}>Вперёд →</button>
      </div>
      <div class="page-quick-jump">
        <span class="jump-label">Перейти:</span>
        <input type="number" min="1" max="9999" class="jump-input" id="${prefix}JumpInput" placeholder="№" value="${curPage}">
        <button type="button" class="jump-btn" id="${prefix}JumpBtn">Перейти →</button>
      </div>
    </div>
  `;

  container.querySelectorAll(`[data-${prefix}-page]`).forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.getAttribute(`data-${prefix}-page`));
      if (p && p !== curPage) onPageChange(p);
    });
  });

  const prev = document.getElementById(`${prefix}PrevBtn`);
  if (prev) {
    prev.addEventListener('click', () => {
      if (curPage > 1) onPageChange(curPage - 1);
    });
  }

  const next = document.getElementById(`${prefix}NextBtn`);
  if (next) {
    next.addEventListener('click', () => {
      if (curPage < totalPages) onPageChange(curPage + 1);
    });
  }

  const jumpInput = document.getElementById(`${prefix}JumpInput`);
  const jumpBtn = document.getElementById(`${prefix}JumpBtn`);
  const triggerJump = () => {
    const val = parseInt(jumpInput?.value, 10);
    if (val && val >= 1) onPageChange(val);
  };
  jumpBtn?.addEventListener('click', triggerJump);
  jumpInput?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      triggerJump();
    }
  });
}

async function loadKinshipCatalog(targetPage = 1) {
  const grid = document.getElementById('kinshipCatalogGrid');
  const pagination = document.getElementById('kinshipPagination');
  const loader = document.getElementById('kinshipCatalogLoading');
  const totalBadge = document.getElementById('kinshipTotalBadge');
  if (!grid || !pagination) return;

  kinshipState.page = Math.max(1, targetPage);
  kinshipState.loading = true;

  const { page, limit, activeTag, animeFilter, animeId, order, query } = kinshipState;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    tag: activeTag || 'all',
    anime: animeFilter || 'all',
    sort: order || 'default'
  });
  if (animeId) params.set('animeId', String(animeId));
  if (query) params.set('search', query);

  const cacheKey = params.toString();
  if (loader && !kinshipPageCache.has(cacheKey)) loader.classList.remove('hidden');

  try {
    let res;
    if (kinshipPageCache.has(cacheKey)) {
      res = kinshipPageCache.get(cacheKey);
    } else {
      res = await api(`/api/kinship?${cacheKey}`);
      kinshipPageCache.set(cacheKey, res);
    }
    const items = Array.isArray(res.items) ? res.items : [];
    const total = res.total || 0;
    const totalPages = res.totalPages || 1;

    // Update tags bar counts
    if (res.tagCounts) {
      document.querySelectorAll('.kinship-tag-btn').forEach(btn => {
        const t = btn.dataset.tag || 'all';
        const count = res.tagCounts[t] !== undefined ? res.tagCounts[t] : 0;
        let baseText = btn.dataset.baseText;
        if (!baseText) {
          baseText = btn.textContent.replace(/\s*\(\d+\)$/, '').trim();
          btn.dataset.baseText = baseText;
        }
        btn.textContent = `${baseText} (${count})`;
      });
    }

    // Populate anime filter dropdown
    if (res.animeList && (!kinshipState._animeListPopulated || kinshipState._lastAnimeCount !== res.animeList.length)) {
      populateKinshipAnimeDropdown(res.animeList);
      kinshipState._animeListPopulated = true;
      kinshipState._lastAnimeCount = res.animeList.length;
    }

    if (totalBadge) {
      totalBadge.textContent = `Страница ${page} · ${items.length} связей`;
    }

    if (!items.length) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <p style="font-size: 18px; font-weight: 700; color: var(--text-heading);">По заданному критерию связи не найдены</p>
          <p style="font-size: 13px; margin-top: 8px;">Попробуйте выбрать другой тайтл, сбросить тег родства или очистить строку поиска.</p>
          <button type="button" class="action-btn action-btn-secondary" id="resetKinshipFiltersBtn" style="margin-top: 16px;">Сбросить фильтры</button>
        </div>
      `;
      pagination.innerHTML = '';
      document.getElementById('resetKinshipFiltersBtn')?.addEventListener('click', () => {
        kinshipState.activeTag = 'all';
        kinshipState.animeFilter = 'all';
        kinshipState.order = 'default';
        kinshipState.query = '';
        kinshipState.page = 1;
        const searchInput = document.getElementById('kinshipCatalogSearch');
        if (searchInput) searchInput.value = '';
        const orderSelect = document.getElementById('kinshipOrder');
        if (orderSelect) orderSelect.value = 'default';
        const animeSelect = document.getElementById('kinshipAnimeFilter');
        if (animeSelect) animeSelect.value = 'all';
        document.querySelectorAll('.kinship-tag-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tag === 'all');
        });
        loadKinshipCatalog(1);
      });
      return;
    }

    grid.innerHTML = items.map(item => {
      const c1 = item.char1;
      const c2 = item.char2;
      const img1 = c1.image ? (imageUrl(c1.image, 'preview') || fallback) : fallback;
      const img2 = c2 && c2.image ? (imageUrl(c2.image, 'preview') || fallback) : fallback;

      const isSolo = !c2 || !c2.id;
      let bodyHtml = '';

      if (isSolo) {
        bodyHtml = `
          <div class="kinship-solo-body" style="display: flex; width: 100%;">
            <button type="button" class="kinship-char-col" data-char-id="${c1.id}" data-char-name="${esc(c1.name)}" data-char-ru="${esc(c1.russian)}" data-char-img="${esc(c1.image)}" style="width: 100%; display: flex; align-items: center; gap: 14px; padding: 10px 14px;" title="Исследовать ветку: ${esc(c1.russian || c1.name)}">
              <img class="kinship-avatar" src="${esc(img1)}" onerror="if(!this.dataset.proxied){this.dataset.proxied=1;this.src='/api/proxy-image?url='+encodeURIComponent(this.src);}else{this.src='${fallback}';}" style="width: 56px; height: 72px; border-radius: 8px; flex-shrink: 0;" alt="" loading="lazy">
              <div class="kinship-char-meta" style="flex: 1;">
                <span class="kinship-char-name" style="font-size: 14.5px; font-weight: 700;">${esc(c1.russian || c1.name)}</span>
                <span class="kinship-char-orig" style="font-size: 12px;">${esc(c1.name)}</span>
                <span class="kinship-char-role" style="font-size: 11.5px; color: #fbbf24; margin-top: 4px;">👑 ${esc(c1.role || 'Мать в аниме')}</span>
              </div>
            </button>
          </div>
        `;
      } else {
        bodyHtml = `
          <div class="kinship-pair-body">
            <button type="button" class="kinship-char-col" data-char-id="${c1.id}" data-char-name="${esc(c1.name)}" data-char-ru="${esc(c1.russian)}" data-char-img="${esc(c1.image)}" title="Исследовать ветку: ${esc(c1.russian || c1.name)}">
              <img class="kinship-avatar" src="${esc(img1)}" onerror="if(!this.dataset.proxied){this.dataset.proxied=1;this.src='/api/proxy-image?url='+encodeURIComponent(this.src);}else{this.src='${fallback}';}" alt="" loading="lazy">
              <div class="kinship-char-meta">
                <span class="kinship-char-name">${esc(c1.russian || c1.name)}</span>
                <span class="kinship-char-orig">${esc(c1.name)}</span>
                <span class="kinship-char-role">${esc(c1.role)}</span>
              </div>
            </button>

            <span class="kinship-connector-icon" title="Связь подтверждена">⇆</span>

            <button type="button" class="kinship-char-col" data-char-id="${c2.id}" data-char-name="${esc(c2.name)}" data-char-ru="${esc(c2.russian)}" data-char-img="${esc(c2.image)}" title="Исследовать ветку: ${esc(c2.russian || c2.name)}">
              <img class="kinship-avatar" src="${esc(img2)}" onerror="if(!this.dataset.proxied){this.dataset.proxied=1;this.src='/api/proxy-image?url='+encodeURIComponent(this.src);}else{this.src='${fallback}';}" alt="" loading="lazy">
              <div class="kinship-char-meta">
                <span class="kinship-char-name">${esc(c2.russian || c2.name)}</span>
                <span class="kinship-char-orig">${esc(c2.name)}</span>
                <span class="kinship-char-role">${esc(c2.role)}</span>
              </div>
            </button>
          </div>
        `;
      }

      return `
        <div class="kinship-pair-card" data-pair-id="${esc(item.id)}">
          <div class="kinship-card-top">
            <button type="button" class="kinship-anime-badge" data-anime="${esc(item.anime)}" title="Фильтровать по ${esc(item.animeRu || item.anime)}">
              🎬 ${esc(item.animeRu || item.anime)}
            </button>
            <span class="kinship-rel-badge">${esc(item.relationLabel)}</span>
          </div>
          ${bodyHtml}
          ${item.note ? `<div class="kinship-card-note">${esc(item.note)}</div>` : ''}
          <div class="kinship-card-actions">
            <button type="button" class="kinship-action-btn btn-open-char-tree" data-char-id="${c1.id}" data-char-name="${esc(c1.name)}" data-char-ru="${esc(c1.russian)}" data-char-img="${esc(c1.image)}" title="Исследовать древо персонажа">
              🌳 Древо ${esc((c1.russian || c1.name).split(' ')[0])} →
            </button>
            <button type="button" class="kinship-action-btn btn-filter-anime" data-anime="${esc(item.anime)}" title="Показать все связи этого аниме">
              🎬 Все узы тайтла
            </button>
          </div>
        </div>
      `;
    }).join('');

    // Action button clicks
    grid.querySelectorAll('.btn-open-char-tree').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        openCharacter({
          id: Number(btn.dataset.charId) || btn.dataset.charId,
          name: btn.dataset.charName,
          russian: btn.dataset.charRu,
          image: btn.dataset.charImg
        });
      });
    });

    grid.querySelectorAll('.btn-filter-anime').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const animeName = btn.dataset.anime;
        if (animeName) {
          kinshipState.animeFilter = animeName;
          kinshipState.page = 1;
          const select = document.getElementById('kinshipAnimeFilter');
          if (select) select.value = animeName;
          loadKinshipCatalog(1);
          document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Character column clicks
    grid.querySelectorAll('.kinship-char-col').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const id = btn.dataset.charId;
        const name = btn.dataset.charName;
        const russian = btn.dataset.charRu;
        const image = btn.dataset.charImg;
        openCharacter({ id: Number(id) || id, name, russian, image });
      });
    });

    // Anime badge clicks
    grid.querySelectorAll('.kinship-anime-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        e.preventDefault();
        const animeName = badge.dataset.anime;
        if (animeName) {
          kinshipState.animeFilter = animeName;
          kinshipState.page = 1;
          const select = document.getElementById('kinshipAnimeFilter');
          if (select) select.value = animeName;
          loadKinshipCatalog(1);
          document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });

    // Smart Rich 999+ Pagination for Kinship Catalog
    const curPage = kinshipState.page || 1;
    renderSmartPagination({
      curPage,
      totalPages,
      totalItems: total,
      labelPlural: 'связей',
      prefix: 'kinship',
      container: pagination,
      onPageChange: (p) => loadKinshipCatalog(p)
    });

  } catch (err) {
    console.error('Failed to load kinship catalog:', err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--accent);">
        <p style="font-weight: 700;">Не удалось загрузить каталог связей.</p>
        <p style="font-size: 13px; margin-top: 6px; color: var(--text-muted);">${esc(err.message)}</p>
        <button type="button" class="action-btn action-btn-secondary" id="retryKinshipBtn" style="margin-top: 14px;">Повторить попытку</button>
      </div>
    `;
    pagination.innerHTML = '';
    document.getElementById('retryKinshipBtn')?.addEventListener('click', () => {
      loadKinshipCatalog(page);
    });
  } finally {
    kinshipState.loading = false;
    if (loader) loader.classList.add('hidden');
  }
}

// Initial setup
updateFavBadge();
applySpoilerState();
loadKinshipCatalog(1);

// Sort change
document.getElementById('kinshipOrder')?.addEventListener('change', (e) => {
  kinshipState.order = e.target.value || 'default';
  kinshipState.page = 1;
  loadKinshipCatalog(1);
});

// Anime filter select change
document.getElementById('kinshipAnimeFilter')?.addEventListener('change', (e) => {
  const val = e.target.value || 'all';
  kinshipState.animeFilter = val;
  if (val === 'all') kinshipState.animeId = null;
  kinshipState.page = 1;
  loadKinshipCatalog(1);
});

// Tags bar click
document.getElementById('kinshipTagsBar')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.kinship-tag-btn');
  if (!btn) return;
  document.querySelectorAll('.kinship-tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  kinshipState.activeTag = btn.dataset.tag || 'all';
  kinshipState.page = 1;
  loadKinshipCatalog(1);
});

// Search filter in kinship catalog
document.getElementById('kinshipCatalogSearch')?.addEventListener('input', debounce((e) => {
  kinshipState.query = e.target.value || '';
  kinshipState.page = 1;
  loadKinshipCatalog(1);
}, 250));

// ==========================================
// ALL ANIME TITLES CATALOG (Shikimori Live API Browser)
// ==========================================
const titlesCatalogState = {
  page: 1,
  limit: 24,
  order: 'popularity',
  kind: 'all',
  search: '',
  loading: false
};

async function loadTitlesCatalog(targetPage = 1) {
  const grid = document.getElementById('titlesCatalogGrid');
  const pagination = document.getElementById('titlesCatalogPagination');
  const loader = document.getElementById('titlesCatalogLoading');
  const badge = document.getElementById('titlesCatalogBadge');
  if (!grid || !pagination) return;

  titlesCatalogState.page = Math.max(1, targetPage);
  titlesCatalogState.loading = true;
  if (loader) loader.classList.remove('hidden');

  const { page, limit, order, kind, search } = titlesCatalogState;
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
    order: order || 'popularity'
  });
  if (kind && kind !== 'all') params.set('kind', kind);
  if (search) params.set('search', search);

  try {
    const res = await api(`/api/titles?${params.toString()}`);
    const titles = Array.isArray(res.titles) ? res.titles : [];

    if (badge) {
      badge.textContent = `Страница ${page} · ${titles.length} тайтлов`;
    }

    if (!titles.length) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
          <p style="font-size: 18px; font-weight: 700; color: var(--text-heading);">Тайтлы не найдены</p>
          <p style="font-size: 13px; margin-top: 8px;">Попробуйте изменить поисковый запрос или выбрать другой тип сортировки.</p>
        </div>
      `;
      pagination.innerHTML = '';
      return;
    }

    grid.innerHTML = titles.map((t, idx) => {
      const poster = t.image?.preview ? imageUrl(t.image, 'preview') : fallback;
      const score = t.score ? Number(t.score).toFixed(1) : null;
      const year = t.aired_on ? t.aired_on.slice(0, 4) : '';
      const kindLabel = (t.kind || 'TV').toUpperCase();
      const epLabel = t.episodes ? `${t.episodes} эп.` : (t.episodes_aired ? `${t.episodes_aired}+ эп.` : '');

      return `
        <article class="titles-catalog-card" data-catalog-idx="${idx}" title="Открыть тайтл: ${esc(t.russian || t.name)}">
          <div class="titles-catalog-poster-wrap">
            <img class="titles-catalog-poster" src="${esc(poster)}" onerror="this.src='${fallback}'" alt="" loading="lazy">
            ${score && score !== '0.0' ? `<span class="titles-catalog-score-badge">★ ${score}</span>` : ''}
          </div>
          <div class="titles-catalog-info">
            <h4 class="titles-catalog-name-ru">${esc(t.russian || t.name)}</h4>
            <div class="titles-catalog-name-orig">${esc(t.name)}</div>
            <div class="titles-catalog-meta-row">
              <span>${esc(kindLabel)}${year ? ` · ${year}` : ''}</span>
              ${epLabel ? `<span>${esc(epLabel)}</span>` : ''}
            </div>
            <div class="titles-card-btn-row">
              <button type="button" class="titles-catalog-explore-btn btn-open-tree" title="Исследовать древо персонажей">
                Древо →
              </button>
              <button type="button" class="titles-catalog-explore-btn btn-kinship-filter" title="Показать родственные связи этого аниме в каталоге связей">
                🧬 Семейные узы
              </button>
            </div>
          </div>
        </article>
      `;
    }).join('');

    // Click handler on cards to open anime or kinship
    grid.querySelectorAll('.titles-catalog-card').forEach(card => {
      const idx = Number(card.dataset.catalogIdx);
      const selected = titles[idx];
      if (!selected) return;

      const treeBtn = card.querySelector('.btn-open-tree');
      const kinshipBtn = card.querySelector('.btn-kinship-filter');

      if (treeBtn) {
        treeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          selectAnime(selected);
        });
      }

      if (kinshipBtn) {
        kinshipBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          loadKinshipForAnime(selected.id, selected.russian || selected.name);
        });
      }

      card.addEventListener('click', () => {
        selectAnime(selected);
      });
    });

    // Smart Rich 999+ Pagination for Titles Catalog
    const curPage = titlesCatalogState.page || 1;
    const totalPagesTitles = Math.max(curPage + 20, 999);
    renderSmartPagination({
      curPage,
      totalPages: totalPagesTitles,
      totalItems: 50000,
      labelPlural: 'аниме тайтлов',
      prefix: 'titles',
      container: pagination,
      onPageChange: (p) => loadTitlesCatalog(p)
    });

  } catch (err) {
    console.error('Failed to load titles catalog:', err);
    grid.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--accent);">
        <p style="font-weight: 700;">Не удалось загрузить каталог аниме.</p>
        <p style="font-size: 13px; margin-top: 6px; color: var(--text-muted);">${esc(err.message)}</p>
        <button type="button" class="action-btn action-btn-secondary" id="retryTitlesCatalogBtn" style="margin-top: 14px;">Повторить попытку</button>
      </div>
    `;
    pagination.innerHTML = '';
    document.getElementById('retryTitlesCatalogBtn')?.addEventListener('click', () => {
      loadTitlesCatalog(page);
    });
  } finally {
    titlesCatalogState.loading = false;
    if (loader) loader.classList.add('hidden');
  }
}

// Initial catalog load
loadTitlesCatalog(1);

// Event listeners for sorting, filters, search
document.getElementById('titlesCatalogOrder')?.addEventListener('change', (e) => {
  titlesCatalogState.order = e.target.value || 'popularity';
  titlesCatalogState.page = 1;
  loadTitlesCatalog(1);
});

document.getElementById('titlesCatalogKind')?.addEventListener('change', (e) => {
  titlesCatalogState.kind = e.target.value || 'all';
  titlesCatalogState.page = 1;
  loadTitlesCatalog(1);
});

document.getElementById('titlesCatalogSearch')?.addEventListener('input', debounce((e) => {
  titlesCatalogState.search = e.target.value || '';
  titlesCatalogState.page = 1;
  loadTitlesCatalog(1);
}, 250));

// Main Tab Switching
function switchMainTab(tabName, options = {}) {
  if (tabName === 'finder') {
    openKinshipModal?.();
    return;
  }
  if (tabName === 'favorites') {
    openFavoritesModal?.();
    return;
  }

  const tabs = document.querySelectorAll('.main-tab-btn');
  tabs.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tabName);
  });

  const kinshipSec = document.getElementById('kinshipCatalogSection');
  const titlesSec = document.getElementById('titlesCatalogSection');
  const titleSec = document.getElementById('titleSection');
  const resultsSec = document.getElementById('resultsSection');

  if (tabName === 'kinship') {
    kinshipSec?.classList.remove('hidden');
    titlesSec?.classList.add('hidden');
    titleSec?.classList.add('hidden');
    resultsSec?.classList.add('hidden');
  } else if (tabName === 'titles') {
    titlesSec?.classList.remove('hidden');
    kinshipSec?.classList.add('hidden');
    titleSec?.classList.add('hidden');
    resultsSec?.classList.add('hidden');
  } else if (tabName === 'tree') {
    titleSec?.classList.remove('hidden');
    kinshipSec?.classList.add('hidden');
    titlesSec?.classList.add('hidden');
    resultsSec?.classList.add('hidden');
    if (!state.current && !options.skipSelect) {
      selectAnime({ id: 20, name: 'Naruto', russian: 'Наруто', media_type: 'anime' });
    }
  }
}

// Bind main tab buttons
document.querySelectorAll('.main-tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const tab = btn.dataset.tab;
    if (tab) switchMainTab(tab);
  });
});

// Deep link support via hash on initial load
window.addEventListener('DOMContentLoaded', async () => {
  const hash = window.location.hash.slice(1);
  if (!hash) return;
  const params = new URLSearchParams(hash);
  const titleId = params.get('title');
  const type = params.get('type') || 'anime';

  if (titleId) {
    try {
      showStatus('Загружаю сохранённый тайтл...');
      const endpoint = type === 'manga' ? `/api/manga?id=${titleId}` : `/api/anime?id=${titleId}`;
      const data = await api(endpoint);
      const titleObj = data.anime || data.manga || { id: titleId, media_type: type };
      selectAnime(titleObj);
    } catch (_) {
      showStatus('');
    }
  }
});
