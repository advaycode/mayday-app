import * as Speech from 'expo-speech';

import { audio } from '@/audio/engine';
import { adaptLines as requestAdaptation, capabilities } from '@/ai/proxy';
import { getSettings } from '@/settings/store';

import { checkRewrite, currentState, initialContext, learn, personalize, preface, voiceRate, type VoiceContext } from './adapt';

/**
 * The voice of one emergency: who we are helping, how the rescuer sounds,
 * and any AI phrasing that has passed the safety check. Everything Mayday
 * says during an emergency goes through say() here, so every line adapts.
 *
 * Speaking never waits for a model. A line is spoken in its adapted form
 * only once that form's audio is ready; until then it is the pre-recorded
 * he/she/they version.
 */

let ctx: VoiceContext = initialContext;
/** original line -> checked AI rewrite, for the current patient. */
const rewrites = new Map<string, string>();
const requested = new Set<string>();
let lastHeardAt = Date.now();
/** The panic we already answered with the calming line (by when it was heard). */
let calmedFor = -1;

export function resetVoice() {
  ctx = initialContext;
  calmedFor = -1;
  rewrites.clear();
  requested.clear();
  lastHeardAt = Date.now();
}

/** Learn from something the rescuer said. Returns true if who we are helping changed. */
export function hearRescuer(text: string): boolean {
  const before = ctx;
  ctx = learn(ctx, text);
  lastHeardAt = Date.now();
  const changed = before.pronoun !== ctx.pronoun || before.relation !== ctx.relation;
  if (changed) {
    rewrites.clear();
    requested.clear();
  }
  return changed;
}

export const voiceContext = () => ctx;
export const sinceHeard = () => Date.now() - lastHeardAt;

/** The form of a line to speak right now. */
export function adaptLine(line: string): string {
  const ai = rewrites.get(line);
  if (ai && audio()?.ready(ai)) return ai;
  return personalize(line, ctx.pronoun);
}

export function say(lines: string[], opts: { calm?: boolean } = {}) {
  if (!getSettings().voice || !lines.length) return Promise.resolve({ start: 0, end: 0 });
  const now = Date.now();
  // The calming line once per panic, not before every step.
  const calm = opts.calm !== false && ctx.stateAt !== calmedFor ? preface(ctx, now) : [];
  if (calm.length) calmedFor = ctx.stateAt;
  const spoken = [...calm, ...lines.map(adaptLine)];
  const rate = voiceRate(ctx, now);
  const a = audio();
  if (a) return a.speak(spoken, { rate });
  // Expo Go (no audio engine): the system voice, one line after another.
  Speech.stop();
  spoken.forEach((l) => Speech.speak(l, { rate: 0.95 * rate, pitch: 0.95 }));
  return Promise.resolve({ start: 0, end: 0 });
}

/**
 * Ask the model (Claude, or a local model on the demo computer) to phrase
 * upcoming lines for this patient. In the background; results that fail
 * checkRewrite are thrown away, and the rest are fetched as audio before use.
 */
let inFlight = false;

export async function prepare(lines: string[]) {
  if (inFlight || !(await capabilities()).adapt) return;
  const todo = [...new Set(lines)].filter((l) => !requested.has(l)).slice(0, 12);
  if (!todo.length) return;
  todo.forEach((l) => requested.add(l));
  const asked = ctx;
  inFlight = true;
  const out = await requestAdaptation({ pronoun: asked.pronoun, relation: asked.relation, state: currentState(asked), lines: todo }).finally(() => {
    inFlight = false;
  });
  if (!out || out.lines.length !== todo.length || asked.pronoun !== ctx.pronoun || asked.relation !== ctx.relation) return;
  const accepted: string[] = [];
  todo.forEach((original, i) => {
    const line = out.lines[i].trim();
    if (line !== original && line !== personalize(original, ctx.pronoun) && checkRewrite(original, line, ctx.pronoun, ctx.relation).ok) {
      rewrites.set(original, line);
      accepted.push(line);
    }
  });
  // Fetch their audio now, so they are ready when their step comes.
  await audio()?.preload(accepted);
}

/** For the demo test hook. */
export const rewriteTable = () => Object.fromEntries(rewrites);
