const express = require('express');
const { requireAuth } = require('../auth');
const { getProgress } = require('../services/progress');
const { getDb } = require('../db');
const { consumeSingleResetCoupon } = require('../services/user-resets');

const router = express.Router();

router.get('/', requireAuth, (req, res) => {
  const db = getDb();
  const progress = getProgress(req.user.id);
  const user = db
    .prepare(
      'SELECT id, username, email, primary_language_id, role, reward_points, single_reset_coupons FROM users WHERE id = ?'
    )
    .get(req.user.id);
  res.json({ progress, user });
});

router.post('/levels/:levelId/reset', requireAuth, (req, res) => {
  const levelId = Number(req.params.levelId);
  if (!levelId) {
    return res.status(400).json({ error: 'levelId invalid' });
  }

  try {
    const result = consumeSingleResetCoupon(req.user.id, levelId);
    return res.json({ ok: true, ...result });
  } catch (err) {
    if (err.message === 'User not found' || err.message === 'Level not found') {
      return res.status(404).json({ error: err.message });
    }
    if (err.message === 'No reset coupon available' || err.message === 'No history found for this level') {
      return res.status(400).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Failed to reset level history' });
  }
});

module.exports = router;
