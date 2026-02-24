const express = require('express');
const { requireAuth } = require('../auth');
const { getLanguages, getLevelsForLanguage } = require('../services/levels');

const router = express.Router();

router.get('/', (req, res) => {
  const languages = getLanguages();
  res.json({ languages });
});

router.get('/:id/levels', requireAuth, (req, res) => {
  const db = require('../db').getDb();
  const languageId = Number(req.params.id);
  const classId = req.query.classId ? Number(req.query.classId) : null;
  if (classId) {
    const membership = db
      .prepare('SELECT 1 FROM class_memberships WHERE user_id = ? AND class_id = ?')
      .get(req.user.id, classId);
    if (!membership) {
      return res.status(403).json({ error: 'Class access required' });
    }
  }
  const levels = getLevelsForLanguage(languageId, req.user.id, classId);
  res.json({ levels });
});

module.exports = router;

