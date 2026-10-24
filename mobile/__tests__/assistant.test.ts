/**
 * The voice assistant's conversation: our own echo against real answers,
 * questions mid-step, 911 by voice, and who is being helped.
 */
import systemLines from '@/audio/systemLines.json';
import { answer } from '@/voice/answer';
import { initialContext, learn, personalConfirm } from '@/voice/adapt';
import { dispatchAsk, dispatchLines } from '@/voice/dispatchTalk';
import { echoKind, isEchoPartial, withoutReassurance } from '@/voice/echo';
import { route, unsureAboutBreathing } from '@/voice/router';
import { answersStep, pickHeard, quickAnswer } from '@/voice/understand';
import type { Fix } from '@/location/location';

const ASKED = ['Watch his chest.', 'Gasping is not breathing.', 'Is he breathing normally?'];

describe('echo guard', () => {
  it('hears "he\'s not breathing" right after asking about breathing', () => {
    expect(echoKind("he's not breathing", ASKED)).toBe('suspect');
    expect(echoKind('no he is not breathing', ASKED)).not.toBe('echo');
  });

  it('still drops our own lines played back word for word', () => {
    expect(echoKind('gasping is not breathing', ASKED)).toBe('echo');
    expect(echoKind('is he breathing normally', ASKED)).toBe('echo');
    expect(echoKind('watch his chest gasping is not breathing', ASKED)).toBe('echo');
    expect(echoKind('seventeen eighteen nineteen', [])).toBe('echo');
  });

  it('drops a long line of ours misheard in one word', () => {
    expect(echoKind('watch his chest gasping is knot breathing is he breathing', ASKED)).toBe('echo');
  });

  it('keeps one-word answers and new words', () => {
    expect(echoKind('no', ASKED)).toBe('clear');
    expect(echoKind('yes', ['Yes or no?'])).toBe('clear');
    expect(echoKind('she threw up', ASKED)).toBe('clear');
  });

  it('hides a fragment of our own voice while it is still arriving', () => {
    expect(isEchoPartial('tell', ["Tell me what's happening."])).toBe(true);
    expect(isEchoPartial('my dad', ["Tell me what's happening."])).toBe(false);
  });

  it('a suspect transcript can only lead to more care', () => {
    const toCare = withoutReassurance(route("he's not breathing", { inProtocol: true }));
    expect(toCare.intent).toBe('not_breathing');
    const reassuring = withoutReassurance(route('is he breathing yes he is breathing', { inProtocol: true }));
    expect(reassuring.slots.breathing).toBeUndefined();
    expect(['yes', 'breathing']).not.toContain(reassuring.intent);
  });
});

describe('questions mid-step', () => {
  it('answers what an AED is, anywhere', () => {
    expect(answer("what's an AED", 'cpr_adult', false).lines[0]).toMatch(/shocks the heart/);
    expect(answer('what is a defibrillator', 'bleeding', false).lines[0]).toMatch(/shocks the heart/);
  });

  it('does not make up an answer', () => {
    expect(answer('is he going to die', 'stroke', false).lines).toEqual([systemLines.lines.groundFallbackGeneral]);
  });

  it('"I don\'t know what to do" asks for the step again, and is not doubt about breathing', () => {
    expect(route("I'm scared I don't know what to do", { inProtocol: true }).intent).toBe('what_now');
    expect(unsureAboutBreathing("i'm scared i do not know what to do")).toBe(false);
    expect(unsureAboutBreathing('i do not know if he is breathing')).toBe(true);
  });
});

describe('911 by voice', () => {
  const fix: Fix = { lat: 28.1866, lon: -82.3473, accuracy: 18, address: '4200 Main Street, Wesley Chapel', at: 0, source: 'gps' };

  it('knows the ways people ask', () => {
    expect(dispatchAsk('what do I tell 911')).toBe('script');
    expect(dispatchAsk('what should I say to the dispatcher')).toBe('script');
    expect(dispatchAsk('call 911')).toBe('call');
    expect(dispatchAsk('can you call an ambulance')).toBe('call');
    expect(dispatchAsk('where am I')).toBe('where');
    expect(dispatchAsk("what's my address")).toBe('where');
  });

  it('leaves the paramedics arriving and plain steps alone', () => {
    expect(dispatchAsk('the ambulance is here')).toBeNull();
    expect(dispatchAsk('paramedics arrived')).toBeNull();
    expect(dispatchAsk('he is not breathing')).toBeNull();
    expect(dispatchAsk('done')).toBeNull();
  });

  it('never offers to call; reads the address and what happened', () => {
    const lines = dispatchLines('call', fix, 'Adult (age not given), unresponsive. CPR started 1:52 PM.');
    expect(lines[0]).toBe(systemLines.lines.cantCall);
    expect(lines).toContain('4200 Main Street, Wesley Chapel.');
    expect(lines[lines.length - 1]).toBe('Adult, unresponsive. CPR started 1:52 PM.');
    expect(dispatchLines('where', fix, '')).toEqual(["You're at 4200 Main Street, Wesley Chapel."]);
    expect(dispatchLines('where', null, '')).toEqual([systemLines.lines.noAddress]);
  });
});

