// ledger-ui: member ledger screen implementation
import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, TextInput, Alert, Image } from 'react-native';
import { getLedgerByMember, getOutstanding, createLedgerEntry } from '../../services/ledgerService';
import { getMember, addPaidPenaltyAmount } from '../../services/memberService';
import { getClub } from '../../services/clubService';
import { getSession } from '../../services/sessionService';
import { useNavigation } from '@react-navigation/native';

// member-ledger: European date + club.timeFormat
function formatDate(ts: string): string {
  const d = new Date(ts);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

function formatTime(ts: string, timeFormat?: string): string {
  const d = new Date(ts);
  const hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  
  if (timeFormat === 'h:mm a') {
    // 12-hour format with AM/PM
    const period = hours >= 12 ? 'PM' : 'AM';
    const hour12 = hours % 12 || 12;
    return `${hour12}:${minutes} ${period}`;
  } else {
    // Default to 24-hour format
    return `${String(hours).padStart(2, '0')}:${minutes}`;
  }
}

function formatDateTime(ts: string, timeFormat?: string): string {
  return `${formatDate(ts)} ${formatTime(ts, timeFormat)}`;
}

// member-ledger: unified manual entry button (payment only)
// member-ledger: amount sign logic, positive subtracts, negative adds
function ActionForm({ memberId, clubId, onRefresh }) {
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit() {
    try {
      setLoading(true);
      const amt = parseFloat(amount);
      if (isNaN(amt) || amt === 0) {
        Alert.alert('Invalid Amount', 'Please enter a valid non-zero number');
        return;
      }
      
      // ledger-fix: normalize payment sign so outstanding math stays correct
      // Positive input reduces debt → store negative; negative input adds debt → store positive
      const ledgerAmount = amt > 0 ? -amt : Math.abs(amt);

      await createLedgerEntry({
        type: 'payment',
        memberId,
        clubId,
        amount: ledgerAmount,
        note: note || null,
        createdBy: 'manual',
        timestamp: new Date().toISOString(),
      });

      // paidPenaltyAmount rule: only increment on positive payments
      if (amt > 0) {
        await addPaidPenaltyAmount(memberId, amt);
        console.log('[MemberLedger] paidPenaltyAmount incremented by', amt, 'for member', memberId);
      } else {
        console.log('[MemberLedger] Negative payment recorded; paidPenaltyAmount unchanged');
      }
      
      setAmount(''); 
      setNote('');
      onRefresh && onRefresh();
      Alert.alert('Success', 'Payment recorded');
    } catch (e: any) {
      Alert.alert('Error', e.message || 'Could not create entry');
    } finally {
      setLoading(false);
    }
  }

  return (
    <View style={styles.actionForm}>
      <Text style={styles.formTitle}>Record Payment</Text>
      <Text style={styles.formHelp}>
        {/* ledger-fix: payment semantics aligned with outstanding */}
        Positive payment reduces debt (green); negative payment adds debt (red).
      </Text>
      <View style={styles.formRow}>
        <View>
          <Text style={styles.formLabel}>Amount</Text>
          <TextInput 
            value={amount} 
            onChangeText={setAmount} 
            keyboardType="numeric" 
            placeholder="10.00 or -10.00"
            style={styles.formInput} 
          />
        </View>
        <View>
          <Text style={styles.formLabel}>Note (Optional)</Text>
          <TextInput 
            value={note} 
            onChangeText={setNote} 
            placeholder="Enter note"
            style={styles.formInput} 
          />
        </View>
        <TouchableOpacity 
          onPress={handleSubmit} 
          disabled={loading} 
          style={styles.formButton}
        >
          <Text style={styles.formButtonText}>{loading ? 'Adding...' : 'Record Payment'}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function MemberLedgerScreen({ route }) {
  const { memberId, clubId } = route.params;
  const navigation = useNavigation();
  const [ledger, setLedger] = useState([]);
  const [memberName, setMemberName] = useState('');
  const [memberPhotoUri, setMemberPhotoUri] = useState<string | undefined>(undefined);
  const [clubTimeFormat, setClubTimeFormat] = useState<string>('HH:mm');
  // member-ledger: total outstanding display
  const [totalOutstanding, setTotalOutstanding] = useState(0);
  const [sessionNames, setSessionNames] = useState<Record<string, string>>({});
  const [refreshFlag, setRefreshFlag] = useState(0);
  const dummyAvatar = useMemo(
    () => require('../../../assets/images/dummy/default-member.png'),
    []
  );

  useEffect(() => {
    async function load() {
      try {
        // Load member, club settings, and ledger
        const [member, club] = await Promise.all([
          getMember(memberId),
          getClub(clubId)
        ]);
        
        console.log('[MemberLedger] Opening ledger for member:', member.name, member.id);
        setMemberName(member.name);
        setMemberPhotoUri(member.photoUri);
        setClubTimeFormat(club?.timeFormat || 'HH:mm');
        
        const l = await getLedgerByMember(memberId);
        console.log('[MemberLedger] Loaded ledger entries:', l.length);

        // member-ledger: authoritative outstanding computation
        const outstanding = await getOutstanding(memberId);
        setTotalOutstanding(outstanding);
        
        // Load session names for session-type entries
        const sessionIds = l
          .filter((e: any) => e.type === 'session' && e.sessionId)
          .map((e: any) => e.sessionId);
        
        const uniqueSessionIds = Array.from(new Set(sessionIds));
        const names: Record<string, string> = {};
        
        for (const sessionId of uniqueSessionIds) {
          try {
            const session = await getSession(sessionId);
            if (session) {
              // member-ledger: session name + amount display
              const sessionDate = formatDate(session.startTime);
              names[sessionId] = `Session ${sessionDate}`;
            }
          } catch (e) {
            console.warn('[MemberLedger] Could not load session:', sessionId);
            names[sessionId] = 'Session';
          }
        }
        
        setSessionNames(names);
        setLedger(l);
      } catch (e: any) {
        console.error('[MemberLedger] Error loading data:', e);
        Alert.alert('Error', 'Failed to load ledger: ' + (e.message || 'Unknown error'));
      }
    }
    load();
  }, [memberId, clubId, refreshFlag]);

  // Sort all entries chronologically (newest first)
  const sortedLedger = [...ledger].sort((a: any, b: any) => 
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  // member-ledger: helper to color code total outstanding
  // ledger-fix: corrected color logic - positive = debt (red), negative = credit (green)
  const getTotalOutstandingColor = (): string => {
    if (totalOutstanding > 0) return '#F44336'; // Red (debt/owed)
    if (totalOutstanding < 0) return '#4CAF50'; // Green (credit/overpaid)
    return '#666666'; // Gray (settled)
  };

  const renderOutstandingValue = (): string => {
    if (totalOutstanding > 0) {
      // ledger-as-source: debt shown as '-amount' (red) via SUM(ledger entries with timestamps)
      return `-€${Math.abs(totalOutstanding).toFixed(2)}`;
    }
    if (totalOutstanding < 0) {
      // ledger-as-source: credit shown as 'Credit amount' (green)
      return `Credit €${Math.abs(totalOutstanding).toFixed(2)}`;
    }
    return `€${Math.abs(totalOutstanding).toFixed(2)}`; // settled
  };

  const getMemberAvatar = () => {
    if (memberPhotoUri) {
      return { uri: memberPhotoUri } as const;
    }
    return dummyAvatar;
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#fff' }}>
      {/* member-ledger: total outstanding displayed at top */}
      <View style={styles.totalOutstandingContainer}>
        <View style={styles.headerRow}>
          <Image source={getMemberAvatar()} style={styles.headerAvatar} />
          <View style={{ flex: 1 }}>
            <Text style={styles.headerName}>{memberName || 'Member'}</Text>
            <Text style={styles.totalOutstandingLabel}>Total Outstanding</Text>
          </View>
          <Text style={[styles.totalOutstandingValue, { color: getTotalOutstandingColor() }]}>
            {/* ledger-fix: display debt as -amount, credit as Credit amount */}
            {renderOutstandingValue()}
          </Text>
        </View>
      </View>
      <ActionForm memberId={memberId} clubId={clubId} onRefresh={() => setRefreshFlag(f => f+1)} />
      <ScrollView style={{ flex: 1 }}>
        <Text style={styles.title}>{memberName ? `${memberName}'s Ledger` : 'Member Ledger'}</Text>
        
        {sortedLedger.length > 0 ? (
          sortedLedger.map((item: any) => {
            const isSession = item.type === 'session';
            const isPayment = item.type === 'payment';
            const displayName = isSession && item.sessionId
              ? sessionNames[item.sessionId] || 'Session'
              : item.note || 'Payment';

            // ledger-fix: per-entry display logic
            let amountText = `€${Math.abs(item.amount).toFixed(2)}`;
            let amountStyle = styles.settled;

            if (isSession) {
              if (item.amount > 0) {
                amountText = `-€${Math.abs(item.amount).toFixed(2)}`;
                amountStyle = styles.debt;
              } else if (item.amount < 0) {
                amountText = `Credit €${Math.abs(item.amount).toFixed(2)}`;
                amountStyle = styles.credit;
              }
            } else if (isPayment) {
              if (item.amount > 0) {
                amountText = `€${Math.abs(item.amount).toFixed(2)}`;
                amountStyle = styles.credit;
              } else if (item.amount < 0) {
                amountText = `€${Math.abs(item.amount).toFixed(2)}`;
                amountStyle = styles.debt;
              }
            } else {
              // fallback for other types
              if (item.amount > 0) {
                amountStyle = styles.debt;
              } else if (item.amount < 0) {
                amountStyle = styles.credit;
              }
            }

            return (
              <TouchableOpacity
                key={item.id}
                style={styles.entryRow}
                onPress={() => {
                  if (isSession && item.sessionId) {
                    (navigation as any).navigate('SessionDetails', { 
                      sessionId: item.sessionId, 
                      clubId 
                    });
                  }
                }}
                disabled={!isSession}
              >
                <View style={styles.entryLeft}>
                  <Text style={styles.entryName}>{displayName}</Text>
                  <Text style={styles.entryDate}>
                    {formatDateTime(item.timestamp, clubTimeFormat)}
                  </Text>
                </View>
                <Text style={[styles.entryAmount, amountStyle]}>
                  {amountText}
                </Text>
              </TouchableOpacity>
            );
          })
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>No ledger entries yet</Text>
            <Text style={styles.emptySubtext}>
              Entries will appear here after sessions or manual payments
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // member-ledger: total outstanding display styles
  totalOutstandingContainer: {
    backgroundColor: '#F9F9F9',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#DDD',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#e5e7eb',
  },
  headerName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
  },
  totalOutstandingLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 4,
  },
  totalOutstandingValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  title: { 
    fontSize: 20, 
    fontWeight: '700', 
    margin: 16,
    marginBottom: 8,
  },
  actionForm: {
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  formTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  formHelp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 12,
  },
  formRow: {
    flexDirection: 'column',
    gap: 12,
  },
  formLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  formInput: {
    borderWidth: 1,
    borderColor: '#ccc',
    borderRadius: 6,
    padding: 12,
    fontSize: 14,
    width: '100%',
  },
  formButton: {
    backgroundColor: '#34C759',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    width: '100%',
  },
  formButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  entryLeft: {
    flex: 1,
    marginRight: 12,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  entryDate: {
    fontSize: 13,
    color: '#666',
  },
  entryAmount: {
    fontSize: 18,
    fontWeight: '700',
  },
  debt: {
    color: '#d32f2f',
  },
  credit: {
    color: '#388e3c',
  },
  settled: {
    color: '#666666',
  },
  emptyState: {
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#bbb',
    textAlign: 'center',
  },
});
