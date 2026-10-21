import { useCallback, useEffect, useRef, useState } from 'react';

import { trace } from '@/voice/trace';

import { analyze, angles, type AgeGroup, type Reading, type Sample } from './analyze';
import type { Scenario } from './sim';
import { phoneSource, simulatedSource, type Source, type SourceKind } from './source';

/**
 * The breathing monitor as a sequence the person can follow:
 *
 *   place      lay the phone on the chest and let go (waits for face up and still)
 *   leveling   one still second: that angle becomes zero, like tapping the
 *              iPhone's Level to set a reference
 *   measuring  10 seconds (the emergency check) or for as long as you like (the lab)
 *   done       the result
 *
 * A hand on the phone or a bump sends it back to `place`.
 */
export type Phase = 'idle' | 'starting' | 'place' | 'leveling' | 'measuring' | 'done' | 'unavailable';

export type Level = { pitch: number; roll: number; relPitch: number; relRoll: number; ref: { pitch: number; roll: number } | null };

const KEEP_S = 40;
const STILL_S = 1;

export function useMonitor(opts: { mode: 'check' | 'lab'; age?: AgeGroup; checkSeconds?: number; scenario?: Scenario; allowSim?: boolean }) {
  const { mode, age = 'adult', checkSeconds = 10, allowSim = true } = opts;
  const [phase, setPhase] = useState<Phase>('idle');
  const [level, setLevel] = useState<Level | null>(null);
  const [reading, setReading] = useState<Reading | null>(null);
  const [final, setFinal] = useState<Reading | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(checkSeconds);
  const [retries, setRetries] = useState(0);
  const [kind, setKind] = useState<SourceKind | null>(null);
  const [scenario, setScenarioState] = useState<Scenario>(opts.scenario ?? 'normal');

  const buf = useRef<Sample[]>([]);
  const source = useRef<Source | null>(null);
  const sim = useRef<ReturnType<typeof simulatedSource> | null>(null);
  const st = useRef({ phase: 'idle' as Phase, since: 0, ref: null as Level['ref'], measureAt: 0, tick: 0, lastTrace: 0 });

  const go = useCallback((p: Phase, at: number) => {
    st.current.phase = p;
    st.current.since = at;
    setPhase(p);
    trace('sensor-phase', { phase: p });
  }, []);

  const push = useCallback((s: Sample) => {
    const b = buf.current;
    b.push(s);
    if (b.length > 50 && s.t - b[0].t > KEEP_S) b.splice(0, b.findIndex((x) => s.t - x.t <= KEEP_S));
  }, []);

  /** Call from a tap: iOS only asks for motion permission inside one. */
  const start = useCallback(async () => {
    if (st.current.phase !== 'idle' && st.current.phase !== 'unavailable' && st.current.phase !== 'done') return;
    buf.current = [];
    setFinal(null);
    setRetries(0);
    st.current.ref = null;
    go('starting', 0);
    let src: Source = phoneSource();
    let ok = await src.start(push);
    if (!ok && allowSim) {
      const s = simulatedSource(scenario);
      sim.current = s;
      src = s;
      ok = await s.start(push);
    }
    source.current = ok ? src : null;
    setKind(ok ? src.kind : null);
    trace('sensor-source', { source: ok ? src.kind : 'none', scenario: src.kind === 'simulated' ? scenario : null });
    go(ok ? 'place' : 'unavailable', 0);
  }, [allowSim, go, push, scenario]);

  const stop = useCallback(() => {
    source.current?.stop();
    source.current = null;
    sim.current = null;
    st.current.phase = 'idle';
    setPhase('idle');
  }, []);

  const relevel = useCallback(() => {
    st.current.ref = null;
    const b = buf.current;
    if (b.length) go('leveling', b[b.length - 1].t);
  }, [go]);

  const setScenario = useCallback((s: Scenario) => {
    setScenarioState(s);
    sim.current?.setScenario(s);
    trace('sensor-source', { source: 'simulated', scenario: s });
  }, []);

  useEffect(() => () => source.current?.stop(), []);

  useEffect(() => {
    const timer = setInterval(() => {
      const b = buf.current;
      const s = st.current;
      if (b.length < 10 || s.phase === 'idle' || s.phase === 'starting' || s.phase === 'unavailable' || s.phase === 'done') return;
      const now = b[b.length - 1].t;
      s.tick++;

      // The level, every tick: the last quarter second, averaged.
      let sx = 0;
      let sy = 0;
      let sz = 0;
      let k = 0;
      for (let i = b.length - 1; i >= 0 && now - b[i].t < 0.25; i--, k++) {
        sx += b[i].x;
        sy += b[i].y;
        sz += b[i].z;
      }
      const flip = sz < 0 ? -1 : 1;
      const a = angles({ x: (flip * sx) / k, y: (flip * sy) / k, z: (flip * sz) / k });
      const ref = s.ref;
      setLevel({ ...a, relPitch: ref ? a.pitch - ref.pitch : 0, relRoll: ref ? a.roll - ref.roll : 0, ref });

      // The analysis, three times a second.
      if (s.tick % 3 !== 0) return;
      const measuring = s.phase === 'measuring';
      const elapsed = measuring ? now - s.measureAt : 0;
      const window = mode === 'lab' ? Math.min(30, Math.max(3, elapsed)) : measuring ? Math.max(2, Math.min(checkSeconds, elapsed)) : 2;
      const r = analyze(b, { age, window, heart: mode === 'lab' && measuring, heartWindow: 10, sync: mode === 'lab' });
      if (!r) return;
      setReading(r);
      const still = r.faceUp && !r.motion.moving;

      if (s.phase === 'place') {
        if (still && now - s.since >= STILL_S) go('leveling', now);
      } else if (s.phase === 'leveling') {
        if (!still) go('place', now);
        else if (now - s.since >= STILL_S) {
          s.ref = { pitch: a.pitch, roll: a.roll };
          s.measureAt = now;
          go('measuring', now);
        }
      } else if (measuring) {
        if (!still) {
          setRetries((n) => n + 1);
          go('place', now);
        } else if (mode === 'check') {
          setSecondsLeft(Math.max(0, Math.ceil(checkSeconds - elapsed)));
          if (elapsed >= checkSeconds) {
            const f = analyze(b, { age, window: checkSeconds });
            setFinal(f);
            trace('sensor-result', { status: f?.breath.status, why: f?.breath.why, perMin: f?.breath.perMin, depthDeg: f?.breath.depthDeg, turns: f?.breath.turns, thresholdDeg: f?.breath.thresholdDeg });
            source.current?.stop();
            go('done', now);
          }
        }
      }
      if (now - s.lastTrace >= 1) {
        s.lastTrace = now;
        trace('sensor', {
          phase: s.phase,
          rate: r.rate,
          pitch: a.pitch,
          roll: a.roll,
          relPitch: ref ? a.pitch - ref.pitch : null,
          noiseDeg: r.noiseDeg,
          tremorMg: r.motion.tremorMg,
          shakeNoiseMg: r.motion.noiseMg,
          breath: r.breath,
          heart: r.heart ? { status: r.heart.status, perMin: r.heart.perMin, confidence: r.heart.confidence, rmssdMs: r.heart.rmssdMs } : null,
        });
      }
    }, 100);
    return () => clearInterval(timer);
  }, [age, checkSeconds, go, mode]);

  return { phase, level, reading, final, secondsLeft, retries, kind, scenario, setScenario, start, stop, relevel };
}
export type Monitor = ReturnType<typeof useMonitor>;
