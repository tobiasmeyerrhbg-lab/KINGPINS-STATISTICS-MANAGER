import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { SafeAreaView, ScrollView, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { getSession, Session } from '../../services/sessionService';
import { getMembersByClub, Member } from '../../services/memberService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import { getCommitSummary, getCommitSummaryWithMultipliers } from '../../services/sessionLogService';

interface Props {
  route: { params: { sessionId: string; clubId: string } };
}

interface CommitDetail {
  total: number;
  byMultiplier: Record<number, number>;
}

// View-only snapshot of commit counts per member/penalty for the session.
// Uses the same display logic as SessionLiveScreenNew (Active Table).
const SessionTableScreen = ({ route }: Props) => {
  const { sessionId, clubId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [commitSummary, setCommitSummary] = useState<Record<string, Record<string, CommitDetail>>>({});
  const [isLoading, setIsLoading] = useState(true);

  const activeMembers = useMemo(() => {
    if (!session) return [];
    return members.filter(m => session.activePlayers.includes(m.id)).sort((a, b) => a.name.localeCompare(b.name));
  }, [members, session]);

  const sortedPenalties = useMemo(() => [...penalties].sort((a, b) => a.name.localeCompare(b.name)), [penalties]);

  const load = async () => {
    try {
      setIsLoading(true);
      const [sessionData, memberRows, penaltyRows, summary] = await Promise.all([
        getSession(sessionId),
        getMembersByClub(clubId),
        getPenaltiesByClub(clubId),
        getCommitSummaryWithMultipliers(sessionId),
      ]);
      setSession(sessionData);
      setMembers(memberRows);
      setPenalties(penaltyRows);
      setCommitSummary(summary);
    } catch (error) {
      console.error('Failed to load session table:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, clubId]);

  const getCount = (memberId: string, penaltyId: string): CommitDetail | null => {
    return commitSummary[memberId]?.[penaltyId] ?? null;
  };

  // session-table: format commit count with multiplier breakdown (same as active table)
  const formatCommitDisplay = useCallback((detail: CommitDetail | null): string => {
    if (!detail || detail.total === 0) return '0';
    
    const multKeys = Object.keys(detail.byMultiplier).filter(k => detail.byMultiplier[Number(k)] !== 0);
    if (multKeys.length === 0) return String(detail.total);
    if (multKeys.length === 1 && Number(multKeys[0]) === 1) return String(detail.total);

    const parts = multKeys
      .map(k => {
        const mult = Number(k);
        const count = detail.byMultiplier[mult];
        return mult === 1 ? null : `${count} × ${mult}x`;
      })
      .filter(Boolean);

    if (parts.length === 0) return String(detail.total);
    return `${detail.total} (${parts.join(', ')})`;
  }, []);

  // session-table: format penalty amount header (same logic as active table)
  const formatPenaltyAmount = useCallback((penalty: Penalty): string => {
    const formatNumber = (value: number) =>
      Math.abs(value % 1) < 0.001 ? value.toString() : value.toFixed(2);

    const amountSelf = penalty.amount || 0;
    const amountOther = penalty.amountOther || 0;

    // active-table: hide amounts when both zero
    if (amountSelf === 0 && amountOther === 0) return '';

    const selfText = amountSelf === 0 ? '' : formatNumber(amountSelf);
    const otherText = amountOther === 0 ? '' : formatNumber(amountOther);

    // active-table: new "(Other)" display and zero handling
    if (penalty.affect === 'SELF') return selfText;
    if (penalty.affect === 'OTHER') return otherText ? `${otherText} (Other)` : '';
    if (penalty.affect === 'BOTH') {
      if (selfText && otherText) return `${selfText} / ${otherText} (Other)`;
      if (!selfText && otherText) return `${otherText} (Other)`;
      if (selfText && !otherText) return selfText;
      return '';
    }
    return selfText;
  }, []);

  // session-table: calculate total session amount (sum of all member totals)
  const sessionTotalAmount = useMemo(() => {
    if (!session || !session.totalAmounts) return 0;
    return Object.values(session.totalAmounts).reduce((sum, amt) => sum + (amt || 0), 0);
  }, [session]);

  // session-table: calculate total commits per penalty (for footer row)
  const penaltyTotals = useMemo(() => {
    const totals: Record<string, CommitDetail> = {};
    
    sortedPenalties.forEach(penalty => {
      const totalDetail: CommitDetail = {
        total: 0,
        byMultiplier: {},
      };
      
      activeMembers.forEach(member => {
        const detail = commitSummary[member.id]?.[penalty.id];
        if (detail) {
          totalDetail.total += detail.total;
          Object.entries(detail.byMultiplier).forEach(([mult, count]) => {
            const m = Number(mult);
            totalDetail.byMultiplier[m] = (totalDetail.byMultiplier[m] || 0) + count;
          });
        }
      });
      
      totals[penalty.id] = totalDetail;
    });
    
    return totals;
  }, [commitSummary, sortedPenalties, activeMembers]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView horizontal contentContainerStyle={styles.scrollContainer}>
        <View style={styles.tableWrapper}>
          {/* Header Row */}
          <View style={styles.headerRow}>
            <View style={[styles.cell, styles.headerCell, styles.memberCol]}>
              <Text style={styles.headerText}>Members</Text>
            </View>
            {sortedPenalties.map(p => (
              <View key={p.id} style={[styles.cell, styles.headerCell, styles.penaltyCol]}>
                <Text style={styles.headerText} numberOfLines={2}>{p.name}</Text>
                {formatPenaltyAmount(p) !== '' && (
                  <Text style={styles.amountHeaderText} numberOfLines={1}>
                    {formatPenaltyAmount(p)}
                  </Text>
                )}
              </View>
            ))}
            <View style={[styles.cell, styles.headerCell, styles.totalCol]}>
              <Text style={styles.headerText}>Total</Text>
            </View>
          </View>

          {/* Member Rows and Footer */}
          <ScrollView style={styles.tableBody}>
            {activeMembers.map((member, index) => {
              const memberTotal = session?.totalAmounts?.[member.id] ?? 0;
              return (
                <View key={member.id} style={styles.bodyRow}>
                  <View style={[styles.cell, styles.bodyCell, styles.memberCol]}>
                    <Text style={styles.memberText} numberOfLines={1}>{member.name}</Text>
                  </View>
                  {sortedPenalties.map(penalty => {
                    const detail = getCount(member.id, penalty.id);
                    return (
                      <View key={penalty.id} style={[styles.cell, styles.bodyCell, styles.penaltyCol]}>
                        <Text style={styles.countText} numberOfLines={2}>{formatCommitDisplay(detail)}</Text>
                      </View>
                    );
                  })}
                  <View style={[styles.cell, styles.bodyCell, styles.totalCol]}>
                    <Text style={styles.totalText}>€{memberTotal.toFixed(2)}</Text>
                  </View>
                </View>
              );
            })}

            {/* Footer: Session Total */}
            <View style={styles.footerRow}>
              <View style={[styles.cell, styles.footerCell, styles.memberCol]}>
                <Text style={styles.footerText}>Session Total</Text>
              </View>
              {sortedPenalties.map(p => {
                const totalDetail = penaltyTotals[p.id];
                return (
                  <View key={p.id} style={[styles.cell, styles.footerCell, styles.penaltyCol]}>
                    <Text style={styles.footerCountText} numberOfLines={2}>
                      {formatCommitDisplay(totalDetail)}
                    </Text>
                  </View>
                );
              })}
              <View style={[styles.cell, styles.footerCell, styles.totalCol]}>
                <Text style={styles.footerTotalText}>€{sessionTotalAmount.toFixed(2)}</Text>
              </View>
            </View>
          </ScrollView>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  scrollContainer: {
    padding: 16,
  },
  tableWrapper: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  // Base cell style (shared)
  cell: {
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderRightWidth: 1,
    borderRightColor: '#cbd5e1',
    justifyContent: 'center',
  },
  // Header row
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#3b82f6',
    borderBottomWidth: 2,
    borderBottomColor: '#2563eb',
  },
  headerCell: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  headerText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#ffffff',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  amountHeaderText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#dbeafe',
    marginTop: 4,
    textAlign: 'center',
  },
  // Column widths
  memberCol: {
    width: 140,
    minWidth: 140,
    maxWidth: 140,
    paddingHorizontal: 12,
  },
  penaltyCol: {
    width: 110,
    minWidth: 110,
    maxWidth: 110,
    alignItems: 'center',
  },
  totalCol: {
    width: 100,
    minWidth: 100,
    maxWidth: 100,
    backgroundColor: '#fef3c7',
    borderRightWidth: 0,
  },
  // Body rows
  tableBody: {
    maxHeight: 500,
  },
  bodyRow: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  bodyCell: {
    paddingVertical: 10,
    alignItems: 'center',
  },
  memberText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'left',
  },
  countText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#334155',
    textAlign: 'center',
    lineHeight: 18,
  },
  totalText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#059669',
    textAlign: 'center',
  },
  // Footer row
  footerRow: {
    flexDirection: 'row',
    backgroundColor: '#1e293b',
    borderTopWidth: 3,
    borderTopColor: '#0f172a',
  },
  footerCell: {
    paddingVertical: 14,
    borderRightColor: '#475569',
  },
  footerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#f1f5f9',
    textAlign: 'left',
  },
  footerCountText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#e2e8f0',
    textAlign: 'center',
    lineHeight: 16,
  },
  footerTotalText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fbbf24',
    textAlign: 'center',
  },
});

export default SessionTableScreen;
