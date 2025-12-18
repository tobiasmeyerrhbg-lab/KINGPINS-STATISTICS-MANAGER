/**
 * PenaltyListScreen
 * 
 * Displays a list of all penalties for a specific club.
 * Features:
 * - List all penalties with name, affect badge, active/inactive indicator, reward tag
 * - Alphabetical sorting (A → Z)
 * - FAB to create new penalty
 * - Tap item to navigate to edit screen
 */

import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Text,
  ActivityIndicator,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Penalty, getPenaltiesByClub } from '../../services/penaltyService';

export default function PenaltyListScreen() {
  const navigation = useNavigation<any>();
  const route = useRoute();
  const { clubId } = route.params as { clubId: string };

  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      loadPenalties();
    }, [clubId])
  );

  const loadPenalties = async () => {
    try {
      setLoading(true);
      const data = await getPenaltiesByClub(clubId);
      setPenalties(data);
    } catch (error) {
      console.error('Error loading penalties:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePenaltyPress = (penalty: Penalty) => {
    (navigation as any).navigate('PenaltyEdit', { penaltyId: penalty.id });
  };

  const handleCreatePress = () => {
    (navigation as any).navigate('PenaltyCreate', { clubId });
  };

  const getAffectColor = (affect: string) => {
    switch (affect) {
      case 'SELF':
        return '#007AFF';
      case 'OTHER':
        return '#FF9500';
      case 'BOTH':
        return '#34C759';
      case 'NONE':
        return '#8E8E93';
      default:
        return '#8E8E93';
    }
  };

  const renderPenaltyItem = ({ item }: { item: Penalty }) => (
    <TouchableOpacity
      style={styles.penaltyItem}
      onPress={() => handlePenaltyPress(item)}
    >
      <View style={styles.penaltyContent}>
        <View style={styles.penaltyHeader}>
          <Text style={styles.penaltyName}>{item.name}</Text>
          {!item.active && (
            <View style={styles.inactiveBadge}>
              <Text style={styles.inactiveText}>Inactive</Text>
            </View>
          )}
        </View>
        
        {item.description && (
          <Text style={styles.penaltyDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
        
        <View style={styles.badgeRow}>
          <View style={[styles.affectBadge, { backgroundColor: getAffectColor(item.affect) }]}>
            <Text style={styles.affectText}>{item.affect}</Text>
          </View>
          
          {item.isTitle && (
            <View style={styles.titleBadge}>
              <Text style={styles.titleText}>Title</Text>
            </View>
          )}
          
          {item.rewardEnabled && (
            <View style={styles.rewardBadge}>
              <Text style={styles.rewardText}>Reward</Text>
            </View>
          )}
        </View>
        
        <View style={styles.amountRow}>
          <Text style={styles.amountLabel}>Self: ${item.amount.toFixed(2)}</Text>
          <Text style={styles.amountLabel}>Other: ${item.amountOther.toFixed(2)}</Text>
        </View>
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
      <FlatList
        data={penalties}
        renderItem={renderPenaltyItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No penalties yet</Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to create your first penalty
            </Text>
          </View>
        }
      />
      
      {/* FAB - Add Penalty Button */}
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
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  penaltyItem: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  penaltyContent: {
    flex: 1,
  },
  penaltyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  penaltyName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000000',
    flex: 1,
  },
  inactiveBadge: {
    backgroundColor: '#FF3B30',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  inactiveText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  penaltyDescription: {
    fontSize: 14,
    color: '#666666',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    marginBottom: 8,
    flexWrap: 'wrap',
    gap: 8,
  },
  affectBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  affectText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  titleBadge: {
    backgroundColor: '#5856D6',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  titleText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '600',
  },
  rewardBadge: {
    backgroundColor: '#FFD700',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  rewardText: {
    color: '#000000',
    fontSize: 12,
    fontWeight: '600',
  },
  amountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  amountLabel: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
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
