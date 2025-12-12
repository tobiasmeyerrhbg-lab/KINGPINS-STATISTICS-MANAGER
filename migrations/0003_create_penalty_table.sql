CREATE TABLE IF NOT EXISTS Penalty (
  id TEXT PRIMARY KEY,
  clubId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  amount REAL NOT NULL,            -- SELF amount
  amountOther REAL NOT NULL,       -- OTHER amount
  affect TEXT NOT NULL,            -- SELF / OTHER / BOTH / NONE
  isTitle INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  rewardEnabled INTEGER NOT NULL DEFAULT 0,
  rewardValue REAL,                -- optional override
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,

  FOREIGN KEY (clubId) REFERENCES Club(id)
);
