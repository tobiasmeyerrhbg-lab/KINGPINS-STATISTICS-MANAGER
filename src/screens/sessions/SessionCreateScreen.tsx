// UPDATED: SessionCreateScreen with inline member creation
// Allows selecting members and starting a session

import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, SafeAreaView, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { getMembersByClub, Member, createMember } from '../../services/memberService';
import { getPenaltiesByClub } from '../../services/penaltyService';
import { startSession } from '../../services/sessionService';

interface RouteParams {
  clubId: string;
  clubName?: string;
  maxMultiplier?: number;
}

export default function SessionCreateScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId, clubName, maxMultiplier } = route.params as RouteParams;

  const [members, setMembers] = useState<Member[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [penaltyCount, setPenaltyCount] = useState(0);
  // UPDATED: Add state for inline member creation modal
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isGuest, setIsGuest] = useState(false);
  const [creatingMember, setCreatingMember] = useState(false);

  const canStart = selectedIds.length > 0 && penaltyCount > 0;

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        console.log('[SessionCreateScreen] Loading members for clubId:', clubId);
        const [m, penalties] = await Promise.all([
          getMembersByClub(clubId),
          getPenaltiesByClub(clubId),
        ]);
        console.log('[SessionCreateScreen] Loaded members:', m.length, 'members');
        console.log('[SessionCreateScreen] Member details:', m);
        console.log('[SessionCreateScreen] Rendering members:', m); // session-create: added debug log
        setMembers(m);
        setPenaltyCount(penalties.filter(p => p.active).length);
      } catch (err) {
        console.error('[SessionCreateScreen] Failed to load members/penalties', err);
        Alert.alert('Error', 'Failed to load data: ' + (err instanceof Error ? err.message : String(err)));
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [clubId]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  // UPDATED: Handler for inline member creation
  const handleCreateMember = async () => {
    if (!newMemberName.trim()) {
      Alert.alert('Invalid name', 'Please enter a member name');
      return;
    }

    try {
      setCreatingMember(true);
      const newMember = await createMember({
        clubId,
        name: newMemberName.trim(),
        isGuest,
      });
      
      // Refresh members list
      const updatedMembers = await getMembersByClub(clubId);
      setMembers(updatedMembers);
      
      // Auto-select the new member
      setSelectedIds(prev => [...prev, newMember.id]);
      
      // Close modal and reset
      setShowMemberModal(false);
      setNewMemberName('');
      setIsGuest(false);
      
      Alert.alert('Success', `${newMember.name} has been added and selected`);
    } catch (err: any) {
      Alert.alert('Creation failed', err.message || 'Could not create member');
    } finally {
      setCreatingMember(false);
    }
  };

  const handleStart = async () => {
    console.log('[SessionCreateScreen] Start button pressed');
    if (selectedIds.length === 0) {
      Alert.alert('Select members', 'Please select at least one member to start a session.');
      return;
    }
    if (penaltyCount === 0) {
      Alert.alert('No penalties', 'You must have at least one active penalty to start a session.');
      return;
    }

    try {
      setLoading(true);
      console.log('[SessionCreateScreen] Starting session with members:', selectedIds);
      const session = await startSession({
        clubId,
        memberIds: selectedIds,
        initialMultiplier: 1, // per spec, always start at 1
      });
      console.log('[SessionCreateScreen] Session created:', session.id);
      (navigation as any).navigate('SessionLive', {
        sessionId: session.id,
        clubId,
        clubName,
        maxMultiplier,
      });
      console.log('[SessionCreateScreen] Navigation to SessionLive requested');
    } catch (err: any) {
      Alert.alert('Start failed', err.message || 'Could not start session');
    } finally {
      setLoading(false);
    }
  };

  const renderMember = ({ item }: { item: Member }) => {
    const selected = selectedIds.includes(item.id);
    return (
      <TouchableOpacity
        onPress={() => toggleSelect(item.id)}
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: 14,
          marginHorizontal: 12,
          marginVertical: 6,
          borderRadius: 10,
          backgroundColor: '#fff',
          borderWidth: selected ? 2 : 1,
          borderColor: selected ? '#007AFF' : '#e0e0e0',
        }}
      >
        <View>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>{item.name}</Text>
          {item.isGuest && <Text style={{ color: '#ff9500' }}>Guest</Text>}
        </View>
        <View
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            borderWidth: 2,
            borderColor: selected ? '#007AFF' : '#ccc',
            backgroundColor: selected ? '#007AFF' : 'transparent',
          }}
        />
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        <Text style={{ fontSize: 16, fontWeight: '700' }}>Start Session for {clubName || 'Club'}</Text>
        <Text style={{ marginTop: 4, color: '#555' }}>Starting multiplier: 1</Text>
        <Text style={{ marginTop: 2, color: '#555' }}>Active penalties: {penaltyCount}</Text>
        <Text style={{ marginTop: 2, color: '#555' }}>Selected: {selectedIds.length}</Text>
        
        {/* UPDATED: Add New Member button */}
        <TouchableOpacity
          style={{ marginTop: 8, backgroundColor: '#34C759', paddingVertical: 8, borderRadius: 8 }}
          onPress={() => setShowMemberModal(true)}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>+ Add New Member</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={members}
        keyExtractor={(item) => item.id}
        renderItem={renderMember}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666' }}>No members available</Text>
            <Text style={{ fontSize: 14, color: '#999', marginTop: 8 }}>
              Tap "+ Add New Member" above to create your first member
            </Text>
          </View>
        )}
      />

      <View style={{ padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: '#e0e0e0' }}>
        {!canStart && (
          <Text style={{ color: '#ef4444', marginBottom: 8, textAlign: 'center' }}>
            {selectedIds.length === 0
              ? 'Select at least one member to start.'
              : 'No active penalties found. Add/activate a penalty first.'}
          </Text>
        )}
        <TouchableOpacity
          style={{ backgroundColor: canStart ? '#007AFF' : '#94a3b8', paddingVertical: 12, borderRadius: 10 }}
          onPress={handleStart}
          disabled={!canStart}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '700' }}>Start Session</Text>
        </TouchableOpacity>
      </View>

      {/* UPDATED: Inline member creation modal */}
      <Modal visible={showMemberModal} transparent animationType="slide">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 20 }}>
          <View style={{ backgroundColor: '#fff', borderRadius: 12, padding: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Add New Member</Text>
            
            <TextInput
              style={{ borderWidth: 1, borderColor: '#ddd', padding: 10, borderRadius: 8, marginBottom: 12 }}
              placeholder="Member name"
              value={newMemberName}
              onChangeText={setNewMemberName}
              autoFocus
            />
            
            <TouchableOpacity
              style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}
              onPress={() => setIsGuest(!isGuest)}
            >
              <View
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  borderWidth: 2,
                  borderColor: isGuest ? '#007AFF' : '#ccc',
                  backgroundColor: isGuest ? '#007AFF' : 'transparent',
                  marginRight: 8,
                }}
              />
              <Text>Guest member</Text>
            </TouchableOpacity>

            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
              <TouchableOpacity
                onPress={() => {
                  setShowMemberModal(false);
                  setNewMemberName('');
                  setIsGuest(false);
                }}
                style={{ paddingHorizontal: 16, paddingVertical: 10 }}
              >
                <Text style={{ color: '#666' }}>Cancel</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                onPress={handleCreateMember}
                disabled={creatingMember}
                style={{ backgroundColor: '#007AFF', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 8 }}
              >
                {creatingMember ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={{ color: '#fff', fontWeight: '600' }}>Create</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
