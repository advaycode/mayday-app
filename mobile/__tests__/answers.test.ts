/**
 * Answers to open questions: the right card for the right question, inside
 * the right protocol, and an honest "I'm not sure" otherwise.
 */
import { answer, cards } from '@/voice/answer';
import { sources } from '@/protocols';

const words = (s: string) => s.trim().split(/\s+/).length;

describe('answer cards', () => {
  it('are well formed: known source, short lines, quotes when verified, no dashes', () => {
    for (const c of cards) {
      expect(sources[c.source]).toBeDefined();
      for (const line of c.say) {
        expect([c.id, line, words(line) <= 12]).toEqual([c.id, line, true]);
        expect(line).not.toMatch(/[\u2013\u2014]/);
      }
      if (c.verified) expect(c.quote).toBeTruthy();
      else expect(c.note).toBeTruthy();
    }
  });

  const cases: [string, string | null, string | null][] = [
    // question, protocol running, expected card (null = honest fallback)
    ['should I move him', 'cpr_adult', 'move_patient'],
    ['how deep do I push', 'cpr_adult', 'cpr_depth_rate_adult'],
    ['how deep do I push', 'cpr_child', 'cpr_depth_rate_young'],
    ['how fast should I go', 'cpr_adult', 'cpr_depth_rate_adult'],
    ['do I have to take her bra off', 'cpr_adult', 'aed_bra'],
    ['he is gasping is that breathing', 'cpr_adult', 'cpr_gasping'],
    ['when can I stop', 'cpr_infant', 'cpr_stop'],
    ['can I take the tourniquet off', 'bleeding', 'tourniquet_loosen'],
    ['do I have to take her bra off', 'bleeding', null],
    ['should I put ice on it', 'burns', 'burn_ice'],
    ['how long do I keep it under the water', 'burns', 'burn_how_long'],
    ['what if she is pregnant', 'choking', 'choking_pregnant'],
    ['what if she is pregnant', 'cpr_adult', null],
    ['should I give him more narcan', 'opioid_overdose', 'naloxone_second'],
    ['is he going to die', 'cpr_adult', null],
    ['is it safe to go near the car', null, 'scene_safety'],
    // Near misses that must NOT answer: one shared word is not a match.
    ['should I give him water', 'cpr_adult', null],
    ['should I take his shirt off', 'cpr_adult', null],
    ['can I give him aspirin', 'stroke', null],
  ];

  it.each(cases)('"%s" during %s -> %s', (question, protocol, expected) => {
    const a = answer(question, protocol, protocol?.startsWith('cpr') ?? false);
    expect(a.kind === 'card' ? a.card.id : null).toBe(expected);
  });

  it('says to keep going and ask the dispatcher when it does not know, during CPR', () => {
    expect(answer('is he going to die', 'cpr_adult', true).lines).toEqual(["I don't know. Keep doing compressions."]);
  });
});
