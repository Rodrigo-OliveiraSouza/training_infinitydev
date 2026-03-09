import { api, requireAuth, attachLogout } from './app.js';

const adminLanguage = document.getElementById('adminLanguage');
const adminLevels = document.getElementById('adminLevels');
const editorTitle = document.getElementById('editorTitle');
const adminStatus = document.getElementById('adminStatus');

const levelTitleInput = document.getElementById('levelTitleInput');
const levelOrderInput = document.getElementById('levelOrderInput');
const levelModuleName = document.getElementById('levelModuleName');
const levelModuleIndex = document.getElementById('levelModuleIndex');
const levelIsMain = document.getElementById('levelIsMain');
const levelTheory = document.getElementById('levelTheory');
const levelExample = document.getElementById('levelExample');

const quizQuestion = document.getElementById('quizQuestion');
const quizOptionA = document.getElementById('quizOptionA');
const quizOptionB = document.getElementById('quizOptionB');
const quizOptionC = document.getElementById('quizOptionC');
const quizOptionD = document.getElementById('quizOptionD');
const quizCorrect = document.getElementById('quizCorrect');
const quizExplain = document.getElementById('quizExplain');
const addQuiz = document.getElementById('addQuiz');
const quizList = document.getElementById('quizList');

const challengePrompt = document.getElementById('challengePrompt');
const challengeConstraints = document.getElementById('challengeConstraints');
const challengeDifficulty = document.getElementById('challengeDifficulty');
const challengeHint = document.getElementById('challengeHint');
const challengeExamples = document.getElementById('challengeExamples');
const challengeRewardKey = document.getElementById('challengeRewardKey');
const challengeRewardLabel = document.getElementById('challengeRewardLabel');
const challengeRewardPoints = document.getElementById('challengeRewardPoints');
const challengeMode = document.getElementById('challengeMode');
const correctionJson = document.getElementById('correctionJson');
const challengeJson = document.getElementById('challengeJson');

const saveLevel = document.getElementById('saveLevel');
const newLevel = document.getElementById('newLevel');
const deleteLevel = document.getElementById('deleteLevel');

const adminUserSearch = document.getElementById('adminUserSearch');
const adminUserSearchButton = document.getElementById('adminUserSearchButton');
const adminUsersStatus = document.getElementById('adminUsersStatus');
const adminUsersList = document.getElementById('adminUsersList');
const adminUserTitle = document.getElementById('adminUserTitle');
const adminUserStatus = document.getElementById('adminUserStatus');
const adminUserEditUsername = document.getElementById('adminUserEditUsername');
const adminUserEditEmail = document.getElementById('adminUserEditEmail');
const adminUserEditRole = document.getElementById('adminUserEditRole');
const adminUserEditLanguage = document.getElementById('adminUserEditLanguage');
const adminUserEditPoints = document.getElementById('adminUserEditPoints');
const adminUserEditCoupons = document.getElementById('adminUserEditCoupons');
const adminUserEditPassword = document.getElementById('adminUserEditPassword');
const adminUserSaveButton = document.getElementById('adminUserSaveButton');
const adminUserLanguageFilter = document.getElementById('adminUserLanguageFilter');
const adminUserRefreshButton = document.getElementById('adminUserRefreshButton');
const adminResetAllButton = document.getElementById('adminResetAllButton');
const adminUserSummary = document.getElementById('adminUserSummary');
const adminUserLevels = document.getElementById('adminUserLevels');

const tabButtons = document.querySelectorAll('.admin-tabs button');
const tabs = document.querySelectorAll('.admin-tab');

let currentLevels = [];
let currentLevel = null;
let currentLanguageId = null;
let quizItems = [];
let languagesCache = [];
let adminUsers = [];
let selectedUser = null;
let selectedUserLevels = [];

