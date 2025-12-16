/**
 * Session Log Service
 * 
 * Manages append-only SessionLog entries.
 * SessionLog is the authoritative record of all session events:
 * - system=1: player added
 * - system=2: title winner (reserved)
 * - system=5: multiplier changed
 * - system=6: reward deduction
 * - system=8: positive commit
 * - system=9: negative commit
 * - system=11: final totals (extra: finalAmounts object)
 * - system=12: commit summary (extra: commitSummary object with counts per penalty)
 * - system=15: member playtime per session (extra: { playtime: seconds })
 * 
 * All operations are append-only. No deletion, no modification.
 * This service DOES NOT handle undo logic — system=9 is a regular commit with negative delta.
 */

import { db } from '../database/db';

export interface SessionLog {
  id: number;
  timestamp: string;
  sessionId: string;
  clubId: string;
  memberId?: string;
  penaltyId?: string;
  system: number;
  amountSelf?: number;
  amountOther?: number;
  amountTotal?: number;
  multiplier?: number;
  note?: string;
  extra?: any; // Parsed JSON
}

export interface CreateLogPayload {
  timestamp: string;
  sessionId: string;
  clubId: string;
  memberId?: string;
  penaltyId?: string;
  system: number;
  amountSelf?: number;
  amountOther?: number;
  amountTotal?: number;
  multiplier?: number;
  note?: string;
  extra?: any;
}

/**
 * Create a new session log entry (append-only)
 * @param payload - Log entry data
 */
export async function createLog(payload: CreateLogPayload): Promise<void> {
  try {
    await db.executeSql(
      `INSERT INTO SessionLog (timestamp, sessionId, clubId, memberId, penaltyId, system, amountSelf, amountOther, amountTotal, multiplier, note, extra) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        payload.timestamp,
        payload.sessionId,
        payload.clubId,
        payload.memberId || null,
        payload.penaltyId || null,
        payload.system,
        payload.amountSelf !== undefined ? payload.amountSelf : null,
        payload.amountOther !== undefined ? payload.amountOther : null,
        payload.amountTotal !== undefined ? payload.amountTotal : null,
        payload.multiplier || null,
        payload.note || null,
        payload.extra ? JSON.stringify(payload.extra) : null,
      ]
    );
  } catch (error) {
    throw new Error(`Failed to create log: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get all logs for a session
 * @param sessionId - Session UUID
 * @returns Array of session logs in order
 */
export async function getLogsBySession(sessionId: string): Promise<SessionLog[]> {
  try {
    const rows: any = await db.getAllAsync(
      'SELECT * FROM SessionLog WHERE sessionId = ? ORDER BY timestamp ASC',
      [sessionId]
    );

    return rows.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      sessionId: row.sessionId,
      clubId: row.clubId,
      memberId: row.memberId || undefined,
      penaltyId: row.penaltyId || undefined,
      system: row.system,
      amountSelf: row.amountSelf || undefined,
      amountOther: row.amountOther || undefined,
      amountTotal: row.amountTotal || undefined,
      multiplier: row.multiplier || undefined,
      note: row.note || undefined,
      extra: row.extra ? JSON.parse(row.extra) : undefined,
    }));
  } catch (error) {
    throw new Error(`Failed to get logs: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate commit summary: count of commits per member-penalty pair
 * Sums system=8 commits (+1) and system=9 negative commits (-1)
 * Formula: totalCommits = COUNT(system=8) - COUNT(system=9) per member-penalty
 * 
 * @param sessionId - Session UUID
 * @returns Object: { memberId: { penaltyId: netCount } }
 */
export async function getCommitSummary(
  sessionId: string
): Promise<Record<string, Record<string, number>>> {
  try {
    const logs = await getLogsBySession(sessionId);
    const summary: Record<string, Record<string, number>> = {};

    for (const log of logs) {
      if ((log.system === 8 || log.system === 9) && log.memberId && log.penaltyId) {
        if (!summary[log.memberId]) {
          summary[log.memberId] = {};
        }
        if (!summary[log.memberId][log.penaltyId]) {
          summary[log.memberId][log.penaltyId] = 0;
        }

        // system=8: +1, system=9: -1
        if (log.system === 8) {
          summary[log.memberId][log.penaltyId] += 1;
        } else if (log.system === 9) {
          summary[log.memberId][log.penaltyId] -= 1;
        }
      }
    }

    return summary;
  } catch (error) {
    throw new Error(`Failed to calculate commit summary: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Calculate commit summary with multiplier groups
 * Returns total count and breakdown by multiplier
 * 
 * @param sessionId - Session UUID
 * @returns Object: { memberId: { penaltyId: { total, byMultiplier: { '2': 1, '4': 2 } } } }
 */
export async function getCommitSummaryWithMultipliers(
  sessionId: string
): Promise<Record<string, Record<string, { total: number; byMultiplier: Record<number, number> }>>> {
  try {
    const logs = await getLogsBySession(sessionId);
    const summary: Record<string, Record<string, { total: number; byMultiplier: Record<number, number> }>> = {};

    for (const log of logs) {
      if ((log.system === 8 || log.system === 9) && log.memberId && log.penaltyId && log.multiplier) {
        if (!summary[log.memberId]) {
          summary[log.memberId] = {};
        }
        if (!summary[log.memberId][log.penaltyId]) {
          summary[log.memberId][log.penaltyId] = { total: 0, byMultiplier: {} };
        }

        const mult = log.multiplier;
        const delta = log.system === 8 ? 1 : -1;

        summary[log.memberId][log.penaltyId].total += delta;
        summary[log.memberId][log.penaltyId].byMultiplier[mult] = 
          (summary[log.memberId][log.penaltyId].byMultiplier[mult] || 0) + delta;
      }
    }

    return summary;
  } catch (error) {
    throw new Error(`Failed to calculate commit summary with multipliers: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

