// ===== CONFIGURATION =====
const API_URL = 'api.php';

// ===== STATE =====
let DB = { animes: [], mangas: [] };
let dbLoaded = false;
let currentTab = 'anime';
let currentFilter = 'all';
let currentSort = 'default';
let editingId = null;
let modalType = 'anime';
let timeDisplayMode = 0; // 0: jours, 1: heures, 2: minutes
let viewMode = 'condensed';
let syncPending = false;

// ===== API =====
async function apiGet() {
  const res = await fetch(API_URL + '?action=get_all');
  if (!res.ok) throw new Error('Erreur chargement API');
  return res.json();
}

async function apiSave() {
  const res = await fetch(API_URL + '?action=save_all', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ animes: DB.animes, mangas: DB.mangas })
  });
  if (!res.ok) throw new Error('Erreur sauvegarde API');
  return res.json();
}

// ===== CHARGEMENT =====
async function loadDatabase() {
  setSyncStatus('syncing');
  try {
    const data = await apiGet();
    DB = { animes: data.animes || [], mangas: data.mangas || [] };
    dbLoaded = true;
    setSyncStatus('synced');
    renderAll();
  } catch (err) {
    console.error('Erreur chargement:', err);
    setSyncStatus('error');
    showNotification('Impossible de charger les données : ' + err.message, 'error');
    DB = { animes: [], mangas: [] };
    renderAll();
  }
}

// ===== SAUVEGARDE =====
async function syncData() {
  if (!dbLoaded) return;
  setSyncStatus('syncing');
  try {
    await apiSave();
    setSyncStatus('synced');
  } catch (err) {
    console.error('Erreur sauvegarde:', err);
    setSyncStatus('error');
    showNotification('Erreur de sauvegarde : ' + err.message, 'error');
  }
}

// ===== INDICATEUR SYNC =====
function setSyncStatus(status) {
  const dot = document.getElementById('sync-dot');
  const text = document.getElementById('sync-text');
  dot.className = 'sync-dot ' + status;
  const labels = { synced: 'Sauvegardé', syncing: 'Sync...', error: 'Erreur' };
  text.textContent = labels[status] || status;
}

