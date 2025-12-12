-- Add timezone field to Club table
-- Format: IANA timezone identifier (e.g., "America/New_York", "Europe/Berlin")
-- Optional field, defaults to NULL (system default)
-- This timezone is used for session display formatting only
-- Existing sessions are NOT retroactively reformatted

ALTER TABLE Club ADD COLUMN timezone TEXT;
