/**
 * Metronome timing. The claim we make in the video is "the beat does not
 * drift". This test is the evidence: ten simulated minutes, driven by a
 * deliberately terrible JavaScript timer, against an ideal metronome.
 */
import * as fs from 'fs';
import * as path from 'path';

import { LookaheadScheduler } from '@/cpr/scheduler';
import { COUNT_BEATS, COACH_BEATS, eventsBetween, period, positionAt, swapLine, type CprPlan, type TimelineEvent } from '@/cpr/timeline';

const handsOnly: CprPlan = {
  bpm: 110,
  mode: 'handsOnly',
  reminders: ['Push hard. Push fast.', 'Center of the chest.'],
  breathsSay: ['Two breaths.'],
  swapEveryS: 120,
};
const withBreaths: CprPlan = { ...handsOnly, mode: '30:2', breathsSay: ['Two breaths.', 'Tilt the head. Lift the chin.', 'Pinch the nose. Breathe.', 'Breathe.'] };

// A seeded random generator so the "bad timer" is the same on every run.
function rng(seed: number) {
  return () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}

/** Drive the scheduler with a timer that fires every 25 ms plus up to 60 ms of random lateness. */
function simulate(plan: CprPlan, seconds: number) {
  let now = 0;
  const events: TimelineEvent[] = [];
  const scheduler = new LookaheadScheduler(plan, 0.5, { now: () => now }, (e) => events.push(e), 0.2);
  const random = rng(42);
  let ticks = 0;
  while (now < seconds) {
    scheduler.tick();
    ticks++;
    now += 0.025 + random() * 0.06;
  }
  return { events, ticks };
}

describe('metronome timing over 10 minutes', () => {
  const TEN_MIN = 600;

  it('places every hands-only beat exactly on the ideal grid, however late the timer runs', () => {
    const { events, ticks } = simulate(handsOnly, TEN_MIN);
    const beats = events.filter((e) => e.kind === 'beat');
    const p = period(110);
    let maxError = 0;
    beats.forEach((b, i) => {
      // Hands-only never pauses, so beat i is simply t0 + i * period.
      const ideal = 0.5 + i * p;
      maxError = Math.max(maxError, Math.abs(b.at - ideal));
    });
    const lastTick = beats[beats.length - 1].at;
    // 110 per minute for ten minutes is 1100 beats.
    expect(beats.length).toBeGreaterThanOrEqual(1099);
    expect(maxError).toBeLessThan(1e-9);
    expect(new Set(beats.map((b) => b.at)).size).toBe(beats.length); // nothing scheduled twice

    // The alternative this replaces: a setTimeout metronome that schedules
    // each beat "one period after the last callback". Same bad timer.
    const random = rng(42);
    let naive = 0.5;
    for (let i = 1; i < beats.length; i++) naive += p + random() * 0.004; // a typical 0 to 4 ms of lateness per beat
    const naiveDrift = naive - (0.5 + (beats.length - 1) * p);

    const report = {
      simulatedSeconds: TEN_MIN,
      bpm: 110,
      beats: beats.length,
      timerTicks: ticks,
      timerJitterMs: '25 + 0..60',
      audioClockScheduler: { maxErrorMs: maxError * 1000, endDriftMs: (lastTick - (0.5 + (beats.length - 1) * p)) * 1000 },
      naiveSetTimeout: { endDriftMs: Math.round(naiveDrift * 1000), equivalentBpmAtEnd: +(60 / (p + naiveDrift / beats.length)).toFixed(2) },
    };
    fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'metronome-drift.json'), JSON.stringify(report, null, 2));
    expect(naiveDrift).toBeGreaterThan(1); // the naive version is over a second late after ten minutes
  });

  it('keeps every beat inside the 100 to 120 per minute band (the gaps are exactly 545 ms)', () => {
    const beats = eventsBetween(handsOnly, 0, -1, 120).filter((e) => e.kind === 'beat');
    for (let i = 1; i < beats.length; i++) {
      const bpm = 60 / (beats[i].at - beats[i - 1].at);
      expect(bpm).toBeGreaterThanOrEqual(100);
      expect(bpm).toBeLessThanOrEqual(120);
    }
  });

  it('counts 1 to 30, then gives 6 quiet coaching beats with one spoken reminder (hands-only)', () => {
    const events = eventsBetween(handsOnly, 0, -1, (COUNT_BEATS + COACH_BEATS) * period(110) - 0.001);
    const counts = events.filter((e) => e.kind === 'beat' && e.count !== null).map((e) => (e.kind === 'beat' ? e.count : 0));
    expect(counts).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
    const quiet = events.filter((e) => e.kind === 'beat' && e.count === null);
    expect(quiet).toHaveLength(COACH_BEATS);
    expect(events.filter((e) => e.kind === 'line').map((e) => (e.kind === 'line' ? e.text : ''))).toEqual(['Push hard. Push fast.']);
  });

  it('30:2 pauses for breaths under 10 seconds, then says back to compressions before beat 1', () => {
    const { events } = simulate(withBreaths, 300);
    const beats = events.filter((e): e is Extract<TimelineEvent, { kind: 'beat' }> => e.kind === 'beat');
    for (let i = 1; i < beats.length; i++) {
      const gap = beats[i].at - beats[i - 1].at;
      if (gap > period(110) + 1e-6) {
        expect(beats[i].count).toBe(1);
        expect(gap - period(110)).toBeLessThan(10); // pause in compressions under 10 s
      }
    }
    const lines = events.filter((e) => e.kind === 'line').map((e) => (e.kind === 'line' ? e.text : ''));
    expect(lines.slice(0, 5)).toEqual(['Two breaths.', 'Tilt the head. Lift the chin.', 'Pinch the nose. Breathe.', 'Breathe.', 'Back to compressions.']);
  });

  it('prompts a rescuer swap about every two minutes, saying how long it has been', () => {
    const { events } = simulate(handsOnly, 600);
    const swaps = events.filter((e) => e.kind === 'line' && e.role === 'swap');
    expect(swaps.length).toBe(4);
    expect(swaps.map((e) => (e.kind === 'line' ? e.text : ''))).toEqual([swapLine(2), swapLine(4), swapLine(6), swapLine(8)]);
    // ...and each lands within 20 s after its own mark (2:00, 4:00, ...), so they never creep later.
    swaps.forEach((s, i) => {
      const sinceStart = s.at - 0.5;
      expect(sinceStart).toBeGreaterThanOrEqual(120 * (i + 1));
      expect(sinceStart).toBeLessThan(120 * (i + 1) + 20);
    });
  });

  it('can say where we are at any moment (what the screen and haptics read)', () => {
    const p = period(110);
    expect(positionAt(handsOnly, 0, 0.0001)).toMatchObject({ phase: 'compress', count: 1 });
    expect(positionAt(handsOnly, 0, 29.5 * p)).toMatchObject({ phase: 'compress', count: 30 });
    expect(positionAt(handsOnly, 0, 30.5 * p)).toMatchObject({ phase: 'coach', count: null });
    expect(positionAt(handsOnly, 0, 36.2 * p)).toMatchObject({ phase: 'compress', count: 1, cycle: 1 });
    expect(positionAt(withBreaths, 0, 30 * p + 1)).toMatchObject({ phase: 'breaths' });
  });
});
