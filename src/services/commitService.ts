/**
 * Commit Service
 * 
 * Handles positive and negative commits during active sessions.
 * System=8: positive commit (+ button) — apply positive delta
 * System=9: negative commit (- button) — apply negative delta
 * 
 * No undo/reversal logic. Both system=8 and system=9 are regular commits with opposite signs.
 * 
 * Calculation rules:
 * - amountSelf = penalty.amount (committed player)
 * - amountOther = penalty.amountOther (affected others)
 * - multiplier = current session.multiplier
 * - applySelf = amountSelf * multiplier
 * - applyOther = amountOther * multiplier
 * - affectedOtherCount = activePlayers - 1 (if affect = OTHER or BOTH)
 * - amountTotal = applySelf (if SELF/BOTH) + applyOther * affectedOtherCount (if OTHER/BOTH)
 * - For system=9: amountTotal is negated
 * 
 * No ledger entries during commits (ledger updated once at finalization).
 */

import { getSession, updateTotalAmounts } from './sessionService';
import { createLog } from './sessionLogService';
import { getPenalty } from './penaltyService';

/**
 * Positive commit: apply positive delta to amounts and counters
 * Creates system=8 log and updates Session.totalAmounts
 * 
 * @param sessionId - Session UUID
 * @param memberId - Member UUID who committed penalty
 * @param penaltyId - Penalty UUID
 */
export async function addCommit(
  sessionId: string,
  memberId: string,
  penaltyId: string
): Promise<void> {
  await commitWithDelta(sessionId, memberId, penaltyId, 8);
}

/**
 * Negative commit: apply negative delta to amounts and counters
 * Creates system=9 log and updates Session.totalAmounts with negated values
 * This is NOT an undo — it is a regular commit with negative delta.
 * 
 * @param sessionId - Session UUID
 * @param memberId - Member UUID
 * @param penaltyId - Penalty UUID
 */
export async function negativeCommit(
  sessionId: string,
  memberId: string,
  penaltyId: string
): Promise<void> {
  await commitWithDelta(sessionId, memberId, penaltyId, 9);
}

/**
 * Internal function to process commits with delta calculation
 * system=8: positive commit, amountTotal is positive
 * system=9: negative commit, amountTotal is negated
 * 
 * @param sessionId - Session UUID
 * @param memberId - Member UUID
 * @param penaltyId - Penalty UUID
 * @param system - 8 (positive) or 9 (negative)
 */
async function commitWithDelta(
  sessionId: string,
  memberId: string,
  penaltyId: string,
  system: 8 | 9
): Promise<void> {
  const session = await getSession(sessionId);
  if (!session) {
    throw new Error('Session not found');
  }
  if (session.status !== 'active') {
    throw new Error('Cannot commit to finished session');
  }

  const penalty = await getPenalty(penaltyId);
  if (!penalty) {
    throw new Error('Penalty not found');
  }

  const now = new Date().toISOString();
  const multiplier = session.multiplier;
  const activePlayers = session.activePlayers;
  const totalAmounts = { ...session.totalAmounts };

  // Determine affected members based on penalty.affect
  let affectedOtherCount = 0;
  const affectedMembers: string[] = [];

  switch (penalty.affect) {
    case 'SELF':
      affectedMembers.push(memberId);
      break;
    case 'OTHER':
      affectedOtherCount = activePlayers.filter(m => m !== memberId).length;
      affectedMembers.push(...activePlayers.filter(m => m !== memberId));
      break;
    case 'BOTH':
      affectedOtherCount = activePlayers.filter(m => m !== memberId).length;
      affectedMembers.push(...activePlayers);
      break;
    case 'NONE':
      // No changes to totalAmounts
      break;
  }

  // Calculate amounts
  const amountSelf = affectedMembers.includes(memberId) ? penalty.amount : 0;
  const amountOther = penalty.amountOther;
  const applySelf = amountSelf * multiplier;
  const applyOther = amountOther * multiplier;

  // Calculate amountTotal based on affect
  let amountTotal = 0;
  if (penalty.affect === 'SELF' || penalty.affect === 'BOTH') {
    amountTotal += applySelf;
  }
  if (penalty.affect === 'OTHER' || penalty.affect === 'BOTH') {
    amountTotal += applyOther * affectedOtherCount;
  }

  // For system=9 (negative commit), negate the delta
  if (system === 9) {
    amountTotal = -amountTotal;
  }

  // Apply delta to totalAmounts
  for (const m of affectedMembers) {
    if (m === memberId) {
      totalAmounts[m] = (totalAmounts[m] || 0) + (applySelf * (system === 8 ? 1 : -1));
    } else {
      totalAmounts[m] = (totalAmounts[m] || 0) + (applyOther * (system === 8 ? 1 : -1));
    }
  }

  // Create log entry with signed amountTotal
  await createLog({
    sessionId,
    clubId: session.clubId,
    memberId,
    penaltyId,
    system,
    amountSelf,
    amountOther,
    amountTotal,
    multiplier,
    timestamp: now,
  });

  // Update session totalAmounts
  await updateTotalAmounts(sessionId, totalAmounts);
}
