import systemLines from '@/audio/systemLines.json';
import type { Slots } from '@/protocols/engine';
import { normalizeUtterance } from '@/voice/router';

/**
 * How bad is it? A severity grade for the five emergencies where it changes
 * what a bystander should do: choking, bleeding, burns, stroke and overdose.
 * (Not breathing and passed out are always the most serious.)
 *
 *   Level 1  Mild       care here, watch for change
 *   Level 2  Serious    needs medical care
 *   Level 3  Critical   911 now
 *
 * Burns also get their depth, the way first aid teaches it: first degree
 * (red, dry, no blisters), second degree (blisters), third degree (white,
 * leathery or charred, often painless).
 *
 * The grade is read from evidence, and every piece is kept so it can be
 * shown: the answers given on the steps, what the rescuer said ("it's
 * blistering", "it's spurting"), what they tapped when asked "what do you
 * see?", and the photo check's verdict. Rules, not a model, so it is
 * instant, works offline and can explain itself.
 *
 * One rule above all, the same as the breathing sensor: it can only push
 * toward more care. The grade never goes down once evidence raised it, a
 * guess never counts as evidence, and no level ever says 911 is not needed.
 * Criteria and sources: docs/SEVERITY.md.
 */

export type Level = 1 | 2 | 3;
export type Category = 'choking' | 'bleeding' | 'burns' | 'stroke' | 'overdose';

export type Signal = { level: Level; name: string; evidence: string; degree?: Level };

export type Grade = {
  category: Category;
  /** The level shown: the strongest evidence, or the starting guess when there is none yet. */
  level: Level;
  /** True when no evidence has come in yet and `level` is the starting guess. */
  guess: boolean;
  /** Burns only: first, second or third degree, once something tells us. */
  degree: Level | null;
  name: string;
  /** What to do at this level, in a few words. */
  action: string;
  signals: Signal[];
};

/** Something the rescuer said or tapped, kept for grading. */
export type Observation = { text: string; via: 'voice' | 'tap' | 'photo'; at: number };

export const LEVEL_NAME: Record<Level, string> = { 1: 'Mild', 2: 'Serious', 3: 'Critical' };
export const DEGREE_NAME: Record<Level, string> = { 1: '1st degree', 2: '2nd degree', 3: '3rd degree' };

export function categoryOf(protocolId: string | null | undefined): Category | null {
  if (!protocolId) return null;
  if (protocolId.startsWith('choking')) return 'choking';
  if (protocolId === 'bleeding') return 'bleeding';
  if (protocolId === 'burns') return 'burns';
  if (protocolId === 'stroke') return 'stroke';
  if (protocolId === 'opioid_overdose') return 'overdose';
  return null;
}

/** With no evidence yet. Stroke and overdose start serious: both always need 911. */
const START: Record<Category, Level> = { choking: 2, bleeding: 2, burns: 2, stroke: 2, overdose: 2 };

const ACTION: Record<Category, Record<Level, string>> = {
  choking: { 1: 'Let them cough. Stay close.', 2: 'Watch the cough. Be ready to help.', 3: 'Call 911. Back blows now.' },
  bleeding: { 1: 'Press until it stops.', 2: 'Keep pressing. Get it seen today.', 3: 'Call 911. Do not let up.' },
  burns: { 1: 'Cool it, then cover it.', 2: 'Cool it. A doctor should see it.', 3: 'Call 911. Keep cooling.' },
  stroke: { 1: 'Call 911. Note the time.', 2: 'Call 911. Note the time.', 3: 'Call 911 now. Note the time.' },
  overdose: { 1: 'Call 911. Narcan wears off.', 2: 'Call 911. Narcan wears off.', 3: 'Call 911. Narcan now.' },
};

