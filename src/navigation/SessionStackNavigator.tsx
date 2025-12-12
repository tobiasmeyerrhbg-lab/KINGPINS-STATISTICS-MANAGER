import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import SessionLiveScreenNew from '../screens/sessions/SessionLiveScreenNew';
import SessionEndSummaryScreenNew from '../screens/sessions/SessionEndSummaryScreenNew';
import SessionDetailsScreen from '../screens/sessions/SessionDetailsScreen';
import SessionListScreen from '../screens/sessions/SessionListScreen';
import SessionCreateScreen from '../screens/sessions/SessionCreateScreen';
import EventLogsScreen from '../screens/sessions/EventLogsScreen';
import SessionTableScreen from '../screens/sessions/SessionTableScreen';
import SessionAnalysisScreen from '../screens/sessions/SessionAnalysisScreen';
import GraphFullscreenScreen from '../screens/statistics/GraphFullscreenScreen';
import { SessionVerificationScreen } from '../screens/sessions/SessionVerificationScreen';

// NEW: Wrapper props to seed club context
export interface SessionStackProps {
  clubId: string;
  clubName?: string;
  maxMultiplier?: number;
  initialScreen?: keyof SessionStackParamList;
  initialScreenParams?: Partial<SessionStackParamList[keyof SessionStackParamList]>;
}

export type SessionStackParamList = {
  SessionList: { clubId: string; clubName?: string; maxMultiplier?: number };
  SessionCreate: { clubId: string; clubName?: string; maxMultiplier?: number };
  SessionLive: { sessionId: string; clubId: string; clubName?: string; maxMultiplier?: number };
  SessionEndSummary: { sessionId: string; clubId: string; clubName?: string };
  SessionDetails: { sessionId: string; clubId?: string; clubName?: string };
  EventLogs: { sessionId: string; clubId: string };
  SessionTable: { sessionId: string; clubId: string };
  SessionAnalysis: { sessionId: string; clubId: string };
  GraphFullscreen: { config: any; result: any; members: any[] };
  SessionVerification: { sessionId: string; clubId: string };
};

const Stack = createNativeStackNavigator<SessionStackParamList>();

export function SessionStackNavigator({ clubId, clubName, maxMultiplier, initialScreen, initialScreenParams }: SessionStackProps) {
  const initialRoute = initialScreen ?? 'SessionList';
  return (
    <Stack.Navigator initialRouteName={initialRoute as any}>
      <Stack.Screen
        name="SessionList"
        component={SessionListScreen}
        options={{ title: 'Sessions' }}
        initialParams={{ clubId, clubName, maxMultiplier }}
      />
      <Stack.Screen
        name="SessionCreate"
        component={SessionCreateScreen}
        options={{ title: 'Start Session' }}
        initialParams={{ clubId, clubName, maxMultiplier, ...(initialScreen === 'SessionCreate' ? initialScreenParams : {}) }}
      />
      <Stack.Screen
        name="SessionLive"
        component={SessionLiveScreenNew}
        options={{ headerShown: false }}
      />
      <Stack.Screen name="SessionEndSummary" component={SessionEndSummaryScreenNew} options={{ title: 'End Session' }} />
      <Stack.Screen name="SessionDetails" component={SessionDetailsScreen} options={{ title: 'Session Details' }} />
      <Stack.Screen name="EventLogs" component={EventLogsScreen} options={{ title: 'Event Logs' }} />
      <Stack.Screen name="SessionTable" component={SessionTableScreen} options={{ title: 'Session Table' }} />
      <Stack.Screen name="SessionAnalysis" component={SessionAnalysisScreen} options={{ title: 'Session Analysis' }} />
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
      <Stack.Screen name="SessionVerification" component={SessionVerificationScreen} options={{ title: 'Verification' }} />
    </Stack.Navigator>
  );
}

export default SessionStackNavigator;
