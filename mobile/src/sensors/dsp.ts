/**
 * Small signal-processing kit for the motion sensors: Butterworth filters,
 * zero-phase filtering, resampling and a few statistics. Pure functions on
 * plain arrays, so the phone, the simulator and the tests run the same code.
 *
 * Filters are second-order sections from the Audio EQ Cookbook (R. Bristow-
 * Johnson). A 4th-order Butterworth is two sections with Q 0.5412 and 1.3066.
 */

type Section = { b0: number; b1: number; b2: number; a1: number; a2: number };

const BUTTER4_Q = [0.5411961, 1.3065630];

function section(kind: 'low' | 'high', fc: number, fs: number, q: number): Section {
  const w = (2 * Math.PI * Math.min(fc, fs * 0.49)) / fs;
  const cos = Math.cos(w);
  const alpha = Math.sin(w) / (2 * q);
  const a0 = 1 + alpha;
  const b = kind === 'low' ? [(1 - cos) / 2, 1 - cos, (1 - cos) / 2] : [(1 + cos) / 2, -(1 + cos), (1 + cos) / 2];
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: (-2 * cos) / a0, a2: (1 - alpha) / a0 };
}

/** A 4th-order Butterworth low-pass or high-pass, as two sections. */
export function butter4(kind: 'low' | 'high', fc: number, fs: number): Section[] {
  return BUTTER4_Q.map((q) => section(kind, fc, fs, q));
}

function run(sections: Section[], x: ArrayLike<number>): Float64Array {
  let y = Float64Array.from(x);
  for (const s of sections) {
    const out = new Float64Array(y.length);
    // Start in steady state on the first sample, so a constant input gives no ringing.
    const x0 = y[0] ?? 0;
    const dc = (s.b0 + s.b1 + s.b2) / (1 + s.a1 + s.a2);
    let x1 = x0;
    let x2 = x0;
    let y1 = x0 * dc;
    let y2 = x0 * dc;
    for (let i = 0; i < y.length; i++) {
      const v = s.b0 * y[i] + s.b1 * x1 + s.b2 * x2 - s.a1 * y1 - s.a2 * y2;
      x2 = x1;
      x1 = y[i];
      y2 = y1;
      y1 = v;
      out[i] = v;
    }
    y = out;
  }
  return y;
}

/**
 * Zero-phase filtering: forward, then backward, so peaks stay where they
 * were in time. The ends are padded with the signal turned point-symmetric
 * about its average over the first (and last) `anchor` samples, so the
 * filter has something to settle on. Anchoring on one sample would hang the
 * edge on that sample's noise: a 0.07° blip became a 0.2° "breath".
 */
export function filtfilt(sections: Section[], x: ArrayLike<number>, padSamples = 0, anchor = 10): Float64Array {
  const n = x.length;
  if (n === 0) return new Float64Array(0);
  const pad = Math.max(0, Math.min(n - 1, padSamples));
  const k = Math.max(1, Math.min(anchor, Math.floor(n / 4)));
  const a0 = mean(x, 0, k);
  const a1 = mean(x, n - k, n);
  const ext = new Float64Array(n + 2 * pad);
  for (let i = 0; i < pad; i++) {
    ext[i] = 2 * a0 - x[pad - i];
    ext[n + pad + i] = 2 * a1 - x[n - 2 - i];
  }
  for (let i = 0; i < n; i++) ext[pad + i] = x[i];
  const fwd = run(sections, ext);
  fwd.reverse();
  const back = run(sections, fwd);
  back.reverse();
  return back.slice(pad, pad + n);
}

// Anchor the ends on a quarter of the shortest period the filter passes (low-pass) or a tenth of a second (high-pass).
export const lowpass = (x: ArrayLike<number>, fc: number, fs: number) => filtfilt(butter4('low', fc, fs), x, Math.round((3 * fs) / fc), Math.round(fs / (4 * fc)));
export const highpass = (x: ArrayLike<number>, fc: number, fs: number) => filtfilt(butter4('high', fc, fs), x, Math.round((3 * fs) / fc), Math.round(fs / 10));
export const bandpass = (x: ArrayLike<number>, lo: number, hi: number, fs: number) => lowpass(highpass(x, lo, fs), hi, fs);

/**
 * Put irregular samples on a regular clock by linear interpolation. Phone
 * sensors deliver samples a few milliseconds early or late, and sometimes
 * drop one; every filter here assumes a fixed rate.
 */
