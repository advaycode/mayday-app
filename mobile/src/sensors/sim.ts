import { CONTACT_MM, G, type AgeGroup, type BreathStatus, type Sample } from './analyze';
import { lowpass, rng, type Rng } from './dsp';

/**
 * A simulated person with a phone on their chest, for testing what we cannot
 * yet test on people. Physics first, then a model of the phone's sensor.
 *
 *   chest and belly heights  ->  phone tilt (difference) and heave (average)
 *   + heartbeat vibration, a rescuer's hand, footsteps on the floor
 *   ->  gravity and motion in the phone's frame
 *   ->  sensor noise, 1 mg steps, late and dropped samples
 *
 * Numbers and where they come from (research/sensor-breathing.md):
 *   chest 2-4 mm, belly 7-9 mm per quiet breath, supine (measured, 9 adults).
 *     The phone's bottom end rests above the navel, which moves less: 4-9 mm.
 *   accelerometer noise 180 µg/√Hz (a typical phone-class sensor, Bosch BMI160;
 *     Apple does not publish the iPhone's), 1 mg resolution (iPhone 6, as
 *     reported by Landreani et al. 2016), 100 samples a second native, 60 on the web.
 *   heartbeat vibration 10 mg peak (assumption; swept 3-30 mg in the report).
 *   a fixed offset of up to 20 mg per axis (assumption; swept 0-40 mg).
 *   gasps every 4-15 s, quick in, slow out, still in between (assumption:
 *     no published rate found).
 *   a hand on the phone: 8-12 Hz tremor of 5-20 mg, and a slow sway of up
 *     to 1.5° (assumption).
 *
 * The gyroscope (on unless `gyro: false`) sees the same body turning:
 *   the breathing tilt's rate of change, about the phone's x axis.
 *   the heart's twist of the chest wall (gyrocardiography): 1°/s peak
 *     (assumption, derived: a 10 mg vibration at 15 Hz moves the wall about
 *     11 µm; across ~5 cm of chest that is 0.013°, at 15 Hz about 1.2°/s).
 *   a hand: 0.5-3°/s of rotational tremor (assumption).
 *   footsteps: the body rocks on the floor, a lever of 0.2-0.6 m (assumption).
 *   noise 0.007°/s/√Hz (Bosch BMI160), a fixed offset up to 0.3°/s, 0.01°/s steps.
 * `rotMap` scrambles the channel order, signs and units the way platforms do,
 * to test that the phone works its own axes out.
 */

export type Scenario = 'normal' | 'shallow' | 'child' | 'slow' | 'agonal' | 'none' | 'none_steps' | 'seesaw' | 'hand';

export const SCENARIOS: { id: Scenario; label: string; expect: BreathStatus; age: AgeGroup; heart: boolean }[] = [
  { id: 'normal', label: 'Breathing normally', expect: 'regular', age: 'adult', heart: true },
  { id: 'shallow', label: 'Shallow breathing', expect: 'regular', age: 'adult', heart: true },
  { id: 'child', label: 'Child breathing', expect: 'regular', age: 'child', heart: true },
  { id: 'slow', label: 'Very slow (overdose)', expect: 'irregular', age: 'adult', heart: true },
  { id: 'agonal', label: 'Gasping (cardiac arrest)', expect: 'irregular', age: 'adult', heart: false },
  { id: 'none', label: 'Not breathing', expect: 'none', age: 'adult', heart: false },
  { id: 'none_steps', label: 'Not breathing, people walking', expect: 'none', age: 'adult', heart: false },
  { id: 'seesaw', label: 'See-saw (blocked airway)', expect: 'seesaw', age: 'adult', heart: true },
  { id: 'hand', label: 'Hand on the phone', expect: 'moving', age: 'adult', heart: true },
];

