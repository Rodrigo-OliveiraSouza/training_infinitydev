import { api, requireAuth, renderMarkdown, attachLogout, getToken, formatDuration } from './app.js';

const levelTitle = document.getElementById('levelTitle');
const theory = document.getElementById('theory');
const example = document.getElementById('example');
const quiz = document.getElementById('quiz');
const challengePrompt = document.getElementById('challengePrompt');
const challengeConstraints = document.getElementById('challengeConstraints');
const challengeExpected = document.getElementById('challengeExpected');
const challengeExpectedPanel = document.getElementById('challengeExpectedPanel');
const challengePromptPanel = document.getElementById('challengePromptPanel');
const challengeTabButtons = document.querySelectorAll('.challenge-tabs .tab-button');
const codeInput = document.getElementById('codeInput');
const runButton = document.getElementById('runButton');
const stopButton = document.getElementById('stopButton');
const submitButton = document.getElementById('submitButton');
const nextButton = document.getElementById('nextButton');
const output = document.getElementById('output');
const feedback = document.getElementById('feedback');
const backToMap = document.getElementById('backToMap');
const terminalTitle = document.getElementById('terminalTitle');
const terminalHint = document.getElementById('terminalHint');
const terminalInputRow = document.getElementById('terminalInputRow');
const terminalInput = document.getElementById('terminalInput');
const terminalSendButton = document.getElementById('terminalSendButton');
let levelTimer = document.getElementById('levelTimer');
const levelLeaderboard = document.getElementById('levelLeaderboard');
const levelRankInfo = document.getElementById('levelRankInfo');
const globalLeaderboard = document.getElementById('globalLeaderboard');
const globalRankInfo = document.getElementById('globalRankInfo');
const classLevelRankCard = document.getElementById('classLevelRankCard');
const classLevelRankInfo = document.getElementById('classLevelRankInfo');
const classLevelLeaderboard = document.getElementById('classLevelLeaderboard');
const classGlobalRankCard = document.getElementById('classGlobalRankCard');
const classGlobalRankInfo = document.getElementById('classGlobalRankInfo');
const classGlobalLeaderboard = document.getElementById('classGlobalLeaderboard');

let sessionId = null;
let levelData = null;
let nextLevelId = null;
let isTextMode = false;

let terminalSocket = null;
let socketReady = false;
let processRunning = false;
let pendingRunCode = null;
let timerInterval = null;
let startTimestamp = null;
let sessionStorageKey = null;

function getLevelIdFromPath() {
  const parts = window.location.pathname.split('/').filter(Boolean);
  return Number(parts[1]);
}

function extractCodeBlock(md) {
  const match = md.match(/```[\w]*\n([\s\S]*?)```/);
  return match ? match[1].trim() : '';
}

function ensureTimerEl() {
  if (!levelTimer) {
    levelTimer = document.getElementById('levelTimer');
  }
  return levelTimer;
}

