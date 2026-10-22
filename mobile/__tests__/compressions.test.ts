import fs from 'fs';
import path from 'path';

import { PACE_LINES, PaceCoach, type PaceAdvice } from '@/cpr/pace';
import type { Sample } from '@/sensors/analyze';
import { readCompressions, type CompressionReading } from '@/sensors/compressions';
import { simulateCpr, type CprSimOptions } from '@/sensors/cprSim';
import { median } from '@/sensors/dsp';

/**
 * The phone feeling chest compressions (sensors/compressions.ts) and what the
 * coach says about them (cpr/pace.ts), on simulated compressions. The full
 * report on five real resuscitations (CPRDAT) runs on request:
 *
 *   python tools/cpr_data.py
 *   CPR_REPORT=1 npx jest compressions      -> docs/CPR_SENSOR.md, reports/cpr-sensor.json
 */

/** Read every half second over the last 6 s, as the app does; feed the coach. */
function play(samples: Sample[], seconds: number, phase: (t: number) => 'compress' | 'coach' | 'breaths' = () => 'compress') {
  const coach = new PaceCoach();
  const readings: { t: number; r: CompressionReading; advice: PaceAdvice | null }[] = [];
  let from = 0;
  for (let t = 3; t <= seconds; t += 0.5) {
    while (from < samples.length && samples[from].t < t - 6) from++;
    let to = from;
    while (to < samples.length && samples[to].t <= t) to++;
    const r = readCompressions(samples.slice(from, to));
    if (!r) continue;
    coach.feed(t, r, phase(t));
    readings.push({ t, r, advice: coach.summary(t).advice });
  }
  return { coach, readings };
}

const sim = (o: Partial<CprSimOptions>) => simulateCpr({ seconds: 30, fs: 60, ...o });

describe('feeling compressions', () => {
  for (const perMin of [90, 110, 130]) {
    it(`reads ${perMin} a minute from a phone on a mattress (60/s)`, () => {
      const { readings } = play(sim({ perMin, transfer: 0.3, seed: perMin }), 30);
      const late = readings.filter((x) => x.t >= 8);
      expect(late.every((x) => x.r.status === 'compressing')).toBe(true);
      expect(Math.abs(median(late.map((x) => x.r.perMin!)) - perMin)).toBeLessThan(3);
    });
  }

  it('works upright in a pocket too', () => {
    const { readings } = play(sim({ perMin: 110, transfer: 0.3, axis: 'y', seed: 4 }), 20);
    expect(readings.filter((x) => x.t >= 8).every((x) => x.r.status === 'compressing')).toBe(true);
  });

  it('says still when nothing moves, and when the motion is under the sensor noise', () => {
    for (const o of [{ stopAt: 0 }, { transfer: 0.001 }]) {
      const { readings } = play(sim({ perMin: 110, seed: 9, ...o }), 15);
      expect(readings.every((x) => x.r.status !== 'compressing')).toBe(true);
    }
  });
});

describe('the pace coach', () => {
  const adviceAt = (o: Partial<CprSimOptions>, t: number, phase?: (t: number) => 'compress' | 'coach' | 'breaths') => {
    const { coach } = play(sim(o), t, phase);
    return coach.summary(t).advice;
  };

  it('is quiet at a good pace', () => expect(adviceAt({ perMin: 110, transfer: 0.3 }, 30)).toBeNull());
  it('says faster under 100', () => expect(adviceAt({ perMin: 88, transfer: 0.3 }, 30)).toBe('faster'));
  it('says slower over 120', () => expect(adviceAt({ perMin: 135, transfer: 0.3 }, 30)).toBe('slower'));
  it('says keep pushing when compressions stop', () => expect(adviceAt({ perMin: 110, transfer: 0.3, stopAt: 20 }, 26)).toBe('keep'));
  it('not during the 30:2 breath pause', () => expect(adviceAt({ perMin: 110, transfer: 0.3, stopAt: 20 }, 26, (t) => (t >= 20 ? 'breaths' : 'compress'))).toBeNull());

  it('never speaks if it could not feel the compressions', () => {
    for (const perMin of [80, 140]) {
      const { readings } = play(sim({ perMin, transfer: 0.001, seed: perMin }), 30);
      expect(readings.every((x) => x.advice === null)).toBe(true);
    }
  });

  it('only ever says these three things, and never "stop"', () => {
    expect(Object.keys(PACE_LINES).sort()).toEqual(['faster', 'keep', 'slower']);
    for (const line of Object.values(PACE_LINES)) expect(line.toLowerCase()).not.toMatch(/\bstop\b(?!\.)|depth|deeper|harder/);
    expect(PACE_LINES.keep).toContain("Don't stop");
  });
});

// --- Five real resuscitations, on request ----------------------------------------------------
const report = process.env.CPR_REPORT ? it : it.skip;
const DATA = path.join(__dirname, '..', '..', 'data', 'cpr');

