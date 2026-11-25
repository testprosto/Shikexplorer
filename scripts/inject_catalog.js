const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'kinship_catalog_data.json');
const appPath = path.join(__dirname, '..', 'public', 'app.js');

const catalogData = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
let appCode = fs.readFileSync(appPath, 'utf8');

// Section markers
const startMarker = 'const KINSHIP_CATALOG_DATA = [';
const endMarker = 'const kinshipState = {';

const startIndex = appCode.indexOf(startMarker);
const endIndex = appCode.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find start or end marker in app.js!');
  process.exit(1);
}

// Prepare replacement code for KINSHIP_CATALOG_DATA and kinshipState and renderKinshipCatalog
const catalogJson = JSON.stringify(catalogData, null, 2);

// We replace everything from KINSHIP_CATALOG_DATA up to the end of kinship event listeners
// Let's find where kinship listeners end:
const listenersEndMarker = '// Deep link support via hash on initial load';
const listenersEndIndex = appCode.indexOf(listenersEndMarker, endIndex);

if (listenersEndIndex === -1) {
  console.error('Could not find listenersEndMarker in app.js!');
  process.exit(1);
}

const newKinshipCode = `const KINSHIP_CATALOG_DATA = ${catalogJson};

const kinshipState = {
  activeTag: 'all',
  animeFilter: 'all',
  page: 1,
  pageSize: 8,
  query: ''
};

function populateKinshipAnimeSelect() {
  const select = document.getElementById('kinshipAnimeFilter');
  if (!select) return;

  // Count by anime
  const counts = new Map();
  KINSHIP_CATALOG_DATA.forEach(item => {
    const key = item.anime;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  // Unique sorted list with ru name
  const list = [];
  const seen = new Set();
  KINSHIP_CATALOG_DATA.forEach(item => {
    if (!seen.has(item.anime)) {
      seen.add(item.anime);
      list.push({
        anime: item.anime,
        animeRu: item.animeRu || item.anime,
        count: counts.get(item.anime) || 1
      });
    }
  });
  list.sort((a, b) => a.animeRu.localeCompare(b.animeRu, 'ru'));

  const currentVal = kinshipState.animeFilter;
  let html = \`<option value="all">🎬 Все тайтлы (\${KINSHIP_CATALOG_DATA.length} связей)</option>\`;
  list.forEach(item => {
    const sel = item.anime === currentVal ? 'selected' : '';
    html += \`<option value="\${esc(item.anime)}" \${sel}>\${esc(item.animeRu)} (\${item.count})</option>\`;
  });
  select.innerHTML = html;
}

function renderKinshipCatalog() {
  const grid = document.getElementById('kinshipCatalogGrid');
  const pagination = document.getElementById('kinshipPagination');
  const totalBadge = document.getElementById('kinshipTotalBadge');
  if (!grid || !pagination) return;

  const q = kinshipState.query.toLowerCase().trim();
  const tag = kinshipState.activeTag;
  const anime = kinshipState.animeFilter;

  const filtered = KINSHIP_CATALOG_DATA.filter(item => {
    // Tag match
    if (tag !== 'all' && !item.tags.includes(tag)) return false;
    // Anime filter match
    if (anime !== 'all' && item.anime !== anime && item.animeRu !== anime) return false;
    // Query search match
    if (q) {
      const match1 = (item.char1.russian || '').toLowerCase().includes(q) || (item.char1.name || '').toLowerCase().includes(q);
      const match2 = (item.char2.russian || '').toLowerCase().includes(q) || (item.char2.name || '').toLowerCase().includes(q);
      const matchAnime = (item.anime || '').toLowerCase().includes(q) || (item.animeRu || '').toLowerCase().includes(q);
      const matchNote = (item.note || '').toLowerCase().includes(q);
      const matchRel = (item.relationLabel || '').toLowerCase().includes(q);
      if (!match1 && !match2 && !matchAnime && !matchNote && !matchRel) return false;
    }
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / kinshipState.pageSize));
  if (kinshipState.page > totalPages) kinshipState.page = 1;

  if (totalBadge) totalBadge.textContent = \`\${filtered.length} связей\`;

  if (!filtered.length) {
    grid.innerHTML = \`
      <div style="grid-column: 1 / -1; text-align: center; padding: 48px 20px; color: var(--text-muted);">
        <p style="font-size: 18px; font-weight: 700; color: var(--text-heading);">По заданному критерию связи не найдены</p>
        <p style="font-size: 13px; margin-top: 8px;">Попробуйте выбрать другой тайтл, сбросить тег родства или очистить строку поиска.</p>
        <button type="button" class="action-btn action-btn-secondary" id="resetKinshipFiltersBtn" style="margin-top: 16px;">Сбросить фильтры</button>
      </div>
    \`;
    pagination.innerHTML = '';
    const resetBtn = document.getElementById('resetKinshipFiltersBtn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        kinshipState.activeTag = 'all';
        kinshipState.animeFilter = 'all';
        kinshipState.query = '';
        kinshipState.page = 1;
        const searchInput = document.getElementById('kinshipCatalogSearch');
        if (searchInput) searchInput.value = '';
        const select = document.getElementById('kinshipAnimeFilter');
        if (select) select.value = 'all';
        document.querySelectorAll('.kinship-tag-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.tag === 'all');
        });
        renderKinshipCatalog();
      });
    }
    return;
  }

  const startIdx = (kinshipState.page - 1) * kinshipState.pageSize;
  const pageItems = filtered.slice(startIdx, startIdx + kinshipState.pageSize);

  grid.innerHTML = pageItems.map(item => {
    const c1 = item.char1;
    const c2 = item.char2;
    const img1 = imageUrl(c1.image, 'preview') || fallback;
    const img2 = imageUrl(c2.image, 'preview') || fallback;

    return \`
      <div class="kinship-pair-card" data-pair-id="\${item.id}">
        <div class="kinship-card-top">
          <button type="button" class="kinship-anime-badge" data-anime="\${esc(item.anime)}" title="Фильтровать по \${esc(item.animeRu || item.anime)}">
            🎬 \${esc(item.animeRu || item.anime)}
          </button>
          <span class="kinship-rel-badge">\${esc(item.relationLabel)}</span>
        </div>
        <div class="kinship-pair-body">
          <button type="button" class="kinship-char-col" data-char-id="\${c1.id}" data-char-name="\${esc(c1.name)}" data-char-ru="\${esc(c1.russian)}" data-char-img="\${esc(c1.image)}" title="Исследовать ветку: \${esc(c1.russian || c1.name)}">
            <img class="kinship-avatar" src="\${esc(img1)}" onerror="this.src='\${fallback}'" alt="" loading="lazy">
            <div class="kinship-char-meta">
              <span class="kinship-char-name">\${esc(c1.russian || c1.name)}</span>
              <span class="kinship-char-orig">\${esc(c1.name)}</span>
              <span class="kinship-char-role">\${esc(c1.role)}</span>
            </div>
          </button>

          <span class="kinship-connector-icon" title="Связь подтверждена">⇆</span>

          <button type="button" class="kinship-char-col" data-char-id="\${c2.id}" data-char-name="\${esc(c2.name)}" data-char-ru="\${esc(c2.russian)}" data-char-img="\${esc(c2.image)}" title="Исследовать ветку: \${esc(c2.russian || c2.name)}">
            <img class="kinship-avatar" src="\${esc(img2)}" onerror="this.src='\${fallback}'" alt="" loading="lazy">
            <div class="kinship-char-meta">
              <span class="kinship-char-name">\${esc(c2.russian || c2.name)}</span>
              <span class="kinship-char-orig">\${esc(c2.name)}</span>
              <span class="kinship-char-role">\${esc(c2.role)}</span>
            </div>
          </button>
        </div>
        \${item.note ? \`<div class="kinship-card-note">\${esc(item.note)}</div>\` : ''}
      </div>
    \`;
  }).join('');

  // Pagination HTML
  const maxButtons = 5;
  let startPage = Math.max(1, kinshipState.page - 2);
  let endPage = Math.min(totalPages, startPage + maxButtons - 1);
  if (endPage - startPage < maxButtons - 1) {
    startPage = Math.max(1, endPage - maxButtons + 1);
  }

  const pagesHtml = [];
  for (let p = startPage; p <= endPage; p++) {
    pagesHtml.push(\`
      <button type="button" class="kinship-page-btn \${p === kinshipState.page ? 'active' : ''}" data-page="\${p}">
        \${p}
      </button>
    \`);
  }

  const curFrom = startIdx + 1;
  const curTo = Math.min(startIdx + kinshipState.pageSize, filtered.length);

  pagination.innerHTML = \`
    <div class="kinship-page-info">
      Показано <strong>\${curFrom}–\${curTo}</strong> из <strong>\${filtered.length}</strong> связей (Страница \${kinshipState.page} из \${totalPages})
    </div>
    <div class="kinship-page-btns">
      <button type="button" class="kinship-page-btn" id="kinshipPrevPage" \${kinshipState.page <= 1 ? 'disabled' : ''}>← Назад</button>
      \${pagesHtml.join('')}
      <button type="button" class="kinship-page-btn" id="kinshipNextPage" \${kinshipState.page >= totalPages ? 'disabled' : ''}>Вперёд →</button>
    </div>
  \`;

  // Delegate character card clicks to openCharacter
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

  // Delegate anime badge click to filter
  grid.querySelectorAll('.kinship-anime-badge').forEach(badge => {
    badge.addEventListener('click', (e) => {
      e.preventDefault();
      const animeName = badge.dataset.anime;
      if (animeName) {
        kinshipState.animeFilter = animeName;
        kinshipState.page = 1;
        const select = document.getElementById('kinshipAnimeFilter');
        if (select) select.value = animeName;
        renderKinshipCatalog();
        document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  // Delegate pagination clicks
  pagination.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const p = Number(btn.dataset.page);
      if (p && p !== kinshipState.page) {
        kinshipState.page = p;
        renderKinshipCatalog();
        document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  const prevBtn = document.getElementById('kinshipPrevPage');
  if (prevBtn) {
    prevBtn.addEventListener('click', () => {
      if (kinshipState.page > 1) {
        kinshipState.page--;
        renderKinshipCatalog();
        document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  const nextBtn = document.getElementById('kinshipNextPage');
  if (nextBtn) {
    nextBtn.addEventListener('click', () => {
      if (kinshipState.page < totalPages) {
        kinshipState.page++;
        renderKinshipCatalog();
        document.getElementById('kinshipCatalogSection')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }
}

// Initial setup
populateKinshipAnimeSelect();
updateFavBadge();
applySpoilerState();
renderKinshipCatalog();

// Anime filter select change
document.getElementById('kinshipAnimeFilter')?.addEventListener('change', (e) => {
  kinshipState.animeFilter = e.target.value || 'all';
  kinshipState.page = 1;
  renderKinshipCatalog();
});

// Tags bar click
document.getElementById('kinshipTagsBar')?.addEventListener('click', (e) => {
  const btn = e.target.closest('.kinship-tag-btn');
  if (!btn) return;
  document.querySelectorAll('.kinship-tag-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  kinshipState.activeTag = btn.dataset.tag || 'all';
  kinshipState.page = 1;
  renderKinshipCatalog();
});

// Search filter in kinship catalog
document.getElementById('kinshipCatalogSearch')?.addEventListener('input', debounce((e) => {
  kinshipState.query = e.target.value || '';
  kinshipState.page = 1;
  renderKinshipCatalog();
}, 200));

`;

// Perform replacement
appCode = appCode.slice(0, startIndex) + newKinshipCode + appCode.slice(listenersEndIndex);
fs.writeFileSync(appPath, appCode, 'utf8');
console.log('Successfully updated public/app.js with new Kinship Catalog and Anime Filter!');
