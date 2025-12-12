CREATE TABLE IF NOT EXISTS Member (
  id TEXT PRIMARY KEY,
  clubId TEXT NOT NULL,
  name TEXT NOT NULL,
  isGuest INTEGER NOT NULL DEFAULT 0,
  photoUri TEXT,
  paidPenaltyAmount REAL NOT NULL DEFAULT 0,
  joinedAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,
  birthdate TEXT,

  FOREIGN KEY (clubId) REFERENCES Club(id)
);
