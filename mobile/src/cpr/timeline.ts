/**
 * The CPR coaching timeline: exactly when every click, count and spoken line
 * happens, as a pure function of the start time.
 *
 * The key rule: every time is computed as start + index * period. Nothing is
 * ever computed as "previous time + period", because adding a slightly wrong
 * number thousands of times is how metronomes drift. At 110 beats a minute a
 * 10-minute session is 1,100 beats; the 1,100th beat lands exactly where the
 * first one predicted it would.
 *
 * Two shapes of cycle:
 *
 *   hands-only  [ 30 counted beats ][ 6 coaching beats ]  ...repeat
 *               Compressions never stop. During the 6 coaching beats the
 *               clicks continue but the counting rests, and one short line
 *               plays ("Push hard. Push fast.").
 *
 *   30:2        [ 30 counted beats ][ breath window ]  ...repeat
 *               The breath window is a fixed, timed pause with the breath
 *               cues, kept under 10 seconds.
 *
 * Every two minutes the next cycle carries a "switch rescuers" line instead.
 */

export type CprMode = 'handsOnly' | '30:2';

export type CprPlan = {
  bpm: number;
  mode: CprMode;
  /** Reminder lines rotated through the hands-only coaching window. */
  reminders: string[];
  /** Breath cues spoken in the 30:2 breath window, in order. */
  breathsSay: string[];
  swapEveryS: number;
  /** The rescuer said they are on their own. */
  alone?: boolean;
};

export const COUNT_BEATS = 30;
export const COACH_BEATS = 6;
/** Breath window: cues at these offsets (s), then "back to compressions", then beat 1. */
export const BREATH_WINDOW_S = 7.2;
export const BREATH_OFFSETS_S = [0.1, 1.2, 3.0, 4.8];
export const BACK_LINE = 'Back to compressions.';
export const BACK_OFFSET_S = 6.0;
/** Extra seconds added to a breath window that also carries the swap line. */
export const SWAP_EXTRA_S = 2.4;
const MINUTE_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen', 'Twenty'];
/** "Four minutes. Switch with someone if you can." Pre-rendered for every value up to twenty. */
/** The 2-minute line. Alone, there is nobody to switch with, so it only marks the time. */
export function swapLine(minutes: number, alone = false): string {
  const m = Math.max(1, Math.round(minutes));
  const tail = alone ? 'Keep going.' : 'Switch with someone if you can.';
  if (m > 20) return alone ? 'Keep going. Help is coming.' : 'Keep going. Switch with someone if you can.';
  return `${MINUTE_WORDS[m]} minute${m === 1 ? '' : 's'}. ${tail}`;
}

export type TimelineEvent =
  | { kind: 'beat'; at: number; cycle: number; index: number; count: number | null }
  | { kind: 'line'; at: number; cycle: number; text: string; role: 'reminder' | 'breath' | 'back' | 'swap' }
  | { kind: 'phase'; at: number; cycle: number; phase: 'compress' | 'coach' | 'breaths' };

export function period(bpm: number) {
  return 60 / bpm;
}

type Cycle = {
  index: number;
  start: number;
  /** The swap mark this cycle carries, in minutes (only meaningful when swap is true). */
  minutes: number;
  /** Seconds from cycle start to the end of the counted beats. */
  countEnd: number;
  duration: number;
  swap: boolean;
};

/**
 * Walk cycles from the start. Hands-only cycles are all the same length; a
 * 30:2 cycle is longer when it carries the swap line.
 */
