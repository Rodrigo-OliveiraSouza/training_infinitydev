const { getDb } = require('../db');
const { prepareRunner } = require('../executor');
const { evaluateOutput, evaluateTestOutput } = require('../utils/correction');
const sessionInputs = require('./session-inputs');
const { truncateOutput } = require('../utils/normalize');
const config = require('../config');

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
      if (progress.firstCompletion) {
        rewardPoints = level.is_main ? 10 : 5;
        awardPoints(db, userId, rewardPoints);
      }
      db.prepare('UPDATE level_sessions SET ended_at = datetime(\'now\') WHERE id = ?').run(
        sessionId
      );
    }

    const userPoints = db
      .prepare('SELECT reward_points FROM users WHERE id = ?')
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
      userPoints: userPoints ? userPoints.reward_points : 0
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
  let feedback = 'Resposta incorreta.';
  let stdout = '';
  let stderr = '';
  let runtimeMs = 0;
  const details = [];

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
      if (!passed) {
        feedback = details.length
          ? 'Um ou mais testes falharam. Verifique a saída e tente novamente.'
          : 'Nenhum teste foi aprovado.';
      }
    } else {
      let input = correction.input || '';
      if (correction.inputSource === 'session') {
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
      if (!passed) {
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
  if (passed) {
    const progress = updateProgress({ userId, levelId, elapsedMs });
    if (progress.firstCompletion) {
      rewardPoints = level.is_main ? 10 : 5;
      awardPoints(db, userId, rewardPoints);
    }
    db.prepare('UPDATE level_sessions SET ended_at = datetime(\'now\') WHERE id = ?').run(
      sessionId
    );
  }

  const userPoints = db
    .prepare('SELECT reward_points FROM users WHERE id = ?')
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
    userPoints: userPoints ? userPoints.reward_points : 0
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

module.exports = { runCode, submitCode };

