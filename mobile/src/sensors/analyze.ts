import { bandpass, detrend, extrema, lowpass, mean, median, resample, rms, std } from './dsp';
import { analyzeHeart, type HeartReading } from './heart';

/**
 * Reading breathing from the phone's tilt.
 *
 * The phone lies on its back on the person's torso, top end on the chest,
 * bottom end on the belly. Breathing lifts the two ends by different amounts
 * (supine, the belly moves about twice as much as the chest), so the phone
 * tips back and forth by a degree or two with every breath. The accelerometer
 * sees that as gravity moving between its long axis and its face, the same
 * way the iPhone's Level works, and we read the angle to a hundredth of a
 * degree.
 *
 *   pitch = atan2(y, z)     head-to-foot tilt (the breathing signal)
 *   roll  = atan2(x, z)     side-to-side tilt
 *
 * With a gyroscope the tilt gets better. The gyroscope measures how fast the
 * phone turns; added up over time that is the change in angle, with far less
 * noise than the accelerometer at breathing speeds, but it drifts. So the two
 * are blended (a complementary filter): the accelerometer for slow changes
 * below 0.08 Hz, the gyroscope above. Platforms disagree on which rotation
 * axis is which (even Expo's own docs contradict each other), so the phone
 * works out its own: whichever gyroscope channel moves with the level's
 * pitch is pitch (`alignGyro`).
 *
 * Published basis: Landreani et al. (CinC 2017) put iPhones on the sternum
 * and on the belly of supine volunteers and recovered breathing rate from the
 * longitudinal (Y) axis within 2%, after a 0.5 Hz low-pass. See
 * research/sensor-breathing.md.
 *
 * One rule matters more than any number here: this reading may tell the
 * rescuer "no normal breathing seen" (start CPR), but it never answers "yes,
 * breathing normally" for them. See `suggestAnswer`.
 */

export const G = 9.80665;

/**
 * One reading in the phone's own frame: acceleration with gravity (m/s²) and,
 * if there is a gyroscope, its rotation rates (degrees a second), in whatever
 * order the platform reports them.
 */
export type Sample = { t: number; x: number; y: number; z: number; rot?: [number, number, number] };

export type GyroInfo = {
  /** True when a gyroscope channel was matched to the level's pitch. */
  locked: boolean;
  /** True when the blended tilt was quieter than the accelerometer's, so it was used. */
  blended: boolean;
  /** Which channel is pitch and roll, and how closely the pitch channel follows the level (0-1). */
  pitchAxis: number;
  rollAxis: number;
  match: number;
  /** Breathing-band noise of the accelerometer alone, degrees (compare Reading.noiseDeg). */
  accelNoiseDeg: number;
  /** Rotation shake at hand-tremor frequencies, degrees a second. */
  shakeDps: number;
};

export type AgeGroup = 'adult' | 'child' | 'infant';

export type BreathStatus = 'unknown' | 'moving' | 'none' | 'irregular' | 'seesaw' | 'regular';

export type BreathReading = {
  status: BreathStatus;
  /** Turning points found (peaks and valleys). */
  turns: number;
  perMin: number | null;
  /** Median peak-to-valley tilt per breath, degrees. */
  depthDeg: number | null;
  /** The same as a height difference between the two ends of the phone, mm (estimate). */
  depthMm: number | null;
  /** Share of the time the chest is not moving at all. Gasps are mostly stillness. */
  stillShare: number | null;
  /** Up-and-down motion of the phone per unit of tilt: about 1 when chest and belly rise together, near 0 when they see-saw. */
  sync: number | null;
  /** Times of breath peaks, seconds, for markers on the trace. */
  peaks: number[];
  /** Smallest tilt change that counts as a breath here, from the measured noise. */
  thresholdDeg: number;
  /** Why the status is what it is, for the engine panel. */
  why: string;
};

