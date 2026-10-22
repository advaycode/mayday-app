import systemLines from '@/audio/systemLines.json';
import { PACE_LINES, type PaceSummary } from '@/cpr/pace';
import { reduce, currentStep } from '@/protocols/engine';
import type { BreathReading } from '@/sensors/analyze';
import { getLive, resetLive, setBreath, setPace } from '@/sensors/live';
import type { SoundReading } from '@/sensors/sounds';
import { route } from '@/voice/router';
import type { RouterSlots } from '@/voice/routerSchema';
import { afterOpen, sensorAsk, sensorReply, type Where } from '@/voice/sensorTalk';

/**
 * The voice assistant and the phone's sensors (voice/sensorTalk.ts), and the
 * router bug this work found: asking about breathing used to count as
 * "breathing normally".
 */
const L = systemLines.lines;

describe('a question or doubt about breathing is never "breathing normally"', () => {
  const doubts = [
    'is he breathing?',
    'is she breathing normally',
    'are they still breathing',
    'how do I know if he is breathing',
    "I can't tell if she's breathing",
    "I'm not sure if he's breathing",
    "I don't know whether my dad is breathing",
    'check his breathing',
  ];
  for (const q of doubts) {
    it(`"${q}"`, () => {
      const r = route(q, { inProtocol: true, known: { conscious: 'false' } });
      expect(r.slots.breathing).toBeUndefined();
      expect(r.intent).not.toBe('breathing');
      expect(r.protocol_id).not.toBe('recovery_position');
    });
  }

  it('at "Are they breathing normally?", "how do I know if he is breathing" no longer answers yes', () => {
    let st = reduce(null, { type: 'start', protocolId: 'cpr_adult', slots: { conscious: 'false' }, at: 0 }).state!;
    expect(currentStep(st)?.id).toBe('breathing');
    const r = route('how do I know if he is breathing', { inProtocol: true, known: st.slots as RouterSlots });
    if (r.intent) st = reduce(st, { type: 'intent', intent: r.intent, at: 0 }).state!;
    expect(currentStep(st)?.id).toBe('breathing');
  });

  it('plain statements still work, both ways', () => {
    expect(route("he's not breathing", {}).slots.breathing).toBe('abnormal');
    expect(route("I'm not sure what to do, he's not breathing", {}).slots.breathing).toBe('abnormal');
    expect(route('she is gasping', {}).slots.breathing).toBe('abnormal');
    expect(route('he is breathing', {}).slots.breathing).toBe('normal');
    expect(route('she started breathing again', { inProtocol: true }).intent).toBe('breathing');
  });
});

describe('what the assistant hears as a sensor request', () => {
  const atBreathing: Where = { stepKind: 'ask', breathingStep: true };
  const inCpr: Where = { stepKind: 'cpr', breathingStep: false };
  const elsewhere: Where = { stepKind: 'do', breathingStep: false };

  it.each([
    ['check his breathing', atBreathing, 'check_breathing'],
    ['can you check', atBreathing, 'check_breathing'],
    ['use the phone', atBreathing, 'check_breathing'],
    ['is she breathing?', atBreathing, 'check_breathing'],
    ["I can't tell", atBreathing, 'check_breathing'],
    ['what did the phone see', atBreathing, 'breathing_result'],
    ['how am I doing', inCpr, 'pace'],
    ['am I going too slow', inCpr, 'pace'],
    ['is this fast enough', inCpr, 'pace'],
    ['should I push faster', inCpr, 'pace'],
  ] as const)('"%s" -> %s', (text, where, ask) => {
    expect(sensorAsk(text, where)).toBe(ask);
  });

  it.each([
    ['how am I doing', elsewhere],
    ['check his breathing', elsewhere],
    ['how deep do I push', inCpr],
    ['the AED is here', inCpr],
    ['yes', atBreathing],
    ['no', atBreathing],
  ] as const)('not "%s" there', (text, where) => {
    expect(sensorAsk(text, where)).toBeNull();
  });
});

describe('what it says', () => {
  const atBreathing: Where = { stepKind: 'ask', breathingStep: true };
  const inCpr: Where = { stepKind: 'cpr', breathingStep: false };
  const breath = (status: BreathReading['status'], perMin: number | null = null) => ({ status, perMin, why: status }) as BreathReading;
  const pace = (s: Partial<PaceSummary>): PaceSummary => ({ trusted: true, perMin: 110, advice: null, ...s });
  beforeEach(resetLive);

  it('pace: from what the phone feels', () => {
    expect(sensorReply('pace', getLive(), inCpr)!.lines).toEqual([L.paceUnfelt]);
    setPace('off', pace({}));
    expect(sensorReply('pace', getLive(), inCpr)!.lines).toEqual([L.paceUnfelt]);
    setPace('on', pace({ trusted: false }));
    expect(sensorReply('pace', getLive(), inCpr)!.lines).toEqual([L.paceUnfelt]);
    setPace('on', pace({}));
    expect(sensorReply('pace', getLive(), inCpr)!.lines).toEqual([L.paceGood]);
    for (const advice of ['faster', 'slower', 'keep'] as const) {
      setPace('on', pace({ advice }));
      expect(sensorReply('pace', getLive(), inCpr)!.lines).toEqual([PACE_LINES[advice]]);
    }
  });

  it('the last check, said the same way, and never "breathing normally"', () => {
    setBreath(breath('none'), null);
    expect(sensorReply('breathing_result', getLive(), atBreathing)!.lines).toEqual([L.sensorNone]);
    setBreath(breath('irregular'), { status: 'gasps' } as SoundReading);
    expect(sensorReply('breathing_result', getLive(), atBreathing)!.lines).toEqual([L.soundGasp, L.soundGaspNot, L.sensorNone]);
    setBreath(breath('regular', 14), { status: 'gasps' } as SoundReading);
    expect(sensorReply('breathing_result', getLive(), atBreathing)!.lines).toEqual([L.sensorMoving]);
    setBreath(breath('moving'), null);
    expect(sensorReply('breathing_result', getLive(), atBreathing)!.lines).toEqual([L.sensorUnsure]);
  });

  it('no check yet: at the breathing question it checks; elsewhere it leaves the question to the answer cards', () => {
    expect(sensorReply('breathing_result', getLive(), atBreathing)).toMatchObject({ openCheck: true });
    expect(sensorReply('breathing_result', getLive(), { stepKind: 'do', breathingStep: false })).toBeNull();
    expect(sensorReply('check_breathing', getLive(), atBreathing)).toMatchObject({ openCheck: true });
  });

  it('opening the check: silent if it opened (it speaks its own steps), a tap where needed, the guideline where there is none', () => {
    expect(afterOpen('started')).toEqual([]);
    expect(afterOpen('needs-tap')).toEqual([L.sensorTap]);
    expect(afterOpen('unavailable')).toEqual([L.sensorDoubt]);
  });

  it('nothing it can say tells the rescuer someone is breathing normally', () => {
    const possible = [L.paceUnfelt, L.paceGood, ...Object.values(PACE_LINES), L.sensorNone, L.sensorMoving, L.sensorUnsure, L.soundGasp, L.soundGaspNot, L.sensorTap, L.sensorDoubt];
    for (const line of possible) expect(line.toLowerCase()).not.toMatch(/\b(is|are) breathing\b|breathing (normally|fine|ok)\b|\bstop (cpr|compressions|pushing)\b/);
  });
});
