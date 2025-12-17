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

  const [clubSortKey, setClubSortKey] = useState<'name' | 'commits' | 'amount'>('name');
  const [clubSortOrder, setClubSortOrder] = useState<SortOrder>('desc');
  const [playerSortKey, setPlayerSortKey] = useState<'amount' | 'playtime' | 'penalty' | 'name'>('amount');
  const [playerSortOrder, setPlayerSortOrder] = useState<SortOrder>('desc');
  const [selectedSortPenalty, setSelectedSortPenalty] = useState<string | null>(null);
  const [showPenaltySortModal, setShowPenaltySortModal] = useState(false);
  const [matrixModalVisible, setMatrixModalVisible] = useState(false);
  // Collapsible sections
  const [showCommitsByPenalty, setShowCommitsByPenalty] = useState(false);
  const [showTopWinners, setShowTopWinners] = useState(false);

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

  const getMemberPhotoUri = (memberId: string): string | undefined => {
    const member = memberStats.find(m => m.memberId === memberId);
    return member?.photoUri;
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
        case 'penalty':
          // Sort by selected penalty's commit count
          if (selectedSortPenalty && clubStats?.commitMatrix) {
            const aCommits = clubStats.commitMatrix.find(m => m.memberId === a.memberId)?.commitsByPenalty[selectedSortPenalty] || 0;
            const bCommits = clubStats.commitMatrix.find(m => m.memberId === b.memberId)?.commitsByPenalty[selectedSortPenalty] || 0;
            aVal = aCommits;
            bVal = bCommits;
          } else {
            aVal = 0;
            bVal = 0;
          }
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
  }, [memberStats, selectedMembers, playerSortKey, playerSortOrder, selectedSortPenalty, clubStats]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
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
            {/* Prominent Totals - Two Boxes */}
            <View style={styles.totalCardsContainer}>
              {/* Total Amount Box */}
              <View style={styles.totalCard}>
                <Text style={styles.totalCardLabel}>Total Amount</Text>
                <Text style={styles.totalCardValue}>
                  {clubStats.currency}{clubStats.totalAmount.toFixed(2)}
                </Text>
              </View>
              {/* Total Playtime Box */}
              <View style={styles.totalCard}>
                <Text style={styles.totalCardLabel}>Total Playtime</Text>
                <Text style={styles.totalCardValue}>
                  {formatTime(clubStats.totalPlaytime)}
                </Text>
              </View>
            </View>

            {/* Penalty Analysis - Collapsible */}
            <View style={styles.collapsibleSection}>
              <TouchableOpacity
                style={styles.collapsibleHeader}
                onPress={() => setShowCommitsByPenalty(!showCommitsByPenalty)}
              >
                <View style={styles.collapsibleHeaderContent}>
                  <Text style={styles.collapsibleTitle}>
                    {showCommitsByPenalty ? '∨' : '>'} Penalty Analysis
                  </Text>
                  {!showCommitsByPenalty && (
                    <Text style={styles.collapsibleHint}>
                      {clubStats.commitsByPenalty.length} penalties
                    </Text>
                  )}
                </View>
              </TouchableOpacity>
              {showCommitsByPenalty && (
                <View style={styles.tableSection}>
                  {/* Sort Controls */}
                  <View style={styles.sortControlsContainer}>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, clubSortKey === 'name' && styles.sortToggleButtonActive]}
                      onPress={() => {
                        if (clubSortKey === 'name') {
                          setClubSortOrder(clubSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setClubSortKey('name');
                          setClubSortOrder('asc');
                        }
                      }}
                    >
                      <Text style={[styles.sortToggleButtonText, clubSortKey === 'name' && styles.sortToggleButtonTextActive]}>
                        Name {clubSortKey === 'name' && (clubSortOrder === 'asc' ? '↑' : '↓')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, clubSortKey === 'commits' && styles.sortToggleButtonActive]}
                      onPress={() => {
                        if (clubSortKey === 'commits') {
                          setClubSortOrder(clubSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setClubSortKey('commits');
                          setClubSortOrder('desc');
                        }
                      }}
                    >
                      <Text style={[styles.sortToggleButtonText, clubSortKey === 'commits' && styles.sortToggleButtonTextActive]}>
                        Commits {clubSortKey === 'commits' && (clubSortOrder === 'asc' ? '↑' : '↓')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.sortToggleButton, clubSortKey === 'amount' && styles.sortToggleButtonActive]}
                      onPress={() => {
                        if (clubSortKey === 'amount') {
                          setClubSortOrder(clubSortOrder === 'asc' ? 'desc' : 'asc');
                        } else {
                          setClubSortKey('amount');
                          setClubSortOrder('desc');
                        }
                      }}
                    >
                      <Text style={[styles.sortToggleButtonText, clubSortKey === 'amount' && styles.sortToggleButtonTextActive]}>
                        Amount {clubSortKey === 'amount' && (clubSortOrder === 'asc' ? '↑' : '↓')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {/* Table Headers */}
                  <View style={styles.tableHeaderRow}>
                    <Text style={[styles.tableHeaderCell, styles.tableHeaderName]}>Penalty Name</Text>
                    <View style={styles.tableRowValues}>
                      <Text style={[styles.tableHeaderCell, styles.tableHeaderCount]}>Commits</Text>
                      <Text style={[styles.tableHeaderCell, styles.tableHeaderAmount]}>Total Amount</Text>
                    </View>
                  </View>
                  <FlatList
                    data={clubStats.commitsByPenalty
                      .sort((a, b) => {
                        if (clubSortKey === 'commits') {
                          return clubSortOrder === 'desc' ? b.totalCommits - a.totalCommits : a.totalCommits - b.totalCommits;
                        }
                        if (clubSortKey === 'amount') {
                          return clubSortOrder === 'desc' ? b.totalAmount - a.totalAmount : a.totalAmount - b.totalAmount;
                        }
                        return clubSortOrder === 'desc'
                          ? b.penaltyName.localeCompare(a.penaltyName)
                          : a.penaltyName.localeCompare(b.penaltyName);
                      })}
                    keyExtractor={item => item.penaltyId}
                    scrollEnabled={false}
                    renderItem={({ item, index }) => (
                      <View style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlternate]}>
                        <Text style={styles.penaltyName}>{item.penaltyName}</Text>
                        <View style={styles.tableRowValues}>
                          <Text style={styles.commitCount}>{item.totalCommits}</Text>
                          <Text style={styles.amountValue}>
                            {clubStats.currency || '€'}{item.totalAmount.toFixed(2)}
                          </Text>
                        </View>
                      </View>
                    )}
                  />
                </View>
              )}
            </View>

            {/* Top Winners by Penalty - Collapsible */}
            {clubStats.topWinnersByPenalty.length > 0 && (
              <View style={styles.collapsibleSection}>
                <TouchableOpacity
                  style={styles.collapsibleHeader}
                  onPress={() => setShowTopWinners(!showTopWinners)}
                >
                  <View style={styles.collapsibleHeaderContent}>
                    <Text style={styles.collapsibleTitle}>
                      {showTopWinners ? '∨' : '>'} Top Winners by Penalty
                    </Text>
                    {!showTopWinners && (
                      <Text style={styles.collapsibleHint}>
                        {clubStats.topWinnersByPenalty.length} penalties
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
                {showTopWinners && (
                  <View style={styles.tableSection}>
                    {clubStats.topWinnersByPenalty.map(penalty => (
                      <View key={penalty.penaltyId} style={styles.penaltyWinnerSection}>
                        <Text style={styles.penaltyWinnerTitle}>{penalty.penaltyName}</Text>
                        {penalty.winners.map((winner, index) => {
                          const photoUri = getMemberPhotoUri(winner.memberId);
                          return (
                            <View key={winner.memberId} style={styles.winnerRow}>
                              <Image
                                source={
                                  photoUri
                                    ? { uri: photoUri }
                                    : require('../../../assets/images/dummy/default_member.png')
                                }
                                style={styles.winnerAvatar}
                              />
                              <View style={styles.winnerInfo}>
                                <Text style={styles.winnerRank}>#{index + 1}</Text>
                                <Text style={styles.winnerName}>{winner.memberName}</Text>
                              </View>
                              <Text style={styles.winnerCount}>{winner.winCount} {winner.winCount === 1 ? 'win' : 'wins'}</Text>
                            </View>
                          );
                        })}
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}

            {/* Commit Matrix - Fullscreen Access */}
            {clubStats.commitMatrix.length > 0 && (
              <View style={styles.tableSection}>
                <View style={styles.matrixAccessCard}>
                  <View style={styles.matrixAccessHeader}>
                    <Text style={styles.matrixAccessTitle}>📊 All-Time Commit Matrix</Text>
                    <Text style={styles.matrixAccessSubtitle}>
                      View detailed commit counts for all {clubStats.commitMatrix.length} members across {clubStats.commitsByPenalty.length} penalties
                    </Text>
                  </View>
                  <View style={styles.matrixAccessButtons}>
                    <TouchableOpacity 
                      style={styles.matrixViewButton} 
                      onPress={() => setMatrixModalVisible(true)}
                    >
                      <Text style={styles.matrixViewButtonText}>📲 View Fullscreen</Text>
                    </TouchableOpacity>
                    <TouchableOpacity 
                      style={styles.matrixExportButton} 
                      onPress={handleExportCommitMatrix}
                    >
                      <Text style={styles.matrixExportButtonText}>📥 Export CSV</Text>
                    </TouchableOpacity>
                  </View>
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
                        {/* Total Commits Column Header */}
                        <View style={styles.modalMatrixHeaderCell}>
                          <Text style={styles.matrixHeaderText}>Total</Text>
                        </View>
                      </View>
                    </View>
                    {clubStats.commitMatrix.map((member, memberIndex) => {
                      // Calculate total commits for this member
                      const totalCommits = Object.values(member.commitsByPenalty).reduce((sum, count) => sum + count, 0);
                      return (
                        <View key={`modal-${member.memberId}`} style={[styles.memberMatrixRow, memberIndex % 2 === 1 && styles.matrixRowAlternate]}>
                          <View style={styles.memberMatrixNameContainer}>
                            {member.photoUri ? (
                              <Image source={{ uri: member.photoUri }} style={styles.memberAvatarSmall} />
                            ) : (
                              <Image source={require('../../../assets/images/dummy/default_member.png')} style={styles.memberAvatarSmall} />
                            )}
                            <Text style={styles.memberMatrixName}>{member.memberName}</Text>
                          </View>
                          <View style={styles.modalMatrixCells}>
                            {clubStats.commitsByPenalty.map(penalty => (
                              <View
                                key={`modal-${member.memberId}-${penalty.penaltyId}`}
                                style={[
                                  styles.modalMatrixCell,
                                  memberIndex % 2 === 1 && styles.matrixCellAlternate,
                                  { 
                                    backgroundColor: member.commitsByPenalty[penalty.penaltyId] 
                                      ? memberIndex % 2 === 1 ? '#c7f0d8' : '#d1fae5' 
                                      : memberIndex % 2 === 1 ? '#f0f1f3' : '#f3f4f6'
                                  }
                                ]}
                              >
                                <Text style={styles.matrixCellText}>
                                  {member.commitsByPenalty[penalty.penaltyId] || '—'}
                                </Text>
                              </View>
                            ))}
                            {/* Total Commits Cell */}
                            <View
                              style={[
                                styles.modalMatrixCell,
                                memberIndex % 2 === 1 && styles.matrixCellAlternate,
                                styles.matrixCellTotal,
                                {
                                  backgroundColor: memberIndex % 2 === 1 ? '#e0f2fe' : '#e0f7ff'
                                }
                              ]}
                            >
                              <Text style={[styles.matrixCellText, styles.matrixCellTotalText]}>
                                {totalCommits}
                              </Text>
                            </View>
                          </View>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </Modal>
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
                {/* Name Sort */}
                <TouchableOpacity
                  style={[
                    styles.sortChip,
                    playerSortKey === 'name' && styles.sortChipActive,
                  ]}
                  onPress={() => {
                    if (playerSortKey === 'name') {
                      setPlayerSortOrder(playerSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setPlayerSortKey('name');
                      setPlayerSortOrder('asc');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      playerSortKey === 'name' && styles.sortChipTextActive,
                    ]}
                  >
                    Name
                    {playerSortKey === 'name' && (playerSortOrder === 'asc' ? ' ⬆️' : ' ⬇️')}
                  </Text>
                </TouchableOpacity>

                {/* Amount Sort */}
                <TouchableOpacity
                  style={[
                    styles.sortChip,
                    playerSortKey === 'amount' && styles.sortChipActive,
                  ]}
                  onPress={() => {
                    if (playerSortKey === 'amount') {
                      setPlayerSortOrder(playerSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setPlayerSortKey('amount');
                      setPlayerSortOrder('desc');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      playerSortKey === 'amount' && styles.sortChipTextActive,
                    ]}
                  >
                    Amount
                    {playerSortKey === 'amount' && (playerSortOrder === 'asc' ? ' ⬆️' : ' ⬇️')}
                  </Text>
                </TouchableOpacity>

                {/* Playtime Sort */}
                <TouchableOpacity
                  style={[
                    styles.sortChip,
                    playerSortKey === 'playtime' && styles.sortChipActive,
                  ]}
                  onPress={() => {
                    if (playerSortKey === 'playtime') {
                      setPlayerSortOrder(playerSortOrder === 'asc' ? 'desc' : 'asc');
                    } else {
                      setPlayerSortKey('playtime');
                      setPlayerSortOrder('desc');
                    }
                  }}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      playerSortKey === 'playtime' && styles.sortChipTextActive,
                    ]}
                  >
                    Playtime
                    {playerSortKey === 'playtime' && (playerSortOrder === 'asc' ? ' ⬆️' : ' ⬇️')}
                  </Text>
                </TouchableOpacity>

                {/* Penalties Sort */}
                <TouchableOpacity
                  style={[
                    styles.sortChip,
                    playerSortKey === 'penalty' && styles.sortChipActive,
                  ]}
                  onPress={() => setShowPenaltySortModal(true)}
                >
                  <Text
                    style={[
                      styles.sortChipText,
                      playerSortKey === 'penalty' && styles.sortChipTextActive,
                    ]}
                  >
                    Penalties
                    {playerSortKey === 'penalty' && selectedSortPenalty && (playerSortOrder === 'asc' ? ' ⬆️' : ' ⬇️')}
                  </Text>
                </TouchableOpacity>
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
                      case 'penalty':
                        // Sort by selected penalty's commit count
                        if (selectedSortPenalty && clubStats?.commitMatrix) {
                          const aCommits = clubStats.commitMatrix.find(m => m.memberId === a.memberId)?.commitsByPenalty[selectedSortPenalty] || 0;
                          const bCommits = clubStats.commitMatrix.find(m => m.memberId === b.memberId)?.commitsByPenalty[selectedSortPenalty] || 0;
                          aVal = aCommits;
                          bVal = bCommits;
                        } else {
                          aVal = 0;
                          bVal = 0;
                        }
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
                renderItem={({ item }) => {
                  // Get all-time commit counts per penalty for this member
                  const memberCommitData = clubStats?.commitMatrix.find(m => m.memberId === item.memberId);
                  const commitsByPenalty = memberCommitData?.commitsByPenalty || {};
                  
                  return (
                  <View style={styles.profileCard}>
                    {/* Member Identity (Profile Header) - Centered */}
                    <View style={styles.profileHeader}>
                      {item.photoUri ? (
                        <Image source={{ uri: item.photoUri }} style={styles.profileAvatar} />
                      ) : (
                        <Image source={require('../../../assets/images/dummy/default_member.png')} style={styles.profileAvatar} />
                      )}
                      <Text style={styles.profileName}>{item.memberName}</Text>
                      
                      {/* Total Playtime (Statistics-specific extension) */}
                      <View style={styles.profilePlaytimeSection}>
                        <Text style={styles.profilePlaytimeLabel}>Total Playtime</Text>
                        <Text style={styles.profilePlaytimeValue}>{formatTime(item.totalPlaytime)}</Text>
                      </View>
                    </View>
                    
                    {/* All-Time Penalty Breakdown (matching Session Details structure) */}
                    <View style={styles.profileCommitsSection}>
                      {penalties
                        .filter(p => p.active)
                        .filter(p => (commitsByPenalty[p.id] || 0) > 0)
                        .map(penalty => (
                          <View key={penalty.id} style={styles.profileCommitRow}>
                            <Text style={styles.profileCommitLabel}>{penalty.name}:</Text>
                            <Text style={styles.profileCommitValue}>
                              {commitsByPenalty[penalty.id] || 0}
                            </Text>
                          </View>
                        ))}
                    </View>
                    
                    {/* Strong Divider */}
                    <View style={styles.profileDivider} />
                    
                    {/* Summary Section (Emphasized) */}
                    <View style={styles.profileSummarySection}>
                      <Text style={styles.profileSummaryLabel}>Lifetime Contribution</Text>
                      <Text
                        style={[
                          styles.profileSummaryValue,
                          item.totalAmount < 0 ? { color: '#10B981' } : item.totalAmount > 0 ? { color: '#EF4444' } : { color: '#64748B' }
                        ]}
                      >
                        {clubStats?.currency}{item.totalAmount.toFixed(2)}
                      </Text>
                    </View>
                  </View>
                  );
                }}
              />
            </View>

            {/* Penalty Sort Selection Modal */}
            <Modal visible={showPenaltySortModal} animationType="slide" transparent>
              <View style={styles.modalOverlay}>
                <View style={styles.modalContent}>
                  <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>Sort by Penalty</Text>
                    <TouchableOpacity onPress={() => setShowPenaltySortModal(false)}>
                      <Text style={styles.modalCloseText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                  <FlatList
                    data={penalties.filter(p => p.active)}
                    keyExtractor={p => p.id}
                    renderItem={({ item: p }) => (
                      <TouchableOpacity
                        style={[
                          styles.penaltyItem,
                          selectedSortPenalty === p.id && styles.penaltyItemSelected,
                        ]}
                        onPress={() => {
                          setSelectedSortPenalty(p.id);
                          setPlayerSortKey('penalty');
                          setPlayerSortOrder('desc');
                          setShowPenaltySortModal(false);
                        }}
                      >
                        <Text style={styles.penaltyItemText}>{p.name}</Text>
                        <Text style={styles.penaltyItemMeta}>{p.affect}</Text>
                      </TouchableOpacity>
                    )}
                  />
                </View>
              </View>
            </Modal>
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
  // Prominent Total Cards
  totalCardsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  totalCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  totalCardLabel: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  totalCardValue: {
    fontSize: 28,
    color: '#000000',
    fontWeight: '800',
    textAlign: 'center',
  },
  // Collapsible Sections - Redesigned for visual appeal
  collapsibleSection: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    overflow: 'hidden',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 2,
  },
  collapsibleHeader: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: '#f8fafc',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  collapsibleHeaderContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  collapsibleTitle: {
    fontSize: 16,
    color: '#000000',
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  collapsibleHint: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
  // Alternating Row Shading
  tableRowAlternate: {
    backgroundColor: '#f8fafc',
  },
  tableRowValues: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
    minWidth: 140,
    flexShrink: 0,
  },
  filterSection: {
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
  // New sort toggle buttons for Penalty Analysis
  sortControlsContainer: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
    backgroundColor: '#ffffff',
  },
  sortToggleButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    backgroundColor: '#f3f4f6',
    borderWidth: 1.5,
    borderColor: '#d1d5db',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sortToggleButtonActive: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  sortToggleButtonText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
    textAlign: 'center',
  },
  sortToggleButtonTextActive: {
    color: '#ffffff',
  },
  // Table header row
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#f9fafb',
    borderBottomWidth: 1.5,
    borderBottomColor: '#e5e7eb',
  },
  tableHeaderCell: {
    fontSize: 12,
    fontWeight: '700',
    color: '#374151',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  tableHeaderName: {
    flex: 1,
  },
  tableHeaderCount: {
    minWidth: 40,
    textAlign: 'right',
  },
  tableHeaderAmount: {
    minWidth: 80,
    textAlign: 'right',
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
    justifyContent: 'flex-start',
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
  amountValue: {
    fontSize: 14,
    color: '#1e40af',
    fontWeight: '600',
    minWidth: 80,
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
  // Profile Card Styles (Steckbrief design - matching SessionDetailsScreen)
  profileCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
    marginHorizontal: 12,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  // Member Identity Section (Dominant)
  profileHeader: {
    alignItems: 'center',
    marginBottom: 20,
  },
  profileAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#E5E7EB',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#3B82F6',
  },
  profileName: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
    marginBottom: 8,
  },
  // Total Playtime Section (Statistics-specific extension)
  profilePlaytimeSection: {
    alignItems: 'center',
    marginTop: 4,
  },
  profilePlaytimeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  profilePlaytimeValue: {
    fontSize: 18,
    fontWeight: '700',
    color: '#3B82F6',
  },
  // Commit Breakdown Section (matching SessionDetailsScreen)
  profileCommitsSection: {
    marginBottom: 16,
  },
  profileCommitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
  },
  profileCommitLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#64748B',
  },
  profileCommitValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  // Strong Divider
  profileDivider: {
    height: 4,
    backgroundColor: '#CBD5E1',
    marginVertical: 16,
    borderRadius: 2,
  },
  // Summary Section (Emphasized)
  profileSummarySection: {
    alignItems: 'center',
    paddingTop: 8,
  },
  profileSummaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  profileSummaryValue: {
    fontSize: 32,
    fontWeight: '900',
    textAlign: 'center',
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
    gap: 10,
  },
  winnerAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#e5e7eb',
  },
  winnerInfo: {
    flex: 1,
  },
  winnerRank: {
    fontSize: 12,
    fontWeight: '700',
    color: '#000000',
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
  // Commit Matrix Access Card Styles
  matrixAccessCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 2,
    borderColor: '#3b82f6',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  matrixAccessHeader: {
    marginBottom: 16,
  },
  matrixAccessTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e40af',
    marginBottom: 8,
  },
  matrixAccessSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },
  matrixAccessButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  matrixViewButton: {
    flex: 1,
    backgroundColor: '#3b82f6',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3b82f6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  matrixViewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  matrixExportButton: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingVertical: 14,
    paddingHorizontal: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  matrixExportButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3b82f6',
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
  matrixCellAlternate: {
    // Used for row alternation background adjustments
  },
  matrixCellTotal: {
    // Total column styling
    fontWeight: '700',
    borderLeftWidth: 2,
    borderLeftColor: '#3b82f6',
  },
  matrixCellTotalText: {
    fontWeight: '700',
    color: '#1e40af',
  },
  matrixRowAlternate: {
    // For zebra striping in matrix rows
    backgroundColor: '#f9fafb',
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
  // Penalty Sort Modal Styles
  modalOverlay: { 
    flex: 1, 
    backgroundColor: 'rgba(0, 0, 0, 0.5)', 
    justifyContent: 'flex-end' 
  },
  modalContent: { 
    backgroundColor: '#ffffff', 
    borderTopLeftRadius: 16, 
    borderTopRightRadius: 16, 
    paddingHorizontal: 16, 
    paddingTop: 16, 
    maxHeight: '80%' 
  },
  modalCloseText: { 
    fontSize: 14, 
    color: '#3b82f6', 
    fontWeight: '600' 
  },
  penaltyItem: { 
    paddingVertical: 12, 
    paddingHorizontal: 8, 
    borderBottomWidth: 1, 
    borderBottomColor: '#e2e8f0' 
  },
  penaltyItemSelected: { 
    backgroundColor: '#dbeafe' 
  },
  penaltyItemText: { 
    fontSize: 14, 
    fontWeight: '600', 
    color: '#1e293b' 
  },
  penaltyItemMeta: { 
    fontSize: 12, 
    color: '#64748b', 
    marginTop: 4 
  },
});
