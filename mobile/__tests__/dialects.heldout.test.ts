/**
 * Held out: written after the dialect rules were tuned, scored once, and not
 * tuned on. A report (DIALECT_REPORT=1), not a gate: it measures how well
 * the rules generalize to phrasings nobody wrote rules for.
 */
import { route, type RouteContext } from '@/voice/router';

const IN: RouteContext = { inProtocol: true };

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

export const HELD_OUT: { say: string; expect: string; ctx?: RouteContext }[] = [
  { say: "oh god me da's just dropped, he's not breathin right", expect: 'cpr' },
  { say: 'my auntie fall down she no dey move', expect: 'cpr' },
  { say: 'bro passed out cold on the court', expect: 'cpr' },
  { say: 'the old fella has collapsed outside the shop', expect: 'cpr' },
  { say: "she's choking innit she can't talk", expect: 'choking' },
  { say: 'baby is choke on grape', expect: 'choking' },
  { say: "he's cut himself bad, blood's pourin out", expect: 'bleeding' },
  { say: 'my hand got scalded with boiling water', expect: 'burns' },
  { say: "his mouth is all droopy and he can't lift his arm", expect: 'stroke' },
  { say: 'i reckon she overdosed on heroin', expect: 'opioid_overdose' },
  { say: 'nah mate', expect: 'no', ctx: IN },
  { say: 'yeah yeah', expect: 'yes', ctx: IN },
  { say: "naw he ain't", expect: 'no', ctx: IN },
  { say: 'he is breathing very strange', expect: 'not_breathing', ctx: IN },
  { say: 'his lips gone blue', expect: 'not_breathing', ctx: IN },
  { say: "she's not respondin to nothing", expect: 'unresponsive', ctx: IN },
  { say: 'okay did it', expect: 'next', ctx: IN },
  { say: "i'm by meself", expect: 'alone', ctx: IN },
  { say: 'say it again please', expect: 'repeat', ctx: IN },
  { say: 'what should i be doing', expect: 'what_now', ctx: IN },
];

describe('accents and dialects, held out', () => {
  it('reports', () => {
    const res = HELD_OUT.map((c) => ({ ...c, got: meaning(c.say, c.ctx) }));
    const ok = res.filter((r) => r.got === r.expect).length;
    if (process.env.DIALECT_REPORT) {
      // eslint-disable-next-line no-console
      console.log(`held out: ${ok}/${res.length}\n` + res.filter((r) => r.got !== r.expect).map((r) => `  MISS "${r.say}" -> ${r.got} (want ${r.expect})`).join('\n'));
    }
    expect(res.length).toBe(20);
  });
});
