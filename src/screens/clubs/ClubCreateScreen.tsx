/**
 * ClubCreateScreen
 * 
 * Create a new club.
 * Features:
 * - Name input (required)
 * - Logo picker (optional)
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
  Image,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { createClub } from '../../services/clubService';
import * as ImagePicker from 'react-native-image-picker';

export default function ClubCreateScreen() {
  const navigation = useNavigation();
  const [name, setName] = useState('');
  const [maxMultiplier, setMaxMultiplier] = useState('10');
  const [logoUri, setLogoUri] = useState<string | undefined>(undefined);
  // create-club: added currency, timezone, time format fields
  const [currency, setCurrency] = useState<string>('€');
  const [timezone, setTimezone] = useState<string>('CET');
  const [timeFormat, setTimeFormat] = useState<string>('HH:mm');
  const [showTimezoneOptions, setShowTimezoneOptions] = useState(false);
  const [showTimeFormatOptions, setShowTimeFormatOptions] = useState(false);
  const [saving, setSaving] = useState(false);

  const timezoneOptions = ['CET', 'UTC', 'EST', 'PST', 'Asia/Kolkata'];
  const timeFormatOptions = ['HH:mm', 'h:mm a', 'HH:mm:ss'];

  const handlePickLogo = () => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: 'photo',
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets.length > 0) {
          setLogoUri(response.assets[0].uri);
        }
      }
    );
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
      // create-club: include currency, timezone, time format in payload with safe defaults
      await createClub({
        name: name.trim(),
        logoUri,
        maxMultiplier: multiplierNum,
        currency: currency.trim() || '€',
        timezone: timezone || 'CET',
        timeFormat: timeFormat || 'HH:mm',
      });
      
      Alert.alert('Success', 'Club created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error creating club:', error);
      Alert.alert('Error', 'Failed to create club');
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
        <Text style={styles.sectionTitle}>Club Settings</Text>
        <Text style={styles.sectionDescription}>
          Configure the basics for this club: currency, timezone, time format, maximum multiplier, and logo.
        </Text>

        <Text style={styles.label}>Club Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter club name"
          autoFocus
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
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0F172A',
    marginTop: 4,
    marginBottom: 6,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#64748B',
    marginBottom: 12,
    lineHeight: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
    marginTop: 16,
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
  buttonDisabled: {
    opacity: 0.5,
  },
});
