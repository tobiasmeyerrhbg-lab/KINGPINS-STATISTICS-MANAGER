CREATE TABLE IF NOT EXISTS MemberSessionSummary (
  id TEXT PRIMARY KEY,
  sessionId TEXT NOT NULL,
  memberId TEXT NOT NULL,
  clubId TEXT NOT NULL,
  totalAmount REAL NOT NULL,
  totalCommits INTEGER NOT NULL,
  commitCounts TEXT NOT NULL,
  playtimeSeconds INTEGER,
  createdAt TEXT NOT NULL,

  FOREIGN KEY (sessionId) REFERENCES Session(id),
  FOREIGN KEY (memberId) REFERENCES Member(id),
  FOREIGN KEY (clubId) REFERENCES Club(id)
);

CREATE INDEX idx_member_session_summary_session ON MemberSessionSummary(sessionId);
CREATE INDEX idx_member_session_summary_member ON MemberSessionSummary(memberId);
CREATE INDEX idx_member_session_summary_club ON MemberSessionSummary(clubId);