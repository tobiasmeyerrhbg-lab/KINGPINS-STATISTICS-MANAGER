// NEW: SessionListScreen
// Lists sessions for a club and navigates to details or resume

import React, { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, SafeAreaView, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import { getSessionsByClub, Session } from '../../services/sessionService';

interface RouteParams {
  clubId: string;
  clubName?: string;
  maxMultiplier?: number;
}

export default function SessionListScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { clubId, clubName, maxMultiplier } = route.params as RouteParams;

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number | 'all'>(currentYear);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [clubId])
  );

  const load = async () => {
    try {
      setLoading(true);
      const data = await getSessionsByClub(clubId);
      setSessions(data);
    } catch (err) {
      console.error('Error loading sessions', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredSessions = useMemo(() => {
    if (selectedYear === 'all') return sessions;
    return sessions.filter(s => new Date(s.startTime).getFullYear() === selectedYear);
  }, [sessions, selectedYear]);

  const totalAmount = (s: Session) => {
    const totals = s.totalAmounts || {};
    return Object.values(totals).reduce((sum, v) => sum + (v || 0), 0);
  };

  const durationLabel = (s: Session) => {
    const start = new Date(s.startTime).getTime();
    const end = s.endTime ? new Date(s.endTime).getTime() : Date.now();
    const diff = Math.max(0, Math.floor((end - start) / 1000));
    const mins = Math.floor(diff / 60);
    const hours = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hours}h ${remMins}m`;
  };

  const renderItem = ({ item }: { item: Session }) => {
    // Format session name: "Session YYYY-MM-DD HH:MM"
    const startTime = new Date(item.startTime);
    const hours = String(startTime.getHours()).padStart(2, '0');
    const minutes = String(startTime.getMinutes()).padStart(2, '0');
    const sessionName = `Session ${item.date} ${hours}:${minutes}`;
    
    return (
      <TouchableOpacity
        style={{ backgroundColor: '#fff', padding: 14, marginHorizontal: 12, marginVertical: 6, borderRadius: 10, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}
        onPress={() => (navigation as any).navigate('SessionDetails', { sessionId: item.id, clubId })}
      >
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={{ fontSize: 16, fontWeight: '600' }}>{sessionName}</Text>
          <Text style={{ color: item.status === 'active' ? '#e67e22' : '#2ecc71', fontWeight: '600' }}>{item.status}</Text>
        </View>
        <Text style={{ color: '#555', marginTop: 4 }}>Duration: {durationLabel(item)}</Text>
        <Text style={{ color: '#555', marginTop: 2 }}>Total: {totalAmount(item).toFixed(2)}</Text>
        <Text style={{ color: '#555', marginTop: 2 }}>Players: {item.playerCount}</Text>
        {item.status === 'active' && (
          <TouchableOpacity
            style={{ marginTop: 10, alignSelf: 'flex-start', backgroundColor: '#007AFF', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }}
            onPress={() => (navigation as any).navigate('SessionLive', { sessionId: item.id, clubId, maxMultiplier })}
          >
            <Text style={{ color: '#fff', fontWeight: '600' }}>Resume</Text>
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#007AFF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#F5F5F5' }}>
      <View style={{ padding: 12, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#e0e0e0' }}>
        {/* Year filter */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#0f172a' }}>Filter</Text>
          <View style={{ flexDirection: 'row' }}>
            <TouchableOpacity
              onPress={() => setSelectedYear(currentYear)}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, marginRight: 8, backgroundColor: selectedYear === currentYear ? '#e0f2fe' : '#fff' }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '600' }}>{currentYear}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setSelectedYear('all')}
              style={{ paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: '#e2e8f0', borderRadius: 8, backgroundColor: selectedYear === 'all' ? '#e0f2fe' : '#fff' }}
            >
              <Text style={{ color: '#0f172a', fontWeight: '600' }}>All</Text>
            </TouchableOpacity>
          </View>
        </View>
        <TouchableOpacity
          style={{ backgroundColor: '#007AFF', paddingVertical: 10, borderRadius: 8 }}
          onPress={() => (navigation as any).navigate('SessionCreate', { clubId, clubName, maxMultiplier })}
        >
          <Text style={{ color: '#fff', textAlign: 'center', fontWeight: '600' }}>Start New Session</Text>
        </TouchableOpacity>
      </View>
      <FlatList
        data={filteredSessions}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingVertical: 8 }}
        ListEmptyComponent={() => (
          <View style={{ padding: 24, alignItems: 'center' }}>
            <Text style={{ fontSize: 16, color: '#666' }}>No sessions yet</Text>
          </View>
        )}
      />
    </SafeAreaView>
  );
}
