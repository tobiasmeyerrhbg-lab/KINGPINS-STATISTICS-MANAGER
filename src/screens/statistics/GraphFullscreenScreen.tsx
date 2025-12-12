import React, { useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, StatusBar } from 'react-native';
import SessionGraphView from '../../components/graphs/SessionGraphView';
import { GraphConfig, GraphResult } from '../../services/sessionGraphEngine';
import { useFocusEffect, useRoute } from '@react-navigation/native';

type RouteParams = {
  config: GraphConfig;
  result: GraphResult;
  members: Array<{ id: string; image?: string; name: string }>;
  penaltyName?: string;
  timeFormat?: string;
  currency?: string;
  timezone?: string;
};

export default function GraphFullscreenScreen() {
  const route = useRoute();
  const { config, result, members, penaltyName, timeFormat, currency, timezone } = (route.params || {}) as RouteParams;
  const viewRef = useRef<View>(null);

  const onExport = useCallback(async (type: 'png' | 'jpg' | 'pdf') => {
    try {
      // @ts-ignore - runtime-only import
      const ViewShot = require('react-native-view-shot');
      // @ts-ignore - runtime-only import (Expo managed or bare)
      const FileSystem = require('expo-file-system');
      // @ts-ignore - runtime-only import (optional)
      const Sharing = require('expo-sharing');
      // @ts-ignore - runtime-only import (optional)
      const Print = require('expo-print');

      if (!viewRef.current) return;

      if (type === 'pdf' && Print?.printToFileAsync) {
        const html = `<html><body><h3>Session Graph Export</h3><p>Mode: ${config.mode}</p><p>Session Start: ${new Date(result.sessionStart).toLocaleString()}</p></body></html>`;
        const { uri } = await Print.printToFileAsync({ html });
        if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf' });
        }
        return;
      }

      const format = type === 'jpg' ? 'jpg' : 'png';
      const uri = await ViewShot.captureRef(viewRef, { format, quality: 0.92, result: 'tmpfile' } as any);
      const cacheDir = (FileSystem?.cacheDirectory || FileSystem?.documentDirectory || '') as string;
      const target = `${cacheDir}graph.${format}`;
      if (FileSystem?.copyAsync) {
        await FileSystem.copyAsync({ from: uri, to: target });
        if (Sharing?.isAvailableAsync && (await Sharing.isAvailableAsync())) {
          await Sharing.shareAsync(target);
        }
      }
    } catch (e) {
      console.warn('Export failed or modules not available:', e);
    }
  }, [config, result]);

  useFocusEffect(
    useCallback(() => {
      // Lock to landscape (best-effort via StatusBar hidden)
      StatusBar.setHidden(true);
      return () => {
        StatusBar.setHidden(false);
      };
    }, [])
  );

  return (
    <View style={styles.container} ref={viewRef}>
      <View style={styles.topSpacer} />
      <SessionGraphView
        config={config}
        result={result}
        members={members}
        fullscreen
        titleOffset={0}
        penaltyName={penaltyName}
        timeFormat={timeFormat}
        currency={currency}
        timezone={timezone}
        onExport={onExport}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  topSpacer: {
    height: 20,
  },
});
