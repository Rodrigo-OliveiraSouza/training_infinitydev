const express = require('express');
const { requireAuth } = require('../auth');
const { getDb } = require('../db');

const router = express.Router();

function getRewardByKey(db, key) {
  return db
    .prepare('SELECT id, key, name, type, cost, value, rarity FROM reward_items WHERE key = ?')
    .get(key);
}

function isOwned(db, userId, rewardId) {
  const row = db
    .prepare('SELECT 1 FROM user_reward_items WHERE user_id = ? AND reward_id = ?')
    .get(userId, rewardId);
  return Boolean(row);
}

router.get('/items', requireAuth, (req, res) => {
  const db = getDb();
  const user = db
    .prepare(
      'SELECT id, reward_points, single_reset_coupons, profile_border, profile_icon, profile_badge FROM users WHERE id = ?'
    )
    .get(req.user.id);
  const items = db
    .prepare(
      `SELECT i.id, i.key, i.name, i.type, i.cost, i.value,
              i.rarity,
              CASE WHEN ur.user_id IS NULL THEN 0 ELSE 1 END AS owned
       FROM reward_items i
       LEFT JOIN user_reward_items ur
         ON ur.reward_id = i.id AND ur.user_id = ?
       ORDER BY CASE i.rarity WHEN 'legendary' THEN 0 WHEN 'epic' THEN 1 WHEN 'rare' THEN 2 ELSE 3 END,
                i.cost ASC, i.name ASC`
    )
    .all(req.user.id);
  const couponQty = user ? Number(user.single_reset_coupons || 0) : 0;
  return res.json({
    items: items.map((item) => ({
      ...item,
      quantity: item.type === 'coupon' ? couponQty : Number(item.owned) === 1 ? 1 : 0
    }))
  });
});

router.post('/purchase', requireAuth, (req, res) => {
  const db = getDb();
  const { rewardKey } = req.body || {};
  if (!rewardKey) {
    return res.status(400).json({ error: 'rewardKey required' });
  }
  const item = getRewardByKey(db, rewardKey);
  if (!item) {
    return res.status(404).json({ error: 'Reward not found' });
  }
  if (item.type !== 'coupon' && isOwned(db, req.user.id, item.id)) {
    return res.status(409).json({ error: 'Reward already owned' });
  }
  const user = db
    .prepare('SELECT reward_points, single_reset_coupons FROM users WHERE id = ?')
    .get(req.user.id);
  const points = user ? Number(user.reward_points || 0) : 0;
  if (points < item.cost) {
    return res.status(400).json({ error: 'Not enough points' });
  }
  db.transaction(() => {
    if (item.type === 'coupon') {
      db.prepare(
        `UPDATE users
         SET reward_points = reward_points - ?, single_reset_coupons = single_reset_coupons + 1,
             updated_at = datetime('now')
         WHERE id = ?`
      ).run(item.cost, req.user.id);
      return;
    }

    db.prepare(
      'INSERT INTO user_reward_items (user_id, reward_id, purchased_at) VALUES (?, ?, datetime(\'now\'))'
    ).run(req.user.id, item.id);
    db.prepare(
      'UPDATE users SET reward_points = reward_points - ?, updated_at = datetime(\'now\') WHERE id = ?'
    ).run(item.cost, req.user.id);
  })();

  const updated = db
    .prepare(
      'SELECT id, reward_points, single_reset_coupons, profile_border, profile_icon, profile_badge FROM users WHERE id = ?'
    )
    .get(req.user.id);
  return res.json({ item, user: updated });
});

router.post('/equip', requireAuth, (req, res) => {
  const db = getDb();
  const { rewardKey } = req.body || {};
  if (!rewardKey) {
    return res.status(400).json({ error: 'rewardKey required' });
  }
  const item = getRewardByKey(db, rewardKey);
  if (!item) {
    return res.status(404).json({ error: 'Reward not found' });
  }
  if (item.type === 'coupon') {
    return res.status(400).json({ error: 'Coupon cannot be equipped' });
  }
  if (item.cost > 0 && !isOwned(db, req.user.id, item.id)) {
    return res.status(403).json({ error: 'Reward not owned' });
  }

  let column = null;
  if (item.type === 'border') column = 'profile_border';
  if (item.type === 'icon') column = 'profile_icon';
  if (item.type === 'badge') column = 'profile_badge';
  if (!column) {
    return res.status(400).json({ error: 'Invalid reward type' });
  }

  db.prepare(
    `UPDATE users SET ${column} = ?, updated_at = datetime('now') WHERE id = ?`
  ).run(item.value, req.user.id);

  const updated = db
    .prepare(
      'SELECT id, reward_points, single_reset_coupons, profile_border, profile_icon, profile_badge FROM users WHERE id = ?'
    )
    .get(req.user.id);
  return res.json({ item, user: updated });
});

module.exports = router;
