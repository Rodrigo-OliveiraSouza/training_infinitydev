PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  primary_language_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS languages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS levels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  language_id INTEGER NOT NULL,
  order_index INTEGER NOT NULL,
  title TEXT NOT NULL,
  theory_md TEXT NOT NULL,
  example_md TEXT NOT NULL,
  quiz_json TEXT NOT NULL,
  challenge_json TEXT NOT NULL,
  correction_config_json TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(language_id, order_index),
  FOREIGN KEY(language_id) REFERENCES languages(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  session_id TEXT,
  code TEXT NOT NULL,
  language TEXT NOT NULL,
  status TEXT NOT NULL,
  exec_stdout TEXT,
  exec_stderr TEXT,
  runtime_ms INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(level_id) REFERENCES levels(id)
);

CREATE TABLE IF NOT EXISTS user_level_progress (
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  best_time_ms INTEGER,
  attempts_count INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  PRIMARY KEY(user_id, level_id),
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(level_id) REFERENCES levels(id)
);

CREATE TABLE IF NOT EXISTS level_sessions (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  last_run_at TEXT,
  ended_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id),
  FOREIGN KEY(level_id) REFERENCES levels(id)
);

CREATE INDEX IF NOT EXISTS idx_levels_language_order ON levels(language_id, order_index);
CREATE INDEX IF NOT EXISTS idx_submissions_user_level ON submissions(user_id, level_id);
CREATE INDEX IF NOT EXISTS idx_progress_user ON user_level_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_progress_level ON user_level_progress(level_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON level_sessions(user_id);

