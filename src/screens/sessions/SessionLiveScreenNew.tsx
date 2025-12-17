/**
 * SessionLiveScreen (New Table Grid Layout)
 * 
 * Displays an active session with:
 * - Table grid: Y-axis = members, X-axis = penalties
 * - Each cell: [−] count [+] for commits
 * - Member totals (sticky right column)
 * - Penalty names (sticky top row)
 * - Session timer (HH:MM:SS)
 * - Multiplier button (top-right) with slider modal
 * - Live session summary
 * - End Session button
 */

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import {
  Alert,
  SafeAreaView,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Modal,
  StyleSheet,
  ActivityIndicator,
  Dimensions,
  Image,
} from 'react-native';
import Slider from '@react-native-community/slider';
import { useFocusEffect } from '@react-navigation/native';
import { Session, getSession, updateMultiplier, updateTotalAmounts } from '../../services/sessionService';
import { SessionLog, getLogsBySession, createLog } from '../../services/sessionLogService';
import { addCommit, negativeCommit } from '../../services/commitService';
import { getPenaltiesByClub, Penalty } from '../../services/penaltyService';
import { getMembersByClub, Member, createMember } from '../../services/memberService';
import { getClub, Club } from '../../services/clubService';
import { SessionEndModals } from '../../components/SessionEndModals';
import { formatCommitCountFromMap } from '../../utils/commitFormatter';
import { db } from '../../database/db';

interface Props {
  route: {
    params: {
      sessionId: string;
      clubId: string;
      clubName?: string;
      maxMultiplier?: number;
    };
  };
  navigation: any;
}

interface CommitState {
  [memberId: string]: {
    [penaltyId: string]: number;
  };
}

interface MemberTotals {
  [memberId: string]: number;
}

