import { getLogsBySession } from './sessionLogService';
import { getSession } from './sessionService';
import { getMembersByClub, Member } from './memberService';
import { getPenaltiesByClub, Penalty } from './penaltyService';

export type GraphMode = 'count-per-penalty' | 'total-amount-per-player' | 'full-replay' | 'player-comparison-per-penalty';

export interface GraphConfig {
  sessionId: string;
  clubId: string;
  mode: GraphMode;
  selectedPenaltyId?: string; // for player-comparison-per-penalty
  selectedPlayerIds?: string[]; // optional filter
  showMultiplierBands?: boolean;
  yAxisType?: 'integer' | 'cumulative' | 'mixed';
}

export interface DataPoint {
  x: number; // ms since session start
  y: number; // mode-dependent
  memberId?: string;
  memberName?: string;
  penaltyId?: string;
  penaltyName?: string;
  multiplier?: number;
  amountApplied?: number;
  amountTotal?: number;
  timestamp?: number; // absolute ms
  committerImageUri?: string | null;
}

export interface LineSeries {
  id: string; // penaltyId or memberId depending on mode
  label: string;
  color?: string;
  points: DataPoint[];
}

export interface MultiplierBand {
  startX: number; // ms
  endX: number; // ms
  multiplier: number;
}

export interface GraphResult {
  series: LineSeries[];
  bands: MultiplierBand[];
  sessionStart: number;
  sessionEnd?: number;
}

function applyAffect(penalty: Penalty, committerId: string, members: Member[]): string[] {
  if (penalty.affect === 'SELF') return [committerId];
  if (penalty.affect === 'OTHER') return members.map(m => m.id).filter(id => id !== committerId);
  if (penalty.affect === 'BOTH') return members.map(m => m.id);
  return [];
}