describe('who is being helped', () => {
  it('"my friend collapsed" is your friend, they until we hear otherwise', () => {
    const ctx = learn(initialContext, 'my friend just collapsed');
    expect(ctx.relation).toBe('friend');
    expect(personalConfirm(systemLines.confirm.cpr_check, ctx)).toBe("Your friend collapsed. Let's check them first.");
    expect(learn(ctx, 'she is not breathing').pronoun).toBe('she');
  });
});

describe('echo guard after Mayday has repeated itself', () => {
  const said = ["Your dad collapsed. Let's check him first.", 'Watch his chest.', 'Gasping is not breathing.', 'Is he breathing normally?', "I'm right here with you.", 'Watch his chest.', 'Gasping is not breathing.', 'Is he breathing normally?', 'An AED is a box that shocks the heart back into rhythm.', 'Is he breathing normally?'];
  it('still hears the answer', () => {
    expect(echoKind("no he's not breathing", said)).not.toBe('echo');
    expect(echoKind('gasping is not breathing is he breathing normally', said)).toBe('echo');
  });
});

describe('choosing among the recognizer guesses', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { getStep } = require('@/protocols') as typeof import('@/protocols');
  const breathing = getStep('cpr_adult', 'breathing');
  const IN = { inProtocol: true };

  it('takes a runner-up that answers the question when the best guess does not', () => {
    expect(pickHeard(['keys not reading', "he's not breathing"], IN, breathing).index).toBe(1);
  });
  it('keeps the best guess when it already answers', () => {
    expect(pickHeard(["he's not breathing", "he's breathing"], IN, breathing).index).toBe(0);
  });
  it('never takes a runner-up that reassures', () => {
    expect(pickHeard(['the reading', "yes he's breathing"], IN, breathing).index).toBe(0);
    expect(pickHeard(['he is', 'he is breathing normally'], IN, breathing).index).toBe(0);
  });
  it('acts early only on short answers that lead to more care', () => {
    expect(quickAnswer('no', breathing)).toBe(true);
    expect(quickAnswer('not breathing', breathing)).toBe(true);
    expect(quickAnswer('yes', breathing)).toBe(false);
    expect(quickAnswer('no I think he might be breathing a bit', breathing)).toBe(false);
  });
  it('a fact answers the question on screen', () => {
    expect(answersStep(route("he's gone blue", IN), breathing)).toBe(true);
    expect(answersStep(route('yes he is gasping', IN), breathing)).toBe(true);
    expect(route('yes he is gasping', IN).intent).toBeNull();
  });
});

describe('quick guidance for emergencies with no protocol', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { guideFor, rank } = require('@/voice/answer') as typeof import('@/voice/answer');
  it.each([
    ["my brother is having a fit", 'guide_seizure'],
    ["he's shaking all over on the floor", 'guide_seizure'],
    ['her face is swelling up, she is allergic', 'guide_allergy'],
    ["he's diabetic and confused", 'guide_low_sugar'],
    ['i think he is having a heart attack', 'guide_chest_pain'],
    ['he got too hot outside and is confused', 'guide_heat'],
  ])('"%s" -> %s', (say, id) => {
    expect(route(say).protocol_id === null || route(say).confidence < 0.7).toBe(true);
    expect(guideFor(say)?.id).toBe(id);
  });
  it('is never given in the middle of a protocol', () => {
    expect(rank('chest pain', 'cpr_adult').some((r) => r.card.intakeOnly)).toBe(false);
  });
  it('every guide says to call 911 or when to', () => {
    for (const id of ['guide_seizure', 'guide_allergy', 'guide_low_sugar', 'guide_heat', 'guide_chest_pain']) {
      const card = guideFor(id.replace('guide_', '').replace('_', ' '));
      expect(card === null || card.say.join(' ').includes('911')).toBe(true);
    }
  });
});
