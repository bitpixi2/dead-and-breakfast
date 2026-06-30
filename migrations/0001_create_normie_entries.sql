CREATE TABLE IF NOT EXISTS normie_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id INTEGER NOT NULL,
  owner TEXT,
  normie_type TEXT NOT NULL DEFAULT 'Unknown',
  normie_name TEXT NOT NULL DEFAULT '',
  level INTEGER NOT NULL DEFAULT 0,
  action_points INTEGER NOT NULL DEFAULT 0,
  customized INTEGER NOT NULL DEFAULT 0,
  entered_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_normie_entries_entered_at
  ON normie_entries (entered_at DESC);

CREATE INDEX IF NOT EXISTS idx_normie_entries_token_id
  ON normie_entries (token_id);

CREATE INDEX IF NOT EXISTS idx_normie_entries_owner
  ON normie_entries (owner);
