/**
 * Rules every protocol must follow. These are the safety properties of the
 * corpus, checked on every test run rather than trusted.
 */
import { reachable, resolveRef } from '@/protocols/engine';
import { protocols, sources, type AgeGroup, type Step } from '@/protocols';

const all = Object.values(protocols);

function choicesOf(step: Step) {
  if (step.kind === 'ask' || step.kind === 'hold' || step.kind === 'end') return step.choices;
  if (step.kind === 'do') return step.alts;
  return [];
}

function refsOf(step: Step): string[] {
  const refs = choicesOf(step).map((c) => c.next);
  if ('next' in step) refs.push(step.next);
  if (step.kind === 'cpr') refs.push(step.aedNext);
  if (step.kind === 'ask' && step.timeoutNext) refs.push(step.timeoutNext);
  if (step.kind === 'timer' && step.actionNext) refs.push(step.actionNext);
  return refs;
}

function spokenLines(step: Step): string[] {
  const lines = [...step.say];
  if (step.kind === 'cpr') lines.push(...step.resumeSay, ...step.reminders, ...step.breathsSay, step.depthSay);
  if (step.kind === 'hold') lines.push(...step.reminders);
  if (step.kind === 'timer') lines.push(...step.doneSay);
  return lines;
}

function visibleText(step: Step): string[] {
  return [step.text, step.sub ?? '', ...choicesOf(step).map((c) => c.label), ...spokenLines(step)];
}

const words = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const ages = (p: (typeof all)[number]): AgeGroup[] =>
  p.appliesTo ?? (p.ageGroup === 'any' ? ['adult', 'child', 'infant'] : [p.ageGroup]);

describe('protocol corpus', () => {
  it('has the ten MVP protocols', () => {
    expect(Object.keys(protocols).sort()).toEqual(
      ['bleeding', 'burns', 'choking', 'choking_infant', 'cpr_adult', 'cpr_child', 'cpr_infant', 'opioid_overdose', 'recovery_position', 'stroke'].sort(),
    );
  });

  for (const p of all) {
    describe(p.id, () => {
      it('has unique step ids and a valid entry', () => {
        const ids = p.steps.map((s) => s.id);
        expect(new Set(ids).size).toBe(ids.length);
        expect(ids).toContain(p.entry);
      });

      it('cites a known source on every step, with a verbatim quote whenever it claims to be verified', () => {
        for (const s of p.steps) {
          expect(sources[s.source]).toBeDefined();
          if (s.verified) expect(s.quote && s.quote.length > 10).toBeTruthy();
          if (!s.verified) expect(s.note).toBeTruthy();
        }
      });

      it('never claims verified against a source we could not retrieve', () => {
        for (const s of p.steps) {
          if (sources[s.source].method === 'not-retrieved') expect(s.verified).toBe(false);
        }
      });

      it('resolves every link, for every age group it applies to', () => {
        for (const age of ages(p)) {
          for (const s of p.steps) {
            for (const ref of refsOf(s)) {
              const loc = resolveRef(ref, { protocolId: p.id, slots: { age_group: age } });
              expect(protocols[loc.protocolId]).toBeDefined();
              expect(protocols[loc.protocolId].steps.some((x) => x.id === loc.stepId)).toBe(true);
            }
          }
          for (const i of p.interrupts) {
            const loc = resolveRef(i.goto, { protocolId: p.id, slots: { age_group: age } });
            expect(protocols[loc.protocolId].steps.some((x) => x.id === loc.stepId)).toBe(true);
          }
        }
      });

      it('can reach every one of its steps from the entry', () => {
        const seen = reachable(p.id, ages(p)[0]);
        for (const s of p.steps) expect(seen.has(`${p.id}#${s.id}`)).toBe(true);
      });

      it('speaks in short utterances: 12 words or fewer each', () => {
        const tooLong = p.steps.flatMap((s) => spokenLines(s)).filter((line) => words(line) > 12);
        expect(tooLong).toEqual([]);
      });

      it('keeps headlines to five words so they read at arm\'s length', () => {
        for (const s of p.steps) expect(words(s.text)).toBeLessThanOrEqual(5);
      });

      it('uses no dashes in visible text', () => {
        for (const s of p.steps) for (const t of visibleText(s)) expect(t).not.toMatch(/[–—]/);
      });
    });
  }

  it('never tells anyone to use two fingers on an infant (withdrawn in the 2025 guidelines)', () => {
    for (const id of ['cpr_infant', 'choking_infant']) {
      for (const s of protocols[id].steps) {
        for (const t of visibleText(s)) expect(t.toLowerCase()).not.toMatch(/\b(two|2)[ -]?fingers?\b/);
      }
    }
  });

  it('starts adult and child choking with back blows, before abdominal thrusts (2025 change)', () => {
    const p = protocols.choking;
    const severe = p.steps.find((s) => s.id === 'severe')!;
    const yesPath = choicesOf(severe).find((c) => c.id === 'no')!.next;
    expect(yesPath).toBe('back_blows');
    const bb = p.steps.find((s) => s.id === 'back_blows')!;
    expect('next' in bb && bb.next).toBe('abd_thrusts');
  });

  it('never gives an infant abdominal thrusts', () => {
    for (const s of protocols.choking_infant.steps) {
      for (const t of visibleText(s)) expect(t.toLowerCase()).not.toMatch(/belly|abdominal/);
    }
  });

  it('tells rescuers a bra can be moved aside rather than removed (2025 change)', () => {
    const pads = protocols.cpr_adult.steps.find((s) => s.id === 'aed_pads')!;
    expect(pads.say.join(' ').toLowerCase()).toContain('move a bra aside');
  });

  it('defaults adult CPR to hands-only when nobody answers the breaths question', () => {
    const q = protocols.cpr_adult.steps.find((s) => s.id === 'breaths_q')!;
    expect(q.kind === 'ask' && q.timeoutNext).toBe('compressions');
  });

  it('never tells anyone to loosen a tourniquet', () => {
    for (const s of protocols.bleeding.steps) {
      for (const t of spokenLines(s)) if (/loosen/i.test(t)) expect(t).toMatch(/^Never loosen it/);
    }
  });

  it('never says ice is fine for burns', () => {
    for (const s of protocols.burns.steps) {
      for (const t of spokenLines(s)) {
        if (/\bice\b/i.test(t)) expect(t).toMatch(/never ice|no butter or ice/i);
      }
    }
  });
});
