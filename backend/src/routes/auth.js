const express = require('express');
const bcrypt = require('bcryptjs');
const { getDb } = require('../db');
const { signToken, requireAuth } = require('../auth');

const router = express.Router();

function isValidEmail(email) {
  return /.+@.+\..+/.test(email || '');
}

router.post('/register', (req, res) => {
  const db = getDb();
  const { username, email, password, classCode, role } = req.body || {};
  if (!username || username.length < 3) {
    return res.status(400).json({ error: 'Username too short' });
  }
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Invalid email' });
  }
  if (!password || password.length < 6) {
    return res.status(400).json({ error: 'Password too short' });
  }

  const existing = db
    .prepare('SELECT id FROM users WHERE username = ? OR email = ?')
    .get(username, email);
  if (existing) {
    return res.status(409).json({ error: 'Username or email already in use' });
  }

  const normalizedRole = role === 'teacher' ? 'teacher' : 'user';
  const passwordHash = bcrypt.hashSync(password, 10);
  const info = db
    .prepare(
      'INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
    )
    .run(username, email, passwordHash, normalizedRole);

  const user = db
    .prepare(
      'SELECT id, username, email, primary_language_id, role, reward_points, profile_border, profile_icon, profile_badge, intro_seen FROM users WHERE id = ?'
    )
    .get(info.lastInsertRowid);

  if (classCode) {
    const classRow = db
      .prepare('SELECT id FROM classes WHERE code = ?')
      .get(String(classCode).trim().toUpperCase());
    if (classRow) {
      db.prepare(
        'INSERT OR IGNORE INTO class_memberships (user_id, class_id, role, joined_at) VALUES (?, ?, ?, datetime(\'now\'))'
      ).run(user.id, classRow.id, normalizedRole === 'teacher' ? 'teacher' : 'student');
    }
  }

  const token = signToken(user);
  return res.status(201).json({ user, token });
});

router.post('/login', (req, res) => {
  const db = getDb();
  const { identifier, password, email, username } = req.body || {};
  const loginId = identifier || email || username;
  if (!loginId || !password) {
    return res.status(400).json({ error: 'Login and password required' });
  }

  const user = loginId.includes('@')
    ? db.prepare('SELECT * FROM users WHERE email = ?').get(loginId)
    : db.prepare('SELECT * FROM users WHERE username = ?').get(loginId);

  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken(user);
  return res.json({
    user: {
      id: user.id,
      username: user.username,
      email: user.email,
      primary_language_id: user.primary_language_id,
      role: user.role || 'user',
      reward_points: user.reward_points || 0,
      profile_border: user.profile_border || null,
      profile_icon: user.profile_icon || null,
      profile_badge: user.profile_badge || null,
      intro_seen: user.intro_seen ? 1 : 0
    },
    token
  });
});

router.post('/recover', (req, res) => {
  const { email } = req.body || {};
  if (!email || !isValidEmail(email)) {
    return res.status(400).json({ error: 'Email required' });
  }
  return res.json({ ok: true, message: 'If the email exists, a reset link will be sent.' });
});

router.post('/logout', requireAuth, (req, res) => {
  return res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => {
  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, username, email, primary_language_id, role, reward_points, profile_border, profile_icon, profile_badge, intro_seen FROM users WHERE id = ?'
    )
    .get(req.user.id);
  return res.json({ user });
});

router.patch('/me/language', requireAuth, (req, res) => {
  const db = getDb();
  const { languageId } = req.body || {};
  if (!languageId) {
    return res.status(400).json({ error: 'languageId required' });
  }
  const language = db.prepare('SELECT id FROM languages WHERE id = ?').get(languageId);
  if (!language) {
    return res.status(404).json({ error: 'Language not found' });
  }
  db.prepare('UPDATE users SET primary_language_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run(
    languageId,
    req.user.id
  );
  const user = db
    .prepare(
      'SELECT id, username, email, primary_language_id, reward_points, profile_border, profile_icon, profile_badge, intro_seen FROM users WHERE id = ?'
    )
    .get(req.user.id);
  return res.json({ user });
});

router.patch('/me/intro', requireAuth, (req, res) => {
  const db = getDb();
  db.prepare('UPDATE users SET intro_seen = 1, updated_at = datetime(\'now\') WHERE id = ?').run(
    req.user.id
  );
  const user = db
    .prepare(
      'SELECT id, username, email, primary_language_id, reward_points, profile_border, profile_icon, profile_badge, intro_seen FROM users WHERE id = ?'
    )
    .get(req.user.id);
  return res.json({ user });
});

module.exports = router;

