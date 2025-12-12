/**
 * SessionEndSummaryScreen (New Modal-Based Resolution)
 * 
 * Implements:
 * - Auto-resolution for non-tied penalties
 * - Sequential modals for tied penalties (title resolution)
 * - Sequential modals for missing reward values
 * - Name-based display (no IDs)
 * - Final session finalization
 */

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Alert,
  Modal,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getSession, finalizeSession, updateTotalAmounts, Session } from '../../services/sessionService';
import { getLogsBySession, getCommitSummary, createLog } from '../../services/sessionLogService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import { getMembersByClub, Member } from '../../services/memberService';
import { getSummariesBySession, MemberSessionSummary } from '../../services/memberSessionSummaryService';

interface Props {
  route: { params: { sessionId: string; clubId: string; clubName?: string } };
  navigation: any;
}

interface WinnerState {
  [penaltyId: string]: string; // exactly one winnerId per title penalty
}

interface RewardState {
  [penaltyId: string]: number; // rewardValue per penalty
}

export function SessionEndSummaryScreenNew({ route, navigation }: Props) {
  const { sessionId, clubId, clubName = 'Club' } = route.params;

  const [session, setSession] = useState<Session | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [commitSummary, setCommitSummary] = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Modal states
  const [currentTitlePenaltyIndex, setCurrentTitlePenaltyIndex] = useState(0);
  const [currentRewardPenaltyIndex, setCurrentRewardPenaltyIndex] = useState(0);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [rewardValueInput, setRewardValueInput] = useState('');

  // Resolution states
  const [winners, setWinners] = useState<WinnerState>({});
  const [rewards, setRewards] = useState<RewardState>({});

  /**
   * Load session data and compute commit summaries
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [s, logRows, p, clubMembers, cs] = await Promise.all([
        getSession(sessionId),
        getLogsBySession(sessionId),
        getPenaltiesByClub(clubId),
        getMembersByClub(clubId),
        getCommitSummary(sessionId),
      ]);

      if (!s) throw new Error('Session not found');
      setSession(s);
      setMembers(clubMembers);
      setPenalties(p);
      setCommitSummary(cs);

      // Pre-populate winners if already selected (convert array to single string)
      if (s.winners) {
        const convertedWinners: WinnerState = {};
        for (const [penaltyId, winnerIds] of Object.entries(s.winners)) {
          if (Array.isArray(winnerIds) && winnerIds.length > 0) {
            convertedWinners[penaltyId] = winnerIds[0];
          }
        }
        setWinners(convertedWinners);
      }
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, clubId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  /**
   * Get title penalties that need resolution
   */
  const titlePenalties = useMemo(
    () => penalties.filter(p => p.isTitle),
    [penalties]
  );

  /**
   * Get reward penalties that need value input
   */
  const rewardPenalties = useMemo(
    () => penalties.filter(p => p.rewardEnabled && !p.rewardValue),
    [penalties]
  );

  /**
   * For current title penalty, get tied members
   * commitSummary is keyed by memberId, then penaltyId
   */
  const currentTitlePenalty = titlePenalties[currentTitlePenaltyIndex];
  const tiedMembersForCurrentTitle = useMemo(() => {
    if (!currentTitlePenalty) return [];
    
    // Build penalty-centric view: penaltyId -> { memberId -> count }
    const countsForPenalty: Record<string, number> = {};
    
    for (const [memberId, penaltyMap] of Object.entries(commitSummary)) {
      const count = penaltyMap[currentTitlePenalty.id] || 0;
      countsForPenalty[memberId] = count;
    }

    // Find max count among members who have commits for this penalty
    const memberIdsWithCommits = Object.entries(countsForPenalty)
      .filter(([, count]) => count > 0)
      .map(([memberId]) => memberId);
    
    if (memberIdsWithCommits.length === 0) return [];
    
    const maxCount = Math.max(
      ...memberIdsWithCommits.map(mid => countsForPenalty[mid])
    );
    
    const tiedMemberIds = Object.entries(countsForPenalty)
      .filter(([, count]) => count === maxCount)
      .map(([memberId]) => memberId);

    return members.filter(m => tiedMemberIds.includes(m.id));
  }, [currentTitlePenalty, commitSummary, members]);

  /**
   * Calculate member totals from commitSummary and penalties
   */
  const memberTotals = useMemo(() => {
    const totals: Record<string, number> = {};
    
    members.forEach(member => {
      let total = 0;
      const penaltyMap = commitSummary[member.id] || {};
      
      // Sum up all penalties: commits * penalty amount
      for (const [penaltyId, commitCount] of Object.entries(penaltyMap)) {
        const penalty = penalties.find(p => p.id === penaltyId);
        if (penalty) {
          total += commitCount * penalty.amount;
        }
      }
      
      totals[member.id] = total;
    });
    
    return totals;
  }, [members, commitSummary, penalties]);

  /**
   * Check if current title penalty has a clear winner (no tie)
   */
  const hasAutowinner = tiedMembersForCurrentTitle.length === 1;

  /**
   * Auto-resolve titles with clear winners (skip modal for non-tied)
   */
  useEffect(() => {
    if (!showTitleModal || !currentTitlePenalty || !hasAutowinner) return;
    
    // Delay to ensure modal is fully visible before auto-advancing
    const timer = setTimeout(() => {
      const winner = tiedMembersForCurrentTitle[0];
      const newWinners = { ...winners, [currentTitlePenalty.id]: winner.id };
      setWinners(newWinners);

      // Write system=2 log for auto-selected winner
      createLog({
        sessionId,
        clubId,
        memberId: winner.id,
        penaltyId: currentTitlePenalty.id,
        system: 2,
        timestamp: new Date().toISOString(),
        note: `Auto-selected winner for ${currentTitlePenalty.name}`,
      });

      // Move to next title
      if (currentTitlePenaltyIndex < titlePenalties.length - 1) {
        setCurrentTitlePenaltyIndex(currentTitlePenaltyIndex + 1);
      } else {
        // All titles resolved, move to rewards
        setShowTitleModal(false);
        if (rewardPenalties.length > 0) {
          setCurrentRewardPenaltyIndex(0);
          setShowRewardModal(true);
        }
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [showTitleModal, currentTitlePenalty, hasAutowinner, tiedMembersForCurrentTitle, currentTitlePenaltyIndex, titlePenalties.length, winners, sessionId, clubId, rewardPenalties.length]);

  /**
   * Handle auto-resolution for current title penalty
   */
  const autoResolveTitleIfNeeded = useCallback(async () => {
    if (!currentTitlePenalty || !hasAutowinner) return;

    const winner = tiedMembersForCurrentTitle[0];
    const newWinners = { ...winners, [currentTitlePenalty.id]: winner.id };
    setWinners(newWinners);

    // Move to next title penalty
    if (currentTitlePenaltyIndex < titlePenalties.length - 1) {
      setCurrentTitlePenaltyIndex(currentTitlePenaltyIndex + 1);
    } else {
      // All titles resolved, move to rewards
      setShowTitleModal(false);
      if (rewardPenalties.length > 0) {
        setCurrentRewardPenaltyIndex(0);
        setShowRewardModal(true);
      }
    }
  }, [
    currentTitlePenalty,
    hasAutowinner,
    tiedMembersForCurrentTitle,
    winners,
    currentTitlePenaltyIndex,
    titlePenalties.length,
    rewardPenalties.length,
  ]);

  /**
   * Handle title selection
   */
  const handleSelectWinner = useCallback((memberId: string) => {
    if (!currentTitlePenalty) return;

    const newWinners = { ...winners, [currentTitlePenalty.id]: memberId };
    setWinners(newWinners);

    // Write system=2 log
    createLog({
      sessionId,
      clubId,
      memberId,
      penaltyId: currentTitlePenalty.id,
      system: 2,
      timestamp: new Date().toISOString(),
      note: `Winner selected for ${currentTitlePenalty.name}`,
    });

    // Move to next title penalty
    if (currentTitlePenaltyIndex < titlePenalties.length - 1) {
      setCurrentTitlePenaltyIndex(currentTitlePenaltyIndex + 1);
    } else {
      // All titles resolved, move to rewards
      setShowTitleModal(false);
      if (rewardPenalties.length > 0) {
        setCurrentRewardPenaltyIndex(0);
        setShowRewardModal(true);
      }
    }
  }, [currentTitlePenalty, winners, currentTitlePenaltyIndex, titlePenalties.length, sessionId, clubId, rewardPenalties.length]);

  /**
   * Handle reward value input
   */
  const handleSetRewardValue = useCallback(async () => {
    const value = parseFloat(rewardValueInput);
    if (isNaN(value) || value <= 0) {
      Alert.alert('Invalid Input', 'Please enter a positive number');
      return;
    }

    const currentRewardPenalty = rewardPenalties[currentRewardPenaltyIndex];
    if (!currentRewardPenalty) return;

    const newRewards = { ...rewards, [currentRewardPenalty.id]: value };
    setRewards(newRewards);

    // Get winner (from title resolution or penalty's rewardValue)
    const winnerId = winners[currentRewardPenalty.id];
    if (!winnerId) {
      Alert.alert('Error', 'No winner selected for this reward');
      return;
    }

    // Apply deduction
    const winnerMember = members.find(m => m.id === winnerId);
    if (winnerMember && session) {
      const newTotals = { ...session.totalAmounts };
      newTotals[winnerId] = (newTotals[winnerId] || 0) - value;

      try {
        await updateTotalAmounts(sessionId, newTotals);

        // Write system=6 log
        await createLog({
          sessionId,
          clubId,
          memberId: winnerId,
          penaltyId: currentRewardPenalty.id,
          system: 6,
          amountTotal: -value,
          timestamp: new Date().toISOString(),
          note: `Reward deduction for ${currentRewardPenalty.name}`,
        });
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to apply reward');
        return;
      }
    }

    setRewardValueInput('');

    // Move to next reward penalty
    if (currentRewardPenaltyIndex < rewardPenalties.length - 1) {
      setCurrentRewardPenaltyIndex(currentRewardPenaltyIndex + 1);
    } else {
      // All rewards resolved, finalize
      setShowRewardModal(false);
      await handleFinalize();
    }
  }, [
    rewardValueInput,
    currentRewardPenaltyIndex,
    rewardPenalties,
    rewards,
    winners,
    members,
    session,
    sessionId,
    clubId,
  ]);

  /**
   * Finalize session
   */
  const handleFinalize = useCallback(async () => {
    setIsFinalizing(true);
    try {
      // Convert winners to array format expected by finalizeSession
      const winnersArray: Record<string, string[]> = {};
      for (const [penaltyId, winnerId] of Object.entries(winners)) {
        winnersArray[penaltyId] = [winnerId];
      }
      
      await finalizeSession(sessionId, winnersArray);
      Alert.alert(
        'Session Finalized',
        'Your session has been completed successfully.',
        [
          {
            text: 'View Details',
            onPress: () => {
              navigation.navigate('SessionDetails', { sessionId, clubId, clubName });
            },
          },
        ]
      );
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to finalize session');
    } finally {
      setIsFinalizing(false);
    }
  }, [sessionId, clubId, clubName, navigation, winners]);

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
        <Text style={styles.title}>Session Summary</Text>
        <Text style={styles.subtitle}>
          {titlePenalties.length > 0
            ? `Resolving ${titlePenalties.length} title(s)...`
            : 'No titles to resolve'}
        </Text>
        {rewardPenalties.length > 0 && (
          <Text style={styles.subtitle}>
            {rewardPenalties.length} reward value(s) to enter
          </Text>
        )}

        {/* Final Totals Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Member Commit Counts</Text>
          {members.map(member => (
            <View key={member.id} style={styles.memberCommitsCard}>
              <Text style={styles.memberName}>{member.name}</Text>
              <View style={styles.commitsGrid}>
                {penalties.filter(p => p.active).map(penalty => (
                  <View key={penalty.id} style={styles.commitItemRow}>
                    <Text style={styles.commitLabel}>{penalty.name}:</Text>
                    <Text style={styles.commitValue}>
                      {commitSummary[member.id]?.[penalty.id] || 0}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* Title Resolution Modal - Only shows for tied titles */}
      {currentTitlePenalty && !hasAutowinner && (
        <Modal visible={showTitleModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Select winner for {currentTitlePenalty.name}
              </Text>

              <Text style={styles.modalSubtitle}>
                Multiple members tied with {
                  Math.max(
                    ...Object.values(
                      commitSummary[currentTitlePenalty.id] || {}
                    )
                  )
                } commits
              </Text>
              <View style={styles.optionsList}>
                {tiedMembersForCurrentTitle.map(member => (
                  <TouchableOpacity
                    key={member.id}
                    style={styles.optionButton}
                    onPress={() => handleSelectWinner(member.id)}
                  >
                    <Text style={styles.optionText}>{member.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </Modal>
      )}

      {/* Reward Value Modal */}
      {rewardPenalties[currentRewardPenaltyIndex] && (
        <Modal visible={showRewardModal} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                Enter reward value for {rewardPenalties[currentRewardPenaltyIndex].name}
              </Text>
              <Text style={styles.modalSubtitle}>
                Will be deducted from {
                  members.find(m => m.id === winners[rewardPenalties[currentRewardPenaltyIndex].id])?.name
                }'s total
              </Text>
              <TextInput
                style={styles.rewardInput}
                placeholder="Enter amount (e.g., 5.50)"
                keyboardType="decimal-pad"
                value={rewardValueInput}
                onChangeText={setRewardValueInput}
              />
              <View style={styles.rewardPreview}>
                <Text style={styles.previewLabel}>Updated Total:</Text>
                <Text style={styles.previewValue}>
                  {(
                    (session.totalAmounts[
                      winners[rewardPenalties[currentRewardPenaltyIndex].id]
                    ] || 0) - (parseFloat(rewardValueInput) || 0)
                  ).toFixed(2)}
                </Text>
              </View>
              <TouchableOpacity
                style={styles.confirmButton}
                onPress={handleSetRewardValue}
                disabled={!rewardValueInput || isNaN(parseFloat(rewardValueInput))}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  section: {
    marginVertical: 20,
    padding: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
    marginBottom: 12,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  memberCommitsCard: {
    backgroundColor: '#fff',
    borderRadius: 6,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#eee',
  },
  commitsGrid: {
    marginTop: 8,
  },
  commitItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  commitLabel: {
    fontSize: 13,
    color: '#666',
  },
  commitValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#007AFF',
  },
  memberName: {
    fontSize: 14,
    color: '#000',
  },
  totalAmount: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  autoWinnerText: {
    fontSize: 14,
    color: '#00AA00',
    fontWeight: '600',
    marginVertical: 16,
    textAlign: 'center',
  },
  optionsList: {
    marginVertical: 16,
  },
  optionButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginBottom: 8,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 8,
  },
  optionText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#007AFF',
    textAlign: 'center',
  },
  nextButton: {
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 12,
  },
  nextButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  rewardInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginVertical: 12,
  },
  rewardPreview: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: '#f5f5f5',
    borderRadius: 8,
    marginBottom: 16,
  },
  previewLabel: {
    fontSize: 12,
    color: '#666',
  },
  previewValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  confirmButton: {
    paddingVertical: 12,
    backgroundColor: '#007AFF',
    borderRadius: 8,
    alignItems: 'center',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  errorText: {
    fontSize: 16,
    color: '#f00',
    textAlign: 'center',
    marginTop: 20,
  },
});

export default SessionEndSummaryScreenNew;
