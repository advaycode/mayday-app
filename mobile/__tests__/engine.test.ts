/**
 * The protocol engine, walked branch by branch.
 */
import { reduce, type EngineEvent, type EngineState, type Effect } from '@/protocols/engine';
import { protocols, type Step } from '@/protocols';

let clock = 0;
const at = () => (clock += 1000);

type EventInput = EngineEvent extends infer E ? (E extends EngineEvent ? Omit<E, 'at'> : never) : never;

function run(events: EventInput[], start?: EngineState | null) {
  let state = start ?? null;
  const effects: Effect[] = [];
  for (const e of events) {
    const r = reduce(state, { ...e, at: at() } as EngineEvent);
    state = r.state;
    effects.push(...r.effects);
  }
  return { state: state!, effects };
}

const logs = (effects: Effect[]) => effects.flatMap((e) => (e.type === 'log' ? [e.text] : []));
const said = (effects: Effect[]) => effects.flatMap((e) => (e.type === 'say' ? e.lines : []));

describe('adult CPR', () => {
  it('walks from first contact to compressions', () => {
    const { state, effects } = run([
      { type: 'start', protocolId: 'cpr_adult' },
      { type: 'choose', choiceId: 'no' }, // no response
      { type: 'choose', choiceId: 'no' }, // not breathing
      { type: 'choose', choiceId: 'sent' },
      { type: 'advance' }, // flat on floor
      { type: 'advance' }, // hands
      { type: 'choose', choiceId: 'no' }, // hands only
    ]);
    expect(state.stepId).toBe('compressions');
    expect(state.slots).toMatchObject({ conscious: 'false', breathing: 'abnormal', rescue_breaths: 'false' });
    expect(logs(effects)[0]).toBe('Started CPR');
    expect(said(effects)).toContain('Push hard and fast. Follow the beat.');
  });

  it('skips questions the router already answered', () => {
    const { state, effects } = run([
      { type: 'start', protocolId: 'cpr_adult', slots: { conscious: 'false', breathing: 'abnormal' } },
    ]);
    expect(state.stepId).toBe('send_aed');
    expect(logs(effects).filter((l) => l.includes('already known'))).toHaveLength(2);
  });

  it('moves on if nobody answers "send for an AED"', () => {
    const { state, effects } = run([
      { type: 'start', protocolId: 'cpr_adult', slots: { conscious: 'false', breathing: 'abnormal' } },
      { type: 'timeout' },
    ]);
    expect(state.stepId).toBe('position');
    expect(logs(effects)).toContain('Send for an AED: no answer');
  });

  it('jumps to the AED steps when someone says the AED is here, then back to compressions with a resume line', () => {
    const start = run([{ type: 'start', protocolId: 'cpr_adult' }, { type: 'goto', ref: 'compressions' }]).state;
    const { state, effects } = run(
      [{ type: 'intent', intent: 'aed_here' }, { type: 'advance' }, { type: 'advance' }, { type: 'advance' }],
      start,
    );
    expect(state.stepId).toBe('compressions');
    expect(logs(effects)).toContain('AED arrived');
    expect(said(effects).slice(-1)).toEqual(['Back to compressions. Now.']);
  });

  it('handles vomiting mid-CPR and returns to compressions', () => {
    const start = run([{ type: 'start', protocolId: 'cpr_adult' }, { type: 'goto', ref: 'compressions' }]).state;
    const { state } = run([{ type: 'intent', intent: 'vomiting' }, { type: 'advance' }], start);
    expect(state.stepId).toBe('compressions');
  });

  it('only accepts "they are breathing" as a reason to stop during compressions', () => {
    const atHands = run([{ type: 'start', protocolId: 'cpr_adult' }, { type: 'goto', ref: 'hands' }]).state;
    const r1 = reduce(atHands, { type: 'intent', intent: 'breathing', at: at() });
    expect(r1.state.stepId).toBe('hands');
    expect(r1.effects).toContainEqual({ type: 'unhandled', intent: 'breathing' });

    const atCompressions = run([{ type: 'goto', ref: 'compressions' }], atHands).state;
    const r2 = reduce(atCompressions, { type: 'intent', intent: 'breathing', at: at() });
    expect(r2.state.protocolId).toBe('recovery_position');
  });

  it('repeats the current step on request', () => {
    const start = run([{ type: 'start', protocolId: 'cpr_adult' }]).state;
    const r = reduce(start, { type: 'intent', intent: 'repeat', at: at() });
    expect(r.state.stepId).toBe('responsive');
    expect(said(r.effects)).toEqual(protocols.cpr_adult.steps[0].say);
  });

  it('sends a breathing, unresponsive person to the recovery position', () => {
    const { state } = run([{ type: 'start', protocolId: 'cpr_adult', slots: { conscious: 'false', breathing: 'normal' } }]);
    expect(state.protocolId).toBe('recovery_position');
  });
});

