import fs from 'fs';
import path from 'path';

import { median } from '@/sensors/dsp';
import { trial, type TrialResult } from '@/sensors/evaluate';
import type { SimOptions } from '@/sensors/sim';

/**
 * The breathing check on real breathing: the PhysioNet CEBS respiration
 * belts (20 healthy adults lying still, about 17 hours; exported by
 * tools/heart_ml/breathing.py) played through the simulated phone. Everyone
 * here is breathing normally at rest, so every "Start CPR" is a false alarm,
 * and its reason says what real breathing does that the formula's breaths
 * did not.
 *
 *   python tools/heart_ml/breathing.py
 *   REAL_BREATH=1 npx jest realbreathing
 *
 * Writes reports/real-breathing.json and docs/REAL_BREATHING.md. The belts
 * are not in git (data/ is ignored), so this runs on request only.
 */
const DATA = path.join(__dirname, '..', '..', 'data', 'resp');
const run = process.env.REAL_BREATH ? it : it.skip;
/** REAL_BREATH=fast: the 10 s check at 60/s only, a quarter of the windows, no files written; for trying a change. */
const FAST = process.env.REAL_BREATH === 'fast';

type Entry = { name: string; subject: number; file: string; fs: number; n: number; peaks: number[]; badSeconds: number[] };
type Window = { entry: Entry; breath: Float32Array; from: number; perMin: number | null };

/** Windows every `every` seconds, `seconds` long, away from movement; the belt's rate around each. */
function windows(entry: Entry, breath: Float32Array, every: number, seconds: number): Window[] {
  const out: Window[] = [];
  const total = entry.n / entry.fs;
  for (let from = 5; from + seconds + 5 < total; from += every) {
    if (entry.badSeconds.some((s) => s >= from - 2 && s <= from + seconds + 2)) continue;
    const near = entry.peaks.filter((p) => p >= from - 8 && p <= from + seconds + 8);
    const gaps = near.slice(1).map((p, k) => p - near[k]);
    out.push({ entry, breath, from, perMin: gaps.length >= 2 ? 60 / median(gaps) : null });
  }
  return out;
}

/** The kind of reason, from the analysis's own words. */
function reason(r: TrialResult): string {
  if (r.status === 'regular') return 'regular';
  if (r.status === 'moving') return 'hand or bump (wrongly)';
  if (r.status === 'none') return 'no movement seen';
  if (r.why.startsWith('Only')) return 'too few breaths in the window';
  if (r.why.includes('outside')) return r.rate !== null && r.rate < 12 ? 'rate too slow' : 'rate too fast';
  if (r.why.startsWith('Still')) return 'long pauses (looks like gasps)';
  if (r.why.startsWith('Uneven timing')) return 'uneven timing';
  if (r.why.startsWith('Uneven depth')) return 'uneven depth';
  return r.status;
}