// ===== NOTIFICATIONS =====
function showNotification(message, type = 'info') {
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
    `;
    document.head.appendChild(style);
  }
  const toast = document.createElement('div');
  const bg = type === 'error' ? 'var(--accent)' : type === 'success' ? 'var(--green)' : 'var(--blue)';
  toast.style.cssText = `position:fixed;bottom:60px;right:20px;background:${bg};color:white;padding:12px 20px;border-radius:8px;font-size:0.85rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);animation:slideIn 0.3s ease;max-width:350px;`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ===== UTILS =====
function getStatus(item) {
  if (item.type === 'manga') {
    if (item.total === 0) return 'pas-commence';
    if (item.read >= item.total) return 'fini';
    if (item.read > 0) return 'en-cours';
    return 'pas-commence';
  }
  const totalEps = item.seasons.reduce((s, se) => s + se.eps, 0);
  const watchedEps = item.seasons.reduce((s, se) => s + se.watched, 0);
  if (totalEps === 0) return 'pas-commence';
  if (watchedEps >= totalEps) return 'fini';
  if (watchedEps > 0) return 'en-cours';
  return 'pas-commence';
}

function getProgress(item) {
  if (item.type === 'manga') return item.total > 0 ? item.read / item.total : 0;
  const total = item.seasons.reduce((s, se) => s + se.eps, 0);
  const watched = item.seasons.reduce((s, se) => s + se.watched, 0);
  return total > 0 ? watched / total : 0;
}

function formatTime(mins) {
  if (mins < 60) return mins + 'min';
  const h = Math.floor(mins / 60);
  if (h < 24) return h + 'h';
  const d = Math.floor(h / 24);
  const rh = h % 24;
  return d + 'j ' + (rh > 0 ? rh + 'h' : '');
}

function formatTimeInteractive(mins) {
  if (timeDisplayMode === 0) return formatTime(mins);
  if (timeDisplayMode === 1) { const h = Math.floor(mins / 60); const m = mins % 60; return h + 'h ' + (m > 0 ? m + 'min' : ''); }
  return mins + ' minutes';
}

function cycleTimeDisplay() {
  timeDisplayMode = (timeDisplayMode + 1) % 3;
  renderStats();
}

function badgeHTML(status) {
  const map = {
    'fini':          ['badge-fini',          '✓ Fini'],
    'en-cours':      ['badge-en-cours',      '⟳ En cours'],
    'pas-commence':  ['badge-pas-commence',  '○ À voir']
  };
  const [cls, label] = map[status];
  return `<span class="card-badge ${cls}">${label}</span>`;
}

function genId() {
  return 'x' + Math.random().toString(36).substr(2, 9);
}

// ===== RENDU =====
function renderStats() {
  const totalEpsWatched = DB.animes.reduce((sum, a) => sum + a.seasons.reduce((s, se) => s + se.watched, 0), 0);
  const totalTimeMin    = DB.animes.reduce((sum, a) => sum + a.seasons.reduce((s, se) => s + se.watched * se.epDur, 0), 0);
  const totalTomesLus   = DB.mangas.reduce((sum, m) => sum + m.read, 0);
  const animesTermines  = DB.animes.filter(a => getStatus(a) === 'fini').length;
  const mangasTermines  = DB.mangas.filter(m => getStatus(m) === 'fini').length;
  const episodesAVoir   = DB.animes.reduce((sum, a) => {
    const total = a.seasons.reduce((s, se) => s + se.eps, 0);
    const watched = a.seasons.reduce((s, se) => s + se.watched, 0);
    return sum + (total - watched);
  }, 0);
  const tomesALire = DB.mangas.reduce((sum, m) => sum + (m.total - m.read), 0);

  if (currentTab === 'anime') {
    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Épisodes vus</div>
        <div class="stat-value accent">${totalEpsWatched}</div>
        <div class="stat-sub">${formatTimeInteractive(totalTimeMin)} de visionnage</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Épisodes à voir</div>
        <div class="stat-value blue">${episodesAVoir}</div>
        <div class="stat-sub">restants</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Animes terminés</div>
        <div class="stat-value green">${animesTermines}</div>
        <div class="stat-sub">sur ${DB.animes.length} titres</div>
      </div>
      <div class="stat-card" style="cursor:pointer;" onclick="cycleTimeDisplay()" title="Cliquer pour changer l'unité">
        <div class="stat-label">Temps de visionnage ⏱️</div>
        <div class="stat-value purple">${formatTimeInteractive(totalTimeMin)}</div>
        <div class="stat-sub">cliquer pour changer</div>
      </div>`;
  } else {
    document.getElementById('stats-row').innerHTML = `
      <div class="stat-card">
        <div class="stat-label">Tomes lus</div>
        <div class="stat-value purple">${totalTomesLus}</div>
        <div class="stat-sub">tomes</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Tomes à lire</div>
        <div class="stat-value blue">${tomesALire}</div>
        <div class="stat-sub">restants</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Mangas terminés</div>
        <div class="stat-value green">${mangasTermines}</div>
        <div class="stat-sub">sur ${DB.mangas.length} séries</div>
      </div>`;
  }
}

