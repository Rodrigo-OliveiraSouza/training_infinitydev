const { getDb } = require('../db');

function getProgress(userId) {
  const db = getDb();
  const languages = db.prepare('SELECT id, name FROM languages ORDER BY id').all();
  const byLanguage = languages.map((language) => {
    const totalRow = db
      .prepare('SELECT COUNT(*) AS total FROM levels WHERE language_id = ?')
      .get(language.id);
    const completedRow = db
      .prepare(
        `SELECT COUNT(*) AS completed
         FROM user_level_progress p
         JOIN levels l ON l.id = p.level_id
         WHERE p.user_id = ? AND p.completed_at IS NOT NULL AND l.language_id = ?`
      )
      .get(userId, language.id);
    const total = totalRow ? totalRow.total : 0;
    const completed = completedRow ? completedRow.completed : 0;
    return {
      language_id: language.id,
      name: language.name,
      completed,
      total,
      percent: total === 0 ? 0 : Math.round((completed / total) * 100)
    };
  });

  const overallTotal = byLanguage.reduce((sum, row) => sum + row.total, 0);
  const overallCompleted = byLanguage.reduce((sum, row) => sum + row.completed, 0);

  return {
    overall: {
      completed: overallCompleted,
      total: overallTotal,
      percent: overallTotal === 0 ? 0 : Math.round((overallCompleted / overallTotal) * 100)
    },
    byLanguage
  };
}

module.exports = { getProgress };

