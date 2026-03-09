ALTER TABLE users ADD COLUMN single_reset_coupons INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS user_level_reward_claims (
  user_id INTEGER NOT NULL,
  level_id INTEGER NOT NULL,
  claimed_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, level_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(level_id) REFERENCES levels(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_level_reward_claims_user
  ON user_level_reward_claims(user_id);

INSERT OR IGNORE INTO user_level_reward_claims (user_id, level_id, claimed_at)
SELECT user_id, level_id, COALESCE(completed_at, created_at, datetime('now'))
FROM user_level_progress
WHERE completed_at IS NOT NULL;

INSERT OR IGNORE INTO reward_items (key, name, type, cost, value)
VALUES ('coupon-reset-one', 'Cupom Reset de Questao', 'coupon', 20, 'single-reset');
