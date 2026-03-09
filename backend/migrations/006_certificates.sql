ALTER TABLE users ADD COLUMN full_name TEXT;
ALTER TABLE users ADD COLUMN document_id TEXT;
ALTER TABLE users ADD COLUMN birth_date TEXT;

CREATE TABLE IF NOT EXISTS certificate_tracks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  total_hours INTEGER NOT NULL,
  price_cents INTEGER NOT NULL DEFAULT 0,
  location_text TEXT NOT NULL DEFAULT 'Cruz das Almas',
  final_activity_title TEXT NOT NULL,
  final_activity_instructions TEXT NOT NULL,
  program_json TEXT NOT NULL DEFAULT '[]',
  signers_json TEXT NOT NULL DEFAULT '[]',
  preview_watermark TEXT NOT NULL DEFAULT 'PREVIA NAO VALIDA',
  active INTEGER NOT NULL DEFAULT 1,
  created_by_user_id INTEGER,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  FOREIGN KEY(created_by_user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS certificate_submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  submission_text TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(certificate_id, user_id),
  FOREIGN KEY(certificate_id) REFERENCES certificate_tracks(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS certificate_orders (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  certificate_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  amount_cents INTEGER NOT NULL,
  verification_code TEXT UNIQUE,
  paid_at TEXT,
  issued_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT,
  UNIQUE(certificate_id, user_id),
  FOREIGN KEY(certificate_id) REFERENCES certificate_tracks(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_certificate_tracks_active ON certificate_tracks(active);
CREATE INDEX IF NOT EXISTS idx_certificate_submissions_user ON certificate_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_certificate_orders_user_status ON certificate_orders(user_id, status);
