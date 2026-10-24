/**
 * Regions (src/region): the emergency number shown and spoken, the hospitals
 * on the map, and the sourced reason a region is where Mayday helps most.
 */
import { clipKey, voiceClips } from '@/audio/voiceManifest';
import systemLines from '@/audio/systemLines.json';
import { describe as describePlace, nearest } from '@/facilities/nearest';
import { regionAt, regionById, REGIONS } from '@/region/regions';
import { localize } from '@/region/store';

const lagos = regionById('ng-lagos');
const florida = regionById('us-fl');

describe('regions', () => {
  it('Lagos says and shows 112; Florida 911', () => {
    expect(localize('Call 911 now.', lagos)).toBe('Call 112 now.');
    expect(localize('Call 911 now.', florida)).toBe('Call 911 now.');
    expect(lagos.alsoCall).toMatch(/767/);
  });

  it('every line the voice can say with 911 has a 112 recording', () => {
    const with911 = Object.values(systemLines.lines).filter((l) => l.includes('911'));
    expect(with911.length).toBeGreaterThan(3);
    expect(with911.map((l) => localize(l, lagos)).filter((l) => !(clipKey(l) in voiceClips))).toEqual([]);
  });

  it('knows where a phone is', () => {
    expect(regionAt({ lat: 6.6, lon: 3.35 })?.id).toBe('ng-lagos');
    expect(regionAt({ lat: 27.95, lon: -82.46 })?.id).toBe('us-fl');
    expect(regionAt({ lat: 51.5, lon: -0.12 })).toBeNull();
  });

  it('Lagos has its hospitals, and only claims an emergency department where the data does', () => {
    expect(lagos.facilities.length).toBeGreaterThan(400);
    const er = lagos.facilities.filter((f) => f.kind === 'er');
    expect(er.length).toBeLessThan(10);
    expect(lagos.facilities.some((f) => f.name === 'Lagos University Teaching Hospital')).toBe(true);
    expect(describePlace(lagos.facilities.find((f) => f.kind === 'hospital')!)).toMatch(/not confirmed/);
    expect(describePlace(lagos.facilities.find((f) => f.kind === 'phc')!)).toMatch(/Not for emergencies/);
  });

  it('the nearest place to go in Lagos is a hospital, not a clinic or health centre', () => {
    const [n] = nearest(lagos.demo, lagos.emergencyKinds, 1, lagos.facilities);
    expect(['er', 'referral']).toContain(n.f.kind);
  });

  it('every figure has a source', () => {
    for (const r of REGIONS) {
      for (const s of r.why?.stats ?? []) {
        expect(s.source.title.length).toBeGreaterThan(20);
        expect(s.source.url).toMatch(/^https:\/\/doi\.org\//);
      }
    }
  });
});
