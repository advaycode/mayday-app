import { MODEL_FS, NETS, features, pickBeats, runNet } from './beatnet';
import { bandpass, lowpass, mean, median, std } from './dsp';

/**
 * EXPERIMENTAL. The heartbeat as a vibration, and a twist, of the chest wall.
 *
 * Each heartbeat shakes the chest by a few thousandths of g at 5 to 25 Hz
 * (seismocardiography, SCG) and turns it by a fraction of a degree
 * (gyrocardiography, GCG). A phone lying still on the chest can feel both:
 * the accelerometer along the axis out of the screen, the gyroscope about all
 * three. Landreani et al. (EMBC 2016) found over 98% of beats with an iPhone
 * 6's accelerometer; Cinotti et al. (Sensors 2025) found the phone's
 * gyroscope better than its accelerometer (sensitivity 97% against 89%). We
 * follow their steps on each:
 *
 *   band-pass 5-25 Hz  ->  rectify  ->  envelope  ->  how often it repeats
 *   (autocorrelation)  ->  individual beats, at least 60% of a beat apart
 *
 * and keep whichever of vibration, rotation or both repeats most clearly.
 *
 * Those are the rules. By default the lab uses BeatNet instead (beatnet.ts),
 * a small model that learned the shape of a beat from real recordings and
 * passes its beats through the same checks; the rules remain the fallback
 * and the yardstick it is scored against (docs/HEART_MODEL.md).
 *
 * Shown in the practice lab only, never in an emergency, and never used to
 * decide anything. Lay rescuers are taught not to check for a pulse; a
 * phone that "finds" a heartbeat in someone in cardiac arrest could cost
 * them their life.
 */
export type HeartSource = 'vibration' | 'rotation' | 'both';

export type HeartReading = {
  status: 'found' | 'not-found' | 'moving' | 'slow-sensor';
  perMin: number | null;
  /** How strongly the beat repeats at that rate, 0 to 1. */
  confidence: number;
  /** Which signal the reading came from. */
  source: HeartSource | null;
  /** The trained model, or the hand-written rules. */
  method: 'model' | 'rules';
  /** The model's beat probability, 50 values a second (model only), for the screen. */
  trace?: number[];
  /** Beat times, seconds before now. */
  beats: number[];
  /** Beat-to-beat intervals, ms: how the rhythm varies. */
  intervalsMs: number[];
  /** Root mean square of successive differences, ms: a standard measure of that variation. */
  rmssdMs: number | null;
};

const MIN_BPM = 40;
const MAX_BPM = 180;
const MIN_CONFIDENCE = 0.45;

/** Band-pass each channel to the heart's band, combine, rectify and smooth. */
export function envelopeOf(channels: ArrayLike<number>[], fs: number): Float64Array {
  const bands = channels.map((c) => bandpass(c, 5, Math.min(25, fs * 0.45), fs));
  const n = bands[0].length;
  const mag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (const b of bands) s += b[i] * b[i];
    mag[i] = Math.sqrt(s);
  }
  return lowpass(mag, 4, fs);
}

/** Heart rate and beats from an envelope (any source). */
export function fromEnvelope(env: Float64Array, fs: number, source: HeartSource): HeartReading {
  const none: HeartReading = { status: 'not-found', perMin: null, confidence: 0, source, method: 'rules', beats: [], intervalsMs: [], rmssdMs: null };
  const m = mean(env);
  const e = Array.from(env, (v) => v - m);
  const n = e.length;
  let e0 = 0;
  for (let i = 0; i < n; i++) e0 += e[i] * e[i];
  if (e0 === 0) return none;

  // Autocorrelation over the lags a heartbeat can have.
  const minLag = Math.round((60 / MAX_BPM) * fs);
  const maxLag = Math.min(n - 1, Math.round((60 / MIN_BPM) * fs));
  const r: number[] = [];
  for (let lag = 0; lag <= maxLag; lag++) {
    let s = 0;
    for (let i = 0; i + lag < n; i++) s += e[i] * e[i + lag];
    // Unbiased: longer lags overlap less, so scale back up.
    r.push((s / e0) * (n / (n - lag)));
  }
  let best = minLag;
  for (let lag = minLag; lag <= maxLag; lag++) if (r[lag] > r[best]) best = lag;
  // A beat repeats at its period and at every multiple of it: take the shortest lag that is nearly as strong.
  let lag = best;
  for (let l = minLag + 1; l < best; l++) {
    if (r[l] >= 0.8 * r[best] && r[l] >= r[l - 1] && r[l] >= r[l + 1]) {
      lag = l;
      break;
    }
  }
  const confidence = Math.max(0, Math.min(1, r[lag]));

  // Beats: the strongest envelope peaks, never closer than 60% of a beat.
  const cand: { i: number; v: number }[] = [];
  for (let i = 1; i < n - 1; i++) if (env[i] > env[i - 1] && env[i] >= env[i + 1]) cand.push({ i, v: env[i] });
  cand.sort((a, b) => b.v - a.v);
  const top = cand.slice(0, Math.max(1, Math.round(n / lag)));
  const floor = 0.5 * mean(top.map((c) => c.v));
  const gap = 0.6 * lag;
  const kept: number[] = [];
  for (const c of cand) {
    if (c.v < floor) break;
    if (kept.every((k) => Math.abs(k - c.i) >= gap)) kept.push(c.i);
  }
  kept.sort((a, b) => a - b);
  return beatsReading(kept, env, n, fs, lag, confidence, source);
}

