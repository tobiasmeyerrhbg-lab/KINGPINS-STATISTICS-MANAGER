/**
 * SessionEndModals Component
 * 
 * Handles all end session modals in sequence:
 * 1. Confirmation modal
 * 2. Title resolution modals (for ties)
 * 3. Reward value input modals
 * 4. Final navigation to SessionDetailsScreen
 */

import React, { useState } from 'react';
import {
  Alert,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {
  prepareTitleResolution,
  prepareRewardResolution,
  finalizeSessionComplete,
  TitleResolutionItem,
  RewardResolutionItem,
} from '../services/sessionFinalizationService';

interface Props {
  sessionId: string;
  clubId: string;
  members: Array<{ id: string; name: string }>;
  penalties: Array<{ id: string; name: string; isTitle: boolean; rewardEnabled: boolean; rewardValue?: number }>;
  visible: boolean;
  onClose: () => void;
  onFinalized: () => void;
}

export function SessionEndModals({
  sessionId,
  clubId,
  members,
  penalties,
  visible,
  onClose,
  onFinalized,
}: Props) {
  // Flow state
  const [step, setStep] = useState<'confirm' | 'titles' | 'rewards' | 'finalizing'>('confirm');
  const [isProcessing, setIsProcessing] = useState(false);

  // Title resolution
  const [titlesToResolve, setTitlesToResolve] = useState<TitleResolutionItem[]>([]);
  const [currentTitleIndex, setCurrentTitleIndex] = useState(0);
  const [selectedWinnerId, setSelectedWinnerId] = useState('');
  const [resolvedWinners, setResolvedWinners] = useState<Record<string, string>>({});

  // Reward resolution
  const [rewardsToResolve, setRewardsToResolve] = useState<RewardResolutionItem[]>([]);
  const [currentRewardIndex, setCurrentRewardIndex] = useState(0);
  const [rewardValueInput, setRewardValueInput] = useState('');
  const [resolvedRewards, setResolvedRewards] = useState<Record<string, { winnerId: string; rewardValue: number }>>({});

  const memberMap: Record<string, string> = {};
  members.forEach(m => memberMap[m.id] = m.name);

  const handleConfirm = async () => {
    setIsProcessing(true);
    try {
      // Prepare title resolution
      const { titlesToResolve: titles, autoResolvedWinners } = await prepareTitleResolution(
        sessionId,
        clubId,
        memberMap
      );

      setResolvedWinners(autoResolvedWinners);

      if (titles.length > 0) {
        // Need user input for tied titles
        setTitlesToResolve(titles);
        setCurrentTitleIndex(0);
        setSelectedWinnerId('');
        setStep('titles');
      } else {
        // No ties, proceed to rewards
        await proceedToRewards(autoResolvedWinners);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to prepare finalization');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTitleConfirm = async () => {
    if (!selectedWinnerId) {
      Alert.alert('Selection Required', 'Please select a winner');
      return;
    }

    const currentTitle = titlesToResolve[currentTitleIndex];
    const newResolvedWinners = {
      ...resolvedWinners,
      [currentTitle.penaltyId]: selectedWinnerId,
    };
    setResolvedWinners(newResolvedWinners);

    if (currentTitleIndex + 1 < titlesToResolve.length) {
      // More titles to resolve
      setCurrentTitleIndex(currentTitleIndex + 1);
      setSelectedWinnerId('');
    } else {
      // All titles resolved, proceed to rewards
      await proceedToRewards(newResolvedWinners);
    }
  };

  const proceedToRewards = async (winners: Record<string, string>) => {
    setIsProcessing(true);
    try {
      const { rewardsToResolve: rewards, autoRewards } = await prepareRewardResolution(
        sessionId,
        clubId,
        winners,
        memberMap
      );

      setResolvedRewards(autoRewards);

      if (rewards.length > 0) {
        // Need user input for rewards
        setRewardsToResolve(rewards);
        setCurrentRewardIndex(0);
        setRewardValueInput('');
        setStep('rewards');
      } else {
        // No rewards needing input, finalize
        await performFinalization(winners, autoRewards);
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to prepare rewards');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRewardConfirm = async () => {
    const value = parseFloat(rewardValueInput);
    if (isNaN(value) || value < 0) {
      Alert.alert('Invalid Input', 'Please enter a valid number (0 or greater)');
      return;
    }

    const currentReward = rewardsToResolve[currentRewardIndex];
    const newResolvedRewards = {
      ...resolvedRewards,
      [currentReward.penaltyId]: {
        winnerId: currentReward.winnerId,
        rewardValue: value,
      },
    };
    setResolvedRewards(newResolvedRewards);

    if (currentRewardIndex + 1 < rewardsToResolve.length) {
      // More rewards to resolve
      setCurrentRewardIndex(currentRewardIndex + 1);
      setRewardValueInput('');
    } else {
      // All rewards resolved, finalize
      await performFinalization(resolvedWinners, newResolvedRewards);
    }
  };

  const performFinalization = async (
    winners: Record<string, string>,
    rewards: Record<string, { winnerId: string; rewardValue: number }>
  ) => {
    setStep('finalizing');
    setIsProcessing(true);
    try {
      await finalizeSessionComplete(sessionId, clubId, winners, rewards);
      onFinalized();
    } catch (error: any) {
      Alert.alert('Finalization Failed', error.message || 'Could not finalize session');
      onClose();
    } finally {
      setIsProcessing(false);
    }
  };

  const renderConfirmModal = () => (
    <Modal visible={visible && step === 'confirm'} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <Text style={styles.modalTitle}>End Session?</Text>
          <Text style={styles.modalSubtitle}>
            Are you sure you want to end this session? This cannot be undone.
          </Text>
          <View style={styles.modalButtons}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isProcessing}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.confirmButton]}
              onPress={handleConfirm}
              disabled={isProcessing}
            >
              {isProcessing ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.confirmButtonText}>Confirm</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  const renderTitleModal = () => {
    if (titlesToResolve.length === 0) return null;
    const currentTitle = titlesToResolve[currentTitleIndex];

    return (
      <Modal visible={visible && step === 'titles'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Select Winner</Text>
            <Text style={styles.modalSubtitle}>
              Choose the winner for {currentTitle.penaltyName}
            </Text>
            <Text style={styles.progressText}>
              Title {currentTitleIndex + 1} of {titlesToResolve.length}
            </Text>

            <ScrollView style={styles.optionsList}>
              {currentTitle.tiedMembers.map((item: { memberId: string; memberName: string; count: number }) => (
                <TouchableOpacity
                  key={item.memberId}
                  style={styles.radioOption}
                  onPress={() => setSelectedWinnerId(item.memberId)}
                >
                  <View style={[
                    styles.radioCircle,
                    selectedWinnerId === item.memberId && styles.radioCircleSelected
                  ]} />
                  <View style={styles.optionContent}>
                    <Text style={styles.optionName}>{item.memberName}</Text>
                    <Text style={styles.optionCount}>{item.count} commits</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleTitleConfirm}
                disabled={!selectedWinnerId}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderRewardModal = () => {
    if (rewardsToResolve.length === 0) return null;
    const currentReward = rewardsToResolve[currentRewardIndex];

    return (
      <Modal visible={visible && step === 'rewards'} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Enter Reward Value</Text>
            <Text style={styles.modalSubtitle}>
              For {currentReward.penaltyName}
            </Text>
            <Text style={styles.rewardInfo}>
              This will be deducted from {currentReward.winnerName}'s total
            </Text>
            <Text style={styles.progressText}>
              Reward {currentRewardIndex + 1} of {rewardsToResolve.length}
            </Text>

            <TextInput
              style={styles.input}
              placeholder="Enter amount"
              keyboardType="numeric"
              value={rewardValueInput}
              onChangeText={setRewardValueInput}
              autoFocus
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.button, styles.confirmButton]}
                onPress={handleRewardConfirm}
                disabled={rewardValueInput.trim() === '' || isNaN(parseFloat(rewardValueInput))}
              >
                <Text style={styles.confirmButtonText}>Confirm</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  const renderFinalizingModal = () => (
    <Modal visible={visible && step === 'finalizing'} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContainer}>
          <ActivityIndicator size="large" color="#007AFF" />
          <Text style={styles.finalizingText}>Finalizing session...</Text>
        </View>
      </View>
    </Modal>
  );

  return (
    <>
      {renderConfirmModal()}
      {renderTitleModal()}
      {renderRewardModal()}
      {renderFinalizingModal()}
    </>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 20,
  },
  modalContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  progressText: {
    fontSize: 12,
    color: '#999',
    marginBottom: 12,
  },
  rewardInfo: {
    fontSize: 13,
    color: '#555',
    marginBottom: 16,
    fontStyle: 'italic',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  optionsList: {
    maxHeight: 300,
    marginBottom: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#ccc',
    marginRight: 12,
  },
  radioCircleSelected: {
    borderColor: '#007AFF',
    backgroundColor: '#007AFF',
  },
  optionContent: {
    flex: 1,
  },
  optionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000',
  },
  optionCount: {
    fontSize: 12,
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    marginBottom: 8,
  },
  finalizingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
  },
});