/** What a rescuer can tap to tell us what they see, per emergency (the words are matched like speech). */
export const LOOKS: Record<Category, { label: string; text: string }[]> = {
  choking: [
    { label: 'Coughing hard', text: 'coughing hard' },
    { label: 'Weak cough', text: 'weak cough' },
    { label: "Can't breathe", text: 'cannot breathe' },
  ],
  bleeding: [
    { label: 'Small, oozing', text: 'small cut oozing' },
    { label: 'Steady flow', text: 'steady bleeding' },
    { label: 'Spurting', text: 'spurting' },
  ],
  burns: [
    { label: 'Red, no blisters', text: 'red no blisters' },
    { label: 'Blisters', text: 'blisters' },
    { label: 'White or charred', text: 'white charred' },
  ],
  stroke: [
    { label: 'Face droops', text: 'face droops' },
    { label: 'Arm drifts', text: 'arm drifts' },
    { label: 'Slurred speech', text: 'slurred speech' },
  ],
  overdose: [
    { label: 'Awake', text: 'awake and talking' },
    { label: 'Hard to wake', text: 'hard to wake' },
    { label: 'Blue lips', text: 'blue lips' },
  ],
};

type Cue = { re: RegExp; level: Level; name: string; degree?: Level };

/** Words that carry severity, per emergency. Matched on normalized text (see router.ts). */
const CUES: Record<Category, Cue[]> = {
  choking: [
    { re: /\b(cannot (breathe|talk|speak|cough)|not breathing|no sound|silent|turning blue|lips are blue|blue lips|going blue|clutching|grabbing (his|her|their|the) throat)\b/, level: 3, name: 'No air moving' },
    { re: /\b(weak\w* cough|cough\w*( \w+){0,2} weak\w*|barely coughing|high pitched|squeak\w*|wheez\w*|struggling to breathe)\b/, level: 3, name: 'Weak cough' },
    { re: /\b(coughing hard|cough(ing)? (a lot|loudly|strongly)|can (talk|speak|breathe)|still talking|still breathing)\b/, level: 1, name: 'Coughing hard' },
  ],
  bleeding: [
    { re: /\b(spurt\w*|gush\w*|puls\w*|pool\w*|lot of blood|so much blood|blood everywhere|will not stop|not stopping|soak\w*|amputat\w*|cut off|severed|stab\w*|shot|gunshot)\b/, level: 3, name: 'Life-threatening bleeding' },
    { re: /\b(steady|keeps bleeding|still bleeding|deep cut|deep)\b/, level: 2, name: 'Steady bleeding' },
    { re: /\b(small cut|little cut|tiny cut|scrape\w*|scratch\w*|nick\w*|ooz\w*|stopped bleeding|just a little|barely bleeding)\b/, level: 1, name: 'Small bleed' },
  ],
  burns: [
    { re: /\b(white|waxy|leather\w*|charred|black\w*|brown|no feeling|no pain|(does|did) not (even )?hurt|not (even )?hurting|cannot feel (it|anything)|painless|numb)\b/, level: 3, name: 'Deep burn', degree: 3 },
    { re: /\b(face|eye\w*|hands?|feet|foot|groin|genital\w*|private\w*|joint|knee|elbow|neck|mouth|airway)\b/, level: 3, name: 'Burn on a critical area' },
    { re: /\b(bigger than (a|my|his|her|their|your) (hand|palm)|whole (arm|leg|back|chest|hand|side)|large|huge|big)\b/, level: 3, name: 'Large burn' },
    { re: /\b(chemical|acid|bleach|lye|electric\w*|lightning|outlet|wire|power line|smoke|explosion)\b/, level: 3, name: 'Chemical, electrical or smoke' },
    { re: /\b(blister\w*|bubbl\w*|weeping|wet|shiny|raw)\b/, level: 2, name: 'Blisters', degree: 2 },
    { re: /\b(red|pink|sunburn|no blisters|dry)\b/, level: 1, name: 'Red, no blisters', degree: 1 },
  ],
  stroke: [
    { re: /\b(droop\w*|lopsided|uneven (smile|face)|face (is )?(hanging|drooping))\b/, level: 3, name: 'Face drooping' },
    { re: /\b(arm drifts?|arm (is )?(weak|numb|falling)|cannot (lift|raise) (his|her|their|one|an|the) arm|weak on one side|numb on one side)\b/, level: 3, name: 'Arm weakness' },
    { re: /\b(slur\w*|words (are )?(jumbled|wrong|weird)|talking funny|cannot (talk|speak)|confused)\b/, level: 3, name: 'Speech trouble' },
    { re: /\b(worst headache|cannot see|lost (his|her|their) vision|cannot walk|fell over)\b/, level: 3, name: 'Other stroke signs' },
  ],
  overdose: [
    { re: /\b(not breathing|barely breathing|blue lips|lips are blue|turning blue|gurgl\w*|snoring|will not wake|cannot wake|hard to wake|unresponsive|passed out|limp)\b/, level: 3, name: 'Breathing or waking trouble' },
    { re: /\b(awake|talking|responding|alert)\b/, level: 2, name: 'Awake' },
  ],
};