export function resample(t: ArrayLike<number>, x: ArrayLike<number>, fs: number, from = t[0], to = t[t.length - 1]): Float64Array {
  const n = Math.max(0, Math.floor((to - from) * fs) + 1);
  const out = new Float64Array(n);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const ti = from + i / fs;
    while (j < t.length - 2 && t[j + 1] < ti) j++;
    const span = t[j + 1] - t[j];
    const f = span > 0 ? Math.min(1, Math.max(0, (ti - t[j]) / span)) : 0;
    out[i] = x[j] + f * ((x[j + 1] ?? x[j]) - x[j]);
  }
  return out;
}

export function mean(x: ArrayLike<number>, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i];
  return to > from ? s / (to - from) : 0;
}

export function rms(x: ArrayLike<number>, from = 0, to = x.length): number {
  let s = 0;
  for (let i = from; i < to; i++) s += x[i] * x[i];
  return to > from ? Math.sqrt(s / (to - from)) : 0;
}

export function std(x: ArrayLike<number>, from = 0, to = x.length): number {
  const m = mean(x, from, to);
  let s = 0;
  for (let i = from; i < to; i++) s += (x[i] - m) ** 2;
  return to - from > 1 ? Math.sqrt(s / (to - from - 1)) : 0;
}

export function median(x: number[]): number {
  if (x.length === 0) return 0;
  const s = [...x].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Subtract the straight line that best fits the signal (slow drift goes). */
export function detrend(x: ArrayLike<number>): Float64Array {
  const n = x.length;
  const out = new Float64Array(n);
  if (n < 2) return Float64Array.from(x);
  const mx = (n - 1) / 2;
  const my = mean(x);
  let sxy = 0;
  let sxx = 0;
  for (let i = 0; i < n; i++) {
    sxy += (i - mx) * (x[i] - my);
    sxx += (i - mx) ** 2;
  }
  const slope = sxy / sxx;
  for (let i = 0; i < n; i++) out[i] = x[i] - my - slope * (i - mx);
  return out;
}

/**
 * Turning points with hysteresis: a peak only counts once the signal has
 * fallen from it by at least `prominence`, and a valley once it has risen by
 * that much. Noise smaller than `prominence` can never make a turning point,
 * which is what keeps a still chest from looking like breathing.
 */
export function extrema(x: ArrayLike<number>, prominence: number): { i: number; v: number; kind: 'max' | 'min' }[] {
  const out: { i: number; v: number; kind: 'max' | 'min' }[] = [];
  if (x.length < 3) return out;
  let hi = 0;
  let lo = 0;
  // Before the first turning point, a peak is only real if the signal also
  // rose to it; otherwise it is just where the window happened to start.
  let riseToHi = 0;
  let fallToLo = 0;
  let runMin = x[0];
  let runMax = x[0];
  let dir: 'up' | 'down' | null = null;
  for (let i = 1; i < x.length; i++) {
    if (x[i] > x[hi]) {
      hi = i;
      riseToHi = x[i] - runMin;
    }
    if (x[i] < x[lo]) {
      lo = i;
      fallToLo = runMax - x[i];
    }
    runMin = Math.min(runMin, x[i]);
    runMax = Math.max(runMax, x[i]);
    if (dir !== 'down' && x[hi] - x[i] >= prominence) {
      // Fell far enough from the high point: it was a peak.
      if (dir === 'up' || riseToHi >= prominence) out.push({ i: hi, v: x[hi], kind: 'max' });
      dir = 'down';
      lo = i;
    } else if (dir !== 'up' && x[i] - x[lo] >= prominence) {
      if (dir === 'down' || fallToLo >= prominence) out.push({ i: lo, v: x[lo], kind: 'min' });
      dir = 'up';
      hi = i;
    }
  }
  return out;
}

/** Seeded random numbers (mulberry32), so a simulated test can be replayed exactly. */
export function rng(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let spare: number | null = null;
  return {
    next,
    uniform: (lo: number, hi: number) => lo + (hi - lo) * next(),
    /** Standard normal (Box-Muller). */
    gauss: () => {
      if (spare !== null) {
        const s = spare;
        spare = null;
        return s;
      }
      const u = Math.max(next(), 1e-12);
      const v = next();
      const r = Math.sqrt(-2 * Math.log(u));
      spare = r * Math.sin(2 * Math.PI * v);
      return r * Math.cos(2 * Math.PI * v);
    },
  };
}
export type Rng = ReturnType<typeof rng>;
