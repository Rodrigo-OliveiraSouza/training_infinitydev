import { api, requireAuth, attachLogout, formatDuration } from './app.js';

const minimapEl = document.getElementById('minimap');
const mapTitle = document.getElementById('mapTitle');
const mapSubtitle = document.getElementById('mapSubtitle');
const selectedTitle = document.getElementById('selectedTitle');
const selectedStatus = document.getElementById('selectedStatus');
const startLevelButton = document.getElementById('startLevelButton');
const levelLeaderboard = document.getElementById('levelLeaderboard');
const levelRankInfo = document.getElementById('levelRankInfo');
const globalLeaderboard = document.getElementById('globalLeaderboard');
const globalRankInfo = document.getElementById('globalRankInfo');
const languageSelect = document.getElementById('languageSelect');
const profileAvatar = document.getElementById('profileAvatar');
const profileName = document.getElementById('profileName');
const profilePoints = document.getElementById('profilePoints');
const rewardsList = document.getElementById('rewardsList');
const profileTabButtons = document.querySelectorAll('.profile-tabs .tab-button');
const profileTab = document.getElementById('profileTab');
const rewardsTab = document.getElementById('rewardsTab');
const classSelect = document.getElementById('classSelect');
const openClassMap = document.getElementById('openClassMap');
const joinClassButton = document.getElementById('joinClassButton');
const joinClassCode = document.getElementById('joinClassCode');
const classStatus = document.getElementById('classStatus');
const classRankCard = document.getElementById('classRankCard');
const classRankInfo = document.getElementById('classRankInfo');
const classLeaderboard = document.getElementById('classLeaderboard');

let currentLanguageId = null;
let levelsCache = [];
let selectedLevel = null;
let currentUser = null;
let rewardsCache = [];
let classesCache = [];
let currentClassId = null;
const PLACEHOLDER_LEVELS = 6;

function getLanguageIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[1] === 'class') {
    return null;
  }
  const id = parts[1];
  return id ? Number(id) : null;
}

function getClassIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  if (parts[1] === 'class') {
    return Number(parts[2]);
  }
  return null;
}

function renderAvatar(container, user) {
  if (!container) return;
  const icon = user.profile_icon || (user.username ? user.username.charAt(0) : '?');
  const borderClass = user.profile_border ? ` ${user.profile_border}` : '';
  container.className = `avatar${borderClass}`;
  container.innerHTML = '';
  const iconEl = document.createElement('span');
  iconEl.className = 'avatar-icon';
  iconEl.textContent = icon;
  container.appendChild(iconEl);
  if (user.profile_badge) {
    const badge = document.createElement('span');
    badge.className = 'avatar-badge';
    badge.textContent = user.profile_badge;
    container.appendChild(badge);
  }
}

function renderLeaderboard(container, rows) {
  if (!container) return;
  container.innerHTML = '';
  if (!rows.length) {
    container.innerHTML = '<p class="notice">Sem resultados ainda.</p>';
    return;
  }
  rows.forEach((row, index) => {
    const item = document.createElement('div');
    item.className = 'leaderboard-item';
    const timeValue =
      row.best_time_ms !== undefined && row.best_time_ms !== null
        ? row.best_time_ms
        : row.total_time_ms;
    const userWrap = document.createElement('span');
    userWrap.className = 'leaderboard-user';
    const avatar = document.createElement('span');
    renderAvatar(avatar, row);
    const label = document.createElement('span');
    label.textContent = `#${index + 1} ${row.username}`;
    userWrap.appendChild(avatar);
    userWrap.appendChild(label);
    const timeEl = document.createElement('span');
    timeEl.textContent = formatDuration(timeValue);
    item.appendChild(userWrap);
    item.appendChild(timeEl);
    container.appendChild(item);
  });
}

function renderProfile(user) {
  if (!user) return;
  if (profileName) {
    profileName.textContent = user.username;
  }
  if (profilePoints) {
    const points = Number(user.reward_points || 0);
    profilePoints.textContent = `${points} pontos de conquista`;
  }
  renderAvatar(profileAvatar, user);
}

