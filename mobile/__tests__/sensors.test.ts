import fs from 'fs';
import path from 'path';

import { analyze, angles, G, suggestAnswer, type BreathReading, type BreathStatus } from '@/sensors/analyze';
import { extrema, lowpass, resample, rng } from '@/sensors/dsp';
import { evaluate, trial } from '@/sensors/evaluate';
import { SCENARIOS, simulate, type Scenario } from '@/sensors/sim';

/**
 * The breathing sensor, tested on simulated people (src/sensors/sim.ts):
 * physics of a phone on a breathing torso, a heartbeat, a rescuer's hand,
 * footsteps, and a phone-class accelerometer's noise, resolution and timing.
 *
 * The full sweep (noise, sample rate, sensor offset, heartbeat strength)
 * writes reports/sensor-sim.json and docs/SENSOR_SIM.md:
 *   SENSOR_REPORT=1 npx jest sensors
 */

const amplitude = (x: Float64Array) => Math.max(...x.slice(200, -200)) - Math.min(...x.slice(200, -200));

describe('signal kit', () => {
  const fs100 = 100;
  const sine = (hz: number) => Float64Array.from({ length: 2000 }, (_, i) => Math.sin((2 * Math.PI * hz * i) / fs100));

  it('low-pass keeps breathing and removes a heartbeat-band vibration', () => {
    expect(amplitude(lowpass(sine(0.25), 1, fs100))).toBeCloseTo(2, 1);
    expect(amplitude(lowpass(sine(10), 1, fs100))).toBeLessThan(0.001);
  });

  it('filters without moving peaks in time (zero phase)', () => {
    const y = lowpass(sine(0.25), 1, fs100);
    const peak = y.slice(0, 600).reduce((best, v, i, a) => (v > a[best] ? i : best), 0);
    expect(Math.abs(peak - 100)).toBeLessThanOrEqual(1); // sin peaks at 1 s
  });

  it('turning points ignore wiggles smaller than the threshold', () => {
    const r = rng(3);
    const x = Array.from({ length: 1000 }, (_, i) => Math.sin((2 * Math.PI * i) / 250) + 0.05 * r.gauss());
    expect(extrema(x, 0.5).length).toBe(8); // 4 cycles: 4 peaks, 4 valleys
    expect(extrema(x.map((v) => v * 0.01), 0.5).length).toBe(0);
  });

  it('puts jittery samples on a regular clock', () => {
    const t = [0, 0.011, 0.019, 0.032, 0.04];
    const y = resample(t, t.map((v) => 2 * v), 100);
    expect(Array.from(y).map((v) => Math.round(v * 1000))).toEqual([0, 20, 40, 60, 80]);
  });
});

describe('the level', () => {
  it('reads tilt from gravity like the iPhone Level', () => {
    const tip = (deg: number) => ({ x: 0, y: G * Math.sin((deg * Math.PI) / 180), z: G * Math.cos((deg * Math.PI) / 180) });
    expect(angles(tip(0.37)).pitch).toBeCloseTo(0.37, 6);
    expect(angles(tip(-2)).pitch).toBeCloseTo(-2, 6);
  });

  it('works whichever sign the platform gives gravity', () => {
    const { samples } = simulate({ scenario: 'normal', seconds: 12, seed: 5 });
    const flipped = samples.map((s) => ({ t: s.t, x: -s.x, y: -s.y, z: -s.z }));
    expect(analyze(flipped, { window: 10 })!.breath.status).toBe(analyze(samples, { window: 10 })!.breath.status);
  });
});

describe('safety: the phone can only point toward CPR', () => {
  const reading = (status: BreathStatus) => ({ status }) as BreathReading;

  it('never answers "breathing normally" for the rescuer', () => {
    for (const s of ['unknown', 'moving', 'none', 'irregular', 'seesaw', 'regular'] as BreathStatus[]) {
      expect([null, 'abnormal']).toContain(suggestAnswer(reading(s)));
    }
    expect(suggestAnswer(reading('regular'))).toBeNull();
    expect(suggestAnswer(reading('none'))).toBe('abnormal');
  });

  // The one mistake that must not happen: "regular breathing" on someone who
  // is not breathing, or only gasping.
  const notBreathing: Scenario[] = ['none', 'none_steps', 'agonal', 'slow'];
  for (const fs of [60, 100]) {
    for (const sc of notBreathing) {
      it(`${sc} at ${fs}/s: never called regular in 30 simulated 10-second checks`, () => {
        for (let k = 0; k < 30; k++) expect(trial(sc, 101 + k * 37, 'check', { fs }).status).not.toBe('regular');
      });
    }
  }
});

