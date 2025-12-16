import React, { useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ActivityIndicator, FlatList } from 'react-native';
import { getLogsBySession, SessionLog } from '../../services/sessionLogService';
import { getMembersByClub, Member } from '../../services/memberService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';

interface Props {
  route: { params: { sessionId: string; clubId: string } };
}

const EventLogsScreen = ({ route }: Props) => {
  const { sessionId, clubId } = route.params;
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const memberNameById = useMemo(() => {
    const map: Record<string, string> = {};
    members.forEach(m => {
      map[m.id] = m.name;
    });
    return map;
  }, [members]);

  const penaltyNameById = useMemo(() => {
    const map: Record<string, string> = {};
    penalties.forEach(p => {
      map[p.id] = p.name;
    });
    return map;
  }, [penalties]);

  const load = async () => {
    try {
      setIsLoading(true);
      const [logRows, memberRows, penaltyRows] = await Promise.all([
        getLogsBySession(sessionId),
        getMembersByClub(clubId),
        getPenaltiesByClub(clubId),
      ]);
      setLogs(logRows);
      setMembers(memberRows);
      setPenalties(penaltyRows);
    } catch (error) {
      console.error('Failed to load event logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, clubId]);

  const getMemberName = (id?: string) => {
    if (!id) return 'Unknown';
    return memberNameById[id] || id.slice(0, 8);
  };

  const getPenaltyName = (id?: string) => {
    if (!id) return 'Unknown';
    return penaltyNameById[id] || id.slice(0, 8);
  };

  const formatPlaytime = (milliseconds?: number) => {
    if (!milliseconds || milliseconds <= 0) return '0m';
    const totalSeconds = Math.floor(milliseconds / 1000);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
  };

  const parseMultiplierChange = (log: SessionLog) => {
    const note = log.note || '';
    const match = note.match(/from\s+(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?)/i);
    const oldValue = match?.[1];
    const newValue = match?.[2] || (log.multiplier ? String(log.multiplier) : undefined);
    return { oldValue, newValue };
  };

  const renderLogItem = ({ item }: { item: SessionLog }) => {
    const time = new Date(item.timestamp).toLocaleTimeString();

    if (item.system === 1) {
      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.tag}>Player Added</Text>
          </View>
          <Text style={styles.bodyText}>{getMemberName(item.memberId)}</Text>
        </View>
      );
    }

    if (item.system === 8 || item.system === 9) {
      const label = item.system === 8 ? 'Positive Commit' : 'Negative Commit';
      const displayTotal = item.amountTotal ?? (item.amountSelf ?? 0) + (item.amountOther ?? 0);
      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={[styles.tag, item.system === 9 ? styles.tagNegative : styles.tagPositive]}>{label}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.subLabel}>Penalty</Text>
            <Text style={styles.bodyText}>{getPenaltyName(item.penaltyId)}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.subLabel}>Committer</Text>
            <Text style={styles.bodyText}>{getMemberName(item.memberId)}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.subLabel}>Total</Text>
            <Text style={[styles.amount, displayTotal < 0 ? styles.negative : undefined]}>
              {displayTotal.toFixed(2)}
            </Text>
          </View>
        </View>
      );
    }

    if (item.system === 5) {
      const { oldValue, newValue } = parseMultiplierChange(item);
      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.tag}>Multiplier Changed</Text>
          </View>
          <Text style={styles.bodyText}>
            {oldValue ? `${oldValue} → ${newValue || '—'}` : `New: ${newValue || '—'}`}
          </Text>
        </View>
      );
    }

    if (item.system === 2) {
      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.tag}>Title Winner</Text>
          </View>
          <Text style={styles.bodyText}>
            {getMemberName(item.memberId)} wins {getPenaltyName(item.penaltyId)}
          </Text>
        </View>
      );
    }

    if (item.system === 6) {
      const rewardAmount = item.amountTotal ? Math.abs(item.amountTotal) : 0;
      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.tag}>Reward Deduction</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.subLabel}>Winner</Text>
            <Text style={styles.bodyText}>{getMemberName(item.memberId)}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.subLabel}>Penalty</Text>
            <Text style={styles.bodyText}>{getPenaltyName(item.penaltyId)}</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.subLabel}>Reward</Text>
            <Text style={[styles.amount, styles.negative]}>
              {rewardAmount.toFixed(2)}
            </Text>
          </View>
        </View>
      );
    }

    if (item.system >= 11 && item.system <= 13) {
      const labels: Record<number, string> = {
        11: 'Final Totals',
        12: 'Commit Summary',
        13: 'Penalty Summary',
      };
      
      // Convert IDs to readable names
      let displayData = item.extra;
      if (item.system === 11 && displayData) {
        // Convert memberId to member names
        const newData: Record<string, number> = {};
        for (const [memberId, amount] of Object.entries(displayData)) {
          const member = members.find(m => m.id === memberId);
          const memberName = member?.name || memberId;
          newData[memberName] = amount as number;
        }
        displayData = newData;
      } else if (item.system === 12 && displayData) {
        // Convert memberId and penaltyId to names
        const newData: Record<string, Record<string, number>> = {};
        for (const [memberId, penaltyMap] of Object.entries(displayData)) {
          const member = members.find(m => m.id === memberId);
          const memberName = member?.name || memberId;
          const newMap: Record<string, number> = {};
          for (const [penaltyId, count] of Object.entries(penaltyMap as Record<string, number>)) {
            const penalty = penalties.find(p => p.id === penaltyId);
            const penaltyName = penalty?.name || penaltyId;
            newMap[penaltyName] = count;
          }
          newData[memberName] = newMap;
        }
        displayData = newData;
      } else if (item.system === 13 && displayData) {
        // Convert penaltyId to penalty names
        const newData: Record<string, number> = {};
        for (const [penaltyId, amount] of Object.entries(displayData)) {
          const penalty = penalties.find(p => p.id === penaltyId);
          const penaltyName = penalty?.name || penaltyId;
          newData[penaltyName] = amount as number;
        }
        displayData = newData;
      }
      
      const extraData = displayData ? JSON.stringify(displayData, null, 2) : 'No data';
      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.tag}>{labels[item.system] || `System ${item.system}`}</Text>
          </View>
          <Text style={styles.bodyTextMono}>{extraData}</Text>
        </View>
      );
    }

    if (item.system === 15) {
      // System 15: Individual member playtime log (one log per member, playtime in seconds)
      const playtimeSeconds = item.extra?.playtime || 0;
      const memberName = getMemberName(item.memberId || '');

      return (
        <View style={styles.logCard}>
          <View style={styles.logHeader}>
            <Text style={styles.time}>{time}</Text>
            <Text style={styles.tag}>Member Playtime</Text>
          </View>
          <View style={styles.rowLine}>
            <Text style={styles.bodyText}>{memberName}</Text>
            <Text style={styles.bodyText}>{formatPlaytime(playtimeSeconds * 1000)}</Text>
          </View>
        </View>
      );
    }

    return (
      <View style={styles.logCard}>
        <View style={styles.logHeader}>
          <Text style={styles.time}>{time}</Text>
          <Text style={styles.tag}>System {item.system}</Text>
        </View>
        <Text style={styles.bodyText}>{item.note || 'No details'}</Text>
      </View>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={logs}
        keyExtractor={item => String(item.id)}
        renderItem={renderLogItem}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={() => (
          <Text style={styles.emptyText}>No logs for this session.</Text>
        )}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listContent: {
    padding: 16,
  },
  logCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    color: '#6b7280',
  },
  tag: {
    fontSize: 12,
    color: '#0a84ff',
    fontWeight: '700',
  },
  tagPositive: {
    color: '#22c55e',
  },
  tagNegative: {
    color: '#dc2626',
  },
  rowLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  subLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  bodyText: {
    fontSize: 14,
    color: '#111827',
  },
  bodyTextMono: {
    fontSize: 11,
    color: '#111827',
    fontFamily: 'monospace',
  },
  amount: {
    fontSize: 14,
    fontWeight: '700',
    color: '#111827',
  },
  negative: {
    color: '#dc2626',
  },
  separator: {
    height: 12,
  },
  emptyText: {
    textAlign: 'center',
    color: '#6b7280',
    marginTop: 24,
  },
});

export default EventLogsScreen;