function renderRewards(items, user) {
  if (!rewardsList) return;
  rewardsList.innerHTML = '';
  if (!items.length) {
    rewardsList.innerHTML = '<p class="notice">Sem recompensas disponiveis.</p>';
    return;
  }
  const points = Number(user.reward_points || 0);
  items.forEach((item) => {
    const row = document.createElement('div');
    row.className = 'reward-item';

    const info = document.createElement('div');
    info.className = 'reward-info';
    const preview = document.createElement('span');
    const previewUser = {
      username: user.username,
      profile_icon: item.type === 'icon' ? item.value : user.profile_icon,
      profile_border: item.type === 'border' ? item.value : user.profile_border,
      profile_badge: item.type === 'badge' ? item.value : user.profile_badge
    };
    renderAvatar(preview, previewUser);
    const meta = document.createElement('div');
    meta.innerHTML = `<strong>${item.name}</strong><div class="reward-cost">${item.cost} pts</div>`;
    info.appendChild(preview);
    info.appendChild(meta);

    const actions = document.createElement('div');
    actions.className = 'reward-actions';
    const owned = Number(item.owned) === 1;
    const equipped =
      (item.type === 'icon' && user.profile_icon === item.value) ||
      (item.type === 'border' && user.profile_border === item.value) ||
      (item.type === 'badge' && user.profile_badge === item.value);
    const button = document.createElement('button');
    button.className = 'button secondary';
    if (!owned) {
      button.textContent = points >= item.cost ? 'Comprar' : 'Pontos insuf.';
      button.disabled = points < item.cost;
      button.addEventListener('click', async () => {
        try {
          const result = await api.rewardsPurchase(item.key);
          currentUser = { ...currentUser, ...result.user };
          rewardsCache = rewardsCache.map((reward) =>
            reward.key === item.key ? { ...reward, owned: 1 } : reward
          );
          renderProfile(currentUser);
          renderRewards(rewardsCache, currentUser);
        } catch (err) {
          window.alert(err.message);
        }
      });
    } else {
      button.textContent = equipped ? 'Equipado' : 'Equipar';
      button.disabled = equipped;
      button.addEventListener('click', async () => {
        try {
          const result = await api.rewardsEquip(item.key);
          currentUser = { ...currentUser, ...result.user };
          renderProfile(currentUser);
          renderRewards(rewardsCache, currentUser);
        } catch (err) {
          window.alert(err.message);
        }
      });
    }

    actions.appendChild(button);
    row.appendChild(info);
    row.appendChild(actions);
    rewardsList.appendChild(row);
  });
}

function setProfileTab(tab) {
  if (!profileTab || !rewardsTab || !profileTabButtons.length) return;
  profileTab.classList.toggle('is-hidden', tab !== 'profile');
  rewardsTab.classList.toggle('is-hidden', tab !== 'rewards');
  profileTabButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.tab === tab);
  });
}

function updateSelected(level) {
  selectedLevel = level;
  if (selectedTitle) {
    selectedTitle.textContent = `${level.order_index}. ${level.title}`;
  }
  if (selectedStatus) {
    selectedStatus.textContent = `Status: ${level.status}`;
  }
  if (startLevelButton) {
    startLevelButton.disabled = level.status === 'locked';
  }

  if (level.status !== 'locked') {
    if (startLevelButton) {
      startLevelButton.onclick = () => {
        window.location.href = `/level/${level.id}`;
      };
    }
  }

  loadLevelLeaderboard(level.id);
}

function renderMap(levels) {
  minimapEl.innerHTML = '';
  const modules = new Map();
  levels.forEach((level) => {
    const key = level.module_index || 0;
    if (!modules.has(key)) {
      modules.set(key, {
        name: level.module_name || `Assunto ${key}`,
        moduleIndex: key,
        main: null,
        extras: []
      });
    }
    const entry = modules.get(key);
    if (level.is_main) {
      entry.main = level;
    } else {
      entry.extras.push(level);
    }
  });

  const entries = Array.from(modules.entries()).sort((a, b) => a[0] - b[0]);
  entries.forEach((_entry) => {
    const data = _entry[1];
    const row = document.createElement('div');
    row.className = 'map-row';

    const main = data.main || data.extras[0];
    const mainOrder = data.moduleIndex || (main ? main.order_index : 1);
    const mainTile = createTile(main, true, data.name, `${mainOrder}`);
    row.appendChild(mainTile);

    if (data.extras.length) {
      const connector = document.createElement('div');
      connector.className = 'map-connector';
      row.appendChild(connector);

      const extrasWrap = document.createElement('div');
      extrasWrap.className = 'map-extras';
      data.extras
        .sort((a, b) => a.order_index - b.order_index)
        .forEach((extra, idx) => {
          const displayOrder = `${mainOrder}.${idx + 1}`;
          extrasWrap.appendChild(createTile(extra, false, null, displayOrder));
        });
      row.appendChild(extrasWrap);
    } else {
      row.classList.add('solo');
    }

    minimapEl.appendChild(row);
  });

  const firstAvailable = levels.find((level) => level.status !== 'locked');
  if (firstAvailable) {
    updateSelected(firstAvailable);
  }
}

