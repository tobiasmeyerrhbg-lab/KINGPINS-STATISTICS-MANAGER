/**
 * MemberSessionSummary Service
 * 
 * Creates denormalized summary records at session finalization
 */

import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { db } from '../database/db';

export interface MemberSessionSummary {
  id: string;
  sessionId: string;
  memberId: string;
  clubId: string;
  totalAmount: number;
  totalCommits: number;
  commitCounts: Record<string, number>; // { penaltyId: count }
  playtimeSeconds: number;
  createdAt: string;
}

export interface CreateMemberSessionSummaryPayload {
  sessionId: string;
  memberId: string;
  clubId: string;
  totalAmount: number;
  totalCommits: number;
  commitCounts: Record<string, number>;
  playtimeSeconds: number;
}

// NEW: Update payload (same shape as create)
export interface UpdateMemberSessionSummaryPayload extends CreateMemberSessionSummaryPayload {}

export async function getSummariesBySession(sessionId: string): Promise<MemberSessionSummary[]> {
  const rows: any = await db.getAllAsync(
    'SELECT * FROM MemberSessionSummary WHERE sessionId = ? ORDER BY totalAmount DESC',
    [sessionId]
  );

  return rows.map((row: any) => ({
    id: row.id,
    sessionId: row.sessionId,
    memberId: row.memberId,
    clubId: row.clubId,
    totalAmount: row.totalAmount,
    totalCommits: row.totalCommits,
    commitCounts: JSON.parse(row.commitCounts),
    playtimeSeconds: row.playtimeSeconds,
    createdAt: row.createdAt,
  }));
}

/**
 * Create MemberSessionSummary record
 * @param payload - Summary data
 */
export async function createMemberSessionSummary(
  payload: CreateMemberSessionSummaryPayload
): Promise<void> {
  const id = uuidv4();
  const now = new Date().toISOString();

  await db.executeSql(
    `INSERT INTO MemberSessionSummary (id, sessionId, memberId, clubId, totalAmount, totalCommits, commitCounts, playtimeSeconds, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      payload.sessionId,
      payload.memberId,
      payload.clubId,
      payload.totalAmount,
      payload.totalCommits,
      JSON.stringify(payload.commitCounts),
      payload.playtimeSeconds,
      now,
    ]
  );
}

// NEW: Update an existing MemberSessionSummary. Returns true if a row was updated, false otherwise.
export async function updateMemberSessionSummary(
  payload: UpdateMemberSessionSummaryPayload
): Promise<boolean> {
  const now = new Date().toISOString();

  const result: any = await db.executeSql(
    `UPDATE MemberSessionSummary
     SET totalAmount = ?, totalCommits = ?, commitCounts = ?, playtimeSeconds = ?, createdAt = ?
     WHERE sessionId = ? AND memberId = ?`,
    [
      payload.totalAmount,
      payload.totalCommits,
      JSON.stringify(payload.commitCounts),
      payload.playtimeSeconds,
      now,
      payload.sessionId,
      payload.memberId,
    ]
  );

  // expo-sqlite runAsync returns { changes, lastInsertRowId }
  return (result?.changes ?? 0) > 0;
}

/**
 * Get total playing time for a member (aggregate from all sessions)
 * @param memberId - Member UUID
 * @returns Total playtime in seconds
 */
export async function getTotalPlaytimeSeconds(memberId: string): Promise<number> {
  const row: any = await db.getFirstAsync(
    'SELECT SUM(playtimeSeconds) as total FROM MemberSessionSummary WHERE memberId = ?',
    [memberId]
  );

  return row?.total || 0;
}