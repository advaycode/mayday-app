import { getProtocol, getStep } from './index';
import type { AgeGroup, Choice, Intent, Protocol, Slot, Step } from './schema';

/**
 * The protocol engine: a pure function from (state, event) to (new state,
 * effects). It never touches audio, the screen or the network. The screen
 * dispatches events (a tap, a recognised phrase, a timer firing) and carries
 * out the effects (speak these lines, write this to the incident log).
 *
 * Keeping it pure is what makes it testable: __tests__/engine.test.ts walks
 * every branch of every protocol without a phone.
 */

export type Slots = Partial<Record<Slot, string>>;

export type EngineState = {
  protocolId: string;
  stepId: string;
  slots: Slots;
  /** How many times each step has been entered, keyed "protocol#step". */
  visits: Record<string, number>;
  /** Every step entered, with the time, for the paramedic handoff. */
  trail: { protocolId: string; stepId: string; at: number }[];
};

export type Effect =
  | { type: 'enter'; protocolId: string; step: Step; reentry: boolean }
  | { type: 'say'; lines: string[] }
  | { type: 'log'; text: string; at: number }
  | { type: 'unhandled'; intent: Intent };

export type EngineEvent =
  | { type: 'start'; protocolId: string; slots?: Slots; at: number }
  | { type: 'advance'; at: number }
  | { type: 'choose'; choiceId: string; at: number }
  | { type: 'intent'; intent: Intent; at: number }
  | { type: 'timeout'; at: number }
  | { type: 'goto'; ref: string; at: number }
  | { type: 'setSlots'; slots: Slots; at: number };

export type Result = { state: EngineState; effects: Effect[] };

const MAX_AUTO_HOPS = 12;

/** "CPR" stays CPR; "Severe bleeding" becomes "severe bleeding". */
const logTitle = (p: Protocol) => (p.title === p.title.toUpperCase() ? p.title : p.title.toLowerCase());

export function ageGroupFor(state: { slots: Slots }, protocol?: Protocol): AgeGroup {
  const known = state.slots.age_group;
  if (known === 'adult' || known === 'child' || known === 'infant') return known;
  if (protocol && protocol.ageGroup !== 'any') return protocol.ageGroup;
  return 'adult';
}

/** Turn "breathing", "@recovery_position" or "@cpr_{age_group}#position" into a concrete location. */
export function resolveRef(ref: string, state: { protocolId: string; slots: Slots }): { protocolId: string; stepId: string } {
  if (!ref.startsWith('@')) return { protocolId: state.protocolId, stepId: ref };
  const current = getProtocol(state.protocolId);
  const filled = ref.slice(1).replace('{age_group}', ageGroupFor(state, current));
  const [protocolId, stepId] = filled.split('#');
  return { protocolId, stepId: stepId ?? getProtocol(protocolId).entry };
}

export function currentStep(state: EngineState): Step {
  return getStep(state.protocolId, state.stepId);
}

function enter(state: EngineState, ref: string, at: number, effects: Effect[], hops = 0): EngineState {
  const { protocolId, stepId } = resolveRef(ref, state);
  const step = getStep(protocolId, stepId);
  let next: EngineState = { ...state, protocolId, stepId };

  // If an ask step's answer is already known (the router heard "he's not
  // breathing" before we asked), skip the question and follow the answer.
  if (step.kind === 'ask' && step.slot && hops < MAX_AUTO_HOPS) {
    const known = next.slots[step.slot];
    const choice = known !== undefined ? step.choices.find((c) => c.value === known) : undefined;
    if (choice) {
      effects.push({ type: 'log', text: `${step.text}${/[?.!]$/.test(step.text) ? '' : ':'} ${choice.label} (already known)`, at });
      return enter(next, choice.next, at, effects, hops + 1);
    }
  }

  const key = `${protocolId}#${stepId}`;
  const count = (next.visits[key] ?? 0) + 1;
  next = {
    ...next,
    visits: { ...next.visits, [key]: count },
    trail: [...next.trail, { protocolId, stepId, at }],
  };
  const reentry = count > 1;

  if (protocolId !== state.protocolId) {
    effects.push({ type: 'log', text: `Started ${logTitle(getProtocol(protocolId))}`, at });
  }
  if (step.log) effects.push({ type: 'log', text: step.log, at });
  effects.push({ type: 'enter', protocolId, step, reentry });

  const lines = step.kind === 'cpr' && reentry && step.resumeSay.length > 0 ? step.resumeSay : step.say;
  effects.push({ type: 'say', lines });
  return next;
}

function choicesOf(step: Step): Choice[] {
  switch (step.kind) {
    case 'ask':
    case 'hold':
    case 'end':
      return step.choices;
    case 'do':
      return step.alts;
    default:
      return [];
  }
}

