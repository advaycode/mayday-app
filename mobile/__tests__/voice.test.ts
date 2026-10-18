/**
 * Every line the app can say must have a pre-rendered clip, so nothing is
 * left to the robotic fallback voice in the middle of an emergency.
 */
import { clipKey, voiceClips, voiceDurations } from '@/audio/voiceManifest';
import systemLines from '@/audio/systemLines.json';
import { BACK_LINE, period, swapLine } from '@/cpr/timeline';
import { protocols } from '@/protocols';

function allProtocolLines(): string[] {
  return Object.values(protocols).flatMap((p) =>
    p.steps.flatMap((s) => {
      const lines = [...s.say];
      if (s.kind === 'cpr') lines.push(...s.resumeSay, ...s.reminders, ...s.breathsSay, s.depthSay);
      if (s.kind === 'hold') lines.push(...s.reminders);
      if (s.kind === 'timer') lines.push(...s.doneSay);
      return lines;
    }),
  );
}

describe('voice clips', () => {
  it('cover every protocol line', () => {
    const missing = allProtocolLines().filter((l) => !(clipKey(l) in voiceClips));
    expect(missing).toEqual([]);
  });

  it('cover every app line, confirmation and count', () => {
    const lines = [...Object.values(systemLines.lines), ...Object.values(systemLines.confirm), ...systemLines.counts];
    expect(lines.filter((l) => !(clipKey(l) in voiceClips))).toEqual([]);
  });

  it('cover the metronome lines (back to compressions, every swap minute)', () => {
    const lines = [BACK_LINE, ...Array.from({ length: 20 }, (_, i) => swapLine(i + 1)), swapLine(30)];
    expect(lines.filter((l) => !(clipKey(l) in voiceClips))).toEqual([]);
  });

  it('fit every count inside one beat at 110 per minute, with room for the click', () => {
    const tooLong = systemLines.counts.filter((c) => voiceDurations[clipKey(c)] > period(110) - 0.1);
    expect(tooLong).toEqual([]);
  });
});
