/**
 * Session Finalization Service
 * 
 * Handles complete session end logic following SESSION-GUIDE.md:
 * 1. Title resolution (auto-winner or tie-breaking)
 * 2. Reward resolution and application
 * 3. Final summary logs (system=11,12,13,14)
 * 4. MemberSessionSummary creation
 * 5. Ledger entries
 * 6. Session locking
 */

import { getSession, updateTotalAmounts } from './sessionService';
import { getLogsBySession, getCommitSummary, createLog } from './sessionLogService';
import { getPenaltiesByClub, Penalty } from './penaltyService';
import { getMembersByClub } from './memberService';
import { createMemberSessionSummary, updateMemberSessionSummary } from './memberSessionSummaryService';
import { createLedgerEntry } from './ledgerService';
import { db } from '../database/db';

const getErrorMessage = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * Recalculate member totals from logs
 * This ensures totals match what the live session actually computed
 */
async function recalculateTotalsFromLogs(
  sessionId: string,
  clubId: string,
  activePlayers: string[]
): Promise<Record<string, number>> {
  const [logs, penalties, members] = await Promise.all([
    getLogsBySession(sessionId),
    getPenaltiesByClub(clubId),
    getMembersByClub(clubId),
  ]);

  const activePenalties = penalties.filter(p => p.active);
  const activeMemberIds = new Set(activePlayers);
  const activeMembersList = members.filter(m => activeMemberIds.has(m.id));

  // Build member join times
  const memberJoinTimes: Record<string, string> = {};
  for (const log of logs) {
    if (log.system === 1 && log.memberId && !memberJoinTimes[log.memberId]) {
      memberJoinTimes[log.memberId] = log.timestamp;
    }
  }

  // Initialize totals for active members only
  const totals: Record<string, number> = {};
  for (const member of activeMembersList) {
    totals[member.id] = 0;
  }

  // Replay all logs to calculate totals
  let lastMultiplier = 1;
  for (const log of logs) {
    if (log.system === 5) {
      lastMultiplier = log.multiplier || 1;
    } else if (log.system === 8 || log.system === 9) {
      // Commit event
      if (log.memberId && log.penaltyId) {
        const delta = log.system === 8 ? 1 : -1;
        const penalty = activePenalties.find(p => p.id === log.penaltyId);
        if (penalty) {
          const multiplier = log.multiplier || lastMultiplier;
          const amountSelf = penalty.amount * multiplier;
          const amountOther = penalty.amountOther * multiplier;

          if (penalty.affect === 'SELF') {
            if (totals[log.memberId] !== undefined) {
              totals[log.memberId] += delta * amountSelf;
            }
          } else if (penalty.affect === 'OTHER') {
            for (const member of activeMembersList) {
              if (member.id !== log.memberId) {
                const memberJoinTime = memberJoinTimes[member.id];
                if (!memberJoinTime || memberJoinTime <= log.timestamp) {
                  totals[member.id] += delta * amountOther;
                }
              }
            }
          } else if (penalty.affect === 'BOTH') {
            if (totals[log.memberId] !== undefined) {
              totals[log.memberId] += delta * amountSelf;
            }
            for (const member of activeMembersList) {
              if (member.id !== log.memberId) {
                const memberJoinTime = memberJoinTimes[member.id];
                if (!memberJoinTime || memberJoinTime <= log.timestamp) {
                  totals[member.id] += delta * amountOther;
                }
              }
            }
          }
        }
      }
    }
  }

  return totals;
}

export interface TitleResolutionItem {
  penaltyId: string;
  penaltyName: string;
  tiedMembers: { memberId: string; memberName: string; count: number }[];
  autoWinnerId?: string; // Set if unique max
}

export interface RewardResolutionItem {
  penaltyId: string;
  penaltyName: string;
  winnerId: string;
  winnerName: string;
  rewardValue?: number; // Set if penalty has predefined value
}

/**
 * Step 1: Analyze titles and determine which need user resolution
 * Also resolves winners for non-title penalties (automatic, no modal)
 * 
 * Returns:
 * - titlesToResolve: Title penalties requiring user input (ties or no commits)
 * - autoResolvedWinners: Winners for title penalties (auto-resolved)
 * - nonTitleWinners: ALL tied leaders for non-title penalties (one system=2 log per winner)
 */