function formatTimer(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function getSessionKey(userId, levelId) {
  return `level_session_${userId}_${levelId}`;
}

function loadStoredSession() {
  if (!sessionStorageKey) return null;
  try {
    const raw = localStorage.getItem(sessionStorageKey);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (err) {
    return null;
  }
}

function saveStoredSession(data) {
  if (!sessionStorageKey) return;
  localStorage.setItem(sessionStorageKey, JSON.stringify(data));
}

function clearStoredSession() {
  if (!sessionStorageKey) return;
  localStorage.removeItem(sessionStorageKey);
}

function parseTimerTimestamp(value) {
  if (!value) return NaN;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const normalized = value.includes('T') ? value : value.replace(' ', 'T');
    const hasZone = /Z|[+-]\d{2}:?\d{2}$/.test(normalized);
    const parsed = Date.parse(hasZone ? normalized : `${normalized}Z`);
    return parsed;
  }
  return Date.parse(value);
}

function startTimer(startedAt) {
  const timerEl = ensureTimerEl();
  if (!timerEl) return;
  const parsed = parseTimerTimestamp(startedAt);
  startTimestamp = Number.isNaN(parsed) ? Date.now() : parsed;
  timerEl.textContent = formatTimer(Date.now() - startTimestamp);
  if (timerInterval) {
    clearInterval(timerInterval);
  }
  timerInterval = setInterval(() => {
    timerEl.textContent = formatTimer(Date.now() - startTimestamp);
  }, 1000);
}

function syncTimerElapsed(elapsedMs) {
  const timerEl = ensureTimerEl();
  if (!timerEl) return;
  const safeElapsed = Number.isFinite(elapsedMs) ? elapsedMs : 0;
  startTimestamp = Date.now() - safeElapsed;
  timerEl.textContent = formatTimer(safeElapsed);
}

function stopTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function renderQuiz(questions) {
  quiz.innerHTML = '';
  questions.forEach((item, index) => {
    const wrapper = document.createElement('div');
    wrapper.className = 'quiz-block';
    const questionEl = document.createElement('div');
    questionEl.className = 'quiz-question';
    questionEl.textContent = `${index + 1}. ${item.question}`;
    wrapper.appendChild(questionEl);
    const explanationEl = document.createElement('div');
    explanationEl.className = 'quiz-explanation notice is-hidden';
    explanationEl.textContent =
      item.explanation || `Resposta correta: ${item.options[item.correctIndex]}`;
    item.options.forEach((option, optionIndex) => {
      const optionEl = document.createElement('div');
      optionEl.className = 'quiz-option';
      optionEl.textContent = option;
      optionEl.addEventListener('click', () => {
        if (optionEl.dataset.locked) return;
        optionEl.dataset.locked = 'true';
        if (optionIndex === item.correctIndex) {
          optionEl.classList.add('correct');
        } else {
          optionEl.classList.add('wrong');
        }
        explanationEl.classList.remove('is-hidden');
      });
      wrapper.appendChild(optionEl);
    });
    wrapper.appendChild(explanationEl);
    quiz.appendChild(wrapper);
  });
}

function setChallengeTab(tab) {
  challengeTabButtons.forEach((button) => {
    const isActive = button.dataset.tab === tab;
    button.classList.toggle('active', isActive);
  });
  if (challengePromptPanel && challengeExpectedPanel) {
    challengePromptPanel.classList.toggle('is-hidden', tab !== 'prompt');
    challengeExpectedPanel.classList.toggle('is-hidden', tab !== 'expected');
  }
}

function renderChallengeExpected(challenge) {
  if (!challengeExpected) return;
  const expected =
    challenge.expected ||
    challenge.expected_output ||
    challenge.expectedOutput ||
    '';
  if (Array.isArray(expected) && expected.length) {
    challengeExpected.textContent = expected.join('\n');
  } else if (typeof expected === 'string' && expected.trim()) {
    challengeExpected.textContent = expected.trim();
  } else {
    challengeExpected.textContent =
      'Sem resposta fixa. Siga as condicoes do desafio.';
  }
}

function renderLeaderboard(container, rows) {
  if (!container) return;
  container.innerHTML = '';
  if (!rows || !rows.length) {
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
    const icon = row.profile_icon || (row.username ? row.username.charAt(0) : '?');
    const borderClass = row.profile_border ? ` ${row.profile_border}` : '';
    avatar.className = `avatar${borderClass}`;
    const iconEl = document.createElement('span');
    iconEl.className = 'avatar-icon';
    iconEl.textContent = icon;
    avatar.appendChild(iconEl);
    if (row.profile_badge) {
      const badge = document.createElement('span');
      badge.className = 'avatar-badge';
      badge.textContent = row.profile_badge;
      avatar.appendChild(badge);
    }
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
    levelRankInfo.textContent = 'Ranking indisponivel.';
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
    globalRankInfo.textContent = 'Ranking indisponivel.';
  }
}

async function loadClassLevelLeaderboard(classId, levelId) {
  if (!classLevelLeaderboard || !classLevelRankInfo || !classLevelRankCard) return;
  classLevelRankCard.classList.remove('is-hidden');
  try {
    const data = await api.classLeaderboardLevel(classId, levelId);
    renderLeaderboard(classLevelLeaderboard, data.rows);
    classLevelRankInfo.textContent = data.userRank
      ? `Sua posicao: #${data.userRank} (melhor tempo: ${formatDuration(data.userTime)})`
      : 'Sem tempo registrado ainda.';
  } catch (err) {
    classLevelLeaderboard.innerHTML = '<p class="notice">Falha ao carregar ranking.</p>';
    classLevelRankInfo.textContent = 'Ranking indisponivel.';
  }
}

async function loadClassGlobalLeaderboard(classId, languageId) {
  if (!classGlobalLeaderboard || !classGlobalRankInfo || !classGlobalRankCard) return;
  classGlobalRankCard.classList.remove('is-hidden');
  try {
    const data = await api.classLeaderboardGlobal(classId, languageId);
    renderLeaderboard(classGlobalLeaderboard, data.rows);
    if (data.userRank) {
      classGlobalRankInfo.textContent = `Sua posicao: #${data.userRank} (${data.userStats.completed} fases concluidas)`;
    } else {
      classGlobalRankInfo.textContent = 'Sem progresso na turma ainda.';
    }
  } catch (err) {
    classGlobalLeaderboard.innerHTML = '<p class="notice">Falha ao carregar ranking.</p>';
    classGlobalRankInfo.textContent = 'Ranking indisponivel.';
  }
}

async function loadNextLevelInfo(languageId, orderIndex) {
  const levelsData = await api.levelsByLanguage(languageId);
  const next = levelsData.levels.find((level) => level.order_index === orderIndex + 1);
  nextLevelId = next ? next.id : null;
  if (!nextLevelId) {
    nextButton.textContent = 'Ultima fase';
  }
}

function setFeedback(message, type = 'notice') {
  feedback.textContent = message || '';
  feedback.className = type === 'error' ? 'notice error' : type === 'success' ? 'notice success' : 'notice';
}

function appendOutput(text) {
  if (!text) return;
  output.textContent += text;
  output.scrollTop = output.scrollHeight;
}

function resetTerminal() {
  output.textContent = '';
  setFeedback('');
  terminalInput.value = '';
  terminalInput.disabled = true;
  stopButton.disabled = true;
  processRunning = false;
}

function getTerminalUrl(levelId) {
  const token = getToken();
  const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
  return `${protocol}://${window.location.host}/ws/terminal?token=${encodeURIComponent(token)}&levelId=${levelId}`;
}

function handleTerminalMessage(event) {
  let message = null;
  try {
    message = JSON.parse(event.data);
  } catch (err) {
    setFeedback('Resposta invalida do terminal.', 'error');
    return;
  }

  if (message.type === 'ready') {
    processRunning = true;
    terminalInput.disabled = false;
    stopButton.disabled = false;
    terminalInput.focus();
    setFeedback('Execucao iniciada.', 'success');
    return;
  }

  if (message.type === 'stdout') {
    appendOutput(message.data);
    return;
  }

  if (message.type === 'stderr') {
    appendOutput(message.data);
    return;
  }

  if (message.type === 'compile_error') {
    appendOutput(message.stderr || message.stdout || 'Erro de compilacao.');
    setFeedback('Erro de compilacao.', 'error');
    processRunning = false;
    terminalInput.disabled = true;
    stopButton.disabled = true;
    return;
  }

  if (message.type === 'timeout') {
    setFeedback('Tempo limite atingido.', 'error');
    processRunning = false;
    terminalInput.disabled = true;
    stopButton.disabled = true;
    return;
  }

  if (message.type === 'exit') {
    processRunning = false;
    terminalInput.disabled = true;
    stopButton.disabled = true;
    if (message.code && Number(message.code) !== 0) {
      setFeedback('Execucao finalizada com erro.', 'error');
    } else if (message.reason === 'stopped') {
      setFeedback('Execucao interrompida.', 'notice');
    } else {
      setFeedback('Execucao finalizada.', 'success');
    }
    return;
  }

  if (message.type === 'error') {
    setFeedback(message.message || 'Falha no terminal.', 'error');
  }
}

function connectTerminal(levelId) {
  const token = getToken();
  if (!token) {
    setFeedback('Autenticacao necessaria.', 'error');
    return;
  }

  if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
    return;
  }
  if (terminalSocket && terminalSocket.readyState === WebSocket.CONNECTING) {
    return;
  }

  terminalSocket = new WebSocket(getTerminalUrl(levelId));
  socketReady = false;

  terminalSocket.addEventListener('open', () => {
    socketReady = true;
    if (pendingRunCode) {
      sendRun(pendingRunCode);
      pendingRunCode = null;
    }
  });

  terminalSocket.addEventListener('message', handleTerminalMessage);

  terminalSocket.addEventListener('close', () => {
    socketReady = false;
    processRunning = false;
    terminalInput.disabled = true;
    stopButton.disabled = true;
  });

  terminalSocket.addEventListener('error', () => {
    setFeedback('Falha ao conectar no terminal.', 'error');
  });
}

