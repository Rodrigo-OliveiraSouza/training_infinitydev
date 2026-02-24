CREATE TABLE IF NOT EXISTS classes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  owner_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY(owner_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS class_memberships (
  user_id INTEGER NOT NULL,
  class_id INTEGER NOT NULL,
  role TEXT NOT NULL DEFAULT 'student',
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, class_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(class_id) REFERENCES classes(id) ON DELETE CASCADE
);

ALTER TABLE levels ADD COLUMN class_id INTEGER;
ALTER TABLE levels ADD COLUMN owner_user_id INTEGER;
ALTER TABLE levels ADD COLUMN allow_quiz INTEGER NOT NULL DEFAULT 1;
ALTER TABLE levels ADD COLUMN allow_terminal INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_classes_owner ON classes(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_class_memberships_class ON class_memberships(class_id);
CREATE INDEX IF NOT EXISTS idx_levels_class ON levels(class_id);
