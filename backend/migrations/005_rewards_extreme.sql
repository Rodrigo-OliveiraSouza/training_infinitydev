ALTER TABLE reward_items ADD COLUMN rarity TEXT NOT NULL DEFAULT 'common';

UPDATE reward_items
SET rarity = CASE
  WHEN cost >= 55 THEN 'epic'
  WHEN cost >= 35 THEN 'rare'
  ELSE 'common'
END;

INSERT OR IGNORE INTO reward_items (key, name, type, cost, value, rarity) VALUES
  ('border-infinity', 'Borda Infinita', 'border', 90, 'border-infinity', 'legendary'),
  ('border-ember', 'Borda Ember', 'border', 70, 'border-ember', 'epic'),
  ('icon-orbit', 'Icone Orbit', 'icon', 65, 'O', 'epic'),
  ('icon-code', 'Icone Code', 'icon', 55, '</>', 'rare'),
  ('badge-legend', 'Selo Lendario', 'badge', 95, 'L', 'legendary'),
  ('badge-cipher', 'Selo Cipher', 'badge', 75, 'C', 'epic');
