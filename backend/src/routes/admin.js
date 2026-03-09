const bcrypt = require('bcryptjs');
const express = require('express');
const { getDb } = require('../db');
const { requireAuth, requireAdmin } = require('../auth');
const { resetUserLevelHistory, resetUserAllHistory } = require('../services/user-resets');

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

function isValidEmail(email) {
  return /.+@.+\..+/.test(email || '');
}

function userResponse(row) {
  return {
    ...row,
    full_name: row.full_name || null,
    document_id: row.document_id || null,
    birth_date: row.birth_date || null,
    primary_language_id:
      row.primary_language_id === null || row.primary_language_id === undefined
        ? null
        : Number(row.primary_language_id),
    reward_points: Number(row.reward_points || 0),
    single_reset_coupons: Number(row.single_reset_coupons || 0),
    completed_levels: Number(row.completed_levels || 0),
    total_submissions: Number(row.total_submissions || 0)
  };
}

function getUserWithStats(db, userId) {
  const row = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.primary_language_id, u.reward_points, u.single_reset_coupons,
              u.full_name, u.document_id, u.birth_date,
              (
                SELECT COUNT(*)
                FROM user_level_progress p
                WHERE p.user_id = u.id AND p.completed_at IS NOT NULL
              ) AS completed_levels,
              (
                SELECT COUNT(*)
                FROM submissions s
                WHERE s.user_id = u.id
              ) AS total_submissions
       FROM users u
       WHERE u.id = ?`
    )
    .get(userId);

  return row ? userResponse(row) : null;
}

router.get('/users', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const rawQuery = String(req.query.query || '').trim();
  const pattern = `%${rawQuery.replace(/\s+/g, '%')}%`;
  const rows = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.primary_language_id, u.reward_points, u.single_reset_coupons,
              u.full_name, u.document_id, u.birth_date,
              (
                SELECT COUNT(*)
                FROM user_level_progress p
                WHERE p.user_id = u.id AND p.completed_at IS NOT NULL
              ) AS completed_levels,
              (
                SELECT COUNT(*)
                FROM submissions s
                WHERE s.user_id = u.id
              ) AS total_submissions
       FROM users u
       WHERE ? = '' OR u.username LIKE ? OR u.email LIKE ?
       ORDER BY CASE u.role WHEN 'admin' THEN 0 WHEN 'teacher' THEN 1 ELSE 2 END, u.username ASC
       LIMIT 100`
    )
    .all(rawQuery, pattern, pattern);

  return res.json({ users: rows.map(userResponse) });
});

router.get('/users/:userId/levels', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'userId invalid' });
  }

  const user = db
    .prepare(
      `SELECT u.id, u.username, u.email, u.role, u.primary_language_id, u.reward_points, u.single_reset_coupons,
              u.full_name, u.document_id, u.birth_date,
              (
                SELECT COUNT(*)
                FROM user_level_progress p
                WHERE p.user_id = u.id AND p.completed_at IS NOT NULL
              ) AS completed_levels,
              (
                SELECT COUNT(*)
                FROM submissions s
                WHERE s.user_id = u.id
              ) AS total_submissions
       FROM users u
       WHERE u.id = ?`
    )
    .get(userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  const languageId = req.query.languageId ? Number(req.query.languageId) : null;
  const rows = languageId
    ? db
        .prepare(
          `SELECT l.id, l.language_id, lang.name AS language_name, l.order_index, l.title,
                  l.module_name, l.module_index, l.is_main, l.class_id,
                  COALESCE(p.attempts_count, 0) AS attempts_count,
                  p.best_time_ms, p.completed_at,
                  (
                    SELECT COUNT(*)
                    FROM submissions s
                    WHERE s.user_id = ? AND s.level_id = l.id
                  ) AS submissions_count
           FROM levels l
           JOIN languages lang ON lang.id = l.language_id
           LEFT JOIN user_level_progress p ON p.user_id = ? AND p.level_id = l.id
           WHERE l.language_id = ?
           ORDER BY l.order_index ASC`
        )
        .all(userId, userId, languageId)
    : db
        .prepare(
          `SELECT l.id, l.language_id, lang.name AS language_name, l.order_index, l.title,
                  l.module_name, l.module_index, l.is_main, l.class_id,
                  COALESCE(p.attempts_count, 0) AS attempts_count,
                  p.best_time_ms, p.completed_at,
                  (
                    SELECT COUNT(*)
                    FROM submissions s
                    WHERE s.user_id = ? AND s.level_id = l.id
                  ) AS submissions_count
           FROM levels l
           JOIN languages lang ON lang.id = l.language_id
           LEFT JOIN user_level_progress p ON p.user_id = ? AND p.level_id = l.id
           ORDER BY lang.name ASC, l.order_index ASC`
        )
        .all(userId, userId);

  const levels = rows.map((row) => ({
    ...row,
    attempts_count: Number(row.attempts_count || 0),
    submissions_count: Number(row.submissions_count || 0),
    best_time_ms: row.best_time_ms === null || row.best_time_ms === undefined ? null : Number(row.best_time_ms),
    has_history:
      Number(row.attempts_count || 0) > 0 ||
      Number(row.submissions_count || 0) > 0 ||
      Boolean(row.completed_at)
  }));

  return res.json({ user: userResponse(user), levels });
});