function sendRun(code) {
  if (!terminalSocket || !socketReady) {
    pendingRunCode = code;
    connectTerminal(levelData.id);
    return;
  }
  terminalSocket.send(
    JSON.stringify({
      type: 'run',
      levelId: levelData.id,
      code,
      sessionId
    })
  );
}

function sendInputLine() {
  if (!processRunning || !terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) {
    return;
  }
  const line = terminalInput.value;
  terminalInput.value = '';
  appendOutput(`> ${line}\n`);
  terminalSocket.send(JSON.stringify({ type: 'input', data: `${line}\n`, sessionId }));
}

async function init() {
  const levelId = getLevelIdFromPath();
  const user = await requireAuth();
  if (!user) return;

  sessionStorageKey = getSessionKey(user.id, levelId);
  const levelResponse = await api.level(levelId);
  levelData = levelResponse.level;

  levelTitle.textContent = `${levelData.order_index}. ${levelData.title}`;
  theory.innerHTML = renderMarkdown(levelData.theory_md);
  example.innerHTML = renderMarkdown(levelData.example_md);
  renderQuiz(levelData.quiz || []);

  challengePrompt.textContent = levelData.challenge.prompt;
  if (levelData.challenge.constraints && levelData.challenge.constraints.length) {
    challengeConstraints.textContent = levelData.challenge.constraints.join(' ');
  } else {
    challengeConstraints.textContent = 'Sem restricoes adicionais.';
  }
  renderChallengeExpected(levelData.challenge);
  if (challengeTabButtons.length) {
    challengeTabButtons.forEach((button) => {
      button.addEventListener('click', () => {
        setChallengeTab(button.dataset.tab);
      });
    });
    setChallengeTab('prompt');
  }

  const starter = extractCodeBlock(levelData.example_md) || '';
  if (Number(levelData.order_index) === 1) {
    codeInput.value = starter;
  } else {
    codeInput.value = '';
    codeInput.placeholder = 'Escreva seu codigo aqui';
  }

  isTextMode = levelData.challenge && levelData.challenge.mode === 'text';
  if (isTextMode) {
    terminalTitle.textContent = 'Resposta';
    terminalHint.textContent = 'Digite sua resposta. Execucao nao disponivel para esta trilha.';
    terminalInputRow.classList.add('is-hidden');
    runButton.disabled = true;
    runButton.style.display = 'none';
    stopButton.style.display = 'none';
    submitButton.textContent = 'Enviar resposta';
    codeInput.placeholder = 'Digite sua resposta aqui';
    codeInput.value = '';
  } else {
    terminalHint.textContent = 'Use o terminal interativo para testar seu codigo.';
  }

  const storedSession = loadStoredSession();
  try {
    const session = await api.startLevel(levelId);
    sessionId = session.sessionId;
    saveStoredSession({ sessionId, startedAt: session.startedAt || Date.now() });
    startTimer(session.startedAt);
  } catch (err) {
    if (storedSession && storedSession.sessionId && storedSession.startedAt) {
      sessionId = storedSession.sessionId;
      startTimer(storedSession.startedAt);
      setFeedback('Sessao restaurada localmente. Verifique a conexao.', 'notice');
    } else {
      setFeedback('Falha ao iniciar sessao.', 'error');
    }
  }

  await loadNextLevelInfo(levelData.language_id, levelData.order_index);
  backToMap.href = levelData.class_id ? `/map/class/${levelData.class_id}` : `/map/${levelData.language_id}`;

  await loadLevelLeaderboard(levelData.id);
  await loadGlobalLeaderboard();
  if (levelData.class_id) {
    await loadClassLevelLeaderboard(levelData.class_id, levelData.id);
    await loadClassGlobalLeaderboard(levelData.class_id, levelData.language_id);
  } else {
    if (classLevelRankCard) classLevelRankCard.classList.add('is-hidden');
    if (classGlobalRankCard) classGlobalRankCard.classList.add('is-hidden');
  }

  resetTerminal();
}

