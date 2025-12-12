/**
 * Database Module
 * 
 * Handles SQLite database initialization and connection
 * Runs all pending migrations on app startup
 */

import * as SQLite from 'expo-sqlite';

let databaseConnection: SQLite.SQLiteDatabase | null = null;

// SQL Migration Scripts (in order of execution)
const MIGRATIONS = [
  // 0001_create_club_table
  `CREATE TABLE IF NOT EXISTS Club (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logoUri TEXT,
    maxMultiplier INTEGER NOT NULL DEFAULT 10,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL
  );`,

  // 0002_create_member_table
  `CREATE TABLE IF NOT EXISTS Member (
    id TEXT PRIMARY KEY,
    clubId TEXT NOT NULL,
    name TEXT NOT NULL,
    isGuest INTEGER NOT NULL DEFAULT 0,
    photoUri TEXT,
    paidPenaltyAmount REAL NOT NULL DEFAULT 0,
    joinedAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    birthdate TEXT,
    FOREIGN KEY (clubId) REFERENCES Club(id) ON DELETE CASCADE
  );`,

  // 0003_create_penalty_table
  `CREATE TABLE IF NOT EXISTS Penalty (
    id TEXT PRIMARY KEY,
    clubId TEXT NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    amount REAL NOT NULL,
    amountOther REAL NOT NULL,
    affect TEXT NOT NULL,
    isTitle INTEGER NOT NULL DEFAULT 0,
    active INTEGER NOT NULL DEFAULT 1,
    rewardEnabled INTEGER NOT NULL DEFAULT 0,
    rewardValue REAL,
    createdAt TEXT NOT NULL,
    updatedAt TEXT NOT NULL,
    FOREIGN KEY (clubId) REFERENCES Club(id) ON DELETE CASCADE
  );`,

  // 0004_create_session_table
  `CREATE TABLE IF NOT EXISTS Session (
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
  CREATE INDEX IF NOT EXISTS idx_session_club ON Session(clubId);
  CREATE INDEX IF NOT EXISTS idx_session_status ON Session(status);
  CREATE INDEX IF NOT EXISTS idx_session_date ON Session(date DESC);`,

  // 0005_create_sessionlog_table
  `CREATE TABLE IF NOT EXISTS SessionLog (
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
  CREATE INDEX IF NOT EXISTS idx_sessionlog_session ON SessionLog(sessionId);
  CREATE INDEX IF NOT EXISTS idx_sessionlog_system ON SessionLog(system);
  CREATE INDEX IF NOT EXISTS idx_sessionlog_timestamp ON SessionLog(timestamp);`,

  // 0006_create_member_session_summary_table
  `CREATE TABLE IF NOT EXISTS MemberSessionSummary (
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
  CREATE INDEX IF NOT EXISTS idx_member_session_summary_session ON MemberSessionSummary(sessionId);
  CREATE INDEX IF NOT EXISTS idx_member_session_summary_member ON MemberSessionSummary(memberId);
  CREATE INDEX IF NOT EXISTS idx_member_session_summary_club ON MemberSessionSummary(clubId);`,

  // 0007_create_ledger_table
  `CREATE TABLE IF NOT EXISTS Ledger (
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
  CREATE INDEX IF NOT EXISTS idx_ledger_member ON Ledger(memberId);
  CREATE INDEX IF NOT EXISTS idx_ledger_club ON Ledger(clubId);
  CREATE INDEX IF NOT EXISTS idx_ledger_session ON Ledger(sessionId);
  CREATE INDEX IF NOT EXISTS idx_ledger_type ON Ledger(type);
  CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON Ledger(timestamp DESC);`,

  // 0008_add_club_timezone
  `ALTER TABLE Club ADD COLUMN timezone TEXT;`,

  // 0009_fix_ledger_schema
  `ALTER TABLE Ledger ADD COLUMN sessionId TEXT;
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
  CREATE INDEX IF NOT EXISTS idx_ledger_timestamp ON Ledger(timestamp DESC);`,

  // 0010_add_currency_timeformat
  `ALTER TABLE Club ADD COLUMN currency TEXT;
  ALTER TABLE Club ADD COLUMN timeFormat TEXT;`,
];

const MIGRATION_NAMES = [
  '0001_create_club_table',
  '0002_create_member_table',
  '0003_create_penalty_table',
  '0004_create_session_table',
  '0005_create_sessionlog_table',
  '0006_create_member_session_summary_table',
  '0007_create_ledger_table',
  '0008_add_club_timezone',
  '0009_fix_ledger_schema',
  '0010_add_currency_timeformat',
];

