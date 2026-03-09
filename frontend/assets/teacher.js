import { api, requireAuth, attachLogout } from './app.js';

const teacherLanguage = document.getElementById('teacherLanguage');
const teacherLevels = document.getElementById('teacherLevels');
const editorTitle = document.getElementById('editorTitle');
const teacherStatus = document.getElementById('teacherStatus');

const classSelect = document.getElementById('classSelect');
const classNameInput = document.getElementById('classNameInput');
const createClassButton = document.getElementById('createClassButton');
const classCreateStatus = document.getElementById('classCreateStatus');
const classCodeInfo = document.getElementById('classCodeInfo');

const levelTitleInput = document.getElementById('levelTitleInput');
const levelOrderInput = document.getElementById('levelOrderInput');
const levelModuleName = document.getElementById('levelModuleName');
const levelModuleIndex = document.getElementById('levelModuleIndex');
const levelIsMain = document.getElementById('levelIsMain');
const levelAllowQuiz = document.getElementById('levelAllowQuiz');
const levelAllowTerminal = document.getElementById('levelAllowTerminal');
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

const tabButtons = document.querySelectorAll('.admin-tabs button');
const tabs = document.querySelectorAll('.admin-tab');

let currentLevels = [];
let currentLevel = null;
let currentLanguageId = null;
let currentClassId = null;
let classesCache = [];
let quizItems = [];

function setStatus(message, type = 'notice') {
  teacherStatus.textContent = message;
  teacherStatus.className = type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
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
  teacherLevels.innerHTML = '';
  if (!currentLevels.length) {
    teacherLevels.innerHTML = '<p class="notice">Nenhuma fase cadastrada.</p>';
    return;
  }
  currentLevels.forEach((level) => {
    const item = document.createElement('button');
    item.className = `admin-level ${level.id === currentLevel?.id ? 'active' : ''}`;
    item.textContent = `${level.order_index} - ${level.title}`;
    item.addEventListener('click', () => selectLevel(level));
    teacherLevels.appendChild(item);
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
  levelAllowQuiz.value = level.allow_quiz ? '1' : '0';
  levelAllowTerminal.value = level.allow_terminal ? '1' : '0';
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

addQuiz.addEventListener('click', () => {
  const question = quizQuestion.value.trim();
  const options = [quizOptionA.value, quizOptionB.value, quizOptionC.value, quizOptionD.value].map((v) => v.trim());
  const correctIndex = Number(quizCorrect.value);
  const explanation = quizExplain.value.trim();

  if (!question || options.some((opt) => !opt) || Number.isNaN(correctIndex)) {
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

async function loadLevels() {
  if (!currentClassId || !currentLanguageId) return;
  const data = await api.teacherClassLevels(currentClassId, currentLanguageId);
  currentLevels = data.levels || [];
  currentLevel = null;
  saveLevel.disabled = true;
  deleteLevel.disabled = true;
  editorTitle.textContent = 'Editar fase';
  setStatus('Selecione uma fase para editar.', 'notice');
  renderLevels();
}

function resetEditor() {
  currentLevel = null;
  editorTitle.textContent = 'Nova fase';
  levelTitleInput.value = '';
  levelOrderInput.value = '';
  levelModuleName.value = '';
  levelModuleIndex.value = '';
  levelIsMain.value = '1';
  levelAllowQuiz.value = '1';
  levelAllowTerminal.value = '1';
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
}

newLevel.addEventListener('click', resetEditor);

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
    allow_quiz: levelAllowQuiz.value === '1',
    allow_terminal: levelAllowTerminal.value === '1',
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
      await api.teacherUpdateLevel(currentClassId, currentLevel.id, payload);
    } else {
      await api.teacherCreateLevel(currentClassId, payload);
    }
    await loadLevels();
    setStatus('Fase salva com sucesso.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

deleteLevel.addEventListener('click', async () => {
  if (!currentLevel?.id) return;
  try {
    await api.teacherDeleteLevel(currentClassId, currentLevel.id);
    await loadLevels();
    setStatus('Fase removida.', 'success');
  } catch (err) {
    setStatus(err.message, 'error');
  }
});

async function loadClasses() {
  const data = await api.teacherClasses();
  classesCache = data.classes || [];
  classSelect.innerHTML = '';
  classesCache.forEach((klass) => {
    const option = document.createElement('option');
    option.value = klass.id;
    option.textContent = klass.name;
    classSelect.appendChild(option);
  });
  currentClassId = classesCache[0]?.id || null;
  if (currentClassId) {
    classSelect.value = currentClassId;
    const klass = classesCache.find((item) => item.id === currentClassId);
    classCodeInfo.textContent = klass ? `Codigo: ${klass.code}` : '';
  } else {
    classCodeInfo.textContent = 'Crie uma turma para comecar.';
  }
}

createClassButton.addEventListener('click', async () => {
  const name = classNameInput.value.trim();
  if (!name) return;
  try {
    const data = await api.createClass({ name });
    classCreateStatus.textContent = `Turma criada. Codigo: ${data.class.code}`;
    classNameInput.value = '';
    await loadClasses();
    await loadLevels();
  } catch (err) {
    classCreateStatus.textContent = err.message;
  }
});

classSelect.addEventListener('change', async (event) => {
  currentClassId = Number(event.target.value);
  const klass = classesCache.find((item) => Number(item.id) === currentClassId);
  classCodeInfo.textContent = klass ? `Codigo: ${klass.code}` : '';
  await loadLevels();
});

teacherLanguage.addEventListener('change', async (event) => {
  currentLanguageId = Number(event.target.value);
  await loadLevels();
});

async function init() {
  const user = await requireAuth();
  if (!user || (user.role !== 'teacher' && user.role !== 'admin')) {
    window.location.href = '/';
    return;
  }

  const languages = await api.languages();
  teacherLanguage.innerHTML = '';
  languages.languages.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang.id;
    option.textContent = lang.name;
    teacherLanguage.appendChild(option);
  });
  currentLanguageId = languages.languages[0]?.id || null;
  teacherLanguage.value = currentLanguageId;

  await loadClasses();
  if (currentClassId) {
    await loadLevels();
  }
}

attachLogout();
setActiveTab('tab-subject');
init();