function setStatus(message, type = 'notice') {
  adminStatus.textContent = message;
  adminStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function setUserStatus(message, type = 'notice') {
  adminUserStatus.textContent = message;
  adminUserStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function setUsersListStatus(message, type = 'notice') {
  adminUsersStatus.textContent = message;
  adminUsersStatus.className =
    type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function formatDuration(ms) {
  if (ms === null || ms === undefined) return '--';
  const totalSeconds = Math.floor(Number(ms) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function setActiveTab(tabId) {
  tabs.forEach((tab) => {
    tab.classList.toggle('is-hidden', tab.id !== tabId);
  });
  tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.tab === tabId);
  });
}

tabButtons.forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.tab));
});

function renderLevels() {
  adminLevels.innerHTML = '';
  if (!currentLevels.length) {
    adminLevels.innerHTML = '<p class="notice">Nenhuma fase cadastrada.</p>';
    return;
  }
  currentLevels.forEach((level) => {
    const item = document.createElement('button');
    item.className = `admin-level ${level.id === currentLevel?.id ? 'active' : ''}`;
    item.textContent = `${level.order_index} - ${level.title}`;
    item.addEventListener('click', () => selectLevel(level));
    adminLevels.appendChild(item);
  });
}

function selectLevel(level) {
  currentLevel = level;
  editorTitle.textContent = `Editar fase #${level.order_index}`;
  levelTitleInput.value = level.title || '';
  levelOrderInput.value = level.order_index || '';
  levelModuleName.value = level.module_name || '';
  levelModuleIndex.value = level.module_index || '';
  levelIsMain.value = level.is_main ? '1' : '0';
  levelTheory.value = level.theory_md || '';
  levelExample.value = level.example_md || '';

  quizItems = Array.isArray(level.quiz) ? [...level.quiz] : [];
  renderQuizList();

  const challenge = level.challenge || {};
  challengePrompt.value = challenge.prompt || '';
  challengeConstraints.value = Array.isArray(challenge.constraints)
    ? challenge.constraints.join('\n')
    : '';
  challengeDifficulty.value = challenge.difficulty || 'normal';
  challengeHint.value = challenge.hint || '';
  challengeExamples.value = JSON.stringify(challenge.visibleExamples || [], null, 2);
  challengeRewardKey.value = challenge.rewardKey || '';
  challengeRewardLabel.value = challenge.rewardLabel || '';
  challengeRewardPoints.value = challenge.rewardPoints || '';
  challengeMode.value = challenge.mode || 'code';

  correctionJson.value = JSON.stringify(level.correction || {}, null, 2);
  challengeJson.value = '';

  saveLevel.disabled = false;
  deleteLevel.disabled = false;
  setStatus('Edicao pronta.', 'notice');
}

function renderQuizList() {
  quizList.innerHTML = '';
  if (!quizItems.length) {
    quizList.innerHTML = '<p class="notice">Sem perguntas ainda.</p>';
    return;
  }
  quizItems.forEach((item, index) => {
    const card = document.createElement('div');
    card.className = 'admin-quiz-item';
    card.innerHTML = `
      <strong>${index + 1}. ${item.question}</strong>
      <p class="notice">${item.options.join(' | ')}</p>
      <p class="notice">Correta: ${item.options[item.correctIndex]}</p>
      <button class="button secondary" data-index="${index}">Remover</button>
    `;
    card.querySelector('button').addEventListener('click', () => {
      quizItems.splice(index, 1);
      renderQuizList();
    });
    quizList.appendChild(card);
  });
}

function populateUserLanguageFilter() {
  adminUserLanguageFilter.innerHTML = '';
  const allOption = document.createElement('option');
  allOption.value = '';
  allOption.textContent = 'Todas as linguagens';
  adminUserLanguageFilter.appendChild(allOption);

  languagesCache.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.id;
    option.textContent = language.name;
    adminUserLanguageFilter.appendChild(option);
  });
}

