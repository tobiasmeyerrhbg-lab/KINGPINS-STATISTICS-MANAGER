/**
 * PenaltyStack Navigator
 * 
 * Navigation stack for Penalty Management screens:
 * - Penalties: Main penalties tab screen (shows all penalties across clubs)
 * - PenaltyList: List all penalties for a club
 * - PenaltyCreate: Create new penalty
 * - PenaltyEdit: Edit existing penalty
 * 
 * This stack should be integrated into the main navigator under "Admin" section
 * alongside Club and Member management.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PenaltiesScreen from '../screens/penalties/PenaltiesScreen';
import PenaltyListScreen from '../screens/penalties/PenaltyListScreen';
import PenaltyCreateScreen from '../screens/penalties/PenaltyCreateScreen';
import PenaltyEditScreen from '../screens/penalties/PenaltyEditScreen';

export type PenaltyStackParamList = {
  Penalties: undefined;
  PenaltyList: { clubId: string };
  PenaltyCreate: { clubId: string };
  PenaltyEdit: { penaltyId: string };
};

const Stack = createNativeStackNavigator<PenaltyStackParamList>();

export default function PenaltyStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Penalties"
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
        name="Penalties"
        component={PenaltiesScreen}
        options={{
          title: 'Penalties',
        }}
      />
      <Stack.Screen
        name="PenaltyList"
        component={PenaltyListScreen}
        options={{
          title: 'Penalties',
        }}
      />
      <Stack.Screen
        name="PenaltyCreate"
        component={PenaltyCreateScreen}
        options={{
          title: 'Create Penalty',
        }}
      />
      <Stack.Screen
        name="PenaltyEdit"
        component={PenaltyEditScreen}
        options={{
          title: 'Edit Penalty',
        }}
      />
    </Stack.Navigator>
  );
}
