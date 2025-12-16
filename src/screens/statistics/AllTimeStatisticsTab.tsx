import React, { useState, useMemo, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  FlatList,
  Alert,
  Dimensions,
  Modal,
  Image,
} from 'react-native';
import { useRoute } from '@react-navigation/native';
import { getClubLevelStats, getMemberLevelStats, ClubLevelStats, MemberStats } from '../../services/allTimeStatisticsService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import {
  generateClubStatisticsCSV,
  generatePlayerStatisticsCSV,
  generateCommitMatrixCSV,
  exportToCSV,
  exportToCSVLocal,
} from '../../services/statisticsExportService';

interface AllTimeStatisticsTabProps {
  clubId?: string;
}

type SortKey = 'name' | 'amount' | 'playtime' | 'commits' | 'attendance';
type SortOrder = 'asc' | 'desc';

export default function AllTimeStatisticsTab(props: AllTimeStatisticsTabProps) {
  const route = useRoute();
  const passedClubId = props.clubId || (route.params as any)?.clubId;

  const [clubStats, setClubStats] = useState<ClubLevelStats | null>(null);
  const [memberStats, setMemberStats] = useState<MemberStats[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<'club' | 'member'>('club');
  const [selectedPenalties, setSelectedPenalties] = useState<Set<string>>(new Set());
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [penalties, setPenalties] = useState<Penalty[]>([]);

  const [clubSortKey, setClubSortKey] = useState<'name' | 'commits'>('commits');
  const [clubSortOrder, setClubSortOrder] = useState<SortOrder>('desc');
  const [playerSortKey, setPlayerSortKey] = useState<'amount' | 'playtime' | 'attendance' | 'name'>('amount');
  const [playerSortOrder, setPlayerSortOrder] = useState<SortOrder>('desc');
  const [matrixModalVisible, setMatrixModalVisible] = useState(false);

  useEffect(() => {
    loadStats();
  }, [passedClubId]);

  const loadStats = async () => {
    if (!passedClubId) {
      setError('Club ID not provided');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const [clubData, memberData, penaltiesData] = await Promise.all([
        getClubLevelStats(passedClubId),
        getMemberLevelStats(passedClubId),
        getPenaltiesByClub(passedClubId),
      ]);

      console.log('Club Stats Loaded:', clubData);
      console.log('Total Amount:', clubData.totalAmount);
      console.log('Commits by Penalty:', clubData.commitsByPenalty);
      console.log('Top Winners:', clubData.topWinnersByPenalty);
      console.log('Commit Matrix:', clubData.commitMatrix);

      setClubStats(clubData);
      setMemberStats(memberData);
      setPenalties(penaltiesData);
    } catch (err) {
      console.error('Failed to load statistics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const handleExportClubStats = async () => {
    try {
      if (!clubStats) return;
      const csv = generateClubStatisticsCSV(clubStats, {});
      await exportToCSV(csv, `club-statistics`);
      Alert.alert('Success', 'Club statistics saved to /PenaltyPro/StatisticsExports/');
    } catch (err) {
      Alert.alert('Error', `Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportCommitMatrix = async () => {
    try {
      if (!clubStats) return;
      const csv = generateCommitMatrixCSV(clubStats);
      await exportToCSV(csv, `commit-matrix`);
      Alert.alert('Success', 'Commit matrix saved to /PenaltyPro/StatisticsExports/');
    } catch (err) {
      Alert.alert('Error', `Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  const handleExportMemberStats = async () => {
    try {
      const csv = generatePlayerStatisticsCSV(memberStats, clubStats?.currency || '$');
      await exportToCSV(csv, `member-statistics`);
      Alert.alert('Success', 'Member statistics saved to /PenaltyPro/StatisticsExports/');
    } catch (err) {
      Alert.alert('Error', `Failed to export: ${err instanceof Error ? err.message : 'Unknown error'}`);
    }
  };

  // Filter and sort member statistics
  const filteredAndSortedPlayerStats = useMemo(() => {
    let filtered = [...memberStats];

    if (selectedMembers.size > 0) {
      filtered = filtered.filter(p => selectedMembers.has(p.memberId));
    }

    return filtered.sort((a, b) => {
      let aVal: any, bVal: any;

      switch (playerSortKey) {
        case 'amount':
          aVal = a.totalAmount;
          bVal = b.totalAmount;
          break;
        case 'playtime':
          aVal = a.totalPlaytime;
          bVal = b.totalPlaytime;
          break;
        case 'attendance':
          aVal = a.attendancePercentage;
          bVal = b.attendancePercentage;
          break;
          break;
        default:
          aVal = a.memberName;
          bVal = b.memberName;
      }

      if (typeof aVal === 'string') {
        return playerSortOrder === 'desc'
          ? bVal.localeCompare(aVal)
          : aVal.localeCompare(bVal);
      }

      return playerSortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
  }, [memberStats, selectedMembers, playerSortKey, playerSortOrder]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#3b82f6" />
        <Text style={styles.loadingText}>Loading statistics...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryButton} onPress={loadStats}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Tab Selection */}
      <View style={styles.tabSelector}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'club' && styles.tabButtonActive]}
          onPress={() => setActiveTab('club')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'club' && styles.tabButtonTextActive]}>
            Club Level
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === 'member' && styles.tabButtonActive]}
          onPress={() => setActiveTab('member')}
        >
          <Text style={[styles.tabButtonText, activeTab === 'member' && styles.tabButtonTextActive]}>
            Member Level
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {activeTab === 'club' && clubStats && (
          <View style={styles.section}>
            {/* Club Summary */}
            <View style={styles.summaryCard}>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelProminent}>💰 Total Amount:</Text>
                <Text style={styles.summaryValueProminent}>{clubStats.currency}{clubStats.totalAmount.toFixed(2)}</Text>
              </View>
              <View style={styles.summaryRow}>
                <Text style={styles.summaryLabelProminent}>⏱️ Total Playtime:</Text>
                <Text style={styles.summaryValueProminent}>{formatTime(clubStats.totalPlaytime)}</Text>
              </View>
            </View>

            {/* Commits by Penalty Table */}
            <View style={styles.tableSection}>
              <View style={styles.tableHeader}>
                <Text style={styles.tableSectionTitle}>Commits by Penalty</Text>
                <View style={styles.sortControls}>
                  <TouchableOpacity
                    onPress={() =>
                      setClubSortKey(clubSortKey === 'name' ? 'commits' : 'name')
                    }
                  >
                    <Text style={styles.sortButton}>
                      {clubSortKey === 'commits' ? '📊' : '📝'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() =>
                      setClubSortOrder(clubSortOrder === 'asc' ? 'desc' : 'asc')
                    }
                  >
                    <Text style={styles.sortButton}>
                      {clubSortOrder === 'asc' ? '⬆️' : '⬇️'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
              <FlatList
                data={clubStats.commitsByPenalty
                  .sort((a, b) => {
                    if (clubSortKey === 'commits') {
                      return clubSortOrder === 'desc' ? b.totalCommits - a.totalCommits : a.totalCommits - b.totalCommits;
                    }
                    return clubSortOrder === 'desc'
                      ? b.penaltyName.localeCompare(a.penaltyName)
                      : a.penaltyName.localeCompare(b.penaltyName);
                  })}
                keyExtractor={item => item.penaltyId}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.tableRow}>
                    <Text style={styles.penaltyName}>{item.penaltyName}</Text>
                    <Text style={styles.commitCount}>{item.totalCommits}</Text>
                  </View>
                )}
              />
            </View>

            {/* Top Winners by Penalty */}
            {clubStats.topWinnersByPenalty.length > 0 && (
              <View style={styles.tableSection}>
                <Text style={styles.tableSectionTitle}>Top Winners by Penalty</Text>
                {clubStats.topWinnersByPenalty.map(penalty => (
                  <View key={penalty.penaltyId} style={styles.penaltyWinnerSection}>
                    <Text style={styles.penaltyWinnerTitle}>{penalty.penaltyName}</Text>
                    {penalty.winners.map((winner, index) => (
                      <View key={winner.memberId} style={styles.winnerRow}>
                        <Text style={styles.winnerRank}>#{index + 1}</Text>
                        <Text style={styles.winnerName}>{winner.memberName}</Text>
                        <Text style={styles.winnerCount}>{winner.winCount} {winner.winCount === 1 ? 'win' : 'wins'}</Text>
                      </View>
                    ))}
                  </View>
                ))}
              </View>
            )}

            {/* Commit Matrix */}
            {clubStats.commitMatrix.length > 0 && (
              <View style={styles.tableSection}>
                <View style={styles.tableHeader}>
                  <Text style={styles.tableSectionTitle}>All-Time Commit Matrix</Text>
                  <View style={styles.matrixHeaderActions}>
                    <TouchableOpacity onPress={() => setMatrixModalVisible(true)}>
                      <Text style={styles.sortButton}>🔍 Fullscreen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={handleExportCommitMatrix}>
                      <Text style={styles.sortButton}>📥 CSV</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={styles.matrixContainer}>
                  {/* Penalty Header Row */}
                  <View style={styles.memberMatrixRow}>
                    <View style={styles.memberMatrixNameContainer}>
                      <Text style={styles.memberMatrixName}></Text>
                    </View>
                    <View style={styles.matrixCells}>
                      {clubStats.commitsByPenalty.map(penalty => (
                        <View key={penalty.penaltyId} style={styles.matrixHeaderCell}>
                          <Text style={styles.matrixHeaderText}>{penalty.penaltyName}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                  {clubStats.commitMatrix.map(member => (
                    <View key={member.memberId} style={styles.memberMatrixRow}>
                      <View style={styles.memberMatrixNameContainer}>
                        {member.photoUri ? (
                          <Image source={{ uri: member.photoUri }} style={styles.memberAvatarSmall} />
                        ) : (
                          <Image source={require('../../../assets/images/dummy/default-member.png')} style={styles.memberAvatarSmall} />
                        )}
                        <Text style={styles.memberMatrixName}>{member.memberName}</Text>
                      </View>
                      <View style={styles.matrixCells}>
                        {clubStats.commitsByPenalty.map(penalty => (
                          <View
                            key={`${member.memberId}-${penalty.penaltyId}`}
                            style={[
                              styles.matrixCell,
                              { 
                                backgroundColor: member.commitsByPenalty[penalty.penaltyId] 
                                  ? '#d1fae5' 
                                  : '#f3f4f6'
                              }
                            ]}
                          >
                            <Text style={styles.matrixCellText}>
                              {member.commitsByPenalty[penalty.penaltyId] || '—'}
                            </Text>
                          </View>
                        ))}
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Matrix Fullscreen Modal */}
            <Modal visible={matrixModalVisible} animationType="slide" onRequestClose={() => setMatrixModalVisible(false)}>
              <View style={styles.modalContainer}>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>All-Time Commit Matrix</Text>
                  <TouchableOpacity onPress={() => setMatrixModalVisible(false)}>
                    <Text style={styles.modalClose}>✖️ Close</Text>
                  </TouchableOpacity>
                </View>
                <ScrollView horizontal scrollEventThrottle={16} showsHorizontalScrollIndicator={true}>
                  <View>
                    {/* Frozen Header Row */}
                    <View style={styles.memberMatrixRow}>
                      <View style={styles.memberMatrixNameContainer}>
                        <Text style={styles.memberMatrixName}></Text>
                      </View>
                      <View style={styles.modalMatrixCells}>
                        {clubStats.commitsByPenalty.map(penalty => (
                          <View key={`modal-header-${penalty.penaltyId}`} style={styles.modalMatrixHeaderCell}>
                            <Text style={styles.matrixHeaderText}>{penalty.penaltyName}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    {clubStats.commitMatrix.map(member => (
                      <View key={`modal-${member.memberId}`} style={styles.memberMatrixRow}>
                        <View style={styles.memberMatrixNameContainer}>
                          {member.photoUri ? (
                            <Image source={{ uri: member.photoUri }} style={styles.memberAvatarSmall} />
                          ) : (
                            <Image source={require('../../../assets/images/dummy/default-member.png')} style={styles.memberAvatarSmall} />
                          )}
                          <Text style={styles.memberMatrixName}>{member.memberName}</Text>
                        </View>
                        <View style={styles.modalMatrixCells}>
                          {clubStats.commitsByPenalty.map(penalty => (
                            <View
                              key={`modal-${member.memberId}-${penalty.penaltyId}`}
                              style={[
                                styles.modalMatrixCell,
                                { 
                                  backgroundColor: member.commitsByPenalty[penalty.penaltyId] 
                                    ? '#d1fae5' 
                                    : '#f3f4f6'
                                }
                              ]}
                            >
                              <Text style={styles.matrixCellText}>
                                {member.commitsByPenalty[penalty.penaltyId] || '—'}
                              </Text>
                            </View>
                          ))}
                        </View>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </Modal>

            {/* Export Button */}
            <TouchableOpacity style={styles.exportButton} onPress={handleExportClubStats}>
              <Text style={styles.exportButtonText}>📥 Export as CSV</Text>
            </TouchableOpacity>
          </View>
        )}

        {activeTab === 'member' && (
          <View style={styles.section}>
            {/* Filter: Members */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Filter by Members:</Text>
              <View style={styles.filterChips}>
                {memberStats.map(member => (
                  <TouchableOpacity
                    key={member.memberId}
                    style={[
                      styles.chip,
                      selectedMembers.has(member.memberId) && styles.chipSelected,
                    ]}
                    onPress={() => {
                      const newSelected = new Set(selectedMembers);
                      if (newSelected.has(member.memberId)) {
                        newSelected.delete(member.memberId);
                      } else {
                        newSelected.add(member.memberId);
                      }
                      setSelectedMembers(newSelected);
                    }}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        selectedMembers.has(member.memberId) && styles.chipTextSelected,
                      ]}
                    >
                      {member.memberName}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Sort Controls */}
            <View style={styles.sortSection}>
              <Text style={styles.filterLabel}>Sort By:</Text>
              <View style={styles.sortButtons}>
                {['amount', 'playtime', 'attendance', 'name'].map(key => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.sortChip,
                      playerSortKey === key && styles.sortChipActive,
                    ]}
                    onPress={() => {
                      if (playerSortKey === key) {
                        setPlayerSortOrder(playerSortOrder === 'asc' ? 'desc' : 'asc');
                      } else {
                        setPlayerSortKey(key as any);
                        setPlayerSortOrder('desc');
                      }
                    }}
                  >
                    <Text
                      style={[
                        styles.sortChipText,
                        playerSortKey === key && styles.sortChipTextActive,
                      ]}
                    >
                      {key.charAt(0).toUpperCase() + key.slice(1)}
                      {playerSortKey === key && (playerSortOrder === 'asc' ? ' ⬆️' : ' ⬇️')}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Member Statistics Table */}
            <View style={styles.tableSection}>
              <Text style={styles.tableSectionTitle}>Member Statistics</Text>
              <FlatList
                data={memberStats
                  .filter(m => selectedMembers.size === 0 || selectedMembers.has(m.memberId))
                  .sort((a, b) => {
                    let aVal: any, bVal: any;

                    switch (playerSortKey) {
                      case 'amount':
                        aVal = a.totalAmount;
                        bVal = b.totalAmount;
                        break;
                      case 'playtime':
                        aVal = a.totalPlaytime;
                        bVal = b.totalPlaytime;
                        break;
                      case 'attendance':
                        aVal = a.attendancePercentage;
                        bVal = b.attendancePercentage;
                        break;
                      default:
                        aVal = a.memberName;
                        bVal = b.memberName;
                    }

                    if (typeof aVal === 'string') {
                      return playerSortOrder === 'desc'
                        ? bVal.localeCompare(aVal)
                        : aVal.localeCompare(bVal);
                    }

                    return playerSortOrder === 'desc' ? bVal - aVal : aVal - bVal;
                  })}
                keyExtractor={item => item.memberId}
                scrollEnabled={false}
                renderItem={({ item }) => (
                  <View style={styles.memberCard}>
                    <View style={[styles.memberHeader, { flexDirection: 'row', alignItems: 'center', gap: 8 }]}>
                      {item.photoUri ? (
                        <Image source={{ uri: item.photoUri }} style={styles.memberAvatar} />
                      ) : (
                        <Image source={require('../../../assets/images/dummy/default-member.png')} style={styles.memberAvatar} />
                      )}
                      <Text style={styles.memberName}>{item.memberName}</Text>
                    </View>
                    <View style={styles.memberStats}>
                      <View style={styles.memberStatRow}>
                        <Text style={styles.memberStatLabel}>Total Amount:</Text>
                        <Text style={styles.memberStatValue}>{clubStats?.currency}{item.totalAmount.toFixed(2)}</Text>
                      </View>
                      <View style={styles.memberStatRow}>
                        <Text style={styles.memberStatLabel}>Playtime:</Text>
                        <Text style={styles.memberStatValue}>{formatTime(item.totalPlaytime)}</Text>
                      </View>
                      <View style={styles.memberStatRow}>
                        <Text style={styles.memberStatLabel}>Attendance:</Text>
                        <Text style={styles.memberStatValue}>
                          {item.attendanceSessions} sessions ({item.attendancePercentage.toFixed(0)}%)
                        </Text>
                      </View>
                    </View>
                  </View>
                )}
              />
            </View>

            {/* Export Button */}
            <TouchableOpacity style={styles.exportButton} onPress={handleExportMemberStats}>
              <Text style={styles.exportButtonText}>📥 Export as CSV</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#000000',
  },
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    paddingHorizontal: 20,
  },
  errorText: {
    fontSize: 16,
    color: '#ef4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
  },
  retryText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  tabSelector: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: 'transparent',
  },
  tabButtonActive: {
    borderBottomColor: '#3b82f6',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#000000',
  },
  tabButtonTextActive: {
    color: '#000000',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 12,
  },
  summaryCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  summaryLabel: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '500',
  },
  summaryValue: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '700',
  },  summaryLabelProminent: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '700',
  },
  summaryValueProminent: {
    fontSize: 20,
    color: '#000000',
    fontWeight: '800',
  },  filterSection: {
    marginBottom: 16,
  },
  filterLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
    marginBottom: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  chipSelected: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  chipText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '500',
  },
  chipTextSelected: {
    color: '#ffffff',
  },
  sortSection: {
    marginBottom: 16,
  },
  sortButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sortChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#e2e8f0',
    borderWidth: 1,
    borderColor: '#cbd5e1',
  },
  sortChipActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  sortChipText: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '500',
  },
  sortChipTextActive: {
    color: '#ffffff',
  },
  tableSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 16,
    overflow: 'hidden',
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  tableSectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  sortControls: {
    flexDirection: 'row',
    gap: 8,
  },
  matrixHeaderActions: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
  },
  sortButton: {
    fontSize: 16,
    paddingHorizontal: 8,
  },
  tableRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  penaltyName: {
    flex: 1,
    fontSize: 14,
    color: '#000000',
    fontWeight: '600',
  },
  penaltySubtitle: {
    flex: 1,
    fontSize: 12,
    color: '#000000',
    marginTop: 4,
  },
  commitCount: {
    fontSize: 14,
    color: '#000000',
    fontWeight: '700',
    minWidth: 40,
    textAlign: 'right',
  },
  playerCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  playerHeader: {
    marginBottom: 8,
  },
  playerName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  memberCard: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  memberHeader: {
    marginBottom: 8,
  },
  memberAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000000',
  },
  memberStats: {
    gap: 4,
  },
  memberStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  memberStatLabel: {
    fontSize: 13,
    color: '#000000',
  },
  memberStatValue: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '600',
  },
  playerStats: {
    gap: 4,
  },
  playerStatRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  playerStatLabel: {
    fontSize: 13,
    color: '#000000',
  },
  playerStatValue: {
    fontSize: 13,
    color: '#000000',
    fontWeight: '600',
  },
  penaltyWinnerSection: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  penaltyWinnerTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 8,
  },
  winnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    paddingLeft: 12,
  },
  winnerRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
    width: 40,
  },
  winnerName: {
    flex: 1,
    fontSize: 13,
    color: '#000000',
  },
  winnerCount: {
    fontSize: 12,
    color: '#000000',
    fontWeight: '600',
  },
  matrixContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  memberMatrixRow: {
    flexDirection: 'row',
    marginBottom: 4,
    alignItems: 'center',
  },
  memberMatrixNameContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    width: 140,
    paddingRight: 8,
    gap: 8,
  },
  memberMatrixName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  memberAvatarSmall: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  matrixCells: {
    flexDirection: 'row',
    flex: 1,
  },
  matrixCell: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 32,
  },
  matrixCellText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
  },
  modalClose: {
    fontSize: 14,
    fontWeight: '700',
    color: '#ef4444',
  },
  matrixHeaderCell: {
    flex: 1,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 36,
  },
  matrixHeaderText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
  },
  modalMatrixCells: {
    flexDirection: 'row',
  },
  modalMatrixHeaderCell: {
    width: 60,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    minHeight: 36,
  },
  modalMatrixCell: {
    width: 60,
    padding: 4,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    minHeight: 32,
  },
  commitsBreakdown: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  commitsLabel: {
    fontSize: 12,
    color: '#475569',
    fontWeight: '600',
    marginBottom: 4,
  },
  commitItem: {
    fontSize: 12,
    color: '#64748b',
    marginVertical: 2,
  },
  exportButton: {
    marginHorizontal: 12,
    marginVertical: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  exportButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
  },
});
