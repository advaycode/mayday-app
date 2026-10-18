import { eventsBetween, type CprPlan, type TimelineEvent } from './timeline';

/**
 * Lookahead scheduling: the standard way to keep audio on time when the code
 * that drives it runs on an unreliable timer.
 *
 * A JavaScript timer fires roughly every 25 ms, but "roughly" can mean 5 ms
 * or 80 ms late when the phone is busy. So the timer never plays anything
 * itself. Each time it wakes up it looks a short way into the future (the
 * lookahead, 200 ms) and hands every event in that window to the audio
 * hardware with an exact start time. The audio hardware then plays it at
 * that time, sample-accurately, however late the timer was.
 *
 *   timer wakes (late, jittery)  ->  "beat 17 at t=9.27273 s"  ->  audio clock plays it exactly then
 */
export type Clock = { now(): number };

export class LookaheadScheduler {
  private until: number;

  constructor(
    private readonly plan: CprPlan,
    private readonly t0: number,
    private readonly clock: Clock,
    private readonly emit: (event: TimelineEvent) => void,
    private readonly lookahead = 0.2,
  ) {
    // Start just before t0 so the very first beat is included.
    this.until = t0 - 1e-6;
  }

  /** Call often (every ~25 ms). Safe to call late or twice. */
  tick(): number {
    const horizon = this.clock.now() + this.lookahead;
    if (horizon <= this.until) return 0;
    const events = eventsBetween(this.plan, this.t0, this.until, horizon);
    for (const e of events) this.emit(e);
    this.until = horizon;
    return events.length;
  }
}