export function* cycles(plan: CprPlan, t0: number): Generator<Cycle> {
  const p = period(plan.bpm);
  const countEnd = COUNT_BEATS * p;
  const baseCycle = plan.mode === 'handsOnly' ? (COUNT_BEATS + COACH_BEATS) * p : countEnd + BREATH_WINDOW_S;
  let swapsSoFar = 0;
  let extendedSoFar = 0;
  for (let index = 0; ; index++) {
    // Start of cycle k is t0 + k whole cycles + any swap extensions before it.
    // A product, not a running sum, so rounding cannot build up.
    const start = t0 + index * baseCycle + extendedSoFar * SWAP_EXTRA_S;
    // Swaps are anchored to the clock (2:00, 4:00, 6:00...), not to the
    // previous swap, so they cannot creep later and later. Each one happens
    // at the first cycle boundary after its mark.
    const mark = (swapsSoFar + 1) * plan.swapEveryS;
    const swap = start + countEnd - t0 >= mark;
    const extra = plan.mode === '30:2' && swap ? SWAP_EXTRA_S : 0;
    yield { index, start, countEnd, duration: baseCycle + extra, swap, minutes: mark / 60 };
    if (swap) swapsSoFar++;
    if (extra) extendedSoFar++;
  }
}

export function eventsOfCycle(plan: CprPlan, c: Cycle): TimelineEvent[] {
  const p = period(plan.bpm);
  const out: TimelineEvent[] = [{ kind: 'phase', at: c.start, cycle: c.index, phase: 'compress' }];
  for (let i = 0; i < COUNT_BEATS; i++) {
    out.push({ kind: 'beat', at: c.start + i * p, cycle: c.index, index: i, count: i + 1 });
  }
  const tailStart = c.start + c.countEnd;
  if (plan.mode === 'handsOnly') {
    out.push({ kind: 'phase', at: tailStart, cycle: c.index, phase: 'coach' });
    for (let i = 0; i < COACH_BEATS; i++) {
      out.push({ kind: 'beat', at: c.start + (COUNT_BEATS + i) * p, cycle: c.index, index: COUNT_BEATS + i, count: null });
    }
    const text = c.swap ? swapLine(c.minutes, plan.alone) : plan.reminders[c.index % plan.reminders.length];
    out.push({ kind: 'line', at: tailStart, cycle: c.index, text, role: c.swap ? 'swap' : 'reminder' });
  } else {
    out.push({ kind: 'phase', at: tailStart, cycle: c.index, phase: 'breaths' });
    let offset = 0;
    if (c.swap) {
      out.push({ kind: 'line', at: tailStart, cycle: c.index, text: swapLine(c.minutes, plan.alone), role: 'swap' });
      offset = SWAP_EXTRA_S;
    }
    plan.breathsSay.forEach((text, i) => {
      const at = tailStart + offset + (BREATH_OFFSETS_S[i] ?? BREATH_OFFSETS_S[BREATH_OFFSETS_S.length - 1] + i);
      out.push({ kind: 'line', at, cycle: c.index, text, role: 'breath' });
    });
    out.push({ kind: 'line', at: tailStart + offset + BACK_OFFSET_S, cycle: c.index, text: BACK_LINE, role: 'back' });
  }
  return out.sort((a, b) => a.at - b.at);
}

/** All events with from < at <= to. */
export function eventsBetween(plan: CprPlan, t0: number, from: number, to: number): TimelineEvent[] {
  const out: TimelineEvent[] = [];
  for (const c of cycles(plan, t0)) {
    if (c.start > to) break;
    if (c.start + c.duration <= from) continue;
    for (const e of eventsOfCycle(plan, c)) if (e.at > from && e.at <= to) out.push(e);
  }
  return out;
}

/** Where we are at time t: which cycle, which phase, which count is showing. */
export function positionAt(plan: CprPlan, t0: number, t: number) {
  const p = period(plan.bpm);
  for (const c of cycles(plan, t0)) {
    if (t < c.start + c.duration) {
      const local = t - c.start;
      if (local < 0) return { cycle: c.index, phase: 'compress' as const, count: 0, beatIndex: -1, swap: c.swap };
      if (local < c.countEnd) {
        const i = Math.floor(local / p);
        return { cycle: c.index, phase: 'compress' as const, count: i + 1, beatIndex: i, swap: c.swap };
      }
      if (plan.mode === 'handsOnly') {
        const i = Math.floor(local / p);
        return { cycle: c.index, phase: 'coach' as const, count: null, beatIndex: i, swap: c.swap };
      }
      return { cycle: c.index, phase: 'breaths' as const, count: null, beatIndex: -1, swap: c.swap };
    }
  }
  throw new Error('unreachable');
}
