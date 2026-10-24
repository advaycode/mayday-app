/**
 * English as people actually speak it in an emergency: accents and dialects
 * (Scottish, Irish, Australian, Nigerian Pidgin, Indian, Singaporean,
 * Southern US, AAVE), fillers, and the words speech recognizers most often
 * mishear. The recognizer is the phone's own; this tests what Mayday does
 * with what it hears. DIALECT_REPORT=1 prints the score.
 */
import { route, type RouteContext } from '@/voice/router';

type Case = { say: string; expect: string; ctx?: RouteContext; dialect: string };

const IN: RouteContext = { inProtocol: true };

/** What a route means, in one word: the protocol family in intake, the intent (or answered slot) in a protocol. */
function meaning(say: string, ctx?: RouteContext): string {
  const r = route(say, ctx);
  if (ctx?.inProtocol) {
    if (r.intent) return r.intent;
    if (r.slots.breathing === 'abnormal') return 'not_breathing';
    if (r.slots.conscious === 'false') return 'unresponsive';
    return 'nothing';
  }
  if (!r.protocol_id) return 'nothing';
  return r.protocol_id.replace(/_(adult|child|infant)$/, '').replace('recovery_position', 'cpr');
}

const CASES: Case[] = [
  // Starting: what happened.
  { say: "me mate's collapsed, he ain't breathin", expect: 'cpr', dialect: 'UK / Southern US' },
  { say: "she's after collapsing in the kitchen", expect: 'cpr', dialect: 'Irish' },
  { say: "he keeled over and he's not moving", expect: 'cpr', dialect: 'US' },
  { say: 'my granny just blacked out', expect: 'cpr', dialect: 'UK' },
  { say: "he's gone blue and he's not breathing", expect: 'cpr', dialect: 'UK' },
  { say: 'she is not breathing properly what to do', expect: 'cpr', dialect: 'Indian' },
  { say: 'abeg help my brother no dey breathe', expect: 'cpr', dialect: 'Nigerian Pidgin' },
  { say: 'he fainted and he no wake up', expect: 'cpr', dialect: 'Nigerian / Caribbean' },
  { say: 'she flaked out on the floor', expect: 'cpr', dialect: 'Australian' },
  { say: "he cannae breathe he's choking on a sweetie", expect: 'choking', dialect: 'Scottish' },
  { say: 'my wee boy is chokin', expect: 'choking', dialect: 'Scottish' },
  { say: "she's chalking on food", expect: 'choking', dialect: 'misheard' },
  { say: 'something stuck in his throat already lah', expect: 'choking', dialect: 'Singaporean' },
  { say: "he's bleedin real bad from his leg", expect: 'bleeding', dialect: 'Southern US' },
  { say: 'there is blood everywhere he got cut', expect: 'bleeding', dialect: 'US' },
  { say: 'she burnt her hand on the cooker', expect: 'burns', dialect: 'UK' },
  { say: "his face is droopin and he's talkin funny", expect: 'stroke', dialect: 'Southern US' },
  { say: "i think he OD'd on fentanol", expect: 'opioid_overdose', dialect: 'misheard' },
  { say: "she took too many pills and won't wake up", expect: 'opioid_overdose', dialect: 'US' },
  { say: 'um uh he is like not breathing', expect: 'cpr', dialect: 'fillers' },

  // Answering "Breathing normally?"
  { say: "nah he ain't breathin", expect: 'not_breathing', ctx: IN, dialect: 'AAVE / Southern US' },
  { say: 'naw', expect: 'no', ctx: IN, dialect: 'US' },
  { say: 'nae', expect: 'no', ctx: IN, dialect: 'Scottish' },
  { say: 'yeah nah', expect: 'no', ctx: IN, dialect: 'Australian' },
  { say: 'nah yeah', expect: 'yes', ctx: IN, dialect: 'Australian' },
  { say: 'aye', expect: 'yes', ctx: IN, dialect: 'Scottish' },
  { say: 'mhm', expect: 'yes', ctx: IN, dialect: 'US' },
  { say: 'ja', expect: 'yes', ctx: IN, dialect: 'South African' },
  { say: 'she no dey breathe', expect: 'not_breathing', ctx: IN, dialect: 'Nigerian Pidgin' },
  { say: "he's not breathin' at all", expect: 'not_breathing', ctx: IN, dialect: 'Irish / UK' },
  { say: "he's gone blue", expect: 'not_breathing', ctx: IN, dialect: 'UK' },
  { say: "he's just gasping", expect: 'not_breathing', ctx: IN, dialect: 'US' },
  { say: "he's not breeding", expect: 'not_breathing', ctx: IN, dialect: 'misheard' },
  { say: 'not breathing again', expect: 'not_breathing', ctx: IN, dialect: 'Nigerian / Indian ("again" = any more)' },

  // Answering "Do they respond?"
  { say: "he's out cold", expect: 'unresponsive', ctx: IN, dialect: 'US' },
  { say: "she don't wake up", expect: 'unresponsive', ctx: IN, dialect: 'AAVE' },
  { say: 'he is not responding only', expect: 'unresponsive', ctx: IN, dialect: 'Indian' },

  // Moving on, and the AED.
  { say: 'sorted', expect: 'next', ctx: IN, dialect: 'UK' },
  { say: 'alright done', expect: 'next', ctx: IN, dialect: 'US' },
  { say: 'okay can already', expect: 'next', ctx: IN, dialect: 'Singaporean' },
  { say: "my mate's gone to get it", expect: 'next', ctx: IN, dialect: 'UK / Australian' },
  { say: "nobody's here it's just me", expect: 'alone', ctx: IN, dialect: 'US' },
  { say: "i'm on me own", expect: 'alone', ctx: IN, dialect: 'UK' },
  { say: 'wat do i do now', expect: 'what_now', ctx: IN, dialect: 'misheard / texting' },
  { say: 'come again', expect: 'repeat', ctx: IN, dialect: 'Caribbean / African' },
];

describe('accents and dialects', () => {
  const results = CASES.map((c) => ({ ...c, got: meaning(c.say, c.ctx) }));
  const ok = results.filter((r) => r.got === r.expect);

  if (process.env.DIALECT_REPORT) {
    // eslint-disable-next-line no-console
    console.log(
      `${ok.length}/${results.length} understood\n` +
        results.filter((r) => r.got !== r.expect).map((r) => `  MISS [${r.dialect}] "${r.say}" -> ${r.got} (want ${r.expect})`).join('\n'),
    );
  }

  it.each(CASES.map((c) => [c.dialect, c.say, c.expect, c.ctx] as const))('[%s] "%s" -> %s', (_d, say, want, ctx) => {
    expect(meaning(say, ctx)).toBe(want);
  });
});