function populateUserEditLanguageOptions() {
  adminUserEditLanguage.innerHTML = '';

  const emptyOption = document.createElement('option');
  emptyOption.value = '';
  emptyOption.textContent = 'Sem linguagem';
  adminUserEditLanguage.appendChild(emptyOption);

  languagesCache.forEach((language) => {
    const option = document.createElement('option');
    option.value = language.id;
    option.textContent = language.name;
    adminUserEditLanguage.appendChild(option);
  });
}

function setUserFormEnabled(enabled) {
  [
    adminUserEditUsername,
    adminUserEditEmail,
    adminUserEditRole,
    adminUserEditLanguage,
    adminUserEditPoints,
    adminUserEditCoupons,
    adminUserEditPassword,
    adminUserSaveButton
  ].forEach((element) => {
    element.disabled = !enabled;
  });
}

function renderUserForm() {
  if (!selectedUser) {
    adminUserEditUsername.value = '';
    adminUserEditEmail.value = '';
    adminUserEditRole.value = 'user';
    adminUserEditLanguage.value = '';
    adminUserEditPoints.value = '';
    adminUserEditCoupons.value = '';
    adminUserEditPassword.value = '';
    setUserFormEnabled(false);
    return;
  }

  adminUserEditUsername.value = selectedUser.username || '';
  adminUserEditEmail.value = selectedUser.email || '';
  adminUserEditRole.value = selectedUser.role || 'user';
  adminUserEditLanguage.value =
    selectedUser.primary_language_id === null || selectedUser.primary_language_id === undefined
      ? ''
      : String(selectedUser.primary_language_id);
  adminUserEditPoints.value = String(selectedUser.reward_points || 0);
  adminUserEditCoupons.value = String(selectedUser.single_reset_coupons || 0);
  adminUserEditPassword.value = '';
  setUserFormEnabled(true);
}

function renderUsers() {
  adminUsersList.innerHTML = '';
  if (!adminUsers.length) {
    adminUsersList.innerHTML = '<p class="notice">Nenhum usuario encontrado.</p>';
    return;
  }

  adminUsers.forEach((user) => {
    const button = document.createElement('button');
    button.className = `admin-user-row ${selectedUser?.id === user.id ? 'active' : ''}`;
    button.type = 'button';
    button.innerHTML = `
      <strong>${user.username}</strong>
      <span>${user.email}</span>
      <span>${user.role} | ${user.reward_points || 0} pts | ${user.single_reset_coupons || 0} cupom(ns)</span>
    `;
    button.addEventListener('click', () => selectUser(user));
    adminUsersList.appendChild(button);
  });
}

function renderUserSummary() {
  if (!selectedUser) {
    adminUserSummary.innerHTML = '';
    renderUserForm();
    return;
  }

  const levelsWithHistory = selectedUserLevels.filter((level) => level.has_history).length;
  adminUserSummary.innerHTML = `
    <div class="admin-user-stat">
      <strong>${selectedUser.reward_points || 0}</strong>
      <span>pontos</span>
    </div>
    <div class="admin-user-stat">
      <strong>${selectedUser.single_reset_coupons || 0}</strong>
      <span>cupons</span>
    </div>
    <div class="admin-user-stat">
      <strong>${selectedUser.completed_levels || 0}</strong>
      <span>fases concluidas</span>
    </div>
    <div class="admin-user-stat">
      <strong>${levelsWithHistory}</strong>
      <span>questoes com historico</span>
    </div>
  `;
  renderUserForm();
}

