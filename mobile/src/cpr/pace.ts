import type { CompressionReading } from '@/sensors/compressions';
import { median } from '@/sensors/dsp';

import type { CoachState } from './useCprCoach';

/**
 * What the coach says about the rescuer's compressions, from the phone's
 * reading of them (sensors/compressions.ts).
 *
 * It speaks in the hands-only coaching slot (the six beats after each 30
 * counts, which otherwise carry "Push hard. Push fast."), so it never talks
 * over a count. Three things it can say, and only these:
 *
 *   faster   the last 8 s ran under 100 a minute
 *   slower   the last 8 s ran over 120 a minute (2025 guidelines: 100-120)
 *   keep     compressions were felt, then none for 4 s while they should be going
 *
 * It never tells anyone to stop, never comments on depth, and stays quiet
 * unless it has clearly felt compressions for at least 4 of the last 30
 * seconds: a phone that cannot feel them from where it lies must not nag.
 */
export type PaceAdvice = 'faster' | 'slower' | 'keep';

export const PACE_LINES: Record<PaceAdvice, string> = {
  faster: 'Faster. Push on every click.',
  slower: 'A little slower. Push on every click.',
  keep: "Keep pushing. Don't stop.",
};

export const LOW_PER_MIN = 100;
export const HIGH_PER_MIN = 120;
const TRUST_S = 4;
const TRUST_WITHIN_S = 30;
const RATE_OVER_S = 8;
const STOPPED_S = 4;

type Entry = { t: number; reading: CompressionReading; phase: CoachState['phase'] };

export type PaceSummary = {
  /** The phone has clearly felt compressions recently, so it may speak. */
  trusted: boolean;
  /** Median rate over the last 8 s, when felt. */
  perMin: number | null;
  advice: PaceAdvice | null;
};

export class PaceCoach {
  private log: Entry[] = [];

  /** Add a reading (about twice a second). `t` in seconds, any clock, increasing. */
  feed(t: number, reading: CompressionReading, phase: CoachState['phase']) {
    this.log.push({ t, reading, phase });
    while (this.log.length && this.log[0].t < t - 60) this.log.shift();
  }

  summary(t: number): PaceSummary {
    const recent = this.log.filter((e) => e.t >= t - TRUST_WITHIN_S);
    let felt = 0;
    for (let k = 1; k < recent.length; k++) if (recent[k].reading.status === 'compressing') felt += recent[k].t - recent[k - 1].t;
    const trusted = felt >= TRUST_S;
    const rates = this.log.filter((e) => e.t >= t - RATE_OVER_S && e.reading.status === 'compressing' && e.reading.perMin !== null).map((e) => e.reading.perMin!);
    const perMin = rates.length >= 4 ? median(rates) : null;
    if (!trusted) return { trusted, perMin, advice: null };

    // Stopped: nothing felt for 4 s, during compressions (not the 30:2 breath pause).
    const last = this.log.filter((e) => e.t >= t - STOPPED_S);
    const covers = last.length >= 3 && last[0].t <= t - STOPPED_S + 1;
    if (covers && last.every((e) => e.reading.status !== 'compressing' && e.phase !== 'breaths' && e.phase !== 'intro')) {
      return { trusted, perMin: null, advice: 'keep' };
    }
    if (perMin !== null && perMin < LOW_PER_MIN) return { trusted, perMin, advice: 'faster' };
    if (perMin !== null && perMin > HIGH_PER_MIN) return { trusted, perMin, advice: 'slower' };
    return { trusted, perMin, advice: null };
  }
}