export type SimOptions = {
  scenario: Scenario;
  seconds: number;
  seed?: number;
  /** Samples per second: 100 native, 60 in a browser. */
  fs?: number;
  /** Accelerometer noise density, µg/√Hz. */
  noiseUg?: number;
  /** Smallest step the sensor reports, mg. */
  quantMg?: number;
  jitterMs?: number;
  dropRate?: number;
  /** Heartbeat vibration, peak mg. */
  scgMg?: number;
  /** Largest fixed offset of each accelerometer axis, mg (each axis gets a random one up to this). */
  biasMg?: number;
  contactMm?: number;
  /** How the body tips the phone at rest, degrees (random if not given). */
  pitch0?: number;
  roll0?: number;
  /** Include a gyroscope (default true). */
  gyro?: boolean;
  /** Gyroscope noise density, °/s/√Hz. */
  gyroNoise?: number;
  /** Largest fixed gyroscope offset per axis, °/s. */
  gyroBiasDps?: number;
  /** The heart's twist of the chest wall, peak °/s. */
  gcgDps?: number;
  /** How the platform reports rotation: channel order (indices of x, y, z), signs, radians. */
  rotMap?: { order: [number, number, number]; signs: [number, number, number]; radians?: boolean };
  /** Real breathing to play instead of the scenario's formula (see `played`). */
  recorded?: Recorded;
};

/**
 * A recorded breathing belt (tools/heart_ml/breathing.py: the PhysioNet CEBS
 * belts, 20 people): `breath` is in typical breaths (one breath's peak to
 * valley is about 1, breathing in goes up), played from `from` seconds.
 * `perMin` is the belt's own rate there.
 */
export type Recorded = { fs: number; breath: ArrayLike<number>; from: number; perMin: number | null };

export type SimTruth = { scenario: Scenario; expect: BreathStatus; age: AgeGroup; breathsPerMin: number | null; heartPerMin: number | null; beats: number[] };

const INNER_FS = 400;

/** One quiet breath, 0..1 over the cycle: in for 40%, out, then a short pause. */
function breathShape(phase: number, inShare = 0.4): number {
  if (phase < inShare) return (1 - Math.cos((Math.PI * phase) / inShare)) / 2;
  const u = Math.min(1, (phase - inShare) / ((1 - inShare) * 0.8));
  return (1 + Math.cos(Math.PI * u)) / 2;
}

/** Chest and belly heights (mm) over time. */
function breathing(s: Scenario, r: Rng, t: Float64Array) {
  const n = t.length;
  const chest = new Float64Array(n);
  const belly = new Float64Array(n);
  let rate: number | null = null;
  const T = t[n - 1];

  const cycles = (perMin: number, chestMm: number, bellyMm: number, inShare = 0.4) => {
    rate = perMin;
    const lag = r.uniform(-0.15, 0.15);
    let start = -r.uniform(0, 60 / perMin);
    while (start < T) {
      const period = (60 / perMin) * (1 + 0.08 * r.gauss());
      const amp = 1 + 0.1 * r.gauss();
      const i0 = Math.max(0, Math.floor((start - 0.5) * INNER_FS));
      const i1 = Math.min(n, Math.ceil((start + period + 0.5) * INNER_FS));
      for (let i = i0; i < i1; i++) {
        const pb = (t[i] - start) / period;
        const pc = (t[i] - start - lag) / period;
        if (pb >= 0 && pb < 1) belly[i] += amp * bellyMm * breathShape(pb, inShare);
        if (pc >= 0 && pc < 1) chest[i] += amp * chestMm * breathShape(pc, inShare);
      }
      start += period;
    }
  };

  switch (s) {
    case 'normal':
    case 'hand':
      cycles(r.uniform(12, 20), r.uniform(2, 4), r.uniform(4, 9));
      break;
    case 'shallow': {
      const k = r.uniform(0.25, 0.4);
      cycles(r.uniform(12, 20), k * r.uniform(2, 4), k * r.uniform(4, 9));
      break;
    }
    case 'child':
      cycles(r.uniform(20, 30), 0.6 * r.uniform(2, 4), 0.6 * r.uniform(4, 9));
      break;
    case 'slow':
      cycles(r.uniform(4, 7), r.uniform(1.5, 3.5), r.uniform(3, 8));
      break;
    case 'seesaw': {
      // The belly rises as the chest is sucked in.
      const k = r.uniform(0.4, 0.9);
      const b = r.uniform(5, 9);
      cycles(r.uniform(12, 24), -k * b, b, 0.45);
      break;
    }
    case 'agonal': {
      // A sharp gasp, a slower fall, then stillness.
      let at = r.uniform(0, 8);
      while (at < T) {
        const rise = r.uniform(0.3, 0.6);
        const fall = r.uniform(0.8, 1.5);
        const c = r.uniform(3, 8);
        const b = r.uniform(3, 8);
        for (let i = Math.max(0, Math.floor(at * INNER_FS)); i < Math.min(n, Math.ceil((at + rise + fall) * INNER_FS)); i++) {
          const u = t[i] - at;
          const v = u < rise ? (1 - Math.cos((Math.PI * u) / rise)) / 2 : (1 + Math.cos((Math.PI * (u - rise)) / fall)) / 2;
          chest[i] += c * v;
          belly[i] += b * v;
        }
        at += rise + fall + r.uniform(4, 15);
      }
      break;
    }
    case 'none':
    case 'none_steps':
      break;
  }
  return { chest, belly, rate: rate as number | null };
}

