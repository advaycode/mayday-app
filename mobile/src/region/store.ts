import { useSyncExternalStore } from 'react';

import { getSettings, setSettings, useSettings } from '@/settings/store';

import { REGIONS, regionAt, regionById, type Region, type RegionId } from './regions';

/**
 * The region in use: the one chosen on the map, or else the one this phone is
 * in (from its location), or else Florida. Read by the screens (the number to
 * call, the map) and by the voice (it says that number).
 */
let detected: RegionId | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

export function getRegion(): Region {
  const chosen = getSettings().region;
  return regionById(chosen ?? detected ?? 'us-fl');
}

/** The phone's location is known: use the region it is in, unless one was chosen. */
export function detectRegion(p: { lat: number; lon: number }) {
  const r = regionAt(p);
  if (r && r.id !== detected) {
    detected = r.id;
    notify();
  }
}

/** Chosen on the map. null goes back to automatic. */
export function chooseRegion(id: RegionId | null) {
  setSettings({ region: id });
  notify();
}

export function useRegion(): Region {
  // Also follow the saved choice as it loads from storage.
  useSettings();
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getRegion,
    getRegion,
  );
}

/** Text with the region's emergency number in place of 911 ("Call 911 now" -> "Call 112 now"). */
export function localize(text: string, region: Region = getRegion()): string {
  return region.number === '911' ? text : text.replace(/\b911\b/g, region.number);
}

export { REGIONS };
