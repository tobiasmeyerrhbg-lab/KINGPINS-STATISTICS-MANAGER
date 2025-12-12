CREATE TABLE IF NOT EXISTS Session (
  id TEXT PRIMARY KEY,
  clubId TEXT NOT NULL,
  date TEXT NOT NULL,
  startTime TEXT NOT NULL,
  endTime TEXT,
  playingTimeSeconds INTEGER,
  playerCount INTEGER NOT NULL,
  multiplier INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'finished')),
  locked INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  winners TEXT,
  activePlayers TEXT NOT NULL,
  totalAmounts TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL,

  FOREIGN KEY (clubId) REFERENCES Club(id)
);

CREATE INDEX idx_session_club ON Session(clubId);
CREATE INDEX idx_session_status ON Session(status);
CREATE INDEX idx_session_date ON Session(date DESC);