import { useCallback, useEffect, useRef, useState } from 'react';

import type { Sample } from '@/sensors/analyze';
import { readCompressions, type CompressionReading } from '@/sensors/compressions';
import { clearPace, setPace } from '@/sensors/live';
import { motionNeedsTap, phoneSource, type Source } from '@/sensors/source';
import { trace } from '@/voice/trace';

import { PACE_LINES, PaceCoach, type PaceSummary } from './pace';
import type { CoachState } from './useCprCoach';

/**
 * The phone feeling the compressions while the coach counts (pace.ts,
 * sensors/compressions.ts). Starts with the coach where the platform allows
 * it; Safari on iPhone only shares motion after a tap, so there the screen
 * offers one ("Check my pace").
 *
 *   status  off        no accelerometer here (a desktop browser), or refused
 *           needs-tap  the platform wants a tap first
 *           on         reading twice a second
 */
export type PaceStatus = 'off' | 'needs-tap' | 'on';

const KEEP_S = 7;

export function usePaceSensor(active: boolean) {
  const [status, setStatus] = useState<PaceStatus>('off');
  const [reading, setReading] = useState<CompressionReading | null>(null);
  const [summary, setSummary] = useState<PaceSummary>({ trusted: false, perMin: null, advice: null });
  // The coach's phase, set by the screen each render (the coach is created after this hook).
  const phaseRef = useRef<CoachState['phase']>('intro');
  const coach = useRef(new PaceCoach());
  const buf = useRef<Sample[]>([]);
  const source = useRef<Source | null>(null);
  const starting = useRef(false);
  const latest = useRef<PaceSummary>(summary);

  const begin = useCallback(async (fromTap: boolean) => {
    if (source.current || starting.current) return;
    starting.current = true;
    const src = phoneSource();
    const ok = await src.start((s) => {
      buf.current.push(s);
      const cut = s.t - KEEP_S;
      let k = 0;
      while (k < buf.current.length && buf.current[k].t < cut) k++;
      if (k) buf.current.splice(0, k);
    });
    if (ok) {
      source.current = src;
      setStatus('on');
      setPace('on', latest.current);
      trace('pace-source', { source: 'phone accelerometer' });
    } else {
      // Asked without a tap and refused: on iPhone Safari a tap will work.
      const askable = motionNeedsTap();
      setStatus(!fromTap && askable ? 'needs-tap' : 'off');
      setPace(!fromTap && askable ? 'needs-tap' : 'off', latest.current);
      trace('pace-source', { source: askable && !fromTap ? 'waiting for a tap' : 'no accelerometer' });
    }
    starting.current = false;
  }, []);

  useEffect(() => {
    if (!active) return;
    void begin(false);
    const timer = setInterval(() => {
      if (!source.current) return;
      const r = readCompressions(buf.current.slice());
      if (!r) return;
      const t = performance.now() / 1000;
      coach.current.feed(t, r, phaseRef.current);
      const s = coach.current.summary(t);
      latest.current = s;
      setReading(r);
      setSummary(s);
      // For the voice assistant: "how am I doing?"
      setPace('on', s);
      trace('pace', { status: r.status, perMin: r.perMin, confidence: r.confidence, sizeMg: r.sizeMg, noiseMg: r.noiseMg, rate: r.rate, why: r.why, trusted: s.trusted, medianPerMin: s.perMin, advice: s.advice, phase: phaseRef.current });
    }, 500);
    return () => {
      clearInterval(timer);
      source.current?.stop();
      source.current = null;
      buf.current = [];
      coach.current = new PaceCoach();
      setStatus('off');
      clearPace();
    };
  }, [active, begin]);

  /** For the coach's next coaching slot: the pace line to say instead of the usual reminder, if any. */
  const paceLine = useCallback(() => {
    const a = latest.current.advice;
    if (a) trace('pace-said', { advice: a, line: PACE_LINES[a] });
    return a ? PACE_LINES[a] : null;
  }, []);

  return { status, reading, summary, paceLine, phase: phaseRef, startFromTap: () => begin(true) };
}
