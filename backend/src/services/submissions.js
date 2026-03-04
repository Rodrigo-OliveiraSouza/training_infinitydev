const { getDb } = require('../db');
const { prepareRunner } = require('../executor');
const { evaluateOutput, evaluateTestOutput } = require('../utils/correction');
const sessionInputs = require('./session-inputs');
const { truncateOutput } = require('../utils/normalize');
const config = require('../config');

const INPUT_PLACEHOLDER_RE = /\{\{input(?:_line\d+)?\}\}/;
const PYTHON_INPUT_RE = /\binput\s*\(/i;
const JAVA_SCANNER_RE = /new\s+Scanner\s*\(\s*System\.in\s*\)/i;
const JAVA_CONSOLE_RE = /System\.console\s*\(\s*\)\s*\.readLine\s*\(/i;
const JAVA_BUFFERED_READER_RE = /new\s+BufferedReader\s*\(\s*new\s+InputStreamReader\s*\(\s*System\.in\s*\)\s*\)/i;
const PYTHON_EOF_RE = /EOFError:\s*EOF when reading a line/i;
const JAVA_INPUT_ERROR_RE = /NoSuchElementException|No line found|InputMismatchException/i;

function getElapsedMs(db, startedAt) {
  if (!startedAt) return 0;
  const row = db
    .prepare(
      `SELECT CAST((julianday('now') - julianday(?)) * 86400000 AS INTEGER) AS elapsed_ms`
    )
    .get(startedAt);
  const elapsedMs = row ? Number(row.elapsed_ms) : 0;
  return Number.isFinite(elapsedMs) && elapsedMs > 0 ? elapsedMs : 0;
}

function correctionUsesSessionInput(correction) {
  if (!correction || typeof correction !== 'object') return false;
  if (correction.inputSource === 'session') return true;
  if (correction.inputSource && correction.inputSource !== 'session') return false;
  if (typeof correction.input === 'string' && correction.input.length > 0) return false;
  return (
    correction.type === 'regex' &&
    typeof correction.expectedRegex === 'string' &&
    INPUT_PLACEHOLDER_RE.test(correction.expectedRegex)
  );
}

function normalizeLanguageName(language) {
  return String(language || '').trim().toLowerCase();
}

function correctionAcceptsInput(correction, challenge) {
  if (!correction || typeof correction !== 'object') return false;
  if (correction.inputSource === 'session') return true;
  if (typeof correction.input === 'string' && correction.input.length > 0) return true;
  if (
    correction.type === 'regex' &&
    typeof correction.expectedRegex === 'string' &&
    INPUT_PLACEHOLDER_RE.test(correction.expectedRegex)
  ) {
    return true;
  }
  if (correction.type === 'tests') {
    const tests = challenge && Array.isArray(challenge.tests) ? challenge.tests : [];
    return tests.some((test) => typeof test.input === 'string' && test.input.length > 0);
  }
  return false;
}

function codeReadsInteractiveInput(language, code) {
  if (typeof code !== 'string' || code.length === 0) return false;
  const lang = normalizeLanguageName(language);
  if (lang === 'python') {
    return PYTHON_INPUT_RE.test(code);
  }
  if (lang === 'java') {
    return (
      JAVA_SCANNER_RE.test(code) ||
      JAVA_CONSOLE_RE.test(code) ||
      JAVA_BUFFERED_READER_RE.test(code)
    );
  }
  return PYTHON_INPUT_RE.test(code) || JAVA_SCANNER_RE.test(code);
}

function isInteractiveInputRuntimeError(language, stderr) {
  if (typeof stderr !== 'string' || stderr.length === 0) return false;
  const lang = normalizeLanguageName(language);
  if (lang === 'python') {
    return PYTHON_EOF_RE.test(stderr);
  }
  if (lang === 'java') {
    return JAVA_INPUT_ERROR_RE.test(stderr);
  }
  return PYTHON_EOF_RE.test(stderr) || JAVA_INPUT_ERROR_RE.test(stderr);
}

function inputNotSupportedFeedback() {
  return 'Esta fase nao aceita entrada interativa no envio. Remova input()/Scanner e imprima apenas o resultado pedido.';
}

async function runCode({ language, code, input }) {
  const runner = await prepareRunner(language, code);
  if (runner.compileError) {
    return {
      status: 'compile_error',
      stdout: runner.compileError.stdout,
      stderr: runner.compileError.stderr,
      runtimeMs: runner.compileError.runtimeMs
    };
  }

  try {
    const result = await runner.run(input || '');
    return {
      status: result.exitCode === 0 ? 'ok' : 'runtime_error',
      stdout: result.stdout,
      stderr: result.stderr,
      runtimeMs: result.runtimeMs
    };
  } finally {
    runner.cleanup();
  }
}

function parseLevelData(levelRow) {
  return {
    ...levelRow,
    quiz: JSON.parse(levelRow.quiz_json),
    challenge: JSON.parse(levelRow.challenge_json),
    correction: JSON.parse(levelRow.correction_config_json)
  };
}

async function submitCode({ userId, levelId, language, code, sessionId }) {
  const db = getDb();
  const levelRow = db
    .prepare(
      'SELECT id, language_id, order_index, title, quiz_json, challenge_json, correction_config_json, is_main FROM levels WHERE id = ?'
    )
    .get(levelId);

  if (!levelRow) {
    return { error: 'Level not found', statusCode: 404 };
  }

  const level = parseLevelData(levelRow);
  const correction = level.correction || { type: 'exact' };
  const isTextMode = level.challenge && level.challenge.mode === 'text';
  const acceptsInput = correctionAcceptsInput(correction, level.challenge);
  const readsInteractiveInput = codeReadsInteractiveInput(language, code);

  const session = db
    .prepare('SELECT id, started_at FROM level_sessions WHERE id = ? AND user_id = ?')
    .get(sessionId, userId);

  if (!session) {
    return { error: 'Session required', statusCode: 400 };
  }

  if (isTextMode) {
    const evaluation = evaluateOutput(correction, code || '', '');
    const passed = evaluation.passed;
    const feedback = passed ? 'Resposta aceita.' : 'Resposta incorreta.';
    let rewardPoints = 0;
    let rewardItem = null;

    recordSubmission({
      userId,
      levelId,
      sessionId,
      code,
      language,
      status: passed ? 'passed' : 'failed',
      stdout: '',
      stderr: '',
      runtimeMs: 0
    });

    const elapsedMs = getElapsedMs(db, session.started_at);
    if (passed) {
      const progress = updateProgress({ userId, levelId, elapsedMs });
      if (progress.firstCompletion && !hasRewardClaim(db, userId, levelId)) {
        rewardPoints = resolveRewardPoints(level);
        awardPoints(db, userId, rewardPoints);
        rewardItem = grantSpecialReward(db, userId, level.challenge);
        recordRewardClaim(db, userId, levelId);
      }
      db.prepare('UPDATE level_sessions SET ended_at = datetime(\'now\') WHERE id = ?').run(
        sessionId
      );
    }

    const userPoints = db
      .prepare('SELECT reward_points, single_reset_coupons FROM users WHERE id = ?')
      .get(userId);

    return {
      status: passed ? 'passed' : 'failed',
      passed,
      feedback,
      stdout: '',
      stderr: '',
      runtimeMs: 0,
      elapsedMs,
      rewardPoints,
      rewardItem,
      userPoints: userPoints ? userPoints.reward_points : 0,
      userCoupons: userPoints ? userPoints.single_reset_coupons : 0
    };
  }

  const runner = await prepareRunner(language, code);
  if (runner.compileError) {
    recordSubmission({
      userId,
      levelId,
      sessionId,
      code,
      language,
      status: 'compile_error',
      stdout: runner.compileError.stdout,
      stderr: runner.compileError.stderr,
      runtimeMs: runner.compileError.runtimeMs
    });
    return {
      status: 'compile_error',
      passed: false,
      feedback: 'Erro de compilação. Verifique a sintaxe.',
      stdout: runner.compileError.stdout,
      stderr: runner.compileError.stderr
    };
  }

  let passed = false;
  let feedback = '';
  let stdout = '';
  let stderr = '';
  let runtimeMs = 0;
  const details = [];
  let inputNotSupportedError = false;

  try {
    if (correction.type === 'tests') {
      const tests = level.challenge.tests || [];
      let passedCount = 0;

      for (let index = 0; index < tests.length; index += 1) {
        const test = tests[index];
        const result = await runner.run(test.input || '');
        stdout = result.stdout;
        stderr = result.stderr;
        runtimeMs += result.runtimeMs;
        if (
          result.exitCode !== 0 &&
          !acceptsInput &&
          readsInteractiveInput &&
          isInteractiveInputRuntimeError(language, result.stderr)
        ) {
          inputNotSupportedError = true;
        }

        const evaluation = evaluateTestOutput(test, result.stdout, test.input || '');
        if (evaluation.passed && result.exitCode === 0) {
          passedCount += 1;
        } else {
          details.push({ index, expected: test.expected, actual: result.stdout });
        }
      }

      const threshold = correction.passThreshold || 1;
      const ratio = tests.length === 0 ? 0 : passedCount / tests.length;
      passed = ratio >= threshold && details.length === 0;
      if (passed) {
        feedback = 'Resposta aceita.';
      } else if (inputNotSupportedError) {
        feedback = inputNotSupportedFeedback();
      } else {
        feedback = details.length
          ? 'Um ou mais testes falharam. Verifique a saída e tente novamente.'
          : 'Nenhum teste foi aprovado.';
      }
    } else {
      let input = correction.input || '';
      if (correctionUsesSessionInput(correction)) {
        input = sessionInputs.consumeInput(sessionId);
        if (!input) {
          return { error: 'Execute o codigo no terminal antes de enviar.', statusCode: 400 };
        }
      }
      const result = await runner.run(input);
      stdout = result.stdout;
      stderr = result.stderr;
      runtimeMs = result.runtimeMs;

      const evaluation = evaluateOutput(correction, result.stdout, input);
      passed = evaluation.passed && result.exitCode === 0;
      if (passed) {
        feedback = 'Resposta aceita.';
      } else if (result.exitCode !== 0) {
        if (
          !acceptsInput &&
          readsInteractiveInput &&
          isInteractiveInputRuntimeError(language, result.stderr)
        ) {
          feedback = inputNotSupportedFeedback();
        } else {
          feedback = 'Execucao finalizada com erro.';
        }
      } else {
        feedback = 'Saída não corresponde ao esperado.';
      }
    }
  } finally {
    runner.cleanup();
  }

  recordSubmission({
    userId,
    levelId,
    sessionId,
    code,
    language,
    status: passed ? 'passed' : 'failed',
    stdout,
    stderr,
    runtimeMs
  });

  const elapsedMs = getElapsedMs(db, session.started_at);
  let rewardPoints = 0;
  let rewardItem = null;
  if (passed) {
    const progress = updateProgress({ userId, levelId, elapsedMs });
    if (progress.firstCompletion && !hasRewardClaim(db, userId, levelId)) {
      rewardPoints = resolveRewardPoints(level);
      awardPoints(db, userId, rewardPoints);
      rewardItem = grantSpecialReward(db, userId, level.challenge);
      recordRewardClaim(db, userId, levelId);
    }
    db.prepare('UPDATE level_sessions SET ended_at = datetime(\'now\') WHERE id = ?').run(
      sessionId
    );
  }

  const userPoints = db
    .prepare('SELECT reward_points, single_reset_coupons FROM users WHERE id = ?')
    .get(userId);

  return {
    status: passed ? 'passed' : 'failed',
    passed,
    feedback,
    stdout: truncateOutput(stdout, config.maxOutputKb),
    stderr: truncateOutput(stderr, config.maxOutputKb),
    runtimeMs,
    elapsedMs,
    rewardPoints,
    rewardItem,
    userPoints: userPoints ? userPoints.reward_points : 0,
    userCoupons: userPoints ? userPoints.single_reset_coupons : 0
  };
}

function recordSubmission({ userId, levelId, sessionId, code, language, status, stdout, stderr, runtimeMs }) {
  const db = getDb();
  db.prepare(
    `INSERT INTO submissions (user_id, level_id, session_id, code, language, status, exec_stdout, exec_stderr, runtime_ms)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(userId, levelId, sessionId, code, language, status, stdout, stderr, runtimeMs);

  db.prepare(
    `INSERT INTO user_level_progress (user_id, level_id, attempts_count, updated_at)
     VALUES (?, ?, 1, datetime('now'))
     ON CONFLICT(user_id, level_id)
     DO UPDATE SET attempts_count = attempts_count + 1, updated_at = datetime('now')`
  ).run(userId, levelId);
}

function updateProgress({ userId, levelId, elapsedMs }) {
  const db = getDb();
  const existing = db
    .prepare('SELECT best_time_ms, completed_at FROM user_level_progress WHERE user_id = ? AND level_id = ?')
    .get(userId, levelId);

  if (!existing || !existing.completed_at) {
    db.prepare(
      `UPDATE user_level_progress
       SET best_time_ms = ?, completed_at = datetime('now'), updated_at = datetime('now')
       WHERE user_id = ? AND level_id = ?`
    ).run(elapsedMs, userId, levelId);
    return { firstCompletion: true };
  }

  if (existing.best_time_ms === null || elapsedMs < existing.best_time_ms) {
    db.prepare(
      `UPDATE user_level_progress
       SET best_time_ms = ?, updated_at = datetime('now')
       WHERE user_id = ? AND level_id = ?`
    ).run(elapsedMs, userId, levelId);
  }

  return { firstCompletion: false };
}

function awardPoints(db, userId, points) {
  if (!points || points <= 0) return;
  db.prepare(
    `UPDATE users
     SET reward_points = COALESCE(reward_points, 0) + ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(points, userId);
}

function resolveRewardPoints(level) {
  const challenge = level.challenge || {};
  const override = Number(challenge.rewardPoints);
  if (!Number.isNaN(override) && override > 0) {
    return override;
  }

  const difficulty = String(challenge.difficulty || 'normal').toLowerCase();
  if (difficulty === 'extreme') {
    return level.is_main ? 30 : 18;
  }
  if (difficulty === 'advanced') {
    return level.is_main ? 18 : 10;
  }
  return level.is_main ? 10 : 5;
}

function grantSpecialReward(db, userId, challenge) {
  const rewardKey = challenge && challenge.rewardKey ? String(challenge.rewardKey).trim() : '';
  if (!rewardKey) return null;

  const reward = db
    .prepare('SELECT id, key, name, type, value, rarity FROM reward_items WHERE key = ?')
    .get(rewardKey);
  if (!reward) return null;

  if (reward.type === 'coupon') {
    db.prepare(
      `UPDATE users
       SET single_reset_coupons = single_reset_coupons + 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(userId);
    return reward;
  }

  const owned = db
    .prepare('SELECT 1 FROM user_reward_items WHERE user_id = ? AND reward_id = ?')
    .get(userId, reward.id);
  if (owned) {
    return null;
  }

  db.prepare(
    `INSERT INTO user_reward_items (user_id, reward_id, purchased_at)
     VALUES (?, ?, datetime('now'))`
  ).run(userId, reward.id);

  return reward;
}

function hasRewardClaim(db, userId, levelId) {
  const row = db
    .prepare('SELECT 1 FROM user_level_reward_claims WHERE user_id = ? AND level_id = ?')
    .get(userId, levelId);
  return Boolean(row);
}

function recordRewardClaim(db, userId, levelId) {
  db.prepare(
    `INSERT OR IGNORE INTO user_level_reward_claims (user_id, level_id, claimed_at)
     VALUES (?, ?, datetime('now'))`
  ).run(userId, levelId);
}

module.exports = { runCode, submitCode };

