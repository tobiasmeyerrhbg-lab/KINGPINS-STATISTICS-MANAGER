/**
 * Session Service
 * 
 * Manages Session lifecycle: start, active commits, finalization
 * All operations follow SESSION-GUIDE.md specifications
 * 
 * Rules:
 * - Session.status: "active" or "finished" (two-state lifecycle)
 * - Session.multiplier stored in database, updated immediately
 * - Session.totalAmounts mutable during active, immutable after finalization
 * - locked=true after finalization (permanent, cannot reopen)
 * - Negative amounts allowed (debt tracking)
 * - Multiple concurrent sessions allowed per club
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

export interface Session {
  id: string;
  clubId: string;
  date: string;
  startTime: string;
  endTime?: string;
  playingTimeSeconds?: number;
  playerCount: number;
  multiplier: number;
  status: 'active' | 'finished';
  locked: boolean;
  notes?: string;
  winners?: Record<string, string[]>; // { penaltyId: [memberIds] }
  activePlayers: string[]; // memberIds
  totalAmounts: Record<string, number>; // { memberId: amount }
  createdAt: string;
  updatedAt: string;
}

export interface CreateSessionPayload {
  clubId: string;
  memberIds: string[]; // Selected members for session
  // NEW: allow optional initial multiplier (defaults to 1 per spec)
  initialMultiplier?: number;
}

/**
 * Start a new session
 * Creates Session record and writes system=1 logs for each member
 * 
 * @param payload - Club ID and selected member IDs
 * @returns Created Session
 */
