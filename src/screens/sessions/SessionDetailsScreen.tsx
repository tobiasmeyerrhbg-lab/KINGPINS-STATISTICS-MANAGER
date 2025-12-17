import React, { useEffect, useMemo, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  View,
  StyleSheet,
  ActivityIndicator,
  Image,
  TouchableOpacity,
  Alert,
  Modal,
  FlatList,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { getSession, Session } from '../../services/sessionService';
import { getSummariesBySession, MemberSessionSummary } from '../../services/memberSessionSummaryService';
import { getMembersByClub, Member } from '../../services/memberService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import { getCommitSummary } from '../../services/sessionLogService';
import { exportSessionData, exportAndShareSessionData } from '../../services/sessionDetailsExportService';
import { SessionStackParamList } from '../../navigation/SessionStackNavigator';
import { loadGraphOptions, saveGraphOptions } from '../../services/graphOptionsService';

interface Props {
  route: { params: { sessionId: string; clubId?: string } };
}

export function SessionDetailsScreen({ route }: Props) {
  const { sessionId, clubId } = route.params;
  const navigation = useNavigation<NativeStackNavigationProp<SessionStackParamList>>();
  const [session, setSession] = useState<Session | null>(null);
  const [summaries, setSummaries] = useState<MemberSessionSummary[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [resolvedClubId, setResolvedClubId] = useState<string | undefined>(clubId);
  // Commit counts now taken only from Commit Summary
  const [commitCounts, setCommitCounts] = useState<Record<string, Record<string, number>>>({});
  // Penalty selection for winners display (reused from SessionAnalysisScreen pattern)
  const [selectedPenaltyIds, setSelectedPenaltyIds] = useState<string[]>([]);
  const [showSelectPenalties, setShowSelectPenalties] = useState(false);
  // Winners section collapsible state (default: collapsed)
  const [showWinners, setShowWinners] = useState(false);
  // Secondary statistics actions are grouped under 'More Statistics' to reduce visual clutter.
  const [showMoreStatistics, setShowMoreStatistics] = useState(false);

  const dummyAvatar = useMemo(
    () => require('../../../assets/images/dummy/default_member.png'),
    []
  );

  const load = async () => {
    try {
      setIsLoading(true);
      const s = await getSession(sessionId);
      if (!s) throw new Error('Session not found');
      setSession(s);
      
      const actualClubId = clubId || s.clubId;
      setResolvedClubId(actualClubId);
      
      const [summaryRows, clubMembers, clubPenalties, calculatedCommits] = await Promise.all([
        getSummariesBySession(sessionId),
        getMembersByClub(actualClubId),
        getPenaltiesByClub(actualClubId),
        getCommitSummary(sessionId),
      ]);
      
      setSummaries(summaryRows);
      setMembers(clubMembers);
      setPenalties(clubPenalties);
      // Commit counts now taken only from Commit Summary
      setCommitCounts(calculatedCommits);
      
      // Load saved penalty selection defaults (single source of truth: graphOptionsService)
      const graphOptions = await loadGraphOptions(actualClubId);
      if (graphOptions && graphOptions.comparePenaltyIds) {
        setSelectedPenaltyIds(graphOptions.comparePenaltyIds);
      } else {
        // Default: show all winners if no saved selection
        setSelectedPenaltyIds(Object.keys(s.winners || {}));
      }
    } catch (error: any) {
      console.error('Failed to load session details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [sessionId]);

  const getMemberName = (memberId?: string) => {
    if (!memberId) return 'Unknown';
    const member = members.find(m => m.id === memberId);
    return member?.name || memberId.substring(0, 8);
  };

  const getMemberAvatar = (memberId?: string) => {
    if (!memberId) return dummyAvatar;
    const member = members.find(m => m.id === memberId);
    if (member?.photoUri) {
      return { uri: member.photoUri } as const;
    }
    return dummyAvatar;
  };

  const getPenaltyName = (penaltyId?: string) => {
    if (!penaltyId) return 'Unknown';
    const penalty = penalties.find(p => p.id === penaltyId);
    return penalty?.name || penaltyId.substring(0, 8);
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'N/A';
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hours}h ${mins}m ${secs}s`;
  };

  const navigateToEventLogs = () => {
    if (!session || !resolvedClubId) return;
    navigation.navigate('EventLogs', { sessionId: session.id, clubId: resolvedClubId });
  };

  const navigateToSummaries = () => {
    if (!session) return;
    navigation.navigate('SessionEndSummary', {
      sessionId: session.id,
      clubId: resolvedClubId || session.clubId,
    });
  };

  const navigateToSessionTable = () => {
    if (!session || !resolvedClubId) return;
    navigation.navigate('SessionTable', { sessionId: session.id, clubId: resolvedClubId });
  };

  const navigateToSessionAnalysis = () => {
    if (!session || !resolvedClubId) return;
    navigation.navigate('SessionAnalysis', { sessionId: session.id, clubId: resolvedClubId });
  };

  const navigateToVerification = () => {
    if (!session || !resolvedClubId) return;
    navigation.navigate('SessionVerification', { sessionId: session.id, clubId: resolvedClubId });
  };

  const handleExportSessionData = async () => {
    if (!session) {
      Alert.alert('Error', 'Session data not available');
      return;
    }

    try {
      const [csvUri, jsonUri] = await exportSessionData(session.id);
      Alert.alert(
        'Export Successful',
        `Session data exported to:\n\n${csvUri}\n\n${jsonUri}`,
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Export Failed', errorMsg, [{ text: 'OK', onPress: () => {} }]);
      console.error('Export error:', error);
    }
  };

  const handleShareSessionData = async () => {
    if (!session) {
      Alert.alert('Error', 'Session data not available');
      return;
    }

    try {
      await exportAndShareSessionData(session.id);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Share Failed', errorMsg, [{ text: 'OK', onPress: () => {} }]);
      console.error('Share error:', error);
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>Session not found</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* --- UPDATED SECTION START --- Session Information --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Session Information</Text>
          <View style={styles.infoRowCompact}>
            <Text style={styles.label}>Status</Text>
            <Text style={[styles.value, session.status === 'finished' && styles.finishedStatus]}>
              {session.status.toUpperCase()}
            </Text>
          </View>
          <View style={styles.infoRowCompact}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{session.date}</Text>
          </View>
          <View style={styles.infoRowCompact}>
            <Text style={styles.label}>Duration</Text>
            <Text style={styles.value}>{formatDuration(session.playingTimeSeconds)}</Text>
          </View>
          <View style={styles.infoRowCompact}>
            <Text style={styles.label}>Players</Text>
            <Text style={styles.value}>{session.playerCount}</Text>
          </View>
        </View>
        {/* --- UPDATED SECTION END --- */}

        {/* Winners */}
        {/* --- UPDATED SECTION START --- Winners --- */}
        {session.winners && Object.keys(session.winners).length > 0 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.winnersHeader}
              onPress={() => setShowWinners(!showWinners)}
            >
              <View style={styles.winnersHeaderContent}>
                <Text style={styles.winnersTitle}>
                  {showWinners ? '∨' : '>'} Winners
                </Text>
                {!showWinners && (
                  <Text style={styles.winnersHint}>
                    {Object.keys(session.winners).length} penalties
                  </Text>
                )}
              </View>
              <TouchableOpacity
                style={styles.selectPenaltiesButton}
                onPress={() => setShowSelectPenalties(true)}
              >
                <Text style={styles.selectPenaltiesButtonText}>Select Penalties</Text>
              </TouchableOpacity>
            </TouchableOpacity>
            {showWinners && (
              <View>
                {Object.entries(session.winners)
                  .filter(([penaltyId]) => selectedPenaltyIds.includes(penaltyId))
                  .map(([penaltyId, winnerIds]) => {
                  const winnerIdArray = Array.isArray(winnerIds) ? winnerIds : [winnerIds];
                  // Multiple winners supported: all tied leaders are included in the array
                  const isTiedWin = winnerIdArray.length > 1;
                  
                  return (
                    <View key={penaltyId} style={styles.winnerCard}>
                      <View style={styles.penaltyNameRow}>
                        <Text style={styles.penaltyName}>{getPenaltyName(penaltyId)}</Text>
                        {isTiedWin && <Text style={styles.tiedLabel}>Tied for the lead</Text>}
                      </View>
                      {winnerIdArray.map(id => {
                        const commitCount = commitCounts[id]?.[penaltyId] || 0;
                        return (
                          <View key={id} style={styles.winnerPersonRow}>
                            <Image source={getMemberAvatar(id)} style={styles.winnerAvatar} />
                            <Text style={styles.winnerName}>{getMemberName(id)}</Text>
                            <Text style={styles.winnerCommitCount}>({commitCount} commits)</Text>
                          </View>
                        );
                      })}
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        )}
        {/* --- UPDATED SECTION END --- */}

        {/* Final Totals */}
        {/* --- UPDATED SECTION START --- Final Totals --- */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Final Totals</Text>
          {Object.entries(session.totalAmounts || {}).map(([memberId, amount]) => (
            <View key={memberId} style={styles.totalRowAligned}>
              <View style={styles.personRow}>
                <Image source={getMemberAvatar(memberId)} style={styles.avatarSmall} />
                <Text style={styles.memberName}>{getMemberName(memberId)}</Text>
              </View>
              <Text
                style={[
                  styles.totalAmount,
                  // financial-fix: session display uses raw totals (positive = red, negative = green)
                  amount < 0
                    ? styles.sessionCredit
                    : amount > 0
                      ? styles.sessionDebt
                      : styles.sessionNeutral,
                ]}
              >
                {amount.toFixed(2)}
              </Text>
            </View>
          ))}
        </View>
        {/* --- UPDATED SECTION END --- */}

        {/* Member Summaries */}
        {/* --- UPDATED SECTION START --- Member Commit Counts --- */}
        {session && session.activePlayers && session.activePlayers.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Member Commit Counts</Text>
            {session.activePlayers.map(memberId => {
              const member = members.find(m => m.id === memberId);
              if (!member) return null;
              
              // Commit counts now taken only from Commit Summary
              const memberCommitCounts = commitCounts[memberId] || {};
              const memberTotal = session.totalAmounts?.[memberId] || 0;
              
              return (
                <View key={memberId} style={styles.profileCard}>
                  {/* Member Identity (Profile Header) - Centered */}
                  <View style={styles.profileHeader}>
                    <Image source={getMemberAvatar(memberId)} style={styles.profileAvatar} />
                    <Text style={styles.profileName}>{member.name}</Text>
                  </View>
                  
                  {/* Commit Breakdown (Secondary Details) */}
                  <View style={styles.profileCommitsSection}>
                    {penalties
                      .filter(p => p.active)
                      .filter(p => (memberCommitCounts[p.id] || 0) > 0)
                      .map(penalty => (
                        <View key={penalty.id} style={styles.profileCommitRow}>
                          <Text style={styles.profileCommitLabel}>{penalty.name}:</Text>
                          <Text style={styles.profileCommitValue}>
                            {memberCommitCounts[penalty.id] || 0}
                          </Text>
                        </View>
                      ))}
                  </View>
                  
                  {/* Strong Divider */}
                  <View style={styles.profileDivider} />
                  
                  {/* Total Amount (Emphasized Summary) */}
                  <View style={styles.profileTotalSection}>
                    <Text style={styles.profileTotalLabel}>Total Session Amount</Text>
                    <Text
                      style={[
                        styles.profileTotalAmount,
                        memberTotal < 0
                          ? styles.sessionCredit
                          : memberTotal > 0
                            ? styles.sessionDebt
                            : styles.sessionNeutral,
                      ]}
                    >
                      {memberTotal.toFixed(2)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}
        {/* --- UPDATED SECTION END --- */}

        {/* --- UPDATED SECTION START --- Actions (bottom) --- */}
        {/* Secondary statistics actions are grouped under 'More Statistics' to reduce visual clutter. */}
        <View style={styles.actionsGrid}>
          <TouchableOpacity 
            style={styles.moreStatisticsButton} 
            onPress={() => setShowMoreStatistics(!showMoreStatistics)}
          >
            <Text style={styles.actionButtonText}>
              {showMoreStatistics ? '▼' : '▶'} More Statistics
            </Text>
          </TouchableOpacity>
          
          {showMoreStatistics && (
            <>
              <TouchableOpacity style={styles.actionButton} onPress={navigateToEventLogs}>
                <Text style={styles.actionButtonText}>Event Logs</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={navigateToSessionTable}>
                <Text style={styles.actionButtonText}>Session Table</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={navigateToSessionAnalysis}>
                <Text style={styles.actionButtonText}>Session Analysis</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleExportSessionData}>
                <Text style={styles.actionButtonText}>📥 Export Data</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={handleShareSessionData}>
                <Text style={styles.actionButtonText}>📤 Share Data</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.actionButton} onPress={navigateToVerification}>
                <Text style={styles.actionButtonText}>Verify Totals</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
        {/* --- UPDATED SECTION END --- */}

        {/* Select Penalties Modal - Reused from SessionAnalysisScreen pattern */}
        <Modal visible={showSelectPenalties} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select Winner Penalties</Text>
                <TouchableOpacity onPress={() => setShowSelectPenalties(false)}>
                  <Text style={styles.modalCloseText}>Done</Text>
                </TouchableOpacity>
              </View>
              <FlatList
                data={penalties}
                keyExtractor={p => p.id}
                renderItem={({ item: p }) => {
                  const selected = selectedPenaltyIds.includes(p.id);
                  return (
                    <TouchableOpacity
                      style={[styles.penaltyItem, selected && styles.penaltyItemSelected]}
                      onPress={() => {
                        setSelectedPenaltyIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
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
                  // Persist penalty selection (single source of truth: graphOptionsService)
                  await saveGraphOptions(resolvedClubId || clubId, { comparePenaltyIds: selectedPenaltyIds });
                  setShowSelectPenalties(false);
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
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 14,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
  },
  infoRowCompact: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  value: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  finishedStatus: {
    color: '#28a745',
  },
  playersBlock: {
    marginTop: 8,
  },
  playerListContainer: {
    marginTop: 8,
    gap: 8,
  },
  playerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f5f7fb',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignSelf: 'flex-start',
  },
  playerName: {
    fontSize: 13,
    color: '#000',
    marginLeft: 8,
  },
  actionsGrid: {
    flexDirection: 'column',
    gap: 12,
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#3B82F6',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  moreStatisticsButton: {
    backgroundColor: '#059669',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    shadowColor: '#059669',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 14,
  },
  winnerCard: {
    borderBottomWidth: 1,
    borderBottomColor: '#E2E8F0',
    paddingVertical: 10,
    gap: 8,
  },
  penaltyName: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
    marginBottom: 4,
  },
  penaltyNameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  tiedLabel: {
    fontSize: 12,
    color: '#F59E0B',
    fontWeight: '600',
    fontStyle: 'italic',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  winnerName: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  winnerCommitCount: {
    fontSize: 13,
    color: '#666',
    marginLeft: 4,
  },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarSmall: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  winnerPersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 6,
  },
  winnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e5e7eb',
  },
  totalRowAligned: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
    alignItems: 'center',
  },
  memberName: {
    fontSize: 14,
    color: '#0F172A',
    fontWeight: '600',
  },
  totalAmount: {
    fontSize: 15,
    fontWeight: '700',
  },
  sessionDebt: {
    color: '#EF4444',
  },
  sessionCredit: {
    color: '#10B981',
  },
  sessionNeutral: {
    color: '#64748B',
  },
  // Profile Card Styles (Steckbrief design)
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  // Member Identity Section (Dominant)
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  // Commit Breakdown Section (Secondary)
  profileCommitsSection: {
    marginBottom: 16,
  },
  profileCommitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileCommitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  profileCommitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  // Strong Divider
  profileDivider: {
    height: 4,
    backgroundColor: '#CBD5E1',
    marginVertical: 16,
    borderRadius: 2,
  },
  // Total Amount Section (Emphasized)
  profileTotalSection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  profileTotalLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  profileTotalAmount: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 4,
  },
  summaryLabel: {
    fontSize: 13,
    color: '#666',
  },
  summaryValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  errorText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  // Winners header with Select Penalties button - Redesigned
  winnersHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  winnersHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  winnersTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
  },
  winnersHint: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  selectPenaltiesButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#3b82f6',
  },
  selectPenaltiesButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  // Modal styles (reused from SessionAnalysisScreen pattern)
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: '#ffffff', 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    maxHeight: '80%' 
  },
  modalHeader: { 
    flexDirection: 'row', 
    justifyContent: 'space-between', 
    alignItems: 'center', 
    marginBottom: 16 
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    color: '#1e293b' 
  },
  modalCloseText: { 
    fontSize: 14, 
    color: '#3b82f6', 
    fontWeight: '600' 
  },
  penaltyItem: { 
    paddingVertical: 12, 
    paddingHorizontal: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0' 
  },
  penaltyItemSelected: { 
    backgroundColor: '#dbeafe' 
  },
  penaltyItemText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1e293b' 
  },
  penaltyItemMeta: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4 
  },
  loadButton: { 
    paddingVertical: 12, 
    paddingHorizontal: 16, 
    borderRadius: 8, 
    alignItems: 'center' 
  },
  loadButtonText: { 
    fontSize: 16, 
    fontWeight: '700', 
    color: '#ffffff' 
  },
});

export default SessionDetailsScreen;