/** Intervals, rate, variation and the checks a real heartbeat passes, from beat positions. */
export function beatsReading(kept: number[], env: ArrayLike<number>, n: number, fs: number, lag: number, confidence: number, source: HeartSource): HeartReading {
  const intervals: number[] = [];
  for (let k = 1; k < kept.length; k++) {
    const d = kept[k] - kept[k - 1];
    if (d >= 0.7 * lag && d <= 1.3 * lag) intervals.push((d / fs) * 1000);
  }
  const diffs = intervals.slice(1).map((v, k) => v - intervals[k]);
  const rmssdMs = diffs.length >= 2 ? Math.sqrt(mean(diffs.map((d) => d * d))) : null;
  const perMin = intervals.length ? 60000 / median(intervals) : (60 * fs) / lag;
  const beats = kept.map((i) => (i - n) / fs);

  // A heart keeps time and hits about as hard every beat. Footsteps come in
  // bursts and vary in strength: one more way to tell them apart.
  const steady = intervals.length >= 4 && std(intervals) / mean(intervals) < 0.15;
  const heights = kept.map((i) => env[i]);
  const even = heights.length >= 4 && std(heights) / mean(heights) < 0.4;
  const covered = kept.length >= 0.6 * (n / lag);
  // A heart does not stop for a second; people walking past do, between bouts.
  const edges = [kept[0] ?? n, ...kept.slice(1).map((v, k) => v - kept[k]), n - (kept[kept.length - 1] ?? 0)];
  const unbroken = Math.max(...edges) <= 2.5 * lag;
  const found = confidence >= MIN_CONFIDENCE && steady && even && covered && unbroken;
  return { status: found ? 'found' : 'not-found', perMin: found ? perMin : null, confidence, source, method: 'rules', beats, intervalsMs: intervals, rmssdMs: found ? rmssdMs : null };
}

/**
 * BeatNet's reading: the probability of a beat at every moment, its peaks as
 * beats, and the same checks the rules use. The gyroscope model when there
 * is a gyroscope, the accelerometer model when not.
 */
export function modelHeart(z: ArrayLike<number>, fs: number, rot: ArrayLike<number>[] | null): HeartReading & { prob: Float64Array } {
  const net = rot ? NETS.both : NETS.vibration;
  const prob = runNet(net, features(z, rot, fs));
  const kept = pickBeats(net, prob);
  const gaps = kept.slice(1).map((v, k) => v - kept[k]);
  const lag = gaps.length ? median(gaps) : MODEL_FS;
  const confidence = kept.length ? mean(kept.map((i) => prob[i])) : 0;
  return { ...beatsReading(kept, prob, prob.length, MODEL_FS, lag, confidence, rot ? 'both' : 'vibration'), method: 'model', prob };
}

/**
 * The heartbeat from the accelerometer's out-of-screen axis and, if there is
 * one, the gyroscope (degrees a second, any axis order). `method` picks the
 * model (default) or the rules.
 */
export function analyzeHeart(z: ArrayLike<number>, fs: number, moving: boolean, rot: ArrayLike<number>[] | null = null, method: 'model' | 'rules' = 'model'): HeartReading {
  const none: HeartReading = { status: 'not-found', perMin: null, confidence: 0, source: null, method, beats: [], intervalsMs: [], rmssdMs: null };
  if (fs < 50) return { ...none, status: 'slow-sensor' };
  if (moving) return { ...none, status: 'moving' };
  if (z.length < fs * 5) return none;
  if (method === 'model') {
    const { prob, ...reading } = modelHeart(z, fs, rot);
    return { ...reading, trace: Array.from(prob).filter((_, i) => i % 2 === 0) };
  }

  const vib = envelopeOf([z], fs);
  const tries: HeartReading[] = [fromEnvelope(vib, fs, 'vibration')];
  if (rot) {
    const turn = envelopeOf(rot, fs);
    tries.push(fromEnvelope(turn, fs, 'rotation'));
    // Both, each scaled by its own typical level so neither drowns the other.
    const mv = median(Array.from(vib)) || 1;
    const mt = median(Array.from(turn)) || 1;
    tries.push(fromEnvelope(Float64Array.from(vib, (v, i) => v / mv + turn[i] / mt), fs, 'both'));
  }
  const found = tries.filter((h) => h.status === 'found');
  return (found.length ? found : tries).reduce((a, b) => (b.confidence > a.confidence ? b : a));
}
