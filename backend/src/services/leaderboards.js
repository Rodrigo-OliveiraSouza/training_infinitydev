const { getDb } = require('../db');

function getLevelLeaderboard(levelId, userId, limit = 10) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.username, p.user_id, p.best_time_ms,
              u.profile_border, u.profile_icon, u.profile_badge
       FROM user_level_progress p
       JOIN users u ON u.id = p.user_id
       WHERE p.level_id = ? AND p.completed_at IS NOT NULL
       ORDER BY p.best_time_ms ASC, p.completed_at ASC
       LIMIT ?`
    )
    .all(levelId, limit);

  let userRank = null;
  let userTime = null;
  if (userId) {
    const userProgress = db
      .prepare(
        'SELECT best_time_ms FROM user_level_progress WHERE user_id = ? AND level_id = ? AND completed_at IS NOT NULL'
      )
      .get(userId, levelId);

    if (userProgress) {
      userTime = userProgress.best_time_ms;
      const rankRow = db
        .prepare(
          'SELECT COUNT(*) + 1 AS rank FROM user_level_progress WHERE level_id = ? AND completed_at IS NOT NULL AND best_time_ms < ?'
        )
        .get(levelId, userTime);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userTime };
}

function getGlobalLeaderboard(userId, limit = 10, languageId = null) {
  const db = getDb();
  const useLanguage = Boolean(languageId);
  const args = useLanguage ? [languageId, languageId] : [];

  const rows = db
    .prepare(
      useLanguage
        ? `SELECT u.id AS user_id, u.username,
                u.profile_border, u.profile_icon, u.profile_badge,
                SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                COALESCE(SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END), 0) AS total_time_ms
           FROM users u
           LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
           LEFT JOIN levels l ON l.id = p.level_id
           GROUP BY u.id
           ORDER BY completed DESC, total_time_ms ASC, u.username ASC
           LIMIT ?`
        : `SELECT u.id AS user_id, u.username,
                u.profile_border, u.profile_icon, u.profile_badge,
                COUNT(p.level_id) AS completed,
                COALESCE(SUM(p.best_time_ms), 0) AS total_time_ms
           FROM users u
           LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
           GROUP BY u.id
           ORDER BY completed DESC, total_time_ms ASC, u.username ASC
           LIMIT ?`
    )
    .all(...args, limit);

  let userRank = null;
  let userStats = null;
  if (userId) {
    const stats = db
      .prepare(
        useLanguage
          ? `SELECT u.id AS user_id,
                  SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                  COALESCE(SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END), 0) AS total_time_ms
             FROM users u
             LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
             LEFT JOIN levels l ON l.id = p.level_id
             WHERE u.id = ?
             GROUP BY u.id`
          : `SELECT u.id AS user_id,
                  COUNT(p.level_id) AS completed,
                  COALESCE(SUM(p.best_time_ms), 0) AS total_time_ms
             FROM users u
             LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
             WHERE u.id = ?
             GROUP BY u.id`
      )
      .get(...args, userId);

    if (stats) {
      userStats = stats;
      const rankRow = db
        .prepare(
          useLanguage
            ? `WITH stats AS (
                 SELECT u.id AS user_id,
                        SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                        COALESCE(SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END), 0) AS total_time_ms
                 FROM users u
                 LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                 LEFT JOIN levels l ON l.id = p.level_id
                 GROUP BY u.id
               )
               SELECT COUNT(*) + 1 AS rank
               FROM stats
               WHERE completed > ? OR (completed = ? AND total_time_ms < ?)`
            : `WITH stats AS (
                 SELECT u.id AS user_id,
                        COUNT(p.level_id) AS completed,
                        COALESCE(SUM(p.best_time_ms), 0) AS total_time_ms
                 FROM users u
                 LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                 GROUP BY u.id
               )
               SELECT COUNT(*) + 1 AS rank
               FROM stats
               WHERE completed > ? OR (completed = ? AND total_time_ms < ?)`
        )
        .get(...args, stats.completed, stats.completed, stats.total_time_ms);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userStats };
}

function getClassLevelLeaderboard(levelId, classId, userId, limit = 10) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.username, p.user_id, p.best_time_ms,
              u.profile_border, u.profile_icon, u.profile_badge
       FROM user_level_progress p
       JOIN users u ON u.id = p.user_id
       JOIN class_memberships m ON m.user_id = u.id AND m.class_id = ?
       WHERE p.level_id = ? AND p.completed_at IS NOT NULL
       ORDER BY p.best_time_ms ASC, p.completed_at ASC
       LIMIT ?`
    )
    .all(classId, levelId, limit);

  let userRank = null;
  let userTime = null;
  if (userId) {
    const userProgress = db
      .prepare(
        `SELECT p.best_time_ms
         FROM user_level_progress p
         JOIN class_memberships m ON m.user_id = p.user_id AND m.class_id = ?
         WHERE p.user_id = ? AND p.level_id = ? AND p.completed_at IS NOT NULL`
      )
      .get(classId, userId, levelId);

    if (userProgress) {
      userTime = userProgress.best_time_ms;
      const rankRow = db
        .prepare(
          `SELECT COUNT(*) + 1 AS rank
           FROM user_level_progress p
           JOIN class_memberships m ON m.user_id = p.user_id AND m.class_id = ?
           WHERE p.level_id = ? AND p.completed_at IS NOT NULL AND p.best_time_ms < ?`
        )
        .get(classId, levelId, userTime);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userTime };
}