function renderUserLevels() {
  adminUserLevels.innerHTML = '';
  if (!selectedUser) {
    adminUserLevels.innerHTML = '<p class="notice">Selecione um usuario para listar as questoes.</p>';
    return;
  }

  if (!selectedUserLevels.length) {
    adminUserLevels.innerHTML = '<p class="notice">Nenhuma questao encontrada para esse filtro.</p>';
    return;
  }

  selectedUserLevels.forEach((level) => {
    const card = document.createElement('div');
    card.className = 'admin-user-level-row';
    const historyLabel = level.has_history ? 'Com historico' : 'Sem historico';
    const completedLabel = level.completed_at ? 'Concluida' : 'Nao concluida';
    card.innerHTML = `
      <div>
        <strong>${level.language_name} | ${level.order_index} - ${level.title}</strong>
        <p class="notice">${historyLabel} | ${completedLabel} | tentativas: ${level.attempts_count} | envios: ${level.submissions_count} | melhor tempo: ${formatDuration(level.best_time_ms)}</p>
      </div>
      <button class="button secondary" type="button" ${level.has_history ? '' : 'disabled'}>
        Resetar questao
      </button>
    `;
    const button = card.querySelector('button');
    button.addEventListener('click', async () => {
      const confirmed = window.confirm(
        `Remover todo o historico da questao "${level.title}" para o usuario ${selectedUser.username}?`
      );
      if (!confirmed) return;

      try {
        await api.adminResetUserLevel(selectedUser.id, level.id);
        await refreshSelectedUser();
        setUserStatus(`Historico da questao "${level.title}" removido.`, 'success');
      } catch (err) {
        setUserStatus(err.message, 'error');
      }
    });
    adminUserLevels.appendChild(card);
  });
}

async function loadUsers(query = '') {
  setUsersListStatus('Carregando usuarios...');

  try {
    const data = await api.adminUsers(query);
    adminUsers = data.users || [];
    setUsersListStatus(`${adminUsers.length} usuario(s) encontrado(s).`);
    renderUsers();

    if (!selectedUser) return;

    const updated = adminUsers.find((user) => user.id === selectedUser.id);
    if (updated) {
      selectedUser = updated;
      renderUsers();
      renderUserSummary();
      return;
    }

    selectedUser = null;
    selectedUserLevels = [];
    adminUserTitle.textContent = 'Selecione um usuario';
    adminUserRefreshButton.disabled = true;
    adminResetAllButton.disabled = true;
    renderUserSummary();
    renderUserLevels();
  } catch (err) {
    adminUsers = [];
    renderUsers();
    setUsersListStatus(
      err.message === 'Not found'
        ? 'A API de usuarios do admin nao esta ativa. Reinicie o backend para carregar esta tela.'
        : err.message,
      'error'
    );
    throw err;
  }
}

async function refreshSelectedUser() {
  if (!selectedUser) return;

  adminUserRefreshButton.disabled = true;
  adminResetAllButton.disabled = true;

  try {
    const languageValue = adminUserLanguageFilter.value;
    const languageId = languageValue ? Number(languageValue) : null;
    const data = await api.adminUserLevels(selectedUser.id, languageId);
    selectedUser = data.user;
    selectedUserLevels = data.levels || [];
    adminUserTitle.textContent = `${selectedUser.username} (${selectedUser.email})`;
    setUserStatus('Historico do usuario carregado.', 'notice');
    renderUsers();
    renderUserSummary();
    renderUserLevels();
  } catch (err) {
    setUserStatus(err.message, 'error');
    selectedUserLevels = [];
    renderUserLevels();
  } finally {
    adminUserRefreshButton.disabled = !selectedUser;
    adminResetAllButton.disabled = !selectedUser;
  }
}

async function selectUser(user) {
  selectedUser = user;
  renderUsers();
  await refreshSelectedUser();
}

addQuiz.addEventListener('click', () => {
  const question = quizQuestion.value.trim();
  const options = [quizOptionA.value, quizOptionB.value, quizOptionC.value, quizOptionD.value].map((value) =>
    value.trim()
  );
  const correctIndex = Number(quizCorrect.value);
  const explanation = quizExplain.value.trim();

  if (!question || options.some((option) => !option) || Number.isNaN(correctIndex)) {
    setStatus('Preencha pergunta, opcoes e indice correto.', 'error');
    return;
  }

  quizItems.push({ question, options, correctIndex, explanation });
  quizQuestion.value = '';
  quizOptionA.value = '';
  quizOptionB.value = '';
  quizOptionC.value = '';
  quizOptionD.value = '';
  quizCorrect.value = '';
  quizExplain.value = '';
  renderQuizList();
});

