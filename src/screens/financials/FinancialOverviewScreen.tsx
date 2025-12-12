// financials: added outstanding computation, club-level financials UI
import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { getMembersByClub } from '../../services/memberService';
import { getOutstanding } from '../../services/ledgerService';
import { useNavigation } from '@react-navigation/native';

export default function FinancialOverviewScreen({ route }) {
  const { clubId } = route.params;
  const navigation = useNavigation();
  const [members, setMembers] = useState([]);
  const [outstandings, setOutstandings] = useState({});
  const [sort, setSort] = useState<'outstanding'|'alpha'>('outstanding');

  useEffect(() => {
    async function load() {
      try {
        console.log('[FinancialOverview] Loading members for clubId:', clubId);
        const m = await getMembersByClub(clubId);
        console.log('[FinancialOverview] Loaded members:', m.length);
        
        const outs = {};
        for (const member of m) {
          const outstanding = await getOutstanding(member.id);
          console.log(`[FinancialOverview] Outstanding for ${member.name}:`, outstanding);
          outs[member.id] = outstanding;
        }
        console.log('[FinancialOverview] All outstandings:', outs);
        setMembers(m);
        setOutstandings(outs);
      } catch (error) {
        console.error('[FinancialOverview] Error loading data:', error);
      }
    }
    load();
  }, [clubId]);

  const sortedMembers = [...members].sort((a, b) => {
    if (sort === 'alpha') return a.name.localeCompare(b.name);
    return (outstandings[b.id] ?? 0) - (outstandings[a.id] ?? 0);
  });

  // financials: compute total outstanding across all members
  const totalOutstanding = (Object.values(outstandings) as number[]).reduce((sum: number, val: number) => sum + (val ?? 0), 0);

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Club Financials</Text>
        
        {/* financials: total outstanding summary card */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Total Outstanding</Text>
          <Text style={[styles.summaryValue, totalOutstanding < 0 ? styles.negative : styles.positive]}>
            {/* financials: remove "+" sign for positive amounts */}
            {totalOutstanding < 0 ? totalOutstanding.toFixed(2) : totalOutstanding.toFixed(2)}
          </Text>
        </View>

        <View style={styles.sortRow}>
          <TouchableOpacity onPress={() => setSort('outstanding')} style={[styles.sortBtn, sort==='outstanding'&&styles.activeSort]}> 
            <Text style={sort==='outstanding'?styles.sortBtnTextActive:styles.sortBtnText}>Outstanding</Text> 
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setSort('alpha')} style={[styles.sortBtn, sort==='alpha'&&styles.activeSort]}> 
            <Text style={sort==='alpha'?styles.sortBtnTextActive:styles.sortBtnText}>A→Z</Text> 
          </TouchableOpacity>
        </View>
      </View>
      <FlatList
        data={sortedMembers}
        keyExtractor={m => m.id}
        renderItem={({ item }) => (
          <TouchableOpacity 
            style={styles.row} 
            onPress={() => {
              console.log('[FinancialOverview] Navigating to MemberLedger with:', { memberId: item.id, clubId });
              try {
                (navigation as any).navigate('MemberLedger', { memberId: item.id, clubId });
              } catch (error) {
                console.error('[FinancialOverview] Navigation error:', error);
              }
            }}
          >
            <Image 
              source={item.photoUri ? { uri: item.photoUri } : require('../../../assets/images/dummy/default-member.png')} 
              style={styles.avatar} 
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.name}>{item.name}</Text>
              {item.isGuest && <Text style={styles.guest}>Guest</Text>}
            </View>
            <Text style={[styles.amount, (outstandings[item.id]??0)<0?styles.negative:styles.positive]}>
              {/* financials: remove "+" sign for positive amounts */}
              {(outstandings[item.id]??0) < 0 ? (outstandings[item.id]??0).toFixed(2) : (outstandings[item.id]??0).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  header: { padding: 16, backgroundColor: '#f5f5f5', borderBottomWidth: 1, borderBottomColor: '#eee' },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  summaryCard: { 
    backgroundColor: '#fff', 
    padding: 12, 
    borderRadius: 8, 
    marginTop: 8, 
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    alignItems: 'center',
  },
  summaryLabel: { fontSize: 14, color: '#666', marginBottom: 4 },
  summaryValue: { fontSize: 24, fontWeight: '700' },
  sortRow: { flexDirection: 'row', marginTop: 8 },
  sortBtn: { marginRight: 12, padding: 8, borderRadius: 6, backgroundColor: '#eee' },
  sortBtnText: { color: '#333', fontSize: 14 },
  sortBtnTextActive: { color: '#fff', fontSize: 14, fontWeight: '600' },
  activeSort: { backgroundColor: '#007AFF' },
  row: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: '#eee' },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 12 },
  name: { fontSize: 16, fontWeight: '600' },
  guest: { color: '#ff9500', fontSize: 13 },
  amount: { fontSize: 16, fontWeight: '700', minWidth: 80, textAlign: 'right' },
  negative: { color: '#d32f2f' },
  positive: { color: '#388e3c' },
});