function renderAll() {
  renderStats();
  const search = document.getElementById('search-input').value.toLowerCase();
  let data = currentTab === 'anime' ? DB.animes : DB.mangas;

  document.getElementById('pill-anime').textContent = DB.animes.length;
  document.getElementById('pill-manga').textContent = DB.mangas.length;

  let filtered = data.filter(item => {
    const status = getStatus(item);
    if (currentFilter !== 'all' && status !== currentFilter) return false;
    if (search && !item.title.toLowerCase().includes(search)) return false;
    return true;
  });

  filtered = sortDataArray(filtered);

  const grid = document.getElementById('grid');
  grid.classList.toggle('expanded-view', viewMode === 'expanded');

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="icon">📭</div><p>Aucun résultat</p></div>`;
    return;
  }
  grid.innerHTML = filtered.map(item => renderCard(item)).join('');
}

function sortDataArray(data) {
  const arr = [...data];
  switch (currentSort) {
    case 'alpha-asc':  arr.sort((a, b) => a.title.localeCompare(b.title)); break;
    case 'alpha-desc': arr.sort((a, b) => b.title.localeCompare(a.title)); break;
    case 'recent':     arr.sort((a, b) => (b.lastModified || 0) - (a.lastModified || 0)); break;
    case 'progress':   arr.sort((a, b) => getProgress(b) - getProgress(a)); break;
    case 'duration':
      arr.sort((a, b) => {
        if (a.type === 'anime') {
          const durA = a.seasons.reduce((s, se) => s + se.eps * se.epDur, 0);
          const durB = b.seasons.reduce((s, se) => s + se.eps * se.epDur, 0);
          return durB - durA;
        }
        return (b.total || 0) - (a.total || 0);
      });
      break;
  }
  return arr;
}

function sortData() {
  currentSort = document.getElementById('sort-select').value;
  renderAll();
}

function renderCard(item) {
  const status = getStatus(item);
  const progress = getProgress(item);
  const color = item.type === 'manga' ? 'var(--manga)' : 'var(--anime)';
  const isExpanded = viewMode === 'expanded';
  const posterUrl = item.poster || `https://via.placeholder.com/140x200/1a1a26/8888aa?text=${encodeURIComponent((item.title || '?').substring(0, 2).toUpperCase())}`;

  if (item.type === 'manga') {
    const pct = Math.round(progress * 100);
    const posterBlock = isExpanded ? `<img class="card-poster" src="${posterUrl}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/140x200/1a1a26/8888aa?text=NO+IMG'">` : '';
    const inner = `
      <div class="card-header">
        <div class="card-title">${item.title}</div>
        ${badgeHTML(status)}
      </div>
      <div class="progress-wrap">
        <div class="progress-label"><span>Tomes lus</span><strong>${item.read} / ${item.total}</strong></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div style="text-align:right;font-size:0.7rem;color:var(--text-dim);margin-top:2px;">${pct}%</div>
      </div>
      ${item.notes ? `<div style="font-size:0.72rem;color:var(--text-dim);margin-top:0.5rem;">📝 ${item.notes}</div>` : ''}
      <div class="card-actions">
        ${item.read < item.total ? `<button class="btn-sm" onclick="quickUpdateManga('${item.id}',1)">+1 tome</button>` : ''}
        <button class="btn-sm" onclick="editEntry('${item.id}')">Modifier</button>
        <button class="btn-sm danger" onclick="deleteEntry('${item.id}')">Supprimer</button>
      </div>`;

    if (isExpanded) return `<div class="card expanded" style="--card-color:${color}">${posterBlock}<div class="card-content">${inner}</div></div>`;
    return `<div class="card" style="--card-color:${color}">${inner}</div>`;
  }

  // Anime
  const totalEps   = item.seasons.reduce((s, se) => s + se.eps, 0);
  const watchedEps = item.seasons.reduce((s, se) => s + se.watched, 0);
  const totalTime  = item.seasons.reduce((s, se) => s + se.watched * se.epDur, 0);
  const pct = totalEps > 0 ? Math.round(watchedEps / totalEps * 100) : 0;
  const inProgressCount = item.seasons.filter(se => se.watched > 0 && se.watched < se.eps).length;
  const notStartedCount = item.seasons.filter(se => se.watched === 0 && se.eps > 0).length;
  const toggleLabel = item.seasons.length === 1 ? '1 saison' : `${item.seasons.length} saisons`;

  const seasonsDetailHTML = item.seasons.map((se, idx) => {
    const isDone = se.watched >= se.eps;
    const sePct = se.eps > 0 ? Math.round(se.watched / se.eps * 100) : 0;
    return `<div class="season-row">
      <span class="season-row-name">${se.name}</span>
      <div class="season-row-bar"><div class="season-row-fill" style="width:${sePct}%"></div></div>
      <span class="season-row-count${isDone ? ' done' : ''}">${se.watched}/${se.eps}</span>
      ${isDone
        ? `<span class="season-done-badge">fini</span>`
        : `<button class="btn-ep" onclick="quickEpisode('${item.id}',${idx})">+1 ep</button>`
      }
    </div>`;
  }).join('');

  const seasonsBlock = item.seasons.length > 0 ? `
    <div class="progress-wrap">
      <div class="progress-label"><span>Épisodes</span><strong>${watchedEps} / ${totalEps} · ${formatTime(totalTime)}</strong></div>
      <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div style="text-align:right;font-size:0.7rem;color:var(--text-dim);margin-top:2px;">${pct}%</div>
    </div>
    <div class="seasons-toggle" onclick="toggleSeasons('${item.id}', this)" id="toggle-${item.id}">
      <span class="toggle-arrow">&#9654;</span>
      <span>${toggleLabel}</span>
      ${inProgressCount > 0 ? `<span style="color:var(--accent2);font-size:0.68rem;">&middot; ${inProgressCount} en cours</span>` : ''}
      ${notStartedCount > 0 && inProgressCount === 0 ? `<span style="color:var(--text-dim);font-size:0.68rem;">&middot; ${notStartedCount} à voir</span>` : ''}
    </div>
    <div class="seasons-detail" id="detail-${item.id}">${seasonsDetailHTML}</div>`
    : `<div class="card-subtitle" style="margin-top:0.5rem">Aucune saison renseignée</div>`;

  const inner = `
    <div class="card-header">
      <div class="card-title">${item.title}</div>
      ${badgeHTML(status)}
    </div>
    ${seasonsBlock}
    <div class="card-actions">
      <button class="btn-sm" onclick="editEntry('${item.id}')">Modifier</button>
      <button class="btn-sm danger" onclick="deleteEntry('${item.id}')">Supprimer</button>
    </div>`;

  const posterBlock = isExpanded ? `<img class="card-poster" src="${posterUrl}" alt="${item.title}" onerror="this.src='https://via.placeholder.com/140x200/1a1a26/8888aa?text=NO+IMG'">` : '';

  if (isExpanded) return `<div class="card expanded" style="--card-color:${color}">${posterBlock}<div class="card-content">${inner}</div></div>`;
  return `<div class="card" style="--card-color:${color}">${inner}</div>`;
}

