import { G, prepare, type Sample } from './analyze';
import { bandpass, median, rms } from './dsp';

/**
 * Feeling chest compressions through the phone.
 *
 * Every compression moves whatever the phone is touching: the mattress or
 * couch the person lies on, the floor beside them, or the rescuer's own body
 * if the phone is in a pocket. Wherever it is, the motion repeats at the
 * compression rate, so the reading looks for one thing: a motion that
 * repeats 50 to 200 times a minute, clearly above the sensor's own noise.
 *
 *   accelerometer, 3 axes  ->  0.7-6 Hz (the compressions and their overtones)
 *   ->  the one direction it moves most (so it works lying any way up, or in a pocket)
 *   ->  how often it repeats (autocorrelation over the last 5 s)  ->  rate
 *
 * Depth is not measured: an accelerometer's depth estimate drifts, and a
 * phone that is not under the hands does not move as far as the chest. The
 * rate is what it can measure, and the rate is what the coach acts on.
 *
 * Basis: chest compression rate from accelerometers is standard in CPR
 * feedback devices; the published CPR recordings this was scored on are in
 * docs/CPR_SENSOR.md (CPRDAT, University of Graz, five real resuscitations).
 */
export type CompressionStatus = 'compressing' | 'still' | 'unsure';

export type CompressionReading = {
  status: CompressionStatus;
  /** Compressions a minute, when compressing. */
  perMin: number | null;
  /** How clearly the motion repeats, 0 to 1. */
  confidence: number;
  /** Size of the repeating motion, mg (RMS in 0.7-6 Hz, along its main direction). */
  sizeMg: number;
  /** What the sensor's own noise alone would show in the same band, mg. */
  noiseMg: number;
  /** Samples a second actually delivered. */
  rate: number;
  why: string;
};

/** Below this the repetition is too unclear to call. */
export const MIN_CONFIDENCE = 0.5;
/** The motion must be this many times the sensor's own noise. */
export const MIN_SNR = 4;
/** And at least this big: a phone reports in 1 mg steps. */
export const MIN_SIZE_MG = 1;
/** The last 1.5 s moving less than this share of the window's motion means compressions just stopped. */
const STOPPED_SHARE = 0.3;
const LO_HZ = 0.7;
const HI_HZ = 6;
const MIN_PER_MIN = 50;
const MAX_PER_MIN = 200;

/** The unit vector the band-passed motion follows most (largest eigenvector of its covariance). */
function mainDirection(b: Float64Array[]): [number, number, number] {
  const c = [0, 0, 0, 0, 0, 0, 0, 0, 0];
  const n = b[0].length;
  for (let i = 0; i < n; i++) {
    for (let r = 0; r < 3; r++) for (let k = 0; k < 3; k++) c[r * 3 + k] += b[r][i] * b[k][i];
  }
  let v: [number, number, number] = [0.3, 0.5, 0.8];
  for (let it = 0; it < 30; it++) {
    const w: [number, number, number] = [0, 1, 2].map((r) => c[r * 3] * v[0] + c[r * 3 + 1] * v[1] + c[r * 3 + 2] * v[2]) as [number, number, number];
    const len = Math.hypot(...w) || 1;
    v = w.map((x) => x / len) as [number, number, number];
  }
  return v;
}

export function readCompressions(samples: Sample[], window = 5): CompressionReading | null {
  const p = prepare(samples);
  if (!p) return null;
  const fs = p.fs;
  const n = p.z.length;
  const win = Math.min(n, Math.round(window * fs));
  // Filter with a little of what came before, so the window's start is settled.
  const ctx = Math.max(0, n - win - Math.round(2 * fs));
  const hi = Math.min(HI_HZ, fs * 0.4);
  const axes = [p.x, p.y, p.z].map((a) => bandpass(a.slice(ctx), LO_HZ, hi, fs).slice(n - win - ctx));
  const dir = mainDirection(axes);
  const s = Float64Array.from(axes[0], (_, i) => dir[0] * axes[0][i] + dir[1] * axes[1][i] + dir[2] * axes[2][i]);
  const sizeMg = (rms(s) / G) * 1000;

  // The sensor's noise, measured near the top of its range (60-90% of the
  // highest frequency it can see) on all three axes, and scaled to one
  // direction and this band. Compressions on a soft surface reach a little
  // way up; that only makes the noise read high, which is the cautious side.
  const nyq = fs / 2;
  const floors: number[] = [];
  const step = Math.max(1, Math.round(fs));
  const hiBand = [p.x, p.y, p.z].map((a) => bandpass(a.slice(n - win), 0.6 * nyq, 0.9 * nyq, fs));
  for (let i = 0; i + step <= win; i += Math.round(step / 2)) floors.push(Math.sqrt(hiBand.reduce((t, b) => t + rms(b, i, i + step) ** 2, 0) / 3));
  const noiseMg = floors.length ? ((median(floors) / G) * 1000 * Math.sqrt((hi - LO_HZ) / (0.3 * nyq))) : 0;

  // How often it repeats.
  const minLag = Math.round((60 / MAX_PER_MIN) * fs);
  const maxLag = Math.min(win - 1, Math.round((60 / MIN_PER_MIN) * fs));
  let e0 = 0;
  for (let i = 0; i < win; i++) e0 += s[i] * s[i];
  const r = new Float64Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1 && lag < win; lag++) {
    let t = 0;
    for (let i = 0; i + lag < win; i++) t += s[i] * s[i + lag];
    r[lag] = e0 > 0 ? (t / e0) * (win / (win - lag)) : 0;
  }
  let best = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) if (r[lag] > r[best]) best = lag;
  // A rhythm also repeats at twice its period: take the shortest lag that is nearly as strong.
  let lag = best;
  for (let l = minLag + 1; l < best; l++) {
    if (r[l] >= 0.85 * r[best] && r[l] >= r[l - 1] && r[l] >= r[l + 1]) {
      lag = l;
      break;
    }
  }
  // Between samples: fit a parabola through the peak and its neighbours.
  const a = r[lag - 1] ?? r[lag];
  const c = r[lag + 1] ?? r[lag];
  const den = a - 2 * r[lag] + c;
  const exact = den < 0 ? lag + (0.5 * (a - c)) / den : lag;
  const confidence = Math.max(0, Math.min(1, r[lag]));
  const perMin = (60 * fs) / exact;

  const base = { confidence, sizeMg, noiseMg, rate: fs };
  if (sizeMg < MIN_SIZE_MG || sizeMg < MIN_SNR * noiseMg) {
    return { ...base, status: 'still', perMin: null, why: `Motion ${sizeMg.toFixed(1)} mg, under ${Math.max(MIN_SIZE_MG, MIN_SNR * noiseMg).toFixed(1)} mg` };
  }
  // The window is 5 s, so it still holds compressions for a while after they
  // stop. The last 1.5 s says whether they are still going.
  const recent = rms(s, win - Math.round(1.5 * fs), win) / (rms(s) || 1);
  if (recent < STOPPED_SHARE) {
    return { ...base, status: 'still', perMin: null, why: `Stopped: the last 1.5 s moved ${Math.round(recent * 100)}% as much` };
  }
  if (confidence < MIN_CONFIDENCE) {
    return { ...base, status: 'unsure', perMin: null, why: `Moving, but not in a steady rhythm (${Math.round(confidence * 100)}%)` };
  }
  return { ...base, status: 'compressing', perMin, why: `${Math.round(perMin)} a minute, ${Math.round(confidence * 100)}% steady` };
}
