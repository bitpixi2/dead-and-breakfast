CREATE TABLE IF NOT EXISTS game_completions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wallet_address TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  coins INTEGER NOT NULL DEFAULT 0,
  served INTEGER NOT NULL DEFAULT 0,
  missed INTEGER NOT NULL DEFAULT 0,
  completed_days INTEGER NOT NULL DEFAULT 7,
  completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_game_completions_completed_at
  ON game_completions (completed_at DESC);

CREATE INDEX IF NOT EXISTS idx_game_completions_wallet_address
  ON game_completions (wallet_address);
