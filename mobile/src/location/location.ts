import * as Location from 'expo-location';
import { Platform } from 'react-native';

import { DEMO_MODE } from '@/config';
import { km, regionById } from '@/region/regions';
import { detectRegion, getRegion } from '@/region/store';
import { getSettings } from '@/settings/store';

/**
 * Where the person is, in the form a 911 dispatcher wants it: a street
 * address first, then GPS coordinates with their accuracy.
 */
export type Fix = {
  lat: number;
  lon: number;
  /** Radius of uncertainty in metres. */
  accuracy: number | null;
  address: string | null;
  at: number;
  source: 'gps' | 'last-known' | 'demo';
};

/**
 * Used only in DEMO_MODE, clearly labelled: when the device cannot give a
 * location (a desktop browser), or when a region was chosen on the map that
 * this phone is not in (showing Lagos from Florida). The region's own point.
 */
const demoFix = () => getRegion().demo;

const withTimeout = <T,>(p: Promise<T>, ms: number) =>
  Promise.race([p, new Promise<null>((r) => setTimeout(() => r(null), ms))]);

async function reverse(lat: number, lon: number): Promise<string | null> {
  if (Platform.OS !== 'web') {
    try {
      const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lon });
      if (!r) return null;
      const street = [r.streetNumber, r.street].filter(Boolean).join(' ');
      return [street || r.name, r.city, r.region].filter(Boolean).join(', ') || null;
    } catch {
      return null;
    }
  }
  // Web has no built-in geocoder; OpenStreetMap's Nominatim answers when online.
  try {
    const res = await withTimeout(
      fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`, {
        headers: { Accept: 'application/json' },
      }),
      4000,
    );
    if (!res || !res.ok) return null;
    const j = (await res.json()) as { address?: Record<string, string> };
    const a = j.address ?? {};
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    return [street, a.city ?? a.town ?? a.village ?? a.suburb, a.state].filter(Boolean).join(', ') || null;
  } catch {
    return null;
  }
}

export async function getFix(): Promise<Fix | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      const pos =
        (await withTimeout(Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }), 7000)) ??
        (await Location.getLastKnownPositionAsync().catch(() => null));
      if (pos) {
        const { latitude: lat, longitude: lon, accuracy } = pos.coords;
        detectRegion({ lat, lon });
        const chosen = getSettings().region;
        const away = chosen !== null && km({ lat, lon }, regionById(chosen).center) > 150;
        if (!(DEMO_MODE && away)) return { lat, lon, accuracy: accuracy ?? null, address: await reverse(lat, lon), at: Date.now(), source: 'gps' };
      }
    }
  } catch {
    // fall through
  }
  if (DEMO_MODE) {
    const d = demoFix();
    return { ...d, accuracy: null, address: await reverse(d.lat, d.lon), at: Date.now(), source: 'demo' };
  }
  return null;
}

export function formatCoords(fix: Fix): string {
  const ns = fix.lat >= 0 ? 'N' : 'S';
  const ew = fix.lon >= 0 ? 'E' : 'W';
  return `${Math.abs(fix.lat).toFixed(5)}° ${ns}, ${Math.abs(fix.lon).toFixed(5)}° ${ew}`;
}
