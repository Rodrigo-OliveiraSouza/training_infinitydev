const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireTeacher } = require('../auth');

const router = express.Router();

function normalizeJson(value, fallback) {
  if (value === undefined) return fallback;
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}

function normalizeInt(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

function ensureClassOwner(db, userId, classId) {
  const row = db
    .prepare('SELECT id FROM classes WHERE id = ? AND owner_user_id = ?')
    .get(classId, userId);
  return Boolean(row);
}

router.get('/classes', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const rows = db
    .prepare('SELECT id, name, code, owner_user_id FROM classes WHERE owner_user_id = ?')
    .all(req.user.id);
  res.json({ classes: rows });
});

router.get('/classes/:classId/levels', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const classId = Number(req.params.classId);
  const languageId = req.query.languageId ? Number(req.query.languageId) : null;
  if (!ensureClassOwner(db, req.user.id, classId)) {
    return res.status(403).json({ error: 'Class access required' });
  }

  const rows = languageId
    ? db.prepare(
        `SELECT id, language_id, module_name, module_index, is_main, order_index, title,
                theory_md, example_md, quiz_json, challenge_json, correction_config_json,
                class_id, owner_user_id, allow_quiz, allow_terminal
         FROM levels WHERE language_id = ? AND class_id = ? ORDER BY order_index`
      ).all(languageId, classId)
    : db.prepare(
        `SELECT id, language_id, module_name, module_index, is_main, order_index, title,
                theory_md, example_md, quiz_json, challenge_json, correction_config_json,
                class_id, owner_user_id, allow_quiz, allow_terminal
         FROM levels WHERE class_id = ? ORDER BY language_id, order_index`
      ).all(classId);

  const levels = rows.map((row) => ({
    ...row,
    quiz: JSON.parse(row.quiz_json),
    challenge: JSON.parse(row.challenge_json),
    correction: JSON.parse(row.correction_config_json)
  }));
  res.json({ levels });
});

router.post('/classes/:classId/levels', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const classId = Number(req.params.classId);
  if (!ensureClassOwner(db, req.user.id, classId)) {
    return res.status(403).json({ error: 'Class access required' });
  }

  const payload = req.body || {};
  const languageId = normalizeInt(payload.language_id);
  const orderIndex = normalizeInt(payload.order_index);
  const moduleIndex = normalizeInt(payload.module_index);
  const isMain = payload.is_main ? 1 : 0;
  const allowQuiz = payload.allow_quiz === undefined ? 1 : payload.allow_quiz ? 1 : 0;
  const allowTerminal = payload.allow_terminal === undefined ? 1 : payload.allow_terminal ? 1 : 0;

  if (!languageId || !orderIndex || !payload.title) {
    return res.status(400).json({ error: 'language_id, order_index and title are required' });
  }

  const quizJson = normalizeJson(payload.quiz_json || payload.quiz || [], '[]');
  const challengeJson = normalizeJson(payload.challenge_json || payload.challenge || {}, '{}');
  const correctionJson = normalizeJson(payload.correction_config_json || payload.correction || {}, '{}');

  try {
    const insert = db.prepare(
      `INSERT INTO levels
        (language_id, module_name, module_index, is_main, order_index, title, theory_md, example_md, quiz_json, challenge_json, correction_config_json, class_id, owner_user_id, allow_quiz, allow_terminal)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    );
    insert.run(
      languageId,
      payload.module_name || '',
      moduleIndex || null,
      isMain,
      orderIndex,
      payload.title,
      payload.theory_md || '',
      payload.example_md || '',
      quizJson,
      challengeJson,
      correctionJson,
      classId,
      req.user.id,
      allowQuiz,
      allowTerminal
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(409).json({ error: 'Order already in use' });
  }
});

router.patch('/classes/:classId/levels/:id', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const classId = Number(req.params.classId);
  if (!ensureClassOwner(db, req.user.id, classId)) {
    return res.status(403).json({ error: 'Class access required' });
  }

  const levelId = Number(req.params.id);
  const existing = db.prepare('SELECT * FROM levels WHERE id = ? AND class_id = ?').get(levelId, classId);
  if (!existing) {
    return res.status(404).json({ error: 'Level not found' });
  }

  const payload = req.body || {};
  const nextOrder = normalizeInt(payload.order_index, existing.order_index);
  const nextModuleIndex = normalizeInt(payload.module_index, existing.module_index);
  const nextIsMain = payload.is_main === undefined ? existing.is_main : payload.is_main ? 1 : 0;

  const quizJson = normalizeJson(payload.quiz_json || payload.quiz, existing.quiz_json);
  const challengeJson = normalizeJson(payload.challenge_json || payload.challenge, existing.challenge_json);
  const correctionJson = normalizeJson(
    payload.correction_config_json || payload.correction,
    existing.correction_config_json
  );

  const languageId = normalizeInt(payload.language_id, existing.language_id);
  const title = payload.title === undefined ? existing.title : payload.title;
  const theory = payload.theory_md === undefined ? existing.theory_md : payload.theory_md;
  const example = payload.example_md === undefined ? existing.example_md : payload.example_md;
  const moduleName = payload.module_name === undefined ? existing.module_name : payload.module_name;
  const allowQuiz = payload.allow_quiz === undefined ? existing.allow_quiz : payload.allow_quiz ? 1 : 0;
  const allowTerminal =
    payload.allow_terminal === undefined ? existing.allow_terminal : payload.allow_terminal ? 1 : 0;

  const transaction = db.transaction(() => {
    if (nextOrder !== existing.order_index) {
      const conflict = db.prepare(
        'SELECT id FROM levels WHERE language_id = ? AND class_id = ? AND order_index = ?'
      ).get(languageId, classId, nextOrder);
      if (conflict) {
        db.prepare('UPDATE levels SET order_index = ? WHERE id = ?').run(existing.order_index, conflict.id);
      }
    }

    db.prepare(
      `UPDATE levels
       SET language_id = ?, module_name = ?, module_index = ?, is_main = ?, order_index = ?,
           title = ?, theory_md = ?, example_md = ?, quiz_json = ?, challenge_json = ?, correction_config_json = ?,
           allow_quiz = ?, allow_terminal = ?, updated_at = datetime('now')
       WHERE id = ? AND class_id = ?`
    ).run(
      languageId,
      moduleName,
      nextModuleIndex || null,
      nextIsMain,
      nextOrder,
      title,
      theory,
      example,
      quizJson,
      challengeJson,
      correctionJson,
      allowQuiz,
      allowTerminal,
      levelId,
      classId
    );
  });

  try {
    transaction();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to update level' });
  }
});

router.delete('/classes/:classId/levels/:id', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const classId = Number(req.params.classId);
  if (!ensureClassOwner(db, req.user.id, classId)) {
    return res.status(403).json({ error: 'Class access required' });
  }

  const levelId = Number(req.params.id);
  const info = db.prepare('DELETE FROM levels WHERE id = ? AND class_id = ?').run(levelId, classId);
  if (!info.changes) {
    return res.status(404).json({ error: 'Level not found' });
  }
  return res.json({ ok: true });
});

module.exports = router;