/**
 * Real breathing, at the sizes 'normal' uses: a typical breath lifts the
 * chest 2-4 mm and the belly 4-9 mm. A chest belt cannot tell chest from
 * belly, so both follow the belt, the chest a little early or late, as in
 * the formula.
 */
function played(rec: Recorded, r: Rng, t: Float64Array) {
  const n = t.length;
  const chestMm = r.uniform(2, 4);
  const bellyMm = r.uniform(4, 9);
  const lag = r.uniform(-0.15, 0.15);
  const at = (s: number) => {
    const u = Math.max(0, (rec.from + s) * rec.fs);
    const i = Math.min(rec.breath.length - 2, Math.floor(u));
    const f = Math.min(1, u - i);
    return rec.breath[i] * (1 - f) + rec.breath[i + 1] * f;
  };
  const chest = new Float64Array(n);
  const belly = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    belly[i] = bellyMm * at(t[i]);
    chest[i] = chestMm * at(t[i] - lag);
  }
  // Straight lines between the belt's samples bend sharply at each one: as
  // acceleration and turn rate those bends are a buzz at hand-tremor
  // frequencies that no chest makes. The belt was filtered to 2 Hz, so
  // smoothing to 3 Hz removes only the bends.
  return { chest: lowpass(chest, 3, INNER_FS), belly: lowpass(belly, 3, INNER_FS), rate: rec.perMin };
}

/** A damped ring: what one heart sound or one footstep looks like to an accelerometer. */
function ring(out: Float64Array, at: number, amp: number, hz: number, decayS: number) {
  const i0 = Math.max(0, Math.floor(at * INNER_FS));
  const i1 = Math.min(out.length, Math.ceil((at + 6 * decayS) * INNER_FS));
  for (let i = i0; i < i1; i++) {
    const u = i / INNER_FS - at;
    if (u >= 0) out[i] += amp * Math.exp(-u / decayS) * Math.sin(2 * Math.PI * hz * u);
  }
}

/** Smooth random wander with roughly the given size, below `hz`. */
function wander(r: Rng, n: number, size: number, hz: number) {
  const out = new Float64Array(n);
  const a = Math.exp((-2 * Math.PI * hz) / INNER_FS);
  let v = 0;
  let w = 0;
  for (let i = 0; i < n; i++) {
    v = a * v + (1 - a) * r.gauss();
    w = a * w + (1 - a) * v;
    out[i] = w;
  }
  let s = 0;
  for (let i = 0; i < n; i++) s += out[i] * out[i];
  const k = size / Math.max(1e-9, Math.sqrt(s / n));
  for (let i = 0; i < n; i++) out[i] *= k;
  return out;
}