export type Reading = {
  /** Samples per second the sensor actually delivered. */
  rate: number;
  seconds: number;
  faceUp: boolean;
  /** Latest absolute angles, degrees. */
  pitch: number;
  roll: number;
  motion: { moving: boolean; tremorMg: number; noiseMg: number; bump: boolean; shakeDps: number };
  /** The breathing-band noise floor, degrees. */
  noiseDeg: number;
  /** Breathing tilt relative to the start of the window (filtered), for the trace. */
  trace: { t: number[]; deg: number[] };
  breath: BreathReading;
  heart: HeartReading | null;
  gyro: GyroInfo | null;
};

/** Distance between where the two ends of the phone rest, mm. A 150 mm phone, less its rounded corners. */
export const CONTACT_MM = 140;

/** Breathing rates that can count as regular, per minute. Wide on purpose: this is a plausibility band, not a diagnosis. */
const RATE_BAND: Record<AgeGroup, [number, number]> = { adult: [8, 30], child: [12, 40], infant: [20, 60] };

/** In-plane shake at tremor frequencies above this, and well above the sensor's own noise, means a hand is on the phone. */
const TREMOR_MG = 1.5;
/** A jolt bigger than this anywhere in the window spoils it. */
const BUMP_MG = 60;
/** Rotation shake at tremor frequencies above this, and well above the gyroscope's own noise, also means a hand. */
const SHAKE_DPS = 0.4;
/** Below this the accelerometer leads the blended tilt; above it, the gyroscope. */
const FUSE_HZ = 0.08;
/** Swings smaller than this share of the biggest one are wobbles within a breath, not breaths. */
const WOBBLE_SHARE = 0.25;

export function angles(s: { x: number; y: number; z: number }) {
  return { pitch: (Math.atan2(s.y, s.z) * 180) / Math.PI, roll: (Math.atan2(s.x, s.z) * 180) / Math.PI };
}

type Prepared = {
  fs: number;
  t0: number;
  x: Float64Array;
  y: Float64Array;
  z: Float64Array;
  pitch: Float64Array;
  roll: Float64Array;
  mag: Float64Array;
  rot: [Float64Array, Float64Array, Float64Array] | null;
};

/** Regular clock, gravity pointing out of the screen, angles and magnitude. */
export function prepare(samples: Sample[]): Prepared | null {
  if (samples.length < 20) return null;
  const t = samples.map((s) => s.t);
  const span = t[t.length - 1] - t[0];
  if (span < 1) return null;
  const fs = Math.min(100, Math.max(20, Math.round((samples.length - 1) / span)));
  // iOS and Android disagree on the sign of gravity. Lying face up, make it +z either way.
  const sign = mean(samples.map((s) => s.z)) < 0 ? -1 : 1;
  const x = resample(t, samples.map((s) => sign * s.x), fs);
  const y = resample(t, samples.map((s) => sign * s.y), fs);
  const z = resample(t, samples.map((s) => sign * s.z), fs);
  const n = z.length;
  const pitch = new Float64Array(n);
  const roll = new Float64Array(n);
  const mag = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    pitch[i] = (Math.atan2(y[i], z[i]) * 180) / Math.PI;
    roll[i] = (Math.atan2(x[i], z[i]) * 180) / Math.PI;
    mag[i] = Math.hypot(x[i], y[i], z[i]);
  }
  // The gyroscope, if most samples have it; a missing reading repeats the last one.
  let rot: Prepared['rot'] = null;
  const first = samples.find((s) => s.rot)?.rot;
  if (first && samples.filter((s) => s.rot).length >= 0.8 * samples.length) {
    let last = first;
    const filled = samples.map((s) => (last = s.rot ?? last));
    rot = [0, 1, 2].map((k) => resample(t, filled.map((r) => r[k]), fs)) as Prepared['rot'];
  }
  return { fs, t0: t[0], x, y, z, pitch, roll, mag, rot };
}

