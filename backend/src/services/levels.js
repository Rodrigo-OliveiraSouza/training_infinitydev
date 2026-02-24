const { getDb } = require('../db');

function getLanguages() {
  const db = getDb();
  return db.prepare('SELECT id, name FROM languages ORDER BY id').all();
}

function ensureLanguages() {
  const db = getDb();
  const names = ['Python', 'Java', 'Rede'];
  const insert = db.prepare('INSERT OR IGNORE INTO languages (name) VALUES (?)');
  names.forEach((name) => insert.run(name));
}

function getLevelsForLanguage(languageId, userId, classId = null) {
  const db = getDb();
  const levels = classId
    ? db
        .prepare(
          'SELECT id, order_index, title, module_name, module_index, is_main FROM levels WHERE language_id = ? AND class_id = ? ORDER BY order_index'
        )
        .all(languageId, classId)
    : db
        .prepare(
          'SELECT id, order_index, title, module_name, module_index, is_main FROM levels WHERE language_id = ? AND class_id IS NULL ORDER BY order_index'
        )
        .all(languageId);

  if (levels.length === 0) {
    return [];
  }

  if (!userId) {
    return levels.map((level, index) => ({
      ...level,
      status: index === 0 ? 'available' : 'locked',
      best_time_ms: null
    }));
  }

  const progressRows = db
    .prepare(
      'SELECT level_id, best_time_ms, completed_at FROM user_level_progress WHERE user_id = ? AND level_id IN (' +
        levels.map(() => '?').join(',') +
        ')'
    )
    .all(userId, ...levels.map((level) => level.id));

  const progressByLevel = new Map(progressRows.map((row) => [row.level_id, row]));

  const mainByModule = new Map();
  levels.forEach((level) => {
    if (level.is_main) {
      mainByModule.set(level.module_index, level.id);
    }
  });

  const mainCompleted = new Map();
  mainByModule.forEach((mainId, moduleIndex) => {
    const progress = progressByLevel.get(mainId);
    mainCompleted.set(moduleIndex, Boolean(progress && progress.completed_at));
  });

  return levels.map((level) => {
    const progress = progressByLevel.get(level.id);
    const completed = Boolean(progress && progress.completed_at);
    let status = 'locked';

    if (completed) {
      status = 'completed';
    } else if (level.is_main) {
      const previousCompleted = level.module_index <= 1
        ? true
        : Boolean(mainCompleted.get(level.module_index - 1));
      status = previousCompleted ? 'available' : 'locked';
    } else {
      const mainDone = Boolean(mainCompleted.get(level.module_index));
      status = mainDone ? 'available' : 'locked';
    }

    return {
      ...level,
      status,
      best_time_ms: progress ? progress.best_time_ms : null
    };
  });
}

function getLevel(levelId) {
  const db = getDb();
  return db
    .prepare(
      'SELECT id, language_id, order_index, title, theory_md, example_md, quiz_json, challenge_json, correction_config_json, class_id, module_name, module_index, is_main, allow_quiz, allow_terminal FROM levels WHERE id = ?'
    )
    .get(levelId);
}

function isLevelUnlocked(levelId, userId) {
  const db = getDb();
  const level = db
    .prepare('SELECT id, language_id, order_index, module_index, is_main, class_id FROM levels WHERE id = ?')
    .get(levelId);
  if (!level) {
    return { allowed: false, reason: 'Level not found' };
  }

  if (level.class_id) {
    const membership = db
      .prepare('SELECT 1 FROM class_memberships WHERE user_id = ? AND class_id = ?')
      .get(userId, level.class_id);
    if (!membership) {
      return { allowed: false, reason: 'Class access required', level };
    }
  }
  if (level.order_index === 1) {
    return { allowed: true, level };
  }

  if (level.module_index === null || level.module_index === undefined) {
    const previous = db
      .prepare(
        'SELECT id FROM levels WHERE language_id = ? AND order_index = ?'
      )
      .get(level.language_id, level.order_index - 1);

    if (!previous) {
      return { allowed: true, level };
    }

    const progress = db
      .prepare(
        'SELECT completed_at FROM user_level_progress WHERE user_id = ? AND level_id = ?'
      )
      .get(userId, previous.id);

    if (!progress || !progress.completed_at) {
      return { allowed: false, reason: 'Previous level not completed', level };
    }

    return { allowed: true, level };
  }

  if (level.is_main) {
    if (level.module_index <= 1) {
      return { allowed: true, level };
    }
    const previousMain = db
      .prepare(
        'SELECT id FROM levels WHERE language_id = ? AND is_main = 1 AND module_index = ?'
      )
      .get(level.language_id, level.module_index - 1);

    if (!previousMain) {
      return { allowed: true, level };
    }

    const progress = db
      .prepare(
        'SELECT completed_at FROM user_level_progress WHERE user_id = ? AND level_id = ?'
      )
      .get(userId, previousMain.id);

    if (!progress || !progress.completed_at) {
      return { allowed: false, reason: 'Previous main level not completed', level };
    }

    return { allowed: true, level };
  }

  const main = db
    .prepare(
      'SELECT id FROM levels WHERE language_id = ? AND is_main = 1 AND module_index = ?'
    )
    .get(level.language_id, level.module_index);

  if (!main) {
    return { allowed: true, level };
  }

  const progress = db
    .prepare(
      'SELECT completed_at FROM user_level_progress WHERE user_id = ? AND level_id = ?'
    )
    .get(userId, main.id);

  if (!progress || !progress.completed_at) {
    return { allowed: false, reason: 'Main level not completed', level };
  }

  return { allowed: true, level };
}

module.exports = { getLanguages, ensureLanguages, getLevelsForLanguage, getLevel, isLevelUnlocked };

