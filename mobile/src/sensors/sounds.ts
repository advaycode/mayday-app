import { mean, median, std } from './dsp';

/**
 * Hearing gasps.
 *
 * Gasping (agonal breathing) is the commonest reason bystanders do not start
 * CPR: it looks and sounds like breathing. It is also loud. Chan et al.
 * (npj Digital Medicine 2019) trained a model on 911 calls and heard agonal
 * breaths with 97% sensitivity; their recordings are not public, so this is
 * not that model. It is a small set of rules a person can check, listening
 * during the 10-second breathing check for the one thing a gasp is:
 *
 *   one loud burst      10 dB or more over the room, 0.2 to 2 s long,
 *                       one or two swells (a gasp in, maybe out), not the
 *                       several syllables of speech
 *   with quiet around   2 s or more of quiet before or after it: a gasp,
 *                       then nothing
 *   and no rhythm       three or more evenly spaced bursts are loud regular
 *                       breathing or snoring, and are not called gasps
 *   and nobody talking  if anyone speaks during the check (several
 *                       syllables), nothing in it is called a gasp: single
 *                       words look like single bursts
 *
 * What it hears can only add to a "not normal" answer. Hearing nothing says
 * nothing (quiet breathing is silent from a phone on the chest), and it never
 * overrules the chest's movement. Our own voice is skipped: frames are marked
 * while the app is speaking, and 0.3 s after.
 *
 * Frames come from the microphone (mic.ts, about 50 a second) or, in tests
 * and the report, from recordings (`framesFromPcm`).
 */
export type SoundFrame = {
  /** Seconds, any clock. */
  t: number;
  /** Energy in 100-4000 Hz, dB (full scale or any fixed reference). */
  db: number;
  /** Spectral flatness in that band, 0 (a pure tone) to 1 (white noise). */
  flatness: number;
  /** The app was speaking when this frame was captured. */
  own?: boolean;
};

export type SoundEvent = { start: number; end: number; peakDb: number; swells: number; flatness: number; kind: 'gasp' | 'speech' | 'long' };

export type SoundReading = {
  status: 'gasps' | 'regular' | 'talking' | 'quiet' | 'unavailable';
  events: SoundEvent[];
  /** Room level, dB (20th percentile of the frames). */
  floorDb: number;
  why: string;
};

export const BAND_LO = 100;
export const BAND_HI = 4000;
/** A burst is this many dB over the room. */
export const RISE_DB = 10;
const MIN_S = 0.2;
const MAX_S = 2;
const QUIET_S = 2;
const OWN_TAIL_S = 0.3;
/** A dip this deep between two peaks separates two swells (syllables). */
const DIP_DB = 6;
/** Loud frames this close together are one burst (speech pauses between words are often longer than 0.15 s). */
const JOIN_S = 0.35;

/** Energy and flatness of the 100-4000 Hz band, from a power spectrum (linear power per bin). */
export function frameFeatures(power: ArrayLike<number>, binHz: number): { db: number; flatness: number } {
  const lo = Math.max(1, Math.ceil(BAND_LO / binHz));
  const hi = Math.min(power.length - 1, Math.floor(BAND_HI / binHz));
  let sum = 0;
  let logSum = 0;
  let k = 0;
  for (let i = lo; i <= hi; i++) {
    const p = Math.max(power[i], 1e-20);
    sum += p;
    logSum += Math.log(p);
    k++;
  }
  if (!k) return { db: -120, flatness: 0 };
  const flatness = Math.exp(logSum / k) / (sum / k);
  return { db: 10 * Math.log10(sum + 1e-20), flatness };
}

/** In-place radix-2 FFT (re, im of length 2^m). */
function fft(re: Float64Array, im: Float64Array) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [re[i], re[j]] = [re[j], re[i]];
      [im[i], im[j]] = [im[j], im[i]];
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (-2 * Math.PI) / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(ang * k);
        const wi = Math.sin(ang * k);
        const ar = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const ai = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k + len / 2] = re[i + k] - ar;
        im[i + k + len / 2] = im[i + k] - ai;
        re[i + k] += ar;
        im[i + k] += ai;
      }
    }
  }
}

