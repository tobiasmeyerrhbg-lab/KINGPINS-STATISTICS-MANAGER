import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
  Platform,
  Modal,
  TextInput,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import {
  exportAllLogs,
  exportAndShareAllLogs,
  exportPenaltyAnalysis,
  exportTopWinners,
  exportMemberStatistics,
  fetchAvailableYears,
} from '../../services/globalExportsService';
import { Picker } from '@react-native-picker/picker';

interface GlobalExportsTabProps {
  clubId?: string;
}

// Helper: Get current date in YYYY-MM-DD format
const getDateString = () => {
  const now = new Date();
  return now.toISOString().split('T')[0];
};

// Helper: Get current year
const getCurrentYear = () => {
  return new Date().getFullYear();
};

// Helper: Share file with option to save or share
const shareExportFile = async (fileUri: string, fileName: string) => {
  try {
    if (!(await Sharing.isAvailableAsync())) {
      // If sharing is not available, show the file URI for manual save
      Alert.alert(
        'Export Successful',
        `File saved to:\n\n${fileUri}\n\nYou can access it through your file manager.`,
        [{ text: 'OK', onPress: () => {} }]
      );
      return;
    }

    await Sharing.shareAsync(fileUri, {
      mimeType: fileName.endsWith('.json') ? 'application/json' : 'text/csv',
      dialogTitle: `Share ${fileName}`,
    });
  } catch (error) {
    console.error('Share error:', error);
    // Fallback: Show file location
    Alert.alert(
      'Export Successful',
      `File saved to:\n\n${fileUri}`,
      [{ text: 'OK', onPress: () => {} }]
    );
  }
};

