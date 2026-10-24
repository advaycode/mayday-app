import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

import type { RegionId } from '@/region/regions';

/**
 * Settings and the optional Medical ID. Stored only on this phone, never
 * sent anywhere. A tiny store: one object, saved whole on every change.
 */
export type MedicalId = {
  name: string;
  born: string;
  conditions: string;
  medications: string;
  allergies: string;
  contact: string;
};

export type Settings = {
  voice: boolean;
  haptics: boolean;
  disclaimerSeen: boolean;
  medical: MedicalId;
  /** Chosen on the map; null means from the phone's location. */
  region: RegionId | null;
};

const KEY = 'mayday.settings.v1';
const DEFAULTS: Settings = {
  voice: true,
  haptics: true,
  disclaimerSeen: false,
  region: null,
  medical: { name: '', born: '', conditions: '', medications: '', allergies: '', contact: '' },
};

let state: Settings = DEFAULTS;
const listeners = new Set<() => void>();

AsyncStorage.getItem(KEY)
  .then((raw) => {
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<Settings>;
    state = { ...DEFAULTS, ...saved, medical: { ...DEFAULTS.medical, ...(saved.medical ?? {}) } };
    listeners.forEach((l) => l());
  })
  .catch(() => {});

export function getSettings() {
  return state;
}

export function setSettings(patch: Partial<Settings>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
}

export function useSettings(): Settings {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
}

export function hasMedicalId(m: MedicalId) {
  return Object.values(m).some((v) => v.trim().length > 0);
}
