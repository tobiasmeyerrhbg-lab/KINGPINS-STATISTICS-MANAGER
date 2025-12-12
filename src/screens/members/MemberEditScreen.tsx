/**
 * MemberEditScreen
 * 
 * Edit an existing member.
 * Features:
 * - Name input (required)
 * - Guest toggle
 * - Photo picker (optional)
 * - Birthdate picker (optional)
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
  Switch,
} from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { Member, getMember, updateMember, deleteMember } from '../../services/memberService';
import * as ImagePicker from 'react-native-image-picker';

export default function MemberEditScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { memberId } = route.params as { memberId: string; clubId?: string };

  const [member, setMember] = useState<Member | null>(null);
  const [name, setName] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [photoUri, setPhotoUri] = useState<string | undefined>(undefined);
  const [birthdate, setBirthdate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadMember();
  }, [memberId]);

  const loadMember = async () => {
    try {
      setLoading(true);
      const data = await getMember(memberId);
      if (data) {
        setMember(data);
        setName(data.name);
        setIsGuest(data.isGuest);
        setPhotoUri(data.photoUri);
        setBirthdate(data.birthdate || '');
      } else {
        Alert.alert('Error', 'Member not found', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      }
    } catch (error) {
      console.error('Error loading member:', error);
      Alert.alert('Error', 'Failed to load member');
    } finally {
      setLoading(false);
    }
  };

  const handlePickPhoto = () => {
    ImagePicker.launchImageLibrary(
      {
        mediaType: 'photo',
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.8,
      },
      (response) => {
        if (response.assets && response.assets.length > 0) {
          setPhotoUri(response.assets[0].uri);
        }
      }
    );
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Member name is required');
      return;
    }

    try {
      setSaving(true);
      await updateMember(memberId, {
        name: name.trim(),
        isGuest,
        photoUri,
        birthdate: birthdate || undefined,
      });
      
      Alert.alert('Success', 'Member updated successfully', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (error) {
      console.error('Error updating member:', error);
      Alert.alert('Error', 'Failed to update member');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Member',
      `Are you sure you want to delete "${member?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              setSaving(true);
              await deleteMember(memberId);
              Alert.alert('Success', 'Member deleted successfully', [
                { text: 'OK', onPress: () => navigation.goBack() },
              ]);
            } catch (error) {
              console.error('Error deleting member:', error);
              Alert.alert('Error', 'Failed to delete member');
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

  if (!member) {
    return null;
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.label}>Member Name *</Text>
        <TextInput
          style={styles.input}
          value={name}
          onChangeText={setName}
          placeholder="Enter member name"
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

        <TouchableOpacity
          style={[styles.deleteButton, saving && styles.buttonDisabled]}
          onPress={handleDelete}
          disabled={saving}
        >
          <Text style={styles.deleteButtonText}>Delete Member</Text>
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
