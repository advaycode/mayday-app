import { Linking, Platform } from 'react-native';

import type { Care } from '@/protocols/schema';

import { getRegion } from '@/region/store';

import data from './fl_facilities.json';

export type Facility = {
  id: string;
  name: string;
  /**
   * er/trauma/urgent: U.S. (CMS, state trauma lists, OpenStreetMap).
   * referral/phc/hospital: places where no official list exists (Lagos): a
   * public general or teaching hospital, a primary health centre, or any
   * other hospital or clinic whose emergency care is not confirmed.
   */
  kind: 'er' | 'trauma' | 'urgent' | 'referral' | 'phc' | 'hospital';
  traumaLevel: string | null;
  address: string | null;
  city: string | null;
  phone: string | null;
  lat: number;
  lon: number;
  pediatric: boolean;
  veterans?: boolean;
};

export const facilities = data.facilities as Facility[];
export const facilitySources = data.sources;

const R_MILES = 3958.8;
const rad = (d: number) => (d * Math.PI) / 180;

/** Great-circle distance in miles. */
export function miles(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * R_MILES * Math.asin(Math.sqrt(h));
}

/**
 * A rough drive time, clearly labelled as an estimate in the UI: roads are
 * about 1.35 times longer than a straight line, at about 35 mph in town.
 * It needs no network, which matters more here than precision.
 */
export function driveMinutes(distanceMiles: number): number {
  return Math.max(1, Math.round(((distanceMiles * 1.35) / 35) * 60));
}

export function nearest(from: { lat: number; lon: number }, kinds: Facility['kind'][], n = 3, list: Facility[] = getRegion().facilities) {
  return list
    .filter((f) => kinds.includes(f.kind))
    .map((f) => ({ f, d: miles(from, f) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, n);
}

/** Emergency departments include trauma centers: every trauma center has one. */
export const ER_KINDS: Facility['kind'][] = ['er', 'trauma'];

export function describe(f: Facility): string {
  if (f.kind === 'trauma') return `Trauma center, Level ${f.traumaLevel}`.replace('Level Pediatric', 'pediatric');
  if (f.kind === 'urgent') return 'Urgent care. Not for emergencies.';
  if (f.kind === 'referral') return 'Public general or teaching hospital';
  if (f.kind === 'phc') return 'Primary health centre. Not for emergencies.';
  if (f.kind === 'hospital') return 'Hospital or clinic. Emergency care not confirmed.';
  return 'Emergency room';
}

/** "2.4 mi" or "3.9 km", for the region in use. */
export function distanceText(distanceMiles: number, units: 'mi' | 'km' = getRegion().units): string {
  return units === 'km' ? `${(distanceMiles * 1.609344).toFixed(1)} km` : `${distanceMiles.toFixed(1)} mi`;
}

/**
 * Where help should come from, decided by the protocol's `care` field, not by
 * a model. Cardiac arrest, stroke and major bleeding: stay, paramedics are
 * coming, do not drive. Paramedics choose the destination; we show the one
 * they are likely to use so the family knows where to go.
 */
export function careAdvice(care: Care | null, slots: Record<string, string | undefined>, at: { lat: number; lon: number }) {
  const er = nearest(at, getRegion().emergencyKinds, 1)[0];
  const trauma = nearest(at, ['trauma'], 1)[0];
  if (care === 'by_severity' && slots.burn_severity === 'minor') {
    const uc = nearest(at, ['urgent'], 1)[0];
    return { stay: false, line: 'Small burns can be seen at urgent care.', likely: uc ?? er };
  }
  if (care === 'trauma_stay') return { stay: true, line: 'Stay. Paramedics are coming. Do not drive.', likely: trauma ?? er };
  return { stay: care !== null, line: care ? 'Stay. Paramedics are coming. Do not drive.' : '', likely: er };
}

export function navigate(f: Facility) {
  const dest = `${f.lat},${f.lon}`;
  const url =
    Platform.OS === 'ios'
      ? `maps://?daddr=${dest}&q=${encodeURIComponent(f.name)}`
      : Platform.OS === 'android'
        ? `geo:0,0?q=${dest}(${encodeURIComponent(f.name)})`
        : `https://www.google.com/maps/dir/?api=1&destination=${dest}`;
  Linking.openURL(url).catch(() => Linking.openURL(`https://www.google.com/maps/dir/?api=1&destination=${dest}`));
}
