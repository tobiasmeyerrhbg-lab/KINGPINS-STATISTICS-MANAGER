import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY_PREFIX = 'graphOptions:';

export interface GraphOptions {
  comparePenaltyIds: string[];
}

export async function loadGraphOptions(clubId: string): Promise<GraphOptions | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + clubId);
  return raw ? JSON.parse(raw) as GraphOptions : null;
}

export async function saveGraphOptions(clubId: string, options: GraphOptions): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + clubId, JSON.stringify(options));
}