const has = (t: string, re: RegExp) => re.test(t);

/** Answers given on the steps, read from the incident log (it keeps them even after Back). */
function fromAnswers(category: Category, slots: Slots, log: { text: string }[]): Signal[] {
  const out: Signal[] = [];
  const said = (re: RegExp) => log.find((e) => re.test(e.text))?.text ?? null;
  const add = (level: Level, name: string, evidence: string | null, degree?: Level) => {
    if (evidence) out.push({ level, name, evidence, ...(degree ? { degree } : {}) });
  };
  const slot = (k: keyof Slots, v: string, text: string) => (slots[k] === v ? text : null);

  if (slots.conscious === 'false' || said(/^(Can you wake them\?|Do they respond\?):? No/)) add(3, 'Not responding', said(/wake them\?:? No/) ?? 'Not responding');
  switch (category) {
    case 'choking':
      add(3, 'No air moving', said(/^Can they cough or speak\? No/) ?? slot('severe_fbao', 'true', "Can't cough or speak"));
      add(3, 'Weak cough', said(/Cough got weak/));
      add(1, 'Coughing hard', said(/^Can they cough or speak\? Coughing hard/) ?? slot('severe_fbao', 'false', 'Coughing hard'));
      break;
    case 'bleeding':
      add(3, 'Neck, armpit or groin', said(/Where is it bleeding\? Neck/) ?? slot('wound_site', 'junctional', 'Neck, armpit or groin'));
      add(3, 'Chest or belly wound', said(/Where is it bleeding\? Chest/) ?? slot('wound_site', 'torso', 'Chest or belly'));
      add(3, 'Soaking through', said(/(Soaking through|Still soaking|Still bleeding|Bleeding again)$/));
      add(3, 'Needed a tourniquet', said(/^Have a tourniquet\? Yes/));
      add(2, 'Arm or leg wound', said(/Where is it bleeding\? Arm or leg/) ?? slot('wound_site', 'limb', 'Arm or leg'));
      break;
    case 'burns':
      add(3, 'A bad burn', said(/^Is it a bad burn\? Yes/) ?? slot('burn_severity', 'major', 'A bad burn'));
      add(1, 'A small burn', said(/^Is it a bad burn\? No/) ?? slot('burn_severity', 'minor', 'A small burn'));
      break;
    case 'stroke':
      add(3, 'Face drooping', said(/^Ask them to smile:? One side droops/) ?? slot('fast_face', 'true', 'One side droops'));
      add(3, 'Arm drifting', said(/^Raise both arms:? One drifts/) ?? slot('fast_arms', 'true', 'One arm drifts'));
      add(3, 'Speech trouble', said(/^Repeat a short sentence:? Slurred/) ?? slot('fast_speech', 'true', 'Slurred or wrong'));
      add(3, 'Stopped responding', said(/Stopped responding/));
      break;
    case 'overdose':
      add(3, 'Not breathing normally', said(/^Breathing normally( now)?\?:? No/) ?? slot('breathing', 'abnormal', 'Not breathing normally'));
      add(3, 'Needed a second dose', said(/^Naloxone second dose/));
      add(3, 'Hard to wake again', said(/Hard to wake again/));
      add(2, 'Awake', said(/^Can you wake them\?:? Yes/));
      break;
  }
  return out;
}

