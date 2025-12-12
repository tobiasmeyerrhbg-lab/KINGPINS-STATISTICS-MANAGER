import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
// Using bottom tabs for consistency with existing MainTabNavigator
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useRoute } from '@react-navigation/native';
import SessionAnalysisTabImpl from './SessionAnalysisTab';

const Tab = createBottomTabNavigator();

function Placeholder({ title }: { title: string }) {
  return (
    <View style={styles.placeholderContainer}>
      <Text style={styles.placeholderTitle}>{title}</Text>
      <Text style={styles.placeholderText}>Coming Soon</Text>
    </View>
  );
}

function AllTimeTab() {
  return <Placeholder title="All-Time Statistics" />;
}

function CrossSessionTab() {
  return <Placeholder title="Cross-Session Analysis" />;
}

function SessionAnalysisTabWrapper(props: any) {
  const clubId = props.route?.params?.clubId || '';
  return <SessionAnalysisTabImpl clubId={clubId} />;
}

function ExportsTab() {
  return <Placeholder title="Exports" />;
}

export default function StatisticsScreen() {
  const route = useRoute();
  const clubId = (route.params as any)?.clubId || '';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Statistics</Text>
      <View style={styles.tabsWrapper}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            tabBarActiveTintColor: '#3b82f6',
            tabBarInactiveTintColor: '#64748b',
            tabBarStyle: { backgroundColor: '#ffffff' },
            headerShown: false,
            tabBarIcon: ({ color }) => {
              const icon = route.name === 'All-Time' ? '🕒'
                : route.name === 'Cross-Session' ? '🔄'
                : route.name === 'Session Analysis' ? '🧠'
                : route.name === 'Exports' ? '📤'
                : '•';
              return <Text style={{ color, fontSize: 18 }}>{icon}</Text>;
            },
          })}
        >
          <Tab.Screen name="All-Time" component={AllTimeTab} />
          <Tab.Screen name="Cross-Session" component={CrossSessionTab} />
          <Tab.Screen
            name="Session Analysis"
            component={SessionAnalysisTabWrapper}
            initialParams={{ clubId }}
          />
          <Tab.Screen name="Exports" component={ExportsTab} />
        </Tab.Navigator>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f4f8',
  },
  header: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  tabsWrapper: {
    flex: 1,
    marginHorizontal: 8,
  },
  placeholderContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
  },
  placeholderText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
  },
});
