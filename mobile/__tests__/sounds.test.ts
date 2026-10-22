import fs from 'fs';
import path from 'path';

import { rng } from '@/sensors/dsp';
import { framesFromPcm, hearBreathing, type SoundFrame } from '@/sensors/sounds';

/**
 * Hearing gasps (sensors/sounds.ts) on synthetic sound: a quiet room, a
 * gasp, speech-like syllables, regular loud breaths, our own voice. There
 * is no public recording of agonal breathing to test on, so these show the
 * rules do what they say. How often real non-gasp sounds (breathing,
 * snoring, coughing, laughing, speech) are wrongly called gasps is measured
 * on request:
 *
 *   python tools/sound_data.py
 *   SOUND_REPORT=1 npx jest sounds      -> docs/SOUND_CHECK.md, reports/sound-check.json
 */
const RATE = 16000;

/** 10 s of a quiet room (-60 dBFS noise) with sounds added: each a noise burst shaped by `env` (0..1 over its length). */
function room(seconds: number, seed: number, adds: { at: number; dur: number; db: number; env?: (u: number) => number; tone?: number }[]) {
  const r = rng(seed);
  const n = Math.round(seconds * RATE);
  const x = new Float64Array(n);
  for (let i = 0; i < n; i++) x[i] = 0.001 * r.gauss();
  for (const a of adds) {
    const amp = 10 ** (a.db / 20);
    const i0 = Math.round(a.at * RATE);
    const len = Math.round(a.dur * RATE);
    let lp = 0;
    for (let i = 0; i < len && i0 + i < n; i++) {
      const u = i / len;
      const e = a.env ? a.env(u) : Math.sin(Math.PI * u);
      // Breath noise: white noise, gently low-passed. A tone (speech or snoring): a buzz with harmonics.
      lp = 0.7 * lp + 0.3 * r.gauss();
      const v = a.tone ? Math.sign(Math.sin((2 * Math.PI * a.tone * i) / RATE)) * 0.5 + 0.1 * r.gauss() : lp;
      x[i0 + i] += amp * e * v;
    }
  }
  return x;
}

const hear = (x: Float64Array, own?: (t: number) => boolean) =>
  hearBreathing(framesFromPcm(x, RATE).map((f: SoundFrame) => ({ ...f, own: own ? own(f.t) : false })));

/** Speech-like: four syllables in 1.2 s, with dips between. */
const syllables = (u: number) => Math.abs(Math.sin(Math.PI * 4 * u)) ** 2;

describe('hearing gasps', () => {
  it('a quiet room is quiet', () => {
    expect(hear(room(10, 1, [])).status).toBe('quiet');
  });

  it('one gasp with quiet around it is a gasp', () => {
    const r = hear(room(10, 2, [{ at: 4, dur: 0.6, db: -25, env: (u) => (u < 0.2 ? u / 0.2 : (1 - u) / 0.8) }]));
    expect(r.status).toBe('gasps');
    expect(r.events[0].swells).toBeLessThanOrEqual(2);
  });

  it('two gasps 6 s apart are gasps', () => {
    expect(hear(room(10, 3, [{ at: 1.5, dur: 0.5, db: -25 }, { at: 7.5, dur: 0.5, db: -28 }])).status).toBe('gasps');
  });

  it('single words between sentences are not gasps either', () => {
    const word = { dur: 0.35, db: -25, tone: 130 };
    const r = hear(room(10, 8, [{ at: 1, ...word, dur: 1.2, env: syllables }, { at: 4.5, ...word }, { at: 8, ...word }]));
    expect(r.status).toBe('talking');
  });

  it('talking is not a gasp', () => {
    const r = hear(room(10, 4, [{ at: 2, dur: 1.2, db: -25, env: syllables, tone: 140 }, { at: 3.6, dur: 1.2, db: -25, env: syllables, tone: 140 }, { at: 6, dur: 1.2, db: -26, env: syllables, tone: 150 }]));
    expect(r.status).not.toBe('gasps');
  });

  it('loud regular breathing or snoring is not called gasps', () => {
    const adds = [0.5, 3.6, 6.7, 9.0].map((at, k) => ({ at, dur: 1, db: -30, tone: k % 2 ? 0 : 60 }));
    const r = hear(room(10.5, 5, adds));
    expect(r.status).toBe('regular');
  });

  it('our own voice is skipped', () => {
    const x = room(10, 6, [{ at: 4, dur: 0.6, db: -25 }]);
    expect(hear(x, (t) => t >= 3.8 && t <= 4.7).status).not.toBe('gasps');
  });

  it('a level change does not matter: only the rise over the room', () => {
    const x = room(10, 7, [{ at: 4, dur: 0.6, db: -25 }]).map((v) => v * 0.05);
    expect(hear(Float64Array.from(x)).status).toBe('gasps');
  });
});

