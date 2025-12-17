/**
 * MembersScreen
 * 
 * Shows all members across all clubs with club filtering.
 * Entry point for member management from main tab bar.
 * 
 * Features:
 * - Lists all members with photo, name, club badge
 * - Filter by club (dropdown selector)
 * - Guest badge indicator
 * - Tap member → navigate to MemberEditScreen
 * - FAB → show club selector, then navigate to MemberCreateScreen
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
  Modal,
  ScrollView,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { getAllClubs, Club } from '../../services/clubService';
import { getMembersByClub, Member } from '../../services/memberService';

interface MemberWithClub extends Member {
  clubName: string;
}

export default function MembersScreen() {
  const navigation = useNavigation();
  const [clubs, setClubs] = useState<Club[]>([]);
  const [members, setMembers] = useState<MemberWithClub[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<MemberWithClub[]>([]);
  const [selectedClubId, setSelectedClubId] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [clubSelectorVisible, setClubSelectorVisible] = useState(false);
  const [showClubFilter, setShowClubFilter] = useState(false);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  useEffect(() => {
    applyFilter();
  }, [selectedClubId, members]);

  const loadData = async () => {
    try {
      setLoading(true);
      const clubData = await getAllClubs();
      setClubs(clubData);

      // Load all members from all clubs
      const allMembers: MemberWithClub[] = [];
      for (const club of clubData) {
        const clubMembers = await getMembersByClub(club.id);
        clubMembers.forEach((member) => {
          allMembers.push({
            ...member,
            clubName: club.name,
          });
        });
      }

      // Sort alphabetically by name
      allMembers.sort((a, b) => a.name.localeCompare(b.name));
      setMembers(allMembers);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    if (selectedClubId === 'all') {
      setFilteredMembers(members);
    } else {
      setFilteredMembers(members.filter((m) => m.clubId === selectedClubId));
    }
  };

  const handleMemberPress = (member: Member) => {
    (navigation as any).navigate('MemberEdit', { memberId: member.id });
  };

  const handleCreatePress = () => {
    if (clubs.length === 0) {
      alert('Please create a club first');
      return;
    }
    setClubSelectorVisible(true);
  };

  const handleClubSelected = (clubId: string) => {
    setClubSelectorVisible(false);
    (navigation as any).navigate('MemberCreate', { clubId });
  };

  const renderMemberCard = ({ item }: { item: MemberWithClub }) => (
    <TouchableOpacity
      style={styles.memberCard}
      onPress={() => handleMemberPress(item)}
    >
      <View style={styles.memberPhotoContainer}>
        {item.photoUri ? (
          <Image source={{ uri: item.photoUri }} style={styles.memberPhoto} />
        ) : (
          <Image
            source={require('../../../assets/images/dummy/default_member.png')}
            style={styles.memberPhoto}
          />
        )}
      </View>

      <View style={styles.memberInfo}>
        <View style={styles.memberNameRow}>
          <Text style={styles.memberName}>{item.name}</Text>
          {item.isGuest && (
            <View style={styles.guestBadge}>
              <Text style={styles.guestBadgeText}>Guest</Text>
            </View>
          )}
        </View>
        <View style={styles.clubBadge}>
          <Text style={styles.clubBadgeText}>{item.clubName}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderClubSelector = () => (
    <Modal
      visible={clubSelectorVisible}
      transparent
      animationType="fade"
      onRequestClose={() => setClubSelectorVisible(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setClubSelectorVisible(false)}
      >
        <View style={styles.modalDialog}>
          <Text style={styles.modalTitle}>Select Club</Text>
          {clubs.map((club) => (
            <TouchableOpacity
              key={club.id}
              style={styles.modalClubItem}
              onPress={() => handleClubSelected(club.id)}
            >
              {club.logoUri ? (
                <Image source={{ uri: club.logoUri }} style={styles.modalClubLogo} />
              ) : (
                <View style={styles.modalClubLogoPlaceholder}>
                  <Text style={styles.modalClubLogoText}>
                    {club.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
              )}
              <Text style={styles.modalClubName}>{club.name}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={styles.modalCancelButton}
            onPress={() => setClubSelectorVisible(false)}
          >
            <Text style={styles.modalCancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No members yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Tap the + button to add your first member
      </Text>
    </View>
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
      {/* Club Filter */}
      {clubs.length > 1 && (
        <View style={styles.filterContainer}>
          <Text style={styles.filterLabel}>Filter by Club:</Text>
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => setShowClubFilter(true)}
          >
            <Text style={styles.filterButtonText}>
              {selectedClubId === 'all'
                ? 'All Clubs'
                : clubs.find((c) => c.id === selectedClubId)?.name || 'Select Club'}
            </Text>
            <Text style={styles.filterButtonArrow}>▼</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Club Filter Modal */}
      <Modal
        visible={showClubFilter}
        transparent
        animationType="fade"
        onRequestClose={() => setShowClubFilter(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setShowClubFilter(false)}
        >
          <View style={styles.filterModalContent}>
            <Text style={styles.filterModalTitle}>Select Club</Text>
            <ScrollView style={styles.clubList}>
              <TouchableOpacity
                style={styles.clubOption}
                onPress={() => {
                  setSelectedClubId('all');
                  setShowClubFilter(false);
                }}
              >
                <Text
                  style={[
                    styles.clubOptionText,
                    selectedClubId === 'all' && styles.clubOptionSelected,
                  ]}
                >
                  All Clubs
                </Text>
              </TouchableOpacity>
              {clubs.map((club) => (
                <TouchableOpacity
                  key={club.id}
                  style={styles.clubOption}
                  onPress={() => {
                    setSelectedClubId(club.id);
                    setShowClubFilter(false);
                  }}
                >
                  <Text
                    style={[
                      styles.clubOptionText,
                      selectedClubId === club.id && styles.clubOptionSelected,
                    ]}
                  >
                    {club.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      <FlatList
        data={filteredMembers}
        renderItem={renderMemberCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          filteredMembers.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
      />

      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleCreatePress}>
        <Text style={styles.fabText}>+</Text>
      </TouchableOpacity>

      {renderClubSelector()}
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
    backgroundColor: '#F5F5F5',
  },
  filterContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  picker: {
    height: 40,
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  memberCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  memberPhotoContainer: {
    marginRight: 16,
  },
  memberPhoto: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  memberInfo: {
    flex: 1,
  },
  memberNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginRight: 8,
  },
  guestBadge: {
    backgroundColor: '#FF9800',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  guestBadgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  clubBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  clubBadgeText: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
  },
  emptyState: {
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyStateText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptyStateSubtext: {
    fontSize: 16,
    color: '#999999',
    textAlign: 'center',
  },
  fab: {
    position: 'absolute',
    right: 24,
    bottom: 24,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabText: {
    fontSize: 32,
    color: '#FFFFFF',
    fontWeight: '300',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalDialog: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 20,
    width: '80%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
    textAlign: 'center',
  },
  modalClubItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    marginBottom: 8,
    backgroundColor: '#F5F5F5',
  },
  modalClubLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  modalClubLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  modalClubLogoText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  modalClubName: {
    fontSize: 16,
    color: '#000000',
  },
  modalCancelButton: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButtonText: {
    fontSize: 16,
    color: '#666666',
    fontWeight: '600',
  },
  filterButton: {
    backgroundColor: '#F5F5F5',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  filterButtonText: {
    fontSize: 14,
    color: '#333333',
    fontWeight: '500',
  },
  filterButtonArrow: {
    fontSize: 12,
    color: '#666666',
    marginLeft: 8,
  },
  filterModalContent: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    maxHeight: '60%',
  },
  filterModalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
    textAlign: 'center',
  },
  clubList: {
    maxHeight: 300,
  },
  clubOption: {
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  clubOptionText: {
    fontSize: 16,
    color: '#333333',
  },
  clubOptionSelected: {
    fontWeight: '600',
    color: '#007AFF',
  },
});
