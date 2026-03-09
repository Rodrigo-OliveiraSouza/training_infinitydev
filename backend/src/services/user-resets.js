const { getDb } = require('../db');

function ensureUserExists(db, userId) {
  const user = db
    .prepare(
      'SELECT id, username, email, role, reward_points, single_reset_coupons FROM users WHERE id = ?'
    )
    .get(userId);
  if (!user) {
    throw new Error('User not found');
  }
  return user;
}

function ensureLevelExists(db, levelId) {
  const level = db
    .prepare('SELECT id, title, language_id, order_index FROM levels WHERE id = ?')
    .get(levelId);
  if (!level) {
    throw new Error('Level not found');
  }
  return level;
}

function removeUserLevelHistory(db, userId, levelId) {
  const submissionsRemoved = db
    .prepare('DELETE FROM submissions WHERE user_id = ? AND level_id = ?')
    .run(userId, levelId).changes;
  const progressRemoved = db
    .prepare('DELETE FROM user_level_progress WHERE user_id = ? AND level_id = ?')
    .run(userId, levelId).changes;
  const sessionsRemoved = db
    .prepare('DELETE FROM level_sessions WHERE user_id = ? AND level_id = ?')
    .run(userId, levelId).changes;

  return {
    submissionsRemoved,
    progressRemoved,
    sessionsRemoved,
    hadHistory: submissionsRemoved > 0 || progressRemoved > 0 || sessionsRemoved > 0
  };
}

function getUserInventory(db, userId) {
  return db
    .prepare(
      'SELECT id, username, email, role, reward_points, single_reset_coupons FROM users WHERE id = ?'
    )
    .get(userId);
}

function resetUserLevelHistory(userId, levelId) {
  const db = getDb();
  const transaction = db.transaction(() => {
    const user = ensureUserExists(db, userId);
    const level = ensureLevelExists(db, levelId);
    const counts = removeUserLevelHistory(db, userId, levelId);
    return {
      user: getUserInventory(db, user.id),
      level,
      ...counts
    };
  });

  return transaction();
}

function resetUserAllHistory(userId) {
  const db = getDb();
  const transaction = db.transaction(() => {
    const user = ensureUserExists(db, userId);
    const submissionsRemoved = db
      .prepare('DELETE FROM submissions WHERE user_id = ?')
      .run(userId).changes;
    const progressRemoved = db
      .prepare('DELETE FROM user_level_progress WHERE user_id = ?')
      .run(userId).changes;
    const sessionsRemoved = db
      .prepare('DELETE FROM level_sessions WHERE user_id = ?')
      .run(userId).changes;

    return {
      user: getUserInventory(db, user.id),
      submissionsRemoved,
      progressRemoved,
      sessionsRemoved,
      hadHistory: submissionsRemoved > 0 || progressRemoved > 0 || sessionsRemoved > 0
    };
  });

  return transaction();
}

function consumeSingleResetCoupon(userId, levelId) {
  const db = getDb();
  const transaction = db.transaction(() => {
    const user = ensureUserExists(db, userId);
    if (Number(user.single_reset_coupons || 0) <= 0) {
      throw new Error('No reset coupon available');
    }

    const level = ensureLevelExists(db, levelId);
    const counts = removeUserLevelHistory(db, userId, levelId);
    if (!counts.hadHistory) {
      throw new Error('No history found for this level');
    }

    db.prepare(
      `UPDATE users
       SET single_reset_coupons = single_reset_coupons - 1, updated_at = datetime('now')
       WHERE id = ?`
    ).run(userId);

    return {
      user: getUserInventory(db, user.id),
      level,
      ...counts
    };
  });

  return transaction();
}

module.exports = {
  resetUserLevelHistory,
  resetUserAllHistory,
  consumeSingleResetCoupon
};