function getClassGlobalLeaderboard(classId, userId, limit = 10, languageId = null) {
  const db = getDb();
  const useLanguage = Boolean(languageId);
  const args = useLanguage ? [languageId, languageId, classId] : [classId];

  const rows = db
    .prepare(
      useLanguage
        ? `SELECT u.id AS user_id, u.username,
                u.profile_border, u.profile_icon, u.profile_badge,
                SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                COALESCE(SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END), 0) AS total_time_ms
           FROM class_memberships m
           JOIN users u ON u.id = m.user_id
           LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
           LEFT JOIN levels l ON l.id = p.level_id
           WHERE m.class_id = ?
           GROUP BY u.id
           ORDER BY completed DESC, total_time_ms ASC, u.username ASC
           LIMIT ?`
        : `SELECT u.id AS user_id, u.username,
                u.profile_border, u.profile_icon, u.profile_badge,
                COUNT(p.level_id) AS completed,
                COALESCE(SUM(p.best_time_ms), 0) AS total_time_ms
           FROM class_memberships m
           JOIN users u ON u.id = m.user_id
           LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
           WHERE m.class_id = ?
           GROUP BY u.id
           ORDER BY completed DESC, total_time_ms ASC, u.username ASC
           LIMIT ?`
    )
    .all(...args, limit);

  let userRank = null;
  let userStats = null;
  if (userId) {
    const stats = db
      .prepare(
        useLanguage
          ? `SELECT u.id AS user_id,
                  SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                  COALESCE(SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END), 0) AS total_time_ms
             FROM class_memberships m
             JOIN users u ON u.id = m.user_id
             LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
             LEFT JOIN levels l ON l.id = p.level_id
             WHERE m.class_id = ? AND u.id = ?
             GROUP BY u.id`
          : `SELECT u.id AS user_id,
                  COUNT(p.level_id) AS completed,
                  COALESCE(SUM(p.best_time_ms), 0) AS total_time_ms
             FROM class_memberships m
             JOIN users u ON u.id = m.user_id
             LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
             WHERE m.class_id = ? AND u.id = ?
             GROUP BY u.id`
      )
      .get(...args, userId);

    if (stats) {
      userStats = stats;
      const rankRow = db
        .prepare(
          useLanguage
            ? `WITH stats AS (
                 SELECT u.id AS user_id,
                        SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                        COALESCE(SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END), 0) AS total_time_ms
                 FROM class_memberships m
                 JOIN users u ON u.id = m.user_id
                 LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                 LEFT JOIN levels l ON l.id = p.level_id
                 WHERE m.class_id = ?
                 GROUP BY u.id
               )
               SELECT COUNT(*) + 1 AS rank
               FROM stats
               WHERE completed > ? OR (completed = ? AND total_time_ms < ?)`
            : `WITH stats AS (
                 SELECT u.id AS user_id,
                        COUNT(p.level_id) AS completed,
                        COALESCE(SUM(p.best_time_ms), 0) AS total_time_ms
                 FROM class_memberships m
                 JOIN users u ON u.id = m.user_id
                 LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                 WHERE m.class_id = ?
                 GROUP BY u.id
               )
               SELECT COUNT(*) + 1 AS rank
               FROM stats
               WHERE completed > ? OR (completed = ? AND total_time_ms < ?)`
        )
        .get(...args, stats.completed, stats.completed, stats.total_time_ms);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userStats };
}

module.exports = { getLevelLeaderboard, getGlobalLeaderboard, getClassLevelLeaderboard, getClassGlobalLeaderboard };