export async function prepareTitleResolution(
  sessionId: string,
  clubId: string,
  memberMap: Record<string, string> // memberId → name
): Promise<{
  titlesToResolve: TitleResolutionItem[];
  autoResolvedWinners: Record<string, string>; // penaltyId → winnerId (title penalties only)
  nonTitleWinners: Record<string, string[]>; // penaltyId → [winnerId1, winnerId2, ...] (non-title penalties)
}> {
  try {
    const [commitSummary, penalties, session] = await Promise.all([
      getCommitSummary(sessionId),
      getPenaltiesByClub(clubId),
      getSession(sessionId),
    ]);

    const titlePenalties = penalties.filter(p => p.isTitle && p.active);
    const nonTitlePenalties = penalties.filter(p => !p.isTitle && p.active);
    const titlesToResolve: TitleResolutionItem[] = [];
    const autoResolvedWinners: Record<string, string> = {};
    const nonTitleWinners: Record<string, string[]> = {};
    const activePlayers = session?.activePlayers || [];
    const now = new Date().toISOString();

    // ========== TITLE PENALTIES (unchanged logic) ==========
    for (const penalty of titlePenalties) {
      // Build counts for this penalty: memberId → commit count
      const countsForPenalty: Record<string, number> = {};

      for (const [memberId, penaltyMap] of Object.entries(commitSummary)) {
        const count = penaltyMap[penalty.id] || 0;
        if (count > 0) {
          countsForPenalty[memberId] = count;
        }
      }

      const memberIds = Object.keys(countsForPenalty);
      
      if (memberIds.length === 0) {
        // No commits for this title - require user to pick from active players
        const activeMembersList = activePlayers
          .map(id => ({ memberId: id, memberName: memberMap[id] || id }))
          .filter(m => m.memberName);
        
        if (activeMembersList.length === 1) {
          // Only one player - auto-assign
          autoResolvedWinners[penalty.id] = activeMembersList[0].memberId;
        } else {
          // Multiple players - need user selection
          titlesToResolve.push({
            penaltyId: penalty.id,
            penaltyName: penalty.name,
            tiedMembers: activeMembersList.map(m => ({
              memberId: m.memberId,
              memberName: m.memberName,
              count: 0,
            })),
          });
        }
        continue;
      }

      const maxCount = Math.max(...Object.values(countsForPenalty));
      const winnersWithMaxCount = memberIds.filter(mid => countsForPenalty[mid] === maxCount);

      if (winnersWithMaxCount.length === 1) {
        // Unique winner - auto-resolve
        autoResolvedWinners[penalty.id] = winnersWithMaxCount[0];
      } else {
        // Tie - needs user resolution
        titlesToResolve.push({
          penaltyId: penalty.id,
          penaltyName: penalty.name,
          tiedMembers: winnersWithMaxCount.map(mid => ({
            memberId: mid,
            memberName: memberMap[mid] || mid,
            count: countsForPenalty[mid],
          })),
        });
      }
    }

    // ========== NON-TITLE PENALTIES (new logic) ==========
    // For each non-title penalty, identify ALL tied leaders and write system=2 logs
    // Important: Multiple winners per penalty are valid and fully supported.
    // All tied leaders are winners, not just the first one.
    for (const penalty of nonTitlePenalties) {
      // Build counts for this penalty: memberId → commit count
      const countsForPenalty: Record<string, number> = {};

      for (const [memberId, penaltyMap] of Object.entries(commitSummary)) {
        const count = penaltyMap[penalty.id] || 0;
        if (count > 0) {
          countsForPenalty[memberId] = count;
        }
      }

      const memberIds = Object.keys(countsForPenalty);
      const winnersForPenalty: string[] = [];

      if (memberIds.length === 0) {
        // No commits - for non-title penalties, all active players are considered tied winners
        // (equivalent to everyone tied for the lead at 0 commits)
        if (activePlayers.length > 0) {
          winnersForPenalty.push(...activePlayers);
        }
      } else {
        // Find all members with max commits (all tied leaders are winners)
        // Do NOT limit to just the first member - all tied leaders count as winners
        const maxCount = Math.max(...Object.values(countsForPenalty));
        const allLeaders = memberIds.filter(mid => countsForPenalty[mid] === maxCount);
        winnersForPenalty.push(...allLeaders);
      }

      // Write system=2 logs for each winner
      // Each winner in a tie must have their own system=2 log entry
      // This ensures statistics and analytics reflect all winners accurately
      for (const winnerId of winnersForPenalty) {
        await createLog({
          sessionId,
          clubId,
          memberId: winnerId,
          penaltyId: penalty.id,
          system: 2,
          timestamp: now,
          note: winnersForPenalty.length > 1 ? 'Winner (tied for lead)' : 'Winner',
        });
      }

      // Store all winners for this penalty
      // Session.winners array format: penaltyId -> [winnerId1, winnerId2, ...]
      // All tied leaders are stored, not just the first or top one
      nonTitleWinners[penalty.id] = winnersForPenalty;
    }

    return { titlesToResolve, autoResolvedWinners, nonTitleWinners };
  } catch (error) {
    throw new Error(`Failed to prepare title resolution: ${getErrorMessage(error)}`);
  }
}

