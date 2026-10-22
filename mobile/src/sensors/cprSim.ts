import { G, type Sample } from './analyze';
import { rng } from './dsp';

/**
 * A phone near someone getting chest compressions, for testing the
 * compression reader (compressions.ts) without a person.
 *
 * The chest's motion is either drawn (each compression a smooth push to
 * `depthMm` in 40% of the cycle and a slower release) or played from a real
 * resuscitation (`recorded`: the CPRDAT defibrillator accelerometer,
 * tools/cpr_data.py, in g). The phone feels a share of it, `transfer`:
 *
 *   1      the phone under the rescuer's hands (reference only, never advised)
 *   ~0.3   on a mattress or couch the person lies on (assumption)
 *   ~0.01  on a hard floor beside them (assumption)
 *
 * Nobody has published these shares for a phone, so the report sweeps them
 * and says how much motion the reader needs. The sensor is the same
 * phone-class model as sim.ts: 180 µg/√Hz noise, 1 mg steps, jitter, drops.
 */
export type CprSimOptions = {
  seconds: number;
  seed?: number;
  /** Compressions a minute (drawn chest only). */
  perMin?: number;
  depthMm?: number;
  /** Compressions stop at this time, s (drawn chest only). */
  stopAt?: number;
  /** Share of the chest's motion the phone feels. */
  transfer?: number;
  fs?: number;
  noiseUg?: number;
  jitterMs?: number;
  dropRate?: number;
  /** The direction the motion reaches the phone: out of the screen (lying flat) or along it (upright in a pocket). */
  axis?: 'z' | 'y';
  /** A real chest, in g, played from `from` seconds. */
  recorded?: { fs: number; g: ArrayLike<number>; from: number };
};

const INNER_FS = 400;

/** The chest's acceleration, g, at INNER_FS. */
function drawnChest(o: CprSimOptions, n: number): Float64Array {
  const r = rng((o.seed ?? 1) + 17);
  const d = new Float64Array(n);
  const perMin = o.perMin ?? 110;
  const depth = (o.depthMm ?? 50) / 1000;
  let start = r.uniform(0, 60 / perMin);
  while (start < n / INNER_FS) {
    const T = (60 / perMin) * (1 + 0.03 * r.gauss());
    const dep = depth * (1 + 0.1 * r.gauss());
    if (o.stopAt !== undefined && start >= o.stopAt) break;
    for (let i = Math.floor(start * INNER_FS); i < Math.min(n, Math.ceil((start + T) * INNER_FS)); i++) {
      const u = (i / INNER_FS - start) / T;
      if (u < 0) continue;
      d[i] = u < 0.4 ? (dep * (1 - Math.cos((Math.PI * u) / 0.4))) / 2 : (dep * (1 + Math.cos((Math.PI * (u - 0.4)) / 0.6))) / 2;
    }
    start += T;
  }
  const acc = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) acc[i] = ((d[i + 1] - 2 * d[i] + d[i - 1]) * INNER_FS * INNER_FS) / G;
  return acc;
}

export function simulateCpr(o: CprSimOptions): Sample[] {
  const r = rng(o.seed ?? 1);
  const n = Math.ceil(o.seconds * INNER_FS) + 1;
  let chest: Float64Array;
  if (o.recorded) {
    const rec = o.recorded;
    chest = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const u = (rec.from + i / INNER_FS) * rec.fs;
      const k = Math.min(rec.g.length - 2, Math.max(0, Math.floor(u)));
      const f = Math.min(1, Math.max(0, u - k));
      chest[i] = rec.g[k] * (1 - f) + rec.g[k + 1] * f;
    }
  } else {
    chest = drawnChest(o, n);
  }
  const k = o.transfer ?? 0.3;
  const fs = o.fs ?? 100;
  const noise = (o.noiseUg ?? 180) * 1e-6 * G * Math.sqrt(fs / 2);
  const q = G / 1000;
  const quant = (v: number) => Math.round(v / q) * q;
  const tilt = { x: r.uniform(-0.05, 0.05), y: r.uniform(-0.05, 0.05) };
  const bias = { x: r.uniform(-0.02, 0.02) * G, y: r.uniform(-0.02, 0.02) * G, z: r.uniform(-0.02, 0.02) * G };
  const out: Sample[] = [];
  for (let j = 0; ; j++) {
    if (o.dropRate && r.next() < o.dropRate) continue;
    const ts = j / fs + ((o.jitterMs ?? 2) / 1000) * r.gauss();
    if (ts > o.seconds) break;
    if (ts < 0) continue;
    const i = Math.min(n - 1, Math.round(ts * INNER_FS));
    const m = k * chest[i] * G;
    // Lying flat the motion is out of the screen, with gravity; upright in a pocket, along the phone, gravity too.
    const along = o.axis === 'y';
    out.push({
      t: ts,
      x: quant(tilt.x * G + bias.x + noise * r.gauss()),
      y: quant((along ? G + m : tilt.y * G) + bias.y + noise * r.gauss()),
      z: quant((along ? 0.1 * G : G + m) + bias.z + noise * r.gauss()),
    });
  }
  return out;
}
