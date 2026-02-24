const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const rawDbPath = process.env.DB_PATH;
const dbPath = rawDbPath
  ? path.resolve(process.cwd(), rawDbPath)
  : path.join(__dirname, '..', 'data', 'app.db');

let sqlDb = null;
let dbWrapper = null;
let inTransaction = false;
let pendingSave = false;

function ensureDir() {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
}

function saveDb() {
  if (!sqlDb) return;
  if (inTransaction) {
    pendingSave = true;
    return;
  }
  ensureDir();
  const data = sqlDb.export();
  fs.writeFileSync(dbPath, Buffer.from(data));
}

function normalizeParams(params) {
  if (params.length === 1 && Array.isArray(params[0])) {
    return params[0];
  }
  return params;
}

function prepare(sql) {
  return {
    get: (...params) => {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(normalizeParams(params));
      const row = stmt.step() ? stmt.getAsObject() : undefined;
      stmt.free();
      return row;
    },
    all: (...params) => {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(normalizeParams(params));
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      stmt.free();
      return rows;
    },
    run: (...params) => {
      const stmt = sqlDb.prepare(sql);
      stmt.bind(normalizeParams(params));
      stmt.step();
      stmt.free();
      const changes = sqlDb.getRowsModified();
      const lastRow = sqlDb.exec('SELECT last_insert_rowid() AS id');
      const lastInsertRowid = lastRow && lastRow[0] && lastRow[0].values[0]
        ? lastRow[0].values[0][0]
        : null;
      saveDb();
      return { changes, lastInsertRowid };
    }
  };
}

function exec(sql) {
  sqlDb.exec(sql);
  saveDb();
}

function transaction(fn) {
  return (...args) => {
    if (!sqlDb) {
      throw new Error('Database not initialized');
    }
    inTransaction = true;
    sqlDb.exec('BEGIN');
    try {
      const result = fn(...args);
      sqlDb.exec('COMMIT');
      inTransaction = false;
      if (pendingSave) {
        pendingSave = false;
        saveDb();
      }
      return result;
    } catch (err) {
      sqlDb.exec('ROLLBACK');
      inTransaction = false;
      pendingSave = false;
      saveDb();
      throw err;
    }
  };
}

async function initDb() {
  if (dbWrapper) {
    return dbWrapper;
  }
  const wasmPath = require.resolve('sql.js/dist/sql-wasm.wasm');
  const SQL = await initSqlJs({
    locateFile: () => wasmPath
  });

  if (fs.existsSync(dbPath)) {
    const fileBuffer = fs.readFileSync(dbPath);
    sqlDb = new SQL.Database(fileBuffer);
  } else {
    sqlDb = new SQL.Database();
  }

  sqlDb.exec('PRAGMA foreign_keys = ON;');
  dbWrapper = {
    exec,
    prepare,
    transaction
  };
  return dbWrapper;
}

function getDb() {
  if (!dbWrapper) {
    throw new Error('Database not initialized');
  }
  return dbWrapper;
}

async function migrate() {
  const db = await initDb();
  db.exec(
    "CREATE TABLE IF NOT EXISTS schema_migrations (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, applied_at TEXT NOT NULL DEFAULT (datetime('now')));"
  );
  const migrationsDir = path.join(__dirname, '..', 'migrations');
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  const applied = new Set(
    db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name)
  );

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
    db.exec(sql);
    db.prepare('INSERT INTO schema_migrations (name) VALUES (?)').run(file);
  }
  return db;
}

if (require.main === module) {
  const command = process.argv[2];
  if (command === 'migrate') {
    migrate()
      .then(() => {
        console.log('Migrations applied');
      })
      .catch((err) => {
        console.error(err);
        process.exit(1);
      });
  } else {
    console.log('Unknown command');
  }
}

module.exports = { initDb, getDb, migrate };
