import type { Choice, Step } from '@/protocols/schema';

import { normalizeUtterance, route, type RouteContext } from './router';
import type { RouterOutput } from './routerSchema';

/**
 * Choosing what was said. Speech recognizers return a best guess and a few
 * runners-up, and with an accent the right words are often the second or
 * third guess ("he's not breeding" first, "he's not breathing" second).
 * Mayday takes the recognizer's best guess unless a runner-up is something
 * it can act on and the best guess is not; and a runner-up can never be one
 * that reassures ("he's breathing" behind "he's not breathing"), because a
 * wrong reassurance is the one mistake it must not make.
 */

/** How useful a transcript is: 3 answers what is on screen, 2 is a command or starts help, 1 says something, 0 nothing. */
export type Score = 0 | 1 | 2 | 3;

export function choicesOf(step: Step | null): Choice[] {
  if (!step) return [];
  if (step.kind === 'ask' || step.kind === 'hold' || step.kind === 'end') return step.choices;
  if (step.kind === 'do') return step.alts;
  return [];
}

/** Does this route answer the step on screen (its intent is one of the answers, or it fills the step's question)? */
export function answersStep(r: RouterOutput, step: Step | null): boolean {
  if (!step) return false;
  if (r.intent && choicesOf(step).some((c) => c.intents.includes(r.intent!))) return true;
  if (r.intent === 'next' && (step.kind === 'do' || step.kind === 'timer')) return true;
  return step.kind === 'ask' && !!step.slot && r.slots[step.slot as keyof RouterOutput['slots']] !== undefined;
}

export function reassures(r: RouterOutput): boolean {
  return r.intent === 'yes' || r.intent === 'breathing' || r.intent === 'responsive' || r.slots.breathing === 'normal' || r.slots.conscious === 'true';
}

export function scoreOf(text: string, ctx: RouteContext, step: Step | null, extra: (t: string) => boolean = () => false): Score {
  if (!normalizeUtterance(text)) return 0;
  const r = route(text, ctx);
  if (ctx.inProtocol && answersStep(r, step)) return 3;
  if (!ctx.inProtocol && r.protocol_id && (r.urgent || r.confidence >= 0.7)) return 3;
  if (r.intent || extra(text)) return 2;
  if (r.protocol_id || Object.keys(r.slots).length) return 1;
  return 0;
}

/** The guess to act on: the best guess, unless a runner-up scores higher and does not reassure. */
export function pickHeard(guesses: string[], ctx: RouteContext, step: Step | null, extra?: (t: string) => boolean): { text: string; index: number } {
  let index = 0;
  let best = scoreOf(guesses[0] ?? '', ctx, step, extra);
  for (let i = 1; i < guesses.length; i++) {
    const s = scoreOf(guesses[i], ctx, step, extra);
    if (s > best && !reassures(route(guesses[i], ctx))) {
      best = s;
      index = i;
    }
  }
  return { text: guesses[index] ?? '', index };
}

/**
 * A short answer that can be acted on before the recognizer finishes the
 * sentence: it answers the step on screen and leads to more care (no, not
 * breathing, not responding, done, I'm alone). "Yes" always waits for the
 * whole sentence ("yes... no, wait").
 */
export function quickAnswer(text: string, step: Step | null): boolean {
  const t = normalizeUtterance(text);
  if (!t || t.split(' ').length > 3) return false;
  const r = route(text, { inProtocol: true });
  return !reassures(r) && !!r.intent && ['no', 'not_breathing', 'unresponsive', 'next', 'alone'].includes(r.intent) && answersStep(r, step);
}