async function loadLevels(languageId) {
  const data = await api.adminLevels(languageId);
  currentLevels = data.levels || [];
  currentLevel = null;
  saveLevel.disabled = true;
  deleteLevel.disabled = true;
  editorTitle.textContent = 'Editar fase';
  setStatus('Selecione uma fase para editar.', 'notice');
  renderLevels();
}

async function init() {
  const user = await requireAuth();
  if (!user || user.role !== 'admin') {
    window.location.href = '/';
    return;
  }

  const languages = await api.languages();
  languagesCache = languages.languages || [];
  adminLanguage.innerHTML = '';
  languagesCache.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.id;
    option.textContent = lang.name;
    adminLanguage.appendChild(option);
  });
  currentLanguageId = languagesCache[0]?.id || null;
  adminLanguage.value = currentLanguageId;
  populateUserLanguageFilter();
  populateUserEditLanguageOptions();

  await loadLevels(currentLanguageId);
  try {
    await loadUsers();
  } catch (err) {
    setUserStatus(
      err.message === 'Not found'
        ? 'O backend ativo ainda nao carregou o gerenciamento de usuarios. Reinicie o servidor.'
        : err.message,
      'error'
    );
  }

  adminLanguage.addEventListener('change', async (event) => {
    currentLanguageId = Number(event.target.value);
    await loadLevels(currentLanguageId);
  });

  adminUserLanguageFilter.addEventListener('change', async () => {
    if (!selectedUser) return;
    await refreshSelectedUser();
  });
}

newLevel.addEventListener('click', () => {
  currentLevel = null;
  editorTitle.textContent = 'Nova fase';
  levelTitleInput.value = '';
  levelOrderInput.value = '';
  levelModuleName.value = '';
  levelModuleIndex.value = '';
  levelIsMain.value = '1';
  levelTheory.value = '';
  levelExample.value = '';
  quizItems = [];
  renderQuizList();
  challengePrompt.value = '';
  challengeConstraints.value = '';
  challengeDifficulty.value = 'normal';
  challengeHint.value = '';
  challengeExamples.value = '[]';
  challengeRewardKey.value = '';
  challengeRewardLabel.value = '';
  challengeRewardPoints.value = '';
  challengeMode.value = 'code';
  correctionJson.value = '{}';
  challengeJson.value = '';
  saveLevel.disabled = false;
  deleteLevel.disabled = true;
  setStatus('Preencha os dados e salve.', 'notice');
});

