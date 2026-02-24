const express = require('express');
const { requireAuth } = require('../auth');
const { getProgress } = require('../services/progress');
const { getDb } = require('../db');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const progress = getProgress(req.user.id);
  const user = db
    .prepare('SELECT id, username, email, primary_language_id FROM users WHERE id = ?')
    .get(req.user.id);
  res.json({ progress, user });
});

module.exports = router;