/**
 * Step 2: Write system=2 logs for all resolved titles (auto + manual)
 */
export async function logTitleWinners(
  sessionId: string,
  clubId: string,
  winners: Record<string, string> // penaltyId → winnerId
): Promise<void> {
  const now = new Date().toISOString();

  for (const [penaltyId, winnerId] of Object.entries(winners)) {
    // system log 2: write a log for every winner
    await createLog({
      sessionId,
      clubId,
      memberId: winnerId,
      penaltyId,
      system: 2,
      timestamp: now,
      note: `Title winner`,
    });
  }
}

/**
 * Log all winners (both title and non-title) with system=2 logs
 * system log 2: write a log for every winner (including multiple winners on non-title penalties)
 */
export async function logAllWinners(
  sessionId: string,
  clubId: string,
  titleWinners: Record<string, string>, // penaltyId → winnerId (title penalties)
  nonTitleWinners: Record<string, string> // penaltyId → winnerId (non-title penalties)
): Promise<void> {
  const now = new Date().toISOString();
  
  // Log all title winners
  for (const [penaltyId, winnerId] of Object.entries(titleWinners)) {
    await createLog({
      sessionId,
      clubId,
      memberId: winnerId,
      penaltyId,
      system: 2,
      timestamp: now,
      note: `Title winner`,
    });
  }

  // Log all non-title winners
  for (const [penaltyId, winnerId] of Object.entries(nonTitleWinners)) {
    await createLog({
      sessionId,
      clubId,
      memberId: winnerId,
      penaltyId,
      system: 2,
      timestamp: now,
      note: `Penalty winner`,
    });
  }
}

/**
 * Determine winners for non-title penalties (may have multiple winners)
 * Each non-title penalty produces one winner (highest commits, first alphabetically if tie)
 */
