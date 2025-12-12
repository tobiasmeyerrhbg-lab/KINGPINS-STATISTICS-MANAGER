/**
 * Session Verification Screen
 * 
 * Displays verification results for Session.totalAmounts
 * Green if all match, red if mismatches found
 */

import React, { useEffect, useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { verifySessionTotals, VerificationResult } from '../../services/sessionVerificationService';

interface Props {
  route: { params: { sessionId: string; clubId: string } };
  navigation: any;
}

export function SessionVerificationScreen({ route, navigation }: Props) {
  const { sessionId, clubId } = route.params;
  const [results, setResults] = useState<VerificationResult[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [allMatch, setAllMatch] = useState(true);

  useEffect(() => {
    const verify = async () => {
      try {
        const verificationResults = await verifySessionTotals(sessionId, clubId);
        setResults(verificationResults);
        setAllMatch(verificationResults.every(r => r.match));
      } catch (error) {
        console.error('Verification failed:', error);
      } finally {
        setIsLoading(false);
      }
    };
    verify();
  }, [sessionId, clubId]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={[styles.statusCard, allMatch ? styles.successCard : styles.failureCard]}>
          <Text style={[styles.statusText, allMatch ? styles.successText : styles.failureText]}>
            {allMatch ? '✓ Verification Passed' : '✗ Verification Failed'}
          </Text>
          <Text style={styles.statusSubtext}>
            {allMatch
              ? 'All member totals match calculated values'
              : `${results.filter(r => !r.match).length} member(s) have mismatches`}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Member Totals</Text>
          {results.map(result => (
            <View
              key={result.memberId}
              style={[styles.resultCard, result.match ? styles.matchCard : styles.mismatchCard]}
            >
              <View style={styles.resultHeader}>
                <Text style={styles.memberName}>{result.memberName}</Text>
                <Text style={[styles.matchBadge, result.match ? styles.matchBadgeGreen : styles.matchBadgeRed]}>
                  {result.match ? 'OK' : 'MISMATCH'}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.label}>Stored Total:</Text>
                <Text style={[styles.value, result.match && styles.valueMatch]}>
                  {result.storedTotal.toFixed(2)}
                </Text>
              </View>
              <View style={styles.resultRow}>
                <Text style={styles.label}>Calculated Total:</Text>
                <Text style={[styles.value, result.match && styles.valueMatch]}>
                  {result.calculatedTotal.toFixed(2)}
                </Text>
              </View>
              {!result.match && (
                <View style={styles.resultRow}>
                  <Text style={styles.label}>Difference:</Text>
                  <Text style={styles.valueDiff}>
                    {(result.storedTotal - result.calculatedTotal).toFixed(2)}
                  </Text>
                </View>
              )}
            </View>
          ))}
        </View>

        <TouchableOpacity style={styles.button} onPress={() => navigation.goBack()}>
          <Text style={styles.buttonText}>Back</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    padding: 16,
  },
  statusCard: {
    borderRadius: 8,
    padding: 16,
    marginBottom: 20,
    alignItems: 'center',
  },
  successCard: {
    backgroundColor: '#e8f5e9',
  },
  failureCard: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  successText: {
    color: '#2e7d32',
  },
  failureText: {
    color: '#c62828',
  },
  statusSubtext: {
    fontSize: 14,
    color: '#555',
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000',
    marginBottom: 12,
  },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 4,
  },
  matchCard: {
    borderLeftColor: '#4caf50',
  },
  mismatchCard: {
    borderLeftColor: '#f44336',
  },
  resultHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#000',
  },
  matchBadge: {
    fontSize: 12,
    fontWeight: '700',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  matchBadgeGreen: {
    backgroundColor: '#c8e6c9',
    color: '#2e7d32',
  },
  matchBadgeRed: {
    backgroundColor: '#ffcdd2',
    color: '#c62828',
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  label: {
    fontSize: 13,
    color: '#666',
  },
  value: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  valueMatch: {
    color: '#4caf50',
  },
  valueDiff: {
    fontSize: 13,
    fontWeight: '600',
    color: '#f44336',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
});