router.patch('/users/:userId', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'userId invalid' });
  }

  const existing = db
    .prepare(
      `SELECT id, username, email, role, primary_language_id, reward_points, single_reset_coupons, password_hash
              , full_name, document_id, birth_date
       FROM users
       WHERE id = ?`
    )
    .get(userId);

  if (!existing) {
    return res.status(404).json({ error: 'User not found' });
  }

  const payload = req.body || {};
  const nextUsername = payload.username === undefined ? existing.username : String(payload.username).trim();
  const nextEmail = payload.email === undefined ? existing.email : String(payload.email).trim();
  const nextRole = payload.role === undefined ? existing.role : String(payload.role).trim();
  const nextRewardPoints =
    payload.reward_points === undefined ? Number(existing.reward_points || 0) : Number(payload.reward_points);
  const nextCoupons =
    payload.single_reset_coupons === undefined
      ? Number(existing.single_reset_coupons || 0)
      : Number(payload.single_reset_coupons);
  const nextFullName =
    payload.full_name === undefined ? existing.full_name : String(payload.full_name || '').trim();
  const nextDocumentId =
    payload.document_id === undefined ? existing.document_id : String(payload.document_id || '').trim();
  const nextBirthDate =
    payload.birth_date === undefined ? existing.birth_date : String(payload.birth_date || '').trim();

  if (!nextUsername || nextUsername.length < 3) {
    return res.status(400).json({ error: 'Username too short' });
  }
  if (!isValidEmail(nextEmail)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!['user', 'teacher', 'admin'].includes(nextRole)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  if (!Number.isFinite(nextRewardPoints) || nextRewardPoints < 0) {
    return res.status(400).json({ error: 'Invalid reward points' });
  }
  if (!Number.isFinite(nextCoupons) || nextCoupons < 0) {
    return res.status(400).json({ error: 'Invalid reset coupon count' });
  }

  let nextPrimaryLanguageId = existing.primary_language_id || null;
  if (payload.primary_language_id !== undefined) {
    if (payload.primary_language_id === null || payload.primary_language_id === '') {
      nextPrimaryLanguageId = null;
    } else {
      const parsedLanguageId = Number(payload.primary_language_id);
      if (!parsedLanguageId) {
        return res.status(400).json({ error: 'primary_language_id invalid' });
      }
      const language = db.prepare('SELECT id FROM languages WHERE id = ?').get(parsedLanguageId);
      if (!language) {
        return res.status(404).json({ error: 'Language not found' });
      }
      nextPrimaryLanguageId = parsedLanguageId;
    }
  }

  const password = payload.password === undefined ? '' : String(payload.password);
  if (password && password.length < 6) {
    return res.status(400).json({ error: 'Password too short' });
  }

  const conflict = db
    .prepare('SELECT id FROM users WHERE (username = ? OR email = ?) AND id <> ?')
    .get(nextUsername, nextEmail, userId);
  if (conflict) {
    return res.status(409).json({ error: 'Username or email already in use' });
  }

  const passwordHash = password ? bcrypt.hashSync(password, 10) : existing.password_hash;

  db.prepare(
    `UPDATE users
     SET username = ?, email = ?, role = ?, primary_language_id = ?, reward_points = ?, single_reset_coupons = ?,
         password_hash = ?, full_name = ?, document_id = ?, birth_date = ?, updated_at = datetime('now')
     WHERE id = ?`
  ).run(
    nextUsername,
    nextEmail,
    nextRole,
    nextPrimaryLanguageId,
    Math.floor(nextRewardPoints),
    Math.floor(nextCoupons),
    passwordHash,
    nextFullName || null,
    nextDocumentId || null,
    nextBirthDate || null,
    userId
  );

  const user = getUserWithStats(db, userId);
  return res.json({ user });
});

router.post('/users/:userId/reset-level', requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  const levelId = Number(req.body?.levelId);
  if (!userId || !levelId) {
    return res.status(400).json({ error: 'userId and levelId are required' });
  }

  try {
    const result = resetUserLevelHistory(userId, levelId);
    if (!result.hadHistory) {
      return res.status(400).json({ error: 'No history found for this level' });
    }
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err.message === 'User not found' || err.message === 'Level not found') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to reset level history' });
  }
});