export async function determineNonTitleWinners(
  sessionId: string,
  clubId: string,
  memberMap: Record<string, string> // memberId → name
): Promise<Record<string, string>> {
  // winner handling: ensure all winners (including non-title) are added
  try {
    const [commitSummary, penalties, session] = await Promise.all([
      getCommitSummary(sessionId),
      getPenaltiesByClub(clubId),
      getSession(sessionId),
    ]);

    const nonTitlePenalties = penalties.filter(p => !p.isTitle && p.active);
    const winners: Record<string, string> = {};
    const activePlayers = session?.activePlayers || [];

    for (const penalty of nonTitlePenalties) {
      // Build counts for this penalty: memberId → commit count
      const countsForPenalty: Record<string, number> = {};

      for (const [memberId, penaltyMap] of Object.entries(commitSummary)) {
        const count = penaltyMap[penalty.id] || 0;
        if (count > 0) {
          countsForPenalty[memberId] = count;
        }
      }

      const memberIds = Object.keys(countsForPenalty);

      if (memberIds.length === 0) {
        // No commits - pick first active player
        if (activePlayers.length > 0) {
          winners[penalty.id] = activePlayers[0];
        }
        continue;
      }

      // Find winner with highest commits (tie-break: alphabetically by name)
      const maxCount = Math.max(...Object.values(countsForPenalty));
      const winnersWithMaxCount = memberIds.filter(mid => countsForPenalty[mid] === maxCount);

      if (winnersWithMaxCount.length === 1) {
        winners[penalty.id] = winnersWithMaxCount[0];
      } else {
        // Tie-break by member name alphabetically
        winnersWithMaxCount.sort((a, b) => {
          const nameA = memberMap[a] || a;
          const nameB = memberMap[b] || b;
          return nameA.localeCompare(nameB);
        });
        winners[penalty.id] = winnersWithMaxCount[0];
      }
    }

    return winners;
  } catch (error) {
    throw new Error(`Failed to determine non-title winners: ${getErrorMessage(error)}`);
  }
}

/**
 * Step 3: Prepare reward resolution
 * Returns list of rewards requiring user input (no predefined value)
 */
export async function prepareRewardResolution(
  sessionId: string,
  clubId: string,
  winners: Record<string, string>, // penaltyId → winnerId
  memberMap: Record<string, string>
): Promise<{
  rewardsToResolve: RewardResolutionItem[];
  autoRewards: Record<string, { winnerId: string; rewardValue: number }>;
}> {
  try {
    const penalties = await getPenaltiesByClub(clubId);
    const rewardPenalties = penalties.filter(p => p.rewardEnabled);

    const rewardsToResolve: RewardResolutionItem[] = [];
    const autoRewards: Record<string, { winnerId: string; rewardValue: number }> = {};

    for (const penalty of rewardPenalties) {
      const winnerId = winners[penalty.id];
      if (!winnerId) continue; // No winner for this penalty

      if (penalty.rewardValue && penalty.rewardValue > 0) {
        // Auto reward - has predefined value
        autoRewards[penalty.id] = {
          winnerId,
          rewardValue: penalty.rewardValue,
        };
      } else {
        // Needs user input
        rewardsToResolve.push({
          penaltyId: penalty.id,
          penaltyName: penalty.name,
          winnerId,
          winnerName: memberMap[winnerId] || winnerId,
        });
      }
    }

    return { rewardsToResolve, autoRewards };
  } catch (error) {
    throw new Error(`Failed to prepare reward resolution: ${getErrorMessage(error)}`);
  }
}

/**
 * Step 4: Apply rewards and write system=6 logs
 */
export async function applyRewards(
  sessionId: string,
  clubId: string,
  rewards: Record<string, { winnerId: string; rewardValue: number }>,
  currentTotalAmounts: Record<string, number>
): Promise<Record<string, number>> {
  const now = new Date().toISOString();
  const updatedTotals = { ...currentTotalAmounts };

  for (const [penaltyId, { winnerId, rewardValue }] of Object.entries(rewards)) {
    // Deduct from winner
    updatedTotals[winnerId] = (updatedTotals[winnerId] || 0) - rewardValue;

    // Write system=6 log
    await createLog({
      sessionId,
      clubId,
      memberId: winnerId,
      penaltyId,
      system: 6,
      amountTotal: -rewardValue,
      timestamp: now,
      note: `Reward deduction`,
    });
  }

  // Update session totals
  await updateTotalAmounts(sessionId, updatedTotals);

  return updatedTotals;
}

/**
 * Step 5: Generate final summary logs (system=11,12,13,14)
 */