// ===== INTERACTIONS =====
function switchTab(tab) {
  currentTab = tab;
  document.getElementById('tab-anime').classList.toggle('active', tab === 'anime');
  document.getElementById('tab-manga').classList.toggle('active', tab === 'manga');
  renderAll();
}

function setFilter(f) {
  currentFilter = f;
  ['all', 'fini', 'en-cours', 'pas-commence'].forEach(id => {
    document.getElementById('filter-' + id).classList.toggle('active', id === f);
  });
  renderAll();
}

function quickUpdateManga(id, delta) {
  const m = DB.mangas.find(x => x.id === id);
  if (!m) return;
  m.read = Math.max(0, Math.min(m.total, m.read + delta));
  m.lastModified = Date.now();
  syncData();
  renderAll();
}

function quickEpisode(animeId, seasonIdx) {
  const a = DB.animes.find(x => x.id === animeId);
  if (!a) return;
  const se = a.seasons[seasonIdx];
  if (se.watched < se.eps) {
    se.watched++;
    a.lastModified = Date.now();
    syncData();
    renderAll();
  }
}

function toggleSeasons(animeId, toggleEl) {
  const detail = document.getElementById('detail-' + animeId);
  if (!detail) return;
  detail.classList.toggle('open');
  toggleEl.classList.toggle('open');
}

function setViewMode(mode) {
  viewMode = mode;
  document.getElementById('view-condensed').classList.toggle('active', mode === 'condensed');
  document.getElementById('view-expanded').classList.toggle('active', mode === 'expanded');
  localStorage.setItem('otakutrack-viewmode', mode);
  renderAll();
}

function deleteEntry(id) {
  if (!confirm('Supprimer cette entrée ?')) return;
  DB.animes = DB.animes.filter(x => x.id !== id);
  DB.mangas = DB.mangas.filter(x => x.id !== id);
  syncData();
  renderAll();
}

// ===== MODAL AJOUT / ÉDITION =====
let seasonFields = [];

function openModal(id = null) {
  editingId = id;
  seasonFields = [];

  if (id) {
    const item = [...DB.animes, ...DB.mangas].find(x => x.id === id);
    document.getElementById('modal-title').textContent = 'Modifier';
    selectModalType(item.type);
    if (item.type === 'anime') {
      document.getElementById('m-title').value = item.title;
      document.getElementById('seasons-list').innerHTML = '';
      seasonFields = [];
      item.seasons.forEach(se => addSeasonField(se));
      if (item.seasons.length === 0) addSeasonField();
    } else {
      document.getElementById('m-manga-title').value = item.title;
      document.getElementById('m-total').value = item.total;
      document.getElementById('m-read').value = item.read;
      document.getElementById('m-notes').value = item.notes || '';
    }
  } else {
    document.getElementById('modal-title').textContent = 'Ajouter';
    selectModalType(currentTab === 'manga' ? 'manga' : 'anime');
    document.getElementById('m-title').value = '';
    document.getElementById('m-manga-title').value = '';
    document.getElementById('m-total').value = '';
    document.getElementById('m-read').value = '';
    document.getElementById('m-notes').value = '';
    if (modalType === 'anime') addSeasonField();
  }
  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editingId = null;
}

