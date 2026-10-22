import fs from 'fs';
import path from 'path';

import { prepare } from '@/sensors/analyze';
import { rng } from '@/sensors/dsp';
import { simulate, type Scenario } from '@/sensors/sim';

/**
 * Exports simulated people for training the heartbeat model
 * (tools/heart_ml/train.py), so the model and the app share one simulator:
 *
 *   SIM_EXPORT=1 npx jest heartdata
 *
 * Each person is 60 s on the regular clock the app's analysis uses
 * (`prepare`): the out-of-screen acceleration and the three rotation rates,
 * with the true beat times. Written as raw float32 to data/sim/ (git-ignored).
 */
const run = process.env.SIM_EXPORT ? it : it.skip;

const PLAN: { scenario: Scenario; count: number }[] = [
  { scenario: 'normal', count: 120 },
  { scenario: 'shallow', count: 60 },
  { scenario: 'child', count: 60 },
  { scenario: 'slow', count: 40 },
  { scenario: 'seesaw', count: 40 },
  // No heartbeat: what the model must learn to stay quiet on.
  { scenario: 'none', count: 50 },
  { scenario: 'none_steps', count: 110 },
  { scenario: 'agonal', count: 40 },
];

run(
  'exports simulated people for the heartbeat model',
  () => {
    const out = path.join(__dirname, '..', '..', 'data', 'sim');
    fs.mkdirSync(out, { recursive: true });
    const r = rng(20261021);
    const index: object[] = [];
    let k = 0;
    for (const { scenario, count } of PLAN) {
      for (let j = 0; j < count; j++, k++) {
        const opts = {
          scenario,
          seconds: 60,
          seed: 1_000_000 + k,
          fs: r.next() < 0.5 ? 60 : 100,
          noiseUg: 180 * [1, 1, 2, 4][Math.floor(r.next() * 4)],
          gyroNoise: 0.007 * [1, 1, 2, 4][Math.floor(r.next() * 4)],
          scgMg: r.uniform(3, 30),
          gcgDps: r.uniform(0.3, 3),
          jitterMs: 2,
          dropRate: 0.01,
        };
        const { samples, truth } = simulate(opts);
        const p = prepare(samples)!;
        const n = p.z.length;
        const buf = new Float32Array(4 * n);
        buf.set(p.z, 0);
        p.rot!.forEach((c, i) => buf.set(c, (i + 1) * n));
        const file = `s${String(k).padStart(4, '0')}.f32`;
        fs.writeFileSync(path.join(out, file), Buffer.from(buf.buffer));
        // Beat times on the analysis clock (it starts at the first sample).
        index.push({ file, scenario, fs: p.fs, n, t0: p.t0, beats: truth.beats.map((b) => b - p.t0), heart: truth.heartPerMin, opts });
      }
    }
    fs.writeFileSync(path.join(out, 'index.json'), JSON.stringify(index));
  },
  1_800_000,
);