export async function generateFinalSummaryLogs(
  sessionId: string,
  clubId: string,
  finalTotals: Record<string, number>,
  commitSummary: Record<string, Record<string, number>>,
  penalties: Penalty[],
  session: any
): Promise<void> {
  const now = new Date().toISOString();

  // CENTRALIZED SUMMARY LOGS (system 11–15)
  // system=15 is emitted here to guarantee it is created together with 11–14
  // in the same call and sequence at session end.

  // system=11: FinalTotals { memberId: amount }
  await createLog({
    sessionId,
    clubId,
    system: 11,
    timestamp: now,
    extra: finalTotals,
  });

  // system=12: CommitSummary { memberId: { penaltyId: count } }
  await createLog({
    sessionId,
    clubId,
    system: 12,
    timestamp: now,
    extra: commitSummary,
  });

  // system=13: PenaltySummary { penaltyId: sum(amountTotal over all commit logs) }
  const penaltySummary: Record<string, number> = {};
  // Initialize all penalties to 0
  for (const penalty of penalties) {
    penaltySummary[penalty.id] = 0;
  }
  // Sum amounts from commit logs (systems 8 and 9)
  const logs = await getLogsBySession(sessionId);
  for (const log of logs) {
    const pId = log.penaltyId;
    const isCommitEvent = log.system === 8 || log.system === 9;
    if (pId && isCommitEvent) {
      const amount = log.amountTotal || 0;
      penaltySummary[pId] = (penaltySummary[pId] || 0) + amount;
    }
  }

  await createLog({
    sessionId,
    clubId,
    system: 13,
    timestamp: now,
    extra: penaltySummary,
  });

  // system=14: PlayerSummary { memberId: { totalAmount, totalCommits } }
  const playerSummary: Record<string, { totalAmount: number; totalCommits: number }> = {};
  for (const [memberId, penaltyMap] of Object.entries(commitSummary)) {
    const totalCommits = Object.values(penaltyMap).reduce((sum, count) => sum + count, 0);
    playerSummary[memberId] = {
      totalAmount: finalTotals[memberId] || 0,
      totalCommits,
    };
  }

  await createLog({
    sessionId,
    clubId,
    system: 14,
    timestamp: now,
    extra: playerSummary,
  });

  // system=15: MemberPlaytime — one log per member (no aggregate)
  // Calculate each member's playtime from first system=1 (join) to now (finalization time).
  // Note: session.endTime is not yet set; it will be set by lockSession() afterwards.
  const sessionEndMs = new Date(now).getTime();

  // Build first-join map from existing logs (system=1)
  const firstJoinByMember: Record<string, number> = {};
  for (const l of logs) {
    if (l.system === 1 && l.memberId && firstJoinByMember[l.memberId] === undefined) {
      firstJoinByMember[l.memberId] = new Date(l.timestamp).getTime();
    }
  }

  // Emit one system=15 per active member
  for (const memberId of session.activePlayers || []) {
    const joinMs = firstJoinByMember[memberId] ?? new Date(session.startTime).getTime();
    const playtimeSeconds = Math.max(0, Math.floor((sessionEndMs - joinMs) / 1000));
    await createLog({
      sessionId,
      clubId,
      memberId,
      system: 15,
      timestamp: now,
      extra: { playtime: playtimeSeconds },
    });
  }
}

/**
 * Step 6: Calculate playtime using system=1 logs
 */
async function getMemberJoinTime(sessionId: string, memberId: string, startTime: string): Promise<string> {
  const logs = await getLogsBySession(sessionId);
  const system1Log = logs.find(log => log.system === 1 && log.memberId === memberId);
  
  if (system1Log) {
    return system1Log.timestamp;
  }
  
  // Fallback: use session startTime
  console.warn(`No system=1 log found for member ${memberId}, using session startTime`);
  return startTime;
}

/**
 * Step 7: Create MemberSessionSummary records with correct playtime
 */
export async function createMemberSummaries(
  sessionId: string,
  clubId: string,
  activePlayers: string[],
  finalTotals: Record<string, number>,
  commitSummary: Record<string, Record<string, number>>,
  startTime: string,
  endTime: string
): Promise<void> {
  const endTimeMs = new Date(endTime).getTime();

  for (const memberId of activePlayers) {
    const memberJoinTime = await getMemberJoinTime(sessionId, memberId, startTime);
    const joinTimeMs = new Date(memberJoinTime).getTime();
    const playtimeSeconds = Math.floor((endTimeMs - joinTimeMs) / 1000);

    const memberCommits = commitSummary[memberId] || {};
    const totalCommits = Object.values(memberCommits).reduce((sum, count) => sum + count, 0);

    const payload = {
      sessionId,
      memberId,
      clubId,
      totalAmount: finalTotals[memberId] || 0,
      totalCommits,
      commitCounts: memberCommits,
      playtimeSeconds,
    };

    // Try update, if no rows affected then create
    const updated = await updateMemberSessionSummary(payload);
    if (!updated) {
      await createMemberSessionSummary(payload);
    }
  }
}

