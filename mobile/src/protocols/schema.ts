import { z } from 'zod';

/**
 * The protocol format. A protocol is a small state machine: a list of steps,
 * each of which says what to show, what to say out loud, and where to go
 * next. The model never writes any of this; it is authored, cited, and
 * versioned in src/protocols/corpus/*.json and checked by these schemas and
 * by __tests__/protocols.test.ts.
 */

/** Things a person can say mid-protocol that the router turns into an intent. */
export const Intent = z.enum([
  'yes',
  'no',
  'next',
  'repeat',
  'what_now',
  'alone',
  'aed_here',
  'vomiting',
  'tired',
  'breathing',
  'not_breathing',
  'responsive',
  'unresponsive',
  'coughing',
  'choking',
  'object_out',
  'worse',
  'still_bleeding',
  'limb',
  'junctional',
  'torso',
  'major',
  'minor',
  'pregnant',
  'ems_here',
]);
export type Intent = z.infer<typeof Intent>;

/** Facts about the incident that steps can ask for and the router can fill in early. */
export const Slot = z.enum([
  'age_group',
  'conscious',
  'breathing',
  'others_present',
  'rescue_breaths',
  'severe_fbao',
  'wound_site',
  'has_tourniquet',
  'burn_severity',
  'fast_face',
  'fast_arms',
  'fast_speech',
  'has_naloxone',
  'spine_injury',
]);
export type Slot = z.infer<typeof Slot>;

/**
 * Where a step leads. Either a step id in the same protocol ("breathing"), or
 * another protocol ("@recovery_position", "@cpr_adult#position"). A
 * "{age_group}" placeholder is filled from what we know about the person, so
 * a choking child who collapses lands in child CPR, not adult CPR.
 */
export const StepRef = z.string().regex(/^(@[a-z_{}]+(#[a-z_]+)?|[a-z_]+)$/);

const Choice = z.object({
  id: z.string(),
  label: z.string(),
  next: StepRef,
  value: z.string().optional(),
  intents: z.array(Intent).default([]),
});
export type Choice = z.infer<typeof Choice>;

const common = {
  id: z.string().regex(/^[a-z0-9_]+$/),
  /** Headline on screen. Short enough to read at arm's length while kneeling. */
  text: z.string().min(1),
  sub: z.string().optional(),
  /** Spoken lines, one utterance each, at most 12 words. */
  say: z.array(z.string().min(1)).min(1),
  visual: z.string().optional(),
  /** Incident-log line written when this step is entered. */
  log: z.string().optional(),
  source: z.string(),
  /** Verbatim text from the source, or null when it has not been read first-hand. */
  quote: z.string().nullable(),
  verified: z.boolean(),
  note: z.string().optional(),
};

const DoStep = z.object({
  ...common,
  kind: z.literal('do'),
  next: StepRef,
  /** Label for the advance button. */
  action: z.string().default('Done'),
  /** Other ways out of this step ("It came out"). */
  alts: z.array(Choice).default([]),
});

const AskStep = z.object({
  ...common,
  kind: z.literal('ask'),
  slot: Slot.optional(),
  choices: z.array(Choice).min(2),
  /** If nobody answers, move on after this many seconds without recording an answer. */
  timeoutS: z.number().positive().optional(),
  timeoutNext: StepRef.optional(),
});

const CprStep = z.object({
  ...common,
  kind: z.literal('cpr'),
  /** 'fromSlot' = 30:2 if the rescuer said yes to breaths, otherwise hands-only. */
  ratio: z.enum(['fromSlot', 'handsOnly', '30:2']),
  resumeSay: z.array(z.string()).default([]),
  depthSay: z.string(),
  reminders: z.array(z.string()).min(1),
  breathsSay: z.array(z.string()).min(1),
  swapEveryS: z.number().positive(),
  aedNext: StepRef,
});

const HoldStep = z.object({
  ...common,
  kind: z.literal('hold'),
  remindEveryS: z.number().positive(),
  reminders: z.array(z.string()).min(1),
  choices: z.array(Choice).default([]),
});

const TimerStep = z.object({
  ...common,
  kind: z.literal('timer'),
  seconds: z.number().positive(),
  doneSay: z.array(z.string()).default([]),
  next: StepRef,
  action: z.string().default('Done'),
  /** Where the manual button goes, if different from where the timer goes. */
  actionNext: StepRef.optional(),
});

const EndStep = z.object({
  ...common,
  kind: z.literal('end'),
  choices: z.array(Choice).default([]),
});

export const Step = z.discriminatedUnion('kind', [DoStep, AskStep, CprStep, HoldStep, TimerStep, EndStep]);
export type Step = z.infer<typeof Step>;
export type StepOf<K extends Step['kind']> = Extract<Step, { kind: K }>;

export const AgeGroup = z.enum(['adult', 'child', 'infant']);
export type AgeGroup = z.infer<typeof AgeGroup>;

/**
 * What the map and the voice say about getting to care. This lives in the
 * protocol, not in the model:
 *   ems_stay       call 911 and stay; do not drive them yourself
 *   trauma_stay    same, and the likely destination is a trauma center
 *   stroke_stay    same, and the likely destination is a stroke-capable ER
 *   by_severity    depends on a slot (burns: major -> 911, minor -> urgent care is fine)
 */
export const Care = z.enum(['ems_stay', 'trauma_stay', 'stroke_stay', 'by_severity']);
export type Care = z.infer<typeof Care>;

export const Protocol = z.object({
  $schema: z.literal('mayday.protocol.v2'),
  id: z.string().regex(/^[a-z_]+$/),
  version: z.string().regex(/^\d+\.\d+\.\d+$/),
  title: z.string(),
  short: z.string(),
  ageGroup: z.enum(['adult', 'child', 'infant', 'any']),
  appliesTo: z.array(AgeGroup).optional(),
  icon: z.string(),
  care: Care,
  entry: z.string(),
  interrupts: z
    .array(z.object({ intent: Intent, goto: StepRef, onlyFrom: z.array(z.string()).optional() }))
    .default([]),
  steps: z.array(Step).min(1),
});
export type Protocol = z.infer<typeof Protocol>;

export const Source = z.object({
  id: z.string(),
  title: z.string(),
  publisher: z.string(),
  citation: z.string(),
  url: z.string().url(),
  retrieved: z.string().nullable(),
  method: z.enum(['local-copy', 'direct-fetch', 'search-excerpt', 'not-retrieved']),
  localCopy: z.string().optional(),
  note: z.string().optional(),
});
export type Source = z.infer<typeof Source>;

export const SourceFile = z.object({
  $schema: z.literal('mayday.sources.v2'),
  note: z.string(),
  sources: z.array(Source),
});