export function simulate(o: SimOptions): { samples: Sample[]; truth: SimTruth } {
  const r = rng(o.seed ?? 1);
  const meta = SCENARIOS.find((s) => s.id === o.scenario)!;
  const fs = o.fs ?? 100;
  const d = o.contactMm ?? CONTACT_MM;
  const n = Math.ceil(o.seconds * INNER_FS) + 1;
  const t = Float64Array.from({ length: n }, (_, i) => i / INNER_FS);

  // --- The body -----------------------------------------------------------------
  const { chest, belly, rate } = o.recorded ? played(o.recorded, r, t) : breathing(o.scenario, r, t);
  const pitch0 = o.pitch0 ?? r.uniform(-8, 8);
  const roll0 = o.roll0 ?? r.uniform(-6, 6);
  const pitch = new Float64Array(n);
  const roll = new Float64Array(n);
  const heave = new Float64Array(n); // mm
  for (let i = 0; i < n; i++) {
    pitch[i] = pitch0 + (Math.atan((chest[i] - belly[i]) / d) * 180) / Math.PI;
    roll[i] = roll0 + 0.05 * (pitch[i] - pitch0); // a body is never quite symmetric
    heave[i] = (chest[i] + belly[i]) / 2;
  }

  // Heartbeat: S1 then S2, along the axis out of the screen, a little along the body.
  const scgZ = new Float64Array(n);
  const scgY = new Float64Array(n);
  const gcg = { x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n) };
  const beats: number[] = [];
  let heartPerMin: number | null = null;
  if (meta.heart) {
    heartPerMin = o.scenario === 'child' ? r.uniform(80, 120) : o.scenario === 'seesaw' ? r.uniform(90, 130) : o.scenario === 'slow' ? r.uniform(50, 80) : r.uniform(55, 100);
    const amp = (o.scgMg ?? 10) * r.uniform(0.6, 1.4);
    const twist = (o.gcgDps ?? 1) * r.uniform(0.6, 1.4);
    const f1 = r.uniform(12, 20);
    const f2 = r.uniform(18, 25);
    let at = r.uniform(0, 60 / heartPerMin);
    while (at < o.seconds) {
      beats.push(at);
      const breathMod = rate ? 0.04 * Math.sin((2 * Math.PI * rate * at) / 60) : 0;
      ring(scgZ, at, amp, f1, 0.03);
      ring(scgZ, at + 0.32, 0.5 * amp, f2, 0.025);
      ring(scgY, at, 0.3 * amp, f1, 0.03);
      ring(gcg.x, at + 0.01, twist, f1, 0.03);
      ring(gcg.x, at + 0.33, 0.5 * twist, f2, 0.025);
      ring(gcg.y, at + 0.01, 0.6 * twist, f1, 0.03);
      ring(gcg.z, at + 0.01, 0.4 * twist, f1, 0.03);
      at += (60 / heartPerMin) * (1 + breathMod) + 0.015 * r.gauss();
    }
  }

  // A rescuer's hand on the phone: tremor and a slow sway.
  const tremor = { x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n) };
  const turnTremor = { x: new Float64Array(n), y: new Float64Array(n), z: new Float64Array(n) };
  if (o.scenario === 'hand') {
    const dps = r.uniform(0.5, 3);
    const thz = r.uniform(8, 12);
    for (const axis of ['x', 'y', 'z'] as const) {
      const ph = r.uniform(0, 2 * Math.PI);
      const env = wander(r, n, 1, 0.5);
      for (let i = 0; i < n; i++) turnTremor[axis][i] = dps * (0.7 + 0.3 * env[i]) * Math.sin(2 * Math.PI * thz * t[i] + ph);
    }
    const size = r.uniform(5, 20);
    const hz = r.uniform(8, 12);
    for (const axis of ['x', 'y', 'z'] as const) {
      const env = wander(r, n, 1, 0.5);
      const ph = r.uniform(0, 2 * Math.PI);
      for (let i = 0; i < n; i++) tremor[axis][i] = size * (0.7 + 0.3 * env[i]) * Math.sin(2 * Math.PI * hz * t[i] + ph + 0.3 * env[i]);
    }
    const sp = wander(r, n, r.uniform(0.3, 1.5), 0.4);
    const sr = wander(r, n, r.uniform(0.3, 1.5), 0.4);
    for (let i = 0; i < n; i++) {
      pitch[i] += sp[i];
      roll[i] += sr[i];
    }
  }

  // People walking past: each step rings the floor.
  const steps = new Float64Array(n);
  const rock = { x: new Float64Array(n), y: new Float64Array(n) };
  if (o.scenario === 'none_steps') {
    let at = r.uniform(0, 2);
    while (at < o.seconds) {
      const walk = r.uniform(3, 8);
      const cadence = r.uniform(1.6, 2.2);
      const size = r.uniform(2, 15);
      for (let s = at; s < Math.min(o.seconds, at + walk); s += 1 / cadence) {
        const a = size * r.uniform(0.6, 1.2);
        const hz = r.uniform(6, 15);
        ring(steps, s, a, hz, 0.05);
        // The body rocks: a floor movement of a/ω² over a lever of 0.2-0.6 m, as a rate.
        const dps = (((a / 1000) * G) / (2 * Math.PI * hz * r.uniform(0.2, 0.6))) * (180 / Math.PI);
        const dir = r.uniform(0, 2 * Math.PI);
        ring(rock.x, s, dps * Math.cos(dir), hz, 0.05);
        ring(rock.y, s, dps * Math.sin(dir), hz, 0.05);
      }
      at += walk + r.uniform(1, 5);
    }
  }

  // Up-and-down acceleration of the phone, from its height: mm/s² -> m/s².
  const heaveAcc = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) heaveAcc[i] = ((heave[i + 1] - 2 * heave[i] + heave[i - 1]) * INNER_FS * INNER_FS) / 1000;

  // --- The sensor -----------------------------------------------------------------
  const noise = (o.noiseUg ?? 180) * 1e-6 * G * Math.sqrt(fs / 2);
  const q = ((o.quantMg ?? 1) / 1000) * G;
  const b = ((o.biasMg ?? 20) / 1000) * G;
  const bias = { x: r.uniform(-b, b), y: r.uniform(-b, b), z: r.uniform(-b, b) };
  const mg = G / 1000;
  const samples: Sample[] = [];
  const quant = (v: number) => (q > 0 ? Math.round(v / q) * q : v);
  const withGyro = o.gyro ?? true;
  const gNoise = (o.gyroNoise ?? 0.007) * Math.sqrt(fs / 2);
  const gb = o.gyroBiasDps ?? 0.3;
  const gBias = [r.uniform(-gb, gb), r.uniform(-gb, gb), r.uniform(-gb, gb)];
  const gq = (v: number) => Math.round(v / 0.01) * 0.01;
  const map = o.rotMap ?? { order: [0, 1, 2], signs: [1, 1, 1] };
  const turnRate = (a: Float64Array, i: number) => ((a[Math.min(n - 1, i + 1)] - a[Math.max(0, i - 1)]) * INNER_FS) / 2;
  for (let k = 0; ; k++) {
    if (o.dropRate && r.next() < o.dropRate) continue;
    const ts = k / fs + ((o.jitterMs ?? 0) / 1000) * r.gauss();
    if (ts > o.seconds) break;
    if (ts < 0) continue;
    const i = Math.min(n - 1, Math.round(ts * INNER_FS));
    // Which way is up, in the phone's frame.
    const tx = Math.tan((roll[i] * Math.PI) / 180);
    const ty = Math.tan((pitch[i] * Math.PI) / 180);
    const len = Math.hypot(tx, ty, 1);
    const up = { x: tx / len, y: ty / len, z: 1 / len };
    const vertical = G + heaveAcc[i] + steps[i] * mg;
    const sample: Sample = {
      t: ts,
      x: quant(vertical * up.x + tremor.x[i] * mg + bias.x + noise * r.gauss()),
      y: quant(vertical * up.y + (scgY[i] + tremor.y[i]) * mg + bias.y + noise * r.gauss()),
      z: quant(vertical * up.z + (scgZ[i] + tremor.z[i]) * mg + bias.z + noise * r.gauss()),
    };
    if (withGyro) {
      // Top end up is a turn about +x; roll as measured is a turn about -y.
      const truth = [
        turnRate(pitch, i) + gcg.x[i] + turnTremor.x[i] + rock.x[i],
        -turnRate(roll, i) + gcg.y[i] + turnTremor.y[i] + rock.y[i],
        gcg.z[i] + turnTremor.z[i],
      ].map((v, k) => gq(v + gBias[k] + gNoise * r.gauss()));
      const out = map.order.map((k, j) => map.signs[j] * truth[k] * (map.radians ? Math.PI / 180 : 1)) as [number, number, number];
      sample.rot = out;
    }
    samples.push(sample);
  }
  samples.sort((a, b) => a.t - b.t);

  return { samples, truth: { scenario: o.scenario, expect: meta.expect, age: meta.age, breathsPerMin: rate, heartPerMin, beats } };
}