/**
 * Step 8: Create ledger entries (one per member with final total)
 */
export async function createSessionLedgerEntries(
  sessionId: string,
  clubId: string,
  memberIds: string[],
  finalTotals: Record<string, number>
) {
  const now = new Date().toISOString();
  for (const memberId of memberIds) {
    await createLedgerEntry({
      type: 'session',
      sessionId,
      memberId,
      clubId,
      amount: finalTotals[memberId] ?? 0,
      note: null,
      createdBy: 'system',
      timestamp: now,
    });
  }
}

/**
 * Step 9: Lock session with final metadata
 */
export async function lockSession(
  sessionId: string,
  winners: Record<string, string[]>, // penaltyId → [winnerId1, winnerId2, ...] (both title and non-title)
  activePlayers: string[],
  startTime: string
): Promise<void> {
  const now = new Date().toISOString();
  const playingTimeSeconds = Math.floor(
    (new Date(now).getTime() - new Date(startTime).getTime()) / 1000
  );

  // All non-title winners are stored as arrays without truncation.
  // Multiple winners per penalty are fully supported:
  // - Title penalties: single winner per penalty, stored as [winnerId]
  // - Non-title penalties: all tied leaders stored as [winnerId1, winnerId2, ...]
  // UI and statistics code must iterate through ALL winners, not assume first only.
  await db.executeSql(
    `UPDATE Session 
     SET endTime = ?, playingTimeSeconds = ?, playerCount = ?, status = ?, locked = ?, winners = ?, updatedAt = ? 
     WHERE id = ?`,
    [
      now,
      playingTimeSeconds,
      activePlayers.length,
      'finished',
      1,
      JSON.stringify(winners),
      now,
      sessionId,
    ]
  );
}

/**
 * Complete finalization orchestrator
 * Call this after all title and reward modals are resolved
 */
export async function finalizeSessionComplete(
  sessionId: string,
  clubId: string,
  allWinners: Record<string, string[]>, // penaltyId → [winnerId1, winnerId2, ...] (both title and non-title)
  allRewards: Record<string, { winnerId: string; rewardValue: number }>
): Promise<void> {
  try {
    const session = await getSession(sessionId);
    if (!session) throw new Error('Session not found');
    if (session.locked) throw new Error('Session already locked');

    // Get current data and recalculate totals from logs
    const [commitSummary, penalties, recalculatedTotals, members] = await Promise.all([
      getCommitSummary(sessionId),
      getPenaltiesByClub(clubId),
      recalculateTotalsFromLogs(sessionId, clubId, session.activePlayers),
      getMembersByClub(clubId),
    ]);

    // Build member map for lookups
    const memberMap: Record<string, string> = {};
    for (const member of members) {
      memberMap[member.id] = member.name;
    }

    // Apply rewards on top of recalculated totals
    const finalTotals = await applyRewards(
      sessionId,
      clubId,
      allRewards,
      recalculatedTotals
    );

    // Generate summary logs
    await generateFinalSummaryLogs(sessionId, clubId, finalTotals, commitSummary, penalties, session);

    // Create member summaries
    await createMemberSummaries(
      sessionId,
      clubId,
      session.activePlayers,
      finalTotals,
      commitSummary,
      session.startTime,
      new Date().toISOString()
    );

    // Create ledger entries
    await createSessionLedgerEntries(sessionId, clubId, session.activePlayers, finalTotals);

    // Lock session with all winners (title + non-title)
    await lockSession(sessionId, allWinners, session.activePlayers, session.startTime);

  } catch (error) {
    throw new Error(`Failed to finalize session: ${getErrorMessage(error)}`);
  }
}
