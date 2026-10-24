import { normalizeUtterance } from './router';

/**
 * Adaptive voice: what Mayday says changes with who it is helping and how
 * the rescuer sounds, without ever changing the medicine.
 *
 *   - Who: "my dad collapsed" -> the voice says "him", "his", "your dad".
 *   - How the rescuer sounds: panicked -> a calming line first and a slower,
 *     lower voice; confused -> the step again, slower; silent -> a short nudge.
 *   - Progress: alone -> no "switch with someone" lines.
 *
 * Everything here is deterministic and offline. An AI rewrite (proxy /adapt)
 * can make phrasing more natural on top, but every AI line must pass
 * checkRewrite() against the original or it is thrown away.
 */

export type Pronoun = 'he' | 'she' | 'they';
export type RescuerState = 'steady' | 'panicked' | 'confused';

export type VoiceContext = {
  /** "dad", "mom", "son"... as the rescuer said it, if they did. */
  relation: string | null;
  pronoun: Pronoun;
  state: RescuerState;
  /** When the state was last observed; it decays back to steady. */
  stateAt: number;
  /** Is the rescuer on their own? Then "switch with someone" is useless advice. */
  alone: boolean;
};

export const initialContext: VoiceContext = { relation: null, pronoun: 'they', state: 'steady', stateAt: 0, alone: false };

const RELATIONS: [RegExp, string, Pronoun][] = [
  [/\b(dad|daddy|father|papa)\b/, 'dad', 'he'],
  [/\b(mom|mommy|mother|mama)\b/, 'mom', 'she'],
  [/\b(husband|boyfriend)\b/, 'husband', 'he'],
  [/\b(wife|girlfriend)\b/, 'wife', 'she'],
  [/\b(grandpa|grandfather)\b/, 'grandpa', 'he'],
  [/\b(grandma|grandmother)\b/, 'grandma', 'she'],
  [/\bson\b/, 'son', 'he'],
  [/\bdaughter\b/, 'daughter', 'she'],
  [/\bbrother\b/, 'brother', 'he'],
  [/\bsister\b/, 'sister', 'she'],
  [/\buncle\b/, 'uncle', 'he'],
  [/\baunt\b/, 'aunt', 'she'],
  // Not family: "they" until a he or she is heard.
  [/\b(friend|buddy)\b/, 'friend', 'they'],
  [/\broommate\b/, 'roommate', 'they'],
  [/\bneighbou?r\b/, 'neighbor', 'they'],
  [/\bco ?worker\b/, 'coworker', 'they'],
  [/\bpartner\b/, 'partner', 'they'],
  [/\bteammate\b/, 'teammate', 'they'],
  [/\bcoach\b/, 'coach', 'they'],
  [/\bteacher\b/, 'teacher', 'they'],
];

export const RELATION_NAMES = [...new Set(RELATIONS.map(([, name]) => name))];

// --- Reading the rescuer: weighted signals ----------------------------------------
//
// Several weak signals, each with a weight, add up to a score from 0 to 1.
// 0.5 or more is a state. Every signal that fired is kept with its evidence,
// so the decision can be shown and checked (the desktop mirror's engine panel
// shows exactly these numbers).

export type Signal = { name: string; weight: number; evidence: string | null };
export type Assessment = { distress: number; confusion: number; distressSignals: Signal[]; confusionSignals: Signal[]; state: RescuerState | null };

type Rule = { name: string; weight: number; find: (clean: string, raw: string) => string | null };
const match = (re: RegExp) => (clean: string) => clean.match(re)?.[0] ?? null;

