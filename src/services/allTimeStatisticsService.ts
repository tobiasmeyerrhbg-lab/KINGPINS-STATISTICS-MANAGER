/**
 * All-Time Statistics Service
 * 
 * Aggregates SessionLog and Session data for club-level and player-level all-time statistics.
 * 
 * Data Sources:
 * - Club-Level Total Amount: SUM(system=11 logs) for all members/sessions
 * - Club-Level Playtime: SUM(session.endTime - session.startTime) for all finished sessions
 * - Commits per Penalty: SUM(system=12 logs count) per penaltyId
 * - Top Winners: Member with most commits per penaltyId (from system=12 logs)
 * - Commit Matrix: member × penalty grid (from system=12 logs)
 * 
 * - Member Total Amount: SUM(system=11 logs) per member
 * - Member Playtime: SUM(system=15 logs playtime) per member
 * - Member Attendance: COUNT(DISTINCT sessionId) where member participated
 */

import { db } from '../database/db';

export interface ClubLevelStats {
  clubId: string;
  currency?: string;
  totalAmount: number;
  totalPlaytime: number; // in seconds
  commitsByPenalty: Array<{ penaltyId: string; penaltyName: string; totalCommits: number }>;
  topWinnersByPenalty: Array<{ 
    penaltyId: string; 
    penaltyName: string; 
    winners: Array<{ memberId: string; memberName: string; winCount: number }> 
  }>;
  commitMatrix: Array<{
    memberId: string;
    memberName: string;
    photoUri?: string;
    commitsByPenalty: Record<string, number>; // penaltyId -> count
  }>;
}

export interface MemberStats {
  memberId: string;
  memberName: string;
  photoUri?: string;
  totalAmount: number;
  totalPlaytime: number; // in seconds
  attendanceSessions: number;
  attendancePercentage: number; // 0-100
}

/**
 * Get club-level all-time statistics
 * @param clubId - Club UUID
 * @returns Club-level statistics with all aggregations
 */
