import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Modal,
  FlatList,
  Image,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getSessionsByClub, Session } from '../../services/sessionService';
import { buildGraph, GraphConfig, GraphResult, GraphMode } from '../../services/sessionGraphEngine';
import { listPresets, loadPreset, savePreset, deletePreset, GraphPreset } from '../../services/graphPresetsService';
import { getPenaltiesByClub } from '../../services/penaltyService';
import { getClub } from '../../services/clubService';
import { loadGraphOptions, saveGraphOptions } from '../../services/graphOptionsService';
import SessionGraphView from '../../components/graphs/SessionGraphView';
import { useNavigation } from '@react-navigation/native';
import { v4 as uuid } from 'uuid';
import { Member, getMembersByClub } from '../../services/memberService';

interface Props {
  clubId: string;
}

export default function SessionAnalysisTab({ clubId }: Props) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<GraphMode>('total-amount-per-player');
  const [selectedPenaltyId, setSelectedPenaltyId] = useState<string | null>(null);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [showMultiplierBands, setShowMultiplierBands] = useState(true);
  const [clubCurrency, setClubCurrency] = useState<string>('');
  const [clubTimeFormat, setClubTimeFormat] = useState<string>('HH:mm');
  const [graphResult, setGraphResult] = useState<GraphResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [presets, setPresets] = useState<GraphPreset[]>([]);
  const [showPresetsModal, setShowPresetsModal] = useState(false);
  const [showSessionsModal, setShowSessionsModal] = useState(false);
  const [showPenaltiesModal, setShowPenaltiesModal] = useState(false);
  const [presetName, setPresetName] = useState('');

  const loadSessions = useCallback(async () => {
    try {
      const data = await getSessionsByClub(clubId);
      const finished = data.filter(s => s.locked);
      setSessions(finished.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime()));
      if (finished.length > 0 && !selectedSessionId) {
        setSelectedSessionId(finished[0].id);
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
    }
  }, [clubId, selectedSessionId]);

  const loadPenalties = useCallback(async () => {
    try {
      const data = await getPenaltiesByClub(clubId);
      setPenalties(data);
    } catch (error) {
      console.error('Failed to load penalties:', error);
    }
  }, [clubId]);

  const loadMembers = useCallback(async () => {
    try {
      const data = await getMembersByClub(clubId);
      setMembers(data);
    } catch (error) {
      console.error('Failed to load members:', error);
    }
  }, [clubId]);

  const loadPresets_ = useCallback(async () => {
    try {
      const data = await listPresets();
      setPresets(data);
    } catch (error) {
      console.error('Failed to load presets:', error);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadSessions();
      loadPenalties();
      loadMembers();
      loadPresets_();
      (async () => {
        const club = await getClub(clubId);
        setClubCurrency(club?.currency || '');
        setClubTimeFormat(club?.timeFormat || 'HH:mm');
      })();
    }, [loadSessions, loadPenalties, loadMembers, loadPresets_])
  );

  const loadGraph = useCallback(async () => {
    if (!selectedSessionId) {
      alert('Please select a session');
      return;
    }
    if (mode === 'player-comparison-per-penalty' && !selectedPenaltyId) {
      alert('Please select a penalty');
      return;
    }
    try {
      setLoading(true);
      const config: GraphConfig = {
        sessionId: selectedSessionId,
        clubId,
        mode,
        selectedPenaltyId: mode === 'player-comparison-per-penalty' ? selectedPenaltyId || undefined : undefined,
        showMultiplierBands,
      };
      const result = await buildGraph(config);
      setGraphResult(result);
    } catch (error) {
      console.error('Failed to build graph:', error);
      alert('Error building graph');
    } finally {
      setLoading(false);
    }
  }, [selectedSessionId, clubId, mode, selectedPenaltyId, showMultiplierBands]);

  const saveCurrentAsPreset = useCallback(async () => {
    if (!presetName.trim()) {
      alert('Enter a preset name');
      return;
    }
    const preset: GraphPreset = {
      id: uuid(),
      name: presetName,
      config: {
        sessionId: selectedSessionId || '',
        clubId,
        mode,
        selectedPenaltyId: mode === 'player-comparison-per-penalty' ? selectedPenaltyId || undefined : undefined,
        showMultiplierBands,
      },
      createdAt: new Date().toISOString(),
    };
    try {
      await savePreset(preset);
      await loadPresets_();
      setPresetName('');
      alert('Preset saved');
    } catch (error) {
      console.error('Failed to save preset:', error);
    }
  }, [presetName, selectedSessionId, clubId, mode, selectedPenaltyId, showMultiplierBands, loadPresets_]);

  const applyPreset = useCallback(async (id: string) => {
    try {
      const preset = await loadPreset(id);
      if (preset) {
        setSelectedSessionId(preset.config.sessionId);
        setMode(preset.config.mode);
        setSelectedPenaltyId(preset.config.selectedPenaltyId || null);
        setShowMultiplierBands(preset.config.showMultiplierBands ?? true);
        setShowPresetsModal(false);
      }
    } catch (error) {
      console.error('Failed to apply preset:', error);
    }
  }, []);

  const removePreset = useCallback(async (id: string) => {
    try {
      await deletePreset(id);
      await loadPresets_();
    } catch (error) {
      console.error('Failed to delete preset:', error);
    }
  }, [loadPresets_]);

  const selectedSession = useMemo(() => sessions.find(s => s.id === selectedSessionId), [sessions, selectedSessionId]);
  const navigation = useNavigation();
  const openFullscreen = useCallback(() => {
    if (!graphResult) return;
    const penaltyName = selectedPenaltyId ? penalties.find(p => p.id === selectedPenaltyId)?.name : undefined;
    // Use any to avoid strict typing mismatch on navigate
    (navigation as any).navigate('GraphFullscreen', {
      config: { sessionId: selectedSessionId || '', clubId, mode, selectedPenaltyId, showMultiplierBands },
      result: graphResult,
      members,
      penaltyName,
      timeFormat: clubTimeFormat,
      currency: clubCurrency,
    });
  }, [graphResult, selectedSessionId, clubId, mode, selectedPenaltyId, showMultiplierBands, members, navigation, penalties, clubTimeFormat, clubCurrency]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Session Analysis</Text>

        {/* Session Selector */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Select Session</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowSessionsModal(true)}
          >
            <Text style={styles.dropdownText}>
              {selectedSession
                ? `${new Date(selectedSession.startTime).toLocaleDateString()} (${selectedSession.activePlayers.length} players)`
                : 'Select a session'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Penalty Selector (only for player-comparison-per-penalty) */}
        {mode === 'player-comparison-per-penalty' && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Select Penalty</Text>
            <TouchableOpacity
              style={styles.dropdownButton}
              onPress={() => setShowPenaltiesModal(true)}
            >
              <Text style={styles.dropdownText}>
                {selectedPenaltyId && penalties.find(p => p.id === selectedPenaltyId)
                  ? penalties.find(p => p.id === selectedPenaltyId)?.name
                  : 'Select a penalty'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Mode Selection */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Graph Mode</Text>
          <View style={styles.modeGrid}>
            {(['count-per-penalty', 'total-amount-per-player', 'full-replay', 'player-comparison-per-penalty'] as GraphMode[]).map(m => (
              <TouchableOpacity
                key={m}
                style={[styles.modeButton, mode === m && styles.modeButtonActive]}
                onPress={() => {
                  setMode(m);
                  if (m !== 'player-comparison-per-penalty') {
                    setSelectedPenaltyId(null);
                  }
                }}
              >
                <Text style={[styles.modeButtonText, mode === m && styles.modeButtonTextActive]}>
                  {m === 'count-per-penalty' ? 'Count' : m === 'total-amount-per-player' ? 'Amount' : m === 'full-replay' ? 'Full' : 'Compare'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Options */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Options</Text>
          <TouchableOpacity
            style={[styles.toggle, showMultiplierBands && styles.toggleActive]}
            onPress={() => setShowMultiplierBands(!showMultiplierBands)}
          >
            <Text style={styles.toggleText}>Show Multiplier Bands: {showMultiplierBands ? 'ON' : 'OFF'}</Text>
          </TouchableOpacity>
        </View>

        {/* Presets */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Favorites</Text>
          <View style={styles.presetInputContainer}>
            <View style={styles.presetInput}>
              <Text style={styles.presetInputPlaceholder}>Preset name</Text>
            </View>
            <TouchableOpacity style={styles.presetButton} onPress={() => setShowPresetsModal(true)}>
              <Text style={styles.presetButtonText}>Manage</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Load + Fullscreen Buttons */}
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <TouchableOpacity style={styles.loadButton} onPress={loadGraph} disabled={loading}>
            <Text style={styles.loadButtonText}>{loading ? 'Building...' : 'Load Graph'}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.loadButton, { backgroundColor: '#334155' }]} onPress={openFullscreen} disabled={!graphResult || loading}>
            <Text style={styles.loadButtonText}>Fullscreen</Text>
          </TouchableOpacity>
        </View>

        {/* Graph */}
        {loading && <ActivityIndicator size="large" color="#3b82f6" style={styles.loader} />}
        {graphResult && !loading && (
          <SessionGraphView
            config={{ sessionId: selectedSessionId || '', clubId, mode, selectedPenaltyId, showMultiplierBands }}
            result={graphResult}
            members={members}
            currency={clubCurrency}
            timeFormat={clubTimeFormat}
            onRequestFullscreen={openFullscreen}
          />
        )}
      </ScrollView>

      {/* Presets Modal */}
      <Modal visible={showPresetsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Favorites</Text>
              <TouchableOpacity onPress={() => setShowPresetsModal(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.presetSaveSection}>
              <View style={styles.presetNameInput}>
                <Text style={styles.presetInputPlaceholder}>Save current as...</Text>
              </View>
              <TouchableOpacity style={styles.presetButton} onPress={saveCurrentAsPreset}>
                <Text style={styles.presetButtonText}>Save</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.presetListTitle}>Saved Presets</Text>
            <FlatList
              data={presets}
              keyExtractor={p => p.id}
              renderItem={({ item: p }) => (
                <View style={styles.presetItem}>
                  <TouchableOpacity style={{ flex: 1 }} onPress={() => applyPreset(p.id)}>
                    <Text style={styles.presetItemName}>{p.name}</Text>
                    <Text style={styles.presetItemMeta}>{p.config.mode}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => removePreset(p.id)}>
                    <Text style={styles.presetItemDelete}>Delete</Text>
                  </TouchableOpacity>
                </View>
              )}
              scrollEnabled={false}
            />
          </View>
        </View>
      </Modal>

      {/* Sessions Modal */}
      <Modal visible={showSessionsModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Session</Text>
              <TouchableOpacity onPress={() => setShowSessionsModal(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={sessions}
              keyExtractor={s => s.id}
              renderItem={({ item: s }) => (
                <TouchableOpacity
                  style={[styles.sessionItem, selectedSessionId === s.id && styles.sessionItemSelected]}
                  onPress={() => {
                    setSelectedSessionId(s.id);
                    setShowSessionsModal(false);
                  }}
                >
                  <Text style={styles.sessionItemText}>{new Date(s.startTime).toLocaleDateString()} - {new Date(s.startTime).toLocaleTimeString()}</Text>
                  <Text style={styles.sessionItemMeta}>{s.activePlayers.length} players</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>

      {/* Penalties Modal */}
      <Modal visible={showPenaltiesModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Penalty</Text>
              <TouchableOpacity onPress={() => setShowPenaltiesModal(false)}>
                <Text style={styles.modalCloseText}>Close</Text>
              </TouchableOpacity>
            </View>
            <FlatList
              data={penalties}
              keyExtractor={p => p.id}
              renderItem={({ item: p }) => (
                <TouchableOpacity
                  style={[styles.penaltyItem, selectedPenaltyId === p.id && styles.penaltyItemSelected]}
                  onPress={() => {
                    setSelectedPenaltyId(p.id);
                    setShowPenaltiesModal(false);
                  }}
                >
                  <Text style={styles.penaltyItemText}>{p.name}</Text>
                  <Text style={styles.penaltyItemMeta}>{p.affect}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f4f8' },
  content: { padding: 12 },
  title: { fontSize: 22, fontWeight: '700', color: '#1e293b', marginBottom: 16 },
  card: { backgroundColor: '#ffffff', borderRadius: 8, padding: 12, marginBottom: 12, shadowColor: '#000', shadowOpacity: 0.05, elevation: 2 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  dropdownButton: { paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  dropdownText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  modeGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  modeButton: { flex: 1, minWidth: '45%', paddingVertical: 8, paddingHorizontal: 6, borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1', backgroundColor: '#f1f5f9' },
  modeButtonActive: { backgroundColor: '#3b82f6', borderColor: '#2563eb' },
  modeButtonText: { fontSize: 12, fontWeight: '600', color: '#334155', textAlign: 'center' },
  modeButtonTextActive: { color: '#ffffff' },
  toggle: { paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  toggleActive: { backgroundColor: '#dbeafe', borderColor: '#93c5fd' },
  toggleText: { fontSize: 14, color: '#1e293b', fontWeight: '600' },
  presetInputContainer: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  presetInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  presetInputPlaceholder: { fontSize: 14, color: '#64748b' },
  presetButton: { paddingVertical: 10, paddingHorizontal: 12, backgroundColor: '#3b82f6', borderRadius: 6 },
  presetButtonText: { fontSize: 14, fontWeight: '600', color: '#ffffff' },
  loadButton: { paddingVertical: 12, paddingHorizontal: 16, backgroundColor: '#3b82f6', borderRadius: 8, alignItems: 'center', marginBottom: 16 },
  loadButtonText: { fontSize: 16, fontWeight: '700', color: '#ffffff' },
  loader: { marginVertical: 32 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.5)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#ffffff', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 16, paddingTop: 16, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  modalTitle: { fontSize: 18, fontWeight: '700', color: '#1e293b' },
  modalCloseText: { fontSize: 14, color: '#3b82f6', fontWeight: '600' },
  presetSaveSection: { flexDirection: 'row', gap: 8, marginBottom: 16, alignItems: 'center' },
  presetNameInput: { flex: 1, paddingVertical: 10, paddingHorizontal: 8, backgroundColor: '#f1f5f9', borderRadius: 6, borderWidth: 1, borderColor: '#cbd5e1' },
  presetListTitle: { fontSize: 14, fontWeight: '700', color: '#334155', marginBottom: 8 },
  presetItem: { flexDirection: 'row', paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#e2e8f0', alignItems: 'center' },
  presetItemName: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  presetItemMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  presetItemDelete: { fontSize: 12, color: '#ef4444', fontWeight: '600' },
  sessionItem: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  sessionItemSelected: { backgroundColor: '#dbeafe' },
  sessionItemText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  sessionItemMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
  penaltyItem: { paddingVertical: 12, paddingHorizontal: 8, borderBottomWidth: 1, borderBottomColor: '#e2e8f0' },
  penaltyItemSelected: { backgroundColor: '#dbeafe' },
  penaltyItemText: { fontSize: 14, fontWeight: '600', color: '#1e293b' },
  penaltyItemMeta: { fontSize: 12, color: '#64748b', marginTop: 4 },
});
