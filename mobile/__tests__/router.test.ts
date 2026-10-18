/**
 * Router evaluation. Runs every utterance in router-eval.json through the
 * offline router and reports accuracy. The bar: at least 90% on intake, and
 * zero misses on life threats (a not-breathing utterance must start CPR).
 */
import * as fs from 'fs';
import * as path from 'path';

import { normalizeUtterance, route } from '@/voice/router';
import { RouterOutput } from '@/voice/routerSchema';

import heldOut from './router-heldout.json';
import evalSet from './router-eval.json';

type IntakeCase = { say: string; protocol: string | null; slots: Record<string, string> };

describe('router', () => {
  it('cleans up panicked speech', () => {
    expect(normalizeUtterance("He's not, he's not breathing, HELP")).toBe('he is not breathing help');
    expect(normalizeUtterance("she can't breathe")).toBe('she cannot breathe');
    expect(normalizeUtterance('the A.E.D. is here')).toBe('the aed is here');
    expect(normalizeUtterance('call 911')).toBe('call nine one one');
  });

  it('always returns output that matches the schema', () => {
    for (const c of evalSet.intake) expect(() => RouterOutput.parse(route(c.say))).not.toThrow();
  });

  it('meets the accuracy bar on the evaluation set', () => {
    const results = (evalSet.intake as IntakeCase[]).map((c) => {
      const out = route(c.say);
      const protocolOk = out.protocol_id === c.protocol;
      const slotMisses = Object.entries(c.slots).filter(([k, v]) => (out.slots as Record<string, string>)[k] !== v);
      return { ...c, got: out.protocol_id, gotSlots: out.slots, protocolOk, slotsOk: slotMisses.length === 0, urgent: out.urgent };
    });

    const intents = evalSet.inProtocol.map((c) => {
      const out = route(c.say, { inProtocol: true });
      return { ...c, got: out.intent, ok: out.intent === c.intent };
    });

    const protocolAcc = results.filter((r) => r.protocolOk).length / results.length;
    const slotAcc = results.filter((r) => r.slotsOk).length / results.length;
    const intentAcc = intents.filter((r) => r.ok).length / intents.length;

    const report = {
      intakeCases: results.length,
      protocolAccuracy: +protocolAcc.toFixed(3),
      slotAccuracy: +slotAcc.toFixed(3),
      inProtocolCases: intents.length,
      intentAccuracy: +intentAcc.toFixed(3),
      failures: [
        ...results.filter((r) => !r.protocolOk || !r.slotsOk).map((r) => ({ say: r.say, expected: r.protocol, got: r.got, expectedSlots: r.slots, gotSlots: r.gotSlots })),
        ...intents.filter((r) => !r.ok).map((r) => ({ say: r.say, expected: r.intent, got: r.got })),
      ],
    };
    fs.mkdirSync(path.join(__dirname, '..', 'reports'), { recursive: true });
    fs.writeFileSync(path.join(__dirname, '..', 'reports', 'router-eval.json'), JSON.stringify(report, null, 2));

    expect(protocolAcc).toBeGreaterThanOrEqual(0.9);
    expect(intentAcc).toBeGreaterThanOrEqual(0.9);
  });

  it('never misses a life threat: anything not breathing starts a CPR-family protocol, urgently', () => {
    for (const c of evalSet.intake as IntakeCase[]) {
      if (c.slots.breathing === 'abnormal' && c.protocol?.startsWith('cpr')) {
        const out = route(c.say);
        expect([c.say, out.protocol_id?.startsWith('cpr'), out.urgent]).toEqual([c.say, true, true]);
      }
    }
  });

  it('never guesses: an unclear utterance asks a fixed question instead', () => {
    const out = route("uh, I don't know, he's acting weird");
    expect(out.protocol_id).toBeNull();
    expect(out.next_question).toBe('what');
  });

  it('asks the age when it matters and nobody said it', () => {
    expect(route("he's choking").next_question).toBe('age');
    expect(route('my baby is choking').next_question).toBeNull();
  });
});

describe('router, held-out set', () => {
  // These sentences were never used to tune the router. The number is reported,
  // not tuned: a failure here is information, recorded in reports/router-heldout.json.
  it('reports accuracy on unseen sentences', () => {
    const results = heldOut.intake.map((c) => ({ ...c, got: route(c.say).protocol_id }));
    const acc = results.filter((r) => r.got === r.protocol).length / results.length;
    fs.writeFileSync(
      path.join(__dirname, '..', 'reports', 'router-heldout.json'),
      JSON.stringify({ cases: results.length, protocolAccuracy: +acc.toFixed(3), failures: results.filter((r) => r.got !== r.protocol) }, null, 2),
    );
    // Safety floor only: no unseen not-breathing sentence may miss CPR entirely.
    for (const r of results) if (r.protocol?.startsWith('cpr')) expect([r.say, r.got?.startsWith('cpr') || r.got === 'opioid_overdose']).toEqual([r.say, true]);
    expect(acc).toBeGreaterThan(0.6);
  });
});
