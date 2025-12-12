/**
 * Session Verification Service
 * 
 * Handles system=99 log: verification of Session.totalAmounts
 * Recalculates totals from scratch respecting member join times
 */

import { getSession } from './sessionService';
import { getLogsBySession, createLog } from './sessionLogService';
import { getPenaltiesByClub } from './penaltyService';
import { getMembersByClub } from './memberService';

export interface VerificationResult {
  passed: boolean;
  memberId: string;
  memberName: string;
  storedTotal: number;
  calculatedTotal: number;
  match: boolean;
}

/**
 * Verify Session.totalAmounts by recalculating from logs
 * Writes system=99 log with verification results
 * 
 * @param sessionId - Session UUID
 * @param clubId - Club UUID
 * @returns Array of verification results per member
 */
export async function verifySessionTotals(
  sessionId: string,
  clubId: string
): Promise<VerificationResult[]> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }

  const [logs, penalties, members] = await Promise.all([
    getLogsBySession(sessionId),
    getPenaltiesByClub(clubId),
    getMembersByClub(clubId),
  ]);

  const activePenalties = penalties.filter(p => p.active);
  const activeMemberIds = new Set(session.activePlayers || []);
  const activeMembersList = members.filter(m => activeMemberIds.has(m.id));

  // Build member join times from system=1 logs
  const memberJoinTimes: Record<string, string> = {};
  for (const log of logs) {
    if (log.system === 1 && log.memberId && !memberJoinTimes[log.memberId]) {
      memberJoinTimes[log.memberId] = log.timestamp;
    }
  }

  // Recalculate totals from scratch
  const calculatedTotals: Record<string, number> = {};
  for (const member of activeMembersList) {
    calculatedTotals[member.id] = 0;
  }

  // Replay all commit and system=6 logs (rewards)
  let lastMultiplier = 1;
  for (const log of logs) {
    if (log.system === 5) {
      // Multiplier change
      lastMultiplier = log.multiplier || 1;
    } else if (log.system === 8 || log.system === 9) {
      // Commit event
      if (log.memberId && log.penaltyId) {
        const penalty = activePenalties.find(p => p.id === log.penaltyId);
        if (!penalty) continue;

        const delta = log.system === 8 ? 1 : -1;
        const multiplier = log.multiplier || lastMultiplier;
        const amountSelf = penalty.amount * multiplier;
        const amountOther = penalty.amountOther * multiplier;

        // Apply based on affect type
        if (penalty.affect === 'SELF') {
          if (calculatedTotals[log.memberId] !== undefined) {
            calculatedTotals[log.memberId] += delta * amountSelf;
          }
        } else if (penalty.affect === 'OTHER') {
          for (const member of activeMembersList) {
            if (member.id !== log.memberId) {
              // Only apply if member had joined before this log
              const memberJoinTime = memberJoinTimes[member.id];
              if (!memberJoinTime || memberJoinTime <= log.timestamp) {
                calculatedTotals[member.id] += delta * amountOther;
              }
            }
          }
        } else if (penalty.affect === 'BOTH') {
          if (calculatedTotals[log.memberId] !== undefined) {
            calculatedTotals[log.memberId] += delta * amountSelf;
          }
          for (const member of activeMembersList) {
            if (member.id !== log.memberId) {
              // Only apply if member had joined before this log
              const memberJoinTime = memberJoinTimes[member.id];
              if (!memberJoinTime || memberJoinTime <= log.timestamp) {
                calculatedTotals[member.id] += delta * amountOther;
              }
            }
          }
        }
        // NONE: no change
      }
    } else if (log.system === 6) {
      // Reward deduction (system=6)
      if (log.memberId) {
        const rewardAmount = Math.abs(log.amountTotal || 0);
        calculatedTotals[log.memberId] = (calculatedTotals[log.memberId] || 0) - rewardAmount;
      }
    }
  }

  // Compare stored vs calculated
  const results: VerificationResult[] = [];
  let allMatch = true;

  for (const member of activeMembersList) {
    const storedTotal = session.totalAmounts?.[member.id] || 0;
    const calculatedTotal = calculatedTotals[member.id] || 0;
    const match = Math.abs(storedTotal - calculatedTotal) < 0.001; // Account for floating point

    if (!match) {
      allMatch = false;
    }

    results.push({
      passed: match,
      memberId: member.id,
      memberName: member.name,
      storedTotal,
      calculatedTotal,
      match,
    });
  }

  // Write system=99 log
  const now = new Date().toISOString();
  const summaryData = {
    verification: results.map(r => ({
      memberName: r.memberName,
      storedTotal: r.storedTotal,
      calculatedTotal: r.calculatedTotal,
      match: r.match,
    })),
    allMatch,
    timestamp: now,
  };

  await createLog({
    sessionId,
    clubId,
    system: 99,
    timestamp: now,
    extra: summaryData,
    note: allMatch ? 'All totals verified successfully' : 'Verification failed: mismatches found',
  });

  return results;
}
