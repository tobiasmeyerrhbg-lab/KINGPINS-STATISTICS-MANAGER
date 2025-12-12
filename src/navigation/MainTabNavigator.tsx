/**
 * MainTabNavigator
 * 
 * Main application tab bar navigator.
 * Contains all primary navigation screens.
 * 
 * Tabs:
 * 1. Clubs → ClubsScreen → ClubStackNavigator
 * 2. Members → MembersScreen → MemberStackNavigator  
 * 3. Financials → FinancialsScreen
 * 4. Penalties → PenaltiesScreen → PenaltyStackNavigator
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { NavigationContainer } from '@react-navigation/native';
import { Text } from 'react-native';

// Tab Screens
import ClubsScreen from '../screens/clubs/ClubsScreen';
import MembersScreen from '../screens/members/MembersScreen';
import FinancialsScreen from '../screens/financials/FinancialsScreen';
import PenaltiesScreen from '../screens/penalties/PenaltiesScreen';

// Stack Navigators
import ClubStackNavigator from './ClubStackNavigator';
import MemberStackNavigator from './MemberStackNavigator';
import PenaltyStackNavigator from './PenaltyStackNavigator';

const Tab = createBottomTabNavigator();

export default function MainTabNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          headerShown: true,
          tabBarActiveTintColor: '#007AFF',
          tabBarInactiveTintColor: '#666666',
          tabBarStyle: {
            paddingBottom: 5,
            paddingTop: 5,
            height: 60,
          },
        }}
      >
        <Tab.Screen
          name="ClubsTab"
          component={ClubStackNavigator}
          options={{
            headerShown: false,
            title: 'Clubs',
            tabBarIcon: ({ color }) => (
              <TabIcon name="people" color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="MembersTab"
          component={MemberStackNavigator}
          options={{
            headerShown: false,
            title: 'Members',
            tabBarIcon: ({ color }) => (
              <TabIcon name="person" color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="FinancialsTab"
          component={FinancialsScreen}
          options={{
            title: 'Financials',
            tabBarIcon: ({ color}) => (
              <TabIcon name="wallet" color={color} />
            ),
          }}
        />

        <Tab.Screen
          name="PenaltiesTab"
          component={PenaltyStackNavigator}
          options={{
            headerShown: false,
            title: 'Penalties',
            tabBarIcon: ({ color }) => (
              <TabIcon name="warning" color={color} />
            ),
          }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

// Simple Tab Icon Component (using text for now, replace with icon library later)
function TabIcon({ name, color }: { name: string; color: string }) {
  const iconMap: Record<string, string> = {
    people: '👥',
    person: '👤',
    wallet: '💰',
    warning: '⚠️',
  };

  return (
    <Text style={{ fontSize: 24, color }}>
      {iconMap[name] || '•'}
    </Text>
  );
}