run(
  'real breathing through the simulated phone: writes reports/real-breathing.json and docs/REAL_BREATHING.md',
  () => {
    const index: Entry[] = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
    const load = (e: Entry) => new Float32Array(fs.readFileSync(path.join(DATA, e.file)).buffer.slice(0));
    const all3: { name: string; mode: 'check' | 'lab'; sensor: Partial<SimOptions> }[] = [
      { name: 'Emergency check (10 s), 100/s (native app)', mode: 'check', sensor: { fs: 100 } },
      { name: 'Emergency check (10 s), 60/s (browser)', mode: 'check', sensor: { fs: 60 } },
      { name: 'Lab (30 s), 100/s', mode: 'lab', sensor: { fs: 100 } },
    ];
    const runs = FAST ? [all3[1]] : all3;
    const results = runs.map((spec) => {
      const all: (TrialResult & { name: string; subject: number; from: number })[] = [];
      let k = 0;
      for (const e of index) {
        const breath = load(e);
        // Long records sampled more sparsely, so each person counts about the same.
        const every = (e.n / e.fs > 600 ? 30 : 15) * (FAST ? 4 : 1);
        for (const w of windows(e, breath, every, spec.mode === 'check' ? 11.5 : 32)) {
          const r = trial('normal', 1 + 7919 * k++, spec.mode, { ...spec.sensor, recorded: { fs: e.fs, breath, from: w.from, perMin: w.perMin } });
          all.push({ ...r, name: e.name, subject: e.subject, from: w.from });
        }
      }
      const share = (f: (r: TrialResult) => boolean, of = all) => (of.length ? Math.round((of.filter(f).length / of.length) * 1000) / 1000 : null);
      const reasons: Record<string, number> = {};
      for (const r of all) reasons[reason(r)] = (reasons[reason(r)] ?? 0) + 1;
      const rated = all.filter((r) => r.status === 'regular' && r.rate !== null && r.truthRate !== null);
      const subjects = [...new Set(all.map((r) => r.subject))].sort((a, b) => a - b).map((s) => {
        const mine = all.filter((r) => r.subject === s);
        const rates = mine.map((r) => r.truthRate).filter((v): v is number => v !== null);
        const misses: Record<string, number> = {};
        for (const r of mine) if (r.status !== 'regular') misses[reason(r)] = (misses[reason(r)] ?? 0) + 1;
        const top = Object.entries(misses).sort((a, b) => b[1] - a[1])[0];
        return { subject: s, windows: mine.length, beltRate: rates.length ? Math.round(median(rates) * 10) / 10 : null, regular: share((r) => r.status === 'regular', mine), mainMiss: top ? top[0] : '' };
      });
      return {
        ...spec,
        windows: all.length,
        regular: share((r) => r.status === 'regular'),
        startCpr: share((r) => r.suggest === 'abnormal'),
        rateMedianError: rated.length ? Math.round(median(rated.map((r) => Math.abs(r.rate! - r.truthRate!))) * 100) / 100 : null,
        reasons,
        subjects,
      };
    });
    if (FAST) {
      for (const r of results) console.log(`${r.name}: ${r.windows} windows, regular ${r.regular}, start CPR ${r.startCpr}, rate error ${r.rateMedianError}`, JSON.stringify(r.reasons));
      return;
    }
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'real-breathing.json'), JSON.stringify({ generated: new Date().toISOString(), runs: results }, null, 2) + '\n');

    const pct = (v: number | null) => (v === null ? '' : `${Math.round(v * 100)}%`);
    const people = new Set(index.map((e) => e.subject)).size;
    const minutes = Math.round(index.reduce((s, e) => s + e.n / e.fs, 0) / 60);
    const md = [
      '# Breathing check on real breathing',
      '',
      `Generated by \`REAL_BREATH=1 npx jest realbreathing\` (mobile/__tests__/realbreathing.test.ts) after \`python tools/heart_ml/breathing.py\`. Numbers in \`mobile/reports/real-breathing.json\`.`,
      '',
      `**What this is.** The respiration belts of the PhysioNet CEBS database (${people} healthy adults lying still, ${minutes} minutes; García-González et al., Computing in Cardiology 2013) played through the simulated phone (\`mobile/src/sensors/sim.ts\`, \`recorded\`): each real breath becomes the chest and belly rising by the sizes measured in supine adults, then the phone's tilt, its accelerometer and gyroscope, their noise and timing, and the app's own analysis. The breathing is real; the phone is simulated.`,
      '',
      '**How to read it.** Everyone is breathing normally at rest, so "regular" is right and every "Start CPR" is a false alarm. False alarms are the safe mistake (the check only runs on someone who does not respond, and the guidelines say: if in doubt, start CPR), but each one is a real breathing pattern the check does not recognise. The rate error is against the belt\'s own breaths around the same window.',
      '',
      '| Check | Windows | Called regular | Start CPR (false alarm) | Rate error, median (/min) |',
      '|---|---|---|---|---|',
      ...results.map((r) => `| ${r.name} | ${r.windows} | ${pct(r.regular)} | ${pct(r.startCpr)} | ${r.rateMedianError ?? ''} |`),
      '',
      '## Why real breathing was not called regular',
      '',
      `| Reason | ${results.map((r) => r.name).join(' | ')} |`,
      `|---|${results.map(() => '---|').join('')}`,
      ...[...new Set(results.flatMap((r) => Object.keys(r.reasons)))]
        .filter((k) => k !== 'regular')
        .sort()
        .map((k) => `| ${k} | ${results.map((r) => pct((r.reasons[k] ?? 0) / r.windows)).join(' | ')} |`),
      '',
      '## By person (emergency check, 60/s)',
      '',
      '| Person | Windows | Belt rate (/min) | Called regular | Most common miss |',
      '|---|---|---|---|---|',
      ...results[1].subjects.map((s) => `| ${s.subject} | ${s.windows} | ${s.beltRate ?? ''} | ${pct(s.regular)} | ${s.mainMiss} |`),
      '',
    ];
    fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'REAL_BREATHING.md'), md.join('\n'));
    expect(results.every((r) => r.windows > 100)).toBe(true);
  },
  1_800_000,
);