export async function startSession(payload: CreateSessionPayload): Promise<Session> {
  if (!payload.clubId) {
    throw new Error('clubId is required');
  }
  if (!payload.memberIds || payload.memberIds.length === 0) {
    throw new Error('At least one member is required');
  }

  const id = uuidv4();
  const now = new Date().toISOString();
  const date = now.split('T')[0]; // YYYY-MM-DD

  // Initialize totalAmounts: { memberId: 0 }
  const totalAmounts: Record<string, number> = {};
  payload.memberIds.forEach(memberId => {
    totalAmounts[memberId] = 0;
  });

  const session: Session = {
    id,
    clubId: payload.clubId,
    date,
    startTime: now,
    playerCount: payload.memberIds.length,
    multiplier: payload.initialMultiplier && payload.initialMultiplier >= 1 ? payload.initialMultiplier : 1,
    status: 'active',
    locked: false,
    activePlayers: payload.memberIds,
    totalAmounts,
    createdAt: now,
    updatedAt: now,
  };

  try {
    // Insert Session record
    await db.executeSql(
      `INSERT INTO Session (id, clubId, date, startTime, playerCount, multiplier, status, locked, activePlayers, totalAmounts, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        session.id,
        session.clubId,
        session.date,
        session.startTime,
        session.playerCount,
        session.multiplier,
        session.status,
        session.locked ? 1 : 0,
        JSON.stringify(session.activePlayers),
        JSON.stringify(session.totalAmounts),
        session.createdAt,
        session.updatedAt,
      ]
    );

    // Write system=1 logs for each member (player added)
    const { createLog } = await import('./sessionLogService');
    for (const memberId of payload.memberIds) {
      await createLog({
        sessionId: session.id,
        clubId: session.clubId,
        memberId,
        system: 1,
        timestamp: now,
      });
    }

    // NEW: Option A — create zeroed MemberSessionSummary rows at session start
    const { createMemberSessionSummary } = await import('./memberSessionSummaryService');
    for (const memberId of payload.memberIds) {
      await createMemberSessionSummary({
        sessionId: session.id,
        memberId,
        clubId: session.clubId,
        totalAmount: 0,
        totalCommits: 0,
        commitCounts: {},
        playtimeSeconds: 0,
      });
    }

    return session;
  } catch (error) {
    throw new Error(`Failed to start session: ${getErrorMessage(error)}`);
  }
}

/**
 * Get session by ID
 * @param sessionId - Session UUID
 * @returns Session or null
 */
export async function getSession(sessionId: string): Promise<Session | null> {
  if (!sessionId) {
    throw new Error('sessionId is required');
  }

  try {
    const row: any = await db.getFirstAsync(
      'SELECT * FROM Session WHERE id = ?',
      [sessionId]
    );

    if (row) {
      return parseSessionRow(row);
    }

    return null;
  } catch (error) {
    throw new Error(`Failed to get session: ${getErrorMessage(error)}`);
  }
}

/**
 * Get all sessions for a club
 * @param clubId - Club UUID
 * @param status - Optional filter by status
 * @returns Array of sessions sorted by date DESC (latest first)
 */
export async function getSessionsByClub(
  clubId: string,
  status?: 'active' | 'finished'
): Promise<Session[]> {
  if (!clubId) {
    throw new Error('clubId is required');
  }

  try {
    let sql = 'SELECT * FROM Session WHERE clubId = ?';
    const params: any[] = [clubId];

    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }

    // UPDATED: Order by date DESC (latest first) per requirements
    sql += ' ORDER BY date DESC, startTime DESC';

    const rows: any = await db.getAllAsync(sql, params);

    return rows.map((row: any) => parseSessionRow(row));
  } catch (error) {
    throw new Error(`Failed to get sessions: ${getErrorMessage(error)}`);
  }
}

/**
 * Update session multiplier
 * Writes system=5 log and updates Session.multiplier
 * 
 * @param sessionId - Session UUID
 * @param newMultiplier - New multiplier value (≥1)
 * @param maxMultiplier - Club's maxMultiplier setting
 */
export async function updateMultiplier(
  sessionId: string,
  newMultiplier: number,
  maxMultiplier: number
): Promise<void> {
  if (newMultiplier < 1) {
    throw new Error('Multiplier must be ≥ 1');
  }
  if (newMultiplier > maxMultiplier) {
    throw new Error(`Multiplier cannot exceed ${maxMultiplier}`);
  }

  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.status !== 'active') {
    throw new Error('Cannot update multiplier on finished session');
  }

  const now = new Date().toISOString();
  const oldMultiplier = session.multiplier;

  try {
    // Update Session.multiplier
    await db.executeSql(
      'UPDATE Session SET multiplier = ?, updatedAt = ? WHERE id = ?',
      [newMultiplier, now, sessionId]
    );

    // Write system=5 log
    const { createLog } = await import('./sessionLogService');
    await createLog({
      sessionId,
      clubId: session.clubId,
      system: 5,
      timestamp: now,
      note: `Multiplier changed from ${oldMultiplier} to ${newMultiplier}`,
      multiplier: newMultiplier,
    });
  } catch (error) {
    throw new Error(`Failed to update multiplier: ${getErrorMessage(error)}`);
  }
}

/**
 * Update session totalAmounts (internal use during commits)
 * @param sessionId - Session UUID
 * @param totalAmounts - Updated totals map
 */
export async function updateTotalAmounts(
  sessionId: string,
  totalAmounts: Record<string, number>
): Promise<void> {
  const now = new Date().toISOString();

  await db.executeSql(
    'UPDATE Session SET totalAmounts = ?, updatedAt = ? WHERE id = ?',
    [JSON.stringify(totalAmounts), now, sessionId]
  );
}

/**
 * Finalize session
 * Sets status=finished, locked=true, calculates playingTimeSeconds
 * Creates evaluation logs and MemberSessionSummary records
 * 
 * @param sessionId - Session UUID
 * @param winners - Title winners { penaltyId: [winnerId] }
 */
export async function finalizeSession(
  sessionId: string,
  winners: Record<string, string[]>
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.status === 'finished') {
    throw new Error('Session already finalized');
  }

  const now = new Date().toISOString();
  const playingTimeSeconds = Math.floor(
    (new Date(now).getTime() - new Date(session.startTime).getTime()) / 1000
  );

  try {
    // Update session metadata
    await db.executeSql(
      `UPDATE Session 
       SET endTime = ?, playingTimeSeconds = ?, playerCount = ?, status = ?, locked = ?, winners = ?, updatedAt = ? 
       WHERE id = ?`,
      [
        now,
        playingTimeSeconds,
        session.activePlayers.length,
        'finished',
        1,
        JSON.stringify(winners),
        now,
        sessionId,
      ]
    );

    // Create evaluation logs (system=11-14)
    const { createLog } = await import('./sessionLogService');
    const { getCommitSummary } = await import('./sessionLogService');

    const commitSummary = await getCommitSummary(sessionId);

    // system=11: FinalTotals
    await createLog({
      sessionId,
      clubId: session.clubId,
      system: 11,
      timestamp: now,
      extra: JSON.stringify(session.totalAmounts),
    });

    // system=12: CommitSummary
    await createLog({
      sessionId,
      clubId: session.clubId,
      system: 12,
      timestamp: now,
      extra: JSON.stringify(commitSummary),
    });

    // Create/Update MemberSessionSummary records
    const { createMemberSessionSummary, updateMemberSessionSummary } = await import('./memberSessionSummaryService');
    for (const memberId of session.activePlayers) {
      const memberCommits = commitSummary[memberId] || {};
      const totalCommits = Object.values(memberCommits).reduce((sum: number, count) => sum + (count as number), 0);
      const payload = {
        sessionId,
        memberId,
        clubId: session.clubId,
        totalAmount: session.totalAmounts[memberId] || 0,
        totalCommits,
        commitCounts: memberCommits,
        playtimeSeconds: playingTimeSeconds,
      };

      // try update, if no rows affected then create
      const updated = await updateMemberSessionSummary(payload);
      if (!updated) {
        await createMemberSessionSummary(payload);
      }
    }

    // Create Ledger entries: ONE per active member with final totalAmount
    // Ledger represents final session totals, not individual commits/rewards
    const { createLedgerEntry } = await import('./ledgerService');
    for (const memberId of session.activePlayers) {
      const finalAmount = session.totalAmounts[memberId] || 0;
      await createLedgerEntry({
        type: 'session',
        sessionId,
        memberId,
        clubId: session.clubId,
        amount: finalAmount,
        timestamp: now,
        note: `Final session total`,
      });
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to finalize session: ${msg}`);
  }
}

/**
 * Parse database row to Session object
 */
function parseSessionRow(row: any): Session {
  return {
    id: row.id,
    clubId: row.clubId,
    date: row.date,
    startTime: row.startTime,
    endTime: row.endTime || undefined,
    playingTimeSeconds: row.playingTimeSeconds || undefined,
    playerCount: row.playerCount,
    multiplier: row.multiplier,
    status: row.status,
    locked: row.locked === 1,
    notes: row.notes || undefined,
    winners: row.winners ? JSON.parse(row.winners) : undefined,
    activePlayers: JSON.parse(row.activePlayers),
    totalAmounts: JSON.parse(row.totalAmounts),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}