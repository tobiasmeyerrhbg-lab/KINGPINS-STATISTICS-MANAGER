/**
 * PenaltyEditScreen
 * 
 * Edit an existing penalty.
 * Features:
 * - All penalty fields with proper controls
 * - Affect selector (SELF/OTHER/BOTH/NONE)
 * - Toggles for isTitle, active, rewardEnabled
 * - Optional rewardValue (enabled only if rewardEnabled = true)
 * - Warning for title penalties
 * - Save/Delete/Cancel buttons
 */

import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Penalty, getPenalty, updatePenalty, deletePenalty, PenaltyAffect } from '../../services/penaltyService';

const AFFECT_OPTIONS: PenaltyAffect[] = ['SELF', 'OTHER', 'BOTH', 'NONE'];

export default function PenaltyEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { penaltyId } = route.params as { penaltyId: string; clubId?: string };

  const [penalty, setPenalty] = useState<Penalty | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [amountOther, setAmountOther] = useState('');
  const [affect, setAffect] = useState<PenaltyAffect>('SELF');
  const [isTitle, setIsTitle] = useState(false);
  const [active, setActive] = useState(true);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardValue, setRewardValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadPenalty();
  }, [penaltyId]);

  const loadPenalty = async () => {
    try {
      setLoading(true);
      const data = await getPenalty(penaltyId);
      if (data) {
        setPenalty(data);
        setName(data.name);
        setDescription(data.description || '');
        setAmount(data.amount.toString());
        setAmountOther(data.amountOther.toString());
        setAffect(data.affect);
        setIsTitle(data.isTitle);
        setActive(data.active);
        setRewardEnabled(data.rewardEnabled);
        setRewardValue(data.rewardValue?.toString() || '');
      } else {
        Alert.alert('Error', 'Penalty not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error loading penalty:', error);
      Alert.alert('Error', 'Failed to load penalty');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Penalty name is required');
      return;
    }

    const amountNum = parseFloat(amount);
    const amountOtherNum = parseFloat(amountOther);

    if (isNaN(amountNum)) {
      Alert.alert('Error', 'Amount (SELF) must be a valid number');
      return;
    }

    if (isNaN(amountOtherNum)) {
      Alert.alert('Error', 'Amount (OTHER) must be a valid number');
      return;
    }

    try {
      setSaving(true);
      await updatePenalty(penaltyId, {
        name: name.trim(),
        description: description.trim() || undefined,
        amount: amountNum,
        amountOther: amountOtherNum,
        affect,
        isTitle,
        active,
        rewardEnabled,
        rewardValue: rewardEnabled && rewardValue ? parseFloat(rewardValue) : undefined,
      });
      
      Alert.alert('Success', 'Penalty updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating penalty:', error);
      Alert.alert('Error', 'Failed to update penalty');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Penalty',
      `Are you sure you want to delete "${penalty?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deletePenalty(penaltyId);
              Alert.alert('Success', 'Penalty deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error('Error deleting penalty:', error);
              Alert.alert('Error', 'Failed to delete penalty');
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!penalty) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Penalty Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter penalty name"
        />

        <Text style={styles.label}>Description</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Optional description"
          multiline
          numberOfLines={3}
        />

        <Text style={styles.label}>Amount (SELF) *</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Amount (OTHER) *</Text>
        <TextInput
          style={styles.input}
          value={amountOther}
          onChangeText={setAmountOther}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />

        <Text style={styles.label}>Affect *</Text>
        <View style={styles.affectContainer}>
          {AFFECT_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.affectButton,
                affect === option && styles.affectButtonSelected,
              ]}
              onPress={() => setAffect(option)}
            >
              <Text
                style={[
                  styles.affectButtonText,
                  affect === option && styles.affectButtonTextSelected,
                ]}
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.switchRow}>
          <View style={styles.switchLabel}>
            <Text style={styles.label}>Title Penalty</Text>
            <Text style={styles.helperText}>Requires selecting exactly one winner at session end</Text>
          </View>
          <Switch
            value={isTitle}
            onValueChange={setIsTitle}
            trackColor={{ false: '#DDDDDD', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {isTitle && (
          <View style={styles.warningBox}>
            <Text style={styles.warningText}>
              ⚠️ Title penalties require selecting exactly one winner at session end.
            </Text>
          </View>
        )}

        <View style={styles.switchRow}>
          <Text style={styles.label}>Active</Text>
          <Switch
            value={active}
            onValueChange={setActive}
            trackColor={{ false: '#DDDDDD', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View style={styles.switchRow}>
          <Text style={styles.label}>Reward Enabled</Text>
          <Switch
            value={rewardEnabled}
            onValueChange={setRewardEnabled}
            trackColor={{ false: '#DDDDDD', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        {rewardEnabled && (
          <>
            <Text style={styles.label}>Reward Value (Optional)</Text>
            <TextInput
              style={styles.input}
              value={rewardValue}
              onChangeText={setRewardValue}
              placeholder="Leave empty to ask at session end"
              keyboardType="decimal-pad"
            />
          </>
        )}

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.button, styles.cancelButton]}
            onPress={handleCancel}
            disabled={saving}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.saveButton, saving && styles.buttonDisabled]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveButtonText}>
              {saving ? 'Saving...' : 'Save'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.deleteButton, saving && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={saving}
        >
          <Text style={styles.deleteButtonText}>Delete Penalty</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    marginTop: 16,
  },
  helperText: {
    fontSize: 12,
    color: '#666666',
    marginTop: 2,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  multiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  affectContainer: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  affectButton: {
    flex: 1,
    minWidth: 70,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#DDDDDD',
    alignItems: 'center',
  },
  affectButtonSelected: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  affectButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  affectButtonTextSelected: {
    color: '#FFFFFF',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  switchLabel: {
    flex: 1,
    marginRight: 16,
  },
  warningBox: {
    backgroundColor: '#FFF3CD',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
    borderWidth: 1,
    borderColor: '#FFD700',
  },
  warningText: {
    fontSize: 14,
    color: '#856404',
  },
  buttonContainer: {
    flexDirection: 'row',
    marginTop: 32,
    gap: 12,
  },
  button: {
    flex: 1,
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
  saveButton: {
    backgroundColor: '#007AFF',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  deleteButton: {
    marginTop: 32,
    padding: 16,
    borderRadius: 8,
    backgroundColor: '#FF3B30',
    alignItems: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
});
