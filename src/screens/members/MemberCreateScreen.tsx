/**
 * MemberCreateScreen
 * 
 * Create a new member for a club.
 * Features:
 * - Name input (required)
 * - Guest toggle
 * - Photo picker (optional)
 * - Birthdate picker (optional)
 * - Auto-set joinedAt
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
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { createMember } from '../../services/memberService';
// UPDATED: use shared picker that supports camera or gallery
import { pickImageWithPrompt } from '../../services/imagePickerService';

export default function MemberCreateScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId } = route.params as { clubId: string };

  const [name, setName] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [birthdate, setBirthdate] = useState('');
  const [saving, setSaving] = useState(false);

  const handlePickPhoto = async () => {
    // UPDATED: prompt user to choose camera or library; compressed via shared options
    const uri = await pickImageWithPrompt('photo');
    if (uri) setPhotoUri(uri);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Member name is required');
      return;
    }

    try {
      setSaving(true);
      await createMember({
        clubId,
        name: name.trim(),
        isGuest,
        photoUri,
        birthdate: birthdate || undefined,
      });
      
      Alert.alert('Success', 'Member created successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error creating member:', error);
      Alert.alert('Error', 'Failed to create member');
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
        <Text style={styles.label}>Member Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter member name"
          autoFocus
        />

        <View style={styles.switchRow}>
          <Text style={styles.label}>Guest Member</Text>
          <Switch
            value={isGuest}
            onValueChange={setIsGuest}
            trackColor={{ false: '#DDDDDD', true: '#007AFF' }}
            thumbColor="#FFFFFF"
          />
        </View>

        <Text style={styles.label}>Profile Photo</Text>
        {photoUri ? (
          <View style={styles.photoContainer}>
            <Image source={{ uri: photoUri }} style={styles.photo} />
            <TouchableOpacity
              style={styles.changePhotoButton}
              onPress={handlePickPhoto}
            >
              <Text style={styles.changePhotoText}>Change Photo</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.photoPickerButton}
            onPress={handlePickPhoto}
          >
            <Text style={styles.photoPickerText}>+ Pick Photo</Text>
          </TouchableOpacity>
        )}

        <Text style={styles.label}>Birthdate (Optional)</Text>
        <TextInput
          style={styles.input}
          value={birthdate}
          onChangeText={setBirthdate}
          placeholder="YYYY-MM-DD"
        />

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
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#DDDDDD',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 16,
    marginBottom: 8,
  },
  photoContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  photo: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: 12,
  },
  changePhotoButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  changePhotoText: {
    color: '#007AFF',
    fontSize: 16,
  },
  photoPickerButton: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#DDDDDD',
    borderStyle: 'dashed',
  },
  photoPickerText: {
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