async function runMigrations(db: SQLite.SQLiteDatabase) {
  console.log('Setting up migrations...');
  
  try {
    // Create migrations tracking table if it doesn't exist
    await db.execAsync(
      `CREATE TABLE IF NOT EXISTS _Migrations (
        id TEXT PRIMARY KEY,
        executedAt TEXT NOT NULL
      );`
    );
    console.log('✓ Migrations tracking table ready');

    // Check which migrations have been run
    const result = await db.getAllAsync('SELECT id FROM _Migrations ORDER BY executedAt ASC');
    const executedMigrations: string[] = result.map((row: any) => row.id);
    
    console.log(`Already executed: ${executedMigrations.length} migrations`);

    // Run each pending migration
    for (let i = 0; i < MIGRATION_NAMES.length; i++) {
      const migrationName = MIGRATION_NAMES[i];
      
      if (executedMigrations.includes(migrationName)) {
        console.log(`⊘ Skipping: ${migrationName}`);
        continue;
      }

      console.log(`▶ Running: ${migrationName}`);
      const sql = MIGRATIONS[i];

      try {
        await db.execAsync(sql);
        console.log(`✓ Executed: ${migrationName}`);
      } catch (error: any) {
        const message = String(error?.message || error);
        // Allow duplicate column error for timezone migration to proceed
        const isDuplicateColumn = message.toLowerCase().includes('duplicate column');
        const allowedDuplicateColumn =
          (migrationName === '0008_add_club_timezone' && isDuplicateColumn) ||
          (migrationName === '0009_fix_ledger_schema' && isDuplicateColumn);

        if (allowedDuplicateColumn) {
          console.warn(`⚠ Migration ${migrationName} already applied (duplicate column), marking as done.`);
        } else {
          console.error(`✗ Failed: ${migrationName}`, error);
          throw error;
        }
      }

      // Record migration as executed (even if duplicate column handled)
      await db.runAsync(
        'INSERT INTO _Migrations (id, executedAt) VALUES (?, ?)',
        [migrationName, new Date().toISOString()]
      );
      console.log(`✓ Recorded: ${migrationName}`);
    }

    console.log('✓ All migrations completed');
  } catch (error) {
    console.error('Migration system error:', error);
    throw error;
  }
}

async function resetDatabase(db: SQLite.SQLiteDatabase) {
  console.log('Resetting database...');
  
  try {
    // Drop all tables
    await db.execAsync(`
      DROP TABLE IF EXISTS Ledger;
      DROP TABLE IF EXISTS MemberSessionSummary;
      DROP TABLE IF EXISTS SessionLog;
      DROP TABLE IF EXISTS Session;
      DROP TABLE IF EXISTS Penalty;
      DROP TABLE IF EXISTS Member;
      DROP TABLE IF EXISTS Club;
      DROP TABLE IF EXISTS _Migrations;
    `);
    
    console.log('✓ All tables dropped');
    
    // Clear migration tracking and run migrations again
    await runMigrations(db);
    
    console.log('✓ Database reset completed');
  } catch (error) {
    console.error('Database reset error:', error);
    throw error;
  }
}

export async function initializeDatabase() {
  console.log('Initializing database...');
  
  try {
    // Open/create database
    const db = await SQLite.openDatabaseAsync('kingpins.db');
    console.log('Database connection opened');
    
    databaseConnection = db;

    // Run migrations
    await runMigrations(db);
    console.log('Database initialized with all migrations');
    
    return db;
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

export const database = {
  executeSql: async (sql: string, params?: any[]) => {
    if (!databaseConnection) {
      throw new Error('Database not initialized');
    }
    try {
      // Use getAllAsync for SELECT queries
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        const result = await databaseConnection.getAllAsync(sql, params || []);
        return { rows: result };
      } else {
        // Use runAsync for write operations - pass params as array directly
        await databaseConnection.runAsync(sql, params || []);
        return { changes: 1 };
      }
    } catch (error) {
      console.error('SQL execution error:', error);
      console.error('Failed SQL:', sql);
      console.error('Params:', params);
      throw error;
    }
  },
  
  getAllAsync: async (sql: string, params?: any[]) => {
    if (!databaseConnection) {
      throw new Error('Database not initialized');
    }
    try {
      return await databaseConnection.getAllAsync(sql, params || []);
    } catch (error) {
      console.error('getAllAsync error:', error);
      console.error('Failed SQL:', sql);
      throw error;
    }
  },
  
  getFirstAsync: async (sql: string, params?: any[]) => {
    if (!databaseConnection) {
      throw new Error('Database not initialized');
    }
    try {
      return await databaseConnection.getFirstAsync(sql, params || []);
    } catch (error) {
      console.error('getFirstAsync error:', error);
      console.error('Failed SQL:', sql);
      throw error;
    }
  },

  reset: async () => {
    if (!databaseConnection) {
      throw new Error('Database not initialized');
    }
    await resetDatabase(databaseConnection);
  },
};

export const db = database;
