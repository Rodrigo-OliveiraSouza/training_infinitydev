const { getDb } = require('../db');

const MAX_AVG_TIME = 2147483647;

function normalizeRow(row) {
  if (!row) return row;
  return {
    ...row,
    completed: row.completed === undefined ? row.completed : Number(row.completed || 0),
    avg_time_ms:
      row.avg_time_ms === undefined || row.avg_time_ms === null ? row.avg_time_ms : Number(row.avg_time_ms),
    best_time_ms:
      row.best_time_ms === undefined || row.best_time_ms === null ? row.best_time_ms : Number(row.best_time_ms)
  };
}

function getLevelLeaderboard(levelId, userId, limit = 10) {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT u.username, p.user_id, p.best_time_ms,
              u.profile_border, u.profile_icon, u.profile_badge
       FROM user_level_progress p
       JOIN users u ON u.id = p.user_id
       WHERE p.level_id = ? AND p.completed_at IS NOT NULL AND COALESCE(u.role, 'user') <> 'admin'
       ORDER BY p.best_time_ms ASC, p.completed_at ASC
       LIMIT ?`
    )
    .all(levelId, limit)
    .map(normalizeRow);

  let userRank = null;
  let userTime = null;
  if (userId) {
    const userProgress = db
      .prepare(
        `SELECT p.best_time_ms
         FROM user_level_progress p
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ? AND p.level_id = ? AND p.completed_at IS NOT NULL
           AND COALESCE(u.role, 'user') <> 'admin'`
      )
      .get(userId, levelId);

    if (userProgress) {
      userTime = Number(userProgress.best_time_ms);
      const rankRow = db
        .prepare(
          `SELECT COUNT(*) + 1 AS rank
           FROM user_level_progress p
           JOIN users u ON u.id = p.user_id
           WHERE p.level_id = ? AND p.completed_at IS NOT NULL
             AND COALESCE(u.role, 'user') <> 'admin'
             AND p.best_time_ms < ?`
        )
        .get(levelId, userTime);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userTime };
}

function getGlobalQueries(useLanguage, classScoped = false) {
  if (useLanguage && classScoped) {
    return {
      statsSql: `WITH stats AS (
                   SELECT u.id AS user_id, u.username,
                          u.profile_border, u.profile_icon, u.profile_badge,
                          SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                          CASE
                            WHEN SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) = 0 THEN NULL
                            ELSE CAST(ROUND(
                              SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END) * 1.0 /
                              SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END)
                            ) AS INTEGER)
                          END AS avg_time_ms
                   FROM class_memberships m
                   JOIN users u ON u.id = m.user_id
                   LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                   LEFT JOIN levels l ON l.id = p.level_id
                   WHERE m.class_id = ? AND COALESCE(u.role, 'user') <> 'admin'
                   GROUP BY u.id
                 )`,
      statsArgs: (languageId, classId) => [languageId, languageId, languageId, languageId, classId]
    };
  }

  if (useLanguage) {
    return {
      statsSql: `WITH stats AS (
                   SELECT u.id AS user_id, u.username,
                          u.profile_border, u.profile_icon, u.profile_badge,
                          SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) AS completed,
                          CASE
                            WHEN SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END) = 0 THEN NULL
                            ELSE CAST(ROUND(
                              SUM(CASE WHEN l.language_id = ? THEN p.best_time_ms ELSE 0 END) * 1.0 /
                              SUM(CASE WHEN l.language_id = ? THEN 1 ELSE 0 END)
                            ) AS INTEGER)
                          END AS avg_time_ms
                   FROM users u
                   LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                   LEFT JOIN levels l ON l.id = p.level_id
                   WHERE COALESCE(u.role, 'user') <> 'admin'
                   GROUP BY u.id
                 )`,
      statsArgs: (languageId) => [languageId, languageId, languageId, languageId]
    };
  }

  if (classScoped) {
    return {
      statsSql: `WITH stats AS (
                   SELECT u.id AS user_id, u.username,
                          u.profile_border, u.profile_icon, u.profile_badge,
                          COUNT(p.level_id) AS completed,
                          CASE
                            WHEN COUNT(p.level_id) = 0 THEN NULL
                            ELSE CAST(ROUND(AVG(p.best_time_ms)) AS INTEGER)
                          END AS avg_time_ms
                   FROM class_memberships m
                   JOIN users u ON u.id = m.user_id
                   LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                   WHERE m.class_id = ? AND COALESCE(u.role, 'user') <> 'admin'
                   GROUP BY u.id
                 )`,
      statsArgs: (_languageId, classId) => [classId]
    };
  }

  return {
    statsSql: `WITH stats AS (
                 SELECT u.id AS user_id, u.username,
                        u.profile_border, u.profile_icon, u.profile_badge,
                        COUNT(p.level_id) AS completed,
                        CASE
                          WHEN COUNT(p.level_id) = 0 THEN NULL
                          ELSE CAST(ROUND(AVG(p.best_time_ms)) AS INTEGER)
                        END AS avg_time_ms
                 FROM users u
                 LEFT JOIN user_level_progress p ON p.user_id = u.id AND p.completed_at IS NOT NULL
                 WHERE COALESCE(u.role, 'user') <> 'admin'
                 GROUP BY u.id
               )`,
    statsArgs: () => []
  };
}

function getLeaderboardFromStats({ statsSql, statsArgs }, params, userId, limit) {
  const db = getDb();
  const baseArgs = statsArgs(...params);

  const rows = db
    .prepare(
      `${statsSql}
       SELECT *
       FROM stats
       ORDER BY completed DESC,
                CASE WHEN avg_time_ms IS NULL THEN 1 ELSE 0 END ASC,
                avg_time_ms ASC,
                username ASC
       LIMIT ?`
    )
    .all(...baseArgs, limit)
    .map(normalizeRow);

  let userRank = null;
  let userStats = null;
  if (userId) {
    userStats = db
      .prepare(
        `${statsSql}
         SELECT *
         FROM stats
         WHERE user_id = ?`
      )
      .get(...baseArgs, userId);

    userStats = normalizeRow(userStats);

    if (userStats) {
      const rankRow = db
        .prepare(
          `${statsSql}
           SELECT COUNT(*) + 1 AS rank
           FROM stats
           WHERE completed > ?
              OR (
                completed = ?
                AND COALESCE(avg_time_ms, ${MAX_AVG_TIME}) < COALESCE(?, ${MAX_AVG_TIME})
              )`
        )
        .get(...baseArgs, userStats.completed, userStats.completed, userStats.avg_time_ms);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userStats };
}

function getGlobalLeaderboard(userId, limit = 10, languageId = null) {
  const queries = getGlobalQueries(Boolean(languageId), false);
  const params = languageId ? [languageId] : [];
  return getLeaderboardFromStats(queries, params, userId, limit);
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
       WHERE p.level_id = ? AND p.completed_at IS NOT NULL AND COALESCE(u.role, 'user') <> 'admin'
       ORDER BY p.best_time_ms ASC, p.completed_at ASC
       LIMIT ?`
    )
    .all(classId, levelId, limit)
    .map(normalizeRow);

  let userRank = null;
  let userTime = null;
  if (userId) {
    const userProgress = db
      .prepare(
        `SELECT p.best_time_ms
         FROM user_level_progress p
         JOIN class_memberships m ON m.user_id = p.user_id AND m.class_id = ?
         JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ? AND p.level_id = ? AND p.completed_at IS NOT NULL
           AND COALESCE(u.role, 'user') <> 'admin'`
      )
      .get(classId, userId, levelId);

    if (userProgress) {
      userTime = Number(userProgress.best_time_ms);
      const rankRow = db
        .prepare(
          `SELECT COUNT(*) + 1 AS rank
           FROM user_level_progress p
           JOIN class_memberships m ON m.user_id = p.user_id AND m.class_id = ?
           JOIN users u ON u.id = p.user_id
           WHERE p.level_id = ? AND p.completed_at IS NOT NULL
             AND COALESCE(u.role, 'user') <> 'admin'
             AND p.best_time_ms < ?`
        )
        .get(classId, levelId, userTime);
      userRank = rankRow ? rankRow.rank : null;
    }
  }

  return { rows, userRank, userTime };
}

function getClassGlobalLeaderboard(classId, userId, limit = 10, languageId = null) {
  const queries = getGlobalQueries(Boolean(languageId), true);
  const params = languageId ? [languageId, classId] : [null, classId];
  return getLeaderboardFromStats(queries, params, userId, limit);
}

module.exports = {
  getLevelLeaderboard,
  getGlobalLeaderboard,
  getClassLevelLeaderboard,
  getClassGlobalLeaderboard
};