function selectModalType(type) {
  modalType = type;
  document.getElementById('mtype-anime').classList.toggle('active', type === 'anime');
  document.getElementById('mtype-manga').classList.toggle('active', type === 'manga');
  document.getElementById('anime-form').style.display = type === 'anime' ? '' : 'none';
  document.getElementById('manga-form').style.display = type === 'manga' ? '' : 'none';
  if (type === 'anime' && seasonFields.length === 0) addSeasonField();
}

function addSeasonField(se = null) {
  const idx = seasonFields.length;
  seasonFields.push(se || { name: '', eps: 12, watched: 0, epDur: 20 });
  const list = document.getElementById('seasons-list');
  const div = document.createElement('div');
  div.id = 'sf-' + idx;
  div.style.cssText = 'display:grid;grid-template-columns:1fr 60px 60px 60px 30px;gap:6px;margin-bottom:6px;align-items:end;';
  div.innerHTML = `
    <div><label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:3px;">Nom</label>
      <input class="form-input" style="padding:0.4rem 0.6rem" value="${seasonFields[idx].name}" oninput="updateSF(${idx},'name',this.value)"></div>
    <div><label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:3px;">Eps</label>
      <input class="form-input" style="padding:0.4rem 0.6rem" type="number" min="0" value="${seasonFields[idx].eps}" oninput="updateSF(${idx},'eps',+this.value)"></div>
    <div><label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:3px;">Vus</label>
      <input class="form-input" style="padding:0.4rem 0.6rem" type="number" min="0" value="${seasonFields[idx].watched}" oninput="updateSF(${idx},'watched',+this.value)"></div>
    <div><label style="font-size:0.7rem;color:var(--text-dim);display:block;margin-bottom:3px;">Min/ep</label>
      <input class="form-input" style="padding:0.4rem 0.6rem" type="number" min="1" value="${seasonFields[idx].epDur}" oninput="updateSF(${idx},'epDur',+this.value)"></div>
    <button class="btn-sm danger" style="margin-top:18px;" onclick="removeSF(${idx})">✕</button>`;
  list.appendChild(div);
}

function updateSF(idx, key, val) { seasonFields[idx][key] = val; }
function removeSF(idx) {
  const el = document.getElementById('sf-' + idx);
  if (el) el.remove();
  seasonFields[idx] = null;
}

function saveEntry() {
  const now = Date.now();
  if (modalType === 'anime') {
    const title = document.getElementById('m-title').value.trim();
    if (!title) return alert('Titre requis');
    const seasons = seasonFields.filter(Boolean).map(se => ({
      name:    se.name || 's1',
      eps:     +se.eps || 0,
      watched: Math.min(+se.watched || 0, +se.eps || 0),
      epDur:   +se.epDur || 20
    }));
    if (editingId) {
      const a = DB.animes.find(x => x.id === editingId);
      if (a) { a.title = title; a.seasons = seasons; a.lastModified = now; }
    } else {
      DB.animes.push({ id: genId(), title, type: 'anime', seasons, lastModified: now });
    }
  } else {
    const title = document.getElementById('m-manga-title').value.trim();
    const total = parseInt(document.getElementById('m-total').value) || 0;
    const read  = Math.min(parseInt(document.getElementById('m-read').value) || 0, total);
    const notes = document.getElementById('m-notes').value.trim();
    if (!title) return alert('Titre requis');
    if (editingId) {
      const m = DB.mangas.find(x => x.id === editingId);
      if (m) { m.title = title; m.total = total; m.read = read; m.notes = notes; m.lastModified = now; }
    } else {
      DB.mangas.push({ id: genId(), title, type: 'manga', total, read, notes, lastModified: now });
    }
  }
  syncData();
  closeModal();
  if (modalType !== currentTab) switchTab(modalType);
  renderAll();
}

function editEntry(id) { openModal(id); }

// ===== INIT =====
document.getElementById('modal').addEventListener('click', function(e) {
  if (e.target === this) closeModal();
});

// Exposer les fonctions pour les onclick HTML
Object.assign(window, {
  switchTab, setFilter, sortData, cycleTimeDisplay,
  openModal, closeModal, editEntry, deleteEntry,
  quickUpdateManga, quickEpisode, toggleSeasons,
  saveEntry, addSeasonField, removeSF, setViewMode,
  selectModalType, updateSF
});

async function initApp() {
  const savedViewMode = localStorage.getItem('otakutrack-viewmode');
  if (savedViewMode) viewMode = savedViewMode;
  document.getElementById('view-condensed').classList.toggle('active', viewMode === 'condensed');
  document.getElementById('view-expanded').classList.toggle('active', viewMode === 'expanded');
  await loadDatabase();
}

initApp();