export type Alignment = { locked: boolean; pitchAxis: number; pitchSign: number; rollAxis: number; rollSign: number; scale: number; match: number };

/**
 * Which gyroscope channel is which. The level gives pitch and roll; their
 * rates of change must equal the gyroscope's rotation about those axes. So
 * correlate every channel with both, take the best match and its sign, and
 * its units (a slope near 57 means the platform sent radians a second).
 * Uses the whole buffer, which includes the phone being laid down, so there
 * is usually plenty of rotation to match. Locks only on a clear match.
 */
export function alignGyro(p: Prepared): Alignment | null {
  if (!p.rot) return null;
  const fs = p.fs;
  const rateOf = (x: Float64Array) => {
    const l = lowpass(x, 2, fs);
    const d = new Float64Array(l.length);
    for (let i = 1; i < l.length - 1; i++) d[i] = ((l[i + 1] - l[i - 1]) * fs) / 2;
    return d;
  };
  const dp = rateOf(p.pitch);
  const dr = rateOf(p.roll);
  const ch = p.rot.map((c) => lowpass(c, 2, fs));
  const edge = Math.min(Math.round(fs / 2), Math.floor(dp.length / 4));
  const fit = (target: Float64Array, skip: number) => {
    let best = { k: skip === 0 ? 1 : 0, corr: 0, gain: 1 };
    ch.forEach((c, k) => {
      if (k === skip) return;
      const mc = mean(c, edge, c.length - edge);
      const mt = mean(target, edge, target.length - edge);
      let sct = 0;
      let scc = 0;
      let stt = 0;
      for (let i = edge; i < c.length - edge; i++) {
        sct += (c[i] - mc) * (target[i] - mt);
        scc += (c[i] - mc) ** 2;
        stt += (target[i] - mt) ** 2;
      }
      const corr = scc > 0 && stt > 0 ? sct / Math.sqrt(scc * stt) : 0;
      if (Math.abs(corr) > Math.abs(best.corr)) best = { k, corr, gain: scc > 0 ? sct / scc : 1 };
    });
    return best;
  };
  const pf = fit(dp, -1);
  const rf = fit(dr, pf.k);
  return {
    locked: Math.abs(pf.corr) >= 0.6,
    pitchAxis: pf.k,
    pitchSign: Math.sign(pf.corr) || 1,
    rollAxis: rf.k,
    rollSign: Math.sign(rf.corr) || 1,
    scale: Math.abs(pf.gain) > 20 ? 180 / Math.PI : 1,
    match: Math.abs(pf.corr),
  };
}

/** Rotation rate (degrees a second) added up into an angle, then blended with the accelerometer's angle. */
function blend(acc: number[], rate: ArrayLike<number>, fs: number): number[] {
  const theta = new Float64Array(rate.length);
  for (let i = 1; i < rate.length; i++) theta[i] = theta[i - 1] + (rate[i - 1] + rate[i]) / (2 * fs);
  const slowAcc = lowpass(acc, FUSE_HZ, fs);
  const slowGyro = lowpass(theta, FUSE_HZ, fs);
  return acc.map((_, i) => slowAcc[i] + theta[i] - slowGyro[i]);
}

/**
 * A hand on the phone shakes it at 8 to 12 Hz (physiological tremor); a bump
 * is one big jolt. Breathing and the heart do neither in the phone's own
 * plane. Sensor noise is spread evenly over all frequencies, so the shake is
 * judged against the same sensor's noise at the top of its range (60-90% of
 * the highest frequency it can see), side to side, where neither a hand nor
 * a heartbeat reaches: a fixed threshold made a noisier phone look
 * permanently "held" (the simulator caught this at 4 times the noise), and
 * reference bands below the tremor picked up the hand's own sway.
 */