saveLevel.addEventListener('click', async () => {
  const parseNumber = (value) => {
    const parsed = Number(value);
    return Number.isNaN(parsed) ? null : parsed;
  };

  const payload = {
    language_id: currentLanguageId,
    title: levelTitleInput.value.trim(),
    order_index: parseNumber(levelOrderInput.value),
    module_name: levelModuleName.value.trim(),
    module_index: parseNumber(levelModuleIndex.value),
    is_main: levelIsMain.value === '1',
    theory_md: levelTheory.value,
    example_md: levelExample.value,
    quiz: quizItems,
    challenge: {
      prompt: challengePrompt.value,
      constraints: challengeConstraints.value.split('\n').filter((line) => line.trim().length),
      difficulty: challengeDifficulty.value,
      hint: challengeHint.value.trim(),
      rewardKey: challengeRewardKey.value.trim(),
      rewardLabel: challengeRewardLabel.value.trim()
    },
    correction: {}
  };

  try {
    payload.correction = JSON.parse(correctionJson.value || '{}');
  } catch (err) {
    setStatus('Correction JSON invalido.', 'error');
    return;
  }

  if (challengeJson.value.trim()) {
    try {
      payload.challenge = JSON.parse(challengeJson.value);
    } catch (err) {
      setStatus('Challenge JSON invalido.', 'error');
      return;
    }
  } else {
    try {
      payload.challenge.visibleExamples = JSON.parse(challengeExamples.value || '[]');
    } catch (err) {
      setStatus('Exemplos visiveis JSON invalido.', 'error');
      return;
    }
    const rewardPoints = Number(challengeRewardPoints.value);
    if (challengeRewardPoints.value.trim()) {
      if (Number.isNaN(rewardPoints) || rewardPoints < 0) {
        setStatus('Pontos da conclusao invalidos.', 'error');
        return;
      }
      payload.challenge.rewardPoints = rewardPoints;
    }
    payload.challenge.mode = challengeMode.value;
  }

  try {
    if (currentLevel?.id) {
      await api.adminLevelUpdate(currentLevel.id, payload);
    } else {
      await api.adminLevelCreate(payload);
    }
    await loadLevels(currentLanguageId);
    setStatus('Fase salva com sucesso.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

deleteLevel.addEventListener('click', async () => {
  if (!currentLevel?.id) return;
  try {
    await api.adminLevelDelete(currentLevel.id);
    await loadLevels(currentLanguageId);
    setStatus('Fase removida.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

adminUserSearchButton.addEventListener('click', async () => {
  try {
    await loadUsers(adminUserSearch.value.trim());
    setUserStatus('Lista de usuarios atualizada.', 'notice');
  } catch (err) {
    setUserStatus(err.message, 'error');
  }
});

adminUserSearch.addEventListener('keydown', (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();
  adminUserSearchButton.click();
});

adminUserSaveButton.addEventListener('click', async () => {
  if (!selectedUser) return;

  const rewardPoints = Number(adminUserEditPoints.value);
  const coupons = Number(adminUserEditCoupons.value);
  if (Number.isNaN(rewardPoints) || rewardPoints < 0) {
    setUserStatus('Pontos invalidos.', 'error');
    return;
  }
  if (Number.isNaN(coupons) || coupons < 0) {
    setUserStatus('Quantidade de cupons invalida.', 'error');
    return;
  }

  adminUserSaveButton.disabled = true;

  try {
    const payload = {
      username: adminUserEditUsername.value.trim(),
      email: adminUserEditEmail.value.trim(),
      role: adminUserEditRole.value,
      reward_points: rewardPoints,
      single_reset_coupons: coupons,
      primary_language_id: adminUserEditLanguage.value ? Number(adminUserEditLanguage.value) : null
    };

    const password = adminUserEditPassword.value.trim();
    if (password) {
      payload.password = password;
    }

    const data = await api.adminUpdateUser(selectedUser.id, payload);
    selectedUser = data.user;
    renderUsers();
    renderUserSummary();
    await loadUsers(adminUserSearch.value.trim());
    await refreshSelectedUser();
    setUserStatus(`Usuario ${selectedUser.username} atualizado.`, 'success');
  } catch (err) {
    setUserStatus(err.message, 'error');
  } finally {
    adminUserSaveButton.disabled = !selectedUser;
  }
});

adminUserRefreshButton.addEventListener('click', async () => {
  if (!selectedUser) return;
  await refreshSelectedUser();
});

adminResetAllButton.addEventListener('click', async () => {
  if (!selectedUser) return;

  const confirmed = window.confirm(
    `Remover todo o historico de todas as questoes do usuario ${selectedUser.username}?`
  );
  if (!confirmed) return;

  try {
    await api.adminResetUserAll(selectedUser.id);
    await refreshSelectedUser();
    await loadUsers(adminUserSearch.value.trim());
    setUserStatus(`Historico completo de ${selectedUser.username} removido.`, 'success');
  } catch (err) {
    setUserStatus(err.message, 'error');
  }
});

attachLogout();
setActiveTab('tab-subject');
init();
