CREATE TABLE IF NOT EXISTS watchlist_items (
  user_email TEXT NOT NULL,
  symbol TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_email, symbol)
);

CREATE INDEX IF NOT EXISTS idx_watchlist_items_user_created_at
ON watchlist_items (user_email, created_at DESC);