export function motionOf(p: Prepared, from: number, to: number, gyroScale = 1) {
  const hi = Math.min(12, p.fs * 0.45);
  const xs = p.x.slice(from, to);
  const ys = p.y.slice(from, to);
  const bx = bandpass(xs, 6, hi, p.fs);
  const by = bandpass(ys, 6, hi, p.fs);
  const nyq = p.fs / 2;
  const nx = bandpass(xs, 0.6 * nyq, 0.9 * nyq, p.fs);
  // Worst one-second stretch for the shake, so a short one is not averaged
  // away; the typical stretch for the noise.
  let worst = 0;
  const floors: number[] = [];
  const step = Math.max(1, Math.round(p.fs));
  for (let i = 0; i + step <= bx.length; i += Math.round(step / 2)) {
    worst = Math.max(worst, Math.hypot(rms(bx, i, i + step), rms(by, i, i + step)));
    floors.push(rms(nx, i, i + step));
  }
  const tremorMg = (worst / G) * 1000;
  // White noise on two axes in the 6-12 Hz band, from one axis's share near the top.
  const noiseMg = floors.length ? (median(floors) / G) * 1000 * Math.sqrt((2 * (hi - 6)) / (0.3 * nyq)) : 0;
  const m = median(Array.from(p.mag.slice(from, to)));
  let bump = false;
  for (let i = from; i < to; i++) if (Math.abs(p.mag[i] - m) > (BUMP_MG / 1000) * G) bump = true;
  const shaking = tremorMg > TREMOR_MG && tremorMg > 3 * noiseMg;

  // The gyroscope feels a hand as rotation shake, even when the accelerometer is too noisy to.
  let shakeDps = 0;
  let twisting = false;
  if (p.rot) {
    const part = (c: Float64Array) => Array.from(c.slice(from, to), (v) => v * gyroScale);
    const g = p.rot.map((c) => bandpass(part(c), 6, hi, p.fs));
    const gn = p.rot.map((c) => bandpass(part(c), 0.6 * nyq, 0.9 * nyq, p.fs));
    let worstG = 0;
    const floorsG: number[] = [];
    for (let i = 0; i + step <= g[0].length; i += Math.round(step / 2)) {
      worstG = Math.max(worstG, Math.hypot(...g.map((c) => rms(c, i, i + step))));
      floorsG.push(Math.hypot(...gn.map((c) => rms(c, i, i + step))));
    }
    shakeDps = worstG;
    const noiseDps = floorsG.length ? median(floorsG) * Math.sqrt((hi - 6) / (0.3 * nyq)) : 0;
    twisting = shakeDps > SHAKE_DPS && shakeDps > 4 * noiseDps;
  }
  return { moving: shaking || twisting || bump, tremorMg, noiseMg, bump, shakeDps };
}

/**
 * Analyse the last `window` seconds. `heart` adds the experimental heartbeat
 * reading over the last `heartWindow` seconds (needs 50+ samples a second).
 * `sync` adds the experimental chest-belly sync, which depends on the
 * accelerometer's offset (see `syncOf`); the emergency check leaves it off.
 */
