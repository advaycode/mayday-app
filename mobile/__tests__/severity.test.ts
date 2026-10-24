/**
 * Severity grading (src/triage/severity.ts). The rule that matters most is
 * the same as the breathing sensor's: it only ever moves toward more care.
 */
import { announcement, categoryOf, grade, LOOKS, type Observation } from '@/triage/severity';

const said = (...texts: string[]): Observation[] => texts.map((text, i) => ({ text, via: 'voice', at: i }));
const tapped = (text: string): Observation[] => [{ text, via: 'tap', at: 0 }];

describe('which emergencies are graded', () => {
  it('grades the five where it changes what to do', () => {
    expect(['choking', 'bleeding', 'burns', 'stroke', 'opioid_overdose', 'choking_infant'].map(categoryOf)).toEqual(['choking', 'bleeding', 'burns', 'stroke', 'overdose', 'choking']);
    expect(categoryOf('cpr_adult')).toBeNull();
    expect(grade('cpr_adult', {}, [], [])).toBeNull();
  });
});

describe('burns: depth and severity', () => {
  it('reads first, second and third degree from what is seen', () => {
    expect(grade('burns', {}, [], said("it's red but no blisters"))!.degree).toBe(1);
    expect(grade('burns', {}, [], said("it's blistering"))!.degree).toBe(2);
    expect(grade('burns', {}, [], said('the skin is white and leathery'))!.degree).toBe(3);
    expect(grade('burns', {}, [], said("it doesn't even hurt"))!.degree).toBe(3);
  });

  it('a third degree burn is critical; a small red one is mild', () => {
    expect(grade('burns', {}, [], said('it looks charred'))!.level).toBe(3);
    const mild = grade('burns', {}, [{ text: 'Is it a bad burn? No, small' }], said('just red'))!;
    expect([mild.level, mild.name, mild.degree]).toEqual([1, 'Mild', 1]);
  });

  it('face, hands, chemicals, electricity or a large area are critical whatever the depth', () => {
    for (const t of ['red on her face', 'blisters on his hand', 'it was bleach', 'he touched a power line', 'the whole arm is red']) {
      expect([t, grade('burns', {}, [], said(t))!.level]).toEqual([t, 3]);
    }
  });

  it('"no blisters" is not blisters', () => {
    expect(grade('burns', {}, [], said('no blisters, just pink'))!.degree).toBe(1);
  });

  it('the bad-burn answer counts', () => {
    expect(grade('burns', { burn_severity: 'major' }, [], [])!.level).toBe(3);
  });
});

describe('bleeding', () => {
  it('spurting, soaking through or a junctional wound is critical', () => {
    expect(grade('bleeding', {}, [], said("it's spurting"))!.level).toBe(3);
    expect(grade('bleeding', {}, [{ text: 'Press hard: Soaking through' }], [])!.level).toBe(3);
    expect(grade('bleeding', { wound_site: 'junctional' }, [], [])!.level).toBe(3);
  });
  it('a small oozing cut is mild', () => {
    expect(grade('bleeding', {}, [], tapped('small cut oozing'))!.level).toBe(1);
  });
});

describe('choking', () => {
  it("can't breathe or a weak cough is critical; coughing hard is mild", () => {
    expect(grade('choking', { severe_fbao: 'true' }, [], [])!.level).toBe(3);
    expect(grade('choking', {}, [], said('his cough is getting weak'))!.level).toBe(3);
    expect(grade('choking', { severe_fbao: 'false' }, [], [])!.level).toBe(1);
  });
});

describe('stroke and overdose are never mild', () => {
  it('any FAST sign is critical', () => {
    expect(grade('stroke', { fast_face: 'true' }, [], [])!.level).toBe(3);
    expect(grade('stroke', {}, [], said('her speech is slurred'))!.level).toBe(3);
  });
  it('no signs yet is still serious, not mild', () => {
    expect(grade('stroke', { fast_face: 'false', fast_arms: 'false', fast_speech: 'false' }, [], [])!.level).toBe(2);
  });
  it('overdose: awake is serious; blue lips or hard to wake is critical', () => {
    expect(grade('opioid_overdose', {}, [{ text: 'Can you wake them? Yes' }], [])!.level).toBe(2);
    expect(grade('opioid_overdose', {}, [], said('his lips are blue'))!.level).toBe(3);
    expect(grade('opioid_overdose', { conscious: 'false' }, [], [])!.level).toBe(3);
  });
});

describe('only toward more care', () => {
  it('the grade never goes down once evidence raised it', () => {
    const peak = { level: 3 as const, degree: 3 as const };
    const later = grade('burns', {}, [], said('actually it is just red'), peak)!;
    expect([later.level, later.degree]).toEqual([3, 3]);
  });

  it('the strongest evidence wins when it is mixed', () => {
    expect(grade('bleeding', {}, [], said('small cut', 'now it is spurting'))!.level).toBe(3);
  });

  it('a starting guess is marked as a guess and is never mild', () => {
    for (const p of ['choking', 'bleeding', 'burns', 'stroke', 'opioid_overdose']) {
      const g = grade(p, {}, [], [])!;
      expect([p, g.guess, g.level]).toEqual([p, true, 2]);
    }
  });

  it('no level ever tells anyone 911 is not needed', () => {
    for (const p of ['choking', 'bleeding', 'burns', 'stroke', 'opioid_overdose']) {
      for (const t of ['', ...LOOKS[categoryOf(p)!].map((l) => l.text)]) {
        expect(grade(p, {}, [], t ? said(t) : [])!.action).not.toMatch(/\b(no|not|don't|do not)( need)? (to )?call|no 911|not an emergency|fine\b/i);
      }
    }
  });
});

describe('what Mayday says', () => {
  it('names the burn depth when it is first known, and says 911 once at critical', () => {
    const before = { level: 2 as const, degree: null, guess: true };
    expect(announcement(before, grade('burns', {}, [], said('blisters'))!)).toEqual(['Sounds like a second degree burn.']);
    expect(announcement(before, grade('burns', {}, [], said('charred'))!)).toEqual(['Sounds like a third degree burn. Call 911.']);
    expect(announcement(before, grade('bleeding', {}, [], said('spurting'))!)).toEqual(['This is serious. Make sure 911 is called.']);
    expect(announcement({ level: 3, degree: null, guess: false }, grade('bleeding', {}, [], said('spurting'))!)).toEqual([]);
  });
  it('says nothing for a guess', () => {
    expect(announcement(null, grade('stroke', {}, [], [])!)).toEqual([]);
  });
});
