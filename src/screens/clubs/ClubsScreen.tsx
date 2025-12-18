/**
 * ClubsScreen
 * 
 * Main landing screen showing all clubs.
 * Entry point for club management from main tab bar.
 * 
 * Features:
 * - Lists all clubs with logo, name, member count
 * - Tap club card → navigate to ClubEditScreen
 * - FAB → navigate to ClubCreateScreen
 * - Empty state when no clubs exist
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { Club, getAllClubs, createClub } from '../../services/clubService';
import { getMembersByClub } from '../../services/memberService';
import { db } from '../../database/db';
import ClubLogo from '../../components/ClubLogo';

interface ClubWithCount extends Club {
  memberCount: number;
}

export default function ClubsScreen() {
  const navigation = useNavigation();
  const [clubs, setClubs] = useState<ClubWithCount[]>([]);
  const [loading, setLoading] = useState(true);
  // UPDATED: Demo Loader - track if demo club was loaded to hide button
  const [demoLoaded, setDemoLoaded] = useState(false);

  // Reload clubs when screen comes into focus
  useFocusEffect(
    useCallback(() => {
      loadClubs();
    }, [])
  );

  const loadClubs = async () => {
    try {
      setLoading(true);
      const clubData = await getAllClubs();
      
      // Get member count for each club
      const clubsWithCounts = await Promise.all(
        clubData.map(async (club) => {
          const members = await getMembersByClub(club.id);
          return {
            ...club,
            memberCount: members.length,
          };
        })
      );
      
      // Sort alphabetically by name
      clubsWithCounts.sort((a, b) => a.name.localeCompare(b.name));
      
      setClubs(clubsWithCounts);
    } catch (error) {
      console.error('Error loading clubs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClubPress = (club: Club) => {
    (navigation as any).navigate('ClubDetail', { clubId: club.id, clubName: club.name });
  };

  const handleCreatePress = () => {
    (navigation as any).navigate('ClubCreate');
  };

  // UPDATED: Demo Loader - Load Demo Club (einmalig, dann Button ausblenden)
  const handleLoadDemoClub = async () => {
    try {
      setLoading(true);
      
      // Check if club already exists
      const existingClubs = await getAllClubs();
      const demoExists = existingClubs.find(c => c.name === 'Berka Kingpins');
      
      if (demoExists) {
        // Navigate to existing demo club
        setDemoLoaded(true);
        (navigation as any).navigate('ClubDetail', { 
          clubId: demoExists.id, 
          clubName: demoExists.name 
        });
        return;
      }
      
      // Create new demo club
      const newClub = await createClub({
        name: 'Berka Kingpins',
        maxMultiplier: 10,
        currency: '€',
        timezone: 'CET',
        timeFormat: 'HH:mm',
      });

      // Reload clubs and hide button
      await loadClubs();
      setDemoLoaded(true);
      
      // Navigate to the new club
      (navigation as any).navigate('ClubDetail', { 
        clubId: newClub.id, 
        clubName: newClub.name 
      });
    } catch (error) {
      console.error('Error loading demo club:', error);
      alert('Failed to load demo club');
    } finally {
      setLoading(false);
    }
  };

  // NEW: Reset DB and reload
  const handleResetDatabase = async () => {
    Alert.alert(
      'Reset Database',
      'This will delete all data and reinitialize the database. Continue?',
      [
        {
          text: 'Cancel',
          onPress: () => {},
          style: 'cancel',
        },
        {
          text: 'Delete All',
          onPress: async () => {
            try {
              setLoading(true);
              // Reset database (drops all tables and re-runs migrations)
              await db.reset();
              // Reload clubs
              await loadClubs();
              Alert.alert('Success', 'Database reset and reinitialized');
            } catch (error: any) {
              console.error('Error resetting database:', error);
              Alert.alert('Error', error.message || 'Failed to reset database');
            } finally {
              setLoading(false);
            }
          },
          style: 'destructive',
        },
      ]
    );
  };

  const renderClubCard = ({ item }: { item: ClubWithCount }) => (
    <TouchableOpacity
      style={styles.clubCard}
      onPress={() => handleClubPress(item)}
    >
      <View style={styles.clubLogoContainer}>
        <ClubLogo logoUri={item.logoUri} style={styles.clubLogo} resizeMode="cover" />
      </View>
      
      <View style={styles.clubInfo}>
        <Text style={styles.clubName}>{item.name}</Text>
        <Text style={styles.clubDate}>
          Created {new Date(item.createdAt).toLocaleDateString()}
        </Text>
      </View>
      
      <View style={styles.memberCountBadge}>
        <Text style={styles.memberCountText}>{item.memberCount}</Text>
        <Text style={styles.memberCountLabel}>members</Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No clubs yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Tap the + button to create your first club
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
      {/* UPDATED: Demo Loader Button (ausgeblendet nach Verwendung) + Reset Button */}
      <View style={styles.headerContainer}>
        {!demoLoaded && (
          <TouchableOpacity
            style={styles.demoButton}
            onPress={handleLoadDemoClub}
          >
            <Text style={styles.demoButtonText}>Load Demo-Club</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.demoButton, styles.resetButton]}
          onPress={handleResetDatabase}
        >
          <Text style={styles.demoButtonText}>Reset DB</Text>
        </TouchableOpacity>
      </View>
      
      <FlatList
        data={clubs}
        renderItem={renderClubCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={clubs.length === 0 ? styles.emptyList : styles.list}
        ListEmptyComponent={renderEmptyState}
      />
      
      {/* FAB */}
      <TouchableOpacity style={styles.fab} onPress={handleCreatePress}>
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
    backgroundColor: '#F5F5F5',
  },
  // NEW: Demo Loader Styles
  headerContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
  },
  demoButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  resetButton: {
    backgroundColor: '#F44336',
  },
  demoButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  list: {
    padding: 16,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  clubCard: {
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
  clubLogoContainer: {
    marginRight: 16,
  },
  clubLogo: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  clubLogoPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  clubLogoText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: 'bold',
  },
  clubInfo: {
    flex: 1,
  },
  clubName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 4,
  },
  clubDate: {
    fontSize: 14,
    color: '#666666',
  },
  memberCountBadge: {
    backgroundColor: '#E3F2FD',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  memberCountText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#007AFF',
  },
  memberCountLabel: {
    fontSize: 12,
    color: '#666666',
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
    backgroundColor: '#007AFF',
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
});
