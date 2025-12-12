/**
 * MemberListScreen
 * 
 * Displays a list of all members for a specific club.
 * Features:
 * - List all members with photo, name, and guest indicator
 * - Alphabetical sorting (A → Z)
 * - FAB to create new member
 * - Tap item to navigate to edit screen
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Member, getMembersByClub, createMember } from '../../services/memberService';

export default function MemberListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId } = route.params as { clubId: string };

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadMembers();
    }, [clubId])
  );

  const loadMembers = async () => {
    try {
      setLoading(true);
      console.log('[MemberListScreen] Loading members for clubId:', clubId);
      const data = await getMembersByClub(clubId);
      console.log('[MemberListScreen] Loaded members:', data.length, 'members');
      console.log('[MemberListScreen] Member data:', JSON.stringify(data, null, 2));
      setMembers(data);
    } catch (error) {
      console.error('Error loading members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMemberPress = (member: Member) => {
    (navigation as any).navigate('MemberEdit', { memberId: member.id, clubId });
  };

  const handleCreatePress = () => {
    (navigation as any).navigate('MemberCreate', { clubId });
  };

  // NEW: Demo Loader - Load Demo Members
  const handleLoadDemoMembers = async () => {
    try {
      setLoading(true);
      
      // Demo Member 1: Player 1
      await createMember({
        clubId,
        name: 'Player 1',
        isGuest: false,
      });

      // Demo Member 2: Player 2
      await createMember({
        clubId,
        name: 'Player 2',
        isGuest: false,
      });

      // Demo Member 3: Player 3 (Guest)
      await createMember({
        clubId,
        name: 'Player 3',
        isGuest: true,
      });

      // Reload members
      await loadMembers();
    } catch (error) {
      console.error('Error loading demo members:', error);
      alert('Failed to load demo members');
    } finally {
      setLoading(false);
    }
  };

  const renderMemberItem = ({ item }: { item: Member }) => (
    <TouchableOpacity
      style={styles.memberItem}
      onPress={() => handleMemberPress(item)}
    >
      {item.photoUri ? (
        <Image source={{ uri: item.photoUri }} style={styles.photo} />
      ) : (
        <Image
          source={require('../../../assets/images/dummy/default-member.png')}
          style={styles.photo}
        />
      )}
      <View style={styles.memberInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.memberName}>{item.name}</Text>
          {item.isGuest && (
            <View style={styles.guestBadge}>
              <Text style={styles.guestText}>Guest</Text>
            </View>
          )}
        </View>
        {item.birthdate && (
          <Text style={styles.memberDetail}>
            Born: {new Date(item.birthdate).toLocaleDateString()}
          </Text>
        )}
        <Text style={styles.memberDetail}>
          Joined: {new Date(item.joinedAt).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* NEW: Demo Loader Button */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleLoadDemoMembers}
        >
          <Text style={styles.demoButtonText}>Load Demo-Members</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={members}
        renderItem={renderMemberItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No members yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first member
            </Text>
          </View>
        }
      />
      
      {/* FAB - Add Member Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={handleCreatePress}
      >
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>
    </View>
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
  // NEW: Demo Loader Styles
  headerContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
  },
  demoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  memberItem: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  photo: {
    width: 60,
    height: 60,
    borderRadius: 30,
    marginRight: 16,
  },
  memberInfo: {
    flex: 1,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  guestBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guestText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  memberDetail: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 8,
  },
  fabText: {
    color: '#FFFFFF',
    fontSize: 32,
    fontWeight: '300',
  },
});