/** Does this say anything about how bad it is, for this emergency? */
export function cuesIn(category: Category, text: string): boolean {
  const t = normalizeUtterance(text);
  return CUES[category].some((c) => c.re.test(t));
}

/** "Red, no blisters" must not count as blisters. */
const NO_BLISTERS = /\bno blisters?\b/g;

function fromWords(category: Category, observations: Observation[]): Signal[] {
  const out: Signal[] = [];
  for (const o of observations) {
    const t = normalizeUtterance(o.text);
    for (const cue of CUES[category]) {
      const text = cue.name === 'Blisters' ? t.replace(NO_BLISTERS, ' ') : t;
      if (!has(text, cue.re)) continue;
      const how = o.via === 'tap' ? 'You tapped' : o.via === 'photo' ? 'Photo check' : 'You said';
      out.push({ level: cue.level, name: cue.name, evidence: `${how}: "${o.text}"`, ...(cue.degree ? { degree: cue.degree } : {}) });
    }
  }
  return out;
}

/**
 * Grade one emergency from everything known so far. `peak` is the highest
 * level evidence has already reached in this emergency: it never goes down.
 */
export function grade(
  protocolId: string | null | undefined,
  slots: Slots,
  log: { text: string }[],
  observations: Observation[],
  peak: { level?: Level; degree?: Level } = {},
): Grade | null {
  const category = categoryOf(protocolId);
  if (!category) return null;
  const signals = [...fromAnswers(category, slots, log), ...fromWords(category, observations)];
  // Burns: the deepest depth seen, and a burn on a critical area or a large one is critical whatever its depth.
  const degrees = signals.map((s) => s.degree ?? 0);
  const evidence = Math.max(peak.level ?? 0, ...signals.map((s) => s.level)) as Level | 0;
  const deepest = Math.max(peak.degree ?? 0, ...degrees) as Level | 0;
  // Overdose and stroke are never mild: both always need 911.
  const floor: Level = category === 'overdose' || category === 'stroke' ? 2 : 1;
  const level = (evidence ? Math.max(evidence, floor, deepest === 3 ? 3 : 0) : START[category]) as Level;
  return {
    category,
    level,
    guess: !evidence,
    degree: category === 'burns' && deepest ? (deepest as Level) : null,
    name: LEVEL_NAME[level],
    action: ACTION[category][level],
    // Strongest first, one line per kind of evidence.
    signals: dedupe(signals).sort((a, b) => b.level - a.level),
  };
}

function dedupe(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  return signals.filter((s) => {
    const k = `${s.name}|${s.evidence}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

/**
 * What Mayday says when the grade goes up, or a burn's depth is first known.
 * Only ever on the way up; never a line that sounds like "it's fine".
 */
export function announcement(before: { level: Level; degree: Level | null; guess: boolean } | null, after: Grade): string[] {
  const lines: string[] = [];
  if (after.category === 'burns' && after.degree && after.degree !== before?.degree) lines.push(DEGREE_LINE[after.degree]);
  const nowCritical = after.level === 3 && !after.guess && (before?.level !== 3 || before.guess);
  if (nowCritical && !lines.some((l) => l.includes('911'))) lines.push(CRITICAL_LINE);
  return lines;
}

const L = systemLines.lines;
const DEGREE_LINE: Record<Level, string> = { 1: L.sevDegree1, 2: L.sevDegree2, 3: L.sevDegree3 };
const CRITICAL_LINE = L.sevCritical;

/** Every line announcement() can say, for the voice recordings. */
export const ANNOUNCEMENTS = [...Object.values(DEGREE_LINE), CRITICAL_LINE];