report(
  'real compressions (CPRDAT): writes docs/CPR_SENSOR.md and reports/cpr-sensor.json',
  () => {
    type Case = { name: string; file: string; fs: number; n: number; periods: [number, number][]; compressions: number[] };
    const index: Case[] = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
    const cases = index.map((c) => ({ ...c, g: new Float32Array(fs.readFileSync(path.join(DATA, c.file)).buffer.slice(0)) }));
    const transfers = [1, 0.3, 0.1, 0.03, 0.01, 0.003];
    const rows: Record<string, unknown>[] = [];
    const byCase: Record<string, { on: number; felt: number; off: number; falseFelt: number }> = {};
    for (const fsPhone of [100, 60]) {
      for (const transfer of transfers) {
        let tp = 0;
        let fn = 0;
        let fp = 0;
        let tn = 0;
        const errs: number[] = [];
        let k = 0;
        for (const c of cases) {
          const total = c.n / c.fs;
          // Every 15 s, a 6 s stretch: is the physician's mark on at its end, and what rate do the reference peaks give?
          for (let at = 10; at + 1 < total; at += 15) {
            const on = c.periods.some(([s, e]) => at - 3 >= s && at <= e);
            const off = c.periods.every(([s, e]) => at < s - 1 || at - 6 > e + 1);
            if (!on && !off) continue; // the edge of a period: skip
            const samples = simulateCpr({ seconds: 6, fs: fsPhone, transfer, seed: 1 + k++, recorded: { fs: c.fs, g: c.g, from: at - 6 } });
            const r = readCompressions(samples);
            const said = r?.status === 'compressing';
            if (fsPhone === 60 && transfer === 0.3) {
              const b = (byCase[c.name] ??= { on: 0, felt: 0, off: 0, falseFelt: 0 });
              if (on) {
                b.on++;
                if (said) b.felt++;
              } else {
                b.off++;
                if (said) b.falseFelt++;
              }
            }
            if (on) {
              if (said) tp++;
              else fn++;
              const ref = c.compressions.filter((t) => t >= at - 5 && t <= at);
              const gaps = ref.slice(1).map((t, j) => t - ref[j]).filter((g) => g < 1.2);
              if (said && gaps.length >= 4) errs.push(Math.abs(r!.perMin! - 60 / median(gaps)));
            } else if (said) fp++;
            else tn++;
          }
        }
        const sizeMg = transfer * 1000; // per g of chest motion, for the table
        rows.push({
          fs: fsPhone,
          transfer,
          sensitivity: tp / (tp + fn),
          specificity: tn / (tn + fp),
          windowsOn: tp + fn,
          windowsOff: tn + fp,
          rateErrorMedian: errs.length ? median(errs) : null,
          rateWithin5: errs.length ? errs.filter((e) => e <= 5).length / errs.length : null,
          sizeMg,
        });
      }
    }
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'cpr-sensor.json'), JSON.stringify({ generated: new Date().toISOString(), rows, byCase }, null, 2) + '\n');
    const pct = (v: unknown) => (typeof v === 'number' ? `${Math.round(v * 100)}%` : '');
    const share = (v: number) => `${v >= 0.01 ? Math.round(v * 100) : Math.round(v * 1000) / 10}%`;
    const minutes = Math.round(cases.reduce((s, c) => s + c.n / c.fs, 0) / 60);
    const md = [
      '# Feeling chest compressions: scored on real resuscitations',
      '',
      'Generated by `CPR_REPORT=1 npx jest compressions` (mobile/__tests__/compressions.test.ts) after `python tools/cpr_data.py`. Numbers in `mobile/reports/cpr-sensor.json`.',
      '',
      `**Data.** CPRDAT (University of Graz; Orlob et al., Resuscitation, in press at release; Zenodo 5497700, CC BY 4.0): five real out-of-hospital resuscitations, ${minutes} minutes, the defibrillator's chest accelerometer, and the periods of compressions marked by experienced physicians. The accelerometer's unit is not published; it is calibrated by assuming the median compression is 5 cm deep (\`tools/cpr_data.py\`), so treat sizes as ±25%.`,
      '',
      "**The phone.** The real chest motion is played through a simulated phone (`mobile/src/sensors/cprSim.ts`): the phone feels a share of it (\"transfer\"), plus phone-class sensor noise (180 µg/√Hz), 1 mg steps and timing jitter. 100% is the phone under the hands (never advised); a mattress or couch the person lies on is perhaps 30%; a hard floor beside them perhaps 1%. Nobody has measured these shares for a phone, so they are swept. Every 15 s of each case, the reader sees the 6 s before and says whether compressions are going on.",
      '',
      '**Scores.** Sensitivity: of the moments physicians marked as compressions, how many the phone felt. Specificity: of the moments marked as no compressions (pauses, rhythm checks, shocks, transport), how many it called still. Rate error: against the compressions counted in the full-strength signal over the same 5 s.',
      '',
      '| Samples/s | Phone feels | Felt compressions (sensitivity) | Called still when there were none (specificity) | Rate error, median (/min) | Rate within 5/min |',
      '|---|---|---|---|---|---|',
      ...rows.map((r) => `| ${r.fs} | ${share(r.transfer as number)} | ${pct(r.sensitivity)} | ${pct(r.specificity)} | ${typeof r.rateErrorMedian === 'number' ? (r.rateErrorMedian as number).toFixed(1) : ''} | ${pct(r.rateWithin5)} |`),
      '',
      '**By case** (60 a second, the phone feeling 30%): where the false "compressing" calls come from.',
      '',
      '| Case | Moments with compressions | Felt | Moments without | Called compressing anyway |',
      '|---|---|---|---|---|',
      ...Object.entries(byCase).map(([name, b]) => `| ${name.replace('case_', 'Case ')} | ${b.on} | ${pct(b.felt / b.on)} | ${b.off} | ${b.off ? pct(b.falseFelt / b.off) : ''} |`),
      '',
      'The coach only speaks after it has clearly felt compressions for 4 of the last 30 seconds, so where the phone cannot feel them it stays quiet rather than nag. It never says stop, and never comments on depth.',
      '',
    ];
    fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'CPR_SENSOR.md'), md.join('\n'));
    expect(rows.length).toBe(transfers.length * 2);
  },
  1_800_000,
);
