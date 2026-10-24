import type { Intent } from '@/protocols/schema';

import { EMPTY, type ProtocolId, type RouterOutput, type RouterSlots } from './routerSchema';

/**
 * The offline router: turns what a panicking person says into a protocol,
 * facts about the patient, or an in-protocol command, using rules only.
 *
 * It runs on every phone, with no signal, in under a millisecond, and it is
 * the path that decides when to start CPR. A language model behind the proxy
 * may add detail later (llmRouter.ts), but it can never delay this.
 *
 * People in an emergency do not speak in clean sentences ("he's not, he's
 * not breathing, help"), so the first job is cleaning the transcript:
 * expanding contractions, dropping punctuation, and collapsing repeated
 * words and phrases.
 */

const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
  eleven: 11, twelve: 12, thirteen: 13, fourteen: 14, fifteen: 15, sixteen: 16, seventeen: 17,
  eighteen: 18, nineteen: 19, twenty: 20,
};

/**
 * English as it is spoken, and as recognizers mishear it, mapped onto the
 * words the rules know. Applied after punctuation is gone, in this order
 * (multi-word answers before the single words inside them). Tested on
 * __tests__/dialects.test.ts.
 */
const DIALECT: [RegExp, string][] = [
  // Yes and no, the many ways. "Yeah nah" is no and "nah yeah" is yes (Australia, New Zealand).
  [/\byeah nah( nah)?\b/g, 'no'],
  [/\bnah yeah( yeah)?\b/g, 'yes'],
  [/\b(uh huh|mm hmm|mmhmm|mhm+|yessir|yes sir|yes maam|aye|ja|yah|yea)\b/g, 'yes'],
  [/\b(nuh uh|naw|nae|nay|nope)\b/g, 'no'],
  // Scots negatives.
  [/\b(cannae|canna)\b/g, 'cannot'],
  [/\b(isnae)\b/g, 'is not'],
  [/\b(disnae|doesnae)\b/g, 'does not'],
  [/\b(dinnae|dinna)\b/g, 'do not'],
  [/\b(wasnae)\b/g, 'was not'],
  [/\b(didnae)\b/g, 'did not'],
  [/\b(willnae|winnae)\b/g, 'will not'],
  // Fillers carry nothing ("um uh he is not breathing"; Singapore "lah", "leh", "lor").
  [/\b(um+|uh+|er+|erm+|hmm+|ah+|lah|leh|lor|innit|you know)\b/g, ' '],
  // Spelling as heard.
  [/\b(wat|wot|whut)\b/g, 'what'],
  [/\bgonna\b/g, 'going to'],
  [/\bwanna\b/g, 'want to'],
  [/\bme (own|mate|mum|dad|brother|sister|son|daughter|wife|husband)\b/g, 'my $1'],
  [/\bon my own\b/g, 'alone'],
  // Words recognizers often get wrong in an emergency.
  [/\b(breathin|breathen|brething|breating|breathe in)\b/g, 'breathing'],
  // "Breeding" may be breathing or bleeding; only "not breeding" is safe to read (as not breathing).
  [/\bnot breeding\b/g, 'not breathing'],
  [/\b(bleedin|bleading)\b/g, 'bleeding'],
  [/\b(chalking|chocking|choaking|chokin|choke in)\b/g, 'choking'],
  [/\b(fentanol|fentanil|fentanel|fenta nil)\b/g, 'fentanyl'],
  [/\b(narkan|nar can|nark an|nar kin)\b/g, 'narcan'],
  [/\b(od|o d|oded|od d|overdoes)\b/g, 'overdosed'],
  [/\b(tourney kit|tourney cat|turnicut|tournicut|tourniquette|turnicate)\b/g, 'tourniquet'],
  [/\b(defibulator|defibrilator)\b/g, 'defibrillator'],
  [/\b(epi pen|eppy pen)\b/g, 'epipen'],
  [/\b(c p r|see pee are)\b/g, 'cpr'],
  [/\b(hymlick|heimlick|himlick)\b/g, 'heimlich'],
  [/\b(having a fit|is fitting|are fitting|in a fit|seizing|seizin)\b/g, 'having a seizure'],
  // -in' spoken endings with the apostrophe already gone: "talkin funny", "droopin", "movin".
  [/\b(talk|mov|respond|wak|gasp|shak|droop|slurr|bleed|burn|chok|turn|go)in\b/g, '$1ing'],
];

