ALTER TABLE users ADD COLUMN reward_points INTEGER NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN profile_border TEXT;
ALTER TABLE users ADD COLUMN profile_icon TEXT;
ALTER TABLE users ADD COLUMN profile_badge TEXT;
ALTER TABLE users ADD COLUMN intro_seen INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS reward_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  cost INTEGER NOT NULL DEFAULT 0,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS user_reward_items (
  user_id INTEGER NOT NULL,
  reward_id INTEGER NOT NULL,
  purchased_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, reward_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(reward_id) REFERENCES reward_items(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_reward_items_type ON reward_items(type);
CREATE INDEX IF NOT EXISTS idx_user_reward_items_user ON user_reward_items(user_id);

INSERT OR IGNORE INTO reward_items (key, name, type, cost, value) VALUES
  ('border-neon', 'Borda Neon', 'border', 30, 'border-neon'),
  ('border-gold', 'Borda Ouro', 'border', 60, 'border-gold'),
  ('border-ice', 'Borda Gelo', 'border', 45, 'border-ice'),
  ('icon-bolt', 'Icone Raio', 'icon', 25, '⚡'),
  ('icon-dragon', 'Icone Dragao', 'icon', 50, '🐉'),
  ('icon-rocket', 'Icone Foguete', 'icon', 35, '🚀'),
  ('badge-crown', 'Selo Coroa', 'badge', 40, '👑'),
  ('badge-star', 'Selo Estrela', 'badge', 20, '⭐'),
  ('badge-gem', 'Selo Cristal', 'badge', 35, '💎');