export function analyze(
  samples: Sample[],
  opts: { age?: AgeGroup; window?: number; heart?: boolean; heartWindow?: number; sync?: boolean; heartMethod?: 'model' | 'rules' } = {},
): Reading | null {
  const p = prepare(samples);
  if (!p) return null;
  const age = opts.age ?? 'adult';
  const n = p.z.length;
  const win = Math.min(n, Math.round((opts.window ?? 10) * p.fs));
  const from = n - win;
  const seconds = win / p.fs;
  const last = Math.max(from, n - Math.round(p.fs / 2));
  const pitch = mean(p.pitch, last, n);
  const roll = mean(p.roll, last, n);
  const faceUp = mean(p.z, last, n) > 0.7 * G;
  const al = alignGyro(p);
  const motion = motionOf(p, from, n, al?.scale ?? 1);

  // --- Breathing band: below 1 Hz (1.5 for babies, who breathe faster) -------------------
  // Filter with up to 1.5 s of what came before the window, so its start is settled.
  const fc = age === 'infant' ? 1.5 : 1;
  const ctx = Math.max(0, from - Math.round(1.5 * p.fs));
  const accP = Array.from(p.pitch.slice(ctx));
  const accR = Array.from(p.roll.slice(ctx));
  // Noise floor: the tilt's wobble at 2-6 Hz (no breath and little heartbeat there),
  // as a density, scaled to the breathing band. Measured higher up it would read low:
  // putting jittery samples on a regular clock smooths the top of the spectrum.
  const accDensity = std(bandpass(accP, 2, 6, p.fs).slice(from - ctx)) / 2;
  const accelNoiseDeg = accDensity * Math.sqrt(fc);

  // With a matched gyroscope: blend. The blend's noise is the accelerometer's
  // below the crossover plus the gyroscope's, added up, above it (white rate
  // noise of density d becomes angle noise of d / 2πf). The heart's own twist
  // makes the gyroscope's noise read high, so this errs on the safe side; the
  // blend is used only when it comes out quieter than the accelerometer alone.
  let pw = accP;
  let rw = accR;
  let noiseDeg = accelNoiseDeg;
  let blended = false;
  if (al?.locked && p.rot) {
    const pr = Float64Array.from(p.rot[al.pitchAxis].slice(ctx), (v) => al.pitchSign * al.scale * v);
    const rr = Float64Array.from(p.rot[al.rollAxis].slice(ctx), (v) => al.rollSign * al.scale * v);
    const gyroDensity = std(bandpass(pr, 2, 6, p.fs).slice(from - ctx)) / 2;
    const blendNoise = Math.hypot(accDensity * Math.sqrt(FUSE_HZ), (gyroDensity / (2 * Math.PI)) * Math.sqrt(1 / FUSE_HZ - 1 / fc));
    if (blendNoise < accelNoiseDeg) {
      pw = blend(accP, pr, p.fs);
      rw = blend(accR, rr, p.fs);
      noiseDeg = blendNoise;
      blended = true;
    }
  }
  const pl = lowpass(pw, fc, p.fs).slice(from - ctx);
  const rl = lowpass(rw, fc, p.fs).slice(from - ctx);

  // The phone may lie along the body or across it: follow whichever way it tips most.
  const pd = detrend(pl);
  const rd = detrend(rl);
  let spp = 0;
  let srr = 0;
  let spr = 0;
  for (let i = 0; i < pd.length; i++) {
    spp += pd[i] * pd[i];
    srr += rd[i] * rd[i];
    spr += pd[i] * rd[i];
  }
  const angle = 0.5 * Math.atan2(2 * spr, spp - srr);
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const tilt = Array.from(pd, (v, i) => ca * v + sa * rd[i]);
  const alongBody = Math.abs(ca) > 0.8;

  const trace = { t: [] as number[], deg: [] as number[] };
  const every = Math.max(1, Math.round(p.fs / 20));
  for (let i = 0; i < tilt.length; i += every) {
    trace.t.push(i / p.fs - seconds);
    trace.deg.push(tilt[i]);
  }

  const breath = readBreathing(tilt, p, from, { age, noiseDeg, fc, seconds, motion, faceUp, alongBody: alongBody && !!opts.sync, sign: ca >= 0 ? 1 : -1 });
  const hw = Math.max(0, n - Math.round((opts.heartWindow ?? 10) * p.fs));
  const heartRot = p.rot && al ? p.rot.map((c) => Float64Array.from(c.slice(hw), (v) => v * al.scale)) : null;
  const heart = opts.heart ? analyzeHeart(p.z.slice(hw), p.fs, motion.moving, heartRot, opts.heartMethod ?? 'model') : null;
  const gyro: GyroInfo | null = al
    ? { locked: al.locked, blended, pitchAxis: al.pitchAxis, rollAxis: al.rollAxis, match: al.match, accelNoiseDeg, shakeDps: motion.shakeDps }
    : null;

  return { rate: p.fs, seconds, faceUp, pitch, roll, motion, noiseDeg, trace, breath, heart, gyro };
}