export function SessionLiveScreenNew({ route, navigation }: Props) {
  const { sessionId, clubId, clubName = 'Club', maxMultiplier: maxMultParam = 10 } = route.params;

  const [session, setSession] = useState<Session | null>(null);
  const [club, setClub] = useState<Club | null>(null);
  const [logs, setLogs] = useState<SessionLog[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // State management
  const [commitCounts, setCommitCounts] = useState<CommitState>({});
  const [memberTotals, setMemberTotals] = useState<MemberTotals>({});
  const [currentMultiplier, setCurrentMultiplier] = useState(1);
  const [showMultiplierModal, setShowMultiplierModal] = useState(false);
  const [sliderMultiplier, setSliderMultiplier] = useState(1);
  const [showAddMembersModal, setShowAddMembersModal] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [showCreateMemberInline, setShowCreateMemberInline] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [showEndModals, setShowEndModals] = useState(false);
  const [tick, setTick] = useState(0);
  
  // End session flow state
  const [showEndConfirmModal, setShowEndConfirmModal] = useState(false);
  const [isFinalizingSession, setIsFinalizingSession] = useState(false);
  const [showTitleModal, setShowTitleModal] = useState(false);
  const [showRewardModal, setShowRewardModal] = useState(false);
  const [currentTitleIndex, setCurrentTitleIndex] = useState(0);
  const [currentRewardIndex, setCurrentRewardIndex] = useState(0);
  const [selectedWinnerId, setSelectedWinnerId] = useState<string>('');
  const [rewardValueInput, setRewardValueInput] = useState('');
  const [titlesToResolve, setTitlesToResolve] = useState<{penaltyId: string; tiedMembers: string[]; maxCount: number}[]>([]);
  const [rewardsToResolve, setRewardsToResolve] = useState<{penaltyId: string; winnerId: string}[]>([]);
  const [resolvedWinners, setResolvedWinners] = useState<Record<string, string>>({});

  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessing = useRef(false);
  // UPDATED (Crash/Resume): track scroll positions for reliable UI restoration
  const verticalScrollRef = useRef<ScrollView | null>(null);
  const horizontalScrollRef = useRef<ScrollView | null>(null);
  const [savedScrollY, setSavedScrollY] = useState(0);
  const [savedScrollX, setSavedScrollX] = useState(0);
  const hasRestoredScroll = useRef(false);

  /**
   * Load session data and rebuild state from logs
   */
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const sessionData = await getSession(sessionId);
      if (!sessionData) throw new Error('Session not found');
      setSession(sessionData);
      setCurrentMultiplier(sessionData.multiplier);
      setSliderMultiplier(sessionData.multiplier);

      const [logRows, clubPenalties, clubMembers, clubData] = await Promise.all([
        getLogsBySession(sessionId),
        getPenaltiesByClub(clubId),
        getMembersByClub(clubId),
        getClub(clubId),
      ]);
      
      setLogs(logRows);
      const activePenalties = clubPenalties.filter(p => p.active);
      setPenalties(activePenalties);
      setMembers(clubMembers);
      setClub(clubData || null);

      const activeMemberIds = sessionData.activePlayers || [];
      const activeMembersList = clubMembers.filter(m => activeMemberIds.includes(m.id));

      // Build a map of member join times (when system=1 log appears)
      const memberJoinTimes: Record<string, string> = {};
      for (const log of logRows) {
        if (log.system === 1 && log.memberId && !memberJoinTimes[log.memberId]) {
          memberJoinTimes[log.memberId] = log.timestamp;
        }
      }

      // UPDATED (Crash/Resume): Restore multiplier from the last system=5 log, else session.multiplier
      const lastMultLog = [...logRows].reverse().find(l => l.system === 5);
      const restoredMultiplier = lastMultLog?.multiplier ?? sessionData.multiplier ?? 1;
      setCurrentMultiplier(restoredMultiplier);
      setSliderMultiplier(restoredMultiplier);

      // Rebuild state from logs
      const newCommitCounts: CommitState = {};
      const newTotals: MemberTotals = {};

      // Initialize zero counts and totals
      for (const member of activeMembersList) {
        if (!newCommitCounts[member.id]) {
          newCommitCounts[member.id] = {};
        }
        for (const penalty of activePenalties) {
          newCommitCounts[member.id][penalty.id] = 0;
        }
        newTotals[member.id] = 0;
      }

      // Replay logs to rebuild state
      let lastMultiplier = 1;
      for (const log of logRows) {
        if (log.system === 5) {
          // Multiplier change
          lastMultiplier = log.multiplier || 1;
        } else if (log.system === 8 || log.system === 9) {
          // Commit event
          if (log.memberId && log.penaltyId) {
            const delta = log.system === 8 ? 1 : -1;
            if (!newCommitCounts[log.memberId]) {
              newCommitCounts[log.memberId] = {};
            }
            newCommitCounts[log.memberId][log.penaltyId] =
              (newCommitCounts[log.memberId][log.penaltyId] || 0) + delta;

            // Recalculate totals with affect rules
            const penalty = activePenalties.find(p => p.id === log.penaltyId);
            if (penalty) {
              const multiplier = log.multiplier || lastMultiplier;
              const amountSelf = penalty.amount * multiplier;
              const amountOther = penalty.amountOther * multiplier;

              if (penalty.affect === 'SELF') {
                newTotals[log.memberId] = (newTotals[log.memberId] || 0) + delta * amountSelf;
              } else if (penalty.affect === 'OTHER') {
                for (const m of activeMembersList) {
                  if (m.id !== log.memberId) {
                    // Only apply OTHER penalty if member had joined before this log
                    const memberJoinTime = memberJoinTimes[m.id];
                    if (!memberJoinTime || memberJoinTime <= log.timestamp) {
                      newTotals[m.id] = (newTotals[m.id] || 0) + delta * amountOther;
                    }
                  }
                }
              } else if (penalty.affect === 'BOTH') {
                newTotals[log.memberId] = (newTotals[log.memberId] || 0) + delta * amountSelf;
                for (const m of activeMembersList) {
                  if (m.id !== log.memberId) {
                    // Only apply OTHER penalty if member had joined before this log
                    const memberJoinTime = memberJoinTimes[m.id];
                    if (!memberJoinTime || memberJoinTime <= log.timestamp) {
                      newTotals[m.id] = (newTotals[m.id] || 0) + delta * amountOther;
                    }
                  }
                }
              }
              // NONE affect: no change to totals
            }
          }
        }
      }

      setCommitCounts(newCommitCounts);
      setMemberTotals(newTotals);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to load session');
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, clubId]);

  // UPDATED (Crash/Resume): run loadData and manage timer on screen focus
  useFocusEffect(
    useCallback(() => {
      loadData();
      if (!timerRef.current) {
        timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
      }
      // Restore saved scroll positions once after initial layout
      if (!hasRestoredScroll.current) {
        setTimeout(() => {
          if (verticalScrollRef.current && savedScrollY > 0) {
            verticalScrollRef.current.scrollTo({ y: savedScrollY, animated: false });
          }
          if (horizontalScrollRef.current && savedScrollX > 0) {
            horizontalScrollRef.current.scrollTo({ x: savedScrollX, animated: false });
          }
          hasRestoredScroll.current = true;
        }, 0);
      }
      return () => {
        if (timerRef.current) {
          clearInterval(timerRef.current);
          timerRef.current = null;
        }
      };
    }, [loadData])
  );

  // Timer effect
  useEffect(() => {
    if (!session) return;
    timerRef.current && clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setTick(t => t + 1), 1000);
    return () => {
      timerRef.current && clearInterval(timerRef.current);
    };
  }, [session?.startTime]);

  /**
   * Format elapsed time as HH:MM:SS
   */
  const elapsedTime = useMemo(() => {
    if (!session) return '00:00:00';
    const start = new Date(session.startTime).getTime();
    const now = Date.now();
    const diff = Math.max(0, Math.floor((now - start) / 1000));
    const hh = String(Math.floor(diff / 3600)).padStart(2, '0');
    const mm = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
    const ss = String(diff % 60).padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }, [session?.startTime, tick]);

  /**
   * Calculate total session amount
   */
  const totalSessionAmount = useMemo(() => {
    return Object.values(memberTotals).reduce((sum, total) => sum + total, 0);
  }, [memberTotals]);

  // Format date as YYYY/MM/DD (JJJJ/MM/DD)
  const formattedDate = useMemo(() => {
    const parts = session?.date ? session.date.split('-') : [];
    if (parts.length === 3) {
      return `${parts[0]}/${parts[1]}/${parts[2]}`;
    }
    return session?.date || '';
  }, [session?.date]);

  /**
   * Format commit display with multiplier grouping using shared formatter
   */
  const formatCommitDisplay = useCallback(
    (memberId: string, penaltyId: string): string => {
      const total = commitCounts[memberId]?.[penaltyId] || 0;

      // Group by multiplier from logs
      const byMultiplier: Record<number, number> = {};
      for (const log of logs) {
        if (
          (log.system === 8 || log.system === 9) &&
          log.memberId === memberId &&
          log.penaltyId === penaltyId &&
          log.multiplier
        ) {
          const mult = log.multiplier;
          const delta = log.system === 8 ? 1 : -1;
          byMultiplier[mult] = (byMultiplier[mult] || 0) + delta;
        }
      }

      return formatCommitCountFromMap(total, byMultiplier);
    },
    [commitCounts, logs]
  );

  const formatPenaltyAmount = useCallback((penalty: Penalty): string => {
    const formatNumber = (value: number) =>
      Math.abs(value % 1) < 0.001 ? value.toString() : value.toFixed(2);

    const amountSelf = penalty.amount || 0;
    const amountOther = penalty.amountOther || 0;

    // UPDATED: Add currency symbol from club if available
    const currencySymbol = club?.currency || '$';

    // active-table: hide amounts when both zero
    if (amountSelf === 0 && amountOther === 0) return '';

    const selfText = amountSelf === 0 ? '' : `${currencySymbol}${formatNumber(amountSelf)}`;
    const otherText = amountOther === 0 ? '' : `${currencySymbol}${formatNumber(amountOther)}`;

    // active-table: new "(Other)" display and zero handling
    if (penalty.affect === 'SELF') return selfText;
    if (penalty.affect === 'OTHER') return otherText ? `${otherText} (Other)` : '';
    if (penalty.affect === 'BOTH') {
      if (selfText && otherText) return `${selfText} / ${otherText} (Other)`;
      if (!selfText && otherText) return `${otherText} (Other)`;
      if (selfText && !otherText) return selfText;
      return '';
    }
    return selfText;
  }, [club?.currency]);

  const availableMembers = useMemo(() => {
    return members.filter(m => !session?.activePlayers.includes(m.id));
  }, [members, session?.activePlayers]);

  const handleAddMembers = useCallback(async () => {
    if (selectedMemberIds.length === 0 || !session) return;
    try {
      isProcessing.current = true;
      const now = new Date().toISOString();
      
      // Add system=1 logs for new members
      for (const memberId of selectedMemberIds) {
        await createLog({
          sessionId,
          clubId,
          memberId,
          system: 1,
          timestamp: now,
        });
      }

      // Update session activePlayers and totalAmounts
      const updatedActivePlayers = [...session.activePlayers, ...selectedMemberIds];
      const updatedTotals = { ...session.totalAmounts };
      for (const memberId of selectedMemberIds) {
        updatedTotals[memberId] = 0;
      }

      await db.executeSql(
        'UPDATE Session SET activePlayers = ?, totalAmounts = ?, updatedAt = ? WHERE id = ?',
        [JSON.stringify(updatedActivePlayers), JSON.stringify(updatedTotals), now, sessionId]
      );

      setSelectedMemberIds([]);
      setShowAddMembersModal(false);
      await loadData();
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to add members');
    } finally {
      isProcessing.current = false;
    }
  }, [selectedMemberIds, session, sessionId, clubId, loadData]);

  const handleCreateMemberInline = useCallback(async () => {
    if (!newMemberName.trim()) {
      Alert.alert('Error', 'Member name is required');
      return;
    }
    try {
      const newMember = await createMember({
        clubId,
        name: newMemberName.trim(),
        isGuest: false,
      });
      setMembers(prev => [...prev, newMember]);
      setSelectedMemberIds(prev => [...prev, newMember.id]);
      setNewMemberName('');
      setShowCreateMemberInline(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to create member');
    }
  }, [newMemberName, clubId]);

  const toggleMemberSelection = (memberId: string) => {
    setSelectedMemberIds(prev =>
      prev.includes(memberId) ? prev.filter(id => id !== memberId) : [...prev, memberId]
    );
  };

  /**
   * Handle commit (+ or -)
   */
  const handleCommit = useCallback(
    async (memberId: string, penaltyId: string, direction: 1 | -1) => {
      if (isProcessing.current || session?.locked) return;

      // Prevent negative commits: block decrement if count is already 0
      if (direction === -1) {
        const currentCount = commitCounts[memberId]?.[penaltyId] || 0;
        if (currentCount <= 0) {
          return; // Do nothing - commits cannot go below 0
        }
      }

      isProcessing.current = true;

      try {
        const penalty = penalties.find(p => p.id === penaltyId);
        if (!penalty) throw new Error('Penalty not found');

        const activeIds = session?.activePlayers || [];
        const activeSet = new Set(activeIds);
        const activeMembersList = members.filter(m => activeSet.has(m.id));

        // Update in-memory state immediately
        const newCounts = { ...commitCounts };
        if (!newCounts[memberId]) newCounts[memberId] = {};
        newCounts[memberId][penaltyId] = (newCounts[memberId][penaltyId] || 0) + direction;
        setCommitCounts(newCounts);

        // Calculate amount change
        const amountSelf = penalty.amount * currentMultiplier;
        const amountOther = penalty.amountOther * currentMultiplier;
        const newTotals = { ...memberTotals };

        if (penalty.affect === 'SELF') {
          newTotals[memberId] = (newTotals[memberId] || 0) + direction * amountSelf;
        } else if (penalty.affect === 'OTHER') {
          for (const member of activeMembersList) {
            if (member.id !== memberId) {
              newTotals[member.id] = (newTotals[member.id] || 0) + direction * amountOther;
            }
          }
        } else if (penalty.affect === 'BOTH') {
          newTotals[memberId] = (newTotals[memberId] || 0) + direction * amountSelf;
          for (const member of activeMembersList) {
            if (member.id !== memberId) {
              newTotals[member.id] = (newTotals[member.id] || 0) + direction * amountOther;
            }
          }
        }
        // NONE: no change

        setMemberTotals(newTotals);

        // Commit via service (writes log with correct amountTotal)
        if (direction > 0) {
          await addCommit(sessionId, memberId, penaltyId);
        } else {
          await negativeCommit(sessionId, memberId, penaltyId);
        }

        // Reload logs immediately to update multiplier breakdowns in UI
        const freshLogs = await getLogsBySession(sessionId);
        setLogs(freshLogs);
      } catch (err: any) {
        Alert.alert('Error', err.message || 'Failed to create commit');
        // Reload data to recover state
        loadData();
      } finally {
        isProcessing.current = false;
      }
    },
    [commitCounts, memberTotals, currentMultiplier, penalties, members, session?.activePlayers, sessionId, clubId, loadData]
  );

  /**
   * Handle multiplier change
   */
  const handleMultiplierChange = useCallback(async () => {
    if (sliderMultiplier === currentMultiplier || session?.locked) {
      setShowMultiplierModal(false);
      return;
    }

    try {
      isProcessing.current = true;
      const oldMultiplier = currentMultiplier;
      setCurrentMultiplier(sliderMultiplier);

      // Update session multiplier in DB (this writes system=5 log)
      const maxMult = maxMultParam || 10;
      await updateMultiplier(sessionId, sliderMultiplier, maxMult);

      setShowMultiplierModal(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update multiplier');
      setSliderMultiplier(currentMultiplier); // Revert
    } finally {
      isProcessing.current = false;
    }
  }, [sliderMultiplier, currentMultiplier, sessionId, clubId]);

  /**
   * Handle End Session
   */
  const handleEndSession = useCallback(() => {
    if (session?.locked) {
      Alert.alert('Session Locked', 'This session has already been finalized.');
      return;
    }
    setShowEndModals(true);
  }, [session]);

  const handleSessionFinalized = useCallback(() => {
    // Navigate to SessionDetailsScreen
    navigation.replace('SessionDetails', { sessionId, clubId, clubName });
  }, [navigation, sessionId, clubId, clubName]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  if (!session || penalties.length === 0 || members.length === 0) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Unable to load session data</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadData}>
            <Text style={styles.buttonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const activeMemberIds = session.activePlayers || [];
  const activeMembers = members.filter(m => activeMemberIds.includes(m.id));

  // IMPROVED: Calculate dynamic column widths for better responsiveness
  const screenWidth = Dimensions.get('window').width;
  const containerPadding = 16;
  const availableWidth = screenWidth - containerPadding * 2;
  
  // UPDATED: More generous member name width for readability
  const memberNameWidth = Math.max(90, availableWidth * 0.18); // 18% of width, min 90
  const totalColumnWidth = Math.max(70, availableWidth * 0.13); // compact total column
  const penaltyContentWidth = availableWidth - memberNameWidth - totalColumnWidth;
  
  // IMPROVED: Better penalty column width distribution
  // For few penalties (1-4): use wider columns for better button clickability
  // For many penalties (5+): enable horizontal scrolling with narrower minimum
  const numPenalties = penalties.length;
  let minPenaltyColumnWidth: number;
  
  if (numPenalties <= 4) {
    minPenaltyColumnWidth = 140; // Wide enough to contain buttons with spacing
  } else if (numPenalties <= 8) {
    minPenaltyColumnWidth = 130; // Balanced for medium penalty count
  } else {
    minPenaltyColumnWidth = 120; // Minimum to contain buttons without overlap
  }
  
  const calculatedPenaltyWidth = Math.max(
    minPenaltyColumnWidth,
    penaltyContentWidth / Math.max(1, numPenalties)
  );
  // Cap at 30% for very wide screens with few penalties
  const penaltyColumnWidth = Math.min(calculatedPenaltyWidth, availableWidth * 0.30);

  return (
    <SafeAreaView style={styles.container}>
      {/* UPDATED: Enhanced Top Bar with Back Button + Title + Timer + Multiplier */}
      <View style={styles.topBar}>
        {/* ADDED: Back Button - navigates to SessionListScreen */}
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.navigate('SessionList')}
        >
          <Text style={styles.backButtonText}>←</Text>
        </TouchableOpacity>

        {/* Title - reduced flex to accommodate back button */}
        <View style={styles.topBarLeft}>
          <Text style={styles.sessionTitle} numberOfLines={1}>
            {clubName} Session {formattedDate}
          </Text>
        </View>

        {/* Timer - centered */}
        <View style={styles.topBarCenter}>
          <Text style={styles.timerText}>{elapsedTime}</Text>
        </View>

        {/* UPDATED: Multiplier Button - fixed width to prevent overlap with system info */}
        <TouchableOpacity
          style={styles.multiplierButton}
          onPress={() => setShowMultiplierModal(true)}
        >
          <Text style={styles.multiplierButtonText}>{currentMultiplier}×</Text>
        </TouchableOpacity>
      </View>

      {/* Grid Table - Takes Maximum Space */}
      {/* UPDATED (Crash/Resume): capture vertical scroll position for resume */}
      <ScrollView
        style={styles.gridContainer}
        showsVerticalScrollIndicator={false}
        scrollEnabled={true}
        ref={ref => { verticalScrollRef.current = ref; }}
        onScroll={({ nativeEvent }) => setSavedScrollY(nativeEvent.contentOffset.y)}
        scrollEventThrottle={16}
      >
        {/* UPDATED (Crash/Resume): capture horizontal scroll position for resume */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          scrollEnabled={penalties.length > 0}
          ref={ref => { horizontalScrollRef.current = ref; }}
          onScroll={({ nativeEvent }) => setSavedScrollX(nativeEvent.contentOffset.x)}
          scrollEventThrottle={16}
        >
          <View style={[styles.table, { minWidth: memberNameWidth + totalColumnWidth + (penaltyColumnWidth * numPenalties) }]}>
            {/* Header Row (Penalty Names) */}
            <View style={styles.headerRow}>
              <View style={[styles.memberNameCell, { minWidth: memberNameWidth }]}>
                <Text style={styles.headerText}>Member</Text>
              </View>
              <View style={styles.penaltyHeadersRow}>
                {penalties.map(penalty => (
                  <View
                    key={penalty.id}
                    style={[styles.penaltyHeaderCell, { width: penaltyColumnWidth, minWidth: penaltyColumnWidth }]}
                  >
                    <View style={styles.penaltyNameContainer}>
                      <Text style={styles.penaltyHeaderText} numberOfLines={2}>
                        {penalty.name}
                      </Text>
                    </View>
                    <View style={styles.penaltyAmountContainer}>
                      {formatPenaltyAmount(penalty) !== '' ? (
                        <Text style={styles.penaltyAmountText} numberOfLines={1}>
                          {formatPenaltyAmount(penalty)}
                        </Text>
                      ) : (
                        <Text style={styles.penaltyAmountPlaceholder}> </Text>
                      )}
                    </View>
                  </View>
                ))}
              </View>
              <View style={[styles.totalHeaderCell, { minWidth: totalColumnWidth }]}>
                <Text style={styles.headerText}>Total</Text>
              </View>
            </View>

            {/* Member Rows */}
            {activeMembers.map(member => (
              <View key={member.id} style={styles.dataRow}>
                <View style={[styles.memberNameCell, { minWidth: memberNameWidth }]}>
                  {/* session-live: added avatar to member row */}
                  <Image
                    source={
                      member.photoUri
                        ? { uri: member.photoUri }
                        : require('../../../assets/images/dummy/default_member.png')
                    }
                    style={styles.avatar}
                  />
                  <Text style={styles.memberNameText}>{member.name}</Text>
                </View>
                <View style={styles.penaltyCellsRow}>
                  {penalties.map(penalty => {
                    const displayText = formatCommitDisplay(member.id, penalty.id);
                    return (
                      <View
                        key={penalty.id}
                        style={[styles.commitCell, { width: penaltyColumnWidth, minWidth: penaltyColumnWidth }]}
                      >
                        <TouchableOpacity
                          style={[styles.commitButton, { marginLeft: 2, marginRight: 2 }]}
                          onPress={() => handleCommit(member.id, penalty.id, -1)}
                          disabled={isProcessing.current}
                        >
                          <Text style={styles.buttonSymbol}>−</Text>
                        </TouchableOpacity>
                        <Text style={styles.commitCount}>{displayText}</Text>
                        <TouchableOpacity
                          style={[styles.commitButton, { marginLeft: 2, marginRight: 2 }]}
                          onPress={() => handleCommit(member.id, penalty.id, 1)}
                          disabled={isProcessing.current}
                        >
                          <Text style={styles.buttonSymbol}>+</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  })}
                </View>
                <View style={[styles.totalCell, { minWidth: totalColumnWidth }]}>
                  <Text style={styles.totalText}>{(memberTotals[member.id] || 0).toFixed(2)}</Text>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Actions only (no footer background or summary) */}
      <View style={styles.actionsBar}>
        <TouchableOpacity
          style={styles.addMembersButton}
          onPress={() => setShowAddMembersModal(true)}
          disabled={isProcessing.current}
        >
          <Text style={styles.addMembersButtonText}>+ Members</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.endSessionButton,
            session?.locked && styles.endSessionButtonDisabled
          ]}
          onPress={handleEndSession}
          disabled={isProcessing.current || session?.locked}
        >
          <Text style={styles.endSessionButtonText}>
            {session?.locked ? 'Locked' : 'End Session'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add Members Modal */}
      <Modal visible={showAddMembersModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: '80%' }]}>
            <Text style={styles.modalTitle}>Add Members to Session</Text>
            
            <ScrollView style={{ maxHeight: 300 }}>
              {availableMembers.length === 0 && !showCreateMemberInline && (
                <Text style={styles.modalSubtitle}>No available members. Create a new one below.</Text>
              )}
              {availableMembers.map(member => (
                <TouchableOpacity
                  key={member.id}
                  style={styles.memberCheckboxRow}
                  onPress={() => toggleMemberSelection(member.id)}
                >
                  <View style={styles.checkbox}>
                    {selectedMemberIds.includes(member.id) && (
                      <Text style={styles.checkmark}>✓</Text>
                    )}
                  </View>
                  <Text style={styles.memberCheckboxText}>{member.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {!showCreateMemberInline && (
              <TouchableOpacity
                style={styles.addNewMemberButton}
                onPress={() => setShowCreateMemberInline(true)}
              >
                <Text style={styles.addNewMemberButtonText}>+ Create New Member</Text>
              </TouchableOpacity>
            )}

            {showCreateMemberInline && (
              <View style={styles.inlineCreateForm}>
                <TextInput
                  style={styles.memberNameInput}
                  placeholder="Member name"
                  value={newMemberName}
                  onChangeText={setNewMemberName}
                  autoFocus
                />
                <View style={styles.inlineCreateButtons}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.cancelButton]}
                    onPress={() => {
                      setShowCreateMemberInline(false);
                      setNewMemberName('');
                    }}
                  >
                    <Text style={styles.cancelButtonText}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.confirmButton]}
                    onPress={handleCreateMemberInline}
                  >
                    <Text style={styles.confirmButtonText}>Create</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowAddMembersModal(false);
                  setSelectedMemberIds([]);
                  setShowCreateMemberInline(false);
                  setNewMemberName('');
                }}
              >
                <Text style={styles.cancelButtonText}>Close</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleAddMembers}
                disabled={selectedMemberIds.length === 0}
              >
                <Text style={styles.confirmButtonText}>
                  Add {selectedMemberIds.length > 0 ? `(${selectedMemberIds.length})` : ''}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Multiplier Modal */}
      <Modal visible={showMultiplierModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Multiplier</Text>
            <View style={styles.sliderContainer}>
              <Text style={styles.sliderValue}>{sliderMultiplier}×</Text>
              <Slider
                style={styles.slider}
                minimumValue={1}
                maximumValue={maxMultParam}
                step={1}
                value={sliderMultiplier}
                onValueChange={setSliderMultiplier}
              />
              <View style={styles.sliderLabels}>
                <Text style={styles.sliderLabel}>1</Text>
                <Text style={styles.sliderLabel}>{maxMultParam}</Text>
              </View>
            </View>
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setSliderMultiplier(currentMultiplier);
                  setShowMultiplierModal(false);
                }}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.confirmButton]}
                onPress={handleMultiplierChange}
              >
                <Text style={styles.confirmButtonText}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* End Session Modals */}
      <SessionEndModals
        sessionId={sessionId}
        clubId={clubId}
        members={activeMembers}
        penalties={penalties}
        visible={showEndModals}
        onClose={() => setShowEndModals(false)}
        onFinalized={handleSessionFinalized}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  // UPDATED: Top bar expanded with back button and increased height to prevent system overlay
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 4,
    backgroundColor: '#f9f9f9',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    minHeight: 50,
  },
  topBarLeft: {
    flex: 1,
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  topBarCenter: {
    flex: 0.8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000',
  },
  timerText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#007AFF',
  },
  // UPDATED: Multiplier button with increased padding and fixed width
  multiplierButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 50,
  },
  topBarMinimal: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  multiplierButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  // ADDED: Back button styling for navigation to SessionListScreen
  backButton: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginRight: 8,
    minWidth: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backButtonText: {
    fontSize: 24,
    fontWeight: '600',
    color: '#007AFF',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 4,
    paddingVertical: 0,
  },
  table: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    overflow: 'hidden',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: '#f0f0f0',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    minHeight: 64,
    alignItems: 'stretch',
  },
  memberNameCell: {
    width: 100,
    paddingHorizontal: 10,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderRightWidth: 1,
    borderRightColor: '#ddd',
    minHeight: 72,
  },
  penaltyHeadersRow: {
    flexDirection: 'row',
    flex: 1,
  },
  penaltyHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'stretch',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    flexDirection: 'column',
    gap: 2,
  },
  penaltyNameContainer: {
    minHeight: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  penaltyHeaderText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 13,
  },
  penaltyAmountContainer: {
    minHeight: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  penaltyAmountText: {
    fontSize: 9,
    color: '#006200',
    textAlign: 'center',
    fontWeight: '500',
    lineHeight: 12,
  },
  penaltyAmountPlaceholder: {
    fontSize: 10,
    color: 'transparent',
    textAlign: 'center',
    fontWeight: '500',
  },
  totalHeaderCell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
    backgroundColor: '#f5f5f5',
    minHeight: 72,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
    minHeight: 72,
    alignItems: 'stretch',
  },
  memberNameText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#000',
    flex: 1,
  },
  penaltyCellsRow: {
    flexDirection: 'row',
    flex: 1,
  },
  commitCell: {
    paddingHorizontal: 6,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    borderRightWidth: 1,
    borderRightColor: '#eee',
    gap: 4,
    minHeight: 72,
    overflow: 'hidden',
  },
  commitButton: {
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 4,
    backgroundColor: '#007AFF',
    minWidth: 36,
    minHeight: 36,
    justifyContent: 'center',
    alignItems: 'center',
    flexShrink: 0,
  },
  buttonSymbol: {
    fontSize: 18,
    fontWeight: '700',
    color: '#fff',
  },
  commitCount: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000',
    minWidth: 20,
    maxWidth: 24,
    textAlign: 'center',
    flex: 0,
    flexShrink: 0,
  },
  totalCell: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    justifyContent: 'center',
    alignItems: 'center',
    borderLeftWidth: 1,
    borderLeftColor: '#ddd',
    backgroundColor: '#f9f9f9',
    minHeight: 72,
  },
  totalText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#000000',
  },

  summaryLabel: {
    fontSize: 11,
    color: '#000000',
  },
  summaryValue: {
    fontSize: 12,
    fontWeight: '600',
    color: '#000000',
  },
  endSessionButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  endSessionButtonDisabled: {
    backgroundColor: '#999',
    opacity: 0.6,
  },
  endSessionButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#000000',
    marginBottom: 16,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: '#007AFF',
    borderRadius: 6,
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  modalContent: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#000',
    marginBottom: 20,
  },
  sliderContainer: {
    marginBottom: 24,
  },
  sliderValue: {
    fontSize: 24,
    fontWeight: '700',
    color: '#007AFF',
    textAlign: 'center',
    marginBottom: 12,
  },
  slider: {
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  sliderLabel: {
    fontSize: 12,
    color: '#666',
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#e0e0e0',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  confirmButton: {
    backgroundColor: '#007AFF',
  },
  confirmButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    backgroundColor: '#f9f9f9',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  footerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  summaryMinimal: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  actionsBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
    maxHeight: 48,
  },
  addMembersButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 6,
    minWidth: 100,
  },
  addMembersButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#fff',
  },
  modalSubtitle: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  memberCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderRadius: 4,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    fontSize: 16,
    fontWeight: '700',
    color: '#007AFF',
  },
  memberCheckboxText: {
    fontSize: 14,
    color: '#000',
  },
  addNewMemberButton: {
    marginTop: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 6,
    alignItems: 'center',
  },
  addNewMemberButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#007AFF',
  },
  inlineCreateForm: {
    marginTop: 12,
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 6,
  },
  memberNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  inlineCreateButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    marginRight: 8,
  },
});

export default SessionLiveScreenNew;