describe('simulated bench', () => {
  it('sees normal breathing and its rate', () => {
    const rows = evaluate('check', 20, { fs: 60 }).filter((r) => ['normal', 'child'].includes(r.scenario));
    for (const r of rows) {
      expect(r.saidRegular).toBeGreaterThanOrEqual(0.9);
      expect(r.rateMae!).toBeLessThan(2);
    }
  });

  it('notices a hand on the phone', () => {
    for (let k = 0; k < 15; k++) expect(trial('hand', 9 + k, 'check', { fs: 60 }).status).toBe('moving');
  });

  it('finds an experimental heartbeat when the room is quiet', () => {
    const row = evaluate('lab', 15, { fs: 100 }).find((r) => r.scenario === 'normal')!;
    expect(row.heartFound!).toBeGreaterThanOrEqual(0.7);
    expect(row.heartMae!).toBeLessThan(5);
  });
});

// --- The full sweep, on request -------------------------------------------------------
const report = process.env.SENSOR_REPORT ? it : it.skip;

report(
  'writes reports/sensor-sim.json and docs/SENSOR_SIM.md',
  () => {
    const N = 60;
    const runs: { name: string; mode: 'check' | 'lab'; sensor: Record<string, number> }[] = [
      { name: 'Emergency check, 100/s (native app)', mode: 'check', sensor: { fs: 100 } },
      { name: 'Emergency check, 60/s (browser)', mode: 'check', sensor: { fs: 60 } },
      { name: 'Emergency check, 60/s, 2× sensor noise', mode: 'check', sensor: { fs: 60, noiseUg: 360 } },
      { name: 'Emergency check, 60/s, 4× sensor noise', mode: 'check', sensor: { fs: 60, noiseUg: 720 } },
      { name: 'Emergency check, 60/s, 8× sensor noise', mode: 'check', sensor: { fs: 60, noiseUg: 1440 } },
      { name: 'Lab, 100/s', mode: 'lab', sensor: { fs: 100 } },
      { name: 'Lab, 60/s', mode: 'lab', sensor: { fs: 60 } },
      { name: 'Lab, 100/s, sensor offset ≤ 0 mg', mode: 'lab', sensor: { fs: 100, biasMg: 0 } },
      { name: 'Lab, 100/s, sensor offset ≤ 5 mg', mode: 'lab', sensor: { fs: 100, biasMg: 5 } },
      { name: 'Lab, 100/s, sensor offset ≤ 40 mg', mode: 'lab', sensor: { fs: 100, biasMg: 40 } },
      { name: 'Lab, 100/s, heartbeat 3 mg', mode: 'lab', sensor: { fs: 100, scgMg: 3 } },
      { name: 'Lab, 100/s, heartbeat 30 mg', mode: 'lab', sensor: { fs: 100, scgMg: 30 } },
    ];
    const results = runs.map((run) => ({ ...run, rows: evaluate(run.mode, N, run.sensor, 1000) }));
    const out = { generated: new Date().toISOString(), trialsPerScenario: N, scenarios: SCENARIOS, runs: results };
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'sensor-sim.json'), JSON.stringify(out, null, 2) + '\n');

    const pct = (v: number | null) => (v === null ? '' : `${Math.round(v * 100)}%`);
    const md = [
      '# Breathing sensor: simulated bench results',
      '',
      `Generated by \`SENSOR_REPORT=1 npx jest sensors\` (mobile/__tests__/sensors.test.ts). ${N} simulated people per row, each with a different breathing pattern, body shape, heartbeat and sensor noise. **These are simulations, not measurements on people**; the model and its sources are in \`mobile/src/sensors/sim.ts\` and \`research/sensor-breathing.md\`.`,
      '',
      '"Called regular" must be 0% for **Not breathing**, **Not breathing, people walking**, **Gasping** and **Very slow**: anything else would be the phone telling a rescuer that someone who is not breathing normally is fine. Two rows can read "regular" by design. See-saw breathing moves the chest steadily, and the emergency check only reports movement and hands the judgment to the rescuer, because telling see-saw apart needs a calibrated sensor (compare the Lab rows with different sensor offsets). And with a hand on the phone of someone who *is* breathing, a very noisy sensor may miss the hand and see the breathing. "Start CPR" is the share where the app would say "No normal breathing seen. Start CPR."',
      '',
    ];
    for (const r of results) {
      md.push(`## ${r.name}`, '', '| Simulated person | Expected | Correct | Called regular | Start CPR | Rate error (/min) | Heartbeat found | Heart error (/min) |', '|---|---|---|---|---|---|---|---|');
      for (const row of r.rows) {
        md.push(`| ${row.label} | ${row.expect} | ${pct(row.correct)} | ${pct(row.saidRegular)} | ${pct(row.saidStartCpr)} | ${row.rateMae ?? ''} | ${pct(row.heartFound)} | ${row.heartMae ?? ''} |`);
      }
      md.push('');
    }
    fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'SENSOR_SIM.md'), md.join('\n'));
  },
  600_000,
);
