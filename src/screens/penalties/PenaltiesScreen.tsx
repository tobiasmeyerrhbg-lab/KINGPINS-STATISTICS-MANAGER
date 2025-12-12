/**
 * PenaltiesScreen
 * 
 * Shows penalties for a single club.
 * Entry point for penalty management from club detail.
 * 
 * Features:
 * - Lists all penalties for the club
 * - Filter by active/inactive status
 * - Affect badges, title badges, reward badges
 * - Tap penalty → navigate to PenaltyEditScreen
 * - FAB → navigate to PenaltyCreateScreen
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute } from '@react-navigation/native';
import { getPenaltiesByClub, Penalty, createPenalty } from '../../services/penaltyService';

interface PenaltySection {
  clubName: string;
  clubId: string;
  data: Penalty[];
}

export default function PenaltiesScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId, clubName } = route.params as { clubId: string; clubName?: string };
  const [sections, setSections] = useState<PenaltySection[]>([]);
  const [showActiveOnly, setShowActiveOnly] = useState(true);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [clubId, showActiveOnly])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      console.log('[PenaltiesScreen] Loading penalties for clubId:', clubId);
      let penalties = await getPenaltiesByClub(clubId);
      console.log('[PenaltiesScreen] Loaded penalties:', penalties.length, 'penalties');
      console.log('[PenaltiesScreen] Penalty data:', JSON.stringify(penalties, null, 2));

      if (showActiveOnly) {
        console.log('[PenaltiesScreen] Filtering to active only');
        penalties = penalties.filter((p) => p.active);
        console.log('[PenaltiesScreen] After filter:', penalties.length, 'penalties');
      }

      penalties.sort((a, b) => {
        if (a.active !== b.active) return a.active ? -1 : 1;
        return a.name.localeCompare(b.name);
      });

      setSections([
        {
          clubName: clubName || 'Penalties',
          clubId,
          data: penalties,
        },
      ]);
    } catch (error) {
      console.error('Error loading penalties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePenaltyPress = (penalty: Penalty) => {
    (navigation as any).navigate('PenaltyEdit', { penaltyId: penalty.id, clubId });
  };

  const handleCreatePress = () => {
    (navigation as any).navigate('PenaltyCreate', { clubId });
  };

  // NEW: Demo Loader - Load Demo Penalties
  const handleLoadDemoPenalties = async () => {
    try {
      setLoading(true);
      
      // Demo Penalty 1: Kegelkönig-Pkt.
      await createPenalty({
        clubId,
        name: 'Kegelkönig-Pkt.',
        description: '',
        amount: 0,
        amountOther: 0,
        affect: 'NONE',
        isTitle: true,
        active: true,
        rewardEnabled: true,
        rewardValue: 0,
      });

      // Demo Penalty 2: Pudel
      await createPenalty({
        clubId,
        name: 'Pudel',
        description: '',
        amount: 0.25,
        amountOther: 0,
        affect: 'SELF',
        isTitle: true,
        active: true,
        rewardEnabled: false,
      });

      // Demo Penalty 3: Fötzken
      await createPenalty({
        clubId,
        name: 'Fötzken',
        description: '',
        amount: 0.5,
        amountOther: 0,
        affect: 'SELF',
        isTitle: true,
        active: true,
        rewardEnabled: false,
      });

      // Demo Penalty 4: Kranz
      await createPenalty({
        clubId,
        name: 'Kranz',
        description: '',
        amount: -3.5,
        amountOther: 0.5,
        affect: 'BOTH',
        isTitle: true,
        active: true,
        rewardEnabled: false,
      });

      // Reload penalties
      await loadData();
    } catch (error) {
      console.error('Error loading demo penalties:', error);
      alert('Failed to load demo penalties');
    } finally {
      setLoading(false);
    }
  };

  const getAffectBadgeColor = (affect: string): string => {
    switch (affect) {
      case 'SELF':
        return '#2196F3';
      case 'OTHER':
        return '#FF9800';
      case 'BOTH':
        return '#4CAF50';
      case 'NONE':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const renderPenaltyCard = ({ item }: { item: Penalty }) => (
    <TouchableOpacity
      style={styles.penaltyCard}
      onPress={() => handlePenaltyPress(item)}
    >
      <View style={styles.penaltyHeader}>
        <Text style={styles.penaltyName}>{item.name}</Text>
        <View style={styles.badgeRow}>
          <View
            style={[
              styles.affectBadge,
              { backgroundColor: getAffectBadgeColor(item.affect) },
            ]}
          >
            <Text style={styles.affectBadgeText}>{item.affect}</Text>
          </View>
          {!item.active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveBadgeText}>Inactive</Text>
            </View>
          )}
          {item.isTitle && (
            <View style={styles.titleBadge}>
              <Text style={styles.titleBadgeText}>Title</Text>
            </View>
          )}
          {item.rewardEnabled && (
            <View style={styles.rewardBadge}>
              <Text style={styles.rewardBadgeText}>Reward</Text>
            </View>
          )}
        </View>
      </View>

      {item.description && (
        <Text style={styles.penaltyDescription} numberOfLines={2}>
          {item.description}
        </Text>
      )}

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Self: €{item.amount.toFixed(2)}</Text>
        <Text style={styles.amountSeparator}>|</Text>
        <Text style={styles.amountLabel}>Other: €{item.amountOther.toFixed(2)}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderSectionHeader = ({ section }: { section: PenaltySection }) => (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionHeaderText}>{section.clubName}</Text>
    </View>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No penalties yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Tap the + button to create your first penalty
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
      {/* Active Filter Toggle & Demo Loader */}
      <View style={styles.filterContainer}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            showActiveOnly && styles.filterButtonActive,
          ]}
          onPress={() => setShowActiveOnly(!showActiveOnly)}
        >
          <Text
            style={[
              styles.filterButtonText,
              showActiveOnly && styles.filterButtonTextActive,
            ]}
          >
            {showActiveOnly ? 'Show All' : 'Show Active Only'}
          </Text>
        </TouchableOpacity>
        
        {/* NEW: Demo Loader Button */}
        <TouchableOpacity
          style={styles.demoButton}
          onPress={handleLoadDemoPenalties}
        >
          <Text style={styles.demoButtonText}>Load Demo-Penalties</Text>
        </TouchableOpacity>
      </View>

      <SectionList
        sections={sections}
        renderItem={renderPenaltyCard}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={(item) => item.id}
        contentContainerStyle={sections.length === 0 ? styles.emptyList : styles.list}
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
  filterContainer: {
    backgroundColor: '#FFFFFF',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  filterButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  filterButtonActive: {
    backgroundColor: '#007AFF',
  },
  filterButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#666666',
  },
  filterButtonTextActive: {
    color: '#FFFFFF',
  },
  // NEW: Demo Loader Button Styles
  demoButton: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#4CAF50',
  },
  demoButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  list: {
    paddingBottom: 80,
  },
  emptyList: {
    flex: 1,
    justifyContent: 'center',
  },
  sectionHeader: {
    backgroundColor: '#E3F2FD',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#BBDEFB',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  penaltyCard: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  penaltyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  penaltyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
    marginRight: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 4,
  },
  affectBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  affectBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  inactiveBadge: {
    backgroundColor: '#757575',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  inactiveBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  titleBadge: {
    backgroundColor: '#9C27B0',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  titleBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  rewardBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  rewardBadgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
  },
  penaltyDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  amountRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  amountLabel: {
    fontSize: 13,
    color: '#333333',
    fontWeight: '500',
  },
  amountSeparator: {
    fontSize: 13,
    color: '#CCCCCC',
    marginHorizontal: 8,
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
    backgroundColor: '#FF5722',
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
});
