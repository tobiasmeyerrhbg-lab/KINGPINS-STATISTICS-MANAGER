import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SafeAreaView, View, Text, StyleSheet, ScrollView, ActivityIndicator, TouchableOpacity, Modal, FlatList } from 'react-native';
import SessionGraphView from '../../components/graphs/SessionGraphView';
import { buildGraph, GraphConfig, GraphResult } from '../../services/sessionGraphEngine';
import { getSession, Session } from '../../services/sessionService';
import { getMembersByClub, Member } from '../../services/memberService';
import { getClub } from '../../services/clubService';
import { loadGraphOptions } from '../../services/graphOptionsService';
import { useNavigation } from '@react-navigation/native';

interface Props {
  route: { params: { sessionId: string; clubId: string } };
}

const SessionAnalysisScreen = ({ route }: Props) => {
  const { sessionId, clubId } = route.params;
  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [fullResult, setFullResult] = useState<GraphResult | null>(null);
  const [compareResults, setCompareResults] = useState<Array<{ penaltyId: string; name: string; result: GraphResult }>>([]);
  const [loading, setLoading] = useState(true);
  const navigation = useNavigation();
  const [clubCurrency, setClubCurrency] = useState<string>('');
  const [clubTimeFormat, setClubTimeFormat] = useState<string>('HH:mm');
  const [clubTimezone, setClubTimezone] = useState<string>('UTC');
  const [penalties, setPenalties] = useState<any[]>([]);
  const [comparePenaltyIds, setComparePenaltyIds] = useState<string[]>([]);
  const [showCompareOptions, setShowCompareOptions] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const s = await getSession(sessionId);
      setSession(s || null);
      const m = await getMembersByClub(clubId);
      setMembers(m);
      if (!s) return;
      const club = await getClub(clubId);
      setClubCurrency(club?.currency || '');
      setClubTimeFormat(club?.timeFormat || 'HH:mm');
      setClubTimezone(club?.timezone || 'UTC');
      // Load penalties for options modal
      const { getPenaltiesByClub } = await import('../../services/penaltyService');
      const plist = await getPenaltiesByClub(clubId);
      setPenalties(plist);

      // Full Graph (mandatory)
      const fullConfig: GraphConfig = { sessionId, clubId, mode: 'full-replay', showMultiplierBands: true };
      const full = await buildGraph(fullConfig);
      setFullResult(full);

      // Compare Graphs: default to title penalties from session.winners
      const opts = await loadGraphOptions(clubId);
      const winnerPenaltyIds = (opts?.comparePenaltyIds && opts.comparePenaltyIds.length > 0) ? opts.comparePenaltyIds : Object.keys(s.winners || {});
      setComparePenaltyIds(winnerPenaltyIds);
      const results: Array<{ penaltyId: string; name: string; result: GraphResult }> = [];
      for (const pid of winnerPenaltyIds) {
        const cfg: GraphConfig = { sessionId, clubId, mode: 'player-comparison-per-penalty', selectedPenaltyId: pid, showMultiplierBands: true };
        const res = await buildGraph(cfg);
        results.push({ penaltyId: pid, name: pid, result: res });
      }
      setCompareResults(results);
    } catch (e) {
      console.error('Failed to load session analysis:', e);
    } finally {
      setLoading(false);
    }
  }, [sessionId, clubId]);

  useEffect(() => {
    load();
  }, [load]);

  const membersSlim = useMemo(() => members.map(m => ({ id: m.id, name: m.name, image: (m as any).photoUri || undefined })), [members]);

  const openFullscreen = useCallback((config: GraphConfig, result: GraphResult, penaltyName?: string) => {
    (navigation as any).navigate('GraphFullscreen', {
      config,
      result,
      members: membersSlim,
      penaltyName,
      timeFormat: clubTimeFormat,
      currency: clubCurrency,
      timezone: clubTimezone,
    });
  }, [navigation, membersSlim, clubTimeFormat, clubCurrency, clubTimezone]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#3b82f6" style={{ marginTop: 24 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.header}>Session Analysis</Text>

        {/* Full Graph (mandatory) */}
        {fullResult && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Full Session Replay</Text>
            <SessionGraphView
              config={{ sessionId, clubId, mode: 'full-replay', showMultiplierBands: true }}
              result={fullResult}
              members={membersSlim}
              currency={clubCurrency}
              timeFormat={clubTimeFormat}
              timezone={clubTimezone}
              onRequestFullscreen={() => openFullscreen({ sessionId, clubId, mode: 'full-replay', showMultiplierBands: true }, fullResult)}
              onExport={() => openFullscreen({ sessionId, clubId, mode: 'full-replay', showMultiplierBands: true }, fullResult)}
            />
          </View>
        )}

        {/* Compare Graphs (optional, under full) */}
        {compareResults.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Compare Graphs (Title Penalties)</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
              <TouchableOpacity style={[styles.loadButton, { backgroundColor: '#334155', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 8 }]} onPress={() => setShowCompareOptions(true)}>
                <Text style={styles.loadButtonText}>Select Penalties</Text>
              </TouchableOpacity>
            </View>
            {compareResults.map(({ penaltyId, result }) => {
              const penalty = penalties.find(p => p.id === penaltyId);
              return (
                <View key={penaltyId} style={{ marginTop: 12 }}>
                  <SessionGraphView
                    config={{ sessionId, clubId, mode: 'player-comparison-per-penalty', selectedPenaltyId: penaltyId, showMultiplierBands: true }}
                    result={result}
                    members={membersSlim}
                    currency={clubCurrency}
                    penaltyName={penalty?.name}
                    timeFormat={clubTimeFormat}
                    timezone={clubTimezone}
                    onRequestFullscreen={() => openFullscreen({ sessionId, clubId, mode: 'player-comparison-per-penalty', selectedPenaltyId: penaltyId, showMultiplierBands: true }, result, penalty?.name)}
                    onExport={() => openFullscreen({ sessionId, clubId, mode: 'player-comparison-per-penalty', selectedPenaltyId: penaltyId, showMultiplierBands: true }, result, penalty?.name)}
                  />
                </View>
              );
            })}
          </View>
        )}

        {/* Compare Options Modal */}
        <Modal visible={showCompareOptions} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Compare Penalties</Text>
                <TouchableOpacity onPress={() => setShowCompareOptions(false)}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={penalties}
                keyExtractor={p => p.id}
                renderItem={({ item: p }) => {
                  const selected = comparePenaltyIds.includes(p.id);
                  return (
                    <TouchableOpacity
                      style={[styles.penaltyItem, selected && styles.penaltyItemSelected]}
                      onPress={() => {
                        setComparePenaltyIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                      }}
                    >
                      <Text style={styles.penaltyItemText}>{p.name}</Text>
                      <Text style={styles.penaltyItemMeta}>{p.affect}</Text>
                    </TouchableOpacity>
                  );
                }}
              />
              <TouchableOpacity
                style={[styles.loadButton, { backgroundColor: '#3b82f6' }]}
                onPress={async () => {
                  // Persist and rebuild compare graphs
                  const { saveGraphOptions } = await import('../../services/graphOptionsService');
                  await saveGraphOptions(clubId, { comparePenaltyIds });
                  const results: Array<{ penaltyId: string; name: string; result: GraphResult }> = [];
                  for (const pid of comparePenaltyIds) {
                    const cfg: GraphConfig = { sessionId, clubId, mode: 'player-comparison-per-penalty', selectedPenaltyId: pid, showMultiplierBands: true };
                    const res = await buildGraph(cfg);
                    results.push({ penaltyId: pid, name: pid, result: res });
                  }
                  setCompareResults(results);
                  setShowCompareOptions(false);
                }}
              >
                <Text style={styles.loadButtonText}>Save & Apply</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 12 },
  header: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 12 },
  card: { backgroundColor: '#ffffff', borderRadius: 8, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  loadButton: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 8, alignItems: 'center' },
  loadButtonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalCloseText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  penaltyItem: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  penaltyItemSelected: { backgroundColor: '#dbeafe' },
  penaltyItemText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  penaltyItemMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
});

export default SessionAnalysisScreen;