describe('cross-protocol jumps use the right age', () => {
  it('a choking child who collapses goes to child CPR', () => {
    const { state } = run([
      { type: 'start', protocolId: 'choking', slots: { age_group: 'child' } },
      { type: 'choose', choiceId: 'no' },
      { type: 'intent', intent: 'unresponsive' },
    ]);
    expect(state.protocolId).toBe('cpr_child');
    expect(state.stepId).toBe('position');
  });

  it('a choking adult who collapses goes to adult CPR', () => {
    const { state } = run([{ type: 'start', protocolId: 'choking' }, { type: 'intent', intent: 'unresponsive' }]);
    expect(state.protocolId).toBe('cpr_adult');
  });

  it('a choking infant who goes limp goes to infant CPR', () => {
    const { state } = run([{ type: 'start', protocolId: 'choking_infant' }, { type: 'intent', intent: 'unresponsive' }]);
    expect(state.protocolId).toBe('cpr_infant');
  });

  it('an overdose with no naloxone and no normal breathing goes to CPR', () => {
    const { state } = run([
      { type: 'start', protocolId: 'opioid_overdose', slots: { conscious: 'false', breathing: 'abnormal' } },
      { type: 'choose', choiceId: 'no' }, // no naloxone
      { type: 'choose', choiceId: 'no' }, // not breathing normally
    ]);
    expect(state.protocolId).toBe('cpr_adult');
    expect(state.stepId).toBe('position');
  });
});

describe('bleeding', () => {
  it('limb with a tourniquet logs the time it went on', () => {
    const { state, effects } = run([
      { type: 'start', protocolId: 'bleeding' },
      { type: 'choose', choiceId: 'limb' },
      { type: 'choose', choiceId: 'yes' },
      { type: 'advance' },
    ]);
    expect(state.stepId).toBe('tq_time');
    expect(effects.find((e) => e.type === 'log' && e.text === 'Tourniquet applied')).toBeDefined();
  });

  it('chest or belly wounds go straight to pressure-and-wait, never a tourniquet', () => {
    const { state } = run([{ type: 'start', protocolId: 'bleeding', slots: { wound_site: 'torso' } }]);
    expect(state.stepId).toBe('torso');
  });

  it('pressure that soaks through escalates to packing', () => {
    const { state } = run([
      { type: 'start', protocolId: 'bleeding', slots: { wound_site: 'limb', has_tourniquet: 'false' } },
      { type: 'intent', intent: 'still_bleeding' },
    ]);
    expect(state.stepId).toBe('pack');
  });
});

describe('timers', () => {
  it('burn cooling runs its timer then says the 20-minute note', () => {
    const { state, effects } = run([
      { type: 'start', protocolId: 'burns', slots: { burn_severity: 'minor' } },
      { type: 'advance' }, // away from heat
      { type: 'advance' }, // jewelry (severity already known)
      { type: 'timeout' }, // 10 minutes later
    ]);
    expect(state.stepId).toBe('cover');
    expect(said(effects)).toContain('Ten minutes. Twenty is even better, if you can.');
  });

  it('naloxone watch: waking up goes to stay-with-them, no change prompts a second dose', () => {
    const base = run([{ type: 'start', protocolId: 'opioid_overdose' }, { type: 'goto', ref: 'roll_watch' }]).state;
    expect(reduce(base, { type: 'advance', at: at() }).state.stepId).toBe('awake_end');
    expect(reduce(base, { type: 'timeout', at: at() }).state.stepId).toBe('second_dose');
  });
});

describe('exhaustive', () => {
  it('every choice of every step can be taken without error', () => {
    let count = 0;
    for (const p of Object.values(protocols)) {
      for (const s of p.steps as Step[]) {
        const choices =
          s.kind === 'ask' || s.kind === 'hold' || s.kind === 'end' ? s.choices : s.kind === 'do' ? s.alts : [];
        for (const c of choices) {
          const base = run([{ type: 'start', protocolId: p.id }, { type: 'goto', ref: s.id }]).state;
          expect(() => reduce(base, { type: 'choose', choiceId: c.id, at: at() })).not.toThrow();
          count++;
        }
        if (s.kind === 'do' || s.kind === 'timer') {
          const base = run([{ type: 'start', protocolId: p.id }, { type: 'goto', ref: s.id }]).state;
          expect(() => reduce(base, { type: 'advance', at: at() })).not.toThrow();
          count++;
        }
      }
    }
    expect(count).toBeGreaterThan(60);
  });
});
