const express = require('express');
const crypto = require('crypto');
const { requireAuth } = require('../auth');
const { getLevel, isLevelUnlocked } = require('../services/levels');
const { runCode, submitCode } = require('../services/submissions');
const { getDb } = require('../db');

const router = express.Router();

function getLanguageName(languageId) {
  const db = getDb();
  const row = db.prepare('SELECT name FROM languages WHERE id = ?').get(languageId);
  return row ? row.name.toLowerCase() : null;
}

function sanitizeLevel(level) {
  const challenge = JSON.parse(level.challenge_json);
  const { tests, ...publicChallenge } = challenge;
  const allowQuiz = level.allow_quiz !== undefined ? Number(level.allow_quiz) !== 0 : true;
  const allowTerminal = level.allow_terminal !== undefined ? Number(level.allow_terminal) !== 0 : true;
  if (!allowTerminal) {
    publicChallenge.mode = 'text';
  }
  return {
    id: level.id,
    language_id: level.language_id,
    class_id: level.class_id || null,
    order_index: level.order_index,
    title: level.title,
    theory_md: level.theory_md,
    example_md: level.example_md,
    quiz: allowQuiz ? JSON.parse(level.quiz_json) : [],
    challenge: publicChallenge
  };
}

router.get('/:id', requireAuth, (req, res) => {
  const levelId = Number(req.params.id);
  const access = isLevelUnlocked(levelId, req.user.id);
  if (!access.allowed) {
    return res.status(403).json({ error: access.reason || 'Level locked' });
  }
  const level = getLevel(levelId);
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  return res.json({ level: sanitizeLevel(level) });
});

router.post('/:id/start', requireAuth, (req, res) => {
  const db = getDb();
  const levelId = Number(req.params.id);
  const access = isLevelUnlocked(levelId, req.user.id);
  if (!access.allowed) {
    return res.status(403).json({ error: access.reason || 'Level locked' });
  }
  const existingSession = db
    .prepare(
      `SELECT id, started_at
       FROM level_sessions
       WHERE user_id = ? AND level_id = ? AND ended_at IS NULL
       ORDER BY started_at DESC
       LIMIT 1`
    )
    .get(req.user.id, levelId);
  if (existingSession) {
    return res.json({ sessionId: existingSession.id, startedAt: existingSession.started_at });
  }

  const sessionId = crypto.randomUUID();
  db.prepare(
    'INSERT INTO level_sessions (id, user_id, level_id, started_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(sessionId, req.user.id, levelId);
  const sessionRow = db
    .prepare('SELECT started_at FROM level_sessions WHERE id = ?')
    .get(sessionId);
  return res.json({ sessionId, startedAt: sessionRow ? sessionRow.started_at : null });
});

router.post('/:id/run', requireAuth, async (req, res) => {
  const db = getDb();
  const levelId = Number(req.params.id);
  const access = isLevelUnlocked(levelId, req.user.id);
  if (!access.allowed) {
    return res.status(403).json({ error: access.reason || 'Level locked' });
  }

  const level = getLevel(levelId);
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  const challenge = JSON.parse(level.challenge_json);
  if (challenge.mode === 'text') {
    return res.status(400).json({ error: 'Execucao indisponivel para esta trilha.' });
  }

  const { code, input, sessionId } = req.body || {};
  if (!code || code.length < 3) {
    return res.status(400).json({ error: 'Code required' });
  }

  if (sessionId) {
    db.prepare('UPDATE level_sessions SET last_run_at = datetime(\'now\') WHERE id = ?').run(
      sessionId
    );
  }

  try {
    const language = getLanguageName(access.level.language_id);
    if (!language) {
      return res.status(500).json({ error: 'Language not configured' });
    }
    const result = await runCode({ language, code, input });
    return res.json({ result });
  } catch (err) {
    return res.status(500).json({ error: 'Execution failed' });
  }
});

router.post('/:id/submit', requireAuth, async (req, res) => {
  const db = getDb();
  const levelId = Number(req.params.id);
  const access = isLevelUnlocked(levelId, req.user.id);
  if (!access.allowed) {
    return res.status(403).json({ error: access.reason || 'Level locked' });
  }

  const { code, sessionId } = req.body || {};
  if (!sessionId) {
    return res.status(400).json({ error: 'sessionId required' });
  }

  const level = getLevel(levelId);
  if (!level) {
    return res.status(404).json({ error: 'Level not found' });
  }
  const challenge = JSON.parse(level.challenge_json);
  const isTextMode = challenge.mode === 'text';
  if (!code || (isTextMode ? !code.trim() : code.length < 3)) {
    return res.status(400).json({ error: isTextMode ? 'Resposta obrigatoria' : 'Code required' });
  }

  try {
    const language = getLanguageName(access.level.language_id);
    if (!language) {
      return res.status(500).json({ error: 'Language not configured' });
    }
    const result = await submitCode({
      userId: req.user.id,
      levelId,
      language,
      code,
      sessionId
    });
    if (result.error) {
      return res.status(result.statusCode || 400).json({ error: result.error });
    }
    return res.json({ result });
  } catch (err) {
    return res.status(500).json({ error: 'Execution failed' });
  }
});

module.exports = router;

