/**
 * ClubStack Navigator
 * 
 * Navigation stack for Club Management screens:
 * - Clubs: Main clubs tab screen (shows all clubs)
 * - ClubList: List all clubs (legacy - redirects to Clubs)
 * - ClubCreate: Create new club
 * - ClubEdit: Edit existing club
 */

import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import ClubsScreen from '../screens/clubs/ClubsScreen';
import ClubListScreen from '../screens/clubs/ClubListScreen';
import ClubCreateScreen from '../screens/clubs/ClubCreateScreen';
import ClubEditScreen from '../screens/clubs/ClubEditScreen';
import MemberListScreen from '../screens/members/MemberListScreen';
import MemberCreateScreen from '../screens/members/MemberCreateScreen';
import MemberEditScreen from '../screens/members/MemberEditScreen';
import FinancialsScreen from '../screens/financials/FinancialsScreen';
import MemberLedgerScreen from '../screens/financials/MemberLedgerScreen';
import PenaltiesScreen from '../screens/penalties/PenaltiesScreen';
import PenaltyCreateScreen from '../screens/penalties/PenaltyCreateScreen';
import PenaltyEditScreen from '../screens/penalties/PenaltyEditScreen';
import ClubDetailScreen from '../screens/clubs/ClubDetailScreen';
import SessionStackNavigator from './SessionStackNavigator';
import StatisticsScreen from '../screens/statistics/StatisticsScreen';
import GraphFullscreenScreen from '../screens/statistics/GraphFullscreenScreen';

export type ClubStackParamList = {
  Clubs: undefined;
  ClubDetail: { clubId: string; clubName: string };
  ClubCreate: undefined;
  ClubEdit: { clubId: string };
  MemberList: { clubId: string; clubName?: string };
  MemberCreate: { clubId: string };
  MemberEdit: { memberId: string; clubId?: string };
  Financials: { clubId: string; clubName?: string };
  MemberLedger: { memberId: string; clubId: string };
  Penalties: { clubId: string; clubName?: string };
  PenaltyCreate: { clubId: string };
  PenaltyEdit: { penaltyId: string; clubId?: string };
  ClubList?: undefined; // legacy
  Sessions: { clubId: string; clubName?: string; maxMultiplier?: number };
  Statistics: { clubId: string; clubName?: string };
  GraphFullscreen: { config: any; result: any; members: any[] };
};

const Stack = createNativeStackNavigator<ClubStackParamList>();

export default function ClubStackNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Clubs"
        screenOptions={{
          headerStyle: {
            backgroundColor: '#007AFF',
          },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: {
            fontWeight: '600',
          },
        }}
      >
        <Stack.Screen
          name="Clubs"
          component={ClubsScreen}
          options={{ title: 'Clubs' }}
        />
        <Stack.Screen
          name="ClubDetail"
          component={ClubDetailScreen}
          options={({ route }) => ({
            title: route.params.clubName || 'Club',
          })}
        />
        <Stack.Screen
          name="ClubCreate"
          component={ClubCreateScreen}
          options={{ title: 'Create Club' }}
        />
        <Stack.Screen
          name="ClubEdit"
          component={ClubEditScreen}
          options={{ title: 'Options' }}
        />
        <Stack.Screen
          name="MemberList"
          component={MemberListScreen}
          options={({ route }) => ({ title: route.params.clubName || 'Members' })}
        />
        <Stack.Screen
          name="MemberCreate"
          component={MemberCreateScreen}
          options={{ title: 'Create Member' }}
        />
        <Stack.Screen
          name="MemberEdit"
          component={MemberEditScreen}
          options={{ title: 'Edit Member' }}
        />
        <Stack.Screen
          name="Financials"
          component={FinancialsScreen}
          options={({ route }) => ({ title: route.params.clubName || 'Financials' })}
        />
        <Stack.Screen
          name="MemberLedger"
          component={MemberLedgerScreen}
          options={{ title: 'Member Ledger' }}
        />
        <Stack.Screen
          name="Penalties"
          component={PenaltiesScreen}
          options={({ route }) => ({ title: route.params.clubName || 'Penalties' })}
        />
        <Stack.Screen
          name="PenaltyCreate"
          component={PenaltyCreateScreen}
          options={{ title: 'Create Penalty' }}
        />
        <Stack.Screen
          name="PenaltyEdit"
          component={PenaltyEditScreen}
          options={{ title: 'Edit Penalty' }}
        />
        <Stack.Screen
          name="Statistics"
          component={StatisticsScreen}
          options={({ route }) => ({ title: route.params?.clubName || 'Statistics' })}
        />
        <Stack.Screen
          name="GraphFullscreen"
          component={GraphFullscreenScreen}
          options={({ route }) => {
            const params: any = route.params || {};
            const mode = params.config?.mode;
            const title = mode === 'full-replay'
              ? 'Session Graph – Full Timeline'
              : `${params.penaltyName || 'Penalty'} – Player Comparison`;
            return { headerShown: true, title };
          }}
        />
        {/* NEW: Sessions nested stack */}
        <Stack.Screen
          name="Sessions"
          options={{ headerShown: false }}
        >
          {({ route }) => (
            <SessionStackNavigator
              clubId={(route.params as any)?.clubId}
              clubName={(route.params as any)?.clubName}
              maxMultiplier={(route.params as any)?.maxMultiplier}
              initialScreen={(route.params as any)?.initialScreen}
              initialScreenParams={(route.params as any)?.initialScreenParams}
            />
          )}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
}
