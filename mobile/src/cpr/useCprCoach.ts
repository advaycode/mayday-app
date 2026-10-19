import { useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming, Easing } from 'react-native-reanimated';

import { audio } from '@/audio/engine';
import systemLines from '@/audio/systemLines.json';
import { CPR_BPM } from '@/config';
import { haptic } from '@/design/haptics';
import { getSettings } from '@/settings/store';
import { adaptLine, say, voiceContext } from '@/voice/voice';

import { LookaheadScheduler } from './scheduler';
import { BACK_LINE, positionAt, swapLine, type CprMode, type CprPlan, type TimelineEvent } from './timeline';

const COUNTS = systemLines.counts;

export type CoachState = {
  phase: 'intro' | 'compress' | 'coach' | 'breaths';
  count: number | null;
  cycle: number;
  /** Seconds since the first compression. */
  elapsed: number;
  /** Is the audio engine running, or only haptics and the screen? */
  withAudio: boolean;
};

type Options = {
  active: boolean;
  mode: CprMode;
  introLines: string[];
  reminders: string[];
  breathsSay: string[];
  swapEveryS: number;
  onStart?: (atMs: number) => void;
  onSwap?: () => void;
};

/**
 * Runs the compression coach while `active`.
 *
 * The audio clock is the master. The scheduler hands clicks and counts to
 * the audio hardware ahead of time; the screen and the haptic motor simply
 * read the same clock every frame and ask the timeline "which beat is it
 * now?". So sound, number on screen and buzz in the hand all agree, and none
 * of them can drift.
 */
export function useCprCoach(opts: Options) {
  const [state, setState] = useState<CoachState>({ phase: 'intro', count: null, cycle: 0, elapsed: 0, withAudio: false });
  const pulse = useSharedValue(0);
  const optsRef = useRef(opts);
  optsRef.current = opts;

  useEffect(() => {
    if (!opts.active) return;
    let cancelled = false;
    let raf = 0;
    let interval: ReturnType<typeof setInterval> | undefined;

    // Lines adapted to this patient ("watch his chest") and rescuer (alone or not).
    const alone = voiceContext().alone;
    const plan: CprPlan = {
      bpm: CPR_BPM,
      mode: opts.mode,
      reminders: opts.reminders.map(adaptLine),
      breathsSay: opts.breathsSay.map(adaptLine),
      swapEveryS: opts.swapEveryS,
      alone,
    };
    const a = audio();
    const now = a ? () => a.now() : () => performance.now() / 1000;

    (async () => {
      let t0: number;
      if (a) {
        const lines = [
          ...opts.introLines.map(adaptLine),
          ...COUNTS,
          ...plan.reminders,
          ...plan.breathsSay,
          BACK_LINE,
          ...Array.from({ length: 10 }, (_, i) => swapLine((i + 1) * 2, alone)),
        ];
        await a.preload(lines);
        if (cancelled) return;
        // "Spoken coaching" off in settings: keep the click, drop the voice.
        const voice = getSettings().voice;
        const spoken = voice ? await say(opts.introLines) : { end: a.now() };
        t0 = spoken.end + 0.35;
        const emit = (e: TimelineEvent) => {
          if (e.kind === 'beat') {
            a.playClick(e.at, e.count === 1);
            if (voice && e.count !== null) a.playLineAt(COUNTS[e.count - 1], e.at);
          } else if (e.kind === 'line' && voice) {
            a.playLineAt(e.text, e.at);
          }
        };
        const scheduler = new LookaheadScheduler(plan, t0, { now }, emit);
        interval = setInterval(() => scheduler.tick(), 25);
        scheduler.tick();
      } else {
        t0 = now() + 1;
      }
      optsRef.current.onStart?.(Date.now() + (t0 - now()) * 1000);

      // Visual + haptic loop: read the clock, never count frames.
      let lastBeat = -1;
      let lastSwapCycle = -1;
      const frame = () => {
        if (cancelled) return;
        const t = now();
        if (t >= t0) {
          const pos = positionAt(plan, t0, t);
          const beatKey = pos.cycle * 100 + pos.beatIndex;
          if (pos.beatIndex >= 0 && beatKey !== lastBeat) {
            lastBeat = beatKey;
            haptic('compression');
            pulse.value = 1;
            pulse.value = withTiming(0, { duration: 380, easing: Easing.out(Easing.cubic) });
          }
          if (pos.swap && (pos.phase === 'coach' || pos.phase === 'breaths') && lastSwapCycle !== pos.cycle) {
            lastSwapCycle = pos.cycle;
            haptic('swap');
            optsRef.current.onSwap?.();
          }
          setState((s) =>
            s.count === pos.count && s.phase === pos.phase && Math.floor(s.elapsed) === Math.floor(t - t0)
              ? s
              : { phase: pos.phase, count: pos.count, cycle: pos.cycle, elapsed: t - t0, withAudio: !!a },
          );
        }
        raf = requestAnimationFrame(frame);
      };
      raf = requestAnimationFrame(frame);
    })();

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (interval) clearInterval(interval);
      a?.stopSpeech();
    };
    // Restart only when the mode or active flag changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.active, opts.mode]);

  return { ...state, pulse };
}