/** Frames from a recording (mono, -1..1), 1024-sample Hann windows every 20 ms, as the microphone path makes them. */
export function framesFromPcm(pcm: ArrayLike<number>, rate: number, size = 1024): SoundFrame[] {
  const hop = Math.round(rate * 0.02);
  const win = Float64Array.from({ length: size }, (_, i) => 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1)));
  const out: SoundFrame[] = [];
  for (let s = 0; s + size <= pcm.length; s += hop) {
    const re = new Float64Array(size);
    const im = new Float64Array(size);
    for (let i = 0; i < size; i++) re[i] = pcm[s + i] * win[i];
    fft(re, im);
    const power = new Float64Array(size / 2);
    for (let i = 0; i < size / 2; i++) power[i] = (re[i] * re[i] + im[i] * im[i]) / size;
    out.push({ t: (s + size / 2) / rate, ...frameFeatures(power, rate / size) });
  }
  return out;
}

/** How many swells (separate peaks with a 6 dB dip between) a burst has. */
function swells(db: number[]): number {
  let count = 0;
  let peak = -Infinity;
  let rising = true;
  for (const v of db) {
    if (rising) {
      if (v > peak) peak = v;
      else if (v < peak - DIP_DB) {
        count++;
        rising = false;
        peak = v;
      }
    } else if (v < peak) peak = v;
    else if (v > peak + DIP_DB) {
      rising = true;
      peak = v;
    }
  }
  return count + (rising ? 1 : 0);
}

export function hearBreathing(frames: SoundFrame[]): SoundReading {
  if (frames.length < 25) return { status: 'unavailable', events: [], floorDb: 0, why: 'No sound' };
  // Skip our own voice, and a moment after it.
  let ownUntil = -Infinity;
  const usable = frames.filter((f) => {
    if (f.own) ownUntil = f.t + OWN_TAIL_S;
    return !f.own && f.t > ownUntil;
  });
  if (usable.length < 25) return { status: 'unavailable', events: [], floorDb: 0, why: 'Only our own voice' };
  const sorted = usable.map((f) => f.db).sort((a, b) => a - b);
  const floorDb = sorted[Math.floor(0.2 * sorted.length)];
  const dt = median(usable.slice(1).map((f, i) => f.t - usable[i].t));

  // Bursts: runs of loud frames, joined across short gaps.
  const events: SoundEvent[] = [];
  let run: SoundFrame[] = [];
  const close = () => {
    if (!run.length) return;
    const start = run[0].t - dt / 2;
    const end = run[run.length - 1].t + dt / 2;
    const span = usable.filter((f) => f.t >= run[0].t && f.t <= run[run.length - 1].t);
    const n = swells(span.map((f) => f.db));
    const d = end - start;
    events.push({
      start,
      end,
      peakDb: Math.max(...run.map((f) => f.db)) - floorDb,
      swells: n,
      flatness: mean(run.map((f) => f.flatness)),
      kind: d > MAX_S ? 'long' : n >= 3 ? 'speech' : 'gasp',
    });
    run = [];
  };
  for (const f of usable) {
    if (f.db >= floorDb + RISE_DB) {
      if (run.length && f.t - run[run.length - 1].t > JOIN_S) close();
      run.push(f);
    }
  }
  close();
  const bursts = events.filter((e) => e.end - e.start >= MIN_S);
  const t0 = usable[0].t;
  const t1 = usable[usable.length - 1].t;
  const gasps = bursts.filter((e) => e.kind === 'gasp');
  const quietAround = (e: SoundEvent) => {
    const before = Math.min(e.start - t0, ...bursts.filter((o) => o.end <= e.start).map((o) => e.start - o.end));
    const after = Math.min(t1 - e.end, ...bursts.filter((o) => o.start >= e.end).map((o) => o.start - e.end));
    return before >= QUIET_S || after >= QUIET_S;
  };

  if (bursts.some((e) => e.kind !== 'gasp')) return { status: 'talking', events: bursts, floorDb, why: 'Someone talking, or a long sound: not judged' };
  if (gasps.length >= 3) {
    const gaps = gasps.slice(1).map((e, i) => e.start - gasps[i].start);
    if (std(gaps) / mean(gaps) < 0.3) return { status: 'regular', events: bursts, floorDb, why: `${gasps.length} evenly spaced breath sounds: loud breathing or snoring` };
  }
  const isolated = gasps.filter(quietAround);
  if (isolated.length) {
    const e = isolated[0];
    return { status: 'gasps', events: bursts, floorDb, why: `${isolated.length} gasp${isolated.length > 1 ? 's' : ''}: a loud burst (${Math.round(e.peakDb)} dB over the room, ${(e.end - e.start).toFixed(1)} s) with quiet around it` };
  }
  return { status: 'quiet', events: bursts, floorDb, why: bursts.length ? 'Sounds, but none like a gasp' : 'Nothing over the room' };
}
