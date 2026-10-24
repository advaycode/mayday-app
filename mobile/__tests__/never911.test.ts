/**
 * Mayday must never call 911, or anyone, under any circumstances. These tests
 * fail if any way to dial or text a number is added to the app.
 */
import * as fs from 'fs';
import * as path from 'path';

import appJson from '../app.json';
import { DEMO_MODE } from '@/config';

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return sourceFiles(p);
    return /\.(ts|tsx|js|jsx)$/.test(e.name) ? [p] : [];
  });
}

const SRC = path.join(__dirname, '..', 'src');
const FILES = [...sourceFiles(SRC), path.join(__dirname, '..', 'index.js')];

describe('Mayday never calls 911', () => {
  it('has no phone, text or video-call link anywhere in the app code', () => {
    const offenders = FILES.filter((f) => /\b(tel|telprompt|sms|smsto|mms|facetime|facetime-audio):/i.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('never imports a module that can place a call', () => {
    const offenders = FILES.filter((f) => /(react-native-immediate-phone-call|react-native-communications|expo-sms|react-native-phone-call|CallKit)/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('does not even install a module that can place a call or send a text', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    const deps = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
    expect(deps.filter((d) => /(phone-call|communications|expo-sms|sms|callkit|telephony)/i.test(d))).toEqual([]);
  });

  it('only opens web pages with Linking', () => {
    for (const f of FILES) {
      const src = fs.readFileSync(f, 'utf8');
      for (const m of src.matchAll(/Linking\.openURL\(([^)]*)\)/g)) {
        // Allowed: map directions (the maps app or a https page), photo credit pages, and the sources of the map's region figures.
        expect([f, m[1]]).toEqual([f, expect.stringMatching(/^(url|credit\.source|s\.source\.url|`https:\/\/[^`]*`)$/)]);
      }
    }
  });

  it('links each region figure to a web page, nothing else', () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { REGIONS } = require('@/region/regions') as typeof import('@/region/regions');
    for (const r of REGIONS) for (const s of r.why?.stats ?? []) expect(s.source.url).toMatch(/^https:\/\//);
  });

  it('has no code that places a call at all', () => {
    expect(fs.existsSync(path.join(SRC, 'emergency', 'call.ts'))).toBe(false);
    const offenders = FILES.filter((f) => /\b(placeCall|textTo911|Linking\.canOpenURL\(['"`]tel)/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('demo mode is permanent', () => {
    expect(DEMO_MODE).toBe(true);
    expect(fs.readFileSync(path.join(SRC, 'config.ts'), 'utf8')).toMatch(/export const DEMO_MODE = true;/);
  });

  it('does not ask the phone for permission to make calls', () => {
    expect(appJson.expo.android.permissions).not.toContain('CALL_PHONE');
  });
});