function readBreathing(
  tilt: number[],
  p: Prepared,
  from: number,
  c: { age: AgeGroup; noiseDeg: number; fc: number; seconds: number; motion: { moving: boolean; bump: boolean }; faceUp: boolean; alongBody: boolean; sign: number },
): BreathReading {
  const fs = p.fs;
  const thresholdDeg = Math.max(0.05, 8 * c.noiseDeg);
  const blank: BreathReading = { status: 'unknown', turns: 0, perMin: null, depthDeg: null, depthMm: null, stillShare: null, sync: null, peaks: [], thresholdDeg, why: '' };
  if (!c.faceUp) return { ...blank, why: 'The phone is not lying face up' };
  if (c.motion.moving) return { ...blank, status: 'moving', why: c.motion.bump ? 'The phone was bumped' : 'A hand is on the phone' };

  // Turning points over the noise; then again, ignoring wobbles under a
  // quarter of the biggest swing. Real breaths have notches and shoulders
  // (CEBS belts, docs/REAL_BREATHING.md) that were counted as extra breaths,
  // doubling the rate and making the timing look uneven. A gasp is one big
  // swing and stillness, so this leaves it as it is.
  let ext = extrema(tilt, thresholdDeg);
  if (ext.length >= 3) {
    const biggest = Math.max(...ext.slice(1).map((e, k) => Math.abs(e.v - ext[k].v)));
    ext = extrema(tilt, Math.max(thresholdDeg, WOBBLE_SHARE * biggest));
  }
  const turns = ext.length;
  const peaks = ext.filter((e) => e.kind === 'max').map((e) => e.i / fs - c.seconds);
  if (turns === 0) return { ...blank, status: 'none', why: `No chest movement over ${thresholdDeg.toFixed(2)}° in ${Math.round(c.seconds)} s` };

  // Depth: each swing from a peak to the next valley (or back).
  const swings = ext.slice(1).map((e, k) => Math.abs(e.v - ext[k].v));
  const depthDeg = swings.length ? median(swings) : Math.abs(ext[0].v);
  const depthMm = CONTACT_MM * Math.tan((depthDeg * Math.PI) / 180);

  // Rate from peak-to-peak and valley-to-valley times.
  const periods: number[] = [];
  for (const kind of ['max', 'min'] as const) {
    const at = ext.filter((e) => e.kind === kind).map((e) => e.i / fs);
    for (let k = 1; k < at.length; k++) periods.push(at[k] - at[k - 1]);
  }
  const period = periods.length ? median(periods) : null;
  const perMin = period ? 60 / period : null;

  // Gasps are a sharp heave and then stillness; breathing keeps moving.
  // "Still" means slower than 15% of the fastest movement, or than twice what
  // the sensor's noise alone would show (noise filtered to fc changes at about
  // 2π·fc/√3 times its size per second): noise must not make stillness look
  // like breathing.
  const slope = tilt.slice(1).map((v, i) => Math.abs(v - tilt[i]) * fs);
  const fast = [...slope].sort((a, b) => a - b)[Math.floor(slope.length * 0.95)] ?? 0;
  const noiseSlope = 2 * c.noiseDeg * ((2 * Math.PI * c.fc) / Math.sqrt(3));
  const stillBelow = Math.max(0.15 * fast, noiseSlope);
  const stillShare = fast > 0 ? slope.filter((s) => s < stillBelow).length / slope.length : 1;

  const [lo, hi] = RATE_BAND[c.age];
  const base = { ...blank, turns, perMin, depthDeg, depthMm, stillShare, peaks };
  if (turns < 3 || perMin === null) return { ...base, status: 'irregular', why: `Only ${turns} chest movement${turns === 1 ? '' : 's'} in ${Math.round(c.seconds)} s` };
  if (perMin < lo || perMin > hi) return { ...base, status: 'irregular', why: `${Math.round(perMin)} a minute, outside ${lo}–${hi}` };
  if (stillShare > 0.45) return { ...base, status: 'irregular', why: `Still ${Math.round(stillShare * 100)}% of the time, like gasps` };
  // Breathing keeps time and depth; gasps and noise do not.
  const cv = (v: number[]) => (v.length > 1 ? std(v) / mean(v) : 0);
  if (cv(periods) > 0.3) return { ...base, status: 'irregular', why: `Uneven timing (varies ${Math.round(cv(periods) * 100)}%)` };
  if (swings.length >= 2 && Math.max(...swings) > 3 * Math.min(...swings)) return { ...base, status: 'irregular', why: 'Uneven depth, like gasps' };

  const sync = c.alongBody ? syncOf(tilt, p, from, c.sign, period!) : null;
  if (sync !== null && Math.abs(sync) < 0.3) return { ...base, sync, status: 'seesaw', why: `Chest and belly move against each other (sync ${sync.toFixed(2)})` };
  return { ...base, sync, status: 'regular', why: `${Math.round(perMin)} a minute, steady` };
}