function createTile(level, isMain, moduleName, displayOrder) {
  const tile = document.createElement('div');
  tile.className = `tile ${level.status} ${isMain ? 'main' : 'extra'}`;
  const typeLabel = isMain ? 'Bloco' : 'Fase';
  tile.innerHTML = `
    ${moduleName ? `<div class="tag tag-module">${moduleName}</div>` : ''}
    <div class="tile-title"><strong>${displayOrder || level.order_index}</strong> ${level.title}</div>
    <div class="tile-meta">
      <span class="tag">${typeLabel}</span>
      <span class="tag">${level.status}</span>
      <span class="tag">${formatDuration(level.best_time_ms)}</span>
    </div>
  `;
  if (level.status !== 'locked') {
    tile.addEventListener('click', () => updateSelected(level));
    tile.addEventListener('dblclick', () => {
      window.location.href = `/level/${level.id}`;
    });
  }
  return tile;
}

function renderPlaceholder(count = PLACEHOLDER_LEVELS) {
  minimapEl.innerHTML = '';
  for (let i = 1; i <= count; i += 1) {
    const row = document.createElement('div');
    row.className = 'map-row';
    const mainTile = document.createElement('div');
    mainTile.className = 'tile locked main';
    mainTile.innerHTML = `
      <div class="tile-title"><strong>${i}</strong> Assunto ${i}</div>
      <div class="tile-meta">
        <span class="tag">Bloco</span>
        <span class="tag">em breve</span>
      </div>
    `;
    const connector = document.createElement('div');
    connector.className = 'map-connector';

    const extrasWrap = document.createElement('div');
    extrasWrap.className = 'map-extras';
    const extra = document.createElement('div');
    extra.className = 'tile locked extra';
    extra.innerHTML = `
      <div class="tile-title"><strong>+</strong> Fase extra</div>
      <div class="tile-meta">
        <span class="tag">Fase</span>
        <span class="tag">--</span>
      </div>
    `;
    extrasWrap.appendChild(extra);
    row.appendChild(mainTile);
    row.appendChild(connector);
    row.appendChild(extrasWrap);
    minimapEl.appendChild(row);
  }
}

function showEmptyState(message) {
  mapSubtitle.textContent = message;
  if (selectedTitle) selectedTitle.textContent = 'Sem fases cadastradas';
  if (selectedStatus) selectedStatus.textContent = '';
  if (startLevelButton) startLevelButton.disabled = true;
  renderPlaceholder();
}

async function loadLevelLeaderboard(levelId) {
  if (!levelLeaderboard || !levelRankInfo) return;
  try {
    const data = await api.leaderboardLevel(levelId);
    renderLeaderboard(levelLeaderboard, data.rows);
    levelRankInfo.textContent = data.userRank
      ? `Sua posicao: #${data.userRank} (melhor tempo: ${formatDuration(data.userTime)})`
      : 'Sem tempo registrado ainda.';
  } catch (err) {
    levelLeaderboard.innerHTML = '<p class="notice">Falha ao carregar ranking.</p>';
  }
}

async function loadGlobalLeaderboard() {
  if (!globalLeaderboard || !globalRankInfo) return;
  try {
    const data = await api.leaderboardGlobal();
    renderLeaderboard(globalLeaderboard, data.rows);
    if (data.userRank) {
      globalRankInfo.textContent = `Sua posicao: #${data.userRank} (${data.userStats.completed} fases concluidas)`;
    } else {
      globalRankInfo.textContent = 'Sem progresso ainda.';
    }
  } catch (err) {
    globalLeaderboard.innerHTML = '<p class="notice">Falha ao carregar ranking.</p>';
  }
}

async function loadClassLeaderboard() {
  if (!classRankCard || !classLeaderboard || !classRankInfo) return;
  if (!currentClassId) {
    classRankCard.classList.add('is-hidden');
    return;
  }
  classRankCard.classList.remove('is-hidden');
  try {
    const data = await api.classLeaderboardGlobal(currentClassId, currentLanguageId);
    renderLeaderboard(classLeaderboard, data.rows);
    if (data.userRank) {
      classRankInfo.textContent = `Sua posicao: #${data.userRank} (${data.userStats.completed} fases concluidas)`;
    } else {
      classRankInfo.textContent = 'Sem progresso na turma ainda.';
    }
  } catch (err) {
    classLeaderboard.innerHTML = '<p class="notice">Falha ao carregar ranking.</p>';
    classRankInfo.textContent = 'Ranking indisponivel.';
  }
}