runButton.addEventListener('click', () => {
  if (!levelData || isTextMode) return;
  if (!codeInput.value || codeInput.value.trim().length < 3) {
    setFeedback('Codigo obrigatorio para executar.', 'error');
    return;
  }
  resetTerminal();
  sendRun(codeInput.value);
});

stopButton.addEventListener('click', () => {
  if (!terminalSocket || terminalSocket.readyState !== WebSocket.OPEN) return;
  terminalSocket.send(JSON.stringify({ type: 'stop' }));
});

terminalSendButton.addEventListener('click', () => {
  sendInputLine();
});

terminalInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    sendInputLine();
  }
});

submitButton.addEventListener('click', async () => {
  if (!levelData) return;
  setFeedback('');
  if (!isTextMode) {
    output.textContent = '';
  }
  try {
    const result = await api.submit(levelData.id, { code: codeInput.value, sessionId });
    if (!isTextMode) {
      output.textContent = result.result.stdout || result.result.stderr || 'Sem saida.';
    } else {
      output.textContent = '';
    }
    if (result.result.passed) {
      const elapsedMs = Number(result.result.elapsedMs) || 0;
      const rewardPoints = Number(result.result.rewardPoints || 0);
      const rewardInfo = rewardPoints > 0 ? ` +${rewardPoints} pts` : '';
      setFeedback(`Aprovado! Tempo: ${formatTimer(elapsedMs)}${rewardInfo}`, 'success');
      nextButton.disabled = !nextLevelId;
      stopTimer();
      syncTimerElapsed(elapsedMs);
      clearStoredSession();
      await loadLevelLeaderboard(levelData.id);
      await loadGlobalLeaderboard();
    } else {
      setFeedback(result.result.feedback, 'error');
    }
  } catch (err) {
    if (err.message === 'Session required') {
      clearStoredSession();
      try {
        const session = await api.startLevel(levelData.id);
        sessionId = session.sessionId;
        saveStoredSession({ sessionId, startedAt: session.startedAt || Date.now() });
        startTimer(session.startedAt);
        setFeedback('Sessao reiniciada. Execute novamente e envie.', 'notice');
        return;
      } catch (startErr) {
        setFeedback('Falha ao criar nova sessao.', 'error');
        return;
      }
    }
    setFeedback(err.message, 'error');
  }
});

nextButton.addEventListener('click', () => {
  if (nextLevelId) {
    window.location.href = `/level/${nextLevelId}`;
  }
});

window.addEventListener('beforeunload', () => {
  stopTimer();
  if (terminalSocket && terminalSocket.readyState === WebSocket.OPEN) {
    terminalSocket.close();
  }
});

attachLogout();
init();