/**
 * Chest and belly together, or against each other?
 *
 * Tilt measures the difference between the two ends (belly minus chest).
 * The up-and-down acceleration of the whole phone measures their average.
 * When both rise together the average is about as big as the difference; in
 * see-saw breathing (the belly rises as the chest sinks, a sign of a blocked
 * airway) the average nearly cancels. The size of the gravity vector does
 * not change when the phone tips, so |a| - g is pure up-and-down motion.
 *
 * Experimental, and the simulator shows why: every accelerometer reads a
 * little off zero (tens of mg), and as the phone tips that offset leaks into
 * |a| exactly in step with the tilt, looking like heave. Without measuring
 * each phone's offset first, this can be fooled, so it never feeds the
 * emergency check.
 */
function syncOf(tilt: number[], p: Prepared, from: number, sign: number, period: number): number | null {
  const fs = p.fs;
  const f = 1 / period;
  const hiCut = Math.min(1, 2.5 * f);
  // Up-and-down acceleration of the phone, mm/s².
  const heave = bandpass(Array.from(p.mag.slice(from), (m) => (m - G) * 1000), 0.08, hiCut, fs);
  // Height difference between the ends, mm, and its acceleration.
  const diff = tilt.map((d) => sign * CONTACT_MM * Math.tan((d * Math.PI) / 180));
  const acc = new Array<number>(diff.length).fill(0);
  for (let i = 1; i < diff.length - 1; i++) acc[i] = (diff[i + 1] - 2 * diff[i] + diff[i - 1]) * fs * fs;
  const accB = bandpass(acc, 0.08, hiCut, fs);
  // Skip the edges, where the filters are still settling.
  const edge = Math.round(fs);
  let sxy = 0;
  let sxx = 0;
  for (let i = edge; i < accB.length - edge; i++) {
    sxy += heave[i] * accB[i];
    sxx += accB[i] * accB[i];
  }
  return sxx > 0 ? sxy / sxx : null;
}

/**
 * What the reading may say to the rescuer at "Breathing normally?". It can
 * only ever point toward CPR. "Regular" returns null: the rescuer looks and
 * answers themselves, because a phone that wrongly says "breathing" to
 * someone kneeling next to a gasping, dying person is the one mistake this
 * feature must never make. If there is any doubt, assume cardiac arrest and
 * start CPR (Resuscitation Council UK, 2025).
 */
export function suggestAnswer(b: BreathReading): 'abnormal' | null {
  return b.status === 'none' || b.status === 'irregular' || b.status === 'seesaw' ? 'abnormal' : null;
}
