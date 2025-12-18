import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Session, getSession, getSessionsByClub, updateMultiplier } from '../../services/sessionService';
import { SessionLog, getLogsBySession } from '../../services/sessionLogService';
import { addCommit, negativeCommit } from '../../services/commitService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import { getMembersByClub, Member } from '../../services/memberService';

// NOTE: This screen assumes `route.params` provides { sessionId: string, clubId: string, maxMultiplier?: number }
// It hydrates state on mount and on app relaunch by fetching Session + SessionLog data already written to DB.

interface Props {
  route: {
    params: {
      sessionId: string;
      clubId: string;
      maxMultiplier?: number;
    };
  };
  navigation: any;
}

interface CommitCounterKey {
  memberId: string;
  penaltyId: string;
}

export function SessionLiveScreen({ route, navigation }: Props) {
  const { sessionId, clubId, maxMultiplier: maxMultParam } = route.params;

  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [commitCounts, setCommitCounts] = useState<Record<string, number>>({});
  const [currentMultiplier, setCurrentMultiplier] = useState<number>(1);
  const [tick, setTick] = useState<number>(0);
  const [debugMode, setDebugMode] = useState<boolean>(true); // Default ON to preserve current +/- controls

  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Hydrate session state (crash recovery friendly)
  const loadData = async () => {
    setIsLoading(true);
    try {
      const s = await getSession(sessionId);
      if (!s) throw new Error('Session not found');
      setSession(s);
      setCurrentMultiplier(s.multiplier);

      const [logRows, clubPenalties, clubMembers] = await Promise.all([
        getLogsBySession(sessionId),
        getPenaltiesByClub(clubId),
        getMembersByClub(clubId),
      ]);
      setLogs(logRows);
      setPenalties(clubPenalties.filter(p => p.active));
      setMembers(clubMembers);

      // rebuild commit counts from logs (system=8/+1, system=9/-1)
      const counts: Record<string, number> = {};
      for (const l of logRows) {
        if (l.system === 8 || l.system === 9) {
          const key = `${l.memberId}|${l.penaltyId}`;
          const delta = l.system === 8 ? 1 : -1;
          counts[key] = (counts[key] || 0) + delta;
        }
      }
      setCommitCounts(counts);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [sessionId]);

  // Timer: updates every second based on session.startTime
  useEffect(() => {
    if (!session) return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      timerRef.current && clearInterval(timerRef.current);
    };
  }, [session?.startTime]);

  const elapsedHHMMSS = useMemo(() => {
    if (!session) return '00:00:00';
    const start = new Date(session.startTime).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - start) / 1000));
    const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [session, tick]);

  const maxMultiplier = maxMultParam ?? 10;

  const handleCommit = async (memberId: string, penaltyId: string) => {
    try {
      await addCommit(sessionId, memberId, penaltyId);
      await loadData();
    } catch (err: any) {
      Alert.alert('Commit failed', err.message || 'Could not add commit');
    }
  };

  const handleNegativeCommit = async (memberId: string, penaltyId: string) => {
    try {
      await negativeCommit(sessionId, memberId, penaltyId);
      await loadData();
    } catch (err: any) {
      Alert.alert('Negative commit failed', err.message || 'Could not apply negative commit');
    }
  };

  const handleMultiplierChange = async (value: number) => {
    const newValue = Math.round(value);
    if (!session) return;
    if (newValue === currentMultiplier) return;
    try {
      await updateMultiplier(sessionId, newValue, maxMultiplier);
      setCurrentMultiplier(newValue);
      await loadData();
    } catch (err: any) {
      Alert.alert('Multiplier error', err.message || 'Failed to update multiplier');
    }
  };

  const memberDisplayName = (memberId: string) => members.find(m => m.id === memberId)?.name || memberId;

  const renderPenaltyRow = (penalty: Penalty) => {
    if (!session) return null;
    return (
      <View key={penalty.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
        <Text style={{ fontWeight: '700', marginBottom: 4 }}>
          {penalty.name} ({penalty.affect})
        </Text>
        {session.activePlayers.map(memberId => {
          const key = `${memberId}|${penalty.id}`;
          const count = commitCounts[key] || 0;
          return (
            <View key={key} style={{ flexDirection: 'row', alignItems: 'center', marginVertical: 4 }}>
              <Text style={{ flex: 1 }}>{memberDisplayName(memberId)}</Text>
              {debugMode ? (
                <>
                  <TouchableOpacity
                    style={{ backgroundColor: '#e74c3c', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginRight: 8 }}
                    onPress={() => handleNegativeCommit(memberId, penalty.id)}
                    accessibilityLabel="Decrease commit"
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>-</Text>
                  </TouchableOpacity>
                  <Text style={{ width: 44, textAlign: 'center' }}>{count}</Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#27ae60', paddingVertical: 8, paddingHorizontal: 12, borderRadius: 6, marginLeft: 8 }}
                    onPress={() => handleCommit(memberId, penalty.id)}
                    accessibilityLabel="Increase commit"
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>+</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  onPress={() => handleCommit(memberId, penalty.id)}
                  onLongPress={() => handleNegativeCommit(memberId, penalty.id)}
                  delayLongPress={300}
                  style={{
                    minWidth: 80,
                    paddingVertical: 10,
                    paddingHorizontal: 12,
                    borderWidth: 1,
                    borderColor: '#E2E8F0',
                    backgroundColor: '#FFFFFF',
                    borderRadius: 8,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  accessibilityLabel="Commit cell (tap to add, long-press to subtract)"
                >
                  <Text style={{ fontWeight: '700' }}>{count}</Text>
                  <Text style={{ fontSize: 12, color: '#64748B', marginTop: 2 }}>tap +1 • long-press -1</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>
    );
  };

  const totalForMember = (memberId: string) => session?.totalAmounts?.[memberId] ?? 0;
  const sessionTotal = useMemo(() => {
    if (!session) return 0;
    return Object.values(session.totalAmounts || {}).reduce((sum, v) => sum + (v || 0), 0);
  }, [session]);

  if (isLoading || !session) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading session...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, padding: 16 }}>
      <View style={{ marginBottom: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold' }}>Session Live</Text>
        <Text>Timer: {elapsedHHMMSS}</Text>
        <Text>Status: {session.status}</Text>
      </View>

      <View style={{ marginVertical: 12 }}>
        <Text style={{ fontWeight: 'bold' }}>Multiplier: {currentMultiplier} (max {maxMultiplier})</Text>
        <Slider
          minimumValue={1}
          maximumValue={maxMultiplier}
          step={1}
          value={currentMultiplier}
          onSlidingComplete={handleMultiplierChange}
        />
      </View>

      <FlatList
        data={penalties}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => renderPenaltyRow(item)}
      />

      <View style={{ marginTop: 16, padding: 12, backgroundColor: '#fff', borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
        <Text style={{ fontWeight: '700', marginBottom: 8 }}>Totals</Text>
        {session.activePlayers.map((memberId) => (
          <View key={memberId} style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 4 }}>
            <Text>{memberDisplayName(memberId)}</Text>
            <Text>{totalForMember(memberId).toFixed(2)}</Text>
          </View>
        ))}
        <View style={{ borderTopWidth: 1, borderColor: '#eee', marginTop: 6, paddingTop: 6, flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontWeight: '700' }}>Session Total</Text>
          <Text style={{ fontWeight: '700' }}>{sessionTotal.toFixed(2)}</Text>
        </View>
      </View>

      {/* Footer Controls */}
      <View style={{ marginTop: 16 }}>
        <TouchableOpacity
          onPress={() => setDebugMode((v) => !v)}
          style={{
            paddingVertical: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: debugMode ? '#10B981' : '#94A3B8',
            backgroundColor: debugMode ? '#D1FAE5' : '#F1F5F9',
            marginBottom: 10,
          }}
          accessibilityRole="button"
          accessibilityLabel="Toggle Debug Mode"
        >
          <Text style={{ textAlign: 'center', fontWeight: '700', color: debugMode ? '#065F46' : '#334155' }}>
            Debug Mode: {debugMode ? 'ON' : 'OFF'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={{ backgroundColor: '#e67e22', paddingVertical: 12, borderRadius: 10 }}
          onPress={() => (navigation as any).navigate('SessionEndSummary', { sessionId, clubId })}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>End Session</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

export default SessionLiveScreen;