export default function GlobalExportsTab(props: GlobalExportsTabProps) {
  const route = useRoute();
  const passedClubId = props.clubId || (route.params as any)?.clubId;

  const [exporting, setExporting] = useState(false);
  const [availableYears, setAvailableYears] = useState<number[]>([getCurrentYear()]);
  const [selectedYear, setSelectedYear] = useState<number>(getCurrentYear());
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [pendingExport, setPendingExport] = useState<null | 'all-penalty' | 'all-winners' | 'all-members' | 'all-logs' | 'ann-penalty' | 'ann-winners' | 'ann-members' | 'ann-logs'>(null);
  const defaultDownloads = (FileSystem as any).documentDirectory
    ? `${(FileSystem as any).documentDirectory}Downloads/`
    : '';
  const [savePath, setSavePath] = useState<string>(defaultDownloads);

  // Fetch available years from the database so only years with data appear
  useEffect(() => {
    let isMounted = true;

    const loadYears = async () => {
      if (!passedClubId) {
        const fallbackYear = getCurrentYear();
        if (isMounted) {
          setAvailableYears([fallbackYear]);
          setSelectedYear(fallbackYear);
        }
        return;
      }

      try {
        const years = await fetchAvailableYears(passedClubId);

        if (!isMounted) return;

        if (years && years.length > 0) {
          setAvailableYears(years);
          // Keep the current selection if still valid; otherwise default to newest year
          if (!years.includes(selectedYear)) {
            setSelectedYear(years[0]);
          }
        } else {
          const fallbackYear = getCurrentYear();
          setAvailableYears([fallbackYear]);
          setSelectedYear(fallbackYear);
        }
      } catch (error) {
        console.error('Failed to fetch available years:', error);
        const fallbackYear = getCurrentYear();
        if (isMounted) {
          setAvailableYears([fallbackYear]);
          setSelectedYear(fallbackYear);
        }
      }
    };

    loadYears();

    return () => {
      isMounted = false;
    };
  }, [passedClubId]);

  const handleExportAllLogs = async () => {
    openSaveModal('all-logs');
  };

  const handleShareAllLogs = async () => {
    if (!passedClubId) {
      Alert.alert('Error', 'Club ID not available');
      return;
    }

    try {
      setExporting(true);
      const message = 'Exporting logs for sharing...';
      
      // This creates files and opens share dialog
      await exportAndShareAllLogs(passedClubId);
      
      Alert.alert('Success', 'Logs have been shared or saved to your device.');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Share Failed', errorMsg, [{ text: 'OK', onPress: () => {} }]);
      console.error('Share error:', error);
    } finally {
      setExporting(false);
    }
  };

  const handleExportPenaltyAnalysis = async () => {
    openSaveModal('all-penalty');
  };

  const handleExportTopWinners = async () => {
    openSaveModal('all-winners');
  };

  const handleExportMemberStatistics = async () => {
    openSaveModal('all-members');
  };

  // Annual Report Handlers
  const moveFileToPath = async (sourceUri: string, fileName: string) => {
    const normalizedDir = savePath.endsWith('/') ? savePath : `${savePath}/`;
    const destinationUri = `${normalizedDir}${fileName}`;

    try {
      await FileSystem.makeDirectoryAsync(normalizedDir, { intermediates: true });
    } catch (e) {
      // ignore if exists
    }

    try {
      await FileSystem.copyAsync({ from: sourceUri, to: destinationUri });
      return destinationUri;
    } catch (error) {
      console.error('Failed to move file:', error);
      return sourceUri;
    }
  };

  const handleRunExport = async (type: 'all-penalty' | 'all-winners' | 'all-members' | 'all-logs' | 'ann-penalty' | 'ann-winners' | 'ann-members' | 'ann-logs') => {
    if (!passedClubId) {
      Alert.alert('Error', 'Club ID not available');
      return;
    }

    try {
      setExporting(true);

      if (type === 'all-penalty') {
        const csvUri = await exportPenaltyAnalysis(passedClubId);

        if (!csvUri || csvUri.includes('No data')) {
          Alert.alert('No Data', 'No data available for export.');
          return;
        }

        const fileName = `penalty_analysis_${getDateString()}.csv`;
        const finalPath = await moveFileToPath(csvUri, fileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            'Penalty analysis has been exported. Would you like to share it?',
            [
              {
                text: 'Share',
                onPress: () => shareExportFile(finalPath, fileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert('File Location', finalPath, [{ text: 'OK', onPress: () => {} }]);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `File saved to:\n\n${finalPath}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'all-winners') {
        const csvUri = await exportTopWinners(passedClubId);

        if (!csvUri || csvUri.includes('No data')) {
          Alert.alert('No Data', 'No data available for export.');
          return;
        }

        const fileName = `top_winners_${getDateString()}.csv`;
        const finalPath = await moveFileToPath(csvUri, fileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            'Top winners list has been exported. Would you like to share it?',
            [
              {
                text: 'Share',
                onPress: () => shareExportFile(finalPath, fileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert('File Location', finalPath, [{ text: 'OK', onPress: () => {} }]);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `File saved to:\n\n${finalPath}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'all-members') {
        const csvUri = await exportMemberStatistics(passedClubId);

        if (!csvUri || csvUri.includes('No data')) {
          Alert.alert('No Data', 'No data available for export.');
          return;
        }

        const fileName = `member_statistics_${getDateString()}.csv`;
        const finalPath = await moveFileToPath(csvUri, fileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            'Member statistics have been exported. Would you like to share them?',
            [
              {
                text: 'Share',
                onPress: () => shareExportFile(finalPath, fileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert('File Location', finalPath, [{ text: 'OK', onPress: () => {} }]);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `File saved to:\n\n${finalPath}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'all-logs') {
        const [csvUri, jsonUri] = await exportAllLogs(passedClubId);

        if ((!csvUri || csvUri.includes('No data')) && (!jsonUri || jsonUri.includes('No data'))) {
          Alert.alert('No Data', 'No data available for export.');
          return;
        }

        const csvFileName = `all_logs_${getDateString()}.csv`;
        const jsonFileName = `all_logs_${getDateString()}.json`;
        const finalCsv = await moveFileToPath(csvUri, csvFileName);
        const finalJson = await moveFileToPath(jsonUri, jsonFileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            'Both CSV and JSON files have been exported. Would you like to share them?',
            [
              {
                text: 'Share CSV',
                onPress: () => shareExportFile(finalCsv, csvFileName),
              },
              {
                text: 'Share JSON',
                onPress: () => shareExportFile(finalJson, jsonFileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert(
                    'File Locations',
                    `CSV: ${finalCsv}\n\nJSON: ${finalJson}`,
                    [{ text: 'OK', onPress: () => {} }]
                  );
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `Files exported:\n\nCSV: ${finalCsv}\n\nJSON: ${finalJson}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'ann-penalty') {
        const csvUri = await exportPenaltyAnalysis(passedClubId, selectedYear);

        if (!csvUri || csvUri.includes('No data')) {
          Alert.alert('No Data', `No data available for year ${selectedYear}.`);
          return;
        }

        const fileName = `penalty_analysis_${selectedYear}.csv`;
        const finalPath = await moveFileToPath(csvUri, fileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            `Penalty analysis for ${selectedYear} has been exported. Would you like to share it?`,
            [
              {
                text: 'Share',
                onPress: () => shareExportFile(finalPath, fileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert('File Location', finalPath, [{ text: 'OK', onPress: () => {} }]);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `File saved to:\n\n${finalPath}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'ann-winners') {
        const csvUri = await exportTopWinners(passedClubId, selectedYear);

        if (!csvUri || csvUri.includes('No data')) {
          Alert.alert('No Data', `No data available for year ${selectedYear}.`);
          return;
        }

        const fileName = `top_winners_${selectedYear}.csv`;
        const finalPath = await moveFileToPath(csvUri, fileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            `Top winners for ${selectedYear} have been exported. Would you like to share them?`,
            [
              {
                text: 'Share',
                onPress: () => shareExportFile(finalPath, fileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert('File Location', finalPath, [{ text: 'OK', onPress: () => {} }]);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `File saved to:\n\n${finalPath}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'ann-members') {
        const csvUri = await exportMemberStatistics(passedClubId, selectedYear);

        if (!csvUri || csvUri.includes('No data')) {
          Alert.alert('No Data', `No data available for year ${selectedYear}.`);
          return;
        }

        const fileName = `member_statistics_${selectedYear}.csv`;
        const finalPath = await moveFileToPath(csvUri, fileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            `Member statistics for ${selectedYear} have been exported. Would you like to share them?`,
            [
              {
                text: 'Share',
                onPress: () => shareExportFile(finalPath, fileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert('File Location', finalPath, [{ text: 'OK', onPress: () => {} }]);
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `File saved to:\n\n${finalPath}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }

      if (type === 'ann-logs') {
        const [csvUri, jsonUri] = await exportAllLogs(passedClubId, selectedYear);

        if ((!csvUri || csvUri.includes('No data')) && (!jsonUri || jsonUri.includes('No data'))) {
          Alert.alert('No Data', `No data available for year ${selectedYear}.`);
          return;
        }

        const csvFileName = `all_logs_${selectedYear}.csv`;
        const jsonFileName = `all_logs_${selectedYear}.json`;
        const finalCsv = await moveFileToPath(csvUri, csvFileName);
        const finalJson = await moveFileToPath(jsonUri, jsonFileName);

        if (await Sharing.isAvailableAsync()) {
          Alert.alert(
            'Export Successful',
            `Both CSV and JSON files for ${selectedYear} have been exported. Would you like to share them?`,
            [
              {
                text: 'Share CSV',
                onPress: () => shareExportFile(finalCsv, csvFileName),
              },
              {
                text: 'Share JSON',
                onPress: () => shareExportFile(finalJson, jsonFileName),
              },
              {
                text: 'View Location',
                onPress: () => {
                  Alert.alert(
                    'File Locations',
                    `CSV: ${finalCsv}\n\nJSON: ${finalJson}`,
                    [{ text: 'OK', onPress: () => {} }]
                  );
                },
              },
            ]
          );
        } else {
          Alert.alert(
            'Export Successful',
            `Files exported:\n\nCSV: ${finalCsv}\n\nJSON: ${finalJson}`,
            [{ text: 'OK', onPress: () => {} }]
          );
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown error';
      Alert.alert('Export Failed', errorMsg, [{ text: 'OK', onPress: () => {} }]);
      console.error('Export error:', error);
    } finally {
      setExporting(false);
      setSaveModalVisible(false);
      setPendingExport(null);
    }
  };

  const openSaveModal = (type: 'all-penalty' | 'all-winners' | 'all-members' | 'all-logs' | 'ann-penalty' | 'ann-winners' | 'ann-members' | 'ann-logs') => {
    if (exporting) return;
    setPendingExport(type);
    setSaveModalVisible(true);
  };

  const handleExportAnnualPenaltyAnalysis = async () => {
    openSaveModal('ann-penalty');
  };

  const handleExportAnnualTopWinners = async () => {
    openSaveModal('ann-winners');
  };

  const handleExportAnnualMemberStatistics = async () => {
    openSaveModal('ann-members');
  };

  const handleExportAnnualAllLogs = async () => {
    openSaveModal('ann-logs');
  };

  return (
    <ScrollView style={styles.container}>
      <Modal
        visible={saveModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!exporting) {
            setSaveModalVisible(false);
            setPendingExport(null);
          }
        }}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalContainer}>
            <Text style={styles.modalTitle}>Choose Save Location</Text>
            <Text style={styles.modalText}>Files will be saved to the selected folder.</Text>
            <TextInput
              value={savePath}
              onChangeText={setSavePath}
              editable={!exporting}
              style={styles.modalInput}
              placeholder="Enter folder path"
            />
            <View style={styles.modalButtonsRow}>
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton, styles.modalButton]}
                onPress={() => {
                  if (!exporting) {
                    setSaveModalVisible(false);
                    setPendingExport(null);
                  }
                }}
                disabled={exporting}
              >
                <Text style={styles.buttonTextSecondary}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.button, styles.primaryButton, styles.modalButton]}
                onPress={() => pendingExport && handleRunExport(pendingExport)}
                disabled={exporting || !pendingExport}
              >
                {exporting ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.buttonText}>Save & Export</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <View style={styles.header}>
        <Text style={styles.title}>📊 Global Exports</Text>
        <Text style={styles.subtitle}>Export comprehensive club statistics and logs</Text>
      </View>

     

      {/* Annual Reports Exports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📅 Annual Reports</Text>
        <Text style={styles.description}>
          Export statistics and logs for a specific year. Select the desired year below.
        </Text>

        {/* Year Selection */}
        <View style={styles.yearSelectionContainer}>
          <Text style={styles.yearLabel}>Select Year:</Text>
          <View style={styles.yearPickerWrapper}>
            <Picker
              enabled={!exporting}
              selectedValue={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(Number(value))}
              style={styles.yearPicker}
            >
              {availableYears.map((year) => (
                <Picker.Item key={year} label={`${year}`} value={year.toString()} /> // <-- value als String
              ))}
            </Picker>
          </View>
        </View>

        {/* Annual Export Buttons */}
        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportAnnualPenaltyAnalysis}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>📥 Export Penalty Analysis ({selectedYear})</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportAnnualTopWinners}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>🏆 Export Top Winners ({selectedYear})</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportAnnualMemberStatistics}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>👥 Export Member Statistics ({selectedYear})</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportAnnualAllLogs}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>📥 Export All Logs ({selectedYear})</Text>
          )}
        </TouchableOpacity>

        {/* Annual Reports Info */}
        <View style={styles.annualInfoBox}>
          <Text style={styles.annualInfoText}>
            Annual reports include only data for {selectedYear}. Please choose the desired year before exporting.
          </Text>
        </View>
      </View>

 {/* All-Time Statistics Exports */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>📈 All-Time Statistics</Text>
        <Text style={styles.description}>
          Export comprehensive statistics matching Tab 1 (All-Time). Includes all penalties, members, and sessions.
        </Text>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportPenaltyAnalysis}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>📥 Export All Time Penalty Analysis</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportTopWinners}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>🏆 Export Top Winners by Penalty</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.button, styles.primaryButton]}
          onPress={handleExportMemberStatistics}
          disabled={exporting}
        >
          {exporting ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <Text style={styles.buttonText}>👥 Export Member Statistics</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* All System Logs */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>🗂️ All System Logs</Text>
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
        <Text style={styles.infoTitle}>ℹ️ Export Information</Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>All-Time Statistics:</Text> Penalty Analysis, Top Winners, and Member Statistics 
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>All System Logs:</Text> Complete history of all system events (all logs, not filtered)
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Format:</Text> CSV for spreadsheets, JSON for data import (readable)
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Coverage:</Text> All sessions, all members, all penalties, complete history
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>File Names:</Text> Automatically timestamped (e.g., all_logs_2025-12-18.csv)
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Sharing:</Text> Choose to save to device or share via email, cloud storage, etc.
        </Text>
        <Text style={styles.infoText}>
          • <Text style={{ fontWeight: 'bold' }}>Data Completeness:</Text> Nothing is filtered or excluded. You get 100% of your data.
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
    color: '#666666',
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
    color: '#666666',
    marginBottom: 16,
    lineHeight: 20,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#007AFF',
  },
  secondaryButton: {
    backgroundColor: '#e8e8e8',
    borderWidth: 1,
    borderColor: '#d0d0d0',
  },
  buttonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  buttonTextSecondary: {
    color: '#000000',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
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
    color: '#333333',
    marginBottom: 10,
    lineHeight: 20,
  },
  yearSelectionContainer: {
    marginVertical: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  yearLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 12,
  },
  yearButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  yearPickerWrapper: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 6,
    backgroundColor: '#f9f9f9',
  },
  yearPicker: {
    height: 50,
  },
  yearButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: '#d0d0d0',
    backgroundColor: '#f9f9f9',
  },
  yearButtonActive: {
    backgroundColor: '#007AFF',
    borderColor: '#007AFF',
  },
  yearButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333333',
  },
  yearButtonTextActive: {
    color: '#fff',
  },
  annualInfoBox: {
    marginTop: 16,
    padding: 12,
    backgroundColor: '#f0f7ff',
    borderLeftWidth: 4,
    borderLeftColor: '#007AFF',
    borderRadius: 4,
  },
  annualInfoText: {
    fontSize: 13,
    color: '#0051ba',
    fontStyle: 'italic',
    lineHeight: 20,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  modalContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    elevation: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#000',
    marginBottom: 8,
  },
  modalText: {
    fontSize: 13,
    color: '#444',
    marginBottom: 12,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d0d0d0',
    borderRadius: 8,
    padding: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  modalButtonsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  modalButton: {
    minWidth: 120,
  },
});