router.post('/users/:userId/reset-all', requireAuth, requireAdmin, (req, res) => {
  const userId = Number(req.params.userId);
  if (!userId) {
    return res.status(400).json({ error: 'userId invalid' });
  }

  try {
    const result = resetUserAllHistory(userId);
    if (!result.hadHistory) {
      return res.status(400).json({ error: 'No history found for this user' });
    }
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err.message === 'User not found') {
      return res.status(404).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to reset user history' });
  }
});

router.get('/levels', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const languageId = req.query.languageId ? Number(req.query.languageId) : null;
  const rows = languageId
    ? db.prepare(
        `SELECT id, language_id, module_name, module_index, is_main, order_index, title,
                theory_md, example_md, quiz_json, challenge_json, correction_config_json,
                class_id, owner_user_id, allow_quiz, allow_terminal
         FROM levels WHERE language_id = ? ORDER BY order_index`
      ).all(languageId)
    : db.prepare(
        `SELECT id, language_id, module_name, module_index, is_main, order_index, title,
                theory_md, example_md, quiz_json, challenge_json, correction_config_json,
                class_id, owner_user_id, allow_quiz, allow_terminal
         FROM levels ORDER BY language_id, order_index`
      ).all();

  const levels = rows.map((row) => ({
    ...row,
    quiz: JSON.parse(row.quiz_json),
    challenge: JSON.parse(row.challenge_json),
    correction: JSON.parse(row.correction_config_json)
  }));
  res.json({ levels });
});

router.get('/levels/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const levelId = Number(req.params.id);
  const row = db.prepare(
    `SELECT id, language_id, module_name, module_index, is_main, order_index, title,
            theory_md, example_md, quiz_json, challenge_json, correction_config_json,
            class_id, owner_user_id, allow_quiz, allow_terminal
     FROM levels WHERE id = ?`
  ).get(levelId);

  if (!row) {
    return res.status(404).json({ error: 'Level not found' });
  }
  return res.json({
    level: {
      ...row,
      quiz: JSON.parse(row.quiz_json),
      challenge: JSON.parse(row.challenge_json),
      correction: JSON.parse(row.correction_config_json)
    }
  });
});

router.post('/levels', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const payload = req.body || {};
  const languageId = normalizeInt(payload.language_id);
  const orderIndex = normalizeInt(payload.order_index);
  const moduleIndex = normalizeInt(payload.module_index);
  const isMain = payload.is_main ? 1 : 0;
  const classId = normalizeInt(payload.class_id);
  const ownerUserId = normalizeInt(payload.owner_user_id);
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
      classId || null,
      ownerUserId || null,
      allowQuiz,
      allowTerminal
    );
    return res.status(201).json({ ok: true });
  } catch (err) {
    return res.status(409).json({ error: 'Order already in use' });
  }
});

router.patch('/levels/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const levelId = Number(req.params.id);
  const payload = req.body || {};
  const existing = db.prepare('SELECT * FROM levels WHERE id = ?').get(levelId);
  if (!existing) {
    return res.status(404).json({ error: 'Level not found' });
  }

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
  const classId = normalizeInt(payload.class_id, existing.class_id);
  const ownerUserId = normalizeInt(payload.owner_user_id, existing.owner_user_id);
  const allowQuiz = payload.allow_quiz === undefined ? existing.allow_quiz : payload.allow_quiz ? 1 : 0;
  const allowTerminal =
    payload.allow_terminal === undefined ? existing.allow_terminal : payload.allow_terminal ? 1 : 0;

  const transaction = db.transaction(() => {
    if (nextOrder !== existing.order_index) {
      const conflict = db.prepare(
        'SELECT id FROM levels WHERE language_id = ? AND order_index = ?'
      ).get(languageId, nextOrder);
      if (conflict) {
        db.prepare('UPDATE levels SET order_index = ? WHERE id = ?').run(existing.order_index, conflict.id);
      }
    }

    db.prepare(
      `UPDATE levels
       SET language_id = ?, module_name = ?, module_index = ?, is_main = ?, order_index = ?,
           title = ?, theory_md = ?, example_md = ?, quiz_json = ?, challenge_json = ?, correction_config_json = ?,
           class_id = ?, owner_user_id = ?, allow_quiz = ?, allow_terminal = ?, updated_at = datetime('now')
       WHERE id = ?`
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
      classId || null,
      ownerUserId || null,
      allowQuiz,
      allowTerminal,
      levelId
    );
  });

  try {
    transaction();
    return res.json({ ok: true });
  } catch (err) {
    return res.status(400).json({ error: 'Failed to update level' });
  }
});

router.delete('/levels/:id', requireAuth, requireAdmin, (req, res) => {
  const db = getDb();
  const levelId = Number(req.params.id);
  const info = db.prepare('DELETE FROM levels WHERE id = ?').run(levelId);
  if (!info.changes) {
    return res.status(404).json({ error: 'Level not found' });
  }
  return res.json({ ok: true });
});

module.exports = router;
