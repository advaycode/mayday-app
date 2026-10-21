import { bandpass, lowpass, mean, median, std } from './dsp';

/**
 * EXPERIMENTAL. The heartbeat as a vibration of the chest wall.
 *
 * Each heartbeat shakes the chest by a few thousandths of g at 5 to 25 Hz
 * (seismocardiography). A phone lying still on the chest can feel it along
 * the axis that points out of the screen. Landreani et al. (EMBC 2016) did
 * this with an iPhone 6 at 100 samples a second on 9 supine volunteers and
 * found over 98% of beats against an ECG; we follow their steps:
 *
 *   band-pass 5-25 Hz  ->  rectify  ->  envelope  ->  how often it repeats
 *   (autocorrelation)  ->  individual beats, at least 60% of a beat apart
 *
 * Shown in the practice lab only, never in an emergency, and never used to
 * decide anything. Lay rescuers are taught not to check for a pulse; a
 * phone that "finds" a heartbeat in someone in cardiac arrest could cost
 * them their life.
 */
export type HeartReading = {
  status: 'found' | 'not-found' | 'moving' | 'slow-sensor';
  perMin: number | null;
  /** How strongly the vibration repeats at that rate, 0 to 1. */
  confidence: number;
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

export function analyzeHeart(z: ArrayLike<number>, fs: number, moving: boolean): HeartReading {
  const none: HeartReading = { status: 'not-found', perMin: null, confidence: 0, beats: [], intervalsMs: [], rmssdMs: null };
  if (fs < 50) return { ...none, status: 'slow-sensor' };
  if (moving) return { ...none, status: 'moving' };
  if (z.length < fs * 5) return none;

  const scg = bandpass(z, 5, Math.min(25, fs * 0.45), fs);
  const env = lowpass(Array.from(scg, Math.abs), 4, fs);
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
  const found = confidence >= MIN_CONFIDENCE && steady && even && covered;
  return { status: found ? 'found' : 'not-found', perMin: found ? perMin : null, confidence, beats, intervalsMs: intervals, rmssdMs: found ? rmssdMs : null };
}
