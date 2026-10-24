import type { Facility } from '@/facilities/nearest';
import fl from '@/facilities/fl_facilities.json';
import lagos from '@/facilities/lagos_facilities.json';

/**
 * Where Mayday is being used. A region brings its emergency number (what the
 * screens show and the voice says; Mayday never dials it), its hospitals for
 * the map, and, where help is far away, the reason Mayday matters there.
 *
 * Florida is home. Lagos is the first place where the bystander is often the
 * only help that comes: ambulances there answered under half of road-crash
 * calls, and across Africa fewer than one person in ten is covered by any
 * ambulance service. Every figure below is from a cited, checkable source.
 */

export type RegionId = 'us-fl' | 'ng-lagos';

export type Stat = { big: string; text: string; source: { title: string; url: string } };

export type Region = {
  id: RegionId;
  /** Where, in a few words, for the map's region chip. */
  name: string;
  country: string;
  /** The number to call, as shown. Mayday shows it and never dials it. */
  number: string;
  /** Another local line, if there is one ("767 in Lagos State"). */
  alsoCall: string | null;
  center: { lat: number; lon: number };
  zoom: number;
  /** Shown on the map when this phone is not in the region (clearly labelled). */
  demo: { lat: number; lon: number };
  units: 'mi' | 'km';
  /** A drive-time guess is honest for U.S. roads, not for Lagos traffic. */
  driveEstimate: boolean;
  facilities: Facility[];
  /** The map's tabs: what each shows. */
  filters: { id: string; label: string; kinds: Facility['kind'][] }[];
  /** Which kinds count as "where to go" in an emergency. */
  emergencyKinds: Facility['kind'][];
  facilitySource: string;
  why: { headline: string; body: string; stats: Stat[] } | null;
};

const MOULD_MILLMAN = {
  title: 'Mould-Millman et al. The State of Emergency Medical Services (EMS) Systems in Africa. Prehospital and Disaster Medicine, 2017',
  url: 'https://doi.org/10.1017/S1049023X17000061',
};
const VENKATRAMAN = {
  title: 'Venkatraman et al. Lagos State Ambulance Service: a performance evaluation. European Journal of Trauma and Emergency Surgery, 2020',
  url: 'https://doi.org/10.1007/s00068-020-01319-y',
};
const SONG = {
  title: 'Song et al. The effect of bystander CPR on the survival of out-of-hospital cardiac arrests: a systematic review and meta-analysis. Scand J Trauma Resusc Emerg Med, 2018',
  url: 'https://doi.org/10.1186/s13049-018-0552-8',
};

export const REGIONS: Region[] = [
  {
    id: 'us-fl',
    name: 'Tampa Bay, Florida',
    country: 'United States',
    number: '911',
    alsoCall: null,
    center: { lat: 28.1866, lon: -82.3473 },
    zoom: 11,
    demo: { lat: 28.1866, lon: -82.3473 },
    units: 'mi',
    driveEstimate: true,
    facilities: fl.facilities as Facility[],
    filters: [
      { id: 'er', label: 'ER', kinds: ['er', 'trauma'] },
      { id: 'trauma', label: 'Trauma', kinds: ['trauma'] },
      { id: 'urgent', label: 'Urgent care', kinds: ['urgent'] },
    ],
    emergencyKinds: ['er', 'trauma'],
    facilitySource: 'CMS, Florida DOH, OpenStreetMap',
    why: null,
  },
  {
    id: 'ng-lagos',
    name: 'Lagos, Nigeria',
    country: 'Nigeria',
    number: '112',
    alsoCall: '767 in Lagos State',
    center: { lat: 6.5244, lon: 3.3792 },
    zoom: 11,
    // Lagos Island, by the Marina.
    demo: { lat: 6.4541, lon: 3.3947 },
    units: 'km',
    driveEstimate: false,
    facilities: lagos.facilities as Facility[],
    filters: [
      { id: 'hospitals', label: 'Hospitals', kinds: ['er', 'referral'] },
      { id: 'clinics', label: 'Clinics', kinds: ['hospital'] },
      { id: 'phc', label: 'Health centres', kinds: ['phc'] },
    ],
    emergencyKinds: ['er', 'referral'],
    facilitySource: 'OpenStreetMap',
    why: {
      headline: 'Here, the bystander is the ambulance',
      body: 'When help is far away, the person beside you is the emergency service. Mayday works offline, needs no account, and understands many Englishes.',
      stats: [
        { big: '8.7%', text: 'of people in Africa were covered by any ambulance service (2012)', source: MOULD_MILLMAN },
        { big: '53%', text: "of road-crash calls Lagos State's ambulance service did not respond to (2017-18)", source: VENKATRAMAN },
        { big: '2×', text: 'the odds of surviving cardiac arrest when a bystander gives CPR', source: SONG },
      ],
    },
  },
];

export const regionById = (id: RegionId) => REGIONS.find((r) => r.id === id)!;

/** km between two points. */
export function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** The region this point is in (within 150 km of its centre), if any. */
export function regionAt(p: { lat: number; lon: number }): Region | null {
  return REGIONS.find((r) => km(p, r.center) < 150) ?? null;
}