// --- Real non-gasp sounds, on request ---------------------------------------------------------
const report = process.env.SOUND_REPORT ? it : it.skip;
const DATA = path.join(__dirname, '..', '..', 'data', 'sounds');

report(
  'real sounds: writes docs/SOUND_CHECK.md and reports/sound-check.json',
  () => {
    type Clip = { file: string; group: string; source: string; seconds: number };
    const index: Clip[] = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
    const groups: Record<string, { clips: number; gasps: number; regular: number; talking: number; quiet: number; unavailable: number }> = {};
    const examples: Record<string, string[]> = {};
    for (const c of index) {
      const pcm = new Float32Array(fs.readFileSync(path.join(DATA, c.file)).buffer.slice(0));
      const r = hearBreathing(framesFromPcm(pcm, RATE));
      const g = (groups[c.group] ??= { clips: 0, gasps: 0, regular: 0, talking: 0, quiet: 0, unavailable: 0 });
      g.clips++;
      g[r.status]++;
      if (r.status === 'gasps') (examples[c.group] ??= []).push(`${c.source}: ${r.why}`);
    }
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'sound-check.json'), JSON.stringify({ generated: new Date().toISOString(), groups, examples }, null, 2) + '\n');
    const pct = (a: number, b: number) => `${Math.round((a / b) * 100)}%`;
    const md = [
      '# Hearing gasps: false alarms on real sounds',
      '',
      'Generated by `SOUND_REPORT=1 npx jest sounds` (mobile/__tests__/sounds.test.ts) after `python tools/sound_data.py`. Numbers in `mobile/reports/sound-check.json`.',
      '',
      '**What this measures.** How often sounds that are *not* gasps are wrongly called gasps by `mobile/src/sensors/sounds.ts`. The clips: ESC-50 (Piczak 2015, Harvard Dataverse, CC BY-NC; 5-second clips from Freesound) for breathing, snoring, coughing, sneezing and laughing, and the app\'s own recorded voice lines run together like someone talking. There is no public recording of agonal breathing, so how many real gasps it hears is not known: the rules are tested on synthetic gasps only (`mobile/__tests__/sounds.test.ts`).',
      '',
      '**Why a false alarm matters little, and still matters.** The microphone only adds to a "not normal" answer the chest\'s movement already gave, or says "I heard gasping" before the rescuer answers. It never says "breathing normally". A false gasp nudges a rescuer toward CPR on someone who is breathing.',
      '',
      '| Sound | Clips | Called gasps (false alarm) | Regular | Speech or long | Nothing like a gasp |',
      '|---|---|---|---|---|---|',
      ...Object.entries(groups).map(([k, g]) => `| ${k} | ${g.clips} | ${pct(g.gasps, g.clips)} | ${pct(g.regular, g.clips)} | ${pct(g.talking, g.clips)} | ${pct(g.quiet + g.unavailable, g.clips)} |`),
      '',
    ];
    fs.writeFileSync(path.join(__dirname, '..', '..', 'docs', 'SOUND_CHECK.md'), md.join('\n'));
    expect(index.length).toBeGreaterThan(50);
  },
  600_000,
);
