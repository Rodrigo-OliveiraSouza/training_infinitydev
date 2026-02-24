const express = require('express');
const crypto = require('crypto');
const { getDb } = require('../db');
const { requireAuth, requireTeacher } = require('../auth');

const router = express.Router();

function generateCode() {
  return crypto.randomBytes(4).toString('hex').toUpperCase();
}

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const classes = db
    .prepare(
      `SELECT c.id, c.name, c.code, c.owner_user_id,
              m.role AS membership_role
       FROM class_memberships m
       JOIN classes c ON c.id = m.class_id
       WHERE m.user_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(req.user.id);
  res.json({ classes });
});

router.post('/', requireAuth, requireTeacher, (req, res) => {
  const db = getDb();
  const { name } = req.body || {};
  if (!name || name.trim().length < 3) {
    return res.status(400).json({ error: 'Name required' });
  }

  let code = generateCode();
  while (db.prepare('SELECT id FROM classes WHERE code = ?').get(code)) {
    code = generateCode();
  }

  const info = db
    .prepare(
      'INSERT INTO classes (name, code, owner_user_id, created_at) VALUES (?, ?, ?, datetime(\'now\'))'
    )
    .run(name.trim(), code, req.user.id);

  db.prepare(
    'INSERT INTO class_memberships (user_id, class_id, role, joined_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(req.user.id, info.lastInsertRowid, 'teacher');

  return res.status(201).json({
    class: {
      id: info.lastInsertRowid,
      name: name.trim(),
      code,
      owner_user_id: req.user.id
    }
  });
});

router.post('/join', requireAuth, (req, res) => {
  const db = getDb();
  const { code } = req.body || {};
  if (!code) {
    return res.status(400).json({ error: 'Code required' });
  }
  const classRow = db
    .prepare('SELECT id, name, code, owner_user_id FROM classes WHERE code = ?')
    .get(code.trim().toUpperCase());
  if (!classRow) {
    return res.status(404).json({ error: 'Class not found' });
  }

  const existing = db
    .prepare('SELECT 1 FROM class_memberships WHERE user_id = ? AND class_id = ?')
    .get(req.user.id, classRow.id);
  if (existing) {
    return res.json({ class: classRow });
  }

  db.prepare(
    'INSERT INTO class_memberships (user_id, class_id, role, joined_at) VALUES (?, ?, ?, datetime(\'now\'))'
  ).run(req.user.id, classRow.id, 'student');
  return res.json({ class: classRow });
});

router.get('/:id', requireAuth, (req, res) => {
  const db = getDb();
  const classId = Number(req.params.id);
  const membership = db
    .prepare('SELECT role FROM class_memberships WHERE user_id = ? AND class_id = ?')
    .get(req.user.id, classId);
  if (!membership) {
    return res.status(403).json({ error: 'Not a member' });
  }
  const row = db
    .prepare('SELECT id, name, code, owner_user_id FROM classes WHERE id = ?')
    .get(classId);
  if (!row) {
    return res.status(404).json({ error: 'Class not found' });
  }
  return res.json({ class: { ...row, membership_role: membership.role } });
});

module.exports = router;