export async function buildGraph(config: GraphConfig): Promise<GraphResult> {
  const [session, logs, members, penalties] = await Promise.all([
    getSession(config.sessionId),
    getLogsBySession(config.sessionId),
    getMembersByClub(config.clubId),
    getPenaltiesByClub(config.clubId),
  ]);

  if (!session) throw new Error('Session not found');
  const startMs = new Date(session.startTime).getTime();

  // sort logs ascending by timestamp/id
  logs.sort((a, b) => {
    const ta = new Date(a.timestamp).getTime();
    const tb = new Date(b.timestamp).getTime();
    if (ta !== tb) return ta - tb;
    return (a.id ?? 0) - (b.id ?? 0);
  });

  const memberMap: Record<string, Member> = {};
  members.forEach(m => (memberMap[m.id] = m));
  const penaltyMap: Record<string, Penalty> = {};
  penalties.forEach(p => (penaltyMap[p.id] = p));

  const activeMemberIds = session.activePlayers;
  const activeMembers = members.filter(m => activeMemberIds.includes(m.id));

  const series: LineSeries[] = [];
  const bands: MultiplierBand[] = [];

  // initialize series per mode
  if (config.mode === 'count-per-penalty') {
    for (const p of penalties) {
      series.push({ id: p.id, label: p.name, points: [] });
    }
  } else if (config.mode === 'total-amount-per-player') {
    for (const m of activeMembers) {
      series.push({ id: m.id, label: m.name, points: [] });
    }
  } else if (config.mode === 'player-comparison-per-penalty') {
    const pId = config.selectedPenaltyId;
    if (!pId) throw new Error('selectedPenaltyId required for player-comparison-per-penalty');
    for (const m of activeMembers) {
      series.push({ id: m.id, label: m.name, points: [] });
    }
  } else if (config.mode === 'full-replay') {
    // Single series for cumulative total session amount
    series.push({ id: 'total', label: 'Total Session Amount', points: [] });
  }

  // track cumulative totals/counts
  const countsPerPenalty: Record<string, number> = {};
  const totalsPerMember: Record<string, number> = {};
  let totalSessionAmount = 0; // for full-replay mode
  for (const p of penalties) countsPerPenalty[p.id] = 0;
  for (const m of activeMembers) totalsPerMember[m.id] = 0;

  // multiplier bands
  let currentMult = 1;
  let currentBandStart: number | null = null;

  for (const log of logs) {
    const t = new Date(log.timestamp).getTime();
    const x = t - startMs;
    if (log.system === 5) {
      // multiplier change
      const newMult = log.multiplier || 1;
      if (config.showMultiplierBands) {
        if (currentBandStart !== null) {
          bands.push({ startX: currentBandStart, endX: x, multiplier: currentMult });
        }
        currentBandStart = x;
      }
      currentMult = newMult;
      continue;
    }

    // commits
    if ((log.system === 8 || log.system === 9) && log.penaltyId && log.memberId) {
      const penalty = penaltyMap[log.penaltyId];
      if (!penalty) continue;
      const committer = memberMap[log.memberId];
      const delta = log.system === 8 ? 1 : -1;
      const multiplierAtThisTime = log.multiplier || currentMult;
      const affected = applyAffect(penalty, log.memberId, activeMembers);

      // amounts
      const amountSelf = (penalty.amount || 0) * multiplierAtThisTime;
      const amountOther = (penalty.amountOther || 0) * multiplierAtThisTime;

      // mode-specific handling
      if (config.mode === 'count-per-penalty') {
        countsPerPenalty[penalty.id] = (countsPerPenalty[penalty.id] || 0) + delta;
        series.find(s => s.id === penalty.id)?.points.push({
          x,
          y: countsPerPenalty[penalty.id],
          penaltyId: penalty.id,
          penaltyName: penalty.name,
          memberName: committer?.name,
          multiplier: multiplierAtThisTime,
          memberId: log.memberId,
          amountTotal: log.amountTotal ?? null,
          timestamp: t,
        });
      } else if (config.mode === 'total-amount-per-player') {
        // apply totals to affected members
        for (const mid of affected) {
          const apply = mid === log.memberId ? amountSelf : amountOther;
          totalsPerMember[mid] = (totalsPerMember[mid] || 0) + delta * apply;
          series.find(s => s.id === mid)?.points.push({
            x,
            y: totalsPerMember[mid],
            memberId: mid,
            memberName: memberMap[mid]?.name,
            penaltyId: penalty.id,
            penaltyName: penalty.name,
            multiplier: multiplierAtThisTime,
            amountApplied: delta * apply,
            amountTotal: log.amountTotal ?? null,
            timestamp: t,
          });
        }
      } else if (config.mode === 'full-replay') {
        // Single cumulative total across all members
        for (const mid of affected) {
          const apply = mid === log.memberId ? amountSelf : amountOther;
          totalSessionAmount += delta * apply;
        }
        series.find(s => s.id === 'total')?.points.push({
          x,
          y: totalSessionAmount,
          penaltyId: penalty.id,
          penaltyName: penalty.name,
          multiplier: multiplierAtThisTime,
          memberId: log.memberId,
          memberName: committer?.name,
          amountApplied: delta * (amountSelf + amountOther),
          amountTotal: log.amountTotal ?? null,
          timestamp: t,
        });
      } else if (config.mode === 'player-comparison-per-penalty') {
        if (log.penaltyId !== config.selectedPenaltyId) continue;
        // count per player for selected penalty
        const s = series.find(s => s.id === log.memberId);
        if (s) {
          const prev = s.points.length ? s.points[s.points.length - 1].y : 0;
          s.points.push({
            x,
            y: prev + delta,
            memberId: log.memberId,
            memberName: committer?.name,
            penaltyId: penalty.id,
            penaltyName: penalty.name,
            multiplier: multiplierAtThisTime,
            amountTotal: log.amountTotal ?? null,
            timestamp: t,
          });
        }
      }
    }
  }

  // close last multiplier band
  if (config.showMultiplierBands && currentBandStart !== null) {
    const endX = session.endTime ? new Date(session.endTime).getTime() - startMs : (new Date().getTime() - startMs);
    bands.push({ startX: currentBandStart, endX, multiplier: currentMult });
  }

  const sessionEnd = session.endTime ? new Date(session.endTime).getTime() : undefined;
  return { series, bands, sessionStart: startMs, sessionEnd };
}

// Export stubs - to be wired with rendering
export async function exportGraph(result: GraphResult, format: 'png' | 'jpeg' | 'pdf'): Promise<Blob | null> {
  // Placeholder: real implementation will render to canvas and export
  return null;
}
