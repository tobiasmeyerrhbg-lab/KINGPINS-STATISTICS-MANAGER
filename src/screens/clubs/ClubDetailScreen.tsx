import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useNavigation, useRoute, useFocusEffect } from '@react-navigation/native';
import { Club, getClub } from '../../services/clubService';
import { getMembersByClub } from '../../services/memberService';
import { getPenaltiesByClub } from '../../services/penaltyService';
// UPDATED: Removed getSessionsByClub import - sessions now managed in SessionListScreen

interface RouteParams {
  clubId: string;
  clubName?: string;
}

export default function ClubDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId, clubName } = route.params as RouteParams;

  const [club, setClub] = useState<Club | null>(null);
  const [memberCount, setMemberCount] = useState<number>(0);
  const [penaltyCount, setPenaltyCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  // UPDATED: Removed activeSessionId - Resume button now in SessionListScreen

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [clubId])
  );

  const loadData = async () => {
    try {
      setLoading(true);
      const [clubData, members, penalties] = await Promise.all([
        getClub(clubId),
        getMembersByClub(clubId),
        getPenaltiesByClub(clubId),
        // UPDATED: Removed getSessionsByClub - sessions managed in SessionListScreen
      ]);

      setClub(clubData || null);
      setMemberCount(members.length);
      setPenaltyCount(penalties.length);
    } catch (error) {
      console.error('Error loading club detail:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (screen: string, params: Record<string, any> = {}) => {
    if (screen === 'SessionCreate') {
      (navigation as any).navigate('Sessions', {
        clubId,
        clubName: displayName,
        maxMultiplier: club?.maxMultiplier,
        initialScreen: 'SessionCreate',
        initialScreenParams: params,
      });
      return;
    }
    if (screen === 'SessionList') {
      (navigation as any).navigate('Sessions', {
        clubId,
        clubName: displayName,
        maxMultiplier: club?.maxMultiplier,
        initialScreen: 'SessionList',
      });
      return;
    }
    if (screen === 'SessionLive') {
      (navigation as any).navigate('Sessions', {
        clubId,
        clubName: displayName,
        maxMultiplier: club?.maxMultiplier,
        initialScreen: 'SessionLive',
        initialScreenParams: params,
      });
      return;
    }

    (navigation as any).navigate(screen, params);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#007AFF" />
      </View>
    );
  }

  if (!club) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.emptyText}>Club not found</Text>
      </View>
    );
  }

  const displayName = club.name || clubName || 'Club';

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.heroCard}>
        <View style={styles.heroHeader}>
          {club.logoUri ? (
            <Image source={{ uri: club.logoUri }} style={styles.logo} resizeMode="contain" />
          ) : (
            <View style={styles.logoPlaceholder}>
              <Text style={styles.logoText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          <View style={styles.heroInfo}>
            <Text style={styles.clubName}>{displayName}</Text>
            <Text style={styles.metaText}>
              Created {new Date(club.createdAt).toLocaleDateString()}
            </Text>
            <Text style={styles.metaText}>Members: {memberCount}</Text>
            <Text style={styles.metaText}>Penalties: {penaltyCount}</Text>
          </View>
        </View>
      </View>

      <View style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Manage</Text>
        {/* Sessions first (primary) */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate('SessionList')}
        >
          <Text style={styles.actionTitle}>📅 Sessions</Text>
          <Text style={styles.actionSubtitle}>View and manage sessions for this club</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate('MemberList', { clubId, clubName: displayName })}
        >
          <Text style={styles.actionTitle}>👥 Members</Text>
          <Text style={styles.actionSubtitle}>View and add members for this club</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate('Financials', { clubId, clubName: displayName })}
        >
          <Text style={styles.actionTitle}>💰 Financials</Text>
          <Text style={styles.actionSubtitle}>See balances scoped to this club</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate('Penalties', { clubId, clubName: displayName })}
        >
          <Text style={styles.actionTitle}>⚠️ Penalties</Text>
          <Text style={styles.actionSubtitle}>Manage penalties for this club</Text>
        </TouchableOpacity>

        {/* NEW: Statistics button */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate('Statistics', { clubId, clubName: displayName })}
        >
          <Text style={styles.actionTitle}>📊 Statistics</Text>
          <Text style={styles.actionSubtitle}>Explore club-wide statistics and analysis</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.actionsCard}>
        <Text style={styles.sectionTitle}>Club Settings</Text>
        <TouchableOpacity
          style={styles.actionButton}
          onPress={() => handleNavigate('ClubEdit', { clubId })}
        >
          <Text style={styles.actionTitle}>⚙️ Options</Text>
          <Text style={styles.actionSubtitle}>Update club name or logo</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  content: {
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
  emptyText: {
    fontSize: 16,
    color: '#666666',
  },
  heroCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logo: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  logoPlaceholder: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#007AFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logoText: {
    color: '#FFFFFF',
    fontSize: 28,
    fontWeight: 'bold',
  },
  heroInfo: {
    flex: 1,
    marginLeft: 16,
  },
  clubName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 4,
  },
  metaText: {
    fontSize: 14,
    color: '#666666',
    marginTop: 2,
  },
  actionsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#000000',
    marginBottom: 12,
  },
  actionButton: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#EEEEEE',
  },
  actionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
  },
  actionSubtitle: {
    fontSize: 13,
    color: '#666666',
    marginTop: 4,
  },
  // UPDATED: Removed resumeButton/resumeText styles - Resume now in SessionListScreen
});