async function loadMap(languageId) {
  try {
    const languagesData = await api.languages();
    const language = languagesData.languages.find((lang) => lang.id === languageId);
    mapTitle.textContent = 'Mundo do Training.infinity.dev';
    if (language) {
      const city = language.name === 'Python'
        ? 'Cidade do Python'
        : language.name === 'Java'
          ? 'Cidade do Java'
          : 'Cidade da Rede';
      mapSubtitle.textContent = `${city} - desbloqueie andando pelo mapa.`;
    } else {
      mapSubtitle.textContent = 'Escolha uma linguagem para continuar.';
    }
    if (currentClassId && classesCache.length) {
      const klass = classesCache.find((item) => Number(item.id) === Number(currentClassId));
      if (klass) {
        mapSubtitle.textContent = `Turma ${klass.name} - ${mapSubtitle.textContent}`;
      }
    }

    const levelsData = await api.levelsByLanguage(languageId, currentClassId);
    levelsCache = levelsData.levels;
    if (!levelsCache.length) {
      showEmptyState('Nenhuma fase cadastrada ainda.');
      return;
    }

    const progressData = await api.progress();
    const langProgress = progressData.progress.byLanguage.find(
      (item) => item.language_id === languageId
    );
    if (langProgress) {
      mapSubtitle.textContent += ` Concluidas ${langProgress.completed} de ${langProgress.total} fases.`;
    }
    renderMap(levelsCache);
    await loadClassLeaderboard();
  } catch (err) {
    showEmptyState('Falha ao carregar o minimapa.');
  }
}

async function init() {
  currentUser = await requireAuth();
  if (!currentUser) return;

  const pathLanguage = getLanguageIdFromPath();
  currentLanguageId = pathLanguage || currentUser.primary_language_id;
  currentClassId = getClassIdFromPath();

  let languagesData = { languages: [] };
  try {
    languagesData = await api.languages();
  } catch (err) {
    showEmptyState('Falha ao carregar linguagens.');
    return;
  }

  const fallbackLanguage = languagesData.languages[0];
  if (!currentLanguageId || Number.isNaN(Number(currentLanguageId))) {
    currentLanguageId = fallbackLanguage ? fallbackLanguage.id : null;
  }

  languageSelect.innerHTML = '';
  languagesData.languages.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.id;
    option.textContent = language.name;
    if (Number(language.id) === Number(currentLanguageId)) {
      option.selected = true;
    }
    languageSelect.appendChild(option);
  });


  languageSelect.addEventListener('change', async (event) => {
    const languageId = Number(event.target.value);
    await api.setLanguage(languageId);
    window.location.href = `/map/${languageId}`;
  });

  if (!currentLanguageId) {
    showEmptyState('Selecione uma linguagem para continuar.');
    return;
  }

  try {
    classesCache = (await api.classes()).classes || [];
  } catch (err) {
    classesCache = [];
  }

  try {
    rewardsCache = (await api.rewardsItems()).items || [];
  } catch (err) {
    rewardsCache = [];
  }
  renderProfile(currentUser);
  renderRewards(rewardsCache, currentUser);
  setProfileTab('profile');
  if (profileTabButtons.length) {
    profileTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setProfileTab(button.dataset.tab);
      });
    });
  }

  if (classSelect) {
    classSelect.innerHTML = '';
    const globalOption = document.createElement('option');
    globalOption.value = '';
    globalOption.textContent = 'Mapa global';
    classSelect.appendChild(globalOption);
    classesCache.forEach((klass) => {
      const option = document.createElement('option');
      option.value = klass.id;
      option.textContent = klass.name;
      if (currentClassId && Number(klass.id) === Number(currentClassId)) {
        option.selected = true;
      }
      classSelect.appendChild(option);
    });
  }

  if (openClassMap) {
    openClassMap.addEventListener('click', () => {
      const selected = classSelect ? classSelect.value : '';
      if (selected) {
        window.location.href = `/map/class/${selected}`;
      } else if (currentLanguageId) {
        window.location.href = `/map/${currentLanguageId}`;
      }
    });
  }

  if (joinClassButton && joinClassCode) {
    joinClassButton.addEventListener('click', async () => {
      const code = joinClassCode.value.trim();
      if (!code) return;
      try {
        await api.joinClass(code);
        classStatus.textContent = 'Turma adicionada.';
        classesCache = (await api.classes()).classes || [];
        if (classSelect) {
          classSelect.innerHTML = '';
          const globalOption = document.createElement('option');
          globalOption.value = '';
          globalOption.textContent = 'Mapa global';
          classSelect.appendChild(globalOption);
          classesCache.forEach((klass) => {
            const option = document.createElement('option');
            option.value = klass.id;
            option.textContent = klass.name;
            classSelect.appendChild(option);
          });
        }
        joinClassCode.value = '';
      } catch (err) {
        classStatus.textContent = err.message;
      }
    });
  }

  await loadMap(currentLanguageId);
  await loadGlobalLeaderboard();
}

attachLogout();
init();

