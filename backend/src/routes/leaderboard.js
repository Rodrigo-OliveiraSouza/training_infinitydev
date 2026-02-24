const express = require('express');
const { requireAuth } = require('../auth');
const {
  getLevelLeaderboard,
  getGlobalLeaderboard,
  getClassLevelLeaderboard,
  getClassGlobalLeaderboard
} = require('../services/leaderboards');

const router = express.Router();

router.get('/levels/:id', requireAuth, (req, res) => {
  const levelId = Number(req.params.id);
  const limit = Number(req.query.limit || 10);
  const data = getLevelLeaderboard(levelId, req.user.id, limit);
  res.json(data);
});

router.get('/global', requireAuth, (req, res) => {
  const limit = Number(req.query.limit || 10);
  const languageId = req.query.languageId ? Number(req.query.languageId) : null;
  const data = getGlobalLeaderboard(req.user.id, limit, languageId);
  res.json(data);
});

router.get('/classes/:classId/levels/:id', requireAuth, (req, res) => {
  const db = require('../db').getDb();
  const classId = Number(req.params.classId);
  const levelId = Number(req.params.id);
  const limit = Number(req.query.limit || 10);
  const membership = db
    .prepare('SELECT 1 FROM class_memberships WHERE user_id = ? AND class_id = ?')
    .get(req.user.id, classId);
  if (!membership) {
    return res.status(403).json({ error: 'Class access required' });
  }
  const data = getClassLevelLeaderboard(levelId, classId, req.user.id, limit);
  res.json(data);
});

router.get('/classes/:classId/global', requireAuth, (req, res) => {
  const db = require('../db').getDb();
  const classId = Number(req.params.classId);
  const limit = Number(req.query.limit || 10);
  const languageId = req.query.languageId ? Number(req.query.languageId) : null;
  const membership = db
    .prepare('SELECT 1 FROM class_memberships WHERE user_id = ? AND class_id = ?')
    .get(req.user.id, classId);
  if (!membership) {
    return res.status(403).json({ error: 'Class access required' });
  }
  const data = getClassGlobalLeaderboard(classId, req.user.id, limit, languageId);
  res.json(data);
});

module.exports = router;

