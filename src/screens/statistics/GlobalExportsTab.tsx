import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import {
  exportAllLogs,
  exportAndShareAllLogs,
} from '../../services/globalExportsService';

interface GlobalExportsTabProps {
  clubId?: string;
}

export default function GlobalExportsTab(props: GlobalExportsTabProps) {
  const route = useRoute();
  const passedClubId = props.clubId || (route.params as any)?.clubId;

  const [exporting, setExporting] = useState(false);

  const handleExportAllLogs = async () => {
    if (!passedClubId) {
      Alert.alert('Error', 'Club ID not available');
      return;
    }

    try {
      setExporting(true);
      const [csvUri, jsonUri] = await exportAllLogs(passedClubId);

      Alert.alert(
        'Export Successful',
        `Logs exported to:\n\n${csvUri}\n\n${jsonUri}`,
        [{ text: 'OK', onPress: () => {} }]
      );
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Export Failed', errorMsg, [{ text: 'OK', onPress: () => {} }]);
      console.error('Export error:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleShareAllLogs = async () => {
    if (!passedClubId) {
      Alert.alert('Error', 'Club ID not available');
      return;
    }

    try {
      setExporting(true);
      await exportAndShareAllLogs(passedClubId);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Share Failed', errorMsg, [{ text: 'OK', onPress: () => {} }]);
      console.error('Share error:', error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Global Exports</Text>
        <Text style={styles.subtitle}>Export all club logs and system data</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>All System Logs</Text>
        <Text style={styles.description}>
          Export all session logs (Final Amounts, Commits, Playtime) across all sessions in CSV and JSON formats.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportAllLogs}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>📥 Export All Logs (CSV & JSON)</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.secondaryButton]}
          onPress={handleShareAllLogs}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#333" size="small" />
          ) : (
            <Text style={styles.buttonTextSecondary}>📤 Share All Logs</Text>
          )}
        </TouchableOpacity>
      </View>

      <View style={styles.infoSection}>
        <Text style={styles.infoTitle}>Export Information</Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Systems Included:</Text> Final Amounts (11), Commit Summary (12), Member Playtime (15)
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Format:</Text> Both CSV and JSON for compatibility
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Coverage:</Text> All sessions and all members in this club
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Filename:</Text> all-logs-[clubId]-YYYY-MM-DD.csv/json
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Location:</Text> Device local storage (/PenaltyPro/Exports/)
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#000000',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  description: {
    fontSize: 13,
    color: '#000000',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#e8e8e8',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonTextSecondary: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
  },
  infoSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000000',
    marginBottom: 12,
  },
  infoText: {
    fontSize: 13,
    color: '#000000',
    marginBottom: 10,
    lineHeight: 20,
  },
});
