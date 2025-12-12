/**
 * MemberStack Navigator
 * 
 * Navigation stack for Member Management screens:
 * - Members: Main members tab screen (shows all members across clubs)
 * - MemberList: List all members for a club
 * - MemberCreate: Create new member
 * - MemberEdit: Edit existing member
 * 
 * This stack should be integrated into the main navigator under "Admin" section
 * or inside "Club Details" screen when available.
 */

import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MembersScreen from '../screens/members/MembersScreen';
import MemberListScreen from '../screens/members/MemberListScreen';
import MemberCreateScreen from '../screens/members/MemberCreateScreen';
import MemberEditScreen from '../screens/members/MemberEditScreen';

export type MemberStackParamList = {
  Members: undefined;
  MemberList: { clubId: string };
  MemberCreate: { clubId: string };
  MemberEdit: { memberId: string };
};

const Stack = createNativeStackNavigator<MemberStackParamList>();

export default function MemberStackNavigator() {
  return (
    <Stack.Navigator
      initialRouteName="Members"
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
        name="Members"
        component={MembersScreen}
        options={{
          title: 'Members',
        }}
      />
      <Stack.Screen
        name="MemberList"
        component={MemberListScreen}
        options={{
          title: 'Members',
        }}
      />
      <Stack.Screen
        name="MemberCreate"
        component={MemberCreateScreen}
        options={{
          title: 'Create Member',
        }}
      />
      <Stack.Screen
        name="MemberEdit"
        component={MemberEditScreen}
        options={{
          title: 'Edit Member',
        }}
      />
    </Stack.Navigator>
  );
}
