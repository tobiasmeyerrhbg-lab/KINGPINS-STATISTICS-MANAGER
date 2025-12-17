/**
 * FinancialsScreen
 * 
 * Shows financial overview for members in a single club.
 * Displays outstanding balances sorted by amount.
 * 
 * Features:
 * - Summary card: total outstanding, total collected, member count
 * - Member list with outstanding amounts (color-coded)
 * - Tap member → navigate to MemberLedgerScreen (future)
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Text,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useFocusEffect, useRoute, useNavigation } from '@react-navigation/native';
import { getMembersByClub } from '../../services/memberService';
import { getOutstanding } from '../../services/ledgerService';

interface MemberFinancial {
  id: string;
  name: string;
  photoUri: string | undefined;
  outstanding: number;
  paidPenaltyAmount: number;
}

export default function FinancialsScreen() {
  const route = useRoute();
  const navigation = useNavigation();
  const { clubId } = route.params as { clubId: string };
  const [financials, setFinancials] = useState<MemberFinancial[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // financial-summary: member list sorting added
  const [sortBy, setSortBy] = useState<'outstanding-desc' | 'outstanding-asc' | 'alphabetical'>('outstanding-desc');

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [clubId])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const clubMembers = await getMembersByClub(clubId);
      const memberFinancials: MemberFinancial[] = [];

      for (const member of clubMembers) {
        const outstanding = await getOutstanding(member.id);
        memberFinancials.push({
          id: member.id,
          name: member.name,
          photoUri: member.photoUri,
          outstanding,
          paidPenaltyAmount: member.paidPenaltyAmount || 0,
        });
      }

      // financial-summary: apply sorting based on current sort mode
      applySort(memberFinancials);
      setFinancials(memberFinancials);
    } catch (error) {
      console.error('Error loading financials:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // financial-summary: member list sorting function
  const applySort = (data: MemberFinancial[]) => {
    if (sortBy === 'outstanding-asc') {
      data.sort((a, b) => a.outstanding - b.outstanding);
    } else if (sortBy === 'outstanding-desc') {
      data.sort((a, b) => b.outstanding - a.outstanding);
    } else if (sortBy === 'alphabetical') {
      data.sort((a, b) => a.name.localeCompare(b.name));
    }
  };

  // financial-summary: handle sorting change and re-sort list
  const handleSortChange = (newSort: 'outstanding-desc' | 'outstanding-asc' | 'alphabetical') => {
    setSortBy(newSort);
    const sorted = [...financials];
    applySort(sorted);
    setFinancials(sorted);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleMemberPress = (member: MemberFinancial) => {
    // member-ledger: fixed navigation + logging
    console.log('[Financials] Navigating to MemberLedger for:', member.name, member.id);
    (navigation as any).navigate('MemberLedger', { memberId: member.id, clubId });
  };

  // financial-summary: fixed calculation - positive = collected (payments), negative = owed
  const calculateSummary = () => {
    const totalOutstanding = financials.reduce(
      (sum, f) => sum + f.outstanding,
      0
    );
    // total collected: sum of member.paidPenaltyAmount (positive payments only)
    const totalCollected = financials.reduce(
      (sum, f) => sum + (f.paidPenaltyAmount || 0),
      0
    );

    console.log('[Financials] Summary totals -> outstanding:', totalOutstanding, 'collected:', totalCollected);

    return { totalOutstanding, totalCollected };
  };

  const formatCurrency = (amount: number): string => {
    return `€${Math.abs(amount).toFixed(2)}`;
  };

  // financial-fix: debt/credit display matches ledger semantics
  const formatOutstandingDisplay = (amount: number): string => {
    if (amount > 0) return `-€${Math.abs(amount).toFixed(2)}`;
    if (amount < 0) return `Credit €${Math.abs(amount).toFixed(2)}`;
    return `€${Math.abs(amount).toFixed(2)}`;
  };

  // financial-summary: use ledgerService.getOutstanding(memberId) — no sign inversion
  // financial-summary: color rules align with member-ledger (owed=red, credit=green)
  const getAmountColor = (amount: number): string => {
    if (amount > 0) return '#F44336'; // Red (member owes club)
    if (amount < 0) return '#4CAF50'; // Green (club owes member / credit)
    return '#666666'; // Gray (settled)
  };

  const renderSummaryCard = () => {
    const { totalOutstanding, totalCollected } =
      calculateSummary();

    return (
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Financial Summary</Text>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Outstanding</Text>
            <Text style={[styles.summaryValue, { color: getAmountColor(totalOutstanding) }]}>
              {formatOutstandingDisplay(totalOutstanding)}
            </Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Collected</Text>
            <Text style={[styles.summaryValue, { color: '#4CAF50' }]}>
              {formatCurrency(totalCollected)}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  const renderSortSelector = () => (
    <View style={styles.sortContainer}>
      <Text style={styles.sortLabel}>Sort by:</Text>
      <View style={styles.sortButtonsRow}>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'outstanding-desc' && styles.sortButtonActive]}
          onPress={() => handleSortChange('outstanding-desc')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'outstanding-desc' && styles.sortButtonTextActive]}>
            Highest Owed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'outstanding-asc' && styles.sortButtonActive]}
          onPress={() => handleSortChange('outstanding-asc')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'outstanding-asc' && styles.sortButtonTextActive]}>
            Lowest Owed
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.sortButton, sortBy === 'alphabetical' && styles.sortButtonActive]}
          onPress={() => handleSortChange('alphabetical')}
        >
          <Text style={[styles.sortButtonText, sortBy === 'alphabetical' && styles.sortButtonTextActive]}>
            A-Z
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderMemberCard = ({ item }: { item: MemberFinancial }) => (
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
        <Text style={styles.memberName}>{item.name}</Text>
      </View>

      <View style={styles.amountContainer}>
        <Text style={[styles.amountText, { color: getAmountColor(item.outstanding) }]}>
          {/* ui-fix: member debt shows as -amount, credit as "Credit amount" */}
          {formatOutstandingDisplay(item.outstanding)}
        </Text>
        <Text style={styles.amountLabel}>
          {item.outstanding > 0 ? 'Debt' : item.outstanding < 0 ? 'Credit' : 'Settled'}
        </Text>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Text style={styles.emptyStateText}>No financial data yet</Text>
      <Text style={styles.emptyStateSubtext}>
        Complete a session to see member balances
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
      {renderSummaryCard()}
      {renderSortSelector()}

      <FlatList
        data={financials}
        renderItem={renderMemberCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={
          financials.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      />
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
  summaryCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 16,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  // financial-summary: member list sorting styles
  sortContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  sortLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  sortButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  sortButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#F0F0F0',
    borderWidth: 1,
    borderColor: '#DDD',
  },
  sortButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  sortButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    textAlign: 'center',
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
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
  memberName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 6,
  },
  amountContainer: {
    alignItems: 'flex-end',
  },
  amountText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  amountLabel: {
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
});
