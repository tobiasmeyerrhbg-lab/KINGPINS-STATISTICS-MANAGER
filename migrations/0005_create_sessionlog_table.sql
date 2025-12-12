-- SessionLog: Append-only transaction log for all session events
-- System codes:
--   1 = Player added
--   2 = Title winner (reserved)
--   5 = Multiplier changed
--   6 = Reward deduction
--   8 = Positive commit (+ button)
--   9 = Negative commit (- button, not an undo - regular commit with negative delta)
--   11-14 = Finalization evaluation logs
--
-- system=8 and system=9 are both regular commits with opposite signs.
-- There is no undo/reversal logic; system=9 is simply a negative delta.

CREATE TABLE IF NOT EXISTS SessionLog (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  timestamp TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  clubId TEXT NOT NULL,
  memberId TEXT,
  penaltyId TEXT,
  system INTEGER NOT NULL,
  amountSelf REAL,
  amountOther REAL,
  amountTotal REAL,
  multiplier INTEGER,
  note TEXT,
  extra TEXT,

  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (clubId) REFERENCES Club(id),
  FOREIGN KEY (memberId) REFERENCES Member(id),
  FOREIGN KEY (penaltyId) REFERENCES Penalty(id)
);

CREATE INDEX idx_sessionlog_session ON SessionLog(sessionId);
CREATE INDEX idx_sessionlog_system ON SessionLog(system);
CREATE INDEX idx_sessionlog_timestamp ON SessionLog(timestamp);