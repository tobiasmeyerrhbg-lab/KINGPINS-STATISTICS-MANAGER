ALTER TABLE Ledger ADD COLUMN sessionId TEXT;
ALTER TABLE Ledger ADD COLUMN paymentId TEXT;
ALTER TABLE Ledger ADD COLUMN clubId TEXT;
ALTER TABLE Ledger ADD COLUMN note TEXT;
ALTER TABLE Ledger ADD COLUMN timestamp TEXT;

UPDATE Ledger SET note = COALESCE(note, description) WHERE note IS NULL AND description IS NOT NULL;
UPDATE Ledger SET timestamp = COALESCE(timestamp, createdAt, datetime('now')) WHERE timestamp IS NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_member ON Ledger(memberId);
CREATE INDEX IF NOT EXISTS idx_ledger_club ON Ledger(clubId);
CREATE INDEX IF NOT EXISTS idx_ledger_session ON Ledger(sessionId);
CREATE INDEX IF NOT EXISTS idx_ledger_type ON Ledger(type);
CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON Ledger(timestamp DESC);