export async function getClubLevelStats(clubId: string): Promise<ClubLevelStats> {
  try {
    // Get club info for currency
    const clubRow: any = await db.getFirstAsync(
      'SELECT currency FROM Club WHERE id = ?',
      [clubId]
    );
    const currency = clubRow?.currency || '$';

    // Get all finished sessions for playtime calculation and win counting
    const sessionsData = await db.getAllAsync(
      `SELECT id, startTime, endTime, winners FROM Session WHERE clubId = ? AND status = 'finished'`,
      [clubId]
    );

    // Calculate total playtime from sessions
    let totalPlaytime = 0;
    sessionsData.forEach((row: any) => {
      const start = new Date(row.startTime).getTime();
      const end = new Date(row.endTime || row.startTime).getTime();
      const duration = Math.floor((end - start) / 1000);
      totalPlaytime += duration;
    });

    // Count wins per penalty per member from Session.winners field
    const winCountsByPenalty: Record<string, Record<string, number>> = {}; // penaltyId -> memberId -> win count

    for (const sessionRow of sessionsData as any[]) {
      if (sessionRow.winners) {
        try {
          const winnersData = JSON.parse(sessionRow.winners);
          // winnersData format: { penaltyId: [winnerId] } or { penaltyId: winnerId }
          for (const [penaltyId, winnerValue] of Object.entries(winnersData)) {
            // Handle both array and string formats
            const winnerIds = Array.isArray(winnerValue) ? winnerValue : [winnerValue];
            for (const winnerId of winnerIds as string[]) {
              if (!winCountsByPenalty[penaltyId]) {
                winCountsByPenalty[penaltyId] = {};
              }
              winCountsByPenalty[penaltyId][winnerId] = (winCountsByPenalty[penaltyId][winnerId] || 0) + 1;
            }
          }
        } catch (e) {
          console.error('Failed to parse winners for session:', sessionRow.id, e);
        }
      }
    }

    // Get all SessionLogs for this club
    const logsData = await db.getAllAsync(
      `SELECT * FROM SessionLog WHERE clubId = ? ORDER BY timestamp ASC`,
      [clubId]
    );

    const parsedLogs = logsData.map((row: any) => ({
      id: row.id,
      timestamp: row.timestamp,
      sessionId: row.sessionId,
      clubId: row.clubId,
      memberId: row.memberId || undefined,
      penaltyId: row.penaltyId || undefined,
      system: row.system,
      amountTotal: row.amountTotal || undefined,
      extra: row.extra ? JSON.parse(row.extra) : undefined,
    }));

    console.log('Total SessionLogs found:', parsedLogs.length);
    console.log('System codes distribution:', {
      system11: parsedLogs.filter(l => l.system === 11).length,
      system12: parsedLogs.filter(l => l.system === 12).length,
      system15: parsedLogs.filter(l => l.system === 15).length,
    });

    // Log sample data
    const sys11Sample = parsedLogs.find(l => l.system === 11);
    if (sys11Sample) {
      console.log('System=11 sample:', sys11Sample);
    }

    const sys12Sample = parsedLogs.find(l => l.system === 12);
    if (sys12Sample) {
      console.log('System=12 sample:', sys12Sample);
    }

    // Aggregate data
    let totalAmount = 0;
    const commitsByPenaltyMap: Record<string, number> = {};
    const memberCommitsByPenalty: Record<string, Record<string, number>> = {}; // memberId -> penaltyId -> count

    // Process logs
    for (const log of parsedLogs) {
      // System=11: Final amounts per session (stored as { memberId: amount } in extra)
      if (log.system === 11 && log.extra) {
        const finalTotals = log.extra; // { memberId: amount }
        for (const [memberId, amount] of Object.entries(finalTotals)) {
          totalAmount += Number(amount) || 0;
          console.log('System=11 log member amount:', { memberId, amount, runningTotal: totalAmount });
        }
      }

      // System=12: Commit summary per session (stored as { memberId: { penaltyId: count } } in extra)
      if (log.system === 12 && log.extra) {
        const commitSummary = log.extra; // { memberId: { penaltyId: count } }
        for (const [memberId, penaltyCommits] of Object.entries(commitSummary)) {
          const penalties = penaltyCommits as Record<string, number>;
          for (const [penaltyId, count] of Object.entries(penalties)) {
            console.log('System=12 log member penalty:', { memberId, penaltyId, count });
            
            // Commits by penalty
            commitsByPenaltyMap[penaltyId] = (commitsByPenaltyMap[penaltyId] || 0) + count;

            // Commit matrix (member x penalty)
            if (!memberCommitsByPenalty[memberId]) {
              memberCommitsByPenalty[memberId] = {};
            }
            memberCommitsByPenalty[memberId][penaltyId] = 
              (memberCommitsByPenalty[memberId][penaltyId] || 0) + count;
          }
        }
      }
    }

    console.log('Aggregated data - Total Amount:', totalAmount, 'Commits by Penalty:', commitsByPenaltyMap);

    // Build commits by penalty array
    const commitsByPenalty = await Promise.all(
      Object.entries(commitsByPenaltyMap).map(async ([penaltyId, count]) => {
        const penaltyRow: any = await db.getFirstAsync(
          'SELECT name FROM Penalty WHERE id = ?',
          [penaltyId]
        );
        return {
          penaltyId,
          penaltyName: penaltyRow?.name || 'Unknown',
          totalCommits: count,
        };
      })
    );

    // Build top winners by penalty (from Session.winners field)
    const topWinnersByPenalty = await Promise.all(
      Object.entries(winCountsByPenalty).map(async ([penaltyId, memberWins]) => {
        const penaltyRow: any = await db.getFirstAsync(
          'SELECT name, isTitle FROM Penalty WHERE id = ?',
          [penaltyId]
        );

        // Get top 3 winners for this penalty
        const sortedWinners = Object.entries(memberWins)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3);

        const winners = await Promise.all(
          sortedWinners.map(async ([memberId, winCount]) => {
            const memberRow: any = await db.getFirstAsync(
              'SELECT name FROM Member WHERE id = ?',
              [memberId]
            );
            return {
              memberId,
              memberName: memberRow?.name || 'Unknown',
              winCount,
            };
          })
        );

        return {
          penaltyId,
          penaltyName: penaltyRow?.name || 'Unknown',
          winners,
        };
      })
    );

    // Build commit matrix
    const commitMatrix = await Promise.all(
      Object.entries(memberCommitsByPenalty).map(async ([memberId, penaltyCommits]) => {
        const memberRow: any = await db.getFirstAsync(
          'SELECT name, photoUri FROM Member WHERE id = ?',
          [memberId]
        );
        return {
          memberId,
          memberName: memberRow?.name || 'Unknown',
          photoUri: memberRow?.photoUri || undefined,
          commitsByPenalty: penaltyCommits,
        };
      })
    );

    return {
      clubId,
      currency,
      totalAmount,
      totalPlaytime,
      commitsByPenalty,
      topWinnersByPenalty,
      commitMatrix,
    };
  } catch (error) {
    throw new Error(`Failed to get club-level stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Get member-level all-time statistics
 * @param clubId - Club UUID
 * @returns Array of member statistics
 */
export async function getMemberLevelStats(clubId: string): Promise<MemberStats[]> {
  try {
    // Get club info for currency
    const clubRow: any = await db.getFirstAsync(
      'SELECT currency FROM Club WHERE id = ?',
      [clubId]
    );

    // Get all SessionLogs for this club
    const logsData = await db.getAllAsync(
      `SELECT * FROM SessionLog WHERE clubId = ? ORDER BY timestamp ASC`,
      [clubId]
    );

    const parsedLogs = logsData.map((row: any) => ({
      memberId: row.memberId || undefined,
      system: row.system,
      sessionId: row.sessionId,
      amountTotal: row.amountTotal || undefined,
      extra: row.extra ? JSON.parse(row.extra) : undefined,
    }));

    // Aggregate per member
    const memberStats: Record<string, {
      memberId: string;
      totalAmount: number;
      totalPlaytime: number;
      sessionIds: Set<string>;
    }> = {};

    for (const log of parsedLogs) {
      // System=11: Final amounts per session (stored as { memberId: amount } in extra)
      if (log.system === 11 && log.extra) {
        const finalTotals = log.extra; // { memberId: amount }
        for (const [memberId, amount] of Object.entries(finalTotals)) {
          if (!memberStats[memberId]) {
            memberStats[memberId] = {
              memberId,
              totalAmount: 0,
              totalPlaytime: 0,
              sessionIds: new Set(),
            };
          }
          memberStats[memberId].totalAmount += Number(amount) || 0;
          memberStats[memberId].sessionIds.add(log.sessionId);
        }
      }

      // System=15: Sum playtime (this has individual memberId)
      if (log.system === 15 && log.memberId && log.extra?.playtime) {
        if (!memberStats[log.memberId]) {
          memberStats[log.memberId] = {
            memberId: log.memberId,
            totalAmount: 0,
            totalPlaytime: 0,
            sessionIds: new Set(),
          };
        }
        memberStats[log.memberId].totalPlaytime += log.extra.playtime;
        memberStats[log.memberId].sessionIds.add(log.sessionId);
      }
    }

    // Compute club total playtime from finished sessions for attendance percentage based on playtime
    const sessionsData: any[] = await db.getAllAsync(
      `SELECT id, startTime, endTime FROM Session WHERE clubId = ? AND status = 'finished'`,
      [clubId]
    );
    let clubTotalPlaytime = 0;
    for (const row of sessionsData) {
      const start = new Date(row.startTime).getTime();
      const end = new Date(row.endTime || row.startTime).getTime();
      const duration = Math.floor((end - start) / 1000);
      clubTotalPlaytime += duration;
    }

    // Build result with member names
    const result: MemberStats[] = await Promise.all(
      Object.entries(memberStats).map(async ([memberId, stats]) => {
        const memberRow: any = await db.getFirstAsync(
          'SELECT name, photoUri FROM Member WHERE id = ?',
          [memberId]
        );

        const attendanceSessions = stats.sessionIds.size;
        const attendancePercentage = clubTotalPlaytime > 0 ? (stats.totalPlaytime / clubTotalPlaytime) * 100 : 0;

        return {
          memberId,
          memberName: memberRow?.name || 'Unknown',
          photoUri: memberRow?.photoUri || undefined,
          totalAmount: stats.totalAmount,
          totalPlaytime: stats.totalPlaytime,
          attendanceSessions,
          attendancePercentage,
        };
      })
    );

    return result.sort((a, b) => a.memberName.localeCompare(b.memberName));
  } catch (error) {
    throw new Error(`Failed to get member-level stats: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
