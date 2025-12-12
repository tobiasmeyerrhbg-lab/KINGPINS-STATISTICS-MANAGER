CREATE TABLE IF NOT EXISTS Ledger (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('session', 'payment', 'adjustment', 'refund')),
  sessionId TEXT,
  paymentId TEXT,
  memberId TEXT NOT NULL,
  clubId TEXT NOT NULL,
  amount REAL NOT NULL,
  note TEXT,
  createdBy TEXT,
  timestamp TEXT NOT NULL,

  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (memberId) REFERENCES Member(id),
  FOREIGN KEY (clubId) REFERENCES Club(id)
);

CREATE INDEX idx_ledger_member ON Ledger(memberId);
CREATE INDEX idx_ledger_club ON Ledger(clubId);
CREATE INDEX idx_ledger_session ON Ledger(sessionId);
CREATE INDEX idx_ledger_type ON Ledger(type);
CREATE INDEX idx_ledger_timestamp ON Ledger(timestamp DESC);