import * as Speech from 'expo-speech';

import { audio } from '@/audio/engine';
import { adaptLines as requestAdaptation, capabilities } from '@/ai/proxy';
import { localize } from '@/region/store';
import { getSettings } from '@/settings/store';

import { checkRewrite, currentState, initialContext, learn, personalize, preface, voiceRate, type VoiceContext } from './adapt';
import { trace } from './trace';

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
  if (ai && audio()?.ready(ai)) return localize(ai);
  // Then the region's emergency number in place of 911 (each has its own recording).
  return localize(personalize(line, ctx.pronoun));
}

export function say(lines: string[], opts: { calm?: boolean } = {}) {
  if (!getSettings().voice || !lines.length) return Promise.resolve({ start: 0, end: 0 });
  const now = Date.now();
  // The calming line once per panic, not before every step.
  const calm = opts.calm !== false && ctx.stateAt !== calmedFor ? preface(ctx, now) : [];
  if (calm.length) calmedFor = ctx.stateAt;
  const spoken = [...calm, ...lines.map(adaptLine)];
  const rate = voiceRate(ctx, now);
  const engine = audio();
  trace('say', {
    rate,
    calm: calm.length > 0,
    lines: [
      ...calm.map((l) => ({ original: null, spoken: l, how: 'calming line', audio: engine?.has(l) ? 'recorded' : 'system voice' })),
      ...lines.map((l) => {
        const out = adaptLine(l);
        const how = rewrites.get(l) === out ? 'AI rewrite (checked)' : out !== l ? 'personalized' : 'as written';
        return { original: out !== l ? l : null, spoken: out, how, audio: engine?.has(out) ? 'recorded' : engine?.ready(out) ? 'neural voice' : 'system voice' };
      }),
    ],
  });
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
  if (inFlight) return;
  // Claim the slot before the first await, so two calls in the same moment send one request.
  inFlight = true;
  const todo = [...new Set(lines)].filter((l) => !requested.has(l)).slice(0, 12);
  if (!todo.length || !(await capabilities()).adapt) {
    inFlight = false;
    return;
  }
  todo.forEach((l) => requested.add(l));
  const asked = ctx;
  const started = Date.now();
  trace('rewrite-start', { count: todo.length, pronoun: asked.pronoun, relation: asked.relation, state: currentState(asked) });
  const out = await requestAdaptation({ pronoun: asked.pronoun, relation: asked.relation, state: currentState(asked), lines: todo }).finally(() => {
    inFlight = false;
  });
  if (!out || out.lines.length !== todo.length || asked.pronoun !== ctx.pronoun || asked.relation !== ctx.relation) return;
  const accepted: string[] = [];
  const verdicts: { original: string; rewrite: string; ok: boolean; reason: string | null }[] = [];
  todo.forEach((original, i) => {
    const line = out.lines[i].trim();
    const same = line === original || line === personalize(original, ctx.pronoun);
    const verdict = checkRewrite(original, line, ctx.pronoun, ctx.relation);
    verdicts.push({ original, rewrite: line, ok: !same && verdict.ok, reason: same ? 'same as offline' : verdict.ok ? null : verdict.reason });
    if (!same && verdict.ok) {
      rewrites.set(original, line);
      accepted.push(line);
    }
  });
  trace('rewrite', { model: out.model ?? 'model', seconds: Math.round((Date.now() - started) / 100) / 10, verdicts });
  // Fetch their audio now, so they are ready when their step comes.
  await audio()?.preload(accepted);
}

/** For the demo test hook. */
export const rewriteTable = () => Object.fromEntries(rewrites);