export function normalizeUtterance(raw: string): string {
  let t = ` ${raw.toLowerCase().replace(/[‘’`]/g, "'")} `;
  t = t
    .replace(/\bain'?t\b/g, 'is not')
    .replace(/\bod'?d\b/g, 'overdosed')
    .replace(/\b(\w+)in'(?=\s|$)/g, '$1ing')
    .replace(/\bcan't\b/g, 'cannot')
    .replace(/\bcant\b/g, 'cannot')
    .replace(/\bcan not\b/g, 'cannot')
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bwont\b/g, 'will not')
    .replace(/\b(\w+)n't\b/g, '$1 not')
    .replace(/\b(is|was|does|are|did|has)nt\b/g, '$1 not')
    .replace(/\b(he|she|it|that|there|what|who)'s\b/g, '$1 is')
    .replace(/\b(they|you|we)'re\b/g, '$1 are')
    .replace(/\bi'm\b/g, 'i am')
    .replace(/\b(\w+)'ll\b/g, '$1 will')
    .replace(/\b(\w+)'ve\b/g, '$1 have')
    .replace(/\ba\.?e\.?d\b/g, 'aed')
    .replace(/\ba e d\b/g, 'aed')
    .replace(/\b9[ -]?1[ -]?1\b/g, 'nine one one')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ');
  for (const [re, to] of DIALECT) t = t.replace(re, to);
  t = t.replace(/\s+/g, ' ').trim();

  // Collapse stutters and repeated phrases: "he is not he is not breathing" -> "he is not breathing".
  let words = t.split(' ');
  for (let n = 4; n >= 1; n--) {
    const out: string[] = [];
    for (let i = 0; i < words.length; ) {
      const a = words.slice(i, i + n).join(' ');
      const b = words.slice(i + n, i + 2 * n).join(' ');
      // Repeated number words are real ("nine one one"), not a stutter.
      if (a && a === b && !(n === 1 && a in NUMBER_WORDS)) {
        i += n; // skip the first copy
        continue;
      }
      out.push(words[i]);
      i++;
    }
    words = out;
  }
  return words.join(' ');
}

const has = (t: string, re: RegExp) => re.test(t);

// --- Patient facts -------------------------------------------------------

// "Can't breathe" is left out on purpose: a person who can say it, or who is
// choking, is not in cardiac arrest. It is handled by the choking rules.
const NEG = '(not|no|never|stopped|barely|hardly|without)';

/**
 * Asking about breathing, or not being sure, is not an answer: "is he
 * breathing?", "how do I know if she's breathing", "I can't tell if he's
 * breathing", "check his breathing". These used to set breathing to normal,
 * and the middle two even answered "yes, breathing normally" at the
 * breathing question: the one mistake Mayday must never make. They now say
 * nothing about breathing, and the assistant offers the phone check instead
 * (voice/sensorTalk.ts).
 */
export function unsureAboutBreathing(t: string): boolean {
  return (
    has(t, /\b(if|whether)( \w+){0,3} breath\w*/) ||
    has(t, /^(is|are|does|do) (he|she|they|it|the (person|patient|man|woman|baby|child|kid)|my \w+) (still |really |even )?breath\w*/) ||
    // "I don't know what to do" is about the rescuer, not the breathing.
    has(t.replace(/\b(do not know|dunno|not sure) what to do\b/g, ' '), /\b(not sure|do not know|dunno|cannot tell|can not tell|hard to tell|how (do|can|would|will|should) i (know|tell|check))\b/) ||
    has(t, /\b(check|checking|measure|test)( \w+){0,2} breath\w*/)
  );
}

/** Doubt phrases that contain "not": taken out before looking for "not breathing". */
const DOUBT = /\b(not sure|do not know|cannot tell|can not tell|hard to tell)\b/g;

function breathing(t: string): RouterSlots['breathing'] {
  if (has(t, /\b(gasp\w*|agonal|snoring weird|blue lips|lips are blue)\b/)) return 'abnormal';
  // "I'm not sure what to do, he's not breathing" is still not breathing.
  const plain = t.replace(DOUBT, ' ');
  if (has(plain, /\b(turning|turned|gone|going|went) blue\b/) && !has(plain, /\bchok\w*/)) return 'abnormal';
  if (has(plain, new RegExp(`\\b${NEG}( \\w+){0,2} breath\\w*`))) return 'abnormal';
  // "Breathing weird", "breathing very strange", "breathing is kind of off".
  if (has(plain, /\bbreath\w*( \w+){0,3} (weird\w*|funny|strange\w*|wrong|shallow|slow|gurgl\w*|odd\w*|off|bad|noisy|irregular|struggl\w*|labou?red)\b/)) return 'abnormal';
  if (has(plain, /\b(weird|funny|strange|odd|shallow|noisy|irregular|struggling|labou?red) breath\w*/)) return 'abnormal';
  // Doubt only ever withholds the reassuring answer.
  if (unsureAboutBreathing(t)) return undefined;
  if (has(t, /\bbreathing\b/) && !has(t, /\bcannot breathe\b/)) return 'normal';
  return undefined;
}

function conscious(t: string): RouterSlots['conscious'] {
  if (
    has(t, /\b(unconscious|unresponsive|passed out|passing out|collapsed|collapse|collapsing|fainted|fainting|went limp|limp|out cold|knocked out|blacked out|flaked out|conked out|keeled over|went down|dropped)\b/) ||
    has(t, /\b(not|will not|cannot|wont) (respond\w*|wake\w*|move\w*|answer\w*)\b/) ||
    // "Can't talk" means unresponsive, unless something is stuck in their throat.
    (has(t, /\b(not|will not|cannot|wont) talk\w*\b/) && !has(t, /\b(chok\w*|stuck|throat|swallow\w*)\b/)) ||
    has(t, /\bnot awake\b/)
  ) {
    return 'false';
  }
  if (has(t, /\b(awake|conscious|talking|responding|alert|woke up|opened (his|her|their) eyes)\b/)) return 'true';
  return undefined;
}

function ageGroup(t: string): RouterSlots['age_group'] {
  const m = t.match(/\b(\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty) (year|years|yr|yrs|month|months|week|weeks) old\b/);
  if (m) {
    const n = Number(m[1]) || NUMBER_WORDS[m[1]] || 0;
    if (m[2].startsWith('month') || m[2].startsWith('week')) return n < 12 || m[2].startsWith('week') ? 'infant' : 'child';
    if (n < 1) return 'infant';
    return n <= 12 ? 'child' : 'adult';
  }
  if (has(t, /\b(baby|babys|infant|newborn|new born)\b/)) return 'infant';
  if (has(t, /\b(child|kid|kids|toddler|little (boy|girl|brother|sister|one)|preschooler|grandson|granddaughter)\b/)) return 'child';
  if (has(t, /\b(boy|girl)\b/) && !has(t, /\b(boyfriend|girlfriend)\b/)) return 'child';
  if (
    has(t, /\b(dad|daddy|father|mom|mommy|mother|grandma|grandpa|grandmother|grandfather|husband|wife|man|woman|guy|lady|coworker|boss|uncle|aunt|neighbor|stranger|adult|teacher|boyfriend|girlfriend|partner|old man|old lady|customer|player|coach)\b/)
  ) {
    return 'adult';
  }
  return undefined;
}

function woundSite(t: string): RouterSlots['wound_site'] {
  if (has(t, /\b(neck|armpit|groin|inner thigh)\b/)) return 'junctional';
  if (has(t, /\b(chest|stomach|belly|abdomen|gut|torso|back)\b/)) return 'torso';
  if (has(t, /\b(arm|leg|hand|foot|feet|thigh|calf|wrist|ankle|forearm|knee|elbow|finger|toe)s?\b/)) return 'limb';
  return undefined;
}

// --- Protocols -----------------------------------------------------------

type Hit = { protocol: 'cpr' | 'choking' | ProtocolId; score: number; urgent: boolean };

function protocolHits(t: string, slots: RouterSlots): Hit[] {
  const hits: Hit[] = [];
  const eating = has(t, /\b(eat\w*|food|swallow\w*|steak|candy|grape|hot dog|popcorn|toy|coin|bite|chewing)\b/);

  if (has(t, /\b(chok\w*|something stuck|stuck in (his|her|their|the|my) throat|food stuck|lodged)\b/) || (eating && has(t, /\bcannot (breathe|talk|speak|cough)\b/))) {
    hits.push({ protocol: 'choking', score: 0.95, urgent: true });
  }
  if (has(t, /\b(overdos\w*|fentanyl|heroin|opioid\w*|opiate\w*|narcan|naloxone|too many pills|took too many|pills)\b/)) {
    hits.push({ protocol: 'opioid_overdose', score: 0.9, urgent: slots.conscious === 'false' || slots.breathing === 'abnormal' });
  }
  if (has(t, /\b(bleed\w*|blood\w*|stabbed|stab|shot|gunshot|gash\w*|lacerat\w*|slashed|severed|amputat\w*|cut (his|her|their|my) )/) || has(t, /\b(deep|bad) cut\b/)) {
    hits.push({ protocol: 'bleeding', score: 0.9, urgent: has(t, /\b(spurt\w*|gush\w*|lot of blood|so much blood|will not stop|pool\w*|stabbed|shot)\b/) });
  }
  if (has(t, /\b(burn\w*|scald\w*|boiling|hot oil|grease|caught fire|on fire)\b/)) {
    hits.push({ protocol: 'burns', score: 0.9, urgent: false });
  }
  if (has(t, /\b(stroke|droop\w*|slur\w*|lopsided|face (is )?(drooping|hanging|uneven)|one side (of (his|her|their) (face|body) )?(is )?(numb|weak|limp)|numb on one side|cannot (lift|raise) (his|her|their|one) arm|talking funny|words (are )?(jumbled|weird|wrong))\b/)) {
    hits.push({ protocol: 'stroke', score: 0.88, urgent: false });
  }
  const choking = hits.some((h) => h.protocol === 'choking');
  const overdose = hits.find((h) => h.protocol === 'opioid_overdose');
  // An unresponsive choking person gets CPR (2025 FBAO algorithm). A responsive one gets choking care.
  if (choking && slots.conscious === 'false') {
    hits.push({ protocol: 'cpr', score: 0.99, urgent: true });
    return hits;
  }
  // Overdose with breathing trouble: the overdose protocol gives naloxone AND leads into CPR.
  if (overdose && (slots.breathing === 'abnormal' || slots.conscious === 'false')) {
    overdose.score = 0.98;
    overdose.urgent = true;
    return hits;
  }
  const arrestWords = has(t, /\b(no pulse|no heartbeat|heart stopped|cardiac arrest|drown\w*|pulled (him|her|them) out of the (water|pool))\b/);
  if (choking && !arrestWords) return hits;
  if (arrestWords || slots.breathing === 'abnormal') {
    hits.push({ protocol: 'cpr', score: 0.97, urgent: true });
  } else if (slots.conscious === 'false') {
    // Collapsed, breathing unknown: the CPR protocol starts by checking.
    hits.push({ protocol: 'cpr', score: 0.85, urgent: true });
  } else if (has(t, /\bheart attack\b/)) {
    hits.push({ protocol: 'cpr', score: 0.6, urgent: false });
  }
  return hits;
}

function pickVariant(protocol: Hit['protocol'], age: RouterSlots['age_group'], slots: RouterSlots): ProtocolId {
  if (protocol === 'cpr') {
    if (slots.conscious === 'false' && slots.breathing === 'normal') return 'recovery_position';
    if (age === 'infant') return 'cpr_infant';
    if (age === 'child') return 'cpr_child';
    return 'cpr_adult';
  }
  if (protocol === 'choking') return age === 'infant' ? 'choking_infant' : 'choking';
  return protocol;
}

// --- In-protocol intents ------------------------------------------------

const INTENTS: [Intent, RegExp][] = [
  ['ems_here', /\b(paramedic\w*|ambulance|ems|firefighter\w*|fire department|medics) (is |are )?(here|arrived)\b/],
  ['aed_here', /\b(aed|defib\w*)\b.*\b(here|arrived|got|found|have|brought|open)\b|\b(got|found|have|brought) (the |an |a )?(aed|defib\w*)\b/],
  ['object_out', /\b(came out|it is out|its out|spit it out|got it out|coughed it up|popped out|cleared)\b/],
  ['vomiting', /\b(vomit\w*|throw\w* up|threw up|puk\w*|sick everywhere)\b/],
  ['tired', /\b(tired|exhausted|cannot keep going|arms hurt|need a break|cannot do this)\b/],
  ['alone', /\b(i am alone|by myself|nobody (else )?(is )?here|no one (else )?(is )?here|just me)\b/],
  ['still_bleeding', /\b(still bleeding|soak\w* through|will not stop|keeps bleeding|bleeding through|not stopping)\b/],
  ['pregnant', /\b(pregnant|too big|cannot reach around)\b/],
  ['not_breathing', new RegExp(`\\b${NEG}( \\w+){0,2} breath\\w*`)],
  ['breathing', /\b(is|are|started|starting) breathing\b|\bbreathing (again|now|on (his|her|their) own)\b/],
  ['unresponsive', /\b(passed out|unconscious|collapsed|went limp|not responding|stopped responding|will not wake|not waking|no wake|out cold|blacked out|keeled over)\b/],
  ['responsive', /\b(woke up|waking up|is awake|are awake|talking|opened (his|her|their) eyes|moving|responding)\b/],
  ['coughing', /\b(cough\w*)\b/],
  ['what_now', /\b(what (do|should) i do|what now|what next|help me|now what|(do not|dont) know what to do|what am i supposed to do)\b/],
  ['repeat', /\b(repeat|again|say that again|what did you say|didn t hear|did not hear|pardon|huh)\b/],
  ['next', /\b(next|done|ok|okay|ready|got it|did it|continue|go on|finished|it is on|they are on|turned it on|sorted|alright|all right|can already|(gone|went|going|ran) (to get|for) (it|one|the aed|the defibrillator)|is getting (it|one))\b/],
];

// "He is" alone is a yes; "he is gasping" or "he's gone blue" is not, so pronoun answers must be the whole reply.
const YES = /^(yes|yeah|yep|yup|ya|uh huh|correct|right|affirmative|i am|i can|i do|i have|sure)\b|^(yes |yeah )?(he|she|they|it) (is|are|does|do)( yes| yeah)?$/;
const NO = /^(no|nope|nah|negative|he is not|she is not|they are not|it is not|i cannot|i do not|i am not)\b/;

export type RouteContext = {
  /** True while a protocol is running: short answers are probably answers. */
  inProtocol?: boolean;
  known?: RouterSlots;
};

export function route(raw: string, ctx: RouteContext = {}): RouterOutput {
  const t = normalizeUtterance(raw);
  if (!t) return EMPTY;

  const slots: RouterSlots = {};
  const b = breathing(t);
  if (b) slots.breathing = b;
  const c = conscious(t);
  if (c) slots.conscious = c;
  const age = ageGroup(t) ?? ctx.known?.age_group;
  if (ageGroup(t)) slots.age_group = ageGroup(t);
  const site = woundSite(t);
  if (site && has(t, /\b(bleed\w*|blood|cut|stab\w*|shot|wound|gash)\b/)) slots.wound_site = site;
  if (has(t, /\b(chok\w*)\b/) && has(t, /\bcannot (breathe|talk|speak|cough)|turning blue|silent|no sound\b/)) slots.severe_fbao = 'true';
  if (has(t, /\b(chok\w*)\b/) && has(t, /\b(coughing hard|is coughing|can talk|still talking)\b/)) slots.severe_fbao = 'false';
  if (has(t, /\b(have|got|has) (some |a )?(narcan|naloxone)\b/)) slots.has_naloxone = 'true';
  if (has(t, /\b(face|hands|whole (arm|leg|back|chest)|large|huge|big|smoke|chemical|electric\w*)\b/) && has(t, /\bburn\w*/)) slots.burn_severity = 'major';
  if (has(t, /\b(i am alone|by myself|nobody (else )?here|no one (else )?here)\b/)) slots.others_present = 'false';

  // In-protocol command?
  let intent: Intent | null = null;
  if (ctx.inProtocol) {
    // Specific phrases first ("he's throwing up" is not a yes), then a bare
    // yes or no, then the generic next/repeat/what-now.
    const generic: Intent[] = ['next', 'repeat', 'what_now'];
    const short = t.split(' ').length <= 4;
    // A question or a doubt about breathing never answers "yes, breathing".
    const unsure = unsureAboutBreathing(t);
    intent =
      INTENTS.find(([name, re]) => !generic.includes(name) && !(unsure && name === 'breathing') && re.test(t))?.[0] ??
      (YES.test(t) && short ? 'yes' : NO.test(t) && short ? 'no' : null) ??
      INTENTS.find(([name, re]) => generic.includes(name) && re.test(t))?.[0] ??
      null;
    // The words win over the form: "yes, he's gasping" or "he is breathing weird" is
    // not "yes, breathing normally". The fact (abnormal, unresponsive) answers instead.
    const worse = slots.breathing === 'abnormal' || slots.conscious === 'false';
    if (worse && (intent === 'yes' || intent === 'breathing' || intent === 'responsive')) intent = null;
  }

  const merged = { ...ctx.known, ...slots };
  const hits = protocolHits(t, merged).sort((a, b) => b.score - a.score);
  const top = hits[0];

  if (!top) {
    if (intent) return { ...EMPTY, intent, slots, confidence: 0.85 };
    // Nothing recognisable. Ask the most useful single question.
    const unsure = has(t, /\bcannot breathe|help|emergency|hurt|fell|accident|seizure|shaking|allerg\w*\b/);
    return { ...EMPTY, slots, confidence: Object.keys(slots).length ? 0.3 : 0, next_question: unsure || !ctx.inProtocol ? 'what' : null };
  }

  const protocol_id = pickVariant(top.protocol, age, merged);
  const ageMatters = ['cpr_adult', 'choking', 'bleeding', 'opioid_overdose'].includes(protocol_id);
  const next_question = !age && ageMatters ? 'age' : null;
  // Confidence: the rule's own strength, a little lower when two different protocols both fired.
  const conflict = hits.length > 1 && hits[1].protocol !== top.protocol && hits[1].score > 0.85;
  const confidence = Math.max(0, top.score - (conflict ? 0.15 : 0) - (next_question ? 0.05 : 0));

  return { protocol_id, intent, slots, confidence, next_question, urgent: top.urgent };
}
