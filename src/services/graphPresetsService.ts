import AsyncStorage from '@react-native-async-storage/async-storage';
import { GraphConfig } from './sessionGraphEngine';

const KEY_PREFIX = 'graphPreset:';

export interface GraphPreset {
  id: string;
  name: string;
  config: GraphConfig;
  createdAt: string;
}

export async function savePreset(preset: GraphPreset): Promise<void> {
  await AsyncStorage.setItem(KEY_PREFIX + preset.id, JSON.stringify(preset));
}

export async function loadPreset(id: string): Promise<GraphPreset | null> {
  const raw = await AsyncStorage.getItem(KEY_PREFIX + id);
  return raw ? JSON.parse(raw) : null;
}

export async function listPresets(): Promise<GraphPreset[]> {
  const keys = await AsyncStorage.getAllKeys();
  const presetKeys = keys.filter(k => k.startsWith(KEY_PREFIX));
  const raws = await AsyncStorage.multiGet(presetKeys);
  return raws.map(([, v]) => (v ? JSON.parse(v) : null)).filter(Boolean) as GraphPreset[];
}

export async function deletePreset(id: string): Promise<void> {
  await AsyncStorage.removeItem(KEY_PREFIX + id);
}
