/**
 * PenaltyCreateScreen
 * 
 * Create a new penalty for a club.
 * Features:
 * - All penalty fields with proper controls
 * - Affect selector (SELF/OTHER/BOTH/NONE)
 * - Toggles for isTitle, active, rewardEnabled
 * - Optional rewardValue (enabled only if rewardEnabled = true)
 * - Save/Cancel buttons
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createPenalty, PenaltyAffect } from '../../services/penaltyService';

const AFFECT_OPTIONS: PenaltyAffect[] = ['SELF', 'OTHER', 'BOTH', 'NONE'];

export default function PenaltyCreateScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId } = route.params as { clubId: string };

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [amountOther, setAmountOther] = useState('');
  const [affect, setAffect] = useState<PenaltyAffect>('SELF');
  const [isTitle, setIsTitle] = useState(false);
  const [active, setActive] = useState(true);
  const [rewardEnabled, setRewardEnabled] = useState(false);
  const [rewardValue, setRewardValue] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Penalty name is required');
      return;
    }

    const amountNum = parseFloat(amount);
    const amountOtherNum = parseFloat(amountOther);
    let normalizedAmount = 0;
    let normalizedAmountOther = 0;

    switch (affect) {
      case 'SELF':
        if (Number.isNaN(amountNum)) {
          Alert.alert('Error', 'Amount (SELF) is required when Affect is SELF.');
          return;
        }
        normalizedAmount = amountNum;
        normalizedAmountOther = 0;
        break;
      case 'OTHER':
        if (Number.isNaN(amountOtherNum)) {
          Alert.alert('Error', 'Amount (OTHER) is required when Affect is OTHER.');
          return;
        }
        normalizedAmount = 0;
        normalizedAmountOther = amountOtherNum;
        break;
      case 'BOTH':
        if (Number.isNaN(amountNum) || Number.isNaN(amountOtherNum)) {
          Alert.alert('Error', 'Amount (SELF) and Amount (OTHER) are required when Affect is BOTH.');
          return;
        }
        normalizedAmount = amountNum;
        normalizedAmountOther = amountOtherNum;
        break;
      case 'NONE':
        normalizedAmount = 0;
        normalizedAmountOther = 0;
        break;
      default:
        Alert.alert('Error', 'Affect selection is invalid');
        return;
    }

    try {
      setSaving(true);
      await createPenalty({
        clubId,
        name: name.trim(),
        description: description.trim() || undefined,
        amount: normalizedAmount,
        amountOther: normalizedAmountOther,
        affect,
        isTitle,
        active,
        rewardEnabled,
        rewardValue: rewardEnabled && rewardValue ? parseFloat(rewardValue) : undefined,
      });
      
      Alert.alert('Success', 'Penalty created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error creating penalty:', error);
      Alert.alert('Error', 'Failed to create penalty');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Penalty Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter penalty name"
          autoFocus
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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
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
  buttonDisabled: {
    opacity: 0.5,
  },
});
