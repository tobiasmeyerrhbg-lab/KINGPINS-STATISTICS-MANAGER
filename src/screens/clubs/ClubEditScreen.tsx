/**
 * ClubEditScreen
 * 
 * Edit an existing club.
 * Features:
 * - Name input (required)
 * - Logo picker (optional)
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
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Club, getClub, updateClub, deleteClub } from '../../services/clubService';
import { getPenaltiesByClub } from '../../services/penaltyService';
import { loadGraphOptions, saveGraphOptions } from '../../services/graphOptionsService';
// UPDATED: use shared picker that supports camera or gallery
import { pickImageWithPrompt } from '../../services/imagePickerService';

export default function ClubEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId } = route.params as { clubId: string };

  const [club, setClub] = useState<Club | null>(null);
  const [name, setName] = useState('');
  const [logoUri, setLogoUri] = useState<string | undefined>(undefined);
  const [maxMultiplier, setMaxMultiplier] = useState('10');
  const [currency, setCurrency] = useState<string>('€');
  const [timezone, setTimezone] = useState<string>('CET');
  const [timeFormat, setTimeFormat] = useState<string>('HH:mm');
  const [showTimezoneOptions, setShowTimezoneOptions] = useState(false);
  const [showTimeFormatOptions, setShowTimeFormatOptions] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [penalties, setPenalties] = useState<any[]>([]);
  const [defaultComparePenaltyIds, setDefaultComparePenaltyIds] = useState<string[]>([]);

  const timezoneOptions = ['CET', 'UTC', 'EST', 'PST', 'Asia/Kolkata'];
  const timeFormatOptions = ['HH:mm', 'h:mm a', 'HH:mm:ss'];

  useEffect(() => {
    loadClub();
    (async () => {
      const list = await getPenaltiesByClub(clubId);
      setPenalties(list);
      const opts = await loadGraphOptions(clubId);
      setDefaultComparePenaltyIds(opts?.comparePenaltyIds || []);
    })();
  }, [clubId]);

  const loadClub = async () => {
    try {
      setLoading(true);
      const data = await getClub(clubId);
      if (data) {
        setClub(data);
        setName(data.name);
        setLogoUri(data.logoUri);
        setMaxMultiplier(String(data.maxMultiplier));
        setCurrency(data.currency || '€');
        setTimezone(data.timezone || 'CET');
        setTimeFormat(data.timeFormat || 'HH:mm');
      } else {
        Alert.alert('Error', 'Club not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error loading club:', error);
      Alert.alert('Error', 'Failed to load club');
    } finally {
      setLoading(false);
    }
  };

  const handlePickLogo = async () => {
    // UPDATED: prompt user to choose camera or library; compressed via shared options
    const uri = await pickImageWithPrompt('logo');
    if (uri) setLogoUri(uri);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Club name is required');
      return;
    }

    const multiplierNum = parseInt(maxMultiplier, 10);
    if (isNaN(multiplierNum) || multiplierNum < 1) {
      Alert.alert('Error', 'Max Multiplier must be a number greater than 0');
      return;
    }

    try {
      setSaving(true);
      await updateClub(clubId, {
        name: name.trim(),
        logoUri,
        maxMultiplier: multiplierNum,
        currency: currency.trim() || null,
        timezone: timezone || 'CET',
        timeFormat,
      });
      await saveGraphOptions(clubId, { comparePenaltyIds: defaultComparePenaltyIds });
      
      Alert.alert('Success', 'Club updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating club:', error);
      Alert.alert('Error', 'Failed to update club');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Club',
      `Are you sure you want to delete "${club?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteClub(clubId);
              Alert.alert('Success', 'Club deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error('Error deleting club:', error);
              Alert.alert('Error', 'Failed to delete club');
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

  if (!club) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Club Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter club name"
        />

        <Text style={styles.label}>Currency</Text>
        <TextInput
          style={styles.input}
          value={currency}
          onChangeText={setCurrency}
          placeholder="€, $, £"
        />

        <Text style={styles.label}>Timezone</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowTimezoneOptions(!showTimezoneOptions)}
        >
          <Text style={styles.dropdownValue}>{timezone}</Text>
        </TouchableOpacity>
        {showTimezoneOptions && (
          <View style={styles.dropdownList}>
            {timezoneOptions.map(tz => (
              <TouchableOpacity
                key={tz}
                style={styles.dropdownItem}
                onPress={() => {
                  setTimezone(tz);
                  setShowTimezoneOptions(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{tz}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Time Format</Text>
        <TouchableOpacity
          style={styles.dropdown}
          onPress={() => setShowTimeFormatOptions(!showTimeFormatOptions)}
        >
          <Text style={styles.dropdownValue}>{timeFormat}</Text>
        </TouchableOpacity>
        {showTimeFormatOptions && (
          <View style={styles.dropdownList}>
            {timeFormatOptions.map(fmt => (
              <TouchableOpacity
                key={fmt}
                style={styles.dropdownItem}
                onPress={() => {
                  setTimeFormat(fmt);
                  setShowTimeFormatOptions(false);
                }}
              >
                <Text style={styles.dropdownItemText}>{fmt}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <Text style={styles.label}>Max Multiplier</Text>
        <TextInput
          style={styles.input}
          value={maxMultiplier}
          onChangeText={setMaxMultiplier}
          placeholder="Enter max multiplier"
          keyboardType="number-pad"
        />

        <Text style={styles.label}>Club Logo</Text>
        {logoUri ? (
          <View style={styles.logoContainer}>
            <Image source={{ uri: logoUri }} style={styles.logo} />
            <TouchableOpacity
              style={styles.changeLogoButton}
              onPress={handlePickLogo}
            >
              <Text style={styles.changeLogoText}>Change Logo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.logoPickerButton}
            onPress={handlePickLogo}
          >
            <Text style={styles.logoPickerText}>+ Pick Logo</Text>
          </TouchableOpacity>
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

        {/* Default Graphs Section */}
        <View style={styles.sectionDivider} />
        <Text style={styles.sectionTitle}>Default Graphs</Text>
        <Text style={styles.sectionDescription}>
          Select which penalties should be displayed as comparison graphs by default in the Session Analysis screen.
        </Text>
        <View style={styles.dropdownList}>
          {penalties.map(p => {
            const selected = defaultComparePenaltyIds.includes(p.id);
            return (
              <TouchableOpacity
                key={p.id}
                style={[styles.dropdownItem, selected && { backgroundColor: '#dbeafe' }]}
                onPress={() => {
                  setDefaultComparePenaltyIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id]);
                }}
              >
                <Text style={styles.dropdownItemText}>{p.name}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
        <TouchableOpacity
          style={[styles.button, styles.saveButton]}
          onPress={async () => {
            await saveGraphOptions(clubId, { comparePenaltyIds: defaultComparePenaltyIds });
            Alert.alert('Saved', 'Default graphs updated successfully');
          }}
        >
          <Text style={styles.saveButtonText}>Save Default Graphs</Text>
        </TouchableOpacity>

        {/* Delete Club - moved to bottom */}
        <View style={styles.dangerZoneDivider} />
        <TouchableOpacity
          style={[styles.deleteButton, saving && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={saving}
        >
          <Text style={styles.deleteButtonText}>Delete Club</Text>
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
  sectionDivider: {
    height: 1,
    backgroundColor: '#E2E8F0',
    marginVertical: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 16,
    lineHeight: 20,
  },
  dangerZoneDivider: {
    height: 1,
    backgroundColor: '#FCA5A5',
    marginVertical: 48,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  dropdown: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownValue: {
    fontSize: 16,
    color: '#000000',
  },
  dropdownList: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDDDDD',
    marginTop: 6,
    overflow: 'hidden',
  },
  dropdownItem: {
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  dropdownItemText: {
    fontSize: 16,
    color: '#000000',
  },
  logoContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  logo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  changeLogoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changeLogoText: {
    color: '#007AFF',
    fontSize: 16,
  },
  logoPickerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DDDDDD',
    borderStyle: 'dashed',
  },
  logoPickerText: {
    fontSize: 16,
    color: '#007AFF',
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
