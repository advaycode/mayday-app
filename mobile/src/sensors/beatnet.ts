import { bandpass, mean, resample } from './dsp';
import both from './beatnet-both.json';
import vibration from './beatnet-vibration.json';

/**
 * BeatNet: the heartbeat model, run on the phone in plain TypeScript.
 *
 * A small neural network (four dilated 1-D convolutions, about 4,000
 * numbers) that looks at 1.2 s of chest movement around every moment and
 * gives the probability that a heartbeat is there. Trained in
 * tools/heart_ml/train.py:
 *
 *   vibration  the accelerometer alone, trained on real recordings
 *              (PhysioNet CEBS: 20 people, 18 hours, 76,945 beats
 *              annotated from the ECG) and about 40% beat-free windows
 *   both       accelerometer and gyroscope: the same real recordings with a
 *              gyroscope that feels nothing but its own noise, plus
 *              simulated people whose gyroscope feels the heart's twist (no
 *              open dataset has a phone-style gyroscope on the chest)
 *
 * Scores, and a fault found in the CEBS database: docs/HEART_MODEL.md.
 *
 * It learns the shape of a beat, not just its rhythm: each beat is a pair of
 * vibrations a third of a second apart (the two heart sounds); a footstep is
 * one thud. The input preparation below must match tools/heart_ml/dsp.py
 * exactly; __tests__/beatnet.test.ts checks it against the trained model's
 * own output.
 */
export type Layer = { in: number; out: number; k: number; dilation: number; relu: boolean; w: number[]; b: number[] };
export type Net = { name: string; inputs: string[]; fs: number; threshold: number; minGapS: number; params: number; trainedOn: string; layers: Layer[] };

export const NETS = { vibration: vibration as unknown as Net, both: both as unknown as Net };
export const MODEL_FS = 100;

/** Onto the model's 100 samples a second, by straight lines between samples. */
export function toModelRate(x: ArrayLike<number>, fs: number): Float64Array {
  if (fs === MODEL_FS) return Float64Array.from(x);
  const t = Array.from({ length: x.length }, (_, i) => i / fs);
  return resample(t, x, MODEL_FS);
}

/**
 * The model's input: the out-of-screen acceleration in the heart's 5-25 Hz
 * band, and (with a gyroscope) the size of the rotation in the same band,
 * each divided by its own mean size so the model sees shape, not strength.
 */
export function features(z: ArrayLike<number>, rot: ArrayLike<number>[] | null, fs: number): Float64Array[] {
  const bz = bandpass(toModelRate(z, fs), 5, 25, MODEL_FS);
  const sz = mean(Array.from(bz, Math.abs)) + 1e-9;
  const chans = [Float64Array.from(bz, (v) => v / sz)];
  if (rot) {
    const br = rot.map((c) => bandpass(toModelRate(c, fs), 5, 25, MODEL_FS));
    const n = Math.min(bz.length, ...br.map((c) => c.length));
    const m = new Float64Array(n);
    for (let i = 0; i < n; i++) m[i] = Math.sqrt(br.reduce((s, c) => s + c[i] * c[i], 0));
    const sm = mean(m) + 1e-9;
    chans.push(Float64Array.from(m, (v) => v / sm));
  }
  return chans;
}

/** Run the network: zero-padded "same" convolutions, ReLU between, a sigmoid at the end. */
export function runNet(net: Net, input: Float64Array[]): Float64Array {
  let x = input;
  const n = x[0].length;
  for (const L of net.layers) {
    const pad = (L.dilation * (L.k - 1)) / 2;
    const y: Float64Array[] = [];
    for (let o = 0; o < L.out; o++) {
      const out = new Float64Array(n).fill(L.b[o]);
      for (let c = 0; c < L.in; c++) {
        const xc = x[c];
        const base = (o * L.in + c) * L.k;
        for (let j = 0; j < L.k; j++) {
          const w = L.w[base + j];
          const shift = j * L.dilation - pad;
          const lo = Math.max(0, -shift);
          const hi = Math.min(n, n - shift);
          for (let i = lo; i < hi; i++) out[i] += w * xc[i + shift];
        }
      }
      if (L.relu) for (let i = 0; i < n; i++) if (out[i] < 0) out[i] = 0;
      y.push(out);
    }
    x = y;
  }
  return Float64Array.from(x[0], (v) => 1 / (1 + Math.exp(-v)));
}

/** Beat positions (samples at 100/s): peaks over the threshold, the strongest first, never closer than minGapS. */
export function pickBeats(net: Net, prob: Float64Array): number[] {
  const cand: { i: number; v: number }[] = [];
  for (let i = 1; i < prob.length - 1; i++) {
    if (prob[i] > net.threshold && prob[i] > prob[i - 1] && prob[i] >= prob[i + 1]) cand.push({ i, v: prob[i] });
  }
  cand.sort((a, b) => b.v - a.v);
  const gap = Math.round(net.minGapS * MODEL_FS);
  const kept: number[] = [];
  for (const c of cand) if (kept.every((k) => Math.abs(k - c.i) >= gap)) kept.push(c.i);
  return kept.sort((a, b) => a - b);
}