function choose(state: EngineState, choice: Choice, step: Step, at: number, effects: Effect[]): EngineState {
  let slots = state.slots;
  if (step.kind === 'ask' && step.slot && choice.value !== undefined) {
    slots = { ...slots, [step.slot]: choice.value };
  }
  effects.push({ type: 'log', text: `${step.text}${/[?.!]$/.test(step.text) ? '' : ':'} ${choice.label}`, at });
  return enter({ ...state, slots }, choice.next, at, effects);
}

export function reduce(state: EngineState | null, event: EngineEvent): Result {
  const effects: Effect[] = [];

  if (event.type === 'start') {
    const protocol = getProtocol(event.protocolId);
    const base: EngineState = {
      protocolId: protocol.id,
      stepId: protocol.entry,
      slots: { ...(state?.slots ?? {}), ...(event.slots ?? {}) },
      visits: state?.visits ?? {},
      trail: state?.trail ?? [],
    };
    effects.push({ type: 'log', text: `Started ${logTitle(protocol)}`, at: event.at });
    // Enter via an absolute ref so the "Started" log is not duplicated.
    const next = enter({ ...base, protocolId: protocol.id }, protocol.entry, event.at, effects);
    return { state: next, effects };
  }

  if (!state) throw new Error(`Engine not started (got ${event.type})`);
  const step = currentStep(state);

  switch (event.type) {
    case 'setSlots':
      return { state: { ...state, slots: { ...state.slots, ...event.slots } }, effects };

    case 'goto':
      return { state: enter(state, event.ref, event.at, effects), effects };

    case 'advance': {
      if (step.kind === 'do') return { state: enter(state, step.next, event.at, effects), effects };
      if (step.kind === 'timer') return { state: enter(state, step.actionNext ?? step.next, event.at, effects), effects };
      return { state, effects };
    }

    case 'timeout': {
      if (step.kind === 'ask' && step.timeoutNext) {
        effects.push({ type: 'log', text: `${step.text}${/[?.!]$/.test(step.text) ? '' : ':'} no answer`, at: event.at });
        return { state: enter(state, step.timeoutNext, event.at, effects), effects };
      }
      if (step.kind === 'timer') {
        if (step.doneSay.length) effects.push({ type: 'say', lines: step.doneSay });
        return { state: enter(state, step.next, event.at, effects), effects };
      }
      return { state, effects };
    }

    case 'choose': {
      const choice = choicesOf(step).find((c) => c.id === event.choiceId);
      if (!choice) throw new Error(`No choice ${event.choiceId} on ${state.protocolId}#${state.stepId}`);
      return { state: choose(state, choice, step, event.at, effects), effects };
    }

    case 'intent': {
      const { intent } = event;
      // 1. An answer to what is on screen right now wins.
      const match = choicesOf(step).find((c) => c.intents.includes(intent));
      if (match) return { state: choose(state, match, step, event.at, effects), effects };

      // 2. "Next" / "done" moves a do-step or timer on.
      if (intent === 'next' && (step.kind === 'do' || step.kind === 'timer')) {
        return reduce(state, { type: 'advance', at: event.at });
      }

      // 3. "Repeat" / "what do I do" says the current step again.
      if (intent === 'repeat' || intent === 'what_now') {
        effects.push({ type: 'say', lines: step.say });
        return { state, effects };
      }

      // 4. Interrupts that apply anywhere in this protocol ("the AED is here").
      const protocol = getProtocol(state.protocolId);
      const interrupt = protocol.interrupts.find(
        (i) => i.intent === intent && (!i.onlyFrom || i.onlyFrom.includes(state.stepId)),
      );
      if (interrupt) {
        effects.push({ type: 'log', text: `Heard: ${intent.replace(/_/g, ' ')}`, at: event.at });
        return { state: enter(state, interrupt.goto, event.at, effects), effects };
      }

      effects.push({ type: 'unhandled', intent });
      return { state, effects };
    }
  }
}

/** Every step reachable from a protocol's entry, following every edge (including into other protocols). */
export function reachable(protocolId: string, ageGroup: AgeGroup = 'adult'): Set<string> {
  const seen = new Set<string>();
  const queue: { protocolId: string; stepId: string }[] = [
    { protocolId, stepId: getProtocol(protocolId).entry },
  ];
  const slots: Slots = { age_group: ageGroup };
  while (queue.length) {
    const loc = queue.shift()!;
    const key = `${loc.protocolId}#${loc.stepId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const step = getStep(loc.protocolId, loc.stepId);
    const ctx = { protocolId: loc.protocolId, slots };
    const refs: string[] = [];
    if ('next' in step) refs.push(step.next);
    if (step.kind === 'timer' && step.actionNext) refs.push(step.actionNext);
    if (step.kind === 'ask' && step.timeoutNext) refs.push(step.timeoutNext);
    if (step.kind === 'cpr') refs.push(step.aedNext);
    for (const c of choicesOf(step)) refs.push(c.next);
    for (const i of getProtocol(loc.protocolId).interrupts) refs.push(i.goto);
    for (const r of refs) queue.push(resolveRef(r, ctx));
  }
  return seen;
}
