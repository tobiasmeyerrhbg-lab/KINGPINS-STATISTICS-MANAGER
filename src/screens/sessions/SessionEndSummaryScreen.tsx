import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, SafeAreaView, ScrollView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { getSession, finalizeSession, updateTotalAmounts, Session } from '../../services/sessionService';
import { getLogsBySession, getCommitSummary, createLog } from '../../services/sessionLogService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import { getSummariesBySession, MemberSessionSummary } from '../../services/memberSessionSummaryService';

interface Props {
  route: { params: { sessionId: string; clubId: string } };
  navigation: any;
}

interface WinnerState {
  [penaltyId: string]: string[]; // should be exactly one for title penalties
}

export function SessionEndSummaryScreen({ route, navigation }: Props) {
  const { sessionId, clubId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [summaries, setSummaries] = useState<MemberSessionSummary[]>([]);
  const [commitSummary, setCommitSummary] = useState<Record<string, Record<string, number>>>({});
  const [winners, setWinners] = useState<WinnerState>({});
  const [rewardModalPenalty, setRewardModalPenalty] = useState<Penalty | null>(null);
  const [rewardValueInput, setRewardValueInput] = useState<string>('');
  const [titleModalPenalty, setTitleModalPenalty] = useState<Penalty | null>(null);
  const [titleChoice, setTitleChoice] = useState<string>('');

  const load = async () => {
    try {
      const [s, logRows, p, summariesRows, cs] = await Promise.all([
        getSession(sessionId),
        getLogsBySession(sessionId),
        getPenaltiesByClub(clubId),
        getSummariesBySession(sessionId),
        getCommitSummary(sessionId),
      ]);
      if (!s) throw new Error('Session not found');
      setSession(s);
      setLogs(logRows);
      setPenalties(p);
      setSummaries(summariesRows);
      setCommitSummary(cs);
      setWinners(s.winners || {});
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load session summary');
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const titlePenalties = useMemo(() => penalties.filter(p => p.isTitle), [penalties]);
  const rewardPenalties = useMemo(() => penalties.filter(p => p.rewardEnabled), [penalties]);

  const resolveWinner = (penalty: Penalty) => {
    const memberCounts: Record<string, number> = {};
    for (const memberId of Object.keys(commitSummary)) {
      const counts = commitSummary[memberId] || {};
      const c = counts[penalty.id] || 0;
      memberCounts[memberId] = c;
    }
    const max = Math.max(...Object.values(memberCounts));
    const candidates = Object.entries(memberCounts)
      .filter(([_, v]) => v === max)
      .map(([m]) => m);
    if (candidates.length === 1) {
      setWinners(prev => ({ ...prev, [penalty.id]: [candidates[0]] }));
    } else {
      setTitleModalPenalty(penalty);
      setTitleChoice('');
    }
  };

  const applyTitleChoice = () => {
    if (!titleModalPenalty || !titleChoice) return;
    setWinners(prev => ({ ...prev, [titleModalPenalty.id]: [titleChoice] }));
    setTitleModalPenalty(null);
    setTitleChoice('');
  };

  const applyReward = async () => {
    if (!rewardModalPenalty || !session) return;
    const rewardValue = rewardModalPenalty.rewardValue ?? Number(rewardValueInput || '0');
    if (!rewardValue || rewardValue <= 0) {
      Alert.alert('Invalid reward value');
      return;
    }

    // determine winners for this penalty (non-title = all top committers)
    const winnerIds = rewardModalPenalty.isTitle
      ? (winners[rewardModalPenalty.id] || [])
      : computeNonTitleWinners(rewardModalPenalty.id);

    if (!winnerIds.length) {
      Alert.alert('No winner available for reward');
      return;
    }

    const totals = { ...(session.totalAmounts || {}) };
    const now = new Date().toISOString();

    // Rewards: deduct from winner totals and create SessionLog entries only
    // No ledger entries - ledger is updated once during finalization with final totals
    for (const w of winnerIds) {
      totals[w] = (totals[w] || 0) - rewardValue;
      await createLog({
        sessionId: session.id,
        clubId: session.clubId,
        memberId: w,
        penaltyId: rewardModalPenalty.id,
        system: 6,
        amountTotal: -rewardValue,
        timestamp: now,
      });
    }

    await updateTotalAmounts(session.id, totals);

    setRewardModalPenalty(null);
    setRewardValueInput('');
    await load();
  };

  const computeNonTitleWinners = (penaltyId: string): string[] => {
    const memberCounts: Record<string, number> = {};
    for (const memberId of Object.keys(commitSummary)) {
      const counts = commitSummary[memberId] || {};
      const c = counts[penaltyId] || 0;
      memberCounts[memberId] = c;
    }
    const max = Math.max(...Object.values(memberCounts));
    return Object.entries(memberCounts)
      .filter(([_, v]) => v === max)
      .map(([m]) => m);
  };

  const handleFinalize = async () => {
    if (!session) return;
    // ensure title penalties have a single winner selected
    for (const p of titlePenalties) {
      const w = winners[p.id] || [];
      if (w.length !== 1) {
        Alert.alert('Missing winner', `Select winner for ${p.name}`);
        return;
      }
    }
    try {
      await finalizeSession(session.id, winners);
      await load();
      Alert.alert('Session finalized');
      navigation.goBack();
    } catch (err: any) {
      Alert.alert('Finalize failed', err.message || 'Could not finalize session');
    }
  };

  const renderSummaryRow = (s: MemberSessionSummary) => {
    const playMinutes = Math.floor((s.playtimeSeconds || 0) / 60);
    return (
      <View key={s.id} style={{ paddingVertical: 8, borderBottomWidth: 1, borderColor: '#eee' }}>
        <Text style={{ fontWeight: 'bold' }}>Member: {s.memberId}</Text>
        <Text>Total: {s.totalAmount}</Text>
        <Text>Commits: {s.totalCommits}</Text>
        <Text>Playtime: {playMinutes} min</Text>
      </View>
    );
  };

  if (!session) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <Text>Loading...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16 }}>
        <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>Session End Summary</Text>
        <Text>Session: {session.id}</Text>
        <Text>Status: {session.status}</Text>
        <Text>Totals snapshot entries: {summaries.length}</Text>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Title Resolution</Text>
          {titlePenalties.map(p => (
            <View key={p.id} style={{ marginBottom: 8 }}>
              <Text>{p.name}</Text>
              <Text>Winner: {(winners[p.id] || []).join(', ') || 'Not set'}</Text>
              <TouchableOpacity
                style={{ padding: 8, backgroundColor: '#3498db', borderRadius: 6, marginTop: 4 }}
                onPress={() => resolveWinner(p)}
              >
                <Text style={{ color: '#fff' }}>Resolve</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Rewards</Text>
          {rewardPenalties.map(p => (
            <View key={p.id} style={{ marginBottom: 8 }}>
              <Text>{p.name}</Text>
              <Text>Value: {p.rewardValue ?? 'Enter value'}</Text>
              <TouchableOpacity
                style={{ padding: 8, backgroundColor: '#f39c12', borderRadius: 6, marginTop: 4 }}
                onPress={() => { setRewardModalPenalty(p); setRewardValueInput(p.rewardValue ? String(p.rewardValue) : ''); }}
              >
                <Text style={{ color: '#fff' }}>Apply Reward</Text>
              </TouchableOpacity>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Text style={{ fontWeight: 'bold', marginBottom: 8 }}>Member Summaries</Text>
          {summaries.map(renderSummaryRow)}
        </View>

        <TouchableOpacity
          style={{ padding: 12, backgroundColor: '#27ae60', borderRadius: 8, marginTop: 20 }}
          onPress={handleFinalize}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: 'bold' }}>Finalize Session</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Title tie modal */}
      <Modal visible={!!titleModalPenalty} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Select winner for {titleModalPenalty?.name}</Text>
            {(Object.keys(commitSummary) || []).map(memberId => {
              const cnt = commitSummary[memberId]?.[titleModalPenalty?.id || ''] || 0;
              return (
                <TouchableOpacity key={memberId} onPress={() => setTitleChoice(memberId)} style={{ paddingVertical: 6 }}>
                  <Text style={{ color: titleChoice === memberId ? '#3498db' : '#000' }}>
                    {memberId} (commits: {cnt})
                  </Text>
                </TouchableOpacity>
              );
            })}
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={() => { setTitleModalPenalty(null); setTitleChoice(''); }} style={{ marginRight: 12 }}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyTitleChoice}>
                <Text style={{ color: '#3498db' }}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reward modal */}
      <Modal visible={!!rewardModalPenalty} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: '#00000088', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontWeight: 'bold', marginBottom: 12 }}>Reward for {rewardModalPenalty?.name}</Text>
            <TextInput
              value={rewardValueInput}
              onChangeText={setRewardValueInput}
              placeholder="Enter reward value"
              keyboardType="numeric"
              style={{ borderWidth: 1, borderColor: '#ddd', padding: 8, borderRadius: 6 }}
            />
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginTop: 12 }}>
              <TouchableOpacity onPress={() => { setRewardModalPenalty(null); setRewardValueInput(''); }} style={{ marginRight: 12 }}>
                <Text>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={applyReward}>
                <Text style={{ color: '#3498db' }}>Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

export default SessionEndSummaryScreen;
