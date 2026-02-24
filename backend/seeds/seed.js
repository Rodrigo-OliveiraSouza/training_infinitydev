const { initDb, migrate, getDb } = require('../src/db');
const { buildLevels } = require('./levels');

async function seed() {
  await initDb();
  await migrate();
  const db = getDb();
  const shouldUpdate = process.env.SEED_UPDATE === 'true';

  function seedLanguages() {
    const languages = ['Python', 'Java', 'Rede'];
    const insert = db.prepare('INSERT OR IGNORE INTO languages (name) VALUES (?)');
    languages.forEach((name) => insert.run(name));
  }

  function seedAdminUser() {
    const username = 'adm';
    const email = 'adm@training.infinity.dev';
    const passwordHash = '$2a$10$utnZbNrlML0ldE3btauGmuI9W4KX4y1xktm1C39T82YP3v3lVB/qi';
    const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
    if (!existing) {
      db.prepare(
        'INSERT INTO users (username, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))'
      ).run(username, email, passwordHash, 'admin');
    } else {
      db.prepare('UPDATE users SET role = ? WHERE username = ?').run('admin', username);
    }
  }

  function seedLevels() {
    const languageRows = db.prepare('SELECT id, name FROM languages').all();
    const languageMap = languageRows.reduce((acc, row) => {
      acc[row.name] = row.id;
      return acc;
    }, {});
    const levels = buildLevels(languageMap);
    const existingRows = db
      .prepare('SELECT language_id, order_index FROM levels')
      .all();
    const existing = new Set(
      existingRows.map((row) => `${row.language_id}-${row.order_index}`)
    );
    const pending = levels.filter(
      (level) => !existing.has(`${level.language_id}-${level.order_index}`)
    );
    if (!shouldUpdate && pending.length === 0) {
      console.log('Levels already seeded');
      return;
    }
    const insert = db.prepare(
      `INSERT INTO levels
        (language_id, module_name, module_index, is_main, order_index, title, theory_md, example_md, quiz_json, challenge_json, correction_config_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(language_id, order_index)
       DO UPDATE SET
         module_name = excluded.module_name,
         module_index = excluded.module_index,
         is_main = excluded.is_main,
         title = excluded.title,
         theory_md = excluded.theory_md,
         example_md = excluded.example_md,
         quiz_json = excluded.quiz_json,
         challenge_json = excluded.challenge_json,
         correction_config_json = excluded.correction_config_json,
         updated_at = datetime('now')`
    );

    const transaction = db.transaction((items) => {
      items.forEach((level) => {
        insert.run(
          level.language_id,
          level.module_name,
          level.module_index,
          level.is_main,
          level.order_index,
          level.title,
          level.theory_md,
          level.example_md,
          JSON.stringify(level.quiz_json),
          JSON.stringify(level.challenge_json),
          JSON.stringify(level.correction_config_json)
        );
      });
    });

    const items = shouldUpdate ? levels : pending;
    transaction(items);
    console.log(`Seeded ${items.length} levels`);
  }

  seedLanguages();
  seedAdminUser();
  seedLevels();
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