/** A word or a short phrase said twice in a row: "no no", "he's not, he's not". */
function repeated(raw: string): string | null {
  const w = raw.toLowerCase().replace(/[^a-z' ]+/g, ' ').split(/\s+/).filter(Boolean);
  for (let n = 3; n >= 1; n--) {
    for (let i = 0; i + 2 * n <= w.length; i++) {
      const a = w.slice(i, i + n).join(' ');
      if (a.length > 1 && a === w.slice(i + n, i + 2 * n).join(' ')) return `${a} ×2`;
    }
  }
  return null;
}

const DISTRESS: Rule[] = [
  { name: 'Pleading', weight: 0.5, find: match(/\b(oh my god|oh god|please|help me|hurry|what do i do)\b/) },
  { name: 'Fear', weight: 0.5, find: match(/\b(scared|panicking|freaking out|terrified|i can not|i cannot|he is dying|she is dying)\b/) },
  { name: 'Repetition', weight: 0.35, find: (_c, raw) => repeated(raw) },
  { name: 'Exclamation', weight: 0.25, find: (_c, raw) => (/!/.test(raw) ? raw.match(/!+/)![0] : null) },
  { name: 'Shouting', weight: 0.25, find: (_c, raw) => raw.match(/\b[A-Z]{3,}\b/)?.[0] ?? null },
];

const CONFUSION: Rule[] = [
  { name: 'Asked "what"', weight: 0.5, find: match(/^(what|huh)\b/) },
  { name: 'Not following', weight: 0.6, find: match(/\b(i do not understand|i don t understand|i do not get it|i don t get it|confused|i am lost)\b/) },
  { name: 'Asked again', weight: 0.5, find: match(/\b(say that again|repeat|slower|too fast)\b/) },
  { name: 'How do I', weight: 0.4, find: match(/\bhow do i\b/) },
];

function score(rules: Rule[], clean: string, raw: string): { total: number; signals: Signal[] } {
  const signals = rules.map((r) => ({ name: r.name, weight: r.weight, evidence: r.find(clean, raw) }));
  const total = Math.min(1, signals.reduce((sum, s) => sum + (s.evidence ? s.weight : 0), 0));
  return { total, signals };
}

/** How the rescuer sounds in one utterance. */
export function assess(utterance: string): Assessment {
  const clean = normalizeUtterance(utterance);
  const d = score(DISTRESS, clean, utterance);
  const c = score(CONFUSION, clean, utterance);
  const short = clean.split(' ').length <= 8;
  const state: RescuerState | null = d.total >= 0.5 ? 'panicked' : c.total >= 0.5 && short ? 'confused' : null;
  return { distress: d.total, confusion: c.total, distressSignals: d.signals, confusionSignals: c.signals, state };
}

/** Update what we know from something the rescuer said. */
export function learn(ctx: VoiceContext, utterance: string, now = Date.now()): VoiceContext {
  const t = normalizeUtterance(utterance);
  let { relation, pronoun, state, stateAt, alone } = ctx;
  if (/\b(alone|by myself|no one else|nobody else|just me|only me|nobody here|no one here)\b/.test(t)) alone = true;
  else if (/\b(someone (else )?is here|there are two of us|my \w+ is here|people here)\b/.test(t)) alone = false;
  if (!relation) {
    for (const [re, name, p] of RELATIONS) {
      if (re.test(t)) {
        relation = name;
        pronoun = p;
        break;
      }
    }
  }
  if (pronoun === 'they') {
    if (/\b(he|him|his)\b/.test(t)) pronoun = 'he';
    else if (/\b(she|her)\b/.test(t)) pronoun = 'she';
  }
  const read = assess(utterance);
  if (read.state) {
    state = read.state;
    stateAt = now;
  }
  return { relation, pronoun, state, stateAt, alone };
}

/** States fade: 45 seconds without new signs and the voice goes back to normal. */
export function currentState(ctx: VoiceContext, now = Date.now()): RescuerState {
  return now - ctx.stateAt > 45_000 ? 'steady' : ctx.state;
}

// --- Pronouns, with English verb agreement -----------------------------------------

const MODALS = new Set(['can', 'could', 'should', 'will', 'would', 'may', 'might', 'must']);
// Present-tense verbs that follow "they" in our lines and need an -s with he/she.
const VERBS = new Set(['get', 'stop', 'breathe', 'respond', 'need', 'start', 'seem', 'look', 'go', 'have', 'feel', 'wake', 'want', 'move', 'try', 'do']);

function thirdPerson(verb: string): string {
  if (verb === 'have') return 'has';
  if (verb === 'do') return 'does';
  if (verb === 'go') return 'goes';
  if (/(s|sh|ch|x|z)$/.test(verb)) return verb + 'es';
  if (/[^aeiou]y$/.test(verb)) return verb.slice(0, -1) + 'ies';
  return verb + 's';
}

function matchCase(word: string, like: string) {
  return like[0] === like[0].toUpperCase() ? word[0].toUpperCase() + word.slice(1) : word;
}

/**
 * "Do they respond?" -> "Does he respond?"; "Lay them flat on their back" ->
 * "Lay her flat on her back"; "where they are" -> "where he is".
 */
export function personalize(line: string, pronoun: Pronoun): string {
  if (pronoun === 'they' || !/\b(they|them|their|theirs|themselves|they're)\b/i.test(line)) return line;
  const he = pronoun === 'he';
  const subj = he ? 'he' : 'she';
  const obj = he ? 'him' : 'her';
  const poss = he ? 'his' : 'her';

  let s = line
    .replace(/\bthey're\b/gi, (m) => matchCase(`${subj}'s`, m))
    .replace(/\b(are) (they)\b/gi, (m, a: string) => `${matchCase('is', a)} ${subj}`)
    .replace(/\b(do) (they)\b/gi, (m, d: string) => `${matchCase('does', d)} ${subj}`)
    .replace(/\bthey are\b/gi, (m) => matchCase(`${subj} is`, m));

  // "they <verb>" -> "he <verb>s", unless a modal comes first ("can they cough").
  s = s.replace(/(\b\w+\b )?\bthey (\w+)\b/gi, (m, before: string | undefined, verb: string) => {
    const prev = (before ?? '').trim().toLowerCase();
    const pron = matchCase(subj, m.slice((before ?? '').length));
    const v = verb.toLowerCase();
    if (MODALS.has(prev) || !VERBS.has(v)) return `${before ?? ''}${pron} ${verb}`;
    return `${before ?? ''}${pron} ${thirdPerson(v)}`;
  });

  return s
    .replace(/\bthey\b/gi, (m) => matchCase(subj, m))
    .replace(/\bthemselves\b/gi, (m) => matchCase(he ? 'himself' : 'herself', m))
    .replace(/\btheirs\b/gi, (m) => matchCase(he ? 'his' : 'hers', m))
    .replace(/\bthem\b/gi, (m) => matchCase(obj, m))
    .replace(/\btheir\b/gi, (m) => matchCase(poss, m));
}

// --- What to add, based on how the rescuer sounds --------------------------------------

export const CALM_LINE = "I'm right here with you.";
export const NUDGE_SUFFIX = 'Yes or no?';

/** Lines to say before the step's own lines. */
export function preface(ctx: VoiceContext, now = Date.now()): string[] {
  return currentState(ctx, now) === 'panicked' ? [CALM_LINE] : [];
}

/** Voice speed: slower and lower when the rescuer is struggling. 1 = normal. */
export function voiceRate(ctx: VoiceContext, now = Date.now()): number {
  const s = currentState(ctx, now);
  return s === 'confused' ? 0.86 : s === 'panicked' ? 0.92 : 1;
}

/** "Not breathing. We'll do this together." -> "Your dad isn't breathing. We'll do this together." */
export function personalConfirm(confirm: string, ctx: VoiceContext): string {
  if (!ctx.relation) return confirm;
  const who = `Your ${ctx.relation}`;
  const pronoun = ctx.pronoun !== 'they' ? ctx.pronoun : (RELATIONS.find(([, name]) => name === ctx.relation)?.[2] ?? 'they');
  const out = confirm
    .replace(/^Not breathing\./, `${who} isn't breathing.`)
    .replace(/^Collapsed\./, `${who} collapsed.`)
    .replace(/^Choking\./, `${who} is choking.`)
    .replace(/^Bleeding\./, `${who} is bleeding.`);
  return out === confirm ? confirm : personalize(out, pronoun);
}

// --- The safety check for any AI rewrite --------------------------------------------------

/**
 * Words that carry the medicine. A rewrite must keep every one of these that
 * the original line has, and may not add any the original lacks. That stops
 * a model from dropping "on the floor" or inventing "a hand under his head".
 */
const CRITICAL = new Set(
  (
    'aed pad pads bra chest hand hands heel arm arms elbow elbows shoulder shoulders blade blades back side front head chin nose mouth nostril neck ' +
    'leg legs knee foot feet belly button fist palm face hands wound cloth gauze tourniquet floor firm flat bed knee kneel ' +
    'push pushing press pressing pack tilt lift pinch breathe breath breaths puff roll lean stand tap shout shake cough coughing spray plunger ' +
    'water ice butter cream blister blisters cover cool running minute minutes inch inches second seconds time ' +
    'one two three four five six seven eight nine ten twenty thirty third hundred 911 nine ' +
    'never not no stop loosen remove move off up down hard fast deep' +
    ' smile raise drift slurred sentence normally gasping gasp breathing respond responding' +
    // How hard or fast: a model that adds "gently" to "tap and shout" has changed the instruction.
    ' gently gentle softly soft lightly light slowly slow carefully careful quickly quick firmly firm'
  ).split(' '),
);

/** "stops" counts as "stop" ("they stop" becomes "he stops"); words in the list keep their own form. */
function critical(word: string): string | null {
  if (CRITICAL.has(word)) return word;
  if (word.endsWith('es') && CRITICAL.has(word.slice(0, -2))) return word.slice(0, -2);
  if (word.endsWith('s') && CRITICAL.has(word.slice(0, -1))) return word.slice(0, -1);
  return null;
}

function criticalWords(line: string): Set<string> {
  return new Set(
    normalizeUtterance(line.replace(/n't\b/g, ' not'))
      .split(' ')
      .map(critical)
      .filter((w): w is string => w !== null),
  );
}

export type RewriteVerdict = { ok: true } | { ok: false; reason: string };

export function checkRewrite(original: string, rewritten: string, pronoun: Pronoun, relation: string | null = null): RewriteVerdict {
  const words = rewritten.trim().split(/\s+/).length;
  if (!rewritten.trim()) return { ok: false, reason: 'empty' };
  if (words > 12) return { ok: false, reason: 'over 12 words' };
  // Telegraphic English ("Lay him flat on back, floor.") keeps the words but loses clarity.
  if (words < original.trim().split(/\s+/).length - 1) return { ok: false, reason: 'too clipped' };
  if (/[–—]/.test(rewritten)) return { ok: false, reason: 'dash' };
  // The voice speaks to the rescuer about the patient. "you" may only appear if it did
  // before, apart from naming the patient: "your dad".
  const named = relation ? rewritten.replace(new RegExp(`\\byour ${relation}\\b`, 'gi'), relation) : rewritten;
  if (/\byou(r)?\b/i.test(named) && !/\byou(r)?\b/i.test(original)) return { ok: false, reason: 'speaks to the patient' };
  const before = criticalWords(original);
  const after = criticalWords(rewritten);
  const missing = [...before].filter((w) => !after.has(w));
  if (missing.length) return { ok: false, reason: `dropped: ${missing.join(', ')}` };
  const added = [...after].filter((w) => !before.has(w));
  if (added.length) return { ok: false, reason: `added: ${added.join(', ')}` };
  const numbers = (s: string) => (s.match(/\d+/g) ?? []).join(',');
  if (numbers(original) !== numbers(rewritten)) return { ok: false, reason: 'numbers changed' };
  if (pronoun !== 'they' && /\b(they|them|their)\b/i.test(rewritten)) return { ok: false, reason: 'pronoun' };
  // Broken agreement, which small models produce: "Do he respond?", "If he stop responding".
  if (/\b(do|are|have|were) (he|she)\b/i.test(rewritten)) return { ok: false, reason: 'grammar' };
  if (/(?<!\b(?:does|do|did|can|could|should|will|would|may|might|must|to|let|make|help) )\b(he|she) (are|do|have|stop|breathe|respond|get|need|start|look|feel|wake|seem|try|go|move)\b/i.test(rewritten)) {
    return { ok: false, reason: 'grammar' };
  }
  return { ok: true };
}
